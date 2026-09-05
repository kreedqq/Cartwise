import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { CancelOrderDialog } from "@/components/orders/CancelOrderDialog";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderTrackingCard } from "@/components/orders/OrderTrackingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useAdminUserDirectory } from "@/hooks/useAdminOrders";
import { useAdminOrder, useSetOrderStatus } from "@/hooks/useOrders";
import { useSaveOrderTracking, useTestTrackingEmail } from "@/hooks/useOrderTracking";
import { formatDateTime } from "@/lib/money";
import { formatShippingListDate } from "@/lib/shippingHub";
import {
  TRACKING_CARRIER_OPTIONS,
  buildCarrierTrackingUrl,
  hasTrackingNumber,
  isTrackingCarrierKey,
  normalizeTrackingNumber,
  resolveTrackingUrl,
  shouldSendTrackingNotification,
  type TrackingCarrierKey,
} from "@/lib/tracking";
import { formatOrderTelegramSnapshot, ORDER_STATUS_LABELS } from "@/services/orders";

export default function AdminShipmentManagePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const orderQuery = useAdminOrder(orderId);
  const directoryQuery = useAdminUserDirectory();
  const saveTracking = useSaveOrderTracking(orderId ?? "");
  const testEmail = useTestTrackingEmail(orderId ?? "");
  const setStatus = useSetOrderStatus(orderId ?? "");

  const order = orderQuery.data;

  const [trackingDraft, setTrackingDraft] = React.useState<{
    carrier: TrackingCarrierKey;
    trackingNumber: string;
    trackingUrl: string;
    urlTouched: boolean;
  } | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const savedCarrier = isTrackingCarrierKey(order?.tracking_carrier) ? order.tracking_carrier : "dhl";
  const savedNumber = order?.tracking_number ?? "";
  const savedUrl = order?.tracking_url ?? "";
  const carrier = trackingDraft?.carrier ?? savedCarrier;
  const trackingNumber = trackingDraft?.trackingNumber ?? savedNumber;
  const urlTouched =
    trackingDraft?.urlTouched ??
    Boolean(savedUrl && savedUrl !== (buildCarrierTrackingUrl(savedCarrier, savedNumber) ?? ""));
  const trackingUrl = trackingDraft?.trackingUrl ?? savedUrl;
  const resolvedUrl = urlTouched
    ? trackingUrl.trim()
    : resolveTrackingUrl({ carrier, trackingNumber, customUrl: trackingUrl }) ?? "";
  const trackingDirty =
    normalizeTrackingNumber(trackingNumber) !== normalizeTrackingNumber(savedNumber) ||
    carrier !== savedCarrier ||
    (resolvedUrl || "") !== (savedUrl || "");
  const dirty = trackingDirty;

  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!orderId) return <EmptyState title="Bestellung nicht gefunden" />;
  if (orderQuery.isLoading) return <FullScreenSpinner label="Bestellung wird geladen …" />;
  if (orderQuery.isError) {
    return <ErrorState message="Bestellung konnte nicht geladen werden." onRetry={() => orderQuery.refetch()} />;
  }
  if (!order) return <EmptyState title="Bestellung nicht gefunden" />;

  const customer = order.user_id ? directoryQuery.data?.get(order.user_id) : undefined;
  const assignedBy = order.tracking_assigned_by ? directoryQuery.data?.get(order.tracking_assigned_by) : undefined;
  const cancelled = order.status === "cancelled";

  function updateTracking(
    patch: Partial<{
      carrier: TrackingCarrierKey;
      trackingNumber: string;
      trackingUrl: string;
      urlTouched: boolean;
    }>,
  ) {
    const nextCarrier = patch.carrier ?? carrier;
    const nextNumber = patch.trackingNumber ?? trackingNumber;
    const nextTouched = patch.urlTouched ?? urlTouched;
    setTrackingDraft({
      carrier: nextCarrier,
      trackingNumber: nextNumber,
      urlTouched: nextTouched,
      trackingUrl: nextTouched
        ? (patch.trackingUrl ?? trackingUrl)
        : (buildCarrierTrackingUrl(nextCarrier, nextNumber) ?? ""),
    });
  }

  function handleCarrierChange(next: TrackingCarrierKey) {
    updateTracking({ carrier: next });
  }

  function handleNumberChange(value: string) {
    updateTracking({ trackingNumber: value });
  }

  async function handleSaveTracking() {
    const number = normalizeTrackingNumber(trackingNumber);
    try {
      const result = await saveTracking.mutateAsync({
        trackingNumber: number,
        trackingCarrier: number ? carrier : null,
        trackingUrl: number ? resolvedUrl || null : null,
        previous: {
          tracking_number: order?.tracking_number,
          tracking_notification_sent_at: order?.tracking_notification_sent_at,
        },
      });
      setTrackingDraft(null);
      if (result.email?.reason === "no_email") {
        toast.success("Sendungsverfolgung gespeichert.");
        toast.error("Keine E-Mail-Adresse hinterlegt. Tracking-Benachrichtigung konnte nicht versendet werden.");
      } else if (result.email?.sent) {
        toast.success("Sendungsverfolgung gespeichert. Der Kunde wurde per E-Mail benachrichtigt.");
      } else if (result.email?.reason === "not_configured") {
        toast.success("Sendungsverfolgung gespeichert.");
        toast.error("E-Mail-Versand ist nicht konfiguriert. Die Sendungsnummer wurde trotzdem gespeichert.");
      } else {
        toast.success("Sendungsverfolgung gespeichert.");
      }
    } catch (error) {
      console.error("Sendungsverfolgung speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Sendungsverfolgung konnte nicht gespeichert werden.");
    }
  }

  async function handleCancel(reason: string | null) {
    try {
      await setStatus.mutateAsync({
        status: "cancelled",
        adminNote: reason ? `Stornierung: ${reason}` : "Bestellung storniert.",
      });
      setCancelOpen(false);
      toast.success(`Bestellung ${order?.order_number} wurde storniert.`);
    } catch (error) {
      console.error("Bestellung stornieren fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Bestellung konnte nicht storniert werden.");
    }
  }

  async function handleTestEmail() {
    try {
      const result = await testEmail.mutateAsync();
      if (result.sent) toast.success("Test-E-Mail wurde an deine Admin-Adresse gesendet.");
      else toast.error(result.message ?? "Test-E-Mail konnte nicht gesendet werden.");
    } catch (error) {
      console.error("Test-E-Mail fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Test-E-Mail konnte nicht gesendet werden.");
    }
  }

  const willNotify = shouldSendTrackingNotification(
    {
      tracking_number: order.tracking_number,
      tracking_notification_sent_at: order.tracking_notification_sent_at,
    },
    trackingNumber,
  );

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
        <Link to="/admin/shipping">
          <ArrowLeft className="h-3.5 w-3.5" /> Versand
        </Link>
      </Button>

      <AdminPageHeader
        title="Bestellung verwalten"
        description="Sendungsverfolgung und Stornierung an einem Ort. Den Kundenfortschritt steuerst du in der Versandübersicht."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/orders/${order.id}`)}>
            Zur Bestelldetailseite
          </Button>
        }
      />

      {dirty ? (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-2 text-sm text-primary">
          Ungespeicherte Änderungen. Speichern, bevor du die Seite verlässt.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="space-y-5">
          <AdminSection title="Bestellung" padded>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-lg font-semibold">{order.order_number}</p>
                <p className="text-sm text-foreground">{formatOrderTelegramSnapshot(order)}</p>
                <p className="text-xs text-muted-foreground">{formatShippingListDate(order.submitted_at)}</p>
                {customer?.email ? (
                  <p className="text-xs text-muted-foreground">{customer.email}</p>
                ) : (
                  <p className="text-xs text-destructive/80">Keine E-Mail-Adresse hinterlegt.</p>
                )}
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Interner Status: {ORDER_STATUS_LABELS[order.status]}. Der Kundenfortschritt wird in der
              Versandübersicht gesetzt und bleibt davon getrennt.
            </p>
          </AdminSection>

          <AdminSection title="Sendungsverfolgung" padded>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tracking-carrier">Versanddienstleister</Label>
                <Select value={carrier} onValueChange={(value) => handleCarrierChange(value as TrackingCarrierKey)}>
                  <SelectTrigger id="tracking-carrier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_CARRIER_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tracking-number">Sendungsnummer</Label>
                <Input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(event) => handleNumberChange(event.target.value)}
                  placeholder="00340434123456789012"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tracking-url">Tracking-Link</Label>
                <Input
                  id="tracking-url"
                  value={urlTouched ? trackingUrl : resolvedUrl}
                  onChange={(event) => updateTracking({ urlTouched: true, trackingUrl: event.target.value })}
                  placeholder="https://"
                />
                <p className="text-[11px] text-muted-foreground">
                  Wird aus Dienstleister und Sendungsnummer erzeugt. Du kannst den Link jederzeit überschreiben.
                </p>
              </div>
            </div>
            {hasTrackingNumber(order) ? (
              <div className="mt-4 rounded-xl border border-primary/15 bg-secondary/30 p-3 text-xs text-muted-foreground">
                <p>
                  Gespeichert: <span className="font-mono text-foreground">{order.tracking_number}</span>
                </p>
                {order.tracking_assigned_at ? <p>Zugewiesen: {formatDateTime(order.tracking_assigned_at)}</p> : null}
                {assignedBy?.email || assignedBy?.displayName ? (
                  <p>Gesetzt von: {assignedBy.displayName || assignedBy.email}</p>
                ) : null}
                {order.tracking_notification_sent_at ? (
                  <p>E-Mail gesendet: {formatDateTime(order.tracking_notification_sent_at)}</p>
                ) : willNotify ? (
                  <p>Beim Speichern wird einmalig eine Versand-E-Mail an die Account-Adresse gesendet.</p>
                ) : (
                  <p>Es wird keine weitere Tracking-E-Mail automatisch versendet.</p>
                )}
              </div>
            ) : willNotify ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Beim ersten Speichern einer Sendungsnummer wird einmalig eine E-Mail an die Account-Adresse gesendet.
              </p>
            ) : null}
          </AdminSection>

          <AdminSection title="Aktionen" padded>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                onClick={() => void handleSaveTracking()}
                loading={saveTracking.isPending}
                disabled={!trackingDirty}
              >
                Tracking speichern
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleTestEmail()}
                loading={testEmail.isPending}
                disabled={!normalizeTrackingNumber(trackingNumber) && !hasTrackingNumber(order)}
              >
                Test-E-Mail an mich
              </Button>
              {!cancelled ? (
                <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={setStatus.isPending}>
                  Bestellung stornieren
                </Button>
              ) : (
                <p className="self-center text-sm text-destructive">Diese Bestellung ist storniert und bleibt erhalten.</p>
              )}
            </div>
          </AdminSection>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <OrderTrackingCard
            tracking={{
              tracking_number: normalizeTrackingNumber(trackingNumber) ?? order.tracking_number,
              tracking_carrier: carrier,
              tracking_url: resolvedUrl || order.tracking_url,
              tracking_assigned_at: order.tracking_assigned_at,
            }}
          />
        </div>
      </div>

      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orderNumber={order.order_number}
        loading={setStatus.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
