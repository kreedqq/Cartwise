#!/usr/bin/env node
/**
 * Kit create → join → full → cart → checkout → order (UI, 3 users, localhost only).
 */
import { createClient } from "@supabase/supabase-js";
import {
  BASE,
  assertDevServer,
  acceptConsentIfNeeded,
  clearOpenCartItems,
  failAndExit,
  fillCheckoutAndSubmit,
  HOME_SHIPPING_RPC,
  login,
  loadAccount,
  loadQaFile,
  mergeFlowState,
  openCartFromTopbar,
  requireQaAccounts,
  writeJson,
  GENERATED_DIR,
} from "./browser-helpers.mjs";

const KITS_URL = `${BASE}/shop/group-buy-1/kit-gesuche`;
const PRODUCT_SEARCH = "QA-KIT";
const KIT_MARKER = `BROWSER-KIT-E2E-${Date.now()}`;

async function wizardNext(page) {
  await page.getByRole("dialog").getByRole("button", { name: "Weiter" }).click();
}

async function createKitViaWizard(page) {
  await page.goto(KITS_URL, { waitUntil: "networkidle" });
  await acceptConsentIfNeeded(page);
  await page.getByRole("button", { name: "Gesuch erstellen" }).first().click();
  await page.getByRole("dialog").waitFor({ state: "visible" });

  await page.getByRole("dialog").getByRole("textbox", { name: "Produkt suchen" }).fill(PRODUCT_SEARCH);
  await page.waitForTimeout(800);
  await page.getByRole("dialog").getByRole("button").filter({ hasText: /QA Kit/i }).first().click();
  await wizardNext(page);

  await page.getByRole("dialog").getByRole("button").filter({ hasText: /5 mg/i }).first().click();
  await wizardNext(page);

  await wizardNext(page);
  await page.getByRole("dialog").getByRole("button", { name: "5", exact: true }).click();
  await wizardNext(page);
  await page.getByRole("dialog").locator("textarea").fill(KIT_MARKER);
  await wizardNext(page);

  await page.getByRole("dialog").getByRole("button", { name: "Kit Gesuch erstellen" }).click();
  await page.getByRole("dialog").getByText("Kit Gesuch erstellt").waitFor({ timeout: 45_000 });
  await page.getByRole("button", { name: "Gesuch ansehen" }).click();
  await page.waitForTimeout(1500);
}

