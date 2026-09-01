import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));

const {
  getRedirectUrl,
  signInWithOAuth: startOAuth,
  isSafeOAuthProviderUrl,
  isDiscordGoTrueAuthorizeUrl,
  isEnabledGoTrueOAuthAuthorizeUrl,
  stripSkipHttpRedirect,
  OAUTH_CALLBACK_PATH,
  OAUTH_PROVIDERS,
  TELEGRAM_OAUTH_PROVIDER,
  TELEGRAM_OAUTH_SCOPES,
  DISCORD_OAUTH_PROVIDER,
} = await import("@/services/auth");

const TELEGRAM_AUTHORIZE = "https://example.supabase.co/auth/v1/authorize?provider=custom:telegram";
const TELEGRAM = "https://oauth.telegram.org/auth";
const DISCORD_AUTHORIZE = "https://example.supabase.co/auth/v1/authorize?provider=discord";
const DISCORD = "https://discord.com/api/oauth2/authorize?client_id=x";

function jsonResponse(body: unknown, status = 200, location: string | null = null) {
  return {
    status,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "location") return location;
        return "application/json";
      },
    },
    text: async () => JSON.stringify(body),
  };
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Telegram OAuth provider", () => {
  it("uses the dashboard Custom OIDC identifier custom:telegram", () => {
    expect(TELEGRAM_OAUTH_PROVIDER).toBe("custom:telegram");
    expect(OAUTH_PROVIDERS).toContain("custom:telegram");
    expect(OAUTH_PROVIDERS[0]).toBe(DISCORD_OAUTH_PROVIDER);
  });

  it("requests only openid and profile, never phone", () => {
    expect(TELEGRAM_OAUTH_SCOPES).toBe("openid profile");
    expect(TELEGRAM_OAUTH_SCOPES.split(/\s+/)).toEqual(["openid", "profile"]);
    expect(TELEGRAM_OAUTH_SCOPES).not.toMatch(/phone/i);
    const auth = readSource("src/services/auth.ts");
    expect(auth).not.toMatch(/scopes:\s*["'`][^"'`]*phone/i);
  });
});

describe("Telegram login", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({
      data: { url: TELEGRAM_AUTHORIZE, provider: TELEGRAM_OAUTH_PROVIDER },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls signInWithOAuth with custom:telegram and the existing auth callback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ url: TELEGRAM }));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth(TELEGRAM_OAUTH_PROVIDER, fetchImpl);

    const [payload] = signInWithOAuth.mock.calls[0] as [{ provider: string; options: Record<string, unknown> }];
    expect(payload.provider).toBe("custom:telegram");
    expect(payload.options.skipBrowserRedirect).toBe(true);
    expect(payload.options.redirectTo).toBe(getRedirectUrl(OAUTH_CALLBACK_PATH));
    expect(String(payload.options.redirectTo).endsWith("/auth/callback")).toBe(true);
    expect(payload.options.scopes).toBe("openid profile");
    expect(String(payload.options.scopes)).not.toMatch(/phone/i);
    expect(assign).toHaveBeenCalledWith(TELEGRAM);
  });

  it("does not require an email for Telegram sign-in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ url: TELEGRAM }));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth(TELEGRAM_OAUTH_PROVIDER, fetchImpl);

    const [payload] = signInWithOAuth.mock.calls[0] as [{ provider: string; options: Record<string, unknown> }];
    expect(payload).not.toHaveProperty("email");
    expect(JSON.stringify(payload)).not.toMatch(/@/);
    expect(assign).toHaveBeenCalled();
  });

  it("document-navigates Telegram GoTrue authorize when Location is hidden", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse("Found", 302, null));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth(TELEGRAM_OAUTH_PROVIDER, fetchImpl);
    expect(assign).toHaveBeenCalledWith(TELEGRAM_AUTHORIZE);
  });

  it("falls back to document navigation on CORS/network for Telegram", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth(TELEGRAM_OAUTH_PROVIDER, fetchImpl);
    expect(assign).toHaveBeenCalledWith(TELEGRAM_AUTHORIZE);
  });
});

