import * as React from "react";

import { cn } from "@/lib/utils";

interface AdminSectionProps {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function AdminSection({ title, description, actions, children, className, padded = false }: AdminSectionProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-[0_1px_3px_0_hsl(var(--foreground)/0.04)]", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="space-y-0.5">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4")}>{children}</div>
    </div>
  );
}
