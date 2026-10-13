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
import { Button, Card, ErrorBox, Field, GasWarning, MockBanner, PageTitle, SignInGate, Spinner, inputCls } from "@/components/ui";

export default function HoursPage() {
  const { session } = useWallet();
  const router = useRouter();
  const { write, pending } = useTx();
  const now = useNow(10000) / 1000;

  const bal = usePoll(() => (session ? readBalances(session.address) : Promise.resolve(undefined)), [session?.address], 10000);
  const mine = usePoll(
    async () => (session ? (await scanDeliveries()).filter((d) => d.buyer.toLowerCase() === session.address.toLowerCase()).reverse() : []),
    [session?.address],
    10000,
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
      const ev = parseEventLogs({ abi: deliveryEscrowAbi, logs: receipt.logs, eventName: "DeliveryRequested" })[0];
      if (ev) router.push(`/delivery/${ev.args.deliveryId}`);
    } catch {
      /* toast already shown */
    }
  };

  return (
    <>
      <PageTitle title="My hours & deliveries" sub="Redeem HourTokens for a real GPU machine. Credentials come back encrypted to your passkey." />
      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      <SignInGate what="see your hours">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Your HourTokens">
            {!bal.data ? (
              <Spinner />
            ) : (
              <ul className="divide-y divide-grid-700">
                {SERIES.map((x) => (
                  <li key={x.symbol} className="py-3 flex justify-between items-center text-sm gap-2">
                    <div>
                      <div className="font-semibold">{x.symbol}</div>
                      <div className="text-xs text-gray-500">
                        {x.className} · {fmtDate(x.windowStart)} – {fmtDate(x.windowEnd)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{fmtNum(hoursFromWei(bal.data!.hours[x.symbol]))} h</div>
                      <Link href={`/market/${x.symbol}`} className="text-xs text-grid-monad underline">
                        trade
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Redeem for a machine">
            <p className="text-xs text-gray-400">
              Redeeming burns HourTokens and assigns the first provider in the FIFO queue. Your passkey&apos;s PRF output derives a
              separate X25519 key (not your wallet key). Its public half goes onchain, so only you can decrypt the SSH credentials.
            </p>
            <div className="space-y-3">
              <Field label="Series">
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
                  {SERIES.map((x) => (
                    <option key={x.symbol} value={x.symbol}>
                      {x.symbol}
                      {now < x.windowStart ? ` (opens ${fmtDate(x.windowStart)})` : now > x.windowEnd ? " (window closed)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hours" hint={`You hold ${fmtNum(owned)} h`}>
                <input type="number" min="1" step="1" value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} />
              </Field>
              {session && (
                <div className="text-xs text-gray-500 break-all">
                  Delivery key: <span className="font-mono text-gray-300">{bytesToHex(session.deliveryKey.publicKey)}</span>
                </div>
              )}
              {!inWindow && s && <ErrorBox>{s.symbol} can only be redeemed during its delivery window.</ErrorBox>}
              <Button className="w-full !py-3" onClick={redeem} loading={pending} disabled={!inWindow || !(h >= 1) || h > owned}>
                Redeem {h >= 1 ? h : ""}h & request machine
              </Button>
            </div>
          </Card>
        </div>

        <Card title="My deliveries" className="mt-6">
          {mine.loading && !mine.data ? (
            <Spinner />
          ) : mine.error ? (
            <ErrorBox>{mine.error}</ErrorBox>
          ) : (
            <DeliveryList items={mine.data ?? []} empty="No deliveries yet. Redeem some hours above." />
          )}
        </Card>
      </SignInGate>
    </>
  );
}
