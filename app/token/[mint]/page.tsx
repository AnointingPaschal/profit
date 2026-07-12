"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DexPair, RugReport } from "@/lib/types";
import { formatUsd, formatPct, formatAge, shortAddr } from "@/lib/format";
import { store } from "@/lib/store";
import RiskBadge from "@/components/RiskBadge";
import { ArrowLeft, Star, Ban, ShieldCheck, ShieldAlert } from "lucide-react";

export default function TokenDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const router = useRouter();
  const [pair, setPair] = useState<DexPair | null>(null);
  const [rug, setRug] = useState<RugReport | null>(null);
  const [initialMc, setInitialMc] = useState<number | null>(null);
  const [watchlisted, setWatchlisted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWatchlisted(store.getWatchlist().includes(mint));
    let interval: ReturnType<typeof setInterval>;

    const load = async () => {
      try {
        const res = await fetch(`/api/token/${mint}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPair(data.pair);
        setRug(data.rug);
        setInitialMc((prev) => (prev === null ? data.pair.marketCap ?? data.pair.fdv ?? 0 : prev));
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
    interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [mint]);

  if (error) return <div className="p-4"><div className="card text-danger">{error}</div></div>;
  if (!pair || !rug) return <div className="p-4 text-muted text-sm">Loading token…</div>;

  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  const mcapChangePct = initialMc ? ((mcap - initialMc) / initialMc) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold flex-1 truncate">{pair.baseToken.name} ({pair.baseToken.symbol})</h1>
        <button
          onClick={() => setWatchlisted(store.toggleWatchlist(mint).includes(mint))}
          className={watchlisted ? "text-warn" : "text-muted"}
        >
          <Star size={20} fill={watchlisted ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="text-xs text-muted -mt-2">{shortAddr(mint, 6)}</div>

      {/* Live data panel */}
      <div className="card grid grid-cols-2 gap-3">
        <div>
          <div className="text-muted text-xs">Price</div>
          <div className="font-semibold">${Number(pair.priceUsd ?? 0).toPrecision(4)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Market Cap</div>
          <div className="font-semibold">{formatUsd(mcap)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">MC at fetch</div>
          <div className="font-semibold">{formatUsd(initialMc)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Change since fetch</div>
          <div className={mcapChangePct >= 0 ? "text-accent font-semibold" : "text-danger font-semibold"}>
            {formatPct(mcapChangePct)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">Liquidity</div>
          <div className="font-semibold">{formatUsd(pair.liquidity?.usd)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Age</div>
          <div className="font-semibold">{formatAge(pair.pairCreatedAt)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Vol 5m</div>
          <div className="font-semibold">{formatUsd(pair.volume?.m5)}</div>
        </div>
        <div>
          <div className="text-muted text-xs">Vol 1h</div>
          <div className="font-semibold">{formatUsd(pair.volume?.h1)}</div>
        </div>
      </div>

      {/* Rug report */}
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
        {rug.reasons.length > 0 && (
          <ul className="text-xs text-muted list-disc pl-4 space-y-0.5 pt-1">
            {rug.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/trade?mint=${mint}`)}
          className="flex-1 bg-accent text-black font-semibold rounded-xl2 py-3"
        >
          Buy
        </button>
        <button
          onClick={() => {
            store.addToBlacklist(mint);
            router.push("/discover");
          }}
          className="px-4 border border-border rounded-xl2 text-danger flex items-center gap-1 text-sm"
        >
          <Ban size={16} /> Blacklist
        </button>
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
