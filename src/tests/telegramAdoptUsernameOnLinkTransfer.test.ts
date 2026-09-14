import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shouldPromptForUsername, markUsernameChangeEligible } from "@/services/username";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0083/0084 link/transfer adopt telegram username", () => {
  const sql = read("supabase/migrations/0084_link_transfer_adopt_telegram_username.sql");

  it("sets target username from preferred_username on link and transfer", () => {
    expect(sql).toContain("apply_telegram_reauth_username");
    expect(sql).toContain("complete_telegram_identity_transfer");
    expect(sql).toContain("preferred_username");
    expect(sql).toContain("Target username := verified Telegram preferred_username");
    expect(sql).toContain("Validate preferred_username BEFORE moving identity");
    expect(sql).toContain("duplicate_username");
    expect(sql).not.toContain("Existing PEPTIX username wins");
    expect(sql).not.toContain("Keep existing target username");
  });

  it("does not change source username and never uses display name claims", () => {
    expect(sql).toContain("Source profiles.username untouched");
    expect(sql).toMatch(/identity_data->>'preferred_username'/);
    expect(sql).not.toMatch(/identity_data->>'name'/);
    expect(sql).not.toMatch(/identity_data->>'display_name'/);
  });
});

describe("normal login must not overwrite username", () => {
  it("skips username gate when telegram already linked", () => {
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

  it("AuthCallback applies username only on link, never on login", () => {
    const callback = read("src/pages/AuthCallback.tsx");
    expect(callback).toContain('flowKind === "link"');
    expect(callback).toContain("applyTelegramReauthUsername");
    expect(callback).toContain('flowKind === "transfer"');
    expect(callback).toContain("Never run this on Flow A normal login");
  });
});
