import os
import sys
import numpy as np
import pytest
from fastapi.testclient import TestClient

# Ensure repo root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from verifier.common.challenge import gen, hash_row, MerkleTree
from verifier.api.server import app, sessions, verdicts


@pytest.fixture(autouse=True)
def clean_state():
    sessions.clear()
    verdicts.clear()
    yield
    sessions.clear()
    verdicts.clear()


def test_reproducible_matrix_generation():
    seed = 42
    n = 256
    step = 0
    A1, B1 = gen(seed, n, step)
    A2, B2 = gen(seed, n, step)

    assert np.array_equal(A1, A2), "Matrix A must be bit-identical across runs"
    assert np.array_equal(B1, B2), "Matrix B must be bit-identical across runs"
    assert A1.shape == (n, n)
    assert np.all(A1 >= -8) and np.all(A1 <= 8)


def test_merkle_tree_proof_verification():
    seed = 99
    n = 64
    A, B = gen(seed, n, 0)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)

    row_hashes = [hash_row(C[r]) for r in range(n)]
    tree = MerkleTree(row_hashes)
    root = tree.root

    assert len(root) == 32

    # Verify proof for leaf 7
    idx = 7
    proof = tree.get_proof(idx)
    assert MerkleTree.verify_proof(row_hashes[idx], proof, idx, root)

    # Corrupt leaf and assert verification fails
    fake_leaf = b"\x00" * 32
    assert not MerkleTree.verify_proof(fake_leaf, proof, idx, root)


def test_api_full_pass_lifecycle():
    client = TestClient(app)

    # 1. Challenge with n=128 for instant CPU testing
    delivery_id = 101
    res = client.post("/challenge", json={"deliveryId": delivery_id, "gpuClass": "T4", "n": 128})
    assert res.status_code == 200
    ch_data = res.json()
    seed = ch_data["seed"]
    n = ch_data["n"]
    steps = ch_data["steps"]

    # 2. Compute last step locally
    A, B = gen(seed, n, steps - 1)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    row_hashes = [hash_row(C[r]) for r in range(n)]
    tree = MerkleTree(row_hashes)
    root_hex = "0x" + tree.root.hex()

    # 3. Commit with valid TFLOPS (8.1 TFLOPS for T4)
    res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": root_hex,
        "tflops": 8.1,
        "sm": 40,
        "device": "Tesla T4"
    })
    assert res.status_code == 200
    sample_indices = res.json()["sampleIndices"]
    assert len(sample_indices) == 8

    # 4. Reveal
    rows = []
    proofs = []
    for idx in sample_indices:
        row_hex = "0x" + C[idx].tobytes().hex()
        rows.append({"index": idx, "data": row_hex})
        proofs.append(tree.get_proof(idx))

    res = client.post("/reveal", json={
        "deliveryId": delivery_id,
        "rows": rows,
        "proofs": proofs
    })
    assert res.status_code == 200
    rev_data = res.json()
    assert rev_data["verdict"] == 1  # PASS
    assert rev_data["verdictName"] == "PASS"
    assert rev_data["tflopsE2"] == 810
    assert rev_data["signature"].startswith("0x")


def test_api_fail_on_spoofed_class():
    client = TestClient(app)

    # Claiming A100 SXM4 (rated 312 TFLOPS) but delivering only 8.1 TFLOPS
    delivery_id = 102
    res = client.post("/challenge", json={"deliveryId": delivery_id, "gpuClass": "A100 SXM4", "n": 128})
    assert res.status_code == 200
    ch_data = res.json()
    seed = ch_data["seed"]
    n = ch_data["n"]
    steps = ch_data["steps"]

    A, B = gen(seed, n, steps - 1)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    row_hashes = [hash_row(C[r]) for r in range(n)]
    tree = MerkleTree(row_hashes)
    root_hex = "0x" + tree.root.hex()

    res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": root_hex,
        "tflops": 8.1,  # Way below 0.5 * 312 = 156
        "sm": 40,
        "device": "Tesla T4"
    })
    assert res.status_code == 200
    sample_indices = res.json()["sampleIndices"]

    rows = []
    proofs = []
    for idx in sample_indices:
        row_hex = "0x" + C[idx].tobytes().hex()
        rows.append({"index": idx, "data": row_hex})
        proofs.append(tree.get_proof(idx))

    res = client.post("/reveal", json={
        "deliveryId": delivery_id,
        "rows": rows,
        "proofs": proofs
    })
    assert res.status_code == 200
    rev_data = res.json()
    assert rev_data["verdict"] == 3  # FAIL
    assert rev_data["verdictName"] == "FAIL"


