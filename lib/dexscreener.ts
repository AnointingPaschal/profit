import { DexPair } from "./types";

const BASE = "https://api.dexscreener.com";

// Terms covering the full market-cap spectrum:
// – Established / high-MC Solana tokens
// – Mid-range DeFi / meme tokens
// – Low-MC newcomers
const SEARCH_QUERIES = [
  // Established / high-MC
  "sol", "bonk", "wif", "jup", "ray", "jto", "pyth", "bome",
  "mew", "popcat", "drift", "wen", "silly", "mobile",
  // Mid-range
  "pump", "meme", "doge", "pepe", "moon", "inu", "based",
  "cat", "dog", "ai", "agent", "gme", "degen", "ape",
  // Low-MC / new launches
  "baby", "mini", "super", "fish", "frog", "bird", "bear",
  "bull", "king", "god", "gem", "chad", "wojak", "dao",
];

async function safeFetch<T>(url: string, revalidate = 15): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

/** All pairs from a token-address batch endpoint */
export async function fetchPairsForTokens(addresses: string[]): Promise<DexPair[]> {
  if (addresses.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

  const results = await Promise.allSettled(
    chunks.map(chunk =>
      safeFetch<DexPair[]>(`${BASE}/tokens/v1/solana/${chunk.join(",")}`, 15)
    )
  );
  const all: DexPair[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) all.push(...r.value);
  }
  return all;
}

/** Fetch from all discovery sources in parallel, deduplicate by mint address (not pool) */
export async function fetchAllSolanaPairs(): Promise<DexPair[]> {
  // 1. Boosted addresses (top + latest)
  const [boostedTop, boostedLatest] = await Promise.all([
    safeFetch<any[]>(`${BASE}/token-boosts/top/v1`, 30),
    safeFetch<any[]>(`${BASE}/token-boosts/latest/v1`, 15),
  ]);
  const boostedAddresses = [
    ...(boostedTop ?? []),
    ...(boostedLatest ?? []),
  ]
    .filter((t: any) => t?.chainId === "solana" && t.tokenAddress)
    .map((t: any) => t.tokenAddress as string);

  // 2. Profile addresses
  const profiles = await safeFetch<any[]>(`${BASE}/token-profiles/latest/v1`, 30);
  const profileAddresses = (profiles ?? [])
    .filter((p: any) => p?.chainId === "solana" && p.tokenAddress)
    .map((p: any) => p.tokenAddress as string);

  // 3. Parallel search queries
  const searchResults = await Promise.allSettled(
    SEARCH_QUERIES.map(q =>
      safeFetch<{ pairs?: DexPair[] }>(
        `${BASE}/latest/dex/search?q=${encodeURIComponent(q)}`, 20
      ).then(d => (d?.pairs ?? []).filter((p: DexPair) => p.chainId === "solana"))
    )
  );
  const searchPairs: DexPair[] = [];
  for (const r of searchResults) {
    if (r.status === "fulfilled") searchPairs.push(...r.value);
  }

  // 4. Fetch full pair data for boosted + profile addresses
  const addressPairs = await fetchPairsForTokens([
    ...new Set([...boostedAddresses, ...profileAddresses]),
  ]);

  // 5. Deduplicate by mint address — keep the highest-liquidity pool per token.
  //    This is why PUMP was appearing dozens of times: it has many liquidity pools
  //    and DexScreener returns each pool as a separate row.
  const byMint = new Map<string, DexPair>();
  for (const p of [...addressPairs, ...searchPairs]) {
    if (p.chainId !== "solana") continue;
    const mint = p.baseToken.address;
    const prev = byMint.get(mint);
    if (!prev || (p.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) {
      byMint.set(mint, p);
    }
  }

  return Array.from(byMint.values());
}

export async function fetchPairByMint(mint: string): Promise<DexPair | null> {
  const pairs = await fetchPairsForTokens([mint]);
  if (pairs.length === 0) return null;
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

export async function fetchBoostedSolanaTokens(): Promise<string[]> {
  const data = await safeFetch<any[]>(`${BASE}/token-boosts/latest/v1`, 15);
  return (data ?? []).filter((t: any) => t.chainId === "solana").map((t: any) => t.tokenAddress);
}

export async function searchSolanaPairs(query: string): Promise<DexPair[]> {
  const data = await safeFetch<{ pairs?: DexPair[] }>(
    `${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`, 15
  );
  return (data?.pairs ?? []).filter(p => p.chainId === "solana");
}
