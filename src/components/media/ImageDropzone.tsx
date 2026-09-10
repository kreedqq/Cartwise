import * as React from "react";
import { ImagePlus, Replace, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateImageFile } from "@/lib/mediaUpload";

export function ImageDropzone({
  previewUrl,
  onFile,
  onRemove,
  disabled = false,
  label = "Bild hinzufügen",
  hint = "JPG, PNG oder WEBP. Drag & Drop oder Datei wählen.",
  aspect = "video",
  compact = false,
  objectPosition,
}: {
  previewUrl: string | null;
  onFile: (file: File) => Promise<void> | void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  aspect?: "video" | "photo";
  compact?: boolean;
  objectPosition?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept(file: File | null | undefined) {
    if (!file || disabled) return;
    setError(null);
    setBusy(true);
    try {
      await validateImageFile(file);
      await onFile(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={previewUrl ? `${label} ersetzen` : label}
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void accept(event.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative w-full cursor-pointer overflow-hidden rounded-xl border border-dashed border-input bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact
            ? previewUrl
              ? "mx-auto aspect-[4/3] max-h-44 w-full max-w-[15rem]"
              : "max-h-44 text-left"
            : cn("text-center", aspect === "video" ? "aspect-video" : "aspect-[4/3]"),
          dragOver && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: objectPosition ?? "50% 50%" }}
          />
        ) : (
          <div
            className={cn(
              "flex h-full items-center justify-center gap-3 px-4 text-muted-foreground",
              compact ? "flex-row flex-wrap py-4 sm:py-5" : "flex-col gap-2",
            )}
          >
            <ImagePlus className={cn("shrink-0", compact ? "h-5 w-5" : "h-6 w-6")} aria-hidden />
            <div className={cn(compact ? "min-w-0 space-y-0.5" : "space-y-1")}>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs">{hint}</p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void accept(file);
          }}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          <Replace className="h-3.5 w-3.5" />
          {previewUrl ? "Ersetzen" : "Datei wählen"}
        </Button>
        {previewUrl && onRemove ? (
          <Button type="button" size="sm" variant="ghost" disabled={disabled || busy} onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
            Entfernen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
