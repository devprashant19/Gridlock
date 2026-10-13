"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { addressUrl, GPU_CLASSES, IS_MOCK, SERIES, seriesBySymbol } from "@/lib/config";
import { readBalances, readBook, readIndexPrices } from "@/lib/data";
import { fmtDate, fmtNum, fmtUsd, gusd, hoursFromWei, priceE8ToUsd } from "@/lib/format";
import { usePoll, useTx } from "@/lib/hooks";
import { estimateBuy, limitSell, marginBalance, marketBuy, type Book } from "@/lib/kuru";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  Button,
  Card,
  Empty,
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
    5000
  );

  if (!s) {
    return (
      <Card>
        <Empty>
          Unknown series “{symbol}”.{" "}
          <Link href="/" className="underline text-grid-monad font-bold">
            Back to Forward Curve
          </Link>
        </Empty>
      </Card>
    );
  }

  const spot = idx.data?.[s.className] ? priceE8ToUsd(idx.data[s.className]!.priceE8) : null;
  const bestAsk = book.data?.asks[0]?.[0];
  const basis = spot != null && bestAsk != null ? ((bestAsk - spot) / spot) * 100 : null;
  const gpuInfo = GPU_CLASSES[s.className];

  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <div className="flex items-center gap-3">
            <span>{s.symbol}</span>
            <Badge tone="cyan" pulse>
              MONAD L2 ORDER BOOK
            </Badge>
          </div>
        }
        sub={
          <span className="font-mono text-xs sm:text-sm text-gray-300">
            {s.className} ({gpuInfo?.ratedTflops ?? "?"} TFLOPS FP16) · Window: {fmtDate(s.windowStart)} – {fmtDate(s.windowEnd)} · Physically Delivered (1 Token = 1 GPU-Hour)
          </span>
        }
        right={
          <div className="flex gap-1.5 overflow-x-auto sleek-scroll no-scrollbar py-1">
            {SERIES.map((x) => (
              <Link
                key={x.symbol}
                href={`/market/${x.symbol}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap border transition-all ${
                  x.symbol === s.symbol
                    ? "bg-grid-monad text-black border-grid-monad shadow-sm shadow-grid-monad/30"
                    : "bg-surface border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                }`}
              >
                {x.symbol}
              </Link>
            ))}
          </div>
        }
      />

      <MockBanner />
      <GasWarning mon={bal.data?.mon} />

      {/* Market Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="hud-box p-3 rounded-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Ornn Spot Benchmark</div>
          <div className="text-lg font-bold font-mono text-white mt-0.5">
            {spot != null ? fmtUsd(spot, 4) : "—"} / hr
          </div>
          <div className="text-[10px] text-gray-500 font-mono">Reference Spot Index</div>
        </div>
        <div className="hud-box p-3 rounded-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Best Kuru Ask</div>
          <div className="text-lg font-bold font-mono text-grid-monad mt-0.5">
            {bestAsk != null ? fmtUsd(bestAsk, 4) : "—"} / hr
          </div>
          <div className="text-[10px] text-gray-500 font-mono">Immediate Fill Ask</div>
        </div>
        <div className="hud-box p-3 rounded-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Forward Basis Spread</div>
          <div className="text-lg font-bold font-mono mt-0.5">
            {basis != null ? (
              <span className={basis <= 0 ? "text-grid-pass" : "text-grid-fail"}>
                {basis > 0 ? `+${basis.toFixed(1)}%` : `${basis.toFixed(1)}%`}
              </span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            {basis != null && basis <= 0 ? "Forward Discount" : "Forward Premium"}
          </div>
        </div>
        <div className="hud-box p-3 rounded-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Hardware Pass Bar</div>
          <div className="text-lg font-bold font-mono text-grid-cyan mt-0.5">
            ≥ {gpuInfo?.passMinTflops ?? "?"} TF
          </div>
          <div className="text-[10px] text-gray-500 font-mono">Slashes if &lt; {gpuInfo?.failMaxTflops ?? "?"} TF</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* L2 Order Book Container */}
        <Card
          className="lg:col-span-2"
          title="Kuru High-Frequency L2 Order Book"
          right={
            s.kuruMarket ? (
              <a
                href={addressUrl(s.kuruMarket)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-grid-cyan hover:underline flex items-center gap-1"
              >
                <span>DEX: {s.kuruMarket.slice(0, 10)}…</span>
                <span>↗</span>
              </a>
            ) : (
              <span className="text-xs font-mono text-gray-500">Market not deployed</span>
            )
          }
        >
          {book.loading && !book.data ? (
            <Spinner label="Loading live L2 order book…" />
          ) : book.error && !book.data ? (
            <ErrorBox>Failed to read Kuru book: {book.error}</ErrorBox>
          ) : !book.data ? (
            <Empty>No active Kuru order book for this series.</Empty>
          ) : (
            <BookView book={book.data} spot={spot} />
          )}
        </Card>

        {/* Trade & Account Cockpit */}
        <div className="space-y-6">
          <Card title="Order Execution Terminal">
            <SignInGate what="execute forward compute trades">
              {book.data && (
                <TradeForm
                  market={s.kuruMarket}
                  book={book.data}
                  symbol={s.symbol}
                  userGusd={bal.data?.gusd}
                  userHours={bal.data ? hoursFromWei(bal.data.hours[s.symbol]) : 0}
                />
              )}
            </SignInGate>
          </Card>

          {session && (
            <Card title="Account Balances & Margin">
              {bal.data ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center p-2 rounded bg-obsidian/60 border border-white/[0.06]">
                    <span className="text-gray-400 font-sans">gUSD Stablecoin:</span>
                    <span className="font-bold text-white">{fmtNum(gusd(bal.data.gusd))} gUSD</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-obsidian/60 border border-white/[0.06]">
                    <span className="text-gray-400 font-sans">{s.symbol} in Wallet:</span>
                    <span className="font-bold text-grid-monad">{fmtNum(hoursFromWei(bal.data.hours[s.symbol]))} h</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-obsidian/60 border border-white/[0.06]">
                    <span className="text-gray-400 font-sans">{s.symbol} on Kuru Margin:</span>
                    <span className="font-bold text-grid-cyan">{fmtNum(bal.data.marginHours)} h</span>
                  </div>

                  <Link
                    href="/hours"
                    className="block text-center py-2.5 rounded-lg bg-surface hover:bg-grid-700/80 border border-white/10 hover:border-grid-cyan text-grid-cyan font-sans font-semibold text-xs transition-colors"
                  >
                    Redeem Hours for Machine Access →
                  </Link>
                </div>
              ) : (
                <Spinner />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BookView({ book, spot }: { book: Book; spot: number | null }) {
  const asks = book.asks.slice(0, 9).reverse();
  const bids = book.bids.slice(0, 9);
  const maxSize = Math.max(1, ...asks.map((a) => a[1]), ...bids.map((b) => b[1]));
  const bestAsk = book.asks[0]?.[0];
  const bestBid = book.bids[0]?.[0];
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const spreadBps = bestAsk != null && spread != null ? (spread / bestAsk) * 10000 : null;

  const LevelRow = ({ l, side }: { l: [number, number]; side: "ask" | "bid" }) => {
    const widthPct = Math.min(100, Math.max(4, (l[1] / maxSize) * 100));
    return (
      <div className="relative grid grid-cols-3 px-3 py-1.5 rounded font-mono text-xs transition-colors hover:bg-white/[0.04] group">
        <div
          className={`absolute inset-y-0 right-0 rounded transition-all duration-300 ${
            side === "ask" ? "bg-red-500/15 group-hover:bg-red-500/25" : "bg-emerald-500/15 group-hover:bg-emerald-500/25"
          }`}
          style={{ width: `${widthPct}%` }}
        />
        <span className={`relative font-bold ${side === "ask" ? "text-red-400" : "text-emerald-400"}`}>
          ${l[0].toFixed(4)}
        </span>
        <span className="relative text-right text-white font-medium">{fmtNum(l[1], 2)} h</span>
        <span className="relative text-right text-gray-400">${fmtNum(l[0] * l[1], 2)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 font-tabular">
      <div className="grid grid-cols-3 px-3 text-[11px] font-mono uppercase tracking-wider text-gray-400 pb-2 border-b border-white/[0.08]">
        <span>Price (gUSD/h)</span>
        <span className="text-right">Hours Depth</span>
        <span className="text-right">Total (gUSD)</span>
      </div>

      {/* Asks (Red) */}
      <div className="space-y-0.5">
        {asks.length ? (
          asks.map((l) => <LevelRow key={`a-${l[0]}`} l={l} side="ask" />)
        ) : (
          <div className="text-xs text-gray-500 px-3 py-3 font-mono">No resting asks on order book</div>
        )}
      </div>

      {/* Mid-Market Spread Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 my-2 border-y border-white/[0.08] bg-obsidian/60 text-xs font-mono rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 uppercase text-[10px]">SPREAD:</span>
          <span className="font-bold text-white">
            {spread != null ? `${spread.toFixed(4)} gUSD (${spreadBps?.toFixed(0)} bps)` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 uppercase text-[10px]">SPOT BENCHMARK:</span>
          <span className="font-bold text-grid-cyan">{spot != null ? fmtUsd(spot, 4) : "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-grid-monad animate-ping" />
          <span>{book.blockNumber ? `BLOCK #${book.blockNumber}` : "LIVE 400MS"}</span>
        </div>
      </div>

      {/* Bids (Green) */}
      <div className="space-y-0.5">
        {bids.length ? (
          bids.map((l) => <LevelRow key={`b-${l[0]}`} l={l} side="bid" />)
        ) : (
          <div className="text-xs text-gray-500 px-3 py-3 font-mono">No resting bids on order book</div>
        )}
      </div>
    </div>
  );
}

function TradeForm({
  market,
  book,
  symbol,
  userGusd,
  userHours,
}: {
  market?: `0x${string}`;
  book: Book;
  symbol: string;
  userGusd?: bigint;
  userHours?: number;
}) {
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

  const setPercentQuote = (pct: number) => {
    if (userGusd !== undefined) {
      const maxVal = gusd(userGusd);
      const val = (maxVal * pct).toFixed(2);
      setQuote(val);
    }
  };

  return (
    <div className="space-y-4">
      {/* Side Selector Tabs */}
      <div className="flex rounded-lg bg-obsidian p-1 border border-white/[0.08] text-xs font-mono">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 py-2 font-bold rounded-md transition-all ${
            side === "buy"
              ? "bg-grid-pass text-black shadow-md shadow-grid-pass/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          BUY FORWARD (IOC)
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 py-2 font-bold rounded-md transition-all ${
            side === "sell"
              ? "bg-grid-fail text-white shadow-md shadow-grid-fail/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          SELL FORWARD (GTC)
        </button>
      </div>

      {side === "buy" ? (
        <div className="space-y-3.5">
          <Field
            label="Spend Amount (gUSD)"
            hint={
              userGusd !== undefined ? (
                <button
                  type="button"
                  onClick={() => setPercentQuote(1)}
                  className="text-grid-cyan hover:underline"
                >
                  Max: ${gusd(userGusd).toFixed(2)}
                </button>
              ) : undefined
            }
          >
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                className={`${inputCls} pr-14`}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2.5 text-xs font-mono text-gray-500">gUSD</span>
            </div>
          </Field>

          {/* Quick Percentage Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[0.25, 0.5, 0.75, 1.0].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPercentQuote(pct)}
                className="py-1 rounded bg-surface hover:bg-grid-700/80 border border-white/[0.06] text-[10px] font-mono text-gray-300 hover:text-white transition-colors"
              >
                {pct * 100}%
              </button>
            ))}
          </div>

          <Field label="Max Slippage Limit (%)" hint={`${slippage}% max price drift`}>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full accent-grid-monad cursor-pointer"
            />
          </Field>

          {/* Fill Estimation Receipt */}
          <div className="p-3 rounded-lg bg-obsidian border border-white/[0.08] text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-400">Est. Hours Acquired:</span>
              <span className="font-bold text-white">{fmtNum(est.hours, 4)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Effective Execution Price:</span>
              <span className="font-bold text-grid-monad">
                {est.avgPrice ? `$${est.avgPrice.toFixed(4)} / hr` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min Guaranteed (Slippage Gate):</span>
              <span className="text-grid-cyan">{fmtNum(minOut, 4)} h</span>
            </div>
            {est.unfilledQuote > 0.0001 && (
              <div className="text-grid-degraded text-[11px] pt-1 border-t border-white/[0.06]">
                Book depth tight: {est.unfilledQuote.toFixed(2)} gUSD will be refunded (IOC)
              </div>
            )}
          </div>

          <Button
            className="w-full !py-3 font-mono text-sm tracking-wider"
            onClick={buy}
            loading={pending}
            disabled={!(Number(quote) > 0) || est.hours <= 0}
          >
            ⚡ BUY {symbol} FORWARDS
          </Button>
          <p className="text-[11px] text-gray-500 font-mono text-center">
            Signed by Mera Passkey session · Monad 400ms Sub-Second Fill
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <Field
            label="Hours to Sell"
            hint={userHours !== undefined ? `In Wallet: ${fmtNum(userHours)} h` : undefined}
          >
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={sellHours}
              onChange={(e) => setSellHours(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Limit Ask Price (gUSD / hour)">
            <input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Button
            variant="danger"
            className="w-full !py-3 font-mono text-sm tracking-wider"
            onClick={sell}
            loading={pending}
            disabled={!(Number(sellHours) > 0 && Number(sellPrice) > 0)}
          >
            DEPOSIT MARGIN & PLACE ASK
          </Button>
          <p className="text-[11px] text-gray-500 font-mono text-center">
            HourTokens deposit to Kuru Margin Account · Post-Only GTC Ask
          </p>
        </div>
      )}
    </div>
  );
}
