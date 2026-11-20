-- Téléphone décrit par Marque → Modèle → Série → Code (ex. Tecno → Camon → 11 → CF7).
-- Accessoires : téléphone compatible. Réparations : téléphone déposé.
-- À exécuter une fois dans Supabase (SQL Editor).

alter table public.products
  add column if not exists phone_brand text,
  add column if not exists phone_model text,
  add column if not exists phone_series text,
  add column if not exists phone_code text;

alter table public.repairs
  add column if not exists phone_brand text,
  add column if not exists phone_model text,
  add column if not exists phone_series text,
  add column if not exists phone_code text;

-- products est lu colonne par colonne (le prix d'achat reste caché aux vendeurs)
grant select (phone_brand, phone_model, phone_series, phone_code) on public.products to authenticated;
