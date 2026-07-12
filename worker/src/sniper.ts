import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "./config";
import { findCandidates } from "./scanner";
import { assessRisk } from "./rugCheck";
import { buyToken, sellToken, getQuote } from "./jupiter";
import { openPosition, evaluateExit, applySell } from "./positionManager";
import { Position } from "./types";

const positions = new Map<string, Position>();
const seenMints = new Set<string>(); // avoid re-buying the same token repeatedly

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadWallet(): Keypair {
  if (config.dryRun && !config.walletPrivateKey) {
    // Dry run can use an ephemeral throwaway keypair since nothing is actually sent.
    return Keypair.generate();
  }
  const secret = bs58.decode(config.walletPrivateKey);
  return Keypair.fromSecretKey(secret);
}

async function scanAndBuy(connection: Connection, wallet: Keypair) {
  if (positions.size >= config.risk.maxConcurrentPositions) {
    log(`At max concurrent positions (${positions.size}), skipping scan.`);
    return;
  }

  const candidates = await findCandidates();
  log(`Scanner found ${candidates.length} candidate pair(s) passing size/age/volume filters.`);

  for (const pair of candidates) {
    if (positions.size >= config.risk.maxConcurrentPositions) break;
    const mint = pair.baseToken.address;
    if (seenMints.has(mint)) continue;
    seenMints.add(mint);

    const risk = await assessRisk(connection, mint);
    if (risk.isRisky) {
      log(`SKIP ${pair.baseToken.symbol} (${mint}): ${risk.reasons.join("; ")}`);
      continue;
    }

    log(`Candidate passed rug checks: ${pair.baseToken.symbol} (${mint}). Buying...`);
    const result = await buyToken(connection, wallet, mint, config.risk.buyAmountSol);
    if (!result.success) {
      log(`BUY FAILED for ${pair.baseToken.symbol}: ${result.error}`);
      continue;
    }

    const entryPriceUsd = Number(pair.priceUsd ?? 0);
    const amountTokens = Number(result.quote?.outAmount ?? 0);
    const position = openPosition(mint, pair.baseToken.symbol, entryPriceUsd, amountTokens, config.risk.buyAmountSol);
    positions.set(mint, position);
    log(
      `BOUGHT ${pair.baseToken.symbol}: ${config.risk.buyAmountSol} SOL @ $${entryPriceUsd} ` +
        `(sig: ${result.signature}${config.dryRun ? " — dry run" : ""})`
    );
  }
}

async function monitorPositions(connection: Connection, wallet: Keypair) {
  for (const [mint, position] of positions.entries()) {
    if (position.remainingPct <= 0) {
      positions.delete(mint);
      continue;
    }

    // Get current price via a tiny reverse quote (token -> SOL) as a proxy for spot price.
    const priceQuote = await getQuote(mint, config.solMint, 1_000_000, 100);
    if (!priceQuote) continue;
    // NOTE: for a production bot, pull priceUsd from DexScreener/Birdeye instead — deriving
    // USD price from a raw Jupiter quote requires decimals + SOL/USD conversion, omitted
    // here for brevity. Wire this up before going live.
    const currentPriceUsd = position.entryPriceUsd; // placeholder — replace with live price feed

    const action = evaluateExit(position, currentPriceUsd);
    if (action.type === "none") continue;

    const tokensToSell = Math.floor(position.amountTokens * (action.sellPct / 100));
    log(`${action.type.toUpperCase()} triggered for ${position.symbol}: selling ${action.sellPct}%`);

    const result = await sellToken(connection, wallet, mint, tokensToSell);
    if (!result.success) {
      log(`SELL FAILED for ${position.symbol}: ${result.error}`);
      continue;
    }
    applySell(position, action.sellPct);
    log(`SOLD ${action.sellPct}% of ${position.symbol} (sig: ${result.signature})`);
  }
}

export async function runSniperLoop() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const wallet = loadWallet();

  log(`Sniper starting. DRY_RUN=${config.dryRun}. Wallet: ${wallet.publicKey.toBase58()}`);
  if (config.dryRun) {
    log("Running in DRY RUN mode — no real transactions will be sent.");
  }

  setInterval(() => scanAndBuy(connection, wallet).catch((e) => log(`scan error: ${e.message}`)), 15_000);
  setInterval(() => monitorPositions(connection, wallet).catch((e) => log(`monitor error: ${e.message}`)), 10_000);
}
