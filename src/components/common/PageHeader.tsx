import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-semibold sm:text-[2.35rem]">{title}</h1>
        {description && <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
