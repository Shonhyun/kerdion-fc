'use client';

import { useSyncExternalStore } from 'react';
import { produce } from 'immer';
import type { AppData } from '@/lib/types';
import { fresh, isValid, migrateV1, normalize } from '@/lib/data';
import { makeL } from '@/lib/format';
import { getSupabase } from '@/lib/supabase/client';

export type SaveState = 'saved' | 'saving' | 'offline' | 'error' | 'conflict';
export interface Meta {
  phase: 'loading' | 'ready' | 'error';
  mode: 'cloud' | 'local';
  save: SaveState;
  email: string;
  userId: string;
  error: string;
}
export interface ToastState { id: number; msg: string; undo: AppData | null; show: boolean }

// Keys keep the old 'kerdion-' prefix (the app's first name) so existing saved data and caches still load.
const LOCAL_KEY = 'kerdion-v3';
const OLD_KEYS = ['tubo-food-costing-v2', 'tubo-food-costing-v1'];

let data: AppData | null = null;
let meta: Meta = { phase: 'loading', mode: 'local', save: 'saved', email: '', userId: '', error: '' };
let toast: ToastState = { id: 0, msg: '', undo: null, show: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function useData(): AppData { return useSyncExternalStore(subscribe, () => data as AppData, () => data as AppData); }
export function useMeta(): Meta { return useSyncExternalStore(subscribe, () => meta, () => meta); }
export function useToast(): ToastState { return useSyncExternalStore(subscribe, () => toast, () => toast); }
export function useT() { return makeL(useData().lang); }
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

// ---------- persistence ----------
let version = 0;
let dirty = false;
let inFlight = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const cacheKey = () => 'kerdion-cache-' + meta.userId;
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
    .eq('owner_id', meta.userId)
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
  const { data: row, error } = await sb.from('businesses').select('data, version').eq('owner_id', meta.userId).maybeSingle();
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
    setMeta({ phase: 'ready', mode: 'local', save: 'saved' });
    return;
  }

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) { window.location.href = '/login'; return; }
  meta = { ...meta, mode: 'cloud', userId: user.id, email: user.email || '' };

  // Show the last copy on this device right away, then check the cloud.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cached: { data: any; version: number; dirty: boolean } | null = null;
  try { const c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (c && isValid(c.data)) cached = c; } catch { /* ignore */ }
  if (cached) { data = normalize(cached.data); version = cached.version || 0; setMeta({ phase: 'ready', save: cached.dirty ? 'saving' : 'saved' }); }

  const { data: row, error } = await sb.from('businesses').select('data, version').eq('owner_id', user.id).maybeSingle();
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

export async function signOut() {
  const sb = getSupabase();
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
