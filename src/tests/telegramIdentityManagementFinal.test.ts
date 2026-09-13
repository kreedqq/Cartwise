import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  extractRpcErrorMessage,
  mapUsernameError,
  shouldPromptForUsername,
  markUsernameChangeEligible,
} from "@/services/username";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0080 telegram identity management final", () => {
  const sql = read("supabase/migrations/0080_telegram_identity_management_final.sql");

  it("keeps existing profiles.username on link apply and only adopts preferred when unset", () => {
    expect(sql).toContain("Existing PEPTIX username wins");
    expect(sql).toContain("Initial claim only: adopt preferred_username");
    expect(sql).toContain("admin_remove_telegram_identity");
    expect(sql).toContain("einzige Anmeldemethode dieses Kontos");
    expect(sql).not.toContain("0070_one_user_cart");
  });

  it("keeps target username on transfer when already set", () => {
    expect(sql).toContain("Keep existing target username");
    expect(sql).toContain("Adopt preferred only when target has none");
  });

  it("blocks telegram-only remove and transfer", () => {
    expect(sql).toContain("source_telegram_only");
    expect(sql).toContain("delete from auth.identities");
    expect(sql).toContain("provider = 'custom:telegram'");
  });
});

describe("username error extraction", () => {
  it("reads PostgREST plain-object messages instead of falling back to generic text", () => {
    expect(
      extractRpcErrorMessage({
        message: "Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.",
        code: "42501",
        details: null,
        hint: null,
      }),
    ).toMatch(/Bitte melde dich mit Telegram an/);

    expect(
      mapUsernameError({
        message: "",
        details: "Dieser Telegram Benutzername wird bereits verwendet.",
        hint: null,
      }),
    ).toMatch(/bereits verwendet/);

    expect(mapUsernameError({})).toBe("Der Telegram Benutzername konnte nicht zugewiesen werden.");
  });

  it("maps telegram-only remove protection", () => {
    expect(
      mapUsernameError(
        new Error(
          "Die Telegram Zuordnung kann nicht entfernt werden, solange sie die einzige Anmeldemethode dieses Kontos ist.",
        ),
      ),
    ).toMatch(/einzige Anmeldemethode/);
  });
});

describe("flow separation regressions", () => {
  it("never prompts overwrite when telegram already linked (Flow A)", () => {
    markUsernameChangeEligible("u1");
    expect(
      shouldPromptForUsername({
        loading: false,
        user: {
          id: "u1",
          identities: [{ provider: "email" }, { provider: "custom:telegram" }],
        },
        profile: { username: "Pepsidryage", username_required_on_next_login: true },
      }),
    ).toBe(false);
  });

  it("AuthCallback applies username only on link and routes failures back to gate", () => {
    const callback = read("src/pages/AuthCallback.tsx");
    expect(callback).toContain('flowKind === "link"');
    expect(callback).toContain('flowKind === "transfer"');
    expect(callback).toContain("post_link_failed");
    expect(callback).toContain('await finish("/username-required")');
    expect(callback).toContain("Stale transfer intent must never hijack");
  });

  it("admin UI shows remove when linked and force only when not linked", () => {
    const page = read("src/pages/admin/AdminUsers.tsx");
    expect(page).toContain("Telegram Zuordnung entfernen");
    expect(page).toContain("Telegram verbunden");
    expect(page).toContain("Telegram nicht verbunden");
    expect(page).toContain("adminRemoveTelegramIdentity");
    expect(page).toContain("Telegram Anmeldung beim nächsten Login erzwingen");
  });
});
