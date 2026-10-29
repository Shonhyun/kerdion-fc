'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LibItem, Prep } from '@/lib/types';
import { dimOf, getLib, getPrep, lineCost, libPerBase, prepPerBase, prepTotal, rawPerBase, unitPriceText, usedIn } from '@/lib/calc';
import { line, newLib } from '@/lib/data';
import { fmtDate, focusSoon, nid, peso } from '@/lib/format';
import { Icon, PageHead, Pager, UnitSelect, useHelp } from '../ui';
import { AlertsCard } from '../blocks';
import { LibFields } from './ProductEditor';
import { update, useData, useT } from '@/store/store';

type LTab = 'ing' | 'pack' | 'prep';

function LibCard({ l }: { l: LibItem }) {
  const S = useData(); const L = useT();
  const used = usedIn(S, l.id); const hist = (l.history || []).slice(-3).reverse();
  const del = () => update((d) => {
    d.recipes.forEach((x) => { x.items = x.items.filter((y) => y.ref !== l.id); });
    d.preps.forEach((x) => { x.items = x.items.filter((y) => y.ref !== l.id); });
    d.library = d.library.filter((x) => x.id !== l.id); d.alerts = d.alerts.filter((a) => a.lid !== l.id);
  }, L('Deleted ', 'Binura ang ') + (l.name || 'item'));
  return (
    <div className="item">
      <div className="item-top">
        <input className="input" id={'lib-' + l.id + '-name'} value={l.name} placeholder={L('Item name', 'Pangalan')} aria-label={L('Item name', 'Pangalan ng item')} autoComplete="off"
          onChange={(e) => update((d) => { const x = getLib(d, l.id); if (x) x.name = e.target.value; })} />
        <button className="icon-btn" aria-label={L('Delete ', 'Burahin ang ') + (l.name || 'item')} onClick={del}><Icon name="x" size={18} /></button>
      </div>
      <div className="item-body">
        <LibFields lid={l.id} prefix="lib" />
        <div className="item-cost"><span className="grp-lbl">{L('Real cost', 'Totoong cost')}</span><strong>{unitPriceText(libPerBase(l), dimOf(l.unit))}</strong></div>
      </div>
      <div className="lib-meta">
        <span>{used.length ? L('Used in: ', 'Gamit sa: ') + used.join(', ') : L('Not used in any product yet', 'Hindi pa gamit sa kahit anong produkto')}</span>
        {hist.length > 1 && <span className="hist">Price history: {hist.map((s) => fmtDate(s.d, S.lang) + ' ' + unitPriceText(rawPerBase(s), dimOf(s.unit))).join(' · ')}</span>}
      </div>
    </div>
  );
}

