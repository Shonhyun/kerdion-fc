import type { Lang } from './types';

export type Translate = (en: string, tl?: string) => string;
export function makeL(lang: Lang): Translate {
  return (en, tl) => (lang === 'tl' && tl != null ? tl : en);
}

export function num(v: unknown): number {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

export function peso(n: number, dp = 2): string {
  const s = '₱' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return n < -0.004 ? '−' + s : s;
}
export function pct(n: number): string { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }
export function int(n: number): string { return Math.round(n).toLocaleString('en-US'); }
export function tone(n: number): 'good' | 'bad' { return n >= 0 ? 'good' : 'bad'; }

function pad(n: number) { return (n < 10 ? '0' : '') + n; }
export function iso(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function todayISO(): string { return iso(new Date()); }
export function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
export function fmtDate(d: string, lang: Lang): string {
  try {
    const p = d.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return d; }
}

let seq = 0;
export function nid(p: string): string { seq += 1; return p + Date.now().toString(36) + seq + Math.random().toString(36).slice(2, 5); }

export function focusSoon(id: string, select = true) {
  setTimeout(() => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.focus({ preventScroll: false });
    if (select && el.tagName === 'INPUT' && el.type !== 'search' && typeof el.select === 'function') el.select();
  }, 40);
}
