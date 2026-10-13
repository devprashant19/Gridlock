"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { addressUrl, IS_MOCK, SERIES, seriesBySymbol } from "@/lib/config";
import { readBalances, readBook, readIndexPrices } from "@/lib/data";
import { fmtDate, fmtNum, fmtUsd, gusd, hoursFromWei, priceE8ToUsd } from "@/lib/format";
import { usePoll, useTx } from "@/lib/hooks";
import { estimateBuy, limitSell, marginBalance, marketBuy, type Book } from "@/lib/kuru";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { Button, Card, Empty, ErrorBox, Field, GasWarning, MockBanner, PageTitle, SignInGate, Spinner, inputCls } from "@/components/ui";

export default function MarketPage({ params }: { params: Promise<{ series: string }> }) {
  const { series: symbol } = use(params);
  const s = seriesBySymbol(decodeURIComponent(symbol));
  const { session } = useWallet();

  const book = usePoll(() => (s ? readBook(s) : Promise.resolve(null)), [s?.symbol], 1000);
  const idx = usePoll(readIndexPrices, [], 30000);
  const bal = usePoll(
    async () => {
      if (!session || !s) return undefined;
      const b = await readBalances(session.address);
      const margin = !IS_MOCK && s.kuruMarket ? await marginBalance(session.address, s.token).catch(() => null) : null;
      return { ...b, marginHours: margin ? Number(margin.toString()) / 1e18 : 0 };
    },
    [session?.address, s?.symbol],
    5000,
  );

  if (!s) {
    return (
      <Card>
        <Empty>
          Unknown series “{symbol}”.{" "}
          <Link href="/" className="underline">
            Back to the curve
          </Link>
        </Empty>
      </Card>
    );
  }

  const spot = idx.data?.[s.className] ? priceE8ToUsd(idx.data[s.className]!.priceE8) : null;

  return (
    <>
      <PageTitle
        title={s.symbol}
        sub={
          <>
            {s.className} · delivery {fmtDate(s.windowStart)} – {fmtDate(s.windowEnd)} · physically delivered, 1 token = 1 GPU-hour
          </>
        }
        right={
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {SERIES.map((x) => (
              <Link
                key={x.symbol}
                href={`/market/${x.symbol}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border ${x.symbol === s.symbol ? "bg-grid-monad text-black border-grid-monad" : "bg-grid-800 border-grid-700 text-gray-300 hover:text-white"}`}
              >
                {x.symbol}
              </Link>
            ))}
          </div>
        }
      />
      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="lg:col-span-2"
          title="Kuru order book"
          right={
            s.kuruMarket ? (
              <a href={addressUrl(s.kuruMarket)} target="_blank" rel="noreferrer" className="text-xs font-mono text-grid-monad hover:underline">
                {s.kuruMarket.slice(0, 10)}… ↗
              </a>
            ) : (
              <span className="text-xs text-gray-500">market not deployed</span>
            )
          }
        >
          {book.loading && !book.data ? (
            <Spinner label="Loading book…" />
          ) : book.error && !book.data ? (
            <ErrorBox>Couldn&apos;t read the order book: {book.error}</ErrorBox>
          ) : !book.data ? (
            <Empty>No Kuru market for this series yet.</Empty>
          ) : (
            <BookView book={book.data} spot={spot} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Trade">
            <SignInGate what="trade">{book.data && <TradeForm market={s.kuruMarket} book={book.data} symbol={s.symbol} />}</SignInGate>
          </Card>
          {session && (
            <Card title="Balances">
              {bal.data ? (
                <dl className="text-sm space-y-2">
                  <Row k="gUSD" v={fmtNum(gusd(bal.data.gusd))} />
                  <Row k={`${s.symbol} (wallet)`} v={`${fmtNum(hoursFromWei(bal.data.hours[s.symbol]))} h`} />
                  <Row k={`${s.symbol} (Kuru margin)`} v={`${fmtNum(bal.data.marginHours)} h`} />
                  <Link href="/hours" className="block text-xs text-grid-monad underline pt-1">
                    Redeem hours for a machine →
                  </Link>
                </dl>
              ) : (
                <Spinner />
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

function BookView({ book, spot }: { book: Book; spot: number | null }) {
  const asks = book.asks.slice(0, 8).reverse();
  const bids = book.bids.slice(0, 8);
  const maxSize = Math.max(1, ...asks.map((a) => a[1]), ...bids.map((b) => b[1]));
  const bestAsk = book.asks[0]?.[0];
  const bestBid = book.bids[0]?.[0];
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;

  const LevelRow = ({ l, side }: { l: [number, number]; side: "ask" | "bid" }) => (
    <div className="relative grid grid-cols-3 px-2 py-1 rounded font-mono text-sm">
      <div
        className={`absolute inset-y-0 right-0 rounded ${side === "ask" ? "bg-red-500/10" : "bg-green-500/10"}`}
        style={{ width: `${(l[1] / maxSize) * 100}%` }}
      />
      <span className={`relative ${side === "ask" ? "text-red-400" : "text-green-400"}`}>{l[0].toFixed(4)}</span>
      <span className="relative text-right">{fmtNum(l[1])}</span>
      <span className="relative text-right text-gray-400">{fmtNum(l[0] * l[1])}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 px-2 text-xs uppercase text-gray-500 pb-1 border-b border-grid-700">
        <span>Price (gUSD/h)</span>
        <span className="text-right">Hours</span>
        <span className="text-right">Total gUSD</span>
      </div>
      {asks.length ? asks.map((l) => <LevelRow key={`a${l[0]}`} l={l} side="ask" />) : <div className="text-xs text-gray-500 px-2 py-2">No asks</div>}
      <div className="flex flex-wrap justify-between gap-2 px-2 py-2 my-1 border-y border-grid-700 text-xs">
        <span>
          Spread <span className="font-mono text-white">{spread != null ? spread.toFixed(4) : "—"}</span>
        </span>
        <span>
          Spot index <span className="font-mono text-white">{spot != null ? fmtUsd(spot, 4) : "—"}</span>
        </span>
        <span className="text-gray-500">{book.blockNumber ? `block ${book.blockNumber}` : "live · 1s"}</span>
      </div>
      {bids.length ? bids.map((l) => <LevelRow key={`b${l[0]}`} l={l} side="bid" />) : <div className="text-xs text-gray-500 px-2 py-2">No bids</div>}
    </div>
  );
}

function TradeForm({ market, book, symbol }: { market?: `0x${string}`; book: Book; symbol: string }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quote, setQuote] = useState("5");
  const [slippage, setSlippage] = useState("2");
  const [sellHours, setSellHours] = useState("1");
  const [sellPrice, setSellPrice] = useState(() => (book.asks[0]?.[0] ?? book.bids[0]?.[0] ?? 0.4).toFixed(4));
  const { run, pending } = useTx();

  const est = useMemo(() => estimateBuy(book, Number(quote) || 0), [book, quote]);
  const minOut = est.hours * (1 - (Number(slippage) || 0) / 100);

  const buy = () =>
    run(`Buy ${symbol}`, (s) => {
      if (!market) throw new Error("No Kuru market for this series");
      return marketBuy(s.ethersSigner, market, Number(quote), minOut);
    }).catch(() => {});

  const sell = () =>
    run(`Sell ${sellHours}h ${symbol}`, (s) => {
      if (!market) throw new Error("No Kuru market for this series");
      return limitSell(s.ethersSigner, market, Number(sellPrice), Number(sellHours));
    }).catch(() => {});

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-grid-900 p-1 text-sm">
        {(["buy", "sell"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSide(k)}
            className={`flex-1 py-1.5 font-semibold rounded ${side === k ? (k === "buy" ? "bg-grid-pass text-black" : "bg-grid-fail text-white") : "text-gray-400 hover:text-white"}`}
          >
            {k === "buy" ? "Buy (market)" : "Sell (limit)"}
          </button>
        ))}
      </div>

      {side === "buy" ? (
        <div className="space-y-3">
          <Field label="Spend (gUSD)">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={quote} onChange={(e) => setQuote(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Max slippage (%)">
            <input type="number" min="0" step="0.5" inputMode="decimal" value={slippage} onChange={(e) => setSlippage(e.target.value)} className={inputCls} />
          </Field>
          <div className="p-3 rounded-lg bg-grid-900 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Est. hours</span>
              <span className="font-mono">{fmtNum(est.hours, 4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg price</span>
              <span className="font-mono">{est.avgPrice ? est.avgPrice.toFixed(4) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min received</span>
              <span className="font-mono">{fmtNum(minOut, 4)} h</span>
            </div>
            {est.unfilledQuote > 0.0001 && <div className="text-grid-degraded">Book too thin: {est.unfilledQuote.toFixed(2)} gUSD won&apos;t fill (IOC)</div>}
          </div>
          <Button className="w-full !py-3" onClick={buy} loading={pending} disabled={!(Number(quote) > 0) || est.hours <= 0}>
            Buy {symbol}
          </Button>
          <p className="text-xs text-gray-500">Approves gUSD to the Kuru book and fills immediately-or-cancel. Signed by your passkey session, no extra prompt.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Hours">
            <input type="number" min="0" step="1" inputMode="decimal" value={sellHours} onChange={(e) => setSellHours(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Limit price (gUSD / hour)">
            <input type="number" min="0" step="0.001" inputMode="decimal" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className={inputCls} />
          </Field>
          <Button variant="danger" className="w-full !py-3" onClick={sell} loading={pending} disabled={!(Number(sellHours) > 0 && Number(sellPrice) > 0)}>
            Deposit & place ask
          </Button>
          <p className="text-xs text-gray-500">Deposits your HourTokens to the Kuru margin account, then rests a post-only GTC ask.</p>
        </div>
      )}
    </div>
  );
}
