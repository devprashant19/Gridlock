import asyncio
import json
import os
import secrets
import sys
import time
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import numpy as np

try:
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    HAS_ETH_ACCOUNT = True
except ImportError:
    HAS_ETH_ACCOUNT = False

try:
    from eth_abi import encode as abi_encode
    HAS_ETH_ABI = True
except ImportError:
    HAS_ETH_ABI = False

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from verifier.common.challenge import gen, hash_row, MerkleTree
except ImportError:
    from common.challenge import gen, hash_row, MerkleTree

app = FastAPI(
    title="Gridlock Verifier API",
    description="Automated hardware grader, EIP-712 signer, and Chainlink CRE oracle adapter",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load classes table
CLASSES_FILE = os.path.join(os.path.dirname(__file__), "../common/classes.json")
with open(CLASSES_FILE, "r") as f:
    CLASSES_DATA = json.load(f)["classes"]

# Persistence directory
DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")
os.makedirs(DATA_DIR, exist_ok=True)
STATE_FILE = os.path.join(DATA_DIR, "state.json")

# In-memory storage with file backing
sessions: Dict[int, Dict[str, Any]] = {}
verdicts: Dict[int, Dict[str, Any]] = {}

def load_persisted_state():
    global sessions, verdicts
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                sessions = {int(k): v for k, v in data.get("sessions", {}).items()}
                verdicts = {int(k): v for k, v in data.get("verdicts", {}).items()}
        except Exception as e:
            print(f"[Warning] Failed to load persisted state: {e}")

def save_persisted_state():
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({
                "sessions": sessions,
                "verdicts": verdicts,
            }, f, indent=2)
    except Exception as e:
        print(f"[Warning] Failed to save state: {e}")

load_persisted_state()

VERIFIER_SIGNER_PK = os.getenv("VERIFIER_SIGNER_PK", "0x7bd4674689b7faf0f7443e1bec526ec5e997e095bdf4f2155149ade61a11b2b6")
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
    h2dGbps: Optional[float] = None
    d2hGbps: Optional[float] = None


class RowData(BaseModel):
    index: int
    data: str  # hex encoded bytes of int64 row elements


class RevealRequest(BaseModel):
    deliveryId: int
    rows: List[RowData]
    proofs: List[List[str]]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "time": time.time(),
        "hasEthAccount": HAS_ETH_ACCOUNT,
        "hasEthAbi": HAS_ETH_ABI,
        "activeSessions": len(sessions),
        "totalVerdicts": len(verdicts),
    }


@app.post("/challenge")
def create_challenge(req: ChallengeRequest):
    if req.gpuClass not in CLASSES_DATA:
        raise HTTPException(status_code=400, detail=f"Unknown GPU class: {req.gpuClass}")

    seed = secrets.randbits(64)
    n = req.n or 4096
    steps = req.steps or 4
    deadline_ms = 35000

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
    save_persisted_state()

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

    n = session["n"]
    sample_indices = sorted(list(set([secrets.randbelow(n) for _ in range(8)])))
    while len(sample_indices) < 8:
        sample_indices = sorted(list(set(sample_indices + [secrets.randbelow(n)])))

    session.update({
        "root": req.root,
        "tflops": req.tflops,
        "sm": req.sm,
        "device": req.device,
        "h2dGbps": req.h2dGbps,
        "d2hGbps": req.d2hGbps,
        "sampleIndices": sample_indices,
        "committedAt": time.time(),
        "status": "COMMITTED",
    })
    save_persisted_state()

    return {
        "deliveryId": req.deliveryId,
        "sampleIndices": sample_indices,
    }


@app.post("/reveal")
def reveal_result(req: RevealRequest):
    # Idempotent response if already revealed
    if req.deliveryId in verdicts:
        return verdicts[req.deliveryId]

    session = sessions.get(req.deliveryId)
    if not session or session.get("status") != "COMMITTED":
        raise HTTPException(status_code=400, detail="Invalid session state for reveal")

    expected_indices = session["sampleIndices"]
    claimed_root_hex = session["root"]
    claimed_root = bytes.fromhex(claimed_root_hex.replace("0x", ""))
    tflops = session["tflops"]
    gpu_class = session["gpuClass"]
    rated_tflops = CLASSES_DATA[gpu_class]["ratedTflops"]

    # Check elapsed deadline
    elapsed_ms = (time.time() - session["startedAt"]) * 1000
    timeout = elapsed_ms > session["deadlineMs"]

    # Re-generate A, B on CPU for last step
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

    # Verdict Evaluation
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

    # EIP-712 Signing
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

    # ABI encoded report for Chainlink CRE & DeliveryEscrow.onReport
    report_bytes_hex = ""
    if HAS_ETH_ABI:
        try:
            clean_root = bytes.fromhex(claimed_root_hex.replace("0x", ""))
            encoded = abi_encode(
                ["uint256", "uint8", "uint32", "bytes32"],
                [req.deliveryId, verdict, tflops_e2, clean_root]
            )
            report_bytes_hex = "0x" + encoded.hex()
        except Exception:
            pass

    verdict_record = {
        "deliveryId": req.deliveryId,
        "verdict": verdict,
        "verdictName": verdict_name,
        "tflopsE2": tflops_e2,
        "resultRoot": claimed_root_hex if claimed_root_hex.startswith("0x") else "0x" + claimed_root_hex,
        "signature": signature,
        "reportBytes": report_bytes_hex,
        "timestamp": int(time.time()),
    }

    verdicts[req.deliveryId] = verdict_record
    session["status"] = "REVEALED"
    save_persisted_state()

    return verdict_record


@app.get("/verdict/{delivery_id}")
def get_verdict(delivery_id: int):
    verdict = verdicts.get(delivery_id)
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found for delivery")
    return verdict


@app.get("/cre/verdict/{delivery_id}")
def get_cre_verdict(delivery_id: int):
    """
    Format tailored specifically for Chainlink CRE DON consensus.
    DON nodes fetch this endpoint, reach identical consensus on verdict,
    and submit reportBytes to DeliveryEscrow.onReport(reportBytes).
    """
    verdict = verdicts.get(delivery_id)
    if not verdict:
        return {
            "deliveryId": delivery_id,
            "isReady": False,
            "status": "PENDING",
        }
    return {
        "deliveryId": delivery_id,
        "isReady": True,
        "verdict": verdict["verdict"],
        "tflopsE2": verdict["tflopsE2"],
        "resultRoot": verdict["resultRoot"],
        "reportBytes": verdict.get("reportBytes", ""),
        "timestamp": verdict["timestamp"],
    }


@app.get("/verdict/{delivery_id}/stream")
async def stream_verdict(delivery_id: int):
    """
    Server-Sent Events (SSE) stream for Stream B Web App.
    Pushes live updates to /delivery/[id] without polling.
    """
    async def event_generator():
        for _ in range(60):  # Wait up to 60s
            if delivery_id in verdicts:
                yield f"data: {json.dumps(verdicts[delivery_id])}\n\n"
                return
            yield f"data: {json.dumps({'deliveryId': delivery_id, 'status': 'AWAITING_VERDICT'})}\n\n"
            await asyncio.sleep(1)
        yield f"data: {json.dumps({'deliveryId': delivery_id, 'status': 'TIMEOUT'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
