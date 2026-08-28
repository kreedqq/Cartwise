import * as React from "react";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { mapAuthError, signInWithOAuth, type OAuthProvider } from "@/services/auth";

function DiscordMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.89 3l-.2.36a18.3 18.3 0 0 1 4.26 1.64 19.5 19.5 0 0 0-15.9 0A18.3 18.3 0 0 1 8.3 3.36L8.11 3A19.8 19.8 0 0 0 3.68 4.37C.96 8.42.22 12.36.48 16.24A19.9 19.9 0 0 0 6.6 19l.46-.75a13 13 0 0 1-1.84-.88l.46-.36a14.2 14.2 0 0 0 12.64 0l.46.36c-.6.35-1.22.64-1.84.88l.46.75a19.9 19.9 0 0 0 6.12-2.76c.31-4.5-.53-8.4-3.2-12.48ZM8.02 13.8c-.9 0-1.64-.83-1.64-1.84s.72-1.85 1.64-1.85 1.66.84 1.64 1.85c0 1-.74 1.84-1.64 1.84Zm7.96 0c-.9 0-1.64-.83-1.64-1.84s.72-1.85 1.64-1.85 1.66.84 1.64 1.85c0 1-.73 1.84-1.64 1.84Z" />
    </svg>
  );
}

const oauthButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-3 rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function OAuthButtons() {
  const [pending, setPending] = React.useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setPending(provider);
    try {
      await signInWithOAuth(provider);
    } catch (error) {
      toast.error(mapAuthError(error));
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.16em]">
          <span className="bg-transparent px-3 text-muted-foreground">oder</span>
        </div>
      </div>

      <button
        type="button"
        className={cn(
          oauthButtonClass,
          "border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.07]",
        )}
        disabled={pending !== null}
        onClick={() => void handleOAuth("discord")}
      >
        <DiscordMark className="h-5 w-5 text-primary" />
        {pending === "discord" ? "Weiterleitung …" : "Mit Discord fortfahren"}
      </button>
    </div>
  );
}
