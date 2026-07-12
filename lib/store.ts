"use client";

import { Position, StrategyConfig } from "./types";
import { DEGEN } from "./presets";
import type { EncryptedBlob } from "./localWallet";

export interface LocalWalletVault {
  publicKey: string;
  secretType: "mnemonic" | "privateKey";
  encrypted: EncryptedBlob;
  createdAt: number;
}

const KEYS = {
  config: "profit.config.v1",
  positions: "profit.positions.v1",
  watchlist: "profit.watchlist.v1",
  blacklist: "profit.blacklist.v1",
  killSwitch: "profit.killswitch.v1",
  vault: "profit.localWalletVault.v1",
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
};
