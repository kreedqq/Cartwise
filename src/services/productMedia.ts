import { MAX_IMAGE_SIZE_BYTES, PRODUCT_MEDIA_BUCKET } from "@/lib/constants";
import { publicMediaUrl, removeStorageObject, uploadPrivateOrPublicImage } from "@/services/mediaStorage";

export function productMediaPublicUrl(path: string | null | undefined): string | null {
  return publicMediaUrl(PRODUCT_MEDIA_BUCKET, path);
}

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const safeExt = ext === "png" || ext === "webp" ? ext : "jpg";
  const path = `products/${productId}/hero.${safeExt}`;
  await uploadPrivateOrPublicImage({
    bucket: PRODUCT_MEDIA_BUCKET,
    path,
    file,
    maxBytes: MAX_IMAGE_SIZE_BYTES,
    minWidth: 320,
    minHeight: 320,
    upsert: true,
  });
  return path;
}

export async function deleteProductImage(path: string | null | undefined): Promise<void> {
  await removeStorageObject(PRODUCT_MEDIA_BUCKET, path);
}
