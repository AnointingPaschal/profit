import type { Metadata } from "next";
import "./globals.css";
import SolanaProviders from "@/components/SolanaProviders";
import { LocalWalletProvider } from "@/components/LocalWalletProvider";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Profit — Solana Sniper",
  description: "Low-mcap Solana token discovery, sniping, and portfolio tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaProviders>
          <LocalWalletProvider>
            <main className="tabbar-safe min-h-screen">{children}</main>
            <TabBar />
          </LocalWalletProvider>
        </SolanaProviders>
      </body>
    </html>
  );
}
