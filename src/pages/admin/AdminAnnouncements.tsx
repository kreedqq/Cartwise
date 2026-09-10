import * as React from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminAnnouncements,
  useClearAnnouncementImage,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useReplaceAnnouncementImage,
  useSetAnnouncementPublished,
  useUpdateAnnouncement,
} from "@/hooks/useAnnouncements";
import { announcementFocalPosition, announcementImageSrc, formatAnnouncementDate } from "@/lib/announcements";
import type { Announcement, AnnouncementInput } from "@/services/announcements";
import { announcementPublicUrl } from "@/services/announcements";
import { toast } from "@/components/ui/toaster";

const EMPTY_FORM: AnnouncementInput = {
  title: "",
  content: "",
  published: false,
  pinned: false,
  image_url: "",
  image_path: null,
  image_focal_x: 50,
  image_focal_y: 50,
  external_url: "",
};

export default function AdminAnnouncementsPage() {
  const listQuery = useAdminAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const publishMutation = useSetAnnouncementPublished();
  const deleteMutation = useDeleteAnnouncement();
  const replaceImage = useReplaceAnnouncementImage();
  const clearImage = useClearAnnouncementImage();
  const [form, setForm] = React.useState<AnnouncementInput>(EMPTY_FORM);
  const [editing, setEditing] = React.useState<Announcement | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<Announcement | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = React.useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  function startEdit(item: Announcement) {
    setEditing(item);
    setForm({
      title: item.title,
      content: item.content,
      published: item.published,
      pinned: item.pinned,
      image_url: item.image_url ?? "",
      image_path: item.image_path,
      image_focal_x: item.image_focal_x ?? 50,
      image_focal_y: item.image_focal_y ?? 50,
      external_url: item.external_url ?? "",
    });
    setPendingFile(null);
    setPendingPreview(null);
    setRemoveExistingImage(false);
  }

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPendingFile(null);
    setPendingPreview(null);
    setRemoveExistingImage(false);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    try {
      const saved = editing
        ? await updateMutation.mutateAsync({ id: editing.id, input: form })
        : await createMutation.mutateAsync(form);
      if (pendingFile) {
        await replaceImage.mutateAsync({
          row: saved,
          file: pendingFile,
          focalX: form.image_focal_x ?? 50,
          focalY: form.image_focal_y ?? 50,
        });
      } else if (editing && removeExistingImage && editing.image_path) {
        await clearImage.mutateAsync(editing);
      }
      toast.success(editing ? "Ankündigung gespeichert." : "Ankündigung erstellt.");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  const items = listQuery.data ?? [];
  const previewUrl =
    pendingPreview ??
    (removeExistingImage ? null : announcementImageSrc(editing ?? { image_path: form.image_path ?? null, image_url: form.image_url ?? null }, announcementPublicUrl));

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Ankündigungen" description="Veröffentlichte Einträge erscheinen im Kundenbereich. Bilder optional im 16:9-Rahmen." />

      <AdminSection title={editing ? "Ankündigung bearbeiten" : "Neue Ankündigung"}>
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
          <div className="space-y-1.5">
            <Label>Ankündigungsbild (optional, 16:9)</Label>
            <ImageDropzone
              previewUrl={previewUrl}
              objectPosition={announcementFocalPosition({
                image_focal_x: form.image_focal_x,
                image_focal_y: form.image_focal_y,
              })}
              onFile={(file) => {
                if (pendingPreview) URL.revokeObjectURL(pendingPreview);
                setPendingFile(file);
                setPendingPreview(URL.createObjectURL(file));
                setRemoveExistingImage(false);
              }}
              onRemove={() => {
                if (pendingPreview) URL.revokeObjectURL(pendingPreview);
                setPendingFile(null);
                setPendingPreview(null);
                setRemoveExistingImage(true);
              }}
            />
          </div>
          {previewUrl ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-focal-x">Bildfokus X ({form.image_focal_x ?? 50}%)</Label>
                <input
                  id="announcement-focal-x"
                  type="range"
                  min={0}
                  max={100}
                  value={form.image_focal_x ?? 50}
                  onChange={(event) => setForm((current) => ({ ...current, image_focal_x: Number(event.target.value) }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-focal-y">Bildfokus Y ({form.image_focal_y ?? 50}%)</Label>
                <input
                  id="announcement-focal-y"
                  type="range"
                  min={0}
                  max={100}
                  value={form.image_focal_y ?? 50}
                  onChange={(event) => setForm((current) => ({ ...current, image_focal_y: Number(event.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="announcement-link">Link (optional)</Label>
            <Input
              id="announcement-link"
              value={form.external_url ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, external_url: event.target.value }))}
            />
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
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending || replaceImage.isPending}>
              {editing ? "Speichern" : "Erstellen"}
            </Button>
            {editing ? (
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
                  {item.image_path || item.image_url ? " · Mit Bild" : ""}
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
                <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteRow(item)}>
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminSection>

      <ConfirmDialog
        open={deleteRow != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
        title="Ankündigung löschen?"
        description="Die Ankündigung und das zugehörige Bild werden dauerhaft entfernt."
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
