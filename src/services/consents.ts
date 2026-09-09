import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export async function hasCurrentResearchConsent(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_current_research_consent");
  if (error) throw error;
  return data === true;
}

export async function acceptResearchConsent(): Promise<Tables<"user_consents">> {
  const { data, error } = await supabase.rpc("accept_research_consent");
  if (error) throw error;
  if (!data) throw new Error("Zustimmung konnte nicht gespeichert werden.");
  return data;
}
