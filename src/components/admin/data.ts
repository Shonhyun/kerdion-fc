'use client';

import { getSupabase } from '@/lib/supabase/client';

export interface Pay {
  id: string; user_id: string; email: string | null; plan?: 'pro' | 'multi'; billing: 'monthly' | 'yearly'; amount: number;
  reference_no: string | null; proof_path: string; status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null; created_at: string; reviewed_at: string | null;
}
export interface Acct {
  user_id: string; email: string; business_name: string; signed_up: string; products: number;
  plan: string; billing: string | null; current_period_end: string | null; is_tester: boolean;
  last_active: string | null;
  /** Email of the main branch, when this is a branch account. */
  branch_of?: string | null;
  /** How many branch accounts this main branch has. */
  branches?: number;
}
/** One account's saved business, as the admin sees it (read-only). */
export interface BizView {
  user_id: string; email: string; signed_up: string; last_sign_in: string | null;
  business_name: string; data: unknown; created_at: string | null; updated_at: string | null;
}
export type AcctStatus = 'tester' | 'multi' | 'pro' | 'expired' | 'branch' | 'free';

export const n0 = (v: number) => v.toLocaleString('en-US');
export const peso0 = (v: number) => '₱' + n0(v);
export function fmtDay(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : m + ' min ago';
  const h = Math.floor(m / 60);
  return h < 48 ? h + ' hours ago' : Math.floor(h / 24) + ' days ago';
}
export function daysLeft(iso: string | null) {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
export function acctStatus(a: Acct): AcctStatus {
  if (a.branch_of) return 'branch';
  if (a.is_tester) return 'tester';
  const paid = a.plan === 'pro' || a.plan === 'multi';
  if (paid && a.current_period_end && new Date(a.current_period_end).getTime() > Date.now()) return a.plan === 'multi' ? 'multi' : 'pro';
  if (paid) return 'expired';
  return 'free';
}
/** Paying and active, on either plan. */
export const isPaid = (s: AcctStatus) => s === 'pro' || s === 'multi';
export const STATUS_LABEL: Record<AcctStatus, string> = { tester: 'Tester', multi: 'Multi-Branch', pro: 'Pro', expired: 'Expired', branch: 'Branch', free: 'Free' };
export const STATUS_TONE: Record<AcctStatus, string> = { tester: 'good', multi: 'good', pro: 'good', expired: 'bad', branch: 'none', free: 'none' };

export async function loadPayments(status: 'pending' | 'approved' | 'rejected' | 'all' = 'all', limit = 200): Promise<Pay[]> {
  const sb = getSupabase(); if (!sb) return [];
  let q = sb.from('payment_requests').select('*').order('created_at', { ascending: status === 'pending' }).limit(limit);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Pay[];
}
export async function loadAccounts(): Promise<Acct[]> {
  const sb = getSupabase(); if (!sb) return [];
  const { data, error } = await sb.rpc('admin_list_accounts');
  if (error) throw error;
  return (data || []) as Acct[];
}
export async function loadBusiness(userId: string): Promise<BizView | null> {
  const sb = getSupabase(); if (!sb) return null;
  const { data, error } = await sb.rpc('admin_get_business', { p_user: userId });
  if (error) throw error;
  return ((data || []) as BizView[])[0] || null;
}
/** Short-lived links to the private receipt images, keyed by their storage path. */
export async function receiptUrls(paths: string[]): Promise<Record<string, string>> {
  const sb = getSupabase(); if (!sb || !paths.length) return {};
  const { data } = await sb.storage.from('payment-proofs').createSignedUrls(paths, 3600);
  const m: Record<string, string> = {};
  (data || []).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; });
  return m;
}
export async function approvePayment(id: string) {
  const sb = getSupabase(); if (!sb) return;
  const { error } = await sb.rpc('approve_payment', { p_id: id }); if (error) throw error;
}
export async function rejectPayment(id: string, note: string) {
  const sb = getSupabase(); if (!sb) return;
  const { error } = await sb.rpc('reject_payment', { p_id: id, p_note: note.trim() || null }); if (error) throw error;
}
export async function setTester(userId: string, on: boolean) {
  const sb = getSupabase(); if (!sb) return;
  const { error } = await sb.rpc('set_tester', { p_user: userId, p_on: on }); if (error) throw error;
}
