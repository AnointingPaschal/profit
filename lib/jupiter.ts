const JUPITER_BASE = "https://lite-api.jup.ag";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface QuoteResult {
  raw: any;
  outAmount: string;
  priceImpactPct: number;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<QuoteResult | null> {
  const url =
    `${JUPITER_BASE}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount}&slippageBps=${slippageBps}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const raw = await res.json();
  if (!raw?.outAmount) return null;
  return { raw, outAmount: raw.outAmount, priceImpactPct: Number(raw.priceImpactPct ?? 0) * 100 };
}

/** Builds an unsigned swap transaction for the connected wallet to sign client-side. */
export async function buildSwapTransaction(quote: QuoteResult, userPublicKey: string) {
  const res = await fetch(`${JUPITER_BASE}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote.raw,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!res.ok) throw new Error(`swap build failed: ${res.status}`);
  const { swapTransaction } = await res.json();
  return swapTransaction as string; // base64-encoded VersionedTransaction
}
