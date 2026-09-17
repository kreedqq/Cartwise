import * as React from "react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  emptyProductForm,
  ProductFormSections,
} from "@/components/admin/ProductFormSections";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { uploadProductImage } from "@/services/productMedia";
import { createProduct, updateProductMediaFields } from "@/services/products";
import type { ProductFormSubmitExtras } from "@/components/admin/ProductFormSections";
import type { ProductWriteInput } from "@/services/products";

export default function AdminProductCreatePage() {
  const [form, setForm] = React.useState(emptyProductForm());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  async function handleSubmit(input: ProductWriteInput, extras: ProductFormSubmitExtras) {
    setLoading(true);
    try {
      const product = await createProduct(input);
      if (extras.imageFile) {
        const path = await uploadProductImage(product.id, extras.imageFile);
        await updateProductMediaFields(product.id, { imagePath: path });
      }
      setCreatedId(product.id);
      toast.success("Produkt erfolgreich angelegt.");
    } finally {
      setLoading(false);
    }
  }

  if (createdId) {
    return (
      <div className="space-y-6">
        <AdminPageHeader section="Produkte" subsection="Anlegen" title="Produkt angelegt" />
        <p className="text-sm text-muted-foreground">Das Produkt wurde im globalen Katalog gespeichert.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={`/admin/products/${createdId}/edit`}>Produkt öffnen</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreatedId(null);
              setForm(emptyProductForm());
              setErrors({});
            }}
          >
            Weiteres Produkt anlegen
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/admin/products">Zur Produktliste</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Produkte"
        subsection="Anlegen"
        title="Produkt anlegen"
        description="Manuell ohne Excel — gleiches Datenmodell wie der Import."
      />
      <ProductFormSections
        form={form}
        onChange={setForm}
        errors={errors}
        onErrorsChange={setErrors}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Produkt erstellen"
      />
    </div>
  );
}
