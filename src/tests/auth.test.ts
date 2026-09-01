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
  mapAuthError,
  signInWithOAuth: startOAuth,
  resolveOAuthRedirectUrl,
  isSafeOAuthProviderUrl,
  isGoTrueAuthorizeUrl,
  isDiscordGoTrueAuthorizeUrl,
  beginOAuthRedirect,
  stripSkipHttpRedirect,
  readOAuthCallbackError,
  completeOAuthCallback,
  OAUTH_CALLBACK_PATH,
  POST_LOGIN_PATH,
  OAUTH_SUCCESS_PATH,
  OAUTH_PROVIDERS,
  safePostLoginPath,
} = await import("@/services/auth");

const AUTHORIZE = "https://example.supabase.co/auth/v1/authorize?provider=discord";
const DISCORD = "https://discord.com/api/oauth2/authorize?client_id=x";
const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x";
const APPLE = "https://appleid.apple.com/auth/authorize?client_id=x";

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

describe("OAuth URL safety", () => {
  it("allows only Discord identity hosts", () => {
    expect(isSafeOAuthProviderUrl(DISCORD)).toBe(true);
    expect(isSafeOAuthProviderUrl("https://discordapp.com/oauth2/authorize")).toBe(true);
    expect(isSafeOAuthProviderUrl("https://oauth.telegram.org/auth")).toBe(true);
    expect(isSafeOAuthProviderUrl(GOOGLE)).toBe(false);
    expect(isSafeOAuthProviderUrl(APPLE)).toBe(false);
    expect(isSafeOAuthProviderUrl(AUTHORIZE)).toBe(false);
    expect(isSafeOAuthProviderUrl("https://evil.example/authorize.json")).toBe(false);
    expect(isGoTrueAuthorizeUrl(AUTHORIZE)).toBe(true);
    expect(isGoTrueAuthorizeUrl(DISCORD)).toBe(false);
    expect(isDiscordGoTrueAuthorizeUrl(AUTHORIZE)).toBe(true);
  });

  it("never assigns a random JSON authorize URL to the window", () => {
    expect(() => beginOAuthRedirect("https://evil.example/authorize.json")).toThrow(/oauth_redirect_invalid/i);
  });
});

describe("OAuth client helpers", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({
      data: { url: AUTHORIZE, provider: "discord" },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds redirect URLs from the current origin plus the callback path", () => {
    const url = getRedirectUrl(OAUTH_CALLBACK_PATH);
    expect(url.startsWith(window.location.origin)).toBe(true);
    expect(url.endsWith("/auth/callback")).toBe(true);
  });

  it("builds the production callback from the peptix.app origin", () => {
    vi.stubGlobal("location", { origin: "https://peptix.app" });
    expect(getRedirectUrl(OAUTH_CALLBACK_PATH)).toBe("https://peptix.app/auth/callback");
  });

  it("does not hardcode localhost in the OAuth redirect helper", () => {
    const source = readFileSync(resolve(process.cwd(), "src/services/auth.ts"), "utf8");
    expect(source).toContain("window.location.origin");
    expect(source).not.toMatch(/redirectTo:\s*["'`]https?:\/\/localhost/i);
    expect(source).not.toMatch(/https?:\/\/localhost:\d+\/auth\/callback/);
  });

  it("only follows in-app return paths after login", () => {
    expect(safePostLoginPath({ pathname: "/shop" })).toBe("/shop");
    expect(safePostLoginPath({ pathname: "/carts/abc", search: "?x=1" })).toBe("/carts/abc?x=1");
    expect(safePostLoginPath({ pathname: "/login" })).toBe(POST_LOGIN_PATH);
    expect(safePostLoginPath({ pathname: "//evil.example" })).toBe(POST_LOGIN_PATH);
    expect(safePostLoginPath({ pathname: "https://evil.example" })).toBe(POST_LOGIN_PATH);
    expect(safePostLoginPath(null)).toBe(POST_LOGIN_PATH);
  });

  it("redirects Discord to discord.com when Location is readable, never as authorize.json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ url: DISCORD }));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth("discord", fetchImpl);

    const [payload] = signInWithOAuth.mock.calls[0] as [{ provider: string; options: Record<string, unknown> }];
    expect(payload.provider).toBe("discord");
    expect(payload.options.skipBrowserRedirect).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/admin|stammkunde|vip|kunde|role/i);
    expect(assign).toHaveBeenCalledWith(DISCORD);
    expect(assign.mock.calls.some((call) => String(call[0]).includes("/auth/v1/authorize"))).toBe(false);
  });

  it("document-navigates GoTrue authorize on a 302 when Location is hidden by CORS", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse("Found", 302, null));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth("discord", fetchImpl);
    expect(assign).toHaveBeenCalledWith(AUTHORIZE);
  });

  it("does not redirect when the provider is disabled (JSON error)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: "unsupported_provider", error_description: "Unsupported provider: provider is not enabled" },
        400,
      ),
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await expect(startOAuth("discord", fetchImpl)).rejects.toThrow(/not enabled/i);
    expect(assign).not.toHaveBeenCalled();
  });

  it("falls back to document navigation when the authorize probe fails (CORS / network)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth("discord", fetchImpl);
    expect(assign).toHaveBeenCalledWith(AUTHORIZE);
  });

  it("strips skip_http_redirect before navigating to GoTrue", async () => {
    const flagged = `${AUTHORIZE}&skip_http_redirect=true`;
    signInWithOAuth.mockResolvedValue({
      data: { url: flagged, provider: "discord" },
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse("Found", 302, null));
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: window.location.origin, assign });

    await startOAuth("discord", fetchImpl);
    expect(assign).toHaveBeenCalledTimes(1);
    const landed = String(assign.mock.calls[0][0]);
    expect(landed).not.toMatch(/skip_http_redirect/);
    expect(isDiscordGoTrueAuthorizeUrl(landed)).toBe(true);
    expect(stripSkipHttpRedirect(flagged)).not.toMatch(/skip_http_redirect/);
  });

  it("does not treat OAuth success as an admin landing page", () => {
    expect(POST_LOGIN_PATH).toBe("/dashboard");
    expect(OAUTH_SUCCESS_PATH).toBe("/shop");
    expect(OAUTH_PROVIDERS).toContain("discord");
    expect(OAUTH_PROVIDERS).toEqual(["discord", "custom:telegram"]);
  });
});

