'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppData, Line, Recipe, Size } from '@/lib/types';
import { alertText, calc, commitLib, curSize, delivery, getLib, getR, lineCost, lineQty, refOf, rName, usedIn } from '@/lib/calc';
import { dropKeys, dupRecipe, newLib, newLine, sizeAdd, sizeDel, sizesOn } from '@/lib/data';
import { focusSoon, num, pct, peso } from '@/lib/format';
import { Icon, Peso, Pill, Suffix, UnitSelect, useHelp } from '../ui';
import { getData, showToast, update, useData, useT } from '@/store/store';

type Tab = 'ing' | 'pack' | 'price';

/** Saves a price change to history and shows a price alert when it affects profit. */
export function commitPrice(lid: string) {
  let a: ReturnType<typeof commitLib> = null;
  update((d) => { const l = getLib(d, lid); if (l) a = commitLib(d, l); });
  if (a) { const tx = alertText(getData(), a); showToast(tx.title + '. ' + tx.body); }
}

export function LibFields({ lid, prefix }: { lid: string; prefix: string }) {
  const S = useData(); const L = useT();
  const l = getLib(S, lid); if (!l) return null;
  const set = (f: 'price' | 'qty' | 'unit' | 'yield', v: string) => update((d) => { const x = getLib(d, lid); if (x) x[f] = v; });
  return (
    <>
      <div className="grp"><span className="grp-lbl">{L('You buy it for', 'Binibili mo sa halagang')}</span>
        <div className="grp-ctrl">
          <Peso className="peso w-price" id={prefix + lid + '-price'} value={l.price} label={L('Price you pay for ', 'Presyo ng ') + (l.name || 'item')} onChange={(v) => set('price', v)} onBlur={() => commitPrice(lid)} />
          <span className="word">per</span>
          <input className="input w-qty" id={prefix + lid + '-qty'} value={l.qty} inputMode="decimal" aria-label={L('Quantity you buy', 'Dami ng binibili')} onChange={(e) => set('qty', e.target.value)} onBlur={() => commitPrice(lid)} />
          <UnitSelect id={prefix + lid + '-unit'} value={l.unit} label={L('Unit you buy in', 'Unit ng binibili')} onChange={(v) => { set('unit', v); commitPrice(lid); }} />
        </div>
      </div>
      {l.cat === 'ing' && (
        <div className="grp"><span className="grp-lbl">Usable %</span>
          <div className="grp-ctrl"><Suffix className="suffix w-pct" id={prefix + lid + '-yield'} value={l.yield} suffix="%" label={L('Usable percent after trimming or cooking', 'Percent na magagamit after linis o luto')} onChange={(v) => set('yield', v)} /></div>
        </div>
      )}
    </>
  );
}

function ServingGroup({ r, x }: { r: Recipe; x: Line }) {
  const L = useT();
  const setLine = (f: 'qty' | 'unit', v: string) => update((d) => { const rr = getR(d, r.id); const xx = rr?.items.find((i) => i.id === x.id); if (xx) xx[f] = v; });
  const unit = <UnitSelect id={x.id + '-unit'} value={x.unit} label={L('Unit used per serving', 'Unit per serving')} onChange={(v) => setLine('unit', v)} />;
  if (!r.sizes.length) {
    return (
      <div className="grp"><span className="grp-lbl">{L('Used in one serving', 'Gamit sa isang serving')}</span>
        <div className="grp-ctrl">
          <input className="input w-qty" id={x.id + '-qty'} value={x.qty} inputMode="decimal" placeholder="0" aria-label={L('Amount used in one serving', 'Dami na gamit sa isang serving')} onChange={(e) => setLine('qty', e.target.value)} />
          {unit}
        </div>
      </div>
    );
  }
  return (
    <div className="grp"><span className="grp-lbl">{L('Used per serving, by size', 'Gamit per serving, kada size')}</span>
      <div className="grp-ctrl" style={{ alignItems: 'flex-end' }}>
        {r.sizes.map((s, k) => (
          <label className="szq" key={s.id}>{s.name || '?'}
            <input className="input w-qty" id={x.id + '-q' + k} value={lineQty(x, s)} inputMode="decimal" placeholder="0"
              onChange={(e) => update((d) => { const xx = getR(d, r.id)?.items.find((i) => i.id === x.id); if (xx) { if (!xx.q) xx.q = {}; xx.q[s.id] = e.target.value; } })} />
          </label>
        ))}
        {unit}
      </div>
    </div>
  );
}

