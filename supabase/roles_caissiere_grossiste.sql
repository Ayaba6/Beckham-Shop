-- Rôles : Administrateur, Caissière (ventes, caisse, crédits, SAV) et Vendeur (réception du stock
-- et consultation des produits). Ajoute aussi le prix grossiste.
-- À exécuter une fois dans Supabase (SQL Editor), après rls_policies.sql.

-- 1. Nouveau rôle « cashier » ; les anciens vendeurs deviennent caissières ---------------
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'cashier' where role = 'seller';
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'cashier', 'seller'));

-- Vrai pour l'administrateur et la caissière : eux seuls encaissent
create or replace function public.can_sell()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'cashier'));
$$;

-- 2. Ventes, caisse et paiements de crédit réservés à l'administrateur et à la caissière --
drop policy if exists "Création par le vendeur connecté" on public.sales;
create policy "Création par le vendeur connecté" on public.sales for insert to authenticated
  with check (seller_id = auth.uid() and public.can_sell());

drop policy if exists "Création" on public.sale_items;
create policy "Création" on public.sale_items for insert to authenticated
  with check (public.can_sell());

drop policy if exists "Ouverture" on public.cash_registers;
create policy "Ouverture" on public.cash_registers for insert to authenticated
  with check (public.can_sell());
drop policy if exists "Clôture" on public.cash_registers;
create policy "Clôture" on public.cash_registers for update to authenticated
  using (public.can_sell()) with check (public.can_sell());

do $$
begin
  if to_regclass('public.credit_payments') is not null then
    execute 'drop policy if exists "Création" on public.credit_payments';
    execute 'create policy "Création" on public.credit_payments for insert to authenticated
               with check (public.can_sell())';
  end if;
end;
$$;

create or replace function public.decrement_stock(row_id uuid, qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_sell() then
    raise exception 'Seuls l''administrateur et la caissière vendent';
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

-- 3. Prix grossiste (fixé par l'administrateur, visible par tous) -------------------------
alter table public.products add column if not exists wholesale_price numeric not null default 0;
grant select (wholesale_price) on public.products to authenticated;

-- 4. Quantités vendues par produit (liste des produits : stock total, vendu, restant) --------
create or replace function public.get_sold_quantities()
returns table (product_id uuid, sold bigint)
language sql
stable
security definer
set search_path = public
as $$
  select product_id, sum(quantity)::bigint from public.sale_items
   where product_id is not null
   group by product_id;
$$;
grant execute on function public.get_sold_quantities() to authenticated;

-- Un non-administrateur enregistre un accessoire sans aucun prix
drop policy if exists "Création" on public.products;
create policy "Création" on public.products for insert to authenticated
  with check (
    public.is_admin()
    or (coalesce(purchase_price, 0) = 0 and coalesce(selling_price, 0) = 0 and coalesce(wholesale_price, 0) = 0)
  );
