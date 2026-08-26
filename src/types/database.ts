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
export type ImportRowAction = "create" | "update" | "skip";
export type ImportRowResult = "created" | "updated" | "skipped" | "failed";

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
          category: string | null;
          price_usd: number;
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
          unit_price_usd_snapshot: number | null;
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
          parsed_price_usd: number | null;
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
