"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { DexPair } from "@/lib/types";
import { formatUsd, formatTokenPrice, formatPct, formatAge } from "@/lib/format";
import { store, PriceSnapshot } from "@/lib/store";
import {
  RefreshCw, Flame, Sprout, BarChart2, CircleDollarSign,
  Info, History, X, ShieldAlert, ShieldCheck, Clock, Search,
} from "lucide-react";
import clsx from "clsx";

type Tab   = "trending" | "new" | "top" | "lowmc";
type McF   = "all" | "micro" | "small" | "mid";

const TABS: { key: Tab; Icon: React.ElementType; label: string }[] = [
  { key: "trending", Icon: Flame,            label: "Trending" },
  { key: "new",      Icon: Sprout,           label: "New"      },
  { key: "top",      Icon: BarChart2,        label: "Top"      },
  { key: "lowmc",    Icon: CircleDollarSign, label: "Low MC"   },
];

const MC_FILTERS: { key: McF; label: string; max: number }[] = [
  { key: "all",   label: "Any MC",   max: Infinity  },
  { key: "micro", label: "< $100K",  max: 100_000   },
  { key: "small", label: "< $500K",  max: 500_000   },
  { key: "mid",   label: "< $5M",    max: 5_000_000 },
];

const PAGE_SIZE = 40;

/* ────── Skeleton card ────── */
function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden p-2.5 space-y-2 animate-pulse"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--card2)] shrink-0" />
        <div className="flex-1 h-3 rounded bg-[var(--card2)]" />
        <div className="w-20 h-3 rounded bg-[var(--card2)]" />
      </div>
      <div className="h-2.5 w-3/4 rounded bg-[var(--card2)]" />
      <div className="h-2.5 w-1/2 rounded bg-[var(--card2)]" />
    </div>
  );
}

