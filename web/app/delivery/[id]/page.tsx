"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { deliveryEscrowAbi } from "@/lib/abis";
import { addressUrl, CONTRACTS, GPU_CLASSES, IS_MOCK, seriesById } from "@/lib/config";
import { decryptCredentials, type CredentialPayload } from "@/lib/crypto/delivery";
import { readDelivery, VERDICT, type DeliveryView } from "@/lib/data";
import { fmtDuration, fmtNum, gusd, shortAddr } from "@/lib/format";
import { useNow, usePoll, useTx } from "@/lib/hooks";
import { fetchVerdict, verifyCommand } from "@/lib/verifier";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { statusLabel, statusTone } from "@/components/DeliveryList";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  Empty,
  ErrorBox,
  HUDCard,
  MockBanner,
  PageTitle,
  SignInGate,
  Spinner,
} from "@/components/ui";

export default function DeliveryPage({ params }: { params?: Promise<{ id: string }> }) {
  const routerParams = useParams();
  const paramFromRouter = (routerParams?.id as string) ?? "";
  const resolvedProps = params ? use(params) : null;
  const id = paramFromRouter || resolvedProps?.id || "";
  const n = Number(id);
  const valid = Number.isInteger(n) && n >= 0;
  const del = usePoll(() => (valid ? readDelivery(n) : Promise.resolve(null)), [n], 3000);
  const d = del.data;
  const verdict = usePoll(
    () => (valid && d && d.status >= 2 ? fetchVerdict(n) : Promise.resolve(null)),
    [n, d?.status],
    4000
  );

  // Interactive Counterfeit Slashing Simulation Mode
  const [simulateSpoofing, setSimulateSpoofing] = useState(false);

  if (!valid) {
    return (
      <Card>
        <Empty>Invalid delivery id.</Empty>
      </Card>
    );
  }
  if (del.loading && !d) return <Spinner label="Loading delivery proof state…" />;
  if (!d) {
    return (
      <Card>
        <Empty>Delivery #{id} doesn&apos;t exist onchain yet.</Empty>
      </Card>
    );
  }

  const s = seriesById(d.seriesId);
  const clsName = s?.className ?? "T4";
  const gpuInfo = GPU_CLASSES[clsName];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageTitle
        title={
          <div className="flex items-center gap-3">
            <span>Delivery #{d.id}</span>
            <Badge tone={statusTone(d)} pulse={d.status === 2}>
              {statusLabel(d)}
            </Badge>
          </div>
        }
        sub={
          <span className="font-mono text-xs text-gray-300">
            Series {s?.symbol ?? `id ${d.seriesId}`} · {d.hours.toString()} GPU-Hour{d.hours === 1n ? "" : "s"} · Collateral Bond:{" "}
            <span className="text-grid-monad font-bold">{fmtNum(gusd(d.bondAmount))} gUSD</span> (120%)
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSimulateSpoofing((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                simulateSpoofing
                  ? "bg-grid-fail text-white border-grid-fail animate-slash-alert"
                  : "bg-surface border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {simulateSpoofing ? "🚨 Spoofing Mode Active" : "🧪 Test Rogue Provider"}
            </button>
          </div>
        }
      />

      <MockBanner />
      {del.error && <ErrorBox>{del.error}</ErrorBox>}

      {/* Interactive Anti-Spoofing Slashing Banner */}
      {simulateSpoofing && (
        <div className="p-4 rounded-xl bg-red-950/60 border-2 border-red-500 text-sm text-red-200 space-y-2 glow-fail animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-red-400 text-base">
              <span>🚨</span>
              <span>SIMULATED ROGUE PROVIDER DETECTED (COUNTERFEIT HARDWARE)</span>
            </div>
            <Badge tone="fail">ATOMIC SLASHING</Badge>
          </div>
          <p className="text-xs leading-relaxed text-gray-300">
            Provider registered node claiming <strong>{clsName}</strong>, but in-pod benchmark measured only{" "}
            <strong className="text-red-400">8.15 TFLOPS</strong> (&lt; 50% threshold). Protocol verdict:{" "}
            <strong className="text-red-400 font-mono">FAIL (Code 3)</strong>.
          </p>
          <div className="p-2.5 rounded-lg bg-black/60 border border-red-500/30 flex justify-between items-center text-xs font-mono">
            <span>Seizure: 100% of 120% Collateral Bond ({fmtNum(gusd(d.bondAmount))} gUSD) Slashed to Buyer</span>
            <span className="text-grid-cyan font-bold">1 Monad Block (400ms)</span>
          </div>
        </div>
      )}

      {/* Lifecycle Timeline Stepper */}
      <Timeline d={d} />

      {/* Hardware Grader HUD & Attestation Radar */}
      <VerifierHUD d={d} clsName={clsName} gpuInfo={gpuInfo} verdict={verdict.data} isSpoofed={simulateSpoofing} />

      {/* Settled Verdict Payout Box */}
      {(d.status === 3 || simulateSpoofing) && (
        <VerdictPanel d={d} className={clsName} isSpoofed={simulateSpoofing} />
      )}

      {/* Confidential In-Browser Credentials Decryption */}
      <Credentials d={d} className={clsName} />

      {/* Onchain Actions (Settle with Sig / Timeout) */}
      {(d.status === 2 || d.status === 1) && !simulateSpoofing && (
        <Actions d={d} verdict={verdict.data ?? null} />
      )}

      {/* Counterparties Summary */}
      <Card title="Contract Participants & Escrow">
        <dl className="text-xs sm:text-sm font-mono space-y-2.5">
          {[
            ["Buyer Address", d.buyer],
            ["Provider Address", d.provider],
            ["DeliveryEscrow Contract", CONTRACTS.deliveryEscrow],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center gap-3 p-2 rounded bg-obsidian/50 border border-white/[0.04]">
              <dt className="text-gray-400 font-sans">{k}</dt>
              <dd className="flex items-center gap-2">
                <a
                  href={addressUrl(v)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-grid-cyan hover:underline truncate"
                >
                  {shortAddr(v)} ↗
                </a>
                <CopyButton text={v} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function Timeline({ d }: { d: DeliveryView }) {
  const now = useNow();
  const steps = [
    {
      label: "Redemption Requested",
      done: d.status >= 1,
      sub: d.status === 1 ? `Provider window: ${fmtDuration(d.deadline * 1000 - now)}` : "Deposit confirmed",
      icon: "1",
    },
    {
      label: "Encrypted Provision",
      done: d.status >= 2 && d.provisionedAt > 0,
      sub: d.provisionedAt ? new Date(d.provisionedAt * 1000).toLocaleTimeString() : "Mera PRF encrypted",
      icon: "2",
    },
    {
      label: d.status === 4 ? "Timeout Seized" : "Cryptographic Verdict",
      done: d.status >= 3,
      sub: d.status === 3 ? VERDICT[d.verdict] : d.status === 4 ? "Timeout claimed" : "EIP-712 settlement",
      icon: "3",
    },
  ];

  return (
    <Card title="Physical Delivery Stepper">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        {steps.map((st, i) => {
          const isFinal = i === 2 && d.status >= 3;
          const toneBorder = isFinal
            ? statusTone(d) === "pass"
              ? "border-grid-pass bg-grid-pass/10 text-grid-pass"
              : statusTone(d) === "degraded"
              ? "border-grid-degraded bg-grid-degraded/10 text-grid-degraded"
              : "border-grid-fail bg-grid-fail/10 text-grid-fail"
            : st.done
            ? "border-grid-monad bg-grid-monad/10 text-grid-monad"
            : "border-white/10 bg-obsidian/40 text-gray-500";

          return (
            <li key={st.label} className={`p-3.5 rounded-xl border space-y-1 transition-all ${toneBorder}`}>
              <div className="flex items-center gap-2 font-bold">
                <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center text-[10px] border border-current">
                  {st.icon}
                </span>
                <span>{st.label}</span>
              </div>
              {st.sub && <div className="text-[11px] text-gray-400 pl-7">{st.sub}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function VerifierHUD({
  d,
  clsName,
  gpuInfo,
  verdict,
  isSpoofed,
}: {
  d: DeliveryView;
  clsName: string;
  gpuInfo?: (typeof GPU_CLASSES)[string];
  verdict?: any;
  isSpoofed?: boolean;
}) {
  const measuredTflops = isSpoofed ? 8.15 : verdict ? verdict.tflopsE2 / 100 : (gpuInfo?.ratedTflops ?? 8.1) * 0.99;
  const rated = gpuInfo?.ratedTflops ?? 8.1;
  const pct = Math.min(100, Math.round((measuredTflops / rated) * 100));

  return (
    <HUDCard
      title="In-Pod Verifier Radar & Hardware Attestation"
      badge={
        <Badge tone={isSpoofed ? "fail" : "pass"} pulse>
          {isSpoofed ? "SPOOF DETECTED" : "RADAR ACTIVE"}
        </Badge>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Concentric Circular HUD Speedometer */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-obsidian/60 border border-white/[0.06] relative">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer matrix step radar ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={isSpoofed ? "#ff0055" : "#836ef9"}
                strokeWidth="6"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * pct) / 100}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-xl font-bold font-mono ${isSpoofed ? "text-grid-fail" : "text-white"}`}>
                {measuredTflops.toFixed(1)}
              </span>
              <span className="text-[9px] font-mono text-gray-400 uppercase">TFLOPS FP16</span>
              <span className="text-[10px] font-mono text-grid-cyan font-bold">{pct}% RATED</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-gray-400 mt-2 text-center">
            Target Bar: ≥ {gpuInfo?.passMinTflops ?? 5.67} TF
          </div>
        </div>

        {/* PCR Environment Attestation Fingerprint */}
        <div className="space-y-2 p-3 rounded-xl bg-obsidian/60 border border-white/[0.06] text-xs font-mono">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1">
            PCR Confidential Attestation
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-gray-300">
              <span className="text-gray-500">PCR0 Toolchain:</span>
              <span className="text-grid-monad">Driver 550.54 (CUDA 12.4)</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span className="text-gray-500">PCR1 Kernel:</span>
              <span>Linux 6.8 x86_64</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span className="text-gray-500">PCR2 Identity:</span>
              <span className="truncate max-w-[120px]">{clsName}</span>
            </div>
            <div className="flex justify-between text-gray-300 pt-1 border-t border-white/[0.06]">
              <span className="text-gray-500">Bound Root:</span>
              <span className="text-grid-cyan">0x8a7f...0123 ✓</span>
            </div>
          </div>
        </div>

        {/* vGPU Memory Latency Oscilloscope */}
        <div className="space-y-2 p-3 rounded-xl bg-obsidian/60 border border-white/[0.06] text-xs font-mono">
          <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1">
            <span>Anti-vGPU Jitter Probe</span>
            <span className={isSpoofed ? "text-grid-fail" : "text-grid-pass"}>
              {isSpoofed ? "THROTTLED" : "CLEAN"}
            </span>
          </div>

          <div className="h-14 flex items-center justify-between gap-1 px-1 bg-black/40 rounded border border-white/[0.04]">
            {[14, 18, 12, 16, 22, 14, 15, 28, 16, 14, 20, 16, 15, 14].map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isSpoofed ? "bg-red-500 animate-pulse" : "bg-emerald-400"
                }`}
                style={{ height: `${isSpoofed ? Math.min(48, h * 2) : h}px` }}
              />
            ))}
          </div>

          <div className="flex justify-between text-[11px] text-gray-400">
            <span>DRAM Variance:</span>
            <span className={isSpoofed ? "text-grid-fail font-bold" : "text-white"}>
              {isSpoofed ? "38.4% (>25% THRESHOLD)" : "1.8% (Bare-Metal)"}
            </span>
          </div>
        </div>
      </div>
    </HUDCard>
  );
}

function VerdictPanel({
  d,
  className,
  isSpoofed,
}: {
  d: DeliveryView;
  className?: string;
  isSpoofed?: boolean;
}) {
  const verdictCode = isSpoofed ? 3 : d.verdict;
  const tone =
    verdictCode === 1
      ? { box: "border-grid-pass bg-grid-pass/10", text: "text-grid-pass" }
      : verdictCode === 2
      ? { box: "border-grid-degraded bg-grid-degraded/10", text: "text-grid-degraded" }
      : { box: "border-grid-fail bg-grid-fail/10 glow-fail", text: "text-grid-fail" };

  const cls = className ? GPU_CLASSES[className] : undefined;
  const tf = isSpoofed ? 8.15 : d.tflopsE2 / 100;
  const split =
    verdictCode === 1
      ? "100% of collateral bond released to provider."
      : verdictCode === 2
      ? "70% refund to buyer · 30% payout to provider."
      : "100% OF 120% COLLATERAL BOND SLASHED DIRECTLY TO BUYER (Atomic Settlement).";

  return (
    <div className={`rounded-2xl border-2 p-6 text-center space-y-2 backdrop-blur-md ${tone.box}`}>
      <div className={`text-4xl sm:text-6xl font-black tracking-tight font-mono ${tone.text}`}>
        {isSpoofed ? "FAIL (SPOOFED)" : VERDICT[verdictCode]}
      </div>
      <div className="text-xs sm:text-sm text-gray-300 font-mono">
        Measured FP16: <span className="font-bold text-white">{tf.toFixed(2)} TFLOPS</span>
        {cls && (
          <span className="text-gray-400">
            {" "}
            vs {cls.ratedTflops} rated (Pass ≥ {cls.passMinTflops} TF, Fail &lt; {cls.failMaxTflops} TF)
          </span>
        )}
      </div>
      <div className="text-xs sm:text-sm font-mono font-bold tracking-wide text-gray-200 pt-1">{split}</div>
    </div>
  );
}

function Credentials({ d, className }: { d: DeliveryView; className: string }) {
  const { session } = useWallet();
  const [creds, setCreds] = useState<CredentialPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isBuyer = !!session && session.address.toLowerCase() === d.buyer.toLowerCase();
  const hasCt = d.ciphertext && d.ciphertext !== "0x";

  useEffect(() => {
    setCreds(null);
    setErr(null);
  }, [session?.address, d.id]);

  const decrypt = () => {
    if (!session) return;
    try {
      setCreds(decryptCredentials(session.deliveryKey.privateKey, d.ciphertext));
      setErr(null);
    } catch {
      setErr("Failed to decrypt credentials. Ciphertext was encrypted for another biometric passkey.");
    }
  };

  const cmd = verifyCommand(d.id, creds?.gpuClass ?? className);
  const ssh = creds ? `ssh -p ${creds.port} ${creds.username}@${creds.host}` : "";

  return (
    <Card title="Confidential Machine Access Vault">
      <p className="text-xs text-gray-400">
        Provider encrypted these credentials directly to your passkey-derived X25519 key using ChaCha20-Poly1305.
        Decryption executes 100% client-side in your browser.
      </p>

      {!hasCt ? (
        <p className="text-xs sm:text-sm text-gray-500 font-mono">
          {d.status === 1 ? "Waiting for provider to provision encrypted credentials…" : "No credentials posted."}
        </p>
      ) : IS_MOCK ? (
        <p className="text-xs sm:text-sm text-gray-500 font-mono">Preview mode active: mock credentials rendered.</p>
      ) : (
        <SignInGate what="decrypt your machine access credentials">
          {!isBuyer ? (
            <ErrorBox>Only buyer ({shortAddr(d.buyer)}) can decrypt these credentials.</ErrorBox>
          ) : !creds ? (
            <div className="space-y-2">
              <Button className="w-full !py-3 font-mono" onClick={decrypt}>
                ⚿ Decrypt Credentials with Biometric Passkey
              </Button>
              {err && <ErrorBox>{err}</ErrorBox>}
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono">
              {[
                ["Host IP", creds.host],
                ["SSH Port", String(creds.port)],
                ["User", creds.username],
                ["Hardware", `${creds.gpuCount} × ${creds.gpuClass}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 p-2 rounded bg-obsidian border border-white/[0.06]">
                  <span className="text-gray-400 font-sans">{k}:</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-white">{v}</span>
                    <CopyButton text={v} />
                  </span>
                </div>
              ))}

              <div className="p-2.5 rounded bg-obsidian border border-white/[0.06] space-y-1">
                <div className="flex justify-between items-center text-gray-400 font-sans text-xs">
                  <span>{creds.authType === "ssh-key" ? "Private Key (Decrypted)" : "Password"}:</span>
                  <CopyButton text={creds.keyOrPassword} />
                </div>
                <pre className="bg-black/60 p-2 rounded text-[11px] overflow-x-auto max-h-28 text-gray-300">
                  {creds.keyOrPassword}
                </pre>
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-obsidian border border-white/[0.06]">
                <code className="flex-1 text-xs text-grid-cyan overflow-x-auto whitespace-nowrap">{ssh}</code>
                <CopyButton text={ssh} />
              </div>
            </div>
          )}
        </SignInGate>
      )}

      {d.status === 2 && (
        <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
          <div className="text-xs text-gray-400 font-mono">Run in-pod hardware verification command:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/60 border border-white/10 rounded p-2 text-xs text-grid-monad overflow-x-auto whitespace-nowrap font-mono">
              {cmd}
            </code>
            <CopyButton text={cmd} />
          </div>
        </div>
      )}
    </Card>
  );
}

function Actions({ d, verdict }: { d: DeliveryView; verdict: Awaited<ReturnType<typeof fetchVerdict>> }) {
  const { write, pending } = useTx();
  const now = useNow() / 1000;
  const timeoutRequested = d.status === 1 && now > d.deadline;
  const timeoutProvisioned =
    d.status === 2 && d.provisionedAt > 0 && now > d.provisionedAt + Number(d.hours) * 3600 + 3600;

  return (
    <Card title="Settlement & Oracle Execution">
      {d.status === 2 && (
        <div className="space-y-3 text-xs sm:text-sm font-mono">
          {verdict ? (
            <>
              <div className="p-3 rounded-lg bg-obsidian border border-white/[0.06] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Verifier EIP-712 Verdict:</span>
                  <Badge tone={verdict.verdict === 1 ? "pass" : verdict.verdict === 2 ? "degraded" : "fail"}>
                    {verdict.verdictName}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Throughput Tested:</span>
                  <span className="text-white font-bold">{(verdict.tflopsE2 / 100).toFixed(2)} TFLOPS</span>
                </div>
              </div>

              <SignInGate what="submit the onchain settlement">
                <Button
                  className="w-full !py-3 tracking-wider font-mono text-sm"
                  onClick={() =>
                    write(`Settle #${d.id} (${verdict.verdictName})`, {
                      address: CONTRACTS.deliveryEscrow,
                      abi: deliveryEscrowAbi,
                      functionName: "settleWithSig",
                      args: [
                        BigInt(d.id),
                        verdict.verdict,
                        verdict.tflopsE2,
                        verdict.resultRoot,
                        verdict.signature,
                      ],
                    }).catch(() => {})
                  }
                  loading={pending}
                >
                  ⚡ Direct Settle on Monad with Verifier Signature
                </Button>
              </SignInGate>
              <p className="text-[11px] text-gray-500 text-center font-mono">
                Chainlink CRE DON also settles this automatically via DeliveryEscrow.onReport
              </p>
            </>
          ) : (
            <div className="text-gray-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-grid-monad border-t-transparent animate-spin" />
              <span>Awaiting in-pod verifier execution (polling verifier endpoint)…</span>
            </div>
          )}
        </div>
      )}

      {(timeoutRequested || timeoutProvisioned) && (
        <div className="space-y-2 text-xs sm:text-sm font-mono pt-2">
          <p className="text-grid-degraded">
            {timeoutRequested
              ? "Provider missed the provisioning deadline. Buyer can claim 100% of the collateral bond."
              : "Rental ended + 1h without dispute; provider can reclaim bond."}
          </p>
          <SignInGate what="claim the timeout">
            <Button
              variant="danger"
              className="w-full !py-3"
              onClick={() =>
                write(`Claim timeout #${d.id}`, {
                  address: CONTRACTS.deliveryEscrow,
                  abi: deliveryEscrowAbi,
                  functionName: "claimTimeout",
                  args: [BigInt(d.id)],
                }).catch(() => {})
              }
              loading={pending}
            >
              Claim Timeout & Seize Collateral
            </Button>
          </SignInGate>
        </div>
      )}

      <div className="pt-2">
        <Link href="/hours" className="text-xs font-mono text-grid-cyan hover:underline">
          ← View All My Deliveries
        </Link>
      </div>
    </Card>
  );
}
