import { Info } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Tables } from "@/types/database";

interface ShopProductInfoPopoverProps {
  product: Tables<"products">;
  displayTitle: string;
  lexiconHref?: string | null;
}

export function ShopProductInfoPopover({ product, displayTitle, lexiconHref }: ShopProductInfoPopoverProps) {
  const hasBody = Boolean(product.description?.trim() || product.dosage_vial || lexiconHref);
  const [open, setOpen] = React.useState(false);

  if (!hasBody) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Details zu ${displayTitle}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {product.dosage_vial ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/90">Variante:</span> {product.dosage_vial}
            </p>
          ) : null}
          {product.description?.trim() ? (
            <p className="text-muted-foreground leading-relaxed">{product.description.trim()}</p>
          ) : null}
          {lexiconHref ? (
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link to={lexiconHref} onClick={() => setOpen(false)}>
                Im Lexikon lesen
              </Link>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
