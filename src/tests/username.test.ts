import { describe, expect, it, vi, beforeEach } from "vitest";

import { usernameSchema, registerSchema } from "@/lib/validation";
import { shouldPromptForUsername } from "@/services/username";

const rpc = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

const { isUsernameAvailable, claimUsername, mapUsernameError } = await import("@/services/username");

describe("shouldPromptForUsername", () => {
  it("prompts only when auth is ready, a user exists, and username is missing", () => {
    expect(
      shouldPromptForUsername({ loading: false, user: { id: "u1" }, profile: { username: null } }),
    ).toBe(true);
    expect(
      shouldPromptForUsername({ loading: false, user: { id: "u1" }, profile: { username: "ExampleUser" } }),
    ).toBe(false);
    expect(shouldPromptForUsername({ loading: true, user: { id: "u1" }, profile: { username: null } })).toBe(false);
    expect(shouldPromptForUsername({ loading: false, user: null, profile: { username: null } })).toBe(false);
  });
});

describe("usernameSchema", () => {
  it("accepts a valid username", () => {
    expect(usernameSchema.safeParse("ExampleUser").success).toBe(true);
    expect(usernameSchema.safeParse("Lisa123").success).toBe(true);
    expect(usernameSchema.safeParse("Pep.Tix_1").success).toBe(true);
  });

  it("rejects usernames shorter than 3 characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects usernames longer than 24 characters", () => {
    expect(usernameSchema.safeParse("a".repeat(25)).success).toBe(false);
  });

  it("rejects a username that does not start with a letter", () => {
    expect(usernameSchema.safeParse("1Example").success).toBe(false);
    expect(usernameSchema.safeParse("_Example").success).toBe(false);
  });

  it("rejects dangerous / disallowed characters", () => {
    expect(usernameSchema.safeParse("Example<script>").success).toBe(false);
    expect(usernameSchema.safeParse("Example User").success).toBe(false);
    expect(usernameSchema.safeParse("Example'; DROP TABLE").success).toBe(false);
    expect(usernameSchema.safeParse("user@example.com").success).toBe(false);
  });
});

describe("registerSchema username integration", () => {
  const base = {
    email: "test@example.com",
    password: "supersecret1",
    passwordConfirm: "supersecret1",
    displayName: "Test Nutzer",
  };

  it("rejects registration without a valid username", () => {
    expect(registerSchema.safeParse({ ...base, username: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, username: "x" }).success).toBe(false);
  });

  it("accepts registration with a valid username", () => {
    expect(registerSchema.safeParse({ ...base, username: "TestNutzer" }).success).toBe(true);
  });
});

describe("username service", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("checks availability via RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const available = await isUsernameAvailable("ExampleUser");
    expect(rpc).toHaveBeenCalledWith("username_available", { _username: "ExampleUser" });
    expect(available).toBe(true);
  });

  it("claims a username via RPC", async () => {
    rpc.mockResolvedValue({ data: "ExampleUser", error: null });
    const claimed = await claimUsername("ExampleUser");
    expect(rpc).toHaveBeenCalledWith("set_username", { _username: "ExampleUser" });
    expect(claimed).toBe("ExampleUser");
  });

  it("rejects a duplicate username with a clear error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Dieser Benutzername ist bereits vergeben.", details: null, hint: null },
    });
    await expect(claimUsername("Lisa123")).rejects.toMatchObject({
      message: "Dieser Benutzername ist bereits vergeben.",
    });
  });

  it("maps duplicate-username errors to a stable user-facing message", () => {
    expect(mapUsernameError(new Error("Dieser Benutzername ist bereits vergeben."))).toBe(
      "Dieser Benutzername ist bereits vergeben.",
    );
  });
});
