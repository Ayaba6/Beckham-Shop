-- Suppression d'un article par l'administrateur.
-- L'article est archivé plutôt qu'effacé : il disparaît du stock et de la caisse,
-- mais les ventes, factures et statistiques passées qui le citent restent intactes.
-- À exécuter une fois dans Supabase (SQL Editor).

alter table public.products add column if not exists archived boolean not null default false;

-- products est lu colonne par colonne (le prix d'achat reste caché aux non-administrateurs)
grant select (archived) on public.products to authenticated;

-- La modification reste réservée à l'administrateur (règle « Écriture admin » de rls_policies.sql)
