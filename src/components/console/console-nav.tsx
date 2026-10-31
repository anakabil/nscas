"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ConsoleNavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Tautan utama di kepala halaman konsol (latar biru batu gelap). Tampilan desktop; di telepon memakai ConsoleMenu. */
export function ConsoleNav({ items, label }: { items: ConsoleNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden items-center gap-1 text-sm font-semibold md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 transition-colors",
              active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu lipat untuk layar sempit; memakai elemen details agar tetap berfungsi tanpa skrip. */
export function ConsoleMenu({ items, label, menuLabel, signedInAs, logout }: { items: ConsoleNavItem[]; label: string; menuLabel: string; signedInAs: string; logout: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <details className="group relative ml-auto md:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
        {menuLabel}
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="bg-card text-card-foreground border-border absolute right-0 z-20 mt-2 w-64 space-y-1 rounded-xl border p-2 shadow-lg">
        <nav aria-label={label} className="flex flex-col">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("rounded-md px-3 py-2 text-sm font-semibold", active ? "bg-tint text-brand-navy-deep" : "hover:bg-tint")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-border space-y-2 border-t px-3 pt-3 pb-1">
          <p className="text-muted-foreground text-xs">{signedInAs}</p>
          {logout}
        </div>
      </div>
    </details>
  );
}
