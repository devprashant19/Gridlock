"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bytesToHex, parseEventLogs } from "viem";
import { deliveryEscrowAbi } from "@/lib/abis";
import { CONTRACTS, SERIES, seriesBySymbol } from "@/lib/config";
import { readBalances, scanDeliveries } from "@/lib/data";
import { fmtDate, fmtNum, hoursFromWei } from "@/lib/format";
import { useNow, usePoll, useTx } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { DeliveryList } from "@/components/DeliveryList";
import {
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
  Badge,
} from "@/components/ui";

export default function HoursPage() {
  const { session } = useWallet();
  const router = useRouter();
  const { write, pending } = useTx();
  const now = useNow(10000) / 1000;

  const bal = usePoll(
    () => (session ? readBalances(session.address) : Promise.resolve(undefined)),
    [session?.address],
    10000
  );
  const mine = usePoll(
    async () =>
      session
        ? (await scanDeliveries())
            .filter((d) => d.buyer.toLowerCase() === session.address.toLowerCase())
            .reverse()
        : [],
    [session?.address],
    10000
  );

  const openNow = SERIES.filter((s) => now >= s.windowStart && now <= s.windowEnd);
  const [symbol, setSymbol] = useState(openNow[0]?.symbol ?? SERIES[0]?.symbol ?? "");
  const [hours, setHours] = useState("1");
  const s = seriesBySymbol(symbol);
  const owned = s && bal.data ? hoursFromWei(bal.data.hours[s.symbol]) : 0;
  const inWindow = !!s && now >= s.windowStart && now <= s.windowEnd;
  const h = Math.floor(Number(hours));

  const redeem = async () => {
    if (!s || !session) return;
    const pub = bytesToHex(session.deliveryKey.publicKey);
    try {
      const receipt = await write(`Redeem ${h}h ${s.symbol}`, {
        address: CONTRACTS.deliveryEscrow,
        abi: deliveryEscrowAbi,
        functionName: "redeem",
        args: [BigInt(s.seriesId), BigInt(h), pub],
      });
      const ev = parseEventLogs({
        abi: deliveryEscrowAbi,
        logs: receipt.logs,
        eventName: "DeliveryRequested",
      })[0];
      if (ev) router.push(`/delivery/${ev.args.deliveryId}`);
    } catch {
      /* toast already shown */
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-black">
      <PageTitle
        title="My Compute Hours & Deliveries"
        sub="Redeem onchain HourTokens for bare-metal GPU credentials. Machine passwords and SSH keys return encrypted to your passkey."
      />
      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      <SignInGate what="manage your compute holdings and redemptions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inventory Wallet */}
          <Card title="HourToken Inventory (Wallet)">
            {!bal.data ? (
              <Spinner />
            ) : (
              <div className="space-y-3">
                {SERIES.map((x) => {
                  const count = hoursFromWei(bal.data!.hours[x.symbol]);
                  const isOpen = now >= x.windowStart && now <= x.windowEnd;
                  return (
                    <div
                      key={x.symbol}
                      className="p-4 bg-white border-2 border-black shadow-neo-sm flex justify-between items-center text-xs font-mono"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-black text-base">{x.symbol}</span>
                          {isOpen ? (
                            <Badge tone="pass">DELIVERY OPEN</Badge>
                          ) : now < x.windowStart ? (
                            <span className="text-[11px] font-bold text-gray-700 bg-neo-yellow px-1 border border-black">
                              Opens {fmtDate(x.windowStart)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-1 border border-black">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-700 font-sans font-medium">
                          {x.className} · {fmtDate(x.windowStart)} – {fmtDate(x.windowEnd)}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-lg font-black text-black">{fmtNum(count)} h</div>
                        <Link
                          href={`/market/${x.symbol}`}
                          className="inline-block px-2.5 py-0.5 bg-neo-yellow hover:bg-neo-yellowDark text-black text-xs font-mono font-bold uppercase border border-black shadow-neo-sm"
                        >
                          Trade on Kuru →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Machine Redemption Terminal */}
          <Card title="Physical Delivery Redemption Terminal">
            <p className="text-xs text-gray-700 font-medium leading-relaxed">
              Redeeming burns HourTokens and locks the provider in DeliveryEscrow. Your passkey PRF output automatically derives an
              ephemeral X25519 keypair. Its public key is passed to the smart contract, ensuring only your device can decrypt the credentials.
            </p>

            <div className="space-y-4">
              <Field label="Choose Compute Series to Redeem">
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className={inputCls}
                >
                  {SERIES.map((x) => (
                    <option key={x.symbol} value={x.symbol}>
                      {x.symbol} — {x.className}
                      {now < x.windowStart
                        ? ` (Opens ${fmtDate(x.windowStart)})`
                        : now > x.windowEnd
                        ? " (Window closed)"
                        : " (Active Window)"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Hours to Redeem" hint={`Available: ${fmtNum(owned)} h`}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className={inputCls}
                />
              </Field>

              {session && (
                <div className="p-3 bg-[#FFFDF7] border-2 border-black text-xs font-mono space-y-1 shadow-neo-sm">
                  <div className="text-[11px] uppercase font-bold text-black">Mera Derived Public Key:</div>
                  <div className="text-black font-bold break-all text-xs bg-white p-2 border border-black">
                    {bytesToHex(session.deliveryKey.publicKey)}
                  </div>
                </div>
              )}

              {!inWindow && s && (
                <ErrorBox>{s.symbol} delivery window is not active. Redemption is only available during the window.</ErrorBox>
              )}

              <Button
                className="w-full !py-3 tracking-wider font-mono text-sm bg-neo-yellow hover:bg-neo-yellowDark text-black shadow-neo"
                onClick={redeem}
                loading={pending}
                disabled={!inWindow || !(h >= 1) || h > owned}
              >
                ⚡ BURN {h >= 1 ? `${h}h ` : ""}& REQUEST MACHINE PROVISION
              </Button>
            </div>
          </Card>
        </div>

        {/* My Deliveries History */}
        <Card title="Active & Completed Machine Deliveries" className="mt-8">
          {mine.loading && !mine.data ? (
            <Spinner />
          ) : mine.error ? (
            <ErrorBox>{mine.error}</ErrorBox>
          ) : (
            <DeliveryList items={mine.data ?? []} empty="No active deliveries. Redeem compute hours above to request a machine." />
          )}
        </Card>
      </SignInGate>
    </div>
  );
}
