import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublishedAnnouncements } from "@/hooks/useAnnouncements";
import { formatAnnouncementDate, isSafeExternalUrl } from "@/lib/announcements";

export default function AnnouncementsPage() {
  const feedQuery = usePublishedAnnouncements();
  const items = feedQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="PEPTIX" title="Ankündigungen" description="Kurze Updates aus der Plattform — neueste zuerst." />

      {feedQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      )}

      {feedQuery.isError && (
        <ErrorState message="Ankündigungen konnten nicht geladen werden." onRetry={() => feedQuery.refetch()} />
      )}

      {feedQuery.data && items.length === 0 && (
        <EmptyState title="Keine Ankündigungen vorhanden." />
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={item.id} className="overflow-hidden">
            {item.image_url && isSafeExternalUrl(item.image_url) ? (
              <img src={item.image_url} alt="" className="h-48 w-full object-cover" />
            ) : null}
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {item.pinned ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Gepinnt</span> : null}
                {index === 0 ? <span className="rounded-full bg-secondary px-2 py-0.5 text-foreground">Neu</span> : null}
                <span>{formatAnnouncementDate(item.published_at ?? item.created_at)}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.content}</p>
              {item.external_url && isSafeExternalUrl(item.external_url) ? (
                <Button asChild variant="outline" size="sm">
                  <a href={item.external_url} target="_blank" rel="noreferrer">
                    Mehr erfahren <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/shop">Weiter zum Shop</Link>
        </Button>
      </div>
    </div>
  );
}