function PrepCard({ p }: { p: Prep }) {
  const S = useData(); const L = useT();
  const used = usedIn(S, p.id);
  const ingOpts = S.library.filter((l) => l.cat === 'ing' && !p.items.some((y) => y.ref === l.id)).sort((a, b) => a.name.localeCompare(b.name));
  const setP = (f: 'name' | 'makes' | 'unit', v: string) => update((d) => { const x = getPrep(d, p.id); if (x) x[f] = v; });
  const setY = (yid: string, f: 'qty' | 'unit', v: string) => update((d) => { const y = getPrep(d, p.id)?.items.find((i) => i.id === yid); if (y) y[f] = v; });
  const per = prepPerBase(S, p);
  return (
    <div className="item">
      <div className="item-top">
        <input className="input" id={'prep-' + p.id + '-name'} value={p.name} placeholder={L('e.g. Garlic rice (batch)', 'hal. Garlic rice (batch)')} aria-label={L('Sub-recipe name', 'Pangalan ng sub-recipe')} autoComplete="off" onChange={(e) => setP('name', e.target.value)} />
        <button className="icon-btn" aria-label={L('Delete sub-recipe', 'Burahin ang sub-recipe')} onClick={() => update((d) => {
          d.recipes.forEach((x) => { x.items = x.items.filter((y) => y.ref !== p.id); });
          d.preps = d.preps.filter((x) => x.id !== p.id);
        }, L('Deleted ', 'Binura ang ') + (p.name || 'sub-recipe'))}><Icon name="x" size={18} /></button>
      </div>
      <div className="grp"><span className="grp-lbl">{L('One batch makes', 'Isang batch ay nakakagawa ng')}</span>
        <div className="grp-ctrl">
          <input className="input w-qty" id={'prep-' + p.id + '-makes'} value={p.makes} inputMode="decimal" aria-label={L('How much one batch makes', 'Dami ng nagagawa ng isang batch')} onChange={(e) => setP('makes', e.target.value)} />
          <UnitSelect id={'prep-' + p.id + '-unit'} value={p.unit} label={L('Batch unit', 'Unit ng batch')} onChange={(v) => setP('unit', v)} />
        </div>
      </div>
      <div className="fx-list">
        {p.items.map((y) => {
          const l = getLib(S, y.ref); const c = lineCost(S, y);
          return (
            <div className="pl-row" key={y.id}>
              <span className="pl-name">{l ? l.name : L('Deleted item', 'Nabura na item')}</span>
              <input className="input w-qty" style={{ width: 'auto' }} id={'pl-' + y.id + '-qty'} value={y.qty} inputMode="decimal" aria-label={L('Amount in batch', 'Dami sa batch')} onChange={(e) => setY(y.id, 'qty', e.target.value)} />
              <UnitSelect id={'pl-' + y.id + '-unit'} value={y.unit} label="Unit" style={{ width: 'auto' }} onChange={(v) => setY(y.id, 'unit', v)} />
              <strong className="mono" style={{ textAlign: 'right' }} data-tone={c == null ? 'bad' : undefined}>{c == null ? 'Units?' : peso(c)}</strong>
              <button className="icon-btn" aria-label={L('Remove', 'Tanggalin')} onClick={() => update((d) => { const x = getPrep(d, p.id); if (x) x.items = x.items.filter((i) => i.id !== y.id); }, L('Removed from batch', 'Tinanggal sa batch'))}><Icon name="x" size={18} /></button>
            </div>
          );
        })}
      </div>
      {ingOpts.length ? (
        <div className="add-row">
          <select className="input" id={'pp-' + p.id} value="" aria-label={L('Add ingredient to batch', 'Mag-add ng sangkap sa batch')} onChange={(e) => {
            const l = getLib(S, e.target.value); if (!l) return; const dm = dimOf(l.unit);
            const ny = line(l.id, dm === 'count' ? 1 : '', dm === 'count' ? 'pc' : dm === 'vol' ? 'ml' : 'g');
            update((d) => { getPrep(d, p.id)?.items.push(ny); }); focusSoon('pl-' + ny.id + '-qty');
          }}>
            <option value="">{L('+ Add ingredient to this batch…', '+ Mag-add ng sangkap sa batch…')}</option>
            {ingOpts.map((l) => <option key={l.id} value={l.id}>{l.name || '(no name)'}</option>)}
          </select>
        </div>
      ) : <p className="help">{L('Add ingredients in the Ingredients tab first.', 'Mag-add muna ng sangkap sa Ingredients tab.')}</p>}
      <div className="lib-meta">
        <span>{L('Batch cost ', 'Cost ng batch ')}<strong>{peso(prepTotal(S, p))}</strong></span>
        <span>{per > 0 ? unitPriceText(per, dimOf(p.unit)) : L('Set what one batch makes', 'Ilagay kung ilan ang nagagawa ng batch')}</span>
        <span>{used.length ? L('Used in: ', 'Gamit sa: ') + used.join(', ') : ''}</span>
      </div>
    </div>
  );
}

