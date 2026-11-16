'use client';

import { useSyncExternalStore } from 'react';
import { produce } from 'immer';
import type { AppData } from '@/lib/types';
import { fresh, isValid, migrateV1, normalize } from '@/lib/data';
import { makeL } from '@/lib/format';
import { getSupabase } from '@/lib/supabase/client';
import { FREE_ENT, entIsPro, entMulti, setPro, type Billing, type Ent } from '@/lib/plan';

export type SaveState = 'saved' | 'saving' | 'offline' | 'error' | 'conflict';
export interface Meta {
  phase: 'loading' | 'ready' | 'error';
  mode: 'cloud' | 'local';
  save: SaveState;
  email: string;
  userId: string;
  error: string;
  /** Set while a main branch has one of its branches open: everything shown and saved is that branch's. */
  viewing: { userId: string; name: string } | null;
}
export interface ToastState { id: number; msg: string; undo: AppData | null; show: boolean }

// Keys keep the old 'kerdion-' prefix (the app's first name) so existing saved data and caches still load.
const LOCAL_KEY = 'kerdion-v3';
const OLD_KEYS = ['tubo-food-costing-v2', 'tubo-food-costing-v1'];

let data: AppData | null = null;
let meta: Meta = { phase: 'loading', mode: 'local', save: 'saved', email: '', userId: '', error: '', viewing: null };
let toast: ToastState = { id: 0, msg: '', undo: null, show: false };
let ent: Ent = FREE_ENT;
export type UpgradeReason = 'products' | 'preps' | 'export' | 'delivery' | 'alerts' | 'combos' | 'daily' | 'competitor' | 'plan';
let upgrade: { open: boolean; reason: UpgradeReason } = { open: false, reason: 'plan' };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function useData(): AppData { return useSyncExternalStore(subscribe, () => data as AppData, () => data as AppData); }
export function useMeta(): Meta { return useSyncExternalStore(subscribe, () => meta, () => meta); }
export function useToast(): ToastState { return useSyncExternalStore(subscribe, () => toast, () => toast); }
export function useT() { return makeL(useData().lang); }
export function useEnt(): Ent { return useSyncExternalStore(subscribe, () => ent, () => ent); }
export function useUpgrade() { return useSyncExternalStore(subscribe, () => upgrade, () => upgrade); }
/** Shows the Pro offer. Call it whenever a free account reaches a limit or taps a Pro feature. */
export function openUpgrade(reason: UpgradeReason = 'plan') { upgrade = { open: true, reason }; emit(); }
export function closeUpgrade() { upgrade = { ...upgrade, open: false }; emit(); }
export function getData(): AppData { return data as AppData; }
/** Where to go right after the quick setup finishes. */
export const afterSetup = { path: '/dashboard' };

function setMeta(p: Partial<Meta>) { meta = { ...meta, ...p }; emit(); }

/** Change the data. `fn` mutates a draft copy; pass `undoMsg` to show an Undo toast. */
export function update(fn: (d: AppData) => void, undoMsg?: string) {
  if (!data) return;
  const prev = data;
  data = produce(data, (d) => { fn(d as AppData); });
  if (data === prev) return;
  emit();
  persist();
  if (undoMsg) showToast(undoMsg, prev);
}
export function replaceData(next: AppData) { data = next; emit(); persist(); }

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string, undo: AppData | null = null) {
  toast = { id: toast.id + 1, msg, undo, show: true }; emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = { ...toast, show: false, undo: null }; emit(); }, undo ? 8000 : 5200);
}
export function undoLast() {
  if (!toast.undo) return;
  const prev = toast.undo;
  toast = { ...toast, show: false, undo: null };
  replaceData(prev);
}

// ---------- plan ----------
const planKey = () => 'saffra-plan-' + meta.userId;

/** Opens or closes Pro features to match the plan. Locked items re-render, nothing is saved. */
function applyGate() {
  const changed = setPro(meta.mode === 'local' || entIsPro(ent));
  if (changed && data) data = { ...data };
  emit();
}
function setEnt(e: Ent) {
  ent = e;
  try { localStorage.setItem(planKey(), JSON.stringify(e)); } catch { /* ignore */ }
  applyGate();
}

