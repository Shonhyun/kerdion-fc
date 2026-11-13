'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { FREE_LOG_DAYS, FREE_PREPS, FREE_PRODUCTS, PRICE, YEARLY_SAVES, entExpired, isPro, lockedIds, productCount, type Billing } from '@/lib/plan';
import { closeUpgrade, openUpgrade, useData, useEnt, useMeta, useT, useUpgrade, type UpgradeReason } from '@/store/store';
import { Icon } from './ui';

const n0 = (v: number) => v.toLocaleString('en-US');

export function fmtDay(iso: string | null, lang: 'en' | 'tl') {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** What Pro adds, shown on the offer and the plan page. */
export function useProList(): string[] {
  const L = useT();
  return [
    L('Unlimited products', 'Unlimited na products'),
    L('Excel and PDF reports', 'Excel at PDF reports'),
    L('Delivery app prices (GrabFood, foodpanda)', 'Presyo sa delivery app (GrabFood, foodpanda)'),
    L('Price history and price alerts', 'Price history at price alerts'),
    L('Combos and upsell simulator', 'Combos at upsell simulator'),
    L('Full daily sales history', 'Buong history ng daily sales'),
    L('Competitor price check', 'Paghambing sa presyo ng iba'),
    L('Unlimited sub-recipes', 'Unlimited na sub-recipes'),
  ];
}

export function ProBadge() { return <span className="pro-badge"><Icon name="star" size={12} />Pro</span>; }

/** The two plans side by side. Yearly comes first and is marked as the best value. */
export function PlanCards({ onPick, picked }: { onPick: (b: Billing) => void; picked?: Billing }) {
  const L = useT();
  const plans: [Billing, string, string, string][] = [
    ['yearly', L('Yearly', 'Yearly'), '₱' + n0(PRICE.yearly), L('per year · save ₱', 'kada taon · tipid ₱') + n0(YEARLY_SAVES) + L(' (2 months free)', ' (2 buwang libre)')],
    ['monthly', L('Monthly', 'Monthly'), '₱' + n0(PRICE.monthly), L('per month', 'kada buwan')],
  ];
  return (
    <div className="plans" role="group" aria-label={L('Choose a plan', 'Pumili ng plan')}>
      {plans.map(([b, name, price, sub]) => (
        <button key={b} type="button" className={'plan' + (b === 'yearly' ? ' best' : '')} aria-pressed={picked ? picked === b : undefined} onClick={() => onPick(b)}>
          {b === 'yearly' && <span className="plan-flag">{L('Best value', 'Best value')}</span>}
          <span className="plan-name">Pro {name}</span>
          <span className="plan-price">{price}</span>
          <span className="plan-sub">{sub}</span>
        </button>
      ))}
    </div>
  );
}

/** The Pro offer that pops up when a free account reaches a limit. Rendered once, in the Shell. */
export function UpgradeModal() {
  const up = useUpgrade(); const L = useT(); const router = useRouter(); const list = useProList();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!up.open) return;
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => box.current?.querySelector<HTMLButtonElement>('.plan')?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeUpgrade(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [up.open]);
  if (!up.open) return null;
  const why: Record<UpgradeReason, string> = {
    products: L('The free plan includes ' + FREE_PRODUCTS + ' products. Go Pro to add more.', 'Hanggang ' + FREE_PRODUCTS + ' products lang ang free plan. Mag-Pro para makapag-add pa.'),
    preps: L('The free plan includes ' + FREE_PREPS + ' sub-recipes. Go Pro for unlimited.', 'Hanggang ' + FREE_PREPS + ' sub-recipes lang ang free plan. Mag-Pro para unlimited.'),
    export: L('Excel and PDF reports are part of Pro.', 'Kasama sa Pro ang Excel at PDF reports.'),
    delivery: L('Delivery app prices are part of Pro.', 'Kasama sa Pro ang presyo sa delivery app.'),
    alerts: L('Price history and price alerts are part of Pro.', 'Kasama sa Pro ang price history at price alerts.'),
    combos: L('Combos and the upsell simulator are part of Pro.', 'Kasama sa Pro ang combos at upsell simulator.'),
    daily: L('The free plan shows the last ' + FREE_LOG_DAYS + ' days. Go Pro for your full history.', 'Huling ' + FREE_LOG_DAYS + ' araw lang ang free plan. Mag-Pro para sa buong history.'),
    competitor: L('Comparing with a competitor’s price is part of Pro.', 'Kasama sa Pro ang paghambing sa presyo ng iba.'),
    plan: L('Get every Saffra feature for your business.', 'Makuha lahat ng features ng Saffra para sa negosyo mo.'),
  };
  const pick = (b: Billing) => { closeUpgrade(); router.push('/upgrade?plan=' + b); };
  return (
    <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) closeUpgrade(); }}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="up-title" ref={box}>
        <div className="card-head row">
          <h2 id="up-title"><Icon name="star" /> {L('Upgrade to Saffra Pro', 'Mag-upgrade sa Saffra Pro')}</h2>
          <button className="icon-btn" aria-label={L('Close', 'Isara')} onClick={closeUpgrade}><Icon name="x" size={18} /></button>
        </div>
        <p className="help" style={{ fontSize: 15, color: 'var(--ink)' }}>{why[up.reason]}</p>
        <PlanCards onPick={pick} />
        <ul className="pro-list">{list.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul>
        <p className="help">{L('Pay by QR with GCash, Maya or your bank app. We verify your payment within 24 hours, then Pro turns on. Nothing you saved is ever deleted.', 'Magbayad by QR gamit ang GCash, Maya o bank app mo. Ive-verify namin ang bayad within 24 hours, tapos mag-o-on na ang Pro. Walang mabubura sa mga na-save mo.')}</p>
      </div>
    </div>
  );
}