def test_eip712_signature_recovery():
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    from verifier.api.server import VERIFIER_SIGNER_PK, CHAIN_ID, ESCROW_ADDRESS

    client = TestClient(app)
    delivery_id = 103
    res = client.post("/challenge", json={"deliveryId": delivery_id, "gpuClass": "T4", "n": 64})
    ch_data = res.json()
    seed = ch_data["seed"]
    n = ch_data["n"]
    steps = ch_data["steps"]

    A, B = gen(seed, n, steps - 1)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    tree = MerkleTree([hash_row(C[r]) for r in range(n)])
    root_hex = "0x" + tree.root.hex()

    res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": root_hex,
        "tflops": 8.1,
        "sm": 40,
        "device": "Tesla T4"
    })
    sample_indices = res.json()["sampleIndices"]

    rows = [{"index": idx, "data": "0x" + C[idx].tobytes().hex()} for idx in sample_indices]
    proofs = [tree.get_proof(idx) for idx in sample_indices]

    res = client.post("/reveal", json={
        "deliveryId": delivery_id,
        "rows": rows,
        "proofs": proofs
    })
    rev_data = res.json()
    signature = rev_data["signature"]

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
            "resultRoot": root_hex,
        },
    }

    signable = encode_typed_data(full_message=typed_data)
    recovered_address = Account.recover_message(signable, signature=signature)
    expected_address = Account.from_key(VERIFIER_SIGNER_PK).address

    assert recovered_address.lower() == expected_address.lower(), "Signature must recover to verifier signer address"


def test_cre_don_endpoint_and_idempotency():
    client = TestClient(app)
    delivery_id = 104

    # 1. Challenge, commit, reveal
    res = client.post("/challenge", json={"deliveryId": delivery_id, "gpuClass": "T4", "n": 64})
    ch_data = res.json()
    A, B = gen(ch_data["seed"], 64, 3)
    C = (A.astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
    tree = MerkleTree([hash_row(C[r]) for r in range(64)])
    root_hex = "0x" + tree.root.hex()

    commit_res = client.post("/commit", json={
        "deliveryId": delivery_id,
        "root": root_hex,
        "tflops": 8.1,
        "sm": 40,
        "device": "Tesla T4",
        "h2dGbps": 12.0,
        "d2hGbps": 11.5,
    })
    assert commit_res.status_code == 200
    sample_indices = commit_res.json()["sampleIndices"]

    reveal_payload = {
        "deliveryId": delivery_id,
        "rows": [{"index": i, "data": "0x" + C[i].tobytes().hex()} for i in sample_indices],
        "proofs": [tree.get_proof(i) for i in sample_indices],
    }
    res1 = client.post("/reveal", json=reveal_payload)
    assert res1.status_code == 200
    data1 = res1.json()

    # 2. Idempotency test: calling reveal again returns cached result
    res2 = client.post("/reveal", json=reveal_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data1["signature"] == data2["signature"]
    assert data1["verdict"] == data2["verdict"]

    # 3. CRE DON Endpoint test
    cre_res = client.get(f"/cre/verdict/{delivery_id}")
    assert cre_res.status_code == 200
    cre_data = cre_res.json()
    assert cre_data["isReady"] is True
    assert cre_data["verdict"] == 1
    assert "reportBytes" in cre_data
    assert cre_data["reportBytes"].startswith("0x")


def test_telemetry_and_benchmark_probe():
    from verifier.common.benchmark import probe_hardware_telemetry, measure_pcie_bandwidth, measure_fp16_tflops

    telemetry = probe_hardware_telemetry()
    assert "device" in telemetry
    assert "smCount" in telemetry
    assert telemetry["smCount"] > 0

    h2d, d2h = measure_pcie_bandwidth()
    assert h2d > 0 and d2h > 0

    tflops = measure_fp16_tflops()
    assert tflops > 0
