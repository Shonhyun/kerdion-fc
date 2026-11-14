'use client';

import type { AppData } from './types';
import { activeCombos, comboCalc, dayStats, delivery, dimOf, getLib, getUnit, libPerBase, lineCost, lineQty, logItems, refOf, totals, uCalc, uOrders, unitPriceText, units, usedIn } from './calc';
import { int, num, pct, peso, todayISO } from './format';
import { deliveryOn } from './plan';

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function rows(S: AppData) {
  const t = totals(S);
  const sum: (string | number)[][] = [['Saffra report'], ['Business', S.biz.name || ''], ['Date', todayISO()], ['Days open per month', t.days], [],
    ['Total sales per month (PHP)', r2(t.rev)], ['Ingredients and packaging (PHP)', r2(t.cogs)], ['Tax (PHP)', r2(t.tax)], ['Profit before bills (PHP)', r2(t.gross)],
    ['Monthly bills (PHP)', r2(t.fixed)], ['Net profit per month (PHP)', r2(t.net)], ['Net profit per day (PHP)', r2(t.net / t.days)], ['Break-even orders per month', t.avg > 0 ? t.be : 'n/a'], ['Monthly profit goal (PHP)', num(S.goal) || '']];
  const prods: (string | number)[][] = [['Product', 'Type', 'Cost per serving', 'Selling price', 'Profit per order', 'Margin %', 'Food cost %', 'Orders per month', 'Sales per month', 'Profit per month', 'Delivery app price']];
  units(S).forEach((u) => { const c = uCalc(S, u), o = uOrders(u); prods.push([u.name, u.r.kind === 'addon' ? 'Add-on' : 'Product', r2(c.cost), r2(c.sell), r2(c.profit), r2(c.margin), r2(c.foodPct), o, r2(c.sell * o), r2(c.profit * o), deliveryOn(S) && u.r.kind !== 'addon' ? delivery(S, c).price : '']); });
  const det: (string | number)[][] = [['Product', 'Item', 'Type', 'Used per serving', 'Unit', 'Cost per serving']];
  units(S).forEach((u) => u.r.items.forEach((x) => {
    const rf = refOf(S, x.ref), c = lineCost(S, x, u.s), q = num(lineQty(x, u.s));
    if (u.s && q === 0) return;
    det.push([u.name, rf ? rf.name : '(deleted)', rf ? (rf.kind === 'prep' ? 'Sub-recipe' : rf.cat === 'pack' ? 'Packaging' : 'Ingredient') : '', q, x.unit, c == null ? 'unit mismatch' : r2(c)]);
  }));
  const libs: (string | number)[][] = [['Item', 'Type', 'Price paid', 'Quantity', 'Unit', 'Usable %', 'Real cost', 'Used in']];
  S.library.forEach((l) => libs.push([l.name, l.cat === 'pack' ? 'Packaging' : 'Ingredient', num(l.price), num(l.qty), l.unit, num(l.yield) || 100, unitPriceText(libPerBase(l), dimOf(l.unit)).replace('₱', 'PHP '), usedIn(S, l.id).join(', ')]));
  const preps: (string | number)[][] = [['Sub-recipe', 'Batch makes', 'Unit', 'Item', 'Quantity', 'Unit', 'Cost']];
  S.preps.forEach((p) => p.items.forEach((y) => { const l = getLib(S, y.ref), c = lineCost(S, y); preps.push([p.name, num(p.makes), p.unit, l ? l.name : '(deleted)', num(y.qty), y.unit, c == null ? '' : r2(c)]); }));
  const fx: (string | number)[][] = [['Expense', 'Amount per month'], ...S.fixed.map((f) => [f.name, num(f.amount)])];
  const cbs: (string | number)[][] = [['Combo', 'Items', 'Price', 'Cost', 'Profit per combo', 'Orders per month']];
  S.combos.forEach((cb) => { const c = comboCalc(S, cb); cbs.push([cb.name, cb.items.map((y) => { const u = getUnit(S, y.rid); return num(y.qty) + 'x ' + (u ? u.name : '?'); }).join(', '), r2(c.sell), r2(c.cost), r2(c.profit), Math.round(num(cb.orders))]); });
  const lg: (string | number)[][] = [['Date', 'Item', 'Orders', 'Sales', 'Profit before bills']];
  const li = logItems(S); // prices every product, so build it once rather than per logged day
  Object.keys(S.log).sort().forEach((d) => li.forEach((x) => { const n = Math.round(num((S.log[d] || {})[x.key])); if (n > 0) lg.push([d, x.name, n, r2(x.c.sell * n), r2(x.c.profit * n)]); }));
  return { sum, prods, det, libs, preps, fx, cbs, lg, t };
}

