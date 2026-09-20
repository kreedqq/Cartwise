import { describe, expect, it } from "vitest";

import { parseKitReconcileReport } from "@/lib/kit/kitReconciliation";

import { kitIdFromRpc, rpcMessage, shopProductByCode, signIn } from "./helpers";

describe("kit reconcile RPC (local)", () => {
  it("admin reconcile report is read-only HEALTHY for new open kit", async () => {
    const { client: creator } = await signIn("groupBuy");
    const { client: admin } = await signIn("admin");

    const product = await shopProductByCode(creator, "group_buy_1", "QA-KIT-001");
    const created = await creator.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 4,
      _note: "reconcile QA",
      _shop_area: "group_buy_1",
    });
    expect(created.error, rpcMessage(created.error)).toBeNull();
    const kitId = kitIdFromRpc(created.data);

    const state = await admin.rpc("kit_share_project_state", { _kit_share_id: kitId });
    expect(state.error, rpcMessage(state.error)).toBeNull();
    expect(Number((state.data as { allocatedQuantity?: number })?.allocatedQuantity)).toBe(4);

    const reportRpc = await admin.rpc("kit_share_reconcile_report", { _kit_share_id: kitId });
    expect(reportRpc.error, rpcMessage(reportRpc.error)).toBeNull();
    const report = parseKitReconcileReport(reportRpc.data);
    expect(report.overallStatus).toBe("HEALTHY");
    expect(report.reconciliationRequired).toBe(false);
    expect(report.participants.length).toBeGreaterThan(0);

    const customerCancel = await creator.rpc("cancel_kit_request", { _kit_share_id: kitId });
    expect(customerCancel.error, rpcMessage(customerCancel.error)).not.toBeNull();

    const cancelled = await admin.rpc("admin_cancel_kit_request", { _kit_share_id: kitId });
    expect(cancelled.error, rpcMessage(cancelled.error)).toBeNull();
  });

  it("non-admin cannot call reconcile report", async () => {
    const { client: creator } = await signIn("groupBuy");
    const product = await shopProductByCode(creator, "group_buy_1", "QA-KIT-001");
    const created = await creator.rpc("create_kit_request", {
      _product_id: product.id,
      _kit_size_vials: 10,
      _my_quantity: 2,
      _shop_area: "group_buy_1",
    });
    expect(created.error).toBeNull();
    const kitId = kitIdFromRpc(created.data!);

    const denied = await creator.rpc("kit_share_reconcile_report", { _kit_share_id: kitId });
    expect(denied.error).not.toBeNull();

    const customerCancel = await creator.rpc("cancel_kit_request", { _kit_share_id: kitId });
    expect(customerCancel.error).not.toBeNull();

    const { client: admin } = await signIn("admin");
    await admin.rpc("admin_cancel_kit_request", { _kit_share_id: kitId });
  });
});
