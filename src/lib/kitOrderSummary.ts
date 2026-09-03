import {
  formatOrderTelegramSnapshot,
  ORDER_STATUS_LABELS,
  ORDER_TELEGRAM_SNAPSHOT_UNAVAILABLE,
} from "@/services/orders";
import type { OrderStatus, Tables } from "@/types/database";

/** Same key as PROCESSING_ORDER_STATUS in orderSummary.ts. Kept local to avoid a cycle. */
const PROCESSING_STATUS = "processing";

export interface KitShareContextKit {
  id: string;
  product_id: string;
  kit_size_vials: number;
}

export interface KitShareContextParticipant {
  kit_share_id: string;
  user_id: string;
  quantity: number;
  order_id: string | null;
}

export interface KitShareCartLink {
  cart_id: string;
  kit_share_id: string;
  product_id: string | null;
  quantity: number;
}

export interface KitShareOrderContext {
  kits: KitShareContextKit[];
  participants: KitShareContextParticipant[];
  cartLinks?: KitShareCartLink[];
  /** Live Telegram handles for participants who do not yet have an order snapshot. */
  usernamesByUserId?: Record<string, string | null>;
}

export interface SharedKitParticipantView {
  userId: string;
  telegramLabel: string;
  quantity: number;
  kitSize: number;
  shareLabel: string;
  statusKey: OrderStatus | null;
  statusLabel: string;
  isCurrentOrder: boolean;
  hasProcessingOrder: boolean;
}

export interface SharedKitAdminView {
  kitShareId: string;
  productName: string;
  productCode: string;
  kitSize: number;
  processingQuantity: number;
  complete: boolean;
  progressLabel: string;
  participants: SharedKitParticipantView[];
}

const NO_ORDER_STATUS_LABEL = "Noch nicht in Bearbeitung";

export function formatCompleteKitQuantityLabel(kitCount: number): string {
  return `${kitCount} Kit/s`;
}

export function formatSharedKitQuantityLabel(filled: number, kitSize: number): string {
  return `${filled}/${kitSize} Stück`;
}

export function formatSharedKitShareLabel(quantity: number, kitSize: number): string {
  return `${quantity}/${kitSize}`;
}

export function isKitComplete(processingQuantity: number, kitSize: number): boolean {
  return kitSize > 0 && processingQuantity >= kitSize;
}

export function kitProcessingQuantity(
  kitShareId: string,
  participants: KitShareContextParticipant[],
  ordersById: Map<string, { status: string }>,
): number {
  let filled = 0;
  for (const participant of participants) {
    if (participant.kit_share_id !== kitShareId) continue;
    if (!participant.order_id) continue;
    const order = ordersById.get(participant.order_id);
    if (order?.status !== PROCESSING_STATUS) continue;
    filled += participant.quantity;
  }
  return filled;
}

function kitsById(context: KitShareOrderContext): Map<string, KitShareContextKit> {
  return new Map(context.kits.map((kit) => [kit.id, kit]));
}

function hydrateParticipantOrderId(
  participant: KitShareContextParticipant,
  orders: Array<Pick<Tables<"orders">, "id" | "user_id" | "cart_id">>,
  cartLinks: KitShareCartLink[] | undefined,
): string | null {
  if (participant.order_id) return participant.order_id;
  if (!cartLinks?.length) return null;
  const links = cartLinks.filter((link) => link.kit_share_id === participant.kit_share_id);
  if (links.length === 0) return null;
  const cartIds = new Set(links.map((link) => link.cart_id));
  const match = orders.find(
    (order) => order.user_id === participant.user_id && Boolean(order.cart_id) && cartIds.has(order.cart_id as string),
  );
  return match?.id ?? null;
}

export function resolvedKitParticipants(
  context: KitShareOrderContext,
  orders: Array<Pick<Tables<"orders">, "id" | "user_id" | "cart_id">>,
): KitShareContextParticipant[] {
  return context.participants.map((participant) => ({
    ...participant,
    order_id: hydrateParticipantOrderId(participant, orders, context.cartLinks),
  }));
}

export function resolveKitShareIdForItem(
  item: Pick<Tables<"order_items">, "order_id" | "product_id" | "quantity">,
  order: Pick<Tables<"orders">, "id" | "cart_id"> | undefined,
  context: KitShareOrderContext,
  participants = context.participants,
): string | null {
  const kits = kitsById(context);
  const forOrder = participants.filter((participant) => participant.order_id === item.order_id);
  const productMatched = forOrder.filter((participant) => {
    const kit = kits.get(participant.kit_share_id);
    return Boolean(item.product_id) && kit?.product_id === item.product_id;
  });

  if (productMatched.length === 1) return productMatched[0].kit_share_id;
  if (productMatched.length > 1) {
    const qtyMatched = productMatched.filter((participant) => participant.quantity === item.quantity);
    if (qtyMatched.length === 1) return qtyMatched[0].kit_share_id;
    return null;
  }

  if (forOrder.length === 1 && !item.product_id) {
    return forOrder[0].kit_share_id;
  }

  if (order?.cart_id && context.cartLinks) {
    const links = context.cartLinks.filter((link) => link.cart_id === order.cart_id);
    const linkMatched = links.filter((link) => {
      if (link.product_id && item.product_id) return link.product_id === item.product_id;
      const kit = kits.get(link.kit_share_id);
      return Boolean(item.product_id) && kit?.product_id === item.product_id;
    });
    if (linkMatched.length === 1) return linkMatched[0].kit_share_id;
  }

  return null;
}

