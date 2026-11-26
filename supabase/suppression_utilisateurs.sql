-- Suppression d'un utilisateur par l'administrateur.
-- Le compte est désactivé plutôt qu'effacé : il ne peut plus se connecter (bloqué par la
-- fonction create-user), mais son nom reste sur les ventes, caisses et crédits qu'il a faits.
-- À exécuter une fois dans Supabase (SQL Editor), après roles_caissiere_grossiste.sql.

alter table public.profiles add column if not exists disabled boolean not null default false;

-- Un compte désactivé perd aussitôt ses droits, même si sa session est encore ouverte
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not disabled);
$$;

create or replace function public.can_sell()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'cashier') and not disabled);
$$;