/** Loads this account's plan from Supabase. Users can read it but never change it. */
let lastPlanFetch = 0;
export async function refreshPlan(force = true) {
  const sb = getSupabase(); if (!sb || !meta.userId) return;
  if (!force && Date.now() - lastPlanFetch < 60 * 1000) return;
  lastPlanFetch = Date.now();
  // One call that also knows about branches (supabase/branches.sql). Branch accounts get their
  // main branch's plan from it.
  const me = await sb.rpc('my_entitlement');
  if (!me.error) {
    const r = ((me.data || []) as Record<string, unknown>[])[0];
    if (!r) return;
    const plan = r.plan === 'pro' || r.plan === 'multi' ? r.plan : 'free';
    setEnt({
      loaded: true, plan,
      billing: (r.billing as Billing) || null,
      periodStart: (r.current_period_start as string) || null,
      periodEnd: (r.current_period_end as string) || null,
      tester: !!r.is_tester, admin: !!r.is_admin,
      branchOf: (r.branch_owner as string) || null,
      branchName: (r.branch_name as string) || '',
      branchActive: r.branch_active !== false,
    });
    return;
  }
  // Older database without branches.sql: read the tables directly.
  const [sub, adm] = await Promise.all([
    sb.from('subscriptions').select('plan, billing, current_period_start, current_period_end, is_tester').eq('user_id', meta.userId).maybeSingle(),
    sb.from('admins').select('user_id').eq('user_id', meta.userId).maybeSingle(),
  ]);
  if (sub.error) return; // offline or not set up yet: keep the last known plan
  const r = sub.data;
  setEnt({
    loaded: true,
    plan: r?.plan === 'pro' ? 'pro' : 'free',
    billing: (r?.billing as Billing) || null,
    periodStart: r?.current_period_start || null,
    periodEnd: r?.current_period_end || null,
    tester: !!r?.is_tester,
    admin: !adm.error && !!adm.data,
    branchOf: null, branchName: '', branchActive: true,
  });
}

// ---------- persistence ----------
let version = 0;
let dirty = false;
let inFlight = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** Whose business row is open: the account's own, or a branch the main branch is looking at. */
const bizOwner = () => meta.viewing?.userId || meta.userId;
const cacheKey = () => 'kerdion-cache-' + bizOwner();
function writeCache() {
  try {
    if (meta.mode === 'local') localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    else localStorage.setItem(cacheKey(), JSON.stringify({ data, version, dirty: dirty || inFlight }));
  } catch { /* storage full or blocked: cloud copy still saves */ }
}
function persist() {
  if (meta.mode === 'local') { writeCache(); setMeta({ save: 'saved' }); return; }
  dirty = true;
  writeCache();
  if (meta.save !== 'saving') setMeta({ save: 'saving' });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 800);
}

