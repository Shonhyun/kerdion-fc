'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured, siteUrl } from '@/lib/supabase/config';
import { LogoMark } from '@/components/Logo';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

function Brand() {
  return (
    <div className="brand" style={{ gap: 12 }}>
      <LogoMark size={48} />
      <span><span className="brand-name" style={{ fontSize: 30 }}>Saffra</span><span className="brand-sub">Know your real cost and profit</span></span>
    </div>
  );
}

function Password({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pwd">
      <input className="input" id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

/** Turns Supabase's messages into plain words for business owners. */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match. Check them and try again, or reset your password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Open the link we sent to your inbox, then sign in.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Sign in instead, or reset your password.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a minute and try again.';
  if (m.includes('password')) return msg;
  if (m.includes('fetch') || m.includes('network')) return 'Could not reach the server. Check your internet connection and try again.';
  return msg;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter(); const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get('error') === 'link' ? 'That link has expired or was already used. Please try again.' : '');
  const [ok, setOk] = useState('');

  if (!isSupabaseConfigured) {
    return (
      <div className="auth"><Brand />
        <section className="card">
          <h1>Accounts are not set up yet</h1>
          <p className="lead">Supabase is not connected, so Saffra is running in local mode. Your data is saved in this browser only.</p>
          <Link className="btn btn-primary btn-block" href="/dashboard">Continue in local mode</Link>
        </section>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase(); if (!sb) return;
    setBusy(true); setErr(''); setOk('');
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard'); router.refresh();
      } else if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(), password,
          options: { data: { business_name: business.trim() }, emailRedirectTo: siteUrl() + '/auth/callback?next=/dashboard' },
        });
        if (error) throw error;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setOk('Almost done! We sent a confirmation link to ' + email.trim() + '. Open it to finish creating your account.');
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl() + '/auth/callback?next=/reset-password' });
        if (error) throw error;
        setOk('If an account exists for ' + email.trim() + ', we sent a link to reset your password. Check your inbox and spam folder.');
      } else {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setOk('Your password was changed. Taking you to your dashboard…');
        setTimeout(() => { router.replace('/dashboard'); router.refresh(); }, 1200);
      }
    } catch (e2) {
      setErr(friendly((e2 as Error).message || 'Something went wrong. Please try again.'));
    }
    setBusy(false);
  };

  const titles: Record<Mode, [string, string]> = {
    login: ['Sign in', 'Welcome back. Sign in to see your costs and profit.'],
    signup: ['Create your account', 'Free while in beta. Your data is saved to your account, so it is safe even if you clear your browser or change phones.'],
    forgot: ['Reset your password', 'Enter your email and we will send you a link to set a new password.'],
    reset: ['Set a new password', 'Choose a password with at least 8 characters.'],
  };
  let links: ReactNode = null;
  if (mode === 'login') links = <><Link href="/signup">Create an account</Link><Link href="/forgot-password">Forgot password?</Link></>;
  if (mode === 'signup') links = <span>Already have an account? <Link href="/login">Sign in</Link></span>;
  if (mode === 'forgot') links = <Link href="/login">Back to sign in</Link>;

  return (
    <div className="auth"><Brand />
      <section className="card">
        <div className="card-head"><h1>{titles[mode][0]}</h1><p>{titles[mode][1]}</p></div>
        {err && <p className="msg err" role="alert">{err}</p>}
        {ok && <p className="msg ok" role="status">{ok}</p>}
        {!(ok && (mode === 'signup' || mode === 'forgot')) && (
          <form onSubmit={submit} noValidate={false}>
            {mode === 'signup' && (
              <div className="field"><label htmlFor="business">Business name</label>
                <input className="input" id="business" value={business} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" placeholder="e.g. Wins Coffee" required maxLength={120} /></div>
            )}
            {mode !== 'reset' && (
              <div className="field"><label htmlFor="email">Email</label>
                <input className="input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required /></div>
            )}
            {mode !== 'forgot' && (
              <div className="field"><label htmlFor="password">{mode === 'reset' ? 'New password' : 'Password'}</label>
                <Password id="password" value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                {mode !== 'login' && <span className="help">At least 8 characters.</span>}</div>
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}
            </button>
          </form>
        )}
        {links && <div className="links">{links}</div>}
      </section>
    </div>
  );
}
