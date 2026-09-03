import {
  asQuantity,
  formatCompleteKitQuantityLabel,
  formatSharedKitQuantityLabel,
  formatSharedKitShareLabel,
  kitProcessingQuantity,
  resolveKitShareIdForItem,
  resolvedKitParticipants,
  splitKitProgress,
  type KitShareOrderContext,
} from "@/lib/kitOrderSummary";
import { normalizeProductCode, roundCurrency } from "@/lib/money";
import { SHOP_CATEGORIES, shopCategoryIdFor, type ShopCategoryId } from "@/lib/shopCategories";
import {
  formatOralVariantLabel,
  normalizeStrengthToken,
  parseVariantColumn,
} from "@/lib/shop/variantCoverage";
import { formatOrderTelegramSnapshot, ORDER_TELEGRAM_SNAPSHOT_UNAVAILABLE } from "@/services/orders";
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
  dosage_vial?: string | null;
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

export interface OrderSummaryPersonLine {
  name: string;
  quantity: number;
  quantityLabel: string;
  dose: string;
  article: string;
  code: string;
  kitShareId?: string;
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
  personCount: number;
  positionCount: number;
  personQuantityTotal: number;
  personLines: OrderSummaryPersonLine[];
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
    dosage_vial: item.dosage_vial_snapshot,
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

function resolveKitContext(kitContext?: KitShareOrderContext | null): KitShareOrderContext {
  if (!kitContext || !Array.isArray(kitContext.kits) || !Array.isArray(kitContext.participants)) {
    return emptyKitContext();
  }
  return kitContext;
}

function formatPlainQuantityLabel(quantity: number): string {
  return String(asQuantity(quantity));
}

function allocateStoredKitTotals(
  totalUsd: number,
  completeKits: number,
  remainderVials: number,
  kitSize: number,
): { completeUsd: number; remainderUsd: number } {
  const completeVials = completeKits * kitSize;
  const totalVials = completeVials + remainderVials;
  if (totalVials <= 0) return { completeUsd: 0, remainderUsd: 0 };
  if (completeKits === 0) return { completeUsd: 0, remainderUsd: totalUsd };
  if (remainderVials === 0) return { completeUsd: totalUsd, remainderUsd: 0 };
  const completeUsd = roundCurrency(totalUsd * (completeVials / totalVials));
  return { completeUsd, remainderUsd: roundCurrency(totalUsd - completeUsd) };
}

function formatPersonQuantityLabel(quantity: number): string {
  return `${asQuantity(quantity)}x`;
}

const DOSE_UNAVAILABLE = "Nicht verfügbar";

/** Dose from stored variant data only. Never inferred from the article name. */
export function formatOrderSummaryDose(
  dosageVial: string | null | undefined,
  code = "",
): string {
  const raw = dosageVial?.trim();
  if (!raw || raw === "—") return DOSE_UNAVAILABLE;
  const parsed = parseVariantColumn(raw);
  if (parsed.vialStrength) return parsed.vialStrength;
  const oral = formatOralVariantLabel(raw, code);
  if (oral) {
    const oralStrength = parseVariantColumn(raw).vialStrength;
    if (oralStrength) return oralStrength;
    const pack = raw.match(/^([\d.,]+\s*(?:mg|mcg|µg|ug|iu|ui|ml))\b/i);
    if (pack) return normalizeStrengthToken(pack[1]);
  }
  const stripped = raw.replace(/\s*\/\s*vial.*/i, "").replace(/\s*x\s*\d+\s*vials?.*/i, "").trim();
  if (/^[\d.,]+\s*(mg|mcg|µg|ug|iu|ui|ml)$/i.test(stripped)) {
    return normalizeStrengthToken(stripped);
  }
  return DOSE_UNAVAILABLE;
}

function personSortKey(name: string): string {
  return name === ORDER_TELEGRAM_SNAPSHOT_UNAVAILABLE ? "\uFFFF" : name;
}

/** Merchant buy list from frozen order_items of processing orders only. */
export function buildProcessingOrderSummary(
  orders: Tables<"orders">[],
  items: Tables<"order_items">[],
  catalog: CatalogCategoryHint[] = [],
  kitContext?: KitShareOrderContext | null,
): ProcessingOrderSummary {
  const resolvedKitInput = resolveKitContext(kitContext);
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
  const participants = resolvedKitParticipants(resolvedKitInput, orders);
  const resolvedContext: KitShareOrderContext = { ...resolvedKitInput, participants };
  const kits = new Map(resolvedKitInput.kits.map((kit) => [kit.id, kit]));

  const kitItemsByShare = new Map<string, Tables<"order_items">[]>();
  const regularItems: Tables<"order_items">[] = [];
  for (const item of processingItems) {
    const order = ordersById.get(item.order_id);
    const kitShareId = resolveKitShareIdForItem(item, order, resolvedContext, participants);
    const kit = kitShareId ? kits.get(kitShareId) : undefined;
    if (kit && (!item.product_id || kit.product_id === item.product_id)) {
      const list = kitItemsByShare.get(kit.id) ?? [];
      list.push(item);
      kitItemsByShare.set(kit.id, list);
      continue;
    }
    regularItems.push(item);
  }

  const kitProgress = new Map<
    string,
    {
      kitSize: number;
      completeKits: number;
      remainderVials: number;
    }
  >();
  for (const kit of resolvedKitInput.kits) {
    const fromParticipants = kitProcessingQuantity(kit.id, participants, ordersById);
    const fromItems = (kitItemsByShare.get(kit.id) ?? []).reduce((sum, item) => sum + asQuantity(item.quantity), 0);
    // Same kit_share_id: use processing lines even if a participant row is missing from the admin fetch.
    const processingQuantity = Math.max(fromParticipants, fromItems);
    const kitSize = asQuantity(kit.kit_size_vials);
    const split = splitKitProgress(processingQuantity, kitSize);
    kitProgress.set(kit.id, {
      kitSize,
      completeKits: split.completeKits,
      remainderVials: split.remainderVials,
    });
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
    const quantity = asQuantity(item.quantity);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.quantityLabel = formatPlainQuantityLabel(existing.quantity);
      existing.totalUsd = roundCurrency(existing.totalUsd + Number(item.line_total_usd));
      continue;
    }
    merged.set(key, {
      code,
      name,
      quantity,
      quantityLabel: formatPlainQuantityLabel(quantity),
      totalUsd: roundCurrency(Number(item.line_total_usd)),
      categoryId,
    });
  }

