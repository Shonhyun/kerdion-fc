'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon, PageHead, Pill } from '@/components/ui';
import { useAdmin } from './AdminShell';
import { ago, approvePayment, fmtWhen, loadPayments, n0, receiptUrls, rejectPayment, type Pay } from './data';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

function PayCard({ p, url, onDone, onZoom }: { p: Pay; url: string; onDone: () => void; onZoom: (u: string) => void }) {
  const [mode, setMode] = useState<'' | 'approve' | 'reject'>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (kind: 'approve' | 'reject') => {
    setBusy(true); setErr('');
    try { if (kind === 'approve') await approvePayment(p.id); else await rejectPayment(p.id, note); setMode(''); onDone(); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const tone = p.status === 'approved' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn';
  return (
    <div className="adm-pay">
      <div className="meta">
        <strong style={{ fontSize: 16 }}>{p.email || p.user_id}</strong>
        <span>Pro {p.billing === 'yearly' ? 'Yearly' : 'Monthly'} · <strong>₱{n0(p.amount)}</strong></span>
        <span>Reference no.: <strong>{p.reference_no || '—'}</strong></span>
        <span className="help">Sent {fmtWhen(p.created_at)} ({ago(p.created_at)})</span>
        {p.reviewed_at && <span className="help">Reviewed {fmtWhen(p.reviewed_at)}</span>}
        {p.admin_note && <span className="help">Reason: {p.admin_note}</span>}
        <Pill tone={tone} style={{ alignSelf: 'flex-start' }}>{p.status}</Pill>
        {p.status === 'pending' && (mode === 'approve' ? (
          <div className="confirm" role="alert">
            <span>Turn on Pro {p.billing} for {p.email || 'this account'}? Check that ₱{n0(p.amount)} arrived in your Maya or BPI account first.</span>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act('approve')}>{busy ? 'Approving…' : 'Yes, approve'}</button>
            <button className="btn btn-sm" onClick={() => setMode('')}>Cancel</button>
          </div>
        ) : mode === 'reject' ? (
          <div className="field">
            <label htmlFor={'note-' + p.id}>Reason (the user sees this)</label>
            <input className="input" id={'note-' + p.id} value={note} maxLength={500} placeholder="e.g. Amount did not match, or payment not found" onChange={(e) => setNote(e.target.value)} />
            <div className="btn-row"><button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act('reject')}>{busy ? 'Rejecting…' : 'Reject payment'}</button><button className="btn btn-sm" onClick={() => setMode('')}>Cancel</button></div>
          </div>
        ) : (
          <div className="btn-row"><button className="btn btn-sm btn-primary" onClick={() => setMode('approve')}><Icon name="check" size={16} />Approve</button><button className="btn btn-sm" onClick={() => setMode('reject')}><Icon name="x" size={16} />Reject</button></div>
        ))}
        {err && <p className="confirm" role="alert">{err}</p>}
      </div>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <button type="button" className="adm-thumb" aria-label="View receipt full size" onClick={() => onZoom(url)}><img src={url} alt={'Receipt from ' + (p.email || 'user')} /></button>
        : <span className="help">No image</span>}
    </div>
  );
}

export default function Payments() {
  const { refreshPending } = useAdmin();
  const [filter, setFilter] = useState<Filter>('pending');
  const [pays, setPays] = useState<Pay[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const list = await loadPayments(filter); setPays(list); setUrls(await receiptUrls(list.map((p) => p.proof_path))); }
    catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(''); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoom]);
  const done = () => { load(); refreshPending(); };

  return (
    <>
      <PageHead title="Payments" lead="Check that the money arrived, then approve. Approving starts Pro right away, or adds the time on top if it is still active."
        actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>} />
      <div className="chips" role="group" aria-label="Show payments">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'pending' ? 'Waiting' : f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      {err && <p className="confirm" role="alert">{err}</p>}
      {loading ? <p className="help" role="status">Loading…</p>
        : pays.length ? <div className="items">{pays.map((p) => <PayCard key={p.id} p={p} url={urls[p.proof_path] || ''} onDone={done} onZoom={setZoom} />)}</div>
          : <div className="empty"><strong>{filter === 'pending' ? 'No payments waiting' : 'Nothing here'}</strong>{filter === 'pending' && <p>New receipts show up here as soon as users send them.</p>}</div>}
      {zoom && (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="adm-big" role="dialog" aria-label="Receipt" onClick={() => setZoom('')}><img src={zoom} alt="Receipt full size" /></div>
      )}
    </>
  );
}
