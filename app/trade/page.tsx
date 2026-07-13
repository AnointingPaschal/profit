"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import { formatTokenPrice, formatUsd } from "@/lib/format";
import { SOL_MINT, getQuote, buildSwapTransaction } from "@/lib/jupiter";
import { AnalysisResult, TokenAnalysisInput } from "@/app/api/ai-analyze/route";
import clsx from "clsx";
import {
  Minus, Plus, ChevronDown, Zap, Hand,
  BrainCircuit, ShieldAlert, TrendingUp, TrendingDown,
  Minus as MinusIcon, AlertCircle, Lock,
} from "lucide-react";

// ── AI models the user can pick ──
const AI_MODELS = [
  { id: "openai/gpt-4o",                          label: "GPT-4o" },
  { id: "qwen/qwen3-235b-a22b",                   label: "Qwen3 235B" },
  { id: "qwen/qwen3-coder",                        label: "Qwen3 Coder" },
];

type Side      = "buy" | "sell";
type OrderType = "limit" | "market";
type Mode      = "manual" | "auto";

// ── Simulated order-book level ──
interface Level { price: number; amount: number }

function generateBook(mid: number, count = 7): { asks: Level[]; bids: Level[] } {
  if (!mid || mid === 0) return { asks: [], bids: [] };
  const asks: Level[] = [];
  const bids: Level[] = [];
  for (let i = 1; i <= count; i++) {
    asks.unshift({ price: mid * (1 + i * 0.0015), amount: +(Math.random() * 800 + 50).toFixed(2) });
    bids.push({    price: mid * (1 - i * 0.0015), amount: +(Math.random() * 800 + 50).toFixed(2) });
  }
  return { asks, bids };
}

// ── Wallet-gate component ──
function WalletGate() {
  const router = useRouter();
  return (
    <div className="mx-3 mt-4 surface space-y-3 text-center">
      <Lock size={28} className="mx-auto text-[var(--muted)]" />
      <div className="text-sm font-semibold text-[var(--txt)]">Wallet required to trade</div>
      <p className="text-2xs text-[var(--muted)]">
        Create or import a Solana wallet first. Your key stays on this device — nothing is sent to a server.
      </p>
      <button onClick={() => router.push("/wallet")} className="btn-primary w-full">
        Set up wallet
      </button>
    </div>
  );
}

