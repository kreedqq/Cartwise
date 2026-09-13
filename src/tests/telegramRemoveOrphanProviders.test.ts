import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0081 admin remove reconciles providers metadata", () => {
  const sql = read("supabase/migrations/0081_admin_remove_telegram_reconcile_providers.sql");

  it("rebuilds providers from remaining identities and read-backs both identity and providers", () => {
    expect(sql).toContain("admin_remove_telegram_identity");
    expect(sql).toContain("raw_app_meta_data");
    expect(sql).toContain("providers");
    expect(sql).toContain("Providers-Readback fehlgeschlagen");
    expect(sql).toContain("Identity-Readback fehlgeschlagen");
    expect(sql).toContain("admin_list_telegram_orphan_user_ids");
    expect(sql).toContain("einzige Anmeldemethode dieses Kontos");
  });

  it("allows orphaned providers cleanup when identity row is already gone", () => {
    expect(sql).toContain("identity already deleted but providers still lists");
  });
});

describe("stale conflict after remove", () => {
  it("clears conflict markers before starting a fresh Telegram link", () => {
    const page = read("src/pages/UsernameRequired.tsx");
    const start = page.indexOf("async function handleTelegramLink");
    const end = page.indexOf("async function handleConfirmTransfer");
    const body = page.slice(start, end);
    expect(body).toContain("clearTelegramIdentityConflict");
    expect(body).toContain("clearTelegramTransferIntent");
    expect(body).toContain("setShowTransferConfirm(false)");
    expect(body).toContain("startTelegramAccountLink");
  });
});
