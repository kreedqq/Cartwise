import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryMethodSelector } from "@/components/checkout/DeliveryMethodSelector";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { ShippingAddressFields } from "@/components/checkout/ShippingAddressFields";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { useEnabledPaymentMethods } from "@/hooks/useAppPublicState";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  useAdminCreateOrderForCustomer,
  useAdminCustomerCheckoutContext,
  useAdminCustomerKitCheckoutOptions,
  useAdminOrderPreview,
  useAdminShopProductsForCustomer,
} from "@/hooks/useAdminOrderCreate";
import { summarizeOrderCharges } from "@/lib/money";
import { formatShopAreaLabel } from "@/lib/shop/shopAreas";
import {
  EMPTY_CHECKOUT_SHIPPING,
  parseCheckoutShipping,
  type CheckoutShippingField,
  type CheckoutShippingForm,
} from "@/lib/shippingAddress";
import {
  PAYMENT_METHOD_REQUIRED_MESSAGE,
  PAYMENT_METHODS_UNAVAILABLE_MESSAGE,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";
import { adminSearchKitRequestUsers } from "@/services/adminKitRequests";
import type { AdminOrderCreateLine } from "@/services/adminOrderCreate";
import { toast } from "@/components/ui/toaster";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { listAdminShopAreas } from "@/services/shopAreas";

const STEPS = ["Kunde", "Artikel", "Versand", "Zusammenfassung"] as const;

export default function AdminCreateOrderForCustomerPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(0);
  const [userQuery, setUserQuery] = React.useState("");
  const [customerUserId, setCustomerUserId] = React.useState<string | null>(null);
  const [customerUsername, setCustomerUsername] = React.useState<string | null>(null);
  const [shopArea, setShopArea] = React.useState<string>("shop");
  const [productSearch, setProductSearch] = React.useState("");
  const [lines, setLines] = React.useState<AdminOrderCreateLine[]>([]);
  const [note, setNote] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [shipping, setShipping] = React.useState<CheckoutShippingForm>(EMPTY_CHECKOUT_SHIPPING);
  const [shippingErrors, setShippingErrors] = React.useState<Partial<Record<CheckoutShippingField, string>>>({});

  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const userSearchQuery = useQuery({
    queryKey: ["admin-order-create-user-search", userQuery],
    queryFn: () => adminSearchKitRequestUsers(userQuery),
    enabled: userQuery.trim().length >= 2,
  });
  const contextQuery = useAdminCustomerCheckoutContext(customerUserId);
  const productsQuery = useAdminShopProductsForCustomer(shopArea, customerUserId);
  const kitOptionsQuery = useAdminCustomerKitCheckoutOptions(customerUserId, null);
  const previewQuery = useAdminOrderPreview(customerUserId, lines);
  const createMutation = useAdminCreateOrderForCustomer();
  const paymentMethods = useEnabledPaymentMethods();
  const rateQuery = useExchangeRate();

  const effectivePayment =
    paymentMethod != null && paymentMethods.methods.includes(paymentMethod) ? paymentMethod : null;

  const filteredProducts = React.useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const list = productsQuery.data ?? [];
    if (!term) return list.slice(0, 40);
    return list
      .filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          (p.dosage_vial ?? "").toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [productsQuery.data, productSearch]);

  const charges = React.useMemo(() => {
    const productUsd = previewQuery.data?.totalUsd ?? 0;
    const rate = rateQuery.data?.rate ?? null;
    const productEur = rate != null && rate > 0 ? Math.round(productUsd * rate * 100) / 100 : null;
    return summarizeOrderCharges({ productUsd, productEur, usdToEurRate: rate });
  }, [previewQuery.data?.totalUsd, rateQuery.data?.rate]);

  function addCatalogLine(productCode: string, quantity: number) {
    setLines((prev) => [
      ...prev,
      { kind: "catalog", shopArea, vendorCode: productCode, quantity: Math.max(1, quantity) },
    ]);
  }

  function addKitLine(kitShareId: string) {
    if (lines.some((l) => l.kind === "kit" && l.kitShareId === kitShareId)) return;
    setLines((prev) => [...prev, { kind: "kit", kitShareId }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCatalogQty(index: number, quantity: number) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index && line.kind === "catalog" ? { ...line, quantity: Math.max(1, quantity) } : line,
      ),
    );
  }

  async function submitOrder() {
    if (!customerUserId || lines.length === 0) return;
    const parsed = parseCheckoutShipping(shipping);
    if (!parsed.success) {
      setShippingErrors(parsed.error.fieldErrors);
      return;
    }
    if (!effectivePayment) {
      toast.error(PAYMENT_METHOD_REQUIRED_MESSAGE);
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        customerUserId,
        lines,
        note: note.trim() || null,
        paymentMethod: effectivePayment,
        shipping: parsed.data,
      });
      toast.success(`Bestellung ${result.orderNumber} erstellt.`);
      navigate(`/admin/orders/${result.orderId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bestellung fehlgeschlagen.");
    }
  }

  if (areasQuery.isLoading) return <FullScreenSpinner label="Admin wird geladen …" />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bestellung für Kunden erstellen"
        description="Preise und Snapshots werden serverseitig für den ausgewählten Kunden berechnet."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {STEPS.map((label, index) => (
          <span key={label} className={index === step ? "font-medium text-foreground" : undefined}>
            {index + 1}. {label}
            {index < STEPS.length - 1 ? " →" : ""}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kunde auswählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-search">Telegram / Username</Label>
              <Input
                id="user-search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Mindestens 2 Zeichen …"
              />
            </div>
            {userSearchQuery.data?.map((hit) => (
              <Button
                key={hit.userId}
                variant={customerUserId === hit.userId ? "default" : "outline"}
                className="mr-2"
                onClick={() => {
                  setCustomerUserId(hit.userId);
                  setCustomerUsername(hit.username);
                  setLines([]);
                }}
              >
                @{hit.username}
              </Button>
            ))}
            {customerUserId && contextQuery.data && (
              <div className="rounded-md border p-4 text-sm">
                <p>
                  Kunde: <strong>@{customerUsername ?? contextQuery.data.username ?? "—"}</strong>
                </p>
                <p>
                  Rolle: <strong>{contextQuery.data.roleName ?? "—"}</strong> · {contextQuery.data.markupPercent} %
                  Aufschlag
                </p>
              </div>
            )}
            <Button disabled={!customerUserId} onClick={() => setStep(1)}>
              Weiter
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && customerUserId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Produkte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={shopArea} onValueChange={setShopArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Verkaufsbereich" />
                </SelectTrigger>
                <SelectContent>
                  {(areasQuery.data ?? []).map((area) => (
                    <SelectItem key={area.key} value={area.key}>
                      {area.name || formatShopAreaLabel(area.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Produkt suchen …"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productsQuery.isError && (
                <ErrorState message="Katalog konnte nicht geladen werden." onRetry={() => productsQuery.refetch()} />
              )}
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {filteredProducts.map((p) => (
                  <li key={`${shopArea}-${p.code}`} className="flex items-center justify-between gap-2">
                    <span>
                      {p.code} · {p.name}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => addCatalogLine(p.code, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kit-Anteile (bestehend)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(kitOptionsQuery.data ?? [])
                .filter((k) => k.checkoutReady)
                .map((k) => (
                  <div key={k.kitShareId} className="flex items-start justify-between gap-2 border-b pb-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {k.productName} · {k.kitSizeVials}er Kit ({k.status})
                      </p>
                      <p className="text-muted-foreground">
                        Anteil {k.participantQuantity}/{k.kitSizeVials} · {formatShopAreaLabel(k.shopArea)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addKitLine(k.kitShareId)}>
                      Hinzufügen
                    </Button>
                  </div>
                ))}
              {(kitOptionsQuery.data ?? []).filter((k) => k.checkoutReady).length === 0 && (
                <p className="text-sm text-muted-foreground">Keine bestellbereiten Kit-Anteile für diesen Kunden.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Positionen</CardTitle>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Positionen.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={`${line.kind}-${index}`}>
                        <TableCell>
                          {line.kind === "kit" ? `Kit ${line.kitShareId.slice(0, 8)}…` : `${line.vendorCode} (${line.shopArea})`}
                        </TableCell>
                        <TableCell>
                          {line.kind === "catalog" ? (
                            <Input
                              type="number"
                              min={1}
                              className="w-24"
                              value={line.quantity}
                              onChange={(e) => updateCatalogQty(index, Number(e.target.value))}
                            />
                          ) : (
                            "Kit-Anteil"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeLine(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Zurück
                </Button>
                <Button disabled={lines.length === 0} onClick={() => setStep(2)}>
                  Weiter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Versand & Zahlung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DeliveryMethodSelector
              value={shipping.deliveryMethod}
              onChange={(m) => setShipping((s) => ({ ...s, deliveryMethod: m }))}
            />
            {shipping.deliveryMethod === "home" || shipping.deliveryMethod === "packstation" ? (
              <ShippingAddressFields
                value={shipping}
                onChange={setShipping}
                deliveryMethod={shipping.deliveryMethod}
                errors={shippingErrors}
              />
            ) : null}
            {paymentMethods.methods.length === 0 ? (
              <p className="text-sm text-destructive">{PAYMENT_METHODS_UNAVAILABLE_MESSAGE}</p>
            ) : (
              <PaymentMethodSelector
                methods={paymentMethods.methods}
                value={effectivePayment}
                onChange={setPaymentMethod}
              />
            )}
            <Textarea placeholder="Interne Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <Button onClick={() => setStep(3)}>Weiter zur Zusammenfassung</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && customerUserId && (
        <Card>
          <CardHeader>
            <CardTitle>Bestellung erstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewQuery.isLoading && <FullScreenSpinner label="Server-Vorschau …" />}
            {previewQuery.isError && (
              <ErrorState message="Vorschau fehlgeschlagen." onRetry={() => previewQuery.refetch()} />
            )}
            {previewQuery.data && contextQuery.data && (
              <>
                <div className="rounded-md border p-4 text-sm">
                  <p>
                    BESTELLUNG FÜR <strong>@{customerUsername ?? "—"}</strong>
                  </p>
                  <p>
                    ROLLE <strong>{previewQuery.data.roleName ?? contextQuery.data.roleName}</strong> ·{" "}
                    {previewQuery.data.markupPercent} %
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead>Einzelpreis</TableHead>
                      <TableHead>Gesamt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewQuery.data.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {item.productName} ({item.productCode})
                          {item.kind === "kit" ? " · Kit-Anteil" : ""}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <DualCurrencyPrice usd={item.unitPriceUsd} eur={null} rate={rateQuery.data?.rate ?? null} />
                        </TableCell>
                        <TableCell>
                          <DualCurrencyPrice usd={item.lineTotalUsd} eur={null} rate={rateQuery.data?.rate ?? null} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm">
                  Zwischensumme:{" "}
                  <DualCurrencyPrice usd={charges.productUsd} eur={charges.productEur} rate={rateQuery.data?.rate ?? null} />
                </p>
                <p className="text-sm font-medium">
                  Gesamt:{" "}
                  <DualCurrencyPrice usd={charges.grandUsd} eur={charges.grandEur} rate={rateQuery.data?.rate ?? null} />
                </p>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                disabled={createMutation.isPending || !previewQuery.data || !effectivePayment}
                onClick={() => void submitOrder()}
              >
                {createMutation.isPending ? "Wird erstellt …" : "Bestellung erstellen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
