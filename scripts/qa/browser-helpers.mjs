#!/usr/bin/env node
/**
 * Shared Playwright helpers for local browser QA (localhost only).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

export const ROOT = resolve(process.cwd());
export const BASE = process.env.PEPTIX_DEV_URL ?? "http://localhost:5173";
export const ACCOUNTS_PATH =
  process.env.PEPTIX_QA_ACCOUNTS_PATH ?? resolve(ROOT, "supabase/qa/.generated/qa-accounts.local.json");
export const GENERATED_DIR = resolve(ROOT, "supabase/qa/.generated");
export const FLOW_STATE_PATH = resolve(GENERATED_DIR, "browser-flow-state.json");

export const MOBILE_VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "412", width: 412, height: 915 },
];

export function assertLocalhostUrl(url = BASE) {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    throw new Error(`Refusing non-localhost URL: ${url}`);
  }
}

export function loadAccount(key) {
  const file = JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
  assertSafeLocalQaTarget({ supabaseUrl: file.apiUrl });
  const account = file.accounts.find((a) => a.key === key);
  if (!account) throw new Error(`Missing QA account ${key}`);
  return account;
}

export function loadQaFile() {
  const file = JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
  assertSafeLocalQaTarget({ supabaseUrl: file.apiUrl });
  return file;
}

export async function assertDevServer() {
  assertLocalhostUrl(BASE);
  const res = await fetch(BASE, { method: "GET" }).catch(() => null);
  if (!res?.ok) throw new Error(`Dev server not reachable at ${BASE} — run npm run dev`);
}

export function requireQaAccounts() {
  if (!existsSync(ACCOUNTS_PATH)) {
    throw new Error("Run npm run test:qa seed first (qa-accounts.local.json missing)");
  }
}

export async function login(page, email, password) {
  assertLocalhostUrl(BASE);
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // about:blank or blocked origin — ignore
    }
  }).catch(() => {});
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(page.url())) {
    throw new Error(`Login aborted — not localhost: ${page.url()}`);
  }
  const spinner = page.getByText(/Anmeldung wird abgeschlossen/i);
  await spinner.waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});

  const emailInput = page.locator("#email");
  const maintenanceAdmin = page.locator("button.sr-only", { hasText: "Admin" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await emailInput.isVisible().catch(() => false)) break;
    if (await maintenanceAdmin.count()) {
      await maintenanceAdmin.click({ force: true });
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(500);
  }
  await emailInput.waitFor({ state: "visible", timeout: 120_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 45_000 }).catch(() => {});
  await acceptConsentIfNeeded(page);
}

export async function acceptConsentIfNeeded(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!page.url().includes("/consent")) return;
    const label = page.getByText("Ich bestätige diese Erklärung.", { exact: false });
    if (await label.isVisible().catch(() => false)) {
      await label.click();
    } else {
      await page.getByRole("checkbox").first().click();
    }
    const confirm = page.getByRole("button", { name: /Bestätigen und fortfahren|Bestätigen/ });
    await confirm.waitFor({ state: "visible", timeout: 10_000 });
    await confirm.click();
    await page.waitForURL((url) => !url.pathname.includes("/consent"), { timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  if (page.url().includes("/consent")) {
    throw new Error("Research consent gate still blocking after accept attempts");
  }
}

export const HOME_SHIPPING_RPC = {
  _shipping_delivery_method: "home",
  _shipping_first_name: "QA",
  _shipping_last_name: "Browser",
  _shipping_street: "Teststrasse",
  _shipping_house_number: "1",
  _shipping_address_extra: null,
  _shipping_packstation_number: null,
  _shipping_post_number: null,
  _shipping_postal_code: "10115",
  _shipping_city: "Berlin",
  _shipping_country: "Deutschland",
};

/** Removes unsubmitted cart lines so browser E2E starts from a clean cart. */
export async function clearOpenCartItems(client) {
  const { data: cart, error: cartErr } = await client.rpc("get_or_create_user_cart");
  if (cartErr) throw cartErr;
  const cartId = cart.id;

  const { data: items, error: listErr } = await client
    .from("cart_items")
    .select("id, kit_share_id, submitted_order_id")
    .eq("cart_id", cartId);
  if (listErr) throw listErr;

  for (const row of items ?? []) {
    if (row.submitted_order_id) continue;
    if (row.kit_share_id) {
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
    if (row.submitted_order_id) continue;
    if (row.kit_share_id) {
      const { error } = await client.from("cart_items").delete().eq("id", row.id);
      if (error && !/gesperrt/i.test(String(error.message ?? ""))) throw error;
      continue;
    }
    const { error } = await client.from("cart_items").delete().eq("id", row.id);
    if (error) throw error;
  }
}

export async function openCartFromTopbar(page) {
  await page.getByRole("button", { name: /Aktiver Warenkorb/i }).click();
  await page.waitForURL(/\/carts\//, { timeout: 30_000 });
}

export async function fillCheckoutAndSubmit(page) {
  await page.getByRole("radio", { name: "Haustür Zustellung" }).click();
  const crypto = page.getByRole("radio", { name: "Krypto" });
  if (await crypto.isVisible().catch(() => false)) {
    await crypto.click();
  } else {
    const firstPay = page.locator('[role="radiogroup"][aria-label="Zahlungsmethode"] button').first();
    await firstPay.click();
  }
  await page.locator("#shipping-first-name").fill("QA");
  await page.locator("#shipping-last-name").fill("Browser");
  await page.locator("#shipping-street").fill("Teststrasse");
  await page.locator("#shipping-house-number").fill("1");
  await page.locator("#shipping-postal").fill("10115");
  await page.locator("#shipping-city").fill("Berlin");
  await page.locator("#shipping-country").fill("Deutschland");
  await page.getByRole("button", { name: "Bestellung absenden" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible", timeout: 20_000 });
  await dialog.getByRole("button", { name: "Verbindlich bestellen" }).click();
  await page.waitForURL(/\/orders(\/|$)/, { timeout: 60_000 });
}

export async function waitForEurSample(page) {
  await page.waitForTimeout(1500);
  const eur = page.locator('[data-currency="eur"]').first();
  await eur.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  const text = (await eur.textContent().catch(() => ""))?.trim() ?? "";
  return text && !text.startsWith("—") && (text.includes("€") || text.includes("…"));
}

export async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
}

/** Primary CTAs that must meet 44×44px on mobile viewports. */
export const PRIMARY_TOUCH_ROLES = [
  { role: "button", name: "Zum Warenkorb" },
  { role: "button", name: "In den Warenkorb" },
  { role: "button", name: "Bestellung prüfen" },
  { role: "button", name: "Bestellung absenden" },
  { role: "button", name: "Mitmachen" },
  { role: "button", name: "Gesuch erstellen" },
  { role: "button", name: "Verbindlich bestellen" },
  { role: "button", name: /Aktiver Warenkorb/i },
  { role: "button", name: "Weiter" },
  { role: "button", name: "Kit Gesuch erstellen" },
  { role: "radio", name: "Haustür Zustellung" },
];

export async function auditPrimaryTouchTargets(page) {
  const failures = [];
  for (const spec of PRIMARY_TOUCH_ROLES) {
    const loc = page.getByRole(spec.role, { name: spec.name }).first();
    if (!(await loc.isVisible().catch(() => false))) continue;
    const box = await loc.boundingBox();
    if (!box) continue;
    if (box.width < 44 || box.height < 44) {
      failures.push({
        role: spec.role,
        name: String(spec.name),
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
    }
  }
  return failures;
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/** Path + query from a saved flow URL (ignores host/port so QA Vite port can change). */
export function pathFromFlowUrl(stored) {
  if (!stored?.trim()) return null;
  const raw = stored.trim();
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}`;
  } catch {
    if (raw.startsWith("/")) return raw;
    const m = raw.match(/^https?:\/\/[^/]+(\/.*)$/i);
    return m?.[1] ?? null;
  }
}

export function mergeFlowState(patch) {
  let prev = {};
  if (existsSync(FLOW_STATE_PATH)) {
    try {
      prev = JSON.parse(readFileSync(FLOW_STATE_PATH, "utf8"));
    } catch {
      prev = {};
    }
  }
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  writeJson(FLOW_STATE_PATH, next);
  return next;
}

export function failAndExit(label, details) {
  console.error(`${label} FAILED`);
  console.error(details);
  process.exit(1);
}
