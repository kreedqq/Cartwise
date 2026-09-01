export const APP_NAME = "Peptix";
export const BRAND_NAME = "Peptix";
export const BRAND_TAGLINE = "B2B Bestellplattform";

export const PDF_IMPORT_BUCKET = "pdf-imports";
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PDF_MIME_TYPES = ["application/pdf"];

export const EXCHANGE_RATE_CACHE_MINUTES = 60;
export const EXCHANGE_RATE_STALE_WARNING_HOURS = 26;

export const QUERY_KEYS = {
  carts: (userId: string) => ["carts", userId] as const,
  cartSummaries: (userId: string) => ["cart-summaries", userId] as const,
  cart: (id: string) => ["carts", id] as const,
  cartItems: (cartId: string) => ["cart-items", cartId] as const,
  products: ["products"] as const,
  product: (id: string) => ["products", id] as const,
  exchangeRate: ["exchange-rate"] as const,
  pdfImports: ["pdf-imports"] as const,
  pdfImport: (id: string) => ["pdf-imports", id] as const,
  userRoles: ["user-roles"] as const,
  profiles: ["profiles"] as const,
  auditLogs: ["audit-logs"] as const,
  shopProducts: ["shop-products"] as const,
  kitRequests: (filters: unknown) => ["kit-requests", filters] as const,
  myKitRequests: ["my-kit-requests"] as const,
  myKitRequestParticipations: ["my-kit-request-participations"] as const,
  myOrders: (userId: string) => ["my-orders", userId] as const,
  myOrder: (userId: string, id: string) => ["my-orders", userId, id] as const,
  order: (id: string) => ["admin-order", id] as const,
  orderStatusHistory: (id: string) => ["orders", id, "history"] as const,
  adminOrders: ["admin-orders"] as const,
  adminRoleSurcharges: ["admin-role-surcharges"] as const,
  adminUserDirectory: ["admin-user-directory"] as const,
  favorites: ["favorites"] as const,
  orderTemplates: ["order-templates"] as const,
  orderAdminNote: (id: string) => ["orders", id, "admin-note"] as const,
  researchDualRead: ["research-dual-read"] as const,
  publicLexicon: ["public-lexicon"] as const,
  adminResearchDashboard: ["admin-research-dashboard"] as const,
  adminResearchQueue: (kind: string, page: number) => ["admin-research-queue", kind, page] as const,
  adminResearchDetail: (kind: string, id: string) => ["admin-research-detail", kind, id] as const,
  adminResearchMappings: (page: number) => ["admin-research-mappings", page] as const,
  adminResearchRuns: (page: number) => ["admin-research-runs", page] as const,
};
