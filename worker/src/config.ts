import * as dotenv from "dotenv";
dotenv.config();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}
function list(name: string, fallback: number[]): number[] {
  const v = process.env[name];
  return v ? v.split(",").map((x) => Number(x.trim())) : fallback;
}

export const config = {
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY || "",
  rpcUrl: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
  dryRun: (process.env.DRY_RUN ?? "true").toLowerCase() !== "false",

  discovery: {
    minLiquidityUsd: num("MIN_LIQUIDITY_USD", 3000),
    maxMarketCapUsd: num("MAX_MARKET_CAP_USD", 150000),
    minTokenAgeMinutes: num("MIN_TOKEN_AGE_MINUTES", 2),
    maxTokenAgeMinutes: num("MAX_TOKEN_AGE_MINUTES", 180),
    min5mVolumeUsd: num("MIN_5M_VOLUME_USD", 1000),
  },

  risk: {
    buyAmountSol: num("BUY_AMOUNT_SOL", 0.05),
    maxConcurrentPositions: num("MAX_CONCURRENT_POSITIONS", 3),
    maxSlippageBps: num("MAX_SLIPPAGE_BPS", 1500),
    priorityFeeLamports: num("PRIORITY_FEE_LAMPORTS", 200000),
  },

  exit: {
    takeProfitLevels: list("TAKE_PROFIT_LEVELS", [100, 300, 900]), // % gain
    takeProfitSellPcts: list("TAKE_PROFIT_SELL_PCTS", [40, 30, 30]), // % of remaining position sold
    stopLossPct: num("STOP_LOSS_PCT", 35), // % loss from entry
    trailingStopActivatePct: num("TRAILING_STOP_ACTIVATE_PCT", 80), // gain % before trailing stop arms
    trailingStopPct: num("TRAILING_STOP_PCT", 25), // % pullback from peak that triggers sell
    maxHoldMinutes: num("MAX_HOLD_MINUTES", 180),
  },

  rugcheckBaseUrl: process.env.RUGCHECK_BASE_URL || "https://api.rugcheck.xyz/v1",

  solMint: "So11111111111111111111111111111111111111112",
};

export function validateConfig() {
  const problems: string[] = [];
  if (!config.dryRun && !config.walletPrivateKey) {
    problems.push("WALLET_PRIVATE_KEY is required when DRY_RUN=false");
  }
  if (config.exit.takeProfitLevels.length !== config.exit.takeProfitSellPcts.length) {
    problems.push("TAKE_PROFIT_LEVELS and TAKE_PROFIT_SELL_PCTS must be the same length");
  }
  if (problems.length) {
    throw new Error("Config errors:\n- " + problems.join("\n- "));
  }
}
