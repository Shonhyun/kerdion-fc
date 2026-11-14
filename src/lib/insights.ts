import type { AppData } from './types';
import { activeCombos, comboCalc, roundUp, taxMul, totals, uCalc, units, uOrders } from './calc';
import { daysAgo, num, todayISO } from './format';

// ---------- Menu matrix (menu engineering) ----------
// Each item is placed by how often it sells (popularity) and how much it earns per order.
// Popular = at least 70% of an even share of orders; profitable = at or above the average
// profit per order across the menu (weighted by orders). This is the classic
// Kasavana–Smith menu engineering method, kept in plain words for small food businesses.

export type Quad = 'star' | 'workhorse' | 'puzzle' | 'dog';
export interface MatrixItem { key: string; name: string; orders: number; profit: number; sell: number; margin: number; combo: boolean; quad: Quad }
export interface Matrix { items: MatrixItem[]; popLine: number; profitLine: number; total: number }

/** Orders per item sold in the last `days` days of the daily log, today included. */
export function loggedOrders(s: AppData, days = 30): { counts: Record<string, number>; daysLogged: number } {
  const start = daysAgo(days - 1);
  const counts: Record<string, number> = {}; let daysLogged = 0;
  Object.keys(s.log).forEach((d) => {
    if (d < start || d > todayISO()) return;
    let any = false;
    Object.entries(s.log[d] || {}).forEach(([k, v]) => { const n = Math.max(0, Math.round(num(v))); if (n > 0) { counts[k] = (counts[k] || 0) + n; any = true; } });
    if (any) daysLogged++;
  });
  return { counts, daysLogged };
}

export function menuMatrix(s: AppData, source: 'plan' | 'actual'): Matrix {
  const logged = source === 'actual' ? loggedOrders(s).counts : null;
  const raw: Omit<MatrixItem, 'quad'>[] = [];
  units(s, 'product').forEach((u) => {
    const c = uCalc(s, u);
    raw.push({ key: u.key, name: u.name, orders: logged ? logged[u.key] || 0 : uOrders(u), profit: c.profit, sell: c.sell, margin: c.margin, combo: false });
  });
  activeCombos(s).forEach((cb) => {
    const c = comboCalc(s, cb);
    raw.push({ key: cb.id, name: cb.name || 'Combo', orders: logged ? logged[cb.id] || 0 : Math.max(0, Math.round(num(cb.orders))), profit: c.profit, sell: c.sell, margin: c.margin, combo: true });
  });
  const items = raw.filter((x) => x.sell > 0);
  const total = items.reduce((a, x) => a + x.orders, 0);
  const popLine = items.length ? (total / items.length) * 0.7 : 0;
  const profitLine = total > 0 ? items.reduce((a, x) => a + x.profit * x.orders, 0) / total : 0;
  return {
    items: items.map((x) => {
      const pop = x.orders >= popLine && x.orders > 0, rich = x.profit >= profitLine;
      return { ...x, quad: pop ? (rich ? 'star' : 'workhorse') : (rich ? 'puzzle' : 'dog') };
    }),
    popLine, profitLine, total,
  };
}

// ---------- Price-hike simulator ----------
export interface HikeRow { key: string; name: string; orders: number; costBefore: number; costAfter: number; sell: number; profitBefore: number; profitAfter: number; suggested: number; auto: boolean; combo: boolean }
export interface Hike { rows: HikeRow[]; monthlyLoss: number; netBefore: number; netAfter: number; netWithSuggested: number }

/**
 * What happens to profit if one item (or every ingredient and packaging) changes price by `pct` percent.
 * Products with their own price keep it; products priced by margin follow their cost, as in the app.
 * Also suggests, for fixed-price products, the price that keeps their profit per order the same.
 */
export function priceHike(s: AppData, target: string, pct: number): Hike {
  const f = 1 + pct / 100;
  const s2: AppData = JSON.parse(JSON.stringify(s));
  s2.library.forEach((l) => {
    const hit = target === 'all' || (target === 'all-ing' && l.cat === 'ing') || (target === 'all-pack' && l.cat === 'pack') || l.id === target;
    if (hit) l.price = String(Math.max(0, num(l.price) * f));
  });
  const tm = taxMul(s);
  // Pass the extra cost on to the price so the profit per order stays the same, rounded up for the menu.
  const suggest = (pre: number, cost1: number, cost2: number) => {
    const v = Math.ceil((pre + (cost2 - cost1)) * tm - 1e-9);
    return Math.max(v, roundUp(s, v));
  };
  const rows: HikeRow[] = [];
  units(s).forEach((u) => {
    const a = uCalc(s, u), u2 = units(s2).find((x) => x.key === u.key); if (!u2) return;
    const b = uCalc(s2, u2);
    if (Math.abs(b.cost - a.cost) < 0.005) return;
    // Products priced by margin follow their cost automatically; the rest keep their price.
    const auto = u.r.mode !== 'price';
    rows.push({ key: u.key, name: u.name, orders: uOrders(u), costBefore: a.cost, costAfter: b.cost, sell: a.sell, profitBefore: a.profit, profitAfter: b.profit,
      suggested: auto ? b.sell : suggest(a.pre, a.cost, b.cost), auto, combo: false });
  });
  activeCombos(s).forEach((cb) => {
    const a = comboCalc(s, cb), cb2 = s2.combos.find((x) => x.id === cb.id); if (!cb2) return;
    const b = comboCalc(s2, cb2);
    if (Math.abs(b.cost - a.cost) < 0.005) return;
    rows.push({ key: cb.id, name: cb.name || 'Combo', orders: Math.max(0, Math.round(num(cb.orders))), costBefore: a.cost, costAfter: b.cost, sell: a.sell, profitBefore: a.profit, profitAfter: b.profit,
      suggested: suggest(a.pre, a.cost, b.cost), auto: false, combo: true });
  });
  rows.sort((x, y) => (x.profitAfter - x.profitBefore) * x.orders - (y.profitAfter - y.profitBefore) * y.orders);
  const before = totals(s), after = totals(s2);
  const monthlyLoss = before.net - after.net;
  const netWithSuggested = after.net + rows.filter((r) => !r.auto).reduce((acc, r) => acc + (r.suggested - r.sell) / tm * r.orders, 0);
  return { rows, monthlyLoss, netBefore: before.net, netAfter: after.net, netWithSuggested };
}
