"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Library,
  ArrowLeftRight,
  Coins,
  LineChart,
  Sparkles,
  Settings,
  Eye,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Landmark },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/securities", label: "Securities", icon: Library },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/dividends", label: "Dividends", icon: Coins },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/taxes", label: "Taxes", icon: Receipt },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const ADMIN_NAV_ITEM = { href: "/admin", label: "Admin", icon: ShieldCheck } as const;

export function SidebarNav({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: Role;
}) {
  const pathname = usePathname();
  const items = role === "ADMIN" ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
