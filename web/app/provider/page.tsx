"use client";

import { useState } from "react";
import { deliveryEscrowAbi, gridUsdAbi } from "@/lib/abis";
import { CONTRACTS, SERIES, seriesBySymbol, seriesById } from "@/lib/config";
import { encryptCredentials, type CredentialPayload } from "@/lib/crypto/delivery";
import { readBalances, readIndexPrices, readProvider, scanDeliveries, type DeliveryView } from "@/lib/data";
import { bondRaw, fmtDuration, fmtNum, gusd, priceE8ToUsd } from "@/lib/format";
import { publicClient } from "@/lib/chain";
import { useNow, usePoll, useTx } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { DeliveryList } from "@/components/DeliveryList";
import { Badge, Button, Card, ErrorBox, Field, GasWarning, MockBanner, PageTitle, SignInGate, Spinner, inputCls } from "@/components/ui";

export default function ProviderPage() {
  const { session } = useWallet();
  const addr = session?.address;
  const prov = usePoll(() => (addr ? readProvider(addr) : Promise.resolve(undefined)), [addr], 15000);
  const bal = usePoll(() => (addr ? readBalances(addr) : Promise.resolve(undefined)), [addr], 15000);
  const idx = usePoll(readIndexPrices, [], 30000);
  const queue = usePoll(
    async () => (addr ? (await scanDeliveries()).filter((d) => d.provider.toLowerCase() === addr.toLowerCase()).reverse() : []),
    [addr],
    8000,
  );

  const open = queue.data?.filter((d) => d.status === 1) ?? [];
  const rest = queue.data?.filter((d) => d.status !== 1) ?? [];

  return (
    <>
      <PageTitle title="Provider console" sub="Register, mint GPU-hours against a 120% bond, and provision machines for buyers." />
      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      <SignInGate what="provide compute">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <RegisterCard name={prov.data?.name} registered={prov.data?.registered} />
            <MintCard registered={!!prov.data?.registered} gusdBal={bal.data?.gusd} prices={idx.data} />
            <Card title="Open capacity">
              {!prov.data ? (
                <Spinner />
              ) : (
                <ul className="text-sm divide-y divide-grid-700">
                  {SERIES.map((s) => (
                    <li key={s.symbol} className="py-2 flex justify-between">
                      <span>{s.symbol}</span>
                      <span className="font-mono">{prov.data!.openHours[s.symbol]?.toString() ?? "0"} h unsold/unredeemed</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Deliveries to provision" right={open.length ? <Badge tone="degraded">{open.length} waiting</Badge> : undefined}>
              {queue.loading && !queue.data ? (
                <Spinner />
              ) : queue.error ? (
                <ErrorBox>{queue.error}</ErrorBox>
              ) : open.length ? (
                <div className="space-y-4">
                  {open.map((d) => (
                    <ProvisionForm key={d.id} d={d} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No buyer is waiting on you. Redemptions assigned to you show up here.</p>
              )}
            </Card>
            <Card title="History">
              <DeliveryList items={rest} empty="No past deliveries." />
            </Card>
          </div>
        </div>
      </SignInGate>
    </>
  );
}

function RegisterCard({ name, registered }: { name?: string; registered?: boolean }) {
  const [v, setV] = useState("");
  const { write, pending } = useTx();
  return (
    <Card title="Provider identity" right={registered ? <Badge tone="pass">Registered</Badge> : <Badge>Not registered</Badge>}>
      {registered && <p className="text-sm">
        Listed as <strong>{name}</strong> on the leaderboard.
      </p>}
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={registered ? "Rename…" : "Provider name, e.g. HyperNode-BLR"} className={inputCls} />
        <Button
          onClick={() =>
            write("Register provider", { address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "registerProvider", args: [v.trim()] })
              .then(() => setV(""))
              .catch(() => {})
          }
          loading={pending}
          disabled={!v.trim()}
        >
          {registered ? "Update" : "Register"}
        </Button>
      </div>
    </Card>
  );
}

function MintCard({ registered, gusdBal, prices }: { registered: boolean; gusdBal?: bigint; prices?: Awaited<ReturnType<typeof readIndexPrices>> }) {
  const { session } = useWallet();
  const { write, pending } = useTx();
  const [symbol, setSymbol] = useState(SERIES[0]?.symbol ?? "");
  const [hours, setHours] = useState("10");
  const s = seriesBySymbol(symbol);
  const h = BigInt(Math.max(0, Math.floor(Number(hours) || 0)));
  const p = s ? prices?.[s.className] : undefined;
  const bond = p ? bondRaw(h, p.priceE8) : undefined;

  const mint = async () => {
    if (!s || !session || bond === undefined) return;
    try {
      const allowance = await publicClient.readContract({
        address: CONTRACTS.gridUSD,
        abi: gridUsdAbi,
        functionName: "allowance",
        args: [session.address, CONTRACTS.deliveryEscrow],
      });
      if (allowance < bond) {
        await write(`Approve ${gusd(bond).toFixed(2)} gUSD bond`, {
          address: CONTRACTS.gridUSD,
          abi: gridUsdAbi,
          functionName: "approve",
          args: [CONTRACTS.deliveryEscrow, bond],
        });
      }
      await write(`Mint ${h}h ${s.symbol}`, {
        address: CONTRACTS.deliveryEscrow,
        abi: deliveryEscrowAbi,
        functionName: "mint",
        args: [BigInt(s.seriesId), h],
      });
    } catch {
      /* toast shown */
    }
  };

  return (
    <Card title="Mint GPU-hours">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Series">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
            {SERIES.map((x) => (
              <option key={x.symbol}>{x.symbol}</option>
            ))}
          </select>
        </Field>
        <Field label="Hours">
          <input type="number" min="1" step="1" value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="p-3 rounded-lg bg-grid-900 text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-400">Index price ({s?.className})</span>
          <span className="font-mono">{p ? `$${priceE8ToUsd(p.priceE8).toFixed(4)} / h` : "not published"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Bond = hours × index × 1.2</span>
          <span className="font-mono text-grid-monad font-bold">{bond !== undefined ? `${fmtNum(gusd(bond))} gUSD` : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Your gUSD</span>
          <span className="font-mono">{gusdBal !== undefined ? fmtNum(gusd(gusdBal)) : "—"}</span>
        </div>
      </div>
      {!registered && <p className="text-xs text-grid-degraded">Register first so buyers see your name on the leaderboard.</p>}
      <Button
        className="w-full !py-3"
        onClick={mint}
        loading={pending}
        disabled={h < 1n || bond === undefined || (gusdBal !== undefined && bond > gusdBal)}
      >
        Post bond & mint {h.toString()} HourTokens
      </Button>
      <p className="text-xs text-gray-500">
        If you fail verification, the bond for that delivery goes to the buyer. Unsold hours can be withdrawn after the window closes.
      </p>
    </Card>
  );
}

function ProvisionForm({ d }: { d: DeliveryView }) {
  const s = seriesById(d.seriesId);
  const now = useNow();
  const { write, pending } = useTx();
  const toast = useToast();
  const [c, setC] = useState<CredentialPayload>({
    host: "",
    port: 22,
    username: "root",
    authType: "ssh-key",
    keyOrPassword: "",
    gpuCount: 1,
    gpuClass: s?.className ?? "T4",
  });
  const set = <K extends keyof CredentialPayload>(k: K, v: CredentialPayload[K]) => setC((x) => ({ ...x, [k]: v }));
  const left = d.deadline * 1000 - now;
  const noKey = /^0x0*$/.test(d.buyerEncPubKey);

  const submit = () => {
    let ciphertext: `0x${string}`;
    try {
      ciphertext = encryptCredentials(d.buyerEncPubKey, c);
    } catch (e) {
      toast.push({ kind: "error", text: (e as Error).message });
      return;
    }
    write(`Provision delivery #${d.id}`, {
      address: CONTRACTS.deliveryEscrow,
      abi: deliveryEscrowAbi,
      functionName: "provision",
      args: [BigInt(d.id), ciphertext],
    }).catch(() => {});
  };

  return (
    <div className="p-4 rounded-lg bg-grid-900 border border-grid-700 space-y-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold">
            Delivery #{d.id} · {s?.symbol}
          </div>
          <div className="text-xs text-gray-400">
            {d.hours.toString()} h · bond at stake {fmtNum(gusd(d.bondAmount))} gUSD
          </div>
        </div>
        <Badge tone={left > 0 ? "degraded" : "fail"}>{left > 0 ? `${fmtDuration(left)} left` : "deadline passed"}</Badge>
      </div>
      {noKey && <ErrorBox>Buyer posted no encryption key; credentials can&apos;t be delivered privately.</ErrorBox>}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Host">
            <input value={c.host} onChange={(e) => set("host", e.target.value)} placeholder="203.0.113.7" className={inputCls} />
          </Field>
        </div>
        <Field label="Port">
          <input type="number" value={c.port} onChange={(e) => set("port", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="User">
          <input value={c.username} onChange={(e) => set("username", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Auth">
          <select value={c.authType} onChange={(e) => set("authType", e.target.value as CredentialPayload["authType"])} className={inputCls}>
            <option value="ssh-key">SSH key</option>
            <option value="password">Password</option>
          </select>
        </Field>
        <Field label="GPUs">
          <input type="number" min="1" value={c.gpuCount} onChange={(e) => set("gpuCount", Number(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <Field label={c.authType === "ssh-key" ? "Private key" : "Password"}>
        <textarea
          rows={3}
          value={c.keyOrPassword}
          onChange={(e) => set("keyOrPassword", e.target.value)}
          placeholder={c.authType === "ssh-key" ? "-----BEGIN OPENSSH PRIVATE KEY-----" : ""}
          className={`${inputCls} font-mono text-xs`}
        />
      </Field>
      <Button className="w-full" onClick={submit} loading={pending} disabled={noKey || !c.host || !c.keyOrPassword}>
        Encrypt to buyer&apos;s passkey & provision
      </Button>
      <p className="text-[11px] text-gray-500">
        X25519 + XChaCha20-Poly1305 in your browser. Only ciphertext goes onchain. Plaintext never leaves this page.
      </p>
    </div>
  );
}
