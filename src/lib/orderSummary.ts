import {
  formatCompleteKitQuantityLabel,
  formatSharedKitQuantityLabel,
  formatSharedKitShareLabel,
  isKitComplete,
  kitProcessingQuantity,
  resolveKitShareIdForItem,
  resolvedKitParticipants,
  type KitShareOrderContext,
} from "@/lib/kitOrderSummary";
import { normalizeProductCode, roundCurrency } from "@/lib/money";
import { SHOP_CATEGORIES, shopCategoryIdFor, type ShopCategoryId } from "@/lib/shopCategories";
import { formatOrderTelegramSnapshot } from "@/services/orders";
import type { OrderStatus, Tables } from "@/types/database";

export const PROCESSING_ORDER_STATUS: OrderStatus = "processing";

/** Summary headings only. Shop storefront labels stay unchanged. */
export const ORDER_SUMMARY_CATEGORY_LABELS: Record<ShopCategoryId, string> = {
  peptides: "Peptide",
  "injectable-oils": "Injectable Oils",
  orals: "Orals",
  "reconstitution-water": "Reconstitution Water",
};

export interface CatalogCategoryHint {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  category?: string | null;
}

export interface OrderSummaryLine {
  code: string;
  name: string;
  quantity: number;
  /** Merchant quantity shown as-is, e.g. `5/10 Stück` or `1 Kit/s`. */
  quantityLabel: string;
  totalUsd: number;
  categoryId: ShopCategoryId;
  kitShareId?: string;
}

export interface OrderSummaryCustomerLine {
  code: string;
  name: string;
  quantity: number;
  quantityLabel: string;
  kitShareId?: string;
}

export interface OrderSummaryCustomer {
  orderNumber: string;
  telegramLabel: string;
  heading: string;
  lines: OrderSummaryCustomerLine[];
}

export interface OrderSummaryGroup {
  categoryId: ShopCategoryId;
  label: string;
  lines: OrderSummaryLine[];
}

export interface ProcessingOrderSummary {
  orderCount: number;
  productCount: number;
  totalQuantity: number;
  totalUsd: number;
  groups: OrderSummaryGroup[];
  customers: OrderSummaryCustomer[];
}

export function isProcessingOrder(order: { status: string }): boolean {
  return order.status === PROCESSING_ORDER_STATUS;
}

export function formatOrderSummaryCustomerHeading(orderNumber: string, telegramLabel: string): string {
  return `${orderNumber} | ${telegramLabel}`;
}

export function formatOrderSummaryCustomerPdfRow(
  orderNumber: string,
  telegramLabel: string,
  quantityLabel: string,
): string {
  return `${orderNumber} | ${telegramLabel} | ${quantityLabel}`;
}

function catalogHintForItem(
  item: Tables<"order_items">,
  byId: Map<string, CatalogCategoryHint>,
  byCode: Map<string, CatalogCategoryHint>,
): CatalogCategoryHint {
  const fromId = item.product_id ? byId.get(item.product_id) : undefined;
  if (fromId) return fromId;
  const fromCode = byCode.get(normalizeProductCode(item.product_code_snapshot ?? ""));
  if (fromCode) return fromCode;
  return {
    code: item.product_code_snapshot,
    name: item.product_name_snapshot,
    category: null,
  };
}

function productMergeKey(item: Tables<"order_items">): string {
  const code = normalizeProductCode(item.product_code_snapshot ?? "");
  if (code) return `code:${code}`;
  const name = item.product_name_snapshot?.trim() ?? "";
  const dosage = item.dosage_vial_snapshot?.trim() ?? "";
  if (name || dosage) return `name:${name.toLowerCase()}|${dosage.toLowerCase()}`;
  return `item:${item.id}`;
}

function sortLines<T extends { name: string; code: string }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const name = a.name.localeCompare(b.name, "de");
    if (name !== 0) return name;
    return a.code.localeCompare(b.code, "de");
  });
}

function emptyKitContext(): KitShareOrderContext {
  return { kits: [], participants: [] };
}

function formatPlainQuantityLabel(quantity: number): string {
  return String(quantity);
}

