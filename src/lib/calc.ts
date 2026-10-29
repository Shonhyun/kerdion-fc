import type { AppData, Calc, Combo, LibItem, Line, PriceAlert, PriceSnap, Prep, Recipe, SellUnit, Size } from './types';
import { makeL, nid, num, peso, todayISO } from './format';

export const UNITS: Record<string, [string, number]> = { g: ['mass', 1], kg: ['mass', 1000], ml: ['vol', 1], L: ['vol', 1000], pc: ['count', 1] };
export const UNIT_LIST = ['g', 'kg', 'ml', 'L', 'pc'];

export function find<T extends { id: string }>(arr: T[] | undefined, id: string): T | null {
  if (!arr) return null;
  for (const x of arr) if (x.id === id) return x;
  return null;
}
export const getLib = (s: AppData, id: string) => find(s.library, id);
export const getPrep = (s: AppData, id: string) => find(s.preps, id);
export const getR = (s: AppData, id: string) => find(s.recipes, id);
export const getC = (s: AppData, id: string) => find(s.combos, id);

export function rName(s: AppData, r: Recipe): string {
  const L = makeL(s.lang);
  return r.name || (r.kind === 'addon' ? L('Untitled add-on', 'Walang pangalang add-on') : L('Untitled product', 'Walang pangalan'));
}
export function units(s: AppData, kind?: 'product' | 'addon'): SellUnit[] {
  const out: SellUnit[] = [];
  s.recipes.forEach((r) => {
    if (kind && r.kind !== kind) return;
    if (r.sizes && r.sizes.length) r.sizes.forEach((z) => out.push({ key: r.id + '~' + z.id, r, s: z, name: rName(s, r) + ' · ' + (z.name || '?') }));
    else out.push({ key: r.id, r, s: null, name: rName(s, r) });
  });
  return out;
}
export function getUnit(s: AppData, key: string): SellUnit | null {
  const p = String(key || '').split('~');
  const r = getR(s, p[0]);
  if (!r) return null;
  if (p[1]) { const z = find(r.sizes, p[1]); return z ? { key, r, s: z, name: rName(s, r) + ' · ' + (z.name || '?') } : null; }
  return r.sizes && r.sizes.length ? null : { key, r, s: null, name: rName(s, r) };
}
export function uOrders(u: SellUnit): number { return Math.max(0, Math.round(num(u.s ? u.s.orders : u.r.orders))); }

