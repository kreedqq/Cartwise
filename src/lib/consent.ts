export const RESEARCH_CONSENT_TYPE = "research_terms" as const;
export const RESEARCH_CONSENT_VERSION = 1;

export const RESEARCH_CONSENT_TEXT =
  "Ich bestätige, dass PEPTIX ausschließlich zu privaten Forschungs- und Informationszwecken genutzt wird. Mir ist bewusst, dass die Nutzung auf eigene Verantwortung erfolgt und PEPTIX keine Haftung für die Verwendung der bereitgestellten Informationen oder Produkte übernimmt.";

export interface ConsentRecord {
  user_id: string;
  consent_type: string;
  consent_version: number;
  accepted_at: string;
}

export function hasRequiredResearchConsent(
  records: Array<Pick<ConsentRecord, "consent_type" | "consent_version">>,
  requiredVersion = RESEARCH_CONSENT_VERSION,
): boolean {
  return records.some(
    (row) => row.consent_type === RESEARCH_CONSENT_TYPE && row.consent_version === requiredVersion,
  );
}
