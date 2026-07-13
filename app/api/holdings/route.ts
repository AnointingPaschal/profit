import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchPairsForTokens } from "@/lib/dexscreener";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export interface Holding {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number | null;
  logoUrl?: string;
}

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner query param required" }, { status: 400 });

  let ownerKey: PublicKey;
  try {
    ownerKey = new PublicKey(owner);
  } catch {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const [solLamports, tokenAccounts] = await Promise.all([
      connection.getBalance(ownerKey),
      connection.getParsedTokenAccountsByOwner(ownerKey, { programId: TOKEN_PROGRAM_ID }),
    ]);

    const rawHoldings = tokenAccounts.value
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        const amount = Number(info.tokenAmount.uiAmountString ?? 0);
        return { mint: info.mint as string, amount, decimals: info.tokenAmount.decimals as number };
      })
      .filter((h) => h.amount > 0);

    const mints = rawHoldings.map((h) => h.mint);
    const pairs = await fetchPairsForTokens(mints);
    const priceByMint = new Map<string, { priceUsd: number; symbol: string; name: string; logoUrl?: string }>();
    for (const p of pairs) {
      if (!priceByMint.has(p.baseToken.address)) {
        priceByMint.set(p.baseToken.address, {
          priceUsd: Number(p.priceUsd ?? 0),
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          logoUrl: p.info?.imageUrl,
        });
      }
    }

    const holdings: Holding[] = rawHoldings.map((h) => {
      const priced = priceByMint.get(h.mint);
      const priceUsd = priced?.priceUsd ?? null;
      return {
        mint: h.mint,
        symbol: priced?.symbol ?? h.mint.slice(0, 4).toUpperCase(),
        name: priced?.name ?? "Unknown token",
        amount: h.amount,
        decimals: h.decimals,
        priceUsd,
        valueUsd: priceUsd !== null ? priceUsd * h.amount : null,
        logoUrl: priced?.logoUrl,
      };
    });

    holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

    let solPriceUsd: number | null = null;
    try {
      const priceRes = await fetch(
        "https://lite-api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"
      );
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        solPriceUsd = Number(priceData?.data?.So11111111111111111111111111111111111111112?.price ?? 0) || null;
      }
    } catch {
      // price lookup is best-effort; portfolio total just falls back to token value only
    }

    return NextResponse.json({
      solBalance: solLamports / 1e9,
      solPriceUsd,
      holdings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "failed to fetch holdings" }, { status: 500 });
  }
}
