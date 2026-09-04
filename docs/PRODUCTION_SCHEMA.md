# Production schema snapshot (cartwise-prod)

Project: **cartwise-prod** (`cnjrjinvxycdkrmzcime`), region `eu-west-2`, Postgres 17.
This file is schema/architecture only. **No customer rows, orders, or secrets.**

Source of truth for SQL is `supabase/migrations/` plus the live `supabase_migrations.schema_migrations` list below.

## Migration history difference (critical)

Local Git has numbered files `0001_…` through `0049_order_progress.sql`.

Production `schema_migrations.version` values (2026-09-04):

```
0001 … 0039, 0041,
20260831123754, 20260901083829, 20260901125148, 20260901192353,
20260901192458, 20260901195455, 20260901195700, 20260902175401,
20260903085653, 20260903111826, 20260904120914
```

Known mappings (do not re-apply these as new numbered files):

| Local file | Production version |
|---|---|
| `0040_username_cart_names.sql` | `20260831123754` |
| `0041_kit_requests.sql` | `0041` |
| `0048_fix_kit_share_participants_rls_recursion.sql` | `20260903111826` |
| `0049_order_progress.sql` | `20260904120914` |

`0042`–`0047` were applied via MCP timestamp names. **Never** `supabase db push` or `db reset --linked` until `supabase migration list` is compared. Extra timestamp rows vs local filenames are expected.

## Public tables (all RLS enabled)

`audit_logs`, `cart_items`, `carts`, `claim_sources`, `claims`, `community_reports`, `customer_roles`, `evidence_assessments`, `exchange_rates`, `kit_share_participants`, `kit_shares`, `order_admin_notes`, `order_items`, `order_progress`, `order_role_surcharge_lines`, `order_status_history`, `order_template_items`, `order_templates`, `orders`, `pdf_import_rows`, `pdf_imports`, `product_favorites`, `product_price_history`, `product_substances`, `products`, `profiles`, `regulatory_history`, `regulatory_records`, `research_connector_health`, `research_run_sources`, `research_runs`, `review_actions`, `source_substances`, `sources`, `studies`, `study_sources`, `study_substances`, `substance_aliases`, `substance_components`, `substances`, `user_customer_roles`, `user_roles`.

Views: `admin_user_directory`, `cart_summaries`.

## Kit / order / cart / profile (columns that matter for recovery)

**`kit_shares`:** `id`, `product_id`, `creator_user_id`, `kit_size_vials`, `status`, `is_open_request`, `note`, `expires_at`, `completed_at`.

**`kit_share_participants`:** `kit_share_id`, `user_id`, `quantity`, `ordered_at`, `order_id`. Identity for Bestellzusammenfassung is this `order_id` + `kit.product_id` (or same-product cart `kit_share_id`). `order_items` has **no** `kit_share_id` column.

**`orders`:** `order_number`, `user_id` (nullable ON DELETE SET NULL), `cart_id`, `status` (`pending` / `processing` / `dispatched` / `received` / `shipped` / `completed`; historical `confirmed` / `cancelled` remain), telegram + shipping snapshots, totals.

**`order_items`:** snapshots (`product_code_snapshot`, `product_name_snapshot`, `dosage_vial_snapshot`, prices, `quantity` numeric, `line_total_usd`). Postgres often returns quantity as `"5.000"` — formatters must use `asQuantity`, never treat that string as a kit count.

**`order_progress`:** visual tracker, separate from `orders.status`. Writes via `upsert_order_progress` (admin). Customers SELECT own order only.

**`carts` / `cart_items`:** optimistic `version`, `kit_share_id` on lines, `name_ordinal` + username cart titles.

**`profiles`:** `username`, `username_required_on_next_login`, `display_name` (not shown as identity).

**`user_roles`:** `user` \| `admin` via `has_role`.

**`customer_roles` / `user_customer_roles`:** markup percent. Selling prices from RPCs (`list_shop_products`, `sell_unit_price`). Surcharge snapshots on `order_role_surcharge_lines`.

## Security-definer RPCs (subset)

Shop: `list_shop_products`, `get_shop_product_by_code`, `create_order`, `set_order_status`, `delete_order`.
Kits: `create_kit_share`, `join_kit_share`, `list_open_kit_requests`, `join_kit_request`, `user_participates_in_kit_share` (breaks participant RLS recursion), pricing helpers `kit_share_*`.
Admin: `admin_delete_user`, `admin_assign_customer_role`, `upsert_order_progress`, `set_username`.
Auth helper: `has_role`, `handle_new_user`.

Writes to orders/kits/prices go through these RPCs, not open table grants.

## Bestellzusammenfassung (no extra table)

Client function `buildProcessingOrderSummary` in `src/lib/orderSummary.ts`:

1. Filter `orders.status === "processing"` only.
2. Load kit context: `kit_shares`, `kit_share_participants`, cart links (`listAdminKitOrderContext`).
3. `kitProgress` per `kit_share_id`: `max(processing participant qty, sum of processing items for that share)` then `splitKitProgress` (`floor(vials / kit_size_vials)`).
4. **groups** (Händler product tables): complete kit → `1 Kit` / `2 Kits`; remainder → `5/10 Kit`.
5. **personLines** (BESTELLUNGEN + PDF): same `kitProgress`. Full kit (`completeKits > 0`, remainder 0) → one row, names joined with ` + `, label `1 Kit`. Incomplete → per person `5/10 Kit`.
6. **customers** (not rendered on the admin page): always individual shares.
7. Geteiltes Kit (`buildSharedKitsForOrder`): always each participant `5/10 Kit`.

Oils without a kit link stay `n Vials`. Different `kit_share_id` never merge.
