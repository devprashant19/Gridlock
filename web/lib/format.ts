export const fmtUsd = (v: number, digits = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtNum = (v: number, digits = 2) =>
  v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const gusd = (raw: bigint | undefined | null) => (raw == null ? 0 : Number(raw) / 1e6);
export const hoursFromWei = (raw: bigint | undefined | null) => (raw == null ? 0 : Number(raw) / 1e18);
export const priceE8ToUsd = (p: bigint | number | undefined | null) => (p == null ? 0 : Number(p) / 1e8);

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function fmtDuration(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const fmtDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Bond in gUSD for `hours` at `priceE8`, as DeliveryEscrow.mint computes it (6dp). */
export const bondRaw = (hours: bigint, priceE8: bigint) => (hours * priceE8 * 120n) / 10000n;
