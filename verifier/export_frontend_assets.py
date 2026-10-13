import json
import os
import sys
import time
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from verifier.common.attestation import generate_pod_attestation, bind_attestation_to_root

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "data/frontend_fixtures")
os.makedirs(FIXTURES_DIR, exist_ok=True)

CLASSES_FILE = os.path.join(os.path.dirname(__file__), "common/classes.json")
with open(CLASSES_FILE, "r") as f:
    CLASSES_DATA = json.load(f)["classes"]


def generate_verified_machine_specs() -> Dict[str, Any]:
    specs = {}
    for cls_name, info in CLASSES_DATA.items():
        specs[cls_name] = {
            "gpuClass": cls_name,
            "ratedTflops": info["ratedTflops"],
            "passMinTflops": info["passMinTflops"],
            "failMaxTflops": info["failMaxTflops"],
            "multiprocessors": info["multiprocessors"],
            "referencePriceUsd": info["referencePriceUsd"],
            "source": info["source"],
            "recommendedVramGb": 16.0 if "T4" in cls_name else 80.0,
            "pcieBandwidthMinGbps": 12.0 if "T4" in cls_name else 45.0,
        }
    return specs


def generate_sample_benchmark_receipt() -> Dict[str, Any]:
    attestation = generate_pod_attestation(
        device_name="NVIDIA H100 80GB HBM3",
        sm_count=132,
        compute_capability="9.0",
        total_vram_gb=80.0,
        driver_version="550.54.14",
        cuda_version="12.4",
    )
    mock_root = "0x8a7f938c117d33b499120de78f9914b1a45710bc8923a104052345bcdef90123"
    bound_root = bind_attestation_to_root(mock_root, attestation.attestation_hash)

    return {
        "deliveryId": 1042,
        "series": "gH100-W43",
        "gpuClass": "H100 SXM",
        "verdict": 1,
        "verdictName": "PASS",
        "measuredTflops": 982.4,
        "ratedTflops": 989.0,
        "tflopsE2": 98240,
        "hardwareEfficiencyPct": 99.3,
        "merkleRoot": mock_root,
        "boundAttestationRoot": bound_root,
        "attestation": attestation.to_dict(),
        "vgpuProbe": {
            "contentionDetected": False,
            "latencyJitterPercent": 1.8,
            "status": "CLEAN",
        },
        "pcieBandwidth": {
            "h2dGbps": 52.4,
            "d2hGbps": 51.8,
            "bidirectionalGbps": 104.2,
        },
        "signature": "0x4f128bc9123048abcdef129384712039481230481203948120394812039481234a56b78c90de123456789abcdef0123456789abcdef0123456789abcdef0123456781b",
        "timestamp": int(time.time()),
        "network": "monad-testnet",
        "chainId": 10143,
    }


def generate_live_telemetry_snapshot() -> Dict[str, Any]:
    return {
        "status": "online",
        "activeSessions": 3,
        "totalVerdicts": 42,
        "breakdown": {
            "PASS": 38,
            "DEGRADED": 3,
            "FAIL": 1,
        },
        "passRatePercent": 90.5,
        "averageTflops": 612.4,
        "byGpuClass": {
            "T4": {"count": 18, "avgTflops": 8.12, "ratedTflops": 8.1},
            "A100 SXM4": {"count": 12, "avgTflops": 308.5, "ratedTflops": 312.0},
            "H100 SXM": {"count": 12, "avgTflops": 978.2, "ratedTflops": 989.0},
        },
        "vgpuContentionIncidents": 2,
        "averageVerificationLatencySeconds": 4.82,
        "uptimeSeconds": 86400,
    }


def generate_kuru_forward_curve() -> Dict[str, Any]:
    return {
        "updatedAt": int(time.time()),
        "terms": [
            {
                "series": "gT4-NOW",
                "gpuClass": "T4",
                "spotPriceUsd": 0.35,
                "forwardPriceUsd": 0.32,
                "spreadPercent": -8.6,
                "openInterestHours": 1420,
                "deliveryStatus": "PROMPT_DELIVERY",
            },
            {
                "series": "gH100-W43",
                "gpuClass": "H100 SXM",
                "spotPriceUsd": 2.65,
                "forwardPriceUsd": 2.49,
                "spreadPercent": -6.0,
                "openInterestHours": 8500,
                "deliveryStatus": "WEEK_43_SCHEDULED",
            },
            {
                "series": "gH100-W44",
                "gpuClass": "H100 SXM",
                "spotPriceUsd": 2.65,
                "forwardPriceUsd": 2.62,
                "spreadPercent": -1.1,
                "openInterestHours": 6200,
                "deliveryStatus": "WEEK_44_SCHEDULED",
            },
            {
                "series": "gA100-W43",
                "gpuClass": "A100 SXM4",
                "spotPriceUsd": 1.80,
                "forwardPriceUsd": 1.91,
                "spreadPercent": 6.1,
                "openInterestHours": 3400,
                "deliveryStatus": "PREMIUM_TIGHT_SUPPLY",
            },
        ],
    }


def main():
    print("[Gridlock Telemetry Exporter] Generating Stream B frontend fixtures...")

    files = {
        "verified_machine_specs.json": generate_verified_machine_specs(),
        "sample_benchmark_receipt.json": generate_sample_benchmark_receipt(),
        "live_telemetry_snapshot.json": generate_live_telemetry_snapshot(),
        "kuru_forward_curve.json": generate_kuru_forward_curve(),
    }

    for fname, data in files.items():
        fpath = os.path.join(FIXTURES_DIR, fname)
        with open(fpath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  [OK] Exported {fname} ({len(json.dumps(data))} bytes)")

    print(f"[Done] All fixtures written to {FIXTURES_DIR}")


if __name__ == "__main__":
    main()
