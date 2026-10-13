// Kuru order book access (ethers v5 SDK). Reads use a public provider; writes use the
// scoped Mera ethers signer, so every tx still passes the session allowlist + cap.
import { ethers } from "ethers";
import type { MarketParams } from "@kuru-labs/kuru-sdk";
import { getEthersProvider } from "./chain";
import { KURU_MARGIN_ACCOUNT } from "./config";

type Level = [price: number, size: number];
export type Book = { asks: Level[]; bids: Level[]; blockNumber: number };

const sdk = () => import("@kuru-labs/kuru-sdk");
const paramsCache = new Map<string, Promise<MarketParams>>();

export function getMarketParams(market: string) {
  let p = paramsCache.get(market);
  if (!p) {
    p = sdk().then(({ ParamFetcher }) => ParamFetcher.getMarketParams(getEthersProvider(), market));
    p.catch(() => paramsCache.delete(market));
    paramsCache.set(market, p);
  }
  return p;
}

export async function getBook(market: string): Promise<Book> {
  const { OrderBook } = await sdk();
  const params = await getMarketParams(market);
  const b = await OrderBook.getL2OrderBook(getEthersProvider(), market, params);
  // SDK returns both sides price-descending; show asks ascending from the spread.
  const asks = (b.asks as Level[]).filter(([, s]) => s > 0).sort((x, y) => x[0] - y[0]);
  const bids = (b.bids as Level[]).filter(([, s]) => s > 0).sort((x, y) => y[0] - x[0]);
  return { asks, bids, blockNumber: b.blockNumber };
}

/** Walk the asks to estimate hours received for `quote` gUSD. */
export function estimateBuy(book: Book, quote: number) {
  let left = quote;
  let hours = 0;
  for (const [price, size] of book.asks) {
    const cost = price * size;
    if (cost >= left) {
      hours += left / price;
      left = 0;
      break;
    }
    hours += size;
    left -= cost;
  }
  return { hours, unfilledQuote: left, avgPrice: hours > 0 ? (quote - left) / hours : 0 };
}

const decimalsOf = (bn: { toString(): string }) => Math.max(0, String(bn.toString()).length - 1);
const trim = (v: number, dp: number) => {
  const s = v.toFixed(Math.min(dp, 18));
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

/** IOC market buy spending `quoteGusd`; approves gUSD to the book first. */
export async function marketBuy(signer: ethers.Signer, market: string, quoteGusd: number, minHours: number) {
  const { IOC } = await sdk();
  const params = await getMarketParams(market);
  const qdp = Math.min(Number(params.quoteAssetDecimals.toString()), decimalsOf(params.pricePrecision));
  return IOC.placeMarket(signer, market, params, {
    approveTokens: true,
    isBuy: true,
    size: trim(quoteGusd, qdp),
    minAmountOut: trim(minHours, Number(params.baseAssetDecimals.toString())),
    isMargin: false,
    fillOrKill: false,
  });
}

/** Snap a price to the market's tick (Kuru reverts with "Tick Size Error" otherwise). */
export function snapToTick(price: number, params: Pick<MarketParams, "pricePrecision" | "tickSize">) {
  const precision = Number(params.pricePrecision.toString());
  const tick = Number(params.tickSize.toString()) || 1;
  return (Math.round((price * precision) / tick) * tick) / precision;
}

/** Deposit HourTokens to the Kuru margin account, then rest a GTC ask. */
export async function limitSell(signer: ethers.Signer, market: string, price: number, hours: number) {
  const { GTC, MarginDeposit } = await sdk();
  const params = await getMarketParams(market);
  const user = await signer.getAddress();
  const sizeStr = trim(hours, decimalsOf(params.sizePrecision));
  const minSize = Number(params.minSize.toString()) / Number(params.sizePrecision.toString());
  if (Number(sizeStr) < minSize) throw new Error(`Minimum order size on this market is ${minSize} h`);
  const snapped = snapToTick(price, params);
  if (snapped <= 0) throw new Error("Price is below one tick");
  // Only top up what the margin account is missing (e.g. after a previous failed placement).
  const baseDec = Number(params.baseAssetDecimals.toString());
  const have = Number(ethers.utils.formatUnits(await marginBalance(user, params.baseAssetAddress), baseDec));
  const shortfall = Number(sizeStr) - have;
  if (shortfall > 0) {
    await MarginDeposit.deposit(signer, KURU_MARGIN_ACCOUNT, user, params.baseAssetAddress, trim(shortfall, baseDec), baseDec, true);
  }
  return GTC.placeLimit(signer, market, params, {
    price: trim(snapped, decimalsOf(params.pricePrecision)),
    size: sizeStr,
    isBuy: false,
    postOnly: true,
  });
}

export async function marginBalance(user: string, token: string) {
  const { MarginBalance } = await sdk();
  return MarginBalance.getBalance(getEthersProvider(), KURU_MARGIN_ACCOUNT, user, token);
}
