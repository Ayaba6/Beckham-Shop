-- Règles d'accès (RLS) par rôle : appliquées par la base de données elle-même,
-- même si quelqu'un interroge Supabase sans passer par l'application.
--
-- À exécuter EN DERNIER, après : decrement_stock.sql, credit_payments.sql,
-- stock_entries.sql et profiles.sql. Peut être relancé sans risque.
--
-- ATTENTION : ce script SUPPRIME toutes les règles existantes des tables listées
-- plus bas et les remplace par celles-ci. Les visiteurs non connectés (clé anon)
-- n'ont plus aucun accès aux données.
--
-- Résumé :
--   Tout utilisateur connecté : lire les produits (sans prix d'achat), vendre,
--     gérer les clients, le SAV, les crédits, ouvrir et fermer la caisse.
--   Administrateur uniquement : prix d'achat, créer/modifier/supprimer des produits
--     et catégories, réapprovisionner, voir les entrées de stock, supprimer des
--     ventes, clients, réparations ou paiements.

-- 0. Vérifier que les scripts précédents ont été exécutés ------------------------
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Exécutez d''abord supabase/profiles.sql';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sales' and column_name = 'seller_id'
  ) then
    raise exception 'Colonne sales.seller_id absente : exécutez d''abord supabase/profiles.sql';
  end if;
end;
$$;

-- 1. Activer RLS et repartir de zéro sur chaque table --------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'categories', 'products', 'product_imeis', 'customers', 'sales', 'sale_items',
    'cash_registers', 'repairs', 'credit_payments', 'stock_entries'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    end if;
  end loop;
end;
$$;

-- 2. Catalogue : lecture pour tous, écriture pour les administrateurs ----------
create policy "Lecture" on public.categories for select to authenticated using (true);
create policy "Écriture admin" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Lecture" on public.products for select to authenticated using (true);
create policy "Écriture admin" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Lecture" on public.product_imeis for select to authenticated using (true);
create policy "Écriture admin" on public.product_imeis for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. Prix d'achat invisible pour les vendeurs ----------------------------------
-- La lecture se fait colonne par colonne : toutes sauf purchase_price.
revoke select on public.products from anon, authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'products' and column_name <> 'purchase_price';
  execute format('grant select (%s) on public.products to authenticated', cols);
end;
$$;

-- Les administrateurs lisent les prix d'achat via cette fonction
create or replace function public.get_product_costs()
returns table (id uuid, purchase_price numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.purchase_price::numeric from public.products p where public.is_admin();
$$;
grant execute on function public.get_product_costs() to authenticated;

-- 4. Baisse du stock à la vente : autorisée pour tous, mais seulement via cette
--    fonction (les vendeurs ne peuvent pas modifier les produits directement)
create or replace function public.decrement_stock(row_id uuid, qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if qty is null or qty <= 0 then
    raise exception 'Quantité invalide';
  end if;

  update public.products
     set stock_quantity = stock_quantity - qty
   where id = row_id
     and stock_quantity >= qty;

  if not found then
    raise exception 'Stock insuffisant pour le produit %', row_id;
  end if;
end;
$$;
grant execute on function public.decrement_stock(uuid, integer) to authenticated;

-- 5. Ventes ------------------------------------------------------------------
create policy "Lecture" on public.sales for select to authenticated using (true);
create policy "Création par le vendeur connecté" on public.sales for insert to authenticated
  with check (seller_id = auth.uid());
create policy "Modification admin" on public.sales for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Le vendeur peut annuler sa propre vente dans les 10 minutes (échec d'encaissement)
create policy "Suppression" on public.sales for delete to authenticated
  using (public.is_admin() or (seller_id = auth.uid() and created_at > now() - interval '10 minutes'));

create policy "Lecture" on public.sale_items for select to authenticated using (true);
create policy "Création" on public.sale_items for insert to authenticated with check (true);
create policy "Modification admin" on public.sale_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Suppression admin" on public.sale_items for delete to authenticated
  using (public.is_admin());

-- 6. Caisse, clients, SAV : usage courant pour tous, suppression admin ------------
create policy "Lecture" on public.cash_registers for select to authenticated using (true);
create policy "Ouverture" on public.cash_registers for insert to authenticated with check (true);
create policy "Clôture" on public.cash_registers for update to authenticated using (true) with check (true);
create policy "Suppression admin" on public.cash_registers for delete to authenticated
  using (public.is_admin());

create policy "Lecture" on public.customers for select to authenticated using (true);
create policy "Création" on public.customers for insert to authenticated with check (true);
create policy "Modification" on public.customers for update to authenticated using (true) with check (true);
create policy "Suppression admin" on public.customers for delete to authenticated
  using (public.is_admin());

create policy "Lecture" on public.repairs for select to authenticated using (true);
create policy "Création" on public.repairs for insert to authenticated with check (true);
create policy "Modification" on public.repairs for update to authenticated using (true) with check (true);
create policy "Suppression admin" on public.repairs for delete to authenticated
  using (public.is_admin());

-- 7. Crédits : tout le monde encaisse, seul l'admin corrige ou supprime ----------
do $$
begin
  if to_regclass('public.credit_payments') is not null then
    execute 'create policy "Lecture" on public.credit_payments for select to authenticated using (true)';
    execute 'create policy "Création" on public.credit_payments for insert to authenticated with check (true)';
    execute 'create policy "Modification admin" on public.credit_payments for update to authenticated
               using (public.is_admin()) with check (public.is_admin())';
    execute 'create policy "Suppression admin" on public.credit_payments for delete to authenticated
               using (public.is_admin())';
  end if;
end;
$$;

-- 8. Entrées de stock (coûts d'achat) : administrateurs uniquement --------------
do $$
begin
  if to_regclass('public.stock_entries') is not null then
    execute 'create policy "Admin" on public.stock_entries for all to authenticated
               using (public.is_admin()) with check (public.is_admin())';

    execute $f$
      create or replace function public.restock_product(
        p_product_id uuid,
        p_quantity integer,
        p_unit_cost numeric,
        p_supplier text default null,
        p_notes text default null,
        p_update_price boolean default true
      )
      returns public.stock_entries
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_entry public.stock_entries;
      begin
        if not public.is_admin() then
          raise exception 'Réservé aux administrateurs';
        end if;
        if p_quantity is null or p_quantity <= 0 then
          raise exception 'Quantité invalide';
        end if;

        update public.products
           set stock_quantity = stock_quantity + p_quantity,
               purchase_price = case when p_update_price then p_unit_cost else purchase_price end
         where id = p_product_id;

        if not found then
          raise exception 'Produit introuvable';
        end if;

        insert into public.stock_entries (product_id, quantity, unit_cost, supplier, notes)
        values (p_product_id, p_quantity, coalesce(p_unit_cost, 0), nullif(trim(p_supplier), ''), nullif(trim(p_notes), ''))
        returning * into v_entry;

        return v_entry;
      end;
      $body$
    $f$;
  end if;
end;
$$;
