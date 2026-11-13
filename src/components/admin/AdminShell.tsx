'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { LogoMark } from '@/components/Logo';
import { Icon } from '@/components/ui';
import { loadPayments } from './data';

interface AdminCtx { email: string; pending: number; refreshPending: () => void }
const Ctx = createContext<AdminCtx>({ email: '', pending: 0, refreshPending: () => {} });
export const useAdmin = () => useContext(Ctx);

type Gate = 'loading' | 'ok' | 'denied';

/** The admin panel's own frame: its own menu, and only for accounts in the admins table. */
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const [gate, setGate] = useState<Gate>('loading');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  const refreshPending = useCallback(() => {
    loadPayments('pending', 500).then((p) => setPending(p.length)).catch(() => {});
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setGate('denied'); return; }
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      setEmail(auth.user.email || '');
      const { data, error } = await sb.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
      if (error || !data) { setGate('denied'); return; }
      setGate('ok'); refreshPending();
    })();
  }, [router, refreshPending]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const signOut = async () => { await getSupabase()?.auth.signOut(); window.location.href = '/login'; };

  if (gate === 'loading') return <div className="loading" role="status">Loading admin…</div>;
  if (gate === 'denied') {
    return (
      <div className="auth-wrap"><div className="auth card">
        <h1>Admins only</h1>
        <p className="lead">This account cannot open the admin panel.</p>
        <Link className="btn btn-primary" href="/dashboard">Go to Saffra</Link>
      </div></div>
    );
  }

  const items: [string, string, string, string, number?][] = [
    ['/admin', 'Overview', 'Sales, plans and what needs you', 'chart'],
    ['/admin/payments', 'Payments', 'Verify receipts', 'receipt', pending],
    ['/admin/accounts', 'Subscribers', 'Every account and its plan', 'store'],
  ];
  return (
    <Ctx.Provider value={{ email, pending, refreshPending }}>
      <div className={'app admin-app' + (open ? ' nav-open' : '')}>
        <header className="mtop">
          <Link className="brand" href="/admin"><LogoMark /><span className="brand-name">Saffra</span><span className="adm-tag">Admin</span></Link>
          <div className="mtop-right">
            <button ref={menuBtn} className="menu-btn" aria-expanded={open} aria-controls="aside" onClick={() => setOpen(true)}><Icon name="menu" />Menu</button>
          </div>
        </header>
        <div className="scrim" onClick={() => setOpen(false)} />
        <aside className="side" id="aside" aria-label="Admin menu">
          <div className="side-head">
            <Link className="brand" href="/admin"><LogoMark /><span><span className="brand-name">Saffra</span><span className="brand-sub">Admin panel</span></span></Link>
            <button className="close-btn" aria-label="Close menu" onClick={() => { setOpen(false); menuBtn.current?.focus(); }}><Icon name="x" /></button>
          </div>
          <nav className="nav" aria-label="Admin pages">
            <div className="nav-label">Admin</div>
            {items.map(([href, label, hint, icon, badge]) => (
              <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
                <span className="nav-ic"><Icon name={icon} /></span>
                <span className="nav-txt">{label}<span className="nav-hint">{hint}</span></span>
                {badge ? <><span className="count" aria-hidden="true">{badge}</span><span className="sr">, {badge} waiting</span></> : null}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <Link className="btn btn-sm" href="/dashboard"><Icon name="right" size={16} />Open the Saffra app</Link>
            <div className="acct">
              <span className="help">Admin</span>
              <span className="email">{email}</span>
              <button className="btn btn-sm" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
            </div>
          </div>
        </aside>
        <main className="main"><div className="main-inner">{children}</div></main>
      </div>
    </Ctx.Provider>
  );
}
