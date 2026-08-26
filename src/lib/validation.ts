import { z } from "zod";
import { MAX_QUANTITY, MIN_QUANTITY, normalizeProductCode } from "@/lib/money";

/** Shared building blocks -------------------------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "E-Mail-Adresse wird benötigt.")
  .email("Bitte gib eine gültige E-Mail-Adresse ein.");

export const passwordSchema = z
  .string()
  .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.")
  .max(128, "Das Passwort ist zu lang.")
  .regex(/[A-Za-z]/, "Das Passwort muss mindestens einen Buchstaben enthalten.")
  .regex(/[0-9]/, "Das Passwort muss mindestens eine Zahl enthalten.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Anzeigenamen ein.")
  .max(80, "Der Anzeigename darf höchstens 80 Zeichen lang sein.");

export const productCodeSchema = z
  .string()
  .trim()
  .min(1, "Artikelcode wird benötigt.")
  .max(64, "Artikelcode ist zu lang.")
  .transform(normalizeProductCode);

export const quantitySchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const num = typeof value === "string" ? Number(value.replace(",", ".")) : value;
    if (typeof value === "string" && value.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Menge wird benötigt." });
      return z.NEVER;
    }
    if (!Number.isFinite(num)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Menge muss eine Zahl sein." });
      return z.NEVER;
    }
    return num;
  })
  .pipe(
    z
      .number()
      .positive("Menge muss größer als 0 sein.")
      .min(MIN_QUANTITY, "Menge ist zu klein.")
      .max(MAX_QUANTITY, `Menge darf höchstens ${MAX_QUANTITY.toLocaleString("de-DE")} betragen.`)
      .refine((v) => Math.round(v * 1000) === v * 1000, {
        message: "Menge darf höchstens 3 Nachkommastellen haben.",
      }),
  );

/** Auth forms --------------------------------------------------------------- */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    displayName: displayNameSchema,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const resetPasswordRequestSchema = z.object({ email: emailSchema });
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const magicLinkSchema = z.object({ email: emailSchema });
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const profileSchema = z.object({ displayName: displayNameSchema });
export type ProfileInput = z.infer<typeof profileSchema>;

/** Carts ---------------------------------------------------------------------- */

export const cartNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Namen für den Warenkorb ein.")
  .max(120, "Der Name darf höchstens 120 Zeichen lang sein.");

export const createCartSchema = z.object({
  name: cartNameSchema,
  note: z.string().max(2000).optional(),
});
export type CreateCartInput = z.infer<typeof createCartSchema>;

export const cartStatusSchema = z.enum(["draft", "ready", "ordered", "archived"]);

/** Cart items ----------------------------------------------------------------- */

export const cartItemInputSchema = z.object({
  productCodeInput: z
    .string()
    .trim()
    .min(1, "Artikelcode wird benötigt.")
    .max(64, "Artikelcode ist zu lang."),
  quantity: quantitySchema,
  note: z.string().max(500).optional(),
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

/**
 * Parses one line of pasted "Excel-style" bulk input: `CODE<tab or
 * whitespace>QUANTITY`, optionally comma-decimal. Returns null for lines
 * that cannot be parsed at all (blank lines), so the caller can filter them
 * out without treating them as errors.
 */
export interface ParsedPasteLine {
  raw: string;
  code: string | null;
  quantity: number | null;
  error: string | null;
}

export function parsePasteLine(line: string): ParsedPasteLine | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  // Split on tabs, 2+ spaces, or semicolons - NOT on a bare comma, since a
  // comma is also the European decimal separator (e.g. "2,5" = 2.5) and must
  // stay attached to the quantity token.
  const parts = trimmed.split(/\t+|\s{2,}|;/).map((p) => p.trim()).filter(Boolean);
  // Fallback: single-space separated "CODE QTY"
  const tokens = parts.length >= 2 ? parts : trimmed.split(/\s+/);

  if (tokens.length < 2) {
    return { raw: line, code: tokens[0] ?? null, quantity: null, error: "Menge fehlt." };
  }

  const code = tokens[0];
  const qtyRaw = tokens[tokens.length - 1].replace(",", ".");
  const quantity = Number(qtyRaw);

  if (!code) {
    return { raw: line, code: null, quantity: null, error: "Artikelcode fehlt." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { raw: line, code, quantity: null, error: "Menge ist ungültig." };
  }

  return { raw: line, code: normalizeProductCode(code), quantity, error: null };
}

/** Products (admin) ------------------------------------------------------------ */

export const productFormSchema = z.object({
  code: productCodeSchema,
  name: z.string().trim().min(1, "Name wird benötigt.").max(200),
  description: z.string().max(4000).optional().or(z.literal("")),
  category: z.string().max(120).optional().or(z.literal("")),
  priceUsd: z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const num = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Preis muss eine Zahl sein." });
        return z.NEVER;
      }
      return num;
    })
    .pipe(z.number().min(0, "Preis darf nicht negativ sein.").max(10_000_000, "Preis ist unplausibel hoch.")),
  isActive: z.boolean().default(true),
});
export type ProductFormInput = z.infer<typeof productFormSchema>;

/** PDF / CSV import rows -------------------------------------------------------- */

export const importRowEditSchema = z.object({
  parsedCode: z.string().trim().max(64).optional().or(z.literal("")),
  parsedName: z.string().trim().max(200).optional().or(z.literal("")),
  parsedPriceUsd: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === "") return null;
      const num = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(num) ? num : null;
    }),
  action: z.enum(["create", "update", "skip"]),
});
export type ImportRowEditInput = z.infer<typeof importRowEditSchema>;

/** Role management -------------------------------------------------------------- */

export const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
  grant: z.boolean(),
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;
