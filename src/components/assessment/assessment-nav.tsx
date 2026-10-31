"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroupKey, NavPage } from "@/lib/assessments/nav";
import type { PhaseState } from "@/lib/assessments/workflow";
import { cn } from "@/lib/utils";
import { GROUP_ICONS, PAGE_ICONS } from "./nav-icons";

export interface AssessmentNavItem {
  page: NavPage;
  href: string;
  label: string;
  exact?: boolean;
}

export interface AssessmentNavGroup {
  key: NavGroupKey;
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

function NavLink({ item, current }: { item: AssessmentNavItem; current: boolean }) {
  const Icon = PAGE_ICONS[item.page];
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        current ? "bg-card text-brand-navy-deep font-semibold shadow-xs" : "text-foreground/75 hover:bg-card hover:text-foreground",
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0", current ? "text-brand-navy" : "text-muted-foreground")} />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function PhaseMarker({ state }: { state?: PhaseState }) {
  if (state === "done") {
    return (
      <span aria-hidden className="bg-success/15 text-success flex size-4 items-center justify-center rounded-full">
        <Check className="size-3" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "current") return <span aria-hidden className="bg-brand-navy size-2 rounded-full" />;
  return null;
}

function NavList({ groups, active }: { groups: AssessmentNavGroup[]; active: string | null }) {
  return (
    <div className="space-y-1">
      {groups.map((group) => {
        if (!group.title) {
          return (
            <div key={group.key} className="pb-2" data-testid={`assessment-nav-${group.key}`}>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} current={item.href === active} />
              ))}
            </div>
          );
        }
        const GroupIcon = GROUP_ICONS[group.key as Exclude<NavGroupKey, "overview">];
        // Kelompok selain tahap (Lainnya) selalu terbuka; kelompok tahap terbuka bila sedang berjalan atau memuat
        // halaman yang sedang dibuka, sehingga menu hanya menampilkan yang relevan.
        if (!group.state) {
          return (
            <div key={group.key} className="border-border mt-2 border-t pt-3" data-testid={`assessment-nav-${group.key}`}>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} current={item.href === active} />
              ))}
            </div>
          );
        }
        const open = group.state === "current" || group.items.some((item) => item.href === active);
        return (
          <details key={`${group.key}-${open}`} open={open} className="group/phase" data-testid={`assessment-nav-${group.key}`} data-state={group.state}>
            <summary className="hover:bg-card flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md",
                  group.state === "current" ? "bg-brand-navy text-white" : "bg-tint text-brand-navy",
                )}
              >
                <GroupIcon className="size-3.5" strokeWidth={2} />
              </span>
              <span className={cn("min-w-0 flex-1 text-sm leading-snug font-semibold", group.state === "upcoming" && "text-muted-foreground")}>{group.title}</span>
              <PhaseMarker state={group.state} />
              {group.stateLabel ? <span className="sr-only">({group.stateLabel})</span> : null}
              <ChevronDown aria-hidden className="text-muted-foreground size-4 shrink-0 transition-transform group-open/phase:rotate-180" />
            </summary>
            <div className="border-border mt-0.5 mb-2 ml-6 space-y-0.5 border-l pl-2">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} current={item.href === active} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * Navigasi asesmen dikelompokkan per tahap alur kerja (docs/05 bagian 2), dengan simbol untuk setiap halaman.
 * Desktop: kolom samping tetap. Layar sempit: menu lipat yang menyebut halaman saat ini.
 */
export function AssessmentNav({ groups, label, menuLabel }: { groups: AssessmentNavGroup[]; label: string; menuLabel: string }) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups);
  const activeItem = groups.flatMap((g) => g.items).find((item) => item.href === active);
  const ActiveIcon = activeItem ? PAGE_ICONS[activeItem.page] : null;

  return (
    <>
      <nav aria-label={label} className="hidden lg:block">
        <div className="sticky top-6">
          <NavList groups={groups} active={active} />
        </div>
      </nav>
      <details className="group border-border bg-card rounded-xl border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            {ActiveIcon ? <ActiveIcon aria-hidden strokeWidth={1.75} className="text-brand-navy size-4 shrink-0" /> : null}
            <span className="text-muted-foreground font-normal">{menuLabel}:</span>
            <span className="truncate">{activeItem?.label}</span>
          </span>
          <ChevronDown aria-hidden className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label={label} className="border-border border-t px-2 py-3">
          <NavList groups={groups} active={active} />
        </nav>
      </details>
    </>
  );
}
