import type { PaymentMethodFlags } from "@/lib/shop/paymentMethod";

export interface SiteAccessState {
  maintenanceMode: boolean;
  quantityDiscountsEnabled: boolean;
  callerIsAdmin: boolean;
  siteAccessAllowed: boolean;
  paymentMethodFlags: PaymentMethodFlags | null;
}

export const DEFAULT_SITE_ACCESS_STATE: SiteAccessState = {
  maintenanceMode: false,
  quantityDiscountsEnabled: true,
  callerIsAdmin: false,
  siteAccessAllowed: true,
  paymentMethodFlags: null,
};

export function parseSiteAccessState(raw: unknown): SiteAccessState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.maintenance_mode !== "boolean") return null;
  if (typeof row.quantity_discounts_enabled !== "boolean") return null;
  if (typeof row.caller_is_admin !== "boolean") return null;
  if (typeof row.site_access_allowed !== "boolean") return null;
  const crypto = row.payment_crypto_enabled;
  const paypal = row.payment_paypal_enabled;
  const bank = row.payment_bank_transfer_enabled;
  const paymentMethodFlags =
    typeof crypto === "boolean" && typeof paypal === "boolean" && typeof bank === "boolean"
      ? { crypto, paypal, bank_transfer: bank }
      : null;

  return {
    maintenanceMode: row.maintenance_mode,
    quantityDiscountsEnabled: row.quantity_discounts_enabled,
    callerIsAdmin: row.caller_is_admin,
    siteAccessAllowed: row.site_access_allowed,
    paymentMethodFlags,
  };
}

/**
 * Fail-closed public access: a load error is treated as maintenance for
 * anyone whose admin role is not already confirmed.
 */
export function resolvePublicAccess(input: {
  state: SiteAccessState | null;
  loadFailed: boolean;
  isAdminConfirmed: boolean;
}): {
  allowed: boolean;
  maintenanceMode: boolean;
  quantityDiscountsEnabled: boolean;
} {
  if (input.loadFailed || input.state == null) {
    return {
      allowed: input.isAdminConfirmed,
      maintenanceMode: true,
      quantityDiscountsEnabled: false,
    };
  }

  const allowed = input.state.siteAccessAllowed || input.isAdminConfirmed;
  return {
    allowed,
    maintenanceMode: input.state.maintenanceMode,
    quantityDiscountsEnabled: input.state.quantityDiscountsEnabled,
  };
}

export const MAINTENANCE_BYPASS_PATHS = ["/login", "/auth/callback"] as const;

export function isMaintenanceBypassPath(pathname: string): boolean {
  return MAINTENANCE_BYPASS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
