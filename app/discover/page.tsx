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

export default function DiscoverPage() {
  const [tab, setTab]         = useState<Tab>("trending");
  const [pairs, setPairs]     = useState<DexPair[]>([]);
  const [snaps, setSnaps]     = useState<Record<string, PriceSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [guide, setGuide]     = useState(false);

  // Load persisted snapshots + saved tokens on mount → page is never blank on reload
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
      setPairs(asPairs);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/discover?sort=${tab}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fresh: DexPair[] = data.pairs;
      setPairs(fresh);
      store.recordScannedTokens(fresh);
      store.mergeSnapshots(fresh);          // only writes if mint not already stored
      setSnaps(store.getSnapshots());       // reload so UI sees the updated map
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [tab, load]);

  const visible = tab === "lowmc"
    ? pairs.filter(p => (p.marketCap ?? p.fdv ?? Infinity) < 200_000)
    : pairs;

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
            <Btn onClick={load}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></Btn>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Chip>{visible.length} pairs</Chip>
          <Chip>Vol {formatUsd(visible.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0))}</Chip>
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
            <strong className="text-[var(--txt)]">Low MC tab</strong> shows tokens under $200k — highest risk, highest reward.
            Most go to zero. A few 10–100x. Size positions at 0.05–0.1 SOL max so one rug doesn't hurt the account.
          </p>
          {[
            { I: ShieldCheck, c: "text-accent", t: "Mint authority renounced", d: "Dev can't inflate supply" },
            { I: ShieldCheck, c: "text-accent", t: "LP locked / burned",       d: "Liquidity can't be pulled" },
            { I: Clock,       c: "text-warn",   t: "Age 2–60 minutes",         d: "Not dead, not too early" },
            { I: ShieldCheck, c: "text-accent", t: "Top-10 holders < 25%",     d: "No single wallet can dump" },
            { I: ShieldAlert, c: "text-danger", t: "Avoid >200% pumped tokens", d: "You're buying the top" },
          ].map(r => (
            <div key={r.t} className="flex items-start gap-1.5">
              <r.I size={12} className={`${r.c} shrink-0 mt-0.5`} />
              <span className="text-[var(--sub)]"><strong className="text-[var(--txt)]">{r.t}</strong> — {r.d}</span>
            </div>
          ))}
          <p className="text-[var(--muted)] leading-relaxed">
            Stop-loss at -25%. Take partial profits at +100%, +300%, +900%. Trailing stop after +80% gain.
            Time-stop anything flat after 3 hours. The exit matters more than the entry.
          </p>
        </div>
      )}

      {error && <div className="mx-3 mt-3 surface text-danger text-xs">{error}</div>}

      {/* ── Token cards ── */}
      <div className="px-3 pt-3 pb-4 space-y-2">
        {visible.map((p, idx) => {
          const mint    = p.baseToken.address;
          const snap    = snaps[mint];
          const curMc   = p.marketCap ?? p.fdv ?? 0;
          const curLiq  = p.liquidity?.usd ?? 0;
          const curP    = Number(p.priceUsd ?? 0);
          const c24     = p.priceChange?.h24;
          const c5m     = p.priceChange?.m5;
          const mcDelta = snap && snap.marketCap > 0
            ? ((curMc - snap.marketCap) / snap.marketCap) * 100
            : null;
          const isHot   = tab === "trending" && idx < 3;
          const buys    = p.txns?.h24?.buys ?? 0;
          const sells   = p.txns?.h24?.sells ?? 0;
          const total   = buys + sells;
          const buyPct  = total > 0 ? (buys / total) * 100 : 50;

          return (
            <Link key={p.pairAddress} href={`/token/${mint}`}
              className="block rounded-xl2 overflow-hidden relative"
              style={{ border: "1px solid var(--border)" }}>

              {/* Background: token banner with WHITE overlay */}
              {p.info?.header ? (
                <>
                  <div className="absolute inset-0">
                    <Image src={p.info.header} alt="" fill sizes="460px"
                      className="object-cover" unoptimized />
                  </div>
                  {/* White overlay in light mode, dark overlay in dark mode */}
                  <div className="absolute inset-0 banner-overlay" />
                </>
              ) : (
                <div className="absolute inset-0"
                  style={{ background: isHot ? "rgba(16,185,129,0.03)" : "var(--card)" }} />
              )}

              {/* Card content */}
              <div className="relative z-10 p-3 space-y-1">

                {/* Row 1: Logo + symbol + rank + price */}
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--card2)] overflow-hidden relative">
                      {p.info?.imageUrl
                        ? <Image src={p.info.imageUrl} alt="" fill sizes="36px"
                            className="object-cover" unoptimized />
                        : <div className="w-full h-full flex items-center justify-center
                                          text-2xs font-bold text-[var(--muted)]">
                            {p.baseToken.symbol.slice(0, 3)}
                          </div>
                      }
                    </div>
                    {/* Blinking live dot for top trending */}
                    {isHot && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent">
                        <span className="animate-ping absolute inset-0 rounded-full bg-accent opacity-60" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[var(--txt)]">{p.baseToken.symbol}</span>
                      {isHot && (
                        <span className="text-2xs font-semibold text-accent bg-accent/10
                                         px-1.5 py-0.5 rounded-full">
                          #{idx + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price top-right */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[var(--txt)]">{formatTokenPrice(curP)}</div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      {c5m !== undefined && (
                        <span className={`text-2xs font-semibold ${c5m >= 0 ? "text-accent" : "text-danger"}`}>
                          5M {formatPct(c5m)}
                        </span>
                      )}
                      {c24 !== undefined && (
                        <span className={`text-2xs font-semibold ${c24 >= 0 ? "text-accent" : "text-danger"}`}>
                          24H {formatPct(c24)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: LIQ · MC · Age · Vol all inline */}
                <div className="flex items-center gap-2 flex-wrap pl-0.5">
                  <span className="text-2xs text-[var(--sub)]">LIQ {formatUsd(curLiq)}</span>
                  <span className="text-2xs text-[var(--muted)]">·</span>
                  <span className="text-2xs text-[var(--sub)]">MC {formatUsd(curMc)}</span>
                  <span className="text-2xs text-[var(--muted)]">·</span>
                  <span className="text-2xs text-[var(--sub)]">{formatAge(p.pairCreatedAt)}</span>
                  <span className="text-2xs text-[var(--muted)]">·</span>
                  <span className="text-2xs text-[var(--sub)]">Vol {formatUsd(p.volume?.h24)}</span>
                </div>

                {/* Row 3: At fetch — persistent, never changes after first load */}
                <div className="flex items-center gap-2 pl-0.5">
                  {snap ? (
                    <>
                      <span className="text-2xs text-[var(--muted)]">
                        At fetch: {formatUsd(snap.marketCap)} MC
                        {snap.priceUsd > 0 && ` · ${formatTokenPrice(snap.priceUsd)}`}
                      </span>
                      {mcDelta !== null && Math.abs(mcDelta) > 0.05 && (
                        <span className={`text-2xs font-semibold ${mcDelta >= 0 ? "text-accent" : "text-danger"}`}>
                          {formatPct(mcDelta)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-2xs text-[var(--muted)]">Fetching snapshot…</span>
                  )}
                </div>

                {/* Row 4: Buy/sell counts inline */}
                {total > 0 && (
                  <div className="flex items-center gap-2 pl-0.5">
                    <span className="text-2xs text-[var(--muted)]">{buys}B / {sells}S</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: "rgba(239,68,68,0.2)" }}>
                      <div className="h-full bg-accent" style={{ width: `${buyPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        {loading && visible.length === 0 && (
          <div className="text-center py-10 text-xs text-[var(--muted)]">
            Fetching from DexScreener…
          </div>
        )}
        {!loading && tab === "lowmc" && visible.length === 0 && (
          <div className="text-center py-10 text-xs text-[var(--muted)]">
            No tokens under $200k in this batch. Refresh to try again.
          </div>
        )}
      </div>
    </div>
  );
}

/* Small helpers */
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
