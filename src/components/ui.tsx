'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { HELP } from '@/lib/help';
import { UNIT_LIST } from '@/lib/calc';
import { useT } from '@/store/store';

const P: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  bowl: <><path d="M3 11h18" /><path d="M4 11a8 8 0 0 0 16 0" /><path d="M9 7.5c0-1.5 1-2 1-3.5M14 7.5c0-1.5 1-2 1-3.5" /></>,
  basket: <><path d="M4 10h16l-1.5 10h-13z" /><path d="M8 10l3-6M16 10l-3-6" /><path d="M9 14v3M15 14v3" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 15h2" /></>,
  combo: <><rect x="3" y="8" width="8" height="12" rx="2" /><path d="M14 9h6l-1 11h-4z" /><path d="M17 9V4" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 14h3v3H8z" /></>,
  chart: <><path d="M3 20h18" /><path d="M5 16l4-5 4 3 6-8" /></>,
  down: <><path d="M12 4v12M6 11l6 6 6-6" /><path d="M4 20h16" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  store: <><path d="M3 9l2-5h14l2 5" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M10 20v-5h4v5" /></>,
  left: <path d="M19 12H5M11 6l-6 6 6 6" />, right: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />, x: <path d="M6 6l12 12M18 6 6 18" />, check: <path d="M5 12.5l4.5 4.5L19 7" />,
  up: <path d="M7 17 17 7M9 7h8v8" />, dn: <path d="M7 7l10 10M17 9v8H9" />,
  scooter: <><circle cx="6" cy="17" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="M8.5 17h7M14 17l-2-8h4l2 8M12 9H9" /></>,
  sheet: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" /></>,
  pdf: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  disk: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3" /><rect x="8" y="13" width="8" height="5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  auto: <><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
}

export function PageHead({ title, lead, eyebrow, actions }: { title: ReactNode; lead?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="txt">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 tabIndex={-1}>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

export function Pager({ prev, next }: { prev?: [string, string] | null; next?: [string, string] | null }) {
  return (
    <div className="pager">
      {prev ? <Link className="btn" href={prev[0]}><Icon name="left" size={18} />{prev[1]}</Link> : <span className="spacer" />}
      {next && <Link className="btn btn-primary" href={next[0]}>{next[1]}<Icon name="right" size={18} /></Link>}
    </div>
  );
}

export function ConfirmBox({ msg, yes, onYes, onNo }: { msg: ReactNode; yes: string; onYes: () => void; onNo: () => void }) {
  const L = useT();
  return (
    <div className="confirm" role="alert">
      <span>{msg}</span>
      <button className="btn btn-sm btn-danger" onClick={onYes}>{yes}</button>
      <button className="btn btn-sm" onClick={onNo}>{L('Cancel', 'Cancel')}</button>
    </div>
  );
}

export function UnitSelect({ id, value, label, onChange, className = 'input w-unit', style }: { id: string; value: string; label: string; onChange: (v: string) => void; className?: string; style?: React.CSSProperties }) {
  return (
    <select className={className} id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      {UNIT_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

export function Peso({ id, value, onChange, onBlur, label, placeholder = '0', className = 'peso' }: { id: string; value: string; onChange: (v: string) => void; onBlur?: () => void; label?: string; placeholder?: string; className?: string }) {
  return (
    <span className={className}>
      <span>₱</span>
      <input id={id} value={value} inputMode="decimal" placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
    </span>
  );
}

export function Suffix({ id, value, onChange, suffix, label, className = 'suffix', disabled, onBlur }: { id: string; value: string; onChange: (v: string) => void; suffix: string; label?: string; className?: string; disabled?: boolean; onBlur?: () => void }) {
  return (
    <span className={className}>
      <input id={id} value={value} inputMode="decimal" aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}

/** "?" button plus its explanation. Render `btn` inline where the term appears and `text` just below. */
export function useHelp(key: string) {
  const L = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = (
    <button type="button" className="qbtn" aria-expanded={open} aria-controls={id} aria-label={L('What does this mean?', 'Ano ang ibig sabihin nito?')} onClick={() => setOpen((o) => !o)}>?</button>
  );
  const h = HELP[key];
  const text = h ? <p className="qtext" id={id} hidden={!open}>{L(h[0], h[1])}</p> : null;
  return { btn, text };
}

export function Pill({ tone, children, style }: { tone?: string; children: ReactNode; style?: React.CSSProperties }) {
  return <span className="pill" data-tone={tone || undefined} style={style}>{children}</span>;
}
