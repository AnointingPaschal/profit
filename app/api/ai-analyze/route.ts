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
  confidence: number; // 0-100
  reasoning: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  signals: { bullish: string[]; bearish: string[] };
}

// Strip any character above codepoint 127 so Node fetch can encode it as a
// ByteString without throwing "value of NNNN which is greater than 255".
function ascii(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, (c) => {
    // Keep a few common replacements readable instead of dropping them.
    if (c === "\u2014" || c === "\u2013") return "-";   // em/en dash
    if (c === "\u2018" || c === "\u2019") return "'";   // curly single quotes
    if (c === "\u201C" || c === "\u201D") return '"';   // curly double quotes
    if (c === "\u2026") return "...";                   // ellipsis
    return "";                                          // drop everything else
  });
}

function buildPrompt(t: TokenAnalysisInput): string {
  // All values converted to plain ASCII before interpolation.
  const sym  = ascii(t.symbol);
  const name = ascii(t.name);
  const age  = t.ageMinutes ? `${Math.round(t.ageMinutes)} minutes` : "unknown";

  return ascii(`
You are a Solana DeFi trading analyst. Analyse this token and return a structured JSON trading decision.

Token: ${sym} (${name})
Price: $${t.price}
Market Cap: $${t.marketCap?.toLocaleString() ?? 0}
Liquidity: $${t.liquidity?.toLocaleString() ?? 0}
Price change - 5m: ${t.change5m ?? "n/a"}%  1h: ${t.change1h ?? "n/a"}%  24h: ${t.change24h ?? "n/a"}%
24h Volume: $${t.volume24h?.toLocaleString() ?? "n/a"}
Age: ${age}
Mint authority renounced: ${t.mintRenounced}
Freeze authority renounced: ${t.freezeRenounced}
LP locked %: ${t.lpLockedPct}
Top 10 holders %: ${t.top10HolderPct}

Return ONLY a valid JSON object (no markdown, no code fences) matching this schema:
{
  "decision": "BUY" or "SELL" or "HOLD",
  "confidence": number between 0 and 100,
  "reasoning": "2-3 sentence explanation",
  "entryPrice": number,
  "targetPrice": number,
  "stopLoss": number,
  "riskLevel": "LOW" or "MEDIUM" or "HIGH" or "EXTREME",
  "signals": {
    "bullish": ["signal1", "signal2"],
    "bearish": ["signal1", "signal2"]
  }
}
`).trim();
}

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not set. Add it to your Vercel environment variables." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { model, token }: { model: string; token: TokenAnalysisInput } = body;

  if (!model || !token) {
    return NextResponse.json({ error: "model and token are required" }, { status: 400 });
  }

  const prompt = buildPrompt(token);

  // ascii() already stripped all non-ASCII from the prompt and token data,
  // so JSON.stringify produces a clean 7-bit ASCII string that fetch can
  // encode without hitting the ByteString > 255 limit.
  const requestBody = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.2,
  });

  try {
    const res = await fetch(OR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://profit-beryl.vercel.app",
        "X-Title": "Profit Solana Sniper",
      },
      body: requestBody,
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `OpenRouter error: ${txt}` }, { status: res.status });
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content ?? "";

    // Strip accidental markdown fences the model might wrap around the JSON
    const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

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
