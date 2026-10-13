import json
import os
import sys
import secrets
import time
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
try:
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    HAS_ETH_ACCOUNT = True
except ImportError:
    HAS_ETH_ACCOUNT = False

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from verifier.common.challenge import gen, hash_row, MerkleTree
except ImportError:
    from common.challenge import gen, hash_row, MerkleTree

app = FastAPI(title="Gridlock Verifier API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load classes
CLASSES_FILE = os.path.join(os.path.dirname(__file__), "../common/classes.json")
with open(CLASSES_FILE, "r") as f:
    CLASSES_DATA = json.load(f)["classes"]

# In-memory storage
sessions: Dict[int, Dict[str, Any]] = {}
verdicts: Dict[int, Dict[str, Any]] = {}

VERIFIER_SIGNER_PK = os.getenv("VERIFIER_SIGNER_PK", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
ESCROW_ADDRESS = os.getenv("DELIVERY_ESCROW_ADDRESS", "0x4444444444444444444444444444444444444444")
CHAIN_ID = int(os.getenv("CHAIN_ID", "10143"))


class ChallengeRequest(BaseModel):
    deliveryId: int
    gpuClass: str
    n: Optional[int] = 4096
    steps: Optional[int] = 4


class CommitRequest(BaseModel):
    deliveryId: int
    root: str
    tflops: float
    sm: int
    device: str


class RowData(BaseModel):
    index: int
    data: str  # hex encoded bytes of int64 row elements


class RevealRequest(BaseModel):
    deliveryId: int
    rows: List[RowData]
    proofs: List[List[str]]


@app.get("/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.post("/challenge")
def create_challenge(req: ChallengeRequest):
    if req.gpuClass not in CLASSES_DATA:
        raise HTTPException(status_code=400, detail=f"Unknown GPU class: {req.gpuClass}")

    seed = secrets.randbits(64)
    n = req.n or 4096
    steps = req.steps or 4
    # Generous deadline slack (30s)
    deadline_ms = 30000

    sessions[req.deliveryId] = {
        "deliveryId": req.deliveryId,
        "gpuClass": req.gpuClass,
        "seed": seed,
        "n": n,
        "steps": steps,
        "startedAt": time.time(),
        "deadlineMs": deadline_ms,
        "status": "CHALLENGED",
    }

    return {
        "deliveryId": req.deliveryId,
        "seed": seed,
        "n": n,
        "steps": steps,
        "deadlineMs": deadline_ms,
    }


@app.post("/commit")
def commit_result(req: CommitRequest):
    session = sessions.get(req.deliveryId)
    if not session:
        raise HTTPException(status_code=404, detail="Challenge session not found")

    # Select 8 random distinct sample indices
    n = session["n"]
    sample_indices = sorted(list(set([secrets.randbelow(n) for _ in range(8)])))
    while len(sample_indices) < 8:
        sample_indices = sorted(list(set(sample_indices + [secrets.randbelow(n)])))

    session.update({
        "root": req.root,
        "tflops": req.tflops,
        "sm": req.sm,
        "device": req.device,
        "sampleIndices": sample_indices,
        "committedAt": time.time(),
        "status": "COMMITTED",
    })

    return {
        "deliveryId": req.deliveryId,
        "sampleIndices": sample_indices,
    }


@app.post("/reveal")
def reveal_result(req: RevealRequest):
    session = sessions.get(req.deliveryId)
    if not session or session.get("status") != "COMMITTED":
        raise HTTPException(status_code=400, detail="Invalid session state for reveal")

    expected_indices = session["sampleIndices"]
    claimed_root_hex = session["root"]
    claimed_root = bytes.fromhex(claimed_root_hex.replace("0x", ""))
    tflops = session["tflops"]
    gpu_class = session["gpuClass"]
    rated_tflops = CLASSES_DATA[gpu_class]["ratedTflops"]

    # Check elapsed time
    elapsed_ms = (time.time() - session["startedAt"]) * 1000
    timeout = elapsed_ms > session["deadlineMs"]

    # Regenerate ground truth on CPU for step 3 (last step)
    # Step 3 matmul: C = A @ B
    A, B = gen(session["seed"], session["n"], session["steps"] - 1)

    verification_failed = False
    if timeout:
        verification_failed = True

    # Validate each revealed row against ground truth and Merkle proof
    for r_obj, proof in zip(req.rows, req.proofs):
        idx = r_obj.index
        if idx not in expected_indices:
            verification_failed = True
            break

        # Ground truth row computation
        expected_row = (A[idx].astype(np.int64) @ B.astype(np.int64)).astype(np.int64)
        revealed_bytes = bytes.fromhex(r_obj.data.replace("0x", ""))
        revealed_row = np.frombuffer(revealed_bytes, dtype=np.int64)

        if not np.array_equal(expected_row, revealed_row):
            verification_failed = True
            break

        row_hash = hash_row(revealed_row)
        if not MerkleTree.verify_proof(row_hash, proof, idx, claimed_root):
            verification_failed = True
            break

    # Determine verdict
    # 1: PASS, 2: DEGRADED, 3: FAIL
    if verification_failed or tflops < 0.5 * rated_tflops:
        verdict = 3
        verdict_name = "FAIL"
    elif tflops < 0.7 * rated_tflops:
        verdict = 2
        verdict_name = "DEGRADED"
    else:
        verdict = 1
        verdict_name = "PASS"

    tflops_e2 = int(round(tflops * 100))

    # EIP-712 Signature
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
            "deliveryId": req.deliveryId,
            "verdict": verdict,
            "tflopsE2": tflops_e2,
            "resultRoot": claimed_root_hex if claimed_root_hex.startswith("0x") else "0x" + claimed_root_hex,
        },
    }

    if HAS_ETH_ACCOUNT:
        try:
            signable = encode_typed_data(full_message=typed_data)
            signed = Account.sign_message(signable, private_key=VERIFIER_SIGNER_PK)
            signature = signed.signature.hex()
            if not signature.startswith("0x"):
                signature = "0x" + signature
        except Exception as e:
            signature = "0x" + "00" * 65
    else:
        signature = "0x" + "00" * 65

    verdict_record = {
        "deliveryId": req.deliveryId,
        "verdict": verdict,
        "verdictName": verdict_name,
        "tflopsE2": tflops_e2,
        "resultRoot": claimed_root_hex if claimed_root_hex.startswith("0x") else "0x" + claimed_root_hex,
        "signature": signature,
        "timestamp": int(time.time()),
    }

    verdicts[req.deliveryId] = verdict_record
    session["status"] = "REVEALED"

    return verdict_record


@app.get("/verdict/{delivery_id}")
def get_verdict(delivery_id: int):
    verdict = verdicts.get(delivery_id)
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found for delivery")
    return verdict


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
