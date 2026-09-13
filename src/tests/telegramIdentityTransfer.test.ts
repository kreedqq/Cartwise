import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTelegramIdentityConflict,
  createTelegramTransferIntent,
  hasTelegramIdentityConflict,
  isTelegramIdentityConflictError,
  markTelegramIdentityConflict,
  storeTelegramTransferIntent,
  readTelegramTransferIntent,
  clearTelegramTransferIntent,
} from "@/services/username";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0078 telegram identity transfer", () => {
  const sql = read("supabase/migrations/0078_telegram_identity_transfer.sql");

  it("adds transfer intents and complete/create RPCs without rewriting 0070", () => {
    expect(sql).toContain("telegram_transfer_intents");
    expect(sql).toContain("create_telegram_transfer_intent");
    expect(sql).toContain("complete_telegram_identity_transfer");
    expect(sql).toContain("custom:telegram");
    expect(sql).toContain("preferred_username");
    expect(sql).toContain("source_telegram_only");
    expect(sql).not.toContain("0070_one_user_cart");
  });

  it("never falls back to display name claims", () => {
    expect(sql).toMatch(/identity_data->>'preferred_username'/);
    expect(sql).not.toMatch(/identity_data->>'name'/);
    expect(sql).not.toMatch(/identity_data->>'given_name'/);
    expect(sql).not.toMatch(/identity_data->>'family_name'/);
    expect(sql).not.toMatch(/identity_data->>'display_name'/);
  });

  it("blocks telegram-only source accounts and requires fresh telegram JWT", () => {
    expect(sql).toContain("einzige Anmeldung des bisherigen PEPTIX Kontos");
    expect(sql).toContain("app_metadata");
    expect(sql).toContain("5 minutes");
    expect(sql).toContain("30 minutes");
    expect(sql).toContain("for update");
  });

  it("moves identity only after username uniqueness checks", () => {
    const dupIdx = sql.indexOf("Dieser Telegram Benutzername wird bereits verwendet.");
    const moveIdx = sql.indexOf("update auth.identities");
    expect(dupIdx).toBeGreaterThan(-1);
    expect(moveIdx).toBeGreaterThan(dupIdx);
  });
});

describe("telegram transfer client helpers", () => {
  beforeEach(() => {
    sessionStorage.clear();
    rpc.mockReset();
  });

  it("tracks identity conflict and transfer intent in sessionStorage", () => {
    expect(hasTelegramIdentityConflict()).toBe(false);
    markTelegramIdentityConflict();
    expect(hasTelegramIdentityConflict()).toBe(true);
    clearTelegramIdentityConflict();
    expect(hasTelegramIdentityConflict()).toBe(false);

    storeTelegramTransferIntent("intent-1");
    expect(readTelegramTransferIntent()).toBe("intent-1");
    clearTelegramTransferIntent();
    expect(readTelegramTransferIntent()).toBeNull();
  });

  it("detects conflict errors without exposing other account details", () => {
    expect(isTelegramIdentityConflictError(new Error("Identity is already linked to another user"))).toBe(true);
    expect(isTelegramIdentityConflictError(new Error("identity_already_exists"))).toBe(true);
    expect(isTelegramIdentityConflictError(new Error("invalid login credentials"))).toBe(false);
  });

  it("creates transfer intents without client-supplied identity ids", async () => {
    rpc.mockResolvedValue({ data: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", error: null });
    await expect(createTelegramTransferIntent()).resolves.toMatch(/aaaa/);
    expect(rpc).toHaveBeenCalledWith("create_telegram_transfer_intent");
  });
});

describe("telegram transfer UI wiring", () => {
  it("shows confirm/cancel transfer copy without revealing foreign account details", () => {
    const page = read("src/pages/UsernameRequired.tsx");
    expect(page).toContain("Telegram Konto bereits verknüpft");
    expect(page).toContain("Telegram neu zuweisen");
    expect(page).toContain("Abbrechen");
    expect(page).toContain("createTelegramTransferIntent");
    expect(page).toContain("signInWithOAuth");
    expect(page).not.toContain("email@");
    expect(page).not.toContain("from_user");
  });

  it("completes transfer after OAuth only for explicit transfer flow", () => {
    const callback = read("src/pages/AuthCallback.tsx");
    expect(callback).toContain("completeTelegramIdentityTransfer");
    expect(callback).toContain('flowKind === "transfer"');
    expect(callback).toContain("readOAuthFlowKind");
    expect(callback).toContain("markTelegramIdentityConflict");
    expect(callback).toContain('flowKind === "link"');
    expect(callback).toContain("Telegram erfolgreich verknüpft");
    expect(callback).toContain("Stale transfer intent must never hijack");
  });

  it("stores transfer flow marker when confirming reassignment", () => {
    const page = read("src/pages/UsernameRequired.tsx");
    expect(page).toContain('flow: "transfer"');
    expect(page).toContain("createTelegramTransferIntent");
    expect(page).toContain("storeTelegramTransferIntent");
  });

  it("expires stale identity conflict markers", () => {
    sessionStorage.clear();
    sessionStorage.setItem("peptix:telegram-identity-conflict", String(Date.now() - 16 * 60 * 1000));
    expect(hasTelegramIdentityConflict()).toBe(false);
    markTelegramIdentityConflict();
    expect(hasTelegramIdentityConflict()).toBe(true);
  });

  it("expires conflict markers after the short OAuth TTL (3 minutes)", () => {
    sessionStorage.clear();
    sessionStorage.setItem("peptix:telegram-identity-conflict", String(Date.now() - 4 * 60 * 1000));
    expect(hasTelegramIdentityConflict()).toBe(false);
  });
});
