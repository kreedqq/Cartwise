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
import {
  formatCatalogQuantity,
  productQuantityKindFor,
  type QuantitySaleMode,
} from "@/lib/quantityFormat";
import { saleModeForShopArea } from "@/lib/shop/shopAreas";
import {
  calculateLineTotalUsd,
  formatUsd,
  getEffectiveUnitPrice,
  normalizeProductCode,
  roundCurrency,
  type PricedProduct,
} from "@/lib/money";
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
  /** Merchant quantity shown as-is, e.g. `5/10 Kit` or `1 Kit`. */
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

export interface MerchantQuantityTotal {
  code: string;
  quantity: number;
}

export interface ChinaPurchaseLine {
  code: string;
  quantity: number;
  quantityLabel: string;
  unitPriceUsd: number;
  totalUsd: number;
  categoryId: ShopCategoryId;
}

export interface ChinaPurchaseSummary {
  lines: ChinaPurchaseLine[];
  totalUsd: number;
  distinctProducts: number;
  kitCount: number;
  packungCount: number;
  vialCount: number;
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
  /** @deprecated Misleading when lines mix kits/vials/packungen — HTML print only. PDF uses personDistinctProductCount. */
  personQuantityTotal: number;
  /** Distinct product codes on person lines (page 1 stats). */
  personDistinctProductCount: number;
  personLines: OrderSummaryPersonLine[];
  merchantTotals: MerchantQuantityTotal[];
  merchantArticleCount: number;
  chinaPurchase: ChinaPurchaseSummary;
}

/** Raw order-item quantities grouped by product code. Never uses merged kit display lines. */
type CatalogPricedHint = CatalogCategoryHint & {
  price_usd?: number | null;
  bulk_price_usd?: number | null;
  bulk_price_min_quantity?: number | null;
};

function pricedProductForChinaLine(
  item: Tables<"order_items">,
  byId: Map<string, CatalogPricedHint>,
  byCode: Map<string, CatalogPricedHint>,
): PricedProduct {
  const fromId = item.product_id ? byId.get(item.product_id) : undefined;
  const fromCode = byCode.get(normalizeProductCode(item.product_code_snapshot ?? ""));
  const catalog = fromId ?? fromCode;
  if (catalog && typeof catalog.price_usd === "number" && Number.isFinite(catalog.price_usd)) {
    return {
      price_usd: catalog.price_usd,
      bulk_price_usd: catalog.bulk_price_usd ?? null,
      bulk_price_min_quantity: catalog.bulk_price_min_quantity ?? null,
    };
  }
  return {
    price_usd: Number(item.normal_price_usd_snapshot ?? item.unit_price_usd_snapshot ?? 0),
    bulk_price_usd: item.bulk_price_usd_snapshot,
    bulk_price_min_quantity: item.bulk_price_min_quantity_snapshot,
  };
}

function aggregateChinaRowsFromMerchantLines(
  merchantLines: readonly OrderSummaryLine[],
): Array<{ code: string; quantity: number; quantityLabel: string; categoryId: ShopCategoryId }> {
  const byCode = new Map<string, OrderSummaryLine[]>();
  for (const line of merchantLines) {
    const list = byCode.get(line.code) ?? [];
    list.push(line);
    byCode.set(line.code, list);
  }
  return [...byCode.entries()]
    .map(([code, lines]) => {
      const categoryId = lines[0]?.categoryId ?? "peptides";
      const quantity = lines.reduce((sum, row) => sum + row.quantity, 0);
      const quantityLabel =
        lines.length === 1 ? (lines[0]?.quantityLabel ?? formatCatalogQuantity(quantity, categoryId)) : formatCatalogQuantity(quantity, categoryId);
      return { code, quantity, quantityLabel, categoryId };
    })
    .sort((a, b) => {
      if (a.code === "—") return 1;
      if (b.code === "—") return -1;
      return a.code.localeCompare(b.code, "de");
    });
}

function kitUnitsForChinaOverview(line: ChinaPurchaseLine): number {
  if (productQuantityKindFor(line.categoryId) !== "kit") return 0;
  if (line.quantityLabel.includes("/")) {
    const share = line.quantityLabel.match(/^(\d+)\/(\d+)/);
    if (share) {
      return splitKitProgress(Number(share[1]), Number(share[2])).completeKits;
    }
    return 0;
  }
  return line.quantity;
}