export function dimOf(u: string): string { return UNITS[u] ? UNITS[u][0] : ''; }
export function rawPerBase(o: { price: string; qty: string; unit: string }): number {
  const u = UNITS[o.unit]; const q = num(o.qty) * (u ? u[1] : 0);
  return q > 0 ? num(o.price) / q : 0;
}
export function libPerBase(l: LibItem): number {
  const y = Math.min(100, Math.max(1, num(l.yield) || 100)) / 100;
  return rawPerBase(l) / y;
}
export function prepTotal(s: AppData, p: Prep): number {
  let t = 0; p.items.forEach((x) => { const c = lineCost(s, x); if (c != null) t += c; }); return t;
}
export function prepPerBase(s: AppData, p: Prep): number {
  const u = UNITS[p.unit]; const q = num(p.makes) * (u ? u[1] : 0);
  return q > 0 ? prepTotal(s, p) / q : 0;
}
interface Ref { kind: 'lib' | 'prep'; dim: string; per: number; cat: 'ing' | 'pack'; lib?: LibItem; prep?: Prep; name: string; id: string }
export function refOf(s: AppData, id: string): Ref | null {
  const l = getLib(s, id);
  if (l) return { kind: 'lib', dim: dimOf(l.unit), per: libPerBase(l), cat: l.cat, lib: l, name: l.name, id: l.id };
  const p = getPrep(s, id);
  if (p) return { kind: 'prep', dim: dimOf(p.unit), per: prepPerBase(s, p), cat: 'ing', prep: p, name: p.name, id: p.id };
  return null;
}
export function lineQty(x: Line, z: Size | null): string {
  if (z && x.q && Object.prototype.hasOwnProperty.call(x.q, z.id)) return x.q[z.id];
  return x.qty;
}
export function lineCost(s: AppData, x: Line, z: Size | null = null): number | null {
  const r = refOf(s, x.ref); if (!r) return null;
  const u = UNITS[x.unit]; if (!u || u[0] !== r.dim) return null;
  return r.per * num(lineQty(x, z)) * u[1];
}
export function taxMul(s: AppData): number { return s.biz.taxOn ? 1 + num(s.biz.taxRate) / 100 : 1; }
export function roundUp(s: AppData, v: number): number {
  const m = s.biz.round || 'exact';
  if (v <= 0 || m === 'exact') return v;
  if (m === 'peso') return Math.ceil(v - 1e-9);
  if (m === '5') return Math.ceil(v / 5 - 1e-9) * 5;
  if (m === '10') return Math.ceil(v / 10 - 1e-9) * 10;
  // Ends in 9: round up to the next ...9, except a round ten becomes ...9 one peso lower (₱60 → ₱59, not ₱69).
  if (m === '9') { const x = Math.ceil(v - 1e-9); if (x % 10 === 0 && x >= 10) return x - 1; return x + ((9 - (x % 10)) + 10) % 10; }
  return v;
}
export function calc(s: AppData, r: Recipe, z: Size | null): Calc {
  let ing = 0, pack = 0;
  r.items.forEach((x) => { const rf = refOf(s, x.ref); const c = lineCost(s, x, z); if (c == null || !rf) return; if (rf.cat === 'pack') pack += c; else ing += c; });
  const cost = ing + pack, tm = taxMul(s);
  let pre: number, sell: number;
  if (r.mode === 'price') { sell = num(z ? z.price : r.price); pre = sell / tm; }
  else {
    const m = Math.min(95, Math.max(0, num(r.margin))) / 100;
    const pre0 = cost > 0 ? Math.ceil(cost / (1 - m) - 1e-9) : 0;
    sell = Math.round(pre0 * tm * 100) / 100;
    if ((s.biz.round || 'exact') === 'exact') pre = pre0; else { sell = roundUp(s, sell); pre = sell / tm; }
  }
  const profit = pre - cost;
  return { ing, pack, cost, pre, sell, tax: sell - pre, profit, foodPct: pre > 0 ? cost / pre * 100 : 0, margin: pre > 0 ? profit / pre * 100 : 0 };
}
export const uCalc = (s: AppData, u: SellUnit) => calc(s, u.r, u.s);
export function curSize(r: Recipe, sel: string): Size | null {
  if (!r.sizes || !r.sizes.length) return null;
  return find(r.sizes, sel) || r.sizes[0];
}
export function delivery(s: AppData, c: Calc) {
  const cm = Math.min(90, Math.max(0, num(s.biz.deliveryRate))) / 100, tm = taxMul(s), denom = 1 / tm - cm;
  const D = denom > 0 && c.pre > 0 ? Math.ceil(c.pre / denom - 1e-9) : 0;
  return { price: D, same: c.sell / tm - cm * c.sell - c.cost };
}
export function comboCalc(s: AppData, cb: Combo) {
  let cost = 0, sep = 0; const tm = taxMul(s);
  cb.items.forEach((y) => { const u = getUnit(s, y.rid); if (!u) return; const c = uCalc(s, u), q = Math.max(0, num(y.qty)); cost += c.cost * q; sep += c.sell * q; });
  const sell = num(cb.price), pre = sell / tm, profit = pre - cost;
  return { cost, sep, sell, pre, tax: sell - pre, profit, save: sep - sell, margin: pre > 0 ? profit / pre * 100 : 0 };
}
export interface TotalRow { kind: 'u' | 'a' | 'c'; key: string; name: string; c: { sell: number; cost: number; tax: number; profit: number }; o: number; rev: number; cogs: number; tax: number; gross: number }
export function totals(s: AppData) {
  const L = makeL(s.lang);
  const t = { rows: [] as TotalRow[], orders: 0, rev: 0, cogs: 0, tax: 0, gross: 0, fixed: 0, net: 0, days: 1, avg: 0, be: 0 };
  const add = (kind: TotalRow['kind'], key: string, name: string, c: TotalRow['c'], o: number) => {
    const row: TotalRow = { kind, key, name, c, o, rev: c.sell * o, cogs: c.cost * o, tax: c.tax * o, gross: c.profit * o };
    t.rows.push(row); t.orders += o; t.rev += row.rev; t.cogs += row.cogs; t.tax += row.tax; t.gross += row.gross;
  };
  units(s).forEach((u) => add(u.r.kind === 'addon' ? 'a' : 'u', u.key, u.name, uCalc(s, u), uOrders(u)));
  s.combos.forEach((cb) => add('c', cb.id, cb.name || L('Untitled combo', 'Walang pangalang combo'), comboCalc(s, cb), Math.max(0, Math.round(num(cb.orders)))));
  t.fixed = s.fixed.reduce((a, f) => a + Math.max(0, num(f.amount)), 0);
  t.net = t.gross - t.fixed;
  t.days = Math.max(1, Math.round(num(s.biz.daysOpen)) || 1);
  t.avg = t.orders > 0 ? t.gross / t.orders : 0;
  t.be = t.avg > 0 ? Math.ceil(t.fixed / t.avg) : 0;
  return t;
}
export function usedIn(s: AppData, refId: string): string[] {
  const out: string[] = [];
  s.recipes.forEach((r) => {
    const hit = r.items.some((x) => { if (x.ref === refId) return true; const p = getPrep(s, x.ref); return !!p && p.items.some((y) => y.ref === refId); });
    if (hit) out.push(rName(s, r));
  });
  s.preps.forEach((p) => { if (p.items.some((y) => y.ref === refId)) out.push((p.name || '?') + ' (sub-recipe)'); });
  return out;
}
export function progress(s: AppData) {
  const t = totals(s);
  const p = { products: units(s).some((u) => { const c = uCalc(s, u); return c.cost > 0 && c.sell > 0; }), expenses: t.fixed > 0, sales: t.orders > 0, report: false };
  p.report = p.products && p.expenses && p.sales;
  return p;
}
export function unitPriceText(per: number, dim: string): string {
  if (dim === 'mass') return peso(per * 1000) + ' / kg';
  if (dim === 'vol') return peso(per * 1000) + ' / L';
  return peso(per) + ' / pc';
}

