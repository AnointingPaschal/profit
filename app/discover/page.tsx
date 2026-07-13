"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { DexPair } from "@/lib/types";
import { formatUsd, formatTokenPrice, formatPct, formatAge } from "@/lib/format";
import { store, PriceSnapshot } from "@/lib/store";
import {
  RefreshCw, Flame, Sprout, BarChart2,
  CircleDollarSign, Info, History, X,
  ShieldAlert, ShieldCheck, Clock,
} from "lucide-react";
import clsx from "clsx";

type Tab = "trending" | "new" | "top" | "lowmc";
const TABS: { key: Tab; Icon: React.ElementType; label: string }[] = [
  { key: "trending", Icon: Flame,            label: "Trending" },
  { key: "new",      Icon: Sprout,           label: "New"      },
  { key: "top",      Icon: BarChart2,        label: "Top"      },
  { key: "lowmc",    Icon: CircleDollarSign, label: "Low MC"   },
];

const PAGE_SIZE = 40;

export default function DiscoverPage() {
  const [tab,     setTab]     = useState<Tab>("trending");
  const [allPairs, setAllPairs] = useState<DexPair[]>([]);
  const [page,    setPage]    = useState(1);
  const [snaps,   setSnaps]   = useState<Record<string, PriceSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [guide,   setGuide]   = useState(false);
  const [total,   setTotal]   = useState(0);

  // Load cached data and snapshots on mount so UI is never blank
  useEffect(() => {
    setSnaps(store.getSnapshots());
    const saved = store.getScannedTokens();
    if (saved.length > 0) {
      const asPairs: DexPair[] = saved.map(e => ({
        chainId: "solana", dexId: "", pairAddress: e.pairAddress,
        baseToken: { address: e.mint, name: e.name, symbol: e.symbol },
        quoteToken: { address: "", name: "SOL", symbol: "SOL" },
        priceUsd: String(e.lastPriceUsd), marketCap: e.lastMarketCap,
        info: { imageUrl: e.logoUrl },
      }));
      setAllPairs(asPairs);
      setTotal(asPairs.length);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async (resetPage = true) => {
    if (resetPage) setLoading(true);
    try {
      const res  = await fetch(`/api/discover?sort=${tab}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: DexPair[] = data.pairs;
      setAllPairs(fresh);
      setTotal(data.total ?? fresh.length);
      if (resetPage) setPage(1);
      store.recordScannedTokens(fresh);
      store.mergeSnapshots(fresh);
      setSnaps(store.getSnapshots());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [tab]);

  useEffect(() => {
    setPage(1);
    load(true);
    const iv = setInterval(() => load(false), 30_000); // refresh without resetting page
    return () => clearInterval(iv);
  }, [tab, load]);

  // For Low MC tab, filter client-side from already-fetched data
  const filtered = tab === "lowmc"
    ? allPairs.filter(p => (p.marketCap ?? p.fdv ?? Infinity) < 200_000)
    : allPairs;

  const visible    = filtered.slice(0, page * PAGE_SIZE);
  const hasMore    = visible.length < filtered.length;
  const totalShown = visible.length;

  const loadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setPage(p => p + 1);
      setLoadingMore(false);
    }, 100);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 120px)" }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 px-3 pt-2 pb-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>

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
            <Link href="/discover/history" className="text-[var(--muted)] p-1.5"><History size={15} /></Link>
            <Btn onClick={() => load(true)}>
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </Btn>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mt-2">
          <Chip>
            {loading ? "Loading…" : `${totalShown} / ${filtered.length} pairs`}
          </Chip>
          <Chip>
            Vol {formatUsd(filtered.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0))}
          </Chip>
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
            <strong className="text-[var(--txt)]">Low MC tab</strong> — tokens under $200k.
            Highest risk, highest reward. Size at 0.05–0.1 SOL so one bad trade doesn't hurt the account.
          </p>
          {[
            { I: ShieldCheck, c: "text-accent", t: "Mint authority renounced", d: "Dev can't inflate supply" },
            { I: ShieldCheck, c: "text-accent", t: "LP locked / burned",       d: "Liquidity can't be pulled" },
            { I: Clock,       c: "text-warn",   t: "Age 2–60 minutes",         d: "Not dead, not too early" },
            { I: ShieldCheck, c: "text-accent", t: "Top-10 holders < 25%",     d: "No single dump wallet" },
            { I: ShieldAlert, c: "text-danger", t: ">200% already pumped",     d: "You're buying the top" },
          ].map(r => (
            <div key={r.t} className="flex items-start gap-1.5">
              <r.I size={12} className={`${r.c} shrink-0 mt-0.5`} />
              <span className="text-[var(--sub)]">
                <strong className="text-[var(--txt)]">{r.t}</strong> — {r.d}
              </span>
            </div>
          ))}
          <p className="text-[var(--muted)] leading-relaxed">
            Stop-loss -25% · TP at +100%, +300%, +900% · Trailing stop after +80% · Time-stop at 3h flat.
          </p>
        </div>
      )}

      {error && <div className="mx-3 mt-3 surface text-danger text-xs">{error}</div>}

      {/* ── Token list ── */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {visible.map((p, idx) => {
          const mint   = p.baseToken.address;
          const snap   = snaps[mint];
          const curMc  = p.marketCap ?? p.fdv ?? 0;
          const curP   = Number(p.priceUsd ?? 0);
          const c24    = p.priceChange?.h24;
          const c5m    = p.priceChange?.m5;
          const mcDelta = snap && snap.marketCap > 0
            ? ((curMc - snap.marketCap) / snap.marketCap) * 100
            : null;
          const isHot  = tab === "trending" && idx < 3;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`}
              className="block rounded-xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

              <div className="p-2.5">

                {/* Row 1: Logo · Symbol · rank badge · Price · 5M · 24H */}
                <div className="flex items-center gap-2">
                  {/* Logo + blinking dot */}
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
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs font-bold text-[var(--txt)] truncate">
                      {p.baseToken.symbol}
                    </span>
                    {isHot && (
                      <span className="text-2xs font-semibold text-accent bg-accent/10
                                       px-1 py-0.5 rounded-full shrink-0">
                        #{idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Price + changes */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {c5m !== undefined && (
                      <span className={`text-2xs font-semibold ${c5m >= 0 ? "text-accent" : "text-danger"}`}>
                        {formatPct(c5m)}
                      </span>
                    )}
                    {c24 !== undefined && (
                      <span className={`text-2xs font-semibold ${c24 >= 0 ? "text-accent" : "text-danger"}`}>
                        {formatPct(c24)}
                      </span>
                    )}
                    <span className="text-xs font-bold text-[var(--txt)] min-w-[72px] text-right">
                      {formatTokenPrice(curP)}
                    </span>
                  </div>
                </div>

                {/* Row 2: LIQ · MC · Age · Vol — all inline, colored */}
                <div className="flex items-center gap-1.5 mt-1.5 pl-0.5 flex-wrap">
                  <StatPill label="LIQ" value={formatUsd(p.liquidity?.usd)} />
                  <Sep />
                  <StatPill label="MC"  value={formatUsd(curMc)} />
                  <Sep />
                  <span className="text-2xs text-[var(--muted)]">{formatAge(p.pairCreatedAt)}</span>
                  <Sep />
                  <StatPill label="Vol" value={formatUsd(p.volume?.h24)} />
                </div>

                {/* Row 3: At fetch — immutable once set */}
                {snap && (
                  <div className="flex items-center gap-1.5 mt-1 pl-0.5">
                    <span className="text-2xs text-[var(--muted)]">
                      Fetch: {formatUsd(snap.marketCap)} MC · {formatTokenPrice(snap.priceUsd)}
                    </span>
                    {mcDelta !== null && Math.abs(mcDelta) > 0.05 && (
                      <span className={`text-2xs font-semibold ${mcDelta >= 0 ? "text-accent" : "text-danger"}`}>
                        {formatPct(mcDelta)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      <div className="px-3 pb-6">
        {hasMore ? (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingMore
              ? <><RefreshCw size={13} className="animate-spin" /> Loading…</>
              : `Load more  (${totalShown} / ${filtered.length})`
            }
          </button>
        ) : filtered.length > 0 ? (
          <div className="text-center text-2xs text-[var(--muted)] py-3">
            All {filtered.length} tokens loaded
          </div>
        ) : loading ? (
          <div className="text-center text-xs text-[var(--muted)] py-10">
            Fetching from DexScreener…
          </div>
        ) : tab === "lowmc" ? (
          <div className="text-center text-xs text-[var(--muted)] py-10">
            No tokens under $200k in this batch.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-[var(--muted)] p-1.5 rounded-full hover:bg-[var(--card2)]">
      {children}
    </button>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-2xs text-[var(--muted)] bg-[var(--card2)] rounded-lg px-2 py-1">
      {children}
    </span>
  );
}
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-2xs text-[var(--sub)]">
      <span className="text-[var(--muted)]">{label} </span>{value}
    </span>
  );
}
function Sep() {
  return <span className="text-2xs text-[var(--border)]">·</span>;
}
