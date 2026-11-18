-- Photo de l'appareil déposé en réparation (état à la réception).
-- À exécuter une fois dans Supabase (SQL Editor).

alter table public.repairs add column if not exists photo_path text;

-- Espace de stockage privé : les photos ne sont visibles que par le personnel connecté
insert into storage.buckets (id, name, public)
values ('repair-photos', 'repair-photos', false)
on conflict (id) do nothing;

drop policy if exists "Photos SAV lecture" on storage.objects;
create policy "Photos SAV lecture" on storage.objects for select to authenticated
  using (bucket_id = 'repair-photos');

drop policy if exists "Photos SAV ajout" on storage.objects;
create policy "Photos SAV ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'repair-photos');
