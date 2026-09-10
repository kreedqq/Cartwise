import { Star } from "lucide-react";

import { starCountLabel } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const iconClass = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-0.5" aria-label={starCountLabel(value)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden
            className={cn(iconClass, star <= value ? "fill-primary text-primary" : "text-muted-foreground/40")}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Sternebewertung">
      {[1, 2, 3, 4, 5].map((star) => {
        const selected = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={starCountLabel(star)}
            className="min-h-11 min-w-11 rounded-md p-2 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange?.(star)}
          >
            <Star
              aria-hidden
              className={cn(iconClass, selected ? "fill-primary text-primary" : "text-muted-foreground/40")}
            />
          </button>
        );
      })}
    </div>
  );
}
