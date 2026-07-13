import * as fs from "fs";
import * as path from "path";
import { DexPair } from "./types";

const DATA_DIR = path.join(__dirname, "..", "data");
const LOG_FILE = path.join(DATA_DIR, "scanned-tokens.json");
const MAX_ENTRIES = 20000;

export interface ScannedTokenEntry {
  mint: string;
  symbol: string;
  name: string;
  pairAddress: string;
  firstSeenAt: number;
  lastSeenAt: number;
  timesSeen: number;
  initialPriceUsd: number;
  initialMarketCap: number;
  lastPriceUsd: number;
  lastMarketCap: number;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadLog(): Map<string, ScannedTokenEntry> {
  ensureDataDir();
  if (!fs.existsSync(LOG_FILE)) return new Map();
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const entries: ScannedTokenEntry[] = JSON.parse(raw);
    return new Map(entries.map((e) => [e.mint, e]));
  } catch {
    // Corrupt or partially-written file — start fresh rather than crash the scanner.
    return new Map();
  }
}

let writeQueued = false;
let pending: Map<string, ScannedTokenEntry> | null = null;

function flush() {
  writeQueued = false;
  if (!pending) return;
  let entries = Array.from(pending.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
  try {
    ensureDataDir();
    fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error(`[scannedTokensLog] failed to write ${LOG_FILE}:`, err);
  }
}

/** Records every fetched pair (whether or not it passed the discovery filters) to disk. */
export function recordScannedTokens(pairs: DexPair[]) {
  if (pairs.length === 0) return;
  const map = pending ?? loadLog();
  const now = Date.now();

  for (const p of pairs) {
    const mint = p.baseToken.address;
    const priceUsd = Number(p.priceUsd ?? 0);
    const marketCap = p.marketCap ?? p.fdv ?? 0;
    const prior = map.get(mint);
    if (prior) {
      prior.lastSeenAt = now;
      prior.timesSeen += 1;
      prior.lastPriceUsd = priceUsd;
      prior.lastMarketCap = marketCap;
    } else {
      map.set(mint, {
        mint,
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        pairAddress: p.pairAddress,
        firstSeenAt: now,
        lastSeenAt: now,
        timesSeen: 1,
        initialPriceUsd: priceUsd,
        initialMarketCap: marketCap,
        lastPriceUsd: priceUsd,
        lastMarketCap: marketCap,
      });
    }
  }

  pending = map;
  // Debounce writes so a burst of scans doesn't hammer the disk with a write per pair.
  if (!writeQueued) {
    writeQueued = true;
    setTimeout(flush, 2000);
  }
}

export function getScannedTokenCount(): number {
  return loadLog().size;
}
