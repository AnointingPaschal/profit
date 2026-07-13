"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import { ArrowLeft, Copy } from "lucide-react";

export default function ReceivePage() {
  const router = useRouter();
  const { vault } = useLocalWallet();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!vault) return;
    QRCode.toDataURL(vault.publicKey, { width: 280, margin: 1, color: { dark: "#0B0E11", light: "#FFFFFF" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [vault]);

  const copy = () => {
    if (!vault) return;
    navigator.clipboard.writeText(vault.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!vault) {
    return (
      <div className="p-4">
        <div className="card text-sm text-muted">
          You need a wallet first — go to the Wallet tab and create or import one.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold">Receive</h1>
      </div>

      <div className="card flex flex-col items-center gap-4 py-6">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Wallet address QR code" className="rounded-xl2" width={220} height={220} />
        )}
        <div className="text-xs text-muted text-center break-all px-4">{vault.publicKey}</div>
        <button onClick={copy} className="border border-border rounded-xl2 px-6 py-2.5 text-sm flex items-center gap-2">
          <Copy size={14} /> {copied ? "Copied ✓" : "Copy Address"}
        </button>
      </div>

      <div className="card text-xs text-muted">
        Only send Solana (SPL) tokens and SOL to this address. Sending assets from another network will result in
        permanent loss.
      </div>
    </div>
  );
}
