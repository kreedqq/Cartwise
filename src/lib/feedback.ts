export const FEEDBACK_BODY_MIN = 10;
export const FEEDBACK_BODY_MAX = 2000;
export const FEEDBACK_PAGE_SIZE = 12;
export const FEEDBACK_DEFAULT_DISPLAY_NAME = "Verifizierter Kunde";
export const FEEDBACK_IMAGE_ASPECT = "4 / 3";
export const PUBLIC_FEEDBACK_STATUS = "approved";

export type FeedbackStatus = "pending" | "approved" | "rejected" | "hidden";

export function isPublicFeedbackStatus(status: string): boolean {
  return status === PUBLIC_FEEDBACK_STATUS;
}

export function validateFeedbackBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < FEEDBACK_BODY_MIN) {
    throw new Error(`Bitte mindestens ${FEEDBACK_BODY_MIN} Zeichen schreiben.`);
  }
  if (trimmed.length > FEEDBACK_BODY_MAX) {
    throw new Error(`Maximal ${FEEDBACK_BODY_MAX} Zeichen.`);
  }
  return trimmed;
}

export function validateFeedbackRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Bitte 1 bis 5 Sterne wählen.");
  }
  return rating;
}

export function publicDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return FEEDBACK_DEFAULT_DISPLAY_NAME;
  if (trimmed.includes("@") || trimmed.includes("http")) return FEEDBACK_DEFAULT_DISPLAY_NAME;
  return trimmed.slice(0, 40);
}

export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function ratingDistribution(ratings: number[]): Array<{ stars: number; count: number; percent: number }> {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const rating of ratings) {
    if (rating >= 1 && rating <= 5) counts[rating] += 1;
  }
  const total = ratings.length || 1;
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: counts[stars] ?? 0,
    percent: Math.round(((counts[stars] ?? 0) / total) * 100),
  }));
}

export function formatFeedbackMonth(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export function formatAverageRating(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function starCountLabel(rating: number): string {
  return `${rating} von 5 Sternen`;
}

export function eligibleOrdersForFeedback<T extends { id: string }>(
  orders: T[],
  existingByOrderId: Iterable<string>,
): T[] {
  const taken = new Set(existingByOrderId);
  return orders.filter((order) => !taken.has(order.id));
}

export function feedbackOrderChoiceLabel(orderNumber: string, statusLabel: string): string {
  const number = orderNumber.trim() || "Bestellung";
  const status = statusLabel.trim();
  return status ? `${number} · ${status}` : number;
}

export type AdminFeedbackFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "hidden"
  | "with_image"
  | "without_image"
  | "stars_5"
  | "stars_4"
  | "stars_3"
  | "stars_2"
  | "stars_1";

export function matchesAdminFeedbackFilter<T extends { status: string; image_path: string | null; rating: number }>(
  row: T,
  filter: AdminFeedbackFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "pending" || filter === "approved" || filter === "rejected" || filter === "hidden") {
    return row.status === filter;
  }
  if (filter === "with_image") return Boolean(row.image_path);
  if (filter === "without_image") return !row.image_path;
  const stars = Number(filter.slice("stars_".length));
  return row.rating === stars;
}
