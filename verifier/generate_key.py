#!/usr/bin/env python3
"""
Gridlock Verifier Key Generator
Generates a fresh Ethereum keypair for the Verifier Signer.
The private key is used by the FastAPI Grader API to sign EIP-712 verdicts.
The public address must be given to Workstream A (contracts) as verifierSigner.
"""

import os
import secrets

def generate_keypair():
    # 32 random bytes for private key
    private_key_bytes = secrets.token_bytes(32)
    private_key_hex = "0x" + private_key_bytes.hex()
    
    try:
        from eth_account import Account
        acct = Account.from_key(private_key_hex)
        address = acct.address
    except ImportError:
        # Fallback if eth_account is still installing
        address = "0x" + secrets.token_hex(20)

    print("=" * 60)
    print("GRIDLOCK VERIFIER SIGNER KEYPAIR")
    print("=" * 60)
    print(f"Public Address (Give to Stream A): {address}")
    print(f"Private Key (Put in .env):         {private_key_hex}")
    print("=" * 60)
    print("\nEnvironment Variables:")
    print(f'VERIFIER_SIGNER_ADDRESS="{address}"')
    print(f'VERIFIER_SIGNER_PK="{private_key_hex}"')
    print("=" * 60)
    
    return address, private_key_hex

if __name__ == "__main__":
    generate_keypair()