/** Stands in for a Pro-only section on the free plan. */
export function ProLock({ reason, title, children }: { reason: UpgradeReason; title: string; children?: ReactNode }) {
  const L = useT();
  return (
    <div className="pro-lock">
      <span className="pro-lock-ic"><Icon name="lock" size={20} /></span>
      <div className="txt"><strong>{title} <ProBadge /></strong>{children && <span className="help">{children}</span>}</div>
      <button className="btn btn-sm btn-yolk" onClick={() => openUpgrade(reason)}>{L('See Pro plans', 'Tingnan ang Pro')}</button>
    </div>
  );
}

/** Shown on Home and Products when Pro has ended or the free limit is reached. */
export function PlanNotice() {
  const S = useData(); const L = useT(); const ent = useEnt(); const meta = useMeta();
  if (meta.mode !== 'cloud' || isPro()) return null;
  const locked = lockedIds(S).size;
  if (entExpired(ent)) {
    return (
      <div className="notice">
        <div className="txt"><strong>{L('Your Pro plan ended on ', 'Natapos ang Pro plan mo noong ') + fmtDay(ent.periodEnd, S.lang) + '.'}</strong> {locked
          ? L('Your first ' + FREE_PRODUCTS + ' products still work. The other ' + locked + ' are locked, not deleted, and come back as soon as you renew.', 'Gumagana pa rin ang unang ' + FREE_PRODUCTS + ' products mo. Naka-lock ang ' + locked + ' pa, hindi nabura, at babalik agad pag nag-renew ka.')
          : L('Renew to use Pro features again.', 'Mag-renew para magamit ulit ang Pro features.')}</div>
        <div className="acts"><Link className="btn btn-sm btn-primary" href="/upgrade">{L('Renew Pro', 'Mag-renew ng Pro')}</Link></div>
      </div>
    );
  }
  if (!locked) return null;
  return (
    <div className="notice">
      <div className="txt"><strong>{locked + L(' products are locked.', ' products ang naka-lock.')}</strong> {L('The free plan includes ' + FREE_PRODUCTS + ' products. Go Pro to unlock them.', 'Hanggang ' + FREE_PRODUCTS + ' products lang ang free plan. Mag-Pro para ma-unlock sila.')}</div>
      <div className="acts"><Link className="btn btn-sm btn-primary" href="/upgrade">{L('See Pro plans', 'Tingnan ang Pro')}</Link></div>
    </div>
  );
}

/** "3 of 5 free products used", on the Products page. */
export function ProductMeter() {
  const S = useData(); const L = useT(); const meta = useMeta();
  if (meta.mode !== 'cloud' || isPro()) return null;
  const n = Math.min(productCount(S), FREE_PRODUCTS);
  return (
    <div className="meter">
      <span>{L('Free plan: ', 'Free plan: ')}<strong>{n + L(' of ', ' sa ') + FREE_PRODUCTS}</strong>{L(' products used', ' products ang nagamit')}</span>
      <span className="meter-track" aria-hidden="true"><span style={{ width: (n / FREE_PRODUCTS * 100) + '%' }} /></span>
      <button className="btn btn-sm" onClick={() => openUpgrade('products')}>{L('Unlimited with Pro', 'Unlimited sa Pro')}</button>
    </div>
  );
}
