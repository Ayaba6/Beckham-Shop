-- Les vendeurs réceptionnent le stock : ils ajoutent un accessoire et réapprovisionnent,
-- mais sans jamais saisir de prix (seul l'administrateur fixe les prix d'achat et de vente).
-- À exécuter une fois dans Supabase (SQL Editor) si rls_policies.sql a déjà été exécuté.
-- (rls_policies.sql contient déjà ce changement pour une nouvelle installation.)

drop policy if exists "Création" on public.products;
create policy "Création" on public.products for insert to authenticated
  with check (public.is_admin() or (coalesce(purchase_price, 0) = 0 and coalesce(selling_price, 0) = 0));

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
as $$
declare
  v_entry public.stock_entries;
  v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantité invalide';
  end if;

  -- Un vendeur ne fixe pas de prix : l'entrée prend le prix d'achat actuel du produit
  if not v_admin then
    select purchase_price into p_unit_cost from public.products where id = p_product_id;
    p_update_price := false;
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