describe("Telegram redirect safety", () => {
  it("allows oauth.telegram.org and keeps Google/Apple blocked", () => {
    expect(isSafeOAuthProviderUrl(TELEGRAM)).toBe(true);
    expect(isEnabledGoTrueOAuthAuthorizeUrl(TELEGRAM_AUTHORIZE)).toBe(true);
    expect(isDiscordGoTrueAuthorizeUrl(TELEGRAM_AUTHORIZE)).toBe(false);
    expect(isSafeOAuthProviderUrl("https://accounts.google.com/o/oauth2/v2/auth")).toBe(false);
    expect(isSafeOAuthProviderUrl("https://appleid.apple.com/auth/authorize")).toBe(false);
  });

  it("keeps the custom:telegram provider id literal after stripping skip_http_redirect", () => {
    const flagged = `${TELEGRAM_AUTHORIZE}&skip_http_redirect=true`;
    const stripped = stripSkipHttpRedirect(flagged);
    expect(stripped).toContain("provider=custom:telegram");
    expect(stripped).not.toMatch(/skip_http_redirect/);
    expect(stripped).not.toContain("custom%3Atelegram");
  });

  it("builds production callback from peptix.app origin, never a hardcoded localhost", () => {
    vi.stubGlobal("location", { origin: "https://peptix.app" });
    expect(getRedirectUrl(OAUTH_CALLBACK_PATH)).toBe("https://peptix.app/auth/callback");
    const auth = readSource("src/services/auth.ts");
    expect(auth).toContain("window.location.origin");
    expect(auth).not.toMatch(/redirectTo:\s*["'`]https?:\/\/localhost/i);
    expect(auth).not.toMatch(/https?:\/\/localhost:\d+\/auth\/callback/);
    vi.unstubAllGlobals();
  });
});

describe("Discord login remains unchanged", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({
      data: { url: DISCORD_AUTHORIZE, provider: "discord" },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still signs in with discord and skipBrowserRedirect, without Telegram scopes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ url: DISCORD }));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth("discord", fetchImpl);

    const [payload] = signInWithOAuth.mock.calls[0] as [{ provider: string; options: Record<string, unknown> }];
    expect(payload.provider).toBe("discord");
    expect(payload.options.skipBrowserRedirect).toBe(true);
    expect(payload.options.redirectTo).toBe(getRedirectUrl(OAUTH_CALLBACK_PATH));
    expect(payload.options).not.toHaveProperty("scopes");
    expect(assign).toHaveBeenCalledWith(DISCORD);
  });
});

describe("Telegram identity without insecure merge", () => {
  it("does not look up or take over accounts by Telegram username or email", () => {
    const auth = readSource("src/services/auth.ts");
    const username = readSource("src/services/username.ts");
    const combined = `${auth}\n${username}`;
    expect(combined).not.toMatch(/from\(["'`]profiles["'`]\).*username/i);
    expect(combined).not.toMatch(/SELECT\s+.*profiles.*username/i);
    expect(combined).not.toMatch(/linkIdentity|mergeAccount|mergeUser/i);
    expect(auth).not.toMatch(/preferred_username/);
  });

  it("does not invent an email or use the Telegram handle as email", () => {
    const auth = readSource("src/services/auth.ts");
    expect(auth).not.toMatch(/@t\.me/i);
    expect(auth).not.toMatch(/email:\s*.*preferred_username/i);
    expect(TELEGRAM_OAUTH_SCOPES).not.toMatch(/phone/i);
  });

  it("keeps profiles.username as the canonical public handle after Telegram login", () => {
    const dialog = readSource("src/components/auth/RequireUsernameDialog.tsx");
    const usernameService = readSource("src/services/username.ts");
    expect(dialog).toContain("shouldPromptForUsername");
    expect(dialog).toContain("claimUsername");
    expect(dialog).toContain("preferred_username");
    expect(dialog).not.toMatch(/email\?\.split/);
    expect(dialog).not.toMatch(/user\.email/);
    expect(usernameService).toContain("set_username");
    expect(usernameService).toContain("shouldPromptForUsername");
  });

  it("keeps email/password login and the existing callback route", () => {
    const login = readSource("src/pages/Login.tsx");
    const callback = readSource("src/pages/AuthCallback.tsx");
    expect(login).toContain('import { OAuthButtons } from "@/components/auth/OAuthButtons"');
    expect(login).toContain("signIn");
    expect(login).toContain("Anmelden");
    expect(callback).toContain("completeOAuthCallback");
  });

  it("does not put client secrets, bot tokens, or session tokens in frontend auth code", () => {
    const auth = readSource("src/services/auth.ts");
    const buttons = readSource("src/components/auth/OAuthButtons.tsx");
    const combined = `${auth}\n${buttons}`;
    expect(combined).not.toMatch(/client_secret/i);
    expect(combined).not.toMatch(/bot.?token/i);
    expect(combined).not.toMatch(/console\.(log|debug|info).*access_token/i);
  });
});
