"use client";
import { useEffect, useState } from "react";
import { StrategyConfig } from "@/lib/types";
import { PRESETS, DEGEN } from "@/lib/presets";
import { store } from "@/lib/store";
import clsx from "clsx";

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-2xs text-[var(--muted)] mb-1">{label}</div>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-xl px-3 py-2 text-xs text-[var(--txt)] outline-none"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
    </div>
  );
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<StrategyConfig>(DEGEN);
  const [kill, setKill] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setCfg(store.getConfig()); setKill(store.getKillSwitch()); }, []);

  const save = () => { store.setConfig(cfg); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-base font-bold text-[var(--txt)]">Config</h1>

      {/* Kill switch */}
      <div className="surface space-y-2">
        <div className="text-xs font-semibold text-[var(--txt)]">Kill Switch</div>
        <button onClick={() => { const n = !kill; setKill(n); store.setKillSwitch(n); }}
          className={clsx("w-full rounded-xl2 py-2 text-xs font-semibold", kill ? "bg-danger/10 text-danger border border-danger/30" : "bg-[var(--card2)] text-[var(--sub)]")}
          style={{ border: kill ? undefined : "1px solid var(--border)" }}>
          {kill ? "Buying PAUSED — tap to resume" : "Buying active — tap to pause"}
        </button>
      </div>

      {/* Presets */}
      <div className="surface space-y-2">
        <div className="text-xs font-semibold text-[var(--txt)]">Presets</div>
        <div className="flex gap-2">
          {Object.keys(PRESETS).map(n => (
            <button key={n} onClick={() => setCfg({ ...PRESETS[n] })}
              className={clsx("flex-1 py-1.5 rounded-xl text-xs font-medium",
                cfg.name === n ? "bg-accent text-white" : "bg-[var(--card2)] text-[var(--muted)]")}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Discovery */}
      <div className="surface space-y-2.5">
        <div className="text-xs font-semibold text-[var(--txt)]">Discovery Filters</div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min liquidity ($)" value={cfg.discovery.minLiquidityUsd} onChange={v => setCfg({ ...cfg, discovery: { ...cfg.discovery, minLiquidityUsd: v } })} />
          <Field label="Max market cap ($)" value={cfg.discovery.maxMarketCapUsd} onChange={v => setCfg({ ...cfg, discovery: { ...cfg.discovery, maxMarketCapUsd: v } })} />
          <Field label="Min age (min)" value={cfg.discovery.minTokenAgeMinutes} onChange={v => setCfg({ ...cfg, discovery: { ...cfg.discovery, minTokenAgeMinutes: v } })} />
          <Field label="Max age (min)" value={cfg.discovery.maxTokenAgeMinutes} onChange={v => setCfg({ ...cfg, discovery: { ...cfg.discovery, maxTokenAgeMinutes: v } })} />
          <Field label="Min 5m vol ($)" value={cfg.discovery.min5mVolumeUsd} onChange={v => setCfg({ ...cfg, discovery: { ...cfg.discovery, min5mVolumeUsd: v } })} />
        </div>
      </div>

      {/* Risk */}
      <div className="surface space-y-2.5">
        <div className="text-xs font-semibold text-[var(--txt)]">Risk & Position Sizing</div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Buy amount (SOL)" value={cfg.risk.buyAmountSol} onChange={v => setCfg({ ...cfg, risk: { ...cfg.risk, buyAmountSol: v } })} />
          <Field label="Max positions" value={cfg.risk.maxConcurrentPositions} onChange={v => setCfg({ ...cfg, risk: { ...cfg.risk, maxConcurrentPositions: v } })} />
          <Field label="Max slippage (bps)" value={cfg.risk.maxSlippageBps} onChange={v => setCfg({ ...cfg, risk: { ...cfg.risk, maxSlippageBps: v } })} />
          <Field label="Priority fee (lamports)" value={cfg.risk.priorityFeeLamports} onChange={v => setCfg({ ...cfg, risk: { ...cfg.risk, priorityFeeLamports: v } })} />
        </div>
      </div>

      {/* Exit strategy */}
      <div className="surface space-y-2.5">
        <div className="text-xs font-semibold text-[var(--txt)]">Exit Strategy</div>
        <Field label="Stop loss (%)" value={cfg.exit.stopLossPct} onChange={v => setCfg({ ...cfg, exit: { ...cfg.exit, stopLossPct: v } })} />
        <div>
          <div className="text-2xs text-[var(--muted)] mb-1">Take-profit levels (%, comma separated)</div>
          <input value={cfg.exit.takeProfitLevels.join(",")}
            onChange={e => setCfg({ ...cfg, exit: { ...cfg.exit, takeProfitLevels: e.target.value.split(",").map(Number) } })}
            className="w-full rounded-xl px-3 py-2 text-xs outline-none text-[var(--txt)]"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <div className="text-2xs text-[var(--muted)] mb-1">Sell % per level (comma separated)</div>
          <input value={cfg.exit.takeProfitSellPcts.join(",")}
            onChange={e => setCfg({ ...cfg, exit: { ...cfg.exit, takeProfitSellPcts: e.target.value.split(",").map(Number) } })}
            className="w-full rounded-xl px-3 py-2 text-xs outline-none text-[var(--txt)]"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Trailing activate (%)" value={cfg.exit.trailingStopActivatePct} onChange={v => setCfg({ ...cfg, exit: { ...cfg.exit, trailingStopActivatePct: v } })} />
          <Field label="Trailing stop (%)" value={cfg.exit.trailingStopPct} onChange={v => setCfg({ ...cfg, exit: { ...cfg.exit, trailingStopPct: v } })} />
          <Field label="Max hold (min)" value={cfg.exit.maxHoldMinutes} onChange={v => setCfg({ ...cfg, exit: { ...cfg.exit, maxHoldMinutes: v } })} />
        </div>
      </div>

      <button onClick={save} className="btn-primary w-full">
        {saved ? "Saved ✓" : "Save Config"}
      </button>
    </div>
  );
}
