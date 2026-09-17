/** Customer canvas kinds. Admin uses [data-admin] instead. */

export type CustomerPageKind = "dashboard" | "shop" | "kit" | "ops" | "default";

export function customerPageKind(pathname: string): CustomerPageKind {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.includes("kit-gesuche") || pathname.startsWith("/shop/group-buy")) return "kit";
  if (pathname.startsWith("/shop") || pathname.startsWith("/favorites")) return "shop";
  if (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/carts") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/feedback")
  ) {
    return "ops";
  }
  return "default";
}
