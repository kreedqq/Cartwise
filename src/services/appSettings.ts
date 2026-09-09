import { supabase } from "@/lib/supabaseClient";
import { parseSiteAccessState, type SiteAccessState } from "@/lib/siteAccess";

export type AppSettingKey = "maintenance_mode" | "quantity_discounts_enabled";

export async function getSiteAccessState(): Promise<SiteAccessState> {
  const { data, error } = await supabase.rpc("get_site_access_state");
  if (error) throw error;
  const parsed = parseSiteAccessState(data);
  if (!parsed) throw new Error("Site-Status konnte nicht gelesen werden.");
  return parsed;
}

export async function adminSetAppSetting(key: AppSettingKey, value: boolean): Promise<SiteAccessState> {
  const { data, error } = await supabase.rpc("admin_set_app_setting", { _key: key, _value: value });
  if (error) throw error;
  const parsed = parseSiteAccessState(data);
  if (!parsed) throw new Error("Einstellung konnte nicht gespeichert werden.");
  return parsed;
}
