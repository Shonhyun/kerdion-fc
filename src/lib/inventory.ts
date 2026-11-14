import type { AppData, LibItem, Line, Size } from './types';
import { UNITS, activeCombos, dimOf, getLib, getPrep, getUnit, lineQty, units } from './calc';
import { daysAgo, iso, num, todayISO } from './format';

// ---------- How much of each bought item one sale uses ----------
// Amounts are in base units (g, ml or pc) of what is bought, so "usable %" waste is included:
// 18 g of garlic at 80% usable means 22.5 g has to be bought.

type Use = Record<string, number>;

function addLines(s: AppData, lines: Line[], z: Size | null, mult: number, out: Use, depth = 0) {
  lines.forEach((x) => {
    const u = UNITS[x.unit]; if (!u) return;
    const base = num(lineQty(x, z)) * u[1] * mult; if (!(base > 0)) return;
    const l = getLib(s, x.ref);
    if (l) {
      if (dimOf(l.unit) !== u[0]) return;
      const y = Math.min(100, Math.max(1, num(l.yield) || 100)) / 100;
      out[l.id] = (out[l.id] || 0) + base / y;
      return;
    }
    const p = getPrep(s, x.ref);
    if (p && depth < 4) {
      const pu = UNITS[p.unit]; const makes = num(p.makes) * (pu ? pu[1] : 0);
      if (pu && pu[0] === u[0] && makes > 0) addLines(s, p.items, null, base / makes, out, depth + 1);
    }
  });
}

/** For every sale key in the daily log (product, size or combo), the base units of each item it uses. */
export function salesUsage(s: AppData): Record<string, Use> {
  const out: Record<string, Use> = {};
  units(s).forEach((u) => { const m: Use = {}; addLines(s, u.r.items, u.s, 1, m); out[u.key] = m; });
  activeCombos(s).forEach((cb) => {
    const m: Use = {};
    cb.items.forEach((y) => {
      const u = getUnit(s, y.rid); const q = Math.max(0, num(y.qty)); if (!u || !q) return;
      const one = out[u.key] || (() => { const t: Use = {}; addLines(s, u.r.items, u.s, 1, t); return t; })();
      Object.entries(one).forEach(([k, v]) => { m[k] = (m[k] || 0) + v * q; });
    });
    out[cb.id] = m;
  });
  return out;
}

function dayUse(s: AppData, d: string, per: Record<string, Use>): Use {
  const out: Use = {};
  Object.entries(s.log[d] || {}).forEach(([key, v]) => {
    const n = Math.max(0, Math.round(num(v))); const u = per[key]; if (!n || !u) return;
    Object.entries(u).forEach(([lid, b]) => { out[lid] = (out[lid] || 0) + b * n; });
  });
  return out;
}

function nextDay(d: string): string { const p = d.split('-'); const x = new Date(+p[0], +p[1] - 1, +p[2]); x.setDate(x.getDate() + 1); return iso(x); }

// ---------- Stock on hand ----------

export type StockStatus = 'out' | 'low' | 'ok' | 'none';
export interface StockRow {
  l: LibItem;
  tracked: boolean;
  /** In the unit the item is bought in (l.unit). */
  onHand: number;
  /** Average used per open day over the last 14 days, in l.unit. */
  perDay: number;
  daysLeft: number | null;
  low: number | null;
  status: StockStatus;
  countedOn: string | null;
}

export function stockRows(s: AppData): StockRow[] {
  const per = salesUsage(s);
  const today = todayISO();
  const days = Object.keys(s.log).filter((d) => d <= today).sort();
  const useByDay: Record<string, Use> = {};
  days.forEach((d) => { useByDay[d] = dayUse(s, d, per); });
  const recent = days.filter((d) => d >= daysAgo(13) && Object.keys(useByDay[d]).length > 0);
  return s.library.map((l) => {
    const f = UNITS[l.unit] ? UNITS[l.unit][1] : 1;
    const evs = s.stock.filter((e) => e.lid === l.id).sort((a, b) => a.t - b.t);
    let ci = -1; evs.forEach((e, i) => { if (e.kind === 'count') ci = i; });
    const low = l.low != null && l.low !== '' ? num(l.low) : null;
    const perDay = recent.length ? recent.reduce((a, d) => a + (useByDay[d][l.id] || 0), 0) / recent.length / f : 0;
    if (ci < 0) return { l, tracked: false, onHand: 0, perDay, daysLeft: null, low, status: 'none' as StockStatus, countedOn: null };
    const c = evs[ci];
    let onHand = num(c.qty);
    evs.slice(ci + 1).forEach((e) => { onHand += e.kind === 'in' ? num(e.qty) : e.kind === 'waste' ? -num(e.qty) : 0; });
    const from = c.at === 'open' ? c.d : nextDay(c.d);
    days.forEach((d) => { if (d >= from) onHand -= (useByDay[d][l.id] || 0) / f; });
    const daysLeft = perDay > 0 ? Math.max(0, onHand) / perDay : null;
    const status: StockStatus = onHand <= 0.0001 ? 'out' : (low != null && onHand <= low) || (daysLeft != null && daysLeft < 2) ? 'low' : 'ok';
    return { l, tracked: true, onHand, perDay, daysLeft, low, status, countedOn: c.d };
  });
}

/** Tracked items that are out or running low, most urgent first. */
export function lowStock(s: AppData): StockRow[] {
  return stockRows(s).filter((r) => r.status === 'out' || r.status === 'low')
    .sort((a, b) => (a.status === b.status ? (a.daysLeft ?? 99) - (b.daysLeft ?? 99) : a.status === 'out' ? -1 : 1));
}

/** "2.4 kg", "36 pc", "850 ml": tidy amounts in the unit the item is bought in. */
export function qtyText(n: number, unit: string): string {
  const v = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + unit;
}
