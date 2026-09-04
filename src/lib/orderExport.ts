import { formatDateTime, formatMoney, formatUsd, GRAND_TOTAL_LABEL, SHIPPING_LABEL_CHINA, SHIPPING_LABEL_GERMANY, summarizeOrderCharges } from "@/lib/money";
import { downloadCsv } from "@/services/csvProducts";
import { ORDER_STATUS_LABELS } from "@/services/orders";
import { BRAND_NAME } from "@/lib/constants";
import { cartItemDisplayName, cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";
import { formatOrderItemQuantity } from "@/lib/quantityFormat";
import { formatShippingAddressLines, formatShippingRecipient, formatDeliveryMethodLabel, hasShippingSnapshot } from "@/lib/shippingAddress";
import type { OrderStatus, Tables } from "@/types/database";

export interface OrderExportLine {
  product_code_snapshot: string;
  product_name_snapshot: string;
  dosage_vial_snapshot: string | null;
  quantity: number;
  quantityLabel: string;
  applied_price_tier: "normal" | "bulk";
  unit_price_usd_snapshot: number;
  line_total_usd: number;
  eur_value_snapshot: number | null;
  normal_price_usd_snapshot: number;
  bulk_price_usd_snapshot: number | null;
}

export interface OrderExportDoc {
  order_number: string;
  status: OrderStatus;
  submitted_at: string;
  note: string | null;
  total_usd: number;
  total_eur: number | null;
  exchange_rate: number | null;
  customerLabel?: string;
  customerEmail?: string | null;
  telegramUsername?: string | null;
  deliveryMethodLabel?: string | null;
  shippingRecipient?: string | null;
  shippingLines?: string[];
  china_shipping_amount?: number | null;
  china_shipping_currency?: string | null;
  de_shipping_amount?: number | null;
  de_shipping_currency?: string | null;
  catalogSubtotalUsd?: number | null;
  roleSurchargeUsd?: number | null;
  roleSurchargeUnavailable?: boolean;
  items: OrderExportLine[];
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildOrderCsv(doc: OrderExportDoc): string {
  const header = [
    "Bestellnummer",
    "Status",
    "Datum",
    "Telegram Benutzername",
    "Lieferart",
    "Lieferadresse",
    "Code",
    "Name",
    "Dosage",
    "Menge",
    "Preisart",
    "Einzelpreis USD",
    "Gesamt USD",
    "Gesamt EUR",
  ];
  const rows = doc.items.map((item) =>
    [
      doc.order_number,
      ORDER_STATUS_LABELS[doc.status],
      formatDateTime(doc.submitted_at),
      doc.telegramUsername ?? "",
      doc.deliveryMethodLabel ?? "",
      [doc.shippingRecipient, ...(doc.shippingLines ?? [])].filter(Boolean).join(", "),
      item.product_code_snapshot,
      item.product_name_snapshot,
      cartItemVariantSubtitle(item) ?? item.dosage_vial_snapshot ?? "",
      item.quantityLabel,
      item.applied_price_tier === "bulk" ? "Mengenpreis" : "Normalpreis",
      item.unit_price_usd_snapshot,
      item.line_total_usd,
      item.eur_value_snapshot ?? "",
    ]
      .map(csvEscape)
      .join(";"),
  );
  const charges = summarizeOrderCharges({
    productUsd: doc.total_usd,
    productEur: doc.total_eur,
    chinaAmount: doc.china_shipping_amount,
    chinaCurrency: doc.china_shipping_currency,
    deAmount: doc.de_shipping_amount,
    deCurrency: doc.de_shipping_currency,
    usdToEurRate: doc.exchange_rate,
  });
  const summary = [
    "",
    doc.catalogSubtotalUsd != null && doc.roleSurchargeUsd != null
      ? ["Zwischensumme USD", doc.catalogSubtotalUsd].map(csvEscape).join(";")
      : "",
    doc.roleSurchargeUsd != null ? ["Rollenaufschlag USD", doc.roleSurchargeUsd].map(csvEscape).join(";") : "",
    doc.roleSurchargeUnavailable ? ["Rollenaufschlag", "nicht verfügbar"].map(csvEscape).join(";") : "",
    ["Produktsumme USD", doc.total_usd].map(csvEscape).join(";"),
    [SHIPPING_LABEL_CHINA, doc.china_shipping_amount ?? "", doc.china_shipping_currency ?? ""].map(csvEscape).join(";"),
    [SHIPPING_LABEL_GERMANY, doc.de_shipping_amount ?? "", doc.de_shipping_currency ?? ""].map(csvEscape).join(";"),
    [GRAND_TOTAL_LABEL, charges.grandDisplay].map(csvEscape).join(";"),
  ].filter(Boolean);
  return [header.join(";"), ...rows, ...summary].join("\n");
}

export function buildOrdersListCsv(
  orders: Array<{
    order_number: string;
    status: OrderStatus;
    submitted_at: string;
    total_usd: number;
    total_eur: number | null;
    customerLabel: string;
    telegramUsername?: string | null;
    deliveryMethodLabel?: string | null;
    china_shipping_amount?: number | null;
    china_shipping_currency?: string | null;
    de_shipping_amount?: number | null;
    de_shipping_currency?: string | null;
    exchange_rate?: number | null;
  }>,
): string {
  const header = [
    "Bestellnummer",
    "Kunde",
    "Telegram Benutzername",
    "Datum",
    "Status",
    "Lieferart",
    "Produktsumme USD",
    "Produktsumme EUR",
    SHIPPING_LABEL_CHINA,
    "Währung China",
    SHIPPING_LABEL_GERMANY,
    "Währung Deutschland",
    GRAND_TOTAL_LABEL,
  ];
  const rows = orders.map((order) => {
    const charges = summarizeOrderCharges({
      productUsd: order.total_usd,
      productEur: order.total_eur,
      chinaAmount: order.china_shipping_amount,
      chinaCurrency: order.china_shipping_currency,
      deAmount: order.de_shipping_amount,
      deCurrency: order.de_shipping_currency,
      usdToEurRate: order.exchange_rate,
    });
    return [
      order.order_number,
      order.customerLabel,
      order.telegramUsername ?? "",
      formatDateTime(order.submitted_at),
      ORDER_STATUS_LABELS[order.status],
      order.deliveryMethodLabel ?? "",
      order.total_usd,
      order.total_eur ?? "",
      order.china_shipping_amount ?? "",
      order.china_shipping_currency ?? "",
      order.de_shipping_amount ?? "",
      order.de_shipping_currency ?? "",
      charges.grandDisplay,
    ]
      .map(csvEscape)
      .join(";");
  });
  return [header.join(";"), ...rows].join("\n");
}

export function buildAdminOrderItemsCsv(
  rows: Array<{
    order_number: string;
    submitted_at: string;
    telegramUsername: string | null;
    productCode: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
    lineTotalUsd: number;
    deliveryMethodLabel: string | null;
    roleSurchargeUsd: number | null;
    orderTotalUsd: number;
  }>,
): string {
  const header = [
    "Bestellnummer",
    "Datum",
    "Telegram Benutzername",
    "Artikel Code",
    "Produktname",
    "Menge",
    "Stückpreis",
    "Gesamtpreis",
    "Lieferart",
    "Rollenaufschlag",
    "Gesamt",
  ];
  const body = rows.map((row) =>
    [
      row.order_number,
      formatDateTime(row.submitted_at),
      row.telegramUsername ?? "",
      row.productCode,
      row.productName,
      formatOrderItemQuantity({
        quantity: row.quantity,
        product_name_snapshot: row.productName,
        product_code_snapshot: row.productCode,
      }),
      row.unitPriceUsd,
      row.lineTotalUsd,
      row.deliveryMethodLabel ?? "",
      row.roleSurchargeUsd ?? "",
      row.orderTotalUsd,
    ]
      .map(csvEscape)
      .join(";"),
  );
  return [header.join(";"), ...body].join("\n");
}

export function downloadOrderCsv(doc: OrderExportDoc): void {
  downloadCsv(`${doc.order_number}.csv`, buildOrderCsv(doc));
}

export function downloadOrdersListCsv(filename: string, csv: string): void {
  downloadCsv(filename, csv);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML for the Bestellzusammenfassung print window / PDF. */
export function buildOrderPrintHtml(doc: OrderExportDoc): string {
  const rows = doc.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.product_code_snapshot)}</td>
        <td>${escapeHtml(cartItemDisplayName(item))}${(() => {
          const variant = cartItemVariantSubtitle(item);
          return variant ? `<br><span class="muted">${escapeHtml(variant)}</span>` : "";
        })()}</td>
        <td class="num">${escapeHtml(item.quantityLabel)}</td>
        <td class="num">${escapeHtml(formatUsd(item.unit_price_usd_snapshot))}</td>
        <td class="num">${escapeHtml(formatUsd(item.line_total_usd))}</td>
      </tr>`,
    )
    .join("");

  const charges = summarizeOrderCharges({
    productUsd: doc.total_usd,
    productEur: doc.total_eur,
    chinaAmount: doc.china_shipping_amount,
    chinaCurrency: doc.china_shipping_currency,
    deAmount: doc.de_shipping_amount,
    deCurrency: doc.de_shipping_currency,
    usdToEurRate: doc.exchange_rate,
  });
  const surchargeBlock =
    doc.catalogSubtotalUsd != null && doc.roleSurchargeUsd != null
      ? `<div>Zwischensumme: ${escapeHtml(formatUsd(doc.catalogSubtotalUsd))}</div>
    <div>Rollenaufschlag: ${escapeHtml(formatUsd(doc.roleSurchargeUsd))}</div>`
      : doc.roleSurchargeUnavailable
        ? `<div>Rollenaufschlag nicht verfügbar</div>`
        : "";
  const addressHtml =
    doc.shippingRecipient || (doc.shippingLines && doc.shippingLines.length > 0)
      ? `<p>Lieferadresse<br>${doc.shippingRecipient ? `<strong>${escapeHtml(doc.shippingRecipient)}</strong><br>` : ""}${(doc.shippingLines ?? []).map((line) => escapeHtml(line)).join("<br>")}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Bestellzusammenfassung ${escapeHtml(doc.order_number)}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a1612; margin: 32px; font-size: 13px; background: #fff; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.18em; text-transform: uppercase; color: #b8893a; }
    .muted { color: #6b6258; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #e6dfd4; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b6258; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 16px; text-align: right; }
    .totals strong { font-size: 16px; color: #b8893a; }
    header { display: flex; justify-content: space-between; align-items: flex-start; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(BRAND_NAME)}</h1>
      <p class="muted">BESTELLZUSAMMENFASSUNG</p>
      <p>Bestellung: <strong>${escapeHtml(doc.order_number)}</strong></p>
    </div>
    <div class="muted" style="text-align:right">
      <div>${escapeHtml(ORDER_STATUS_LABELS[doc.status])}</div>
      <div>${escapeHtml(formatDateTime(doc.submitted_at))}</div>
    </div>
  </header>
  ${doc.customerLabel ? `<p>Kunde: <strong>${escapeHtml(doc.customerLabel)}</strong>${doc.customerEmail ? ` · ${escapeHtml(doc.customerEmail)}` : ""}</p>` : ""}
  ${doc.telegramUsername ? `<p>Telegram Benutzername: <strong>${escapeHtml(doc.telegramUsername)}</strong></p>` : ""}
  ${doc.deliveryMethodLabel ? `<p>Lieferart: <strong>${escapeHtml(doc.deliveryMethodLabel)}</strong></p>` : ""}
  ${addressHtml}
  <table>
    <thead>
      <tr>
        <th>SKU</th><th>Produkt</th><th class="num">Menge</th>
        <th class="num">Einzelpreis</th><th class="num">Gesamt</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    ${surchargeBlock}
    <div>Gesamt: ${escapeHtml(formatUsd(doc.total_usd))}</div>
    ${charges.china ? `<div>${SHIPPING_LABEL_CHINA}: ${escapeHtml(formatMoney(charges.china.amount, charges.china.currency))}</div>` : ""}
    ${charges.germany ? `<div>${SHIPPING_LABEL_GERMANY}: ${escapeHtml(formatMoney(charges.germany.amount, charges.germany.currency))}</div>` : ""}
    <div><strong>${GRAND_TOTAL_LABEL}: ${escapeHtml(charges.grandDisplay)}</strong></div>
    ${doc.exchange_rate != null ? `<div class="muted">Wechselkurs USD→EUR: ${doc.exchange_rate}</div>` : ""}
    <div class="muted">Währung: USD</div>
  </div>
  ${doc.note ? `<p><strong>Bestellnotiz</strong><br>${escapeHtml(doc.note)}</p>` : ""}
</body>
</html>`;
}

export function printHtmlDocument(html: string): void {
  const frame = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!frame) return;
  frame.document.write(html);
  frame.document.close();
  frame.focus();
  frame.print();
}

/** Opens a print window with a professional order document. The browser's
 * "Als PDF speichern" then produces the actual PDF from the frozen snapshots. */
export function printOrderDocument(doc: OrderExportDoc): void {
  printHtmlDocument(buildOrderPrintHtml(doc));
}

export function toOrderExportDoc(
  order: Tables<"orders">,
  items: Tables<"order_items">[],
  customer?: { displayName: string; email: string | null },
  roleSurcharge?: { catalogSubtotalUsd: number; surchargeUsd: number } | null,
  options?: { audience?: "admin" | "customer"; kitSizes?: Map<string, number> },
): OrderExportDoc {
  const telegramUsername = order.telegram_username_snapshot?.trim() || undefined;
  const audience = options?.audience ?? "customer";
  const surchargeUnavailable = audience === "admin" && !roleSurcharge;
  const kitSizes = options?.kitSizes;
  return {
    order_number: order.order_number,
    status: order.status,
    submitted_at: order.submitted_at,
    note: order.note,
    total_usd: order.total_usd,
    total_eur: order.total_eur,
    exchange_rate: order.exchange_rate,
    china_shipping_amount: order.china_shipping_amount,
    china_shipping_currency: order.china_shipping_currency,
    de_shipping_amount: order.de_shipping_amount,
    de_shipping_currency: order.de_shipping_currency,
    customerLabel: telegramUsername,
    customerEmail: customer?.email,
    telegramUsername: order.telegram_username_snapshot?.trim() || null,
    deliveryMethodLabel: formatDeliveryMethodLabel(order.shipping_delivery_method),
    shippingRecipient: formatShippingRecipient(order),
    shippingLines: hasShippingSnapshot(order) ? formatShippingAddressLines(order) : [],
    catalogSubtotalUsd: roleSurcharge?.catalogSubtotalUsd ?? null,
    roleSurchargeUsd: roleSurcharge?.surchargeUsd ?? null,
    roleSurchargeUnavailable: surchargeUnavailable,
    items: items.map((item) => ({
      ...item,
      quantityLabel: formatOrderItemQuantity(
        item,
        item.product_id ? kitSizes?.get(item.product_id) ?? null : null,
      ),
    })),
  };
}
