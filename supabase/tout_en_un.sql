-- ============================================================
-- TOUT-EN-UN : à coller en une fois dans Supabase > SQL Editor > New query > Run
-- Contient, dans l'ordre : decrement_stock, credit_payments, stock_entries, profiles, rls_policies
-- ============================================================


-- ############################################################
-- decrement_stock.sql
-- ############################################################

-- Décrémente le stock d'un produit en une seule opération atomique.
-- Refuse la mise à jour si le stock est insuffisant (aucun stock négatif possible).
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.

create or replace function public.decrement_stock(row_id uuid, qty integer)
returns void
language plpgsql
as $$
begin
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


-- ############################################################
-- credit_payments.sql
-- ############################################################

-- Ventes à crédit : enregistre l'acompte et chaque remboursement d'une vente
-- dont le mode de paiement est 'credit'. Le reste dû = total de la vente - somme des paiements.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.

create table if not exists public.credit_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid references public.customers(id),
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists credit_payments_sale_id_idx on public.credit_payments (sale_id);

alter table public.credit_payments enable row level security;

drop policy if exists "Utilisateurs connectés" on public.credit_payments;
create policy "Utilisateurs connectés"
  on public.credit_payments
  for all
  to authenticated
  using (true)
  with check (true);


-- ############################################################
-- stock_entries.sql
-- ############################################################

-- Réapprovisionnements : historique des entrées de stock et fonction atomique
-- qui ajoute la quantité au produit et enregistre l'entrée dans la même transaction.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.

create table if not exists public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  supplier text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists stock_entries_product_id_idx on public.stock_entries (product_id);
create index if not exists stock_entries_created_at_idx on public.stock_entries (created_at desc);

alter table public.stock_entries enable row level security;

drop policy if exists "Utilisateurs connectés" on public.stock_entries;
create policy "Utilisateurs connectés"
  on public.stock_entries
  for all
  to authenticated
  using (true)
  with check (true);

-- Ajoute du stock et enregistre l'entrée. Met à jour le prix d'achat si demandé.
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
as $$
declare
  v_entry public.stock_entries;
begin
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
$$;

grant execute on function public.restock_product(uuid, integer, numeric, text, text, boolean) to authenticated;


-- ############################################################
-- profiles.sql
-- ############################################################

-- Utilisateurs : profils (nom, rôle) et traçabilité du vendeur.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- Les comptes se créent toujours dans Authentication > Users ; un profil est créé
-- automatiquement pour chacun. Le premier compte devient administrateur.

-- 1. Table des profils ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  created_at timestamptz not null default now()
);

-- Vrai si l'utilisateur connecté est administrateur
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;

drop policy if exists "Lecture par les utilisateurs connectés" on public.profiles;
create policy "Lecture par les utilisateurs connectés"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Modification par les administrateurs" on public.profiles;
create policy "Modification par les administrateurs"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Profil créé automatiquement à chaque nouveau compte ------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    case when exists (select 1 from public.profiles where role = 'admin') then 'seller' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils des comptes qui existent déjà (le plus ancien devient administrateur s'il n'y en a pas)
insert into public.profiles (id, email, full_name, role, created_at)
select u.id, u.email, split_part(u.email, '@', 1), 'seller', u.created_at
  from auth.users u
on conflict (id) do nothing;

update public.profiles
   set role = 'admin'
 where id = (select id from public.profiles order by created_at limit 1)
   and not exists (select 1 from public.profiles where role = 'admin');

-- 3. Toujours garder au moins un administrateur -------------------------------
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'admin' and new.role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Il doit rester au moins un administrateur';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_one_admin on public.profiles;
create trigger profiles_keep_one_admin
  before update on public.profiles
  for each row execute function public.keep_one_admin();

-- 4. Qui a fait quoi ----------------------------------------------------------
-- Le vendeur est renseigné automatiquement par la base (utilisateur connecté).
alter table public.sales add column if not exists seller_id uuid references auth.users(id) default auth.uid();
alter table public.cash_registers add column if not exists opened_by uuid references auth.users(id) default auth.uid();
alter table public.cash_registers add column if not exists closed_by uuid references auth.users(id);

-- Enregistre qui ferme la caisse au moment de la clôture
create or replace function public.set_register_closed_by()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'closed' and coalesce(old.status, '') <> 'closed' then
    new.closed_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists cash_registers_closed_by on public.cash_registers;
create trigger cash_registers_closed_by
  before update on public.cash_registers
  for each row execute function public.set_register_closed_by();

-- Paiements de crédit (si la table existe déjà, voir credit_payments.sql)
do $$
begin
  if to_regclass('public.credit_payments') is not null then
    alter table public.credit_payments add column if not exists created_by uuid references auth.users(id) default auth.uid();
  end if;
end;
$$;


-- ############################################################
-- rls_policies.sql
-- ############################################################

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
