import { KIT_ALMOST_FULL_REMAINING_THRESHOLD } from "@/lib/kit/kitShareState";
import {
  aggregateHealthLevel,
  healthFromCounts,
  type SystemHealthLevel,
} from "@/lib/admin/systemHealthStatus";
import { adminListKitRequests } from "@/services/adminKitRequests";
import { listAdminOpenCarts } from "@/services/adminCarts";
import { getDataIssuesSummary, listAuditLogs } from "@/services/adminStats";
import { listAllOrders } from "@/services/orders";
import { listAllProducts } from "@/services/products";
import { listAdminShopAreas } from "@/services/shopAreas";

export type AdminSystemHealthCard = {
  id: string;
  title: string;
  value: string;
  context: string;
  level: SystemHealthLevel;
  href?: string;
};

export type AdminSystemHealthSnapshot = {
  overall: SystemHealthLevel;
  cards: AdminSystemHealthCard[];
  lastGlobalSyncAt: string | null;
  lastGlobalSyncSummary: string | null;
};

function kitSyncAttentionCount(items: { orderSyncLabel: string | null }[]): number {
  return items.filter((item) => {
    const label = (item.orderSyncLabel ?? "").toLowerCase();
    if (!label) return false;
    return !label.includes("synchron") && !label.includes("ok");
  }).length;
}

/** Admin-only operational snapshot from existing tables/RPCs (no invented metrics). */
export async function fetchAdminSystemHealth(): Promise<AdminSystemHealthSnapshot> {
  const [
    products,
    issues,
    orders,
    openCarts,
    areas,
    kitOpenPage,
    kitFullPage,
    kitOpenList,
    auditLogs,
  ] = await Promise.all([
    listAllProducts(),
    getDataIssuesSummary(),
    listAllOrders(),
    listAdminOpenCarts(),
    listAdminShopAreas(),
    adminListKitRequests({ status: "open", page: 1, pageSize: 1 }),
    adminListKitRequests({ status: "full", page: 1, pageSize: 200 }),
    adminListKitRequests({ status: "open", page: 1, pageSize: 200 }),
    listAuditLogs(80),
  ]);

  const activeProducts = products.filter((p) => p.is_active).length;
  const inactiveProducts = products.length - activeProducts;
  const activeAreas = areas.filter((a) => a.is_active !== false).length;

  const openOrders = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;
  const kitOpen = kitOpenPage.total;
  const kitFull = kitFullPage.total;
  const almostFull = kitOpenList.items.filter(
    (k) => k.remainingVials > 0 && k.remainingVials <= KIT_ALMOST_FULL_REMAINING_THRESHOLD,
  ).length;
  const kitSyncIssues = kitSyncAttentionCount(kitFullPage.items);
  const openCartsWithKit = openCarts.filter((c) => c.has_kit).length;

  const pricingIssues =
    issues.missingPriceProducts + issues.unresolvedCartItems + issues.inactiveProductsInUse;

  const lastSyncLog = auditLogs.find((row) => row.action === "admin.sync_orders_and_carts");
  const lastGlobalSyncAt = lastSyncLog?.created_at ?? null;
  let lastGlobalSyncSummary: string | null = null;
  const syncPayload = lastSyncLog?.after_data ?? lastSyncLog?.before_data;
  if (syncPayload && typeof syncPayload === "object") {
    const meta = syncPayload as Record<string, unknown>;
    const parts = [
      meta.kitsChecked != null ? `${meta.kitsChecked} Kits geprüft` : null,
      meta.kitsSynced != null ? `${meta.kitsSynced} synchronisiert` : null,
      meta.cartItemsRefreshed != null ? `${meta.cartItemsRefreshed} Cart-Zeilen aktualisiert` : null,
    ].filter(Boolean);
    lastGlobalSyncSummary = parts.length > 0 ? parts.join(" · ") : null;
  }

  const cards: AdminSystemHealthCard[] = [
    {
      id: "catalog",
      title: "Katalog",
      value: `${activeProducts} / ${products.length}`,
      context: `${inactiveProducts} inaktiv · ${activeAreas} Verkaufsbereiche`,
      level: healthFromCounts({ warnings: inactiveProducts > 0 ? 1 : 0 }),
      href: "/admin/products",
    },
    {
      id: "pricing",
      title: "Preise",
      value: pricingIssues === 0 ? "OK" : String(pricingIssues),
      context:
        pricingIssues === 0
          ? "Keine offenen Preis- oder Auflösungsprobleme"
          : `${issues.missingPriceProducts} ohne Preis · ${issues.unresolvedCartItems} unaufgelöst · ${issues.inactiveProductsInUse} inaktiv in Warenkörben`,
      level: healthFromCounts({
        errors: issues.missingPriceProducts > 0 ? 1 : 0,
        warnings: issues.unresolvedCartItems + issues.inactiveProductsInUse,
      }),
      href: "/admin/products",
    },
    {
      id: "kits",
      title: "Kits",
      value: `${kitOpen} offen · ${kitFull} voll`,
      context: `${almostFull} fast voll · ${kitSyncIssues} Sync-Hinweise (volle Kits)`,
      level: healthFromCounts({ warnings: almostFull + kitSyncIssues }),
      href: "/admin/kit-requests",
    },
    {
      id: "carts",
      title: "Warenkörbe",
      value: String(openCarts.length),
      context: `${openCartsWithKit} mit Kit-Zeilen`,
      level: "healthy",
      href: "/admin/carts",
    },
    {
      id: "orders",
      title: "Bestellungen",
      value: String(openOrders),
      context: `${orders.length} gesamt · offen/aktiv`,
      level: healthFromCounts({ warnings: openOrders > 50 ? 1 : 0 }),
      href: "/admin/orders",
    },
    {
      id: "sync",
      title: "Global Sync",
      value: lastGlobalSyncAt ? "Protokoll" : "—",
      context: lastGlobalSyncAt
        ? lastGlobalSyncSummary ?? new Date(lastGlobalSyncAt).toLocaleString("de-DE")
        : "Kein Sync-Verlauf verfügbar",
      level: lastGlobalSyncAt ? "healthy" : "needs_attention",
      href: "/admin/orders",
    },
  ];

  const overall = aggregateHealthLevel(cards.map((c) => c.level));

  return {
    overall,
    cards,
    lastGlobalSyncAt,
    lastGlobalSyncSummary,
  };
}
