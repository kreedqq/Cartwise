import { describe, expect, it } from "vitest";

import { readSupabaseConfig } from "@/lib/supabaseConfig";

const VALID_URL = "https://cnjrjinvxycdkrmzcime.supabase.co";
const VALID_KEY = "sb_publishable_AbCdEfGhIjKlMnOpQrStUv";

function problemsFor(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): string[] {
  const result = readSupabaseConfig(env);
  return result.ok ? [] : result.problems;
}

describe("readSupabaseConfig", () => {
  it("accepts a bare project URL and a publishable key", () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: VALID_URL,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(result).toEqual({ ok: true, url: VALID_URL, anonKey: VALID_KEY });
  });

  it("accepts a legacy anon JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature";
    const result = readSupabaseConfig({ VITE_SUPABASE_URL: VALID_URL, VITE_SUPABASE_ANON_KEY: jwt });

    expect(result.ok).toBe(true);
  });

  it("strips a trailing slash so no double slash reaches the API path", () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: `${VALID_URL}/`,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(result.ok && result.url).toBe(VALID_URL);
  });

  it("trims surrounding whitespace", () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: `  ${VALID_URL}  `,
      VITE_SUPABASE_ANON_KEY: `  ${VALID_KEY}  `,
    });

    expect(result).toEqual({ ok: true, url: VALID_URL, anonKey: VALID_KEY });
  });

  // This is the exact value that caused the production incident: the project
  // URL pasted as a Markdown link out of a rendered document. A substring
  // search for the project ref still succeeds, which is why it went unnoticed.
  it("rejects a URL pasted as a Markdown link", () => {
    const markdown = `[${VALID_URL}](${VALID_URL})`;
    const problems = problemsFor({
      VITE_SUPABASE_URL: markdown,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Markdown-Link");
    expect(markdown).toContain(VALID_URL); // the naive check that used to pass
  });

  it("rejects a quoted URL", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: `"${VALID_URL}"`,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems[0]).toContain("Anführungszeichen");
  });

  it("rejects a URL containing a line break", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: `https://cnjrjinvxycdkrmzcime\n.supabase.co`,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems[0]).toContain("Leerzeichen");
  });

  it("rejects a missing URL and a missing key, reporting both at once", () => {
    const problems = problemsFor({});

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("VITE_SUPABASE_URL ist nicht gesetzt");
    expect(problems[1]).toContain("VITE_SUPABASE_ANON_KEY ist nicht gesetzt");
  });

  it("rejects an empty string as not set", () => {
    expect(problemsFor({ VITE_SUPABASE_URL: "   ", VITE_SUPABASE_ANON_KEY: VALID_KEY })[0]).toContain(
      "nicht gesetzt",
    );
  });

  it("rejects a relative or non-absolute URL", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: "cnjrjinvxycdkrmzcime.supabase.co",
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems[0]).toContain("gültige absolute URL");
  });

  it("rejects a non-http protocol", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: "postgresql://db.supabase.co:5432/postgres",
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems[0]).toContain("https://");
  });

  it("rejects a URL with query parameters", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: `${VALID_URL}/?apikey=x`,
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(problems[0]).toContain("Query-Parameter");
  });

  it("rejects a pasted API endpoint instead of the project URL", () => {
    for (const path of ["/auth/v1", "/rest/v1", "/functions/v1", "/storage/v1"]) {
      const problems = problemsFor({
        VITE_SUPABASE_URL: `${VALID_URL}${path}`,
        VITE_SUPABASE_ANON_KEY: VALID_KEY,
      });

      expect(problems[0], path).toContain("API-Endpunkt");
    }
  });

  it("allows an unusual sub-path, which a self-hosted instance may legitimately use", () => {
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: "https://supabase.internal.example/instance-a",
      VITE_SUPABASE_ANON_KEY: VALID_KEY,
    });

    expect(result.ok).toBe(true);
  });

  it("refuses a secret key, which must never reach the browser", () => {
    expect(
      problemsFor({ VITE_SUPABASE_URL: VALID_URL, VITE_SUPABASE_ANON_KEY: "sb_secret_abcdef123456" })[0],
    ).toContain("Service-Role-Key");
  });

  it("refuses a service-role JWT by reading its role claim, not by substring", () => {
    const payload = btoa(JSON.stringify({ role: "service_role" }));
    const problems = problemsFor({
      VITE_SUPABASE_URL: VALID_URL,
      VITE_SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    });

    expect(problems[0]).toContain("Service-Role-Key");
  });

  it("still accepts an anon JWT whose payload is base64-encoded", () => {
    const payload = btoa(JSON.stringify({ role: "anon" }));
    const result = readSupabaseConfig({
      VITE_SUPABASE_URL: VALID_URL,
      VITE_SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a key pasted as a Markdown link", () => {
    const problems = problemsFor({
      VITE_SUPABASE_URL: VALID_URL,
      VITE_SUPABASE_ANON_KEY: `[${VALID_KEY}](${VALID_KEY})`,
    });

    expect(problems[0]).toContain("Markdown-Link");
  });
});
