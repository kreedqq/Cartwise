/**
 * Hand-written mirror of the Supabase schema defined in
 * supabase/migrations/*.sql. In a real deployment this file can be
 * regenerated from the live project with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * It is committed by hand here (no live project exists in this workspace)
 * so the rest of the codebase has full type safety against the schema. Keep
 * it in sync with the migrations whenever you change them.
 */

export type Role = "user" | "admin";
export type CartStatus = "draft" | "ready" | "ordered" | "archived";
export type ResolutionStatus = "resolved" | "not_found" | "inactive" | "pending";
export type PdfImportStatus = "uploaded" | "previewed" | "applied" | "failed" | "cancelled";
export type ImportRowQuality = "ok" | "warning" | "error";
export type OrderStatus = "pending" | "processing" | "confirmed" | "completed" | "cancelled";
export type ShippingCurrency = "USD" | "EUR";
/**
 * "auto" hands the create-vs-update decision to apply_pdf_import, which
 * resolves it by normalized article code at apply time. The explicit values
 * remain available as a manual override in the import preview.
 */
export type ImportRowAction = "auto" | "create" | "update" | "skip";
export type ImportRowResult = "created" | "updated" | "skipped" | "failed";
/** Which price tier produced the unit price applied to a cart line. */
export type PriceTier = "normal" | "bulk";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: never[];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Role;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> & {
          user_id: string;
          role: Role;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
        Relationships: never[];
      };
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          dosage_vial: string | null;
          category: string | null;
          price_usd: number;
          /** Optional volume price; NULL together with bulk_price_min_quantity. */
          bulk_price_usd: number | null;
          /** Quantity from which bulk_price_usd replaces price_usd for every unit. */
          bulk_price_min_quantity: number | null;
          currency: "USD";
          is_active: boolean;
          last_price_change_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          code: string;
          name: string;
          price_usd: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: never[];
      };
      product_price_history: {
        Row: {
          id: string;
          product_id: string;
          old_price_usd: number | null;
          new_price_usd: number;
          old_bulk_price_usd: number | null;
          new_bulk_price_usd: number | null;
          old_bulk_price_min_quantity: number | null;
          new_bulk_price_min_quantity: number | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_price_history"]["Row"]> & {
          product_id: string;
          new_price_usd: number;
        };
        Update: never;
        Relationships: never[];
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: CartStatus;
          note: string | null;
          is_active_cart: boolean;
          deleted_at: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["carts"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["carts"]["Row"]>;
        Relationships: never[];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          position: number;
          product_id: string | null;
          product_code_input: string;
          product_code_snapshot: string | null;
          product_name_snapshot: string | null;
          quantity: number;
          /** The unit price actually applied (normal or bulk tier). */
          unit_price_usd_snapshot: number | null;
          /** Frozen catalog normal price, used to re-select the tier on a quantity edit. */
          normal_price_usd_snapshot: number | null;
          bulk_price_usd_snapshot: number | null;
          bulk_price_min_quantity_snapshot: number | null;
          applied_price_tier: PriceTier | null;
          exchange_rate_snapshot: number | null;
          eur_value_snapshot: number | null;
          price_snapshot_at: string | null;
          resolution_status: ResolutionStatus;
          note: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cart_items"]["Row"]> & {
          cart_id: string;
          product_code_input: string;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Row"]>;
        Relationships: never[];
      };
      exchange_rates: {
        Row: {
          id: string;
          base_currency: string;
          quote_currency: string;
          rate: number;
          source: string;
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exchange_rates"]["Row"]> & {
          rate: number;
          source: string;
        };
        Update: never;
        Relationships: never[];
      };
      pdf_imports: {
        Row: {
          id: string;
          uploaded_by: string | null;
          file_path: string;
          file_name: string;
          file_size_bytes: number;
          status: PdfImportStatus;
          has_text_layer: boolean | null;
          summary_created: number;
          summary_updated: number;
          summary_skipped: number;
          summary_failed: number;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pdf_imports"]["Row"]> & {
          file_path: string;
          file_name: string;
          file_size_bytes: number;
        };
        Update: Partial<Database["public"]["Tables"]["pdf_imports"]["Row"]>;
        Relationships: never[];
      };
      pdf_import_rows: {
        Row: {
          id: string;
          import_id: string;
          row_number: number;
          raw_text: string;
          parsed_code: string | null;
          parsed_name: string | null;
          parsed_dosage_vial: string | null;
          parsed_description: string | null;
          parsed_category: string | null;
          parsed_price_usd: number | null;
          parsed_bulk_price_usd: number | null;
          parsed_bulk_price_min_quantity: number | null;
          parsed_is_active: boolean | null;
          quality: ImportRowQuality;
          quality_reason: string | null;
          action: ImportRowAction | null;
          target_product_id: string | null;
          result: ImportRowResult | null;
          result_message: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["pdf_import_rows"]["Row"]> & {
          import_id: string;
          row_number: number;
          raw_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["pdf_import_rows"]["Row"]>;
        Relationships: never[];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Record<string, unknown> | null;
          after_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: never;
        Relationships: never[];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          cart_id: string | null;
          status: OrderStatus;
          note: string | null;
          total_usd: number;
          total_eur: number | null;
          exchange_rate: number | null;
          submitted_at: string;
          created_at: string;
          updated_at: string;
          china_shipping_amount: number | null;
          china_shipping_currency: ShippingCurrency | null;
          de_shipping_amount: number | null;
          de_shipping_currency: ShippingCurrency | null;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: never[];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          position: number;
          product_id: string | null;
          product_code_snapshot: string;
          product_name_snapshot: string;
          dosage_vial_snapshot: string | null;
          description_snapshot: string | null;
          normal_price_usd_snapshot: number;
          bulk_price_usd_snapshot: number | null;
          bulk_price_min_quantity_snapshot: number | null;
          applied_price_tier: PriceTier;
          unit_price_usd_snapshot: number;
          quantity: number;
          line_total_usd: number;
          exchange_rate_snapshot: number | null;
          eur_value_snapshot: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
        };
        Update: never;
        Relationships: never[];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          old_status: OrderStatus | null;
          new_status: OrderStatus;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_status_history"]["Row"]> & {
          order_id: string;
          new_status: OrderStatus;
        };
        Update: never;
        Relationships: never[];
      };
      product_favorites: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_favorites"]["Row"]> & {
          user_id: string;
          product_id: string;
        };
        Update: never;
        Relationships: never[];
      };
      order_admin_notes: {
        Row: {
          order_id: string;
          note: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_admin_notes"]["Row"]> & {
          order_id: string;
          note: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_admin_notes"]["Row"]>;
        Relationships: never[];
      };
      order_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_templates"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_templates"]["Row"]>;
        Relationships: never[];
      };
      order_template_items: {
        Row: {
          id: string;
          template_id: string;
          position: number;
          product_code: string;
          quantity: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_template_items"]["Row"]> & {
          template_id: string;
          product_code: string;
          quantity: number;
        };
        Update: never;
        Relationships: never[];
      };
      customer_roles: {
        Row: {
          id: string;
          name: string;
          markup_percent: number;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customer_roles"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_roles"]["Row"]>;
        Relationships: never[];
      };
      user_customer_roles: {
        Row: {
          user_id: string;
          role_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Database["public"]["Tables"]["user_customer_roles"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_customer_roles"]["Row"]>;
        Relationships: never[];
      };
      substances: {
        Row: {
          id: string;
          slug: string;
          name: string;
          display_name: string;
          category: string;
          molecule_type: string | null;
          chemical_class: string | null;
          cas_number: string | null;
          description: string | null;
          identity_note: string | null;
          status: "active" | "deprecated" | "merged" | "placeholder" | "blend";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["substances"]["Row"]> & {
          slug: string;
          name: string;
          display_name: string;
          category: string;
        };
        Update: Partial<Database["public"]["Tables"]["substances"]["Row"]>;
        Relationships: never[];
      };
      substance_aliases: {
        Row: {
          id: string;
          substance_id: string;
          alias: string;
          alias_type:
            | "common_name"
            | "development_name"
            | "abbreviation"
            | "chemical_name"
            | "brand_name"
            | "other";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["substance_aliases"]["Row"]> & {
          substance_id: string;
          alias: string;
          alias_type: Database["public"]["Tables"]["substance_aliases"]["Row"]["alias_type"];
        };
        Update: Partial<Database["public"]["Tables"]["substance_aliases"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "substance_aliases_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
      substance_components: {
        Row: {
          id: string;
          blend_id: string;
          component_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["substance_components"]["Row"]> & {
          blend_id: string;
          component_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["substance_components"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "substance_components_blend_id_fkey";
            columns: ["blend_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "substance_components_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
      product_substances: {
        Row: {
          id: string;
          product_id: string;
          substance_id: string;
          mapping_method: "prefix" | "name" | "manual";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_substances"]["Row"]> & {
          product_id: string;
          substance_id: string;
          mapping_method: "prefix" | "name" | "manual";
        };
        Update: Partial<Database["public"]["Tables"]["product_substances"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "product_substances_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_substances_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      cart_summaries: {
        Row: {
          cart_id: string;
          item_count: number;
          total_quantity: number;
          total_usd: number;
          total_eur: number | null;
          unresolved_count: number;
          missing_price_count: number;
          latest_price_snapshot_at: string | null;
        };
        Relationships: never[];
      };
      admin_user_directory: {
        Row: {
          id: string;
          email: string | null;
          display_name: string;
          created_at: string;
        };
        Relationships: never[];
      };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: string }; Returns: boolean };
      product_is_referenced: { Args: { _product_id: string }; Returns: boolean };
      set_active_cart: { Args: { _cart_id: string }; Returns: undefined };
      duplicate_cart: { Args: { _cart_id: string; _new_name: string }; Returns: string };
      apply_pdf_import: {
        Args: {
          _file_path: string;
          _file_name: string;
          _file_size_bytes: number;
          _has_text_layer: boolean | null;
          _rows: unknown;
        };
        Returns: { importId: string; created: number; updated: number; skipped: number; failed: number };
      };
      log_audit: {
        Args: {
          _actor_id: string | null;
          _action: string;
          _entity_type: string;
          _entity_id: string | null;
          _before: unknown;
          _after: unknown;
        };
        Returns: undefined;
      };
      create_order: {
        Args: { _cart_id: string; _note: string | null };
        Returns: { orderId: string; orderNumber: string; totalUsd: number };
      };
      set_order_status: {
        Args: { _order_id: string; _status: OrderStatus; _admin_note: string | null };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      list_shop_products: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["products"]["Row"][] };
      get_shop_product_by_code: {
        Args: { _code: string };
        Returns: Database["public"]["Tables"]["products"]["Row"] | null;
      };
      get_my_customer_role_name: { Args: Record<string, never>; Returns: string | null };
      sync_cart_selling_prices: { Args: { _cart_id: string }; Returns: undefined };
      admin_upsert_customer_role: {
        Args: { _id: string | null; _name: string; _markup_percent: number; _is_active: boolean };
        Returns: Database["public"]["Tables"]["customer_roles"]["Row"];
      };
      admin_delete_customer_role: { Args: { _id: string }; Returns: undefined };
      admin_assign_customer_role: { Args: { _user_id: string; _role_id: string }; Returns: undefined };
      admin_set_de_shipping: {
        Args: { _order_id: string; _amount: number | null; _currency: ShippingCurrency | null };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      admin_clear_china_shipping: {
        Args: { _order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      admin_preview_china_split: {
        Args: { _amount: number; _order_ids: string[] };
        Returns: { shares: number[]; total: number; count: number };
      };
      admin_apply_china_split: {
        Args: { _amount: number; _currency: ShippingCurrency; _order_ids: string[] };
        Returns: { shares: number[]; total: number; count: number };
      };
      delete_order: { Args: { _order_id: string }; Returns: undefined };
      refresh_product_substance_prefix_mappings: { Args: Record<string, never>; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Read-only aggregate view (see supabase/migrations/0013_cart_summary_view.sql). */
export interface CartSummaryRow {
  cart_id: string;
  item_count: number;
  total_quantity: number;
  total_usd: number;
  total_eur: number | null;
  unresolved_count: number;
  missing_price_count: number;
  latest_price_snapshot_at: string | null;
}
