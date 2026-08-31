import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations/0041_kit_requests.sql"), "utf8");
}

describe("0041 kit requests SQL", () => {
  const sql = readMigration();

  it("extends kit_shares instead of replacing invite kits", () => {
    expect(sql).toMatch(/add column if not exists is_open_request boolean not null default false/);
    expect(sql).not.toMatch(/drop table public\.kit_shares/);
    expect(sql).not.toMatch(/create table public\.kit_requests/);
  });

  it("locks the kit row before join validation", () => {
    expect(sql).toMatch(/create or replace function public\.join_kit_request/);
    expect(sql).toMatch(/from public\.kit_shares\s+where id = _kit_share_id\s+for update/);
    expect(sql).toMatch(/Nicht genügend Vials verfügbar/);
  });

  it("rejects creator join, duplicate join, and completed/expired/cancelled kits", () => {
    expect(sql).toMatch(/Du kannst deinem eigenen Gesuch nicht beitreten/);
    expect(sql).toMatch(/Du bist bereits Teilnehmer dieses Kits/);
    expect(sql).toMatch(/Dieses Kit ist bereits vollständig/);
    expect(sql).toMatch(/Dieses Kit-Gesuch wurde storniert/);
    expect(sql).toMatch(/Dieses Kit-Gesuch ist abgelaufen/);
  });

  it("requires a leftover quantity from the creator", () => {
    expect(sql).toMatch(/Der Ersteller muss mindestens 1 Vial offen lassen/);
    expect(sql).toMatch(/_my_quantity >= _kit_size_vials/);
  });

  it("syncs carts only after the kit is full, inside the same function", () => {
    expect(sql).toMatch(/if _allocated = _kit\.kit_size_vials then/);
    expect(sql).toMatch(/perform public\.kit_share_sync_all_participant_carts/);
    expect(sql).toMatch(/kit_share_catalog_unit_usd/);
    expect(sql).toMatch(/kit_share_participant_price_usd/);
  });

  it("uses auth.uid and a fixed search_path on SECURITY DEFINER RPCs", () => {
    expect(sql).toMatch(/_uid uuid := auth\.uid\(\)/);
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).not.toMatch(/execute\s+'/i);
  });

  it("never returns foreign emails or display_name in card payloads", () => {
    const payloadFn = sql.slice(sql.indexOf("kit_request_card_payload"));
    expect(payloadFn).not.toMatch(/pr\.display_name|email/);
    expect(sql).toMatch(/creatorUsername/);
    expect(sql).toMatch(/from public\.profiles/);
    expect(sql).toMatch(/pr\.username/);
  });

  it("adds an idempotent cart unique index for kit share lines", () => {
    expect(sql).toMatch(/cart_items_one_kit_share_per_cart/);
    expect(sql).toMatch(/on public\.cart_items \(cart_id, kit_share_id\)/);
  });

  it("does not reopen a completed marketplace kit via leave, cancel, or status refresh", () => {
    expect(sql).toMatch(/Ein abgeschlossenes Kit-Gesuch kann nicht mehr verlassen werden/);
    expect(sql).toMatch(/Ein abgeschlossenes oder abgelaufenes Kit-Gesuch kann nicht mehr storniert werden/);
    expect(sql).toMatch(/if _kit\.status in \('cancelled', 'ordered', 'expired'\)/);
    expect(sql).toMatch(/coalesce\(_kit\.is_open_request, false\) and _kit\.status = 'full'/);
  });

  it("does not rewrite create_kit_share", () => {
    expect(sql).not.toMatch(/create or replace function public\.create_kit_share/);
  });

  it("rejects leave by a non-participant", () => {
    expect(sql).toMatch(/Keine Berechtigung, diese Teilnahme zu stornieren/);
  });
});
