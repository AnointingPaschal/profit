"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Keypair } from "@solana/web3.js";
import { store, LocalWalletVault } from "@/lib/store";
import { decryptSecret, keypairFromMnemonic, keypairFromPrivateKey } from "@/lib/localWallet";

interface LocalWalletContextValue {
  vault: LocalWalletVault | null;
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  getKeypair: () => Keypair | null;
  refreshVault: () => void;
}

const LocalWalletContext = createContext<LocalWalletContextValue | null>(null);

export function LocalWalletProvider({ children }: { children: React.ReactNode }) {
  const [vault, setVault] = useState<LocalWalletVault | null>(null);
  const [keypair, setKeypair] = useState<Keypair | null>(null);

  useEffect(() => {
    setVault(store.getVault());
  }, []);

  const refreshVault = useCallback(() => {
    setVault(store.getVault());
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      const v = store.getVault();
      if (!v) return false;
      try {
        const secret = await decryptSecret(v.encrypted, password);
        const kp = v.secretType === "mnemonic" ? keypairFromMnemonic(secret) : keypairFromPrivateKey(secret);
        setKeypair(kp);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const lock = useCallback(() => setKeypair(null), []);

  const getKeypair = useCallback(() => keypair, [keypair]);

  return (
    <LocalWalletContext.Provider value={{ vault, isUnlocked: !!keypair, unlock, lock, getKeypair, refreshVault }}>
      {children}
    </LocalWalletContext.Provider>
  );
}

export function useLocalWallet() {
  const ctx = useContext(LocalWalletContext);
  if (!ctx) throw new Error("useLocalWallet must be used within LocalWalletProvider");
  return ctx;
}
