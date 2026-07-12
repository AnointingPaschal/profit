# Profit — Solana Sniper Dashboard

A mobile-wallet-style dashboard for discovering, rug-checking, sniping, and tracking
low-market-cap Solana tokens, plus a separate always-on worker that runs the automated
trading loop.

## Read this first — this is a real financial risk tool

- **Most low-mcap tokens lose value or go to zero.** The rug checks here catch the
  obvious scams (mint authority not renounced, no LP lock, one wallet holding most of
  supply) — they do not catch a team that renounces everything correctly and still
  quietly dumps.
- **You are competing with faster, better-funded bots.** This app has no Jito tip/bundle
  support yet, so it can lose block races on contested launches.
- **Nothing here is financial advice**, and no configuration guarantees profit. Start in
  dry-run / with tiny amounts, on a dedicated wallet funded only with risk capital.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  Next.js app (Vercel)   │◄──────►│  Worker service           │
│  - Discover/Token/      │  reads │  (Railway / Fly.io / VPS) │
│    Positions/Trade/     │  DB    │  - continuous scan loop   │
│    Wallet/Config pages  │        │  - rug checks              │
│  - wallet-adapter for   │        │  - buy/sell execution      │
│    manual trades only   │        │  - holds bot wallet key    │
└─────────────────────────┘        └──────────────────────────┘
```

This repo ships an MVP where the dashboard talks directly to DexScreener/Jupiter/RugCheck
from Next.js API routes, and uses browser `localStorage` for config/positions/watchlist
so you can run it standalone with zero backend setup. The `/worker` directory is the
standalone automated bot from the original scaffold — deploy it separately (it needs a
persistent host, not Vercel) and point it at a shared database once you're ready to move
config/positions out of localStorage. See "Next steps" below.

## Repo layout

- `/app` — Next.js 14 App Router dashboard (Discover, Token Detail, Positions, Trade,
  Wallet, Config)
- `/lib` — shared types, DexScreener/Jupiter/RugCheck clients, formatting helpers,
  strategy presets, localStorage store, local-wallet key generation/encryption
- `/components` — wallet-adapter provider, bottom tab bar, risk badge, local wallet card,
  holdings list
- `/worker` — standalone always-on sniper bot (scanner → rug check → buy → monitor → sell)
  with its own `package.json`, `.env.example`, and `Dockerfile`

## The built-in wallet (Wallet page)

The Wallet page can create a brand new Solana wallet, or import an existing one via seed
phrase or private key — all client-side.

- **Generation**: standard BIP39 mnemonic + BIP44 derivation path `m/44'/501'/0'/0'`
  (the same convention Phantom and Solflare use), via `bip39` + `ed25519-hd-key`. A seed
  phrase generated here restores to the same address in those wallets, and vice versa.
- **Storage**: the seed phrase or private key is encrypted in the browser with
  AES-GCM-256 (key derived via PBKDF2, 150k iterations) using a password you set, and
  saved only in `localStorage`. Nothing is ever sent to a server — there is no API route
  that touches key material.
- **Holdings**: any address (this local wallet, a connected Phantom/Solflare wallet, or
  the bot wallet) is looked up directly on-chain (`getParsedTokenAccountsByOwner` + SOL
  balance) and enriched with live DexScreener prices. This is why holdings show up
  correctly even if the tokens were originally bought from a different wallet app —
  balances belong to the address on-chain, not to whichever app made the purchase.
- **Limits of this MVP**: `localStorage` is per-browser (clearing site data or switching
  devices loses access — the seed phrase/private key is the only real backup), and a
  browser is a softer security boundary than a hardware wallet or a dedicated extension.
  Treat any wallet created or imported here as a hot wallet for small, disposable amounts.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/discover`. Resize your browser to
~390px wide (or open dev tools device mode) to see the intended mobile layout; it's
capped at 480px max-width by design.

## Deploying the dashboard to Vercel

1. Push this repo to GitHub (done — see below).
2. Import the repo in Vercel, framework preset "Next.js", root directory `/` (leave
   `/worker` alone — it is not part of the Vercel build).
3. Set environment variables in Vercel: `NEXT_PUBLIC_RPC_URL`,
   `NEXT_PUBLIC_BOT_WALLET_ADDRESS`.
4. Deploy.

## Deploying the worker

```bash
cd worker
cp .env.example .env
# fill in WALLET_PRIVATE_KEY (only when DRY_RUN=false), RPC_URL, strategy params
npm install
npm run build
npm start
```

Or via Docker: `docker build -t profit-worker . && docker run --env-file .env profit-worker`.
Deploy that image to Railway/Fly.io/a VPS — anywhere that keeps a process running
continuously. **Never deploy the worker to Vercel** — serverless functions there cannot
host a persistent loop, and you'd also be putting a private key into a platform designed
for public-facing code.

## Known gaps / next steps

- **Shared database.** Right now the dashboard's config/positions/watchlist live in
  `localStorage` (per-browser) and the worker (if deployed) tracks its own state
  in-memory. To have the dashboard show the worker's real live positions, add a Postgres
  instance (Supabase/Neon) and have the worker write to it while the dashboard reads from
  it via a new set of API routes — swap out `lib/store.ts` for DB-backed reads.
- **Live price feed in the worker's monitor loop** — wire in a DexScreener price poll per
  open position (the `/worker` code has a placeholder noted in its own README).
- **No Jito tip/bundle support** — needed for competitive entries on contested launches.
- **Limit orders** on the Trade page are watched client-side for demo purposes; for
  orders that fire even when the app is closed, move that logic into the worker using
  Jupiter's Trigger API.

## License

MIT — use at your own risk.
