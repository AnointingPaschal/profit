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
  pairCreatedAt?: number; // unix ms
  volume?: { m5?: number; h1?: number; h24?: number };
  txns?: { m5?: { buys: number; sells: number } };
}

export interface RugReport {
  mintAddress: string;
  score: number; // higher = riskier, per RugCheck convention
  mintAuthorityRenounced: boolean;
  freezeAuthorityRenounced: boolean;
  lpLockedPct: number; // 0-100
  top10HolderPct: number; // 0-100, excluding LP/burn
  isRisky: boolean;
  reasons: string[];
}

export interface Position {
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  entryTimestamp: number;
  amountTokens: number;
  solSpent: number;
  peakPriceUsd: number;
  remainingPct: number; // % of original position still held
  tpLevelsHit: boolean[];
  trailingStopArmed: boolean;
}
