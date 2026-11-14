'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { qtyText, stockRows, type StockRow } from '@/lib/inventory';
import { fmtDate, nid, num, todayISO } from '@/lib/format';
import type { StockEntry } from '@/lib/types';
import { Icon, PageHead, Pager, Pill, Suffix, useHelp } from '../ui';
import { update, useData, useT } from '@/store/store';

type Mode = 'count' | 'in' | 'waste';

export default function Inventory() {
  const S = useData(); const L = useT(); const help = useHelp('inventory');
  const rows = useMemo(() => stockRows(S), [S]);
  const [open, setOpen] = useState<{ lid: string; mode: Mode } | null>(null);
  const tracked = rows.filter((r) => r.tracked);
  const urgent = rows.filter((r) => r.status === 'out' || r.status === 'low');
  const head = <PageHead title={L('Inventory', 'Inventory')} lead={L('Count what you have once. Every sale you log in Daily sales is taken out automatically, so you see what is running low before it runs out.', 'Bilangin minsan ang stock mo. Awtomatikong ibabawas ang bawat benta na nilog mo sa Daily sales, kaya makikita mo ang paubos bago pa maubos.')} />;

  if (!S.library.length) return <>{head}<div className="empty"><strong>{L('No ingredients yet', 'Wala pang sangkap')}</strong><p>{L('Add a product with its ingredients and packaging first.', 'Mag-add muna ng product kasama ang sangkap at packaging.')}</p><Link className="btn btn-primary" href="/products">{L('Go to Products', 'Pumunta sa Products')}</Link></div></>;

  const groups: [string, StockRow[]][] = [
    [L('Ingredients', 'Sangkap'), rows.filter((r) => r.l.cat === 'ing')],
    [L('Packaging', 'Packaging'), rows.filter((r) => r.l.cat === 'pack')],
  ];
  return (
    <>
      {head}
      <div className="inv-sum">
        <div><span>{L('Items counted', 'Nabilang na')}</span><strong>{tracked.length} / {rows.length}</strong></div>
        <div data-alert={urgent.length > 0 || undefined}><span>{L('Running low or out', 'Paubos o ubos na')}</span><strong>{urgent.length}</strong></div>
      </div>
      {!tracked.length && (
        <div className="inv-start">
          <Icon name="box" size={22} />
          <div><strong>{L('Start with a count', 'Magsimula sa pagbilang')}</strong>
            <p>{L('Tap Count on each item and type how much you have right now. You only do this once, then again whenever you want to correct it.', 'I-tap ang Count sa bawat item at i-type kung gaano karami ang meron ka ngayon. Isang beses lang ito, at uulitin lang kung gusto mong itama.')}</p></div>
        </div>
      )}
      {groups.map(([title, list]) => list.length > 0 && (
        <section className="card" key={title} aria-label={title}>
          <div className="card-head row"><h2>{title}{title === groups[0][0] && help.btn}</h2></div>
          {title === groups[0][0] && help.text}
          <ul className="inv-list">
            {list.map((r) => <Item key={r.l.id} r={r} open={open?.lid === r.l.id ? open.mode : null} setOpen={(m) => setOpen(m ? { lid: r.l.id, mode: m } : null)} />)}
          </ul>
        </section>
      ))}
      <History />
      <Pager prev={['/daily', L('Daily sales', 'Benta araw-araw')]} next={['/ingredients', L('Ingredient prices', 'Presyo ng sangkap')]} />
    </>
  );
}