/** China vendor totals: aggregate by product code, catalog/bulk pricing via getEffectiveUnitPrice (no role markup). */
export function buildChinaPurchaseSummary(
  items: readonly Tables<"order_items">[],
  catalog: CatalogCategoryHint[] = [],
  merchantLines: readonly OrderSummaryLine[] = [],
): ChinaPurchaseSummary {
  const byId = new Map<string, CatalogPricedHint>();
  const byCode = new Map<string, CatalogPricedHint>();
  for (const product of catalog as CatalogPricedHint[]) {
    if (product.id) byId.set(product.id, product);
    const code = normalizeProductCode(product.code ?? "");
    if (code) byCode.set(code, product);
  }

  const sampleByCode = new Map<string, Tables<"order_items">>();
  for (const item of items) {
    const code = normalizeProductCode(item.product_code_snapshot ?? "") || "—";
    if (!sampleByCode.has(code)) sampleByCode.set(code, item);
  }

  const quantityRows =
    merchantLines.length > 0
      ? aggregateChinaRowsFromMerchantLines(merchantLines)
      : aggregateMerchantQuantitiesByCode(items).map(({ code, quantity }) => {
          const sample = sampleByCode.get(code);
          const hint = sample ? catalogHintForItem(sample, byId, byCode) : { category: null, name: null };
          const categoryId = shopCategoryIdFor({
            category: hint.category,
            name: hint.name ?? sample?.product_name_snapshot,
            code: sample?.product_code_snapshot,
          });
          return {
            code,
            quantity,
            quantityLabel: formatCatalogQuantity(quantity, categoryId),
            categoryId,
          };
        });

  const lines: ChinaPurchaseLine[] = [];
  for (const { code, quantity, quantityLabel, categoryId } of quantityRows) {
    const sample = sampleByCode.get(code);
    if (!sample || quantity <= 0) continue;
    const product = pricedProductForChinaLine(sample, byId, byCode);
    const effective = getEffectiveUnitPrice(product, quantity);
    const totalUsd = calculateLineTotalUsd(quantity, effective.unitPriceUsd) ?? 0;
    lines.push({
      code,
      quantity,
      quantityLabel,
      unitPriceUsd: effective.unitPriceUsd,
      totalUsd,
      categoryId,
    });
  }

  let kitCount = 0;
  let packungCount = 0;
  let vialCount = 0;
  for (const line of lines) {
    const kind = productQuantityKindFor(line.categoryId);
    if (kind === "kit") kitCount += kitUnitsForChinaOverview(line);
    else if (kind === "packung") packungCount += line.quantity;
    else vialCount += line.quantity;
  }

  return {
    lines,
    totalUsd: roundCurrency(lines.reduce((sum, line) => sum + line.totalUsd, 0)),
    distinctProducts: lines.length,
    kitCount,
    packungCount,
    vialCount,
  };
}

/** Copy-friendly China price columns for PDF/text export. */
export function formatChinaPurchasePriceCells(line: ChinaPurchaseLine): { price: string; total: string } {
  const total = formatUsd(line.totalUsd);
  const unit = formatUsd(line.unitPriceUsd);
  if (line.quantity <= 1) {
    return { price: unit, total };
  }
  const unitWord = productQuantityKindFor(line.categoryId) === "kit" ? "Kit" : productQuantityKindFor(line.categoryId) === "packung" ? "Packung" : "Stück";
  return { price: `${unit} / ${unitWord}`, total };
}

export function aggregateMerchantQuantitiesByCode(
  items: readonly Pick<Tables<"order_items">, "product_code_snapshot" | "quantity">[],
): MerchantQuantityTotal[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const code = normalizeProductCode(item.product_code_snapshot ?? "") || "—";
    totals.set(code, (totals.get(code) ?? 0) + asQuantity(item.quantity));
  }
  return [...totals.entries()]
    .map(([code, quantity]) => ({ code, quantity }))
    .sort((a, b) => {
      if (a.code === "—") return 1;
      if (b.code === "—") return -1;
      return a.code.localeCompare(b.code, "de");
    });
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

