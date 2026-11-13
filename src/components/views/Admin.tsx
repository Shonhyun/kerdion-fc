'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { ConfirmBox, Icon, PageHead, Pill } from '../ui';
import { fmtDay } from '../Pro';
import { useEnt, useMeta } from '@/store/store';

interface Pay { id: string; user_id: string; email: string | null; billing: 'monthly' | 'yearly'; amount: number; reference_no: string | null; proof_path: string; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string; reviewed_at: string | null }
interface Acct { user_id: string; email: string; business_name: string; signed_up: string; products: number; plan: string; billing: string | null; current_period_end: string | null; is_tester: boolean }
type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const n0 = (v: number) => v.toLocaleString('en-US');
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 1 ? 'less than 1 hour ago' : h < 48 ? h + ' hours ago' : Math.floor(h / 24) + ' days ago';
}
const isActivePro = (a: Acct) => a.plan === 'pro' && !!a.current_period_end && new Date(a.current_period_end).getTime() > Date.now();

function PayCard({ p, url, onDone, onZoom }: { p: Pay; url: string; onDone: () => void; onZoom: (u: string) => void }) {
  const [mode, setMode] = useState<'' | 'approve' | 'reject'>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (kind: 'approve' | 'reject') => {
    const sb = getSupabase(); if (!sb) return;
    setBusy(true); setErr('');
    const res = kind === 'approve' ? await sb.rpc('approve_payment', { p_id: p.id }) : await sb.rpc('reject_payment', { p_id: p.id, p_note: note.trim() || null });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setMode(''); onDone();
  };
  const tone = p.status === 'approved' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn';
  return (
    <div className="adm-pay">
      <div className="meta">
        <strong style={{ fontSize: 16 }}>{p.email || p.user_id}</strong>
        <span>Pro {p.billing === 'yearly' ? 'Yearly' : 'Monthly'} · <strong>₱{n0(p.amount)}</strong></span>
        <span>Ref no.: <strong>{p.reference_no || '—'}</strong></span>
        <span className="help">Sent {fmtWhen(p.created_at)} ({ago(p.created_at)})</span>
        {p.reviewed_at && <span className="help">Reviewed {fmtWhen(p.reviewed_at)}</span>}
        {p.admin_note && <span className="help">Note: {p.admin_note}</span>}
        <Pill tone={tone} style={{ alignSelf: 'flex-start' }}>{p.status}</Pill>
        {p.status === 'pending' && (mode === 'approve'
          ? <ConfirmBox msg={'Turn on Pro ' + p.billing + ' for ' + (p.email || 'this account') + '? Check that ₱' + n0(p.amount) + ' arrived in GCash first.'} yes={busy ? 'Approving…' : 'Yes, approve'} onYes={() => act('approve')} onNo={() => setMode('')} />
          : mode === 'reject' ? (
            <div className="field">
              <label htmlFor={'note-' + p.id}>Reason (the user sees this)</label>
              <input className="input" id={'note-' + p.id} value={note} maxLength={500} placeholder="e.g. Amount did not match, or receipt not found" onChange={(e) => setNote(e.target.value)} />
              <div className="btn-row"><button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act('reject')}>{busy ? 'Rejecting…' : 'Reject payment'}</button><button className="btn btn-sm" onClick={() => setMode('')}>Cancel</button></div>
            </div>
          ) : (
            <div className="btn-row"><button className="btn btn-sm btn-primary" onClick={() => setMode('approve')}><Icon name="check" size={16} />Approve</button><button className="btn btn-sm" onClick={() => setMode('reject')}><Icon name="x" size={16} />Reject</button></div>
          ))}
        {err && <p className="confirm" role="alert">{err}</p>}
      </div>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <button type="button" style={{ border: 0, padding: 0, background: 'none' }} aria-label="View receipt full size" onClick={() => onZoom(url)}><img src={url} alt={'Receipt from ' + (p.email || 'user')} /></button>
        : <span className="help">No image</span>}
    </div>
  );
}

