-- seed.sql
-- Optional demo data for local development. NOT part of the migration chain
-- (so it never runs against a production project by accident). Apply
-- manually if you want sample products to try the app with:
--   supabase db execute -f supabase/seed.sql   (Supabase CLI)
-- or paste into the SQL Editor of a *development* project.
--
-- ART-5001 is the worked example from the pricing spec: 1-9 units cost 60 USD
-- each, from 10 units on every unit costs 55 USD (12 x 55 = 660).

insert into public.products (
  code, name, dosage_vial, description, category,
  price_usd, bulk_price_usd, bulk_price_min_quantity, is_active
)
values
  ('ART-1001', 'Bürostuhl ergonomisch', null, 'Höhenverstellbarer Bürostuhl mit Lordosenstütze', 'Büromöbel', 189.9000, null, null, true),
  ('ART-1002', 'Schreibtisch 160x80', null, 'Elektrisch höhenverstellbarer Schreibtisch', 'Büromöbel', 429.0000, 399.0000, 5, true),
  ('ART-2001', 'USB-C Dockingstation', null, '11-in-1 Dockingstation mit Dual-HDMI', 'Elektronik', 79.5000, 69.5000, 10, true),
  ('ART-2002', 'Monitor 27" 4K', null, 'IPS-Panel, 4K UHD, USB-C mit 90W Power Delivery', 'Elektronik', 349.0000, null, null, true),
  ('ART-3001', 'Kopierpapier A4 (Palette)', null, '80g/m², 500 Blatt je Ries, 100 Ries je Palette', 'Büromaterial', 620.0000, null, null, true),
  ('ART-3002', 'Kugelschreiber (Karton, 50 Stk.)', null, 'Blau schreibend, dokumentenecht', 'Büromaterial', 24.9900, 19.9900, 20, true),
  ('ART-4001', 'Konferenzraum-Kamera', null, '4K PTZ-Kamera mit automatischer Rahmung', 'Elektronik', 899.0000, null, null, true),
  ('ART-4002', 'Whiteboard 120x90', null, 'Magnethaftend, mit Wandhalterung', 'Büromöbel', 96.0000, null, null, false),
  ('ART-5001', 'Beispielpräparat A', '10 mg / Vial', 'Referenzartikel für die Mengenpreis-Logik', 'Präparate', 60.0000, 55.0000, 10, true),
  ('ART-5002', 'Beispielpräparat B', '5 mg / Vial', 'Referenzartikel ohne Mengenpreis', 'Präparate', 42.0000, null, null, true)
on conflict (code) do nothing;
