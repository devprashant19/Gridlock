import hashlib
from typing import List, Tuple
import numpy as np


def gen(seed: int, n: int, step: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Deterministically generates matrices A and B as int8 in [-8, 8].
    Bit-identical across CPU and GPU pods.
    """
    rng = np.random.default_rng(seed * 1000 + step)
    A = rng.integers(-8, 9, size=(n, n), dtype=np.int8)
    B = rng.integers(-8, 9, size=(n, n), dtype=np.int8)
    return A, B


def hash_row(row: np.ndarray) -> bytes:
    """
    Computes SHA256 of row elements cast to int64 bytes.
    """
    return hashlib.sha256(row.astype(np.int64).tobytes()).digest()


class MerkleTree:
    """
    Complete Merkle tree over row hashes.
    """

    def __init__(self, leaves: List[bytes]):
        self.levels: List[List[bytes]] = [leaves]
        current = leaves
        while len(current) > 1:
            next_level = []
            for i in range(0, len(current), 2):
                left = current[i]
                right = current[i + 1] if i + 1 < len(current) else left
                combined = hashlib.sha256(left + right).digest()
                next_level.append(combined)
            self.levels.append(next_level)
            current = next_level

    @property
    def root(self) -> bytes:
        return self.levels[-1][0] if self.levels and self.levels[-1] else b"\x00" * 32

    def get_proof(self, index: int) -> List[str]:
        """
        Returns Merkle proof as hex strings for leaf at `index`.
        """
        proof = []
        idx = index
        for level in self.levels[:-1]:
            if idx % 2 == 0:
                sibling_idx = idx + 1 if idx + 1 < len(level) else idx
            else:
                sibling_idx = idx - 1
            proof.append("0x" + level[sibling_idx].hex())
            idx //= 2
        return proof

    @staticmethod
    def verify_proof(leaf: bytes, proof: List[str], index: int, expected_root: bytes) -> bool:
        """
        Verifies a Merkle proof against an expected root.
        """
        current = leaf
        idx = index
        for sibling_hex in proof:
            sibling = bytes.fromhex(sibling_hex.replace("0x", ""))
            if idx % 2 == 0:
                current = hashlib.sha256(current + sibling).digest()
            else:
                current = hashlib.sha256(sibling + current).digest()
            idx //= 2
        return current == expected_root