export default function DiscoverPage() {
  const [tab,      setTab]      = useState<Tab>("trending");
  const [mcFilter, setMcFilter] = useState<McF>("all");
  const [query,    setQuery]    = useState("");
  const [allPairs, setAllPairs] = useState<DexPair[]>([]);
  const [page,     setPage]     = useState(1);
  const [snaps,    setSnaps]    = useState<Record<string, PriceSnapshot>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [guide,    setGuide]    = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load cached tokens + snapshots immediately so page is never blank on reload
  useEffect(() => {
    setSnaps(store.getSnapshots());
    const saved = store.getScannedTokens();
    if (saved.length > 0) {
      setAllPairs(saved.map(e => ({
        chainId: "solana", dexId: "", pairAddress: e.pairAddress,
        baseToken: { address: e.mint, name: e.name, symbol: e.symbol },
        quoteToken: { address: "", name: "SOL", symbol: "SOL" },
        priceUsd: String(e.lastPriceUsd), marketCap: e.lastMarketCap,
        info: { imageUrl: e.logoUrl },
      })));
      setLoading(false);
    }
  }, []);

  const load = useCallback(async (resetPage = true) => {
    if (resetPage) { setLoading(true); setPage(1); }
    try {
      const res  = await fetch(`/api/discover?sort=${tab}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: DexPair[] = data.pairs;
      setAllPairs(fresh);
      store.recordScannedTokens(fresh);
      store.mergeSnapshots(fresh);
      setSnaps(store.getSnapshots());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => {
    load(true);
    const iv = setInterval(() => load(false), 30_000);
    return () => clearInterval(iv);
  }, [tab, load]);

  // ── Filter chain ──
  const mcMax   = MC_FILTERS.find(f => f.key === mcFilter)?.max ?? Infinity;
  const q       = query.trim().toLowerCase();

  const filtered = allPairs.filter(p => {
    const mc = p.marketCap ?? p.fdv ?? Infinity;
    if (mc > mcMax) return false;
    if (q) {
      const sym  = p.baseToken.symbol.toLowerCase();
      const name = p.baseToken.name.toLowerCase();
      if (!sym.includes(q) && !name.includes(q)) return false;
    }
    if (tab === "lowmc" && mc > 200_000) return false;
    return true;
  });

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // ── Infinite scroll via IntersectionObserver ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore) setPage(p => p + 1); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]);

  return (
    <div style={{ minHeight: "calc(100vh - 120px)" }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 px-3 pt-2 pb-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>

        {/* Tab row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {TABS.map(({ key, Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={clsx(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-2xs font-semibold whitespace-nowrap shrink-0",
                tab === key ? "bg-accent text-white" : "bg-[var(--card2)] text-[var(--muted)]"
              )}>
              <Icon size={11} /> {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <Btn onClick={() => setGuide(g => !g)}><Info size={15} /></Btn>
            <Link href="/discover/history" className="text-[var(--muted)] p-1.5">
              <History size={15} />
            </Link>
            <Btn onClick={() => load(true)}>
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </Btn>
          </div>
        </div>

        {/* Search + MC filter */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 flex-1 rounded-xl px-2.5 py-1.5"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <Search size={13} className="text-[var(--muted)] shrink-0" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search name or symbol…"
              className="flex-1 bg-transparent text-xs outline-none text-[var(--txt)]"
              style={{ minWidth: 0 }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[var(--muted)] shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* MC filter pills */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
          {MC_FILTERS.map(f => (
            <button key={f.key} onClick={() => { setMcFilter(f.key); setPage(1); }}
              className={clsx(
                "text-2xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0",
                mcFilter === f.key ? "bg-accent text-white" : "bg-[var(--card2)] text-[var(--muted)]"
              )}>
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-2xs text-[var(--muted)] shrink-0 whitespace-nowrap">
            {loading && allPairs.length === 0 ? "Loading…" : `${visible.length} / ${filtered.length}`}
          </span>
        </div>
      </div>

      {/* ── Strategy guide ── */}
      {guide && (
        <div className="mx-3 mt-3 surface text-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--txt)]">Sniping Strategy</span>
            <button onClick={() => setGuide(false)} className="text-[var(--muted)]"><X size={14} /></button>
          </div>
          <p className="text-[var(--sub)] leading-relaxed">
            <strong className="text-[var(--txt)]">Low MC</strong> tokens (&lt;$200k) are highest risk / highest reward.
            Size at 0.05–0.1 SOL max so one rug doesn't damage the account.
          </p>
          {[
            { I: ShieldCheck, c: "text-accent", t: "Mint authority renounced", d: "Dev can't inflate supply" },
            { I: ShieldCheck, c: "text-accent", t: "LP locked / burned",       d: "Liquidity can't be pulled" },
            { I: Clock,       c: "text-warn",   t: "Age 2–60 minutes",         d: "Not dead, not too early" },
            { I: ShieldCheck, c: "text-accent", t: "Top-10 holders < 25%",     d: "No single dump wallet" },
            { I: ShieldAlert, c: "text-danger", t: "Already pumped >200%",     d: "You're buying the top" },
          ].map(r => (
            <div key={r.t} className="flex items-start gap-1.5">
              <r.I size={12} className={`${r.c} shrink-0 mt-0.5`} />
              <span className="text-[var(--sub)]">
                <strong className="text-[var(--txt)]">{r.t}</strong> — {r.d}
              </span>
            </div>
          ))}
          <p className="text-[var(--muted)]">
            Stop-loss -25% · TP at +100%, +300%, +900% · Trailing stop after +80%.
          </p>
        </div>
      )}

      {error && <div className="mx-3 mt-3 surface text-danger text-xs">{error}</div>}

      {/* ── Token cards ── */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">

        {/* Initial skeleton while loading */}
        {loading && allPairs.length === 0 &&
          Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
        }

        {visible.map((p, idx) => {
          const mint    = p.baseToken.address;
          const snap    = snaps[mint];
          const curMc   = p.marketCap ?? p.fdv ?? 0;
          const curP    = Number(p.priceUsd ?? 0);
          const c24     = p.priceChange?.h24;
          const c5m     = p.priceChange?.m5;
          const mcDelta = snap && snap.marketCap > 0
            ? ((curMc - snap.marketCap) / snap.marketCap) * 100
            : null;
          const isHot   = tab === "trending" && idx < 3;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`}
              className="block rounded-xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

              <div className="p-2.5 space-y-1.5">

                {/* Row 1: Logo · Symbol · rank · [5M%] [24H%] · Price */}
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--card2)] overflow-hidden relative">
                      {p.info?.imageUrl
                        ? <Image src={p.info.imageUrl} alt="" fill sizes="32px"
                            className="object-cover" unoptimized />
                        : <div className="w-full h-full flex items-center justify-center
                                          text-2xs font-bold text-[var(--muted)]">
                            {p.baseToken.symbol.slice(0, 2)}
                          </div>
                      }
                    </div>
                    {isHot && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent">
                        <span className="animate-ping absolute inset-0 rounded-full bg-accent opacity-60" />
                      </span>
                    )}
                  </div>

                  {/* Symbol + rank */}
                  <span className="text-xs font-bold text-[var(--txt)] flex-1 truncate">
                    {p.baseToken.symbol}
                  </span>
                  {isHot && (
                    <span className="text-2xs font-semibold text-accent bg-accent/10
                                     px-1 py-0.5 rounded-full shrink-0">
                      #{idx + 1}
                    </span>
                  )}

                  {/* Changes + price */}
                  {c5m !== undefined && (
                    <span className={`text-2xs font-semibold shrink-0 ${c5m >= 0 ? "text-accent" : "text-danger"}`}>
                      {formatPct(c5m)}
                    </span>
                  )}
                  {c24 !== undefined && (
                    <span className={`text-2xs font-semibold shrink-0 ${c24 >= 0 ? "text-accent" : "text-danger"}`}>
                      {formatPct(c24)}
                    </span>
                  )}
                  <span className="text-xs font-bold text-[var(--txt)] shrink-0 ml-1">
                    {formatTokenPrice(curP)}
                  </span>
                </div>

                {/* Row 2: LIQ · MC · Age · Vol — all inline */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <S label="LIQ" value={formatUsd(p.liquidity?.usd)} />
                  <Sep />
                  <S label="MC"  value={formatUsd(curMc)} />
                  <Sep />
                  <span className="text-2xs text-[var(--muted)]">{formatAge(p.pairCreatedAt)}</span>
                  <Sep />
                  <S label="Vol" value={formatUsd(p.volume?.h24)} />
                </div>

                {/* Row 3: Fetch snapshot (initial) ↔ current delta — one line */}
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-[var(--muted)]">Fetch:</span>
                  {snap ? (
                    <>
                      <span className="text-2xs text-[var(--sub)]">{formatUsd(snap.marketCap)} MC</span>
                      <Sep />
                      <span className="text-2xs text-[var(--sub)]">{formatTokenPrice(snap.priceUsd)}</span>
                      {mcDelta !== null && Math.abs(mcDelta) > 0.05 && (
                        <span className={`text-2xs font-semibold ml-0.5 ${mcDelta >= 0 ? "text-accent" : "text-danger"}`}>
                          {formatPct(mcDelta)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-2xs text-[var(--muted)]">—</span>
                  )}
                </div>

              </div>
            </Link>
          );
        })}

        {/* Skeleton appended while scrolling to next page */}
        {hasMore && !loading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
          </>
        )}

        {/* Invisible sentinel — IntersectionObserver watches this */}
        <div ref={sentinelRef} className="h-1" />

        {/* Bottom state messages */}
        {!hasMore && filtered.length > 0 && !loading && (
          <div className="text-center text-2xs text-[var(--muted)] py-3">
            All {filtered.length} tokens loaded
          </div>
        )}
        {!loading && filtered.length === 0 && allPairs.length > 0 && (
          <div className="text-center text-xs text-[var(--muted)] py-8">
            No tokens match your search / filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ──
function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-[var(--muted)] p-1.5 rounded-full hover:bg-[var(--card2)]">
      {children}
    </button>
  );
}
function S({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-2xs text-[var(--sub)]">
      <span className="text-[var(--muted)]">{label} </span>{value}
    </span>
  );
}
function Sep() {
  return <span className="text-2xs" style={{ color: "var(--border)" }}>·</span>;
}
