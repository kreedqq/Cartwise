export const APP_NAME = "Warenkorb & Bestelllisten";

export const PDF_IMPORT_BUCKET = "pdf-imports";
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PDF_MIME_TYPES = ["application/pdf"];

export const EXCHANGE_RATE_CACHE_MINUTES = 60;
export const EXCHANGE_RATE_STALE_WARNING_HOURS = 26;

export const QUERY_KEYS = {
  carts: ["carts"] as const,
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
};
