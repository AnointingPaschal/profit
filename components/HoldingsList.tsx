"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatUsd } from "@/lib/format";
import { Holding } from "@/app/api/holdings/route";

export default function HoldingsList({
  address,
  onTotal,
}: {
  address: string | null;
  onTotal?: (totalUsd: number) => void;
}) {
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/holdings?owner=${address}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSolBalance(data.solBalance);
      setSolPriceUsd(data.solPriceUsd);
      setHoldings(data.holdings);
      setError(null);
      const solValue = data.solPriceUsd ? data.solBalance * data.solPriceUsd : 0;
      const tokenValue = data.holdings.reduce((s: number, h: Holding) => s + (h.valueUsd ?? 0), 0);
      onTotal?.(solValue + tokenValue);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!address) return;
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [address, load]);

  if (!address) return null;

  const solValueUsd = solPriceUsd && solBalance !== null ? solPriceUsd * solBalance : null;

  return (
    <div className="space-y-2">
      {error && <div className="text-danger text-xs">{error}</div>}
      {loading && holdings.length === 0 && <div className="text-xs text-muted">Loading holdings…</div>}

      {solBalance !== null && (
        <div className="flex items-center gap-3 py-2 border-b border-border">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-surface2 flex items-center justify-center text-[10px] font-bold text-black shrink-0">
            SOL
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Solana</div>
            <div className="text-xs text-muted">{solBalance.toFixed(4)} SOL</div>
          </div>
          <span className="text-sm">{solValueUsd !== null ? formatUsd(solValueUsd) : "—"}</span>
        </div>
      )}

      {holdings.length === 0 && !loading && (
        <div className="text-xs text-muted text-center py-4">No SPL token balances found for this address.</div>
      )}

      {holdings.map((h) => (
        <Link key={h.mint} href={`/token/${h.mint}`} className="flex items-center gap-3 py-2 border-b border-border block">
          <div className="w-9 h-9 rounded-full bg-surface2 overflow-hidden relative shrink-0">
            {h.logoUrl ? (
              <Image src={h.logoUrl} alt={h.symbol} fill sizes="36px" className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold">
                {h.symbol.slice(0, 3)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{h.symbol}</div>
            <div className="text-xs text-muted">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
          </div>
          <span className="text-sm">{h.valueUsd !== null ? formatUsd(h.valueUsd) : "—"}</span>
        </Link>
      ))}
    </div>
  );
}
