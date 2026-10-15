-- Optional encrypted Ma-Collection preferences for the SAME Supabase backend as Kovelyx.
-- Run once in your own database SQL editor as an administrator.
-- Never put a service_role / sb_secret key in GitHub Pages or the desktop UI.
-- All profiles and account identities remain managed by Kovelyx's existing backend.

create table if not exists public.ma_collection_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ciphertext text not null check (length(ciphertext) <= 1048576),
  salt text not null check (length(salt) <= 256),
  iv text not null check (length(iv) <= 256),
  updated_at timestamptz not null default now()
);

alter table public.ma_collection_vaults enable row level security;
revoke all on table public.ma_collection_vaults from anon;
grant select, insert, update, delete on table public.ma_collection_vaults to authenticated;

drop policy if exists "Ma-Collection : lire uniquement mes données" on public.ma_collection_vaults;
create policy "Ma-Collection : lire uniquement mes données"
  on public.ma_collection_vaults for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Ma-Collection : créer uniquement mes données" on public.ma_collection_vaults;
create policy "Ma-Collection : créer uniquement mes données"
  on public.ma_collection_vaults for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Ma-Collection : modifier uniquement mes données" on public.ma_collection_vaults;
create policy "Ma-Collection : modifier uniquement mes données"
  on public.ma_collection_vaults for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Ma-Collection : supprimer uniquement mes données" on public.ma_collection_vaults;
create policy "Ma-Collection : supprimer uniquement mes données"
  on public.ma_collection_vaults for delete to authenticated
  using (user_id = (select auth.uid()));

-- IMPORTANT: this table stores only client-side AES-GCM ciphertext and salt/IV.
-- The password used to unlock this encrypted vault is distinct from account login.
