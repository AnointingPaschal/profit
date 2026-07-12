import { NextRequest, NextResponse } from "next/server";
import { fetchPairByMint } from "@/lib/dexscreener";
import { assessRisk } from "@/lib/rugcheck";

export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const { mint } = params;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

  try {
    const [pair, rug] = await Promise.all([fetchPairByMint(mint), assessRisk(mint, rpcUrl)]);
    if (!pair) {
      return NextResponse.json({ error: "token not found on DexScreener" }, { status: 404 });
    }
    return NextResponse.json({ pair, rug });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "lookup failed" }, { status: 500 });
  }
}