function Item({ r, open, setOpen }: { r: StockRow; open: Mode | null; setOpen: (m: Mode | null) => void }) {
  const L = useT();
  const u = r.l.unit;
  const pill = r.status === 'out' ? <Pill tone="bad">{L('Out', 'Ubos na')}</Pill>
    : r.status === 'low' ? <Pill tone="warn">{L('Low', 'Paubos')}</Pill>
      : r.status === 'ok' ? <Pill tone="good">OK</Pill> : <Pill tone="none">{L('Not counted', 'Hindi pa bilang')}</Pill>;
  return (
    <li className="inv-item" data-status={r.status}>
      <div className="inv-main">
        <div className="inv-name"><strong>{r.l.name || L('Untitled', 'Walang pangalan')}</strong>{pill}</div>
        {r.tracked ? (
          <p className="inv-line">
            <b>{qtyText(Math.max(0, r.onHand), u)}</b> {L('left', 'natitira')}
            {r.daysLeft != null && r.status !== 'out' && <> · {L('about ', 'mga ') + (r.daysLeft < 1 ? L('less than a day', 'wala pang isang araw') : Math.floor(r.daysLeft) + L(r.daysLeft < 2 ? ' day' : ' days', ' araw'))}</>}
            {r.perDay > 0 && <span className="help"> · {L('uses ', 'gamit ') + qtyText(r.perDay, u) + L(' a day', ' kada araw')}</span>}
          </p>
        ) : <p className="inv-line help">{r.perDay > 0 ? L('Uses about ', 'Gamit mga ') + qtyText(r.perDay, u) + L(' a day. Count it to track it.', ' kada araw. Bilangin para ma-track.') : L('Count it to start tracking.', 'Bilangin para ma-track.')}</p>}
      </div>
      <div className="inv-actions">
        <button className={'btn btn-sm' + (r.tracked ? '' : ' btn-primary')} aria-expanded={open === 'count'} onClick={() => setOpen(open === 'count' ? null : 'count')}>{L('Count', 'Bilang')}</button>
        {r.tracked && <button className="btn btn-sm" aria-expanded={open === 'in'} onClick={() => setOpen(open === 'in' ? null : 'in')}><Icon name="plus" size={16} />{L('Delivery', 'Dumating')}</button>}
        {r.tracked && <button className="btn btn-sm" aria-expanded={open === 'waste'} onClick={() => setOpen(open === 'waste' ? null : 'waste')}>{L('Waste', 'Nasayang')}</button>}
      </div>
      {open && <Entry r={r} mode={open} done={() => setOpen(null)} />}
    </li>
  );
}

function Entry({ r, mode, done }: { r: StockRow; mode: Mode; done: () => void }) {
  const L = useT();
  const id = 'inv-' + r.l.id;
  const [qty, setQty] = useState(mode === 'count' && r.tracked ? String(Math.max(0, Math.round(r.onHand * 100) / 100)) : '');
  const [d, setD] = useState(todayISO());
  const [at, setAt] = useState<'open' | 'close'>('open');
  const [low, setLow] = useState(r.l.low || '');
  const label = mode === 'count' ? L('How much do you have now?', 'Gaano karami ang meron ka ngayon?') : mode === 'in' ? L('How much arrived?', 'Gaano karami ang dumating?') : L('How much was thrown away or spoiled?', 'Gaano karami ang natapon o nasira?');
  const ok = num(qty) > 0 || (mode === 'count' && qty.trim() !== '' && num(qty) === 0);
  const save = () => {
    if (!ok) return;
    const e: StockEntry = { id: nid('st'), t: Date.now(), d, lid: r.l.id, kind: mode, qty: String(num(qty)), ...(mode === 'count' ? { at } : {}) };
    const name = r.l.name || L('item', 'item');
    update((s) => {
      s.stock.push(e);
      if (s.stock.length > 3000) s.stock.splice(0, s.stock.length - 3000);
      if (mode === 'count') { const l = s.library.find((x) => x.id === r.l.id); if (l) l.low = low.trim() === '' ? '' : String(num(low)); }
    }, mode === 'count' ? L('Counted ', 'Nabilang ang ') + name : mode === 'in' ? L('Added delivery of ', 'Na-add ang dumating na ') + name : L('Recorded waste of ', 'Na-record ang nasayang na ') + name);
    done();
  };
  return (
    <div className="inv-entry">
      <div className="field"><label htmlFor={id + '-q'}>{label}</label><Suffix id={id + '-q'} value={qty} suffix={r.l.unit} onChange={(v) => setQty(v)} /></div>
      <div className="field"><label htmlFor={id + '-d'}>{L('Date', 'Petsa')}</label><input id={id + '-d'} type="date" className="input" value={d} max={todayISO()} onChange={(e) => setD(e.target.value || todayISO())} /></div>
      {mode === 'count' && (
        <>
          <div className="field">
            <span className="lbl" id={id + '-at'}>{L('When did you count?', 'Kailan ka nagbilang?')}</span>
            <div className="seg2" role="group" aria-labelledby={id + '-at'}>
              <button type="button" aria-pressed={at === 'open'} onClick={() => setAt('open')}>{L('Before opening', 'Bago magbukas')}</button>
              <button type="button" aria-pressed={at === 'close'} onClick={() => setAt('close')}>{L('After closing', 'Pagsara')}</button>
            </div>
          </div>
          <div className="field"><label htmlFor={id + '-low'}>{L('Warn me when it drops to', 'Paalalahanan ako kapag umabot sa')} <span className="help">({L('optional', 'optional')})</span></label><Suffix id={id + '-low'} value={low} suffix={r.l.unit} onChange={(v) => setLow(v)} /></div>
        </>
      )}
      <div className="inv-entry-btns">
        <button className="btn btn-primary" disabled={!ok} onClick={save}>{mode === 'count' ? L('Save count', 'I-save ang bilang') : mode === 'in' ? L('Add delivery', 'I-add ang dumating') : L('Record waste', 'I-record ang nasayang')}</button>
        <button className="btn" onClick={done}>{L('Cancel', 'Cancel')}</button>
      </div>
    </div>
  );
}

