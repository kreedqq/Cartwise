import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders the title/description and calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Warenkorb löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Endgültig löschen"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Warenkorb löschen?")).toBeInTheDocument();
    expect(screen.getByText(/kann nicht rückgängig gemacht werden/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog content when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Warenkorb löschen?"
        description="Text"
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText("Warenkorb löschen?")).not.toBeInTheDocument();
  });

  it("disables buttons and shows a loading label while loading", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Titel"
        description="Text"
        confirmLabel="Löschen"
        loading
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Wird ausgeführt …" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
  });
});
