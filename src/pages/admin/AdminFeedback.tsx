import * as React from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import {
  useAdminDeleteFeedback,
  useAdminFeedback,
  useAdminRemoveFeedbackImage,
  useAdminUpdateFeedback,
} from "@/hooks/useTrustExperience";
import { matchesAdminFeedbackFilter, type AdminFeedbackFilter } from "@/lib/feedback";
import type { AdminFeedbackRow, OrderFeedback } from "@/services/feedback";

const FILTERS: Array<{ id: AdminFeedbackFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "pending", label: "Ausstehend" },
  { id: "approved", label: "Freigegeben" },
  { id: "rejected", label: "Abgelehnt" },
  { id: "hidden", label: "Ausgeblendet" },
  { id: "with_image", label: "Mit Bild" },
  { id: "without_image", label: "Ohne Bild" },
  { id: "stars_5", label: "5 Sterne" },
  { id: "stars_4", label: "4 Sterne" },
  { id: "stars_3", label: "3 Sterne" },
  { id: "stars_2", label: "2 Sterne" },
  { id: "stars_1", label: "1 Stern" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "AUSSTEHEND",
  approved: "FREIGEGEBEN",
  rejected: "ABGELEHNT",
  hidden: "AUSGEBLENDET",
};

export default function AdminFeedbackPage() {
  const listQuery = useAdminFeedback();
  const updateMutation = useAdminUpdateFeedback();
  const deleteMutation = useAdminDeleteFeedback();
  const removeImage = useAdminRemoveFeedbackImage();
  const [filter, setFilter] = React.useState<AdminFeedbackFilter>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [deleteRow, setDeleteRow] = React.useState<OrderFeedback | null>(null);

  const items = (listQuery.data ?? []).filter((row) => matchesAdminFeedbackFilter(row, filter));

  async function patch(row: OrderFeedback, next: Parameters<typeof updateMutation.mutateAsync>[0]["patch"]) {
    try {
      await updateMutation.mutateAsync({ id: row.id, patch: next });
      toast.success("Feedback aktualisiert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Feedback" description="Verifizierte Bestellbewertungen moderieren. Keine Bestellungen werden verändert." />

      <AdminSection title="Filter" padded>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </AdminSection>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : null}
      {listQuery.isError ? (
        <ErrorState message="Feedback konnte nicht geladen werden." onRetry={() => listQuery.refetch()} />
      ) : null}
      {listQuery.data && items.length === 0 ? <EmptyState title="Keine Bewertungen für diesen Filter." /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((row: AdminFeedbackRow) => (
          <FeedbackCard
            key={row.id}
            item={row}
            footer={
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Status: {STATUS_LABEL[row.status] ?? row.status}
                  {row.orders?.order_number ? ` · ${row.orders.order_number}` : ""}
                </p>
                {editingId === row.id ? (
                  <div className="space-y-2">
                    <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={4} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void patch(row, { body: editBody }).then(() => setEditingId(null));
                        }}
                      >
                        Text speichern
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void patch(row, { status: "approved" })}>
                    Freigeben
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void patch(row, { status: "rejected" })}>
                    Ablehnen
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void patch(row, { status: "hidden" })}>
                    Ausblenden
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void patch(row, { is_featured: !row.is_featured })}
                  >
                    {row.is_featured ? "Hervorhebung entfernen" : "Hervorheben"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditBody(row.body);
                    }}
                  >
                    Bearbeiten
                  </Button>
                  {row.image_path ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void removeImage.mutateAsync(row)}>
                      Bild entfernen
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteRow(row)}>
                    Löschen
                  </Button>
                </div>
              </div>
            }
          />
        ))}
      </div>

      <ConfirmDialog
        open={deleteRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
        title="Bewertung löschen?"
        description="Die Bewertung und das zugehörige Bild werden entfernt. Die Bestellung bleibt unverändert."
        confirmLabel="Löschen"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteRow) return;
          await deleteMutation.mutateAsync(deleteRow);
          setDeleteRow(null);
        }}
      />
    </div>
  );
}
