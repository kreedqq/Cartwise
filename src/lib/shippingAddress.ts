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

export const DELIVERY_METHODS = ["home", "packstation"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  home: "Haustür Zustellung",
  packstation: "Paketstation",
};

export const DELIVERY_METHOD_REQUIRED_MESSAGE = "Bitte wählen Sie eine Lieferart aus.";

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
export type HomeShippingAddress = z.output<typeof shippingAddressSchema>;

const packstationAddressSchema = z.object({
  firstName: requiredShippingText("Bitte Vorname angeben.", 80),
  lastName: requiredShippingText("Bitte Nachname angeben.", 80),
  packstationNumber: requiredShippingText("Bitte Packstation Nummer angeben.", 20),
  postNumber: requiredShippingText("Bitte Postnummer angeben.", 20),
  postalCode: requiredShippingText("Bitte PLZ angeben.", 16),
  city: requiredShippingText("Bitte Ort angeben.", 80),
  country: requiredShippingText("Bitte Land angeben.", 56),
});

export const checkoutShippingSchema = z.discriminatedUnion("deliveryMethod", [
  shippingAddressSchema.extend({
    deliveryMethod: z.literal("home"),
  }),
  packstationAddressSchema.extend({
    deliveryMethod: z.literal("packstation"),
  }),
]);

export type CheckoutShipping = z.output<typeof checkoutShippingSchema>;
export type ShippingAddress = CheckoutShipping;

export interface CheckoutShippingForm {
  deliveryMethod: DeliveryMethod | "";
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  addressExtra: string;
  packstationNumber: string;
  postNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

export type CheckoutShippingField = keyof CheckoutShippingForm;

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

export const EMPTY_CHECKOUT_SHIPPING: CheckoutShippingForm = {
  deliveryMethod: "",
  firstName: "",
  lastName: "",
  street: "",
  houseNumber: "",
  addressExtra: "",
  packstationNumber: "",
  postNumber: "",
  postalCode: "",
  city: "",
  country: "",
};

export function parseCheckoutShipping(form: CheckoutShippingForm) {
  if (form.deliveryMethod !== "home" && form.deliveryMethod !== "packstation") {
    return {
      success: false as const,
      error: {
        fieldErrors: { deliveryMethod: DELIVERY_METHOD_REQUIRED_MESSAGE } as Partial<
          Record<CheckoutShippingField, string>
        >,
      },
    };
  }

  const result =
    form.deliveryMethod === "home"
      ? checkoutShippingSchema.safeParse({
          deliveryMethod: "home",
          firstName: form.firstName,
          lastName: form.lastName,
          street: form.street,
          houseNumber: form.houseNumber,
          addressExtra: form.addressExtra,
          postalCode: form.postalCode,
          city: form.city,
          country: form.country,
        })
      : checkoutShippingSchema.safeParse({
          deliveryMethod: "packstation",
          firstName: form.firstName,
          lastName: form.lastName,
          packstationNumber: form.packstationNumber,
          postNumber: form.postNumber,
          postalCode: form.postalCode,
          city: form.city,
          country: form.country,
        });

  if (!result.success) {
    const fieldErrors: Partial<Record<CheckoutShippingField, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as CheckoutShippingField] = issue.message;
      }
    }
    return { success: false as const, error: { fieldErrors } };
  }

  return { success: true as const, data: result.data };
}

export interface OrderShippingSnapshot {
  telegram_username_snapshot?: string | null;
  shipping_delivery_method?: string | null;
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_street?: string | null;
  shipping_house_number?: string | null;
  shipping_address_extra?: string | null;
  shipping_packstation_number?: string | null;
  shipping_post_number?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
}

export function formatDeliveryMethodLabel(method: string | null | undefined): string | null {
  if (method === "home" || method === "packstation") return DELIVERY_METHOD_LABELS[method];
  return null;
}

export function formatShippingRecipient(snapshot: OrderShippingSnapshot): string | null {
  const name = [snapshot.shipping_first_name, snapshot.shipping_last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}

export function formatShippingAddressLines(snapshot: OrderShippingSnapshot): string[] {
  if (snapshot.shipping_delivery_method === "packstation") {
    const packstation = snapshot.shipping_packstation_number?.trim();
    const postNumber = snapshot.shipping_post_number?.trim();
    const cityLine = [snapshot.shipping_postal_code, snapshot.shipping_city]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    const country = snapshot.shipping_country?.trim();
    return [
      packstation ? `Packstation ${packstation}` : null,
      postNumber ? `Postnummer ${postNumber}` : null,
      cityLine || null,
      country || null,
    ].filter((line): line is string => Boolean(line));
  }

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
  const identity = Boolean(
    snapshot.shipping_first_name?.trim() &&
      snapshot.shipping_last_name?.trim() &&
      snapshot.shipping_postal_code?.trim() &&
      snapshot.shipping_city?.trim() &&
      snapshot.shipping_country?.trim(),
  );
  if (snapshot.shipping_delivery_method === "packstation") {
    return Boolean(
      identity && snapshot.shipping_packstation_number?.trim() && snapshot.shipping_post_number?.trim(),
    );
  }
  return Boolean(identity && snapshot.shipping_street?.trim() && snapshot.shipping_house_number?.trim());
}
