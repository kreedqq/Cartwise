import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

import { assertSafeLocalQaTarget } from "@/lib/qa/productionGuard";

export type QaAccountKey = "admin" | "groupBuy" | "neu" | "kunde" | "stammkunde";

export interface QaAccountFile {
  generatedAt: string;
  apiUrl: string;
  anonKey: string;
  accounts: Array<{
    key: QaAccountKey;
    email: string;
    password: string;
    username: string;
    customerRole: string;
    isAdmin: boolean;
    userId: string;
  }>;
}

export const HOME_SHIPPING = {
  _shipping_delivery_method: "home",
  _shipping_first_name: "QA",
  _shipping_last_name: "Tester",
  _shipping_street: "Teststrasse",
  _shipping_house_number: "1",
  _shipping_address_extra: null,
  _shipping_packstation_number: null,
  _shipping_post_number: null,
  _shipping_postal_code: "10115",
  _shipping_city: "Berlin",
  _shipping_country: "Deutschland",
} as const;

let cachedAccounts: QaAccountFile | null = null;

export function loadQaAccounts(): QaAccountFile {
  if (cachedAccounts) return cachedAccounts;
  const path = process.env.PEPTIX_QA_ACCOUNTS_PATH;
  if (!path) throw new Error("PEPTIX_QA_ACCOUNTS_PATH missing — run via npm run test:qa");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as QaAccountFile;
  assertSafeLocalQaTarget({ supabaseUrl: parsed.apiUrl });
  cachedAccounts = parsed;
  return parsed;
}

export function requireLocalQaEnv(): void {
  if (process.env.PEPTIX_QA_LOCAL !== "1") {
    throw new Error("QA tests must run via npm run test:qa (PEPTIX_QA_LOCAL=1)");
  }
  assertSafeLocalQaTarget({
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    extra: [process.env.SUPABASE_URL],
  });
}

export function anonClient(): SupabaseClient {
  const accounts = loadQaAccounts();
  return createClient(accounts.apiUrl, accounts.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signIn(key: QaAccountKey): Promise<{
  client: SupabaseClient;
  account: QaAccountFile["accounts"][number];
}> {
  const accounts = loadQaAccounts();
  const account = accounts.accounts.find((a) => a.key === key);
  if (!account) throw new Error(`Unknown QA account ${key}`);
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw error;
  return { client, account };
}

export async function shopProductByCode(
  client: SupabaseClient,
  shopArea: string,
  code: string,
): Promise<{ id: string; code: string; name: string; price_usd: number; bulk_price_usd: number | null; bulk_price_min_quantity: number | null }> {
  const { data, error } = await client.rpc("list_shop_products_for_area", { _shop_area: shopArea });
  if (error) throw error;
  const row = ((data as Array<Record<string, unknown>>) ?? []).find(
    (p) => String(p.code).toUpperCase() === code.toUpperCase(),
  );
  if (!row?.id) throw new Error(`Product ${code} not listed in ${shopArea}`);
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    price_usd: Number(row.price_usd),
    bulk_price_usd: row.bulk_price_usd == null ? null : Number(row.bulk_price_usd),
    bulk_price_min_quantity:
      row.bulk_price_min_quantity == null ? null : Number(row.bulk_price_min_quantity),
  };
}

export async function getOrCreateCart(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_or_create_user_cart");
  if (error) throw error;
  return data as { id: string; shop_area: string; status: string };
}

export async function clearCartItems(client: SupabaseClient, cartId: string) {
  const { data: items, error: listErr } = await client
    .from("cart_items")
    .select("id, kit_share_id, submitted_order_id")
    .eq("cart_id", cartId);
  if (listErr) throw listErr;

  for (const row of items ?? []) {
    if (row.kit_share_id) {
      if (row.submitted_order_id) continue;
      await client.rpc("leave_kit_share", { _kit_share_id: row.kit_share_id });
      continue;
    }
    const { error } = await client.from("cart_items").delete().eq("id", row.id);
    if (error) throw error;
  }

  const { data: leftovers, error: leftErr } = await client
    .from("cart_items")
    .select("id, kit_share_id, submitted_order_id")
    .eq("cart_id", cartId);
  if (leftErr) throw leftErr;

  for (const row of leftovers ?? []) {
    if (row.kit_share_id) {
      if (row.submitted_order_id) continue;
      const { error } = await client.from("cart_items").delete().eq("id", row.id);
      if (error && /gesperrt/i.test(String(error.message ?? ""))) continue;
      if (error) throw error;
      continue;
    }
    const { error } = await client.from("cart_items").delete().eq("id", row.id);
    if (error) throw error;
  }
}

export async function addCatalogLine(
  client: SupabaseClient,
  cartId: string,
  code: string,
  quantity: number,
  shopArea: string,
  position: number,
  rate = 0.92,
) {
  const product = await shopProductByCode(client, shopArea, code);
  const unit = product.price_usd;
  const { data, error } = await client
    .from("cart_items")
    .insert({
      cart_id: cartId,
      position,
      product_code_input: code,
      quantity,
      shop_area: shopArea,
      product_id: product.id,
      vendor_code: code,
      product_code_snapshot: product.code,
      product_name_snapshot: product.name,
      unit_price_usd_snapshot: unit,
      normal_price_usd_snapshot: unit,
      bulk_price_usd_snapshot: product.bulk_price_usd,
      bulk_price_min_quantity_snapshot: product.bulk_price_min_quantity,
      applied_price_tier: "normal",
      exchange_rate_snapshot: rate,
      eur_value_snapshot: Math.round(unit * quantity * rate * 100) / 100,
      price_snapshot_at: new Date().toISOString(),
      resolution_status: "resolved",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export function kitIdFromRpc(data: unknown): string {
  if (!data || typeof data !== "object") throw new Error("Missing kit RPC payload");
  const row = data as Record<string, unknown>;
  const id = row.id ?? row.kitRequestId ?? row.kit_share_id;
  if (!id) throw new Error(`No kit id in payload: ${JSON.stringify(data).slice(0, 200)}`);
  return String(id);
}

export function rpcMessage(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" | ");
}
