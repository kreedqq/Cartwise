import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/constants";

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export interface ValidatedImageFile {
  file: File;
  mime: (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
}

function extensionForMime(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export function sniffImageMime(bytes: ArrayBuffer): (typeof ALLOWED_IMAGE_MIME_TYPES)[number] | null {
  const view = new Uint8Array(bytes);
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (
    view.length >= 8 &&
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    view.length >= 12 &&
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46 &&
    view[8] === 0x57 &&
    view[9] === 0x45 &&
    view[10] === 0x42 &&
    view[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function isAllowedImageExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export async function validateImageFile(
  file: File,
  options: { maxBytes?: number; minWidth?: number; minHeight?: number } = {},
): Promise<ValidatedImageFile> {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_SIZE_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error("Die Bilddatei ist leer oder zu groß.");
  }
  if (!isAllowedImageExtension(file.name)) {
    throw new Error("Nur JPG, PNG oder WEBP sind erlaubt.");
  }
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    throw new Error("SVG-Dateien sind nicht erlaubt.");
  }
  const header = await file.slice(0, 16).arrayBuffer();
  const sniffed = sniffImageMime(header);
  if (!sniffed) {
    throw new Error("Die Datei ist kein gültiges Bild.");
  }
  if (file.type && file.type !== sniffed && !(file.type === "image/jpg" && sniffed === "image/jpeg")) {
    throw new Error("Dateityp und Inhalt stimmen nicht überein.");
  }
  const extension = extensionForMime(sniffed);
  if (!extension) throw new Error("Nur JPG, PNG oder WEBP sind erlaubt.");

  const dimensions = await readImageDimensions(file);
  if (dimensions.width < (options.minWidth ?? 200) || dimensions.height < (options.minHeight ?? 200)) {
    throw new Error("Das Bild ist zu klein.");
  }
  return { file, mime: sniffed, extension, width: dimensions.width, height: dimensions.height };
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Die Bilddatei ist beschädigt."));
        return;
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Die Bilddatei ist beschädigt."));
    };
    image.src = url;
  });
}

export function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
