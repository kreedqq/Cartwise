import * as React from "react";

import {
  AREA_PAGE_COPY,
  AREA_PAGE_DESCRIPTION,
  AREA_PAGE_EYEBROW,
  AREA_PAGE_HEADER,
  AREA_PAGE_TITLE,
  AREA_SECTION_COPY,
  AREA_SECTION_DESCRIPTION,
  AREA_SECTION_EYEBROW,
  AREA_SECTION_TITLE,
} from "@/lib/shop/areaLayout";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function AreaSectionHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(AREA_SECTION_COPY, className)}>
      {eyebrow ? <p className={AREA_SECTION_EYEBROW}>{eyebrow}</p> : null}
      <h2 className={AREA_SECTION_TITLE}>{title}</h2>
      {description ? <div className={AREA_SECTION_DESCRIPTION}>{description}</div> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn(AREA_PAGE_HEADER, className)}>
      <div className={AREA_PAGE_COPY}>
        {eyebrow && eyebrow !== title ? <p className={AREA_PAGE_EYEBROW}>{eyebrow}</p> : null}
        <h1 className={AREA_PAGE_TITLE}>{title}</h1>
        {description ? <div className={AREA_PAGE_DESCRIPTION}>{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
