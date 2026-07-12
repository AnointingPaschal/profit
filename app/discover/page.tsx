"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DexPair, StrategyConfig } from "@/lib/types";
import { formatUsd, formatPct, formatAge } from "@/lib/format";
import { store } from "@/lib/store";
import { RefreshCw, TrendingUp } from "lucide-react";

export default function DiscoverPage() {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialMc, setInitialMc] = useState<Record<string, number>>({});
  const [cfg, setCfg] = useState<StrategyConfig | null>(null);

  useEffect(() => {
    setCfg(store.getConfig());
  }, []);

  const load = useCallback(async () => {
    if (!cfg) return;
    try {
      const q = new URLSearchParams({
        minLiquidityUsd: String(cfg.discovery.minLiquidityUsd),
        maxMarketCapUsd: String(cfg.discovery.maxMarketCapUsd),
        minTokenAgeMinutes: String(cfg.discovery.minTokenAgeMinutes),
        maxTokenAgeMinutes: String(cfg.discovery.maxTokenAgeMinutes),
        min5mVolumeUsd: String(cfg.discovery.min5mVolumeUsd),
      });
      const res = await fetch(`/api/discover?${q.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const blacklist = store.getBlacklist();
      const filtered: DexPair[] = data.pairs.filter((p: DexPair) => !blacklist.includes(p.baseToken.address));
      setPairs(filtered);
      setInitialMc((prev) => {
        const next = { ...prev };
        for (const p of filtered) {
          if (!(p.baseToken.address in next)) next[p.baseToken.address] = p.marketCap ?? p.fdv ?? 0;
        }
        return next;
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return;
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [cfg, load]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp size={20} className="text-accent" /> Discover
        </h1>
        <button onClick={load} className="text-muted p-2">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <div className="card mb-3 text-danger text-sm">{error}</div>}
      {!error && pairs.length === 0 && (
        <div className="card text-muted text-sm text-center py-8">
          {loading ? "Scanning for candidates…" : "No tokens currently pass your filters. Loosen them in Config."}
        </div>
      )}

      <div className="space-y-3">
        {pairs.map((p) => {
          const mint = p.baseToken.address;
          const mcap = p.marketCap ?? p.fdv ?? 0;
          const initial = initialMc[mint] ?? mcap;
          const mcapChangePct = initial > 0 ? ((mcap - initial) / initial) * 100 : 0;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`} className="card flex items-center gap-3 block">
              <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-sm font-semibold shrink-0">
                {p.baseToken.symbol.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{p.baseToken.symbol}</span>
                  <span className="text-sm">{formatUsd(mcap)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted mt-0.5">
                  <span>Age {formatAge(p.pairCreatedAt)} · Liq {formatUsd(p.liquidity?.usd)}</span>
                  <span className={mcapChangePct >= 0 ? "text-accent" : "text-danger"}>
                    {formatPct(mcapChangePct)} since fetch
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
