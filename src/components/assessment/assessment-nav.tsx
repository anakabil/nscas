"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PhaseState } from "@/lib/assessments/workflow";
import { cn } from "@/lib/utils";

export interface AssessmentNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export interface AssessmentNavGroup {
  key: string;
  /** Judul kelompok; kosong untuk Ringkasan di bagian atas. */
  title?: string;
  state?: PhaseState;
  stateLabel?: string;
  items: AssessmentNavItem[];
}

function isActive(pathname: string, item: AssessmentNavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Halaman yang paling cocok dengan alamat saat ini (alamat terpanjang yang cocok menang, misalnya Kode QR atas Responden). */
function activeHref(pathname: string, groups: AssessmentNavGroup[]): string | null {
  const matches = groups.flatMap((g) => g.items).filter((item) => isActive(pathname, item));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function NavList({ groups, active }: { groups: AssessmentNavGroup[]; active: string | null }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key} className="space-y-1" data-testid={`assessment-nav-${group.key}`} data-state={group.state}>
          {group.title ? (
            <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold tracking-wide">
              {group.state === "done" ? (
                <CheckCircle2 aria-hidden className="text-success size-3.5" />
              ) : (
                <span aria-hidden className={cn("size-2 rounded-full", group.state === "current" ? "bg-brand-navy" : "bg-border")} />
              )}
              <span className={group.state === "current" ? "text-brand-navy-deep" : "text-muted-foreground"}>{group.title}</span>
              {group.stateLabel ? <span className="sr-only">({group.stateLabel})</span> : null}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const current = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "block rounded-md border-l-2 px-3 py-1.5 text-sm",
                      current
                        ? "border-brand-navy bg-card text-brand-navy-deep font-semibold"
                        : "text-foreground/80 hover:bg-card hover:text-foreground border-transparent",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Navigasi asesmen dikelompokkan per tahap alur kerja (docs/05 bagian 2). Desktop: kolom samping tetap.
 * Layar sempit: menu lipat yang menyebut halaman saat ini, memakai elemen details agar berfungsi tanpa skrip.
 */
export function AssessmentNav({ groups, label, menuLabel }: { groups: AssessmentNavGroup[]; label: string; menuLabel: string }) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups);
  const activeLabel = groups.flatMap((g) => g.items).find((item) => item.href === active)?.label;

  return (
    <>
      <nav aria-label={label} className="hidden lg:block">
        <div className="sticky top-6">
          <NavList groups={groups} active={active} />
        </div>
      </nav>
      <details className="group border-border bg-card rounded-xl border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-muted-foreground font-normal">{menuLabel}: </span>
            {activeLabel}
          </span>
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <nav aria-label={label} className="border-border border-t px-1 py-3">
          <NavList groups={groups} active={active} />
        </nav>
      </details>
    </>
  );
}
