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
