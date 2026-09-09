import { describe, expect, it } from "vitest";

import {
  hasRequiredResearchConsent,
  RESEARCH_CONSENT_TYPE,
  RESEARCH_CONSENT_VERSION,
} from "@/lib/consent";
import { registerSchema } from "@/lib/validation";

describe("research consent", () => {
  const base = {
    email: "test@example.com",
    password: "supersecret1",
    passwordConfirm: "supersecret1",
    displayName: "Test Nutzer",
    username: "TestNutzer",
  };

  it("blocks registration without the required checkbox", () => {
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, researchConsent: false }).success).toBe(false);
  });

  it("allows registration with the required checkbox", () => {
    expect(registerSchema.safeParse({ ...base, researchConsent: true }).success).toBe(true);
  });

  it("requires the current consent version and accepted timestamp shape", () => {
    expect(
      hasRequiredResearchConsent([
        { consent_type: RESEARCH_CONSENT_TYPE, consent_version: RESEARCH_CONSENT_VERSION },
      ]),
    ).toBe(true);
    expect(hasRequiredResearchConsent([])).toBe(false);
    expect(
      hasRequiredResearchConsent([{ consent_type: RESEARCH_CONSENT_TYPE, consent_version: 0 }]),
    ).toBe(false);
    expect(
      hasRequiredResearchConsent([{ consent_type: RESEARCH_CONSENT_TYPE, consent_version: 1 }], 2),
    ).toBe(false);
  });
});
