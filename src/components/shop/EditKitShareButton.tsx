import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listKitShareMembers } from "@/services/kitShareMembers";
import { KitShareDialog } from "@/components/shop/KitShareDialog";

/**
 * "Kit-Aufteilung bearbeiten" entry point for a kit-share cart line (Cart /
 * Checkout). Opens the existing `KitShareDialog` directly against the given
 * kit share id instead of the shop's "create a new kit" flow.
 */
export function EditKitShareButton({ kitShareId }: { kitShareId: string }) {
  const [open, setOpen] = React.useState(false);
  const membersQuery = useQuery({
    queryKey: ["kit-share-members"],
    queryFn: listKitShareMembers,
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-6 gap-1 px-1.5 text-[11px] text-primary hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3 w-3" />
        Kit-Aufteilung bearbeiten
      </Button>
      <KitShareDialog
        existingKitShareId={kitShareId}
        members={membersQuery.data ?? []}
        membersLoading={membersQuery.isLoading}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