export default function Admin() {
  const ent = useEnt(); const meta = useMeta();
  const [tab, setTab] = useState<'pay' | 'acct'>('pay');
  const [filter, setFilter] = useState<Filter>('pending');
  const [pays, setPays] = useState<Pay[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [accts, setAccts] = useState<Acct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const sb = getSupabase(); if (!sb) return;
    setLoading(true); setErr('');
    let pq = sb.from('payment_requests').select('*').order('created_at', { ascending: filter === 'pending' }).limit(200);
    if (filter !== 'all') pq = pq.eq('status', filter);
    const [pr, ar] = await Promise.all([pq, sb.rpc('admin_list_accounts')]);
    if (pr.error || ar.error) { setErr((pr.error || ar.error)!.message); setLoading(false); return; }
    const list = (pr.data || []) as Pay[];
    setPays(list); setAccts((ar.data || []) as Acct[]);
    const paths = list.map((p) => p.proof_path);
    if (paths.length) {
      const s = await sb.storage.from('payment-proofs').createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (s.data || []).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; });
      setUrls(m);
    } else setUrls({});
    setLoading(false);
  }, [filter]);
  useEffect(() => { if (ent.admin) load(); }, [ent.admin, load]);

  const tester = async (a: Acct) => {
    const sb = getSupabase(); if (!sb) return;
    const r = await sb.rpc('set_tester', { p_user: a.user_id, p_on: !a.is_tester });
    if (r.error) setErr(r.error.message); else load();
  };

  if (meta.mode !== 'cloud' || !ent.admin) {
    return <><PageHead title="Admin" /><div className="empty"><strong>This page is for admins only.</strong></div></>;
  }
  const pro = accts.filter(isActivePro).length, testers = accts.filter((a) => a.is_tester).length;
  const ql = q.trim().toLowerCase();
  const shownAccts = accts.filter((a) => !ql || a.email.toLowerCase().includes(ql) || a.business_name.toLowerCase().includes(ql));

  return (
    <>
      <PageHead title="Admin" lead="Verify GCash payments and see every account. Approving starts Pro right away, or adds the time on top if it is still active." actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>} />
      <div className="kpis">
        <div className="stat"><span className="k">Accounts</span><span className="v">{n0(accts.length)}</span></div>
        <div className="stat"><span className="k">Active Pro</span><span className="v">{n0(pro)}</span></div>
        <div className="stat"><span className="k">Testers</span><span className="v">{n0(testers)}</span></div>
        <div className="stat"><span className="k">{filter === 'pending' ? 'Waiting to verify' : 'Payments shown'}</span><span className="v">{n0(pays.length)}</span></div>
      </div>
      {err && <p className="confirm" role="alert">{err}</p>}
      <div className="seg2" role="group" aria-label="Admin sections" style={{ maxWidth: 420 }}>
        <button aria-pressed={tab === 'pay'} onClick={() => setTab('pay')}>Payments</button>
        <button aria-pressed={tab === 'acct'} onClick={() => setTab('acct')}>Accounts</button>
      </div>
      {tab === 'pay' ? (
        <section className="card" aria-label="Payments">
          <div className="chips" role="group" aria-label="Show payments">
            {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
          </div>
          {loading ? <p className="help" role="status">Loading…</p>
            : pays.length ? <div className="items">{pays.map((p) => <PayCard key={p.id} p={p} url={urls[p.proof_path] || ''} onDone={load} onZoom={setZoom} />)}</div>
              : <p className="help">{filter === 'pending' ? 'No payments waiting. Nice!' : 'Nothing here.'}</p>}
        </section>
      ) : (
        <section className="card" aria-label="Accounts">
          <input className="input search" type="search" placeholder="Search email or business…" aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead><tr><th>Account</th><th>Products</th><th>Plan</th><th>Ends</th><th>Tester</th></tr></thead>
              <tbody>
                {shownAccts.map((a) => {
                  const active = isActivePro(a);
                  const plan = a.is_tester ? 'Tester' : active ? 'Pro ' + (a.billing || '') : a.plan === 'pro' ? 'Expired' : 'Free';
                  return (
                    <tr key={a.user_id}>
                      <td><strong>{a.email}</strong><br /><span className="help">{a.business_name || '—'} · joined {fmtDay(a.signed_up, 'en')}</span></td>
                      <td>{a.products}{!active && !a.is_tester && a.products > 5 ? <span className="help"> ({a.products - 5} locked)</span> : null}</td>
                      <td><Pill tone={a.is_tester || active ? 'good' : a.plan === 'pro' ? 'bad' : 'none'}>{plan}</Pill></td>
                      <td>{a.current_period_end ? fmtDay(a.current_period_end, 'en') : '—'}</td>
                      <td><button className="btn btn-sm" onClick={() => tester(a)}>{a.is_tester ? 'Remove tester' : 'Make tester'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {zoom && (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="adm-big" role="dialog" aria-label="Receipt" onClick={() => setZoom('')}><img src={zoom} alt="Receipt full size" /></div>
      )}
    </>
  );
}
