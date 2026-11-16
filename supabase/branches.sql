-- Saffra Multi-Branch: one main account that owns up to 3 branch accounts.
-- Run this once in Supabase Dashboard > SQL Editor > New query, AFTER schema.sql and billing.sql.
-- It is safe to run again: every statement checks before it creates.
--
-- How it works
-- - A new plan, 'multi' (Saffra Multi-Branch), is paid and approved the same way as Pro.
-- - The account that paid is the main branch. It creates branch accounts (email + password) from
--   the Branches page. Each branch account is a normal Saffra login with its own business data.
-- - The main branch can read and edit every branch's data while Multi-Branch is active.
--   Branches can never see the main branch or each other.
-- - Branch accounts get Pro features for as long as the main branch's Multi-Branch is active.
-- - Branch accounts are created, edited and removed only by the server (/api/branches), which
--   uses the service role key. Users have no write policies on the branches table.

-- ---------- plans ----------
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'pro', 'multi'));

alter table public.payment_requests add column if not exists plan text not null default 'pro';
alter table public.payment_requests drop constraint if exists payment_requests_plan_check;
alter table public.payment_requests add constraint payment_requests_plan_check check (plan in ('pro', 'multi'));

-- Users may only create a pending request, for themselves, at the real price of the plan they picked.
-- Prices must match PRICE and MULTI_PRICE in src/lib/plan.ts.
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
    and amount = case
      when plan = 'multi' then case billing when 'monthly' then 799 when 'yearly' then 7990 end
      else case billing when 'monthly' then 299 when 'yearly' then 2990 end
    end
    and split_part(proof_path, '/', 1) = (select auth.uid())::text
  );

-- ---------- branches ----------
create table if not exists public.branches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,        -- the main branch
  user_id    uuid not null unique references auth.users (id) on delete cascade, -- the branch's own login
  name       text not null check (char_length(name) between 1 and 80),
  email      text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id <> user_id)
);
create index if not exists branches_owner on public.branches (owner_id);
alter table public.branches enable row level security;

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

-- Read only for users. Writes go through /api/branches (service role).
drop policy if exists "Main branch and the branch itself can read" on public.branches;
create policy "Main branch and the branch itself can read"
  on public.branches for select
  to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = user_id or public.is_admin());

-- True when a user's Multi-Branch is running (testers get it too).
create or replace function public.multi_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
     where s.user_id = p_user
       and (s.is_tester or (s.plan = 'multi' and s.current_period_end > now()))
  );
$$;
-- Only used inside other functions, so users cannot ask about someone else's plan.
revoke all on function public.multi_active(uuid) from public, anon, authenticated;

-- True when the signed-in user is the main branch of p_user and Multi-Branch is active.
-- Deactivated branches stay readable, so their data is never lost from view.
create or replace function public.manages_branch(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.branches b
     where b.user_id = p_user and b.owner_id = (select auth.uid())
  ) and public.multi_active((select auth.uid()));
$$;
revoke all on function public.manages_branch(uuid) from public, anon;
grant execute on function public.manages_branch(uuid) to authenticated;

-- The main branch can read and edit its branches' business data (full access, like the branch itself).
-- Creating and deleting business rows stays with the owner and the server.
drop policy if exists "Main branch reads its branches" on public.businesses;
create policy "Main branch reads its branches"
  on public.businesses for select
  to authenticated
  using (public.manages_branch(owner_id));

drop policy if exists "Main branch updates its branches" on public.businesses;
create policy "Main branch updates its branches"
  on public.businesses for update
  to authenticated
  using (public.manages_branch(owner_id))
  with check (public.manages_branch(owner_id));

-- ---------- the signed-in account's plan ----------
-- One call that returns what the app needs. A branch account gets its main branch's plan:
-- Pro features while the main branch's Multi-Branch is active and the branch is turned on.
create or replace function public.my_entitlement()
returns table (
  plan text, billing text, current_period_start timestamptz, current_period_end timestamptz,
  is_tester boolean, is_admin boolean, branch_owner uuid, branch_name text, branch_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.branches;
  me uuid := (select auth.uid());
begin
  if me is null then return; end if;
  select * into b from public.branches where user_id = me;
  if found then
    return query
      select case when b.active and coalesce(s.plan, 'free') = 'multi' then 'pro' else 'free' end,
             case when b.active and coalesce(s.plan, 'free') = 'multi' then s.billing end,
             case when b.active and coalesce(s.plan, 'free') = 'multi' then s.current_period_start end,
             case when b.active and coalesce(s.plan, 'free') = 'multi' then s.current_period_end end,
             b.active and coalesce(s.is_tester, false),
             false, b.owner_id, b.name, b.active
        from (select 1) x
        left join public.subscriptions s on s.user_id = b.owner_id;
  else
    return query
      select coalesce(s.plan, 'free'), s.billing, s.current_period_start, s.current_period_end,
             coalesce(s.is_tester, false), public.is_admin(), null::uuid, null::text, null::boolean
        from (select 1) x
        left join public.subscriptions s on s.user_id = me;
  end if;
end;
$$;
revoke all on function public.my_entitlement() from public, anon;
grant execute on function public.my_entitlement() to authenticated;

-- ---------- approving a payment ----------
-- Same plan and still active: the time is added on top. A different plan (Pro to Multi-Branch,
-- or back) starts now.
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
  keep  boolean := false;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into req from public.payment_requests where id = p_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if req.status <> 'pending' then raise exception 'This payment was already reviewed'; end if;
  if exists (select 1 from public.branches where user_id = req.user_id) then
    raise exception 'This is a branch account. Its plan comes from its main branch.';
  end if;

  select * into sub from public.subscriptions where user_id = req.user_id for update;
  start := now();
  if found and sub.plan = req.plan and sub.current_period_end > now() then
    start := sub.current_period_end; keep := true;
  end if;

  insert into public.subscriptions as s (user_id, plan, billing, current_period_start, current_period_end, updated_at)
  values (req.user_id, req.plan, req.billing, start,
          start + case req.billing when 'yearly' then interval '1 year' else interval '1 month' end, now())
  on conflict (user_id) do update
    set plan = excluded.plan,
        billing = excluded.billing,
        current_period_start = case when keep then s.current_period_start else excluded.current_period_start end,
        current_period_end = excluded.current_period_end,
        updated_at = now();

  update public.payment_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id;
end;
$$;
revoke all on function public.approve_payment(uuid) from public, anon;
grant execute on function public.approve_payment(uuid) to authenticated;

-- Every account for the admin page, now with which main branch a branch account belongs to.
drop function if exists public.admin_list_accounts();
create or replace function public.admin_list_accounts()
returns table (
  user_id uuid, email text, business_name text, signed_up timestamptz, products integer,
  plan text, billing text, current_period_end timestamptz, is_tester boolean, last_active timestamptz,
  branch_of text, branches integer
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
           coalesce(s.plan, 'free'), s.billing, s.current_period_end, coalesce(s.is_tester, false),
           b.updated_at,
           (select ou.email::text from public.branches br join auth.users ou on ou.id = br.owner_id where br.user_id = u.id),
           (select count(*)::int from public.branches br where br.owner_id = u.id)
      from auth.users u
      left join public.businesses b on b.owner_id = u.id
      left join public.subscriptions s on s.user_id = u.id
     order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_accounts() from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
