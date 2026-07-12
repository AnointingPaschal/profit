"use client";

import { useEffect, useState } from "react";
import { Position } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";
import { store } from "@/lib/store";

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    setPositions(store.getPositions());
  }, []);

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const realizedTotal = closed.reduce((sum, p) => sum + (p.realizedPnlUsd ?? 0), 0);
  const wins = closed.filter((p) => (p.realizedPnlUsd ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Positions</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-muted text-xs">Realized P/L</div>
          <div className={realizedTotal >= 0 ? "text-accent text-lg font-semibold" : "text-danger text-lg font-semibold"}>
            {formatUsd(realizedTotal)}
          </div>
        </div>
        <div className="card">
          <div className="text-muted text-xs">Win rate</div>
          <div className="text-lg font-semibold">{closed.length ? `${winRate.toFixed(0)}%` : "—"}</div>
        </div>
      </div>

      <section>
        <h2 className="text-sm text-muted mb-2">Open ({open.length})</h2>
        {open.length === 0 && (
          <div className="card text-muted text-sm text-center py-6">
            No open positions yet — buy something from Discover or Trade.
          </div>
        )}
        <div className="space-y-2">
          {open.map((p) => {
            const gainPct = ((p.peakPriceUsd - p.entryPriceUsd) / p.entryPriceUsd) * 100;
            return (
              <div key={p.id} className="card">
                <div className="flex justify-between">
                  <span className="font-medium">{p.symbol}</span>
                  <span className={gainPct >= 0 ? "text-accent" : "text-danger"}>{formatPct(gainPct)}</span>
                </div>
                <div className="text-xs text-muted mt-1">
                  Entry {formatUsd(p.entryPriceUsd)} · Remaining {p.remainingPct}% · {p.solSpent} SOL in
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm text-muted mb-2">History ({closed.length})</h2>
        <div className="space-y-2">
          {closed.map((p) => (
            <div key={p.id} className="card flex justify-between items-center">
              <div>
                <div className="font-medium">{p.symbol}</div>
                <div className="text-xs text-muted">{p.closedReason?.replace("_", " ")}</div>
              </div>
              <span className={(p.realizedPnlUsd ?? 0) >= 0 ? "text-accent" : "text-danger"}>
                {formatUsd(p.realizedPnlUsd)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