function formatPlainQuantityLabel(
  quantity: number,
  categoryId: ShopCategoryId,
  saleMode: QuantitySaleMode = "catalog",
): string {
  return formatCatalogQuantity(quantity, categoryId, saleMode);
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

function formatPersonQuantityLabel(
  quantity: number,
  categoryId: ShopCategoryId,
  saleMode: QuantitySaleMode = "catalog",
): string {
  return formatCatalogQuantity(quantity, categoryId, saleMode);
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

/** Merchant buy list from frozen order_items. Default: processing orders only. Pass includedOrderIds for a persistent order group (any status). */
export function buildProcessingOrderSummary(
  orders: Tables<"orders">[],
  items: Tables<"order_items">[],
  catalog: CatalogCategoryHint[] = [],
  kitContext?: KitShareOrderContext | null,
  includedOrderIds?: ReadonlySet<string> | null,
): ProcessingOrderSummary {
  const resolvedKitInput = resolveKitContext(kitContext);
  const processing = includedOrderIds
    ? orders.filter((order) => includedOrderIds.has(order.id))
    : orders.filter(isProcessingOrder);
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
    const fromParticipants = kitProcessingQuantity(
      kit.id,
      participants,
      ordersById,
      includedOrderIds ? processingIds : undefined,
    );
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
    const saleMode = saleModeForShopArea(ordersById.get(item.order_id)?.shop_area);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.quantityLabel = formatPlainQuantityLabel(existing.quantity, existing.categoryId, saleMode);
      existing.totalUsd = roundCurrency(existing.totalUsd + Number(item.line_total_usd));
      continue;
    }
    merged.set(key, {
      code,
      name,
      quantity,
      quantityLabel: formatPlainQuantityLabel(quantity, categoryId, saleMode),
      totalUsd: roundCurrency(Number(item.line_total_usd)),
      categoryId,
    });
  }

  function addCompleteKits(
    first: Tables<"order_items">,
    completeKits: number,
    completeUsd: number,
    kitShareId: string,
    kitSize: number,
  ) {
    if (completeKits <= 0) return;
    const { code, name, categoryId } = lineMeta(first);
    const key = `kit-complete:${productMergeKey(first)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += completeKits;
      existing.quantityLabel = formatCompleteKitQuantityLabel(existing.quantity, existing.categoryId, kitSize);
      existing.totalUsd = roundCurrency(existing.totalUsd + completeUsd);
      return;
    }
    merged.set(key, {
      code,
      name,
      quantity: completeKits,
      quantityLabel: formatCompleteKitQuantityLabel(completeKits, categoryId, kitSize),
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
    addCompleteKits(first, completeKits, completeUsd, kitShareId, progress.kitSize);
    if (remainderVials > 0) {
      merged.set(`kit-share:${kitShareId}`, {
        code,
        name,
        quantity: remainderVials,
        quantityLabel: formatSharedKitQuantityLabel(remainderVials, progress.kitSize, categoryId),
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
        const { categoryId } = lineMeta(item);
        const saleMode = saleModeForShopArea(order.shop_area);
        const quantityLabel = progress
          ? formatSharedKitShareLabel(quantity, progress.kitSize, categoryId)
          : formatPlainQuantityLabel(quantity, categoryId, saleMode);
        const existing = lineMap.get(lineKey);
        if (existing && !kitShareId) {
          existing.quantity += quantity;
          existing.quantityLabel = formatPlainQuantityLabel(existing.quantity, categoryId, saleMode);
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
      const { categoryId } = lineMeta(item);
      const saleMode = saleModeForShopArea(order.shop_area);
      if (existing && !kitShareId) {
        existing.quantity += quantity;
        existing.quantityLabel = formatPersonQuantityLabel(existing.quantity, categoryId, saleMode);
        continue;
      }
      if (existing) continue;
      personMap.set(mergeKey, {
        name: telegramLabel,
        quantity,
        quantityLabel: progress
          ? formatSharedKitShareLabel(quantity, progress.kitSize, categoryId)
          : formatPersonQuantityLabel(quantity, categoryId, saleMode),
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
    return a.code.localeCompare(b.code, "de");
  });
  const merchantTotals = aggregateMerchantQuantitiesByCode(processingItems);
  const chinaPurchase = buildChinaPurchaseSummary(processingItems, catalog, allLines);
  const personDistinctProductCount = new Set(
    personLines.map((line) => line.code.trim()).filter((code) => code && code !== "—"),
  ).size;
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
    personDistinctProductCount,
    personLines,
    merchantTotals,
    merchantArticleCount: merchantTotals.reduce((sum, row) => sum + row.quantity, 0),
    chinaPurchase,
  };
}
