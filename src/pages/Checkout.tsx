import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
import { useCreateOrder } from "@/hooks/useOrders";
import { calculateCartTotals, formatEur, formatUsd, summarizeOrderCharges } from "@/lib/money";
import {
  PAYMENT_METHOD_REQUIRED_MESSAGE,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";
import {
  EMPTY_SHIPPING_ADDRESS,
  shippingAddressSchema,
  type ShippingAddressInput,
} from "@/lib/shippingAddress";
import { toast } from "@/components/ui/toaster";
import { cartItemDisplayName, cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";

export default function CheckoutPage() {
  const { cartId } = useParams<{ cartId: string }>();
  const navigate = useNavigate();
  const cartsQuery = useCarts();
  const itemsQuery = useCartItems(cartId);
  const createOrder = useCreateOrder();

  const [note, setNote] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);
  const [shipping, setShipping] = React.useState<ShippingAddressInput>(EMPTY_SHIPPING_ADDRESS);
  const [shippingErrors, setShippingErrors] = React.useState<Partial<Record<keyof ShippingAddressInput, string>>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const cart = cartsQuery.data?.find((c) => c.id === cartId);
  const { items } = useCartComputed(itemsQuery.data);

  const eligible = items.filter((i) => i.resolution_status === "resolved" && i.unit_price_usd_snapshot != null);
  const excluded = items.filter((i) => i.resolution_status !== "resolved" || i.unit_price_usd_snapshot == null);
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

  if (cart.status === "ordered") {
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
    const result = shippingAddressSchema.safeParse(shipping);
    if (!result.success) {
      const next: Partial<Record<keyof ShippingAddressInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in next)) {
          next[key as keyof ShippingAddressInput] = issue.message;
        }
      }
      setShippingErrors(next);
      return null;
    }
    setShippingErrors({});
    return result.data;
  }

  async function handleSubmit() {
    if (!cart) return;
    const address = validatedShipping();
    if (!address) {
      setConfirmOpen(false);
      toast.error("Bitte prüfe die Lieferadresse.");
      return;
    }
    if (!paymentMethod) {
      setPaymentError(PAYMENT_METHOD_REQUIRED_MESSAGE);
      setConfirmOpen(false);
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        cartId: cart.id,
        note: note.trim() || null,
        paymentMethod,
        shipping: address,
      });
      toast.success(`Bestellung ${result.orderNumber} wurde übermittelt.`);
      navigate(`/orders/${result.orderId}`);
    } catch (error) {
      console.error("Bestellung absenden fehlgeschlagen:", error);
      const message = error instanceof Error ? error.message : "Bestellung konnte nicht übermittelt werden.";
      toast.error(message);
      setConfirmOpen(false);
    }
  }

  function handleOpenConfirm() {
    const address = validatedShipping();
    if (!address) {
      toast.error("Bitte fülle die Lieferadresse vollständig aus.");
      return;
    }
    if (!paymentMethod) {
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
                    <TableHead className="hidden sm:table-cell">Preisart</TableHead>
                    <TableHead className="text-right">Gesamt USD</TableHead>
                    <TableHead className="hidden xs:table-cell text-right">Gesamt EUR</TableHead>
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
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(item.unit_price_usd_snapshot)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={item.applied_price_tier === "bulk" ? "default" : "secondary"}>
                          {item.applied_price_tier === "bulk" ? "Mengenpreis" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatUsd(item.totalUsd)}</TableCell>
                      <TableCell className="hidden xs:table-cell text-right tabular-nums text-primary">
                        {item.totalEur != null ? formatEur(item.totalEur) : "—"}
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
              <ShippingAddressFields
                value={shipping}
                onChange={(next) => {
                  setShipping(next);
                  setShippingErrors({});
                }}
                errors={shippingErrors}
              />
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={(method) => {
                  setPaymentMethod(method);
                  setPaymentError(null);
                }}
                error={paymentError}
              />
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
              <Button className="mt-1 w-full" size="lg" onClick={handleOpenConfirm}>
                Bestellung absenden
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Bestellung jetzt absenden?"
        description={`Du bestellst ${eligible.length} Position(en) im Gesamtwert von ${formatUsd(eligibleTotals.totalUsd)}. Lieferadresse und Telegram Benutzername werden mit der Bestellung gespeichert. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Verbindlich bestellen"
        loading={createOrder.isPending}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
