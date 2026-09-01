import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatShippingAddressLines,
  formatShippingRecipient,
  hasShippingSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/shippingAddress";

export function OrderShippingDetails({ snapshot }: { snapshot: OrderShippingSnapshot }) {
  const telegram = snapshot.telegram_username_snapshot?.trim();
  const recipient = formatShippingRecipient(snapshot);
  const lines = formatShippingAddressLines(snapshot);
  const hasAddress = hasShippingSnapshot(snapshot);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Telegram Benutzername</p>
        <p className="font-medium">{telegram || "—"}</p>
      </div>
      {hasAddress ? (
        <div>
          <p className="text-xs text-muted-foreground">Lieferadresse</p>
          {recipient && <p className="font-medium">{recipient}</p>}
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Keine Lieferadresse gespeichert.</p>
      )}
    </div>
  );
}

export function OrderShippingCard({ snapshot }: { snapshot: OrderShippingSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lieferung</CardTitle>
      </CardHeader>
      <CardContent>
        <OrderShippingDetails snapshot={snapshot} />
      </CardContent>
    </Card>
  );
}
