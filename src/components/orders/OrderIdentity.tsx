import { formatOrderTelegramSnapshot } from "@/services/orders";

/** Order number stays primary; Telegram handle is the frozen snapshot only. */
export function OrderIdentity({
  orderNumber,
  telegramSnapshot,
  stackedOnMobile = true,
}: {
  orderNumber: string;
  telegramSnapshot: string | null;
  stackedOnMobile?: boolean;
}) {
  const telegram = formatOrderTelegramSnapshot({ telegram_username_snapshot: telegramSnapshot });
  return (
    <div className="min-w-0">
      <p className="font-mono text-xs font-semibold sm:text-sm">{orderNumber}</p>
      <p className="truncate text-xs text-muted-foreground">
        {stackedOnMobile ? <span className="md:hidden">Telegram: </span> : null}
        {telegram}
      </p>
    </div>
  );
}
