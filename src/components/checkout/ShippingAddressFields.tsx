import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CheckoutShippingField, CheckoutShippingForm, DeliveryMethod } from "@/lib/shippingAddress";

interface ShippingAddressFieldsProps {
  value: CheckoutShippingForm;
  onChange: (next: CheckoutShippingForm) => void;
  deliveryMethod: DeliveryMethod;
  errors?: Partial<Record<CheckoutShippingField, string>>;
}

export function ShippingAddressFields({
  value,
  onChange,
  deliveryMethod,
  errors,
}: ShippingAddressFieldsProps) {
  function patch<K extends keyof CheckoutShippingForm>(key: K, next: CheckoutShippingForm[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Lieferadresse</p>
        <p className="text-xs text-muted-foreground">
          Wird nur mit dieser Bestellung gespeichert. Spätere Profiländerungen ändern sie nicht.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="shipping-first-name">Vorname</Label>
          <Input
            id="shipping-first-name"
            autoComplete="given-name"
            value={value.firstName}
            invalid={!!errors?.firstName}
            onChange={(e) => patch("firstName", e.target.value)}
          />
          {errors?.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shipping-last-name">Nachname</Label>
          <Input
            id="shipping-last-name"
            autoComplete="family-name"
            value={value.lastName}
            invalid={!!errors?.lastName}
            onChange={(e) => patch("lastName", e.target.value)}
          />
          {errors?.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
        </div>
      </div>
      {deliveryMethod === "home" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="shipping-street">Straße</Label>
              <Input
                id="shipping-street"
                autoComplete="address-line1"
                value={value.street}
                invalid={!!errors?.street}
                onChange={(e) => patch("street", e.target.value)}
              />
              {errors?.street && <p className="text-xs text-destructive">{errors.street}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shipping-house-number">Hausnummer</Label>
              <Input
                id="shipping-house-number"
                autoComplete="address-line2"
                value={value.houseNumber}
                invalid={!!errors?.houseNumber}
                onChange={(e) => patch("houseNumber", e.target.value)}
              />
              {errors?.houseNumber && <p className="text-xs text-destructive">{errors.houseNumber}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipping-extra">Adresszusatz (optional)</Label>
            <Input
              id="shipping-extra"
              autoComplete="address-line3"
              value={value.addressExtra ?? ""}
              invalid={!!errors?.addressExtra}
              onChange={(e) => patch("addressExtra", e.target.value)}
            />
            {errors?.addressExtra && <p className="text-xs text-destructive">{errors.addressExtra}</p>}
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shipping-packstation">Packstation Nummer</Label>
            <Input
              id="shipping-packstation"
              inputMode="numeric"
              autoComplete="off"
              value={value.packstationNumber}
              invalid={!!errors?.packstationNumber}
              onChange={(e) => patch("packstationNumber", e.target.value)}
            />
            {errors?.packstationNumber && (
              <p className="text-xs text-destructive">{errors.packstationNumber}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipping-post-number">Postnummer</Label>
            <Input
              id="shipping-post-number"
              inputMode="numeric"
              autoComplete="off"
              value={value.postNumber}
              invalid={!!errors?.postNumber}
              onChange={(e) => patch("postNumber", e.target.value)}
            />
            {errors?.postNumber && <p className="text-xs text-destructive">{errors.postNumber}</p>}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="shipping-postal">PLZ</Label>
          <Input
            id="shipping-postal"
            autoComplete="postal-code"
            value={value.postalCode}
            invalid={!!errors?.postalCode}
            onChange={(e) => patch("postalCode", e.target.value)}
          />
          {errors?.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="shipping-city">Ort</Label>
          <Input
            id="shipping-city"
            autoComplete="address-level2"
            value={value.city}
            invalid={!!errors?.city}
            onChange={(e) => patch("city", e.target.value)}
          />
          {errors?.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shipping-country">Land</Label>
        <Input
          id="shipping-country"
          autoComplete="country-name"
          placeholder="Deutschland"
          value={value.country}
          invalid={!!errors?.country}
          onChange={(e) => patch("country", e.target.value)}
        />
        {errors?.country && <p className="text-xs text-destructive">{errors.country}</p>}
      </div>
    </div>
  );
}
