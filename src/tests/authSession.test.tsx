import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const signIn = vi.fn();

const authValue = {
  session: null as { user: { id: string } } | null,
  user: null as { id: string } | null,
  loading: false,
  profile: null as { username: string | null } | null,
  roles: [] as string[],
  isAdmin: false,
  customerRoleName: null as string | null,
  refreshProfile: async () => {},
};

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => authValue,
}));

vi.mock("@/services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/auth")>();
  return {
    ...actual,
    signIn: (...args: unknown[]) => signIn(...args),
  };
});

const { default: LoginPage } = await import("@/pages/Login");
const { ProtectedRoute } = await import("@/routes/ProtectedRoute");
const { shouldPromptForUsername } = await import("@/services/username");
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");

const fakeSession = { user: { id: "user-1" } };

function renderAuthRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard ready</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("login session redirects", () => {
  beforeEach(() => {
    signIn.mockReset();
    authValue.session = null;
    authValue.user = null;
    authValue.loading = false;
  });

  it("navigates to the dashboard after a successful password sign-in once the session is present", async () => {
    const user = userEvent.setup();
    signIn.mockImplementation(async () => {
      authValue.session = fakeSession;
      authValue.user = fakeSession.user;
      return { session: fakeSession, user: fakeSession.user };
    });

    renderAuthRoutes("/login");
    await user.type(screen.getByLabelText("E-Mail-Adresse", { selector: "#email" }), "test@example.com");
    await user.type(screen.getByLabelText("Passwort", { selector: "#password" }), "secret");
    await user.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("test@example.com", "secret");
      expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
      expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
    });
  });

  it("does not bounce ProtectedRoute back to login when a session exists", () => {
    authValue.loading = false;
    authValue.session = fakeSession;
    renderAuthRoutes("/dashboard");
    expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-Mail-Adresse")).not.toBeInTheDocument();
  });

  it("redirects /login to the dashboard when a session already exists", async () => {
    authValue.loading = false;
    authValue.session = fakeSession;
    renderAuthRoutes("/login");
    await waitFor(() => {
      expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    });
  });

  it("keeps ProtectedRoute on the spinner while auth is loading", () => {
    authValue.loading = true;
    authValue.session = null;
    renderAuthRoutes("/dashboard");
    expect(screen.getByText("Wird geladen …")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-Mail-Adresse")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard ready")).not.toBeInTheDocument();
  });
});

describe("username prompt vs login redirect", () => {
  it("opens the username dialog when a profile has no username and does not send the user to /login", () => {
    expect(
      shouldPromptForUsername({
        loading: false,
        user: { id: "user-1" },
        profile: { username: null },
      }),
    ).toBe(true);

    const dialog = readFileSync(resolve(process.cwd(), "src/components/auth/RequireUsernameDialog.tsx"), "utf8");
    const provider = readFileSync(resolve(process.cwd(), "src/context/AuthProvider.tsx"), "utf8");
    expect(dialog).not.toMatch(/navigate\(\s*["']\/login["']/);
    expect(dialog).not.toMatch(/signOut/);
    expect(provider).not.toMatch(/await signOut\(\)/);
  });
});
