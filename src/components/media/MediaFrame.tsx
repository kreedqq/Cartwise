import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MediaFrame({
  ratio = "video",
  className,
  children,
}: {
  ratio?: "video" | "photo";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        ratio === "video" ? "aspect-video" : "aspect-[4/3]",
        className,
      )}
    >
      {children}
    </div>
  );
}
