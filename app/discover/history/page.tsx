"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { store, ScannedTokenEntry } from "@/lib/store";
import { formatUsd, formatPct } from "@/lib/format";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown } from "lucide-react";

export default function ScannedHistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ScannedTokenEntry[]>([]);

  useEffect(() => {
    setEntries(store.getScannedTokens());
  }, []);

  const clearAll = () => {
    if (!confirm(`Delete all ${entries.length} saved tokens?`)) return;
    store.clearScannedTokens();
    setEntries([]);
  };

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 px-3 py-2.5 sticky top-0 z-10"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()} className="text-[var(--muted)]"><ArrowLeft size={18} /></button>
        <span className="text-sm font-semibold flex-1 text-[var(--txt)]">Saved Tokens</span>
        {entries.length > 0 && (
          <button onClick={clearAll} className="text-[var(--muted)]"><Trash2 size={16} /></button>
        )}
      </div>

      <div className="px-3 pt-2 pb-2 text-2xs text-[var(--muted)]">
        {entries.length} tokens saved since first use. Auto-saved on every scan.
      </div>

      {entries.length === 0 && (
        <div className="text-center py-10 text-xs text-[var(--muted)]">
          Nothing saved yet — visit Discover and tokens will appear here automatically.
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {entries.map((e) => {
          const changePct = e.initialMarketCap > 0
            ? ((e.lastMarketCap - e.initialMarketCap) / e.initialMarketCap) * 100
            : 0;
          const isUp = changePct >= 0;

          return (
            <Link key={e.mint} href={`/token/${e.mint}`}
              className="flex items-center gap-3 px-3 py-2.5 block">
              <div className="w-8 h-8 rounded-full bg-[var(--card2)] flex items-center justify-center shrink-0">
                <span className="text-2xs font-bold text-[var(--muted)]">{e.symbol.slice(0, 3)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--txt)]">{e.symbol}</div>
                <div className="text-2xs text-[var(--muted)]">
                  Seen {e.timesSeen}x · {new Date(e.firstSeenAt).toLocaleDateString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-[var(--txt)]">{formatUsd(e.lastMarketCap)}</div>
                <div className={`text-2xs font-medium flex items-center justify-end gap-0.5 mt-0.5 ${isUp ? "text-accent" : "text-danger"}`}>
                  {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {formatPct(changePct)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