describe("resolveOAuthRedirectUrl", () => {
  it("follows a 302 Location to Discord", async () => {
    await expect(
      resolveOAuthRedirectUrl(AUTHORIZE, async () => jsonResponse({}, 302, DISCORD)),
    ).resolves.toBe(DISCORD);
  });

  it("uses document navigation when GoTrue 302s without exposing Location", async () => {
    await expect(
      resolveOAuthRedirectUrl(AUTHORIZE, async () => jsonResponse("Found", 302, null)),
    ).resolves.toBe(AUTHORIZE);
  });

  it("uses document navigation for CORS opaqueredirect", async () => {
    await expect(
      resolveOAuthRedirectUrl(AUTHORIZE, async () => ({
        status: 0,
        type: "opaqueredirect",
        headers: { get: () => null },
        text: async () => "",
      })),
    ).resolves.toBe(AUTHORIZE);
  });

  it("reads skip_http_redirect JSON url for Discord", async () => {
    await expect(
      resolveOAuthRedirectUrl(AUTHORIZE, async () => jsonResponse({ url: DISCORD })),
    ).resolves.toBe(DISCORD);
  });

  it("throws on JSON authorize errors so the browser never downloads authorize.json", async () => {
    await expect(
      resolveOAuthRedirectUrl(AUTHORIZE, async () =>
        jsonResponse({ msg: "Unsupported provider: provider is not enabled" }, 400),
      ),
    ).rejects.toThrow(/not enabled/i);
  });
});

describe("readOAuthCallbackError", () => {
  it("reads provider errors from the callback query string", () => {
    expect(readOAuthCallbackError("?error=access_denied&error_description=User+cancelled", "")).toMatch(/cancelled/i);
    expect(readOAuthCallbackError("", "#error=server_error")).toBe("server_error");
    expect(readOAuthCallbackError("", "")).toBeNull();
  });
});

describe("mapAuthError", () => {
  it("maps cancelled OAuth and provider failures to user-facing German copy", () => {
    expect(mapAuthError("access_denied")).toMatch(/abgebrochen/i);
    expect(mapAuthError("Unsupported provider: provider is not enabled")).toMatch(/Discord/i);
    expect(mapAuthError("identity_already_exists")).toMatch(/verknüpft/i);
    expect(mapAuthError("oauth error")).toMatch(/Anbieter/i);
    expect(mapAuthError("Invalid login credentials")).toMatch(/Passwort/i);
    expect(mapAuthError("Redirect URL not allowed")).toMatch(/Weiterleitungs-URL/i);
  });
});

