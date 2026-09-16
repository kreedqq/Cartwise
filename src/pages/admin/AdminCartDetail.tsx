import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Trash2 } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useQuery } from "@tanstack/react-query";
import { useAdminCartMutations, useAdminOpenCartDetail } from "@/hooks/useAdminCarts";
import { QUERY_KEYS } from "@/lib/constants";
import { listShopProductsForArea } from "@/services/shopAreas";
import { cartItemQuantityLabel } from "@/lib/shop/cartDisplay";
import { formatUsd } from "@/lib/money";
import { formatShopAreaLabel, type ShopAreaKey } from "@/lib/shop/shopAreas";
import { EMPTY_CHECKOUT_SHIPPING, parseCheckoutShipping } from "@/lib/shippingAddress";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { DeliveryMethodSelector } from "@/components/checkout/DeliveryMethodSelector";
import { ShippingAddressFields } from "@/components/checkout/ShippingAddressFields";
import { useEnabledPaymentMethods } from "@/hooks/useAppPublicState";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { AdminOpenCartDetail } from "@/services/adminCarts";
import type { Tables } from "@/types/database";

type CartItemRow = AdminOpenCartDetail["items"][number];
type Mutations = ReturnType<typeof useAdminCartMutations>;

function CartCatalogLineRow({
  item,
  shopArea,
  mutations,
  catalogProducts,
}: {
  item: CartItemRow;
  shopArea: ShopAreaKey;
  mutations: Mutations;
  catalogProducts: Tables<"products">[];
}) {
  const isKit = Boolean(item.kit_share_id);
  const [qtyDraft, setQtyDraft] = React.useState(String(item.quantity));
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  const parsedQty = Number(qtyDraft);
  const qtyDirty = Number.isFinite(parsedQty) && parsedQty !== item.quantity;

  const lineTotal =
    item.unit_price_usd_snapshot != null
      ? Math.round(item.quantity * item.unit_price_usd_snapshot * 100) / 100
      : null;

  async function saveQuantity() {
    const qtyRaw = qtyInputRef.current?.value ?? qtyDraft;
    const qtyToSave = Number(qtyRaw);
    if (!Number.isFinite(qtyToSave) || qtyToSave <= 0) {
      toast.error("Ungültige Menge.");
      return;
    }
    if (qtyToSave === item.quantity) return;
    try {
      await mutations.updateQuantity.mutateAsync({ itemId: item.id, quantity: qtyToSave });
      toast.success("Menge aktualisiert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Menge konnte nicht gespeichert werden.");
    }
  }

  async function removeLine() {
    try {
      await mutations.removeItem.mutateAsync(item.id);
      toast.success("Position entfernt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
    }
  }

  return (
    <TableRow>
      <TableCell>{item.product_code_snapshot ?? item.vendor_code}</TableCell>
      <TableCell>{item.product_name_snapshot}</TableCell>
      <TableCell>
        {isKit ? (
          <p className="text-sm">
            {item.quantity}{" "}
            <span className="text-xs text-muted-foreground">
              ({cartItemQuantityLabel(item, item.kit_size_vials ?? null)} · Kit)
            </span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={qtyInputRef}
              type="number"
              min={1}
              className="w-20"
              value={qtyDraft}
              onChange={(e) => setQtyDraft(e.target.value)}
              aria-label={`Menge ${item.product_code_snapshot ?? item.vendor_code}`}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!qtyDirty || mutations.updateQuantity.isPending}
              loading={mutations.updateQuantity.isPending}
              onClick={() => void saveQuantity()}
            >
              Menge speichern
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              {cartItemQuantityLabel(item, item.kit_size_vials ?? null)}
            </p>
          </div>
        )}
      </TableCell>
      <TableCell>{item.unit_price_usd_snapshot != null ? formatUsd(item.unit_price_usd_snapshot) : "—"}</TableCell>
      <TableCell>{lineTotal != null ? formatUsd(lineTotal) : "—"}</TableCell>
      <TableCell>{isKit ? item.kit_status ?? "Kit" : "—"}</TableCell>
      <TableCell>
        {!isKit ? (
          <div className="flex flex-wrap gap-1">
            <ReplaceLineButton
              item={item}
              shopArea={shopArea}
              mutations={mutations}
              catalogProducts={catalogProducts}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Entfernen"
              loading={mutations.removeItem.isPending}
              onClick={() => void removeLine()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Kit über Kit-Gesuche verwalten.</p>
        )}
      </TableCell>
    </TableRow>
  );
}

function ReplaceLineButton({
  item,
  shopArea,
  mutations,
  catalogProducts,
}: {
  item: CartItemRow;
  shopArea: ShopAreaKey;
  mutations: Mutations;
  catalogProducts: Tables<"products">[];
}) {
  const [open, setOpen] = React.useState(false);
  const [newCode, setNewCode] = React.useState("");
  const [newQty, setNewQty] = React.useState(String(item.quantity));
  const replaceCodeRef = React.useRef<HTMLInputElement>(null);
  const replaceQtyRef = React.useRef<HTMLInputElement>(null);

  function openDialog() {
    setNewCode("");
    setNewQty(String(item.quantity));
    setOpen(true);
  }

  async function confirmReplace() {
    const code = (replaceCodeRef.current?.value ?? newCode).trim();
    if (!code) {
      toast.error("Neuen Produktcode eingeben.");
      return;
    }
    const qty = Number(replaceQtyRef.current?.value ?? newQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Ungültige Menge.");
      return;
    }
    const product = catalogProducts.find((p) => p.code.toUpperCase() === code.toUpperCase());
    if (!product) {
      toast.error("Produkt nicht im Katalog dieses Bereichs.");
      return;
    }
    try {
      await mutations.replaceCatalogLine.mutateAsync({
        itemId: item.id,
        shopArea,
        vendorCode: product.code,
        productId: product.id,
        quantity: qty,
      });
      toast.success("Produkt ersetzt");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ersetzen fehlgeschlagen.");
    }
  }

  const currentLabel = item.product_code_snapshot ?? item.vendor_code;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={openDialog}>
        <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
        Ersetzen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Produkt ersetzen</DialogTitle>
            <DialogDescription>
              Ersetzt die Katalogposition <strong>{currentLabel}</strong> durch ein anderes Produkt im selben Bereich.
              Der Preis wird serverseitig neu berechnet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="replace-code">Neuer Code</Label>
              <Input
                id="replace-code"
                ref={replaceCodeRef}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="z. B. AD5"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="replace-qty">Menge</Label>
              <Input
                id="replace-qty"
                ref={replaceQtyRef}
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-28"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" loading={mutations.replaceCatalogLine.isPending} onClick={() => void confirmReplace()}>
              Ersetzen bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminCartDetailPage() {
  const { cartId } = useParams<{ cartId: string }>();
  const navigate = useNavigate();
  const detailQuery = useAdminOpenCartDetail(cartId ?? null);
  const mutations = useAdminCartMutations(cartId ?? "");

  const cartShopArea = detailQuery.data?.cart.shop_area ?? null;
  const lineShopArea = detailQuery.data?.items.find((row) => row.shop_area)?.shop_area ?? null;
  const defaultArea = (lineShopArea ?? cartShopArea ?? "group_buy_1") as ShopAreaKey;

  const productsQuery = useQuery({
    queryKey: QUERY_KEYS.shopProducts(defaultArea),
    queryFn: () => listShopProductsForArea(defaultArea),
    enabled: Boolean(defaultArea),
  });
  const paymentMethods = useEnabledPaymentMethods();

  const [addCode, setAddCode] = React.useState("");
  const [addQty, setAddQty] = React.useState("1");
  const addCodeInputRef = React.useRef<HTMLInputElement>(null);
  const addQtyInputRef = React.useRef<HTMLInputElement>(null);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [shipping, setShipping] = React.useState(EMPTY_CHECKOUT_SHIPPING);
  const [note, setNote] = React.useState("");

  if (!cartId) return null;

  if (detailQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState message="Warenkorb konnte nicht geladen werden." onRetry={() => detailQuery.refetch()} />;
  }

  const { cart, customer, items } = detailQuery.data;

  async function onAddProduct() {
    if (productsQuery.isLoading) {
      toast.error("Katalog wird noch geladen …");
      return;
    }
    const codeInput = (addCodeInputRef.current?.value ?? addCode).trim();
    const qtyRaw = addQtyInputRef.current?.value ?? addQty;
    const product = (productsQuery.data ?? []).find(
      (p) => p.code.toUpperCase() === codeInput.toUpperCase(),
    );
    if (!product) {
      toast.error("Produkt nicht im Katalog dieses Bereichs.");
      return;
    }
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Ungültige Menge.");
      return;
    }
    try {
      await mutations.addCatalogLine.mutateAsync({
        shopArea: defaultArea,
        vendorCode: product.code,
        productId: product.id,
        quantity: qty,
      });
      setAddCode("");
      toast.success("Position hinzugefügt");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hinzufügen fehlgeschlagen.");
    }
  }

  async function onCheckout() {
    const parsed = parseCheckoutShipping(shipping);
    if (!parsed.success) {
      toast.error("Versandadresse unvollständig.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Zahlungsmethode wählen.");
      return;
    }
    const s = parsed.data;
    const shippingPayload =
      s.deliveryMethod === "home"
        ? {
            firstName: s.firstName,
            lastName: s.lastName,
            street: s.street,
            houseNumber: s.houseNumber,
            addressExtra: s.addressExtra ?? null,
            postalCode: s.postalCode,
            city: s.city,
            country: s.country,
            deliveryMethod: s.deliveryMethod,
            packstationNumber: null,
            postNumber: null,
          }
        : {
            firstName: s.firstName,
            lastName: s.lastName,
            street: null,
            houseNumber: null,
            addressExtra: null,
            postalCode: s.postalCode,
            city: s.city,
            country: s.country,
            deliveryMethod: s.deliveryMethod,
            packstationNumber: s.packstationNumber,
            postNumber: s.postNumber,
          };
    try {
      const result = await mutations.checkout.mutateAsync({
        note: note.trim() || null,
        paymentMethod,
        shipping: shippingPayload,
      });
      toast.success(`Bestellung erstellt (${String(result.orderNumber ?? result.orderId ?? "OK")}).`);
      navigate(`/admin/orders/${result.orderId ?? ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/admin/carts">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Warenkörbe
        </Link>
      </Button>

      <AdminPageHeader
        section="Bestellungen"
        title={`Warenkorb · ${customer.username ?? "Kunde"}`}
        description={`Status ${cart.status} · ${formatShopAreaLabel(defaultArea)}`}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Menge</TableHead>
              <TableHead>Einzel</TableHead>
              <TableHead>Gesamt</TableHead>
              <TableHead>Kit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <CartCatalogLineRow
                key={`${item.id}-${item.quantity}`}
                item={item}
                shopArea={defaultArea}
                mutations={mutations}
                catalogProducts={productsQuery.data ?? []}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Produkt hinzufügen</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="add-code">Code</Label>
            <Input
              id="add-code"
              ref={addCodeInputRef}
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              placeholder="z. B. BA3"
            />
          </div>
          <div>
            <Label htmlFor="add-qty">Menge</Label>
            <Input
              id="add-qty"
              ref={addQtyInputRef}
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="w-24"
            />
          </div>
          <Button
            type="button"
            loading={mutations.addCatalogLine.isPending}
            disabled={productsQuery.isLoading}
            onClick={() => void onAddProduct()}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setCheckoutOpen((v) => !v)}>
          Warenkorb als Kunde absenden
        </Button>
      </div>

      {checkoutOpen && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} methods={paymentMethods.methods} />
          <DeliveryMethodSelector
            value={shipping.deliveryMethod}
            onChange={(m) => setShipping({ ...shipping, deliveryMethod: m })}
          />
          <ShippingAddressFields
            value={shipping}
            onChange={setShipping}
            deliveryMethod={shipping.deliveryMethod === "packstation" ? "packstation" : "home"}
          />
          <div>
            <Label htmlFor="checkout-note">Notiz</Label>
            <Input id="checkout-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="button" loading={mutations.checkout.isPending} onClick={() => void onCheckout()}>
            Bestellung absenden
          </Button>
        </div>
      )}
    </div>
  );
}
