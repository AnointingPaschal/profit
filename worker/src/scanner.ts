import fetch from "node-fetch";
import { config } from "./config";
import { DexPair } from "./types";

/**
 * Discovery layer: finds candidate Solana tokens using DexScreener's public API.
 *
 * NOTE: DexScreener's free endpoints and rate limits (currently ~300 req/min) change
 * periodically — recheck https://docs.dexscreener.com/api/reference before relying on
 * this in production. For lower latency than polling, DexScreener also offers a
 * WebSocket feed and there are paid indexers (Bitquery, Helius webhooks, Birdeye) that
 * push new-pool events in real time instead of polling.
 */

const DEXSCREENER_BASE = "https://api.dexscreener.com";

/** Pull the current latest "boosted"/trending token profiles (a proxy for trending attention). */
async function fetchBoostedTokens(): Promise<{ chainId: string; tokenAddress: string }[]> {
  const res = await fetch(`${DEXSCREENER_BASE}/token-boosts/latest/v1`);
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const items = Array.isArray(data) ? data : data?.data ?? [];
  return items
    .filter((t: any) => t.chainId === "solana")
    .map((t: any) => ({ chainId: t.chainId, tokenAddress: t.tokenAddress }));
}

/** Get full pair/market data for a batch of token addresses. */
async function fetchPairsForTokens(addresses: string[]): Promise<DexPair[]> {
  if (addresses.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

  const allPairs: DexPair[] = [];
  for (const chunk of chunks) {
    const url = `${DEXSCREENER_BASE}/tokens/v1/solana/${chunk.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const pairs = (await res.json()) as DexPair[];
    if (Array.isArray(pairs)) allPairs.push(...pairs);
  }
  return allPairs;
}

/** Also search DexScreener's general search endpoint for extra recall (e.g. "pump" launches). */
async function searchPairs(query: string): Promise<DexPair[]> {
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const pairs: DexPair[] = data?.pairs ?? [];
  return pairs.filter((p) => p.chainId === "solana");
}

function passesFilters(pair: DexPair): { ok: boolean; reason?: string } {
  const { discovery } = config;
  const liquidity = pair.liquidity?.usd ?? 0;
  const mcap = pair.marketCap ?? pair.fdv ?? Infinity;
  const ageMinutes = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 60000 : Infinity;
  const vol5m = pair.volume?.m5 ?? 0;

  if (liquidity < discovery.minLiquidityUsd) return { ok: false, reason: "liquidity too low" };
  if (mcap > discovery.maxMarketCapUsd) return { ok: false, reason: "market cap too high" };
  if (ageMinutes < discovery.minTokenAgeMinutes) return { ok: false, reason: "too new (let it season)" };
  if (ageMinutes > discovery.maxTokenAgeMinutes) return { ok: false, reason: "too old for a snipe entry" };
  if (vol5m < discovery.min5mVolumeUsd) return { ok: false, reason: "insufficient recent volume" };

  return { ok: true };
}

/** Returns a de-duplicated list of candidate pairs that pass the basic size/age/volume filters. */
export async function findCandidates(): Promise<DexPair[]> {
  const boosted = await fetchBoostedTokens();
  const boostedPairs = await fetchPairsForTokens(boosted.map((b) => b.tokenAddress));
  const searchedPairs = await searchPairs("solana"); // broad net; tune query as needed

  const seen = new Set<string>();
  const merged: DexPair[] = [];
  for (const p of [...boostedPairs, ...searchedPairs]) {
    if (p.chainId !== "solana") continue;
    if (seen.has(p.pairAddress)) continue;
    seen.add(p.pairAddress);
    merged.push(p);
  }

  return merged.filter((p) => passesFilters(p).ok);
}