async function joinKit(page, allocatedBefore, qty) {
  await page.goto(KITS_URL, { waitUntil: "networkidle" });
  await acceptConsentIfNeeded(page);
  await page.goto(KITS_URL, { waitUntil: "networkidle" });
  const search = page.locator("#kit-search").or(page.getByPlaceholder("Produkt suchen …").first());
  await search.waitFor({ state: "visible", timeout: 45_000 }).catch(async () => {
    const snippet = (await page.locator("body").innerText()).slice(0, 400);
    failAndExit("KIT JOIN", `Kit list UI missing. ${snippet}`);
  });
  await search.fill("");
  await page.waitForTimeout(800);
  const card = page
    .locator("article")
    .filter({ hasText: KIT_MARKER })
    .filter({ hasText: `${allocatedBefore} / 10` })
    .first();
  await card.waitFor({ state: "visible", timeout: 30_000 });
  await card.getByRole("button", { name: "Mitmachen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: String(qty), exact: true }).click();
  await page.getByRole("button", { name: "Mitmachen" }).click();
  await page.waitForTimeout(2500);
}

async function assertKitCard(page, allocated) {
  await page.goto(KITS_URL, { waitUntil: "networkidle" });
  await acceptConsentIfNeeded(page);
  if (allocated === 10) {
    await page.getByRole("tab", { name: "Meine Kit Beteiligungen" }).click();
  }
  await page.waitForTimeout(800);
  const card = page.locator("article").filter({ hasText: KIT_MARKER }).first();
  await card.waitFor({ state: "visible", timeout: 25_000 });
  await card.getByText(`${allocated} / 10`).waitFor({ state: "visible" });
  if (allocated === 10) {
    await card.getByText(/Voll|Kit vollständig/).first().waitFor({ state: "visible" });
  }
}

async function ensureKitCartSynced(page) {
  await page.goto(KITS_URL, { waitUntil: "networkidle" });
  await acceptConsentIfNeeded(page);
  for (const tabName of ["Von mir erstellt", "Meine Kit Beteiligungen"]) {
    const tab = page.getByRole("tab", { name: tabName });
    if (await tab.isVisible().catch(() => false)) await tab.click();
    const retry = page.locator("article").filter({ hasText: KIT_MARKER }).getByRole("button", { name: "Warenkorb aktualisieren" });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
      await page.waitForTimeout(2500);
      return;
    }
  }
}

function kitCartRowLocator(page, kitId) {
  return page.locator(`tr[data-kit-share-id="${kitId}"], [data-kit-share-id="${kitId}"]`).first();
}

async function checkoutFromCart(page, expectedQty, kitId) {
  await ensureKitCartSynced(page);
  await openCartFromTopbar(page);
  await page.reload({ waitUntil: "networkidle" });
  const cartId = page.url().match(/\/carts\/([^/?#]+)/)?.[1] ?? null;
  const kitRow = kitCartRowLocator(page, kitId);
  await kitRow.waitFor({ state: "visible", timeout: 30_000 });
  const qtyInput = kitRow.locator('input[inputmode="decimal"]');
  await qtyInput.waitFor({ state: "visible", timeout: 10_000 });
  if (await qtyInput.isDisabled().catch(() => false)) {
    await kitRow.getByText("Menge folgt deinem Kit-Anteil.").waitFor({ state: "visible", timeout: 5_000 });
  }
  const qtyVal = await qtyInput.inputValue();
  if (Number(qtyVal.replace(",", ".")) !== expectedQty) {
    failAndExit("KIT CART", `Expected quantity ${expectedQty} for kit ${kitId}, cart input=${qtyVal}`);
  }
  await page.getByRole("button", { name: "Bestellung prüfen" }).click();
  await fillCheckoutAndSubmit(page);
  return cartId;
}

async function main() {
  await assertDevServer();
  requireQaAccounts();
  const qa = loadQaFile();
  const accA = loadAccount("groupBuy");
  const accB = loadAccount("join01");
  const accC = loadAccount("join02");

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const log = [];
  let cartIdA = null;

  try {
    for (const acc of [accA, accB, accC]) {
      const prep = createClient(qa.apiUrl, qa.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await prep.auth.signInWithPassword({ email: acc.email, password: acc.password });
      await clearOpenCartItems(prep);
      await prep.auth.signOut();
    }

    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await ctxA.newPage();
    await login(pageA, accA.email, accA.password);
    await acceptConsentIfNeeded(pageA);
    await createKitViaWizard(pageA);
    log.push("create:ok");
    await assertKitCard(pageA, 5);

    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageB = await ctxB.newPage();
    await login(pageB, accB.email, accB.password);
    await acceptConsentIfNeeded(pageB);
    await joinKit(pageB, 5, 3);
    log.push("join-b:ok");
    await assertKitCard(pageB, 8);

    const ctxC = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageC = await ctxC.newPage();
    await login(pageC, accC.email, accC.password);
    await acceptConsentIfNeeded(pageC);
    await joinKit(pageC, 8, 2);
    log.push("join-c:ok");
    await assertKitCard(pageC, 10);

    const adminClient = createClient(qa.apiUrl, qa.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await adminClient.auth.signInWithPassword({ email: accA.email, password: accA.password });
    const { data: kitsRaw } = await adminClient.rpc("list_my_kit_requests", { _shop_area: "group_buy_1" });
    const kits = Array.isArray(kitsRaw?.items) ? kitsRaw.items : [];
    const latest =
      kits.find((k) => String(k.note ?? "").includes(KIT_MARKER)) ??
      kits.find((k) => Number(k.allocated_total ?? k.allocatedTotal) === 10);
    const kitId = latest?.id ?? latest?.kit_share_id;
    if (!kitId) failAndExit("KIT E2E", "Could not resolve full kit id");

    const syncRes = await adminClient.rpc("sync_completed_kit_request_carts", { _kit_share_id: kitId });
    if (syncRes.error) failAndExit("KIT SYNC", syncRes.error.message ?? String(syncRes.error));

    const projected = await adminClient.rpc("kit_share_project_state", { _kit_share_id: kitId });
    const st = projected.data ?? {};
    if (Number(st.allocatedQuantity ?? st.allocated_total) !== 10) {
      failAndExit("KIT E2E", "allocated_total != 10");
    }
    log.push("invariants:ok");

    await pageA.waitForTimeout(2000);
    cartIdA = await checkoutFromCart(pageA, 5, kitId);
    log.push("checkout-a:ok");

    await checkoutFromCart(pageB, 3, kitId);
    log.push("checkout-b:ok");

    await checkoutFromCart(pageC, 2, kitId);
    log.push("checkout-c:ok");

    if (cartIdA) {
      const { data: openKitLines, error: linesErr } = await adminClient
        .from("cart_items")
        .select("id")
        .eq("cart_id", cartIdA)
        .eq("kit_share_id", kitId)
        .gt("quantity", 0)
        .is("submitted_order_id", null);
      if (linesErr || (openKitLines?.length ?? 0) > 0) {
        failAndExit(
          "KIT DUPLICATE",
          `Kit line should be submitted before duplicate check (openKitLines=${openKitLines?.length ?? "?"} ${linesErr?.message ?? ""})`.trim(),
        );
      }
      const dupOrder = await adminClient.rpc("create_order", {
        _cart_id: cartIdA,
        _note: "browser duplicate attempt",
        _payment_method: "crypto",
        ...HOME_SHIPPING_RPC,
      });
      if (!dupOrder.error) {
        failAndExit("KIT DUPLICATE", "create_order should fail for already-submitted kit participant cart");
      }
      await pageA.goto(`${BASE}/carts/${cartIdA}/checkout`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await pageA
        .getByText(/Bestellübersicht wird geladen|Anmeldung wird abgeschlossen/i)
        .waitFor({ state: "hidden", timeout: 90_000 })
        .catch(() => {});
      const blocked = pageA
        .getByText("Bereits bestellt")
        .or(pageA.getByText("Dieser Warenkorb wurde bereits als Bestellung abgeschickt"))
        .or(pageA.getByRole("button", { name: "Zu meinen Bestellungen" }));
      await blocked.first().waitFor({ timeout: 30_000 });
      log.push("duplicate-checkout-a:blocked");
    } else {
      await pageA.goto(`${BASE}/carts`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await pageA.getByText("schreibgeschützt").first().waitFor({ timeout: 30_000 }).catch(() => {
        failAndExit("KIT DUPLICATE", "Could not verify duplicate checkout block");
      });
      log.push("duplicate-checkout-a:blocked-fallback");
    }

    writeJson(`${GENERATED_DIR}/browser-kit-flow.json`, { pass: true, log, kitId });
    mergeFlowState({ kitId, kitBrowserE2e: true });
    console.log("KIT BROWSER E2E PASS");
    console.log(log.join("\n"));

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  } catch (err) {
    failAndExit("KIT BROWSER E2E", err);
  } finally {
    await browser.close();
  }
}

main();