// ── Order-book column ──
function Book({ asks, bids, mid }: { asks: Level[]; bids: Level[]; mid: number }) {
  return (
    <div className="flex flex-col h-full text-2xs">
      <div className="flex justify-between px-1 pb-1 text-[var(--muted)] font-medium">
        <span>Price (SOL)</span><span>Amount</span>
      </div>
      {/* Asks — red, reversed (lowest ask at bottom) */}
      {asks.slice().reverse().map((l, i) => (
        <div key={`a${i}`} className="flex justify-between px-1 py-0.5 relative">
          <div className="absolute inset-0 opacity-10 bg-danger"
            style={{ width: `${Math.min(100, (l.amount / 1000) * 100)}%` }} />
          <span className="text-danger font-mono">{formatTokenPrice(l.price).replace("$","")}</span>
          <span className="text-[var(--sub)]">{l.amount.toFixed(0)}</span>
        </div>
      ))}
      {/* Current price */}
      <div className="text-center py-1.5 border-y border-[var(--border)] my-1">
        <div className="text-sm font-bold text-accent">{formatTokenPrice(mid).replace("$","")}</div>
        <div className="text-2xs text-[var(--muted)]">{formatUsd(mid)}</div>
      </div>
      {/* Bids — green */}
      {bids.map((l, i) => (
        <div key={`b${i}`} className="flex justify-between px-1 py-0.5 relative">
          <div className="absolute inset-0 opacity-10 bg-accent"
            style={{ width: `${Math.min(100, (l.amount / 1000) * 100)}%` }} />
          <span className="text-accent font-mono">{formatTokenPrice(l.price).replace("$","")}</span>
          <span className="text-[var(--sub)]">{l.amount.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

// ── AI Analysis panel ──
function AIPanel({ token, price }: { token: string; price: number }) {
  const [model,    setModel]    = useState(AI_MODELS[0].id);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const analyse = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const tokenInput: Partial<TokenAnalysisInput> = {
        symbol: token || "UNKNOWN", name: token, price,
        marketCap: 0, liquidity: 0, mintRenounced: false,
        freezeRenounced: false, lpLockedPct: 0, top10HolderPct: 0,
      };
      const res  = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, token: tokenInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="surface space-y-2.5">
      <div className="flex items-center gap-2">
        <BrainCircuit size={15} className="text-accent" />
        <span className="text-xs font-semibold text-[var(--txt)]">AI Analysis</span>
      </div>

      {/* Model selector */}
      <div className="flex gap-1.5 flex-wrap">
        {AI_MODELS.map(m => (
          <button key={m.id} onClick={() => setModel(m.id)}
            className={clsx("text-2xs px-2 py-1 rounded-lg font-medium",
              model === m.id ? "bg-accent text-white" : "bg-[var(--card2)] text-[var(--muted)]")}>
            {m.label}
          </button>
        ))}
      </div>

      <button onClick={analyse} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? "Analysing…" : "Analyse token"}
      </button>

      {error && (
        <div className="flex gap-2 items-start text-danger text-2xs">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Decision badge */}
          <div className="flex items-center justify-between">
            <span className={clsx("text-sm font-bold px-3 py-1 rounded-full",
              result.decision === "BUY"  ? "bg-accent/10 text-accent" :
              result.decision === "SELL" ? "bg-danger/10 text-danger" :
                                           "bg-warn/10 text-warn")}>
              {result.decision}
            </span>
            <div className="text-right">
              <div className="text-2xs text-[var(--muted)]">Confidence</div>
              <div className="text-xs font-bold text-[var(--txt)]">{result.confidence}%</div>
            </div>
            <div className="text-right">
              <div className="text-2xs text-[var(--muted)]">Risk</div>
              <div className={clsx("text-xs font-bold",
                result.riskLevel === "EXTREME" ? "text-danger" :
                result.riskLevel === "HIGH"    ? "text-warn"   : "text-accent")}>
                {result.riskLevel}
              </div>
            </div>
          </div>

          <p className="text-2xs text-[var(--sub)] leading-relaxed">{result.reasoning}</p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "Entry",  v: formatTokenPrice(result.entryPrice)  },
              { l: "Target", v: formatTokenPrice(result.targetPrice) },
              { l: "SL",     v: formatTokenPrice(result.stopLoss)    },
            ].map(r => (
              <div key={r.l} className="bg-[var(--card2)] rounded-xl p-2 text-center">
                <div className="text-2xs text-[var(--muted)]">{r.l}</div>
                <div className="text-2xs font-semibold text-[var(--txt)] mt-0.5">{r.v}</div>
              </div>
            ))}
          </div>

          {/* Signals */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {result.signals.bullish.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-start gap-1 text-2xs text-accent">
                  <TrendingUp size={10} className="shrink-0 mt-0.5" /> {s}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {result.signals.bearish.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-start gap-1 text-2xs text-danger">
                  <TrendingDown size={10} className="shrink-0 mt-0.5" /> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Strategy panel ──
function StrategyPanel({ config }: { config: any }) {
  if (!config) return null;
  return (
    <div className="surface space-y-2">
      <span className="text-xs font-semibold text-[var(--txt)]">Active Strategy: {config.name}</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Row l="Stop Loss"  v={`-${config.exit?.stopLossPct ?? 25}%`}  c="text-danger" />
        <Row l="TP levels"  v={(config.exit?.takeProfitLevels ?? []).map((n: number) => `+${n}%`).join(", ")} c="text-accent" />
        <Row l="Trailing"   v={`${config.exit?.trailingStopPct ?? 25}%`} />
        <Row l="Max hold"   v={`${config.exit?.maxHoldMinutes ?? 180}m`} />
        <Row l="Buy size"   v={`${config.risk?.buyAmountSol ?? 0.05} SOL`} />
        <Row l="Slippage"   v={`${config.risk?.maxSlippageBps ?? 1000} bps`} />
      </div>
    </div>
  );
}
function Row({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs text-[var(--muted)]">{l}</span>
      <span className={clsx("text-2xs font-medium", c ?? "text-[var(--txt)]")}>{v}</span>
    </div>
  );
}

// ── Main inner component (needs useSearchParams) ──
function TradeInner() {
  const search = useSearchParams();
  const { vault, isUnlocked, unlock, getKeypair } = useLocalWallet();

  const [mode,       setMode]      = useState<Mode>("manual");
  const [side,       setSide]      = useState<Side>("buy");
  const [orderType,  setOrderType] = useState<OrderType>("limit");
  const [mint,       setMint]      = useState(search.get("mint") ?? "");
  const [price,      setPrice]     = useState("");
  const [qty,        setQty]       = useState("");
  const [sliderPct,  setSliderPct] = useState(0);
  const [tpsl,       setTpsl]      = useState(false);
  const [tp,         setTp]        = useState("");
  const [sl,         setSl]        = useState("");
  const [status,     setStatus]    = useState<string | null>(null);
  const [sending,    setSending]   = useState(false);
  const [unlockPwd,  setUnlockPwd] = useState("");
  const [unlockErr,  setUnlockErr] = useState<string | null>(null);
  const [curPrice,   setCurPrice]  = useState(0);
  const [solBal,     setSolBal]    = useState(0);
  const [config,     setConfig]    = useState<any>(null);
  const [book,       setBook]      = useState<{ asks: Level[]; bids: Level[] }>({ asks: [], bids: [] });
  const [orderTab,   setOrderTab]  = useState<"orders" | "positions" | "strategies">("orders");
  const [limitPrice, setLimitPrice] = useState("");
  const [orders,     setOrders]    = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("profit.config.v1");
    if (raw) setConfig(JSON.parse(raw));
    const ord = localStorage.getItem("profit.limitOrders.v1");
    if (ord) setOrders(JSON.parse(ord));
  }, []);

  // Fetch live price when mint is set
  useEffect(() => {
    if (!mint) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/token/${mint}`);
        const d   = await res.json();
        if (d.pair?.priceUsd) {
          const p = Number(d.pair.priceUsd);
          setCurPrice(p);
          setBook(generateBook(p));
          if (!price) setPrice(p.toFixed(10).replace(/\.?0+$/, ""));
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [mint]);

  // Fetch SOL balance when wallet available
  useEffect(() => {
    if (!vault) return;
    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpc, "confirmed");
    conn.getBalance(new PublicKey(vault.publicKey))
      .then(b => setSolBal(b / 1e9))
      .catch(() => {});
  }, [vault]);

  const total = (Number(price) || curPrice) * Number(qty || 0);

  const handleSlider = (pct: number) => {
    setSliderPct(pct);
    if (side === "buy" && solBal > 0) {
      const solAmount = (solBal * pct) / 100;
      const p = Number(price) || curPrice;
      if (p > 0) setQty((solAmount / p).toFixed(4));
    }
  };

  const handleUnlock = async () => {
    setUnlockErr(null);
    const ok = await unlock(unlockPwd);
    if (!ok) setUnlockErr("Incorrect password.");
    setUnlockPwd("");
  };

  const addLimitOrder = () => {
    if (!mint || !limitPrice || !qty) return;
    const o = { id: crypto.randomUUID(), mint, side, targetPriceUsd: Number(limitPrice), qty: Number(qty), createdAt: Date.now() };
    const next = [o, ...orders];
    setOrders(next);
    localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
    setStatus("Limit order placed");
  };

  const cancelOrder = (id: string) => {
    const next = orders.filter((o: any) => o.id !== id);
    setOrders(next);
    localStorage.setItem("profit.limitOrders.v1", JSON.stringify(next));
  };

  const execute = async () => {
    if (!isUnlocked) return;
    const kp = getKeypair();
    if (!kp) return;
    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpc, "confirmed");

    setSending(true);
    setStatus("Getting quote…");
    try {
      const lamports = Math.floor(Number(qty) * (Number(price) || curPrice) * 1e9);
      const inputMint  = side === "buy" ? SOL_MINT : mint;
      const outputMint = side === "buy" ? mint      : SOL_MINT;
      const q = await getQuote(inputMint, outputMint, lamports, 1000);
      if (!q) throw new Error("No route found");

      setStatus("Building transaction…");
      const b64 = await buildSwapTransaction(q, kp.publicKey.toBase58());
      const { VersionedTransaction } = await import("@solana/web3.js");
      const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
      tx.sign([kp]);
      setStatus("Sending…");
      const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
      await conn.confirmTransaction(sig, "confirmed");
      setStatus(`Done! ${sig.slice(0, 12)}…`);
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  // ── Render ──
  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-[var(--txt)]">
            {mint ? mint.slice(0, 4).toUpperCase() : "TOKEN"}/SOL
          </div>
          {curPrice > 0 && (
            <span className="text-2xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-full font-semibold">
              {formatTokenPrice(curPrice)}
            </span>
          )}
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1 bg-[var(--card2)] rounded-full p-0.5">
          {(["manual", "auto"] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold",
                mode === m ? "bg-accent text-white" : "text-[var(--muted)]")}>
              {m === "auto" ? <Zap size={10} /> : <Hand size={10} />}
              {m === "auto" ? "Auto" : "Manual"}
            </button>
          ))}
        </div>
      </div>

      {/* Mint address input */}
      <div className="px-3 pb-2">
        <input
          value={mint}
          onChange={e => setMint(e.target.value)}
          placeholder="Paste token mint address…"
          className="w-full text-xs rounded-xl px-3 py-2 outline-none text-[var(--txt)]"
          style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
        />
      </div>

      {/* AI panel in auto mode */}
      {mode === "auto" && (
        <div className="px-3 mb-3">
          <AIPanel token={mint} price={curPrice} />
        </div>
      )}

      {/* Main split: form + order book */}
      <div className="grid grid-cols-2 gap-0 px-3">

        {/* ── LEFT: Order form ── */}
        <div className="pr-2 space-y-2">
          {/* Buy / Sell */}
          <div className="grid grid-cols-2 gap-1 bg-[var(--card2)] rounded-xl p-0.5">
            {(["buy", "sell"] as Side[]).map(s => (
              <button key={s} onClick={() => setSide(s)}
                className={clsx("py-2 rounded-lg text-xs font-bold capitalize",
                  side === s
                    ? s === "buy" ? "bg-accent text-white" : "bg-danger text-white"
                    : "text-[var(--muted)]")}>
                {s}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div className="flex items-center justify-between rounded-xl px-2.5 py-2"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <span className="text-2xs text-[var(--muted)]">Order type</span>
            <select value={orderType} onChange={e => setOrderType(e.target.value as OrderType)}
              className="text-2xs font-semibold text-[var(--txt)] bg-transparent outline-none">
              <option value="limit">Limit</option>
              <option value="market">Market</option>
            </select>
          </div>

          {/* Price */}
          {orderType === "limit" && (
            <div className="rounded-xl px-2.5 py-2 space-y-0.5"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-2xs text-[var(--muted)]">Price (SOL)</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPrice(p => String(Math.max(0, Number(p) * 0.999).toFixed(10).replace(/\.?0+$/, "")))}
                  className="text-[var(--muted)]"><Minus size={12} /></button>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number"
                  className="flex-1 text-xs font-semibold text-[var(--txt)] bg-transparent outline-none text-center min-w-0"
                  placeholder={formatTokenPrice(curPrice)} />
                <button onClick={() => setPrice(p => String((Number(p) * 1.001).toFixed(10).replace(/\.?0+$/, "")))}
                  className="text-[var(--muted)]"><Plus size={12} /></button>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="rounded-xl px-2.5 py-2 space-y-0.5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-2xs text-[var(--muted)]">Quantity</div>
            <div className="flex items-center gap-1">
              <button onClick={() => setQty(q => String(Math.max(0, Number(q) - 1)))}
                className="text-[var(--muted)]"><Minus size={12} /></button>
              <input value={qty} onChange={e => setQty(e.target.value)} type="number"
                className="flex-1 text-xs font-semibold text-[var(--txt)] bg-transparent outline-none text-center min-w-0"
                placeholder="0" />
              <button onClick={() => setQty(q => String(Number(q) + 1))}
                className="text-[var(--muted)]"><Plus size={12} /></button>
            </div>
          </div>

          {/* Percentage slider */}
          <div className="space-y-1">
            <input type="range" min={0} max={100} step={25} value={sliderPct}
              onChange={e => handleSlider(Number(e.target.value))}
              className="w-full h-1 accent-[#10B981]" />
            <div className="flex justify-between text-2xs text-[var(--muted)]">
              {[0, 25, 50, 75, 100].map(p => (
                <button key={p} onClick={() => handleSlider(p)}
                  className={sliderPct === p ? "text-accent font-semibold" : ""}>{p}%</button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-xl px-2.5 py-2"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-2xs text-[var(--muted)]">Total (SOL)</div>
            <div className="text-xs font-semibold text-[var(--txt)] mt-0.5">
              {total > 0 ? total.toFixed(6) : "—"}
            </div>
          </div>

          {/* TP/SL */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-2xs text-[var(--txt)] cursor-pointer">
              <input type="checkbox" checked={tpsl} onChange={e => setTpsl(e.target.checked)}
                className="accent-[#10B981]" />
              TP / SL
            </label>
            {tpsl && (
              <div className="grid grid-cols-2 gap-1">
                <input value={tp} onChange={e => setTp(e.target.value)} placeholder="Take Profit"
                  type="number"
                  className="rounded-xl px-2 py-1.5 text-2xs outline-none text-[var(--txt)]"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
                <input value={sl} onChange={e => setSl(e.target.value)} placeholder="Stop Loss"
                  type="number"
                  className="rounded-xl px-2 py-1.5 text-2xs outline-none text-[var(--txt)]"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
              </div>
            )}
          </div>

          {/* Available */}
          <div className="flex justify-between text-2xs">
            <span className="text-[var(--muted)]">Available</span>
            <span className="text-[var(--txt)] font-medium">{solBal.toFixed(4)} SOL</span>
          </div>

          {/* Execute / unlock */}
          {!vault ? (
            <div className="text-2xs text-[var(--muted)] bg-[var(--card2)] rounded-xl p-2 text-center">
              Go to Wallet tab to set up a wallet.
            </div>
          ) : !isUnlocked ? (
            <div className="space-y-1.5">
              <input type="password" value={unlockPwd} onChange={e => setUnlockPwd(e.target.value)}
                placeholder="Password to unlock"
                className="w-full rounded-xl px-2.5 py-1.5 text-xs outline-none text-[var(--txt)]"
                style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
              {unlockErr && <div className="text-danger text-2xs">{unlockErr}</div>}
              <button onClick={handleUnlock}
                className="btn-primary w-full text-white">Unlock wallet</button>
            </div>
          ) : (
            <button
              onClick={orderType === "limit" ? addLimitOrder : execute}
              disabled={sending || !mint || (!qty && orderType !== "limit")}
              className={clsx(
                "w-full py-2.5 rounded-xl2 text-xs font-bold text-white disabled:opacity-40",
                side === "buy" ? "bg-accent" : "bg-danger"
              )}>
              {sending ? "Executing…" :
                orderType === "limit" ? `Place ${side} limit` :
                `${side === "buy" ? "Buy" : "Sell"} ${mint.slice(0, 4).toUpperCase() || "Token"}`
              }
            </button>
          )}

          {status && <div className="text-2xs text-[var(--muted)] break-all">{status}</div>}
        </div>

        {/* ── RIGHT: Order book ── */}
        <div className="pl-2" style={{ borderLeft: "1px solid var(--border)" }}>
          <Book asks={book.asks} bids={book.bids} mid={curPrice} />
        </div>
      </div>

      {/* ── Strategy info ── */}
      {mode === "auto" && (
        <div className="px-3 mt-3">
          <StrategyPanel config={config} />
        </div>
      )}

      {/* ── Bottom order tabs ── */}
      <div className="px-3 mt-4">
        <div className="flex border-b border-[var(--border)] mb-2">
          {(["orders", "positions", "strategies"] as const).map(t => (
            <button key={t} onClick={() => setOrderTab(t)}
              className={clsx("text-xs pb-2 mr-4 capitalize font-medium",
                orderTab === t
                  ? "text-accent border-b-2 border-accent"
                  : "text-[var(--muted)]")}>
              {t === "orders" ? `Open Orders (${orders.length})` :
               t === "positions" ? "Positions (0)" : "Strategies (0)"}
            </button>
          ))}
        </div>

        {orderTab === "orders" && (
          orders.length === 0
            ? <div className="text-center py-6 text-xs text-[var(--muted)]">No open orders.</div>
            : <div className="space-y-1.5">
                {orders.map((o: any) => (
                  <div key={o.id} className="surface flex items-center justify-between !py-2">
                    <div>
                      <span className={clsx("text-2xs font-semibold",
                        o.side === "buy" ? "text-accent" : "text-danger")}>{o.side.toUpperCase()}</span>
                      <span className="text-2xs text-[var(--muted)] ml-2">@ {formatTokenPrice(o.targetPriceUsd)}</span>
                      <span className="text-2xs text-[var(--muted)] ml-2">{o.qty} tokens</span>
                    </div>
                    <button onClick={() => cancelOrder(o.id)} className="text-danger text-2xs">Cancel</button>
                  </div>
                ))}
              </div>
        )}

        {orderTab === "positions" && (
          <div className="text-center py-6 text-xs text-[var(--muted)]">No open positions.</div>
        )}

        {orderTab === "strategies" && (
          <StrategyPanel config={config} />
        )}
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-[var(--muted)]">Loading…</div>}>
      <TradeInner />
    </Suspense>
  );
}
