import type { AppData, Recipe } from './types';

/** Free plan limits and Pro prices. Change them here and the whole app follows. */
export const FREE_PRODUCTS = 5;
export const FREE_PREPS = 2;
export const FREE_LOG_DAYS = 7;
export const PRICE = { monthly: 299, yearly: 2990 } as const;
export type Billing = keyof typeof PRICE;
/** What a year saves compared with paying monthly for 12 months. */
export const YEARLY_SAVES = PRICE.monthly * 12 - PRICE.yearly;

/** GCash details shown on the payment page. The QR image lives at public/gcash-qr.png. */
export const GCASH = {
  name: process.env.NEXT_PUBLIC_GCASH_NAME || '',
  number: process.env.NEXT_PUBLIC_GCASH_NUMBER || '',
  qr: '/gcash-qr.png',
};

/** The signed-in account's plan, as stored in Supabase (read-only for users). */
export interface Ent {
  loaded: boolean;
  plan: 'free' | 'pro';
  billing: Billing | null;
  periodStart: string | null;
  periodEnd: string | null;
  tester: boolean;
  admin: boolean;
}
export const FREE_ENT: Ent = { loaded: false, plan: 'free', billing: null, periodStart: null, periodEnd: null, tester: false, admin: false };

export function entIsPro(e: Ent, now = Date.now()): boolean {
  if (e.tester) return true;
  return e.plan === 'pro' && !!e.periodEnd && new Date(e.periodEnd).getTime() > now;
}
/** Pro that ran out: the plan says pro but the end date has passed. */
export function entExpired(e: Ent, now = Date.now()): boolean {
  return !e.tester && e.plan === 'pro' && !!e.periodEnd && new Date(e.periodEnd).getTime() <= now;
}

// ---------- the current gate ----------
// The math in calc.ts reads this so locked products and Pro-only data stay out of every total.
// It starts open, which is right for local mode (no accounts); the store closes it for cloud
// accounts until their plan has loaded.
let pro = true;
const EMPTY: ReadonlySet<string> = new Set<string>();
let lockCache = new WeakMap<Recipe[], Set<string>>();
let prepCache = new WeakMap<AppData['preps'], Set<string>>();

export function setPro(v: boolean) {
  if (v === pro) return false;
  pro = v; lockCache = new WeakMap(); prepCache = new WeakMap();
  return true;
}
export function isPro() { return pro; }

const isProduct = (r: Recipe) => r.kind !== 'addon';
export function productCount(s: AppData) { return s.recipes.filter(isProduct).length; }

/**
 * Products over the free limit, when the account is not on Pro. The first products made stay
 * active and the newer ones are locked, never deleted. Products saved before `created` existed
 * count as the oldest, in list order.
 */
export function lockedIds(s: AppData): ReadonlySet<string> {
  if (pro) return EMPTY;
  const hit = lockCache.get(s.recipes); if (hit) return hit;
  const prods = s.recipes.map((r, i) => ({ r, i })).filter((x) => isProduct(x.r));
  prods.sort((a, b) => (a.r.created || 0) - (b.r.created || 0) || a.i - b.i);
  const out = new Set(prods.slice(FREE_PRODUCTS).map((x) => x.r.id));
  lockCache.set(s.recipes, out);
  return out;
}
export const isLocked = (s: AppData, id: string) => lockedIds(s).has(id);

/** Sub-recipes over the free limit are read-only. Their cost still counts, so products stay correct. */
export function lockedPreps(s: AppData): ReadonlySet<string> {
  if (pro) return EMPTY;
  const hit = prepCache.get(s.preps); if (hit) return hit;
  const out = new Set(s.preps.slice(FREE_PREPS).map((p) => p.id));
  prepCache.set(s.preps, out);
  return out;
}

export function canAddProducts(s: AppData, n = 1) { return pro || productCount(s) + n <= FREE_PRODUCTS; }
export function canAddPrep(s: AppData) { return pro || s.preps.length < FREE_PREPS; }
/** Delivery app prices are a Pro feature; the setting is kept so it comes back on Pro. */
export function deliveryOn(s: AppData) { return pro && s.biz.deliveryOn; }

