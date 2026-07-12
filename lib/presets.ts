import { StrategyConfig } from "./types";

export const CONSERVATIVE: StrategyConfig = {
  name: "Conservative",
  discovery: {
    minLiquidityUsd: 8000,
    maxMarketCapUsd: 80000,
    minTokenAgeMinutes: 5,
    maxTokenAgeMinutes: 120,
    min5mVolumeUsd: 2000,
  },
  risk: {
    buyAmountSol: 0.03,
    maxConcurrentPositions: 2,
    maxSlippageBps: 1000,
    priorityFeeLamports: 150000,
  },
  exit: {
    takeProfitLevels: [50, 150, 400],
    takeProfitSellPcts: [50, 30, 20],
    stopLossPct: 25,
    trailingStopActivatePct: 60,
    trailingStopPct: 20,
    maxHoldMinutes: 120,
  },
  rugThresholds: {
    minLpLockedPct: 90,
    maxTop10HolderPct: 20,
    requireMintRenounced: true,
    requireFreezeRenounced: true,
  },
};

export const DEGEN: StrategyConfig = {
  name: "Degen",
  discovery: {
    minLiquidityUsd: 2000,
    maxMarketCapUsd: 200000,
    minTokenAgeMinutes: 1,
    maxTokenAgeMinutes: 60,
    min5mVolumeUsd: 500,
  },
  risk: {
    buyAmountSol: 0.05,
    maxConcurrentPositions: 5,
    maxSlippageBps: 2000,
    priorityFeeLamports: 300000,
  },
  exit: {
    takeProfitLevels: [100, 300, 900],
    takeProfitSellPcts: [40, 30, 30],
    stopLossPct: 35,
    trailingStopActivatePct: 80,
    trailingStopPct: 25,
    maxHoldMinutes: 90,
  },
  rugThresholds: {
    minLpLockedPct: 70,
    maxTop10HolderPct: 30,
    requireMintRenounced: true,
    requireFreezeRenounced: false,
  },
};

export const PRESETS: Record<string, StrategyConfig> = {
  Conservative: CONSERVATIVE,
  Degen: DEGEN,
};
