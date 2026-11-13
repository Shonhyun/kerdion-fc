'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, PageHead, Pill } from '@/components/ui';
import { useAdmin } from './AdminShell';
import { STATUS_LABEL, STATUS_TONE, acctStatus, ago, daysLeft, fmtDay, loadAccounts, loadPayments, n0, peso0, type Acct, type Pay } from './data';

export default function Overview() {
  const { pending } = useAdmin();
  const [accts, setAccts] = useState<Acct[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const [a, p] = await Promise.all([loadAccounts(), loadPayments('all', 1000)]); setAccts(a); setPays(p); }
    catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const weekAgo = Date.now() - 7 * 86400000;
  const approved = pays.filter((p) => p.status === 'approved');
  const revMonth = approved.filter((p) => p.reviewed_at && new Date(p.reviewed_at).getTime() >= monthStart).reduce((a, p) => a + p.amount, 0);
  const revAll = approved.reduce((a, p) => a + p.amount, 0);
  const pro = accts.filter((a) => acctStatus(a) === 'pro');
  const monthly = pro.filter((a) => a.billing !== 'yearly').length, yearly = pro.length - monthly;
  const testers = accts.filter((a) => a.is_tester).length;
  const expired = accts.filter((a) => acctStatus(a) === 'expired').length;
  const newWeek = accts.filter((a) => new Date(a.signed_up).getTime() >= weekAgo).length;
  // Steady monthly income from active plans: yearly plans spread over 12 months.
  const mrr = monthly * 299 + Math.round(yearly * 2990 / 12);
  const expiring = pro.filter((a) => daysLeft(a.current_period_end) <= 7).sort((x, y) => daysLeft(x.current_period_end) - daysLeft(y.current_period_end));
  const recentPays = pays.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const recentAccts = accts.slice(0, 6);

  return (
    <>
      <PageHead title="Overview" lead={'Today is ' + now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }) + '.'}
        actions={<button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>} />
      {err && <p className="confirm" role="alert">{err}</p>}

      {pending > 0 && (
        <div className="notice">
          <div className="txt"><strong>{pending} {pending === 1 ? 'payment is' : 'payments are'} waiting for you.</strong> Users were told they will be verified within 24 hours.</div>
          <div className="acts"><Link className="btn btn-sm btn-primary" href="/admin/payments">Verify now</Link></div>
        </div>
      )}

      <div className="kpis">
        <div className="stat"><span className="k">Sales this month</span><span className="v">{peso0(revMonth)}</span><span className="s">{peso0(revAll)} all time</span></div>
        <div className="stat"><span className="k">Monthly income from plans</span><span className="v">{peso0(mrr)}</span><span className="s">Yearly plans spread over 12 months</span></div>
        <div className="stat"><span className="k">Active Pro</span><span className="v">{n0(pro.length)}</span><span className="s">{monthly} monthly · {yearly} yearly</span></div>
        <div className="stat"><span className="k">Accounts</span><span className="v">{n0(accts.length)}</span><span className="s">+{newWeek} this week · {testers} testers · {expired} expired</span></div>
      </div>

      <div className="two">
        <section className="card" aria-labelledby="h-exp">
          <div className="card-head"><h2 id="h-exp">Ending within 7 days</h2><p>Remind them to renew so their products stay unlocked.</p></div>
          {expiring.length ? (
            <ul className="adm-list">{expiring.map((a) => {
              const d = daysLeft(a.current_period_end);
              return <li key={a.user_id}><div><strong>{a.email}</strong><span className="help">{a.business_name || '—'} · Pro {a.billing}</span></div><Pill tone={d <= 2 ? 'bad' : 'warn'}>{d <= 0 ? 'today' : d === 1 ? '1 day' : d + ' days'}</Pill></li>;
            })}</ul>
          ) : <p className="help">{loading ? 'Loading…' : 'No plans ending this week.'}</p>}
        </section>
        <section className="card" aria-labelledby="h-rp">
          <div className="card-head row"><h2 id="h-rp">Latest payments</h2><Link className="btn btn-sm" href="/admin/payments">See all</Link></div>
          {recentPays.length ? (
            <ul className="adm-list">{recentPays.map((p) => (
              <li key={p.id}><div><strong>{p.email || '—'}</strong><span className="help">{peso0(p.amount)} · {p.billing} · {ago(p.created_at)}</span></div>
                <Pill tone={p.status === 'approved' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}>{p.status}</Pill></li>
            ))}</ul>
          ) : <p className="help">{loading ? 'Loading…' : 'No payments yet.'}</p>}
        </section>
      </div>

      <section className="card" aria-labelledby="h-new">
        <div className="card-head row"><h2 id="h-new">Newest accounts</h2><Link className="btn btn-sm" href="/admin/accounts">See all <Icon name="right" size={16} /></Link></div>
        {recentAccts.length ? (
          <ul className="adm-list">{recentAccts.map((a) => { const s = acctStatus(a); return (
            <li key={a.user_id}><div><strong>{a.email}</strong><span className="help">{a.business_name || '—'} · {a.products} products · joined {fmtDay(a.signed_up)}</span></div><Pill tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Pill></li>
          ); })}</ul>
        ) : <p className="help">{loading ? 'Loading…' : 'No accounts yet.'}</p>}
      </section>
    </>
  );
}
