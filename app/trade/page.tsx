"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { SOL_MINT, buildSwapTransaction } from "@/lib/jupiter";
import clsx from "clsx";

interface LimitOrder {
  id: string;
  mint: string;
  side: "buy" | "sell";
  targetPriceUsd: number;
  amountSol: number;
  createdAt: number;
}

function TradePageInner() {
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
    setQuoting(true);
    setStatus(null);
    try {
      const lamports = Math.floor(Number(amountSol) * 1e9);
      const res = await fetch(
        `/api/quote?inputMint=${SOL_MINT}&outputMint=${mint}&amount=${lamports}&slippageBps=${slippageBps}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuote(data);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setQuoting(false);
    }
  };

  const executeSwap = async () => {
    if (!publicKey || !signTransaction || !quote) return;
    setStatus("Building transaction…");
    try {
      const swapTxB64 = await buildSwapTransaction(quote, publicKey.toBase58());
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxB64, "base64"));
      const signed = await signTransaction(tx);
      setStatus("Sending transaction…");
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`Confirmed: ${sig}`);
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    }
  };

  const addLimitOrder = () => {
    if (!mint || !limitPrice || !amountSol) return;
    const order: LimitOrder = {
      id: crypto.randomUUID(),
      mint,
      side: "buy",
      targetPriceUsd: Number(limitPrice),
      amountSol: Number(amountSol),
      createdAt: Date.now(),
    };
    const next = [order, ...orders];
    setOrders(next);
    window.localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
    setLimitPrice("");
  };

  const cancelOrder = (id: string) => {
    const next = orders.filter((o) => o.id !== id);
    setOrders(next);
    window.localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trade</h1>
        <WalletMultiButton style={{ height: 36, fontSize: 12 }} />
      </div>

      <div className="flex gap-2 bg-surface2 rounded-xl2 p-1">
        {(["spot", "limit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "flex-1 py-2 rounded-xl text-sm font-medium capitalize",
              tab === t ? "bg-accent text-black" : "text-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card space-y-3">
        <label className="block text-xs text-muted">Token mint address</label>
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Paste mint address"
          className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
        />

        <label className="block text-xs text-muted">Amount (SOL)</label>
        <input
          value={amountSol}
          onChange={(e) => setAmountSol(e.target.value)}
          type="number"
          step="0.01"
          className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
        />

        {tab === "spot" && (
          <>
            <label className="block text-xs text-muted">Slippage (bps)</label>
            <input
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              type="number"
              className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button onClick={fetchQuote} className="w-full border border-border rounded-xl py-2 text-sm">
              {quoting ? "Getting quote…" : "Get Quote"}
            </button>
            {quote && (
              <div className="text-xs text-muted space-y-1">
                <div>Est. output: {Number(quote.outAmount) / 1e6} tokens (raw units, check decimals)</div>
                <div>Price impact: {quote.priceImpactPct?.toFixed(2)}%</div>
              </div>
            )}
            {!connected ? (
              <div className="text-xs text-muted text-center">Connect your wallet to sign the swap.</div>
            ) : (
              <button
                onClick={executeSwap}
                disabled={!quote}
                className="w-full bg-accent text-black font-semibold rounded-xl2 py-3 disabled:opacity-40"
              >
                Confirm Swap
              </button>
            )}
            {status && <div className="text-xs text-muted break-all">{status}</div>}
          </>
        )}

        {tab === "limit" && (
          <>
            <label className="block text-xs text-muted">Target price (USD)</label>
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              type="number"
              step="0.0000001"
              className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button onClick={addLimitOrder} className="w-full bg-accent text-black font-semibold rounded-xl2 py-3">
              Place Limit Order
            </button>
            <p className="text-xs text-muted">
              Limit orders here are watched client-side for demo purposes. For real limit orders that fire even
              when the app is closed, wire this up to Jupiter's Trigger API from the worker service.
            </p>
          </>
        )}
      </div>

      {tab === "limit" && orders.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm text-muted">Open orders</h2>
          {orders.map((o) => (
            <div key={o.id} className="card flex justify-between items-center">
              <div className="text-sm">
                <div>{o.mint.slice(0, 6)}… @ ${o.targetPriceUsd}</div>
                <div className="text-xs text-muted">{o.amountSol} SOL</div>
              </div>
              <button onClick={() => cancelOrder(o.id)} className="text-danger text-xs">
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted text-sm">Loading…</div>}>
      <TradePageInner />
    </Suspense>
  );
}
