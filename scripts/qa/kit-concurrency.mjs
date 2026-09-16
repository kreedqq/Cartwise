#!/usr/bin/env node
/**
 * Local kit concurrency suite. Requires QA seed (13+ accounts with join01–join08).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const accountsPath =
  process.env.PEPTIX_QA_ACCOUNTS_PATH ??
  resolve(process.cwd(), "supabase/qa/.generated/qa-accounts.local.json");

function abortIfProduction(url) {
  if (/cnjrjinvxycdkrmzcime|peptix\.app|supabase\.co\/project\/cnjr/i.test(url)) {
    console.error("Refusing to run against production.");
    process.exit(1);
  }
}

function loadAccounts() {
  const parsed = JSON.parse(readFileSync(accountsPath, "utf8"));
  abortIfProduction(parsed.apiUrl);
  return parsed;
}

function kitIdFromRpc(data) {
  if (data && typeof data === "object" && "id" in data) return String(data.id);
  if (data && typeof data === "object" && "kitShareId" in data) return String(data.kitShareId);
  throw new Error("Could not parse kit id");
}

async function signIn(apiUrl, anonKey, account) {
  const client = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw error;
  return client;
}

async function productForKit(client) {
  const { data, error } = await client.rpc("list_shop_products_for_area", {
    _shop_area: "group_buy_1",
  });
  if (error) throw error;
  const row = (data ?? []).find((p) => String(p.code).startsWith("QA-KIT"));
  if (!row) throw new Error("QA-KIT product missing");
  return row;
}

async function createOpenKit(creatorClient, product, creatorQty = 1) {
  const created = await creatorClient.rpc("create_kit_request", {
    _product_id: product.id,
    _kit_size_vials: 10,
    _my_quantity: creatorQty,
    _note: "concurrency",
    _shop_area: "group_buy_1",
  });
  if (created.error) throw created.error;
  return kitIdFromRpc(created.data);
}

async function projectState(client, kitId) {
  const { data, error } = await client.rpc("kit_share_project_state", { _kit_share_id: kitId });
  if (error) throw error;
  return data;
}

async function parallelJoin(clients, kitId, qty = 1) {
  return Promise.all(
    clients.map((client) =>
      client.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: qty }),
    ),
  );
}

async function cleanup(creatorClient, kitId) {
  const { error } = await creatorClient.rpc("cancel_kit_request", { _kit_share_id: kitId });
  if (error) {
    /* kit may already be cancelled or ordered */
  }
}

async function test1(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const joiners = accounts.filter((a) => a.key.startsWith("join")).slice(0, 9);
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const kitId = await createOpenKit(creatorClient, product, 1);
  const clients = await Promise.all(
    joiners.map((acc) => signIn(apiUrl, anonKey, acc)),
  );
  const results = await parallelJoin(clients, kitId, 1);
  const ok = results.filter((r) => !r.error).length;
  const state = await projectState(creatorClient, kitId);
  const allocated = Number(state.allocatedQuantity);
  await cleanup(creatorClient, kitId);
  if (allocated !== 10 || ok !== 9) {
    throw new Error(`TEST1 fail: ok=${ok} allocated=${allocated}`);
  }
  console.log("TEST1 PASS: 10 allocations, FULL");
}

async function test2(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const joiners = accounts.filter((a) => a.key.startsWith("join")).slice(0, 10);
  const extra = accounts.find((a) => a.key === "kunde");
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const kitId = await createOpenKit(creatorClient, product, 1);
  const clients = await Promise.all(
    [...joiners, extra].map((acc) => signIn(apiUrl, anonKey, acc)),
  );
  const results = await parallelJoin(clients, kitId, 1);
  const ok = results.filter((r) => !r.error).length;
  const fail = results.filter((r) => r.error).length;
  const state = await projectState(creatorClient, kitId);
  const allocated = Number(state.allocatedQuantity);
  await cleanup(creatorClient, kitId);
  // Creator already holds 1 slot; 11 parallel join attempts compete for 9 remaining slots.
  if (allocated !== 10 || ok !== 9 || fail < 2) {
    throw new Error(`TEST2 fail: ok=${ok} fail=${fail} allocated=${allocated}`);
  }
  console.log("TEST2 PASS: 9 joins ok, >=2 rejected, allocated=10 (creator holds 1)");
}

async function test3(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const pool = accounts.filter((a) => a.key.startsWith("join")).slice(0, 5);
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const kitId = await createOpenKit(creatorClient, product, 1);
  const clients = await Promise.all(pool.map((acc) => signIn(apiUrl, anonKey, acc)));
  const qtys = [5, 5, 3, 3, 1];
  const results = await Promise.all(
    clients.map((client, i) =>
      client.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: qtys[i] }),
    ),
  );
  const state = await projectState(creatorClient, kitId);
  const allocated = Number(state.allocatedQuantity);
  await cleanup(creatorClient, kitId);
  if (allocated > 10) {
    throw new Error(`TEST3 fail: allocated=${allocated}`);
  }
  const ok = results.filter((r) => !r.error).length;
  console.log(`TEST3 PASS: allocated=${allocated} (<=10), ok=${ok}`);
}

async function assertNoDuplicateParticipants(client, kitId) {
  const { data: parts, error } = await client
    .from("kit_share_participants")
    .select("user_id")
    .eq("kit_share_id", kitId);
  if (error) throw error;
  const ids = (parts ?? []).map((p) => p.user_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("duplicate participant rows detected");
  }
}

