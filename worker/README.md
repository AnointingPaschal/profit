# Solana Sniper Bot (Educational Scaffold)

Scans for low-market-cap Solana tokens, runs rug-pull heuristics, buys via Jupiter, and
manages exits with a stop-loss / take-profit-ladder / trailing-stop strategy.

## Read this before running it

- **Most low-mcap tokens go to zero.** Rug checks catch the obvious scams (mint authority
  not renounced, no LP lock, one wallet holding 90% of supply) — they do not catch
  insider dumping, coordinated pump-and-dumps, or a team that simply abandons the project.
- **You are competing with other bots.** Faster, better-funded snipers with private RPC
  and Jito bundles will often win the first block. This bot is not guaranteed to get
  favorable entries.
- **Start in `DRY_RUN=true`** and watch the logs for a few days before risking real SOL.
  Use a dedicated wallet funded only with what you can afford to lose entirely.
- **This is not financial advice**, and nothing here guarantees profit — treat the exit
  parameters as a starting point to tune, not a proven strategy.

## Setup

```bash
npm install
cp .env.example .env
# edit .env — at minimum review DRY_RUN, BUY_AMOUNT_SOL, and the discovery filters
npm run dev
```

Once you've watched dry-run behavior and are comfortable with it:
1. Get a paid RPC endpoint (Helius, QuickNode, or Triton) — the public RPC will rate-limit
   and cause missed trades.
2. Fund a fresh wallet with only your risk capital, export its base58 private key into
   `WALLET_PRIVATE_KEY`.
3. Set `DRY_RUN=false`.
4. Get a Jupiter API key (https://dev.jup.ag) if you outgrow the free `lite-api` tier.

## How the strategy works (`src/positionManager.ts`)

1. **Stop loss** — full exit if price drops `STOP_LOSS_PCT` below entry. This is what
   protects the account; don't disable it.
2. **Take-profit ladder** — sells a tranche (`TAKE_PROFIT_SELL_PCTS`) each time price
   crosses a level in `TAKE_PROFIT_LEVELS` (default +100%, +300%, +900%), locking in gains
   progressively instead of risking a full round-trip back to breakeven or a loss.
3. **Trailing stop** — once gain passes `TRAILING_STOP_ACTIVATE_PCT`, the remaining
   position sells if price pulls back `TRAILING_STOP_PCT` from its peak, so a genuine
   runner isn't capped at the last fixed TP level.
4. **Time stop** — exits positions that haven't moved after `MAX_HOLD_MINUTES`, so capital
   isn't parked in a dead token.

## Known gaps to close before going live

- `sniper.ts` currently uses `entryPriceUsd` as a placeholder for "current price" in the
  monitoring loop — wire in a real price feed (DexScreener pair price or a Birdeye price
  API call) before running with real funds, or every exit rule above is a no-op.
- The discovery layer polls DexScreener's public endpoints, which are rate-limited and
  can lag. For real snipe-speed entries, consider subscribing directly to Solana program
  logs for Raydium/pump.fun pool-creation instructions (lower latency, no API rate limit),
  or a paid webhook service (Helius, Bitquery).
- No Jito bundle / tip support is included — in busy conditions your buy transaction can
  simply lose the block to a better-tipped bot. Adding a Jito tip instruction alongside
  the Jupiter swap is the standard next step.
- No persistent storage — positions live in memory and are lost on restart. Add a small
  JSON/SQLite store if you need the bot to survive restarts.

## Files

- `src/scanner.ts` — DexScreener-based token discovery + size/age/volume filters
- `src/rugCheck.ts` — RugCheck API + on-chain mint/freeze fallback checks
- `src/jupiter.ts` — quote + swap execution via Jupiter
- `src/positionManager.ts` — exit strategy logic
- `src/sniper.ts` — orchestration loop (scan → filter → buy → monitor → sell)
