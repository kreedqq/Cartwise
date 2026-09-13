# Store builder + Kit UX + EUR first — archived

## Shipped

- `6d20edf` kit EUR-first + designer expansion
- `c2337e7` kit share prices use existing FX rate (`useExchangeRate`)

## Decisions

1. `DualCurrencyPrice` for customer kit/checkout prices. Existing `formatEur` / `formatUsd` / `convertUsdToEur`.
2. Kit copy: gemeinsam kaufen / Mitmachen / Mein Anteil. Status: Offen, Fast voll, Voll.
3. Theme presentation objects in `shop_areas.theme` JSON. No new table.
4. No pricing/kit/cart engine changes. No payment-scope commits.

## Production smoke (PepsiDry, 2026-09-13)

EUR first: shop, cart, dashboard, checkout, kit cards, join dialog.
Designer: Zubehör Design tab, local primary change, discarded, not saved.
403: group-buy-2, zubehoer-by-penbuddy.
Counts unchanged: products 320, orders 12, order_items 35, open carts 16, kit_shares 85.

## Honest leftovers

- Category/product layout tokens stored; live catalog still uses existing table/cards.
- Create-kit is one dialog, not a 6-step stepper.
- Kit join/leave/full sync not exercised on live data (no leftover testdata).
- 0070 objects are live; numbered filename is not in timestamped `schema_migrations`.
