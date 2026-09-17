import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShopCatalogFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}

/** Mobile-friendly filter panel (dialog; no Sheet primitive in project). */
export function ShopCatalogFiltersSheet({
  open,
  onOpenChange,
  title = "Filter",
  children,
}: ShopCatalogFiltersSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
