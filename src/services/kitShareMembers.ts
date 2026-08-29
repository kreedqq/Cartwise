import { supabase } from "@/lib/supabaseClient";

export interface KitShareMember {
  id: string;
  displayName: string;
}

export async function listKitShareMembers(): Promise<KitShareMember[]> {
  const { data, error } = await supabase.rpc("list_kit_share_members");
  if (error) throw error;
  return (data ?? []).map((row: { id: string; display_name: string }) => ({
    id: row.id,
    displayName: row.display_name?.trim() || "Mitglied",
  }));
}
