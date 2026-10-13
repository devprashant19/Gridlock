import asyncio
import json
import os
import secrets
import sys
import time
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel
import numpy as np

SERVER_START_TIME = time.time()

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
    attestationHash: Optional[str] = None
    vgpuStatus: Optional[str] = None


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
        "attestationHash": req.attestationHash,
        "vgpuStatus": req.vgpuStatus or "CLEAN",
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

    vgpu_status = session.get("vgpuStatus", "CLEAN")

    # Verdict Evaluation
    # 1: PASS, 2: DEGRADED, 3: FAIL
    if verification_failed or tflops < 0.5 * rated_tflops:
        verdict = 3
        verdict_name = "FAIL"
    elif tflops < 0.7 * rated_tflops or vgpu_status == "THROTTLED":
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
        "attestationHash": session.get("attestationHash"),
        "vgpuStatus": vgpu_status,
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


@app.get("/telemetry/summary")
def get_telemetry_summary():
    """
    High-level telemetry and verification analytics summary for dashboards and agents.
    """
    total_verdicts = len(verdicts)
    breakdown = {"PASS": 0, "DEGRADED": 0, "FAIL": 0}
    by_gpu_class: Dict[str, Dict[str, Any]] = {}
    total_tflops = 0.0
    vgpu_throttled_count = 0

    for v in verdicts.values():
        name = v.get("verdictName", "FAIL")
        breakdown[name] = breakdown.get(name, 0) + 1
        tflops = v.get("tflopsE2", 0) / 100.0
        total_tflops += tflops
        if v.get("vgpuStatus") == "THROTTLED":
            vgpu_throttled_count += 1

        sess = sessions.get(v.get("deliveryId"))
        gpu_cls = sess.get("gpuClass", "UNKNOWN") if sess else "UNKNOWN"
        if gpu_cls not in by_gpu_class:
            rated = CLASSES_DATA.get(gpu_cls, {}).get("ratedTflops", 0.0)
            by_gpu_class[gpu_cls] = {"count": 0, "totalTflops": 0.0, "ratedTflops": rated}
        by_gpu_class[gpu_cls]["count"] += 1
        by_gpu_class[gpu_cls]["totalTflops"] += tflops

    avg_tflops = round(total_tflops / total_verdicts, 2) if total_verdicts > 0 else 0.0
    for cls_info in by_gpu_class.values():
        cnt = cls_info["count"]
        cls_info["avgTflops"] = round(cls_info["totalTflops"] / cnt, 2) if cnt > 0 else 0.0
        del cls_info["totalTflops"]

    return {
        "status": "online",
        "activeSessions": len(sessions),
        "totalVerdicts": total_verdicts,
        "breakdown": breakdown,
        "averageTflops": avg_tflops,
        "byGpuClass": by_gpu_class,
        "vgpuContentionIncidents": vgpu_throttled_count,
        "uptimeSeconds": round(time.time() - SERVER_START_TIME, 2),
    }


@app.get("/metrics", response_class=PlainTextResponse)
def get_prometheus_metrics():
    """
    Prometheus metrics exposition endpoint for institutional telemetry monitoring.
    """
    pass_cnt = sum(1 for v in verdicts.values() if v.get("verdictName") == "PASS")
    deg_cnt = sum(1 for v in verdicts.values() if v.get("verdictName") == "DEGRADED")
    fail_cnt = sum(1 for v in verdicts.values() if v.get("verdictName") == "FAIL")
    tot_cnt = len(verdicts)
    throttled_cnt = sum(1 for v in verdicts.values() if v.get("vgpuStatus") == "THROTTLED")
    tot_tflops = sum(v.get("tflopsE2", 0) / 100.0 for v in verdicts.values())
    avg_tflops = (tot_tflops / tot_cnt) if tot_cnt > 0 else 0.0
    uptime = time.time() - SERVER_START_TIME

    lines = [
        "# HELP gridlock_verifier_active_sessions Number of currently active verification sessions",
        "# TYPE gridlock_verifier_active_sessions gauge",
        f"gridlock_verifier_active_sessions {len(sessions)}",
        "",
        "# HELP gridlock_verifier_verdicts_total Total verdicts generated by verifier",
        "# TYPE gridlock_verifier_verdicts_total counter",
        f'gridlock_verifier_verdicts_total{{status="PASS"}} {pass_cnt}',
        f'gridlock_verifier_verdicts_total{{status="DEGRADED"}} {deg_cnt}',
        f'gridlock_verifier_verdicts_total{{status="FAIL"}} {fail_cnt}',
        f'gridlock_verifier_verdicts_total{{status="ALL"}} {tot_cnt}',
        "",
        "# HELP gridlock_verifier_vgpu_contention_total Count of vGPU contention or throttling events detected",
        "# TYPE gridlock_verifier_vgpu_contention_total counter",
        f"gridlock_verifier_vgpu_contention_total {throttled_cnt}",
        "",
        "# HELP gridlock_verifier_tflops_average Average measured TFLOPS across all verdicts",
        "# TYPE gridlock_verifier_tflops_average gauge",
        f"gridlock_verifier_tflops_average {avg_tflops:.2f}",
        "",
        "# HELP gridlock_verifier_uptime_seconds Total runtime of verifier server in seconds",
        "# TYPE gridlock_verifier_uptime_seconds gauge",
        f"gridlock_verifier_uptime_seconds {uptime:.2f}",
        ""
    ]
    return "\n".join(lines)


@app.websocket("/ws/verify/{delivery_id}")
async def websocket_verify_endpoint(websocket: WebSocket, delivery_id: int):
    """
    Real-time bidirectional WebSocket stream for verification progress and verdicts.
    Provides live telemetry feed for frontend UI widgets and agent listeners.
    """
    await websocket.accept()
    try:
        sess = sessions.get(delivery_id)
        current_verdict = verdicts.get(delivery_id)
        await websocket.send_json({
            "event": "connected",
            "deliveryId": delivery_id,
            "session": sess,
            "hasVerdict": current_verdict is not None,
            "status": "VERIFIED" if current_verdict else (sess.get("status") if sess else "UNKNOWN")
        })

        if current_verdict:
            await websocket.send_json({
                "event": "verdict",
                "deliveryId": delivery_id,
                "data": current_verdict
            })

        for _ in range(60):
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                msg_type = data.get("type") or data.get("action")
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "time": time.time()})
                elif msg_type == "status":
                    await websocket.send_json({
                        "type": "status_response",
                        "deliveryId": delivery_id,
                        "session": sessions.get(delivery_id),
                        "verdict": verdicts.get(delivery_id)
                    })
            except asyncio.TimeoutError:
                pass

            v = verdicts.get(delivery_id)
            if v and not current_verdict:
                current_verdict = v
                await websocket.send_json({
                    "event": "verdict",
                    "deliveryId": delivery_id,
                    "data": current_verdict
                })
                break
            elif not v and delivery_id in sessions:
                s = sessions[delivery_id]
                elapsed = round(time.time() - s.get("startedAt", time.time()), 2)
                await websocket.send_json({
                    "event": "progress",
                    "deliveryId": delivery_id,
                    "status": s.get("status"),
                    "elapsedSeconds": elapsed,
                    "gpuClass": s.get("gpuClass")
                })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"event": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
