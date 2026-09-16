import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { KitIntegritySection } from "@/components/admin/KitIntegritySection";
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
  useAdminDeleteKitRequest,
  useAdminKitReconcileReport,
  useAdminKitRequest,
  useAdminSearchKitRequestUsers,
  useAdminSetKitRequestDistribution,
  useAdminSyncKitFullOrders,
  useAdminUpdateKitRequestMeta,
} from "@/hooks/useAdminKitRequests";
import {
  kitFullOrderSyncListLabel,
  kitFullOrderSyncParticipantLabel,
} from "@/lib/kitFullOrderSync";
import { KIT_ALMOST_FULL_REMAINING_THRESHOLD } from "@/lib/kit/kitShareState";
import { kitRequestStatusLabel } from "@/lib/kitRequests";
import { KIT_SIZE_OPTIONS } from "@/lib/shop/kitUnits";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import {
  adminKitRpcErrorMessage,
  type AdminKitRequestDetail,
} from "@/services/adminKitRequests";

type DraftRow = {
  key: string;
  userId: string;
  username: string;
  quantity: number;
};

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

function adminStatusLabel(status: string, remainingVials: number): string {
  if (
    status === "open" &&
    remainingVials > 0 &&
    remainingVials <= KIT_ALMOST_FULL_REMAINING_THRESHOLD
  ) {
    return "Fast voll";
  }
  return kitRequestStatusLabel(status);
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  );
}

function rowsFromDetail(detail: AdminKitRequestDetail): DraftRow[] {
  return detail.participants.map((p) => ({
    key: p.userId,
    userId: p.userId,
    username: p.username,
    quantity: p.quantity,
  }));
}

function MetaEditForm({
  detail,
  saving,
  onSave,
  onCancel,
}: {
  detail: AdminKitRequestDetail;
  saving: boolean;
  onSave: (input: { note: string; expiresAt: string; kitSize: string }) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = React.useState(detail.note ?? "");
  const [expiresAt, setExpiresAt] = React.useState(detail.expiresAt ? detail.expiresAt.slice(0, 16) : "");
  const [kitSize, setKitSize] = React.useState(String(detail.kitSizeVials));

  return (
    <AdminSection title="Metadaten bearbeiten" padded>
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
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSave({ note, expiresAt, kitSize })} disabled={saving}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
      </div>
    </AdminSection>
  );
}

