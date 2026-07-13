"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw } from "lucide-react";
import { TxRecord } from "@/app/api/transactions/[address]/route";

function formatTime(blockTime: number | null): string {
  if (!blockTime) return "—";
  const d = new Date(blockTime * 1000);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function WalletHistoryPage() {
  const router = useRouter();
  const { vault } = useLocalWallet();
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!vault) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${vault.publicKey}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setTxs(d.transactions);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [vault]);

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 px-3 py-2.5 sticky top-0 z-10"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()} className="text-[var(--muted)]"><ArrowLeft size={18} /></button>
        <span className="text-sm font-semibold flex-1 text-[var(--txt)]">Transaction History</span>
        <button onClick={load} className="text-[var(--muted)]">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!vault && (
        <div className="mx-3 mt-3 surface text-xs text-[var(--muted)]">
          No wallet found. Create or import one from the Wallet tab.
        </div>
      )}

      {error && (
        <div className="mx-3 mt-3 surface text-danger text-xs flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-xs text-[var(--muted)]">Loading transactions…</div>
      )}

      {!loading && txs.length === 0 && !error && (
        <div className="text-center py-10 text-xs text-[var(--muted)]">No transactions found.</div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {txs.map((tx) => {
          const isReceive = tx.solChange > 0;
          const isFailed = tx.status === "failed";
          return (
            <a
              key={tx.signature}
              href={`https://solscan.io/tx/${tx.signature}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 block"
              style={{ background: "var(--bg)" }}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isFailed ? "bg-danger/10" : isReceive ? "bg-accent/10" : "bg-[var(--card2)]"
              }`}>
                {isFailed
                  ? <AlertCircle size={16} className="text-danger" />
                  : isReceive
                    ? <ArrowDownLeft size={16} className="text-accent" />
                    : <ArrowUpRight size={16} className="text-[var(--muted)]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--txt)]">
                  {isFailed ? "Failed" : isReceive ? "Received" : "Sent"}
                </div>
                <div className="text-2xs text-[var(--muted)] mt-0.5 truncate">
                  {tx.signature.slice(0, 20)}…
                </div>
                {tx.memo && (
                  <div className="text-2xs text-[var(--muted)] truncate">{tx.memo}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-semibold ${
                  isFailed ? "text-[var(--muted)]" : tx.solChange > 0 ? "text-accent" : "text-[var(--txt)]"
                }`}>
                  {tx.solChange !== 0
                    ? `${tx.solChange > 0 ? "+" : ""}${tx.solChange.toFixed(4)} SOL`
                    : "—"
                  }
                </div>
                <div className="text-2xs text-[var(--muted)] mt-0.5">{formatTime(tx.blockTime)}</div>
              </div>
            </a>
          );
        })}
      </div>

      {txs.length > 0 && (
        <div className="text-center py-3 text-2xs text-[var(--muted)]">
          Showing up to 40 recent transactions. View full history on{" "}
          <a href={`https://solscan.io/account/${vault?.publicKey}`} target="_blank" rel="noreferrer"
            className="text-accent">Solscan</a>.
        </div>
      )}
    </div>
  );
}
