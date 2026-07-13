"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import { Holding } from "@/app/api/holdings/route";
import { formatUsd } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

const SOL_OPTION = { mint: "SOL", symbol: "SOL", decimals: 9 };

function SendPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { connection } = useConnection();
  const { vault, isUnlocked, unlock, getKeypair } = useLocalWallet();

  const [solBalance, setSolBalance] = useState<number>(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedMint, setSelectedMint] = useState<string>(search.get("mint") ?? "SOL");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!vault) return;
    fetch(`/api/holdings?owner=${vault.publicKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setSolBalance(d.solBalance);
          setHoldings(d.holdings);
        }
      });
  }, [vault]);

  const selected =
    selectedMint === "SOL"
      ? { symbol: "SOL", decimals: 9, amount: solBalance, valueUsd: null as number | null }
      : holdings.find((h) => h.mint === selectedMint);

  const handleUnlock = async () => {
    setUnlockError(null);
    const ok = await unlock(password);
    if (!ok) setUnlockError("Incorrect password.");
    setPassword("");
  };

  const handleMax = () => {
    if (!selected) return;
    // Leave a little SOL for fees when sending native SOL.
    const max = selectedMint === "SOL" ? Math.max(0, selected.amount - 0.002) : selected.amount;
    setAmount(String(max));
  };

  const send = async () => {
    if (!vault || !recipient || !amount) return;
    const keypair = getKeypair();
    if (!keypair) return setStatus("Wallet is locked.");

    setSending(true);
    setStatus("Building transaction…");
    try {
      const recipientKey = new PublicKey(recipient.trim());
      const tx = new Transaction();

      if (selectedMint === "SOL") {
        const lamports = Math.floor(Number(amount) * 1e9);
        tx.add(
          SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: recipientKey, lamports })
        );
      } else {
        const mintKey = new PublicKey(selectedMint);
        const decimals = selected?.decimals ?? 6;
        const rawAmount = BigInt(Math.floor(Number(amount) * 10 ** decimals));

        const senderAta = await getAssociatedTokenAddress(mintKey, keypair.publicKey);
        const recipientAta = await getAssociatedTokenAddress(mintKey, recipientKey);

        const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(keypair.publicKey, recipientAta, recipientKey, mintKey)
          );
        }
        tx.add(
          createTransferCheckedInstruction(
            senderAta,
            mintKey,
            recipientAta,
            keypair.publicKey,
            rawAmount,
            decimals,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);

      setStatus("Sending…");
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      setStatus(`Sent! Signature: ${sig}`);
      setAmount("");
      setRecipient("");
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!vault) {
    return (
      <div className="p-4">
        <div className="card text-sm text-[var(--muted)]">
          You need a wallet first — go to the Wallet tab and create or import one.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--muted)]"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold">Send</h1>
      </div>

      {!isUnlocked ? (
        <div className="surface space-y-3">
          <p className="text-sm text-[var(--muted)]">Enter your password to unlock this wallet for sending.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Wallet password"
            className="w-full bg-[var(--card2)] rounded-xl px-3 py-2 text-sm outline-none"
          />
          {unlockError && <div className="text-danger text-xs">{unlockError}</div>}
          <button onClick={handleUnlock} className="w-full bg-accent text-white font-semibold rounded-xl2 py-3">
            Unlock
          </button>
        </div>
      ) : (
        <div className="surface space-y-3">
          <label className="block text-xs text-[var(--muted)]">Asset</label>
          <select
            value={selectedMint}
            onChange={(e) => setSelectedMint(e.target.value)}
            className="w-full bg-[var(--card2)] rounded-xl px-3 py-2 text-sm outline-none"
          >
            <option value="SOL">SOL — {solBalance.toFixed(4)}</option>
            {holdings.map((h) => (
              <option key={h.mint} value={h.mint}>
                {h.symbol} — {h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </option>
            ))}
          </select>

          <label className="block text-xs text-[var(--muted)]">Recipient address</label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Solana address"
            className="w-full bg-[var(--card2)] rounded-xl px-3 py-2 text-sm outline-none"
          />

          <label className="block text-xs text-[var(--muted)]">Amount</label>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder="0.00"
              className="flex-1 bg-[var(--card2)] rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button onClick={handleMax} className="px-3 border border-[var(--border)] rounded-xl text-xs">Max</button>
          </div>
          {selected && <div className="text-xs text-[var(--muted)]">Available: {selected.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selected.symbol}</div>}

          <button
            onClick={send}
            disabled={sending || !recipient || !amount}
            className="w-full bg-accent text-white font-semibold rounded-xl2 py-3 disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send"}
          </button>
          {status && <div className="text-xs text-[var(--muted)] break-all">{status}</div>}
        </div>
      )}
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={<div className="p-4 text-[var(--muted)] text-sm">Loading…</div>}>
      <SendPageInner />
    </Suspense>
  );
}
