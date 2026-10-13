# Gridlock Verifier (CLI + FastAPI Grader)

Verifies rented GPU hardware inside the pod without trusting self-reported specs.

### Architecture

1. **Deterministic Challenge**: Server issues `seed`, `n=4096`, `steps=4`.
2. **Pod Execution**: GPU pod runs matmuls, hashes rows, commits Merkle root + measured FP16 TFLOPS.
3. **Selective Audit**: Server demands 8 pseudo-random rows.
4. **Reveal & Verification**: Pod sends row contents + Merkle branches. Server verifies bit-level accuracy and TFLOPS threshold.
5. **EIP-712 Signature**: Server signs typed `Verdict` message for onchain slashing/settlement on Monad.

### Quickstart (Local Development)

```bash
# 1. Install dependencies
cd verifier
pip install -r requirements.txt

# 2. Start Grader API
uvicorn api.server:app --reload --port 8000

# 3. In another terminal, run CLI
python -m cli.main --api http://localhost:8000 --delivery 1 --gpu-class T4
```

### Running on Google Colab (T4 GPU)

```python
!git clone https://github.com/<org>/gridlock
!pip install -r gridlock/verifier/requirements.txt
!python gridlock/verifier/cli/main.py --api <PUBLIC_API_URL> --delivery 1 --gpu-class T4
```