describe("OAuth UI surface", () => {
  it("offers Discord and does not mention Google or Apple", () => {
    const buttons = readFileSync(resolve(process.cwd(), "src/components/auth/OAuthButtons.tsx"), "utf8");
    const login = readFileSync(resolve(process.cwd(), "src/pages/Login.tsx"), "utf8");
    const register = readFileSync(resolve(process.cwd(), "src/pages/Register.tsx"), "utf8");
    const combined = `${buttons}\n${login}\n${register}`;
    expect(combined).toMatch(/Mit Discord fortfahren/);
    expect(combined).toMatch(/Mit Telegram anmelden/);
    expect(combined).not.toMatch(/Mit Google fortfahren/);
    expect(combined).not.toMatch(/Mit Apple fortfahren/);
    expect(buttons).not.toMatch(/handleOAuth\("google"\)/);
    expect(buttons).not.toMatch(/handleOAuth\("apple"\)/);
  });

  it("keeps login free of marketing copy and duplicate Peptix headings", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/components/auth/AuthLayout.tsx"), "utf8");
    const login = readFileSync(resolve(process.cwd(), "src/pages/Login.tsx"), "utf8");
    const combined = `${layout}\n${login}`;
    expect(layout).toContain("peptix-brand.jpg");
    expect(layout.match(/peptix-brand\.jpg/g)?.length).toBe(1);
    expect(layout).not.toMatch(/<img/);
    expect(layout).toMatch(/bg-cover/);
    expect(layout).toMatch(/bg-no-repeat/);
    expect(layout).not.toMatch(/object-contain/);
    expect(layout).not.toMatch(/grid-cols-2/);
    expect(layout).toMatch(/w-\[360px\]/);
    expect(layout).toMatch(/lg:pr-\[5vw\]/);
    expect(layout).toMatch(/rgba\(8,8,8,0\.88\)/);
    expect(combined).not.toMatch(/Willkommen zurück/);
    expect(combined).not.toMatch(/Melde dich mit E-Mail an oder fahre mit Discord fort/);
    expect(combined).not.toMatch(/Geschützte Preise/);
    expect(combined).not.toMatch(/Der Katalog für professionellen Einkauf/);
    expect(combined).not.toMatch(/Willkommen bei/);
    expect(login).not.toMatch(/BrandMark/);
    expect(layout).not.toMatch(/BrandMark/);
  });

  it("sends OAuth users to /shop after PKCE callback", () => {
    const callback = readFileSync(resolve(process.cwd(), "src/pages/AuthCallback.tsx"), "utf8");
    expect(callback).toContain("OAUTH_SUCCESS_PATH");
    expect(callback).toContain("completeOAuthCallback");
    expect(OAUTH_SUCCESS_PATH).toBe("/shop");
  });
});

describe("completeOAuthCallback", () => {
  const session = { user: { id: "user-1" } };

  it("treats a successful code exchange as authenticated", async () => {
    const result = await completeOAuthCallback({
      href: "https://peptix.app/auth/callback?code=abc",
      search: "?code=abc",
      getSession: vi
        .fn()
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session }, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    });
    expect(result).toEqual({ status: "authenticated" });
  });

  it("keeps an existing session when the code exchange fails", async () => {
    const result = await completeOAuthCallback({
      href: "https://peptix.app/auth/callback?code=abc",
      search: "?code=abc",
      getSession: vi
        .fn()
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session }, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "invalid flow state" } }),
    });
    expect(result).toEqual({ status: "authenticated" });
  });

  it("fails to login only when exchange fails and no session exists", async () => {
    const result = await completeOAuthCallback({
      href: "https://peptix.app/auth/callback?code=abc",
      search: "?code=abc",
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "invalid flow state" } }),
    });
    expect(result).toEqual({ status: "failed", message: "invalid flow state" });
  });
});

describe("server-side default role for email and OAuth sign-ups", () => {
  it("handle_new_user still assigns user + default Kunde and never admin", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0019_customer_roles_and_selling_prices.sql"),
      "utf8",
    );
    expect(sql).toMatch(/create or replace function public\.handle_new_user\(\)/);
    expect(sql).toContain("values (new.id, 'user')");
    expect(sql).not.toMatch(/values \(new\.id, 'admin'\)/);
    expect(sql).toMatch(/from public\.customer_roles where is_default/);
    expect(sql).toContain("('Kunde', 25, true, true)");
  });

  it("does not change list_shop_products numeric(12,4) casts from 0021", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0021_fix_shop_product_rpc_types.sql"), "utf8");
    expect(sql).toContain("list_shop_products");
    expect(sql).toContain("numeric(12,4)");
  });
});
