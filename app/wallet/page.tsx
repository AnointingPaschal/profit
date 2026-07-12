"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/format";
import LocalWalletCard from "@/components/LocalWalletCard";
import HoldingsList from "@/components/HoldingsList";
import { AlertTriangle } from "lucide-react";

export default function WalletPage() {
  const { publicKey, connected } = useWallet();
  const botWalletAddress = process.env.NEXT_PUBLIC_BOT_WALLET_ADDRESS || "";

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Wallet</h1>

      <LocalWalletCard />

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
            worker service trades with — the dashboard only ever reads its public balance.
          </div>
        )}
      </div>

      <div className="card border-warn/40 flex gap-2 items-start">
        <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
        <p className="text-xs text-muted">
          Holdings shown for any address reflect what's actually on-chain for that public key — so if you
          import the same private key here that you used in Phantom, Solflare, or the bot wallet, you'll see
          the same balances, regardless of which app originally made the purchase. Seed phrases and private
          keys are encrypted and stored only in this browser; they are never sent to any server. Only keep
          risk capital in a wallet used by an automated bot or a browser-based hot wallet.
        </p>
      </div>
    </div>
  );
}
