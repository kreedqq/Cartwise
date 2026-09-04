import { supabase } from "@/lib/supabaseClient";
import {
  normalizeTrackingNumber,
  resolveTrackingUrl,
  shouldSendTrackingNotification,
  type TrackingCarrierKey,
} from "@/lib/tracking";
import type { Tables } from "@/types/database";

export type TrackingEmailInvokeResult = {
  sent: boolean;
  reason?: "already_notified" | "no_email" | "not_configured" | "test" | "missing_number" | "ok";
  message?: string;
};

export async function upsertOrderTracking(input: {
  orderId: string;
  trackingNumber: string | null;
  trackingCarrier: TrackingCarrierKey | null;
  trackingUrl?: string | null;
}): Promise<Tables<"orders">> {
  const number = normalizeTrackingNumber(input.trackingNumber);
  const url = number
    ? resolveTrackingUrl({
        carrier: input.trackingCarrier,
        trackingNumber: number,
        customUrl: input.trackingUrl,
      })
    : null;
  const { data, error } = await supabase.rpc("upsert_order_tracking", {
    _order_id: input.orderId,
    _tracking_number: number,
    _tracking_carrier: number ? input.trackingCarrier : null,
    _tracking_url: url,
  });
  if (error) throw error;
  return data as Tables<"orders">;
}

export async function invokeTrackingEmail(
  orderId: string,
  options: { test?: boolean } = {},
): Promise<TrackingEmailInvokeResult> {
  const { data, error } = await supabase.functions.invoke<TrackingEmailInvokeResult>("send-tracking-email", {
    body: { orderId, test: Boolean(options.test) },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data ?? { sent: false };
}

export async function saveOrderTrackingAndNotify(input: {
  orderId: string;
  trackingNumber: string | null;
  trackingCarrier: TrackingCarrierKey | null;
  trackingUrl?: string | null;
  previous: {
    tracking_number?: string | null;
    tracking_notification_sent_at?: string | null;
  };
}): Promise<{ order: Tables<"orders">; email: TrackingEmailInvokeResult | null }> {
  const order = await upsertOrderTracking(input);
  if (!shouldSendTrackingNotification(input.previous, input.trackingNumber)) {
    return { order, email: null };
  }
  const email = await invokeTrackingEmail(input.orderId);
  return { order, email };
}

export { shouldSendTrackingNotification };
