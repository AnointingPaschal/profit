import { NextRequest, NextResponse } from "next/server";
import { fetchAllSolanaPairs } from "@/lib/dexscreener";
import { DexPair } from "@/lib/types";

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "trending";

  try {
    const all = await fetchAllSolanaPairs();

    if (sort === "new") {
      all.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    } else if (sort === "top") {
      all.sort((a, b) => (b.marketCap ?? b.fdv ?? 0) - (a.marketCap ?? a.fdv ?? 0));
    } else if (sort === "lowmc") {
      all.sort((a, b) => (a.marketCap ?? a.fdv ?? Infinity) - (b.marketCap ?? b.fdv ?? Infinity));
    } else {
      // trending → highest 24h volume first
      all.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
    }

    return NextResponse.json({ pairs: all, total: all.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fetch failed", pairs: [] }, { status: 500 });
  }
}
