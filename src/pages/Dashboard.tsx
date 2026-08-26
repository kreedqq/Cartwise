import { ShoppingBasket } from "lucide-react";

import { CreateCartDialog } from "@/components/cart/CreateCartDialog";
import { CartCard } from "@/components/cart/CartCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCarts } from "@/hooks/useCarts";
import { useCartSummaries } from "@/hooks/useCartSummaries";

export default function DashboardPage() {
  const cartsQuery = useCarts();
  const summariesQuery = useCartSummaries();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deine Warenkörbe</h1>
          <p className="text-sm text-muted-foreground">
            Verwalte Warenkörbe und Bestelllisten – dein aktiver Warenkorb ist hervorgehoben.
          </p>
        </div>
        <CreateCartDialog />
      </div>

      {cartsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {cartsQuery.isError && (
        <ErrorState message="Warenkörbe konnten nicht geladen werden." onRetry={() => cartsQuery.refetch()} />
      )}

      {cartsQuery.data && cartsQuery.data.length === 0 && (
        <EmptyState
          icon={ShoppingBasket}
          title="Noch keine Warenkörbe"
          description="Erstelle deinen ersten Warenkorb, um Artikel zu sammeln und Summen in USD und EUR zu sehen."
          action={<CreateCartDialog />}
        />
      )}

      {cartsQuery.data && cartsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cartsQuery.data.map((cart) => (
            <CartCard key={cart.id} cart={cart} summary={summariesQuery.data?.get(cart.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