async function cartKitLines(client, kitId) {
  const { data, error } = await client
    .from("cart_items")
    .select("id, cart_id, quantity, kit_share_id, submitted_order_id")
    .eq("kit_share_id", kitId)
    .is("submitted_order_id", null);
  if (error) throw error;
  return data ?? [];
}

async function test5(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const u1 = accounts.find((a) => a.key === "join01");
  const u2 = accounts.find((a) => a.key === "join02");
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const kitId = await createOpenKit(creatorClient, product, 1);
  const c1 = await signIn(apiUrl, anonKey, u1);
  const c2 = await signIn(apiUrl, anonKey, u2);

  await Promise.all([
    c1.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 4 }),
    c2.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 3 }),
    c1.rpc("leave_kit_request", { _kit_share_id: kitId }),
    c1.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 }),
    c2.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 1 }),
  ]);

  const state = await projectState(creatorClient, kitId);
  const allocated = Number(state.allocatedQuantity);
  const remaining = Number(state.remainingQuantity ?? state.remainingVials ?? 0);
  await assertNoDuplicateParticipants(creatorClient, kitId);
  await cleanup(creatorClient, kitId);
  if (allocated > 10 || remaining < 0) {
    throw new Error(`TEST5 fail: allocated=${allocated} remaining=${remaining}`);
  }
  console.log(`TEST5 PASS: chaotic join/leave, allocated=${allocated}, consistent`);
}

async function test6(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const admin = accounts.find((a) => a.key === "admin");
  const joiners = accounts.filter((a) => a.key.startsWith("join")).slice(0, 8);
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const adminClient = await signIn(apiUrl, anonKey, admin);
  const kitId = await createOpenKit(creatorClient, product, 2);
  const clients = await Promise.all(joiners.map((acc) => signIn(apiUrl, anonKey, acc)));
  const joinResults = await parallelJoin(clients, kitId, 1);
  const joinOk = joinResults.filter((r) => !r.error).length;
  const state = await projectState(creatorClient, kitId);
  const allocated = Number(state.allocatedQuantity);
  if (allocated !== 10 || joinOk < 8) {
    await cleanup(creatorClient, kitId);
    throw new Error(`TEST6 setup fail: allocated=${allocated} joinOk=${joinOk}`);
  }

  const before = await cartKitLines(adminClient, kitId);
  await Promise.all(
    Array.from({ length: 10 }, () => adminClient.rpc("admin_sync_orders_and_carts")),
  );
  const after = await cartKitLines(adminClient, kitId);

  const key = (row) => `${row.cart_id}:${row.kit_share_id}`;
  const byCartBefore = new Map();
  for (const row of before) {
    byCartBefore.set(key(row), (byCartBefore.get(key(row)) ?? 0) + 1);
  }
  const byCartAfter = new Map();
  for (const row of after) {
    byCartAfter.set(key(row), (byCartAfter.get(key(row)) ?? 0) + 1);
  }
  for (const [k, count] of byCartAfter) {
    if (count > 1) {
      await cleanup(creatorClient, kitId);
      throw new Error(`TEST6 fail: duplicate cart lines for ${k}`);
    }
  }
  const qtyBefore = before.reduce((s, r) => s + Number(r.quantity), 0);
  const qtyAfter = after.reduce((s, r) => s + Number(r.quantity), 0);
  await cleanup(creatorClient, kitId);
  if (qtyAfter !== qtyBefore) {
    throw new Error(`TEST6 fail: qty drift before=${qtyBefore} after=${qtyAfter}`);
  }
  if (before.length < 1) {
    throw new Error("TEST6 fail: expected kit cart lines after FULL");
  }
  console.log("TEST6 PASS: 10 parallel global syncs, stable cart lines");
}

async function test4(accounts, apiUrl, anonKey, product) {
  const creator = accounts.find((a) => a.key === "groupBuy");
  const joiner = accounts.find((a) => a.key === "join01");
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const kitId = await createOpenKit(creatorClient, product, 5);
  const client = await signIn(apiUrl, anonKey, joiner);
  const results = await Promise.all([
    client.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 }),
    client.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 }),
    client.rpc("join_kit_request", { _kit_share_id: kitId, _quantity: 2 }),
  ]);
  const ok = results.filter((r) => !r.error).length;
  const { data: parts } = await creatorClient
    .from("kit_share_participants")
    .select("user_id")
    .eq("kit_share_id", kitId)
    .eq("user_id", joiner.userId);
  await cleanup(creatorClient, kitId);
  if ((parts ?? []).length > 1) {
    throw new Error("TEST4 fail: duplicate participant rows");
  }
  console.log(`TEST4 PASS: same-user parallel joins, rows=1, ok=${ok}`);
}

async function main() {
  const file = loadAccounts();
  const { apiUrl, anonKey, accounts } = file;
  const creator = accounts.find((a) => a.key === "groupBuy");
  const creatorClient = await signIn(apiUrl, anonKey, creator);
  const product = await productForKit(creatorClient);

  await test1(accounts, apiUrl, anonKey, product);
  await test2(accounts, apiUrl, anonKey, product);
  await test3(accounts, apiUrl, anonKey, product);
  await test4(accounts, apiUrl, anonKey, product);
  await test5(accounts, apiUrl, anonKey, product);
  await test6(accounts, apiUrl, anonKey, product);

  console.log("ALL CONCURRENCY TESTS PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
