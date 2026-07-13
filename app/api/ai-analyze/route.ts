import { NextRequest, NextResponse } from "next/server";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface TokenAnalysisInput {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  liquidity: number;
  change5m?: number;
  change1h?: number;
  change24h?: number;
  volume24h?: number;
  ageMinutes?: number;
  mintRenounced: boolean;
  freezeRenounced: boolean;
  lpLockedPct: number;
  top10HolderPct: number;
}

export interface AnalysisResult {
  decision: "BUY" | "SELL" | "HOLD";
  confidence: number;          // 0–100
  reasoning: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  signals: { bullish: string[]; bearish: string[] };
}

const PROMPT = (t: TokenAnalysisInput) => `
You are a Solana DeFi trading analyst. Analyse this token and return a structured JSON trading decision.

Token: ${t.symbol} (${t.name})
Price: $${t.price}
Market Cap: $${t.marketCap?.toLocaleString()}
Liquidity: $${t.liquidity?.toLocaleString()}
Price change — 5m: ${t.change5m ?? "n/a"}%  1h: ${t.change1h ?? "n/a"}%  24h: ${t.change24h ?? "n/a"}%
24h Volume: $${t.volume24h?.toLocaleString() ?? "n/a"}
Age: ${t.ageMinutes ? Math.round(t.ageMinutes) + " minutes" : "unknown"}
Mint authority renounced: ${t.mintRenounced}
Freeze authority renounced: ${t.freezeRenounced}
LP locked %: ${t.lpLockedPct}
Top 10 holders %: ${t.top10HolderPct}

Return ONLY a valid JSON object (no markdown, no code fences) matching this exact schema:
{
  "decision": "BUY"|"SELL"|"HOLD",
  "confidence": <0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "entryPrice": <number>,
  "targetPrice": <number>,
  "stopLoss": <number>,
  "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"EXTREME",
  "signals": {
    "bullish": ["<signal>", ...],
    "bearish": ["<signal>", ...]
  }
}
`.trim();

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not set on the server. Add it to Vercel environment variables." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { model, token }: { model: string; token: TokenAnalysisInput } = body;

  if (!model || !token) {
    return NextResponse.json({ error: "model and token are required" }, { status: 400 });
  }

  try {
    const res = await fetch(OR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://profit-beryl.vercel.app",
        "X-Title": "Profit — Solana Sniper",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT(token) }],
        max_tokens: 600,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `OpenRouter: ${txt}` }, { status: res.status });
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content ?? "";

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed: AnalysisResult = JSON.parse(clean);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "AI returned non-JSON", raw }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