  function addCompleteKits(
    first: Tables<"order_items">,
    completeKits: number,
    completeUsd: number,
    kitShareId: string,
  ) {
    if (completeKits <= 0) return;
    const { code, name, categoryId } = lineMeta(first);
    const key = `kit-complete:${productMergeKey(first)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += completeKits;
      existing.quantityLabel = formatCompleteKitQuantityLabel(existing.quantity);
      existing.totalUsd = roundCurrency(existing.totalUsd + completeUsd);
      return;
    }
    merged.set(key, {
      code,
      name,
      quantity: completeKits,
      quantityLabel: formatCompleteKitQuantityLabel(completeKits),
      totalUsd: completeUsd,
      categoryId,
      kitShareId,
    });
  }

  for (const [kitShareId, kitItems] of kitItemsByShare) {
    const kit = kits.get(kitShareId);
    const progress = kitProgress.get(kitShareId);
    if (!kit || !progress) continue;
    const first = kitItems[0];
    const { code, name, categoryId } = lineMeta(first);
    const totalUsd = roundCurrency(kitItems.reduce((sum, item) => sum + Number(item.line_total_usd), 0));
    const { completeKits, remainderVials } = progress;
    const { completeUsd, remainderUsd } = allocateStoredKitTotals(
      totalUsd,
      completeKits,
      remainderVials,
      progress.kitSize,
    );
    addCompleteKits(first, completeKits, completeUsd, kitShareId);
    if (remainderVials > 0) {
      merged.set(`kit-share:${kitShareId}`, {
        code,
        name,
        quantity: remainderVials,
        quantityLabel: formatSharedKitQuantityLabel(remainderVials, progress.kitSize),
        totalUsd: remainderUsd,
        categoryId,
        kitShareId,
      });
    }
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
        const quantity = asQuantity(item.quantity);
        const kitFullyComplete = Boolean(progress && progress.completeKits > 0 && progress.remainderVials === 0);
        const quantityLabel = progress
          ? kitFullyComplete
            ? formatCompleteKitQuantityLabel(1)
            : formatSharedKitShareLabel(quantity, progress.kitSize)
          : formatPlainQuantityLabel(quantity);
        const existing = lineMap.get(lineKey);
        if (existing && !kitShareId) {
          existing.quantity += quantity;
          existing.quantityLabel = formatPlainQuantityLabel(existing.quantity);
          continue;
        }
        if (existing) continue;
        lineMap.set(lineKey, {
          code,
          name,
          quantity,
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
  const personMap = new Map<string, OrderSummaryPersonLine>();
  for (const order of processing) {
    const telegramLabel = formatOrderTelegramSnapshot(order);
    const personKey = order.telegram_username_snapshot?.trim()
      ? telegramLabel.toLocaleLowerCase("de")
      : `__order:${order.id}`;
    for (const item of processingItems.filter((row) => row.order_id === order.id)) {
      const hint = catalogHintForItem(item, byId, byCode);
      const kitShareId = resolveKitShareIdForItem(item, order, resolvedContext, participants);
      const progress = kitShareId ? kitProgress.get(kitShareId) : undefined;
      const dose = formatOrderSummaryDose(item.dosage_vial_snapshot || hint.dosage_vial, item.product_code_snapshot ?? "");
      const article = (item.product_name_snapshot ?? "").trim() || hint.name?.trim() || "Nicht verfügbar";
      const code = (item.product_code_snapshot ?? "").trim() || hint.code?.trim() || "—";
      const mergeKey = kitShareId
        ? `${personKey}|kit:${kitShareId}`
        : `${personKey}|${productMergeKey(item)}|${dose}`;
      const existing = personMap.get(mergeKey);
      const quantity = asQuantity(item.quantity);
      if (existing && !kitShareId) {
        existing.quantity += quantity;
        existing.quantityLabel = formatPersonQuantityLabel(existing.quantity);
        continue;
      }
      if (existing) continue;
      personMap.set(mergeKey, {
        name: telegramLabel,
        quantity,
        quantityLabel: progress
          ? formatSharedKitShareLabel(quantity, progress.kitSize)
          : formatPersonQuantityLabel(quantity),
        dose,
        article,
        code,
        kitShareId: kitShareId ?? undefined,
      });
    }
  }
  const personLines = [...personMap.values()].sort((a, b) => {
    const name = personSortKey(a.name).localeCompare(personSortKey(b.name), "de");
    if (name !== 0) return name;
    const article = a.article.localeCompare(b.article, "de");
    if (article !== 0) return article;
    return a.dose.localeCompare(b.dose, "de");
  });
  const personKeys = new Set(
    processing.map((order) =>
      order.telegram_username_snapshot?.trim()
        ? formatOrderTelegramSnapshot(order).toLocaleLowerCase("de")
        : `__order:${order.id}`,
    ),
  );

  return {
    orderCount: processing.length,
    productCount: allLines.length,
    totalQuantity: allLines.reduce((sum, line) => sum + line.quantity, 0),
    totalUsd: roundCurrency(allLines.reduce((sum, line) => sum + line.totalUsd, 0)),
    groups,
    customers,
    personCount: personKeys.size,
    positionCount: personLines.length,
    personQuantityTotal: personLines.reduce((sum, line) => sum + line.quantity, 0),
    personLines,
  };
}
