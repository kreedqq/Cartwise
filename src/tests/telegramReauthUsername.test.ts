import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTelegramReauthUsername,
  clearUsernameChangeEligible,
  isUsernameChangeRequest,
  mapUsernameError,
  markUsernameChangeEligible,
  shouldPromptForUsername,
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

describe("0076 telegram reauth username", () => {
  const sql = read("supabase/migrations/0076_telegram_reauth_username.sql");

  it("reuses username_required_on_next_login and adds apply_telegram_reauth_username", () => {
    expect(sql).toContain("username_required_on_next_login");
    expect(sql).toContain("apply_telegram_reauth_username");
    expect(sql).toContain("preferred_username");
    expect(sql).toContain("custom:telegram");
    expect(sql).toContain("for update");
    expect(sql).toContain("sync_cart_titles_for_user");
    expect(sql).not.toContain("0070_one_user_cart");
  });

  it("never falls back to display name claims", () => {
    expect(sql).toMatch(/identity_data->>'preferred_username'/);
    expect(sql).not.toMatch(/identity_data->>'name'/);
    expect(sql).not.toMatch(/identity_data->>'given_name'/);
    expect(sql).not.toMatch(/identity_data->>'family_name'/);
    expect(sql).not.toMatch(/identity_data->>'display_name'/);
    expect(sql).toContain("Fail closed");
  });

  it("requires a fresh Telegram session (JWT provider + identity aligned with JWT iat)", () => {
    expect(sql).toContain("app_metadata");
    expect(sql).toContain("custom:telegram");
    expect(sql).toContain("last_sign_in_at");
    expect(sql).toContain("5 minutes");
    expect(sql).toContain("30 minutes");
    expect(sql).toContain("Bitte melde dich mit Telegram an");
    expect(sql).toContain("auth.jwt()");
  });

  it("keeps set_username as initial claim only (locked once set)", () => {
    expect(sql).toContain("create or replace function public.set_username");
    expect(sql).toContain("Dein Telegram Benutzername ist gesperrt und kann nicht selbst geändert werden.");
    expect(sql).toContain("initial claim only");
  });

  it("does not consume the requirement when preferred_username is missing", () => {
    expect(sql).toContain("Kein verifizierter Telegram Benutzername verfügbar");
    const missingIdx = sql.indexOf("Kein verifizierter Telegram Benutzername verfügbar");
    const updateIdx = sql.indexOf("username_required_on_next_login = false", missingIdx);
    expect(missingIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(missingIdx);
  });

  it("rejects duplicate usernames without clearing the flag before the uniqueness check", () => {
    expect(sql).toContain("Dieser Telegram Benutzername wird bereits verwendet.");
    const dupIdx = sql.indexOf("Dieser Telegram Benutzername wird bereits verwendet.");
    const clearIdx = sql.lastIndexOf("username_required_on_next_login = false");
    expect(clearIdx).toBeGreaterThan(dupIdx);
  });
});

describe("0077 telegram identity linking RPC", () => {
  const sql = read("supabase/migrations/0077_telegram_identity_linking.sql");

  it("keeps preferred_username-only apply and does not rewrite 0076", () => {
    expect(sql).toContain("apply_telegram_reauth_username");
    expect(sql).toMatch(/identity_data->>'preferred_username'/);
    expect(sql).not.toMatch(/identity_data->>'name'/);
    expect(sql).not.toMatch(/identity_data->>'given_name'/);
    expect(sql).not.toMatch(/identity_data->>'family_name'/);
    expect(sql).not.toMatch(/identity_data->>'display_name'/);
    expect(sql).not.toContain("0070_one_user_cart");
  });

  it("allows linkIdentity freshness without requiring JWT provider=custom:telegram alone", () => {
    expect(sql).toContain("_fresh_telegram_jwt");
    expect(sql).toContain("_fresh_linked_identity");
    expect(sql).toContain("5 seconds");
    expect(sql).toContain("5 minutes");
    expect(sql).toContain("30 minutes");
    expect(sql).toContain("app_metadata");
    expect(sql).toContain("custom:telegram");
  });

  it("still fail-closes on missing preferred_username and duplicate username", () => {
    expect(sql).toContain("Kein verifizierter Telegram Benutzername verfügbar");
    expect(sql).toContain("Dieser Telegram Benutzername wird bereits verwendet.");
    const missingIdx = sql.indexOf("Kein verifizierter Telegram Benutzername verfügbar");
    const clearIdx = sql.lastIndexOf("username_required_on_next_login = false");
    expect(clearIdx).toBeGreaterThan(missingIdx);
  });
});

describe("telegram reauth client gate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    rpc.mockReset();
  });

  it("prompts for missing username without a reauth flag", () => {
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "u1" },
        profile: { username: null, username_required_on_next_login: false },
      }),
    ).toBe(true);
  });

  it("does not prompt for reauth on reload without SIGNED_IN eligibility", () => {
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "u1" },
        profile: { username: "ExampleUser", username_required_on_next_login: true },
      }),
    ).toBe(false);
  });

  it("prompts for reauth only after SIGNED_IN eligibility", () => {
    markUsernameChangeEligible("u1");
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "u1" },
        profile: { username: "ExampleUser", username_required_on_next_login: true },
      }),
    ).toBe(true);
    clearUsernameChangeEligible("u1");
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "u1" },
        profile: { username: "ExampleUser", username_required_on_next_login: true },
      }),
    ).toBe(false);
  });

  it("detects telegram reauth requests separately from initial claim", () => {
    expect(isUsernameChangeRequest({ username: "Ayspet", username_required_on_next_login: true })).toBe(true);
    expect(isUsernameChangeRequest({ username: null, username_required_on_next_login: true })).toBe(false);
    expect(isUsernameChangeRequest({ username: "Ayspet", username_required_on_next_login: false })).toBe(false);
  });

  it("calls apply_telegram_reauth_username without client username args", async () => {
    rpc.mockResolvedValue({ data: "Ayspet", error: null });
    await expect(applyTelegramReauthUsername()).resolves.toBe("Ayspet");
    expect(rpc).toHaveBeenCalledWith("apply_telegram_reauth_username");
  });

  it("maps fail-closed and telegram-required errors", () => {
    expect(
      mapUsernameError(new Error("Kein verifizierter Telegram Benutzername verfügbar. Bitte verwende ein Telegram-Konto mit Benutzername.")),
    ).toMatch(/Kein verifizierter Telegram Benutzername/);
    expect(
      mapUsernameError(new Error("Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.")),
    ).toMatch(/bestehender PEPTIX Account|melde dich mit Telegram/i);
    expect(mapUsernameError(new Error("Dieser Telegram Benutzername wird bereits verwendet."))).toMatch(
      /bereits verwendet/,
    );
  });
});

