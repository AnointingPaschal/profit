import fetch from "node-fetch";
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import { config } from "./config";

/**
 * Jupiter integration using the free, rate-limited "lite-api" tier — fine for testing
 * and low volume. For real trading volume, get an API key at https://dev.jup.ag and
 * switch JUPITER_BASE to https://api.jup.ag with an `x-api-key` header, since endpoints
 * and rate limits have shifted more than once (Metis -> Swap V2 -> current). Re-check
 * https://dev.jup.ag/docs before relying on this in production.
 */
const JUPITER_BASE = "https://lite-api.jup.ag";

export interface QuoteResult {
  raw: any;
  outAmount: string;
  priceImpactPct: number;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamportsOrTokens: number,
  slippageBps: number
): Promise<QuoteResult | null> {
  const url =
    `${JUPITER_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amountLamportsOrTokens}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const raw = await res.json() as any;
  if (!raw || !raw.outAmount) return null;
  return {
    raw,
    outAmount: raw.outAmount,
    priceImpactPct: Number(raw.priceImpactPct ?? 0) * 100,
  };
}

/** Builds, signs, and sends a swap transaction. In dry-run mode it stops before sending. */
export async function executeSwap(
  connection: Connection,
  wallet: Keypair,
  quote: QuoteResult
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const swapRes = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote.raw,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: config.risk.priorityFeeLamports,
        dynamicComputeUnitLimit: true,
      }),
    });
    if (!swapRes.ok) {
      return { success: false, error: `swap build failed: ${swapRes.status}` };
    }
    const { swapTransaction } = (await swapRes.json()) as { swapTransaction: string };

    if (config.dryRun) {
      return { success: true, signature: "DRY_RUN_NO_TX" };
    }

    const txBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      return { success: false, error: JSON.stringify(confirmation.value.err) };
    }
    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

export async function buyToken(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  solAmount: number
) {
  const lamports = Math.floor(solAmount * 1e9);
  const quote = await getQuote(config.solMint, tokenMint, lamports, config.risk.maxSlippageBps);
  if (!quote) return { success: false as const, error: "no route found" };
  if (quote.priceImpactPct > 15) {
    return { success: false as const, error: `price impact too high (${quote.priceImpactPct.toFixed(1)}%)` };
  }
  const result = await executeSwap(connection, wallet, quote);
  return { ...result, quote };
}

export async function sellToken(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  tokenAmountRaw: number
) {
  const quote = await getQuote(tokenMint, config.solMint, tokenAmountRaw, config.risk.maxSlippageBps);
  if (!quote) return { success: false as const, error: "no route found" };
  const result = await executeSwap(connection, wallet, quote);
  return { ...result, quote };
}
