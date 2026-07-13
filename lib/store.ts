"use client";

import { Position, StrategyConfig } from "./types";
import { DEGEN } from "./presets";
import type { EncryptedBlob } from "./localWallet";
import type { DexPair } from "./types";

export interface LocalWalletVault {
  publicKey: string;
  secretType: "mnemonic" | "privateKey";
  encrypted: EncryptedBlob;
  createdAt: number;
}

export interface ScannedTokenEntry {
  mint: string;
  symbol: string;
  name: string;
  pairAddress: string;
  logoUrl?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  timesSeen: number;
  initialPriceUsd: number;
  initialMarketCap: number;
  lastPriceUsd: number;
  lastMarketCap: number;
}

const MAX_SCANNED_TOKENS = 5000;

export interface PriceSnapshot {
  priceUsd: number;
  marketCap: number;
  liquidity: number;
  capturedAt: number;
}

const KEYS = {
  config:         "profit.config.v1",
  positions:      "profit.positions.v1",
  watchlist:      "profit.watchlist.v1",
  blacklist:      "profit.blacklist.v1",
  killSwitch:     "profit.killswitch.v1",
  vault:          "profit.localWalletVault.v1",
  scannedTokens:  "profit.scannedTokens.v1",
  priceSnapshots: "profit.priceSnapshots.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  getConfig(): StrategyConfig {
    return read(KEYS.config, DEGEN);
  },
  setConfig(cfg: StrategyConfig) {
    write(KEYS.config, cfg);
  },

  getPositions(): Position[] {
    return read(KEYS.positions, []);
  },
  setPositions(positions: Position[]) {
    write(KEYS.positions, positions);
  },

  getWatchlist(): string[] {
    return read(KEYS.watchlist, []);
  },
  toggleWatchlist(mint: string) {
    const list = store.getWatchlist();
    const next = list.includes(mint) ? list.filter((m) => m !== mint) : [...list, mint];
    write(KEYS.watchlist, next);
    return next;
  },

  getBlacklist(): string[] {
    return read(KEYS.blacklist, []);
  },
  addToBlacklist(mint: string) {
    const list = store.getBlacklist();
    if (!list.includes(mint)) write(KEYS.blacklist, [...list, mint]);
  },

  getKillSwitch(): boolean {
    return read(KEYS.killSwitch, false);
  },
  setKillSwitch(on: boolean) {
    write(KEYS.killSwitch, on);
  },

  getVault(): LocalWalletVault | null {
    return read<LocalWalletVault | null>(KEYS.vault, null);
  },
  setVault(vault: LocalWalletVault) {
    write(KEYS.vault, vault);
  },
  deleteVault() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEYS.vault);
  },

  getScannedTokens(): ScannedTokenEntry[] {
    return read<ScannedTokenEntry[]>(KEYS.scannedTokens, []);
  },

  /** Merges freshly-fetched DexScreener pairs into the permanent scanned-tokens log. */
  recordScannedTokens(pairs: DexPair[]) {
    if (typeof window === "undefined" || pairs.length === 0) return;
    const existing = read<ScannedTokenEntry[]>(KEYS.scannedTokens, []);
    const byMint = new Map(existing.map((e) => [e.mint, e]));
    const now = Date.now();

    for (const p of pairs) {
      const mint = p.baseToken.address;
      const priceUsd = Number(p.priceUsd ?? 0);
      const marketCap = p.marketCap ?? p.fdv ?? 0;
      const prior = byMint.get(mint);
      if (prior) {
        prior.lastSeenAt = now;
        prior.timesSeen += 1;
        prior.lastPriceUsd = priceUsd;
        prior.lastMarketCap = marketCap;
      } else {
        byMint.set(mint, {
          mint,
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          pairAddress: p.pairAddress,
          logoUrl: p.info?.imageUrl,
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

    let merged = Array.from(byMint.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    if (merged.length > MAX_SCANNED_TOKENS) merged = merged.slice(0, MAX_SCANNED_TOKENS);
    write(KEYS.scannedTokens, merged);
  },

  clearScannedTokens() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEYS.scannedTokens);
  },

  /** Load ALL stored first-seen price snapshots (persists across reloads). */
  getSnapshots(): Record<string, PriceSnapshot> {
    return read<Record<string, PriceSnapshot>>(KEYS.priceSnapshots, {});
  },

  /**
   * Merge new pair data into the snapshot store.
   * Only writes a snapshot for a mint if one doesn't already exist —
   * this means "initial at first fetch" is truly immutable once set.
   */
  mergeSnapshots(pairs: DexPair[]) {
    if (typeof window === "undefined" || pairs.length === 0) return;
    const existing = read<Record<string, PriceSnapshot>>(KEYS.priceSnapshots, {});
    let changed = false;
    const now = Date.now();
    for (const p of pairs) {
      const mint = p.baseToken.address;
      if (!existing[mint]) {
        existing[mint] = {
          priceUsd:   Number(p.priceUsd ?? 0),
          marketCap:  p.marketCap ?? p.fdv ?? 0,
          liquidity:  p.liquidity?.usd ?? 0,
          capturedAt: now,
        };
        changed = true;
      }
    }
    if (changed) write(KEYS.priceSnapshots, existing);
  },
};
