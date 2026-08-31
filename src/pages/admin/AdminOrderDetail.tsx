import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Printer, Trash2 } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaymentMethodBadge } from "@/components/orders/PaymentMethodBadge";
import { OrderChargeSummary } from "@/components/orders/OrderChargeSummary";
import { useDeleteOrder, useOrder, useOrderAdminNote, useOrderStatusHistory, useSetOrderStatus } from "@/hooks/useOrders";
import { useAdminUserDirectory } from "@/hooks/useAdminOrders";
import { downloadOrderCsv, printOrderDocument, toOrderExportDoc } from "@/lib/orderExport";
import { formatDateTime, formatQuantity, formatRate, formatUsd, summarizeOrderCharges } from "@/lib/money";
import { canPermanentlyDeleteOrder, nextOrderStatuses, ORDER_STATUS_LABELS } from "@/services/orders";
import { toast } from "@/components/ui/toaster";
import { cartItemDisplayName, cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";
import type { OrderStatus } from "@/types/database";

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const orderQuery = useOrder(orderId);
  const historyQuery = useOrderStatusHistory(orderId);
  const noteQuery = useOrderAdminNote(orderId);
  const directoryQuery = useAdminUserDirectory();
  const setStatus = useSetOrderStatus(orderId ?? "");
  const deleteOrderMutation = useDeleteOrder();

  const [adminNoteDraft, setAdminNoteDraft] = React.useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = React.useState<OrderStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const adminNote = adminNoteDraft ?? noteQuery.data ?? "";

  if (orderQuery.isLoading) return <FullScreenSpinner label="Bestellung wird geladen …" />;
  if (orderQuery.isError) {
    return <ErrorState message="Bestellung konnte nicht geladen werden." onRetry={() => orderQuery.refetch()} />;
  }
  if (!orderQuery.data) {
    return <EmptyState title="Bestellung nicht gefunden" />;
  }

  const order = orderQuery.data;
  const customer = directoryQuery.data?.get(order.user_id);
  const next = nextOrderStatuses(order.status);
  const exportDoc = toOrderExportDoc(order, order.items, {
    displayName: customer?.displayName ?? order.user_id,
    email: customer?.email ?? null,
  });

  async function applyStatus(status: OrderStatus) {
    try {
      await setStatus.mutateAsync({ status, adminNote: adminNote.trim() || null });
      toast.success(`Status: ${ORDER_STATUS_LABELS[status]}`);
      setPendingStatus(null);
    } catch (error) {
      console.error("Bestellstatus ändern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    }
  }

  async function saveNote() {
    try {
      await setStatus.mutateAsync({ status: order.status, adminNote: adminNote.trim() || null });
      toast.success("Interne Notiz gespeichert.");
    } catch (error) {
      console.error("Admin-Notiz speichern fehlgeschlagen:", error);
      toast.error("Notiz konnte nicht gespeichert werden.");
    }
  }

  async function handleDelete() {
    try {
      await deleteOrderMutation.mutateAsync(order.id);
      toast.success(`Bestellung ${order.order_number} wurde gelöscht.`);
      navigate("/admin/orders");
    } catch (error) {
      console.error("Bestellung löschen fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Bestellung konnte nicht gelöscht werden.");
      setDeleteOpen(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Back + breadcrumb */}
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/admin/orders")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Bestellungen
      </Button>

      {/* Order header card */}
      <AdminSection padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold text-foreground">{order.order_number}</span>
              <OrderStatusBadge status={order.status} />
              <PaymentMethodBadge paymentMethod={order.payment_method} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{customer?.displayName ?? "—"}</span>
              {customer?.email && <span>{customer.email}</span>}
              <span>{formatDateTime(order.submitted_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {next.map((st) => (
              <Button
                key={st}
                size="sm"
                variant={st === "cancelled" ? "destructive" : "outline"}
                onClick={() => setPendingStatus(st)}
              >
                {ORDER_STATUS_LABELS[st]}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => printOrderDocument(exportDoc)}>
              <Printer className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadOrderCsv(exportDoc)}>
              <FileDown className="h-3.5 w-3.5" /> CSV
            </Button>
            {canPermanentlyDeleteOrder(order.status) && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Löschen
              </Button>
            )}
          </div>
        </div>
      </AdminSection>

      {/* Order items */}
      <AdminSection title="Bestellpositionen">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Normalpreis</TableHead>
                <TableHead className="text-right">Mengenpreis</TableHead>
                <TableHead>Stufe</TableHead>
                <TableHead className="text-right">Einzelpreis</TableHead>
                <TableHead className="pr-4 text-right">Gesamt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-4 font-mono text-xs">{item.product_code_snapshot}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{cartItemDisplayName(item)}</p>
                    {cartItemVariantSubtitle(item) && (
                      <p className="text-[11px] text-muted-foreground">{cartItemVariantSubtitle(item)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatQuantity(item.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatUsd(item.normal_price_usd_snapshot)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {item.bulk_price_usd_snapshot != null
                      ? `${formatUsd(item.bulk_price_usd_snapshot)} ab ${formatQuantity(item.bulk_price_min_quantity_snapshot)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.applied_price_tier === "bulk" ? "secondary" : "outline"} className="text-[10px]">
                      {item.applied_price_tier === "bulk" ? "Mengenpreis" : "Normal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatUsd(item.unit_price_usd_snapshot)}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums text-sm font-semibold">
                    {formatUsd(item.line_total_usd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminSection>

      {/* Charges + note */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title="Summen & Versand" padded>
          <div className="space-y-3 text-sm">
            <OrderChargeSummary
              charges={summarizeOrderCharges({
                productUsd: order.total_usd,
                productEur: order.total_eur,
                chinaAmount: order.china_shipping_amount,
                chinaCurrency: order.china_shipping_currency,
                deAmount: order.de_shipping_amount,
                deCurrency: order.de_shipping_currency,
                usdToEurRate: order.exchange_rate,
              })}
            />
            <div className="flex justify-between border-t border-border pt-2 text-muted-foreground">
              <span>Wechselkurs</span>
              <span className="tabular-nums">{formatRate(order.exchange_rate)}</span>
            </div>
            {order.note && (
              <div className="border-t border-border pt-2 text-muted-foreground">
                <span className="font-medium text-foreground">Kundennotiz: </span>
                {order.note}
              </div>
            )}
          </div>
        </AdminSection>

        <AdminSection title="Interne Notiz" padded>
          <div className="space-y-2">
            <Label htmlFor="admin-note" className="sr-only">
              Interne Notiz
            </Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNoteDraft(e.target.value)}
              rows={3}
              placeholder="Nur für Admins sichtbar …"
            />
            <Button size="sm" variant="outline" onClick={saveNote} loading={setStatus.isPending}>
              Notiz speichern
            </Button>
          </div>
        </AdminSection>
      </div>

      {/* Status history */}
      <AdminSection title="Statusverlauf" padded>
        <div className="space-y-2 text-sm">
          {(historyQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">Noch keine Statusänderungen.</p>
          ) : (
            (historyQuery.data ?? []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3">
                <span className="text-foreground">
                  {entry.old_status ? `${ORDER_STATUS_LABELS[entry.old_status]} → ` : ""}
                  <span className="font-medium">{ORDER_STATUS_LABELS[entry.new_status]}</span>
                </span>
                <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.changed_at)}</span>
              </div>
            ))
          )}
        </div>
      </AdminSection>

      <ConfirmDialog
        open={pendingStatus != null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title={pendingStatus ? `Status auf „${ORDER_STATUS_LABELS[pendingStatus]}" setzen?` : "Status ändern"}
        description="Der Kunde sieht den neuen Status sofort. Abgeschlossen und Storniert können danach nicht mehr geändert werden."
        confirmLabel="Status ändern"
        variant={pendingStatus === "cancelled" ? "destructive" : "default"}
        loading={setStatus.isPending}
        onConfirm={() => {
          if (pendingStatus) return applyStatus(pendingStatus);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Bestellung endgültig löschen?"
        description="Diese Bestellung wird endgültig gelöscht. Zugehörige Bestellpositionen, Statushistorie, interne Notizen und abhängige Bestelldaten werden ebenfalls gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden."
        confirmLabel="Endgültig löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={deleteOrderMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
