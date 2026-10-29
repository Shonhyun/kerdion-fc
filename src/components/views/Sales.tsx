'use client';

import Link from 'next/link';
import { comboCalc, getC, getUnit, totals, uCalc, units } from '@/lib/calc';
import { int, num, peso, tone } from '@/lib/format';
import { PageHead, Pager } from '../ui';
import { update, useData, useT } from '@/store/store';

interface Card { key: string; name: string; orders: string; kind: 'unit' | 'combo'; addon?: boolean; sell: number; profit: number }

function SaleCards({ list, days }: { list: Card[]; days: number }) {
  const L = useT();
  const setOrders = (x: Card, v: string) => update((d) => {
    if (x.kind === 'combo') { const c = getC(d, x.key); if (c) c.orders = v; return; }
    const u = getUnit(d, x.key); if (u) (u.s || u.r).orders = v;
  });
  return (
    <div className="sgrid">
      {list.map((x) => {
        const o = Math.max(0, Math.round(num(x.orders)));
        return (
          <div className="scard" key={x.key}>
            <div>
              <h3>{x.name}{x.kind === 'combo' ? <> <span className="badge">Combo</span></> : x.addon ? <> <span className="badge">Add-on</span></> : null}</h3>
              <p className="meta">{L('Sells for ', 'Benta sa ') + peso(x.sell) + ' · ' + peso(x.profit) + L(' profit each', ' tubo bawat isa')}</p>
            </div>
            <div className="field">
              <label htmlFor={'ord-' + x.key}>{L('Orders per month', 'Orders kada buwan')}</label>
              <div className="stepper">
                <button aria-label={L('10 fewer', 'Bawasan ng 10')} onClick={() => setOrders(x, String(Math.max(0, o - 10)))}>−10</button>
                <input className="input" id={'ord-' + x.key} value={x.orders} inputMode="numeric" onChange={(e) => setOrders(x, e.target.value)} />
                <button aria-label={L('10 more', 'Dagdagan ng 10')} onClick={() => setOrders(x, String(o + 10))}>+10</button>
              </div>
              <p className="help">{L('About ', 'Mga ') + (Math.round(o / days * 10) / 10).toLocaleString('en-US') + L(' a day', ' kada araw')}</p>
            </div>
            <div className="s-outs">
              <div><span>{L('Sales', 'Benta')}</span><strong>{peso(x.sell * o, 0)}</strong></div>
              <div><span>{L('Profit', 'Tubo')}</span><strong data-tone={tone(x.profit * o)}>{peso(x.profit * o, 0)}</strong></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Sales() {
  const S = useData(); const L = useT(); const t = totals(S);
  const head = <PageHead title="Sales plan" eyebrow="Step 3 of 4" lead={L('How many of each product do you think you will sell in a month? Try different numbers and watch your profit change.', 'Ilan sa bawat produkto ang tingin mong mabebenta mo kada buwan? Subukan ang iba’t ibang numbers at panoorin ang tubo.')} />;
  if (!S.recipes.length) return <>{head}<div className="empty"><strong>{L('Add a product first', 'Mag-add muna ng produkto')}</strong><Link className="btn btn-primary" href="/products">{L('Go to Products', 'Pumunta sa Products')}</Link></div><Pager prev={['/expenses', 'Expenses']} /></>;
  const mk = (kind: 'product' | 'addon'): Card[] => units(S, kind).map((u) => { const c = uCalc(S, u); return { key: u.key, name: u.name, orders: u.s ? u.s.orders : u.r.orders, kind: 'unit', addon: kind === 'addon', sell: c.sell, profit: c.profit }; });
  const main = mk('product'), adds = mk('addon');
  const cbs: Card[] = S.combos.map((cb) => { const c = comboCalc(S, cb); return { key: cb.id, name: cb.name || 'Combo', orders: cb.orders, kind: 'combo', sell: c.sell, profit: c.profit }; });
  return (
    <>
      {head}
      <div className="sum-banner">
        <div className="stat"><span className="k">{L('Total orders / month', 'Total orders / buwan')}</span><span className="v">{int(t.orders)}</span><span className="s">{L('About ', 'Mga ') + (Math.round(t.orders / t.days * 10) / 10).toLocaleString('en-US') + L(' a day', ' kada araw')}</span></div>
        <div className="stat"><span className="k">{L('Net profit / month', 'Net profit / buwan')}</span><span className="v" data-tone={tone(t.net)}>{peso(t.net, 0)}</span><span className="s">{L('After all costs', 'Bawas na lahat')}</span></div>
        <div className="stat"><span className="k">Break-even</span><span className="v">{t.avg > 0 ? int(t.be) : '—'}</span><span className="s">{L('Orders / month to cover bills', 'Orders / buwan para sa bills')}</span></div>
      </div>
      <SaleCards list={main} days={t.days} />
      {(adds.length > 0 || cbs.length > 0) && <><div className="section-title"><h2>{L('Add-ons and combos', 'Add-ons at combos')}</h2></div><SaleCards list={[...adds, ...cbs]} days={t.days} /></>}
      <p className="help">{L('Based on ', 'Base sa ')}{t.days}{L(' days open per month. Change this in ', ' araw na bukas kada buwan. Palitan sa ')}<Link href="/business">Business info</Link>.</p>
      <Pager prev={['/expenses', 'Expenses']} next={['/report', 'Next: Profit report']} />
    </>
  );
}
