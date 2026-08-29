import type { QueryClient } from "@tanstack/react-query";

/** Drop cached data that must never leak across auth users or stale sessions. */
export function clearUserScopedQueries(queryClient: QueryClient) {
  const prefixes = [
    ["carts"],
    ["cart-summaries"],
    ["cart-items"],
    ["favorites"],
    ["my-orders"],
    ["orders"],
    ["order-templates"],
    ["user-roles"],
    ["profiles"],
    ["admin-research-dashboard"],
    ["admin-research-queue"],
    ["admin-research-detail"],
    ["admin-research-mappings"],
    ["admin-research-runs"],
    ["research-dual-read"],
  ] as const;

  for (const queryKey of prefixes) {
    queryClient.removeQueries({ queryKey: [...queryKey] });
  }
}
