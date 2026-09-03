import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const getUser = vi.fn();
const from = vi.fn();
const select = vi.fn();
const eq = vi.fn();
const order = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => getUser(...args) },
    from: (...args: unknown[]) => from(...args),
  },
}));

const { getMyOrder, getOrder, listAllOrders, listMyOrders } = await import("@/services/orders");

function listChain() {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    select,
    eq,
    order,
    maybeSingle,
  };
  select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  order.mockResolvedValue({ data: [], error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  return chain;
}

describe("customer order isolation", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    select.mockReset();
    eq.mockReset();
    order.mockReset();
    maybeSingle.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-own" } }, error: null });
    from.mockReturnValue(listChain());
  });

  it("listMyOrders always filters by the signed-in auth user id", async () => {
    await listMyOrders();
    expect(getUser).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("orders");
    expect(eq).toHaveBeenCalledWith("user_id", "user-own");
  });

  it("getMyOrder filters by order id and owner, not by telegram or name", async () => {
    await getMyOrder("order-foreign");
    expect(eq).toHaveBeenCalledWith("id", "order-foreign");
    expect(eq).toHaveBeenCalledWith("user_id", "user-own");
    expect(eq).not.toHaveBeenCalledWith("telegram_username_snapshot", expect.anything());
  });

  it("listAllOrders does not add a user_id filter", async () => {
    await listAllOrders();
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).not.toHaveBeenCalled();
  });

  it("getOrder (admin detail) does not add a user_id filter", async () => {
    await getOrder("order-any");
    expect(eq).toHaveBeenCalledWith("id", "order-any");
    expect(eq).not.toHaveBeenCalledWith("user_id", expect.anything());
  });

  it("rejects an unauthenticated customer list instead of loading all rows", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listMyOrders()).rejects.toThrow("Nicht angemeldet.");
    expect(from).not.toHaveBeenCalled();
  });
});

describe("customer and admin order data sources stay split", () => {
  it("customer pages never call listAllOrders or the admin inbox hook", () => {
    expect(read("src/pages/Orders.tsx")).toContain("useMyOrders");
    expect(read("src/pages/Orders.tsx")).not.toMatch(/useAdminOrders|listAllOrders|useAdminKitOrderContext|listAdminKitOrderContext/);
    expect(read("src/pages/OrderDetail.tsx")).toContain("useMyOrder");
    expect(read("src/pages/OrderDetail.tsx")).not.toMatch(/useAdminOrder|useAdminOrders|listAllOrders|useAdminKitOrderContext/);
    expect(read("src/pages/Dashboard.tsx")).toContain("useMyOrders");
    expect(read("src/pages/Dashboard.tsx")).not.toMatch(/useAdminOrders|listAllOrders|useAdminKitOrderContext/);
  });

  it("admin inbox uses the unscoped admin query", () => {
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("useAdminOrders");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("useAdminOrder");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).not.toContain("useMyOrder");
    expect(read("src/hooks/useAdminOrders.ts")).toContain("listAllOrders");
    expect(read("src/hooks/useOrders.ts")).toContain("getMyOrderWithItems");
    expect(read("src/hooks/useOrders.ts")).toContain("getAdminOrderWithItems");
  });

  it("scopes the customer React Query key by user id", () => {
    expect(read("src/lib/constants.ts")).toMatch(/myOrders: \(userId: string\) => \["my-orders", userId\]/);
    expect(read("src/hooks/useOrders.ts")).toContain("QUERY_KEYS.myOrders(user?.id ?? \"\")");
  });
});
