"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { DexPair, StrategyConfig } from "@/lib/types";
import { formatUsd, formatPct, formatAge } from "@/lib/format";
import { store } from "@/lib/store";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";

type SortMode = "trending" | "new" | "top";

export default function DiscoverPage() {
  const [sort, setSort] = useState<SortMode>("trending");
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<StrategyConfig | null>(null);

  useEffect(() => {
    setCfg(store.getConfig());
  }, []);

  const load = useCallback(async () => {
    if (!cfg) return;
    try {
      const q = new URLSearchParams({
        sort,
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
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cfg, sort]);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true);
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [cfg, sort, load]);

  const totalVol5m = pairs.reduce((s, p) => s + (p.volume?.m5 ?? 0), 0);
  const totalTxns5m = pairs.reduce((s, p) => s + Object.values(p.txns?.m5 ?? {}).reduce((a, b) => a + (b || 0), 0), 0);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-base/95 backdrop-blur border-b border-border p-3 space-y-3">
        <div className="flex gap-2">
          {([
            { key: "trending", label: "🔥 Trending" },
            { key: "new", label: "🌱 New" },
            { key: "top", label: "📊 Top" },
          ] as { key: SortMode; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setSort(t.key)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
                sort === t.key ? "bg-accent text-black" : "bg-surface2 text-muted"
              )}
            >
              {t.label}
            </button>
          ))}
          <button onClick={load} className="ml-auto text-muted p-1.5">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface2 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] text-muted uppercase tracking-wide">5M Volume</div>
            <div className="text-sm font-semibold">{formatUsd(totalVol5m)}</div>
          </div>
          <div className="bg-surface2 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] text-muted uppercase tracking-wide">5M Txns</div>
            <div className="text-sm font-semibold">{totalTxns5m.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {error && <div className="card m-3 text-danger text-sm">{error}</div>}
      {!error && pairs.length === 0 && (
        <div className="text-muted text-sm text-center py-10 px-4">
          {loading ? "Scanning for candidates…" : "No tokens currently pass your filters. Loosen them in Config."}
        </div>
      )}

      <div>
        {pairs.map((p) => {
          const mint = p.baseToken.address;
          const change24h = p.priceChange?.h24;
          const change5m = p.priceChange?.m5;
          return (
            <Link
              key={p.pairAddress}
              href={`/token/${mint}`}
              className="flex items-center gap-3 px-3 py-3 border-b border-border active:bg-surface2 block"
            >
              <div className="w-10 h-10 rounded-full bg-surface2 overflow-hidden shrink-0 relative">
                {p.info?.imageUrl ? (
                  <Image src={p.info.imageUrl} alt={p.baseToken.symbol} fill sizes="40px" className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold">
                    {p.baseToken.symbol.slice(0, 3)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm truncate">{p.baseToken.symbol}</span>
                  <span className="text-sm font-medium">
                    {Number(p.priceUsd ?? 0) < 0.01
                      ? `$${Number(p.priceUsd ?? 0).toPrecision(3)}`
                      : formatUsd(Number(p.priceUsd ?? 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-0.5">
                  <span className="text-muted truncate">{p.baseToken.name}</span>
                  <span className="flex gap-2">
                    {change5m !== undefined && (
                      <span className={change5m >= 0 ? "text-accent" : "text-danger"}>{formatPct(change5m)}</span>
                    )}
                    {change24h !== undefined && (
                      <span className={clsx("font-medium", change24h >= 0 ? "text-accent" : "text-danger")}>
                        {formatPct(change24h)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="pill bg-surface2 text-muted">LIQ {formatUsd(p.liquidity?.usd)}</span>
                  <span className="pill bg-surface2 text-muted">VOL {formatUsd(p.volume?.h24)}</span>
                  <span className="pill bg-surface2 text-muted">MC {formatUsd(p.marketCap ?? p.fdv)}</span>
                  <span className="pill bg-surface2 text-muted ml-auto">{formatAge(p.pairCreatedAt)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
