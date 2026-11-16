import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * Server-only Supabase client with the service role key. It skips Row Level Security, so it is
 * used only in route handlers, after the caller's own session has been checked.
 * Set SUPABASE_SERVICE_ROLE_KEY in Vercel (Project Settings > Environment Variables). Never prefix
 * it with NEXT_PUBLIC_: it must never reach the browser.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
