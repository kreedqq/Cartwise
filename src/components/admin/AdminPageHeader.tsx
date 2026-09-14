import * as React from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  /** Primary page title. */
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Top-level hub label, e.g. Bestellungen. */
  section?: string;
  /** Sub-area label, e.g. Kit Gesuche. */
  subsection?: string;
  /** Optional breadcrumb trail after Admin. */
  breadcrumbs?: Array<{ label: string; to?: string }>;
}

export function AdminPageHeader({
  title,
  description,
  actions,
  className,
  section,
  subsection,
  breadcrumbs,
}: AdminPageHeaderProps) {
  // Avoid "Bestellungen · Bestellungen" when the leaf is the hub itself.
  const eyebrowSubsection = subsection && subsection !== section ? subsection : undefined;
  const showEyebrow = Boolean(section);
  const crumbs =
    breadcrumbs ??
    ([
      section ? { label: section } : null,
      eyebrowSubsection ? { label: eyebrowSubsection } : null,
    ].filter(Boolean) as Array<{ label: string; to?: string }>);

  return (
    <div className={cn("space-y-3", className)}>
      {crumbs.length > 0 ? (
        <nav aria-label="Brotkrumen" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          {crumbs.map((crumb) => (
            <React.Fragment key={`${crumb.label}-${crumb.to ?? ""}`}>
              <span aria-hidden>/</span>
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {showEyebrow && !eyebrowSubsection ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{section}</p>
          ) : null}
          {showEyebrow && eyebrowSubsection ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section}
              <span className="mx-1.5 text-border">·</span>
              {eyebrowSubsection}
            </p>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
