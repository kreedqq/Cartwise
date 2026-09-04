import { AlertTriangle, Copy, MoreVertical, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SaveStatusIndicator } from "@/components/common/SaveStatusIndicator";
import { ResolutionStatusBadge } from "@/components/cart/ResolutionStatusBadge";
import { EditKitShareButton } from "@/components/shop/EditKitShareButton";
import { useCartItemRow } from "@/hooks/useCartItemRow";
import { formatDateTime, formatEur, formatUsd } from "@/lib/money";
import {
  cartItemDisplayName,
  cartItemQuantityLabel,
  cartItemVariantSubtitle,
  isKitShareCartItem,
} from "@/lib/shop/cartDisplay";
import type { ComputedCartItem } from "@/hooks/useCartComputed";

interface CartItemsMobileListProps {
  items: ComputedCartItem[];
  cartId: string;
  currentRate: number | null;
  nextPosition: number;
  readOnly?: boolean;
}

export function CartItemsMobileList({ items, cartId, currentRate, nextPosition, readOnly }: CartItemsMobileListProps) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <CartItemCardMobile
          key={item.id}
          item={item}
          index={index}
          cartId={cartId}
          currentRate={currentRate}
          nextPosition={nextPosition + index}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function CartItemCardMobile({
  item,
  index,
  cartId,
  currentRate,
  nextPosition,
  readOnly,
}: {
  item: ComputedCartItem;
  index: number;
  cartId: string;
  currentRate: number | null;
  nextPosition: number;
  readOnly?: boolean;
}) {
  const row = useCartItemRow(item, cartId, currentRate);
  const isProblem = item.resolution_status === "not_found" || item.resolution_status === "inactive";

  return (
    <Card className={isProblem ? "border-destructive/40" : item.isDuplicateCode ? "border-warning/40" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Position {index + 1}</p>
            <p className="truncate text-sm font-semibold">{cartItemDisplayName(item)}</p>
            {cartItemVariantSubtitle(item) && (
              <p className="mt-0.5 text-xs text-muted-foreground">{cartItemVariantSubtitle(item)}</p>
            )}
            {isKitShareCartItem(item) && (
              <>
                <span className="mt-1 inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Kit Anteil
                </span>
                {item.kit_share_id && <EditKitShareButton kitShareId={item.kit_share_id} />}
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={readOnly}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={row.duplicating} onClick={() => row.duplicate(nextPosition)}>
                <Copy /> Duplizieren
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={row.removing} onClick={row.remove}>
                <Trash2 /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Artikelcode</Label>
            <Input
              value={row.codeInput}
              onChange={(e) => row.onCodeChange(e.target.value)}
              onBlur={row.onCodeBlur}
              invalid={item.resolution_status === "not_found"}
              disabled={readOnly}
              className="h-9 font-mono text-xs uppercase"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <Input
              value={row.quantityInput}
              onChange={(e) => row.onQuantityChange(e.target.value)}
              onBlur={row.onQuantityBlur}
              invalid={!!row.quantityError}
              disabled={readOnly}
              inputMode="decimal"
              className="h-9 text-right tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">{cartItemQuantityLabel(item)}</p>
          </div>
        </div>
        {row.quantityError && <p className="text-xs text-destructive">{row.quantityError}</p>}

        <div className="flex flex-wrap items-center gap-1.5">
          <ResolutionStatusBadge status={item.resolution_status} />
          {item.isDuplicateCode && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" /> Duplikat
            </span>
          )}
          <SaveStatusIndicator status={row.codeStatus} />
          <SaveStatusIndicator status={row.quantityStatus} />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary/50 p-2.5 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">
              Gesamt USD
              {item.applied_price_tier === "bulk" && (
                <span className="ml-1 font-medium text-primary">· Mengenpreis</span>
              )}
            </p>
            <p className="font-semibold tabular-nums">{formatUsd(item.totalUsd)}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatUsd(item.unit_price_usd_snapshot)} / Stück
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Gesamt EUR</p>
            <p className="font-semibold tabular-nums text-primary">
              {item.totalEur != null ? formatEur(item.totalEur) : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notiz</Label>
          <Input
            value={row.noteInput}
            onChange={(e) => row.onNoteChange(e.target.value)}
            onBlur={row.onNoteBlur}
            placeholder="Optionale Notiz"
            disabled={readOnly}
            className="h-9 text-sm"
          />
          <SaveStatusIndicator status={row.noteStatus} />
        </div>

        <p className="text-[11px] text-muted-foreground">Preisstand: {formatDateTime(item.price_snapshot_at)}</p>
      </CardContent>
    </Card>
  );
}
