"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { DexPair, StrategyConfig } from "@/lib/types";
import { formatUsd, formatPct, formatAge } from "@/lib/format";
import { store } from "@/lib/store";
import { RefreshCw, History } from "lucide-react";
import clsx from "clsx";

type SortMode = "trending" | "new" | "top";

interface Snapshot { priceUsd: number; marketCap: number; liquidity: number }
type SnapMap = Record<string, Snapshot>;

export default function DiscoverPage() {
  const [sort, setSort] = useState<SortMode>("trending");
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [snapshots, setSnapshots] = useState<SnapMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<StrategyConfig | null>(null);

  useEffect(() => { setCfg(store.getConfig()); }, []);

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
      const res = await fetch(`/api/discover?${q}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const bl = store.getBlacklist();
      const filtered: DexPair[] = data.pairs.filter((p: DexPair) => !bl.includes(p.baseToken.address));
      setPairs(filtered);
      store.recordScannedTokens(data.pairs);
      setSnapshots(prev => {
        const next = { ...prev };
        for (const p of filtered) {
          if (!next[p.baseToken.address]) {
            next[p.baseToken.address] = {
              priceUsd: Number(p.priceUsd ?? 0),
              marketCap: p.marketCap ?? p.fdv ?? 0,
              liquidity: p.liquidity?.usd ?? 0,
            };
          }
        }
        return next;
      });
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [cfg, sort]);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true);
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [cfg, sort, load]);

  const totalVol = pairs.reduce((s, p) => s + (p.volume?.m5 ?? 0), 0);

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-3 pt-2 pb-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>

        <div className="flex items-center gap-2 mb-2">
          {([
            { k: "trending" as SortMode, l: "🔥 Trending" },
            { k: "new" as SortMode, l: "🌱 New" },
            { k: "top" as SortMode, l: "📊 Top" },
          ]).map(t => (
            <button key={t.k} onClick={() => setSort(t.k)}
              className={clsx("px-3 py-1 rounded-full text-2xs font-semibold",
                sort === t.k
                  ? "bg-accent text-white"
                  : "bg-[var(--card2)] text-[var(--muted)]")}>
              {t.l}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/discover/history" className="text-[var(--muted)] p-1">
              <History size={15} />
            </Link>
            <button onClick={load} className="text-[var(--muted)] p-1">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "5M VOLUME", v: formatUsd(totalVol) },
            { l: "PAIRS",     v: pairs.length.toLocaleString() },
          ].map(s => (
            <div key={s.l} className="surface !py-2 text-center">
              <div className="text-2xs text-[var(--muted)] uppercase tracking-wide">{s.l}</div>
              <div className="text-xs font-semibold text-[var(--txt)] mt-0.5">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="m-3 surface text-danger text-xs">{error}</div>}
      {!error && pairs.length === 0 && (
        <div className="text-center py-12 text-xs text-[var(--muted)]">
          {loading ? "Scanning…" : "No tokens pass current filters. Loosen them in Config."}
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {pairs.map(p => {
          const mint = p.baseToken.address;
          const snap = snapshots[mint];
          const curMc = p.marketCap ?? p.fdv ?? 0;
          const curPrice = Number(p.priceUsd ?? 0);
          const mcDelta = snap && snap.marketCap > 0 ? ((curMc - snap.marketCap) / snap.marketCap) * 100 : null;
          const c24 = p.priceChange?.h24;
          const c5m = p.priceChange?.m5;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`}
              className="flex items-center gap-2.5 px-3 py-2.5 block active:bg-[var(--card2)]">

              {/* Logo */}
              <div className="w-9 h-9 rounded-full bg-[var(--card2)] overflow-hidden shrink-0 relative">
                {p.info?.imageUrl
                  ? <Image src={p.info.imageUrl} alt="" fill sizes="36px" className="object-cover" unoptimized />
                  : <div className="w-full h-full flex items-center justify-center text-2xs font-bold text-[var(--muted)]">
                      {p.baseToken.symbol.slice(0, 3)}
                    </div>
                }
              </div>

              {/* Middle */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[var(--txt)]">{p.baseToken.symbol}</span>
                  {c5m !== undefined && (
                    <span className={`text-2xs font-medium ${c5m >= 0 ? "text-accent" : "text-danger"}`}>
                      5M {formatPct(c5m)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xs text-[var(--muted)]">LIQ {formatUsd(p.liquidity?.usd)}</span>
                  <span className="text-2xs text-[var(--muted)]">MC {formatUsd(curMc)}</span>
                  <span className="text-2xs text-[var(--muted)]">{formatAge(p.pairCreatedAt)}</span>
                </div>
                {/* Initial vs current at fetch */}
                {snap && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xs text-[var(--muted)]">
                      Init MC {formatUsd(snap.marketCap)}
                    </span>
                    {mcDelta !== null && (
                      <span className={`text-2xs font-medium ${mcDelta >= 0 ? "text-accent" : "text-danger"}`}>
                        {formatPct(mcDelta)} since fetch
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-[var(--txt)]">
                  {curPrice < 0.01 ? `$${curPrice.toPrecision(3)}` : formatUsd(curPrice)}
                </div>
                {c24 !== undefined && (
                  <div className={`text-2xs font-medium mt-0.5 ${c24 >= 0 ? "text-accent" : "text-danger"}`}>
                    24H {formatPct(c24)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
