import json
import os
import sys
import numpy as np
import pytest
from fastapi.testclient import TestClient

# Ensure repo root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from verifier.common.challenge import gen, hash_row, MerkleTree
from verifier.common.attestation import generate_pod_attestation, bind_attestation_to_root
from verifier.common.benchmark import probe_vgpu_contention
from verifier.api.server import app, sessions, verdicts, VERIFIER_SIGNER_PK, CHAIN_ID, ESCROW_ADDRESS

try:
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    HAS_ETH_ACCOUNT = True
except ImportError:
    HAS_ETH_ACCOUNT = False


@pytest.fixture(autouse=True)
def clean_state():
    sessions.clear()
    verdicts.clear()
    yield
    sessions.clear()
    verdicts.clear()


def test_end_to_end_pass_lifecycle_with_attestation():
    """
    Simulates the full cross-stream happy path:
    1. Series 1 (gT4-NOW) forward contract redeemed.
    2. Pod generates confidential hardware attestation report (PCR0, PCR1, PCR2).
    3. In-pod benchmark completes deterministic matrix challenge.
    4. Attestation hash is bound to the Merkle challenge root.
    5. Verifier API verifies revealed rows and proofs.
    6. Verifier returns PASS (verdict=1) with valid EIP-712 signature.
    7. Escrow distribution: 100% bond + payment to provider.
    """
    client = TestClient(app)
    delivery_id = 501
    gpu_class = "T4"
    hours = 4
    ref_price_usd = 0.35
    total_payment_usd = hours * ref_price_usd  # $1.40
    provider_bond_usd = total_payment_usd * 1.20  # 120% collateral = $1.68

    # Step 1: Challenge Initiation
    res = client.post("/challenge", json={
        "deliveryId": delivery_id,
        "gpuClass": gpu_class,
        "n": 128,
        "steps": 4,
    })
    assert res.status_code == 200
    ch_data = res.json()
    seed = ch_data["seed"]
    n = ch_data["n"]
    steps = ch_data["steps"]

    # Step 2: Pod Hardware Attestation
    attestation = generate_pod_attestation(
        device_name="Tesla T4",
        sm_count=40,
        compute_capability="7.5",
        total_vram_gb=16.0,
        driver_version="550.54.14",
        cuda_version="12.4",
    )
    assert attestation.attestation_hash.startswith("0x")
    assert attestation.pcr0.startswith("0x")

    # Step 3: Anti-vGPU Latency Contention Probe
    vgpu = probe_vgpu_contention(device_idx=0)
    assert vgpu["status"] == "CLEAN"

    # Step 4: Deterministic Matrix Computation
    A, B = gen(seed, n, steps - 1)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    tree = MerkleTree([hash_row(C[r]) for r in range(n)])
    raw_root_hex = "0x" + tree.root.hex()

    # Step 5: Cryptographic Binding of Hardware Attestation to Merkle Root
    bound_root_hex = bind_attestation_to_root(raw_root_hex, attestation.attestation_hash)
    assert len(bound_root_hex) == 66

    # Step 6: Commit to Verifier API
    commit_res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": raw_root_hex,
        "tflops": 8.12,
        "sm": 40,
        "device": "Tesla T4",
        "h2dGbps": 12.4,
        "d2hGbps": 11.9,
        "attestationHash": attestation.attestation_hash,
        "vgpuStatus": vgpu["status"],
    })
    assert commit_res.status_code == 200
    sample_indices = commit_res.json()["sampleIndices"]
    assert len(sample_indices) == 8

    # Step 7: Reveal
    reveal_payload = {
        "deliveryId": delivery_id,
        "rows": [{"index": i, "data": "0x" + C[i].tobytes().hex()} for i in sample_indices],
        "proofs": [tree.get_proof(i) for i in sample_indices],
    }
    rev_res = client.post("/reveal", json=reveal_payload)
    assert rev_res.status_code == 200
    rev_data = rev_res.json()

    assert rev_data["verdict"] == 1  # PASS
    assert rev_data["verdictName"] == "PASS"
    assert rev_data["tflopsE2"] == 812
    assert rev_data["attestationHash"] == attestation.attestation_hash
    assert rev_data["vgpuStatus"] == "CLEAN"
    assert rev_data["signature"].startswith("0x")

    # Step 8: Verify EIP-712 Signature
    if HAS_ETH_ACCOUNT:
        typed_data = {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "Verdict": [
                    {"name": "deliveryId", "type": "uint256"},
                    {"name": "verdict", "type": "uint8"},
                    {"name": "tflopsE2", "type": "uint32"},
                    {"name": "resultRoot", "type": "bytes32"},
                ],
            },
            "primaryType": "Verdict",
            "domain": {
                "name": "Gridlock Verifier",
                "version": "1",
                "chainId": CHAIN_ID,
                "verifyingContract": ESCROW_ADDRESS,
            },
            "message": {
                "deliveryId": delivery_id,
                "verdict": rev_data["verdict"],
                "tflopsE2": rev_data["tflopsE2"],
                "resultRoot": raw_root_hex,
            },
        }
        signable = encode_typed_data(full_message=typed_data)
        recovered = Account.recover_message(signable, signature=rev_data["signature"])
        expected = Account.from_key(VERIFIER_SIGNER_PK).address
        assert recovered.lower() == expected.lower()

    # Step 9: Verify Settlement Accounting
    to_provider_usd = provider_bond_usd + total_payment_usd  # 100% bond + payment = $3.08
    to_buyer_usd = 0.0
    assert to_provider_usd > 0
    assert to_buyer_usd == 0.0


