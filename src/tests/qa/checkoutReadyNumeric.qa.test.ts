import { describe, expect, it } from "vitest";

import {
  HOME_SHIPPING,
  addCatalogLine,
  clearCartItems,
  getOrCreateCart,
  kitIdFromRpc,
  rpcMessage,
  signIn,
} from "./helpers";

/** Live regression: create_order must not raise 42883 for kit lines with qty 5/10/15. */
describe("42883 regression — numeric cart quantity vs checkout-ready helper", () => {
  for (const kitQty of [5, 10, 15] as const) {
    it(`incomplete kit (my_quantity=${kitQty}) + catalog line checkout without 42883`, async () => {
      const { client: admin } = await signIn("admin");
      const { data: master } = await admin
        .from("products")
        .select("id")
        .eq("code", "QA-KIT-001")
        .single();
      expect(master?.id).toBeTruthy();

      const { client } = await signIn("groupBuy");
      const cart = await getOrCreateCart(client);
      await clearCartItems(client, cart.id);

      const kit = await client.rpc("create_kit_share", {
        _product_id: master!.id,
        _kit_size_vials: 20,
        _my_quantity: kitQty,
      });
      expect(kit.error, rpcMessage(kit.error)).toBeNull();
      kitIdFromRpc(kit.data);

      await addCatalogLine(client, cart.id, "QA-PEP-001", 1, "shop", 1);

      const ordered = await client.rpc("create_order", {
        _cart_id: cart.id,
        _note: `QA 42883 regression qty=${kitQty}`,
        _payment_method: "crypto",
        ...HOME_SHIPPING,
      });
      expect(rpcMessage(ordered.error)).not.toMatch(/42883/);
      expect(rpcMessage(ordered.error)).not.toMatch(
        /cart_kit_share_is_checkout_ready.*does not exist/i,
      );
      expect(ordered.error, rpcMessage(ordered.error)).toBeNull();
    });
  }
});