export default function Library() {
  const S = useData(); const L = useT(); const params = useSearchParams();
  const [tab, setTab] = useState<LTab>('ing');
  const [q, setQ] = useState('');
  const hUsable = useHelp('usable'), hPrep = useHelp('prep');
  useEffect(() => { const t = params.get('tab'); if (t === 'prep' || t === 'pack' || t === 'ing') setTab(t); }, [params]);
  const tabs: [LTab, string][] = [['ing', L('Ingredients', 'Sangkap')], ['pack', 'Packaging'], ['prep', 'Sub-recipes']];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const order: LTab[] = ['ing', 'pack', 'prep']; const k = (order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    e.preventDefault(); setTab(order[k]); focusSoon('ltab-' + order[k], false);
  };
  const addLib = (cat: 'ing' | 'pack') => { const l = newLib(cat); update((d) => { d.library.push(l); }); setQ(''); focusSoon('lib-' + l.id + '-name'); };
  const addPrep = () => { const p: Prep = { id: nid('p'), name: '', makes: '1', unit: 'kg', items: [] }; update((d) => { d.preps.push(p); }); focusSoon('prep-' + p.id + '-name'); };
  const ql = q.trim().toLowerCase();
  // Sort only when the set of items or the search changes, so a card does not jump away while you type its name.
  const idsKey = S.library.filter((l) => l.cat === tab).map((l) => l.id).join(',');
  const order = useMemo(() => (tab === 'prep' ? [] : S.library.filter((l) => l.cat === tab && (!ql || l.name.toLowerCase().includes(ql))).sort((a, b) => a.name.localeCompare(b.name)).map((l) => l.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, ql, idsKey]);
  const list = order.map((id) => getLib(S, id)).filter((l): l is LibItem => !!l);
  return (
    <>
      <PageHead title={L('Ingredient prices', 'Presyo ng sangkap')} lead={L('Every ingredient you buy, saved once. When a price changes, update it here and every product that uses it updates too.', 'Lahat ng binibili mo, naka-save once. Pag nagbago ang presyo, i-update dito at updated na lahat ng produktong gumagamit nito.')} />
      <AlertsCard title={L('Recent price changes', 'Mga bagong price change')} limit={3} />
      <div className="libtabs" role="tablist" aria-label={L('Item types', 'Uri ng item')} onKeyDown={onKey}>
        {tabs.map(([k, label]) => <button key={k} role="tab" id={'ltab-' + k} aria-selected={tab === k} aria-controls="lpanel" tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <section className="card" role="tabpanel" id="lpanel" aria-labelledby={'ltab-' + tab}>
        {tab === 'prep' ? <>
          <div className="card-head"><h2>Sub-recipes{hPrep.btn}</h2><p>{L('Things you make in batches, like garlic rice, sauce, marinade or dough.', 'Mga ginagawa mo by batch, tulad ng garlic rice, sauce, marinade o dough.')}</p></div>
          {hPrep.text}
          {S.preps.length ? <div className="items">{S.preps.map((p) => <PrepCard key={p.id} p={p} />)}</div> : <p className="help">{L('No sub-recipes yet.', 'Wala pang sub-recipe.')}</p>}
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={addPrep}><Icon name="plus" size={18} />{L('New sub-recipe', 'Bagong sub-recipe')}</button>
        </> : <>
          <div className="card-head row"><h2>{tab === 'pack' ? 'Packaging' : L('Ingredients', 'Mga sangkap')}{tab === 'ing' && hUsable.btn}</h2>
            <input className="input search" id="lib-search" type="search" placeholder={L('Search…', 'Hanapin…')} aria-label={L('Search items', 'Hanapin ang item')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {tab === 'ing' && hUsable.text}
          {list.length ? <div className="items">{list.map((l) => <LibCard key={l.id} l={l} />)}</div> : <p className="help">{ql ? L('No match.', 'Walang tugma.') : L('Nothing here yet.', 'Wala pa dito.')}</p>}
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => addLib(tab)}><Icon name="plus" size={18} />{tab === 'pack' ? L('New packaging', 'Bagong packaging') : L('New ingredient', 'Bagong sangkap')}</button>
        </>}
      </section>
      <Pager prev={['/dashboard', 'Home']} next={['/products', L('Go to Products', 'Pumunta sa Products')]} />
    </>
  );
}
