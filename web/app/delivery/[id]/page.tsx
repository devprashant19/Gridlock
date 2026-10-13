"use client";

import Link from "next/link";
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
import { Badge, Button, Card, CopyButton, Empty, ErrorBox, MockBanner, PageTitle, SignInGate, Spinner } from "@/components/ui";

export default function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const n = Number(id);
  const valid = Number.isInteger(n) && n >= 0;
  const del = usePoll(() => (valid ? readDelivery(n) : Promise.resolve(null)), [n], 3000);
  const d = del.data;
  const verdict = usePoll(() => (valid && d && d.status >= 2 ? fetchVerdict(n) : Promise.resolve(null)), [n, d?.status], 4000);

  if (!valid) return <Card><Empty>Invalid delivery id.</Empty></Card>;
  if (del.loading && !d) return <Spinner label="Loading delivery…" />;
  if (!d) return <Card><Empty>Delivery #{id} doesn&apos;t exist (yet).</Empty></Card>;

  const s = seriesById(d.seriesId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle
        title={`Delivery #${d.id}`}
        sub={
          <>
            {s?.symbol ?? `series ${d.seriesId}`} · {d.hours.toString()} GPU-hour{d.hours === 1n ? "" : "s"} · bond {fmtNum(gusd(d.bondAmount))} gUSD
          </>
        }
        right={<Badge tone={statusTone(d)}>{statusLabel(d)}</Badge>}
      />
      <MockBanner />
      {del.error && <ErrorBox>{del.error}</ErrorBox>}

      <Timeline d={d} />
      {d.status === 3 && <VerdictPanel d={d} className={s?.className} />}
      <Credentials d={d} className={s?.className ?? "T4"} />
      {(d.status === 2 || d.status === 1) && <Actions d={d} verdict={verdict.data ?? null} />}

      <Card title="Parties">
        <dl className="text-sm space-y-2">
          {[
            ["Buyer", d.buyer],
            ["Provider", d.provider],
            ["Escrow", CONTRACTS.deliveryEscrow],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-gray-400">{k}</dt>
              <dd>
                <a href={addressUrl(v)} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">
                  {shortAddr(v)} ↗
                </a>
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
    { label: "Requested", done: d.status >= 1, sub: d.status === 1 ? `provider has ${fmtDuration(d.deadline * 1000 - now)}` : "" },
    {
      label: "Provisioned",
      done: d.status >= 2 && d.provisionedAt > 0,
      sub: d.provisionedAt ? new Date(d.provisionedAt * 1000).toLocaleTimeString() : "",
    },
    {
      label: d.status === 4 ? "Timed out" : "Verdict",
      done: d.status >= 3,
      sub: d.status === 3 ? VERDICT[d.verdict] : d.status === 4 ? "claimed" : "",
    },
  ];
  return (
    <Card title="Lifecycle">
      <ol className="grid grid-cols-3 gap-2 text-center text-xs">
        {steps.map((st, i) => {
          const tone =
            i === 2 && d.status >= 3
              ? statusTone(d) === "pass"
                ? "border-grid-pass text-grid-pass"
                : statusTone(d) === "degraded"
                  ? "border-grid-degraded text-grid-degraded"
                  : "border-grid-fail text-grid-fail"
              : st.done
                ? "border-grid-monad text-grid-monad"
                : "border-grid-700 text-gray-500";
          return (
            <li key={st.label} className={`p-3 rounded-lg bg-grid-900 border font-semibold ${tone}`}>
              <div>
                {i + 1}. {st.label}
              </div>
              {st.sub && <div className="mt-1 font-normal text-[11px] opacity-80">{st.sub}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function VerdictPanel({ d, className }: { d: DeliveryView; className?: string }) {
  const tone =
    d.verdict === 1
      ? { box: "border-grid-pass bg-grid-pass/10", text: "text-grid-pass" }
      : d.verdict === 2
        ? { box: "border-grid-degraded bg-grid-degraded/10", text: "text-grid-degraded" }
        : { box: "border-grid-fail bg-grid-fail/10", text: "text-grid-fail" };
  const cls = className ? GPU_CLASSES[className] : undefined;
  const tf = d.tflopsE2 / 100;
  const split = d.verdict === 1 ? "100% of bond → provider" : d.verdict === 2 ? "70% → buyer · 30% → provider" : "100% of bond slashed → buyer";
  return (
    <div className={`rounded-2xl border-2 p-6 text-center space-y-2 ${tone.box}`}>
      <div className={`text-5xl sm:text-6xl font-black tracking-tight ${tone.text}`}>{VERDICT[d.verdict]}</div>
      <div className="text-sm text-gray-300">
        Measured <span className="font-mono text-white">{tf.toFixed(2)} TFLOPS</span>
        {cls && (
          <>
            {" "}
            vs {cls.ratedTflops} rated (pass ≥ {cls.passMinTflops}, fail &lt; {cls.failMaxTflops})
          </>
        )}
      </div>
      <div className="text-xs text-gray-400">{split}</div>
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
      setErr("Couldn't decrypt. This ciphertext was encrypted to a different passkey.");
    }
  };

  const cmd = verifyCommand(d.id, creds?.gpuClass ?? className);
  const ssh = creds ? `ssh -p ${creds.port} ${creds.username}@${creds.host}` : "";

  return (
    <Card title="Machine access">
      <p className="text-xs text-gray-400">
        The provider encrypted these to your passkey-derived X25519 key. Decryption runs in this browser, and any device with the same
        synced passkey can open them.
      </p>
      {!hasCt ? (
        <p className="text-sm text-gray-500">{d.status === 1 ? "Waiting for the provider to provision…" : "No credentials were posted."}</p>
      ) : IS_MOCK ? (
        <p className="text-sm text-gray-500">Preview mode: no real ciphertext.</p>
      ) : (
        <SignInGate what="decrypt your credentials">
          {!isBuyer ? (
            <ErrorBox>Only the buyer ({shortAddr(d.buyer)}) can decrypt these credentials.</ErrorBox>
          ) : !creds ? (
            <div className="space-y-2">
              <Button className="w-full !py-3" onClick={decrypt}>
                Decrypt credentials with passkey key
              </Button>
              {err && <ErrorBox>{err}</ErrorBox>}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {[
                ["Host", creds.host],
                ["Port", String(creds.port)],
                ["User", creds.username],
                ["GPUs", `${creds.gpuCount} × ${creds.gpuClass}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 font-mono">
                  <span className="text-gray-500 font-sans">{k}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{v}</span>
                    <CopyButton text={v} />
                  </span>
                </div>
              ))}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500">{creds.authType === "ssh-key" ? "Private key" : "Password"}</span>
                  <CopyButton text={creds.keyOrPassword} />
                </div>
                <pre className="bg-grid-900 border border-grid-700 rounded p-2 text-[11px] overflow-x-auto max-h-32">{creds.keyOrPassword}</pre>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-grid-900 border border-grid-700 rounded p-2 text-xs overflow-x-auto whitespace-nowrap">{ssh}</code>
                <CopyButton text={ssh} />
              </div>
            </div>
          )}
        </SignInGate>
      )}
      {d.status === 2 && (
        <div className="pt-2 border-t border-grid-700">
          <div className="text-xs text-gray-400 mb-1">Then, inside the machine, run the Gridlock verifier:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-grid-900 border border-grid-700 rounded p-2 text-xs text-grid-monad overflow-x-auto whitespace-nowrap">{cmd}</code>
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
  const timeoutProvisioned = d.status === 2 && d.provisionedAt > 0 && now > d.provisionedAt + Number(d.hours) * 3600 + 3600;

  return (
    <Card title="Settlement">
      {d.status === 2 && (
        <div className="space-y-2 text-sm">
          {verdict ? (
            <>
              <p>
                Verifier verdict ready:{" "}
                <Badge tone={verdict.verdict === 1 ? "pass" : verdict.verdict === 2 ? "degraded" : "fail"}>{verdict.verdictName}</Badge>{" "}
                <span className="font-mono text-xs">{(verdict.tflopsE2 / 100).toFixed(2)} TFLOPS</span>
              </p>
              <p className="text-xs text-gray-400">
                The Chainlink CRE settler posts this automatically. Anyone can also submit the EIP-712 signed verdict now:
              </p>
              <SignInGate what="submit the verdict">
                <Button
                  onClick={() =>
                    write(`Settle #${d.id} (${verdict.verdictName})`, {
                      address: CONTRACTS.deliveryEscrow,
                      abi: deliveryEscrowAbi,
                      functionName: "settleWithSig",
                      args: [BigInt(d.id), verdict.verdict, verdict.tflopsE2, verdict.resultRoot, verdict.signature],
                    }).catch(() => {})
                  }
                  loading={pending}
                >
                  Settle onchain with verifier signature
                </Button>
              </SignInGate>
            </>
          ) : (
            <p className="text-gray-400">Waiting for the in-pod verifier run… (polling the verifier for a verdict)</p>
          )}
        </div>
      )}
      {(timeoutRequested || timeoutProvisioned) && (
        <div className="space-y-2 text-sm pt-2">
          <p className="text-grid-degraded">
            {timeoutRequested
              ? "The provider missed the provisioning deadline. The buyer can claim the full bond."
              : "No verdict arrived after the rental ended + 1h, so the provider can reclaim the bond."}
          </p>
          <SignInGate what="claim the timeout">
            <Button
              variant="danger"
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
              Claim timeout
            </Button>
          </SignInGate>
        </div>
      )}
      {d.status === 1 && !timeoutRequested && <p className="text-sm text-gray-400">Waiting for the provider to post encrypted credentials.</p>}
      <Link href="/hours" className="block text-xs text-grid-monad underline">
        ← all my deliveries
      </Link>
    </Card>
  );
}
