import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0062 user consents", () => {
  it("stores versioned consent rows and blocks foreign writes", () => {
    const sql = read("supabase/migrations/0062_user_consents.sql");
    expect(sql).toContain("consent_type");
    expect(sql).toContain("consent_version");
    expect(sql).toContain("accepted_at");
    expect(sql).toContain("user_consents_insert_own");
    expect(sql).toContain("with check (user_id = auth.uid())");
    expect(sql).toContain("accept_research_consent");
    expect(sql).toContain("required_research_consent_version");
    expect(sql).toContain("has_current_research_consent");
    expect(sql).not.toMatch(/create policy user_consents_update/);
    expect(sql).not.toMatch(/drop table/i);
  });
});
