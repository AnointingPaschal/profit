"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { DexPair, StrategyConfig } from "@/lib/types";
import { formatUsd, formatPct, formatAge } from "@/lib/format";
import { store } from "@/lib/store";
import { RefreshCw, Flame, Sprout, BarChart2, CircleDollarSign, Info, History, X, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import clsx from "clsx";

type Tab = "trending" | "new" | "top" | "lowmc";
const TABS: { key: Tab; icon: React.ElementType; label: string }[] = [
  { key: "trending", icon: Flame,             label: "Trending" },
  { key: "new",      icon: Sprout,            label: "New" },
  { key: "top",      icon: BarChart2,         label: "Top" },
  { key: "lowmc",    icon: CircleDollarSign,  label: "Low MC" },
];

interface Snapshot { priceUsd: number; marketCap: number; liquidity: number }

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>("trending");
  const [allPairs, setAllPairs] = useState<DexPair[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const seenMints = useRef<Set<string>>(new Set());

  // Load persisted tokens on mount first so UI isn't empty on reload
  useEffect(() => {
    const saved = store.getScannedTokens();
    if (saved.length > 0) {
      const asPairs: DexPair[] = saved.map(e => ({
        chainId: "solana",
        dexId: "",
        pairAddress: e.pairAddress,
        baseToken: { address: e.mint, name: e.name, symbol: e.symbol },
        quoteToken: { address: "", name: "SOL", symbol: "SOL" },
        priceUsd: String(e.lastPriceUsd),
        marketCap: e.lastMarketCap,
        info: { imageUrl: e.logoUrl },
      }));
      setAllPairs(asPairs);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/discover?sort=${tab}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const pairs: DexPair[] = data.pairs;
      setAllPairs(pairs);
      store.recordScannedTokens(pairs);
      setSnapshots(prev => {
        const next = { ...prev };
        for (const p of pairs) {
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
      // Mark new-this-session tokens
      pairs.forEach(p => seenMints.current.add(p.baseToken.address));
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [tab, load]);

  // Client-side: for Low MC tab, filter <$200k from the trending sort
  const visiblePairs = tab === "lowmc"
    ? allPairs.filter(p => (p.marketCap ?? p.fdv ?? Infinity) < 200_000)
    : allPairs;

  const isTrending = tab === "trending";

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-3 pt-2 pb-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>

        {/* Tab row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-2xs font-semibold whitespace-nowrap shrink-0 transition-colors",
                tab === t.key ? "bg-accent text-white" : "bg-[var(--card2)] text-[var(--muted)]"
              )}>
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button onClick={() => setShowStrategy(s => !s)}
              className="text-[var(--muted)] p-1.5 rounded-full hover:bg-[var(--card2)]">
              <Info size={15} />
            </button>
            <Link href="/discover/history" className="text-[var(--muted)] p-1.5 rounded-full hover:bg-[var(--card2)]">
              <History size={15} />
            </Link>
            <button onClick={load} className="text-[var(--muted)] p-1.5 rounded-full hover:bg-[var(--card2)]">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-2 mt-2 text-2xs text-[var(--muted)]">
          <span className="bg-[var(--card2)] rounded-lg px-2 py-1">
            {visiblePairs.length} pairs
          </span>
          <span className="bg-[var(--card2)] rounded-lg px-2 py-1">
            Vol {formatUsd(visiblePairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0))}
          </span>
        </div>
      </div>

      {/* Risk strategy panel */}
      {showStrategy && (
        <div className="mx-3 mt-3 rounded-xl2 p-3 text-2xs space-y-2.5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--txt)]">Sniping Strategy Guide</span>
            <button onClick={() => setShowStrategy(false)} className="text-[var(--muted)]"><X size={14} /></button>
          </div>
          <p className="text-[var(--sub)] leading-relaxed">
            The <strong className="text-[var(--txt)]">Low MC tab</strong> shows tokens under $200k market cap — the highest-risk,
            highest-reward zone. Most of these go to zero. A small number 10-100x. The strategy is
            position sizing: never risk more than 0.05–0.1 SOL per snipe so one rug doesn't hurt the account.
          </p>
          <div className="space-y-1.5">
            {[
              { icon: ShieldCheck, label: "Mint authority renounced", desc: "Dev can't print more tokens", color: "text-accent" },
              { icon: ShieldCheck, label: "LP locked or burned",      desc: "Liquidity can't be pulled", color: "text-accent" },
              { icon: Clock,       label: "Age 2–60 minutes",         desc: "Not dead, not too early", color: "text-warn" },
              { icon: ShieldAlert, label: "Top 10 holders < 25%",     desc: "No single wallet can dump", color: "text-accent" },
              { icon: ShieldAlert, label: "Avoid >200% pumped tokens", desc: "You're buying the top", color: "text-danger" },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <r.icon size={12} className={r.color} />
                <div>
                  <span className="text-[var(--txt)] font-medium">{r.label}</span>
                  <span className="text-[var(--muted)]"> — {r.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[var(--muted)] leading-relaxed">
            Use a <strong className="text-[var(--txt)]">stop-loss at -25%</strong> and take partial profits at +100%,
            +300%, +900%. Let winners run with the trailing stop. Time-stop anything flat after 3 hours.
            The exit strategy matters more than the entry.
          </p>
        </div>
      )}

      {error && <div className="mx-3 mt-3 surface text-danger text-xs">{error}</div>}

      {!error && visiblePairs.length === 0 && !loading && tab === "lowmc" && (
        <div className="text-center py-10 text-xs text-[var(--muted)]">
          No tokens under $200k found in the current batch. Try refreshing.
        </div>
      )}

      {/* Token list */}
      <div className="px-3 pt-3 space-y-2 pb-4">
        {visiblePairs.map((p, idx) => {
          const mint = p.baseToken.address;
          const snap = snapshots[mint];
          const curMc = p.marketCap ?? p.fdv ?? 0;
          const curPrice = Number(p.priceUsd ?? 0);
          const c24 = p.priceChange?.h24;
          const c5m = p.priceChange?.m5;
          const mcDelta = snap && snap.marketCap > 0 ? ((curMc - snap.marketCap) / snap.marketCap) * 100 : null;
          const isHot = isTrending && idx < 3;
          const isBullish = c24 !== undefined && c24 > 20;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`}
              className="block rounded-xl2 overflow-hidden relative"
              style={{ border: "1px solid var(--border)" }}>

              {/* Token background — banner or gradient */}
              {p.info?.header ? (
                <div className="absolute inset-0 opacity-10">
                  <Image src={p.info.header} alt="" fill sizes="460px" className="object-cover" unoptimized />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, var(--card) 30%, transparent)" }} />
                </div>
              ) : (
                <div className="absolute inset-0" style={{
                  background: isHot
                    ? "linear-gradient(135deg, rgba(16,185,129,0.04) 0%, var(--card) 100%)"
                    : "var(--card)"
                }} />
              )}

              <div className="relative z-10 flex items-center gap-3 p-3">
                {/* Logo + live dot */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--card2)] overflow-hidden relative">
                    {p.info?.imageUrl
                      ? <Image src={p.info.imageUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
                      : <div className="w-full h-full flex items-center justify-center text-2xs font-bold text-[var(--muted)]">
                          {p.baseToken.symbol.slice(0, 3)}
                        </div>
                    }
                  </div>
                  {/* Blinking live indicator for trending tokens */}
                  {isHot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent flex items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    </span>
                  )}
                </div>

                {/* Middle */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--txt)]">{p.baseToken.symbol}</span>
                    {isHot && (
                      <span className="text-2xs font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                        #{idx + 1}
                      </span>
                    )}
                    {tab === "lowmc" && curMc > 0 && curMc < 50000 && (
                      <span className="text-2xs font-semibold text-warn bg-warn/10 px-1.5 py-0.5 rounded-full">
                        Micro
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xs text-[var(--muted)]">
                      LIQ {formatUsd(p.liquidity?.usd)}
                    </span>
                    <span className="text-2xs text-[var(--muted)]">
                      MC {formatUsd(curMc)}
                    </span>
                    <span className="text-2xs text-[var(--muted)]">
                      {formatAge(p.pairCreatedAt)}
                    </span>
                  </div>

                  {/* Initial vs current since fetch */}
                  {snap && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-[var(--muted)]">
                        At fetch: {formatUsd(snap.marketCap)} MC
                      </span>
                      {mcDelta !== null && Math.abs(mcDelta) > 0.1 && (
                        <span className={`text-2xs font-semibold ${mcDelta >= 0 ? "text-accent" : "text-danger"}`}>
                          {formatPct(mcDelta)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-[var(--txt)]">
                    {curPrice < 0.001
                      ? `$${curPrice.toPrecision(3)}`
                      : curPrice < 1
                        ? `$${curPrice.toFixed(5)}`
                        : formatUsd(curPrice)}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 mt-0.5">
                    {c5m !== undefined && (
                      <span className={`text-2xs font-medium ${c5m >= 0 ? "text-accent" : "text-danger"}`}>
                        5M {formatPct(c5m)}
                      </span>
                    )}
                    {c24 !== undefined && (
                      <span className={`text-2xs font-medium ${c24 >= 0 ? "text-accent" : "text-danger"}`}>
                        24H {formatPct(c24)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom bar: vol + buy/sell ratio */}
              {p.txns?.h24 && (
                <div className="relative z-10 px-3 pb-2.5 flex items-center gap-2">
                  <span className="text-2xs text-[var(--muted)]">
                    Vol {formatUsd(p.volume?.h24)}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-danger/20">
                    {(() => {
                      const b = p.txns.h24?.buys ?? 0;
                      const s = p.txns.h24?.sells ?? 0;
                      const t = b + s;
                      const pct = t > 0 ? (b / t) * 100 : 50;
                      return <div className="h-full bg-accent" style={{ width: `${pct}%` }} />;
                    })()}
                  </div>
                  <span className="text-2xs text-[var(--muted)]">
                    {p.txns.h24.buys}B / {p.txns.h24.sells}S
                  </span>
                </div>
              )}
            </Link>
          );
        })}

        {loading && visiblePairs.length === 0 && (
          <div className="text-center py-10 text-xs text-[var(--muted)]">Fetching from DexScreener…</div>
        )}
      </div>
    </div>
  );
}