export function kitParticipantTelegramLabel(input: {
  order?: { telegram_username_snapshot?: string | null } | null;
  profileUsername?: string | null;
}): string {
  if (input.order) return formatOrderTelegramSnapshot(input.order);
  const live = input.profileUsername?.trim();
  if (live) return live;
  return ORDER_TELEGRAM_SNAPSHOT_UNAVAILABLE;
}

export function kitParticipantStatusLabel(
  order: { status: string } | null | undefined,
): { statusKey: OrderStatus | null; statusLabel: string; hasProcessingOrder: boolean } {
  if (!order) {
    return { statusKey: null, statusLabel: NO_ORDER_STATUS_LABEL, hasProcessingOrder: false };
  }
  const statusKey = order.status as OrderStatus;
  return {
    statusKey,
    statusLabel: ORDER_STATUS_LABELS[statusKey] ?? order.status,
    hasProcessingOrder: order.status === PROCESSING_STATUS,
  };
}

export function shouldShowSharedKitPanel(participantCount: number, kitSize: number, allocatedQuantity: number): boolean {
  if (participantCount > 1) return true;
  return kitSize > 0 && allocatedQuantity < kitSize;
}

export function buildSharedKitsForOrder(
  orderId: string,
  items: Tables<"order_items">[],
  orders: Tables<"orders">[],
  context: KitShareOrderContext,
): SharedKitAdminView[] {
  const participants = resolvedKitParticipants(context, orders);
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const kits = kitsById(context);
  const currentOrder = ordersById.get(orderId);
  const kitIds = new Set<string>();

  for (const item of items) {
    const kitShareId = resolveKitShareIdForItem(item, currentOrder, { ...context, participants }, participants);
    if (kitShareId) kitIds.add(kitShareId);
  }

  const views: SharedKitAdminView[] = [];
  for (const kitShareId of kitIds) {
    const kit = kits.get(kitShareId);
    if (!kit) continue;
    const members = participants.filter((participant) => participant.kit_share_id === kitShareId);
    const allocated = members.reduce((sum, member) => sum + member.quantity, 0);
    if (!shouldShowSharedKitPanel(members.length, kit.kit_size_vials, allocated)) continue;

    const processingQuantity = kitProcessingQuantity(kitShareId, participants, ordersById);
    const complete = isKitComplete(processingQuantity, kit.kit_size_vials);
    const orderItem = items.find(
      (item) => resolveKitShareIdForItem(item, currentOrder, { ...context, participants }, participants) === kitShareId,
    );

    const participantViews: SharedKitParticipantView[] = members
      .map((member) => {
        const memberOrder = member.order_id ? ordersById.get(member.order_id) : undefined;
        const status = kitParticipantStatusLabel(memberOrder);
        return {
          userId: member.user_id,
          telegramLabel: kitParticipantTelegramLabel({
            order: memberOrder,
            profileUsername: context.usernamesByUserId?.[member.user_id],
          }),
          quantity: member.quantity,
          kitSize: kit.kit_size_vials,
          shareLabel: formatSharedKitShareLabel(member.quantity, kit.kit_size_vials),
          statusKey: status.statusKey,
          statusLabel: status.statusLabel,
          isCurrentOrder: member.order_id === orderId,
          hasProcessingOrder: status.hasProcessingOrder,
        };
      })
      .sort((a, b) => {
        if (a.isCurrentOrder !== b.isCurrentOrder) return a.isCurrentOrder ? -1 : 1;
        return a.telegramLabel.localeCompare(b.telegramLabel, "de");
      });

    views.push({
      kitShareId,
      productName: orderItem?.product_name_snapshot?.trim() || "Nicht verfügbar",
      productCode: orderItem?.product_code_snapshot?.trim() || "—",
      kitSize: kit.kit_size_vials,
      processingQuantity,
      complete,
      progressLabel: complete
        ? `${kit.kit_size_vials}/${kit.kit_size_vials} bestellt`
        : `${processingQuantity}/${kit.kit_size_vials} bestellt`,
      participants: participantViews,
    });
  }

  return views.sort((a, b) => a.productName.localeCompare(b.productName, "de"));
}
