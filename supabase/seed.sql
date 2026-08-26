-- seed.sql
-- Optional demo data for local development. NOT part of the migration chain
-- (so it never runs against a production project by accident). Apply
-- manually if you want sample products to try the app with:
--   supabase db execute -f supabase/seed.sql   (Supabase CLI)
-- or paste into the SQL Editor of a *development* project.

insert into public.products (code, name, description, category, price_usd, is_active)
values
  ('ART-1001', 'Bürostuhl ergonomisch', 'Höhenverstellbarer Bürostuhl mit Lordosenstütze', 'Büromöbel', 189.9000, true),
  ('ART-1002', 'Schreibtisch 160x80', 'Elektrisch höhenverstellbarer Schreibtisch', 'Büromöbel', 429.0000, true),
  ('ART-2001', 'USB-C Dockingstation', '11-in-1 Dockingstation mit Dual-HDMI', 'Elektronik', 79.5000, true),
  ('ART-2002', 'Monitor 27" 4K', 'IPS-Panel, 4K UHD, USB-C mit 90W Power Delivery', 'Elektronik', 349.0000, true),
  ('ART-3001', 'Kopierpapier A4 (Palette)', '80g/m², 500 Blatt je Ries, 100 Ries je Palette', 'Büromaterial', 620.0000, true),
  ('ART-3002', 'Kugelschreiber (Karton, 50 Stk.)', 'Blau schreibend, dokumentenecht', 'Büromaterial', 24.9900, true),
  ('ART-4001', 'Konferenzraum-Kamera', '4K PTZ-Kamera mit automatischer Rahmung', 'Elektronik', 899.0000, true),
  ('ART-4002', 'Whiteboard 120x90', 'Magnethaftend, mit Wandhalterung', 'Büromöbel', 96.0000, false)
on conflict (code) do nothing;
