import { describe, expect, it, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

const { signIn } = await import("@/services/auth");

const session = {
  user: { id: "user-1", email: "test@example.com" },
  access_token: "token",
  refresh_token: "refresh",
};

describe("signIn", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    getSession.mockReset();
  });

  it("returns the session from signInWithPassword when present", async () => {
    signInWithPassword.mockResolvedValue({ data: { session, user: session.user }, error: null });
    const result = await signIn("test@example.com", "secret");
    expect(result.session).toEqual(session);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to getSession when the password response omits the session", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null, user: session.user }, error: null });
    getSession.mockResolvedValue({ data: { session }, error: null });
    const result = await signIn("test@example.com", "secret");
    expect(result.session).toEqual(session);
  });

  it("throws when neither the password response nor getSession has a session", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(signIn("test@example.com", "secret")).rejects.toThrow(/session missing/);
  });
});
