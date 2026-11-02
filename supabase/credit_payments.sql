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
