import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="border-border bg-card w-full overflow-x-auto rounded-xl border">
      <table data-slot="table" className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-alt text-muted-foreground", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-border border-b last:border-b-0", className)} {...props} />;
}

function TableHeaderCell({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-3 font-semibold", className)} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-top", className)} {...props} />;
}

export { Table, TableHead, TableRow, TableHeaderCell, TableCell };
