import { z } from "zod";

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function requiredShippingText(emptyMessage: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, emptyMessage)
    .max(max, emptyMessage)
    .refine((value) => !hasControlChars(value), emptyMessage);
}

export const shippingAddressSchema = z.object({
  firstName: requiredShippingText("Bitte Vorname angeben.", 80),
  lastName: requiredShippingText("Bitte Nachname angeben.", 80),
  street: requiredShippingText("Bitte Straße angeben.", 120),
  houseNumber: requiredShippingText("Bitte Hausnummer angeben.", 20),
  addressExtra: z
    .string()
    .trim()
    .max(120, "Adresszusatz ist ungültig.")
    .refine((value) => !hasControlChars(value), "Adresszusatz ist ungültig.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  postalCode: requiredShippingText("Bitte PLZ angeben.", 16),
  city: requiredShippingText("Bitte Ort angeben.", 80),
  country: requiredShippingText("Bitte Land angeben.", 56),
});

export type ShippingAddressInput = z.input<typeof shippingAddressSchema>;
export type ShippingAddress = z.output<typeof shippingAddressSchema>;

export const EMPTY_SHIPPING_ADDRESS: ShippingAddressInput = {
  firstName: "",
  lastName: "",
  street: "",
  houseNumber: "",
  addressExtra: "",
  postalCode: "",
  city: "",
  country: "",
};

export interface OrderShippingSnapshot {
  telegram_username_snapshot?: string | null;
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_street?: string | null;
  shipping_house_number?: string | null;
  shipping_address_extra?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
}

export function formatShippingRecipient(snapshot: OrderShippingSnapshot): string | null {
  const name = [snapshot.shipping_first_name, snapshot.shipping_last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}

export function formatShippingAddressLines(snapshot: OrderShippingSnapshot): string[] {
  const street = [snapshot.shipping_street, snapshot.shipping_house_number]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const extra = snapshot.shipping_address_extra?.trim();
  const cityLine = [snapshot.shipping_postal_code, snapshot.shipping_city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const country = snapshot.shipping_country?.trim();
  return [street, extra, cityLine, country].filter((line): line is string => Boolean(line));
}

export function hasShippingSnapshot(snapshot: OrderShippingSnapshot): boolean {
  return Boolean(
    snapshot.shipping_first_name?.trim() &&
      snapshot.shipping_last_name?.trim() &&
      snapshot.shipping_street?.trim() &&
      snapshot.shipping_house_number?.trim() &&
      snapshot.shipping_postal_code?.trim() &&
      snapshot.shipping_city?.trim() &&
      snapshot.shipping_country?.trim(),
  );
}
