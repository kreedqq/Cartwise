import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { mapUsernameError } from "@/services/username";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0075 telegram username lock", () => {
  const sql = read("supabase/migrations/0075_telegram_username_lock.sql");

  it("locks client username mutation and provides admin direct edit", () => {
    expect(sql).toContain("protect_profile_username");
    expect(sql).toContain("profiles_protect_username");
    expect(sql).toContain("Dein Telegram Benutzername ist gesperrt");
    expect(sql).toContain("username_required_on_next_login");
    expect(sql).toContain("admin_set_username");
    expect(sql).toContain("Dieser Telegram Benutzername wird bereits verwendet.");
    expect(sql).toContain("for update");
    expect(sql).toContain("sync_cart_titles_for_user");
    expect(sql).not.toContain("0070_one_user_cart");
  });

  it("keeps admin next-login request on the existing flag", () => {
    expect(sql).toContain("username_required_on_next_login");
    expect(read("supabase/migrations/0046_username_required_and_admin_user_delete.sql")).toContain(
      "admin_set_username_required",
    );
  });
});

describe("username profile and admin UX", () => {
  it("makes profile read-only when a username exists", () => {
    const profile = read("src/pages/Profile.tsx");
    expect(profile).toContain("✓ Bestätigt");
    expect(profile).toContain("kann nicht selbst geändert werden");
    expect(profile).not.toContain("handleSave");
    expect(profile).not.toContain("claimUsername");
    expect(profile).not.toContain("<Save");
  });

  it("shows admin direct edit and Telegram reauth actions", () => {
    const page = read("src/pages/admin/AdminUsers.tsx");
    expect(page).toContain("Benutzername bearbeiten");
    expect(page).toContain("Benutzername festlegen");
    expect(page).toContain("Telegram Anmeldung beim nächsten Login erzwingen");
    expect(page).toContain("Telegram Anmeldung widerrufen");
    expect(page).toContain("adminSetUsername");
    expect(page).toContain("✓ Gesperrt");
  });

  it("binds the reauth gate to SIGNED_IN and applies Telegram identity server-side", () => {
    expect(read("src/context/AuthProvider.tsx")).toContain('event === "SIGNED_IN"');
    expect(read("src/context/AuthProvider.tsx")).toContain("markUsernameChangeEligible");
    expect(read("src/pages/AuthCallback.tsx")).toContain("applyTelegramReauthUsername");
    expect(read("src/pages/AuthCallback.tsx")).toContain("clearUsernameChangeEligible");
    expect(read("src/pages/UsernameRequired.tsx")).not.toContain("applyTelegramReauthUsername");
    expect(read("src/pages/UsernameRequired.tsx")).toContain("Telegram Anmeldung erforderlich");
  });

  it("maps lock and duplicate errors for users", () => {
    expect(mapUsernameError(new Error("Dieser Telegram Benutzername wird bereits verwendet."))).toBe(
      "Dieser Telegram Benutzername wird bereits verwendet.",
    );
    expect(mapUsernameError(new Error("Dein Telegram Benutzername ist gesperrt und kann nicht selbst geändert werden."))).toMatch(
      /gesperrt/i,
    );
  });
});
