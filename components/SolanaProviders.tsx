"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

require("@solana/wallet-adapter-react-ui/styles.css");

// Cast to `any` rather than using `@ts-expect-error`: different install environments can
// resolve slightly different peer versions of these wallet-adapter packages against
// @types/react, which makes a `@ts-expect-error` comment flip between "needed" and
// "unused" (itself a type error) depending on the machine. An `any` cast is inert either way.
const ConnectionProviderAny = ConnectionProvider as any;
const WalletProviderAny = WalletProvider as any;
const WalletModalProviderAny = WalletModalProvider as any;

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProviderAny endpoint={endpoint}>
      <WalletProviderAny wallets={wallets} autoConnect>
        <WalletModalProviderAny>{children}</WalletModalProviderAny>
      </WalletProviderAny>
    </ConnectionProviderAny>
  );
}
