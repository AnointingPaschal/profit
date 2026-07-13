"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { store } from "@/lib/store";
import { ScannedTokenEntry } from "@/lib/store";
import { formatUsd, formatPct } from "@/lib/format";
import { ArrowLeft, Download, Trash2 } from "lucide-react";

export default function ScannedHistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ScannedTokenEntry[]>([]);

  useEffect(() => {
    setEntries(store.getScannedTokens());
  }, []);

  const downloadJson = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-scanned-tokens-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (!confirm(`Delete all ${entries.length} logged tokens? This can't be undone.`)) return;
    store.clearScannedTokens();
    setEntries([]);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold flex-1">Scanned Tokens</h1>
      </div>

      <p className="text-xs text-muted">
        Every token this browser has ever fetched from Discover, saved locally as JSON. Stored only on this
        device — clearing site data or switching browsers loses this log unless you export it first.
      </p>

      <div className="flex gap-2">
        <button
          onClick={downloadJson}
          disabled={entries.length === 0}
          className="flex-1 bg-accent text-black font-semibold rounded-xl2 py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download size={16} /> Download JSON ({entries.length})
        </button>
        <button
          onClick={clearAll}
          disabled={entries.length === 0}
          className="px-4 border border-border rounded-xl2 text-danger flex items-center justify-center disabled:opacity-40"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {entries.length === 0 && (
        <div className="text-muted text-sm text-center py-10">
          Nothing logged yet — visit Discover and it'll start filling in.
        </div>
      )}

      <div>
        {entries.map((e) => {
          const changePct = e.initialMarketCap > 0 ? ((e.lastMarketCap - e.initialMarketCap) / e.initialMarketCap) * 100 : 0;
          return (
            <Link
              key={e.mint}
              href={`/token/${e.mint}`}
              className="flex items-center justify-between py-2.5 border-b border-border block"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{e.symbol}</div>
                <div className="text-xs text-muted">
                  Seen {e.timesSeen}× · first {new Date(e.firstSeenAt).toLocaleDateString()}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-sm">{formatUsd(e.lastMarketCap)}</div>
                <div className={`text-xs ${changePct >= 0 ? "text-accent" : "text-danger"}`}>
                  {formatPct(changePct)} since first seen
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
