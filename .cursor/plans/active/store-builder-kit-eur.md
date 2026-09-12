# Store builder + Kit UX + EUR first

## Analysis

Customer USD-first leftovers:
- `KitRequestCard`, `JoinKitRequestDialog`, `KitShareDialog`
- Checkout confirm string uses `formatUsd`
Admin/technical USD stays (Händler, Admin orders).

Kit sync/join RPCs stay. UX only.

Designer: extend `shop_areas.theme` JSON. No new table. Wire `uploadAreaDesignImage`.

## Decisions

1. DualCurrencyPrice for all customer kit/checkout prices.
2. Kit copy: gemeinsam kaufen / Mitmachen / Mein Anteil. Status: Offen, Fast voll, Voll.
3. Theme presentation objects: background, hero, banner, hub, categories, products, cards, buttons, mobile.
4. No pricing/kit/cart engine changes. No payment-scope commits.
