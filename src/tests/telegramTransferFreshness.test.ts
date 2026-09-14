import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTelegramTransferIntent,
  readTelegramTransferIntent,
  storeTelegramTransferIntent,
} from "@/services/username";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0082 telegram transfer freshness", () => {
  const sql = read("supabase/migrations/0082_fix_telegram_transfer_freshness.sql");

  it("does not require app_metadata.provider = custom:telegram alone", () => {
    expect(sql).toContain("_fresh_telegram_jwt");
    expect(sql).toContain("_fresh_telegram_identity");
    expect(sql).toContain("Multi-identity users often keep app_metadata.provider");
    expect(sql).toContain("stale_telegram_session");
    expect(sql).toContain("no_telegram_identity_on_source");
    expect(sql).toContain("status = 'failed'");
    expect(sql).not.toContain("status = 'expired'");
  });

  it("still moves only custom:telegram and blocks telegram-only sources", () => {
    expect(sql).toContain("update auth.identities");
    expect(sql).toContain("source_telegram_only");
    expect(sql).toContain("Keep existing target username");
    expect(sql).toContain("provider_id");
  });
});

describe("transfer intent storage backup", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("reads intent from localStorage when sessionStorage is empty", () => {
    storeTelegramTransferIntent("intent-backup");
    sessionStorage.removeItem("peptix:telegram-transfer-intent");
    expect(readTelegramTransferIntent()).toBe("intent-backup");
    clearTelegramTransferIntent();
    expect(readTelegramTransferIntent()).toBeNull();
  });
});

describe("transfer callback diagnostics", () => {
  it("logs peptix:transfer before complete and ignores stale intents on other flows", () => {
    const callback = read("src/pages/AuthCallback.tsx");
    expect(callback).toContain("[peptix:transfer]");
    expect(callback).toContain("before_complete");
    expect(callback).toContain("complete_failed");
    expect(callback).toContain("stale_intent_ignored");
    expect(callback).toContain('flowKind === "transfer"');
  });
});
