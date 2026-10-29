'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Shell from '@/components/Shell';
import { afterSetup, initStore, useData, useMeta } from '@/store/store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const meta = useMeta();
  const S = useData();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => { initStore(); }, []);

  const ready = meta.phase === 'ready' && !!S;
  const needsSetup = ready && !S.onboarded;
  useEffect(() => {
    if (!ready) return;
    if (needsSetup && path !== '/welcome') router.replace('/welcome');
    if (!needsSetup && path === '/welcome') { router.replace(afterSetup.path); afterSetup.path = '/dashboard'; }
  }, [ready, needsSetup, path, router]);

  if (meta.phase === 'error') {
    return (
      <div className="auth-wrap"><div className="auth card">
        <h1>Could not load your data</h1>
        <p className="lead">Check your internet connection and try again. ({meta.error})</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
      </div></div>
    );
  }
  if (!ready || (needsSetup && path !== '/welcome') || (!needsSetup && path === '/welcome')) {
    return <div className="loading" role="status">Loading Kerdion…</div>;
  }
  return <Shell>{children}</Shell>;
}
