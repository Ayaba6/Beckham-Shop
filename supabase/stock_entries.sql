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
