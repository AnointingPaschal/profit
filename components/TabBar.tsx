"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Wallet2, LineChart, ArrowLeftRight, Settings } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/discover", icon: Compass,      label: "Discover" },
  { href: "/positions", icon: LineChart,   label: "Positions" },
  { href: "/trade",     icon: ArrowLeftRight, label: "Trade" },
  { href: "/wallet",    icon: Wallet2,     label: "Wallet" },
  { href: "/config",    icon: Settings,    label: "Config" },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50"
      style={{
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex justify-around items-center py-1.5">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg",
                active ? "text-accent" : "text-[var(--muted)]")}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-2xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
