import { describe, expect, it } from "vitest";

import { assertSafeLocalQaTarget, findProductionQaMarker, isLocalSupabaseUrl } from "@/lib/qa/productionGuard";
import { extractRpcErrorMessage } from "@/services/username";

import {
  HOME_SHIPPING,
  addCatalogLine,
  clearCartItems,
  getOrCreateCart,
  kitIdFromRpc,
  loadQaAccounts,
  rpcMessage,
  shopProductByCode,
  signIn,
} from "./helpers";

describe("local QA guard", () => {
  it("rejects production markers and accepts localhost", () => {
    expect(findProductionQaMarker("https://cnjrjinvxycdkrmzcime.supabase.co")).toBe(
      "cnjrjinvxycdkrmzcime",
    );
    expect(findProductionQaMarker("https://peptix.app")).toBe("peptix.app");
    expect(isLocalSupabaseUrl("http://127.0.0.1:55421")).toBe(true);
    expect(() =>
      assertSafeLocalQaTarget({ supabaseUrl: "https://cnjrjinvxycdkrmzcime.supabase.co" }),
    ).toThrow(/QA TEST ABORT/);
    assertSafeLocalQaTarget({ supabaseUrl: loadQaAccounts().apiUrl });
  });
});

describe("1 Group Buy kit permissions", () => {
  it("allows create, list, preview, join, leave", async () => {
    const { client } = await signIn("groupBuy");
    const can = await client.rpc("get_my_can_use_kit_requests");
    expect(can.error).toBeNull();
    expect(can.data).toBe(true);

    const product = await shopProductByCode(client, "group_buy_1", "QA-KIT-001");
    const created = await client.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 3,
      _note: "QA open kit",
      _shop_area: "group_buy_1",
    });
    expect(created.error, rpcMessage(created.error)).toBeNull();
    const kitId = kitIdFromRpc(created.data);

    const listed = await client.rpc("list_open_kit_requests", {
      _shop_area: "group_buy_1",
      _page: 1,
      _page_size: 20,
    });
    expect(listed.error).toBeNull();
    expect(((listed.data as { items?: unknown[] })?.items ?? []).length).toBeGreaterThan(0);

    const { client: joiner } = await signIn("admin");
    const preview = await joiner.rpc("preview_kit_request_join", {
      _kit_share_id: kitId,
      _quantity: 2,
    });
    expect(preview.error, rpcMessage(preview.error)).toBeNull();

    const joined = await joiner.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 });
    expect(joined.error, rpcMessage(joined.error)).toBeNull();

    const left = await joiner.rpc("leave_kit_request", { _kit_share_id: kitId });
    expect(left.error, rpcMessage(left.error)).toBeNull();

    const cancelled = await client.rpc("cancel_kit_request", { _kit_share_id: kitId });
    expect(cancelled.error, rpcMessage(cancelled.error)).toBeNull();
  });
});

describe("2 NEU kit permissions fail-closed", () => {
  it("blocks create/preview/join and returns empty list", async () => {
    const { client: neu } = await signIn("neu");
    const can = await neu.rpc("get_my_can_use_kit_requests");
    expect(can.error).toBeNull();
    expect(can.data).toBe(false);

    const listed = await neu.rpc("list_open_kit_requests", {
      _shop_area: "group_buy_1",
      _page: 1,
      _page_size: 20,
    });
    expect(listed.error).toBeNull();
    expect((listed.data as { items?: unknown[]; total?: number }).items).toEqual([]);
    expect((listed.data as { total?: number }).total).toBe(0);

    const product = await shopProductByCode(neu, "group_buy_1", "QA-KIT-001");
    const created = await neu.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 2,
      _shop_area: "group_buy_1",
    });
    expect(created.error).toBeTruthy();
    expect(rpcMessage(created.error)).toMatch(/nicht freigeschaltet/i);

    const { client: gb } = await signIn("groupBuy");
    const open = await gb.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 4,
      _note: "QA for NEU deny",
      _shop_area: "group_buy_1",
    });
    expect(open.error, rpcMessage(open.error)).toBeNull();
    const kitId = kitIdFromRpc(open.data);

    const { client: neu2 } = await signIn("neu");
    const preview = await neu2.rpc("preview_kit_request_join", {
      _kit_share_id: kitId,
      _quantity: 1,
    });
    expect(preview.error).toBeTruthy();
    expect(rpcMessage(preview.error)).toMatch(/nicht freigeschaltet/i);

    const join = await neu2.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 1 });
    expect(join.error).toBeTruthy();
    expect(rpcMessage(join.error)).toMatch(/nicht freigeschaltet/i);
  });
});

