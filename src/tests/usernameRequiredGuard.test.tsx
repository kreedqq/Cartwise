import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const authValue = {
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
  user: { id: "user-1" } as { id: string } | null,
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
    authValue.user = { id: "user-1" };
    authValue.loading = false;
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: false };
  });

  it("lets users without the flag use the app", () => {
    renderGated("/dashboard");
    expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    expect(screen.queryByText("Username Pflichtseite")).not.toBeInTheDocument();
  });

  it("sends users with the flag to the Pflichtseite instead of the shop", () => {
    authValue.profile = { username: "ExampleUser", username_required_on_next_login: true };
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
