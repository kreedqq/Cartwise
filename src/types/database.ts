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
export type PaymentMethod = "crypto" | "bank_transfer" | "paypal";
export type KitShareStatus = "open" | "full" | "cancelled" | "ordered" | "expired";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          /** Unique public handle shown during kit sharing. Null until the user sets one. */
          username: string | null;
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
          name_ordinal: number;
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
          kit_share_id: string | null;
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
          payment_method: PaymentMethod | null;
          telegram_username_snapshot: string | null;
          shipping_delivery_method: "home" | "packstation" | null;
          shipping_first_name: string | null;
          shipping_last_name: string | null;
          shipping_street: string | null;
          shipping_house_number: string | null;
          shipping_address_extra: string | null;
          shipping_packstation_number: string | null;
          shipping_post_number: string | null;
          shipping_postal_code: string | null;
          shipping_city: string | null;
          shipping_country: string | null;
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
      kit_shares: {
        Row: {
          id: string;
          product_id: string;
          creator_user_id: string;
          kit_size_vials: number;
          status: KitShareStatus;
          is_open_request: boolean;
          note: string | null;
          expires_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kit_shares"]["Row"]> & {
          product_id: string;
          creator_user_id: string;
          kit_size_vials: number;
        };
        Update: Partial<Database["public"]["Tables"]["kit_shares"]["Row"]>;
        Relationships: never[];
      };
      kit_share_participants: {
        Row: {
          id: string;
          kit_share_id: string;
          user_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kit_share_participants"]["Row"]> & {
          kit_share_id: string;
          user_id: string;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["kit_share_participants"]["Row"]>;
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
      order_role_surcharge_lines: {
        Row: {
          order_item_id: string;
          order_id: string;
          catalog_unit_price_usd: number;
          selling_unit_price_usd: number;
          quantity: number;
          base_line_usd: number;
          selling_line_usd: number;
          surcharge_usd: number;
          customer_role_name_snapshot: string | null;
          created_at: string;
        };
        Insert: Database["public"]["Tables"]["order_role_surcharge_lines"]["Row"];
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
      research_runs: {
        Row: {
          id: string;
          run_type: "historical_import" | "migration_import" | "live";
          connector: string;
          query: string | null;
          batch_label: string | null;
          status: "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
          started_at: string | null;
          completed_at: string | null;
          sources_found: number | null;
          sources_accepted: number | null;
          sources_rejected: number | null;
          studies_found: number | null;
          studies_accepted: number | null;
          errors: string | null;
          operator_note: string | null;
          created_at: string;
          trigger_kind: string | null;
          substance_scope: string[];
          connector_scope: string[];
          statistics: unknown;
          error_summary: string | null;
          progress: unknown;
          schedule_kind: string | null;
          cancel_requested: boolean;
          parent_run_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["research_runs"]["Row"]> & {
          run_type: "historical_import" | "migration_import" | "live";
          connector: string;
          status: Database["public"]["Tables"]["research_runs"]["Row"]["status"];
        };
        Update: Partial<Database["public"]["Tables"]["research_runs"]["Row"]>;
        Relationships: never[];
      };
      sources: {
        Row: {
          id: string;
          source_type:
            | "fda"
            | "ema"
            | "bfarm"
            | "mhra"
            | "clinical_trial"
            | "pubmed"
            | "journal"
            | "systematic_review"
            | "review"
            | "meta_analysis"
            | "manufacturer"
            | "literature"
            | "scientific"
            | "regulatory"
            | "other";
          title: string;
          publisher: string | null;
          authors: string | null;
          publication_date: string | null;
          access_date: string | null;
          url: string;
          doi: string | null;
          pmid: string | null;
          nct_id: string | null;
          abstract: string | null;
          external_id: string | null;
          source_quality: number | null;
          status: "active" | "superseded" | "unavailable" | "rejected";
          review_status: "draft" | "review-required" | "approved" | "rejected";
          connector: string | null;
          legacy_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sources"]["Row"]> & {
          source_type: Database["public"]["Tables"]["sources"]["Row"]["source_type"];
          title: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Row"]>;
        Relationships: never[];
      };
      source_substances: {
        Row: {
          id: string;
          source_id: string;
          substance_id: string;
          legacy_source_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["source_substances"]["Row"]> & {
          source_id: string;
          substance_id: string;
          legacy_source_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["source_substances"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "source_substances_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_substances_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
      studies: {
        Row: {
          id: string;
          nct_id: string;
          title: string;
          sponsor: string | null;
          phase: string | null;
          status: string | null;
          enrollment: number | null;
          start_date: string | null;
          completion_date: string | null;
          last_updated: string | null;
          has_results: boolean;
          source_url: string;
          review_status: "draft" | "review-required" | "approved" | "rejected";
          intervention: string | null;
          condition: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["studies"]["Row"]> & {
          nct_id: string;
          title: string;
          source_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["studies"]["Row"]>;
        Relationships: never[];
      };
      study_substances: {
        Row: {
          id: string;
          study_id: string;
          substance_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["study_substances"]["Row"]> & {
          study_id: string;
          substance_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_substances"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "study_substances_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_substances_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
      study_sources: {
        Row: {
          id: string;
          study_id: string;
          source_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["study_sources"]["Row"]> & {
          study_id: string;
          source_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_sources"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "study_sources_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sources_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      research_run_sources: {
        Row: {
          id: string;
          research_run_id: string;
          source_id: string | null;
          discovered_at: string | null;
          accepted: boolean;
          rejection_reason: string | null;
          created_at: string;
          connector: string | null;
          retrieval_status: string | null;
          result_type: string | null;
          identifier: string | null;
          substance_slug: string | null;
          retrieved_at: string | null;
          error_text: string | null;
          previous_fields: unknown;
          current_fields: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["research_run_sources"]["Row"]> & {
          research_run_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["research_run_sources"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "research_run_sources_research_run_id_fkey";
            columns: ["research_run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_run_sources_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          id: string;
          stable_key: string;
          substance_id: string;
          claim_type:
            | "mechanism"
            | "effect"
            | "efficacy"
            | "safety"
            | "pharmacology"
            | "clinical_evidence"
            | "current_research"
            | "other";
          statement: string;
          status: "draft" | "review-required" | "approved" | "rejected";
          safety_category:
            | "common_adverse_event"
            | "serious_adverse_event"
            | "warning"
            | "contraindication"
            | "long_term_unknown"
            | "interaction"
            | null;
          supersedes_claim_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["claims"]["Row"]> & {
          stable_key: string;
          substance_id: string;
          claim_type: Database["public"]["Tables"]["claims"]["Row"]["claim_type"];
          statement: string;
          status: Database["public"]["Tables"]["claims"]["Row"]["status"];
        };
        Update: Partial<Database["public"]["Tables"]["claims"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "claims_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_sources: {
        Row: {
          id: string;
          claim_id: string;
          source_id: string;
          study_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["claim_sources"]["Row"]> & {
          claim_id: string;
          source_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["claim_sources"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "claim_sources_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_sources_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_sources_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence_assessments: {
        Row: {
          id: string;
          claim_id: string;
          evidence_level: "A" | "B" | "C" | "D" | "E" | "F" | null;
          confidence: "high" | "moderate" | "low" | "insufficient" | null;
          evidence_type:
            | "human"
            | "clinical_trial"
            | "observational"
            | "case_report"
            | "systematic_review"
            | "meta_analysis"
            | "animal"
            | "in_vitro"
            | "mechanistic"
            | "regulatory"
            | "other";
          rationale: string | null;
          review_status: "draft" | "review-required" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["evidence_assessments"]["Row"]> & {
          claim_id: string;
          evidence_type: Database["public"]["Tables"]["evidence_assessments"]["Row"]["evidence_type"];
          review_status: Database["public"]["Tables"]["evidence_assessments"]["Row"]["review_status"];
        };
        Update: Partial<Database["public"]["Tables"]["evidence_assessments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "evidence_assessments_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
        ];
      };
      regulatory_records: {
        Row: {
          id: string;
          stable_key: string;
          substance_id: string;
          authority: "fda" | "ema" | "bfarm" | "mhra" | "nmpa" | "other";
          region: "US" | "EU" | "UK" | "JP" | "CN" | "unspecified";
          status:
            | "approved"
            | "approved_specific_indication"
            | "clinical_development"
            | "investigational"
            | "not_approved"
            | "insufficient_information"
            | "unknown";
          indication: string | null;
          product_name: string | null;
          application_id: string | null;
          source_id: string;
          effective_date: string | null;
          last_checked: string | null;
          is_current: boolean;
          note: string | null;
          review_status: "draft" | "review-required" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["regulatory_records"]["Row"]> & {
          substance_id: string;
          authority: Database["public"]["Tables"]["regulatory_records"]["Row"]["authority"];
          region: Database["public"]["Tables"]["regulatory_records"]["Row"]["region"];
          status: Database["public"]["Tables"]["regulatory_records"]["Row"]["status"];
          source_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["regulatory_records"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "regulatory_records_substance_id_fkey";
            columns: ["substance_id"];
            isOneToOne: false;
            referencedRelation: "substances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regulatory_records_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      regulatory_history: {
        Row: {
          id: string;
          regulatory_record_id: string;
          old_status: string | null;
          new_status: string | null;
          old_indication: string | null;
          new_indication: string | null;
          source_id: string | null;
          changed_at: string;
          reason: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["regulatory_history"]["Row"]> & {
          regulatory_record_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["regulatory_history"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "regulatory_history_regulatory_record_id_fkey";
            columns: ["regulatory_record_id"];
            isOneToOne: false;
            referencedRelation: "regulatory_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "regulatory_history_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      review_actions: {
        Row: {
          id: string;
          entity_type:
            | "claim"
            | "evidence_assessment"
            | "regulatory_record"
            | "research_update"
            | "substance"
            | "source"
            | "study"
            | "community_report";
          entity_id: string | null;
          entity_stable_key: string | null;
          action: "approve" | "reject" | "request_review" | "edit" | "publish" | "unpublish";
          previous_status: string | null;
          new_status: string | null;
          reason: string | null;
          admin_user_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["review_actions"]["Row"]> & {
          entity_type: Database["public"]["Tables"]["review_actions"]["Row"]["entity_type"];
          action: Database["public"]["Tables"]["review_actions"]["Row"]["action"];
        };
        Update: Partial<Database["public"]["Tables"]["review_actions"]["Row"]>;
        Relationships: [];
      };
      research_connector_health: {
        Row: {
          id: string;
          connector: string;
          kind: "scientific" | "community";
          availability: "available" | "unavailable";
          last_successful_run_id: string | null;
          last_error: string | null;
          last_checked_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["research_connector_health"]["Row"]> & {
          connector: string;
          kind: "scientific" | "community";
          availability: "available" | "unavailable";
        };
        Update: Partial<Database["public"]["Tables"]["research_connector_health"]["Row"]>;
        Relationships: [];
      };
      community_reports: {
        Row: {
          id: string;
          substance_id: string;
          kind: "reddit" | "forum" | "blog" | "user-report";
          title: string;
          content_summary: string | null;
          source_url: string | null;
          author_identifier: string | null;
          published_at: string | null;
          retrieved_at: string | null;
          review_status: "draft" | "review-required" | "approved" | "rejected";
          source_metadata: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["community_reports"]["Row"]> & {
          substance_id: string;
          kind: "reddit" | "forum" | "blog" | "user-report";
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_reports"]["Row"]>;
        Relationships: [];
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
        Args: {
          _cart_id: string;
          _note: string | null;
          _payment_method?: PaymentMethod | null;
          _shipping_first_name?: string | null;
          _shipping_last_name?: string | null;
          _shipping_street?: string | null;
          _shipping_house_number?: string | null;
          _shipping_address_extra?: string | null;
          _shipping_postal_code?: string | null;
          _shipping_city?: string | null;
          _shipping_country?: string | null;
          _shipping_delivery_method?: "home" | "packstation" | null;
          _shipping_packstation_number?: string | null;
          _shipping_post_number?: string | null;
        };
        Returns: { orderId: string; orderNumber: string; totalUsd: number };
      };
      list_kit_share_members: {
        Args: Record<string, never>;
        Returns: { id: string; display_name: string }[];
      };
      create_kit_share: {
        Args: { _product_id: string; _kit_size_vials: number; _my_quantity: number };
        Returns: Record<string, unknown>;
      };
      invite_kit_share_participant: {
        Args: { _kit_share_id: string; _participant_user_id: string; _quantity: number };
        Returns: Record<string, unknown>;
      };
      join_kit_share: {
        Args: { _kit_share_id: string; _quantity: number };
        Returns: Record<string, unknown>;
      };
      update_kit_share_quantity: {
        Args: { _kit_share_id: string; _quantity: number };
        Returns: Record<string, unknown>;
      };
      update_kit_share_distribution: {
        Args: {
          _kit_share_id: string;
          _distribution: { userId: string; quantity: number }[];
        };
        Returns: Record<string, unknown>;
      };
      remove_kit_share_participant: {
        Args: { _kit_share_id: string; _participant_user_id: string };
        Returns: Record<string, unknown>;
      };
      username_available: {
        Args: { _username: string };
        Returns: boolean;
      };
      set_username: {
        Args: { _username: string };
        Returns: string;
      };
      get_my_kit_share: {
        Args: { _kit_share_id: string };
        Returns: Record<string, unknown>;
      };
      add_kit_share_to_cart: {
        Args: { _kit_share_id: string };
        Returns: string;
      };
      leave_kit_share: { Args: { _kit_share_id: string }; Returns: undefined };
      cancel_kit_share: { Args: { _kit_share_id: string }; Returns: undefined };
      create_kit_request: {
        Args: {
          _product_id: string;
          _kit_size_vials: number;
          _my_quantity: number;
          _note?: string | null;
          _expires_at?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      join_kit_request: {
        Args: { _kit_share_id: string; _quantity: number };
        Returns: Record<string, unknown>;
      };
      preview_kit_request_join: {
        Args: { _kit_share_id: string; _quantity: number };
        Returns: Record<string, unknown>;
      };
      leave_kit_request: { Args: { _kit_share_id: string }; Returns: Record<string, unknown> };
      cancel_kit_request: { Args: { _kit_share_id: string }; Returns: Record<string, unknown> };
      sync_completed_kit_request_carts: {
        Args: { _kit_share_id: string };
        Returns: Record<string, unknown>;
      };
      list_open_kit_requests: {
        Args: {
          _search?: string | null;
          _category?: string | null;
          _product_id?: string | null;
          _product_name?: string | null;
          _variant?: string | null;
          _min_remaining?: number | null;
          _sort?: string | null;
          _page?: number;
          _page_size?: number;
        };
        Returns: Record<string, unknown>;
      };
      list_my_kit_requests: { Args: Record<string, never>; Returns: Record<string, unknown> };
      list_my_kit_request_participations: { Args: Record<string, never>; Returns: Record<string, unknown> };
      get_kit_request: { Args: { _kit_share_id: string }; Returns: Record<string, unknown> };
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
