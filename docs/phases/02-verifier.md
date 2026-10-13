# 02 — Verifier (CLI + grading API)

**Owner:** _______ · **Prize:** Track 01 core demo (the PASS/FAIL moment)
**Hard gate:** PASS verdict on a Colab/Kaggle T4 by **00:30 IST**; API deployed with a public URL.

Works fully independently of contracts until Phase 2. Read `shared/INTERFACES.md` (Verifier API + EIP-712).

Design reference: Waterline (commit to answers before learning which rows get checked). Do **not** copy
its code (no license). Our version is smaller and runs on a free T4.

## Phase 0 (20:30–21:00)

- [ ] Generate verifier key: `cast wallet new` → send the address to 01 (`verifierSigner`).
- [ ] Open a Colab notebook with a T4 runtime (Kaggle T4 as backup).
- [ ] `verifier/cli` and `verifier/api` folders, `pip install numpy torch fastapi uvicorn eth-account`.

## Phase 1 (21:00–00:30)

### Shared maths `verifier/common/challenge.py`

- `gen(seed, n, step)` → A, B as `np.int8` in [-8, 8] using `np.random.default_rng(seed*1000+step)`.
  Same function on CPU (API) and in the pod → bit-identical matrices.
- n = 4096, steps = 4. Entries of C stay < 2^24 → float32 matmul is exact.
- Row hash = `sha256(C[r].astype(np.int64).tobytes())`. Merkle tree over all n row hashes of the **last** step
  (simple, enough for v1). Leaf/node = sha256, odd level duplicates last.

### CLI `gridlock-verify --api URL --delivery ID --class T4`

1. POST `/challenge` → seed, n, steps, deadlineMs.
2. Start timer. For each step: gen on CPU → `torch.from_numpy(...).cuda().float()` →
   `torch.backends.cuda.matmul.allow_tf32 = False` → `C = A @ B` → back to int64.
3. Build Merkle root of last step's rows.
4. TFLOPS probe: fp16 8192×8192 matmul ×20, `torch.cuda.synchronize()`, tflops = 2·n³·20 / t / 1e12.
5. Read `torch.cuda.get_device_name()` and `get_device_properties(0).multi_processor_count`.
6. POST `/commit {root, tflops, sm, device}` → 8 sample rows.
7. POST `/reveal {rows, proofs}` → prints verdict + tx-ready signature. Optional `--settle` sends
   `settleWithSig` with BUYER_PK (Phase 2).
8. Pretty output: green PASS / yellow DEGRADED / red FAIL + receipt (record this for the demo).

Package so the demo is one line: `pip install git+https://github.com/<org>/gridlock#subdirectory=verifier && gridlock-verify ...`
(or a single-file `curl -sL <raw-url> | python3 - --delivery 7 --class T4`).

### API (FastAPI) — host on Render/Railway (Vercel function timeout too short)

- In-memory `sessions` dict (+ JSON file dump) is fine.
- `/challenge`: random 64-bit seed, deadline from class table (T4 budget measured tonight × 3 slack).
- `/commit`: store root + claimed metrics, return 8 random row indices (`secrets.randbelow`).
- `/reveal`: regenerate A,B on CPU for last step; for each sampled row recompute `A[r] @ B` (int64),
  compare, verify Merkle proof against committed root, check deadline.
- Verdict rules:
  - FAIL — any row wrong, proof invalid, deadline missed, or tflops < 0.5 × rated(claimedClass)
  - DEGRADED — tflops < 0.7 × rated(claimedClass)
  - PASS — otherwise
- Sign EIP-712 `Verdict(deliveryId, verdict, tflopsE2, resultRoot)` with `eth_account`
  (`Account.sign_typed_data`). resultRoot = committed Merkle root.
- Store under `/verdict/{deliveryId}` for CRE (04) and the web app (03).

### Class table `verifier/common/classes.json`

Measure T4 fp16 TFLOPS yourself on Colab tonight (run 3×, take median). For A100/H100 use the
NVIDIA spec-sheet dense fp16 tensor figure; write the source URL next to each number. No made-up numbers.

## Phase 2 (00:30–03:00) — integration

- [ ] Get `DeliveryEscrow` address from 01; set EIP-712 domain verifyingContract.
- [ ] Real flow: redeem (03 or cast) → provision → run CLI in Colab → `--settle` → check `Settled` event.
- [ ] FAIL demo: same Colab T4 but `--class "A100 SXM4"` → tflops way under 0.5× A100 → FAIL → buyer refunded.
- [ ] Record both runs as backup footage (screen recording) — 07 needs them.

## Done =

- [ ] Public API URL in group + in `.env.example`
- [ ] PASS and FAIL settled onchain, tx hashes posted
- [ ] Backup recordings uploaded to the team drive
- [ ] README section: protocol in 6 lines + "Prior art: Waterline (ETHGlobal Tokyo 2026)"
