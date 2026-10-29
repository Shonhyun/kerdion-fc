'use client';

import { totals, find } from '@/lib/calc';
import { focusSoon, nid, peso } from '@/lib/format';
import { Icon, PageHead, Pager, Peso } from '../ui';
import { update, useData, useT } from '@/store/store';

const QUICK: [string, string][] = [['Rent', 'Renta'], ['Staff salary', 'Sweldo'], ['Electricity', 'Kuryente'], ['Water', 'Tubig'], ['LPG', 'LPG'], ['Internet', 'Internet'], ['Permits', 'Permits'], ['Delivery rider', 'Rider']];

export default function Expenses() {
  const S = useData(); const L = useT(); const t = totals(S);
  const add = (name: string, focus: 'name' | 'amount') => { const f = { id: nid('f'), name, amount: '' }; update((d) => { d.fixed.push(f); }); focusSoon(f.id + '-' + focus); };
  const set = (id: string, k: 'name' | 'amount', v: string) => update((d) => { const f = find(d.fixed, id); if (f) f[k] = v; });
  return (
    <>
      <PageHead title={L('Monthly expenses', 'Buwanang bayarin')} eyebrow="Step 2 of 4" lead={L('Bills you pay every month even on slow days, like rent, salaries and electricity. Do not include ingredients here, they are already in your products.', 'Mga binabayaran mo kada buwan kahit matumal, tulad ng renta, sweldo at kuryente. Huwag isama ang sangkap, nasa products na ’yon.')} />
      <section className="card" aria-labelledby="h-fx">
        <div className="card-head"><h2 id="h-fx">{L('Your monthly bills', 'Mga bills mo kada buwan')}</h2></div>
        {S.fixed.length ? (
          <div className="fx-list">
            {S.fixed.map((f) => (
              <div className="fx-row" key={f.id}>
                <input className="input" id={f.id + '-name'} value={f.name} placeholder={L('e.g. Rent', 'hal. Renta')} aria-label={L('Expense name', 'Pangalan ng bayarin')} autoComplete="off" onChange={(e) => set(f.id, 'name', e.target.value)} />
                <Peso id={f.id + '-amount'} value={f.amount} label={L('Monthly amount for ', 'Halaga kada buwan ng ') + (f.name || 'expense')} onChange={(v) => set(f.id, 'amount', v)} />
                <button className="icon-btn icon-del" title={L('Delete', 'Burahin')} aria-label={L('Delete ', 'Burahin ang ') + (f.name || 'expense')} onClick={() => update((d) => { d.fixed = d.fixed.filter((x) => x.id !== f.id); }, L('Deleted ', 'Binura ang ') + (f.name || L('expense', 'bayarin')))}><Icon name="trash" size={19} /></button>
              </div>
            ))}
          </div>
        ) : <p className="help">{L('No expenses yet. Tap a common one below or add your own.', 'Wala pang bayarin. I-tap ang common sa baba o mag-add ng sarili.')}</p>}
        <div className="field"><span className="lbl">Quick add</span>
          <div className="chips">{QUICK.map((q) => { const n = L(q[0], q[1]); return <button key={q[0]} className="chip" onClick={() => add(n, 'amount')}>+ {n}</button>; })}</div>
        </div>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => add('', 'name')}><Icon name="plus" size={18} />{L('Add other expense', 'Mag-add ng iba')}</button>
        <div className="subtotal"><span>{L('Total per month', 'Total kada buwan')}</span><strong>{peso(t.fixed, 0)}</strong></div>
      </section>
      <p className="tip">{L('Every day you are open, you need to earn ', 'Kada araw na bukas ka, kailangan mong kumita ng ')}<strong>{peso(t.fixed / t.days, 0)}</strong>{L(' in profit just to cover these bills.', ' na tubo para lang mabayaran ang mga bills na ito.')}</p>
      <Pager prev={['/products', 'Products']} next={['/sales', 'Next: Sales plan']} />
    </>
  );
}
