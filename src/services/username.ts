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
  if (/bereits vergeben/i.test(raw)) return "Dieser Telegram Benutzername ist bereits vergeben.";
  if (/Ungültiger (Telegram )?Benutzername/i.test(raw)) {
    return raw.includes("Telegram") ? raw : raw.replace("Benutzername", "Telegram Benutzername");
  }
  return raw || "Der Telegram Benutzername konnte nicht gespeichert werden.";
}

export function shouldPromptForUsername(input: {
  loading: boolean;
  user: { id: string } | null;
  profile: { username: string | null; username_required_on_next_login?: boolean } | null;
}): boolean {
  if (input.loading || !input.user || !input.profile) return false;
  if (input.profile.username_required_on_next_login) return true;
  return !input.profile.username;
}
