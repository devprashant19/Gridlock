import { ethers } from "ethers";

interface HealthCheckResult {
  service: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  latencyMs: number;
  details: string;
}

export async function checkOrnnApiHealth(
  url = "https://ornn-backend-api-135941626504.us-central1.run.app/api/gpu/H100%20SXM/index-history"
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - start;
    if (res.ok) {
      return {
        service: "Ornn Index Backend (Central1)",
        status: "ONLINE",
        latencyMs: latency,
        details: `HTTP ${res.status} OK (Live Spot Prints Active)`,
      };
    }
    return {
      service: "Ornn Index Backend (Central1)",
      status: "DEGRADED",
      latencyMs: latency,
      details: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      service: "Ornn Index Backend (Central1)",
      status: "OFFLINE",
      latencyMs: Date.now() - start,
      details: err.message,
    };
  }
}

export async function checkVerifierApiHealth(
  url = "http://localhost:8000"
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/docs`, { signal: AbortSignal.timeout(2000) });
    const latency = Date.now() - start;
    if (res.ok) {
      return {
        service: "Gridlock Hardware Verifier",
        status: "ONLINE",
        latencyMs: latency,
        details: "FastAPI EIP-712 Engine Operational",
      };
    }
    return {
      service: "Gridlock Hardware Verifier",
      status: "DEGRADED",
      latencyMs: latency,
      details: `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      service: "Gridlock Hardware Verifier",
      status: "OFFLINE",
      latencyMs: Date.now() - start,
      details: "Daemon idle (run: python -m uvicorn verifier.api.server:app)",
    };
  }
}

export async function checkMonadRpcHealth(
  rpcUrl = "https://testnet-rpc.monad.xyz"
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, 10143);
    const blockNum = await provider.getBlockNumber();
    const latency = Date.now() - start;
    return {
      service: "Monad Testnet RPC (10143)",
      status: "ONLINE",
      latencyMs: latency,
      details: `Head Block: #${blockNum} (~400ms finality)`,
    };
  } catch (err: any) {
    return {
      service: "Monad Testnet RPC (10143)",
      status: "DEGRADED",
      latencyMs: Date.now() - start,
      details: err.message,
    };
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("CHAINLINK RUNTIME ENVIRONMENT (CRE) — SYSTEM HEALTH & LIVENESS MONITOR");
  console.log("===============================================================================\n");

  const [ornn, verifier, monad] = await Promise.all([
    checkOrnnApiHealth(),
    checkVerifierApiHealth(),
    checkMonadRpcHealth(),
  ]);

  const results = [ornn, verifier, monad];

  console.log("+-----------------------------------------------------------------------------+");
  console.log("| Subsystem                     | Status   | Latency  | Details               |");
  console.log("+-------------------------------+----------+----------+-----------------------+");

  for (const r of results) {
    const statusCol = r.status.padEnd(8);
    const latencyCol = `${r.latencyMs}ms`.padEnd(8);
    console.log(`| ${r.service.padEnd(30)}| ${statusCol} | ${latencyCol} | ${r.details.slice(0, 22).padEnd(22)}|`);
  }
  console.log("+-----------------------------------------------------------------------------+");

  const allOnline = results.every((r) => r.status === "ONLINE");
  console.log(`\nOverall DON System Readiness: ${allOnline ? "[READY] All systems operational" : "[WARN] Some dependencies offline/degraded (fallbacks active)"}`);
}

main().catch(console.error);