describe("3 Admin role configuration", () => {
  it("reads Group Buy ON / NEU OFF and persists readback", async () => {
    const { client } = await signIn("admin");
    const { data: roles, error } = await client
      .from("customer_roles")
      .select("id, name, can_use_kit_requests")
      .order("name");
    expect(error).toBeNull();
    const byName = Object.fromEntries((roles ?? []).map((r) => [String(r.name).toUpperCase(), r]));
    expect(byName["GROUP BUY"]?.can_use_kit_requests).toBe(true);
    expect(byName.NEU?.can_use_kit_requests).toBe(false);

    const upsert = await client.rpc("admin_upsert_customer_role", {
      _id: byName.NEU.id,
      _name: "NEU",
      _markup_percent: 25,
      _is_active: true,
      _can_use_kit_requests: false,
    });
    expect(upsert.error, rpcMessage(upsert.error)).toBeNull();

    const { data: neuRow } = await client
      .from("customer_roles")
      .select("can_use_kit_requests")
      .eq("id", byName.NEU.id)
      .single();
    expect(neuRow?.can_use_kit_requests).toBe(false);
  });
});

describe("4–7 checkout kit matrix", () => {
  it("4 normal checkout creates an order", async () => {
    const { client } = await signIn("kunde");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);
    await addCatalogLine(client, cart.id, "QA-PEP-001", 1, "shop", 1);

    const ordered = await client.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA normal checkout",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
    expect(ordered.data).toBeTruthy();

    const { data: items } = await client
      .from("cart_items")
      .select("id, submitted_order_id")
      .eq("cart_id", cart.id);
    expect((items ?? []).every((r) => r.submitted_order_id)).toBe(true);
  });

  it("5 incomplete kit + normal product skips kit and keeps it in cart", async () => {
    const { client: admin } = await signIn("admin");
    const { data: master, error: masterErr } = await admin
      .from("products")
      .select("id")
      .eq("code", "QA-KIT-001")
      .single();
    expect(masterErr).toBeNull();

    const { client } = await signIn("groupBuy");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);

    const kit = await client.rpc("create_kit_share", {
      _product_id: master!.id,
      _kit_size_vials: 10,
      _my_quantity: 3,
    });
    expect(kit.error, rpcMessage(kit.error)).toBeNull();
    const kitId = kitIdFromRpc(kit.data);

    // Invite kits sync into cart while still open (marketplace kits wait until full).
    const before = await client
      .from("cart_items")
      .select("id, kit_share_id")
      .eq("cart_id", cart.id)
      .eq("kit_share_id", kitId);
    expect((before.data ?? []).length).toBeGreaterThan(0);

    await addCatalogLine(client, cart.id, "QA-PEP-001", 1, "shop", 20);

    const ordered = await client.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA incomplete kit skip",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
    expect(rpcMessage(ordered.error)).not.toMatch(/Ungültiger Kit-Anteil/);

    const after = await client
      .from("cart_items")
      .select("kit_share_id, product_code_snapshot, submitted_order_id")
      .eq("cart_id", cart.id);
    const openLines = (after.data ?? []).filter((r) => !r.submitted_order_id);
    const orderedLines = (after.data ?? []).filter((r) => r.submitted_order_id);
    expect(openLines.some((r) => r.kit_share_id === kitId)).toBe(true);
    expect(orderedLines.some((r) => r.product_code_snapshot === "QA-PEP-001")).toBe(true);
    expect(openLines.some((r) => r.product_code_snapshot === "QA-PEP-001")).toBe(false);
  });

  it("6 full marketplace kit checkout succeeds", async () => {
    const { client: creator } = await signIn("groupBuy");
    const product = await shopProductByCode(creator, "group_buy_1", "QA-KIT-001");
    const created = await creator.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 9,
      _note: "QA almost full",
      _shop_area: "group_buy_1",
    });
    expect(created.error, rpcMessage(created.error)).toBeNull();
    const kitId = kitIdFromRpc(created.data);

    const { client: admin } = await signIn("admin");
    const joined = await admin.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 1 });
    expect(joined.error, rpcMessage(joined.error)).toBeNull();
    expect(String((joined.data as { status?: string })?.status ?? "")).toMatch(/full/i);

    // Creator may need a fresh sign-in session after admin ops
    const { client: creator2 } = await signIn("groupBuy");
    const cart = await getOrCreateCart(creator2);
    const lines = await creator2
      .from("cart_items")
      .select("id")
      .eq("cart_id", cart.id)
      .eq("kit_share_id", kitId);
    expect((lines.data ?? []).length).toBeGreaterThan(0);

    const ordered = await creator2.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA full kit",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
  });

  it("7 mixed cart orders normals and keeps incomplete kit", async () => {
    const { client: admin } = await signIn("admin");
    const { data: master } = await admin.from("products").select("id").eq("code", "QA-KIT-001").single();

    const { client } = await signIn("groupBuy");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);

    const kit = await client.rpc("create_kit_share", {
      _product_id: master!.id,
      _kit_size_vials: 10,
      _my_quantity: 2,
    });
    expect(kit.error, rpcMessage(kit.error)).toBeNull();
    const kitId = kitIdFromRpc(kit.data);
    await addCatalogLine(client, cart.id, "QA-ORAL-001", 1, "shop", 1);
    await addCatalogLine(client, cart.id, "QA-WATER-001", 2, "shop", 2);

    const ordered = await client.rpc("create_order", {
      _cart_id: cart.id,
      _note: "QA mixed",
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ordered.error, rpcMessage(ordered.error)).toBeNull();

    const after = await client
      .from("cart_items")
      .select("kit_share_id, product_code_snapshot, submitted_order_id")
      .eq("cart_id", cart.id);
    const openLines = (after.data ?? []).filter((r) => !r.submitted_order_id);
    const orderedLines = (after.data ?? []).filter((r) => r.submitted_order_id);
    expect(openLines.some((r) => r.kit_share_id === kitId)).toBe(true);
    expect(openLines.every((r) => r.kit_share_id)).toBe(true);
    expect(orderedLines.some((r) => r.product_code_snapshot === "QA-ORAL-001")).toBe(true);
    expect(orderedLines.some((r) => r.product_code_snapshot === "QA-WATER-001")).toBe(true);
  });
});

