'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHead, Pill } from '@/components/ui';
import { STATUS_LABEL, STATUS_TONE, acctStatus, ago, daysLeft, fmtDay, loadAccounts, setTester, type Acct, type AcctStatus } from './data';

type Filter = 'all' | AcctStatus;

export default function Accounts() {
  const [accts, setAccts] = useState<Acct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setAccts(await loadAccounts()); } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (a: Acct) => {
    setBusy(a.user_id); setErr('');
    try { await setTester(a.user_id, !a.is_tester); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };
  const count = (f: Filter) => f === 'all' ? accts.length : accts.filter((a) => acctStatus(a) === f).length;
  const ql = q.trim().toLowerCase();
  const shown = accts.filter((a) => (filter === 'all' || acctStatus(a) === filter) && (!ql || a.email.toLowerCase().includes(ql) || a.business_name.toLowerCase().includes(ql)));
  const filters: [Filter, string][] = [['all', 'All'], ['pro', 'Pro'], ['tester', 'Testers'], ['expired', 'Expired'], ['free', 'Free']];

  return (
    <>
      <PageHead title="Subscribers" lead="Every account, its plan and when it ends. Tap an account to see what they have set up. Testers get full access for free until you turn it off."
        actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>} />
      <div className="chips" role="group" aria-label="Show accounts">
        {filters.map(([f, label]) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} ({count(f)})</button>)}
      </div>
      <input className="input search" type="search" placeholder="Search email or business…" aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="confirm" role="alert">{err}</p>}
      <section className="card" aria-label="Accounts">
        {loading ? <p className="help" role="status">Loading…</p> : shown.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead><tr><th>Account</th><th>Plan</th><th>Ends</th><th>Products</th><th>Last active</th><th>Tester</th></tr></thead>
              <tbody>
                {shown.map((a) => {
                  const s = acctStatus(a); const d = daysLeft(a.current_period_end);
                  return (
                    <tr key={a.user_id}>
                      <td><Link href={'/admin/accounts/' + a.user_id}><strong>{a.email}</strong></Link><br /><span className="help">{a.business_name || '—'} · joined {fmtDay(a.signed_up)}</span></td>
                      <td><Pill tone={STATUS_TONE[s]}>{STATUS_LABEL[s] + (s === 'pro' && a.billing ? ' · ' + a.billing : '')}</Pill></td>
                      <td>{a.current_period_end ? <>{fmtDay(a.current_period_end)}{s === 'pro' && <><br /><span className="help">{d} days left</span></>}</> : '—'}</td>
                      <td>{a.products}{(s === 'free' || s === 'expired') && a.products > 5 ? <><br /><span className="help">{a.products - 5} locked</span></> : null}</td>
                      <td>{a.last_active ? <>{ago(a.last_active)}<br /><span className="help">{fmtDay(a.last_active)}</span></> : <span className="help">Not set up</span>}</td>
                      <td><button className="btn btn-sm" disabled={busy === a.user_id} onClick={() => toggle(a)}>{busy === a.user_id ? 'Saving…' : a.is_tester ? 'Remove tester' : 'Make tester'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="help">No accounts match.</p>}
      </section>
    </>
  );
}
