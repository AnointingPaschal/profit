"use client";

import { useEffect, useState } from "react";
import { StrategyConfig } from "@/lib/types";
import { PRESETS, DEGEN } from "@/lib/presets";
import { store } from "@/lib/store";
import clsx from "clsx";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<StrategyConfig>(DEGEN);
  const [killSwitch, setKillSwitchState] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCfg(store.getConfig());
    setKillSwitchState(store.getKillSwitch());
  }, []);

  const save = () => {
    store.setConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const applyPreset = (name: string) => {
    setCfg({ ...PRESETS[name] });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Config</h1>

      <div className="card space-y-2">
        <span className="font-medium">Kill Switch</span>
        <p className="text-xs text-muted">Pauses all automated buying. Existing positions still get monitored and sold.</p>
        <button
          onClick={() => {
            const next = !killSwitch;
            setKillSwitchState(next);
            store.setKillSwitch(next);
          }}
          className={clsx(
            "w-full rounded-xl2 py-3 font-semibold",
            killSwitch ? "bg-danger text-white" : "bg-surface2 text-muted"
          )}
        >
          {killSwitch ? "Buying PAUSED — tap to resume" : "Buying active — tap to pause"}
        </button>
      </div>

      <div className="card space-y-2">
        <span className="font-medium">Presets</span>
        <div className="flex gap-2">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className={clsx(
                "flex-1 py-2 rounded-xl text-sm",
                cfg.name === name ? "bg-accent text-black font-semibold" : "bg-surface2 text-muted"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <span className="font-medium">Discovery Filters</span>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min liquidity ($)" value={cfg.discovery.minLiquidityUsd}
            onChange={(v) => setCfg({ ...cfg, discovery: { ...cfg.discovery, minLiquidityUsd: v } })} />
          <NumberField label="Max market cap ($)" value={cfg.discovery.maxMarketCapUsd}
            onChange={(v) => setCfg({ ...cfg, discovery: { ...cfg.discovery, maxMarketCapUsd: v } })} />
          <NumberField label="Min age (min)" value={cfg.discovery.minTokenAgeMinutes}
            onChange={(v) => setCfg({ ...cfg, discovery: { ...cfg.discovery, minTokenAgeMinutes: v } })} />
          <NumberField label="Max age (min)" value={cfg.discovery.maxTokenAgeMinutes}
            onChange={(v) => setCfg({ ...cfg, discovery: { ...cfg.discovery, maxTokenAgeMinutes: v } })} />
          <NumberField label="Min 5m volume ($)" value={cfg.discovery.min5mVolumeUsd}
            onChange={(v) => setCfg({ ...cfg, discovery: { ...cfg.discovery, min5mVolumeUsd: v } })} />
        </div>
      </div>

      <div className="card space-y-3">
        <span className="font-medium">Risk / Position Sizing</span>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Buy amount (SOL)" value={cfg.risk.buyAmountSol}
            onChange={(v) => setCfg({ ...cfg, risk: { ...cfg.risk, buyAmountSol: v } })} />
          <NumberField label="Max concurrent positions" value={cfg.risk.maxConcurrentPositions}
            onChange={(v) => setCfg({ ...cfg, risk: { ...cfg.risk, maxConcurrentPositions: v } })} />
          <NumberField label="Max slippage (bps)" value={cfg.risk.maxSlippageBps}
            onChange={(v) => setCfg({ ...cfg, risk: { ...cfg.risk, maxSlippageBps: v } })} />
          <NumberField label="Priority fee (lamports)" value={cfg.risk.priorityFeeLamports}
            onChange={(v) => setCfg({ ...cfg, risk: { ...cfg.risk, priorityFeeLamports: v } })} />
        </div>
      </div>

      <div className="card space-y-3">
        <span className="font-medium">Exit Strategy</span>
        <NumberField label="Stop loss (%)" value={cfg.exit.stopLossPct}
          onChange={(v) => setCfg({ ...cfg, exit: { ...cfg.exit, stopLossPct: v } })} />
        <div>
          <label className="block text-xs text-muted mb-1">Take-profit levels (% gain, comma separated)</label>
          <input
            value={cfg.exit.takeProfitLevels.join(",")}
            onChange={(e) =>
              setCfg({ ...cfg, exit: { ...cfg.exit, takeProfitLevels: e.target.value.split(",").map(Number) } })
            }
            className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Sell % per level (comma separated)</label>
          <input
            value={cfg.exit.takeProfitSellPcts.join(",")}
            onChange={(e) =>
              setCfg({ ...cfg, exit: { ...cfg.exit, takeProfitSellPcts: e.target.value.split(",").map(Number) } })
            }
            className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Trailing stop activate (%)" value={cfg.exit.trailingStopActivatePct}
            onChange={(v) => setCfg({ ...cfg, exit: { ...cfg.exit, trailingStopActivatePct: v } })} />
          <NumberField label="Trailing stop (%)" value={cfg.exit.trailingStopPct}
            onChange={(v) => setCfg({ ...cfg, exit: { ...cfg.exit, trailingStopPct: v } })} />
        </div>
        <NumberField label="Max hold (minutes)" value={cfg.exit.maxHoldMinutes}
          onChange={(v) => setCfg({ ...cfg, exit: { ...cfg.exit, maxHoldMinutes: v } })} />
      </div>

      <div className="card space-y-3">
        <span className="font-medium">Rug-check Thresholds</span>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min LP locked (%)" value={cfg.rugThresholds.minLpLockedPct}
            onChange={(v) => setCfg({ ...cfg, rugThresholds: { ...cfg.rugThresholds, minLpLockedPct: v } })} />
          <NumberField label="Max top-10 holder (%)" value={cfg.rugThresholds.maxTop10HolderPct}
            onChange={(v) => setCfg({ ...cfg, rugThresholds: { ...cfg.rugThresholds, maxTop10HolderPct: v } })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.rugThresholds.requireMintRenounced}
            onChange={(e) =>
              setCfg({ ...cfg, rugThresholds: { ...cfg.rugThresholds, requireMintRenounced: e.target.checked } })
            }
          />
          Require mint authority renounced
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.rugThresholds.requireFreezeRenounced}
            onChange={(e) =>
              setCfg({ ...cfg, rugThresholds: { ...cfg.rugThresholds, requireFreezeRenounced: e.target.checked } })
            }
          />
          Require freeze authority renounced
        </label>
      </div>

      <button onClick={save} className="w-full bg-accent text-black font-semibold rounded-xl2 py-3">
        {saved ? "Saved ✓" : "Save Config"}
      </button>
    </div>
  );
}
