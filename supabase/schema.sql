-- Kerdion database schema
-- Run this once in Supabase Dashboard > SQL Editor > New query.
-- Each account owns exactly one business record. Row Level Security makes sure
-- a signed-in user can only ever read or change their own record.

create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users (id) on delete cascade,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

-- Row Level Security: owner-only access.
alter table public.businesses enable row level security;

drop policy if exists "Owners can read their business" on public.businesses;
create policy "Owners can read their business"
  on public.businesses for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create their business" on public.businesses;
create policy "Owners can create their business"
  on public.businesses for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update their business" on public.businesses;
create policy "Owners can update their business"
  on public.businesses for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete their business" on public.businesses;
create policy "Owners can delete their business"
  on public.businesses for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Guard against oversized writes (about 5 MB of JSON per business).
alter table public.businesses drop constraint if exists businesses_data_size;
alter table public.businesses add constraint businesses_data_size check (pg_column_size(data) < 5000000);
