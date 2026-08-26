import { describe, expect, it } from "vitest";

import { ConcurrencyError, toAppError } from "@/lib/errors";

describe("toAppError", () => {
  it("maps a Postgres unique-violation code to a helpful German message", () => {
    const result = toAppError({ code: "23505", message: "duplicate key value" });
    expect(result.message).toContain("existiert bereits");
    expect(result.retryable).toBe(false);
  });

  it("maps a missing-row / RLS-denied PostgREST code without leaking internals", () => {
    const result = toAppError({ code: "PGRST116" });
    expect(result.message).not.toContain("PGRST116");
    expect(result.message.toLowerCase()).toContain("berechtigung");
  });

  it("maps a 401/403 status to a session-expired message", () => {
    const result = toAppError({ status: 401 });
    expect(result.message.toLowerCase()).toContain("sitzung");
    expect(result.retryable).toBe(false);
  });

  it("falls back to a generic, retryable message for unknown errors", () => {
    const result = toAppError(new Error("some obscure internal detail"));
    expect(result.message).not.toContain("obscure internal detail");
    expect(result.retryable).toBe(true);
  });
});

describe("ConcurrencyError", () => {
  it("carries a helpful default message", () => {
    const error = new ConcurrencyError();
    expect(error.name).toBe("ConcurrencyError");
    expect(error.message.length).toBeGreaterThan(0);
  });
});
