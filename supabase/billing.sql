-- Saffra billing: plans, manual QR payments (InstaPay: GCash, Maya, banks) and the admin page.
-- Run this once in Supabase Dashboard > SQL Editor > New query, AFTER schema.sql.
-- It is safe to run again: every statement checks before it creates.
--
-- How it works
-- - Every account is on the Free plan until an admin approves a payment.
-- - A user pays by QR (Maya or BPI InstaPay), uploads the receipt screenshot, and a payment request is created.
-- - The admin opens /admin, looks at the receipt and approves or rejects it.
-- - Approving starts (or extends) Pro for 1 month or 1 year.
-- - Users can READ their own plan but can never change it. Only the admin functions below can.

-- ---------- admins ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "Admins can see their own admin row" on public.admins;
create policy "Admins can see their own admin row"
  on public.admins for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- True when the signed-in user is an admin. security definer so policies can call it
-- without giving users read access to the whole admins table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- subscriptions ----------
create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  plan                 text not null default 'free' check (plan in ('free', 'pro')),
  billing              text check (billing in ('monthly', 'yearly')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  is_tester            boolean not null default false,
  updated_at           timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

-- Read only. There are no insert, update or delete policies on purpose:
-- plans change only through the admin functions below.
drop policy if exists "Users read their own plan, admins read all" on public.subscriptions;
create policy "Users read their own plan, admins read all"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- ---------- payment requests ----------
create table if not exists public.payment_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email        text,
  billing      text not null check (billing in ('monthly', 'yearly')),
  amount       integer not null,
  reference_no text check (reference_no is null or char_length(reference_no) <= 60),
  proof_path   text not null check (char_length(proof_path) <= 300),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note   text check (admin_note is null or char_length(admin_note) <= 500),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users (id) on delete set null
);
create index if not exists payment_requests_status_created on public.payment_requests (status, created_at desc);
-- One waiting request per user at a time.
create unique index if not exists payment_requests_one_pending on public.payment_requests (user_id) where status = 'pending';

alter table public.payment_requests enable row level security;

drop policy if exists "Users read their own payments, admins read all" on public.payment_requests;
create policy "Users read their own payments, admins read all"
  on public.payment_requests for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- Users may only create a pending request, for themselves, at the real price,
-- with a receipt stored in their own folder.
drop policy if exists "Users create their own pending payment" on public.payment_requests;
create policy "Users create their own pending payment"
  on public.payment_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and admin_note is null
    and amount = case billing when 'monthly' then 299 when 'yearly' then 2990 end
    and split_part(proof_path, '/', 1) = (select auth.uid())::text
  );

-- Fill in the email from the account itself, so the admin page shows who paid.
create or replace function public.payment_requests_fill_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select email into new.email from auth.users where id = new.user_id;
  return new;
end;
$$;
drop trigger if exists payment_requests_fill_email on public.payment_requests;
create trigger payment_requests_fill_email
before insert on public.payment_requests
for each row execute function public.payment_requests_fill_email();

-- ---------- admin functions ----------
-- Approve: starts Pro now, or extends it from the current end date if it is still active.
create or replace function public.approve_payment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req   public.payment_requests;
  sub   public.subscriptions;
  start timestamptz;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into req from public.payment_requests where id = p_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if req.status <> 'pending' then raise exception 'This payment was already reviewed'; end if;

  select * into sub from public.subscriptions where user_id = req.user_id for update;
  start := now();
  if found and sub.plan = 'pro' and sub.current_period_end > now() then
    start := sub.current_period_end;
  end if;

  insert into public.subscriptions as s (user_id, plan, billing, current_period_start, current_period_end, updated_at)
  values (req.user_id, 'pro', req.billing, start,
          start + case req.billing when 'yearly' then interval '1 year' else interval '1 month' end, now())
  on conflict (user_id) do update
    set plan = 'pro',
        billing = excluded.billing,
        current_period_start = case when s.plan = 'pro' and s.current_period_end > now() then s.current_period_start else excluded.current_period_start end,
        current_period_end = excluded.current_period_end,
        updated_at = now();

  update public.payment_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id;
end;
$$;

create or replace function public.reject_payment(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.payment_requests
     set status = 'rejected', admin_note = left(p_note, 500), reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id and status = 'pending';
  if not found then raise exception 'Payment not found or already reviewed'; end if;
end;
$$;

-- Beta testers get full access for free, with no end date, until the admin turns it off.
create or replace function public.set_tester(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  insert into public.subscriptions (user_id, is_tester, updated_at) values (p_user, p_on, now())
  on conflict (user_id) do update set is_tester = excluded.is_tester, updated_at = now();
end;
$$;

-- Every account with its plan and product count, for the admin page.
create or replace function public.admin_list_accounts()
returns table (
  user_id uuid, email text, business_name text, signed_up timestamptz, products integer,
  plan text, billing text, current_period_end timestamptz, is_tester boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select u.id, u.email::text, coalesce(b.name, ''), u.created_at,
           coalesce((select count(*)::int from jsonb_array_elements(case when jsonb_typeof(b.data->'recipes') = 'array' then b.data->'recipes' else '[]'::jsonb end) r
                     where coalesce(r->>'kind', 'product') = 'product'), 0),
           coalesce(s.plan, 'free'), s.billing, s.current_period_end, coalesce(s.is_tester, false)
      from auth.users u
      left join public.businesses b on b.owner_id = u.id
      left join public.subscriptions s on s.user_id = u.id
     order by u.created_at desc;
end;
$$;

revoke all on function public.approve_payment(uuid) from public;
revoke all on function public.reject_payment(uuid, text) from public;
revoke all on function public.set_tester(uuid, boolean) from public;
revoke all on function public.admin_list_accounts() from public;
grant execute on function public.approve_payment(uuid) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.set_tester(uuid, boolean) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;

-- ---------- receipt screenshots (private storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Files live at <user id>/<file name>. Users upload and see only their own folder; admins see all.
drop policy if exists "Users upload their own receipts" on storage.objects;
create policy "Users upload their own receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users see their own receipts, admins see all" on storage.objects;
create policy "Users see their own receipts, admins see all"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ---------- admin account ----------
-- Adds the admin once that email has signed up in the app. If it runs before the sign-up, it adds
-- nothing: sign up, then run this file (or just this line) again.
insert into public.admins (user_id) select id from auth.users where email = 'shounramos20@gmail.com' on conflict do nothing;
