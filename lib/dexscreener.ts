import { DexPair } from "./types";

// DexScreener's free endpoints change periodically — recheck
// https://docs.dexscreener.com/api/reference before relying on this in production.
const BASE = "https://api.dexscreener.com";

export async function fetchBoostedSolanaTokens(): Promise<string[]> {
  const res = await fetch(`${BASE}/token-boosts/latest/v1`, { next: { revalidate: 15 } });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.data ?? [];
  return items.filter((t: any) => t.chainId === "solana").map((t: any) => t.tokenAddress);
}

export async function fetchPairsForTokens(addresses: string[]): Promise<DexPair[]> {
  if (addresses.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

  const all: DexPair[] = [];
  for (const chunk of chunks) {
    const res = await fetch(`${BASE}/tokens/v1/solana/${chunk.join(",")}`, { next: { revalidate: 10 } });
    if (!res.ok) continue;
    const pairs = await res.json();
    if (Array.isArray(pairs)) all.push(...pairs);
  }
  return all;
}

export async function searchSolanaPairs(query: string): Promise<DexPair[]> {
  const res = await fetch(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`, {
    next: { revalidate: 15 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const pairs: DexPair[] = data?.pairs ?? [];
  return pairs.filter((p) => p.chainId === "solana");
}

export async function fetchPairByMint(mint: string): Promise<DexPair | null> {
  const pairs = await fetchPairsForTokens([mint]);
  if (pairs.length === 0) return null;
  // Prefer the pair with the highest liquidity if multiple pools exist.
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}