describe("8 payment fail-closed", () => {
  it("rejects disabled and unknown payment methods", async () => {
    const { client } = await signIn("kunde");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);
    await addCatalogLine(client, cart.id, "QA-PEP-001", 1, "shop", 1);

    const paypal = await client.rpc("create_order", {
      _cart_id: cart.id,
      _payment_method: "paypal",
      ...HOME_SHIPPING,
    });
    expect(paypal.error).toBeTruthy();

    const unknown = await client.rpc("create_order", {
      _cart_id: cart.id,
      _payment_method: "cash",
      ...HOME_SHIPPING,
    });
    expect(unknown.error).toBeTruthy();

    const ok = await client.rpc("create_order", {
      _cart_id: cart.id,
      _payment_method: "crypto",
      ...HOME_SHIPPING,
    });
    expect(ok.error, rpcMessage(ok.error)).toBeNull();
  });
});

describe("9 pricing read-only SSoT", () => {
  it("returns priced products without markup_percent", async () => {
    for (const key of ["kunde", "stammkunde", "groupBuy", "neu"] as const) {
      const { client } = await signIn(key);
      const area = key === "groupBuy" || key === "neu" ? "group_buy_1" : "shop";
      const { data, error } = await client.rpc("list_shop_products_for_area", { _shop_area: area });
      expect(error, rpcMessage(error)).toBeNull();
      expect(((data as unknown[]) ?? []).length).toBeGreaterThan(0);
      expect(JSON.stringify(data)).not.toMatch(/markup_percent/i);
    }
  });
});

describe("10 error handling", () => {
  it("extractRpcErrorMessage reads PostgREST objects", () => {
    const err = {
      code: "P0001",
      message: "Kit Gesuche sind für deine aktuelle Rolle nicht freigeschaltet.",
      details: "detail-line",
      hint: "hint-line",
    };
    expect(err instanceof Error).toBe(false);
    expect(extractRpcErrorMessage(err)).toContain("nicht freigeschaltet");
  });
});

describe("11 vendor-only identity", () => {
  it("lists vendor-only by vendor code", async () => {
    const { client } = await signIn("kunde");
    const { data, error } = await client.rpc("list_shop_products_for_area", { _shop_area: "shop" });
    expect(error, rpcMessage(error)).toBeNull();
    const vendor = ((data as Array<Record<string, unknown>>) ?? []).find(
      (r) => String(r.code) === "QA-VENDOR-ONLY",
    );
    expect(vendor).toBeTruthy();
    expect(String(vendor?.name ?? "")).toMatch(/Vendor Only/i);
  });
});

describe("12 one cart", () => {
  it("keeps a single open cart", async () => {
    const { client, account } = await signIn("kunde");
    const a = await getOrCreateCart(client);
    const b = await getOrCreateCart(client);
    expect(a.id).toBe(b.id);
    const { data, error } = await client
      .from("carts")
      .select("id")
      .eq("user_id", account.userId)
      .is("deleted_at", null)
      .in("status", ["draft", "ready"]);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });
});

describe("13 kit cart sync", () => {
  it("does not duplicate kit cart lines", async () => {
    const { client: admin } = await signIn("admin");
    const { data: master } = await admin.from("products").select("id").eq("code", "QA-KIT-001").single();

    const { client } = await signIn("groupBuy");
    const cart = await getOrCreateCart(client);
    await clearCartItems(client, cart.id);

    const kit = await client.rpc("create_kit_share", {
      _product_id: master!.id,
      _kit_size_vials: 10,
      _my_quantity: 1,
    });
    expect(kit.error, rpcMessage(kit.error)).toBeNull();
    const kitId = kitIdFromRpc(kit.data);

    await client.rpc("update_kit_share_quantity", { _kit_share_id: kitId, _quantity: 2 });
    await client.rpc("update_kit_share_quantity", { _kit_share_id: kitId, _quantity: 1 });

    const { data } = await client
      .from("cart_items")
      .select("id")
      .eq("cart_id", cart.id)
      .eq("kit_share_id", kitId);
    expect(data ?? []).toHaveLength(1);
  });
});
