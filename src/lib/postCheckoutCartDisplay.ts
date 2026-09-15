import { formatPartialKitQuantity, formatCatalogQuantity, resolveProductCategoryId } from "@/lib/quantityFormat";
import { isKitCheckoutReadyLine, type OrderIntegrityCartLine } from "@/lib/orderIntegrity";

export type PostCheckoutEvidence = "CHECKOUT_OMITTED" | "ADDED_AFTER_CHECKOUT" | "HISTORICAL_LINK_UNKNOWN";

export type PostCheckoutCartLineInput = OrderIntegrityCartLine & {
  productName: string;
  createdAt: string;
  dosageVial?: string | null;
};

export type PostCheckoutCartLineView = {
  productCode: string;
  productName: string;
  quantityLabel: string;
  evidence: PostCheckoutEvidence;
  hint: string;
};

export function classifyPostCheckoutCartLine(input: {
  orderId: string;
  orderSubmittedAt: string;
  cartLineCreatedAt: string;
  submittedOrderId: string | null;
  kitShareId: string | null;
  kitCheckoutReady: boolean;
  orderHasLinkedCartLines: boolean;
}): PostCheckoutEvidence {
  if (input.submittedOrderId === input.orderId) {
    return "HISTORICAL_LINK_UNKNOWN";
  }

  const createdMs = Date.parse(input.cartLineCreatedAt);
  const submittedMs = Date.parse(input.orderSubmittedAt);
  if (Number.isFinite(createdMs) && Number.isFinite(submittedMs) && createdMs > submittedMs) {
    return "ADDED_AFTER_CHECKOUT";
  }

  if (!input.orderHasLinkedCartLines) {
    return "HISTORICAL_LINK_UNKNOWN";
  }

  if (input.kitShareId) {
    if (!input.kitCheckoutReady) {
      return "CHECKOUT_OMITTED";
    }
    return "CHECKOUT_OMITTED";
  }

  return "CHECKOUT_OMITTED";
}

export function postCheckoutEvidenceHint(
  evidence: PostCheckoutEvidence,
  input: { kitShareId: string | null; kitCheckoutReady: boolean },
): string {
  switch (evidence) {
    case "ADDED_AFTER_CHECKOUT":
      return "Nach dem Checkout zum Warenkorb hinzugefügt.";
    case "CHECKOUT_OMITTED":
      if (input.kitShareId && !input.kitCheckoutReady) {
        return "Beim Checkout nicht bestellt, da Kit unvollständig.";
      }
      return "Beim Checkout nicht in die Bestellung übernommen.";
    case "HISTORICAL_LINK_UNKNOWN":
      return "Historischer Status nicht eindeutig rekonstruierbar.";
    default:
      return "Historischer Status nicht eindeutig rekonstruierbar.";
  }
}

export function formatPostCheckoutCartQuantity(line: PostCheckoutCartLineInput): string {
  const categoryId = resolveProductCategoryId({
    name: line.productName,
    code: line.productCode,
    dosageVial: line.dosageVial,
  });
  if (line.kitShareId && line.kitSizeVials != null && line.kitSizeVials > 0) {
    return formatPartialKitQuantity(line.quantity, line.kitSizeVials, categoryId);
  }
  return formatCatalogQuantity(line.quantity, categoryId, "retail_unit");
}

export function buildPostCheckoutCartLines(input: {
  orderId: string;
  orderSubmittedAt: string;
  cartLines: PostCheckoutCartLineInput[];
}): PostCheckoutCartLineView[] {
  const linkedToOrder = input.cartLines.filter((l) => l.submittedOrderId === input.orderId);
  const orderHasLinkedCartLines = linkedToOrder.length > 0;

  return input.cartLines
    .filter((line) => line.quantity > 0 && line.submittedOrderId !== input.orderId)
    .map((line) => {
      const kitCheckoutReady = isKitCheckoutReadyLine(line);
      const evidence = classifyPostCheckoutCartLine({
        orderId: input.orderId,
        orderSubmittedAt: input.orderSubmittedAt,
        cartLineCreatedAt: line.createdAt,
        submittedOrderId: line.submittedOrderId,
        kitShareId: line.kitShareId,
        kitCheckoutReady,
        orderHasLinkedCartLines,
      });
      return {
        productCode: line.productCode,
        productName: line.productName,
        quantityLabel: formatPostCheckoutCartQuantity(line),
        evidence,
        hint: postCheckoutEvidenceHint(evidence, {
          kitShareId: line.kitShareId,
          kitCheckoutReady,
        }),
      };
    })
    .sort((a, b) => a.productCode.localeCompare(b.productCode, "de"));
}
