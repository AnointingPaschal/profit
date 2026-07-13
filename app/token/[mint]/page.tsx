"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { DexPair, RugReport } from "@/lib/types";
import { formatUsd, formatPct, formatAge, shortAddr } from "@/lib/format";
import { store } from "@/lib/store";
import { ArrowLeft, Star, Copy, Globe, ExternalLink, ShieldCheck, ShieldAlert, Ban } from "lucide-react";
import clsx from "clsx";

type TF = "m5" | "h1" | "h6" | "h24";
const TFS: { k: TF; l: string }[] = [{ k: "m5", l: "5M" }, { k: "h1", l: "1H" }, { k: "h6", l: "6H" }, { k: "h24", l: "24H" }];

interface Holder { owner: string; amount: number; pct: number }

export default function TokenPage() {
  const { mint } = useParams<{ mint: string }>();
  const router = useRouter();

  const [pair, setPair] = useState<DexPair | null>(null);
  const [rug, setRug] = useState<RugReport | null>(null);
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [top10Pct, setTop10Pct] = useState<number | null>(null);
  const [tf, setTf] = useState<TF>("h24");
  const [tab, setTab] = useState<"info" | "chart">("info");
  const [watchlisted, setWatchlisted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot of price/MC/liquidity at first load
  const [snap, setSnap] = useState<{ priceUsd: number; marketCap: number; liquidity: number } | null>(null);

  useEffect(() => {
    setWatchlisted(store.getWatchlist().includes(mint));
    const load = async () => {
      try {
        const res = await fetch(`/api/token/${mint}`);
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        setPair(d.pair);
        setRug(d.rug);
        setError(null);
        setSnap(prev => prev ?? {
          priceUsd: Number(d.pair.priceUsd ?? 0),
          marketCap: d.pair.marketCap ?? d.pair.fdv ?? 0,
          liquidity: d.pair.liquidity?.usd ?? 0,
        });
      } catch (e: any) { setError(e.message); }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [mint]);

  useEffect(() => {
    fetch(`/api/token/${mint}/holders`).then(r => r.json()).then(d => {
      if (!d.error) { setHolders(d.holders); setTop10Pct(d.top10Pct); }
    });
  }, [mint]);

  const copy = () => { navigator.clipboard.writeText(mint); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  if (error) return <div className="p-3"><div className="surface text-danger text-xs">{error}</div></div>;
  if (!pair || !rug) return <div className="p-4 text-xs text-[var(--muted)]">Loading…</div>;

  const curMc    = pair.marketCap ?? pair.fdv ?? 0;
  const curPrice = Number(pair.priceUsd ?? 0);
  const curLiq   = pair.liquidity?.usd ?? 0;
  const change   = pair.priceChange?.[tf];
  const txns     = pair.txns?.[tf];
  const buys     = txns?.buys ?? 0;
  const sells    = txns?.sells ?? 0;
  const total    = buys + sells;
  const buyPct   = total > 0 ? (buys / total) * 100 : 50;

  return (
    <div className="pb-6">
      {/* Mini top bar */}
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 z-10"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()} className="text-[var(--muted)]"><ArrowLeft size={18} /></button>
        {pair.info?.imageUrl && (
          <div className="w-5 h-5 rounded-full overflow-hidden relative shrink-0">
            <Image src={pair.info.imageUrl} alt="" fill sizes="20px" className="object-cover" unoptimized />
          </div>
        )}
        <span className="font-semibold text-sm flex-1 truncate text-[var(--txt)]">{pair.baseToken.name}</span>
        <button onClick={() => setWatchlisted(store.toggleWatchlist(mint).includes(mint))}
          className={watchlisted ? "text-warn" : "text-[var(--muted)]"}>
          <Star size={16} fill={watchlisted ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="px-3 pt-3 space-y-3">

        {/* Chart/Info tabs */}
        <div className="flex gap-1.5 bg-[var(--card2)] rounded-xl2 p-0.5">
          {(["info", "chart"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("flex-1 py-1.5 rounded-xl text-xs font-medium capitalize",
                tab === t ? "bg-[var(--card)] text-[var(--txt)] shadow-sm" : "text-[var(--muted)]")}>
              {t}
            </button>
          ))}
        </div>

        {tab === "chart" ? (
          <div className="rounded-xl2 overflow-hidden" style={{ height: 380, border: "1px solid var(--border)" }}>
            <iframe src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=1&info=0`}
              className="w-full h-full" title="chart" />
          </div>
        ) : (
          /* ── SINGLE DIV, grid layout ── */
          <div className="surface space-y-4">

            {/* Header: logo + pair + CA */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[var(--card2)] overflow-hidden relative shrink-0">
                {pair.info?.imageUrl && <Image src={pair.info.imageUrl} alt="" fill sizes="44px" className="object-cover" unoptimized />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[var(--txt)]">{pair.baseToken.symbol}</span>
                  <span className="text-2xs text-[var(--muted)]">/ {pair.quoteToken.symbol}</span>
                  <span className="pill bg-[var(--card2)] text-[var(--muted)] capitalize">{pair.dexId}</span>
                </div>
                <button onClick={copy} className="flex items-center gap-1 mt-0.5">
                  <span className="text-2xs text-[var(--muted)]">{copied ? "Copied!" : shortAddr(mint, 6)}</span>
                  <Copy size={10} className="text-[var(--muted)]" />
                </button>
              </div>
              <button onClick={() => { store.addToBlacklist(mint); router.push("/discover"); }}
                className="text-[var(--muted)]"><Ban size={15} /></button>
            </div>

            {/* Banner */}
            {pair.info?.header && (
              <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 120 }}>
                <Image src={pair.info.header} alt="" fill sizes="460px" className="object-cover" unoptimized />
              </div>
            )}

            {/* Socials */}
            {((pair.info?.websites?.length ?? 0) + (pair.info?.socials?.length ?? 0)) > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {pair.info?.websites?.map((w, i) => (
                  <a key={i} href={w.url} target="_blank" rel="noreferrer"
                    className="pill bg-[var(--card2)] text-[var(--muted)] flex items-center gap-1">
                    <Globe size={10} /> Website
                  </a>
                ))}
                {pair.info?.socials?.map((s, i) => (
                  <a key={i} href={s.handle} target="_blank" rel="noreferrer"
                    className="pill bg-[var(--card2)] text-[var(--muted)] flex items-center gap-1 capitalize">
                    <ExternalLink size={10} /> {s.platform}
                  </a>
                ))}
              </div>
            )}

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Price + change grid */}
            <div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-2xs text-[var(--muted)]">Price USD</div>
                  <div className="text-xl font-bold text-[var(--txt)]">
                    {curPrice < 0.01 ? `$${curPrice.toPrecision(4)}` : formatUsd(curPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs text-[var(--muted)]">{pair.quoteToken.symbol}</div>
                  <div className="text-xs font-semibold text-[var(--txt)]">{Number(pair.priceNative ?? 0).toPrecision(4)}</div>
                </div>
              </div>

              {/* Timeframe tabs */}
              <div className="grid grid-cols-4 gap-1.5">
                {TFS.map(t => {
                  const c = pair.priceChange?.[t.k];
                  return (
                    <button key={t.k} onClick={() => setTf(t.k)}
                      className={clsx("rounded-xl py-1.5 text-center",
                        tf === t.k ? "bg-[var(--card2)] ring-1 ring-accent" : "bg-[var(--card2)]")}>
                      <div className="text-2xs text-[var(--muted)]">{t.l}</div>
                      <div className={`text-xs font-semibold ${c !== undefined && c >= 0 ? "text-accent" : "text-danger"}`}>
                        {formatPct(c)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Key stats grid */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              {[
                { l: "Liquidity",   v: formatUsd(curLiq) },
                { l: "FDV",         v: formatUsd(pair.fdv) },
                { l: "Market Cap",  v: formatUsd(curMc) },
                { l: `Vol ${TFS.find(t => t.k === tf)?.l}`, v: formatUsd(pair.volume?.[tf]) },
                { l: "Txns",        v: total.toLocaleString() },
                { l: "Age",         v: formatAge(pair.pairCreatedAt) },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-2xs text-[var(--muted)]">{s.l}</div>
                  <div className="text-xs font-semibold text-[var(--txt)] mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>

            {/* Initial vs current at fetch */}
            {snap && (
              <>
                <hr style={{ borderColor: "var(--border)" }} />
                <div>
                  <div className="text-2xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">At fetch vs. now</div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                    {[
                      { l: "Init Price",  init: snap.priceUsd,   cur: curPrice },
                      { l: "Init MC",     init: snap.marketCap,  cur: curMc },
                      { l: "Init Liq",    init: snap.liquidity,  cur: curLiq },
                    ].map(s => {
                      const delta = s.init > 0 ? ((s.cur - s.init) / s.init) * 100 : null;
                      return (
                        <div key={s.l}>
                          <div className="text-2xs text-[var(--muted)]">{s.l}</div>
                          <div className="text-xs font-semibold text-[var(--txt)] mt-0.5">{formatUsd(s.init)}</div>
                          {delta !== null && (
                            <div className={`text-2xs font-medium ${delta >= 0 ? "text-accent" : "text-danger"}`}>
                              {formatPct(delta)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Buy/sell pressure */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-accent font-medium">Buys {buys.toLocaleString()}</span>
                <span className="text-danger font-medium">Sells {sells.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-danger/30 overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${buyPct}%` }} />
              </div>
            </div>

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Rug check */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--txt)]">Rug Check</span>
                <span className={clsx("pill",
                  !rug.isRisky ? "bg-accent/10 text-accent" : rug.score > 75 ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn")}>
                  {!rug.isRisky ? "Safer" : rug.score > 75 ? "High Risk" : "Caution"} · {rug.score}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                {[
                  { ok: rug.mintAuthorityRenounced,   l: "Mint renounced" },
                  { ok: rug.freezeAuthorityRenounced, l: "Freeze renounced" },
                  { ok: rug.lpLockedPct >= 80,        l: `LP locked ${rug.lpLockedPct.toFixed(0)}%` },
                  { ok: rug.top10HolderPct <= 25,     l: `Top10 ${rug.top10HolderPct.toFixed(0)}%` },
                ].map(r => (
                  <div key={r.l} className="flex items-center gap-1.5">
                    {r.ok
                      ? <ShieldCheck size={12} className="text-accent shrink-0" />
                      : <ShieldAlert size={12} className="text-danger shrink-0" />}
                    <span className={`text-2xs ${r.ok ? "text-[var(--muted)]" : "text-danger"}`}>{r.l}</span>
                  </div>
                ))}
              </div>
              {rug.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {rug.reasons.map((r, i) => <li key={i} className="text-2xs text-[var(--muted)] list-disc ml-4">{r}</li>)}
                </ul>
              )}
            </div>

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Top holders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--txt)]">Top Holders</span>
                {top10Pct !== null && <span className="text-2xs text-[var(--muted)]">Top10: {top10Pct.toFixed(1)}%</span>}
              </div>
              {!holders
                ? <div className="text-2xs text-[var(--muted)]">Loading…</div>
                : <div className="space-y-1.5">
                    {holders.map((h, i) => (
                      <div key={h.owner} className="flex items-center justify-between">
                        <span className="text-2xs text-[var(--muted)]">#{i + 1} {shortAddr(h.owner, 5)}</span>
                        <span className="text-2xs text-[var(--txt)]">{h.pct.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
              }
            </div>

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Pair info */}
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              {[
                { l: "Created",   v: formatAge(pair.pairCreatedAt) + " ago" },
                { l: "Pair",      v: shortAddr(pair.pairAddress, 5) },
                { l: `Pooled ${pair.baseToken.symbol}`, v: formatUsd(pair.liquidity?.base) },
                { l: `Pooled ${pair.quoteToken.symbol}`, v: formatUsd(pair.liquidity?.quote) },
              ].map(r => (
                <div key={r.l}>
                  <div className="text-2xs text-[var(--muted)]">{r.l}</div>
                  <div className="text-xs font-semibold text-[var(--txt)] mt-0.5">{r.v}</div>
                </div>
              ))}
            </div>

            {/* Trade button */}
            <button
              onClick={() => router.push(`/trade?mint=${mint}`)}
              className="w-full bg-accent text-white text-sm font-semibold rounded-xl2 py-2.5 mt-1">
              Trade {pair.baseToken.symbol}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
