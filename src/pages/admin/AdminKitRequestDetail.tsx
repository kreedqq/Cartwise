import * as React from "react";
import { Link, useParams } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  useAdminCancelKitRequest,
  useAdminKitRequest,
  useAdminUpdateKitRequestMeta,
  useAdminUpdateKitRequestParticipantQuantity,
} from "@/hooks/useAdminKitRequests";
import {
  canSetOwnKitQuantity,
  kitRequestCustomerStatusLabel,
  maxOwnKitQuantity,
  otherParticipantsQuantity,
  ownQuantityOptions,
} from "@/lib/kitRequests";
import { KIT_SIZE_OPTIONS } from "@/lib/shop/kitUnits";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import {
  adminKitRpcErrorMessage,
  type AdminKitRequestDetail,
  type AdminKitRequestParticipant,
} from "@/services/adminKitRequests";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  );
}

function MetaEditForm({
  detail,
  saving,
  onSave,
}: {
  detail: AdminKitRequestDetail;
  saving: boolean;
  onSave: (input: { note: string; expiresAt: string; kitSize: string }) => void;
}) {
  const [note, setNote] = React.useState(detail.note ?? "");
  const [expiresAt, setExpiresAt] = React.useState(detail.expiresAt ? detail.expiresAt.slice(0, 16) : "");
  const [kitSize, setKitSize] = React.useState(String(detail.kitSizeVials));

  return (
    <AdminSection title="Bearbeiten" padded>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="kit-note">Notiz</Label>
          <Textarea id="kit-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kit-expires">Ablaufdatum</Label>
          <Input
            id="kit-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Kit Größe</Label>
          <Select
            value={kitSize}
            onValueChange={setKitSize}
            disabled={detail.status !== "open" || detail.anyParticipantOrdered}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIT_SIZE_OPTIONS.filter((size) => size >= detail.allocatedTotal).map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4">
        <Button type="button" onClick={() => onSave({ note, expiresAt, kitSize })} disabled={saving}>
          {saving ? "Speichern …" : "Metadaten speichern"}
        </Button>
      </div>
    </AdminSection>
  );
}

