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
