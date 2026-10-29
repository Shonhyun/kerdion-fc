'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { progress } from '@/lib/calc';
import { Icon } from './ui';
import { signOut, undoLast, update, useData, useMeta, useT, useToast } from '@/store/store';
import { LogoMark } from '@/components/Logo';

type Theme = 'light' | 'dark' | 'auto';
function readTheme(): Theme { try { const t = localStorage.getItem('kerdion-theme'); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; } }
function applyTheme(t: Theme) {
  try { localStorage.setItem('kerdion-theme', t); } catch { /* ignore */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-kd-theme'); else document.documentElement.setAttribute('data-kd-theme', t);
}

function SyncLabel() {
  const meta = useMeta(); const L = useT();
  if (meta.mode === 'local') return null;
  const txt = { saved: L('Saved', 'Naka-save'), saving: L('Saving…', 'Sine-save…'), offline: L('Offline, will save later', 'Offline, ise-save mamaya'), error: L('Not saved yet, retrying', 'Hindi pa naka-save, inuulit'), conflict: L('Updated', 'Na-update') }[meta.save];
  return <span className="sync" data-state={meta.save} role="status">{txt}</span>;
}

export default function Shell({ children }: { children: ReactNode }) {
  const S = useData(); const meta = useMeta(); const L = useT(); const path = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('auto');
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const firstPath = useRef(path);

  useEffect(() => { setTheme(readTheme()); }, []);
  useEffect(() => { document.documentElement.lang = S.lang === 'tl' ? 'fil' : 'en'; }, [S.lang]);
  useEffect(() => {
    setOpen(false);
    if (firstPath.current === path) return;
    window.scrollTo(0, 0);
    const h1 = document.querySelector('main h1') as HTMLElement | null;
    if (h1) h1.focus({ preventScroll: true });
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    setTimeout(() => closeBtn.current?.focus(), 30);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pr = progress(S);
  const cur = path.startsWith('/products') ? '/products' : path;
  type Item = { group?: string; href?: string; label?: string; hint?: string; icon?: string; step?: number; key?: 'products' | 'expenses' | 'sales' | 'report'; badge?: number };
  const items: Item[] = [
    { group: 'Overview' },
    { href: '/dashboard', label: 'Home', hint: L('Your summary', 'Buod ng negosyo'), icon: 'home', badge: S.alerts.length },
    { group: L('Set up in 4 steps', 'Set up sa 4 steps') },
    { href: '/products', label: L('Products', 'Mga produkto'), hint: L('Cost and price', 'Gastos at presyo'), icon: 'bowl', step: 1, key: 'products' },
    { href: '/expenses', label: L('Expenses', 'Mga bayarin'), hint: L('Monthly bills', 'Buwanang bills'), icon: 'wallet', step: 2, key: 'expenses' },
    { href: '/sales', label: 'Sales plan', hint: L('Orders per month', 'Orders kada buwan'), icon: 'receipt', step: 3, key: 'sales' },
    { href: '/report', label: 'Profit report', hint: L('Your results and goal', 'Resulta at goal mo'), icon: 'chart', step: 4, key: 'report' },
    { group: 'Tools' },
    { href: '/ingredients', label: L('Ingredient prices', 'Presyo ng sangkap'), hint: L('Update once, used everywhere', 'Isang update, updated lahat'), icon: 'basket' },
    { href: '/daily', label: L('Daily sales', 'Benta araw-araw'), hint: L('Log what you sold', 'I-log ang nabenta'), icon: 'cal' },
    { href: '/combos', label: L('Combos & upsell', 'Combos at upsell'), hint: L('Meal deals, add-ons', 'Meal deals, add-ons'), icon: 'combo' },
    { href: '/export', label: L('Export & backup', 'Export at backup'), hint: 'Excel, PDF, backup', icon: 'down' },
    { group: L('Help', 'Tulong') },
    { href: '/guide', label: L('How to use', 'Paano gamitin'), hint: L('Quick guide', 'Mabilis na guide'), icon: 'book' },
    { href: '/business', label: 'Business info', hint: L('Name, tax, delivery, rounding', 'Pangalan, tax, delivery, rounding'), icon: 'store' },
  ];
  const themes: [Theme, string, string][] = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['auto', 'auto', 'Auto']];

  return (
    <div className={'app' + (open ? ' nav-open' : '')}>
      <header className="mtop">
        <Link className="brand" href="/dashboard"><LogoMark /><span className="brand-name">Saffra</span></Link>
        <div className="mtop-right">
          <SyncLabel />
          <button ref={menuBtn} className="menu-btn" aria-expanded={open} aria-controls="side" onClick={() => setOpen(true)}><Icon name="menu" />Menu</button>
        </div>
      </header>
      <div className="scrim" onClick={() => { setOpen(false); menuBtn.current?.focus(); }} />
      <aside className="side" id="side" aria-label="Main menu">
        <div className="side-head">
          <Link className="brand" href="/dashboard"><LogoMark /><span><span className="brand-name">Saffra</span><span className="brand-sub">{L('Food costing and profit', 'Food costing at tubo')}</span></span></Link>
          <button ref={closeBtn} className="close-btn" aria-label={L('Close menu', 'Isara ang menu')} onClick={() => { setOpen(false); menuBtn.current?.focus(); }}><Icon name="x" /></button>
        </div>
        <nav className="nav" aria-label="Pages">
          {items.map((n, i) => {
            if (n.group) return <div key={i} className="nav-label">{n.group}</div>;
            const done = !!(n.step && n.key && pr[n.key]);
            return (
              <Link key={n.href} href={n.href!} aria-current={cur === n.href ? 'page' : undefined}>
                <span className="nav-ic"><Icon name={n.icon!} /></span>
                <span className="nav-txt">{n.label}<span className="nav-hint">{n.hint}</span></span>
                {n.step ? <><span className={'step' + (done ? ' done' : '')} aria-hidden="true">{done ? <Icon name="check" size={13} /> : n.step}</span><span className="sr">, step {n.step}{done ? L(', done', ', tapos na') : ''}</span></>
                  : n.badge ? <><span className="count" aria-hidden="true">{n.badge}</span><span className="sr">, {n.badge} price alerts</span></> : null}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <div>
            <div className="nav-label" style={{ padding: '0 2px 6px' }} id="theme-lbl">{L('Appearance', 'Itsura')}</div>
            <div className="seg3" role="group" aria-labelledby="theme-lbl">
              {themes.map(([v, ic, label]) => (
                <button key={v} aria-pressed={theme === v} onClick={() => { setTheme(v); applyTheme(v); }}><Icon name={ic} size={15} />{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="nav-label" style={{ padding: '0 2px 6px' }} id="lang-lbl">{L('Language', 'Wika')}</div>
            <div className="seg2" role="group" aria-labelledby="lang-lbl">
              <button aria-pressed={S.lang !== 'tl'} onClick={() => update((d) => { d.lang = 'en'; })}>English</button>
              <button aria-pressed={S.lang === 'tl'} onClick={() => update((d) => { d.lang = 'tl'; })}>Taglish</button>
            </div>
          </div>
          {meta.mode === 'cloud' ? (
            <div className="acct">
              <span className="help">{L('Signed in as', 'Naka-sign in bilang')}</span>
              <span className="email">{meta.email}</span>
              <SyncLabel />
              <button className="btn btn-sm" onClick={() => signOut()}><Icon name="logout" size={16} />{L('Sign out', 'Mag-sign out')}</button>
            </div>
          ) : (
            <div className="save-note"><strong>{L('Saved on this device', 'Naka-save sa device na ito')}</strong>{L('Local mode: connect Supabase to turn on accounts and cloud saving.', 'Local mode: i-connect ang Supabase para sa accounts at cloud saving.')}</div>
          )}
        </div>
      </aside>
      <main className="main"><div className="main-inner">{children}</div></main>
      <Toast />
    </div>
  );
}

function Toast() {
  const t = useToast(); const L = useT();
  return (
    <div className={'toast' + (t.show ? ' show' : '') + (t.undo ? ' act' : '')} role="status" aria-live="polite">
      {t.undo ? <><span>{t.msg}</span><button className="undo" onClick={undoLast}>{L('Undo', 'Undo')}</button></> : t.msg}
    </div>
  );
}
