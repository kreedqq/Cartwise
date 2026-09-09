import * as React from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useSetAnnouncementPublished,
  useUpdateAnnouncement,
} from "@/hooks/useAnnouncements";
import { formatAnnouncementDate } from "@/lib/announcements";
import type { Announcement, AnnouncementInput } from "@/services/announcements";
import { toast } from "@/components/ui/toaster";

const EMPTY_FORM: AnnouncementInput = {
  title: "",
  content: "",
  published: false,
  pinned: false,
  image_url: "",
  external_url: "",
};

export default function AdminAnnouncementsPage() {
  const listQuery = useAdminAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const publishMutation = useSetAnnouncementPublished();
  const deleteMutation = useDeleteAnnouncement();
  const [form, setForm] = React.useState<AnnouncementInput>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      published: item.published,
      pinned: item.pinned,
      image_url: item.image_url ?? "",
      external_url: item.external_url ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: form });
        toast.success("Ankündigung gespeichert.");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Ankündigung erstellt.");
      }
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  const items = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Ankündigungen" description="News für den Kunden-Feed nach Login." />

      <AdminSection title={editingId ? "Ankündigung bearbeiten" : "Neue Ankündigung"}>
        <form className="space-y-3 p-4" onSubmit={(event) => void handleSave(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Titel</Label>
            <Input
              id="announcement-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
              maxLength={160}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-content">Inhalt</Label>
            <Textarea
              id="announcement-content"
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              required
              maxLength={8000}
              rows={6}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-image">Bild-URL (optional)</Label>
              <Input
                id="announcement-image"
                value={form.image_url ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announcement-link">Link (optional)</Label>
              <Input
                id="announcement-link"
                value={form.external_url ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, external_url: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.published)}
                onCheckedChange={(value) => setForm((current) => ({ ...current, published: value === true }))}
              />
              Veröffentlicht
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.pinned)}
                onCheckedChange={(value) => setForm((current) => ({ ...current, pinned: value === true }))}
              />
              Anpinnen
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Speichern" : "Erstellen"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Abbrechen
              </Button>
            ) : null}
          </div>
        </form>
      </AdminSection>

      <AdminSection title="Alle Ankündigungen">
        {listQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : null}
        {listQuery.isError ? (
          <ErrorState message="Ankündigungen konnten nicht geladen werden." onRetry={() => listQuery.refetch()} />
        ) : null}
        {listQuery.data && items.length === 0 ? (
          <EmptyState title="Noch keine Ankündigungen" />
        ) : null}
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.published ? "Veröffentlicht" : "Entwurf"}
                  {item.pinned ? " · Gepinnt" : ""}
                  {item.published_at ? ` · ${formatAnnouncementDate(item.published_at)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                  Bearbeiten
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={publishMutation.isPending}
                  onClick={() => void publishMutation.mutateAsync({ id: item.id, published: !item.published })}
                >
                  {item.published ? "Zurücknehmen" : "Veröffentlichen"}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteId(item.id)}>
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminSection>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Ankündigung löschen?"
        description="Die Ankündigung wird dauerhaft entfernt."
        confirmLabel="Löschen"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteId) return;
          await deleteMutation.mutateAsync(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
