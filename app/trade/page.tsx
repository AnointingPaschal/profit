"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { SOL_MINT, buildSwapTransaction } from "@/lib/jupiter";
import clsx from "clsx";

interface LimitOrder { id: string; mint: string; side: "buy"; targetPriceUsd: number; amountSol: number; createdAt: number }

function TradeInner() {
  const search = useSearchParams();
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [tab, setTab] = useState<"spot" | "limit">("spot");
  const [mint, setMint] = useState(search.get("mint") ?? "");
  const [amountSol, setAmountSol] = useState("0.05");
  const [slippageBps, setSlippageBps] = useState(1000);
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [limitPrice, setLimitPrice] = useState("");
  const [orders, setOrders] = useState<LimitOrder[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem("profit.limitOrders.v1");
    if (raw) setOrders(JSON.parse(raw));
  }, []);

  const fetchQuote = async () => {
    if (!mint || !amountSol) return;
    setQuoting(true); setStatus(null);
    try {
      const lamports = Math.floor(Number(amountSol) * 1e9);
      const res = await fetch(`/api/quote?inputMint=${SOL_MINT}&outputMint=${mint}&amount=${lamports}&slippageBps=${slippageBps}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setQuote(d);
    } catch (e: any) { setStatus(e.message); }
    finally { setQuoting(false); }
  };

  const execSwap = async () => {
    if (!publicKey || !signTransaction || !quote) return;
    setStatus("Building…");
    try {
      const b64 = await buildSwapTransaction(quote, publicKey.toBase58());
      const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
      const signed = await signTransaction(tx);
      setStatus("Sending…");
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`✓ ${sig.slice(0, 16)}…`);
    } catch (e: any) { setStatus(`Failed: ${e.message}`); }
  };

  const addOrder = () => {
    if (!mint || !limitPrice || !amountSol) return;
    const o: LimitOrder = { id: crypto.randomUUID(), mint, side: "buy", targetPriceUsd: Number(limitPrice), amountSol: Number(amountSol), createdAt: Date.now() };
    const next = [o, ...orders];
    setOrders(next);
    window.localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
  };

  const cancelOrder = (id: string) => {
    const next = orders.filter(o => o.id !== id);
    setOrders(next);
    window.localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
  };

  const Input = ({ placeholder, value, onChange, type = "text" }: any) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
      className="w-full rounded-xl px-3 py-2 text-xs outline-none text-[var(--txt)]"
      style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
  );

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-base font-bold text-[var(--txt)]">Trade</h1>

      <div className="flex gap-1 p-0.5 rounded-xl2" style={{ background: "var(--card2)" }}>
        {(["spot", "limit"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium capitalize",
              tab === t ? "bg-[var(--card)] text-[var(--txt)] shadow-sm" : "text-[var(--muted)]")}>
            {t}
          </button>
        ))}
      </div>

      <div className="surface space-y-2.5">
        <div className="text-2xs text-[var(--muted)]">Token mint address</div>
        <Input value={mint} onChange={setMint} placeholder="Paste mint address" />
        <div className="text-2xs text-[var(--muted)]">Amount (SOL)</div>
        <Input value={amountSol} onChange={setAmountSol} placeholder="0.05" type="number" />

        {tab === "spot" && (
          <>
            <div className="text-2xs text-[var(--muted)]">Slippage (bps)</div>
            <Input value={slippageBps} onChange={(v: string) => setSlippageBps(Number(v))} type="number" />
            <button onClick={fetchQuote} className="w-full py-2 rounded-xl text-xs font-medium text-[var(--txt)]"
              style={{ border: "1px solid var(--border)" }}>
              {quoting ? "Getting quote…" : "Get Quote"}
            </button>
            {quote && (
              <div className="text-2xs text-[var(--muted)] space-y-0.5">
                <div>Output: ~{Number(quote.outAmount) / 1e6} tokens (check decimals)</div>
                <div>Price impact: {quote.priceImpactPct?.toFixed(2)}%</div>
              </div>
            )}
            {!connected
              ? <WalletMultiButton style={{ width: "100%", justifyContent: "center", borderRadius: "0.875rem", height: 40, fontSize: 13 }} />
              : <button onClick={execSwap} disabled={!quote}
                  className="btn-primary w-full disabled:opacity-40">
                  Confirm Swap
                </button>
            }
          </>
        )}

        {tab === "limit" && (
          <>
            <div className="text-2xs text-[var(--muted)]">Target price (USD)</div>
            <Input value={limitPrice} onChange={setLimitPrice} placeholder="0.000001" type="number" />
            <button onClick={addOrder} className="btn-primary w-full">
              Place Limit Order
            </button>
            <p className="text-2xs text-[var(--muted)]">
              Limit orders are client-side; deploy the worker for persistent execution via Jupiter Trigger API.
            </p>
          </>
        )}
        {status && <div className="text-2xs text-[var(--muted)] break-all">{status}</div>}
      </div>

      {tab === "limit" && orders.length > 0 && (
        <div className="surface !p-0 divide-y divide-[var(--border)]">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <div className="text-xs text-[var(--txt)]">{o.mint.slice(0, 6)}… @ ${o.targetPriceUsd}</div>
                <div className="text-2xs text-[var(--muted)]">{o.amountSol} SOL</div>
              </div>
              <button onClick={() => cancelOrder(o.id)} className="text-danger text-2xs">Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  return <Suspense fallback={<div className="p-4 text-xs text-[var(--muted)]">Loading…</div>}><TradeInner /></Suspense>;
}
