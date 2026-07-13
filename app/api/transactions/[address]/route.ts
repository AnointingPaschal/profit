import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export interface TxRecord {
  signature: string;
  blockTime: number | null;
  fee: number;
  status: "success" | "failed";
  memo: string | null;
  solChange: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 40 });

    const txs: TxRecord[] = sigs.map((s) => ({
      signature: s.signature,
      blockTime: s.blockTime ?? null,
      fee: 0,
      status: s.err ? "failed" : "success",
      memo: s.memo ?? null,
      solChange: 0,
    }));

    // Fetch a batch of parsed transactions to get SOL change + fee
    const parsedBatch = await connection.getParsedTransactions(
      sigs.slice(0, 20).map((s) => s.signature),
      { maxSupportedTransactionVersion: 0 }
    );

    parsedBatch.forEach((tx, i) => {
      if (!tx) return;
      txs[i].fee = (tx.meta?.fee ?? 0) / 1e9;
      const pre = tx.meta?.preBalances?.[0] ?? 0;
      const post = tx.meta?.postBalances?.[0] ?? 0;
      txs[i].solChange = (post - pre) / 1e9;
    });

    return NextResponse.json({ transactions: txs });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fetch failed" }, { status: 500 });
  }
}
