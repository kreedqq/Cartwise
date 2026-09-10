import { supabase } from "@/lib/supabaseClient";
import { validateImageFile } from "@/lib/mediaUpload";

export async function uploadPrivateOrPublicImage(input: {
  bucket: string;
  path: string;
  file: File;
  maxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  upsert?: boolean;
}): Promise<string> {
  const validated = await validateImageFile(input.file, {
    maxBytes: input.maxBytes,
    minWidth: input.minWidth,
    minHeight: input.minHeight,
  });
  const { error } = await supabase.storage.from(input.bucket).upload(input.path, validated.file, {
    upsert: input.upsert ?? false,
    contentType: validated.mime,
    cacheControl: "3600",
  });
  if (error) throw error;
  return input.path;
}

export async function removeStorageObject(bucket: string, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function publicMediaUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || null;
}

export async function signedMediaUrl(bucket: string, path: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
