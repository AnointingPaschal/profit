"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import LocalWalletCard from "@/components/LocalWalletCard";
import HoldingsList from "@/components/HoldingsList";
import { formatUsd } from "@/lib/format";
import { shortAddr } from "@/lib/format";
import { Send, Download, ArrowLeftRight, AlertTriangle, Copy } from "lucide-react";

export default function WalletPage() {
  const { vault } = useLocalWallet();
  const { publicKey, connected } = useWallet();
  const botWalletAddress = process.env.NEXT_PUBLIC_BOT_WALLET_ADDRESS || "";
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!vault) return;
    navigator.clipboard.writeText(vault.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="p-4 space-y-4">
      {vault ? (
        <>
          {/* Trust-Wallet style portfolio header */}
          <div className="text-center pt-2 pb-1">
            <div className="text-xs text-muted flex items-center justify-center gap-1">
              <button onClick={copyAddress} className="flex items-center gap-1">
                {shortAddr(vault.publicKey, 5)} <Copy size={11} />
              </button>
              {copied && <span className="text-accent">Copied</span>}
            </div>
            <div className="text-3xl font-bold mt-2">{totalUsd !== null ? formatUsd(totalUsd) : "—"}</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Link href="/wallet/send" className="card flex flex-col items-center gap-1.5 py-3">
              <Send size={20} className="text-accent" />
              <span className="text-xs">Send</span>
            </Link>
            <Link href="/wallet/receive" className="card flex flex-col items-center gap-1.5 py-3">
              <Download size={20} className="text-accent" />
              <span className="text-xs">Receive</span>
            </Link>
            <Link href="/trade" className="card flex flex-col items-center gap-1.5 py-3">
              <ArrowLeftRight size={20} className="text-accent" />
              <span className="text-xs">Swap</span>
            </Link>
          </div>

          <div>
            <div className="text-sm text-muted mb-1 px-1">Assets</div>
            <HoldingsList address={vault.publicKey} onTotal={setTotalUsd} />
          </div>

          <details className="text-sm">
            <summary className="text-muted cursor-pointer py-1">Wallet security & backup</summary>
            <div className="pt-2">
              <LocalWalletCard />
            </div>
          </details>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Wallet</h1>
          <LocalWalletCard />
        </>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Connected Wallet</span>
          <WalletMultiButton style={{ height: 34, fontSize: 12 }} />
        </div>
        {connected && publicKey ? (
          <>
            <div className="text-xs text-muted">{shortAddr(publicKey.toBase58(), 6)}</div>
            <HoldingsList address={publicKey.toBase58()} />
          </>
        ) : (
          <div className="text-sm text-muted">Connect Phantom or Solflare to trade manually from this app.</div>
        )}
      </div>

      <div className="card space-y-2">
        <span className="font-medium">Bot Wallet (read-only)</span>
        {botWalletAddress ? (
          <>
            <div className="text-xs text-muted">{shortAddr(botWalletAddress, 6)}</div>
            <HoldingsList address={botWalletAddress} />
          </>
        ) : (
          <div className="text-sm text-muted">
            No bot wallet configured. Set NEXT_PUBLIC_BOT_WALLET_ADDRESS to the public key of the wallet your
            worker service trades with.
          </div>
        )}
      </div>

      <div className="card border-warn/40 flex gap-2 items-start">
        <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
        <p className="text-xs text-muted">
          Seed phrases and private keys are encrypted and stored only in this browser — never sent to any
          server. Only keep risk capital in a browser-based hot wallet.
        </p>
      </div>
    </div>
  );
}
