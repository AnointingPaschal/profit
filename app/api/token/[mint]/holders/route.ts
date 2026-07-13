import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const mintPubkey = new PublicKey(params.mint);
    const [largest, supplyInfo] = await Promise.all([
      connection.getTokenLargestAccounts(mintPubkey),
      connection.getTokenSupply(mintPubkey),
    ]);

    const totalSupply = supplyInfo.value.uiAmount ?? 0;

    // getTokenLargestAccounts returns token *accounts*, not owners — resolve each to its owner
    // so multiple accounts held by the same wallet aren't shown as separate "holders".
    const accountInfos = await connection.getMultipleParsedAccounts(largest.value.map((a) => a.address));
    const ownerAmounts = new Map<string, number>();
    largest.value.forEach((acc, i) => {
      const parsed: any = accountInfos.value[i]?.data;
      const owner = parsed?.parsed?.info?.owner ?? "unknown";
      const amount = acc.uiAmount ?? 0;
      ownerAmounts.set(owner, (ownerAmounts.get(owner) ?? 0) + amount);
    });

    const holders = Array.from(ownerAmounts.entries())
      .map(([owner, amount]) => ({
        owner,
        amount,
        pct: totalSupply > 0 ? (amount / totalSupply) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const top10Pct = holders.reduce((sum, h) => sum + h.pct, 0);

    return NextResponse.json({
      totalSupply,
      holders,
      top10Pct,
      note: "Top 20 largest token accounts only — full holder counts require an indexer (Helius/Birdeye) beyond basic RPC.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "failed to fetch holders" }, { status: 500 });
  }
}
