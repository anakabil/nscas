import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-xl border px-4 py-3 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-tint text-brand-navy",
      success: "border-transparent bg-heat-good text-success",
      warning: "border-transparent bg-heat-mid text-warning",
      destructive: "border-transparent bg-heat-low text-danger",
    },
  },
  defaultVariants: { variant: "info" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert };
