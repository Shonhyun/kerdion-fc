'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon, PageHead, Pill } from '@/components/ui';
import { calc, comboCalc, lineCost, refOf, rName, unitPriceText, libPerBase, dimOf, prepPerBase, usedIn } from '@/lib/calc';
import { normalize } from '@/lib/data';
import { num, peso, pct } from '@/lib/format';
import type { AppData, Recipe, Size } from '@/lib/types';
import { ago, fmtDay, fmtWhen, loadBusiness, n0, type BizView } from './data';

/**
 * Read-only view of one account's business: what they set up and how far they got.
 * Nothing here can change the user's data.
 */
export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<BizView | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setView(await loadBusiness(id)); } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // normalize() fills defaults in place, so give it a copy.
  const s = useMemo<AppData | null>(() => view ? normalize(JSON.parse(JSON.stringify(view.data ?? {}))) : null, [view]);

  const back = <Link className="back" href="/admin/accounts"><Icon name="left" size={18} />Subscribers</Link>;
  if (loading) return <>{back}<p className="help" role="status">Loading…</p></>;
  if (err) return <>{back}<p className="confirm" role="alert">{err}</p></>;
  if (!view || !s) return <>{back}<p className="help">Account not found.</p></>;

  const products = s.recipes.filter((r) => r.kind !== 'addon');
  const addons = s.recipes.filter((r) => r.kind === 'addon');
  const ings = s.library.filter((l) => l.cat === 'ing');
  const packs = s.library.filter((l) => l.cat === 'pack');
  const logDays = Object.keys(s.log).filter((d) => Object.values(s.log[d] || {}).some((v) => num(v) > 0)).sort().reverse();
  const fixedTotal = s.fixed.reduce((a, f) => a + Math.max(0, num(f.amount)), 0);
  const hasBiz = !!view.updated_at;
  const name = view.business_name || s.biz.name || '';

  return (
    <>
      {back}
      <PageHead title={name || view.email} eyebrow="Account"
        lead={<>{name ? view.email + ' · ' : ''}joined {fmtDay(view.signed_up)}
          {view.last_sign_in ? <> · last sign-in {ago(view.last_sign_in)}</> : null}
          {view.updated_at ? <> · data last changed {ago(view.updated_at)} ({fmtWhen(view.updated_at)})</> : null}</>}
        actions={<button className="btn" onClick={load}>Refresh</button>} />

      {!hasBiz ? (
        <section className="card"><p className="help">This account has not saved any business data yet. They signed up but have not finished the setup.</p></section>
      ) : (
        <>
          <div className="chips" aria-label="Setup status">
            <Pill tone={s.onboarded ? 'good' : 'warn'}>{s.onboarded ? 'Setup finished' : 'Setup not finished'}</Pill>
            {s.sample && <Pill tone="warn">Still has the sample data</Pill>}
            {s.goal ? <Pill>Goal: {s.goal}</Pill> : null}
            <Pill>Language: {s.lang === 'tl' ? 'Filipino' : 'English'}</Pill>
          </div>

          <div className="kpis">
            <div className="stat"><span className="k">Products</span><span className="v">{n0(products.length)}</span><span className="s">{addons.length} add-ons · {s.combos.length} combos</span></div>
            <div className="stat"><span className="k">Ingredients</span><span className="v">{n0(ings.length)}</span><span className="s">{packs.length} packaging · {s.preps.length} sub-recipes</span></div>
            <div className="stat"><span className="k">Monthly expenses</span><span className="v">{peso(fixedTotal, 0)}</span><span className="s">{s.fixed.length} items</span></div>
            <div className="stat"><span className="k">Days of sales logged</span><span className="v">{n0(logDays.length)}</span><span className="s">{logDays[0] ? 'latest ' + logDays[0] : 'none yet'}</span></div>
          </div>

          <Products s={s} list={products} title="Products" empty="No products yet." />
          {addons.length > 0 && <Products s={s} list={addons} title="Add-ons" empty="" />}

          <section className="card" aria-labelledby="h-lib">
            <div className="card-head"><h2 id="h-lib">Ingredients and packaging</h2><p>Everything they buy, with the price they entered.</p></div>
            {s.library.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="adm-table">
                  <thead><tr><th>Item</th><th>Type</th><th>They buy</th><th>Unit cost</th><th>Used in</th><th>Price changes</th></tr></thead>
                  <tbody>{s.library.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.name || 'Untitled'}</strong>{num(l.yield) < 100 ? <><br /><span className="help">{l.yield}% usable</span></> : null}</td>
                      <td>{l.cat === 'pack' ? 'Packaging' : 'Ingredient'}</td>
                      <td>{peso(num(l.price))} for {l.qty} {l.unit}</td>
                      <td>{unitPriceText(libPerBase(l), dimOf(l.unit))}</td>
                      <td>{usedIn(s, l.id).length}</td>
                      <td>{l.history.length}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="help">No ingredients yet.</p>}
          </section>

          {s.preps.length > 0 && (
            <section className="card" aria-labelledby="h-prep">
              <div className="card-head"><h2 id="h-prep">Sub-recipes</h2></div>
              <ul className="adm-list">{s.preps.map((p) => (
                <li key={p.id}><div><strong>{p.name || 'Untitled'}</strong><span className="help">Makes {p.makes} {p.unit} · {p.items.length} items · {unitPriceText(prepPerBase(s, p), dimOf(p.unit))}</span></div></li>
              ))}</ul>
            </section>
          )}

          {s.combos.length > 0 && (
            <section className="card" aria-labelledby="h-combo">
              <div className="card-head"><h2 id="h-combo">Combos</h2></div>
              <ul className="adm-list">{s.combos.map((cb) => { const c = comboCalc(s, cb); return (
                <li key={cb.id}><div><strong>{cb.name || 'Untitled combo'}</strong><span className="help">{cb.items.length} items · sells {peso(c.sell)} · profit {peso(c.profit)} ({pct(c.margin)})</span></div></li>
              ); })}</ul>
            </section>
          )}

          <div className="two">
            <section className="card" aria-labelledby="h-fixed">
              <div className="card-head"><h2 id="h-fixed">Monthly expenses</h2></div>
              {s.fixed.length ? (
                <ul className="adm-list">{s.fixed.map((f) => (
                  <li key={f.id}><div><strong>{f.name || 'Untitled'}</strong></div><span>{peso(num(f.amount), 0)}</span></li>
                ))}</ul>
              ) : <p className="help">None entered.</p>}
            </section>
            <section className="card" aria-labelledby="h-biz">
              <div className="card-head"><h2 id="h-biz">Business settings</h2></div>
              <div className="rows">
                <div><span>Days open per month</span><span className="v">{s.biz.daysOpen || '—'}</span></div>
                <div><span>Tax</span><span className="v">{s.biz.taxOn ? s.biz.taxRate + '%' : 'Off'}</span></div>
                <div><span>Delivery app commission</span><span className="v">{s.biz.deliveryOn ? s.biz.deliveryRate + '%' : 'Off'}</span></div>
                <div><span>Price rounding</span><span className="v">{s.biz.round || 'exact'}</span></div>
              </div>
            </section>
          </div>

          {logDays.length > 0 && (
            <section className="card" aria-labelledby="h-log">
              <div className="card-head"><h2 id="h-log">Recent sales logs</h2><p>Orders they recorded per day.</p></div>
              <ul className="adm-list">{logDays.slice(0, 14).map((d) => {
                const day = s.log[d] || {};
                const orders = Object.values(day).reduce((a, v) => a + Math.max(0, num(v)), 0);
                return <li key={d}><div><strong>{d}</strong><span className="help">{Object.keys(day).length} items</span></div><span>{n0(orders)} orders</span></li>;
              })}</ul>
            </section>
          )}
        </>
      )}

      <details className="card">
        <summary><strong>Raw data</strong> <span className="help">for troubleshooting</span></summary>
        <pre style={{ overflowX: 'auto', fontSize: 12, maxHeight: 480 }}>{JSON.stringify(view.data, null, 2)}</pre>
      </details>
    </>
  );
}

function Products({ s, list, title, empty }: { s: AppData; list: Recipe[]; title: string; empty: string }) {
  const rows = (r: Recipe): [Size | null, string][] => r.sizes.length ? r.sizes.map((z) => [z, z.name || '?']) : [[null, '']];
  return (
    <section className="card" aria-labelledby={'h-' + title}>
      <div className="card-head"><h2 id={'h-' + title}>{title}</h2><p>Cost and profit per order, computed the same way the app does. Open a row to see its ingredients.</p></div>
      {list.length ? (
        <ul className="adm-list">{list.map((r) => (
          <li key={r.id} style={{ display: 'block' }}>
            <details>
              <summary style={{ cursor: 'pointer' }}>
                <strong>{rName(s, r)}</strong>{' '}
                <span className="help">{r.items.length} items · {r.mode === 'price' ? 'own price' : 'target margin ' + r.margin + '%'}{r.created ? ' · added ' + fmtDay(new Date(r.created).toISOString()) : ''}</span>
                <div className="help" style={{ marginTop: 4 }}>
                  {rows(r).map(([z, label]) => { const c = calc(s, r, z); return (
                    <span key={z ? z.id : 'one'} style={{ display: 'block' }}>
                      {label ? label + ': ' : ''}sells {peso(c.sell)} · cost {peso(c.cost)} · profit {peso(c.profit)} ({pct(c.margin)}) · {num(z ? z.orders : r.orders) || 0} orders/mo planned
                    </span>
                  ); })}
                </div>
              </summary>
              {r.items.length ? (
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table className="adm-table">
                    <thead><tr><th>Item</th><th>Amount</th><th>Cost</th></tr></thead>
                    <tbody>{r.items.map((x) => { const rf = refOf(s, x.ref); const c = lineCost(s, x); return (
                      <tr key={x.id}><td>{rf ? rf.name || 'Untitled' : <span className="help">Missing item</span>}</td><td>{x.qty} {x.unit}</td><td>{c == null ? '—' : peso(c)}</td></tr>
                    ); })}</tbody>
                  </table>
                </div>
              ) : <p className="help">No ingredients added.</p>}
            </details>
          </li>
        ))}</ul>
      ) : <p className="help">{empty}</p>}
    </section>
  );
}
