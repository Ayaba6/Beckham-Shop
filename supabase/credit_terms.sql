-- Crédits : date d'échéance, motif et type de vente.
-- sale_type = 'sale' pour une vente normale, 'debt' pour une dette libre sans article
-- (ex : reprise d'un crédit noté dans un cahier). Les dettes libres sont exclues
-- du chiffre d'affaires dans les statistiques.
-- À exécuter une fois dans Supabase : SQL Editor > New query > Run.

alter table public.sales add column if not exists sale_type text not null default 'sale';
alter table public.sales add column if not exists due_date date;
alter table public.sales add column if not exists notes text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_sale_type_check') then
    alter table public.sales add constraint sales_sale_type_check check (sale_type in ('sale', 'debt'));
  end if;
end;
$$;

create index if not exists sales_due_date_idx on public.sales (due_date) where payment_method = 'credit';
