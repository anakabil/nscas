import { UiArrowRight } from "@/components/icons/nscas-icons";
import Link from "next/link";
import type { NavPage } from "@/lib/assessments/nav";
import { PAGE_ICONS } from "./nav-icons";

export interface QuickAccessTile {
  page: NavPage;
  href: string;
  label: string;
  hint: string;
}

/** Ubin bersimbol menuju halaman tahap yang sedang berjalan (Ringkasan asesmen). */
export function QuickAccess({ tiles, label }: { tiles: QuickAccessTile[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="quick-access">
        {tiles.map((tile) => {
          const Icon = PAGE_ICONS[tile.page];
          return (
            <li key={tile.href}>
              <Link
                href={tile.href}
                className="group border-border bg-card hover:border-brand-navy/40 hover:bg-tint/40 flex h-full items-start gap-3 rounded-xl border p-4 transition-colors"
              >
                <span aria-hidden className="bg-tint text-brand-navy flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {tile.label}
                    <UiArrowRight aria-hidden className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="text-muted-foreground block text-xs leading-relaxed">{tile.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