async function flush() {
  const sb = getSupabase();
  if (!sb || !data || !dirty) return;
  if (inFlight) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) { setMeta({ save: 'offline' }); return; }
  inFlight = true; dirty = false;
  const snapshot = data;
  const { data: rows, error } = await sb
    .from('businesses')
    .update({ data: snapshot, name: snapshot.biz.name || '', version: version + 1 })
    .eq('owner_id', bizOwner())
    .eq('version', version)
    .select('version');
  inFlight = false;
  if (error) {
    dirty = true;
    setMeta({ save: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error' });
    clearTimeout(retryTimer); retryTimer = setTimeout(flush, 5000);
    return;
  }
  if (!rows || rows.length === 0) { await loadLatest(true); return; }
  version = rows[0].version as number;
  writeCache();
  if (dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
  else setMeta({ save: 'saved' });
}

/** Another device saved first: load the newest copy so nothing gets overwritten by mistake. */
async function loadLatest(conflict: boolean) {
  const sb = getSupabase(); if (!sb) return;
  const { data: row, error } = await sb.from('businesses').select('data, version').eq('owner_id', bizOwner()).maybeSingle();
  if (error || !row) { setMeta({ save: 'error' }); return; }
  data = normalize(row.data); version = row.version as number; dirty = false;
  writeCache(); setMeta({ save: 'saved' });
  if (conflict) {
    const L = makeL(data.lang);
    showToast(L('Your data was changed on another device, so we loaded the newest copy. Please check your last change.', 'May nagbago ng data mo sa ibang device, kaya ni-load namin ang pinakabagong kopya. Pakicheck ang huling binago mo.'));
  }
}

let started = false;
export async function initStore() {
  if (started) return; started = true;
  const sb = getSupabase();

  if (!sb) {
    let d: AppData | null = null;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) { const s = JSON.parse(raw); if (isValid(s)) d = normalize(s); }
      if (!d) for (const k of OLD_KEYS) {
        const old = localStorage.getItem(k);
        if (old) { const o = JSON.parse(old); if (o && o.biz && Array.isArray(o.recipes) && !o.sample) { d = normalize(migrateV1(o)); break; } }
      }
    } catch { /* ignore */ }
    data = d || fresh();
    ent = { ...FREE_ENT, loaded: true };
    setMeta({ phase: 'ready', mode: 'local', save: 'saved' });
    applyGate();
    return;
  }

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) { window.location.href = '/login'; return; }
  meta = { ...meta, mode: 'cloud', userId: user.id, email: user.email || '' };

  // A branch the main branch opened last time. Shown from this device's copy right away and
  // checked against the server once the plan has loaded.
  const viewing = readViewing(user.id);
  if (viewing) meta = { ...meta, viewing };

  // Free until the plan is known. The last plan seen on this device is used right away, so a
  // Pro account does not flash its products as locked; the server copy then replaces it.
  try { const c = JSON.parse(localStorage.getItem(planKey()) || 'null'); if (c && typeof c === 'object') ent = { ...FREE_ENT, ...c }; } catch { /* ignore */ }
  setPro(entIsPro(ent));
  const planLoad = refreshPlan();
  // A Pro period can end while the app is open.
  setInterval(applyGate, 60 * 1000);
  window.addEventListener('focus', () => { refreshPlan(false); });

  // Show the last copy on this device right away, then check the cloud.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cached: { data: any; version: number; dirty: boolean } | null = null;
  try { const c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (c && isValid(c.data)) cached = c; } catch { /* ignore */ }
  if (cached) { data = normalize(cached.data); version = cached.version || 0; setMeta({ phase: 'ready', save: cached.dirty ? 'saving' : 'saved' }); }

  if (viewing) {
    await planLoad;
    const br = entMulti(ent) ? await sb.from('branches').select('user_id, name').eq('owner_id', user.id).eq('user_id', viewing.userId).maybeSingle() : null;
    if (!br || br.error || !br.data) { clearViewing(); window.location.reload(); return; }
    meta = { ...meta, viewing: { userId: viewing.userId, name: String(br.data.name || viewing.name) } };
  }
  const { data: row, error } = await sb.from('businesses').select('data, version').eq('owner_id', bizOwner()).maybeSingle();
  await planLoad;
  if (error) {
    if (data) { setMeta({ save: 'offline' }); dirty = !!cached?.dirty; return; }
    setMeta({ phase: 'error', error: error.message });
    return;
  }
  if (row) {
    if (cached && cached.dirty && cached.version === row.version) {
      // Unsaved changes from last time on this device: keep them and save now.
      dirty = true; version = row.version as number; setMeta({ phase: 'ready' }); flush();
    } else {
      data = normalize(row.data); version = row.version as number; dirty = false;
      writeCache(); setMeta({ phase: 'ready', save: 'saved' });
    }
    return;
  }
  if (viewing) {
    // Branch rows are made by the server when the branch is added, so this one is missing or hidden.
    clearViewing();
    setMeta({ phase: 'error', error: 'This branch could not be opened. Go back to your own business and try again.' });
    return;
  }
  // First sign-in: create the business record.
  const name = String(user.user_metadata?.business_name || '').slice(0, 120);
  const d = fresh('en', name);
  const ins = await sb.from('businesses').insert({ owner_id: user.id, name, data: d, version: 1 }).select('version').single();
  if (ins.error) {
    // Created at the same moment on another tab or device: load that one.
    data = d; await loadLatest(false);
  } else {
    data = d; version = 1; writeCache();
  }
  setMeta({ phase: 'ready', save: 'saved' });
}

// ---------- branches ----------
const VIEW_KEY = 'saffra-view-branch';
function readViewing(me: string): Meta['viewing'] {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    if (v && v.by === me && typeof v.userId === 'string' && v.userId !== me) return { userId: v.userId, name: String(v.name || '') };
  } catch { /* ignore */ }
  return null;
}
function clearViewing() { try { localStorage.removeItem(VIEW_KEY); } catch { /* ignore */ } }

/** Saves anything pending, then waits until nothing is waiting to save. */
async function settle() {
  clearTimeout(saveTimer);
  for (let i = 0; i < 20 && (dirty || inFlight); i++) {
    if (dirty && !inFlight) await flush(); else await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Opens one of this main branch's branches: every page then shows and edits that branch's data.
 * The page reloads so nothing from the current business is mixed in.
 */
export async function openBranch(userId: string, name: string, path = '/dashboard') {
  await settle();
  try { localStorage.setItem(VIEW_KEY, JSON.stringify({ by: meta.userId, userId, name })); } catch { /* ignore */ }
  window.location.href = path;
}
/** Back to the main branch's own business. */
export async function closeBranch(path = '/branches') {
  await settle();
  clearViewing();
  window.location.href = path;
}

export async function signOut() {
  const sb = getSupabase();
  clearViewing();
  if (dirty) await flush();
  // Drop the device copy only once everything is safely in the cloud. While a change is still
  // unsaved (offline, or a save in flight) that copy is the only one there is, and signing back
  // in on this device picks it up again.
  if (!dirty && !inFlight) { try { localStorage.removeItem(cacheKey()); } catch { /* ignore */ } }
  if (sb) await sb.auth.signOut();
  window.location.href = '/login';
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (dirty) flush(); });
  window.addEventListener('beforeunload', (e) => { if (meta.mode === 'cloud' && (dirty || inFlight)) { e.preventDefault(); } });
}
