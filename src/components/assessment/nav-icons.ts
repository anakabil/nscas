// Simbol menu NSCAS (docs/05 bagian 2): satu set ikon garis Lucide agar bentuk, ketebalan, dan ukurannya seragam.
// Dipakai kolom samping asesmen, akses cepat di Ringkasan, dan kepala halaman konsol.

import {
  Archive,
  Building2,
  Calculator,
  Camera,
  ChartColumn,
  ClipboardList,
  FileChartColumn,
  FileText,
  FolderOpen,
  Gavel,
  History,
  Inbox,
  Layers,
  LayoutGrid,
  ListChecks,
  ListTodo,
  type LucideIcon,
  MessagesSquare,
  QrCode,
  Scale,
  Settings2,
  SlidersHorizontal,
  Target,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import type { NavGroupKey, NavPage } from "@/lib/assessments/nav";

export const PAGE_ICONS: Record<NavPage, LucideIcon> = {
  overview: LayoutGrid,
  details: FileText,
  units: Building2,
  strata: Layers,
  parameters: SlidersHorizontal,
  sampling: Calculator,
  team: UsersRound,
  respondents: Users,
  qr: QrCode,
  participation: TrendingUp,
  selfAssessments: UserCheck,
  evidence: FolderOpen,
  observations: Camera,
  validation: MessagesSquare,
  scoring: ListChecks,
  panel: Gavel,
  dashboard: ChartColumn,
  gaps: ListTodo,
  report: FileChartColumn,
  audit: History,
};

export const GROUP_ICONS: Record<Exclude<NavGroupKey, "overview">, LucideIcon> = {
  PREPARATION: Settings2,
  DATA_COLLECTION: Inbox,
  SCORING: Scale,
  RESULTS: Target,
  OTHER: History,
};

/** Menu utama di kepala halaman konsol. */
export type ConsoleSection = "assessments" | "organizations" | "retention" | "account";

export const CONSOLE_ICONS: Record<ConsoleSection, LucideIcon> = {
  assessments: ClipboardList,
  organizations: Building2,
  retention: Archive,
  account: UserRound,
};
