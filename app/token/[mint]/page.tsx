"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { DexPair, RugReport } from "@/lib/types";
import { formatUsd, formatPct, formatAge, shortAddr } from "@/lib/format";
import { store } from "@/lib/store";
import RiskBadge from "@/components/RiskBadge";
import {
  ArrowLeft, Star, Share2, Copy, Globe, ExternalLink,
  ShieldCheck, ShieldAlert, Ban,
} from "lucide-react";

type Timeframe = "m5" | "h1" | "h6" | "h24";
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "m5", label: "5M" },
  { key: "h1", label: "1H" },
  { key: "h6", label: "6H" },
  { key: "h24", label: "24H" },
];

interface Holder { owner: string; amount: number; pct: number }

export default function TokenDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const router = useRouter();
  const [pair, setPair] = useState<DexPair | null>(null);
  const [rug, setRug] = useState<RugReport | null>(null);
  const [watchlisted, setWatchlisted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tf, setTf] = useState<Timeframe>("h24");
  const [tab, setTab] = useState<"info" | "chart">("info");
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [top10Pct, setTop10Pct] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setWatchlisted(store.getWatchlist().includes(mint));
    const load = async () => {
      try {
        const res = await fetch(`/api/token/${mint}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPair(data.pair);
        setRug(data.rug);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [mint]);

  useEffect(() => {
    fetch(`/api/token/${mint}/holders`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setHolders(d.holders);
          setTop10Pct(d.top10Pct);
        }
      })
      .catch(() => {});
  }, [mint]);

  const copyCA = () => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (error) return <div className="p-4"><div className="card text-danger">{error}</div></div>;
  if (!pair || !rug) return <div className="p-4 text-muted text-sm">Loading token…</div>;

  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  const change = pair.priceChange?.[tf];
  const txns = pair.txns?.[tf];
  const buys = txns?.buys ?? 0;
  const sells = txns?.sells ?? 0;
  const totalTx = buys + sells;
  const buyPct = totalTx > 0 ? (buys / totalTx) * 100 : 50;
  const websites = pair.info?.websites ?? [];
  const socials = pair.info?.socials ?? [];

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 sticky top-0 bg-base/95 backdrop-blur z-10 border-b border-border">
        <button onClick={() => router.back()} className="text-muted"><ArrowLeft size={20} /></button>
        <div className="w-6 h-6 rounded-full bg-surface2 overflow-hidden relative shrink-0">
          {pair.info?.imageUrl && (
            <Image src={pair.info.imageUrl} alt="" fill sizes="24px" className="object-cover" unoptimized />
          )}
        </div>
        <span className="font-semibold truncate flex-1">{pair.baseToken.name}</span>
        <button className="text-muted"><Share2 size={18} /></button>
        <button
          onClick={() => setWatchlisted(store.toggleWatchlist(mint).includes(mint))}
          className={watchlisted ? "text-warn" : "text-muted"}
        >
          <Star size={18} fill={watchlisted ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Pair line */}
      <div className="px-3 pt-2 flex items-center justify-center gap-2 text-sm">
        <span className="font-semibold">{pair.baseToken.symbol}</span>
        <span className="text-muted">/ {pair.quoteToken.symbol}</span>
        <button onClick={copyCA} className="text-muted"><Copy size={12} /></button>
        <span className="pill bg-surface2 text-muted capitalize">{pair.dexId}</span>
      </div>
      <div className="text-center text-[11px] text-muted mt-0.5">
        {copied ? "Copied!" : shortAddr(mint, 6)}
      </div>

      {/* Banner */}
      {pair.info?.header && (
        <div className="relative w-full h-36 mt-3 bg-surface2">
          <Image src={pair.info.header} alt="" fill sizes="480px" className="object-cover" unoptimized />
        </div>
      )}

      {/* Social links */}
      {(websites.length > 0 || socials.length > 0) && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-border">
          {websites.map((w, i) => (
            <a key={i} href={w.url} target="_blank" rel="noreferrer" className="pill bg-surface2 flex items-center gap-1 whitespace-nowrap">
              <Globe size={12} /> Website
            </a>
          ))}
          {socials.map((s, i) => (
            <a key={i} href={s.handle} target="_blank" rel="noreferrer" className="pill bg-surface2 flex items-center gap-1 whitespace-nowrap capitalize">
              <ExternalLink size={12} /> {s.platform}
            </a>
          ))}
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Tabs: Info / Chart */}
        <div className="flex gap-2 bg-surface2 rounded-xl2 p-1">
          {(["info", "chart"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${tab === t ? "bg-accent text-black" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "chart" ? (
          <div className="rounded-xl2 overflow-hidden border border-border" style={{ height: 420 }}>
            <iframe
              src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=1&info=0`}
              className="w-full h-full"
              title="chart"
            />
          </div>
        ) : (
          <>
            {/* Price boxes */}
            <div className="grid grid-cols-2 gap-2">
              <div className="card text-center">
                <div className="text-muted text-[10px] uppercase">Price USD</div>
                <div className="font-semibold text-lg">
                  {Number(pair.priceUsd ?? 0) < 0.01 ? `$${Number(pair.priceUsd ?? 0).toPrecision(4)}` : formatUsd(Number(pair.priceUsd))}
                </div>
              </div>
              <div className="card text-center">
                <div className="text-muted text-[10px] uppercase">Price ({pair.quoteToken.symbol})</div>
                <div className="font-semibold text-lg">{Number(pair.priceNative ?? 0).toPrecision(4)}</div>
              </div>
            </div>

            {/* Liq / FDV / MCAP */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card text-center py-2">
                <div className="text-muted text-[10px] uppercase">Liquidity</div>
                <div className="font-semibold text-sm">{formatUsd(pair.liquidity?.usd)}</div>
              </div>
              <div className="card text-center py-2">
                <div className="text-muted text-[10px] uppercase">FDV</div>
                <div className="font-semibold text-sm">{formatUsd(pair.fdv)}</div>
              </div>
              <div className="card text-center py-2">
                <div className="text-muted text-[10px] uppercase">Market Cap</div>
                <div className="font-semibold text-sm">{formatUsd(mcap)}</div>
              </div>
            </div>

            {/* Timeframe tabs */}
            <div className="grid grid-cols-4 gap-2">
              {TIMEFRAMES.map((t) => {
                const c = pair.priceChange?.[t.key];
                return (
                  <button
                    key={t.key}
                    onClick={() => setTf(t.key)}
                    className={`rounded-xl py-2 text-center ${tf === t.key ? "bg-surface2 ring-1 ring-accent" : "bg-surface2"}`}
                  >
                    <div className="text-[10px] text-muted">{t.label}</div>
                    <div className={`text-sm font-semibold ${c !== undefined && c >= 0 ? "text-accent" : "text-danger"}`}>
                      {formatPct(c)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Txns / buys-sells */}
            <div className="card space-y-3">
              <div className="flex justify-between text-sm">
                <div>
                  <div className="text-muted text-[10px] uppercase">Txns ({TIMEFRAMES.find((x) => x.key === tf)?.label})</div>
                  <div className="font-semibold">{totalTx.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted text-[10px] uppercase">Volume</div>
                  <div className="font-semibold">{formatUsd(pair.volume?.[tf])}</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-accent">Buys {buys.toLocaleString()}</span>
                  <span className="text-danger">Sells {sells.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-danger/40 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${buyPct}%` }} />
                </div>
              </div>
            </div>

            {/* Rug check */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Rug Check</span>
                <RiskBadge score={rug.score} isRisky={rug.isRisky} />
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <ChecklistItem ok={rug.mintAuthorityRenounced} label="Mint authority renounced" />
                <ChecklistItem ok={rug.freezeAuthorityRenounced} label="Freeze authority renounced" />
                <ChecklistItem ok={rug.lpLockedPct >= 80} label={`LP locked ${rug.lpLockedPct.toFixed(0)}%`} />
                <ChecklistItem ok={rug.top10HolderPct <= 25} label={`Top 10 hold ${rug.top10HolderPct.toFixed(0)}%`} />
              </div>
            </div>

            {/* Holders */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Top Holders</span>
                {top10Pct !== null && <span className="text-xs text-muted">Top 10: {top10Pct.toFixed(1)}%</span>}
              </div>
              {!holders && <div className="text-xs text-muted">Loading holders…</div>}
              {holders?.map((h, i) => (
                <div key={h.owner} className="flex items-center justify-between text-xs">
                  <span className="text-muted">#{i + 1} {shortAddr(h.owner, 5)}</span>
                  <span>{h.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({h.pct.toFixed(1)}%)</span>
                </div>
              ))}
              <p className="text-[10px] text-muted pt-1">
                Top 20 largest token accounts via RPC — full holder counts need an indexer (Helius/Birdeye).
              </p>
            </div>

            {/* Pair info */}
            <div className="card space-y-1.5 text-xs">
              <Row label="Pair created" value={formatAge(pair.pairCreatedAt) + " ago"} />
              <Row label={`Pooled ${pair.baseToken.symbol}`} value={formatUsd(pair.liquidity?.base)} />
              <Row label={`Pooled ${pair.quoteToken.symbol}`} value={formatUsd(pair.liquidity?.quote)} />
              <Row label="Pair address" value={shortAddr(pair.pairAddress, 5)} />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 sticky bottom-2">
          <button
            onClick={() => router.push(`/trade?mint=${mint}`)}
            className="flex-1 bg-accent text-black font-semibold rounded-xl2 py-3"
          >
            Trade {pair.baseToken.symbol}
          </button>
          <button
            onClick={() => { store.addToBlacklist(mint); router.push("/discover"); }}
            className="px-4 border border-border rounded-xl2 text-danger flex items-center gap-1 text-sm"
          >
            <Ban size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? <ShieldCheck size={14} className="text-accent" /> : <ShieldAlert size={14} className="text-danger" />}
      <span className={ok ? "text-muted" : "text-danger"}>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
