import * as React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { StarRating } from "@/components/media/StarRating";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useMyOrders } from "@/hooks/useOrders";
import { useApprovedFeedback, useCreateFeedback, useFeedbackStats, useMyFeedback } from "@/hooks/useTrustExperience";
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_BODY_MIN,
  FEEDBACK_DEFAULT_DISPLAY_NAME,
  FEEDBACK_PAGE_SIZE,
  averageRating,
  eligibleOrdersForFeedback,
  feedbackOrderChoiceLabel,
  formatAverageRating,
  ratingDistribution,
} from "@/lib/feedback";
import { ORDER_STATUS_LABELS } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

export default function FeedbackPage() {
  const [page, setPage] = React.useState(0);
  const feedQuery = useApprovedFeedback(page);
  const statsQuery = useFeedbackStats();
  const myFeedbackQuery = useMyFeedback();
  const ordersQuery = useMyOrders();
  const createMutation = useCreateFeedback();

  const [orderId, setOrderId] = React.useState("");
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const ratings = statsQuery.data ?? [];
  const average = averageRating(ratings);
  const distribution = ratingDistribution(ratings);
  const visibleFeed = feedQuery.data ?? [];
  const eligible = eligibleOrdersForFeedback(
    ordersQuery.data ?? [],
    (myFeedbackQuery.data ?? []).map((row) => row.order_id),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createMutation.mutateAsync({
        order_id: orderId,
        rating,
        body,
        image_consent: imageFile ? consent : false,
        display_name: displayName,
        imageFile,
      });
      toast.success("Bewertung gesendet. Sie erscheint nach der Freigabe.");
      setBody("");
      setDisplayName("");
      setConsent(false);
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setOrderId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bewertung konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="PEPTIX"
        title="Feedback"
        description="Echte Erfahrungen. Echte Bestellungen."
      />

      <Card className="bg-card/95">
        <CardContent className="grid gap-6 p-5 sm:grid-cols-[auto_1fr]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Gesamtbewertung</p>
            <div className="flex items-center gap-3">
              <StarRating value={Math.round(average)} readOnly size="lg" />
              <span className="font-display text-3xl font-semibold">{formatAverageRating(average)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Basierend auf {ratings.length} verifizierten Bewertungen
            </p>
          </div>
          <ul className="space-y-1.5" aria-label="Sterneverteilung">
            {distribution.map((row) => (
              <li key={row.stars} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 tabular-nums">{row.stars} Sterne</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Eigene Bestellung bewerten</h2>
            <p className="text-sm text-muted-foreground">
              Jede eigene Bestellung. Eine Bewertung pro Bestellung. Veröffentlichung erst nach Freigabe.
            </p>
          </div>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aktuell ist keine weitere eigene Bestellung zur Bewertung verfügbar.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-order">Bestellung</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger id="feedback-order" aria-label="Bestellung auswählen">
                    <SelectValue placeholder="Bestellung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {feedbackOrderChoiceLabel(
                          order.order_number,
                          ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Label className="m-0 shrink-0 leading-none">Sterne</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-body">Deine Erfahrung</Label>
                <Textarea
                  id="feedback-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  minLength={FEEDBACK_BODY_MIN}
                  maxLength={FEEDBACK_BODY_MAX}
                  rows={5}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {body.trim().length} / {FEEDBACK_BODY_MAX} Zeichen (mindestens {FEEDBACK_BODY_MIN})
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-name">Anzeigename (optional)</Label>
                <Input
                  id="feedback-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  placeholder={FEEDBACK_DEFAULT_DISPLAY_NAME}
                />
                <p className="text-xs text-muted-foreground">
                  Ohne Angabe erscheint öffentlich „{FEEDBACK_DEFAULT_DISPLAY_NAME}“. E-Mail, Adresse und Telegram
                  werden nicht angezeigt.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Bestellfoto (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Dein Foto wird nach Freigabe zusammen mit deiner Bewertung öffentlich angezeigt.
                </p>
                <ImageDropzone
                  aspect="photo"
                  compact
                  previewUrl={imagePreview}
                  hint="JPG, PNG oder WEBP. Datei wählen oder per Drag & Drop."
                  label="Zeige anderen deine Bestellung"
                  onFile={(file) => {
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                  onRemove={() => {
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImageFile(null);
                    setImagePreview(null);
                    setConsent(false);
                  }}
                />
                {imageFile ? (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
                    <span>
                      Ich bin damit einverstanden, dass mein hochgeladenes Foto zusammen mit meiner Bewertung auf PEPTIX
                      veröffentlicht wird.
                    </span>
                  </label>
                ) : null}
              </div>
              <Button type="submit" loading={createMutation.isPending} disabled={!orderId || (Boolean(imageFile) && !consent)}>
                Bewertung senden
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {myFeedbackQuery.data && myFeedbackQuery.data.some((row) => row.status === "pending") ? (
        <p className="text-sm text-muted-foreground">Du hast Bewertungen, die auf Freigabe warten.</p>
      ) : null}

      {feedQuery.isLoading && page === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {feedQuery.isError ? (
        <ErrorState message="Feedback konnte nicht geladen werden." onRetry={() => feedQuery.refetch()} />
      ) : null}
      {feedQuery.data && visibleFeed.length === 0 && ratings.length === 0 ? (
        <EmptyState title="Noch keine veröffentlichten Bewertungen." />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleFeed.map((item, index) => (
          <FeedbackCard key={item.id} item={item} priority={page === 0 && index === 0} />
        ))}
      </div>
      {feedQuery.data && feedQuery.data.length === FEEDBACK_PAGE_SIZE * (page + 1) ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((current) => current + 1)}
          >
            Weitere Bewertungen
          </Button>
        </div>
      ) : null}
    </div>
  );
}
