'use client';

import Link from 'next/link';
import { comboCalc, getC, getUnit, totals, uCalc, uOrders, units } from '@/lib/calc';
import { dropKeys } from '@/lib/data';
import { focusSoon, int, nid, num, peso, tone } from '@/lib/format';
import { Icon, PageHead, Pager, Peso, Pill, Suffix } from '../ui';
import { update, useData, useT } from '@/store/store';

export default function Combos() {
  const S = useData(); const L = useT();
  const all = units(S); const t = totals(S);
  if (all.length < 2) {
    return <>
      <PageHead title={L('Combos & upsell', 'Combos at upsell')} />
      <div className="empty"><strong>{L('Add at least 2 products first', 'Mag-add muna ng at least 2 produkto')}</strong><Link className="btn btn-primary" href="/products">{L('Go to Products', 'Pumunta sa Products')}</Link></div>
    </>;
  }
  const opts = all.map((u) => <option key={u.key} value={u.key}>{u.name}</option>);
  const main = getUnit(S, S.ups.main) || all[0];
  let addon = getUnit(S, S.ups.addon);
  if (!addon || addon.key === main.key) addon = all[0].key === main.key ? all[1] : all[0];
  const pctv = Math.min(100, Math.max(0, num(S.ups.pct)));
  const extra = Math.round(uOrders(main) * pctv / 100), ac = uCalc(S, addon), gain = extra * ac.profit;
  const setUps = (k: 'main' | 'addon' | 'pct', v: string) => update((d) => { d.ups[k] = v; });
  const applyUps = () => {
    const name = addon!.name, key = addon!.key;
    update((d) => { const u = getUnit(d, key); if (!u) return; const tgt = u.s || u.r; tgt.orders = String(Math.round(num(tgt.orders)) + extra); }, L('Added ', 'Nadagdag ang ') + int(extra) + ' ' + name + L(' orders to your sales plan', ' orders sa sales plan mo'));
  };
  const addCombo = () => { const c = { id: nid('c'), name: '', price: '', orders: '0', items: all.slice(0, 2).map((u) => ({ id: nid('y'), rid: u.key, qty: '1' })) }; update((d) => { d.combos.push(c); }); focusSoon('cb-' + c.id + '-name'); };
  const setC = (id: string, k: 'name' | 'price' | 'orders', v: string) => update((d) => { const c = getC(d, id); if (c) c[k] = v; });
  const setY = (cid: string, yid: string, k: 'rid' | 'qty', v: string) => update((d) => { const y = getC(d, cid)?.items.find((i) => i.id === yid); if (y) y[k] = v; });
  return (
    <>
      <PageHead title={L('Combos & upsell', 'Combos at upsell')} lead={L('Bundle products into meal deals, and see how much extra you earn when customers add a drink or side.', 'Pagsamahin ang products bilang meal deal, at tingnan ang dagdag kita kapag nag-add ng drink o side ang customer.')} />
      <section className="card" aria-labelledby="h-up">
        <div className="card-head"><h2 id="h-up">Upsell simulator</h2><p>{L('“Would you like a drink with that?” See what happens if some customers say yes.', '“May drinks ka ba diyan?” Tingnan ang mangyayari kung may mga customer na mag-yes.')}</p></div>
        <div className="grid2">
          <div className="field"><label htmlFor="ups-main">{L('When customers buy', 'Kapag bumili ng')}</label><select className="input" id="ups-main" value={main.key} onChange={(e) => setUps('main', e.target.value)}>{opts}</select></div>
          <div className="field"><label htmlFor="ups-addon">{L('They also add', 'Nag-add din ng')}</label><select className="input" id="ups-addon" value={addon.key} onChange={(e) => setUps('addon', e.target.value)}>{opts}</select></div>
        </div>
        <div className="field"><label htmlFor="ups-pct">{L('How many say yes', 'Ilan ang nag-yes')}</label>
          <div className="margin-row">
            <input type="range" id="ups-range" min={0} max={100} step={5} value={pctv} aria-label={L('Percent of customers who add it', 'Percent ng customer na nag-add')} onChange={(e) => setUps('pct', e.target.value)} />
            <Suffix id="ups-pct" value={S.ups.pct} suffix="%" onChange={(v) => setUps('pct', v)} />
          </div>
        </div>
        <div className="combo-out">
          <div><span>{L('Extra orders / month', 'Dagdag na orders / buwan')}</span><strong>{int(extra)}</strong></div>
          <div><span>{L('Extra profit / month', 'Dagdag na tubo / buwan')}</span><strong data-tone={tone(gain)}>{peso(gain, 0)}</strong></div>
          <div><span>{L('Net profit becomes', 'Magiging net profit')}</span><strong data-tone={tone(t.net + gain)}>{peso(t.net + gain, 0)}</strong></div>
        </div>
        <div className="btn-row"><button className="btn btn-sm" onClick={applyUps}>{L('Add these orders to my sales plan', 'Idagdag sa sales plan ko')}</button></div>
      </section>
      <div className="section-title"><h2>{L('Your combos', 'Mga combo mo')}</h2><button className="btn btn-yolk" onClick={addCombo}><Icon name="plus" size={18} />{L('New combo', 'Bagong combo')}</button></div>
      {S.combos.length ? (
        <div className="sgrid">
          {S.combos.map((cb) => {
            const c = comboCalc(S, cb);
            const mt = c.pre <= 0 ? 'none' : c.margin >= 25 ? 'good' : c.margin >= 10 ? 'warn' : 'bad';
            return (
              <div className="scard" key={cb.id}>
                <div className="item-top">
                  <input className="input" style={{ fontWeight: 700 }} id={'cb-' + cb.id + '-name'} value={cb.name} placeholder={L('e.g. Latte + Pandesal', 'hal. Latte + Pandesal')} aria-label={L('Combo name', 'Pangalan ng combo')} autoComplete="off" onChange={(e) => setC(cb.id, 'name', e.target.value)} />
                  <button className="icon-btn" aria-label={L('Delete combo', 'Burahin ang combo')} onClick={() => update((d) => { dropKeys(d, [cb.id]); d.combos = d.combos.filter((x) => x.id !== cb.id); }, L('Deleted ', 'Binura ang ') + (cb.name || 'combo'))}><Icon name="x" size={18} /></button>
                </div>
                <div className="fx-list"><span className="lbl">{L('What is inside', 'Laman')}</span>
                  {cb.items.map((y) => (
                    <div className="cl-row" key={y.id}>
                      <select className="input" id={'cl-' + y.id + '-rid'} value={getUnit(S, y.rid) ? y.rid : ''} aria-label={L('Product', 'Produkto')} onChange={(e) => setY(cb.id, y.id, 'rid', e.target.value)}>
                        {!getUnit(S, y.rid) && <option value="">{L('Choose…', 'Pumili…')}</option>}{opts}
                      </select>
                      <Suffix id={'cl-' + y.id + '-qty'} value={y.qty} suffix="×" label={L('Quantity', 'Dami')} onChange={(v) => setY(cb.id, y.id, 'qty', v)} />
                      <button className="icon-btn" aria-label={L('Remove', 'Tanggalin')} onClick={() => update((d) => { const x = getC(d, cb.id); if (x) x.items = x.items.filter((i) => i.id !== y.id); }, L('Removed from combo', 'Tinanggal sa combo'))}><Icon name="x" size={18} /></button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => update((d) => { getC(d, cb.id)?.items.push({ id: nid('y'), rid: all[0].key, qty: '1' }); })}><Icon name="plus" size={16} />Add item</button>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor={'cb-' + cb.id + '-price'}>{L('Combo price', 'Presyo ng combo')}</label><Peso id={'cb-' + cb.id + '-price'} value={cb.price} onChange={(v) => setC(cb.id, 'price', v)} /></div>
                  <div className="field"><label htmlFor={'cb-' + cb.id + '-orders'}>{L('Orders / month', 'Orders / buwan')}</label><input className="input" id={'cb-' + cb.id + '-orders'} value={cb.orders} inputMode="numeric" onChange={(e) => setC(cb.id, 'orders', e.target.value)} /></div>
                </div>
                <div className="combo-out">
                  <div><span>{L('Bought separately', 'Kung hiwalay')}</span><strong>{peso(c.sep)}</strong></div>
                  <div><span>{L('Customer saves', 'Tipid ng customer')}</span><strong data-tone={c.save >= 0 ? undefined : 'bad'}>{peso(c.save)}</strong></div>
                  <div><span>{L('Cost', 'Gastos')}</span><strong>{peso(c.cost)}</strong></div>
                  <div><span>{L('Profit per combo', 'Tubo per combo')}</span><strong data-tone={tone(c.profit)}>{peso(c.profit)}</strong></div>
                </div>
                <Pill tone={mt} style={{ alignSelf: 'flex-start' }}>{c.pre > 0 ? Math.round(c.margin) + '% margin' : L('Add a price', 'Lagyan ng presyo')}</Pill>
              </div>
            );
          })}
        </div>
      ) : <p className="help">{L('No combos yet. Combos also count in your sales plan and profit report.', 'Wala pang combo. Kasama sa sales plan at profit report ang mga combo.')}</p>}
      <Pager prev={['/sales', 'Sales plan']} next={['/report', 'Profit report']} />
    </>
  );
}
