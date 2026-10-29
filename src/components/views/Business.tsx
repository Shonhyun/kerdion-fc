'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Biz } from '@/lib/types';
import { fresh, sample } from '@/lib/data';
import { getSupabase } from '@/lib/supabase/client';
import { ConfirmBox, Icon, PageHead, Suffix, useHelp } from '../ui';
import { RoundSelect } from './ProductEditor';
import { replaceData, signOut, update, useData, useMeta, useT } from '@/store/store';

export default function Business() {
  const S = useData(); const L = useT(); const meta = useMeta(); const router = useRouter();
  const [confirm, setConfirm] = useState<'' | 'clear' | 'sample'>('');
  const [pw, setPw] = useState(''); const [pwMsg, setPwMsg] = useState<{ ok: boolean; t: string } | null>(null); const [pwBusy, setPwBusy] = useState(false);
  const hRound = useHelp('round'), hDel = useHelp('delivery');
  const set = <K extends keyof Biz>(k: K, v: Biz[K]) => update((d) => { d.biz[k] = v; });

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setPwMsg({ ok: false, t: L('Use at least 8 characters.', 'Gumamit ng at least 8 characters.') }); return; }
    const sb = getSupabase(); if (!sb) return;
    setPwBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) setPwMsg({ ok: false, t: error.message }); else { setPw(''); setPwMsg({ ok: true, t: L('Password changed.', 'Napalitan na ang password.') }); }
  };

  return (
    <>
      <PageHead title="Business info" lead={L('Basic details used in all your computations.', 'Basic details na gamit sa lahat ng computation.')} />
      <section className="card" aria-labelledby="h-biz">
        <div className="card-head"><h2 id="h-biz">{L('Your business', 'Ang negosyo mo')}</h2></div>
        <div className="biz-grid">
          <div className="field"><label htmlFor="biz-name">{L('Business name', 'Pangalan ng negosyo')}</label><input className="input" id="biz-name" value={S.biz.name} placeholder={L('e.g. Wins Coffee', 'hal. Wins Coffee')} autoComplete="off" onChange={(e) => set('name', e.target.value)} /></div>
          <div className="field"><label htmlFor="biz-days">{L('Days open per month', 'Araw na bukas kada buwan')}</label><input className="input" id="biz-days" value={S.biz.daysOpen} inputMode="numeric" onChange={(e) => set('daysOpen', e.target.value)} /><span className="help">{L('Open Monday to Saturday? That is about 26 days.', 'Bukas Monday hanggang Saturday? Mga 26 days ’yan.')}</span></div>
          <div className="field"><label htmlFor="round-b">{L('Round suggested prices', 'I-round ang suggested price')}{hRound.btn}</label>{hRound.text}<RoundSelect id="round-b" /></div>
        </div>
      </section>
      <section className="card" aria-labelledby="h-tax">
        <div className="card-head"><h2 id="h-tax">Tax</h2><p>{L('Turn this on only if you are VAT-registered. Many small sellers are not. Ask BIR or your accountant if unsure.', 'I-on lang kung VAT-registered ka. Maraming maliliit na seller ang hindi. Magtanong sa BIR o accountant kung hindi sure.')}</p></div>
        <label className="switch" htmlFor="biz-taxon"><input type="checkbox" id="biz-taxon" checked={S.biz.taxOn} onChange={(e) => set('taxOn', e.target.checked)} /><span>{L('Add tax to my selling prices', 'Idagdag ang tax sa selling price')}</span></label>
        <div className="field" style={{ maxWidth: 200 }}><label htmlFor="biz-taxrate">Tax rate</label><Suffix id="biz-taxrate" value={S.biz.taxRate} suffix="%" disabled={!S.biz.taxOn} onChange={(v) => set('taxRate', v)} /></div>
      </section>
      <section className="card" aria-labelledby="h-del">
        <div className="card-head"><h2 id="h-del">Delivery apps{hDel.btn}</h2>{hDel.text}</div>
        <label className="switch" htmlFor="biz-delon"><input type="checkbox" id="biz-delon" checked={S.biz.deliveryOn} onChange={(e) => set('deliveryOn', e.target.checked)} /><span>{L('Show delivery app prices', 'Ipakita ang delivery app prices')}</span></label>
        <div className="field" style={{ maxWidth: 200 }}><label htmlFor="biz-delrate">{L('App commission', 'Commission ng app')}</label><Suffix id="biz-delrate" value={S.biz.deliveryRate} suffix="%" disabled={!S.biz.deliveryOn} onChange={(v) => set('deliveryRate', v)} /></div>
      </section>
      {meta.mode === 'cloud' && (
        <section className="card" aria-labelledby="h-acct">
          <div className="card-head"><h2 id="h-acct">{L('Your account', 'Ang account mo')}</h2><p>{L('Signed in as ', 'Naka-sign in bilang ')}<strong>{meta.email}</strong>. {L('Your data saves to your account automatically.', 'Automatic na naka-save sa account mo ang data.')}</p></div>
          <form onSubmit={changePw} className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="new-pw">{L('New password', 'Bagong password')}</label>
            <input className="input" id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setPwMsg(null); }} />
            <button className="btn" type="submit" disabled={pwBusy} style={{ alignSelf: 'flex-start' }}>{pwBusy ? L('Saving…', 'Sine-save…') : L('Change password', 'Palitan ang password')}</button>
            {pwMsg && <p className={pwMsg.ok ? 'tip' : 'confirm'} role="status">{pwMsg.t}</p>}
          </form>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => signOut()}><Icon name="logout" size={18} />{L('Sign out', 'Mag-sign out')}</button>
        </section>
      )}
      <section className="card" aria-labelledby="h-data">
        <div className="card-head"><h2 id="h-data">{L('Your data', 'Ang data mo')}</h2></div>
        {confirm === 'clear' ? <ConfirmBox msg={L('Delete all products, ingredients, expenses and sales logs, then start the quick setup again? This cannot be undone.', 'Burahin lahat ng products, sangkap, bayarin at sales logs, tapos ulitin ang quick setup? Hindi na maibabalik.')} yes={L('Delete everything', 'Burahin lahat')}
          onYes={() => { replaceData(fresh(S.lang, S.biz.name)); setConfirm(''); router.replace('/welcome'); }} onNo={() => setConfirm('')} />
          : confirm === 'sample' ? <ConfirmBox msg={L('Replace your data with the sample silog stall?', 'Palitan ang data mo ng sample silog stall?')} yes={L('Replace', 'Palitan')}
            onYes={() => { replaceData(sample(S.lang)); setConfirm(''); router.push('/dashboard'); }} onNo={() => setConfirm('')} />
            : <div className="btn-row"><button className="btn" onClick={() => setConfirm('sample')}>{L('Load sample data', 'I-load ang sample data')}</button><button className="btn" onClick={() => setConfirm('clear')}>{L('Clear everything', 'Burahin lahat')}</button></div>}
      </section>
    </>
  );
}
