'use client';

import type { AppData } from './types';
import { comboCalc, delivery, dimOf, getLib, getUnit, libPerBase, lineCost, lineQty, logItems, refOf, totals, uCalc, uOrders, unitPriceText, units, usedIn } from './calc';
import { int, num, pct, todayISO } from './format';

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
  units(S).forEach((u) => { const c = uCalc(S, u), o = uOrders(u); prods.push([u.name, u.r.kind === 'addon' ? 'Add-on' : 'Product', r2(c.cost), r2(c.sell), r2(c.profit), r2(c.margin), r2(c.foodPct), o, r2(c.sell * o), r2(c.profit * o), S.biz.deliveryOn && u.r.kind !== 'addon' ? delivery(S, c).price : '']); });
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

export async function exportXlsx(S: AppData) {
  const ExcelJS = (await import('exceljs')).default;
  const R = rows(S);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Saffra';
  const sheets: [string, (string | number)[][]][] = [['Summary', R.sum], ['Products', R.prods], ['Recipe details', R.det], ['Ingredients', R.libs], ['Sub-recipes', R.preps], ['Expenses', R.fx], ['Combos', R.cbs], ['Daily sales', R.lg]];
  sheets.forEach(([name, data]) => {
    const ws = wb.addWorksheet(name);
    ws.addRows(data);
    ws.getRow(1).font = { bold: true };
    ws.columns = (data[0] || []).map((_, i) => ({ width: i === 0 ? 28 : 16 }));
  });
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob('saffra-' + todayISO() + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

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
