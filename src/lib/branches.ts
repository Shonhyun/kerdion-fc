'use client';

import { getSupabase } from './supabase/client';
import { normalize } from './data';
import type { AppData } from './types';

/** A branch account as the main branch sees it. */
export interface Branch {
  id: string; owner_id: string; user_id: string; name: string; email: string;
  active: boolean; created_at: string; updated_at: string;
}
/** A branch with its business data (read through Row Level Security). */
export interface BranchBiz { branch: Branch | null; userId: string; name: string; data: AppData | null; updatedAt: string | null }

export async function loadBranches(owner: string): Promise<Branch[]> {
  const sb = getSupabase(); if (!sb) return [];
  const { data, error } = await sb.from('branches').select('*').eq('owner_id', owner).order('created_at');
  if (error) throw error;
  return (data || []) as Branch[];
}

/** Business data for the main branch and every branch, in one query. */
export async function loadBranchData(owner: string, branches: Branch[]): Promise<Record<string, { name: string; data: AppData; updatedAt: string }>> {
  const sb = getSupabase(); if (!sb) return {};
  const ids = [owner, ...branches.map((b) => b.user_id)];
  const { data, error } = await sb.from('businesses').select('owner_id, name, data, updated_at').in('owner_id', ids);
  if (error) throw error;
  const out: Record<string, { name: string; data: AppData; updatedAt: string }> = {};
  (data || []).forEach((r) => {
    // normalize() fills defaults in place, so give it a copy.
    out[r.owner_id as string] = { name: (r.name as string) || '', data: normalize(JSON.parse(JSON.stringify(r.data ?? {}))), updatedAt: r.updated_at as string };
  });
  return out;
}

async function call(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, query = '') {
  const res = await fetch('/api/branches' + query, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin',
  });
  let j: { error?: string; branch?: Branch } = {};
  try { j = await res.json(); } catch { /* not JSON: signed out or offline */ }
  if (!res.ok) throw new Error(j.error || (res.status === 401 ? 'Please sign in again.' : 'Something went wrong. Check your internet and try again.'));
  return j;
}

export async function addBranch(v: { name: string; email: string; password: string; copy: boolean }) { return (await call('POST', v)).branch as Branch; }
export async function editBranch(id: string, v: { name?: string; email?: string; password?: string; active?: boolean }) { return (await call('PATCH', { id, ...v })).branch as Branch; }
export async function removeBranch(id: string) { await call('DELETE', undefined, '?id=' + encodeURIComponent(id)); }
