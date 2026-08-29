import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { legacyPublicLexiconCatalog } from "@/lib/peptide/lexicon";
import PeptideCalculatorPage from "@/pages/peptide/PeptideCalculator";
import PeptideLexiconDetailPage from "@/pages/peptide/PeptideLexiconDetail";

vi.mock("@/hooks/usePublicLexicon", () => ({
  usePublicLexicon: () => ({
    data: legacyPublicLexiconCatalog(),
    isLoading: false,
    isError: false,
  }),
}));

describe("Button", () => {
  it("renders a native button with its label", () => {
    render(<Button>Speichern</Button>);
    expect(screen.getByRole("button", { name: "Speichern" })).toBeEnabled();
  });

  it("disables a native button and exposes aria-busy while loading", () => {
    render(
      <Button loading type="submit">
        Senden
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Senden" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("honors disabled without loading", () => {
    render(<Button disabled>Gesperrt</Button>);
    expect(screen.getByRole("button", { name: "Gesperrt" })).toBeDisabled();
  });

  it("merges styles onto a router Link via asChild without throwing", () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <Link to="/peptide/lexikon">Zum Lexikon</Link>
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Zum Lexikon" });
    expect(link).toHaveAttribute("href", "/peptide/lexikon");
    expect(link).toHaveClass("bg-primary");
  });

  it("keeps a single slotted child when asChild and loading are combined", () => {
    render(
      <MemoryRouter>
        <Button asChild loading>
          <Link to="/login">Zur Anmeldung</Link>
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Zur Anmeldung" });
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("slots onto a native anchor", () => {
    render(
      <Button asChild variant="outline">
        <a href="/shop">Zum Shop</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Zum Shop" })).toHaveAttribute("href", "/shop");
  });
});

describe("peptide pages that use Button asChild", () => {
  it("renders the calculator including reconstitution tab without a Slot crash", async () => {
    const user = userEvent.setup();
    expect(() =>
      render(
        <MemoryRouter>
          <PeptideCalculatorPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
    expect(screen.getByRole("heading", { name: "Peptid Rechner" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rekonstitution" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vial-Inhalt")).toBeInTheDocument();
    const vialUnit = document.querySelector("#vial-unit");
    expect(vialUnit?.textContent).toContain("g");
    expect(vialUnit?.textContent).toContain("mg");
    expect(vialUnit?.textContent).toContain("mcg");
    expect(vialUnit?.textContent).toContain("ng");
    await user.click(screen.getByRole("tab", { name: "Konzentration" }));
    expect(screen.getByLabelText("Wirkstoffmenge")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Einheiten" }));
    expect(screen.getByLabelText("Menge")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Vial" }));
    expect(screen.getByLabelText("Vial-Inhalt (mg)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zum Lexikon" })).toHaveAttribute("href", "/peptide/lexikon");
  });

  it.each(["retatrutide", "tirzepatide", "semaglutide"] as const)(
    "renders lexicon detail for %s without a Slot crash",
    (slug) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      expect(() =>
        render(
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[`/peptide/lexikon/${slug}`]}>
              <Routes>
                <Route path="/peptide/lexikon/:slug" element={<PeptideLexiconDetailPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>,
        ),
      ).not.toThrow();
      expect(screen.getByRole("link", { name: "Im Rechner verwenden" })).toHaveAttribute(
        "href",
        expect.stringContaining("/peptide/rechner"),
      );
      expect(screen.getByRole("heading", { name: "Scientific Claims" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Mechanism" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Effects" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Side Effects / Safety" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Interactions" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Reconstitution" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Clinical Trials" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Claim Sources" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Source References" })).toBeInTheDocument();
    },
  );
});
