#!/usr/bin/env python3
"""
Deterministically exports ABI artifacts from Foundry compilation artifacts in contracts/out/ to abis/
"""
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTRACTS_OUT = os.path.join(REPO_ROOT, "contracts", "out")
ABIS_DIR = os.path.join(REPO_ROOT, "abis")

TARGET_CONTRACTS = [
    ("DeliveryEscrow.sol", "DeliveryEscrow"),
    ("GridUSD.sol", "GridUSD"),
    ("HourToken.sol", "HourToken"),
    ("IndexOracle.sol", "IndexOracle"),
    ("SeriesFactory.sol", "SeriesFactory")
]

def export_abis():
    os.makedirs(ABIS_DIR, exist_ok=True)
    for source_file, contract_name in TARGET_CONTRACTS:
        artifact_path = os.path.join(CONTRACTS_OUT, source_file, f"{contract_name}.json")
        if not os.path.exists(artifact_path):
            print(f"Error: Artifact not found at {artifact_path}. Did you run 'forge build'?", file=sys.stderr)
            sys.exit(1)

        with open(artifact_path, "r", encoding="utf-8") as f:
            artifact = json.load(f)

        abi = artifact.get("abi", [])
        out_path = os.path.join(ABIS_DIR, f"{contract_name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(abi, f, indent=2)

        print(f"Exported {contract_name} ABI ({len(abi)} items) -> abis/{contract_name}.json")

if __name__ == "__main__":
    export_abis()
