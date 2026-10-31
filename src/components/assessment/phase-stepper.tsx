import { Check } from "lucide-react";
import type { PhaseState } from "@/lib/assessments/workflow";
import { cn } from "@/lib/utils";

export interface StepperPhase {
  key: string;
  label: string;
  state: PhaseState;
  stateLabel: string;
  /** Nama status saat ini, hanya untuk tahap yang sedang berjalan. */
  detail?: string;
}

/** Penanda kemajuan empat tahap asesmen: mendatar di layar lebar, menurun di telepon. */
export function PhaseStepper({ phases, label }: { phases: StepperPhase[]; label: string }) {
  return (
    <ol aria-label={label} className="grid gap-3 sm:grid-cols-4 sm:gap-0" data-testid="phase-stepper">
      {phases.map((phase, index) => (
        <li
          key={phase.key}
          data-state={phase.state}
          aria-current={phase.state === "current" ? "step" : undefined}
          className="relative flex items-start gap-3 sm:flex-col sm:gap-2 sm:pr-4"
        >
          {index < phases.length - 1 ? (
            <span
              aria-hidden
              className={cn("absolute top-4 left-8 hidden h-0.5 w-[calc(100%-2rem)] sm:block", phase.state === "done" ? "bg-success/50" : "bg-border")}
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
              phase.state === "done" && "border-success bg-success text-white",
              phase.state === "current" && "border-brand-navy bg-brand-navy text-white",
              phase.state === "upcoming" && "border-border bg-card text-muted-foreground",
            )}
          >
            {phase.state === "done" ? <Check className="size-4" /> : index + 1}
          </span>
          <span className="space-y-0.5">
            <span className={cn("block text-sm font-semibold", phase.state === "upcoming" && "text-muted-foreground")}>{phase.label}</span>
            <span className={cn("block text-xs", phase.state === "current" ? "text-brand-navy" : "text-muted-foreground")}>
              {phase.detail ?? phase.stateLabel}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
