"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Wallet2, LineChart, ArrowLeftRight, Settings } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/positions", label: "Positions", icon: LineChart },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/wallet", label: "Wallet", icon: Wallet2 },
  { href: "/config", label: "Config", icon: Settings },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-surface/95 backdrop-blur
                 border-t border-border flex justify-around items-center py-2 z-50"
      style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px]",
              active ? "text-accent" : "text-muted"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
