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
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  GasWarning,
  MockBanner,
  PageTitle,
  SignInGate,
  Spinner,
  inputCls,
  StatMetric,
  Empty,
} from "@/components/ui";

export default function ProviderPage() {
  const { session } = useWallet();
  const addr = session?.address;
  const prov = usePoll(() => (addr ? readProvider(addr) : Promise.resolve(undefined)), [addr], 15000);
  const bal = usePoll(() => (addr ? readBalances(addr) : Promise.resolve(undefined)), [addr], 15000);
  const idx = usePoll(readIndexPrices, [], 30000);
  const queue = usePoll(
    async () =>
      addr ? (await scanDeliveries()).filter((d) => d.provider.toLowerCase() === addr.toLowerCase()).reverse() : [],
    [addr],
    8000
  );

  const open = queue.data?.filter((d) => d.status === 1) ?? [];
  const rest = queue.data?.filter((d) => d.status !== 1) ?? [];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Compute Provider Operations Console"
        sub="Register your node, mint forward HourTokens against a 120% collateral bond, and provision bare-metal instances for buyers."
      />
      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      <SignInGate what="access the compute provider operations console">
        {/* Top Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatMetric
            label="Node Status"
            value={prov.data?.registered ? "VERIFIED" : "UNREGISTERED"}
            positive={!!prov.data?.registered}
            sub={prov.data?.name || "Register to appear on leaderboard"}
          />
          <StatMetric
            label="gUSD Balance"
            value={bal.data ? `${gusd(bal.data.gusd).toFixed(2)}` : "—"}
            sub="Available collateral"
          />
          <StatMetric
            label="Active Deliveries"
            value={String(open.length)}
            delta={open.length > 0 ? "ACTION DUE" : "CLEAN"}
            positive={open.length === 0}
            sub="Waiting for SSH encryption"
          />
          <StatMetric
            label="Completed Sessions"
            value={String(rest.length)}
            sub="Historical delivery records"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <RegisterCard name={prov.data?.name} registered={prov.data?.registered} />
            <MintCard registered={!!prov.data?.registered} gusdBal={bal.data?.gusd} prices={idx.data} />

            <Card title="Open Unredeemed Capacity Inventory">
              {!prov.data ? (
                <Spinner />
              ) : (
                <div className="space-y-2 text-xs font-mono">
                  {SERIES.map((s) => (
                    <div
                      key={s.symbol}
                      className="p-2.5 rounded-lg bg-obsidian/70 border border-white/[0.06] flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-grid-monad" />
                        <span className="font-bold text-white">{s.symbol}</span>
                      </div>
                      <span className="text-gray-300">
                        {prov.data!.openHours[s.symbol]?.toString() ?? "0"} h unsold
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              title="Deliveries Requiring Provisioning"
              right={open.length ? <Badge tone="degraded" pulse>{open.length} ACTION DUE</Badge> : undefined}
            >
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
                <Empty>All deliveries provisioned. New redemptions assigned to your node appear here.</Empty>
              )}
            </Card>

            <Card title="Past Deliveries & Settled Bonds">
              <DeliveryList items={rest} empty="No past delivery records." />
            </Card>
          </div>
        </div>
      </SignInGate>
    </div>
  );
}

function RegisterCard({ name, registered }: { name?: string; registered?: boolean }) {
  const [v, setV] = useState("");
  const { write, pending } = useTx();
  return (
    <Card
      title="Provider Node Identity"
      right={registered ? <Badge tone="pass">REGISTERED NODE</Badge> : <Badge tone="neutral">NOT REGISTERED</Badge>}
    >
      {registered && (
        <p className="text-xs text-gray-300 font-mono">
          Public Leaderboard Handle: <strong className="text-grid-cyan">{name}</strong>
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={registered ? "Rename node handle…" : "Provider identity handle (e.g. Lambda-H100-US)"}
          className={inputCls}
        />
        <Button
          onClick={() =>
            write("Register Provider Node", {
              address: CONTRACTS.deliveryEscrow,
              abi: deliveryEscrowAbi,
              functionName: "registerProvider",
              args: [v.trim()],
            })
              .then(() => setV(""))
              .catch(() => {})
          }
          loading={pending}
          disabled={!v.trim()}
          className="shrink-0 font-mono text-xs !px-5"
        >
          {registered ? "Update" : "Register Node"}
        </Button>
      </div>
    </Card>
  );
}

function MintCard({
  registered,
  gusdBal,
  prices,
}: {
  registered: boolean;
  gusdBal?: bigint;
  prices?: Awaited<ReturnType<typeof readIndexPrices>>;
}) {
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
        await write(`Approve ${gusd(bond).toFixed(2)} gUSD Bond`, {
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
    <Card title="Bonded Forward Token Minting">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Series">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
            {SERIES.map((x) => (
              <option key={x.symbol} value={x.symbol}>
                {x.symbol}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hours Capacity">
          <input
            type="number"
            min="1"
            step="1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Bond Formula Breakdown */}
      <div className="p-3.5 rounded-xl bg-obsidian border border-white/[0.08] text-xs font-mono space-y-2">
        <div className="flex justify-between items-center text-gray-400">
          <span>Ornn Spot Index ({s?.className}):</span>
          <span className="font-bold text-white">
            {p ? `$${priceE8ToUsd(p.priceE8).toFixed(4)} / hr` : "Not published"}
          </span>
        </div>
        <div className="flex justify-between items-center text-gray-400 border-t border-white/[0.06] pt-1.5">
          <span>120% Collateral Bond Required:</span>
          <span className="font-bold text-grid-monad text-sm">
            {bond !== undefined ? `${fmtNum(gusd(bond))} gUSD` : "—"}
          </span>
        </div>
        <div className="flex justify-between items-center text-gray-400">
          <span>Your gUSD Balance:</span>
          <span className="text-white">{gusdBal !== undefined ? `${fmtNum(gusd(gusdBal))} gUSD` : "—"}</span>
        </div>
      </div>

      {!registered && (
        <p className="text-xs text-grid-degraded font-mono">
          ⚠ Register your node handle first so buyers recognize your node on the reputation wall.
        </p>
      )}

      <Button
        className="w-full !py-3 tracking-wider font-mono text-sm"
        onClick={mint}
        loading={pending}
        disabled={h < 1n || bond === undefined || (gusdBal !== undefined && bond > gusdBal)}
      >
        ⚡ POST 120% BOND & MINT {h.toString()} HOURTOKENS
      </Button>
      <p className="text-[11px] text-gray-500 font-mono text-center">
        If verifier grades machine below threshold, bond slashes to buyer · Unsold hours reclaimable
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
    write(`Provision Delivery #${d.id}`, {
      address: CONTRACTS.deliveryEscrow,
      abi: deliveryEscrowAbi,
      functionName: "provision",
      args: [BigInt(d.id), ciphertext],
    }).catch(() => {});
  };

  return (
    <div className="p-4 rounded-xl bg-obsidian/90 border border-white/10 space-y-3 font-mono text-xs">
      <div className="flex justify-between items-start gap-2 border-b border-white/[0.06] pb-2.5">
        <div>
          <div className="font-bold text-white text-sm">
            Delivery #{d.id} · {s?.symbol}
          </div>
          <div className="text-[11px] text-gray-400">
            {d.hours.toString()} GPU-Hours · Bond at Stake:{" "}
            <span className="text-grid-monad font-bold">{fmtNum(gusd(d.bondAmount))} gUSD</span>
          </div>
        </div>
        <Badge tone={left > 0 ? "degraded" : "fail"} pulse={left > 0}>
          {left > 0 ? `${fmtDuration(left)} left` : "deadline expired"}
        </Badge>
      </div>

      {noKey && <ErrorBox>Buyer posted no encryption public key; credentials cannot be securely delivered.</ErrorBox>}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Host / IP">
            <input
              value={c.host}
              onChange={(e) => set("host", e.target.value)}
              placeholder="198.51.100.42"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="SSH Port">
          <input
            type="number"
            value={c.port}
            onChange={(e) => set("port", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Username">
          <input
            value={c.username}
            onChange={(e) => set("username", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Auth Method">
          <select
            value={c.authType}
            onChange={(e) => set("authType", e.target.value as CredentialPayload["authType"])}
            className={inputCls}
          >
            <option value="ssh-key">SSH Private Key</option>
            <option value="password">Password</option>
          </select>
        </Field>
        <Field label="GPU Count">
          <input
            type="number"
            min="1"
            value={c.gpuCount}
            onChange={(e) => set("gpuCount", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label={c.authType === "ssh-key" ? "Private Key (Ed25519 / RSA)" : "Machine Password"}>
        <textarea
          rows={3}
          value={c.keyOrPassword}
          onChange={(e) => set("keyOrPassword", e.target.value)}
          placeholder={c.authType === "ssh-key" ? "-----BEGIN OPENSSH PRIVATE KEY-----" : ""}
          className={`${inputCls} font-mono text-[11px]`}
        />
      </Field>

      <Button
        className="w-full !py-3 tracking-wider font-mono text-xs"
        onClick={submit}
        loading={pending}
        disabled={noKey || !c.host || !c.keyOrPassword}
      >
        🔒 ENCRYPT TO BUYER&apos;S PASSKEY & BROADCAST PROVISION
      </Button>
      <p className="text-[10px] text-gray-500 text-center font-mono">
        Encrypted with X25519 + ChaCha20-Poly1305. Plaintext credentials never leave this browser.
      </p>
    </div>
  );
}
