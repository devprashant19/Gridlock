"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function MarketPage({ params }: { params?: Promise<{ series: string }> }) {
  const routerParams = useParams();
  const paramFromRouter = (routerParams?.series as string) ?? "";
  const resolvedProps = params ? use(params) : null;
  const rawSymbol = paramFromRouter || resolvedProps?.series || "";
  const symbol = decodeURIComponent(rawSymbol);
  const s = seriesBySymbol(symbol);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <Empty>
            Unknown series “{symbol}”.{" "}
            <Link href="/" className="underline text-grid-monad font-bold">
              Back to Forward Curve
            </Link>
          </Empty>
        </Card>
      </div>
    );
  }

  const spot = idx.data?.[s.className] ? priceE8ToUsd(idx.data[s.className]!.priceE8) : null;
  const bestAsk = book.data?.asks[0]?.[0];
  const basis = spot != null && bestAsk != null ? ((bestAsk - spot) / spot) * 100 : null;
  const gpuInfo = GPU_CLASSES[s.className];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-black">
      <PageTitle
        title={
          <div className="flex items-center gap-3">
            <span>{s.symbol}</span>
            <Badge tone="yellow" pulse>
              MONAD L2 ORDER BOOK
            </Badge>
          </div>
        }
        sub={
          <span className="font-mono text-xs sm:text-sm text-black/70 font-medium">
            {s.className} ({gpuInfo?.ratedTflops ?? "?"} TFLOPS FP16) · Window: {fmtDate(s.windowStart)} – {fmtDate(s.windowEnd)} · Physically Delivered (1 Token = 1 GPU-Hour)
          </span>
        }
        right={
          <div className="flex gap-2 overflow-x-auto sleek-scroll no-scrollbar py-1">
            {SERIES.map((x) => (
              <Link
                key={x.symbol}
                href={`/market/${x.symbol}`}
                className={`px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider whitespace-nowrap border-2 border-black transition-all ${
                  x.symbol === s.symbol
                    ? "bg-neo-yellow text-black shadow-[2px_2px_0px_#000]"
                    : "bg-white text-black hover:bg-neo-cream"
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
        <div className="bg-neo-yellow/30 border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] font-mono font-black uppercase text-black/60">Ornn Spot Benchmark</div>
          <div className="text-xl font-black font-mono text-black mt-1">
            {spot != null ? fmtUsd(spot, 4) : "—"} / hr
          </div>
          <div className="text-[10px] text-black/60 font-mono font-medium mt-0.5">Reference Spot Index</div>
        </div>
        <div className="bg-neo-blue/30 border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] font-mono font-black uppercase text-black/60">Best Kuru Ask</div>
          <div className="text-xl font-black font-mono text-black mt-1">
            {bestAsk != null ? fmtUsd(bestAsk, 4) : "—"} / hr
          </div>
          <div className="text-[10px] text-black/60 font-mono font-medium mt-0.5">Immediate Fill Ask</div>
        </div>
        <div className="bg-neo-pink/30 border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] font-mono font-black uppercase text-black/60">Forward Basis Spread</div>
          <div className="text-xl font-black font-mono mt-1">
            {basis != null ? (
              <span className={basis <= 0 ? "text-emerald-700" : "text-rose-700"}>
                {basis > 0 ? `+${basis.toFixed(1)}%` : `${basis.toFixed(1)}%`}
              </span>
            ) : (
              <span className="text-black/40">—</span>
            )}
          </div>
          <div className="text-[10px] text-black/60 font-mono font-medium mt-0.5">
            {basis != null && basis <= 0 ? "Forward Discount" : "Forward Premium"}
          </div>
        </div>
        <div className="bg-neo-green/30 border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] font-mono font-black uppercase text-black/60">Hardware Pass Bar</div>
          <div className="text-xl font-black font-mono text-black mt-1">
            ≥ {gpuInfo?.passMinTflops ?? "?"} TF
          </div>
          <div className="text-[10px] text-black/60 font-mono font-medium mt-0.5">Slashes if &lt; {gpuInfo?.failMaxTflops ?? "?"} TF</div>
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
                className="text-xs font-mono font-bold text-black underline flex items-center gap-1 hover:text-black/70"
              >
                <span>DEX: {s.kuruMarket.slice(0, 10)}…</span>
                <span>↗</span>
              </a>
            ) : (
              <span className="text-xs font-mono text-black/50">Market not deployed</span>
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
                  <div className="flex justify-between items-center p-2.5 bg-neo-cream border-2 border-black shadow-[2px_2px_0px_#000]">
                    <span className="text-black/70 font-sans font-bold">gUSD Stablecoin:</span>
                    <span className="font-black text-black">{fmtNum(gusd(bal.data.gusd))} gUSD</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-neo-cream border-2 border-black shadow-[2px_2px_0px_#000]">
                    <span className="text-black/70 font-sans font-bold">{s.symbol} in Wallet:</span>
                    <span className="font-black text-black">{fmtNum(hoursFromWei(bal.data.hours[s.symbol]))} h</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-neo-cream border-2 border-black shadow-[2px_2px_0px_#000]">
                    <span className="text-black/70 font-sans font-bold">{s.symbol} on Kuru Margin:</span>
                    <span className="font-black text-black">{fmtNum(bal.data.marginHours)} h</span>
                  </div>

                  <Link
                    href="/hours"
                    className="block text-center py-2.5 bg-neo-yellow hover:bg-neo-yellow/80 border-2 border-black shadow-[3px_3px_0px_#000] text-black font-sans font-black text-xs uppercase tracking-wider transition-transform active:translate-x-[1px] active:translate-y-[1px]"
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
      <div className="relative grid grid-cols-3 px-3 py-1.5 font-mono text-xs transition-colors hover:bg-black/5 group border-b border-black/10">
        <div
          className={`absolute inset-y-0 right-0 transition-all duration-300 ${
            side === "ask" ? "bg-rose-500/20 group-hover:bg-rose-500/30" : "bg-emerald-500/20 group-hover:bg-emerald-500/30"
          }`}
          style={{ width: `${widthPct}%` }}
        />
        <span className={`relative font-black ${side === "ask" ? "text-rose-700" : "text-emerald-700"}`}>
          ${l[0].toFixed(4)}
        </span>
        <span className="relative text-right text-black font-bold">{fmtNum(l[1], 2)} h</span>
        <span className="relative text-right text-black/60 font-medium">${fmtNum(l[0] * l[1], 2)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-2 font-tabular">
      <div className="grid grid-cols-3 px-3 text-[11px] font-mono font-black uppercase tracking-wider text-black pb-2 border-b-2 border-black">
        <span>Price (gUSD/h)</span>
        <span className="text-right">Hours Depth</span>
        <span className="text-right">Total (gUSD)</span>
      </div>

      {/* Asks (Red) */}
      <div className="space-y-0.5">
        {asks.length ? (
          asks.map((l) => <LevelRow key={`a-${l[0]}`} l={l} side="ask" />)
        ) : (
          <div className="text-xs text-black/50 px-3 py-3 font-mono">No resting asks on order book</div>
        )}
      </div>

      {/* Mid-Market Spread Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 my-2 border-2 border-black bg-neo-yellow/30 text-xs font-mono shadow-[2px_2px_0px_#000]">
        <div className="flex items-center gap-2">
          <span className="text-black/60 font-black uppercase text-[10px]">SPREAD:</span>
          <span className="font-black text-black">
            {spread != null ? `${spread.toFixed(4)} gUSD (${spreadBps?.toFixed(0)} bps)` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-black/60 font-black uppercase text-[10px]">SPOT BENCHMARK:</span>
          <span className="font-black text-black">{spot != null ? fmtUsd(spot, 4) : "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-black font-bold text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
          <span>{book.blockNumber ? `BLOCK #${book.blockNumber}` : "LIVE 400MS"}</span>
        </div>
      </div>

      {/* Bids (Green) */}
      <div className="space-y-0.5">
        {bids.length ? (
          bids.map((l) => <LevelRow key={`b-${l[0]}`} l={l} side="bid" />)
        ) : (
          <div className="text-xs text-black/50 px-3 py-3 font-mono">No resting bids on order book</div>
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

  const setHoursQuote = (hrs: number) => {
    const ask = book.asks[0]?.[0] ?? 0.355;
    const val = (hrs * ask).toFixed(2);
    setQuote(val);
  };

  return (
    <div className="space-y-4">
      {/* Side Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <button
          onClick={() => setSide("buy")}
          className={`py-2.5 font-black uppercase tracking-wider border-2 border-black transition-all ${
            side === "buy"
              ? "bg-neo-green text-black shadow-[3px_3px_0px_#000]"
              : "bg-white text-black/70 hover:bg-neo-cream"
          }`}
        >
          BUY FORWARD (IOC)
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`py-2.5 font-black uppercase tracking-wider border-2 border-black transition-all ${
            side === "sell"
              ? "bg-neo-pink text-black shadow-[3px_3px_0px_#000]"
              : "bg-white text-black/70 hover:bg-neo-cream"
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
                  className="text-black font-black underline hover:text-black/70"
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
              <span className="absolute right-3.5 top-3 text-xs font-mono font-bold text-black/60">gUSD</span>
            </div>
          </Field>

          {/* Quick Presets: Hours & Wallet Percentages */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase text-black/60">
              <span>Quick Presets:</span>
              <span>Compute Hours</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 5, 10].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setHoursQuote(hrs)}
                  className="py-1.5 bg-white hover:bg-neo-yellow border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                >
                  {hrs} {hrs === 1 ? "Hour" : "Hours"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercentQuote(pct)}
                  className="py-1 bg-white/70 hover:bg-neo-cream border border-black text-[11px] font-mono font-bold text-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                >
                  {pct * 100}%
                </button>
              ))}
            </div>
          </div>

          <Field label="Max Slippage Limit (%)" hint={`${slippage}% max price drift`}>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full accent-black cursor-pointer"
            />
          </Field>

          {/* Fill Estimation Receipt */}
          <div className="p-3.5 border-2 border-black bg-neo-cream shadow-[3px_3px_0px_#000] text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-black/70 font-bold">Est. Hours Acquired:</span>
              <span className="font-black text-black">{fmtNum(est.hours, 4)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black/70 font-bold">Effective Execution Price:</span>
              <span className="font-black text-black">
                {est.avgPrice ? `$${est.avgPrice.toFixed(4)} / hr` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black/70 font-bold">Min Guaranteed (Slippage Gate):</span>
              <span className="font-black text-black">{fmtNum(minOut, 4)} h</span>
            </div>
            {est.unfilledQuote > 0.0001 && (
              <div className="text-amber-800 font-bold text-[11px] pt-1 border-t border-black/20">
                Book depth tight: {est.unfilledQuote.toFixed(2)} gUSD will be refunded (IOC)
              </div>
            )}
          </div>

          <Button
            className="w-full !py-3.5 font-mono text-sm font-black uppercase tracking-wider bg-neo-yellow hover:bg-neo-yellow/90 text-black border-2 border-black shadow-[3px_3px_0px_#000]"
            onClick={buy}
            loading={pending}
            disabled={!(Number(quote) > 0) || est.hours <= 0}
          >
            ⚡ 1-CLICK MARKET BUY ({symbol})
          </Button>
          <p className="text-[11px] text-black/60 font-mono font-medium text-center">
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
            className="w-full !py-3.5 font-mono text-sm font-black uppercase tracking-wider"
            onClick={sell}
            loading={pending}
            disabled={!(Number(sellHours) > 0 && Number(sellPrice) > 0)}
          >
            DEPOSIT MARGIN & PLACE ASK
          </Button>
          <p className="text-[11px] text-black/60 font-mono font-medium text-center">
            HourTokens deposit to Kuru Margin Account · Post-Only GTC Ask
          </p>
        </div>
      )}
    </div>
  );
}
