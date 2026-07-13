"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLocalWallet } from "@/components/LocalWalletProvider";
import LocalWalletCard from "@/components/LocalWalletCard";
import { formatUsd, formatTokenPrice, shortAddr } from "@/lib/format";
import { Holding } from "@/app/api/holdings/route";
import {
  ArrowUp, ArrowDown, ArrowLeftRight, Clock,
  Eye, EyeOff, Plus,
} from "lucide-react";

export default function WalletPage() {
  const { vault } = useLocalWallet();
  const { publicKey } = useWallet();

  const [solBal, setSolBal] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);

  const owner = vault?.publicKey ?? publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!owner) { setLoading(false); return; }
    const load = () =>
      fetch(`/api/holdings?owner=${owner}`)
        .then(r => r.json())
        .then(d => {
          if (!d.error) {
            setSolBal(d.solBalance);
            setSolPrice(d.solPriceUsd);
            setHoldings(d.holdings);
          }
        })
        .finally(() => setLoading(false));
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [owner]);

  const solValueUsd = (solBal ?? 0) * (solPrice ?? 0);
  const tokenValueUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const totalUsd = solValueUsd + tokenValueUsd;

  const fmt = (n: number) =>
    hideBalance ? "••••••" : formatUsd(n);

  return (
    <div className="p-3 space-y-3 pb-6">

      {/* ── Portfolio balance card ── */}
      <div className="relative rounded-xl3 overflow-hidden p-4"
        style={{
          background: "linear-gradient(135deg, #0F1E40 0%, #1A2E55 50%, #0C1830 100%)",
          minHeight: 200,
        }}>
        {/* Decorative circles */}
        <div className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2563EB, transparent)", transform: "translate(30%, -30%)" }} />
        <div className="absolute right-10 bottom-0 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #10B981, transparent)", transform: "translateY(40%)" }} />

        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/60 text-2xs">
              <div className="w-5 h-5 rounded-lg bg-white/10 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              Portfolio Balance
            </div>
            <button onClick={() => setHideBalance(h => !h)} className="text-white/40 w-7 h-7 bg-white/10 rounded-full flex items-center justify-center">
              {hideBalance ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>

          <div>
            <div className="text-3xl font-bold text-white">{fmt(totalUsd)}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-2xs font-medium text-accent bg-accent/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                ↑ +0.00% 24h
              </span>
              <span className="text-2xs text-white/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                Solana
              </span>
            </div>
          </div>

          <div className="h-px bg-white/10 my-1" />

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/8 rounded-xl p-2.5">
              <div className="text-2xs text-white/40 mb-0.5">SOL</div>
              <div className="text-xs font-semibold text-white">{hideBalance ? "••••" : (solBal?.toFixed(4) ?? "—")}</div>
              <div className="text-2xs text-white/40">{fmt(solValueUsd)}</div>
            </div>
            <div className="bg-white/8 rounded-xl p-2.5">
              <div className="text-2xs text-white/40 mb-0.5">Assets</div>
              <div className="text-xs font-semibold text-white">{holdings.length}</div>
              <div className="text-2xs text-white/40">tokens</div>
            </div>
            <div className="bg-white/8 rounded-xl p-2.5">
              <div className="text-2xs text-white/40 mb-0.5">Network</div>
              <div className="text-xs font-semibold text-white">SOL</div>
              <div className="text-2xs text-white/40">Mainnet</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="surface">
        <div className="flex justify-around">
          {[
            { href: "/wallet/send",    icon: ArrowUp,          label: "Send" },
            { href: "/wallet/receive", icon: ArrowDown,        label: "Receive" },
            { href: "/trade",          icon: ArrowLeftRight,   label: "Swap" },
            { href: "/wallet/history", icon: Clock,            label: "History" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={label} href={href} className="action-btn">
              <div className="icon dark:bg-[var(--card2)]">
                <Icon size={16} />
              </div>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── My Assets ── */}
      {!owner ? (
        <div className="surface text-center py-6 space-y-3">
          <p className="text-xs text-[var(--muted)]">Create or import a wallet to see your portfolio.</p>
          <LocalWalletCard />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--txt)]">My Assets</span>
            <button className="flex items-center gap-1 bg-[var(--txt)] text-[var(--bg)] text-2xs font-semibold px-2.5 py-1.5 rounded-xl">
              <Plus size={11} /> Import
            </button>
          </div>

          <div className="surface !p-0 overflow-hidden divide-y divide-[var(--border)]">
            {/* SOL row */}
            <AssetRow
              logo={null}
              initial="SOL"
              name="Solana"
              priceUsd={solPrice ?? 0}
              change24h={null}
              balance={solBal ?? 0}
              symbol="SOL"
              valueUsd={solValueUsd}
              hideBalance={hideBalance}
              href={null}
            />
            {holdings.map(h => (
              <AssetRow
                key={h.mint}
                logo={h.logoUrl ?? null}
                initial={h.symbol[0]}
                name={h.name}
                priceUsd={h.priceUsd ?? 0}
                change24h={null}
                balance={h.amount}
                symbol={h.symbol}
                valueUsd={h.valueUsd ?? 0}
                hideBalance={hideBalance}
                href={`/token/${h.mint}`}
              />
            ))}
            {loading && (
              <div className="py-6 text-center text-2xs text-[var(--muted)]">Loading holdings…</div>
            )}
            {!loading && holdings.length === 0 && (
              <div className="py-6 text-center text-2xs text-[var(--muted)]">No SPL tokens found for this address.</div>
            )}
          </div>

          {/* Backup & Security */}
          <details className="surface">
            <summary className="text-xs font-medium text-[var(--sub)] cursor-pointer py-0.5">
              Backup &amp; Security
            </summary>
            <div className="mt-3">
              <LocalWalletCard />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function AssetRow({ logo, initial, name, priceUsd, change24h, balance, symbol, valueUsd, hideBalance, href }: {
  logo: string | null; initial: string; name: string; priceUsd: number;
  change24h: number | null; balance: number; symbol: string; valueUsd: number;
  hideBalance: boolean; href: string | null;
}) {
  const Inner = (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--card2)] flex items-center justify-center shrink-0 relative">
        {logo
          ? <Image src={logo} alt="" fill sizes="36px" className="object-cover" unoptimized />
          : <span className="text-xs font-bold text-[var(--sub)]">{initial}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-[var(--txt)]">{symbol}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-2xs text-[var(--muted)]">{formatTokenPrice(priceUsd)}</span>
          {change24h !== null && (
            <span className={`text-2xs font-medium px-1 py-0.5 rounded ${change24h >= 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}>
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-semibold text-[var(--txt)]">{hideBalance ? "••••" : formatUsd(valueUsd)}</div>
        <div className="text-2xs text-[var(--muted)] mt-0.5">
          {hideBalance ? "••••" : `${balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`}
        </div>
      </div>
    </div>
  );

  return href
    ? <a href={href}>{Inner}</a>
    : <div>{Inner}</div>;
}
