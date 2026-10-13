#!/usr/bin/env python3
"""
Gridlock Master Demo Runner — Multi-Stage Interactive Showcase
Automates the exact hackathon demo sequence with interactive pause controls,
anti-spoofing slashing demonstration, hardware attestation telemetry,
and autonomous AI agent execution bundles on Monad.
"""

import sys
import os
import time
import argparse

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
    HAS_RICH = True
    console = Console()
except ImportError:
    HAS_RICH = False
    console = None


def pause_if_interactive(interactive: bool):
    if interactive:
        if HAS_RICH:
            console.print("[dim cyan]--> Press Enter to advance to next stage...[/dim cyan]", end="")
            input()
        else:
            input("--> Press Enter to advance to next stage...")


def stage_banner(step_num: int, title: str, fast: bool = False):
    if HAS_RICH:
        console.print()
        console.print(Panel(
            f"[bold white]STAGE {step_num}: {title.upper()}[/bold white]",
            style="bold magenta",
            border_style="magenta",
            padding=(0, 2)
        ))
    else:
        print(f"\n==================================================")
        print(f"STAGE {step_num}: {title.upper()}")
        print(f"==================================================")
    if not fast:
        time.sleep(0.8)


def run_slashing_focus(interactive: bool = False, fast: bool = False):
    if HAS_RICH:
        console.clear()
        console.print(Panel.fit(
            "[bold red]GRIDLOCK RAPID ANTI-SPOOFING & SLASHING DEMONSTRATION[/bold red]\n"
            "[white]Showcasing Cryptographic Hardware Proofs & 1-Block Atomic Bond Slashing (400ms)[/white]",
            border_style="red"
        ))
    else:
        print("\n--- GRIDLOCK RAPID ANTI-SPOOFING & SLASHING DEMONSTRATION ---")

    stage_banner(1, "Adversarial Hardware Spoofing Attempt", fast)
    print("Provider registers node claiming: NVIDIA A100 SXM4 (312 TFLOPS rated)")
    print("Provider stakes 120% collateral bond: 6.36 gUSD in DeliveryEscrow.sol")
    print("Under the hood: Provider physically connects a low-tier NVIDIA T4 GPU (8.1 TFLOPS)")
    pause_if_interactive(interactive)

    stage_banner(2, "In-Pod Challenge & Benchmark Probe", fast)
    print("In-pod benchmark agent executes deterministic matrix challenge (N=4096, 4 steps)...")
    print("PCR0 Driver measurement: 550.54.14:12.4")
    print("PCR2 Hardware identity: GPU-00000000-0000-0000-0000-000000000000 (SMs: 40)")
    print("Measured FP16 Tensor Throughput: 8.15 TFLOPS (Threshold required: >= 156.0 TFLOPS)")
    pause_if_interactive(interactive)

    stage_banner(3, "Verifier Verdict & Atomic Monad Slashing", fast)
    if HAS_RICH:
        fail_receipt = Table(title="Hardware Verification Receipt (SPOOFING DETECTED)", border_style="red")
        fail_receipt.add_column("Property", style="dim")
        fail_receipt.add_column("Value", style="bold")
        fail_receipt.add_row("Delivery ID", "#429")
        fail_receipt.add_row("Claimed Class", "A100 SXM4 (Rated 312.0 TF)")
        fail_receipt.add_row("Detected Hardware", "NVIDIA Tesla T4 (40 SMs, Compute 7.5)")
        fail_receipt.add_row("Measured Throughput", "[bold red]8.15 TFLOPS (FAIL: < 50% Threshold)[/bold red]")
        fail_receipt.add_row("Protocol Verdict", "[bold red]FAIL (Verdict Code 3)[/bold red]")
        fail_receipt.add_row("Slashing Action", "[bold red]100% OF 120% COLLATERAL BOND SLASHED TO BUYER[/bold red]")
        fail_receipt.add_row("Buyer Payout", "6.36 gUSD Bond + 5.30 gUSD Refund = 11.66 gUSD")
        fail_receipt.add_row("Provider Payout", "0.00 gUSD")
        fail_receipt.add_row("Settlement Latency", "1 Monad Block (400ms finality)")
        console.print(fail_receipt)
    else:
        print("[VERDICT: FAIL] Hardware spoofing detected! Measured 8.15 TFLOPS vs 312.0 rated.")
        print("[SLASHED] 100% of provider's 120% bond (6.36 gUSD) awarded to buyer.")

    print("\n[Done] Atomic Slashing Demonstration Complete.")


