/** General USD amounts (liquidity, volume, market cap, portfolio value) */
export function formatUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1)             return `$${n.toFixed(2)}`;
  return formatTokenPrice(n);
}

/**
 * Token price formatter — never uses scientific notation.
 * Handles meme-coin prices like 0.00000002798 cleanly.
 *
 * Strategy:
 *   ≥ $1          → $1.23
 *   ≥ $0.01       → $0.2356
 *   ≥ $0.0001     → $0.000245
 *   < $0.0001     → count leading zeros and show 4 significant digits
 *                   e.g. 0.00000002798 → $0.00₇28  (subscript count style)
 *                   Displayed as: $0.0000000280 (plain, no subscript for now)
 */
export function formatTokenPrice(p: number): string {
  if (!p || p === 0 || Number.isNaN(p)) return "$0";
  if (p >= 1_000_000)  return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000)      return `$${(p / 1_000).toFixed(2)}K`;
  if (p >= 1)          return `$${p.toFixed(2)}`;
  if (p >= 0.01)       return `$${p.toFixed(4)}`;
  if (p >= 0.001)      return `$${p.toFixed(5)}`;
  if (p >= 0.0001)     return `$${p.toFixed(6)}`;

  // Very small numbers — convert without scientific notation
  // toFixed clamps at 20 decimals which is enough for any real token price
  const decimals = Math.min(20, Math.ceil(-Math.log10(p)) + 4);
  const fixed = p.toFixed(decimals);
  // Trim trailing zeros but keep at least 4 sig figs after the zeros
  return `$${fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0')}`;
}

export function formatPct(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatAge(createdAtMs?: number): string {
  if (!createdAtMs) return "—";
  const mins = Math.floor((Date.now() - createdAtMs) / 60000);
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function shortAddr(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
