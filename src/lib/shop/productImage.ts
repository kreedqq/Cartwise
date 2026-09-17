import type { CSSProperties } from "react";

import { PRODUCT_MEDIA_BUCKET } from "@/lib/constants";
import { publicMediaUrl } from "@/services/mediaStorage";

/** Public URL for a stored product hero image. */
export function productImageUrl(imagePath: string | null | undefined): string | null {
  return publicMediaUrl(PRODUCT_MEDIA_BUCKET, imagePath);
}

/** Stable accent hue (0–360) from product identity for placeholder atmosphere. */
export function productAccentHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function productAccentStyle(seed: string): { hue: number; css: CSSProperties } {
  const hue = productAccentHue(seed);
  return {
    hue,
    css: {
      ["--product-accent" as string]: `${hue} 72% 52%`,
      backgroundImage: `radial-gradient(ellipse 85% 70% at 50% 38%, hsl(${hue} 65% 42% / 0.35), transparent 68%), linear-gradient(180deg, hsl(var(--card) / 0.15) 0%, hsl(var(--background) / 0.4) 100%)`,
    },
  };
}
