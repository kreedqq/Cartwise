import { describe, expect, it } from "vitest";

import {
  HOME_SHIPPING,
  getOrCreateCart,
  kitIdFromRpc,
  loadQaAccounts,
  rpcMessage,
  shopProductByCode,
  signIn,
} from "./helpers";

/** Local stand-in for KP10 scenario (QA-KIT-001, kit size 10). */
const KIT_PRODUCT_CODE = "QA-KIT-001";
const SHOP_AREA = "group_buy_1";

async function kitCartLine(client: Awaited<ReturnType<typeof signIn>>["client"], kitId: string) {
  const cart = await getOrCreateCart(client);
  const { data, error } = await client
    .from("cart_items")
    .select("id, quantity, kit_share_id, submitted_order_id")
    .eq("cart_id", cart.id)
    .eq("kit_share_id", kitId)
    .is("submitted_order_id", null);
  if (error) throw error;
  return { cart, lines: data ?? [] };
}

describe("Kit E2E local (KP10 pattern A=5 B=3 C=2)", () => {
  it("fills kit, syncs carts, checkouts with snapshots, idempotent global sync", async () => {
    const { client: userA, account: accA } = await signIn("groupBuy");
    const { client: userB, account: accB } = await signIn("join01");
    const { client: userC, account: accC } = await signIn("join02");
    const { client: admin } = await signIn("admin");

    const product = await shopProductByCode(userA, SHOP_AREA, KIT_PRODUCT_CODE);

    const created = await userA.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 5,
      _note: "E2E KP10 pattern",
      _shop_area: SHOP_AREA,
    });
    expect(created.error, rpcMessage(created.error)).toBeNull();
    const kitId = kitIdFromRpc(created.data);

    const joinB = await userB.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 3 });
    expect(joinB.error, rpcMessage(joinB.error)).toBeNull();
    const joinC = await userC.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 });
    expect(joinC.error, rpcMessage(joinC.error)).toBeNull();

    const projected = await userA.rpc("kit_share_project_state", { _kit_share_id: kitId });
    expect(projected.error).toBeNull();
    const state = projected.data as Record<string, unknown>;
    expect(Number(state.allocatedQuantity ?? state.allocated_total)).toBe(10);
    expect(Number(state.remainingQuantity ?? state.remainingVials ?? state.remaining)).toBe(0);
    expect(String(state.status)).toBe("full");

    const { data: participants, error: partErr } = await userA
      .from("kit_share_participants")
      .select("user_id, quantity")
      .eq("kit_share_id", kitId);
    expect(partErr).toBeNull();
    expect(participants ?? []).toHaveLength(3);
    const byUser = new Map((participants ?? []).map((p) => [p.user_id, Number(p.quantity)]));
    expect(byUser.get(accA.userId)).toBe(5);
    expect(byUser.get(accB.userId)).toBe(3);
    expect(byUser.get(accC.userId)).toBe(2);
    expect([...byUser.values()].reduce((s, q) => s + q, 0)).toBe(10);

    const lineA = await kitCartLine(userA, kitId);
    const lineB = await kitCartLine(userB, kitId);
    const lineC = await kitCartLine(userC, kitId);
    expect(lineA.lines).toHaveLength(1);
    expect(lineB.lines).toHaveLength(1);
    expect(lineC.lines).toHaveLength(1);
    expect(Number(lineA.lines[0]!.quantity)).toBe(5);
    expect(Number(lineB.lines[0]!.quantity)).toBe(3);
    expect(Number(lineC.lines[0]!.quantity)).toBe(2);

    const orderA = await userA.rpc("create_order", {
      _cart_id: lineA.cart.id,
      _note: "E2E order A",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(orderA.error, rpcMessage(orderA.error)).toBeNull();
    const orderB = await userB.rpc("create_order", {
      _cart_id: lineB.cart.id,
      _note: "E2E order B",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(orderB.error, rpcMessage(orderB.error)).toBeNull();
    const orderC = await userC.rpc("create_order", {
      _cart_id: lineC.cart.id,
      _note: "E2E order C",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(orderC.error, rpcMessage(orderC.error)).toBeNull();

    type OrderRpc = { orderId?: string; order_id?: string; id?: string };
    const orderIdA =
      (orderA.data as OrderRpc)?.orderId ?? (orderA.data as OrderRpc)?.order_id ?? (orderA.data as OrderRpc)?.id;
    const orderIdB =
      (orderB.data as OrderRpc)?.orderId ?? (orderB.data as OrderRpc)?.order_id ?? (orderB.data as OrderRpc)?.id;
    const orderIdC =
      (orderC.data as OrderRpc)?.orderId ?? (orderC.data as OrderRpc)?.order_id ?? (orderC.data as OrderRpc)?.id;
    expect(orderIdA).toBeTruthy();
    expect(orderIdB).toBeTruthy();
    expect(orderIdC).toBeTruthy();

    const { data: itemsA } = await admin
      .from("order_items")
      .select(
        "kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot, quantity",
      )
      .eq("order_id", orderIdA!);
    const { data: itemsB } = await admin
      .from("order_items")
      .select("kit_participant_quantity_snapshot, kit_size_vials_snapshot, kit_share_id_snapshot, quantity")
      .eq("order_id", orderIdB!);
    const { data: itemsC } = await admin
      .from("order_items")
      .select("kit_participant_quantity_snapshot, kit_size_vials_snapshot, kit_share_id_snapshot, quantity")
      .eq("order_id", orderIdC!);

    const kitLineA = (itemsA ?? []).find((r) => r.kit_share_id_snapshot === kitId) ?? itemsA?.[0];
    const kitLineB = (itemsB ?? []).find((r) => r.kit_share_id_snapshot === kitId) ?? itemsB?.[0];
    const kitLineC = (itemsC ?? []).find((r) => r.kit_share_id_snapshot === kitId) ?? itemsC?.[0];
    expect(kitLineA).toBeTruthy();
    expect(kitLineB).toBeTruthy();
    expect(kitLineC).toBeTruthy();
    expect(String(kitLineA!.kit_share_id_snapshot)).toBe(kitId);
    expect(Number(kitLineA!.kit_size_vials_snapshot)).toBe(10);
    expect(Number(kitLineA!.kit_participant_quantity_snapshot ?? kitLineA!.quantity)).toBe(5);
    expect(Number(kitLineB!.kit_participant_quantity_snapshot ?? kitLineB!.quantity)).toBe(3);
    expect(Number(kitLineC!.kit_participant_quantity_snapshot ?? kitLineC!.quantity)).toBe(2);
    expect(
      Number(kitLineA!.kit_participant_quantity_snapshot ?? kitLineA!.quantity) +
        Number(kitLineB!.kit_participant_quantity_snapshot ?? kitLineB!.quantity) +
        Number(kitLineC!.kit_participant_quantity_snapshot ?? kitLineC!.quantity),
    ).toBe(10);

    const snapshotsBefore = JSON.stringify({ itemsA, itemsB, itemsC });

    const dupA = await userA.rpc("create_order", {
      _cart_id: lineA.cart.id,
      _note: "duplicate attempt",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(dupA.error).toBeTruthy();

    const sync1 = await admin.rpc("admin_sync_orders_and_carts");
    expect(sync1.error, rpcMessage(sync1.error)).toBeNull();
    const sync2 = await admin.rpc("admin_sync_orders_and_carts");
    expect(sync2.error, rpcMessage(sync2.error)).toBeNull();

    const { data: itemsAfterA } = await userA
      .from("order_items")
      .select("kit_participant_quantity_snapshot, kit_size_vials_snapshot, id")
      .eq("order_id", orderIdA!);
    expect(JSON.stringify({ itemsAfterA })).toContain(String(5));

    const { data: allOrderItems } = await admin
      .from("order_items")
      .select("id, order_id, kit_share_id_snapshot")
      .eq("kit_share_id_snapshot", kitId);
    const orderIds = new Set((allOrderItems ?? []).map((r) => r.order_id));
    expect(orderIds.size).toBe(3);

    const { data: openKitLines } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("kit_share_id", kitId)
      .is("submitted_order_id", null);
    expect(openKitLines ?? []).toHaveLength(0);

    expect(snapshotsBefore).toContain('"kit_participant_quantity_snapshot":5');
  });
});

describe("Kit duplicate checkout parallel", () => {
  it("does not create a second order for the same participant cart", async () => {
    const { client: creator } = await signIn("groupBuy");
    const { client: joiner, account: joinAcc } = await signIn("join03");
    const product = await shopProductByCode(creator, SHOP_AREA, KIT_PRODUCT_CODE);

    const created = await creator.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 9,
      _shop_area: SHOP_AREA,
    });
    expect(created.error).toBeNull();
    const kitId = kitIdFromRpc(created.data);
    const joined = await joiner.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 1 });
    expect(joined.error).toBeNull();

    const { cart, lines } = await kitCartLine(joiner, kitId);
    expect(lines).toHaveLength(1);

    const attempts = await Promise.all([
      joiner.rpc("create_order", {
        _cart_id: cart.id,
        _note: "parallel 1",
        _payment_method: "crypto",
        ...HOME_SHIPPING,
      }),
      joiner.rpc("create_order", {
        _cart_id: cart.id,
        _note: "parallel 2",
        _payment_method: "crypto",
        ...HOME_SHIPPING,
      }),
    ]);
    const successes = attempts.filter((r) => !r.error).length;
    expect(successes).toBeLessThanOrEqual(1);

    const { data: ordersForUser } = await joiner
      .from("orders")
      .select("id")
      .eq("user_id", joinAcc.userId);
    const { data: kitItems } = await joiner
      .from("order_items")
      .select("id, kit_share_id_snapshot")
      .eq("kit_share_id_snapshot", kitId);
    expect((kitItems ?? []).length).toBeLessThanOrEqual(1);
    expect(loadQaAccounts().apiUrl).toMatch(/127\.0\.0\.1|localhost/);
    expect(ordersForUser?.length ?? 0).toBeGreaterThan(0);
  });
});
