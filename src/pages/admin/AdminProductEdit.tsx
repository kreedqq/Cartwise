import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  emptyProductForm,
  ProductFormSections,
} from "@/components/admin/ProductFormSections";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { listAllProducts, updateProduct } from "@/services/products";
import type { Tables } from "@/types/database";

function ProductEditForm({
  product,
  onSaved,
}: {
  product: Tables<"products">;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState(() => emptyProductForm(product));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(input: Parameters<typeof updateProduct>[1], _extras: unknown) {
    setLoading(true);
    try {
      await updateProduct(product.id, input);
      onSaved();
      toast.success("Produkt aktualisiert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProductFormSections
      form={form}
      onChange={setForm}
      errors={errors}
      onErrorsChange={setErrors}
      onSubmit={handleSubmit}
      loading={loading}
      submitLabel="Änderungen speichern"
      productId={product.id}
    />
  );
}

export default function AdminProductEditPage() {
  const { productId } = useParams<{ productId: string }>();
  const queryClient = useQueryClient();
  const productsQuery = useQuery({
    queryKey: ["admin-products-edit", productId],
    queryFn: async () => {
      const all = await listAllProducts();
      const product = all.find((p) => p.id === productId);
      if (!product) throw new Error("Produkt nicht gefunden.");
      return product;
    },
    enabled: Boolean(productId),
  });

  if (productsQuery.isLoading) {
    return <Skeleton className="h-64 w-full max-w-xl" />;
  }
  if (productsQuery.isError) {
    return (
      <ErrorState
        message="Produkt konnte nicht geladen werden."
        onRetry={() => productsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Produkte"
        subsection="Bearbeiten"
        title={productsQuery.data?.name ?? "Produkt bearbeiten"}
        description={productsQuery.data?.code}
        actions={
          <Link to="/admin/products" className="text-sm text-primary hover:underline">
            Zur Liste
          </Link>
        }
      />
      {productsQuery.data ? (
        <ProductEditForm
          key={productsQuery.data.id}
          product={productsQuery.data}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-products"] })}
        />
      ) : null}
    </div>
  );
}
