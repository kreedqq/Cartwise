import { Toaster as Sonner } from "sonner";

/**
 * Thin wrapper so the rest of the app imports toast primitives from
 * "@/components/ui/toaster" / "sonner" consistently and theming lives in
 * one place.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}

export { toast } from "sonner";
