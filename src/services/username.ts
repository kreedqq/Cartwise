import { supabase } from "@/lib/supabaseClient";

/** Read-only availability probe. Never reveals who owns a taken username. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("username_available", { _username: username });
  if (error) throw error;
  return Boolean(data);
}

/** Claims a validated, unique username for the current user. Throws on duplicate/invalid input. */
export async function claimUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_username", { _username: username });
  if (error) throw error;
  return String(data);
}

export function mapUsernameError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/bereits vergeben/i.test(raw)) return "Dieser Benutzername ist bereits vergeben.";
  if (/Ungültiger Benutzername/i.test(raw)) return raw;
  return raw || "Der Benutzername konnte nicht gespeichert werden.";
}

export function shouldPromptForUsername(input: {
  loading: boolean;
  user: { id: string } | null;
  profile: { username: string | null } | null;
}): boolean {
  return Boolean(!input.loading && input.user && input.profile && !input.profile.username);
}