function DistributionEditor({
  detail,
  saving,
  onSave,
}: {
  detail: AdminKitRequestDetail;
  saving: boolean;
  onSave: (rows: DraftRow[]) => Promise<void>;
}) {
  const [rows, setRows] = React.useState<DraftRow[]>(() => rowsFromDetail(detail));
  const [search, setSearch] = React.useState("");
  const [addQty, setAddQty] = React.useState("1");
  const [showAdd, setShowAdd] = React.useState(false);
  const searchQuery = useAdminSearchKitRequestUsers(search, showAdd);

  const draftTotal = rows.reduce((sum, row) => sum + (Number.isInteger(row.quantity) ? row.quantity : 0), 0);
  const overCapacity = draftTotal > detail.kitSizeVials;
  const free = Math.max(0, detail.kitSizeVials - draftTotal);
  const baseline = React.useMemo(
    () =>
      JSON.stringify(
        rowsFromDetail(detail).map((r) => ({ userId: r.userId, quantity: r.quantity })),
      ),
    [detail],
  );
  const current = JSON.stringify(rows.map((r) => ({ userId: r.userId, quantity: r.quantity })));
  const dirty = baseline !== current;

  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function updateQty(userId: string, value: string) {
    const qty = Number(value);
    setRows((prev) =>
      prev.map((row) =>
        row.userId === userId
          ? { ...row, quantity: Number.isInteger(qty) ? qty : row.quantity }
          : row,
      ),
    );
  }

  function removeRow(userId: string) {
    setRows((prev) => prev.filter((row) => row.userId !== userId));
  }

  function addUser(hit: { userId: string; username: string }) {
    if (rows.some((row) => row.userId === hit.userId)) {
      toast.error("Dieser Benutzer ist bereits Teilnehmer dieses Kits.");
      return;
    }
    const qty = Number(addQty);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Ungültige Menge.");
      return;
    }
    setRows((prev) => [
      ...prev,
      { key: hit.userId, userId: hit.userId, username: hit.username, quantity: qty },
    ]);
    setSearch("");
    setAddQty("1");
    setShowAdd(false);
  }

  return (
    <AdminSection title="Kit Verteilung" padded>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span>
          Kit Größe <strong>{detail.kitSizeVials}</strong>
        </span>
        <span>
          Verteilt{" "}
          <strong className={overCapacity ? "text-destructive" : undefined}>
            {draftTotal} / {detail.kitSizeVials}
          </strong>
        </span>
        <span>
          Frei <strong>{overCapacity ? 0 : free}</strong>
        </span>
        <Badge variant="secondary">{adminStatusLabel(detail.status, detail.remainingVials)}</Badge>
        {detail.customerMutationLocked ? (
          <Badge variant="outline">
            {detail.customerLockReason === "partial_order" ? "Teilbestellt · gesperrt" : "Gesperrt"}
          </Badge>
        ) : null}
        {dirty ? <Badge variant="outline">Ungespeicherte Änderungen</Badge> : null}
        {overCapacity ? <Badge variant="destructive">Kit ist überbelegt</Badge> : null}
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
          >
            <span className="min-w-[7rem] flex-1 font-medium">{creatorHandle(row.username)}</span>
            <Input
              type="number"
              min={1}
              max={detail.kitSizeVials}
              className="w-20"
              value={row.quantity}
              onChange={(e) => updateQty(row.userId, e.target.value)}
              disabled={!detail.canEditDistribution}
            />
            {detail.canEditDistribution ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(row.userId)}>
                Entfernen
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {detail.canEditDistribution ? (
        <div className="mt-4 space-y-3">
          {!showAdd ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              + Teilnehmer hinzufügen
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label htmlFor="kit-user-search">Benutzer suchen</Label>
              <Input
                id="kit-user-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Telegram Benutzername …"
                autoComplete="off"
              />
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="kit-add-qty">Menge</Label>
                  <Input
                    id="kit-add-qty"
                    type="number"
                    min={1}
                    className="w-20"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                  Schließen
                </Button>
              </div>
              {search.trim().length >= 2 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {(searchQuery.data ?? []).map((hit) => (
                    <li key={hit.userId}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addUser(hit)}
                      >
                        {creatorHandle(hit.username)}
                      </Button>
                    </li>
                  ))}
                  {searchQuery.isFetched && (searchQuery.data?.length ?? 0) === 0 ? (
                    <li className="px-2 text-muted-foreground">Keine Benutzer gefunden.</li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Mindestens 2 Zeichen eingeben.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving || !dirty || overCapacity || rows.length === 0}
              onClick={() => void onSave(rows)}
            >
              {saving ? "Speichern …" : "Verteilung speichern"}
            </Button>
            {dirty ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => setRows(rowsFromDetail(detail))}>
                Änderungen verwerfen
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Verteilung kann in diesem Status nicht geändert werden
          {detail.anyParticipantOrdered ? " (bereits bestellt)." : "."}
        </p>
      )}
    </AdminSection>
  );
}

export default function AdminKitRequestDetailPage() {
  const navigate = useNavigate();
  const { kitRequestId } = useParams<{ kitRequestId: string }>();
  const detailQuery = useAdminKitRequest(kitRequestId);
  const reconcileQuery = useAdminKitReconcileReport(kitRequestId);
  const metaMutation = useAdminUpdateKitRequestMeta();
  const distributionMutation = useAdminSetKitRequestDistribution();
  const orderSyncMutation = useAdminSyncKitFullOrders();
  const cancelMutation = useAdminCancelKitRequest();
  const deleteMutation = useAdminDeleteKitRequest();

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editingMeta, setEditingMeta] = React.useState(false);

  if (detailQuery.isLoading) return <FullScreenSpinner label="Kit Gesuch wird geladen …" />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        message={adminKitRpcErrorMessage(detailQuery.error, "Kit Gesuch konnte nicht geladen werden.")}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;
  const dosageLabel = formatVendorDosageDisplay(
    detail.variantLabel,
    detail.productCode ?? detail.vendorCode ?? "",
  );

  async function saveMeta(input: { note: string; expiresAt: string; kitSize: string }) {
    try {
      const nextSize = Number(input.kitSize);
      await metaMutation.mutateAsync({
        id: detail.id,
        note: input.note,
        expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
        clearExpiresAt: !input.expiresAt,
        kitSizeVials: Number.isInteger(nextSize) && nextSize !== detail.kitSizeVials ? nextSize : null,
      });
      setEditingMeta(false);
      toast.success("Kit Gesuch gespeichert.");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Speichern fehlgeschlagen."));
    }
  }

  async function runOrderSync() {
    try {
      await orderSyncMutation.mutateAsync(detail.id);
      toast.success("Bestell-Synchronisation abgeschlossen.");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Synchronisation fehlgeschlagen."));
    }
  }

  async function saveDistribution(rows: DraftRow[]) {
    try {
      await distributionMutation.mutateAsync({
        id: detail.id,
        allocations: rows.map((row) => ({ userId: row.userId, quantity: row.quantity })),
      });
      toast.success("Verteilung gespeichert.");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Verteilung konnte nicht gespeichert werden."));
    }
  }

  async function confirmCancel() {
    try {
      await cancelMutation.mutateAsync(detail.id);
      setCancelOpen(false);
      toast.success("Kit Gesuch storniert.");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Stornierung fehlgeschlagen."));
    }
  }

  async function confirmDelete() {
    try {
      await deleteMutation.mutateAsync(detail.id);
      setDeleteOpen(false);
      toast.success("Kit Gesuch gelöscht.");
      navigate("/admin/kit-requests");
    } catch (error) {
      toast.error(adminKitRpcErrorMessage(error, "Löschen fehlgeschlagen."));
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
        section="Bestellungen"
        subsection="Kit Gesuche"
        title={detail.productName}
        description={`${dosageLabel} · ${detail.allocatedTotal}/${detail.kitSizeVials} Kit`}
        breadcrumbs={[
          { label: "Bestellungen", to: "/admin/orders" },
          { label: "Kit Gesuche", to: "/admin/kit-requests" },
          { label: detail.productName },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{adminStatusLabel(detail.status, detail.remainingVials)}</Badge>
        {detail.customerMutationLocked ? (
          <Badge variant="outline">
            {detail.customerLockReason === "partial_order" ? "Teilbestellt · gesperrt" : "Gesperrt"}
          </Badge>
        ) : null}
        <span className="text-sm text-muted-foreground">
          Noch {detail.remainingVials} Plätze · {detail.participantCount} Teilnehmer
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {detail.canEditMeta ? (
          <Button type="button" variant={editingMeta ? "default" : "outline"} onClick={() => setEditingMeta(true)}>
            Bearbeiten
          </Button>
        ) : null}
        {detail.canCancel ? (
          <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
            Kit stornieren
          </Button>
        ) : null}
        {detail.canDelete ? (
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Kit löschen
          </Button>
        ) : null}
      </div>

      <AdminSection title="Stammdaten" padded>
        <dl className="space-y-3">
          <MetaRow label="Produkt" value={detail.productName} />
          <MetaRow label="Variante / Dosierung" value={dosageLabel || "—"} />
          <MetaRow label="Kit Größe" value={String(detail.kitSizeVials)} />
          <MetaRow label="Belegung" value={`${detail.allocatedTotal} / ${detail.kitSizeVials}`} />
          <MetaRow label="Freie Plätze" value={String(detail.remainingVials)} />
          <MetaRow label="Status" value={adminStatusLabel(detail.status, detail.remainingVials)} />
          <MetaRow label="Ersteller" value={creatorHandle(detail.creatorUsername)} />
          <MetaRow label="Notiz" value={detail.note?.trim() ? detail.note : "—"} />
          <MetaRow label="Verkaufsbereich" value={detail.shopArea} />
          <MetaRow label="Händlercode" value={detail.vendorCode ?? "—"} />
          <MetaRow label="Produkt-ID" value={detail.masterProductId ?? "—"} />
          <MetaRow label="Bereichsprodukt-ID" value={detail.areaProductId ?? "—"} />
          <MetaRow label="Kit-ID" value={detail.id} />
          <MetaRow label="Erstellt" value={formatDate(detail.createdAt)} />
          <MetaRow label="Ablauf" value={formatDate(detail.expiresAt)} />
        </dl>
      </AdminSection>

      {editingMeta && detail.canEditMeta ? (
        <MetaEditForm
          key={`${detail.id}-${detail.updatedAt}-edit`}
          detail={detail}
          saving={metaMutation.isPending}
          onSave={(input) => void saveMeta(input)}
          onCancel={() => setEditingMeta(false)}
        />
      ) : null}

      <KitIntegritySection
        report={reconcileQuery.data}
        loading={reconcileQuery.isLoading}
        error={reconcileQuery.isError}
        onRetry={() => void reconcileQuery.refetch()}
        kitSize={detail.kitSizeVials}
        allocatedTotal={detail.allocatedTotal}
        participantCount={detail.participantCount}
      />

      {detail.status === "full" ? (
        <AdminSection
          title="Bestell-Synchronisation"
          description="Nach Kit-Full werden fehlende Kit-Anteile in bestehende Kundenbestellungen übernommen (Order Revision, historische Preise)."
          padded
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {kitFullOrderSyncListLabel(
                detail.orderSyncLabel,
                detail.orderSyncSyncedCount,
                detail.orderSyncParticipantCount,
              )}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={orderSyncMutation.isPending}
              onClick={() => void runOrderSync()}
            >
              Bestellungen synchronisieren
            </Button>
          </div>
          <ul className="space-y-2 text-sm">
            {detail.participants.map((p) => {
              const sync = p.orderSyncStatus;
              const status = sync?.status != null ? String(sync.status) : null;
              const reason = sync?.reason != null ? String(sync.reason) : null;
              const orderId = sync?.orderId != null ? String(sync.orderId) : p.orderId;
              return (
                <li
                  key={p.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-medium">{creatorHandle(p.username)}</span>
                  <span className="text-muted-foreground tabular-nums">{p.quantity} Anteil</span>
                  <span className="text-xs text-muted-foreground">
                    {kitFullOrderSyncParticipantLabel(status, reason)}
                  </span>
                  {orderId ? (
                    <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                      <Link to={`/admin/orders/${orderId}`}>Bestellung</Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </AdminSection>
      ) : null}

      <DistributionEditor
        key={`${detail.id}-${detail.updatedAt}-dist`}
        detail={detail}
        saving={distributionMutation.isPending}
        onSave={saveDistribution}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Kit stornieren?"
        description="Möchtest du dieses Kit Gesuch wirklich stornieren? Das Kit wird für weitere Beteiligungen geschlossen. Historische Bestellungen bleiben unverändert."
        confirmLabel="Kit stornieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={cancelMutation.isPending}
        onConfirm={() => void confirmCancel()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Kit Gesuch endgültig löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden. Das Kit und seine Teilnehmer werden entfernt. Bestellungen bleiben unberührt und blockieren das Löschen."
        confirmLabel="Endgültig löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
