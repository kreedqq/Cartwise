# Final Group Buy / Kit UX + vendor-only kit identity

## This session

- Shared storefront hierarchy via `src/lib/shop/areaLayout.ts` + `PageHeader` / `AreaSectionHeader`.
- Removed the “Kit gemeinsam kaufen” banner. Compact action nav: Produkte / Kit Gesuche / Gesuch erstellen.
- Kit cards prioritize product, fill, unit price (`getProductUnitLabel`), creator, Mitmachen.
- Wizard product grid 2-col desktop / 1-col mobile; variant tiles via `wizardVariantPresentation`.
- Area Designer grouped into 7 self-explanatory sections.
- Additive **0073** lets vendor-only area catalog rows (`shop_area_products.id` + `vendor_code`) become kit-requestable without inventing `products` or mapping AD10→AD5. No FK on `area_product_id` because catalog apply deletes/recreates sap rows; durable identity is `vendor_code` + `shop_area`.
- 0070 untouched. Protected docs/pages not edited.

## Production 0073

Applied on cartwise-prod as additive MCP migrations (not `db push`, 0070 untouched):
`kit_request_vendor_catalog_identity` + helpers/create/lists/join/sync + `kit_request_vendor_checkout_identity`.
One Cart `create_order` wrapper kept. Checkout identity patched in `create_one_area_order` only.
Open kits remained 54. AD10/AU50 still unlinked.

## Remaining

- Commit / push / Vercel / logged-in browser QA.