/** Merchant buy list from frozen order_items of processing orders only. */
export function buildProcessingOrderSummary(
  orders: Tables<"orders">[],
  items: Tables<"order_items">[],
  catalog: CatalogCategoryHint[] = [],
  kitContext: KitShareOrderContext = emptyKitContext(),
): ProcessingOrderSummary {
  const processing = orders.filter(isProcessingOrder);
  const processingIds = new Set(processing.map((order) => order.id));
  const processingItems = items.filter((item) => processingIds.has(item.order_id));

  const byId = new Map<string, CatalogCategoryHint>();
  const byCode = new Map<string, CatalogCategoryHint>();
  for (const product of catalog) {
    if (product.id) byId.set(product.id, product);
    const code = normalizeProductCode(product.code ?? "");
    if (code) byCode.set(code, product);
  }

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const participants = resolvedKitParticipants(kitContext, orders);
  const resolvedContext: KitShareOrderContext = { ...kitContext, participants };
  const kits = new Map(kitContext.kits.map((kit) => [kit.id, kit]));
  const kitProgress = new Map<string, { processingQuantity: number; kitSize: number; complete: boolean }>();
  for (const kit of kitContext.kits) {
    const processingQuantity = kitProcessingQuantity(kit.id, participants, ordersById);
    kitProgress.set(kit.id, {
      processingQuantity,
      kitSize: kit.kit_size_vials,
      complete: isKitComplete(processingQuantity, kit.kit_size_vials),
    });
  }

  const kitItemsByShare = new Map<string, Tables<"order_items">[]>();
  const regularItems: Tables<"order_items">[] = [];
  for (const item of processingItems) {
    const order = ordersById.get(item.order_id);
    const kitShareId = resolveKitShareIdForItem(item, order, resolvedContext, participants);
    if (kitShareId && kits.has(kitShareId)) {
      const list = kitItemsByShare.get(kitShareId) ?? [];
      list.push(item);
      kitItemsByShare.set(kitShareId, list);
      continue;
    }
    regularItems.push(item);
  }

  const merged = new Map<string, OrderSummaryLine>();

  function lineMeta(item: Tables<"order_items">) {
    const hint = catalogHintForItem(item, byId, byCode);
    const code = (item.product_code_snapshot ?? "").trim() || hint.code?.trim() || "—";
    const name = (item.product_name_snapshot ?? "").trim() || hint.name?.trim() || "Nicht verfügbar";
    const categoryId = shopCategoryIdFor({
      category: hint.category,
      name,
      code: item.product_code_snapshot,
    });
    return { hint, code, name, categoryId };
  }

  for (const item of regularItems) {
    const key = productMergeKey(item);
    const { code, name, categoryId } = lineMeta(item);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.quantityLabel = formatPlainQuantityLabel(existing.quantity);
      existing.totalUsd = roundCurrency(existing.totalUsd + Number(item.line_total_usd));
      continue;
    }
    merged.set(key, {
      code,
      name,
      quantity: item.quantity,
      quantityLabel: formatPlainQuantityLabel(item.quantity),
      totalUsd: roundCurrency(Number(item.line_total_usd)),
      categoryId,
    });
  }

  for (const [kitShareId, kitItems] of kitItemsByShare) {
    const kit = kits.get(kitShareId);
    const progress = kitProgress.get(kitShareId);
    if (!kit || !progress) continue;
    const first = kitItems[0];
    const { code, name, categoryId } = lineMeta(first);
    const totalUsd = roundCurrency(kitItems.reduce((sum, item) => sum + Number(item.line_total_usd), 0));
    if (progress.complete) {
      const key = `kit-complete:${productMergeKey(first)}`;
      const existing = merged.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.quantityLabel = formatCompleteKitQuantityLabel(existing.quantity);
        existing.totalUsd = roundCurrency(existing.totalUsd + totalUsd);
        continue;
      }
      merged.set(key, {
        code,
        name,
        quantity: 1,
        quantityLabel: formatCompleteKitQuantityLabel(1),
        totalUsd,
        categoryId,
        kitShareId,
      });
      continue;
    }
    merged.set(`kit-share:${kitShareId}`, {
      code,
      name,
      quantity: progress.processingQuantity,
      quantityLabel: formatSharedKitQuantityLabel(progress.processingQuantity, progress.kitSize),
      totalUsd,
      categoryId,
      kitShareId,
    });
  }

  const groups: OrderSummaryGroup[] = SHOP_CATEGORIES.map((category) => ({
    categoryId: category.id,
    label: ORDER_SUMMARY_CATEGORY_LABELS[category.id],
    lines: sortLines([...merged.values()].filter((line) => line.categoryId === category.id)),
  })).filter((group) => group.lines.length > 0);

  const customers: OrderSummaryCustomer[] = [...processing]
    .sort((a, b) => a.order_number.localeCompare(b.order_number, "de"))
    .map((order) => {
      const telegramLabel = formatOrderTelegramSnapshot(order);
      const lineMap = new Map<string, OrderSummaryCustomerLine>();
      for (const item of processingItems.filter((row) => row.order_id === order.id)) {
        const kitShareId = resolveKitShareIdForItem(item, order, resolvedContext, participants);
        const progress = kitShareId ? kitProgress.get(kitShareId) : undefined;
        const lineKey = kitShareId ? `kit:${kitShareId}` : productMergeKey(item);
        const code = (item.product_code_snapshot ?? "").trim() || "—";
        const name = (item.product_name_snapshot ?? "").trim() || "Nicht verfügbar";
        const quantityLabel = progress
          ? progress.complete
            ? formatCompleteKitQuantityLabel(1)
            : formatSharedKitShareLabel(item.quantity, progress.kitSize)
          : formatPlainQuantityLabel(item.quantity);
        const existing = lineMap.get(lineKey);
        if (existing && !kitShareId) {
          existing.quantity += item.quantity;
          existing.quantityLabel = formatPlainQuantityLabel(existing.quantity);
          continue;
        }
        if (existing) continue;
        lineMap.set(lineKey, {
          code,
          name,
          quantity: item.quantity,
          quantityLabel,
          kitShareId: kitShareId ?? undefined,
        });
      }
      return {
        orderNumber: order.order_number,
        telegramLabel,
        heading: formatOrderSummaryCustomerHeading(order.order_number, telegramLabel),
        lines: sortLines([...lineMap.values()]),
      };
    });

  const allLines = groups.flatMap((group) => group.lines);
  return {
    orderCount: processing.length,
    productCount: allLines.length,
    totalQuantity: allLines.reduce((sum, line) => sum + line.quantity, 0),
    totalUsd: roundCurrency(allLines.reduce((sum, line) => sum + line.totalUsd, 0)),
    groups,
    customers,
  };
}
