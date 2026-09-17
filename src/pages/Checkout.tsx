import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DeliveryMethodSelector } from "@/components/checkout/DeliveryMethodSelector";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { ShippingAddressFields } from "@/components/checkout/ShippingAddressFields";
import { OrderChargeSummary } from "@/components/orders/OrderChargeSummary";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { EditKitShareButton } from "@/components/shop/EditKitShareButton";
import { useCarts } from "@/hooks/useCarts";
import { useCartItems } from "@/hooks/useCartItems";
import { useCartComputed } from "@/hooks/useCartComputed";
import { useEnabledPaymentMethods } from "@/hooks/useAppPublicState";
import { useCreateOrder } from "@/hooks/useOrders";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { calculateCartTotals, summarizeOrderCharges } from "@/lib/money";
import {
  PAYMENT_METHOD_REQUIRED_MESSAGE,
  PAYMENT_METHODS_UNAVAILABLE_MESSAGE,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";
import {
  EMPTY_CHECKOUT_SHIPPING,
  parseCheckoutShipping,
  type CheckoutShippingField,
  type CheckoutShippingForm,
  type DeliveryMethod,
} from "@/lib/shippingAddress";
import { toast } from "@/components/ui/toaster";
import { cartItemDisplayName, cartItemQuantityLabel, cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";
import { extractRpcErrorMessage } from "@/services/username";

export default function CheckoutPage() {
  const { cartId } = useParams<{ cartId: string }>();
  const navigate = useNavigate();
  const cartsQuery = useCarts();
  const itemsQuery = useCartItems(cartId);
  const createOrder = useCreateOrder();
  const paymentMethods = useEnabledPaymentMethods();

  const [note, setNote] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);
  const [shipping, setShipping] = React.useState<CheckoutShippingForm>(EMPTY_CHECKOUT_SHIPPING);
  const [shippingErrors, setShippingErrors] = React.useState<Partial<Record<CheckoutShippingField, string>>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const submitLockRef = React.useRef(false);

  const effectivePaymentMethod =
    paymentMethod != null && paymentMethods.methods.includes(paymentMethod) ? paymentMethod : null;

  const cart = cartsQuery.data?.find((c) => c.id === cartId);
  const { items } = useCartComputed(itemsQuery.data);

  const pendingItems = items.filter((i) => i.quantity > 0 && i.submitted_order_id == null);
  const alreadySubmitted =
    pendingItems.length === 0 && items.some((i) => i.quantity > 0 && i.submitted_order_id != null);

  const eligible = pendingItems.filter(
    (i) => i.resolution_status === "resolved" && i.unit_price_usd_snapshot != null,
  );

  // Kit-line detection: if any eligible item is part of a kit share, adapt button copy
  const hasKitLines = eligible.some((i) => i.kit_share_id != null);
  const excluded = pendingItems.filter(
    (i) => i.resolution_status !== "resolved" || i.unit_price_usd_snapshot == null,
  );
  const eligibleTotals = calculateCartTotals(
    eligible.map((item) => ({
      quantity: item.quantity,
      totalUsd: item.totalUsd,
      totalEur: item.totalEur,
      resolutionStatus: item.resolution_status,
    })),
  );

  if (cartsQuery.isLoading || itemsQuery.isLoading) return <FullScreenSpinner label="Bestellübersicht wird geladen …" />;

  if (cartsQuery.isError || itemsQuery.isError) {
    return (
      <ErrorState
        message="Bestellübersicht konnte nicht geladen werden."
        onRetry={() => {
          cartsQuery.refetch();
          itemsQuery.refetch();
        }}
      />
    );
  }

  if (!cart) {
    return <EmptyState title="Warenkorb nicht gefunden" description="Dieser Warenkorb existiert nicht oder du hast keine Berechtigung, ihn zu sehen." />;
  }

  if (cart.status === "ordered" || alreadySubmitted) {
    return (
      <EmptyState
        title="Bereits bestellt"
        description="Dieser Warenkorb wurde bereits als Bestellung abgeschickt und kann nicht erneut bestellt werden."
        action={
          <Button variant="outline" onClick={() => navigate("/orders")}>
            Zu meinen Bestellungen
          </Button>
        }
      />
    );
  }

  function validatedShipping() {
    const result = parseCheckoutShipping(shipping);
    if (!result.success) {
      setShippingErrors(result.error.fieldErrors);
      return null;
    }
    setShippingErrors({});
    return result.data;
  }

  function handleDeliveryMethodChange(method: DeliveryMethod) {
    setShipping((current) => ({ ...current, deliveryMethod: method }));
    setShippingErrors({});
  }

  async function handleSubmit() {
    if (!cart || submitLockRef.current || createOrder.isPending) return;
    submitLockRef.current = true;
    const address = validatedShipping();
    if (!address) {
      submitLockRef.current = false;
      setConfirmOpen(false);
      toast.error("Bitte prüfe Lieferart und Lieferadresse.");
      return;
    }
    if (paymentMethods.methods.length === 0) {
      submitLockRef.current = false;
      setPaymentError(PAYMENT_METHODS_UNAVAILABLE_MESSAGE);
      setConfirmOpen(false);
      return;
    }
    if (!effectivePaymentMethod) {
      submitLockRef.current = false;
      setPaymentError(PAYMENT_METHOD_REQUIRED_MESSAGE);
      setConfirmOpen(false);
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        cartId: cart.id,
        note: note.trim() || null,
        paymentMethod: effectivePaymentMethod,
        shipping: address,
      });
      const extraOrders = Array.isArray(result.orders) ? result.orders.length : 1;
      if (extraOrders > 1) {
        toast.success(`${extraOrders} Bestellungen wurden übermittelt.`);
        navigate("/orders");
      } else {
        toast.success(`Bestellung ${result.orderNumber} wurde übermittelt.`);
        navigate(`/orders/${result.orderId}`);
      }
    } catch (error) {
      submitLockRef.current = false;
      console.error("Bestellung absenden fehlgeschlagen:", error);
      const message =
        extractRpcErrorMessage(error).trim() || "Bestellung konnte nicht übermittelt werden.";
      toast.error(message);
      setConfirmOpen(false);
    }
  }

  function handleOpenConfirm() {
    const address = validatedShipping();
    if (!address) {
      toast.error("Bitte fülle Lieferart und Lieferadresse vollständig aus.");
      return;
    }
    if (paymentMethods.methods.length === 0) {
      setPaymentError(PAYMENT_METHODS_UNAVAILABLE_MESSAGE);
      toast.error(PAYMENT_METHODS_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!effectivePaymentMethod) {
      setPaymentError(PAYMENT_METHOD_REQUIRED_MESSAGE);
      toast.error(PAYMENT_METHOD_REQUIRED_MESSAGE);
      return;
    }
    setPaymentError(null);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(`/carts/${cart.id}`)}>
        <ArrowLeft /> Zurück zum Warenkorb
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bestellung prüfen</h1>
        <p className="text-sm text-muted-foreground">„{cart.name}" - bitte prüfe alle Positionen vor dem Absenden.</p>
      </div>

      {excluded.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{excluded.length} Position(en) werden nicht mit bestellt.</p>
            <p className="text-warning/80">
              {excluded.map((i) => i.product_code_snapshot ?? i.product_code_input).join(", ")} - unbekannter oder
              deaktivierter Artikel bzw. kein Preis verfügbar. Bitte korrigiere oder entferne diese Positionen im
              Warenkorb, falls sie mitbestellt werden sollen.
            </p>
          </div>
        </div>
      )}

      {eligible.length === 0 ? (
        <EmptyState
          title="Keine bestellbaren Positionen"
          description="Der Warenkorb enthält keine gültigen, bepreisten Artikel. Bitte füge im Warenkorb gültige Artikel hinzu."
          action={
            <Button variant="outline" onClick={() => navigate(`/carts/${cart.id}`)}>
              Zurück zum Warenkorb
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Einzelpreis</TableHead>
                    <TableHead className="text-right">Gesamt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="hidden sm:table-cell font-mono text-xs">{item.product_code_snapshot}</TableCell>
                      <TableCell className="text-sm">
                        <p>{cartItemDisplayName(item)}</p>
                        {cartItemVariantSubtitle(item) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{cartItemVariantSubtitle(item)}</p>
                        )}
                        {item.kit_share_id && (
                          <div>
                            <EditKitShareButton kitShareId={item.kit_share_id} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cartItemQuantityLabel({ ...item, shop_area: item.shop_area ?? cart.shop_area })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DualCurrencyPrice
                          usd={item.unit_price_usd_snapshot}
                          rate={item.exchange_rate_snapshot}
                          size="compact"
                          align="right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DualCurrencyPrice usd={item.totalUsd} eur={item.totalEur} size="compact" align="right" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bestellnotiz (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="order-note" className="sr-only">
                Bestellnotiz
              </Label>
              <Textarea
                id="order-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bitte hier eine Nachricht eingeben …"
                rows={3}
                maxLength={2000}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-6 p-5">
              <PaymentMethodSelector
                value={effectivePaymentMethod}
                methods={paymentMethods.methods}
                onChange={(method) => {
                  setPaymentMethod(method);
                  setPaymentError(null);
                }}
                error={paymentError}
              />
              <DeliveryMethodSelector
                value={shipping.deliveryMethod}
                onChange={handleDeliveryMethodChange}
                error={shippingErrors.deliveryMethod ?? null}
              />
              {shipping.deliveryMethod ? (
                <ShippingAddressFields
                  value={shipping}
                  deliveryMethod={shipping.deliveryMethod}
                  onChange={(next) => {
                    setShipping(next);
                    setShippingErrors({});
                  }}
                  errors={shippingErrors}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className="sm:ml-auto sm:max-w-sm">
            <CardContent className="space-y-4 p-5">
              <OrderChargeSummary
                shippingPending
                charges={summarizeOrderCharges({
                  productUsd: eligibleTotals.totalUsd,
                  productEur: eligibleTotals.totalEur,
                  usdToEurRate: eligible.find((i) => i.exchange_rate_snapshot)?.exchange_rate_snapshot ?? null,
                })}
              />
              {/* Desktop submit button — hidden on mobile (sticky bar handles it) */}
              <Button className="mt-1 hidden w-full sm:flex" size="lg" onClick={handleOpenConfirm}>
                {hasKitLines ? "Bestellung aufgeben (Kit wird synchronisiert)" : "Bestellung absenden"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Mobile sticky submit bar ──────────────────────────────────────── */}
      {eligible.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-bottom-bar backdrop-blur sm:hidden">
          <Button className="w-full" size="lg" onClick={handleOpenConfirm}>
            <ShoppingBag className="mr-2 h-4 w-4" aria-hidden="true" />
            {hasKitLines ? "Bestellung aufgeben" : "Bestellung absenden"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Bestellung jetzt absenden?"
        description={
          <div className="space-y-3 text-left">
            <p>Du bestellst {eligible.length} Position(en).</p>
            <DualCurrencyPrice usd={eligibleTotals.totalUsd} eur={eligibleTotals.totalEur} size="summary" />
            <p className="text-sm text-muted-foreground">
              Lieferart, Lieferadresse und Telegram Benutzername werden mit der Bestellung gespeichert. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        }
        confirmLabel={hasKitLines ? "Jetzt verbindlich bestellen (Kit-Sync)" : "Verbindlich bestellen"}
        loading={createOrder.isPending}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
