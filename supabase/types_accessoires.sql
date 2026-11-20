-- Types d'accessoires (table categories) : Écran, Circuit de charge, puis ceux ajoutés via « Autre… ».
-- À exécuter une fois dans Supabase (SQL Editor).

-- Les vendeurs enregistrent les accessoires : ils peuvent donc ajouter un nouveau type
drop policy if exists "Création" on public.categories;
create policy "Création" on public.categories for insert to authenticated with check (true);

insert into public.categories (name)
select t.name
  from (values ('Écran'), ('Circuit de charge')) as t(name)
 where not exists (select 1 from public.categories c where lower(c.name) = lower(t.name));
