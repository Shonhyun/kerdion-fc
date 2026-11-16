import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { fresh, normalize } from '@/lib/data';
import { BRANCH_LIMIT } from '@/lib/plan';

// Branch accounts for Saffra Multi-Branch. Only the main branch (the account that pays for
// Multi-Branch) can call this. Creating logins needs the service role key, so this runs on the
// server; everything here checks first that the branch belongs to the signed-in account.
//
//   POST   { name, email, password, copy }   add a branch (copy = start with the main menu and prices)
//   PATCH  { id, name?, email?, password?, active? }   rename, change email or password, turn on or off
//   DELETE ?id=...                           remove the branch login and all its data

export const dynamic = 'force-dynamic';

const BAN_FOREVER = '876000h'; // 100 years: how Supabase turns a login off without deleting it
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fail(status: number, error: string) { return NextResponse.json({ error }, { status }); }

interface Ctx { user: User; admin: SupabaseClient; multi: boolean }

async function context(): Promise<Ctx | NextResponse> {
  const admin = getServiceSupabase();
  if (!admin) return fail(500, 'Branches are not set up on the server yet (SUPABASE_SERVICE_ROLE_KEY is missing).');
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail(401, 'Please sign in again.');
  const br = await admin.from('branches').select('id').eq('user_id', user.id).maybeSingle();
  if (br.error) return fail(500, br.error.message);
  if (br.data) return fail(403, 'Branch accounts cannot manage branches. Ask your main branch.');
  const sub = await admin.from('subscriptions').select('plan, current_period_end, is_tester').eq('user_id', user.id).maybeSingle();
  if (sub.error) return fail(500, sub.error.message);
  const s = sub.data;
  const multi = !!s && (s.is_tester || (s.plan === 'multi' && !!s.current_period_end && new Date(s.current_period_end).getTime() > Date.now()));
  return { user, admin, multi };
}

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try { const b = await req.json(); return b && typeof b === 'object' ? b : {}; } catch { return {}; }
}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function checkPassword(p: string): string | null {
  if (p.length < 8) return 'The password needs at least 8 characters.';
  if (p.length > 72) return 'The password can have at most 72 characters.';
  return null;
}
function authError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already') || m.includes('registered') || m.includes('exists')) return 'That email already has a Saffra account. Use a different email for this branch.';
  if (m.includes('password')) return msg;
  return 'Could not save the branch login: ' + msg;
}
async function activeCount(admin: SupabaseClient, owner: string) {
  const { count, error } = await admin.from('branches').select('id', { count: 'exact', head: true }).eq('owner_id', owner).eq('active', true);
  if (error) throw error;
  return count || 0;
}

