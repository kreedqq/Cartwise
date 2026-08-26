import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cartNameSchema } from "@/lib/validation";

interface RenameCartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  loading?: boolean;
  onConfirm: (name: string) => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
}

export function RenameCartDialog({
  open,
  onOpenChange,
  initialName,
  loading,
  onConfirm,
  title = "Warenkorb umbenennen",
  confirmLabel = "Speichern",
}: RenameCartDialogProps) {
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);

  // Resets the form fields each time the dialog is (re)opened. Radix keeps
  // DialogContent mounted while closed, so without this the field would
  // keep showing a stale/cancelled edit from the previous time it was open.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [open, initialName]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = cartNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Ungültiger Name.");
      return;
    }
    await onConfirm(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Der Name hilft dir und deinem Team, den Warenkorb wiederzufinden.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-cart">Name</Label>
            <Input
              id="rename-cart"
              autoFocus
              className="mt-1.5"
              value={name}
              invalid={!!error}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" loading={loading}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
