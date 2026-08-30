import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression tests for the reported bug:
 *   "Ungültiger Kit-Anteil im Warenkorb." (P0001) when a second kit-share
 *   participant orders after the first one already did.
 *
 * Root cause: create_order() used to set kit_shares.status = 'ordered' for
 * the WHOLE kit as soon as ANY participant submitted, which then failed the
 * next participant's own `_kit.status <> 'full'` check. Fixed in migration
 * 0039 by tracking completion per participant and only promoting the kit
 * to 'ordered' once every participant has ordered.
 *
 * These are source-level regression guards (matching this repo's existing
 * convention of scanning migration SQL for the presence/absence of specific
 * clauses, see src/tests/carts.test.ts) plus a real Postgres reproduction is
 * documented in scripts/repro_kit_order_bug.sql (requires `supabase start`).
 */

function readMigration(file: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8");
}

describe("0039 fix: kit stays orderable for remaining participants", () => {
  const sql = readMigration("0039_fix_kit_share_partial_order_completion.sql");

  it("adds a per-participant order completion snapshot", () => {
    expect(sql).toMatch(/add column if not exists ordered_at timestamptz/);
    expect(sql).toMatch(/add column if not exists order_id uuid references public\.orders/);
  });

  it("no longer blocks a participant whose kit is already 'ordered' by someone else", () => {
    expect(sql).toMatch(/_kit\.status not in \('full', 'ordered'\)/);
    expect(sql).not.toMatch(/_kit\.status <> 'full' then/);
  });

  it("only promotes the whole kit to 'ordered' once every participant has ordered", () => {
    expect(sql).toMatch(/where kit_share_id = _kit_share_id and ordered_at is null/);
    expect(sql).toMatch(/if _remaining_unordered = 0 then/);
    expect(sql).toMatch(/set status = 'ordered', updated_at = now\(\)/);
  });

  it("locks the kit row and the participant row before validating (race-safety, Phase 14)", () => {
    expect(sql).toMatch(/select \* into _kit from public\.kit_shares where id = _item\.kit_share_id for update/);
    expect(sql).toMatch(/where kit_share_id = _item\.kit_share_id and user_id = auth\.uid\(\)\s*\n\s*for update/);
  });

  it("stamps ordered_at/order_id on the participant as part of the same order", () => {
    expect(sql).toMatch(/set ordered_at = now\(\), order_id = _order_id/);
  });

  it("blocks editing a participant's quantity once they have ordered", () => {
    expect(sql).toMatch(/Deine Bestellung für dieses Kit wurde bereits abgeschlossen/);
    expect(sql).toMatch(/Ein Teilnehmer hat seine Bestellung bereits abgeschlossen/);
  });

  it("blocks removing / kit cancellation once a participant has ordered", () => {
    expect(sql).toMatch(/Dieser Teilnehmer hat bereits bestellt und kann nicht mehr entfernt werden/);
    expect(sql).toMatch(/Mindestens ein Teilnehmer hat bereits bestellt; dieses Kit kann nicht mehr storniert werden/);
  });

  it("never deletes cart_items belonging to an already-ordered cart when cancelling", () => {
    expect(sql).toMatch(/and c\.status <> 'ordered'/);
  });
});

describe("create_order idempotency (Phase 15: no duplicate orders)", () => {
  it("rejects re-submitting a cart that is not draft/ready", () => {
    const sql = readMigration("0039_fix_kit_share_partial_order_completion.sql");
    expect(sql).toMatch(/if _cart\.status not in \('draft', 'ready'\) then/);
    expect(sql).toMatch(/Dieser Warenkorb wurde bereits bestellt oder ist archiviert/);
  });

  it("locks the cart row for update to avoid double-submit races", () => {
    const sql = readMigration("0039_fix_kit_share_partial_order_completion.sql");
    expect(sql).toMatch(/where id = _cart_id and user_id = auth\.uid\(\) and deleted_at is null\s*\n\s*for update/);
  });
});

describe("Dashboard: ordered carts must disappear from the active cart overview (Phase 5)", () => {
  it("filters carts through isOpenCart before rendering the 'Warenkörbe' grid", () => {
    const tsx = readFileSync(resolve(process.cwd(), "src/pages/Dashboard.tsx"), "utf8");
    expect(tsx).toMatch(/import \{ isOpenCart \} from "@\/services\/carts";/);
    expect(tsx).toMatch(/filter\(\(cart\) => isOpenCart\(cart\.status\)\)/);
    expect(tsx).not.toMatch(/cartsQuery\.data\.map\(\(cart\)/);
  });
});

describe("OrderDetail: payment method must be visible on the order (Phase 7)", () => {
  it("renders the selected payment method's German label", () => {
    const tsx = readFileSync(resolve(process.cwd(), "src/pages/OrderDetail.tsx"), "utf8");
    expect(tsx).toMatch(/PAYMENT_METHOD_LABELS/);
    expect(tsx).toMatch(/order\.payment_method/);
  });
});

describe("KitShareDialog: locks a participant's own placed order (Phase 13)", () => {
  it("disables quantity/removal controls once hasOrdered/myHasOrdered is true", () => {
    const tsx = readFileSync(resolve(process.cwd(), "src/components/shop/KitShareDialog.tsx"), "utf8");
    expect(tsx).toMatch(/kitView\.myHasOrdered/);
    expect(tsx).toMatch(/!p\.hasOrdered &&/);
    expect(tsx).toMatch(/disabled=\{busy \|\| p\.hasOrdered\}/);
  });
});
