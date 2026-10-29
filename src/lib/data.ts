import type { AppData, Lang, LibItem, Line, PriceSnap, Recipe, Size } from './types';
import { commitLib, find, lineQty } from './calc';
import { daysAgo, makeL, nid, num, todayISO } from './format';

export function lib(cat: 'ing' | 'pack', name: string, price: number | string, qty: number | string, unit: string, yld?: number, hist?: PriceSnap[]): LibItem {
  const l: LibItem = { id: nid('l'), cat, name, price: String(price), qty: String(qty), unit, yield: String(yld || 100), history: [] };
  if (hist) l.history = hist; else l.history.push({ d: todayISO(), t: 0, price: l.price, qty: l.qty, unit: l.unit });
  return l;
}
export function line(ref: string, qty: number | string, unit: string): Line { return { id: nid('x'), ref, qty: String(qty), unit }; }
export function recipe(kind: 'product' | 'addon', name: string, extra?: Partial<Recipe>): Recipe {
  return { id: nid('r'), kind, name, mode: 'margin', margin: '30', price: '', benchmark: '', orders: '0', items: [], sizes: [], ...(extra || {}) };
}

export function fresh(lang: Lang = 'en', businessName = ''): AppData {
  return {
    v: 4, lang, sample: false, bannerHidden: true, onboarded: false, goal: '', lastBackup: 0,
    biz: { name: businessName, daysOpen: '26', taxOn: false, taxRate: '12', deliveryOn: false, deliveryRate: '30', round: 'exact' },
    library: [], preps: [], recipes: [], combos: [], fixed: [], log: {}, alerts: [], ups: { main: '', addon: '', pct: '30' },
  };
}

