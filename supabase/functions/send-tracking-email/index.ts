import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildClients, requireAdmin } from "../_shared/auth.ts";

interface TrackingEmailBody {
  orderId?: string;
  test?: boolean;
}

const CARRIER_LABELS: Record<string, string> = {
  dhl: "DHL",
  dpd: "DPD",
  ups: "UPS",
  gls: "GLS",
  hermes: "Hermes",
  other: "Andere",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml(input: {
  name: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  logoUrl: string;
}): string {
  const button = input.trackingUrl
    ? `<a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;background:#c4a35a;color:#14110c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Sendung verfolgen</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#0b0b0b;color:#f5f1e8;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14110c;border:1px solid rgba(196,163,90,0.28);border-radius:18px;">
        <tr><td style="padding:28px;text-align:center;border-bottom:1px solid rgba(196,163,90,0.18);">
          <img src="${escapeHtml(input.logoUrl)}" alt="PEPTIX" width="132" style="max-width:160px;height:auto;" />
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4a35a;font-family:Arial,sans-serif;">Versandbestätigung</p>
          <h1 style="margin:0 0 18px;font-size:26px;color:#f7f1e3;">Ihre Bestellung wurde versendet</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#d9d1c3;">Hallo ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#cfc6b6;">Ihre Bestellung wurde versendet und kann ab sofort verfolgt werden.</p>
          <table role="presentation" width="100%" style="background:#1b1712;border:1px solid rgba(196,163,90,0.2);border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,sans-serif;">Bestellung</p>
              <p style="margin:0 0 14px;font-family:Consolas,monospace;font-size:16px;color:#f7f1e3;">${escapeHtml(input.orderNumber)}</p>
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,sans-serif;">Versanddienstleister</p>
              <p style="margin:0 0 14px;font-size:16px;color:#f7f1e3;">${escapeHtml(input.carrier)}</p>
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,sans-serif;">Sendungsnummer</p>
              <p style="margin:0;font-family:Consolas,monospace;font-size:16px;color:#f7f1e3;">${escapeHtml(input.trackingNumber)}</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;">${button}</p>
          <p style="margin:28px 0 0;font-size:14px;color:#b7ae9f;">Vielen Dank für Ihre Bestellung bei PEPTIX.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 }, origin);

  const { asUser, asService } = buildClients(req);
  const adminCheck = await requireAdmin(asUser);
  if (!adminCheck.ok) {
    return jsonResponse({ error: adminCheck.error }, { status: adminCheck.status }, origin);
  }

  let body: TrackingEmailBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Request-Body." }, { status: 400 }, origin);
  }

  const orderId = body.orderId?.trim();
  const test = body.test === true;
  if (!orderId) {
    return jsonResponse({ error: "orderId wird benötigt." }, { status: 400 }, origin);
  }

  const { data: order, error: orderError } = await asUser
    .from("orders")
    .select("id, order_number, user_id, telegram_username_snapshot, tracking_number, tracking_carrier, tracking_url, tracking_notification_sent_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("send-tracking-email order load failed:", orderError);
    return jsonResponse({ error: "Bestellung konnte nicht geladen werden." }, { status: 500 }, origin);
  }
  if (!order) {
    return jsonResponse({ error: "Bestellung wurde nicht gefunden." }, { status: 404 }, origin);
  }

  const trackingNumber = typeof order.tracking_number === "string" ? order.tracking_number.trim() : "";
  if (!trackingNumber) {
    return jsonResponse({ sent: false, reason: "missing_number", message: "Es ist keine Sendungsnummer gespeichert." }, { status: 200 }, origin);
  }

  if (!test && order.tracking_notification_sent_at) {
    return jsonResponse({ sent: false, reason: "already_notified" }, { status: 200 }, origin);
  }

  let recipient: string | null = null;
  if (test) {
    const { data: adminUser } = await asUser.auth.getUser();
    recipient = adminUser.user?.email?.trim() || null;
  } else if (order.user_id) {
    const { data: customer, error: customerError } = await asService.auth.admin.getUserById(order.user_id);
    if (customerError) {
      console.error("send-tracking-email customer lookup failed:", customerError);
    }
    recipient = customer?.user?.email?.trim() || null;
  }

  if (!recipient || !recipient.includes("@")) {
    return jsonResponse({
      sent: false,
      reason: "no_email",
      message: "Keine E-Mail-Adresse hinterlegt. Tracking-Benachrichtigung konnte nicht versendet werden.",
    }, { status: 200 }, origin);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      sent: false,
      reason: "not_configured",
      message: "E-Mail-Versand ist nicht konfiguriert.",
    }, { status: 200 }, origin);
  }

  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://peptix.app").replace(/\/$/, "");
  const from = Deno.env.get("RESEND_FROM") ?? "PEPTIX <noreply@peptix.app>";
  const name =
    (typeof order.telegram_username_snapshot === "string" && order.telegram_username_snapshot.trim()) ||
    "Kunde";
  const carrier = CARRIER_LABELS[String(order.tracking_carrier ?? "")] ?? "Versanddienstleister";
  const trackingUrl = typeof order.tracking_url === "string" && order.tracking_url.trim() ? order.tracking_url.trim() : null;
  const logoUrl = `${siteUrl}/peptix-logo.png`;
  const html = buildHtml({
    name,
    orderNumber: String(order.order_number),
    carrier,
    trackingNumber,
    trackingUrl,
    logoUrl,
  });
  const text = [
    `Hallo ${name},`,
    "",
    "Ihre Bestellung wurde versendet und kann ab sofort verfolgt werden.",
    "",
    `Bestellung: ${order.order_number}`,
    `Versanddienstleister: ${carrier}`,
    `Sendungsnummer: ${trackingNumber}`,
    trackingUrl ? `Sendung verfolgen: ${trackingUrl}` : "",
    "",
    "Vielen Dank für Ihre Bestellung bei PEPTIX.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Ihre Bestellung ${order.order_number} wurde versendet`,
      html,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    console.error("send-tracking-email resend failed:", resendResponse.status, detail);
    return jsonResponse({ error: "E-Mail konnte nicht versendet werden." }, { status: 502 }, origin);
  }

  if (!test) {
    const { error: markError } = await asUser.rpc("mark_order_tracking_notified", { _order_id: orderId });
    if (markError) {
      console.error("send-tracking-email mark failed:", markError);
    }
  }

  return jsonResponse({ sent: true, reason: test ? "test" : "ok" }, { status: 200 }, origin);
});
