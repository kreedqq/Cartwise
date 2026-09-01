import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/components/ui/toaster";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { applyChinaSplit, previewChinaSplit, setDeShipping } from "@/services/shipping";
import { orderTelegramUsername } from "@/services/orders";
import { formatUsd, formatEur } from "@/lib/money";
import type { ShippingCurrency } from "@/types/database";

export default function AdminShippingPage() {
  const queryClient = useQueryClient();
  const ordersQuery = useAdminOrders();
  const orders = ordersQuery.data ?? [];

  const [chinaAmount, setChinaAmount] = React.useState("100");
  const [chinaCurrency, setChinaCurrency] = React.useState<ShippingCurrency>("USD");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [preview, setPreview] = React.useState<{ orderId: string; share: number }[] | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deDrafts, setDeDrafts] = React.useState<Record<string, { amount: string; currency: ShippingCurrency }>>({});

  const selectedIds = Array.from(selected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  }

  async function handlePreview() {
    const amount = Number(chinaAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || selectedIds.length === 0) {
      toast.error("Betrag und mindestens eine Bestellung angeben.");
      return;
    }
    try {
      const result = await previewChinaSplit(amount, selectedIds);
      setPreview(selectedIds.map((id, i) => ({ orderId: id, share: Number(result.shares[i]) })));
    } catch (error) {
      console.error("China-Versand Vorschau fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Vorschau fehlgeschlagen.");
    }
  }

  async function handleApplyChina() {
    const amount = Number(chinaAmount.replace(",", "."));
    try {
      await applyChinaSplit(amount, chinaCurrency, selectedIds);
      toast.success("Versand aus China verteilt.");
      setConfirmOpen(false);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (error) {
      console.error("China-Versand speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Verteilung fehlgeschlagen.");
    }
  }

  async function handleSaveDe(orderId: string) {
    const draft = deDrafts[orderId];
    const amount = draft ? Number(draft.amount.replace(",", ".")) : 0;
    try {
      await setDeShipping(
        orderId,
        !draft || !Number.isFinite(amount) || amount === 0 ? null : amount,
        !draft || amount === 0 ? null : draft.currency,
      );
      toast.success("Versand aus Deutschland gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (error) {
      console.error("DE-Versand speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Versand aus Deutschland fehlgeschlagen.");
    }
  }

  if (ordersQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (ordersQuery.isError) {
    return <ErrorState message="Bestellungen konnten nicht geladen werden." onRetry={() => ordersQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Versandkosten"
        description="Versandkosten aus China aufteilen und Deutschland-Versand individuell setzen."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versand aus China</CardTitle>
          <CardDescription>
            Betrag wird nur auf die ausgewählten Bestellungen aufgeteilt. Restcent auf die letzte Bestellung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Betrag</Label>
              <Input value={chinaAmount} onChange={(e) => setChinaAmount(e.target.value)} className="w-32" />
            </div>
            <div className="space-y-1">
              <Label>Währung</Label>
              <Select value={chinaCurrency} onValueChange={(v) => setChinaCurrency(v as ShippingCurrency)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{selectedIds.length} Besteller ausgewählt</p>
            <Button variant="outline" onClick={handlePreview}>
              Vorschau
            </Button>
            <Button disabled={!preview} onClick={() => setConfirmOpen(true)}>
              Verteilung bestätigen
            </Button>
          </div>

          {preview && (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bestellung</TableHead>
                  <TableHead className="text-right">Anteil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row) => {
                  const order = orders.find((o) => o.id === row.orderId);
                  return (
                    <TableRow key={row.orderId}>
                      <TableCell className="font-mono text-xs">{order?.order_number}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {chinaCurrency === "EUR" ? formatEur(row.share) : formatUsd(row.share)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Bestellung</TableHead>
                <TableHead>Telegram Benutzername</TableHead>
                <TableHead className="text-right">Aktueller Versand aus China</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggle(order.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                  <TableCell className="text-sm">{orderTelegramUsername(order) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {order.china_shipping_amount != null
                      ? `${order.china_shipping_amount} ${order.china_shipping_currency}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versand aus Deutschland</CardTitle>
          <CardDescription>Individuell pro Bestellung. Wird niemals durch die Anzahl der Besteller geteilt.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bestellung</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Währung</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const draft = deDrafts[order.id] ?? {
                  amount: order.de_shipping_amount != null ? String(order.de_shipping_amount) : "",
                  currency: order.de_shipping_currency ?? "EUR",
                };
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                    <TableCell>
                      <Input
                        value={draft.amount}
                        onChange={(e) =>
                          setDeDrafts((prev) => ({ ...prev, [order.id]: { ...draft, amount: e.target.value } }))
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={draft.currency}
                        onValueChange={(v) =>
                          setDeDrafts((prev) => ({ ...prev, [order.id]: { ...draft, currency: v as ShippingCurrency } }))
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleSaveDe(order.id)}>
                        Speichern
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Versand aus China jetzt verteilen?"
        description={`Der Betrag wird auf ${selectedIds.length} Bestellung(en) aufgeteilt und historisch gespeichert.`}
        confirmLabel="Verteilen"
        onConfirm={handleApplyChina}
      />
    </div>
  );
}
