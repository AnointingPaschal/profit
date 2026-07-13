"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useLocalWallet } from "./LocalWalletProvider";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { shortAddr } from "@/lib/format";

export default function TopBar() {
  const { vault } = useLocalWallet();
  const { publicKey } = useWallet();
  const { dark, toggle } = useTheme();

  const address = vault?.publicKey ?? publicKey?.toBase58() ?? null;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5"
      style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      {/* Address pill */}
      <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-full px-2.5 py-1">
        <div className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--bg)]">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
        <span className="text-xs font-medium text-[var(--txt)]">
          {address ? shortAddr(address, 4) : "Connect"}
        </span>
        {!address && (
          <div className="opacity-0 w-0 overflow-hidden">
            <WalletMultiButton />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-xs font-medium text-[var(--txt)]">Solana</span>
        </div>
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
