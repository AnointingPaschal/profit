"use client";
import { useEffect, useState } from "react";
import { Position } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";
import { store } from "@/lib/store";

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  useEffect(() => { setPositions(store.getPositions()); }, []);

  const open = positions.filter(p => p.status === "open");
  const closed = positions.filter(p => p.status === "closed");
  const realized = closed.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0);
  const wins = closed.filter(p => (p.realizedPnlUsd ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-base font-bold text-[var(--txt)]">Positions</h1>

      <div className="grid grid-cols-2 gap-2">
        <div className="surface text-center py-2">
          <div className="text-2xs text-[var(--muted)]">Realized P&amp;L</div>
          <div className={`text-base font-bold mt-0.5 ${realized >= 0 ? "text-accent" : "text-danger"}`}>{formatUsd(realized)}</div>
        </div>
        <div className="surface text-center py-2">
          <div className="text-2xs text-[var(--muted)]">Win Rate</div>
          <div className="text-base font-bold mt-0.5 text-[var(--txt)]">{closed.length ? `${winRate.toFixed(0)}%` : "—"}</div>
        </div>
      </div>

      <div className="text-xs font-semibold text-[var(--muted)]">Open ({open.length})</div>
      {open.length === 0 && <div className="surface text-center py-6 text-xs text-[var(--muted)]">No open positions.</div>}
      <div className="space-y-2">
        {open.map(p => {
          const gain = ((p.peakPriceUsd - p.entryPriceUsd) / p.entryPriceUsd) * 100;
          return (
            <div key={p.id} className="surface">
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-[var(--txt)]">{p.symbol}</span>
                <span className={`text-xs font-medium ${gain >= 0 ? "text-accent" : "text-danger"}`}>{formatPct(gain)}</span>
              </div>
              <div className="text-2xs text-[var(--muted)] mt-1">
                Entry {formatUsd(p.entryPriceUsd)} · {p.remainingPct}% remaining · {p.solSpent} SOL
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs font-semibold text-[var(--muted)]">History ({closed.length})</div>
      <div className="surface !p-0 overflow-hidden divide-y divide-[var(--border)]">
        {closed.map(p => (
          <div key={p.id} className="flex justify-between items-center px-3 py-2.5">
            <div>
              <div className="text-xs font-medium text-[var(--txt)]">{p.symbol}</div>
              <div className="text-2xs text-[var(--muted)]">{p.closedReason?.replace("_", " ")}</div>
            </div>
            <span className={`text-xs font-semibold ${(p.realizedPnlUsd ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>
              {formatUsd(p.realizedPnlUsd)}
            </span>
          </div>
        ))}
        {closed.length === 0 && <div className="py-5 text-center text-xs text-[var(--muted)]">No closed positions yet.</div>}
      </div>
    </div>
  );
}
