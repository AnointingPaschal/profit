"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatUsd } from "@/lib/format";
import { Holding } from "@/app/api/holdings/route";

export default function HoldingsList({ address }: { address: string | null }) {
  const [solBalance, setSolBalance] = useState<number | null>(null);
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
      setHoldings(data.holdings);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [address, load]);

  if (!address) return null;

  const totalTokenValue = holdings.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted">
        <span>Holdings</span>
        <span>{loading ? "Refreshing…" : `Total ${formatUsd(totalTokenValue)} in tokens`}</span>
      </div>

      {error && <div className="text-danger text-xs">{error}</div>}

      {solBalance !== null && (
        <div className="card flex items-center justify-between">
          <span className="font-medium">SOL</span>
          <span>{solBalance.toFixed(4)}</span>
        </div>
      )}

      {holdings.length === 0 && !loading && (
        <div className="text-xs text-muted text-center py-4">No SPL token balances found for this address.</div>
      )}

      {holdings.map((h) => (
        <Link
          key={h.mint}
          href={`/token/${h.mint}`}
          className="card flex items-center justify-between block"
        >
          <div>
            <div className="font-medium text-sm">{h.symbol}</div>
            <div className="text-xs text-muted">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
          </div>
          <span className="text-sm">{h.valueUsd !== null ? formatUsd(h.valueUsd) : "—"}</span>
        </Link>
      ))}
    </div>
  );
}
