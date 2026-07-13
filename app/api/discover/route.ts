import { NextRequest, NextResponse } from "next/server";
import { fetchBoostedSolanaTokens, fetchPairsForTokens, searchSolanaPairs } from "@/lib/dexscreener";
import { DexPair } from "@/lib/types";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const minLiquidityUsd = Number(params.get("minLiquidityUsd") ?? 3000);
  const maxMarketCapUsd = Number(params.get("maxMarketCapUsd") ?? 200000);
  const minTokenAgeMinutes = Number(params.get("minTokenAgeMinutes") ?? 1);
  const maxTokenAgeMinutes = Number(params.get("maxTokenAgeMinutes") ?? 180);
  const min5mVolumeUsd = Number(params.get("min5mVolumeUsd") ?? 500);
  const sort = params.get("sort") ?? "trending"; // trending | new | top

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

    const filtered = merged.filter((p) => {
      const liquidity = p.liquidity?.usd ?? 0;
      const mcap = p.marketCap ?? p.fdv ?? Infinity;
      const ageMinutes = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 60000 : Infinity;
      const vol5m = p.volume?.m5 ?? 0;
      return (
        liquidity >= minLiquidityUsd &&
        mcap <= maxMarketCapUsd &&
        ageMinutes >= minTokenAgeMinutes &&
        ageMinutes <= maxTokenAgeMinutes &&
        vol5m >= min5mVolumeUsd
      );
    });

    if (sort === "new") {
      filtered.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    } else if (sort === "top") {
      filtered.sort((a, b) => (b.marketCap ?? b.fdv ?? 0) - (a.marketCap ?? a.fdv ?? 0));
    } else {
      filtered.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
    }

    return NextResponse.json({ pairs: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "discover failed", pairs: [] }, { status: 500 });
  }
}