export async function POST(req: NextRequest) {
  const ctx = await context(); if (ctx instanceof NextResponse) return ctx;
  const { user, admin, multi } = ctx;
  if (!multi) return fail(403, 'Multi-Branch is not active on this account. Renew it to add branches.');

  const b = await body(req);
  const name = str(b.name, 80);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  if (!name) return fail(400, 'Give the branch a name, like "Dagupan".');
  if (!EMAIL_RE.test(email)) return fail(400, 'Enter a valid email for the branch login.');
  if (email === (user.email || '').toLowerCase()) return fail(400, 'Use a different email from your own.');
  const pw = checkPassword(password); if (pw) return fail(400, pw);
  try {
    if (await activeCount(admin, user.id) >= BRANCH_LIMIT) return fail(400, `You already have ${BRANCH_LIMIT} branches, the most Multi-Branch allows. Turn one off or remove it first.`);
  } catch (e) { return fail(500, (e as Error).message); }

  // The new branch's business: a copy of the main menu, prices and expenses (no sales or stock), or empty.
  const own = await admin.from('businesses').select('name, data').eq('owner_id', user.id).maybeSingle();
  const mainName = (own.data?.name as string) || '';
  const bizName = (mainName ? mainName + ' - ' + name : name).slice(0, 120);
  let data;
  if (b.copy && own.data?.data) {
    data = normalize(JSON.parse(JSON.stringify(own.data.data)));
    data.log = {}; data.stock = []; data.alerts = []; data.sample = false; data.onboarded = true; data.lastBackup = 0;
    data.biz = { ...data.biz, name: bizName };
  } else {
    data = fresh(own.data?.data?.lang === 'tl' ? 'tl' : 'en', bizName);
  }

  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { business_name: bizName, branch_of: user.id, branch_name: name },
  });
  if (created.error || !created.data.user) return fail(400, authError(created.error?.message || 'unknown error'));
  const uid = created.data.user.id;

  const biz = await admin.from('businesses').insert({ owner_id: uid, name: bizName, data, version: 1 });
  const row = biz.error ? null : await admin.from('branches').insert({ owner_id: user.id, user_id: uid, name, email }).select('*').single();
  if (biz.error || !row || row.error) {
    await admin.auth.admin.deleteUser(uid); // undo, so a half-made branch is never left behind
    return fail(500, 'Could not finish adding the branch: ' + (biz.error?.message || row?.error?.message || 'unknown error'));
  }
  return NextResponse.json({ branch: row.data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await context(); if (ctx instanceof NextResponse) return ctx;
  const { user, admin, multi } = ctx;
  const b = await body(req);
  const id = str(b.id, 60);
  const cur = await admin.from('branches').select('*').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (cur.error) return fail(500, cur.error.message);
  if (!cur.data) return fail(404, 'Branch not found.');
  const br = cur.data as { id: string; user_id: string; name: string; email: string; active: boolean };

  const patch: Record<string, unknown> = {};
  const auth: Record<string, unknown> = {};
  if (b.name !== undefined) {
    const name = str(b.name, 80); if (!name) return fail(400, 'The branch name cannot be empty.');
    patch.name = name;
  }
  if (b.email !== undefined) {
    const email = str(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(400, 'Enter a valid email for the branch login.');
    if (email === (user.email || '').toLowerCase()) return fail(400, 'Use a different email from your own.');
    if (email !== br.email) { patch.email = email; auth.email = email; auth.email_confirm = true; }
  }
  if (b.password !== undefined && b.password !== '') {
    const password = typeof b.password === 'string' ? b.password : '';
    const pw = checkPassword(password); if (pw) return fail(400, pw);
    auth.password = password;
  }
  if (typeof b.active === 'boolean' && b.active !== br.active) {
    if (b.active) {
      if (!multi) return fail(403, 'Multi-Branch is not active on this account. Renew it to turn branches back on.');
      try { if (await activeCount(admin, user.id) >= BRANCH_LIMIT) return fail(400, `You already have ${BRANCH_LIMIT} branches turned on. Turn one off first.`); }
      catch (e) { return fail(500, (e as Error).message); }
    }
    patch.active = b.active;
    auth.ban_duration = b.active ? 'none' : BAN_FOREVER;
  }
  if (!Object.keys(patch).length && !Object.keys(auth).length) return NextResponse.json({ branch: br });

  if (Object.keys(auth).length) {
    const up = await admin.auth.admin.updateUserById(br.user_id, auth);
    if (up.error) return fail(400, authError(up.error.message));
  }
  if (!Object.keys(patch).length) return NextResponse.json({ branch: br });
  const saved = await admin.from('branches').update(patch).eq('id', br.id).select('*').single();
  if (saved.error) return fail(500, saved.error.message);
  return NextResponse.json({ branch: saved.data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await context(); if (ctx instanceof NextResponse) return ctx;
  const { user, admin } = ctx;
  const id = (req.nextUrl.searchParams.get('id') || '').slice(0, 60);
  const cur = await admin.from('branches').select('user_id').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (cur.error) return fail(500, cur.error.message);
  if (!cur.data) return fail(404, 'Branch not found.');
  // Deleting the login removes its business data and branch row too (on delete cascade).
  const del = await admin.auth.admin.deleteUser(cur.data.user_id as string);
  if (del.error) return fail(500, 'Could not remove the branch: ' + del.error.message);
  return NextResponse.json({ ok: true });
}
