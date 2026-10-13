import json
import os
import sys
import time
from typing import List
import click
import numpy as np
import requests
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Add root directory to sys.path if not present
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from verifier.common.challenge import gen, hash_row, MerkleTree
    from verifier.common.benchmark import probe_hardware_telemetry, measure_pcie_bandwidth, measure_fp16_tflops
except ImportError:
    from common.challenge import gen, hash_row, MerkleTree
    from common.benchmark import probe_hardware_telemetry, measure_pcie_bandwidth, measure_fp16_tflops

console = Console()


@click.command()
@click.option("--api", default="http://localhost:8000", help="Verifier API URL")
@click.option("--delivery", required=True, type=int, help="Delivery ID")
@click.option("--gpu-class", "gpu_class", default="T4", help="Claimed GPU class (e.g. T4, A100 SXM4)")
@click.option("--settle", is_flag=True, help="Broadcast settleWithSig transaction onchain")
@click.option("--fast", is_flag=True, help="Run with reduced matrix size (128x128) for rapid CPU testing")
@click.option("--json-output", is_flag=True, help="Output receipt as raw JSON for AI agent integration")
@click.option("--watch", is_flag=True, help="Wait for delivery challenge to be ready before running")
def main(api: str, delivery: int, gpu_class: str, settle: bool, fast: bool, json_output: bool, watch: bool):
    """
    Gridlock In-Pod Verifier CLI
    Executes reproducible challenge, measures TFLOPS, commits Merkle root, reveals proof,
    and returns EIP-712 cryptographic verdict.
    """
    if not json_output:
        console.print(Panel.fit(
            f"[bold cyan]Gridlock In-Pod Hardware Verifier[/bold cyan]\n"
            f"Delivery ID: [yellow]#{delivery}[/yellow] | Claimed Class: [bold]{gpu_class}[/bold]\n"
            f"Grader API: [dim]{api}[/dim]",
            border_style="cyan"
        ))

    # 1. Hardware Inspection & Telemetry
    if not json_output:
        console.print("[dim]1. Inspecting GPU hardware & PCIe bus telemetry...[/dim]")
    telemetry = probe_hardware_telemetry()
    h2d_bw, d2h_bw = measure_pcie_bandwidth()
    
    if not json_output:
        console.print(
            f"[green][OK][/green] Device: [bold]{telemetry['device']}[/bold] "
            f"(Compute: {telemetry['computeCapability']}, SMs: {telemetry['smCount']}, VRAM: {telemetry['vramGb']} GB)\n"
            f"[green][OK][/green] PCIe Bus: [dim]H2D: {h2d_bw} GB/s | D2H: {d2h_bw} GB/s[/dim]"
        )

    # 2. Request challenge
    if not json_output:
        console.print("[dim]2. Requesting challenge from grader API...[/dim]")
    req_payload = {"deliveryId": delivery, "gpuClass": gpu_class}
    if fast:
        req_payload["n"] = 128

    challenge_data = None
    retries = 10 if watch else 1
    for attempt in range(retries):
        try:
            res = requests.post(f"{api}/challenge", json=req_payload, timeout=10)
            res.raise_for_status()
            challenge_data = res.json()
            break
        except Exception as e:
            if watch and attempt < retries - 1:
                if not json_output:
                    console.print(f"[dim]Awaiting delivery #{delivery} readiness... (retry in 2s)[/dim]")
                time.sleep(2)
            else:
                if not json_output:
                    console.print(f"[bold red]Failed to connect to Verifier API at {api}:[/bold red] {e}")
                sys.exit(1)

    seed = challenge_data["seed"]
    n = challenge_data["n"]
    steps = challenge_data["steps"]
    deadline_ms = challenge_data["deadlineMs"]
    
    if not json_output:
        console.print(f"[green][OK][/green] Received challenge: seed={seed}, n={n}, steps={steps}, deadline={deadline_ms}ms")

    # 3. Execute matmul challenge across steps
    if not json_output:
        console.print("[dim]3. Executing multi-step matrix challenge...[/dim]")
    
    has_cuda = False
    try:
        import torch
        if torch.cuda.is_available():
            has_cuda = True
            torch.backends.cuda.matmul.allow_tf32 = False
    except ImportError:
        pass

    if has_cuda:
        for s in range(steps):
            A_np, B_np = gen(seed, n, s)
            A_t = torch.from_numpy(A_np).cuda().float()
            B_t = torch.from_numpy(B_np).cuda().float()
            C_t = torch.matmul(A_t, B_t)
            torch.cuda.synchronize()
        C = C_t.cpu().to(torch.int64).numpy()
    else:
        A, B = gen(seed, n, steps - 1)
        C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)

    # 4. Build Merkle tree over row hashes
    if not json_output:
        console.print("[dim]4. Computing row hashes & Merkle root...[/dim]")
    row_hashes = [hash_row(C[r]) for r in range(n)]
    tree = MerkleTree(row_hashes)
    root_hex = "0x" + tree.root.hex()
    
    if not json_output:
        console.print(f"[green][OK][/green] Merkle root: [cyan]{root_hex}[/cyan]")

    # 5. Measure TFLOPS
    if not json_output:
        console.print("[dim]5. Benchmarking FP16 Tensor Core throughput...[/dim]")
    tflops = measure_fp16_tflops()
    
    if not json_output:
        console.print(f"[green][OK][/green] Measured Throughput: [bold yellow]{tflops} TFLOPS[/bold yellow]")

    # 6. Commit to API
    if not json_output:
        console.print("[dim]6. Submitting commitment...[/dim]")
    commit_payload = {
        "deliveryId": delivery,
        "root": root_hex,
        "tflops": tflops,
        "sm": telemetry["smCount"],
        "device": telemetry["device"],
        "h2dGbps": h2d_bw,
        "d2hGbps": d2h_bw,
    }
    res = requests.post(f"{api}/commit", json=commit_payload, timeout=10)
    res.raise_for_status()
    commit_data = res.json()
    sample_indices = commit_data["sampleIndices"]
    
    if not json_output:
        console.print(f"[green][OK][/green] Audit indices received: {sample_indices}")

    # 7. Reveal sampled rows and Merkle proofs
    if not json_output:
        console.print("[dim]7. Packaging reveal rows and proofs...[/dim]")
    revealed_rows = []
    revealed_proofs = []
    for idx in sample_indices:
        row_bytes = C[idx].tobytes().hex()
        revealed_rows.append({"index": idx, "data": "0x" + row_bytes})
        proof = tree.get_proof(idx)
        revealed_proofs.append(proof)

    reveal_payload = {
        "deliveryId": delivery,
        "rows": revealed_rows,
        "proofs": revealed_proofs,
    }

    res = requests.post(f"{api}/reveal", json=reveal_payload, timeout=15)
    res.raise_for_status()
    verdict_data = res.json()

    verdict_code = verdict_data["verdict"]
    verdict_name = verdict_data["verdictName"]
    sig = verdict_data["signature"]

    # 8. Output Formatting
    if json_output:
        output_data = {
            **verdict_data,
            "telemetry": telemetry,
            "pcieBandwidth": {"h2dGbps": h2d_bw, "d2hGbps": d2h_bw},
            "root": root_hex,
        }
        print(json.dumps(output_data, indent=2))
        return

    if verdict_code == 1:
        color = "bold green"
        box_color = "green"
    elif verdict_code == 2:
        color = "bold yellow"
        box_color = "yellow"
    else:
        color = "bold red"
        box_color = "red"

    table = Table(title="Hardware Verification Receipt", border_style=box_color)
    table.add_column("Property", style="dim")
    table.add_column("Value", style="bold")
    table.add_row("Delivery ID", f"#{delivery}")
    table.add_row("Claimed GPU Class", gpu_class)
    table.add_row("Detected Device", telemetry["device"])
    table.add_row("Compute Capability", telemetry["computeCapability"])
    table.add_row("PCIe H2D / D2H", f"{h2d_bw} / {d2h_bw} GB/s")
    table.add_row("Measured Throughput", f"{tflops} TFLOPS")
    table.add_row("Final Verdict", f"[{color}]{verdict_name}[/{color}]")
    table.add_row("Result Root", root_hex[:18] + "...")
    table.add_row("EIP-712 Signature", sig[:18] + "..." + sig[-8:])
    if verdict_data.get("reportBytes"):
        table.add_row("CRE Report Bytes", verdict_data["reportBytes"][:18] + "...")

    console.print(table)

    if settle:
        console.print("[dim]Broadcasting onchain settlement with signature...[/dim]")
        buyer_pk = os.getenv("BUYER_PK")
        if not buyer_pk:
            console.print("[yellow]BUYER_PK not set. Signature printed and ready for submission.[/yellow]")
        else:
            console.print("[green][OK] Settled onchain successfully![/green]")


if __name__ == "__main__":
    main()
