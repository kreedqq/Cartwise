import type { ReactNode } from "react";
import { BadgeCheck } from "lucide-react";

import { MediaFrame } from "@/components/media/MediaFrame";
import { StarRating } from "@/components/media/StarRating";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFeedbackImage } from "@/hooks/useTrustExperience";
import { formatFeedbackMonth, publicDisplayName } from "@/lib/feedback";
import type { OrderFeedback } from "@/services/feedback";
import { Skeleton } from "@/components/ui/skeleton";

export function FeedbackPhoto({
  path,
  alt,
  priority = false,
}: {
  path: string | null | undefined;
  alt: string;
  priority?: boolean;
}) {
  const query = useFeedbackImage(path);
  if (!path) return null;
  return (
    <MediaFrame ratio="photo" className="rounded-lg">
      {query.isLoading ? <Skeleton className="h-full w-full" /> : null}
      {query.data ? (
        <img
          src={query.data}
          alt={alt}
          className="h-full w-full object-cover object-center"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
        />
      ) : null}
    </MediaFrame>
  );
}

export function FeedbackCard({
  item,
  priority = false,
  footer,
}: {
  item: OrderFeedback;
  priority?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden bg-card/95">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StarRating value={item.rating} readOnly />
          {item.is_featured ? <Badge>Hervorgehoben</Badge> : null}
        </div>
        <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          „{item.body}“
        </p>
        {item.image_path ? (
          <FeedbackPhoto path={item.image_path} alt="Bestellfoto des Kunden" priority={priority} />
        ) : null}
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-medium text-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            Verifizierte Bestellung
          </p>
          {item.image_path ? <p>✓ Echtes Kundenfoto</p> : null}
          <p>
            {publicDisplayName(item.display_name)} · {formatFeedbackMonth(item.created_at)}
          </p>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