function History() {
  const S = useData(); const L = useT();
  const list = S.stock.slice().sort((a, b) => b.t - a.t).slice(0, 12);
  if (!list.length) return null;
  const word = (e: StockEntry) => e.kind === 'count' ? L('Counted', 'Nabilang') : e.kind === 'in' ? L('Delivery', 'Dumating') : L('Waste', 'Nasayang');
  return (
    <section className="card" aria-labelledby="h-invh">
      <div className="card-head"><h2 id="h-invh">{L('Recent stock changes', 'Mga huling pagbabago sa stock')}</h2><p>{L('Made a mistake? Remove the entry and add it again.', 'Nagkamali? Tanggalin ang entry at i-add ulit.')}</p></div>
      <ul className="adm-list inv-hist">
        {list.map((e) => {
          const l = S.library.find((x) => x.id === e.lid);
          return (
            <li key={e.id}>
              <div><strong>{word(e)}: {l ? l.name : L('(deleted item)', '(nabura na item)')}</strong>
                <span className="help">{(e.kind === 'waste' ? '−' : e.kind === 'in' ? '+' : '') + qtyText(num(e.qty), l ? l.unit : '')} · {fmtDate(e.d, S.lang)}{e.kind === 'count' ? ' · ' + (e.at === 'close' ? L('after closing', 'pagsara') : L('before opening', 'bago magbukas')) : ''}</span></div>
              <button className="icon-btn" aria-label={L('Remove this entry', 'Tanggalin ang entry na ito')} onClick={() => update((s) => { s.stock = s.stock.filter((x) => x.id !== e.id); }, L('Removed the entry', 'Natanggal ang entry'))}><Icon name="trash" size={18} /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Small card for Home: what is out or running low. */
export function LowStockCard() {
  const S = useData(); const L = useT();
  const list = useMemo(() => stockRows(S).filter((r) => r.status === 'out' || r.status === 'low')
    .sort((a, b) => (a.status === b.status ? (a.daysLeft ?? 99) - (b.daysLeft ?? 99) : a.status === 'out' ? -1 : 1)), [S]);
  if (!list.length) return null;
  return (
    <section className="card" aria-labelledby="h-low">
      <div className="card-head row"><h2 id="h-low">{L('Running low', 'Paubos na')}</h2><Link className="btn btn-sm" href="/inventory">{L('Inventory', 'Inventory')}</Link></div>
      <ul className="adm-list">
        {list.slice(0, 5).map((r) => (
          <li key={r.l.id}>
            <div><strong>{r.l.name}</strong><span className="help">{r.status === 'out' ? L('Out of stock', 'Ubos na') : qtyText(r.onHand, r.l.unit) + L(' left', ' natitira') + (r.daysLeft != null ? ' · ' + (r.daysLeft < 1 ? L('less than a day', 'wala pang isang araw') : L('about ', 'mga ') + Math.floor(r.daysLeft) + L(r.daysLeft < 2 ? ' day' : ' days', ' araw')) : '')}</span></div>
            {r.status === 'out' ? <Pill tone="bad">{L('Out', 'Ubos na')}</Pill> : <Pill tone="warn">{L('Low', 'Paubos')}</Pill>}
          </li>
        ))}
      </ul>
    </section>
  );
}
