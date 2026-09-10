import { FEEDBACK_MEDIA_BUCKET } from "@/lib/constants";
import { validateFeedbackBody, validateFeedbackRating } from "@/lib/feedback";
import { removeStorageObject, signedMediaUrl, uploadPrivateOrPublicImage } from "@/services/mediaStorage";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export type OrderFeedback = Tables<"order_feedback">;

export interface FeedbackInput {
  order_id: string;
  rating: number;
  body: string;
  image_consent: boolean;
  display_name?: string | null;
}

export async function listApprovedFeedback(page = 0, pageSize = 12): Promise<OrderFeedback[]> {
  const from = page * pageSize;
  const { data, error } = await supabase
    .from("order_feedback")
    .select("*")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return data ?? [];
}

export async function listApprovedFeedbackRatings(): Promise<number[]> {
  const { data, error } = await supabase.from("order_feedback").select("rating").eq("status", "approved");
  if (error) throw error;
  return (data ?? []).map((row) => row.rating);
}

export type AdminFeedbackRow = OrderFeedback & {
  orders?: { order_number: string; status: string } | null;
};

export async function listMyFeedback(): Promise<OrderFeedback[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("order_feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAdminFeedback(): Promise<AdminFeedbackRow[]> {
  const { data, error } = await supabase
    .from("order_feedback")
    .select("*, orders(order_number, status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminFeedbackRow[];
}

export async function createOrderFeedback(input: FeedbackInput & { imageFile?: File | null }): Promise<OrderFeedback> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Nicht angemeldet.");
  if (input.imageFile && !input.image_consent) {
    throw new Error("Bitte der Veröffentlichung des Fotos zustimmen.");
  }
  const { data, error } = await supabase
    .from("order_feedback")
    .insert({
      order_id: input.order_id,
      user_id: userId,
      rating: validateFeedbackRating(input.rating),
      body: validateFeedbackBody(input.body),
      image_consent: input.image_consent,
      display_name: input.display_name?.trim() || null,
      status: "pending",
      is_featured: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (!input.imageFile) return data;
  const path = await uploadFeedbackImage(userId, data.id, input.imageFile);
  await attachFeedbackImage(data.id, path, null);
  return { ...data, image_path: path, image_consent: true };
}

export async function updateMyFeedback(
  id: string,
  input: Partial<Pick<FeedbackInput, "rating" | "body" | "display_name" | "image_consent">>,
): Promise<OrderFeedback> {
  const patch: {
    rating?: number;
    body?: string;
    display_name?: string | null;
    image_consent?: boolean;
  } = {};
  if (input.rating != null) patch.rating = validateFeedbackRating(input.rating);
  if (input.body != null) patch.body = validateFeedbackBody(input.body);
  if (input.display_name !== undefined) patch.display_name = input.display_name?.trim() || null;
  if (input.image_consent != null) patch.image_consent = input.image_consent;
  const { data, error } = await supabase.from("order_feedback").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function adminUpdateFeedback(
  id: string,
  patch: Partial<Pick<OrderFeedback, "status" | "is_featured" | "body" | "display_name" | "image_path" | "rating">>,
): Promise<OrderFeedback> {
  const { data, error } = await supabase.from("order_feedback").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function adminDeleteFeedback(row: OrderFeedback): Promise<void> {
  const { error } = await supabase.from("order_feedback").delete().eq("id", row.id);
  if (error) throw error;
  await removeStorageObject(FEEDBACK_MEDIA_BUCKET, row.image_path).catch(() => undefined);
}

export async function uploadFeedbackImage(userId: string, feedbackId: string, file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith(".png") ? "png" : file.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  const path = `${userId}/${feedbackId}/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: FEEDBACK_MEDIA_BUCKET,
    path,
    file,
    minWidth: 400,
    minHeight: 300,
  });
}

export async function attachFeedbackImage(id: string, imagePath: string, previousPath: string | null): Promise<void> {
  const { error } = await supabase
    .from("order_feedback")
    .update({ image_path: imagePath, image_consent: true })
    .eq("id", id);
  if (error) {
    await removeStorageObject(FEEDBACK_MEDIA_BUCKET, imagePath).catch(() => undefined);
    throw error;
  }
  if (previousPath && previousPath !== imagePath) {
    await removeStorageObject(FEEDBACK_MEDIA_BUCKET, previousPath).catch(() => undefined);
  }
}

export async function adminRemoveFeedbackImage(row: OrderFeedback): Promise<void> {
  const { error } = await supabase.from("order_feedback").update({ image_path: null }).eq("id", row.id);
  if (error) throw error;
  await removeStorageObject(FEEDBACK_MEDIA_BUCKET, row.image_path).catch(() => undefined);
}

export async function feedbackImageUrl(path: string | null): Promise<string | null> {
  return signedMediaUrl(FEEDBACK_MEDIA_BUCKET, path);
}
