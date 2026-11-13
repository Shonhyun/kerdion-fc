'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { GCASH, PRICE, entExpired, entIsPro, type Billing } from '@/lib/plan';
import { getSupabase } from '@/lib/supabase/client';
import { Icon, PageHead } from '../ui';
import { PlanCards, fmtDay, useProList } from '../Pro';
import { refreshPlan, useData, useEnt, useMeta, useT } from '@/store/store';

interface PayReq { id: string; billing: Billing; amount: number; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string; reviewed_at: string | null }

const MAX_MB = 5;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const n0 = (v: number) => v.toLocaleString('en-US');

function fmtWhen(iso: string, lang: 'en' | 'tl') {
  return new Date(iso).toLocaleString(lang === 'tl' ? 'fil-PH' : 'en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function QrImage() {
  const L = useT(); const [ok, setOk] = useState(true);
  if (!ok) return <div className="qr-missing">{L('GCash QR is not set up yet. Please message us on Viber to pay.', 'Wala pang GCash QR. Mag-message muna sa amin sa Viber para makapagbayad.')}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={GCASH.qr} alt={L('GCash QR code for Saffra payments', 'GCash QR code para sa bayad sa Saffra')} onError={() => setOk(false)} />;
}

export default function Upgrade() {
  const S = useData(); const L = useT(); const meta = useMeta(); const ent = useEnt(); const params = useSearchParams(); const list = useProList();
  const q = params.get('plan');
  const [billing, setBilling] = useState<Billing>(q === 'monthly' ? 'monthly' : 'yearly');
  const [last, setLast] = useState<PayReq | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const sb = getSupabase(); if (!sb || !meta.userId) { setLoading(false); return; }
    const [{ data }] = await Promise.all([
      sb.from('payment_requests').select('id, billing, amount, status, admin_note, created_at, reviewed_at').eq('user_id', meta.userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      refreshPlan(true),
    ]);
    setLast((data as PayReq) || null); setLoading(false);
  }, [meta.userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (meta.mode !== 'cloud') {
    return <><PageHead title={L('Plan & billing', 'Plan at bayad')} /><div className="empty"><strong>{L('Plans need an account', 'Kailangan ng account para sa plans')}</strong><p>{L('Local mode has every feature. Connect Supabase to use accounts and plans.', 'Kumpleto ang features sa local mode. I-connect ang Supabase para sa accounts at plans.')}</p></div></>;
  }

  const pro = entIsPro(ent); const pending = last?.status === 'pending';
  const pick = (f: File | undefined) => {
    setErr('');
    if (!f) return;
    if (!TYPES.includes(f.type)) { setErr(L('Please upload a PNG, JPG or WEBP screenshot.', 'PNG, JPG o WEBP na screenshot lang ang pwede.')); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(L('The image is too big. Use one under ' + MAX_MB + ' MB.', 'Masyadong malaki ang image. Dapat less than ' + MAX_MB + ' MB.')); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const sb = getSupabase(); if (!sb) return;
    if (!file) { setErr(L('Upload the screenshot of your GCash receipt first.', 'I-upload muna ang screenshot ng GCash receipt mo.')); return; }
    setBusy(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = meta.userId + '/' + Date.now() + '.' + ext;
    const up = await sb.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); setErr(L('Upload failed. Check your internet and try again.', 'Hindi na-upload. I-check ang internet at subukan ulit.')); return; }
    const ins = await sb.from('payment_requests').insert({ billing, amount: PRICE[billing], reference_no: ref.trim().slice(0, 60) || null, proof_path: path });
    setBusy(false);
    if (ins.error) {
      setErr(ins.error.code === '23505' ? L('You already have a payment waiting for verification.', 'May payment ka nang hinihintay ma-verify.') : L('Could not send your payment. Please try again.', 'Hindi na-send ang payment. Subukan ulit.'));
      return;
    }
    setFile(null); setPreview(''); setRef('');
    load();
  };

  const planCard = (
    <section className="card" aria-labelledby="h-plan">
      <div className="card-head"><h2 id="h-plan">{L('Your plan', 'Ang plan mo')}</h2></div>
      {ent.tester ? (
        <div className="status-box"><Icon name="star" /><div><strong>{L('Tester: full access', 'Tester: full access')}</strong><p className="help">{L('Thank you for testing Saffra. Every Pro feature is on, free.', 'Salamat sa pag-test ng Saffra. Naka-on lahat ng Pro features, libre.')}</p></div></div>
      ) : pro ? (
        <div className="status-box"><Icon name="check" /><div><strong>Saffra Pro · {ent.billing === 'yearly' ? 'Yearly' : 'Monthly'}</strong>
          <p className="help">{L('Active until ', 'Active hanggang ') + fmtDay(ent.periodEnd, S.lang) + '. ' + L('Renew before then to keep your products unlocked. Paying early adds the time on top.', 'Mag-renew bago ang petsang iyan para hindi ma-lock ang products. Pag maaga kang nagbayad, nadadagdag lang ang oras.')}</p></div></div>
      ) : entExpired(ent) ? (
        <div className="status-box bad"><Icon name="lock" /><div><strong>{L('Pro ended on ', 'Natapos ang Pro noong ') + fmtDay(ent.periodEnd, S.lang)}</strong>
          <p className="help">{L('You are on the free plan. Products past the first 5 are locked, not deleted. Renew to unlock them.', 'Free plan ka ngayon. Naka-lock ang products na lampas sa unang 5, pero hindi nabura. Mag-renew para ma-unlock.')}</p></div></div>
      ) : (
        <div className="status-box warn"><Icon name="star" /><div><strong>Free plan</strong><p className="help">{L('Up to 5 products, 2 sub-recipes and the last 7 days of daily sales.', 'Hanggang 5 products, 2 sub-recipes at huling 7 araw ng daily sales.')}</p></div></div>
      )}
    </section>
  );

  return (
    <>
      <PageHead title={L('Plan & billing', 'Plan at bayad')} lead={L('Saffra Pro unlocks every feature for your business. Pay with GCash and we turn on Pro within 24 hours.', 'Ina-unlock ng Saffra Pro lahat ng features para sa negosyo mo. Magbayad via GCash at ia-on namin ang Pro within 24 hours.')} />
      {planCard}
      {loading ? <p className="help" role="status">{L('Loading…', 'Naglo-load…')}</p> : pending && last ? (
        <section className="card" aria-labelledby="h-wait">
          <div className="card-head"><h2 id="h-wait">{L('Payment received, waiting for verification', 'Natanggap ang bayad, hinihintay ma-verify')}</h2></div>
          <div className="status-box warn"><Icon name="cal" /><div>
            <strong>Pro {last.billing === 'yearly' ? 'Yearly' : 'Monthly'} · ₱{n0(last.amount)}</strong>
            <p className="help">{L('Sent on ', 'Na-send noong ') + fmtWhen(last.created_at, S.lang) + '. ' + L('We check payments within 24 hours. Pro turns on by itself once it is verified.', 'Chine-check namin ang bayad within 24 hours. Kusa nang mag-o-on ang Pro pag na-verify na.')}</p>
          </div></div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setLoading(true); load(); }}>{L('Check again', 'I-check ulit')}</button>
        </section>
      ) : ent.tester ? null : (
        <>
          {last?.status === 'rejected' && (
            <div className="status-box bad"><Icon name="x" /><div><strong>{L('Your last payment could not be verified', 'Hindi na-verify ang huling bayad mo')}</strong>
              <p className="help">{(last.admin_note ? last.admin_note + ' ' : '') + L('Please send it again, or message us on Viber.', 'Paki-send ulit, o mag-message sa amin sa Viber.')}</p></div></div>
          )}
          <section className="card" aria-labelledby="h-choose">
            <div className="card-head"><h2 id="h-choose">{pro ? L('Renew or extend Pro', 'Mag-renew o mag-extend ng Pro') : L('1. Choose your plan', '1. Pumili ng plan')}</h2></div>
            <PlanCards onPick={setBilling} picked={billing} />
            <ul className="pro-list">{list.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul>
          </section>
          <section className="card" aria-labelledby="h-pay">
            <div className="card-head"><h2 id="h-pay">{L('2. Pay with GCash', '2. Magbayad via GCash')}</h2><p>{L('Amount to pay: ', 'Babayaran: ')}<strong>₱{n0(PRICE[billing])}</strong> · Pro {billing === 'yearly' ? 'Yearly' : 'Monthly'}</p></div>
            <div className="grid2">
              <div className="qr-box">
                <QrImage />
                {GCASH.name && <strong>{GCASH.name}</strong>}
                {GCASH.number && <span>GCash {GCASH.number}</span>}
              </div>
              <ol className="pay-steps">
                <li>{L('Open GCash and tap ', 'Buksan ang GCash at i-tap ang ')}<strong>Scan QR</strong>.</li>
                <li>{L('Scan this code and pay exactly ', 'I-scan ang code at bayaran ng eksaktong ')}<strong>₱{n0(PRICE[billing])}</strong>.</li>
                <li>{L('Take a screenshot of the receipt that shows the reference number.', 'Mag-screenshot ng receipt na may reference number.')}</li>
                <li>{L('Upload the screenshot below and tap Send.', 'I-upload ang screenshot sa ibaba at i-tap ang Send.')}</li>
              </ol>
            </div>
          </section>
          <form className="card" aria-labelledby="h-proof" onSubmit={submit}>
            <div className="card-head"><h2 id="h-proof">{L('3. Send your receipt', '3. I-send ang receipt')}</h2><p>{L('We verify it within 24 hours, then Pro turns on by itself.', 'Ive-verify namin within 24 hours, tapos kusa nang mag-o-on ang Pro.')}</p></div>
            <div className="field">
              <span className="lbl">{L('Receipt screenshot', 'Screenshot ng receipt')}</span>
              <label className="btn file-btn" style={{ alignSelf: 'flex-start' }}><Icon name="upload" size={18} />{file ? L('Change screenshot', 'Palitan ang screenshot') : L('Choose screenshot', 'Pumili ng screenshot')}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img className="proof-preview" src={preview} alt={L('Your receipt screenshot', 'Screenshot ng receipt mo')} />}
            </div>
            <div className="field" style={{ maxWidth: 320 }}>
              <label htmlFor="pay-ref">{L('GCash reference number (optional)', 'GCash reference number (optional)')}</label>
              <input className="input" id="pay-ref" value={ref} maxLength={60} inputMode="numeric" autoComplete="off" placeholder={L('e.g. 1234 567 890123', 'hal. 1234 567 890123')} onChange={(e) => setRef(e.target.value)} />
            </div>
            {err && <p className="confirm" role="alert">{err}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? L('Sending…', 'Sine-send…') : L('Send for verification', 'I-send para ma-verify')}</button>
          </form>
        </>
      )}
    </>
  );
}
