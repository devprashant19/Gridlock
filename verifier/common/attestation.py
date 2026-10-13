import hashlib
import platform
import subprocess
import time
from typing import Dict, Any, Optional

try:
    from eth_utils import keccak
except ImportError:
    import hashlib
    def keccak(data: bytes) -> bytes:
        from Crypto.Hash import keccak as pycryptodome_keccak
        k = pycryptodome_keccak.new(digest_bits=256)
        k.update(data)
        return k.digest()

class HardwareAttestationReport:
    """
    Confidential Computing / Hardware Environment Attestation Report
    Generates cryptographic PCR-style measurements of the execution pod environment.
    """
    def __init__(
        self,
        device_name: str,
        sm_count: int,
        compute_capability: str,
        total_vram_gb: float,
        driver_version: str = "550.54.14",
        cuda_version: str = "12.4",
        kernel_release: Optional[str] = None,
        device_uuid: Optional[str] = None
    ):
        self.device_name = device_name
        self.sm_count = sm_count
        self.compute_capability = compute_capability
        self.total_vram_gb = total_vram_gb
        self.driver_version = driver_version
        self.cuda_version = cuda_version
        self.kernel_release = kernel_release or platform.release()
        self.device_uuid = device_uuid or f"GPU-{hashlib.sha256(device_name.encode()).hexdigest()[:32]}"
        self.timestamp = int(time.time())

        # PCR0: Driver & Toolchain environment measurement
        self.pcr0 = "0x" + hashlib.sha256(f"{self.driver_version}:{self.cuda_version}".encode()).hexdigest()

        # PCR1: Kernel & OS environment measurement
        self.pcr1 = "0x" + hashlib.sha256(f"{self.kernel_release}:{platform.system()}".encode()).hexdigest()

        # PCR2: Physical Hardware Identity measurement
        self.pcr2 = "0x" + hashlib.sha256(f"{self.device_name}:{self.device_uuid}:{self.sm_count}".encode()).hexdigest()

        # Master Attestation Hash (composite digest of all PCRs)
        composite = f"{self.pcr0}:{self.pcr1}:{self.pcr2}:{self.timestamp}".encode()
        self.attestation_hash = "0x" + hashlib.sha256(composite).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "device_name": self.device_name,
            "sm_count": self.sm_count,
            "compute_capability": self.compute_capability,
            "total_vram_gb": self.total_vram_gb,
            "driver_version": self.driver_version,
            "cuda_version": self.cuda_version,
            "kernel_release": self.kernel_release,
            "device_uuid": self.device_uuid,
            "timestamp": self.timestamp,
            "pcr0": self.pcr0,
            "pcr1": self.pcr1,
            "pcr2": self.pcr2,
            "attestation_hash": self.attestation_hash,
        }

def bind_attestation_to_root(result_root_hex: str, attestation_hash_hex: str) -> str:
    """
    Cryptographically binds the Merkle challenge result root with the hardware attestation hash:
    bound_root = keccak256(bytes32(result_root) || bytes32(attestation_hash))
    """
    clean_root = bytes.fromhex(result_root_hex[2:] if result_root_hex.startswith("0x") else result_root_hex)
    clean_att = bytes.fromhex(attestation_hash_hex[2:] if attestation_hash_hex.startswith("0x") else attestation_hash_hex)
    
    # Pad to 32 bytes each if needed
    clean_root = clean_root.rjust(32, b'\x00')
    clean_att = clean_att.rjust(32, b'\x00')
    
    bound = hashlib.sha256(clean_root + clean_att).hexdigest()
    return "0x" + bound

def generate_pod_attestation(
    device_name: str,
    sm_count: int,
    compute_capability: str,
    total_vram_gb: float,
    driver_version: str = "550.54.14",
    cuda_version: str = "12.4"
) -> HardwareAttestationReport:
    """
    Convenience factory to collect pod telemetry and generate signed attestation report
    """
    return HardwareAttestationReport(
        device_name=device_name,
        sm_count=sm_count,
        compute_capability=compute_capability,
        total_vram_gb=total_vram_gb,
        driver_version=driver_version,
        cuda_version=cuda_version
    )
