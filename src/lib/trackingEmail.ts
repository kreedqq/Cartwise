import { trackingCarrierLabel } from "@/lib/tracking";

export const TRACKING_EMAIL_LOGO_PATH = "/peptix-logo.png";
export const TRACKING_EMAIL_SITE_URL = "https://peptix.app";

export interface TrackingEmailContent {
  customerName: string;
  orderNumber: string;
  carrier: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  logoUrl: string;
}

export function trackingEmailRecipientAllowed(email: string | null | undefined): boolean {
  const value = email?.trim() ?? "";
  return value.includes("@");
}

export function buildTrackingEmailSubject(orderNumber: string): string {
  return `Ihre Bestellung ${orderNumber} wurde versendet`;
}

export function buildTrackingEmailText(content: TrackingEmailContent): string {
  const carrier = trackingCarrierLabel(content.carrier);
  const lines = [
    `Hallo ${content.customerName},`,
    "",
    "Ihre Bestellung wurde versendet und kann ab sofort verfolgt werden.",
    "",
    `Bestellung: ${content.orderNumber}`,
    `Versanddienstleister: ${carrier}`,
    `Sendungsnummer: ${content.trackingNumber}`,
  ];
  if (content.trackingUrl) {
    lines.push("", `Sendung verfolgen: ${content.trackingUrl}`);
  }
  lines.push("", "Vielen Dank für Ihre Bestellung bei PEPTIX.");
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTrackingEmailHtml(content: TrackingEmailContent): string {
  const carrier = escapeHtml(trackingCarrierLabel(content.carrier));
  const name = escapeHtml(content.customerName);
  const orderNumber = escapeHtml(content.orderNumber);
  const trackingNumber = escapeHtml(content.trackingNumber);
  const logoUrl = escapeHtml(content.logoUrl);
  const button = content.trackingUrl
    ? `<tr>
        <td style="padding: 28px 0 8px;">
          <a href="${escapeHtml(content.trackingUrl)}" style="display:inline-block;background:#c4a35a;color:#14110c;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;padding:12px 22px;border-radius:10px;">
            Sendung verfolgen
          </a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ihre Bestellung wurde versendet</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0b;color:#f5f1e8;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14110c;border:1px solid rgba(196,163,90,0.28);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;border-bottom:1px solid rgba(196,163,90,0.18);">
              <img src="${logoUrl}" alt="PEPTIX" width="132" style="display:inline-block;max-width:160px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 32px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4a35a;font-family:Arial,Helvetica,sans-serif;">Versandbestätigung</p>
              <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#f7f1e3;font-weight:600;">Ihre Bestellung wurde versendet</h1>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#d9d1c3;">Hallo ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#cfc6b6;">Ihre Bestellung wurde versendet und kann ab sofort verfolgt werden.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1712;border:1px solid rgba(196,163,90,0.2);border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,Helvetica,sans-serif;">Bestellung</p>
                    <p style="margin:0;font-size:16px;font-family:Consolas,Monaco,monospace;color:#f7f1e3;">${orderNumber}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,Helvetica,sans-serif;">Versanddienstleister</p>
                    <p style="margin:0 0 14px;font-size:16px;color:#f7f1e3;">${carrier}</p>
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a35a;font-family:Arial,Helvetica,sans-serif;">Sendungsnummer</p>
                    <p style="margin:0;font-size:16px;font-family:Consolas,Monaco,monospace;color:#f7f1e3;">${trackingNumber}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${button}
              </table>
              <p style="margin:28px 0 0;font-size:14px;line-height:1.7;color:#b7ae9f;">Vielen Dank für Ihre Bestellung bei PEPTIX.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function trackingLogoUrl(siteUrl = TRACKING_EMAIL_SITE_URL): string {
  return `${siteUrl.replace(/\/$/, "")}${TRACKING_EMAIL_LOGO_PATH}`;
}
