import { describe, expect, it } from "vitest";

import {
  HOME_SHIPPING,
  addCatalogLine,
  clearCartItems,
  getOrCreateCart,
  rpcMessage,
  signIn,
} from "./helpers";

describe("order correction (0092)", () => {
  it("admin revises catalog line quantity using frozen unit_price_usd_snapshot", async () => {
    const { client: admin } = await signIn("admin");
    const { client } = await signIn("groupBuy");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);
    await addCatalogLine(client, cart.id, "QA-PEP-001", 4, "group_buy_1", 4);

    const ordered = await client.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA order correction catalog",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
    const orderId = (ordered.data as { orderId: string }).orderId;

    const { data: items } = await client
      .from("order_items")
      .select("id, quantity, unit_price_usd_snapshot, line_total_usd")
      .eq("order_id", orderId)
      .single();
    expect(items).toBeTruthy();
    const unit = Number(items!.unit_price_usd_snapshot);
    const itemId = items!.id;

    const corrected = await admin.rpc("admin_apply_order_correction", {
      _order_id: orderId,
      _expected_revision: 0,
      _reason: "Fehlerhafte Menge",
      _line_changes: [{ orderItemId: itemId, quantity: 2 }],
    });
    expect(corrected.error, rpcMessage(corrected.error)).toBeNull();

    const { data: after } = await admin.from("order_items").select("quantity, line_total_usd").eq("id", itemId).single();
    expect(Number(after?.quantity)).toBe(2);
    expect(Number(after?.line_total_usd)).toBe(Math.round(unit * 2 * 100) / 100);

    const { data: revs } = await admin.from("order_revisions").select("revision_number").eq("order_id", orderId);
    expect(revs?.length).toBe(1);
  });

  it("stamps kit snapshots when a full kit line is ordered", async () => {
    const { client: admin } = await signIn("admin");
    const { data: master } = await admin.from("products").select("id").eq("code", "QA-KIT-001").single();
    expect(master?.id).toBeTruthy();

    const { client } = await signIn("groupBuy");

    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);

    const kit = await client.rpc("create_kit_share", {
      _product_id: master!.id,
      _kit_size_vials: 10,
      _my_quantity: 10,
    });
    expect(kit.error, rpcMessage(kit.error)).toBeNull();
    await client.rpc("add_kit_share_to_cart", { _kit_share_id: (kit.data as { id: string }).id });

    const ordered = await client.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA kit snapshot",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
    const orderId = (ordered.data as { orderId: string }).orderId;

    const { data: line } = await client
      .from("order_items")
      .select("kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot, quantity")
      .eq("order_id", orderId)
      .single();
    expect(line?.kit_share_id_snapshot).toBeTruthy();
    expect(Number(line?.kit_size_vials_snapshot)).toBe(10);
    expect(Number(line?.quantity)).toBe(10);
  });
});