function LineCard({ r, x, cs }: { r: Recipe; x: Line; cs: Size | null }) {
  const S = useData(); const L = useT();
  const rf = refOf(S, x.ref);
  const v = lineCost(S, x, cs);
  const cost = (
    <div className="item-cost"><span className="grp-lbl">{L('Cost per serving', 'Cost per serving')}{cs ? ' (' + cs.name + ')' : ''}</span>
      <strong data-tone={v == null ? 'bad' : undefined}>{v == null ? L('Units must match (kg↔g, L↔ml, pc↔pc)', 'Dapat tugma ang units (kg↔g, L↔ml, pc↔pc)') : peso(v)}</strong></div>
  );
  const rm = <button className="icon-btn" aria-label={L('Remove from this product', 'Tanggalin sa produktong ito')} onClick={() => update((d) => { const rr = getR(d, r.id); if (rr) rr.items = rr.items.filter((i) => i.id !== x.id); }, L('Removed from product', 'Tinanggal sa produkto'))}><Icon name="x" size={18} /></button>;
  if (!rf) return <div className="item"><div className="item-top"><span className="name-static">{L('Deleted item', 'Nabura na item')}</span>{rm}</div></div>;
  if (rf.kind === 'prep') {
    return (
      <div className="item">
        <div className="item-top"><span className="name-static">{rf.name} <span className="badge">Sub-recipe</span></span>{rm}</div>
        <div className="item-body">
          <div className="grp"><span className="grp-lbl">{L('Cost', 'Cost')}</span><span className="item-note">{rf.per > 0 ? peso(rf.per * (rf.dim === 'count' ? 1 : 1000)) + (rf.dim === 'mass' ? ' / kg' : rf.dim === 'vol' ? ' / L' : ' / pc') : L('Set what one batch makes', 'Ilagay kung ilan ang nagagawa ng batch')}</span>
            <Link href="/ingredients?tab=prep" className="item-note">{L('Edit sub-recipe', 'I-edit ang sub-recipe')}</Link></div>
          <ServingGroup r={r} x={x} />
          {cost}
        </div>
      </div>
    );
  }
  const shared = usedIn(S, rf.id).length > 1;
  return (
    <div className="item">
      <div className="item-top">
        <input className="input" id={rf.id + '-name-' + x.id} value={rf.name} placeholder={rf.cat === 'pack' ? L('e.g. Cup 16 oz with lid', 'hal. Cup 16 oz with lid') : L('e.g. Coffee beans', 'hal. Coffee beans')} aria-label={L('Item name', 'Pangalan ng item')} autoComplete="off"
          onChange={(e) => update((d) => { const l = getLib(d, rf.id); if (l) l.name = e.target.value; })} />
        {shared && <span className="badge shared" title={L('Changing the price updates every product that uses it', 'Pag binago ang presyo, updated lahat ng produktong gumagamit nito')}>Shared</span>}
        {rm}
      </div>
      <div className="item-body">
        <LibFields lid={rf.id} prefix={'ln' + x.id} />
        <ServingGroup r={r} x={x} />
        {cost}
      </div>
    </div>
  );
}

