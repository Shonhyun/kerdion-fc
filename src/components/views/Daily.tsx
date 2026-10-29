'use client';

import Link from 'next/link';
import { useState } from 'react';
import { dayStats, logItems, totals } from '@/lib/calc';
import { fmtDate, int, iso, num, peso, todayISO, tone } from '@/lib/format';
import { Icon, PageHead, Pager } from '../ui';
import { update, useData, useT } from '@/store/store';

export default function Daily() {
  const S = useData(); const L = useT();
  const [d, setD] = useState(todayISO());
  const t = totals(S); const today = todayISO();
  const head = <PageHead title={L('Daily sales', 'Benta araw-araw')} lead={L('At the end of each day, enter how many you sold. Kerdion compares your real sales with your plan.', 'Sa dulo ng araw, ilagay kung ilan ang nabenta mo. Ikukumpara ng Kerdion ang totoong benta sa plan mo.')} />;
  if (!S.recipes.length) return <>{head}<div className="empty"><strong>{L('Add a product first', 'Mag-add muna ng produkto')}</strong><Link className="btn btn-primary" href="/products">{L('Go to Products', 'Pumunta sa Products')}</Link></div></>;
  const items = logItems(S);
  const setCount = (key: string, v: string) => update((dd) => { if (!dd.log[d]) dd.log[d] = {}; dd.log[d][key] = v.replace(/[^0-9]/g, ''); });
  const shift = (n: number) => { const p = d.split('-'); const x = new Date(+p[0], +p[1] - 1, +p[2]); x.setDate(x.getDate() + n); const ni = iso(x); if (ni <= today) setD(ni); };
  const ds = dayStats(S, d, items); const billDay = t.fixed / t.days;
  const mo = d.slice(0, 7);
  // One pass over this month's logged days: dayStats prices every product, so it is not called again below.
  const stats = new Map<string, ReturnType<typeof dayStats>>();
  Object.keys(S.log).forEach((k) => { if (k.slice(0, 7) === mo) stats.set(k, dayStats(S, k, items)); });
  const days = [...stats.keys()].filter((k) => stats.get(k)!.o > 0).sort();
  let act = 0; days.forEach((k) => { act += stats.get(k)!.gross - billDay; });
  const plan = t.net / t.days * days.length, mx = Math.max(Math.abs(act), Math.abs(plan), 1);
  return (
    <>
      {head}
      <div className="date-row">
        <div className="field"><label htmlFor="log-date">{L('Date', 'Petsa')}</label><input className="input" type="date" id="log-date" value={d} max={today} onChange={(e) => { if (e.target.value) setD(e.target.value > today ? today : e.target.value); }} /></div>
        <button className="btn" aria-label={L('Previous day', 'Nakaraang araw')} onClick={() => shift(-1)}><Icon name="left" size={18} /></button>
        <button className="btn" aria-label={L('Next day', 'Susunod na araw')} disabled={d >= today} onClick={() => shift(1)}><Icon name="right" size={18} /></button>
        {d !== today && <button className="btn" onClick={() => setD(today)}>{L('Today', 'Ngayon')}</button>}
      </div>
      <section className="card" aria-labelledby="h-lg">
        <div className="card-head"><h2 id="h-lg">{fmtDate(d, S.lang)}</h2><p>{L('Tap + each time you sell, or type the total at closing.', 'I-tap ang + bawat benta, o i-type ang total pagsara.')}</p></div>
        <div className="lg-list">
          {items.map((x) => {
            const v = (S.log[d] || {})[x.key] || ''; const n = Math.max(0, Math.round(num(v)));
            return (
              <div className="lg-row" key={x.key}>
                <span className="nm">{x.name}<small>{peso(x.c.sell)}{x.combo ? ' · Combo' : ''}</small></span>
                <div className="stepper">
                  <button aria-label={L('One less ', 'Bawasan ng isa ang ') + x.name} onClick={() => setCount(x.key, String(Math.max(0, n - 1)))}>−</button>
                  <input className="input" id={'lg-' + x.key} value={v} placeholder="0" inputMode="numeric" aria-label={L('Sold: ', 'Nabenta: ') + x.name} onChange={(e) => setCount(x.key, e.target.value)} />
                  <button aria-label={L('One more ', 'Dagdagan ng isa ang ') + x.name} onClick={() => setCount(x.key, String(n + 1))}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="combo-out">
          <div><span>Orders</span><strong>{int(ds.o)}</strong></div>
          <div><span>{L('Sales', 'Benta')}</span><strong>{peso(ds.rev, 0)}</strong></div>
          <div><span>{L('Profit before bills', 'Tubo bago bills')}</span><strong data-tone={tone(ds.gross)}>{peso(ds.gross, 0)}</strong></div>
          <div><span>{L('Net after daily bills', 'Net bawas daily bills')}</span><strong data-tone={tone(ds.gross - billDay)}>{peso(ds.gross - billDay, 0)}</strong></div>
        </div>
      </section>
      <section className="card" aria-labelledby="h-mtd">
        <div className="card-head"><h2 id="h-mtd">{L('This month so far', 'Ngayong buwan')}</h2><p>{days.length ? days.length + L(' days logged this month.', ' araw na-log ngayong buwan.') : L('No days logged this month yet.', 'Wala pang na-log ngayong buwan.')}</p></div>
        <div className="bars">
          <div className="bar-row"><span className="name">{L('Actual net', 'Totoong net')}</span><span className="track" aria-hidden="true"><span className={'fill cur' + (act < 0 ? ' neg' : '')} style={{ width: Math.round(Math.abs(act) / mx * 100) + '%' }} /></span><span className="val" data-tone={tone(act)}>{peso(act, 0)}</span></div>
          <div className="bar-row"><span className="name">{L('Plan for same days', 'Plan sa parehong araw')}</span><span className="track" aria-hidden="true"><span className="fill plan" style={{ width: Math.round(Math.abs(plan) / mx * 100) + '%' }} /></span><span className="val" data-tone={tone(plan)}>{peso(plan, 0)}</span></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="days">
            <thead><tr><th>{L('Day', 'Araw')}</th><th>Orders</th><th>{L('Sales', 'Benta')}</th><th>Net</th></tr></thead>
            <tbody>
              {days.length ? days.slice().reverse().map((k) => { const st = stats.get(k)!, n = st.gross - billDay; return <tr key={k}><td>{fmtDate(k, S.lang)}</td><td>{int(st.o)}</td><td>{peso(st.rev, 0)}</td><td data-tone={tone(n)}>{peso(n, 0)}</td></tr>; })
                : <tr><td colSpan={4} className="help">{L('Logged days will show here.', 'Dito lalabas ang mga na-log na araw.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <Pager prev={['/dashboard', 'Home']} next={['/report', 'Profit report']} />
    </>
  );
}
