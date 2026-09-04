import * as React from "react";
import { AlertTriangle, Copy, MoreVertical, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
import { formatDateTime, formatEur, formatRate, formatUsd } from "@/lib/money";
import {
  cartItemDisplayName,
  cartItemQuantityLabel,
  cartItemVariantSubtitle,
  isKitShareCartItem,
} from "@/lib/shop/cartDisplay";
import type { ComputedCartItem } from "@/hooks/useCartComputed";

interface CartItemsTableProps {
  items: ComputedCartItem[];
  cartId: string;
  currentRate: number | null;
  nextPosition: number;
  readOnly?: boolean;
}

export function CartItemsTable({ items, cartId, currentRate, nextPosition, readOnly }: CartItemsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead className="w-36">Artikelcode</TableHead>
          <TableHead className="min-w-[180px]">Artikelname</TableHead>
          <TableHead className="w-24 text-right">Menge</TableHead>
          <TableHead className="w-28 text-right">Einzelpreis USD</TableHead>
          <TableHead className="w-28 text-right">Gesamt USD</TableHead>
          <TableHead className="w-24 text-right">Kurs</TableHead>
          <TableHead className="w-28 text-right">Gesamt EUR</TableHead>
          <TableHead className="w-36">Preisstand</TableHead>
          <TableHead className="min-w-[140px]">Notiz</TableHead>
          <TableHead className="w-16 text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <CartItemRowDesktop
            key={item.id}
            item={item}
            index={index}
            cartId={cartId}
            currentRate={currentRate}
            nextPosition={nextPosition + index}
            readOnly={readOnly}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function CartItemRowDesktop({
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
    <TableRow className={isProblem ? "bg-destructive/[0.03]" : item.isDuplicateCode ? "bg-warning/[0.04]" : undefined}>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Input
            value={row.codeInput}
            onChange={(e) => row.onCodeChange(e.target.value)}
            onBlur={row.onCodeBlur}
            invalid={item.resolution_status === "not_found"}
            disabled={readOnly}
            className="h-8 font-mono text-xs uppercase"
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <ResolutionStatusBadge status={item.resolution_status} />
          {item.isDuplicateCode && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" /> Duplikat
            </span>
          )}
          <SaveStatusIndicator status={row.codeStatus} />
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <div className="font-medium">{cartItemDisplayName(item)}</div>
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
      </TableCell>
      <TableCell>
        <Input
          value={row.quantityInput}
          onChange={(e) => row.onQuantityChange(e.target.value)}
          onBlur={row.onQuantityBlur}
          invalid={!!row.quantityError}
          disabled={readOnly}
          inputMode="decimal"
          className="h-8 text-right tabular-nums"
        />
        {row.quantityError && <p className="mt-1 text-[11px] text-destructive">{row.quantityError}</p>}
        <SaveStatusIndicator status={row.quantityStatus} className="mt-1 justify-end" />
        <p className="mt-1 text-[11px] text-muted-foreground">{cartItemQuantityLabel(item)}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {formatUsd(item.unit_price_usd_snapshot)}
        {/* Makes the two-tier price rule self-explanatory: why 55 and not 60. */}
        {item.applied_price_tier === "bulk" && (
          <span
            className="block text-[11px] font-normal text-primary"
            title={
              item.bulk_price_min_quantity_snapshot != null
                ? `Mengenpreis ab ${item.bulk_price_min_quantity_snapshot} Stück (Normalpreis ${formatUsd(
                    item.normal_price_usd_snapshot,
                  )})`
                : "Mengenpreis"
            }
          >
            Mengenpreis
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium">{formatUsd(item.totalUsd)}</TableCell>
      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
        {formatRate(item.exchange_rate_snapshot)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium text-primary">
        {item.totalEur != null ? formatEur(item.totalEur) : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.price_snapshot_at)}</TableCell>
      <TableCell>
        <Input
          value={row.noteInput}
          onChange={(e) => row.onNoteChange(e.target.value)}
          onBlur={row.onNoteBlur}
          placeholder="Notiz"
          disabled={readOnly}
          className="h-8 text-xs"
        />
        <SaveStatusIndicator status={row.noteStatus} className="mt-1" />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly}>
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
      </TableCell>
    </TableRow>
  );
}
