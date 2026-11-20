-- Types d'accessoires (table categories) : la liste de la boutique, puis ceux ajoutés via « Autre… ».
-- À exécuter dans Supabase (SQL Editor). Peut être relancé sans risque : rien n'est ajouté en double.

-- Les vendeurs enregistrent les accessoires : ils peuvent donc ajouter un nouveau type
drop policy if exists "Création" on public.categories;
create policy "Création" on public.categories for insert to authenticated with check (true);

insert into public.categories (name)
select t.name
  from (values ('Circuit de charge'), ('Écran'), ('Chargeur'), ('Couverture'), ('Vitre de photo'),
               ('Vitre d''écran'), ('Bouton allumage'), ('Tactile')) as t(name)
 where not exists (select 1 from public.categories c where lower(c.name) = lower(t.name));