export function sample(lang: Lang = 'en'): AppData {
  const rice = lib('ing', 'Rice', 50, 1, 'kg'), egg = lib('ing', 'Egg', 255, 30, 'pc', 100, [{ d: daysAgo(20), t: 1, price: '240', qty: '30', unit: 'pc' }]),
    garlic = lib('ing', 'Garlic', 180, 1, 'kg', 80), oil = lib('ing', 'Cooking oil', 95, 1, 'L'), tapa = lib('ing', 'Beef tapa (marinated)', 450, 1, 'kg'),
    tea = lib('ing', 'Iced tea powder', 140, 1, 'kg'), ice = lib('ing', 'Ice', 50, 5, 'kg'),
    bowl = lib('pack', 'Bowl with lid', 200, 50, 'pc'), ute = lib('pack', 'Spoon and fork', 100, 100, 'pc'), nap = lib('pack', 'Napkin', 53, 200, 'pc'),
    cup16 = lib('pack', 'Cup 16 oz with lid', 150, 50, 'pc'), cup22 = lib('pack', 'Cup 22 oz with lid', 210, 50, 'pc'), straw = lib('pack', 'Straw', 30, 100, 'pc');
  const grice = { id: nid('p'), name: 'Garlic rice (batch)', makes: '1', unit: 'kg', items: [line(rice.id, 450, 'g'), line(garlic.id, 25, 'g'), line(oil.id, 20, 'ml')] };
  const r1 = recipe('product', 'Beef Tapsilog', { margin: '31', benchmark: '110', orders: '900',
    items: [line(tapa.id, 100, 'g'), line(grice.id, 200, 'g'), line(egg.id, 1, 'pc'), line(oil.id, 10, 'ml'), line(bowl.id, 1, 'pc'), line(ute.id, 1, 'pc'), line(nap.id, 1, 'pc')] });
  const sM: Size = { id: nid('s'), name: '16 oz', price: '25', orders: '450' }, sL: Size = { id: nid('s'), name: '22 oz', price: '35', orders: '150' };
  const q = (a: string, b: string) => ({ [sM.id]: a, [sL.id]: b });
  const tl = { ...line(tea.id, 25, 'g'), q: q('25', '35') }, il = { ...line(ice.id, 200, 'g'), q: q('200', '280') },
    c16 = { ...line(cup16.id, 1, 'pc'), q: q('1', '0') }, c22 = { ...line(cup22.id, 1, 'pc'), q: q('0', '1') }, st = { ...line(straw.id, 1, 'pc'), q: q('1', '1') };
  const r2 = recipe('product', 'Iced Tea', { mode: 'price', margin: '50', benchmark: '30', items: [tl, il, c16, c22, st], sizes: [sM, sL] });
  const a1 = recipe('addon', 'Extra egg', { mode: 'price', price: '15', orders: '120', items: [line(egg.id, 1, 'pc'), line(oil.id, 5, 'ml')] });
  const c1 = { id: nid('c'), name: 'Tapsilog + Iced Tea', price: '125', orders: '150', items: [{ id: nid('y'), rid: r1.id, qty: '1' }, { id: nid('y'), rid: r2.id + '~' + sM.id, qty: '1' }] };
  const log: AppData['log'] = {};
  [[3, 28, 14, 4, 5, 3], [2, 31, 17, 5, 6, 4], [1, 35, 15, 5, 5, 5]].forEach((d) => {
    log[daysAgo(d[0])] = { [r1.id]: String(d[1]), [r2.id + '~' + sM.id]: String(d[2]), [r2.id + '~' + sL.id]: String(d[3]), [c1.id]: String(d[4]), [a1.id]: String(d[5]) };
  });
  const s: AppData = {
    v: 4, lang, sample: true, bannerHidden: false, onboarded: true, goal: '30000', lastBackup: 0,
    biz: { name: 'Kusina ni Juan', daysOpen: '30', taxOn: true, taxRate: '12', deliveryOn: true, deliveryRate: '30', round: 'exact' },
    library: [rice, egg, garlic, oil, tapa, tea, ice, bowl, ute, nap, cup16, cup22, straw], preps: [grice], recipes: [r1, r2, a1], combos: [c1],
    fixed: [
      { id: nid('f'), name: 'Stall rent', amount: '10000' }, { id: nid('f'), name: 'Staff salary', amount: '12000' },
      { id: nid('f'), name: 'Electricity', amount: '2500' }, { id: nid('f'), name: 'Water', amount: '600' }, { id: nid('f'), name: 'LPG', amount: '800' },
    ],
    log, alerts: [], ups: { main: r1.id, addon: r2.id + '~' + sM.id, pct: '30' },
  };
  commitLib(s, egg, true); // seed one price alert so the feature is visible
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValid(s: any): s is AppData {
  return !!s && typeof s === 'object' && !!s.biz && Array.isArray(s.recipes) && Array.isArray(s.library) && Array.isArray(s.fixed);
}
/**
 * Fills defaults so data from older versions (including the HTML prototype backups) keeps working.
 * Nothing here may assume a shape: this also runs on whatever the `data` column holds, which starts
 * out as `{}`, so every field is checked before it is read. Anything present is kept as it is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalize(raw: any): AppData {
  const s = (raw && typeof raw === 'object' ? raw : {}) as AppData;
  // A real business record always carries `biz`. Without it there is nothing to keep, so the
  // owner is sent through the quick setup instead of landing on an empty dashboard.
  const hadBiz = !!(s.biz && typeof s.biz === 'object');
  s.biz = { ...fresh().biz, ...(hadBiz ? s.biz : {}) };
  (['library', 'recipes', 'fixed', 'preps', 'combos', 'alerts'] as const).forEach((k) => { if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown[]>)[k] = []; });
  if (!s.log || typeof s.log !== 'object') s.log = {};
  if (!s.ups || typeof s.ups !== 'object') s.ups = { main: '', addon: '', pct: '30' };
  if (s.onboarded == null) s.onboarded = hadBiz;
  if (s.goal == null) s.goal = '';
  if (!s.lastBackup) s.lastBackup = 0;
  if (s.lang !== 'tl') s.lang = 'en';
  s.recipes.forEach((r) => { if (!r.kind) r.kind = 'product'; if (!Array.isArray(r.sizes)) r.sizes = []; if (!Array.isArray(r.items)) r.items = []; });
  s.preps.forEach((p) => { if (!Array.isArray(p.items)) p.items = []; });
  s.combos.forEach((cb) => { if (!Array.isArray(cb.items)) cb.items = []; });
  s.library.forEach((l) => { if (!Array.isArray(l.history)) l.history = []; if (!l.yield) l.yield = '100'; });
  s.v = 4;
  return s;
}
/** Converts the very first prototype's data (ingredients typed per product) into the shared-list format. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateV1(o: any): AppData {
  const s = fresh(); s.onboarded = true;
  s.biz.name = o.biz?.name || ''; s.biz.daysOpen = o.biz?.daysOpen || '26'; s.biz.taxOn = !!o.biz?.taxOn; s.biz.taxRate = o.biz?.taxRate || '12';
  s.fixed = o.fixed || [];
  const byName: Record<string, LibItem> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (o.recipes || []).forEach((r: any) => {
    const nr = recipe('product', r.name, { id: r.id, mode: r.mode, margin: r.margin, price: r.price, benchmark: r.benchmark, orders: r.orders });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r.items || []).forEach((i: any) => {
      const k = i.type + '|' + (i.name || '').trim().toLowerCase();
      let l = byName[k];
      if (!l) { l = lib(i.type === 'pack' ? 'pack' : 'ing', i.name || '', i.buyPrice, i.buyQty, i.buyUnit); byName[k] = l; s.library.push(l); }
      nr.items.push(line(l.id, i.useQty, i.useUnit));
    });
    s.recipes.push(nr);
  });
  return s;
}

// ---------- templates ----------
type TLib = [('ing' | 'pack'), string, number, number, string, number?];
interface Template {
  name: [string, string]; desc: [string, string];
  lib: TLib[];
  preps: [string, number, string, [string, number, string][]][];
  products: [string, number, [string, number, string][]][];
  sized?: [string, number, string[], [string, number, number, string][]][];
  addons: [string, number, [string, number, string][]][];
}
export const TEMPLATES: Record<string, Template> = {
  silog: { name: ['Silog stall', 'Silog stall'], desc: ['Tapsilog, Longsilog, Tocilog', 'Tapsilog, Longsilog, Tocilog'],
    lib: [['ing', 'Rice', 50, 1, 'kg'], ['ing', 'Egg', 255, 30, 'pc'], ['ing', 'Garlic', 180, 1, 'kg', 80], ['ing', 'Cooking oil', 95, 1, 'L'], ['ing', 'Beef tapa (marinated)', 450, 1, 'kg'], ['ing', 'Longganisa', 300, 1, 'kg'], ['ing', 'Tocino', 320, 1, 'kg'], ['pack', 'Bowl with lid', 200, 50, 'pc'], ['pack', 'Spoon and fork', 100, 100, 'pc'], ['pack', 'Napkin', 53, 200, 'pc']],
    preps: [['Garlic rice (batch)', 1, 'kg', [['Rice', 450, 'g'], ['Garlic', 25, 'g'], ['Cooking oil', 20, 'ml']]]],
    products: [['Tapsilog', 31, [['Beef tapa (marinated)', 100, 'g'], ['Garlic rice (batch)', 200, 'g'], ['Egg', 1, 'pc'], ['Cooking oil', 10, 'ml'], ['Bowl with lid', 1, 'pc'], ['Spoon and fork', 1, 'pc'], ['Napkin', 1, 'pc']]],
      ['Longsilog', 35, [['Longganisa', 90, 'g'], ['Garlic rice (batch)', 200, 'g'], ['Egg', 1, 'pc'], ['Cooking oil', 10, 'ml'], ['Bowl with lid', 1, 'pc'], ['Spoon and fork', 1, 'pc'], ['Napkin', 1, 'pc']]],
      ['Tocilog', 35, [['Tocino', 90, 'g'], ['Garlic rice (batch)', 200, 'g'], ['Egg', 1, 'pc'], ['Cooking oil', 10, 'ml'], ['Bowl with lid', 1, 'pc'], ['Spoon and fork', 1, 'pc'], ['Napkin', 1, 'pc']]]],
    addons: [['Extra egg', 40, [['Egg', 1, 'pc'], ['Cooking oil', 5, 'ml']]], ['Extra rice', 40, [['Garlic rice (batch)', 200, 'g']]]] },
  milktea: { name: ['Milk tea shop', 'Milk tea shop'], desc: ['Classic and Wintermelon, 16 and 22 oz', 'Classic at Wintermelon, 16 at 22 oz'],
    lib: [['ing', 'Black tea leaves', 350, 1, 'kg'], ['ing', 'Non-dairy creamer', 220, 1, 'kg'], ['ing', 'Brown sugar syrup', 180, 1, 'L'], ['ing', 'Wintermelon syrup', 280, 1, 'L'], ['ing', 'Tapioca pearls', 160, 1, 'kg'], ['ing', 'Ice', 50, 5, 'kg'], ['pack', 'Cup 16 oz with seal', 180, 50, 'pc'], ['pack', 'Cup 22 oz with seal', 230, 50, 'pc'], ['pack', 'Big straw', 60, 100, 'pc']],
    preps: [], products: [],
    sized: [['Classic Milk Tea', 55, ['16 oz', '22 oz'], [['Black tea leaves', 8, 11, 'g'], ['Non-dairy creamer', 30, 42, 'g'], ['Brown sugar syrup', 30, 42, 'ml'], ['Tapioca pearls', 50, 70, 'g'], ['Ice', 150, 210, 'g'], ['Cup 16 oz with seal', 1, 0, 'pc'], ['Cup 22 oz with seal', 0, 1, 'pc'], ['Big straw', 1, 1, 'pc']]],
      ['Wintermelon Milk Tea', 55, ['16 oz', '22 oz'], [['Black tea leaves', 8, 11, 'g'], ['Non-dairy creamer', 30, 42, 'g'], ['Wintermelon syrup', 30, 42, 'ml'], ['Tapioca pearls', 50, 70, 'g'], ['Ice', 150, 210, 'g'], ['Cup 16 oz with seal', 1, 0, 'pc'], ['Cup 22 oz with seal', 0, 1, 'pc'], ['Big straw', 1, 1, 'pc']]]],
    addons: [['Extra pearls', 60, [['Tapioca pearls', 40, 'g']]]] },
  coffee: { name: ['Coffee shop', 'Coffee shop'], desc: ['Iced Americano and Latte, 12 and 16 oz', 'Iced Americano at Latte, 12 at 16 oz'],
    lib: [['ing', 'Coffee beans', 900, 1, 'kg'], ['ing', 'Fresh milk', 95, 1, 'L'], ['ing', 'Simple syrup', 120, 1, 'L'], ['ing', 'Ice', 50, 5, 'kg'], ['pack', 'Cup 12 oz with lid', 130, 50, 'pc'], ['pack', 'Cup 16 oz with lid', 150, 50, 'pc'], ['pack', 'Straw', 30, 100, 'pc']],
    preps: [], products: [],
    sized: [['Iced Americano', 60, ['12 oz', '16 oz'], [['Coffee beans', 18, 18, 'g'], ['Simple syrup', 10, 15, 'ml'], ['Ice', 110, 150, 'g'], ['Cup 12 oz with lid', 1, 0, 'pc'], ['Cup 16 oz with lid', 0, 1, 'pc'], ['Straw', 1, 1, 'pc']]],
      ['Iced Latte', 55, ['12 oz', '16 oz'], [['Coffee beans', 18, 18, 'g'], ['Fresh milk', 140, 180, 'ml'], ['Simple syrup', 10, 15, 'ml'], ['Ice', 90, 120, 'g'], ['Cup 12 oz with lid', 1, 0, 'pc'], ['Cup 16 oz with lid', 0, 1, 'pc'], ['Straw', 1, 1, 'pc']]]],
    addons: [['Extra shot', 60, [['Coffee beans', 9, 'g']]]] },
  bakery: { name: ['Bakery', 'Bakery'], desc: ['Pandesal from a dough batch', 'Pandesal galing sa batch ng dough'],
    lib: [['ing', 'Bread flour', 55, 1, 'kg'], ['ing', 'Sugar', 70, 1, 'kg'], ['ing', 'Instant yeast', 50, 100, 'g'], ['ing', 'Margarine', 120, 500, 'g'], ['ing', 'Salt', 30, 1, 'kg'], ['ing', 'Breadcrumbs', 60, 1, 'kg'], ['pack', 'Paper bag', 120, 100, 'pc']],
    preps: [['Pandesal dough (batch)', 50, 'pc', [['Bread flour', 1000, 'g'], ['Sugar', 150, 'g'], ['Instant yeast', 15, 'g'], ['Margarine', 100, 'g'], ['Salt', 15, 'g'], ['Breadcrumbs', 50, 'g']]]],
    products: [['Pandesal (pack of 10)', 40, [['Pandesal dough (batch)', 10, 'pc'], ['Paper bag', 1, 'pc']]]], addons: [] },
};
/** Adds a template's items to the data (mutates; use inside update). Returns how many products and add-ons were added. */
export function applyTemplate(s: AppData, key: string): number {
  const T = TEMPLATES[key]; if (!T) return 0;
  const byName: Record<string, string> = {}; let added = 0;
  s.library.forEach((l) => { byName[l.name.trim().toLowerCase()] = l.id; });
  s.preps.forEach((p) => { byName[p.name.trim().toLowerCase()] = p.id; });
  T.lib.forEach((a) => { const k = a[1].toLowerCase(); if (!byName[k]) { const l = lib(a[0], a[1], a[2], a[3], a[4], a[5]); l.history[0].t = Date.now(); s.library.push(l); byName[k] = l.id; } });
  T.preps.forEach((a) => { const k = a[0].toLowerCase(); if (!byName[k]) { const p = { id: nid('p'), name: a[0], makes: String(a[1]), unit: a[2], items: a[3].map((i) => line(byName[i[0].toLowerCase()], i[1], i[2])) }; s.preps.push(p); byName[k] = p.id; } });
  const ref = (n: string) => byName[n.toLowerCase()];
  T.products.forEach((a) => { s.recipes.push(recipe('product', a[0], { margin: String(a[1]), items: a[2].map((i) => line(ref(i[0]), i[1], i[2])) })); added++; });
  (T.sized || []).forEach((a) => {
    const sizes: Size[] = a[2].map((n) => ({ id: nid('s'), name: n, price: '', orders: '0' }));
    const items = a[3].map((i) => { const x = line(ref(i[0]), i[1], i[3]); x.q = {}; sizes.forEach((z, k) => { x.q![z.id] = String(i[1 + k]); }); return x; });
    s.recipes.push(recipe('product', a[0], { margin: String(a[1]), items, sizes })); added++;
  });
  T.addons.forEach((a) => { s.recipes.push(recipe('addon', a[0], { margin: String(a[1]), items: a[2].map((i) => line(ref(i[0]), i[1], i[2])) })); added++; });
  return added;
}

// ---------- sizes (mutating helpers for use inside update) ----------
export function remapKey(s: AppData, oldKey: string, newKey: string) {
  Object.keys(s.log).forEach((d) => { const rec = s.log[d]; if (rec && rec[oldKey] != null) { rec[newKey] = rec[oldKey]; delete rec[oldKey]; } });
  s.combos.forEach((cb) => cb.items.forEach((y) => { if (y.rid === oldKey) y.rid = newKey; }));
  if (s.ups.main === oldKey) s.ups.main = newKey;
  if (s.ups.addon === oldKey) s.ups.addon = newKey;
}
/**
 * Forgets sell-unit keys (a recipe, one of its sizes, or a combo) everywhere else they are
 * referenced. Without this the daily log keeps rows for things the owner deleted: the totals stay
 * correct, because unknown keys are ignored, but the rows ride along in every save for good.
 */
export function dropKeys(s: AppData, keys: string[]) {
  if (!keys.length) return;
  Object.keys(s.log).forEach((d) => {
    const rec = s.log[d];
    if (!rec) { delete s.log[d]; return; }
    keys.forEach((k) => { delete rec[k]; });
    if (!Object.keys(rec).length) delete s.log[d];
  });
  s.combos.forEach((cb) => { cb.items = cb.items.filter((y) => !keys.includes(y.rid)); });
  if (keys.includes(s.ups.main)) s.ups.main = '';
  if (keys.includes(s.ups.addon)) s.ups.addon = '';
}
export function sizesOn(s: AppData, r: Recipe): Size {
  const L = makeL(s.lang);
  const a: Size = { id: nid('s'), name: L('Regular', 'Regular'), price: r.price, orders: r.orders }, b: Size = { id: nid('s'), name: L('Large', 'Large'), price: '', orders: '0' };
  r.sizes = [a, b];
  r.items.forEach((x) => { x.q = { [a.id]: x.qty, [b.id]: x.qty }; });
  remapKey(s, r.id, r.id + '~' + a.id);
  return a;
}
export function sizeAdd(r: Recipe): Size {
  const base = r.sizes[r.sizes.length - 1], z: Size = { id: nid('s'), name: '', price: '', orders: '0' };
  r.sizes.push(z);
  r.items.forEach((x) => { if (!x.q) x.q = {}; x.q[z.id] = base ? lineQty(x, base) : x.qty; });
  return z;
}
export function sizeDel(s: AppData, r: Recipe, sid: string) {
  const z = find(r.sizes, sid); if (!z) return;
  const key = r.id + '~' + sid;
  if (r.sizes.length <= 1) {
    r.price = z.price; r.orders = z.orders;
    r.items.forEach((x) => { x.qty = String(lineQty(x, z)); delete x.q; });
    r.sizes = []; remapKey(s, key, r.id); return;
  }
  r.sizes = r.sizes.filter((v) => v.id !== sid);
  r.items.forEach((x) => { if (x.q) delete x.q[sid]; });
  dropKeys(s, [key]);
}
export function dupRecipe(s: AppData, r: Recipe): Recipe {
  const L = makeL(s.lang);
  const c: Recipe = JSON.parse(JSON.stringify(r)); const map: Record<string, string> = {};
  c.id = nid('r'); c.name = (r.name || '') + L(' (copy)', ' (kopya)'); c.orders = '0';
  c.sizes.forEach((z) => { const n = nid('s'); map[z.id] = n; z.id = n; z.orders = '0'; });
  c.items.forEach((x) => { x.id = nid('x'); if (x.q) { const q: Record<string, string> = {}; Object.keys(x.q).forEach((k) => { if (map[k]) q[map[k]] = x.q![k]; }); x.q = q; } });
  s.recipes.splice(s.recipes.findIndex((x) => x.id === r.id) + 1, 0, c);
  return c;
}
export function newLine(r: Recipe, ref: string, qty: number | string, unit: string): Line {
  const x = line(ref, qty, unit);
  if (r.sizes.length) { x.q = {}; r.sizes.forEach((z) => { x.q![z.id] = String(qty); }); }
  r.items.push(x); return x;
}
export function newLib(cat: 'ing' | 'pack'): LibItem { const l = lib(cat, '', '', 1, cat === 'pack' ? 'pc' : 'kg'); l.history = []; return l; }
export const ordersNum = (v: string) => Math.max(0, Math.round(num(v)));
