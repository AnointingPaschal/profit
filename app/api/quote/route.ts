import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/jupiter";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const inputMint = params.get("inputMint");
  const outputMint = params.get("outputMint");
  const amount = Number(params.get("amount"));
  const slippageBps = Number(params.get("slippageBps") ?? 1000);

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: "inputMint, outputMint, amount are required" }, { status: 400 });
  }

  const quote = await getQuote(inputMint, outputMint, amount, slippageBps);
  if (!quote) return NextResponse.json({ error: "no route found" }, { status: 404 });
  return NextResponse.json(quote);
}