export default function AdminKitRequestDetailPage() {
  const { kitRequestId } = useParams<{ kitRequestId: string }>();
  const detailQuery = useAdminKitRequest(kitRequestId);
  const metaMutation = useAdminUpdateKitRequestMeta();
  const qtyMutation = useAdminUpdateKitRequestParticipantQuantity();
  const cancelMutation = useAdminCancelKitRequest();

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [editUserId, setEditUserId] = React.useState<string | null>(null);
  const [editQty, setEditQty] = React.useState("1");

  if (detailQuery.isLoading) return <FullScreenSpinner label="Kit Gesuch wird geladen …" />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        message="Kit Gesuch konnte nicht geladen werden."
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;

  const editingParticipant = detail.participants.find((p) => p.userId === editUserId) ?? null;
  const maxForEdit = editingParticipant
    ? maxOwnKitQuantity(detail.kitSizeVials, detail.allocatedTotal, editingParticipant.quantity)
    : 0;
  const qtyOptions = editingParticipant
    ? ownQuantityOptions(detail.kitSizeVials, detail.allocatedTotal, editingParticipant.quantity)
    : [];
  const previewOthers = editingParticipant
    ? otherParticipantsQuantity(detail.allocatedTotal, editingParticipant.quantity)
    : 0;
  const previewQty = Number(editQty);
  const previewTotal =
    editingParticipant && Number.isInteger(previewQty)
      ? previewOthers + previewQty
      : detail.allocatedTotal;

  async function saveMeta(input: { note: string; expiresAt: string; kitSize: string }) {
    try {
      await metaMutation.mutateAsync({
        id: detail.id,
        note: input.note,
        expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
        clearExpiresAt: !input.expiresAt,
        kitSizeVials: Number(input.kitSize) !== detail.kitSizeVials ? Number(input.kitSize) : null,
      });
      toast.success("Metadaten gespeichert.");
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Speichern fehlgeschlagen."));
    }
  }

  async function saveQuantity(participant: AdminKitRequestParticipant) {
    const quantity = Number(editQty);
    if (!canSetOwnKitQuantity(detail.kitSizeVials, detail.allocatedTotal, participant.quantity, quantity)) {
      toast.error("Die neue Menge überschreitet die verfügbare Kitgröße.");
      return;
    }
    try {
      await qtyMutation.mutateAsync({
        id: detail.id,
        participantUserId: participant.userId,
        quantity,
      });
      setEditUserId(null);
      toast.success("Teilnehmermenge aktualisiert.");
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Mengenänderung fehlgeschlagen."));
    }
  }

  async function confirmCancel() {
    try {
      await cancelMutation.mutateAsync(detail.id);
      setCancelOpen(false);
      toast.success("Kit Gesuch storniert.");
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Stornierung fehlgeschlagen."));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/kit-requests">Zurück zur Liste</Link>
        </Button>
      </div>

      <AdminPageHeader
        title={detail.productName}
        description={`${formatVendorDosageDisplay(detail.variantLabel, detail.productCode ?? detail.vendorCode ?? "")} · ${detail.allocatedTotal}/${detail.kitSizeVials} Kit`}
        actions={
          detail.canCancel ? (
            <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
              Kit stornieren
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {kitRequestCustomerStatusLabel(detail.status, detail.remainingVials)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Noch {detail.remainingVials} Plätze · {detail.participantCount} Teilnehmer
        </span>
      </div>

      <AdminSection title="Stammdaten" padded>
        <dl className="space-y-3">
          <MetaRow label="Ersteller" value={creatorHandle(detail.creatorUsername)} />
          <MetaRow label="Shop Area" value={detail.shopArea} />
          <MetaRow label="Vendor Code" value={detail.vendorCode ?? "—"} />
          <MetaRow label="Product Code" value={detail.productCode ?? "—"} />
          <MetaRow label="Product ID" value={detail.masterProductId ?? "—"} />
          <MetaRow label="Area Product ID" value={detail.areaProductId ?? "—"} />
          <MetaRow label="Kit Share ID" value={detail.id} />
          <MetaRow label="Erstellt" value={formatDate(detail.createdAt)} />
          <MetaRow label="Aktualisiert" value={formatDate(detail.updatedAt)} />
          <MetaRow label="Ablauf" value={formatDate(detail.expiresAt)} />
          <MetaRow label="Vollständig seit" value={formatDate(detail.completedAt)} />
          <MetaRow label="Cart Lines" value={String(detail.cartLineCount)} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Produkt- und Vendor-Identität können bei bestehenden Gesuchen nicht geändert werden.
        </p>
      </AdminSection>

      {detail.canEditMeta ? (
        <MetaEditForm
          key={`${detail.id}-${detail.updatedAt}`}
          detail={detail}
          saving={metaMutation.isPending}
          onSave={(input) => void saveMeta(input)}
        />
      ) : null}

      <AdminSection title="Teilnehmer verwalten" padded>
        <ul className="space-y-3">
          {detail.participants.map((participant) => (
            <li key={participant.userId} className="rounded-lg border border-border px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {creatorHandle(participant.username)}
                    {participant.isCreator ? (
                      <span className="ml-2 text-xs text-muted-foreground">Ersteller</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Menge {participant.quantity} · Beitritt {formatDate(participant.joinedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {participant.hasOrdered
                      ? `Bestellt ${formatDate(participant.orderedAt)}`
                      : participant.hasCartItem
                        ? "Im Warenkorb"
                        : "Noch keine Bestellung"}
                  </p>
                </div>
                {detail.canEditQuantities && !participant.hasOrdered ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditUserId(participant.userId);
                      setEditQty(String(participant.quantity));
                    }}
                  >
                    Menge ändern
                  </Button>
                ) : null}
              </div>

              {editUserId === participant.userId ? (
                <div className="mt-3 space-y-3 rounded-md bg-secondary/40 p-3">
                  <p className="text-sm">
                    Aktuell {participant.quantity} · Andere {previewOthers} · Kit {detail.kitSizeVials} · Max {maxForEdit}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {qtyOptions.map((qty) => (
                      <Button
                        key={qty}
                        type="button"
                        size="sm"
                        variant={Number(editQty) === qty ? "default" : "outline"}
                        onClick={() => setEditQty(String(qty))}
                      >
                        {qty}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vorschau: {Number.isInteger(previewQty) ? previewTotal : "—"} / {detail.kitSizeVials} ·{" "}
                    {Number.isInteger(previewQty) ? Math.max(0, detail.kitSizeVials - previewTotal) : "—"} frei
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={qtyMutation.isPending}
                      onClick={() => void saveQuantity(participant)}
                    >
                      Speichern
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditUserId(null)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {!detail.canEditQuantities ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Mengenänderungen sind in diesem Status nicht möglich
            {detail.anyParticipantOrdered ? " (bereits verarbeitet)." : "."}
          </p>
        ) : null}
      </AdminSection>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Kit stornieren?"
        description="Möchtest du dieses Kit Gesuch wirklich stornieren? Das Kit wird für weitere Beteiligungen geschlossen. Historische Bestellungen bleiben unverändert."
        confirmLabel="Kit stornieren"
        loading={cancelMutation.isPending}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