// ---------- Excel ----------
const XL = {
  ink: 'FF16201B', accent: 'FF0B6B47', accentSoft: 'FFE2F1E8', yolkSoft: 'FFFFF3C7', loss: 'FFB13E18',
  muted: 'FF55605A', line: 'FFDCE2D8', band: 'FFF6F8F4', white: 'FFFFFFFF',
};
const PESO = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
const PESO0 = '"₱"#,##0;[Red]-"₱"#,##0';
const PCT = '0.0%';
const INT = '#,##0';

type Cell = string | number | { formula: string; result: number } | null;
type Col = { h: string; w: number; fmt?: string; total?: 'sum' | 'label' };

export async function exportXlsx(S: AppData) {
  const ExcelJS = (await import('exceljs')).default;
  type WS = import('exceljs').Worksheet;
  const t = totals(S);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Saffra'; wb.created = new Date();
  const biz = S.biz.name || 'My business';
  const thin = { style: 'thin' as const, color: { argb: XL.line } };
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

  // Title block shared by every sheet: sheet title, business and date.
  const head = (ws: WS, title: string, note: string, span: number) => {
    ws.mergeCells(1, 1, 1, span); ws.mergeCells(2, 1, 2, span);
    const a = ws.getCell(1, 1); a.value = title; a.font = { name: 'Calibri', size: 18, bold: true, color: { argb: XL.ink } };
    const b = ws.getCell(2, 1); b.value = biz + '  ·  ' + note + '  ·  ' + todayISO(); b.font = { size: 10, color: { argb: XL.muted } };
    ws.getRow(1).height = 28; ws.getRow(3).height = 6;
  };
  // A styled table with a header row, banded rows, optional totals row; returns the last row used.
  const table = (ws: WS, top: number, cols: Col[], body: Cell[][], opts: { totals?: boolean; filter?: boolean } = {}) => {
    cols.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = Math.max(col.width || 0, c.w); });
    const hr = ws.getRow(top);
    cols.forEach((c, i) => {
      const cell = hr.getCell(i + 1); cell.value = c.h;
      cell.font = { bold: true, color: { argb: XL.white } }; cell.fill = fill(XL.accent);
      cell.alignment = { vertical: 'middle', horizontal: c.fmt ? 'right' : 'left', wrapText: true };
    });
    hr.height = 30;
    body.forEach((r, ri) => {
      const row = ws.getRow(top + 1 + ri);
      r.forEach((v, i) => {
        const cell = row.getCell(i + 1); cell.value = v as never;
        if (cols[i]?.fmt) { cell.numFmt = cols[i].fmt!; cell.alignment = { horizontal: 'right' }; }
        cell.border = { bottom: thin };
        if (ri % 2 === 1) cell.fill = fill(XL.band);
      });
    });
    let last = top + body.length;
    if (opts.totals && body.length) {
      const tr = ws.getRow(last + 1);
      cols.forEach((c, i) => {
        const cell = tr.getCell(i + 1); const L = colLetter(i + 1);
        if (c.total === 'label') cell.value = 'Total';
        if (c.total === 'sum') {
          const result = body.reduce((a, r) => { const v = r[i]; return a + (typeof v === 'number' ? v : v && typeof v === 'object' ? v.result : 0); }, 0);
          cell.value = { formula: `SUM(${L}${top + 1}:${L}${last})`, result };
          cell.numFmt = c.fmt || INT; cell.alignment = { horizontal: 'right' };
        }
        cell.font = { bold: true }; cell.fill = fill(XL.accentSoft); cell.border = { top: { style: 'thin', color: { argb: XL.accent } } };
      });
      last += 1;
    }
    if (opts.filter && body.length) ws.autoFilter = { from: { row: top, column: 1 }, to: { row: top + body.length, column: cols.length } };
    return last;
  };
  const sheet = (name: string, landscape = true) => {
    const ws = wb.addWorksheet(name, {
      properties: { tabColor: { argb: XL.accent } },
      pageSetup: { orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: '&LSaffra · ' + biz + '&RPage &P of &N' },
    });
    ws.views = [{ showGridLines: false }];
    return ws;
  };
  const r2x = (n: number) => Math.round(n * 100) / 100;

  // ---- Summary ----
  {
    const ws = sheet('Summary', false);
    head(ws, 'Saffra profit report', t.days + ' days open per month', 5);
    ws.getColumn(1).width = 34; ws.getColumn(2).width = 18; ws.getColumn(3).width = 12; ws.getColumn(4).width = 4; ws.getColumn(5).width = 46;
    // Headline cards
    const card = (row: number, col: number, label: string, value: number | string, fmt: string, tone?: 'good' | 'bad') => {
      const l = ws.getCell(row, col); l.value = label; l.font = { size: 10, bold: true, color: { argb: XL.muted } };
      const v = ws.getCell(row + 1, col); v.value = value; v.numFmt = fmt; v.font = { size: 20, bold: true, color: { argb: tone === 'bad' ? XL.loss : tone === 'good' ? XL.accent : XL.ink } };
      v.alignment = { horizontal: 'left' };
      [l, v].forEach((c) => { c.fill = fill(XL.band); });
    };
    card(4, 1, 'Net profit per month', r2x(t.net), PESO0, t.net >= 0 ? 'good' : 'bad');
    card(4, 2, 'Per day', r2x(t.net / t.days), PESO0, t.net >= 0 ? 'good' : 'bad');
    card(7, 1, 'Break-even', t.avg > 0 ? t.be : 'Not reachable', t.avg > 0 ? INT + '" orders / month"' : '@');
    card(7, 2, 'Per day', t.avg > 0 ? Math.ceil(t.be / t.days) : '—', INT + '" orders"');
    ws.getRow(5).height = 30; ws.getRow(8).height = 30;
    // Money flow, with formulas so the sheet stays live if they edit it
    const top = 10;
    const flow: Cell[][] = [
      ['Total sales', r2x(t.rev), { formula: 'IF($B$11=0,0,B11/$B$11)', result: 1 }],
      ['Ingredients and packaging', r2x(-t.cogs), { formula: 'IF($B$11=0,0,B12/$B$11)', result: t.rev ? -t.cogs / t.rev : 0 }],
      ['Tax', r2x(-t.tax), { formula: 'IF($B$11=0,0,B13/$B$11)', result: t.rev ? -t.tax / t.rev : 0 }],
      ['Profit before bills', { formula: 'B11+B12+B13', result: r2x(t.gross) }, { formula: 'IF($B$11=0,0,B14/$B$11)', result: t.rev ? t.gross / t.rev : 0 }],
      ['Monthly bills', r2x(-t.fixed), { formula: 'IF($B$11=0,0,B15/$B$11)', result: t.rev ? -t.fixed / t.rev : 0 }],
      ['Net profit per month', { formula: 'B14+B15', result: r2x(t.net) }, { formula: 'IF($B$11=0,0,B16/$B$11)', result: t.rev ? t.net / t.rev : 0 }],
      ['Net profit per year', { formula: 'B16*12', result: r2x(t.net * 12) }, null],
    ];
    table(ws, top, [{ h: 'Where your money goes (per month)', w: 34 }, { h: 'Amount', w: 18, fmt: PESO }, { h: '% of sales', w: 12, fmt: PCT }], flow);
    [14, 16].forEach((r) => ws.getRow(r).eachCell((c) => { c.font = { bold: true }; }));
    ws.getRow(16).eachCell((c) => { c.fill = fill(XL.accentSoft); });
    let r = 19;
    const kv = (k: string, v: Cell, fmt?: string) => { ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { color: { argb: XL.muted } }; const c = ws.getCell(r, 2); c.value = v as never; if (fmt) c.numFmt = fmt; c.alignment = { horizontal: 'right' }; r++; };
    ws.getCell(18, 1).value = 'Your numbers'; ws.getCell(18, 1).font = { bold: true, size: 12 };
    kv('Orders per month (plan)', t.orders, INT);
    kv('Average profit per order', r2x(t.avg), PESO);
    kv('Days open per month', t.days, INT);
    if (num(S.goal) > 0) { kv('Monthly profit goal', num(S.goal), PESO0); if (t.avg > 0) kv('Orders needed for the goal', Math.ceil((num(S.goal) + t.fixed) / t.avg), INT); }
    if (S.biz.taxOn) kv('Tax rate', num(S.biz.taxRate) / 100, PCT);
    if (deliveryOn(S)) kv('Delivery app commission', num(S.biz.deliveryRate) / 100, PCT);
    // Notes column
    ws.getCell(10, 5).value = 'Inside this workbook'; ws.getCell(10, 5).font = { bold: true };
    ['Products: cost, price and profit per order.', 'Recipe costs: what goes into each serving.', 'Ingredients: what you buy and the real cost.', 'Expenses: your monthly bills.', 'Daily sales: what you logged each day.']
      .forEach((x, i) => { const c = ws.getCell(11 + i, 5); c.value = x; c.font = { size: 10, color: { argb: XL.muted } }; });
    ws.getCell(r + 1, 1).value = 'Estimates based on the numbers entered in Saffra. Not financial or tax advice.';
    ws.getCell(r + 1, 1).font = { italic: true, size: 9, color: { argb: XL.muted } };
  }

  // ---- Products ----
  {
    const ws = sheet('Products');
    const dlv = deliveryOn(S);
    const cols: Col[] = [
      { h: 'Product', w: 30, total: 'label' }, { h: 'Type', w: 10 }, { h: 'Cost per serving', w: 14, fmt: PESO }, { h: 'Selling price', w: 14, fmt: PESO },
      { h: 'Profit per order', w: 14, fmt: PESO }, { h: 'Margin', w: 10, fmt: PCT }, { h: 'Food cost', w: 10, fmt: PCT },
      { h: 'Orders per month', w: 12, fmt: INT, total: 'sum' }, { h: 'Sales per month', w: 16, fmt: PESO0, total: 'sum' }, { h: 'Profit per month', w: 16, fmt: PESO0, total: 'sum' },
      ...(dlv ? [{ h: 'Delivery app price', w: 14, fmt: PESO }] : []),
    ];
    head(ws, 'Products', 'cost, price and profit per order', cols.length);
    const body: Cell[][] = [];
    units(S).forEach((u) => {
      const c = uCalc(S, u), o = uOrders(u), row = 5 + body.length;
      body.push([u.name, u.r.kind === 'addon' ? 'Add-on' : 'Product', r2x(c.cost), r2x(c.sell), r2x(c.profit), c.margin / 100, c.foodPct / 100, o,
        { formula: `D${row}*H${row}`, result: r2x(c.sell * o) }, { formula: `E${row}*H${row}`, result: r2x(c.profit * o) },
        ...(dlv ? [u.r.kind === 'addon' ? null : delivery(S, c).price] : [])]);
    });
    activeCombos(S).forEach((cb) => {
      const c = comboCalc(S, cb), o = Math.max(0, Math.round(num(cb.orders))), row = 5 + body.length;
      body.push([cb.name || 'Combo', 'Combo', r2x(c.cost), r2x(c.sell), r2x(c.profit), c.margin / 100, c.pre > 0 ? c.cost / c.pre : 0, o,
        { formula: `D${row}*H${row}`, result: r2x(c.sell * o) }, { formula: `E${row}*H${row}`, result: r2x(c.profit * o) }, ...(dlv ? [null] : [])]);
    });
    const last = table(ws, 4, cols, body, { totals: true, filter: true });
    // Highlight items with a thin margin so they stand out when printed.
    body.forEach((r, i) => { const m = r[5] as number; if (m < 0.3) { const c = ws.getCell(5 + i, 6); c.font = { bold: true, color: { argb: XL.loss } }; } });
    ws.getCell(last + 2, 1).value = 'Margin in red = below 30% of the price before tax. Consider a price check.';
    ws.getCell(last + 2, 1).font = { italic: true, size: 9, color: { argb: XL.muted } };
    ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }];
  }

  // ---- Recipe costs: grouped per product with a subtotal ----
  {
    const ws = sheet('Recipe costs', false);
    head(ws, 'Recipe costs', 'what goes into one serving', 5);
    const cols: Col[] = [{ h: 'Item', w: 34 }, { h: 'Type', w: 12 }, { h: 'Used per serving', w: 14, fmt: '#,##0.##' }, { h: 'Unit', w: 8 }, { h: 'Cost per serving', w: 16, fmt: PESO }];
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
    let r = 4;
    units(S).forEach((u) => {
      const c = uCalc(S, u);
      ws.mergeCells(r, 1, r, 3);
      const h = ws.getCell(r, 1); h.value = u.name; h.font = { bold: true, size: 12, color: { argb: XL.ink } };
      ws.mergeCells(r, 4, r, 5);
      const p = ws.getCell(r, 4); p.value = 'Sells ' + peso(c.sell) + ' · profit ' + peso(c.profit); p.font = { size: 10, color: { argb: XL.muted } }; p.alignment = { horizontal: 'right' };
      r++;
      const items = u.r.items.filter((x) => !u.s || num(lineQty(x, u.s)) > 0);
      const body: Cell[][] = items.map((x) => {
        const rf = refOf(S, x.ref), lc = lineCost(S, x, u.s);
        return [rf ? rf.name : '(deleted)', rf ? (rf.kind === 'prep' ? 'Sub-recipe' : rf.cat === 'pack' ? 'Packaging' : 'Ingredient') : '', num(lineQty(x, u.s)), x.unit, lc == null ? 'unit mismatch' : r2x(lc)];
      });
      const last = table(ws, r, cols, body);
      const sub = ws.getRow(last + 1);
      sub.getCell(1).value = 'Cost per serving'; sub.getCell(1).font = { bold: true };
      sub.getCell(5).value = { formula: `SUM(E${r + 1}:E${last})`, result: r2x(c.cost) }; sub.getCell(5).numFmt = PESO; sub.getCell(5).font = { bold: true };
      [1, 2, 3, 4, 5].forEach((i) => { sub.getCell(i).fill = fill(XL.accentSoft); });
      r = last + 3;
    });
  }

  // ---- Ingredients ----
  {
    const ws = sheet('Ingredients');
    const cols: Col[] = [{ h: 'Item', w: 28 }, { h: 'Type', w: 12 }, { h: 'Price paid', w: 13, fmt: PESO }, { h: 'Quantity', w: 10, fmt: '#,##0.##' }, { h: 'Unit', w: 7 },
      { h: 'Usable', w: 9, fmt: '0%' }, { h: 'Real cost', w: 16 }, { h: 'Last price change', w: 28 }, { h: 'Used in', w: 44 }];
    head(ws, 'Ingredients and packaging', S.library.length + ' items', cols.length);
    const body: Cell[][] = S.library.slice().sort((a, b) => (a.cat === b.cat ? a.name.localeCompare(b.name) : a.cat === 'ing' ? -1 : 1)).map((l) => {
      const h = l.history || []; const prev = h.length > 1 ? h[h.length - 2] : null;
      return [l.name, l.cat === 'pack' ? 'Packaging' : 'Ingredient', num(l.price), num(l.qty), l.unit, (num(l.yield) || 100) / 100,
        unitPriceText(libPerBase(l), dimOf(l.unit)), prev ? 'from ' + peso(num(prev.price)) + ' (' + prev.d + ')' : '', usedIn(S, l.id).join(', ')];
    });
    table(ws, 4, cols, body, { filter: true });
    ws.getColumn(9).alignment = { wrapText: true, vertical: 'top' };
    ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }];
  }

  // ---- Sub-recipes (only when there are any) ----
  if (S.preps.length) {
    const ws = sheet('Sub-recipes', false);
    const cols: Col[] = [{ h: 'Sub-recipe', w: 26 }, { h: 'Batch makes', w: 12, fmt: '#,##0.##' }, { h: 'Unit', w: 8 }, { h: 'Item', w: 26 }, { h: 'Quantity', w: 10, fmt: '#,##0.##' }, { h: 'Unit', w: 8 }, { h: 'Cost', w: 14, fmt: PESO }];
    head(ws, 'Sub-recipes', 'batches used inside products', cols.length);
    const body: Cell[][] = [];
    S.preps.forEach((p) => p.items.forEach((y, i) => { const l = getLib(S, y.ref), c = lineCost(S, y); body.push([i ? '' : p.name, i ? null : num(p.makes), i ? '' : p.unit, l ? l.name : '(deleted)', num(y.qty), y.unit, c == null ? null : r2x(c)]); }));
    table(ws, 4, cols, body);
  }

  // ---- Expenses ----
  {
    const ws = sheet('Expenses', false);
    const cols: Col[] = [{ h: 'Expense', w: 32, total: 'label' }, { h: 'Per month', w: 16, fmt: PESO0, total: 'sum' }, { h: 'Per day open', w: 16, fmt: PESO0, total: 'sum' }];
    head(ws, 'Monthly expenses', 'bills you pay even on slow days', cols.length);
    const body: Cell[][] = S.fixed.map((f, i) => [f.name || 'Untitled', num(f.amount), { formula: `B${5 + i}/${t.days}`, result: r2x(num(f.amount) / t.days) }]);
    table(ws, 4, cols, body, { totals: true });
  }

  // ---- Combos (Pro, only when there are any) ----
  const combos = activeCombos(S);
  if (combos.length) {
    const ws = sheet('Combos');
    const cols: Col[] = [{ h: 'Combo', w: 26 }, { h: 'What is inside', w: 40 }, { h: 'Price', w: 13, fmt: PESO }, { h: 'Bought separately', w: 15, fmt: PESO }, { h: 'Customer saves', w: 14, fmt: PESO }, { h: 'Cost', w: 13, fmt: PESO }, { h: 'Profit per combo', w: 15, fmt: PESO }, { h: 'Orders per month', w: 12, fmt: INT }];
    head(ws, 'Combos', 'meal deals and bundles', cols.length);
    table(ws, 4, cols, combos.map((cb) => { const c = comboCalc(S, cb); return [cb.name || 'Combo', cb.items.map((y) => { const u = getUnit(S, y.rid); return num(y.qty) + 'x ' + (u ? u.name : '?'); }).join(', '), r2x(c.sell), r2x(c.sep), r2x(c.save), r2x(c.cost), r2x(c.profit), Math.round(num(cb.orders))]; }));
  }

  // ---- Daily sales: one row per day, then the item detail ----
  {
    const ws = sheet('Daily sales');
    const li = logItems(S); // prices every product, so build it once rather than per logged day
    const billDay = t.fixed / t.days;
    const dates = Object.keys(S.log).filter((d) => li.some((x) => num((S.log[d] || {})[x.key]) > 0)).sort().reverse();
    const cols: Col[] = [{ h: 'Date', w: 14, total: 'label' }, { h: 'Orders', w: 10, fmt: INT, total: 'sum' }, { h: 'Sales', w: 15, fmt: PESO0, total: 'sum' }, { h: 'Profit before bills', w: 17, fmt: PESO0, total: 'sum' }, { h: 'Daily share of bills', w: 17, fmt: PESO0, total: 'sum' }, { h: 'Net', w: 15, fmt: PESO0, total: 'sum' }];
    head(ws, 'Daily sales', dates.length + ' days logged', 9);
    const body: Cell[][] = dates.map((d, i) => { const st = dayStats(S, d, li), row = 5 + i; return [d, st.o, r2x(st.rev), r2x(st.gross), r2x(billDay), { formula: `D${row}-E${row}`, result: r2x(st.gross - billDay) }]; });
    let last = table(ws, 4, cols, body, { totals: true });
    if (!dates.length) { ws.getCell(5, 1).value = 'No days logged yet. Log your sales in Daily sales to see them here.'; ws.getCell(5, 1).font = { italic: true, color: { argb: XL.muted } }; last = 5; }
    // Item detail per day
    const top = last + 3;
    ws.getCell(top - 1, 1).value = 'What sold each day'; ws.getCell(top - 1, 1).font = { bold: true, size: 12 };
    const icols: Col[] = [{ h: 'Date', w: 14 }, { h: 'Item', w: 30 }, { h: 'Orders', w: 10, fmt: INT }, { h: 'Sales', w: 15, fmt: PESO0 }, { h: 'Profit before bills', w: 17, fmt: PESO0 }];
    const ibody: Cell[][] = [];
    dates.forEach((d) => li.forEach((x) => { const n = Math.round(num((S.log[d] || {})[x.key])); if (n > 0) ibody.push([d, x.name, n, r2x(x.c.sell * n), r2x(x.c.profit * n)]); }));
    if (ibody.length) table(ws, top, icols, ibody);
    ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob('saffra-' + todayISO() + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

function colLetter(n: number) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

export async function exportPdf(S: AppData) {
  const { jsPDF } = await import('jspdf');
  const R = rows(S); const t = R.t;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18; const W = 182, X = 14;
  const pp = (n: number) => (n < -0.004 ? '-' : '') + 'PHP ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const need = (h: number) => { if (y + h > 282) { doc.addPage(); y = 18; } };
  const h2 = (s: string) => { need(14); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(s, X, y); y += 6; };
  const table = (cols: string[], body: string[][], widths: number[], right: boolean[]) => {
    doc.setFontSize(9);
    const draw = (cells: string[], bold: boolean) => {
      need(7); doc.setFont('helvetica', bold ? 'bold' : 'normal'); let x = X;
      cells.forEach((c, i) => { const w = widths[i]; const txt = (doc.splitTextToSize(String(c ?? ''), w - 2)[0] as string) || ''; if (right[i]) doc.text(txt, x + w - 1, y, { align: 'right' }); else doc.text(txt, x, y); x += w; });
      y += 5.5; doc.setDrawColor(220); doc.line(X, y - 4, X + W, y - 4);
    };
    draw(cols, true); body.forEach((r) => draw(r, false)); y += 2;
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('Saffra profit report', X, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text((S.biz.name || 'My business') + '  ·  ' + todayISO() + '  ·  ' + t.days + ' days open per month', X, y); y += 6;
  h2('Monthly summary');
  const srows: string[][] = [['Total sales', pp(t.rev)], ['Ingredients and packaging', pp(-t.cogs)], ...(S.biz.taxOn ? [['Tax', pp(-t.tax)]] : []), ['Profit before bills', pp(t.gross)], ['Monthly bills', pp(-t.fixed)], ['Net profit per month', pp(t.net)], ['Net profit per day', pp(t.net / t.days)], ['Net profit per year', pp(t.net * 12)], ['Break-even', t.avg > 0 ? int(t.be) + ' orders per month' : 'not reachable']];
  if (num(S.goal) > 0) srows.push(['Monthly profit goal', pp(num(S.goal)) + (t.avg > 0 ? '  (needs ' + int(Math.ceil((num(S.goal) + t.fixed) / t.avg)) + ' orders)' : '')]);
  table(['Item', 'Amount'], srows, [100, 82], [false, true]);
  h2('Products');
  table(['Product', 'Cost', 'Price', 'Profit', 'Margin', 'Orders/mo', 'Profit/mo'],
    [...units(S).map((u) => { const c = uCalc(S, u), o = uOrders(u); return [u.name, pp(c.cost), pp(c.sell), pp(c.profit), pct(c.margin), int(o), pp(c.profit * o)]; }),
      ...S.combos.map((cb) => { const c = comboCalc(S, cb), o = Math.round(num(cb.orders)); return [(cb.name || 'Combo') + ' (combo)', pp(c.cost), pp(c.sell), pp(c.profit), pct(c.margin), int(o), pp(c.profit * o)]; })],
    [46, 22, 22, 22, 18, 22, 30], [false, true, true, true, true, true, true]);
  h2('Monthly bills');
  table(['Expense', 'Amount'], [...S.fixed.map((f) => [f.name, pp(num(f.amount))]), ['Total', pp(t.fixed)]], [120, 62], [false, true]);
  h2('Recipe costs');
  units(S).forEach((u) => {
    need(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(u.name + '  ·  cost ' + pp(uCalc(S, u).cost), X, y); y += 5;
    table(['Item', 'Per serving', 'Cost'], u.r.items.filter((x) => !u.s || num(lineQty(x, u.s)) > 0).map((x) => { const rf = refOf(S, x.ref), c = lineCost(S, x, u.s); return [rf ? rf.name : '(deleted)', num(lineQty(x, u.s)) + ' ' + x.unit, c == null ? 'unit mismatch' : pp(c)]; }), [110, 36, 36], [false, true, true]);
  });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); need(8); doc.text('Estimates based on the numbers entered in Saffra. Not financial or tax advice.', X, y + 4);
  downloadBlob('saffra-report-' + todayISO() + '.pdf', doc.output('blob'));
}

export function exportBackup(S: AppData) {
  downloadBlob('saffra-backup-' + todayISO() + '.json', new Blob([JSON.stringify({ ...S, lastBackup: Date.now() }, null, 1)], { type: 'application/json' }));
}
