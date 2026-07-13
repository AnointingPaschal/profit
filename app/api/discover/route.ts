import { NextRequest, NextResponse } from "next/server";
import { fetchBoostedSolanaTokens, fetchPairsForTokens, searchSolanaPairs } from "@/lib/dexscreener";
import { DexPair } from "@/lib/types";

// We no longer filter here — we return ALL pairs and let the client sort/tab.
// The only dedup is by pairAddress so the same pool doesn't appear twice.
export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "trending";

  try {
    const boosted = await fetchBoostedSolanaTokens();
    const [boostedPairs, searchedPairs] = await Promise.all([
      fetchPairsForTokens(boosted),
      searchSolanaPairs("solana"),
    ]);

    const seen = new Set<string>();
    const merged: DexPair[] = [];
    for (const p of [...boostedPairs, ...searchedPairs]) {
      if (p.chainId !== "solana" || seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);
      merged.push(p);
    }

    if (sort === "new") {
      merged.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    } else if (sort === "top") {
      merged.sort((a, b) => (b.marketCap ?? b.fdv ?? 0) - (a.marketCap ?? a.fdv ?? 0));
    } else if (sort === "lowmc") {
      merged.sort((a, b) => (a.marketCap ?? a.fdv ?? Infinity) - (b.marketCap ?? b.fdv ?? Infinity));
    } else {
      // trending: highest 24h volume first
      merged.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
    }

    return NextResponse.json({ pairs: merged });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "discover failed", pairs: [] }, { status: 500 });
  }
}
