import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card placeholder:text-muted-foreground flex h-11 w-full min-w-0 rounded-md border px-3 py-2 text-base outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input bg-card flex h-11 w-full rounded-md border px-3 py-2 text-base outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Select };
