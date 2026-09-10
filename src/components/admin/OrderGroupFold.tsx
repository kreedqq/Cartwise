import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface OrderGroupFoldProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function OrderGroupFold({ title, subtitle, children, defaultOpen = false }: OrderGroupFoldProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b border-border px-3 py-3 last:border-b-0 sm:px-4">
      <button type="button" className="flex w-full min-w-0 items-start gap-2 text-left" onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 transition-transform", open ? "rotate-0" : "-rotate-90")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
      </button>
      {open ? <div className="mt-3 min-w-0 pl-6">{children}</div> : null}
    </div>
  );
}
