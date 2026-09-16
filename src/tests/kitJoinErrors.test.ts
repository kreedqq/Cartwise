import { describe, expect, it } from "vitest";

import { kitJoinUserMessage } from "@/lib/kit/kitJoinErrors";

describe("kitJoinUserMessage", () => {
  it("maps capacity errors", () => {
    expect(kitJoinUserMessage(new Error("Nicht genügend Vials verfügbar."), "x")).toContain(
      "nicht mehr verfügbar",
    );
  });

  it("maps full kit", () => {
    expect(kitJoinUserMessage(new Error("Kit ist vollständig"), "x")).toContain("vollständig");
  });
});
