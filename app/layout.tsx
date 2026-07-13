import type { Metadata } from "next";
import "./globals.css";
import SolanaProviders from "@/components/SolanaProviders";
import { LocalWalletProvider } from "@/components/LocalWalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import TabBar from "@/components/TabBar";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Profit",
  description: "Solana token discovery & trading dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SolanaProviders>
            <LocalWalletProvider>
              <TopBar />
              <main className="tabbar-safe">{children}</main>
              <TabBar />
            </LocalWalletProvider>
          </SolanaProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
