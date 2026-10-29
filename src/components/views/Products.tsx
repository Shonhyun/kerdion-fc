'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Recipe } from '@/lib/types';
import { calc, delivery, rName } from '@/lib/calc';
import { applyTemplate, dupRecipe, recipe, removeRecipe, TEMPLATES } from '@/lib/data';
import { peso } from '@/lib/format';
import { Icon, MoreMenu, PageHead, Pager, Pill, useHelp } from '../ui';
import { showToast, update, useData, useT } from '@/store/store';

function PCard({ r }: { r: Recipe }) {
  const S = useData(); const L = useT(); const router = useRouter();
  const z = r.sizes.length ? r.sizes[0] : null;
  const c = calc(S, r, z);
  const mTone = c.pre <= 0 ? 'none' : c.margin >= 25 ? 'good' : c.margin >= 10 ? 'warn' : 'bad';
  const nm = rName(S, r);
  const href = '/products/' + r.id;
  const dup = () => {
    let id = ''; update((d) => { const rr = d.recipes.find((x) => x.id === r.id); if (rr) id = dupRecipe(d, rr).id; });
    showToast(L('Copied. Change the name and amounts.', 'Nakopya. Palitan ang pangalan at dami.'));
    if (id) router.push('/products/' + id + '?new=1');
  };
  const del = () => update((d) => { removeRecipe(d, r.id); }, L('Deleted ', 'Binura ang ') + nm);
  return (
    <div className="pcard">
      <div className="pcard-top">
        <Link className="pcard-name" href={href}>{nm}</Link>
        <Pill tone={mTone}>{c.pre > 0 ? Math.round(c.margin) + '% margin' : L('No price yet', 'Wala pang presyo')}</Pill>
        <MoreMenu label={L('More actions for ', 'Iba pang gagawin sa ') + nm} items={[
          { label: L('Edit', 'I-edit'), icon: 'edit', onSelect: () => router.push(href) },
          { label: L('Duplicate', 'Kopyahin'), icon: 'copy', onSelect: dup },
          { label: L('Delete', 'Burahin'), icon: 'trash', danger: true, onSelect: del },
        ]} />
      </div>
      {r.sizes.length > 0 && <span className="pcard-del">Sizes: {r.sizes.map((s) => (s.name || '?') + ' ' + peso(calc(S, r, s).sell)).join(' · ')}</span>}
      <dl className="pnums">
        <div><dt>{L('Cost', 'Gastos')}</dt><dd>{peso(c.cost)}</dd></div>
        <div><dt>{L('Price', 'Presyo')}</dt><dd>{peso(c.sell)}</dd></div>
        <div><dt>{L('Profit', 'Tubo')}</dt><dd data-tone={c.profit >= 0 ? 'good' : 'bad'}>{peso(c.profit)}</dd></div>
      </dl>
      {S.biz.deliveryOn && r.kind !== 'addon' && <span className="pcard-del">{L('Delivery app price: ', 'Presyo sa delivery app: ')}{delivery(S, c).price ? peso(delivery(S, c).price, 0) : '—'}</span>}
      <span className="pcard-link" aria-hidden="true">{L('Edit', 'I-edit')}<Icon name="right" size={16} /></span>
    </div>
  );
}

export default function Products() {
  const S = useData(); const L = useT(); const router = useRouter();
  const [showTpl, setShowTpl] = useState(false);
  const addonHelp = useHelp('addon');
  const prods = S.recipes.filter((r) => r.kind !== 'addon'), adds = S.recipes.filter((r) => r.kind === 'addon');
  const add = (kind: 'product' | 'addon') => { const r = recipe(kind, ''); update((d) => { d.recipes.push(r); }); router.push('/products/' + r.id + '?new=1'); };
  const applyTpl = (k: string) => {
    let n = 0; update((d) => { n = applyTemplate(d, k); }); setShowTpl(false);
    showToast(L('Added ', 'Nadagdag ang ') + n + L(' items. Update the prices to what you really pay.', ' items. Palitan ang presyo ng totoong binabayaran mo.'));
  };
  const tpl = (
    <div className="card">
      <div className="card-head row">
        <div><h2>{L('Add from a template', 'Mag-add galing sa template')}</h2><p className="help">{L('Adds example products and ingredients. Prices are examples only, so change them to what you actually pay.', 'Magdadagdag ng example na products at sangkap. Example lang ang presyo, palitan mo ng totoong binabayaran mo.')}</p></div>
        {S.recipes.length > 0 && <button className="btn btn-sm" onClick={() => setShowTpl(false)}>{L('Close', 'Isara')}</button>}
      </div>
      <div className="tgrid">
        {Object.keys(TEMPLATES).map((k) => <button key={k} className="tcard" onClick={() => applyTpl(k)}><strong>{L(...TEMPLATES[k].name)}</strong><span>{L(...TEMPLATES[k].desc)}</span></button>)}
      </div>
    </div>
  );
  return (
    <>
      <PageHead title={L('Products', 'Mga produkto')} eyebrow="Step 1 of 4" lead={L('Each product has its own recipe cost and selling price. Tap one to edit it.', 'Bawat produkto may sariling cost at selling price. I-tap para i-edit.')}
        actions={<><button className="btn" onClick={() => setShowTpl((v) => !v)}>{L('Use a template', 'Gumamit ng template')}</button><button className="btn btn-yolk" onClick={() => add('product')}><Icon name="plus" size={18} />Add product</button></>} />
      {(showTpl || !S.recipes.length) && tpl}
      {!prods.length ? (
        <div className="empty"><strong>{L('No products yet', 'Wala pang produkto')}</strong><p>{L('Start with your best seller, or pick a template above.', 'Simulan sa best seller mo, o pumili ng template sa taas.')}</p>
          <button className="btn btn-yolk" onClick={() => add('product')}><Icon name="plus" size={18} />{L('Add your first product', 'I-add ang unang produkto')}</button></div>
      ) : (
        <div className="pgrid">
          {prods.map((r) => <PCard key={r.id} r={r} />)}
          <button className="addcard" onClick={() => add('product')}><Icon name="plus" size={26} />Add product<span>{L('Another dish, drink or item', 'Ibang ulam, drink o item')}</span></button>
        </div>
      )}
      <div className="section-title" style={{ marginTop: 8 }}><h2>Add-ons{addonHelp.btn}</h2><button className="btn btn-sm" onClick={() => add('addon')}><Icon name="plus" size={16} />Add add-on</button></div>
      {addonHelp.text}
      {adds.length ? <div className="pgrid">{adds.map((r) => <PCard key={r.id} r={r} />)}</div>
        : <p className="help">{L('No add-ons yet. Examples: extra shot, extra pearls, extra egg, extra rice.', 'Wala pang add-on. Halimbawa: extra shot, extra pearls, extra egg, extra rice.')}</p>}
      <Pager prev={['/dashboard', 'Home']} next={['/expenses', L('Next: Expenses', 'Next: Mga bayarin')]} />
    </>
  );
}