describe("telegram linking UI wiring", () => {
  it("replaces free-text next-login admin action with Telegram reauth copy", () => {
    const page = read("src/pages/admin/AdminUsers.tsx");
    expect(page).toContain("Telegram Anmeldung beim nächsten Login erzwingen");
    expect(page).toContain("Telegram Anmeldung widerrufen");
    expect(page).toContain("Benutzername bearbeiten");
    expect(page).not.toContain("Änderung beim nächsten Login anfordern");
    expect(page).not.toContain("Änderungsfreigabe widerrufen");
  });

  it("shows Telegram linking CTA instead of signOut+signIn or a username form", () => {
    const page = read("src/pages/UsernameRequired.tsx");
    expect(page).toContain("Telegram Anmeldung erforderlich");
    expect(page).toContain("Mit Telegram anmelden");
    expect(page).toContain("bestehender PEPTIX Account");
    expect(page).toContain("applyTelegramReauthUsername");
    expect(page).toContain("startTelegramAccountLink");
    expect(page).toContain("userHasTelegramIdentity");
    const linkHandler = page.slice(page.indexOf("async function handleTelegramLink"), page.indexOf("async function handleConfirmTransfer"));
    expect(linkHandler).toContain("startTelegramAccountLink");
    expect(linkHandler).not.toMatch(/await\s+signOut\s*\(/);
    expect(page).not.toContain("Telegram Benutzername aktualisieren");
    expect(page).not.toContain("Neuer Telegram Benutzername");
  });

  it("exchanges OAuth codes even when a session already exists (linkIdentity)", () => {
    const auth = read("src/services/auth.ts");
    expect(auth).toContain("Always attempt exchange when a code is present");
    expect(auth).toContain("isIdentityAlreadyLinkedMessage");
    const callback = read("src/pages/AuthCallback.tsx");
    expect(callback).toContain("/username-required");
    expect(callback).not.toMatch(/supabase\.auth\.onAuthStateChange/);
  });

  it("keeps initial claim form for users without a username", () => {
    const dialog = read("src/components/auth/RequireUsernameDialog.tsx");
    expect(dialog).toContain("claimUsername");
    expect(dialog).toContain("preferred_username");
    expect(dialog).not.toContain("isUsernameChangeRequest");
    expect(dialog).not.toContain("Neuer Telegram Benutzername");
  });

  it("keeps profile read-only", () => {
    const profile = read("src/pages/Profile.tsx");
    expect(profile).toContain("kann nicht selbst geändert werden");
    expect(profile).not.toContain("claimUsername");
    expect(profile).not.toContain("applyTelegramReauthUsername");
    expect(profile).not.toContain("<Save");
  });
});
