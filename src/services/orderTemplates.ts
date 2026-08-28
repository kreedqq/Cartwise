import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export interface OrderTemplateWithItems extends Tables<"order_templates"> {
  items: Tables<"order_template_items">[];
}

export async function listOrderTemplates(): Promise<OrderTemplateWithItems[]> {
  const { data: templates, error } = await supabase
    .from("order_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const ids = (templates ?? []).map((t) => t.id);
  if (ids.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("order_template_items")
    .select("*")
    .in("template_id", ids)
    .order("position", { ascending: true });
  if (itemsError) throw itemsError;

  const byTemplate = new Map<string, Tables<"order_template_items">[]>();
  for (const item of items ?? []) {
    const list = byTemplate.get(item.template_id) ?? [];
    list.push(item);
    byTemplate.set(item.template_id, list);
  }

  return (templates ?? []).map((t) => ({ ...t, items: byTemplate.get(t.id) ?? [] }));
}

export async function createOrderTemplate(
  userId: string,
  name: string,
  lines: { productCode: string; quantity: number }[],
): Promise<Tables<"order_templates">> {
  const { data, error } = await supabase
    .from("order_templates")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;

  if (lines.length > 0) {
    const { error: itemsError } = await supabase.from("order_template_items").insert(
      lines.map((line, index) => ({
        template_id: data.id,
        position: index,
        product_code: line.productCode,
        quantity: line.quantity,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return data;
}

export async function deleteOrderTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("order_templates").delete().eq("id", id);
  if (error) throw error;
}
