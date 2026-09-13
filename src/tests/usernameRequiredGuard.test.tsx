import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clearUsernameChangeEligible,
  markUsernameChangeEligible,
  shouldPromptForUsername,
  usernameChangeEligibleKey,
} from "@/services/username";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const authValue = {
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
  user: { id: "user-1", identities: [{ provider: "email" }] } as {
    id: string;
    identities?: Array<{ provider?: string | null }>;
  } | null,
  loading: false,
  profile: { username: "ExampleUser", username_required_on_next_login: false } as {
    username: string | null;
    username_required_on_next_login?: boolean;
  } | null,
  roles: [] as string[],
  isAdmin: false,
  customerRoleName: null as string | null,
  refreshProfile: async () => {},
};

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => authValue,
}));

const { ProtectedRoute } = await import("@/routes/ProtectedRoute");
const { UsernameGate } = await import("@/routes/UsernameGate");

function renderGated(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/username-required" element={<div>Username Pflichtseite</div>} />
          <Route element={<UsernameGate />}>
            <Route path="/dashboard" element={<div>Dashboard ready</div>} />
            <Route path="/shop" element={<div>Shop ready</div>} />
            <Route path="/admin/users" element={<div>Admin users</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("username required login guard", () => {
  beforeEach(() => {
    authValue.session = { user: { id: "user-1" } };
    authValue.user = { id: "user-1", identities: [{ provider: "email" }] };
    authValue.loading = false;
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: false };
    clearUsernameChangeEligible("user-1");
  });

  it("lets users without the flag use the app", () => {
    renderGated("/dashboard");
    expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    expect(screen.queryByText("Username Pflichtseite")).not.toBeInTheDocument();
  });

  it("waits for profile before allowing access after login", () => {
    authValue.profile = null;
    renderGated("/dashboard");
    expect(screen.getByText("Konto wird geladen …")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard ready")).not.toBeInTheDocument();
  });

  it("does not force a change window while still logged in after admin request", () => {
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: true };
    renderGated("/shop");
    expect(screen.getByText("Shop ready")).toBeInTheDocument();
    expect(screen.queryByText("Username Pflichtseite")).not.toBeInTheDocument();
  });

  it("forces Telegram linking after fresh email login when flag is set and Telegram is missing", () => {
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: true };
    authValue.user = { id: "user-1", identities: [{ provider: "email" }] };
    markUsernameChangeEligible("user-1");
    renderGated("/shop");
    expect(screen.getByText("Username Pflichtseite")).toBeInTheDocument();
    expect(screen.queryByText("Shop ready")).not.toBeInTheDocument();
  });

  it("does not force Telegram gate when Telegram is already linked even if flag is set", () => {
    authValue.profile = { username: "Pepsidryage", username_required_on_next_login: true };
    authValue.user = {
      id: "user-1",
      identities: [{ provider: "email" }, { provider: "custom:telegram" }],
    };
    markUsernameChangeEligible("user-1");
    renderGated("/shop");
    expect(screen.getByText("Shop ready")).toBeInTheDocument();
    expect(screen.queryByText("Username Pflichtseite")).not.toBeInTheDocument();
  });

  it("shows the change window only after a fresh login marks the session eligible", () => {
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: true };
    markUsernameChangeEligible("user-1");
    renderGated("/shop");
    expect(screen.getByText("Username Pflichtseite")).toBeInTheDocument();
    expect(screen.queryByText("Shop ready")).not.toBeInTheDocument();
  });

  it("sends users without a username to the Pflichtseite even via a known protected URL", () => {
    authValue.profile = { username: null, username_required_on_next_login: false };
    renderGated("/admin/users");
    expect(screen.getByText("Username Pflichtseite")).toBeInTheDocument();
    expect(screen.queryByText("Admin users")).not.toBeInTheDocument();
  });

  it("keeps the Pflichtseite reachable while the condition is active", () => {
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: true };
    markUsernameChangeEligible("user-1");
    renderGated("/username-required");
    expect(screen.getByText("Username Pflichtseite")).toBeInTheDocument();
  });

  it("wires UsernameGate after ProtectedRoute and outside AppShell", () => {
    const app = readSource("src/App.tsx");
    const routes = app.slice(app.indexOf("<Routes>"));
    expect(app).toContain("UsernameGate");
    expect(app).toContain('path="/username-required"');
    expect(routes.indexOf('path="/username-required"')).toBeLessThan(routes.indexOf("<UsernameGate"));
    expect(routes.indexOf("<UsernameGate")).toBeLessThan(routes.indexOf("<AppShell"));
    expect(readSource("src/components/layout/AppShell.tsx")).not.toContain("RequireUsernameDialog");
  });
});

describe("shouldPromptForUsername next-login binding", () => {
  beforeEach(() => {
    clearUsernameChangeEligible("user-1");
  });

  it("always prompts when username is missing", () => {
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "user-1" },
        profile: { username: null, username_required_on_next_login: false },
      }),
    ).toBe(true);
  });

  it("ignores admin request until SIGNED_IN marks eligibility", () => {
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "user-1", identities: [{ provider: "email" }] },
        profile: { username: "Nullpzr", username_required_on_next_login: true },
      }),
    ).toBe(false);
    markUsernameChangeEligible("user-1");
    expect(sessionStorage.getItem(usernameChangeEligibleKey("user-1"))).toBe("1");
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "user-1", identities: [{ provider: "email" }] },
        profile: { username: "Nullpzr", username_required_on_next_login: true },
      }),
    ).toBe(true);
  });
});
