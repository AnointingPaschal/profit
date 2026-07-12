"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { shortAddr } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export default function WalletPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const botWalletAddress = process.env.NEXT_PUBLIC_BOT_WALLET_ADDRESS || "";
  const [botBalance, setBotBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then((lamports) => setSolBalance(lamports / 1e9));
  }, [publicKey, connection]);

  useEffect(() => {
    if (!botWalletAddress) return;
    connection
      .getBalance(new PublicKey(botWalletAddress))
      .then((lamports) => setBotBalance(lamports / 1e9))
      .catch(() => setBotBalance(null));
  }, [botWalletAddress, connection]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Wallet</h1>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Connected Wallet</span>
          <WalletMultiButton style={{ height: 34, fontSize: 12 }} />
        </div>
        {connected && publicKey ? (
          <div className="text-sm">
            <div className="text-muted text-xs">{shortAddr(publicKey.toBase58(), 6)}</div>
            <div className="text-2xl font-semibold mt-1">
              {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : "…"}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Connect Phantom or Solflare to trade manually from this app.</div>
        )}
      </div>

      <div className="card space-y-2">
        <span className="font-medium">Bot Wallet (read-only)</span>
        {botWalletAddress ? (
          <div className="text-sm">
            <div className="text-muted text-xs">{shortAddr(botWalletAddress, 6)}</div>
            <div className="text-2xl font-semibold mt-1">
              {botBalance !== null ? `${botBalance.toFixed(4)} SOL` : "…"}
            </div>
          </div>
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
          The bot wallet's private key must live only in the worker service's environment secrets — never in this
          app. Only fund it with SOL you can afford to lose entirely, and never reuse a wallet that holds
          significant funds elsewhere.
        </p>
      </div>
    </div>
  );
}