def run_full_demo(interactive: bool = False, fast: bool = False):
    if HAS_RICH:
        console.clear()
        console.print(Panel.fit(
            "[bold cyan]GRIDLOCK PROTOCOL DEMONSTRATION[/bold cyan]\n"
            "[white]Physically Delivered GPU-Hour Forwards Settled on Proof (Monad Metropolis Track 01)[/white]\n"
            "[dim]Network: Monad Testnet (10143) | Interactive Mode: " + str(interactive) + "[/dim]",
            border_style="cyan"
        ))
    else:
        print("=== GRIDLOCK PROTOCOL DEMONSTRATION ===")

    # Stage 1: Market Need & Forward Curve
    stage_banner(1, "Live Forward Compute Curve on Monad", fast)
    if HAS_RICH:
        table = Table(title="Live Forward Compute Curve (Monad)", border_style="cyan")
        table.add_column("Series", style="bold white")
        table.add_column("Hardware Class", style="dim")
        table.add_column("Delivery Window", style="dim")
        table.add_column("Index Price", style="bold yellow")
        table.add_column("Bond (120%)", style="bold green")

        table.add_row("gT4-NOW", "Tesla T4 (FP16 8.1 TF)", "Week 42 (Immediate)", "$0.35 / hr", "0.42 gUSD")
        table.add_row("gA100-W43", "A100 SXM4 (FP16 312 TF)", "Week 43 (Oct 21-28)", "$1.80 / hr", "2.16 gUSD")
        table.add_row("gH100-W43", "H100 SXM (FP16 989 TF)", "Week 43 (Oct 21-28)", "$2.65 / hr", "3.18 gUSD")
        table.add_row("gH100-W44", "H100 SXM (FP16 989 TF)", "Week 44 (Oct 28-Nov 4)", "$2.72 / hr", "3.26 gUSD")
        console.print(table)
    else:
        print("Forward Curve: gT4-NOW ($0.35/hr), gA100-W43 ($1.80/hr), gH100-W43 ($2.65/hr)")
    pause_if_interactive(interactive)

    # Stage 2: Biometric Passkey Login
    stage_banner(2, "Mera Passkey Biometric Authentication & PRF Derivation", fast)
    print("[OK] Prompting WebAuthn PRF Passkey TouchID / FaceID...")
    print("[OK] Passkey PRF Output Derived: 0x4f8b91c...2a (32 bytes)")
    print("[OK] X25519 Encryption Public Key: 0x084d0a346cc2319b7296cf8ead6caf97b330d1ec864260453ef43903d94be158")
    print("[OK] Scoped Session: Trading Only (Max 500 gUSD) -- Zero Popups")
    pause_if_interactive(interactive)

    # Stage 3: Autonomous Compute Arbitrageur Agent
    stage_banner(3, "Autonomous Compute Trader Agent (MetaMask Agent Skill)", fast)
    print("Agent scans Kuru order book vs Ornn spot oracle...")
    print("  Detected Forward Discount: gH100-W43 trading at $2.49/hr vs $2.65/hr spot (6.0% discount)")
    print("  Guard Mode Budget Check: [APPROVED] (Est. Cost: $19.92 USD <= $500.00 Limit)")
    print("  Multi-step proposal formatted: Approve -> Kuru Buy -> Escrow Redeem")
    pause_if_interactive(interactive)

    # Stage 4: Provider Minting
    stage_banner(4, "Provider Mints Hours with 120% Collateral Bond", fast)
    print("Provider deposits 4.20 gUSD bond into DeliveryEscrow.sol")
    print("[OK] Minted: 10.000 gT4-NOW (Tx: 0x8e1a...43)")
    print("[OK] Kuru Order Book: Asks placed at 0.355, 0.360, 0.365 gUSD")
    pause_if_interactive(interactive)

    # Stage 5: Buyer Fills Order on Kuru
    stage_banner(5, "Buyer Executes Market Order on Kuru DEX", fast)
    print("Buyer purchases 1 GPU-Hour of gT4-NOW via IOC Market Order")
    print("[OK] Kuru Trade Filled: 1 hour @ 0.355 gUSD (Monad 1-block finality: 400ms)")
    pause_if_interactive(interactive)

    # Stage 6: Confidential Pod Credential Delivery
    stage_banner(6, "Redeem & Mera PRF Credential Delivery", fast)
    print("Buyer calls DeliveryEscrow.redeem with derived X25519 encryption key.")
    print("Provider encrypts SSH key using ChaCha20-Poly1305 onchain.")
    print("Buyer decrypts credentials in-memory:")
    if HAS_RICH:
        creds_panel = Panel(
            "[bold green]HOST:[/bold green] 34.125.82.10:22\n"
            "[bold green]USER:[/bold green] root\n"
            "[bold green]AUTH:[/bold green] ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... (Decrypted in-memory)\n"
            "[bold yellow]VERIFICATION CMD:[/bold yellow] gridlock-verify --api https://verifier.gridlock.network --delivery 1 --gpu-class T4",
            title="Decrypted Machine Access Credentials",
            border_style="green"
        )
        console.print(creds_panel)
    else:
        print("  Host: 34.125.82.10:22 | User: root | Auth: ssh-ed25519 (Decrypted in-memory)")
    pause_if_interactive(interactive)

    # Stage 7: Hardware Attestation & Anti-vGPU Probe
    stage_banner(7, "Confidential Hardware Attestation & Anti-vGPU Probe", fast)
    print("Pod executes hardware environment measurements:")
    print("  PCR0 Driver & Toolchain: 0xf2fadc8d... (Driver 550.54.14, CUDA 12.4)")
    print("  PCR1 Kernel & OS:        0x4a91c01b... (Linux 6.8.0-40-generic x86_64)")
    print("  PCR2 Hardware Identity:  0xd38914ba... (Tesla T4, 40 SMs)")
    print("  Anti-vGPU Jitter Probe:  [CLEAN] (Latency variance 2.4% <= 25.0% threshold)")
    print("  Cryptographic Binding:   BoundRoot = keccak256(ResultRoot || AttestationHash)")
    pause_if_interactive(interactive)

    # Stage 8: In-Pod Verifier PASS Test
    stage_banner(8, "In-Pod Hardware Verification: PASS Test", fast)
    if HAS_RICH:
        pass_receipt = Table(title="Hardware Verification Receipt (PASS)", border_style="green")
        pass_receipt.add_column("Property", style="dim")
        pass_receipt.add_column("Value", style="bold")
        pass_receipt.add_row("Delivery ID", "#1")
        pass_receipt.add_row("Claimed Class", "T4")
        pass_receipt.add_row("Detected Hardware", "NVIDIA Tesla T4 (Compute 7.5, 40 SMs, 16GB VRAM)")
        pass_receipt.add_row("PCIe H2D / D2H Bandwidth", "12.4 GB/s / 11.8 GB/s (Gen3 x16 Verified)")
        pass_receipt.add_row("FP16 Dense Matmul", "8.15 TFLOPS (Rated: 8.1 TFLOPS)")
        pass_receipt.add_row("Status & Verdict", "[bold green]PASS (100% Bond Released to Provider)[/bold green]")
        pass_receipt.add_row("EIP-712 Signature", "0xa0e120220d183102435f49ae8c12fae04ea4cb1c...")
        console.print(pass_receipt)
    else:
        print("[VERDICT: PASS] 8.15 TFLOPS. 100% Bond released to provider.")
    pause_if_interactive(interactive)

    # Stage 9: Anti-Spoofing & Atomic Slashing
    stage_banner(9, "Anti-Spoofing & Atomic Slashing: FAIL Test", fast)
    print("Malicious provider advertises T4 machine as A100 SXM4 ($1.80/hr)...")
    print("Measured throughput: 8.15 TFLOPS (< 50% of 312 TFLOPS threshold)")
    if HAS_RICH:
        fail_receipt = Table(title="Hardware Verification Receipt (SPOOFING DETECTED)", border_style="red")
        fail_receipt.add_column("Property", style="dim")
        fail_receipt.add_column("Value", style="bold")
        fail_receipt.add_row("Delivery ID", "#2")
        fail_receipt.add_row("Claimed Class", "A100 SXM4 (Requires >= 156.0 TFLOPS)")
        fail_receipt.add_row("Measured Throughput", "[bold red]8.15 TFLOPS (FAIL: < 50% Threshold)[/bold red]")
        fail_receipt.add_row("Protocol Action", "[bold red]FAIL -- 100% OF 120% BOND SLASHED TO BUYER[/bold red]")
        fail_receipt.add_row("Slashing Settlement", "Buyer Refund: 2.16 gUSD | Provider Payout: 0.00 gUSD")
        fail_receipt.add_row("Settlement Latency", "1 Monad Block (Atomic Finality: 400ms)")
        console.print(fail_receipt)
    else:
        print("[VERDICT: FAIL] 100% OF 120% BOND SLASHED TO BUYER in 1 Monad block.")
    pause_if_interactive(interactive)

    # Stage 10: Real-Time WebSockets & Chainlink CRE DON
    stage_banner(10, "Real-Time Telemetry & Dual-Path Settlement", fast)
    print("[OK] WebSocket Stream: /ws/verify/1 streaming live 60fps GFLOPS and Merkle row proofs")
    print("[OK] Prometheus Metrics: /metrics exposed for institutional node monitors")
    print("[OK] Chainlink CRE: DON nodes reach consensus on /cre/verdict/1 -> DeliveryEscrow.onReport")
    print("[OK] Direct EIP-712: settleWithSig executes in sub-second Monad block")
    pause_if_interactive(interactive)

    if HAS_RICH:
        console.print()
        console.print(Panel.fit(
            "[bold green]DEMONSTRATION COMPLETE[/bold green]\n"
            "[white]Forward Compute, Settled on Cryptographic Proof. Built on Monad.[/white]",
            border_style="green"
        ))
    else:
        print("\n=== DEMONSTRATION COMPLETE ===")


def main():
    parser = argparse.ArgumentParser(description="Gridlock Protocol Master Demo Runner")
    parser.add_argument("--interactive", action="store_true", help="Pause between stages for live demo presentation")
    parser.add_argument("--focus-slashing", action="store_true", help="Fast-forward directly to the anti-spoofing slashing test")
    parser.add_argument("--fast", action="store_true", help="Run without simulated sleep delays")
    args = parser.parse_args()

    if args.focus_slashing:
        run_slashing_focus(interactive=args.interactive, fast=args.fast)
    else:
        run_full_demo(interactive=args.interactive, fast=args.fast)


if __name__ == "__main__":
    main()
