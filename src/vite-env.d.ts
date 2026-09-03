/// <reference types="vite/client" />

declare module "*.csv?raw" {
  const content: string;
  export default content;
}

declare module "*.jpg?inline" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_RESEARCH_DB_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