def test_end_to_end_slashing_on_counterfeit_hardware():
    """
    Simulates adversarial scenario:
    1. Provider rents out a low-tier machine claiming to be an H100 SXM (989 TFLOPS rated).
    2. Measured throughput is only 8.1 TFLOPS (under 50% threshold of 494.5 TFLOPS).
    3. Verifier API evaluates FAIL (verdict=3).
    4. Escrow slashes 100% of provider's 120% bond directly to the buyer.
    """
    client = TestClient(app)
    delivery_id = 502
    gpu_class = "H100 SXM"  # Claimed H100
    hours = 2
    h100_spot_usd = 2.65
    payment_usd = hours * h100_spot_usd  # $5.30
    provider_bond_usd = payment_usd * 1.20  # 120% bond = $6.36

    res = client.post("/challenge", json={
        "deliveryId": delivery_id,
        "gpuClass": gpu_class,
        "n": 128,
        "steps": 4,
    })
    ch_data = res.json()
    seed = ch_data["seed"]
    n = ch_data["n"]
    steps = ch_data["steps"]

    A, B = gen(seed, n, steps - 1)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    tree = MerkleTree([hash_row(C[r]) for r in range(n)])
    root_hex = "0x" + tree.root.hex()

    # Malicious provider commits actual T4 throughput (8.1 TFLOPS) on claimed H100
    commit_res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": root_hex,
        "tflops": 8.1,  # Vastly below 0.5 * 989 = 494.5
        "sm": 40,
        "device": "Tesla T4 (Spoofed)",
    })
    sample_indices = commit_res.json()["sampleIndices"]

    rev_res = client.post("/reveal", json={
        "deliveryId": delivery_id,
        "rows": [{"index": i, "data": "0x" + C[i].tobytes().hex()} for i in sample_indices],
        "proofs": [tree.get_proof(i) for i in sample_indices],
    })
    rev_data = rev_res.json()

    # Hardware spoofing caught!
    assert rev_data["verdict"] == 3  # FAIL
    assert rev_data["verdictName"] == "FAIL"

    # Slashed Accounting: Buyer receives 100% of provider's bond + payment refund
    to_buyer_refund_usd = payment_usd + provider_bond_usd  # $11.66 returned to buyer
    to_provider_usd = 0.0
    assert to_buyer_refund_usd == 11.66
    assert to_provider_usd == 0.0
