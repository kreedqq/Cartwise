import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Printer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/admin/orders")}>
        <ArrowLeft /> Zurück zu Bestellungen
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xl font-semibold">{order.order_number}</h2>
          <p className="text-sm text-muted-foreground">
            {customer?.displayName ?? "—"}
            {customer?.email ? ` · ${customer.email}` : ""} · {formatDateTime(order.submitted_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <OrderStatusBadge status={order.status} />
          <PaymentMethodBadge paymentMethod={order.payment_method} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {next.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "cancelled" ? "destructive" : "outline"}
            onClick={() => setPendingStatus(status)}
          >
            {ORDER_STATUS_LABELS[status]}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => printOrderDocument(exportDoc)}>
          <Printer /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadOrderCsv(exportDoc)}>
          <FileDown /> CSV
        </Button>
        {canPermanentlyDeleteOrder(order.status) && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Endgültig löschen
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Normalpreis</TableHead>
                <TableHead className="text-right">Mengenpreis</TableHead>
                <TableHead>Stufe</TableHead>
                <TableHead className="text-right">Einzelpreis</TableHead>
                <TableHead className="text-right">Gesamt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.product_code_snapshot}</TableCell>
                  <TableCell>
                    <p className="text-sm">{item.product_name_snapshot}</p>
                    {item.dosage_vial_snapshot && (
                      <p className="text-xs text-muted-foreground">{item.dosage_vial_snapshot}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatQuantity(item.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(item.normal_price_usd_snapshot)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.bulk_price_usd_snapshot != null
                      ? `${formatUsd(item.bulk_price_usd_snapshot)} ab ${formatQuantity(item.bulk_price_min_quantity_snapshot)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.applied_price_tier === "bulk" ? "Mengenpreis" : "Normalpreis"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(item.unit_price_usd_snapshot)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatUsd(item.line_total_usd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
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
            <div className="flex justify-between text-muted-foreground">
              <span>Wechselkurs</span>
              <span className="tabular-nums">{formatRate(order.exchange_rate)}</span>
            </div>
            {order.note && (
              <p className="border-t border-border pt-2 text-muted-foreground">Kundennotiz: {order.note}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interne Notiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statusverlauf</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(historyQuery.data ?? []).map((entry) => (
            <div key={entry.id} className="flex justify-between gap-3">
              <span>
                {entry.old_status ? `${ORDER_STATUS_LABELS[entry.old_status]} → ` : ""}
                {ORDER_STATUS_LABELS[entry.new_status]}
              </span>
              <span className="text-muted-foreground">{formatDateTime(entry.changed_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

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
