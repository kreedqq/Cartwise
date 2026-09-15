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
type EditKitShareButtonProps = {
  kitShareId: string;
  /** Full-width entry on Kit Gesuche participation cards (status + self-restore). */
  presentation?: "cart" | "participantCard";
};

export function EditKitShareButton({ kitShareId, presentation = "cart" }: EditKitShareButtonProps) {
  const [open, setOpen] = React.useState(false);
  const membersQuery = useQuery({
    queryKey: ["kit-share-members"],
    queryFn: listKitShareMembers,
    enabled: open,
    staleTime: 60_000,
  });

  const isCard = presentation === "participantCard";

  return (
    <>
      <Button
        type="button"
        variant={isCard ? "secondary" : "ghost"}
        size={isCard ? "default" : "sm"}
        className={
          isCard
            ? "min-h-11 w-full"
            : "mt-1 h-6 gap-1 px-1.5 text-[11px] text-primary hover:text-primary"
        }
        onClick={() => setOpen(true)}
      >
        {!isCard ? <Pencil className="h-3 w-3" /> : null}
        {isCard ? "Dein Anteil" : "Kit-Aufteilung bearbeiten"}
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