function AddRow({ r, cat }: { r: Recipe; cat: 'ing' | 'pack' }) {
  const S = useData(); const L = useT();
  const used = r.items.map((x) => x.ref);
  const opts = S.library.filter((l) => l.cat === cat && !used.includes(l.id)).sort((a, b) => a.name.localeCompare(b.name));
  const preps = cat === 'ing' ? S.preps.filter((p) => !used.includes(p.id)) : [];
  const addNew = () => {
    const l = newLib(cat); let xid = '';
    update((d) => { d.library.push(l); const rr = getR(d, r.id); if (rr) xid = newLine(rr, l.id, cat === 'pack' ? 1 : '', cat === 'pack' ? 'pc' : 'g').id; });
    focusSoon(l.id + '-name-' + xid);
  };
  const pick = (id: string) => {
    if (!id) return;
    const rf = refOf(S, id); if (!rf) return;
    let xid = '';
    update((d) => { const rr = getR(d, r.id); if (rr) xid = newLine(rr, id, rf.dim === 'count' ? 1 : '', rf.dim === 'count' ? 'pc' : rf.dim === 'vol' ? 'ml' : 'g').id; });
    focusSoon(r.sizes.length ? xid + '-q0' : xid + '-qty');
  };
  return (
    <div className="add-row">
      <button className="btn btn-ghost" onClick={addNew}><Icon name="plus" size={18} />{cat === 'pack' ? L('New packaging', 'Bagong packaging') : L('New ingredient', 'Bagong sangkap')}</button>
      {(opts.length > 0 || preps.length > 0) && (
        <select className="input" id={'pick-' + cat} value="" aria-label={L('Add a saved item', 'Mag-add ng saved item')} onChange={(e) => pick(e.target.value)}>
          <option value="">{L('+ Add from your saved list…', '+ Mag-add galing sa listahan mo…')}</option>
          {opts.length > 0 && <optgroup label={cat === 'pack' ? 'Packaging' : L('Ingredients', 'Mga sangkap')}>{opts.map((l) => <option key={l.id} value={l.id}>{l.name || '(no name)'}</option>)}</optgroup>}
          {preps.length > 0 && <optgroup label="Sub-recipes">{preps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
        </select>
      )}
    </div>
  );
}

function SizesBlock({ r, cs, setSel }: { r: Recipe; cs: Size | null; setSel: (id: string) => void }) {
  const L = useT(); const help = useHelp('sizes');
  if (r.kind === 'addon') return null;
  if (!r.sizes.length) {
    return <>
      <div className="add-row">
        <button className="btn btn-sm btn-ghost" onClick={() => { let id = ''; update((d) => { const rr = getR(d, r.id); if (rr) id = sizesOn(d, rr).id; }); setSel(id); }}><Icon name="plus" size={16} />{L('Add sizes', 'Mag-add ng sizes')}</button>
        <span className="help">{L('For products sold in different sizes, like 12 oz and 16 oz.', 'Para sa products na may iba’t ibang size, tulad ng 12 oz at 16 oz.')}</span>{help.btn}
      </div>
      {help.text}
    </>;
  }
  return (
    <section className="card szbox" aria-labelledby="h-sz">
      <div className="card-head row"><h2 id="h-sz" style={{ fontSize: 18 }}>Sizes{help.btn}</h2>
        <button className="btn btn-sm" onClick={() => { let id = ''; update((d) => { const rr = getR(d, r.id); if (rr) id = sizeAdd(rr).id; }); setSel(id); focusSoon('sz-' + id); }}><Icon name="plus" size={16} />Add size</button></div>
      {help.text}
      <div className="fx-list">
        {r.sizes.map((s) => (
          <div className="sz-row" key={s.id}>
            <input className="input" id={'sz-' + s.id} value={s.name} placeholder={L('e.g. 16 oz', 'hal. 16 oz')} aria-label={L('Size name', 'Pangalan ng size')} autoComplete="off"
              onChange={(e) => update((d) => { const z = getR(d, r.id)?.sizes.find((v) => v.id === s.id); if (z) z.name = e.target.value; })} />
            <button className="icon-btn" aria-label={L('Remove size ', 'Tanggalin ang size ') + s.name} onClick={() => update((d) => { const rr = getR(d, r.id); if (rr) sizeDel(d, rr, s.id); }, L('Removed size ', 'Tinanggal ang size ') + s.name)}><Icon name="x" size={18} /></button>
          </div>
        ))}
      </div>
      <div className="szpick" role="group" aria-label={L('Show numbers for size', 'Ipakita ang numbers ng size')}>
        <span className="lbl">{L('Showing:', 'Pinapakita:')}</span>
        {r.sizes.map((s) => <button key={s.id} aria-pressed={!!cs && cs.id === s.id} onClick={() => setSel(s.id)}>{s.name || '?'}</button>)}
      </div>
    </section>
  );
}

function RoundSelect({ id }: { id: string }) {
  const S = useData(); const L = useT();
  const o: [string, string][] = [['exact', L('Exact (e.g. ₱107.52)', 'Exact (hal. ₱107.52)')], ['peso', L('Whole peso (₱108)', 'Buong piso (₱108)')], ['9', L('Ends in 9 (₱109)', 'Nagtatapos sa 9 (₱109)')], ['5', L('Nearest ₱5 up (₱110)', 'Pinakamalapit na ₱5 (₱110)')], ['10', L('Nearest ₱10 up (₱110)', 'Pinakamalapit na ₱10 (₱110)')]];
  return <select className="input" id={id} value={S.biz.round} onChange={(e) => update((d) => { d.biz.round = e.target.value; })}>{o.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
}
export { RoundSelect };

function PricePanel({ r, cs, setTab }: { r: Recipe; cs: Size | null; setTab: (t: Tab) => void }) {
  const S = useData(); const L = useT();
  const hMargin = useHelp('margin'), hRound = useHelp('round'), hFood = useHelp('food'), hDel = useHelp('delivery');
  const c = calc(S, r, cs); const isM = r.mode !== 'price'; const isA = r.kind === 'addon';
  const setR = (f: 'margin' | 'price' | 'benchmark', v: string) => update((d) => { const rr = getR(d, r.id); if (rr) rr[f] = v; });
  const setMode = (m: 'margin' | 'price') => update((d) => {
    const rr = getR(d, r.id); if (!rr) return;
    if (m === 'price') {
      rr.mode = 'margin';
      const keep = rr.sizes.map((s) => calc(d as AppData, rr, s).sell), one = calc(d as AppData, rr, null).sell;
      rr.mode = 'price';
      if (rr.sizes.length) rr.sizes.forEach((s, i) => { if (!num(s.price)) s.price = String(keep[i] || ''); }); else if (!num(rr.price)) rr.price = String(one || '');
    } else rr.mode = 'margin';
  });
  const ft = c.pre <= 0 ? 'none' : c.foodPct <= 35 ? 'good' : c.foodPct <= 45 ? 'warn' : 'bad';
  const m = Math.round(num(r.margin));
  const bench = num(r.benchmark);
  const dv = delivery(S, c);
  return (
    <>
      <div className="card-head"><h2>{L('Price', 'Presyo')}</h2><p>{L('Decide how much to sell this for. Your profit per order shows right away.', 'Pagpasyahan kung magkano mo ibebenta. Makikita agad ang tubo per order.')}</p></div>
      <div className="price-layout">
        <div className="stack">
          <div className="field"><span className="lbl" id="lbl-mode">{L('How do you want to set your price?', 'Paano mo gustong i-set ang presyo?')}</span>
            <div className="choice" role="group" aria-labelledby="lbl-mode">
              <button aria-pressed={isM} onClick={() => setMode('margin')}><strong>{L('Suggest a price for me', 'I-suggest ang presyo')}</strong><span>{L('Pick how much profit you want', 'Piliin kung gaano kalaki ang tubo')}</span></button>
              <button aria-pressed={!isM} onClick={() => setMode('price')}><strong>{L('I already have a price', 'May presyo na ako')}</strong><span>{L('Type the price you sell it for', 'I-type ang presyo mo')}</span></button>
            </div>
          </div>
          {isM ? <>
            <div className="field"><label htmlFor={r.id + '-margin'}>{L('Profit margin you want', 'Gustong profit margin')}{hMargin.btn}</label>{hMargin.text}
              <div className="margin-row">
                <input type="range" id={r.id + '-mrange'} aria-label={L('Profit margin slider', 'Profit margin slider')} min={0} max={80} step={1} value={num(r.margin)} onChange={(e) => setR('margin', e.target.value)} />
                <Suffix id={r.id + '-margin'} value={r.margin} suffix="%" onChange={(v) => setR('margin', v)} />
              </div>
              <div className="chips">{[30, 40, 50, 60, 70].map((v) => <button key={v} className="chip" onClick={() => setR('margin', String(v))}>{v}%</button>)}</div>
              <p className="help">{L('At ', 'Sa ') + m + L('%, you keep ₱', '%, ₱') + m + L(' as profit from every ₱100 you sell', ' ang tubo mo sa bawat ₱100 na benta') + (S.biz.taxOn ? L(' (before tax)', ' (bago tax)') : '') + '.'}</p>
            </div>
            <div className="field"><label htmlFor="round-p">{L('Round the price', 'I-round ang presyo')}{hRound.btn}</label>{hRound.text}<RoundSelect id="round-p" /><span className="help">{L('Applies to all products.', 'Para sa lahat ng produkto.')}</span></div>
          </> : r.sizes.length ? (
            <div className="field"><span className="lbl">{L('Your selling price per size', 'Selling price kada size')}{S.biz.taxOn ? L(' (with tax)', ' (may tax na)') : ''}</span>
              <div className="fx-list">{r.sizes.map((s) => (
                <div className="sz-row" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }} key={s.id}>
                  <label htmlFor={'szp-' + s.id} style={{ fontWeight: 700 }}>{s.name || '?'}</label>
                  <Peso id={'szp-' + s.id} value={s.price} onChange={(v) => update((d) => { const z = getR(d, r.id)?.sizes.find((q) => q.id === s.id); if (z) z.price = v; })} />
                </div>))}</div>
            </div>
          ) : (
            <div className="field"><label htmlFor={r.id + '-price'}>{L('Your selling price', 'Selling price mo')}{S.biz.taxOn ? L(' (with tax)', ' (may tax na)') : ''}</label>
              <Peso id={r.id + '-price'} value={r.price} onChange={(v) => setR('price', v)} /><p className="help">{L('This is the price customers pay.', 'Ito ang babayaran ng customer.')}</p></div>
          )}
          <div className="field"><label htmlFor={r.id + '-bench'}>{L('What do nearby stores charge? (optional)', 'Magkano sa ibang tindahan? (optional)')}{cs ? ' · ' + cs.name : ''}</label>
            <Peso id={r.id + '-bench'} value={r.benchmark} placeholder={L('e.g. 110', 'hal. 110')} onChange={(v) => setR('benchmark', v)} />
            {bench > 0 && c.sell > 0
              ? <Pill tone={c.sell - bench <= 0.004 ? 'good' : 'bad'} style={{ alignSelf: 'flex-start' }}>{c.sell - bench <= 0.004 ? L('Good: ', 'Ayos: ') + peso(bench - c.sell) + L(' cheaper than them', ' mas mura sa kanila') : peso(c.sell - bench) + L(' more expensive than them', ' mas mahal sa kanila')}</Pill>
              : <Pill tone="none" style={{ alignSelf: 'flex-start' }}>{L('Compare with a competitor’s price', 'Ikumpara sa presyo ng iba')}</Pill>}
          </div>
        </div>
        <div className="stack">
          <div className="price-hero"><span className="k">{L('Customers pay', 'Babayaran ng customer')}{cs ? ' · ' + cs.name : ''}</span><span className="big">{peso(c.sell)}</span>
            <span className="sub">{r.mode === 'price' ? L('Your profit margin is ', 'Profit margin mo: ') + pct(c.margin) : (S.biz.round || 'exact') === 'exact' ? L('Rounded up to the next peso', 'Rounded up sa susunod na piso') + (S.biz.taxOn ? L(', tax included', ', kasama ang tax') : '') : L('Rounded up for your menu · margin ', 'Rounded up para sa menu · margin ') + pct(c.margin)}</span></div>
          <div className="rows">
            <div><span>{L('Cost per serving', 'Cost per serving')}</span><span className="v">{peso(c.cost)}</span></div>
            {S.biz.taxOn && <div><span>Tax ({S.biz.taxRate}%)<span className="hint">{L('You pay this to BIR', 'Binabayaran mo sa BIR')}</span></span><span className="v">{peso(c.tax)}</span></div>}
            <div><span><strong>{L('Your profit per order', 'Tubo mo per order')}</strong></span><span className="v" data-tone={c.profit >= 0 ? 'good' : 'bad'}>{peso(c.profit)}</span></div>
            <div><span>Food cost{hFood.btn}<span className="hint">{L('Cost ÷ price before tax', 'Cost ÷ presyo bago tax')}</span></span>
              <Pill tone={ft}>{c.pre <= 0 ? L('Add a price', 'Lagyan ng presyo') : pct(c.foodPct) + (ft === 'good' ? ' · healthy' : ft === 'warn' ? L(' · a bit high', ' · medyo mataas') : L(' · high', ' · mataas'))}</Pill></div>
          </div>
          {hFood.text}
          {r.sizes.length > 1 && (
            <div className="rows">
              <div><span className="lbl">{L('All sizes', 'Lahat ng size')}</span><span className="help">{L('cost · price · profit', 'cost · presyo · tubo')}</span></div>
              {r.sizes.map((s) => { const cz = calc(S, r, s); return <div key={s.id}><span>{s.name || '?'}</span><span className="v" data-tone={cz.profit >= 0 ? 'good' : 'bad'}>{peso(cz.cost) + ' · ' + peso(cz.sell) + ' · ' + peso(cz.profit)}</span></div>; })}
            </div>
          )}
          {S.biz.deliveryOn && !isA && (
            <div className="deliv"><h3><Icon name="scooter" />{L('Delivery app price', 'Presyo sa delivery app')}{cs ? ' · ' + cs.name : ''}{hDel.btn}</h3>{hDel.text}
              <span className="big2">{dv.price ? peso(dv.price, 0) : '—'}</span>
              <p className="help">{L('With a ', 'Sa ') + num(S.biz.deliveryRate) + L('% app commission, this keeps your profit at ', '% na commission, pareho pa rin ang tubo mo: ') + peso(c.profit) + ' per order.'}</p>
              <p className="help">{L('If you use the same price on the app, your profit is ', 'Kung parehong presyo sa app, ang tubo mo ay ') + peso(dv.same) + ' per order.'}</p>
            </div>
          )}
          {!S.biz.deliveryOn && !isA && <p className="help">{L('Selling on GrabFood or foodpanda? Turn on delivery pricing in ', 'Nagbebenta sa GrabFood o foodpanda? I-on ang delivery pricing sa ')}<Link href="/business">Business info</Link>.</p>}
          <p className="help">{S.biz.taxOn ? L('Tax is on at ', 'Naka-on ang tax: ') + S.biz.taxRate + '%.' : L('Tax is off.', 'Naka-off ang tax.')} {L('Change this in ', 'Palitan sa ')}<Link href="/business">Business info</Link>.</p>
        </div>
      </div>
      <div className="pager">
        <button className="btn" onClick={() => setTab('pack')}><Icon name="left" size={18} />Packaging</button>
        <Link className="btn btn-primary" href="/products">{L('Done', 'Tapos na')}<Icon name="check" size={18} /></Link>
      </div>
    </>
  );
}

export default function ProductEditor({ id }: { id: string }) {
  const S = useData(); const L = useT(); const router = useRouter(); const params = useSearchParams();
  const [tab, setTab] = useState<Tab>('ing');
  const [sel, setSel] = useState('');
  const usable = useHelp('usable');
  const r = getR(S, id);
  useEffect(() => { if (params.get('new') === '1') focusSoon(id + '-name'); }, [id, params]);

  if (!r) {
    return <div className="empty"><strong>{L('This product was not found', 'Hindi nakita ang produktong ito')}</strong><Link className="btn btn-primary" href="/products">{L('Back to products', 'Balik sa products')}</Link></div>;
  }
  const isA = r.kind === 'addon'; const cs = curSize(r, sel); const c = calc(S, r, cs);
  const tabs: [Tab, string][] = [['ing', L('Ingredients', 'Sangkap')], ['pack', 'Packaging'], ['price', L('Price', 'Presyo')]];
  const goTab = (t: Tab) => {
    setTab(t);
    setTimeout(() => { const sb = document.querySelector('.segtabs'); if (sb && sb.getBoundingClientRect().top < 0) sb.scrollIntoView({ block: 'start' }); (document.getElementById('tab-' + t) as HTMLElement | null)?.focus({ preventScroll: true }); }, 0);
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const order: Tab[] = ['ing', 'pack', 'price']; const k = (order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    e.preventDefault(); goTab(order[k]);
  };
  const del = () => {
    const nm = rName(S, r);
    update((d) => {
      dropKeys(d, [r.id, ...r.sizes.map((s) => r.id + '~' + s.id)]);
      d.recipes = d.recipes.filter((x) => x.id !== r.id);
    }, L('Deleted ', 'Binura ang ') + nm);
    router.push('/products');
  };
  const dup = () => {
    let nid = ''; update((d) => { const rr = getR(d, r.id); if (rr) nid = dupRecipe(d, rr).id; });
    showToast(L('Copied. Change the name and amounts.', 'Nakopya. Palitan ang pangalan at dami.'));
    router.push('/products/' + nid + '?new=1');
  };
  const list = r.items.filter((x) => { const rf = refOf(S, x.ref); return rf ? rf.cat === tab : tab === 'ing'; });

  return (
    <>
      <h1 className="sr" tabIndex={-1}>{isA ? L('Edit add-on', 'I-edit ang add-on') : L('Edit product', 'I-edit ang produkto')}</h1>
      <div className="pager" style={{ padding: 0 }}>
        <Link className="back" href="/products"><Icon name="left" size={18} />{L('All products', 'Lahat ng produkto')}</Link>
        <button className="btn btn-sm" onClick={dup}><Icon name="copy" size={16} />Duplicate</button>
      </div>
      <div className="field">
        <label htmlFor={r.id + '-name'}>{isA ? L('Add-on name', 'Pangalan ng add-on') : L('Product name', 'Pangalan ng produkto')}</label>
        <input className="input input-xl" id={r.id + '-name'} value={r.name} placeholder={isA ? L('e.g. Extra shot', 'hal. Extra shot') : L('e.g. Iced Latte', 'hal. Iced Latte')} autoComplete="off"
          onChange={(e) => update((d) => { const rr = getR(d, r.id); if (rr) rr.name = e.target.value; })} />
      </div>
      <SizesBlock r={r} cs={cs} setSel={setSel} />
      <div className="sumstrip">
        <div><span>{L('Cost per serving', 'Cost per serving')}{cs ? ' · ' + cs.name : ''}</span><strong>{peso(c.cost)}</strong></div>
        <div><span>Selling price</span><strong>{peso(c.sell)}</strong></div>
        <div><span>{L('Profit per order', 'Tubo per order')}</span><strong data-tone={c.profit >= 0 ? 'good' : 'bad'}>{peso(c.profit)}</strong></div>
      </div>
      <div className="segtabs" role="tablist" aria-label={L('Product sections', 'Mga bahagi')} onKeyDown={onTabKey}>
        {tabs.map(([k, label], i) => (
          <button key={k} role="tab" id={'tab-' + k} aria-selected={tab === k} aria-controls="panel" tabIndex={tab === k ? 0 : -1} onClick={() => goTab(k)}><span className="n" aria-hidden="true">{i + 1}</span>{label}</button>
        ))}
      </div>
      <section className="card" role="tabpanel" id="panel" aria-labelledby={'tab-' + tab}>
        {tab !== 'price' ? <>
          {tab === 'ing' ? <>
            <div className="card-head"><h2>{L('Ingredients', 'Mga sangkap')}</h2><p>{L('List everything that goes into one serving. Prices are saved in your ingredient list, so you only type them once.', 'Ilista lahat ng nasa isang serving. Naka-save ang presyo sa ingredient list mo, kaya isang beses mo lang ita-type.')}</p></div>
            <p className="example"><strong>Example:</strong> {L('Coffee beans at ₱900 per 1 kg, 18 g per cup = ₱16.20 per serving.', 'Coffee beans na ₱900 per 1 kg, 18 g per cup = ₱16.20 per serving.')} {L('What is “Usable %”?', 'Ano ang “Usable %”?')}{usable.btn}</p>
            {usable.text}
          </> : (
            <div className="card-head"><h2>Packaging</h2><p>{L('Cups, lids, containers, utensils, napkins and sauce cups. Small costs add up.', 'Cups, takip, containers, utensils, napkin at sauce cups. Maliit lang pero nag-a-add up.')}</p></div>
          )}
          {list.length ? <div className="items">{list.map((x) => <LineCard key={x.id} r={r} x={x} cs={cs} />)}</div> : <p className="help">{L('Nothing added yet.', 'Wala pang naka-add.')}</p>}
          <AddRow r={r} cat={tab} />
          <div className="subtotal"><span>{tab === 'ing' ? L('Ingredients per serving', 'Sangkap per serving') : L('Packaging per serving', 'Packaging per serving')}{cs ? ' · ' + cs.name : ''}</span><strong>{peso(tab === 'ing' ? c.ing : c.pack)}</strong></div>
          {tab === 'ing'
            ? <div className="pager"><span className="spacer" /><button className="btn btn-primary" onClick={() => goTab('pack')}>{L('Next: Packaging', 'Next: Packaging')}<Icon name="right" size={18} /></button></div>
            : <div className="pager"><button className="btn" onClick={() => goTab('ing')}><Icon name="left" size={18} />{L('Ingredients', 'Sangkap')}</button><button className="btn btn-primary" onClick={() => goTab('price')}>{L('Next: Price', 'Next: Presyo')}<Icon name="right" size={18} /></button></div>}
        </> : <PricePanel r={r} cs={cs} setTab={goTab} />}
      </section>
      <div className="danger">
        <span className="help">{L('Changes save automatically.', 'Auto-save ang changes.')}</span>
        <button className="btn btn-sm" onClick={del}>{isA ? L('Delete add-on', 'Burahin ang add-on') : L('Delete product', 'Burahin ang produkto')}</button>
      </div>
    </>
  );
}
