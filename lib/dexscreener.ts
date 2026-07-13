import { DexPair } from "./types";

const BASE = "https://api.dexscreener.com";

// Multiple search terms to pull different segments of the Solana token universe.
// Each query returns up to ~30 pairs. With 30 queries + 3 profile endpoints we
// can surface 500–1000+ unique pairs per refresh.
const SEARCH_QUERIES = [
  "pump", "meme", "dog", "cat", "pepe", "moon", "sol",
  "inu", "baby", "ai", "based", "chad", "gme", "super",
  "degen", "ape", "fish", "frog", "bird", "bear", "bull",
  "king", "god", "legend", "gem", "coin", "token", "swap",
  "dex", "dao",
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

/** Fetch from all discovery sources in parallel and deduplicate by pairAddress */
export async function fetchAllSolanaPairs(): Promise<DexPair[]> {
  const seen = new Set<string>();
  const merged: DexPair[] = [];

  const add = (pairs: DexPair[] | null) => {
    if (!pairs) return;
    for (const p of pairs) {
      if (p.chainId !== "solana" || seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      merged.push(p);
    }
  };

  // 1. Boosted (top + latest) → ~60 pairs
  const [boostedTop, boostedLatest] = await Promise.all([
    safeFetch<any[]>(`${BASE}/token-boosts/top/v1`, 30),
    safeFetch<any[]>(`${BASE}/token-boosts/latest/v1`, 15),
  ]);

  const boostedAddresses: string[] = [];
  for (const item of [...(boostedTop ?? []), ...(boostedLatest ?? [])]) {
    if (item?.chainId === "solana" && item.tokenAddress) {
      boostedAddresses.push(item.tokenAddress);
    }
  }
  add(await fetchPairsForTokens([...new Set(boostedAddresses)]));

  // 2. Latest token profiles → up to 30 more
  const profiles = await safeFetch<any[]>(`${BASE}/token-profiles/latest/v1`, 30);
  const profileAddresses = (profiles ?? [])
    .filter((p: any) => p?.chainId === "solana")
    .map((p: any) => p.tokenAddress as string)
    .filter(Boolean);
  add(await fetchPairsForTokens([...new Set(profileAddresses)]));

  // 3. Parallel search queries — each returns ~30 pairs
  const searchResults = await Promise.allSettled(
    SEARCH_QUERIES.map(q =>
      safeFetch<{ pairs?: DexPair[] }>(`${BASE}/latest/dex/search?q=${encodeURIComponent(q)}`, 20)
        .then(d => d?.pairs ?? [])
    )
  );
  for (const r of searchResults) {
    if (r.status === "fulfilled") add(r.value);
  }

  return merged;
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
