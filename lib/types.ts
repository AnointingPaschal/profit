export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  volume?: { m5?: number; h1?: number; h24?: number };
  txns?: Record<string, { buys: number; sells: number }>;
  info?: { imageUrl?: string; socials?: { platform: string; handle: string }[] };
}

export interface RugReport {
  mint: string;
  score: number;
  mintAuthorityRenounced: boolean;
  freezeAuthorityRenounced: boolean;
  lpLockedPct: number;
  top10HolderPct: number;
  isRisky: boolean;
  reasons: string[];
  source: "rugcheck" | "onchain-fallback";
}

export type ExitReason = "stop_loss" | "take_profit" | "trailing_stop" | "time_stop" | "manual";

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  entryMarketCap: number;
  entryTimestamp: number;
  amountTokens: number;
  solSpent: number;
  peakPriceUsd: number;
  remainingPct: number;
  tpLevelsHit: boolean[];
  trailingStopArmed: boolean;
  status: "open" | "closed";
  closedReason?: ExitReason;
  realizedPnlUsd?: number;
}

export interface StrategyConfig {
  name: string;
  discovery: {
    minLiquidityUsd: number;
    maxMarketCapUsd: number;
    minTokenAgeMinutes: number;
    maxTokenAgeMinutes: number;
    min5mVolumeUsd: number;
  };
  risk: {
    buyAmountSol: number;
    maxConcurrentPositions: number;
    maxSlippageBps: number;
    priorityFeeLamports: number;
  };
  exit: {
    takeProfitLevels: number[];
    takeProfitSellPcts: number[];
    stopLossPct: number;
    trailingStopActivatePct: number;
    trailingStopPct: number;
    maxHoldMinutes: number;
  };
  rugThresholds: {
    minLpLockedPct: number;
    maxTop10HolderPct: number;
    requireMintRenounced: boolean;
    requireFreezeRenounced: boolean;
  };
}
