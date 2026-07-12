"use client";

import { useEffect, useState } from "react";
import {
  generateMnemonic,
  isValidMnemonic,
  keypairFromMnemonic,
  keypairFromPrivateKey,
  exportPrivateKeyBase58,
  encryptSecret,
  decryptSecret,
} from "@/lib/localWallet";
import { store, LocalWalletVault } from "@/lib/store";
import { shortAddr } from "@/lib/format";
import HoldingsList from "./HoldingsList";
import { Copy, Eye, EyeOff, Lock, Trash2, ShieldAlert } from "lucide-react";

type Step =
  | "none"
  | "create-reveal"
  | "create-password"
  | "import-choose"
  | "import-input"
  | "import-password"
  | "ready";

export default function LocalWalletCard() {
  const [vault, setVaultState] = useState<LocalWalletVault | null>(null);
  const [step, setStep] = useState<Step>("none");

  // create flow state
  const [newMnemonic, setNewMnemonic] = useState("");
  const [confirmedWritten, setConfirmedWritten] = useState(false);

  // import flow state
  const [importType, setImportType] = useState<"mnemonic" | "privateKey">("mnemonic");
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // shared password state
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pendingSecret, setPendingSecret] = useState<{ type: "mnemonic" | "privateKey"; value: string; publicKey: string } | null>(null);

  // reveal flow
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");

  useEffect(() => {
    const v = store.getVault();
    setVaultState(v);
    setStep(v ? "ready" : "none");
  }, []);

  const startCreate = () => {
    const mnemonic = generateMnemonic(12);
    setNewMnemonic(mnemonic);
    setConfirmedWritten(false);
    setStep("create-reveal");
  };

  const confirmCreateWritten = () => {
    const keypair = keypairFromMnemonic(newMnemonic);
    setPendingSecret({ type: "mnemonic", value: newMnemonic, publicKey: keypair.publicKey.toBase58() });
    setStep("create-password");
  };

  const startImport = () => {
    setImportValue("");
    setImportError(null);
    setStep("import-choose");
  };

  const submitImport = () => {
    setImportError(null);
    try {
      if (importType === "mnemonic") {
        if (!isValidMnemonic(importValue)) throw new Error("That doesn't look like a valid seed phrase.");
        const keypair = keypairFromMnemonic(importValue);
        setPendingSecret({ type: "mnemonic", value: importValue.trim(), publicKey: keypair.publicKey.toBase58() });
      } else {
        const keypair = keypairFromPrivateKey(importValue);
        setPendingSecret({ type: "privateKey", value: importValue.trim(), publicKey: keypair.publicKey.toBase58() });
      }
      setStep("import-password");
    } catch (e: any) {
      setImportError(e.message ?? "Invalid input.");
    }
  };

  const finishSetup = async () => {
    if (!pendingSecret) return;
    if (password.length < 8) return setImportError("Password must be at least 8 characters.");
    if (password !== passwordConfirm) return setImportError("Passwords don't match.");

    const encrypted = await encryptSecret(pendingSecret.value, password);
    const newVault: LocalWalletVault = {
      publicKey: pendingSecret.publicKey,
      secretType: pendingSecret.type,
      encrypted,
      createdAt: Date.now(),
    };
    store.setVault(newVault);
    setVaultState(newVault);
    setStep("ready");
    setPassword("");
    setPasswordConfirm("");
    setPendingSecret(null);
    setNewMnemonic("");
    setImportValue("");
    setImportError(null);
  };

  const reveal = async () => {
    if (!vault) return;
    setRevealError(null);
    try {
      const secret = await decryptSecret(vault.encrypted, revealPassword);
      setRevealedSecret(secret);
    } catch {
      setRevealError("Incorrect password.");
    }
  };

  const hideReveal = () => {
    setRevealedSecret(null);
    setRevealPassword("");
    setRevealError(null);
  };

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopyLabel("Copied ✓");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  };

  const deleteWallet = () => {
    if (!confirm("Delete this wallet from this browser? Make sure you've saved your seed phrase or private key — this cannot be undone.")) return;
    store.deleteVault();
    setVaultState(null);
    setStep("none");
    hideReveal();
  };

  // ---------- Render ----------

  if (step === "none") {
    return (
      <div className="card space-y-3">
        <span className="font-medium">My Wallet</span>
        <p className="text-xs text-muted">
          Create a new Solana wallet in your browser, or import an existing seed phrase / private key. Your
          keys are encrypted with a password you set and never leave this device.
        </p>
        <div className="flex gap-2">
          <button onClick={startCreate} className="flex-1 bg-accent text-black font-semibold rounded-xl2 py-3">
            Create New Wallet
          </button>
          <button onClick={startImport} className="flex-1 border border-border rounded-xl2 py-3">
            Import Wallet
          </button>
        </div>
      </div>
    );
  }

  if (step === "create-reveal") {
    return (
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-warn">
          <ShieldAlert size={18} />
          <span className="font-medium">Save your seed phrase</span>
        </div>
        <p className="text-xs text-muted">
          This is the ONLY way to recover this wallet. Write it down on paper and store it somewhere safe.
          Anyone with these 12 words has full control of any funds you send here. Anthropic and this app will
          never ask you for it.
        </p>
        <div className="grid grid-cols-3 gap-2 bg-surface2 rounded-xl p-3 text-sm">
          {newMnemonic.split(" ").map((word, i) => (
            <div key={i} className="text-center">
              <span className="text-muted text-[10px] mr-1">{i + 1}</span>
              {word}
            </div>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={confirmedWritten}
            onChange={(e) => setConfirmedWritten(e.target.checked)}
            className="mt-0.5"
          />
          I've written down my seed phrase and stored it somewhere safe.
        </label>
        <button
          disabled={!confirmedWritten}
          onClick={confirmCreateWritten}
          className="w-full bg-accent text-black font-semibold rounded-xl2 py-3 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === "import-choose" || step === "import-input") {
    return (
      <div className="card space-y-3">
        <span className="font-medium">Import Wallet</span>
        <div className="flex gap-2 bg-surface2 rounded-xl2 p-1">
          {(["mnemonic", "privateKey"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setImportType(t)}
              className={`flex-1 py-2 rounded-xl text-sm ${importType === t ? "bg-accent text-black font-semibold" : "text-muted"}`}
            >
              {t === "mnemonic" ? "Seed Phrase" : "Private Key"}
            </button>
          ))}
        </div>
        <textarea
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
          placeholder={importType === "mnemonic" ? "word1 word2 word3 ..." : "Base58 private key"}
          rows={3}
          className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none resize-none"
        />
        {importError && <div className="text-danger text-xs">{importError}</div>}
        <button onClick={submitImport} className="w-full bg-accent text-black font-semibold rounded-xl2 py-3">
          Continue
        </button>
      </div>
    );
  }

  if (step === "create-password" || step === "import-password") {
    return (
      <div className="card space-y-3">
        <span className="font-medium">Set a password</span>
        <p className="text-xs text-muted">
          This password encrypts your key on this device only — it is not sent anywhere and cannot be
          recovered if you forget it (you'd need your seed phrase / private key again).
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
        />
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
        />
        {importError && <div className="text-danger text-xs">{importError}</div>}
        <button onClick={finishSetup} className="w-full bg-accent text-black font-semibold rounded-xl2 py-3">
          Encrypt & Save Wallet
        </button>
      </div>
    );
  }

  // step === "ready"
  if (!vault) return null;
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">My Wallet</span>
        <button onClick={deleteWallet} className="text-danger">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="text-xs text-muted">{shortAddr(vault.publicKey, 6)}</div>

      <HoldingsList address={vault.publicKey} />

      <div className="border-t border-border pt-3 space-y-2">
        {!revealedSecret ? (
          <>
            <input
              type="password"
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              placeholder="Enter password to reveal"
              className="w-full bg-surface2 rounded-xl px-3 py-2 text-sm outline-none"
            />
            {revealError && <div className="text-danger text-xs">{revealError}</div>}
            <button onClick={reveal} className="w-full border border-border rounded-xl py-2 text-sm flex items-center justify-center gap-1.5">
              <Eye size={14} /> Reveal {vault.secretType === "mnemonic" ? "Seed Phrase" : "Private Key"}
            </button>
          </>
        ) : (
          <>
            <div className="bg-surface2 rounded-xl p-3 text-xs break-all font-mono">{revealedSecret}</div>
            <div className="flex gap-2">
              <button onClick={copySecret} className="flex-1 border border-border rounded-xl py-2 text-sm flex items-center justify-center gap-1.5">
                <Copy size={14} /> {copyLabel}
              </button>
              <button onClick={hideReveal} className="flex-1 border border-border rounded-xl py-2 text-sm flex items-center justify-center gap-1.5">
                <EyeOff size={14} /> Hide
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