// ---------- daily log ----------
export function logItems(s: AppData) {
  const L = makeL(s.lang);
  return units(s).map((u) => ({ key: u.key, name: u.name, c: uCalc(s, u) as { sell: number; profit: number }, combo: false }))
    .concat(s.combos.map((cb) => ({ key: cb.id, name: cb.name || L('Combo', 'Combo'), c: comboCalc(s, cb), combo: true })));
}
/** Pass `items` from a single `logItems` call when totalling several days: it prices every product. */
export function dayStats(s: AppData, d: string, items: ReturnType<typeof logItems> = logItems(s)) {
  const rec = s.log[d] || {}; let o = 0, rev = 0, gross = 0;
  items.forEach((x) => { const n = Math.max(0, Math.round(num(rec[x.key]))); o += n; rev += x.c.sell * n; gross += x.c.profit * n; });
  return { o, rev, gross };
}

// ---------- price alerts (run inside an immer draft) ----------
function snap(l: LibItem, t?: number) { return { d: todayISO(), t: t == null ? Date.now() : t, price: l.price, qty: l.qty, unit: l.unit }; }
export function commitLib(s: AppData, l: LibItem, force = false): PriceAlert | null {
  const h = l.history || (l.history = []);
  // Only the last 12 snapshots are ever shown, and the whole business is saved as one document,
  // so every path that records one trims here rather than letting history grow without end.
  const push = (v: PriceSnap) => { h.push(v); if (h.length > 12) h.splice(0, h.length - 12); };
  const last = h[h.length - 1];
  const nowRaw = rawPerBase(l);
  if (!last) { if (nowRaw > 0) push(snap(l)); return null; }
  const oldRaw = rawPerBase(last), same = dimOf(last.unit) === dimOf(l.unit);
  const recent = !!last.t && Date.now() - last.t < 10 * 60 * 1000;
  if (Math.abs(nowRaw - oldRaw) < 1e-9 && same) return null;
  if (!same || nowRaw <= 0 || oldRaw <= 0 || (!force && recent)) {
    if (nowRaw > 0) { if (recent) h[h.length - 1] = snap(l); else push(snap(l)); }
    return null;
  }
  const cur = { price: l.price, qty: l.qty, unit: l.unit };
  l.price = last.price; l.qty = last.qty; l.unit = last.unit;
  const before = totals(s).net; const oldSell: Record<string, number> = {};
  units(s).forEach((u) => { if (u.r.mode !== 'price') oldSell[u.key] = uCalc(s, u).sell; });
  l.price = cur.price; l.qty = cur.qty; l.unit = cur.unit;
  // Impact if the owner keeps today's selling prices.
  const kept: [Recipe, string, string[]][] = [];
  s.recipes.forEach((r) => {
    if (r.mode === 'price') return;
    kept.push([r, r.price, r.sizes.map((z) => z.price)]);
    r.mode = 'price';
    if (r.sizes.length) r.sizes.forEach((z) => { z.price = String(oldSell[r.id + '~' + z.id] || 0); }); else r.price = String(oldSell[r.id] || 0);
  });
  const after = totals(s).net;
  kept.forEach(([r, price, prices]) => { r.mode = 'margin'; r.price = price; r.sizes.forEach((z, i) => { z.price = prices[i]; }); });
  const sugg: string[] = [];
  units(s).forEach((u) => { if (oldSell[u.key] != null) { const ns = uCalc(s, u).sell; if (Math.abs(ns - oldSell[u.key]) > 0.004) sugg.push(u.name + ' ' + peso(ns)); } });
  push(snap(l));
  const a: PriceAlert ={ id: nid('a'), lid: l.id, name: l.name, from: unitPriceText(oldRaw, dimOf(l.unit)), to: unitPriceText(nowRaw, dimOf(l.unit)), up: nowRaw > oldRaw, delta: after - before, sugg, d: todayISO(), products: usedIn(s, l.id) };
  s.alerts.unshift(a); if (s.alerts.length > 8) s.alerts.length = 8;
  return a;
}
export function alertText(s: AppData, a: PriceAlert) {
  const L = makeL(s.lang);
  const dir = a.up ? L('went up', 'tumaas') : L('went down', 'bumaba');
  const eff = Math.abs(a.delta) < 0.5 ? L('Your monthly profit barely changes.', 'Halos walang epekto sa monthly profit mo.')
    : (a.delta < 0 ? L('If you keep your current prices, your monthly profit drops by ', 'Kung hindi mo gagalawin ang presyo, bawas sa monthly profit mo: ') : L('If you keep your current prices, your monthly profit goes up by ', 'Kung hindi mo gagalawin ang presyo, dagdag sa monthly profit mo: ')) + peso(Math.abs(a.delta), 0) + '.';
  const sg = a.sugg && a.sugg.length ? ' ' + L('New suggested price: ', 'Bagong suggested price: ') + a.sugg.join(', ') + '.' : '';
  return { title: a.name + ' ' + dir + ': ' + a.from + ' → ' + a.to, body: eff + sg + (a.products.length ? ' ' + L('Affects: ', 'Apektado: ') + a.products.join(', ') + '.' : '') };
}
