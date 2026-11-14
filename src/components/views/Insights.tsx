'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loggedOrders, menuMatrix, priceHike, type Quad } from '@/lib/insights';
import { int, peso, tone } from '@/lib/format';
import { PageHead, Pager, Suffix, useHelp } from '../ui';
import { useData, useT } from '@/store/store';

const QCOLOR: Record<Quad, string> = { star: 'var(--accent)', workhorse: 'var(--yolk)', puzzle: '#3B6FB6', dog: 'var(--loss)' };

export default function Insights() {
  const S = useData(); const L = useT();
  return (
    <>
      <PageHead title={L('Menu insights', 'Menu insights')}
        lead={L('See which items to push, fix or drop, and what a price hike from your supplier does to your profit.', 'Alamin kung aling items ang ipu-push, aayusin o tatanggalin, at ano ang epekto ng price hike ng supplier sa tubo mo.')} />
      <MenuMatrix />
      <PriceHike />
      <Pager prev={['/report', 'Profit report']} next={S.library.length ? ['/ingredients', L('Ingredient prices', 'Presyo ng sangkap')] : null} />
    </>
  );
}

function MenuMatrix() {
  const S = useData(); const L = useT(); const help = useHelp('matrix');
  const logged = useMemo(() => loggedOrders(S), [S]);
  const [src, setSrc] = useState<'plan' | 'actual'>('plan');
  const source = src === 'actual' && logged.daysLogged > 0 ? 'actual' : 'plan';
  const m = useMemo(() => menuMatrix(S, source), [S, source]);
  const active = m.items.filter((x) => x.orders > 0);

  const Q: Record<Quad, { title: string; what: string; todo: string }> = {
    star: { title: L('Stars', 'Stars'), what: L('Sell a lot and earn well', 'Mabenta at malaki ang tubo'), todo: L('Keep them easy to see on your menu. Keep the quality the same and avoid discounts.', 'Ilagay sa kita agad sa menu. Panatilihin ang quality at iwasan ang discount.') },
    workhorse: { title: L('Workhorses', 'Workhorses'), what: L('Sell a lot but earn little', 'Mabenta pero maliit ang tubo'), todo: L('Raise the price a little, lower the cost per serving, or pair them with a high-profit add-on.', 'Taasan nang kaunti ang presyo, babaan ang cost per serving, o i-pair sa add-on na malaki ang tubo.') },
    puzzle: { title: L('Puzzles', 'Puzzles'), what: L('Earn well but do not sell much', 'Malaki ang tubo pero kaunti ang benta'), todo: L('Promote them: put them first on the menu, let staff recommend them, or add them to a combo.', 'I-promote: ilagay sa unahan ng menu, ipa-recommend sa staff, o isama sa combo.') },
    dog: { title: L('Rethink', 'Pag-isipan'), what: L('Few orders and low profit', 'Kaunti ang benta at maliit ang tubo'), todo: L('Change the recipe or price, or remove them to keep your menu simple.', 'Baguhin ang recipe o presyo, o tanggalin para simple ang menu.') },
  };

  return (
    <section className="card" aria-labelledby="h-mx">
      <div className="card-head row" style={{ alignItems: 'flex-start' }}>
        <div><h2 id="h-mx">{L('Menu matrix', 'Menu matrix')}{help.btn}</h2>
          <p>{L('Every item placed by how much it sells and how much it earns per order.', 'Bawat item ayon sa dami ng benta at laki ng tubo per order.')}</p></div>
      </div>
      {help.text}
      {logged.daysLogged > 0 && (
        <div className="seg2" role="group" aria-label={L('Based on', 'Base sa')} style={{ maxWidth: 360, marginBottom: 14 }}>
          <button aria-pressed={source === 'plan'} onClick={() => setSrc('plan')}>{L('Sales plan', 'Sales plan')}</button>
          <button aria-pressed={source === 'actual'} onClick={() => setSrc('actual')}>{L('Last 30 days sold', 'Nabenta, 30 araw')}</button>
        </div>
      )}
      {active.length < 2 ? (
        <div className="empty">
          <strong>{L('Add orders for at least 2 items', 'Mag-add ng orders sa kahit 2 items')}</strong>
          <p>{source === 'plan' ? L('Type how many you expect to sell in the Sales plan, then come back here.', 'I-type ang inaasahang benta sa Sales plan, tapos bumalik dito.') : L('Log more days in Daily sales to use real sales.', 'Mag-log pa ng mga araw sa Daily sales para magamit ang totoong benta.')}</p>
          <Link className="btn" href="/sales">{L('Go to Sales plan', 'Pumunta sa Sales plan')}</Link>
        </div>
      ) : (
        <>
          <Scatter items={active} popLine={m.popLine} profitLine={m.profitLine} />
          <p className="help" style={{ margin: '6px 0 14px' }}>
            {L('Lines: popular means at least ', 'Linya: mabenta kung hindi bababa sa ') + int(m.popLine) + L(' orders; earning well means at least ', ' orders; malaki ang tubo kung hindi bababa sa ') + peso(m.profitLine) + L(' profit per order (your menu average).', ' tubo per order (average ng menu mo).')}
          </p>
          <div className="quads">
            {(['star', 'puzzle', 'workhorse', 'dog'] as Quad[]).map((q) => {
              const list = m.items.filter((x) => x.quad === q && (x.orders > 0 || q === 'dog')).sort((a, b) => b.profit * b.orders - a.profit * a.orders);
              return (
                <div className="quad" key={q} data-q={q}>
                  <div className="quad-head"><span className="dot" style={{ background: QCOLOR[q] }} aria-hidden="true" /><strong>{Q[q].title}</strong><span className="help">{Q[q].what}</span></div>
                  {list.length ? (
                    <ul>{list.map((x) => <li key={x.key}><span>{x.name}</span><span className="v">{int(x.orders)} · {peso(x.profit)}</span></li>)}</ul>
                  ) : <p className="help">{L('None right now.', 'Wala sa ngayon.')}</p>}
                  {list.length > 0 && <p className="todo">{Q[q].todo}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Scatter({ items, popLine, profitLine }: { items: ReturnType<typeof menuMatrix>['items']; popLine: number; profitLine: number }) {
  const L = useT();
  // Draw at the real width of the card so text stays the same size on phone and desktop.
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(340);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(380, Math.max(260, W * 0.62)));
  const pl = 30, pr = 10, pt = 26, pb = 30;
  const maxX = Math.max(popLine * 1.5, ...items.map((x) => x.orders)) * 1.12 || 1;
  const ps = items.map((x) => x.profit).concat(profitLine);
  const lo = Math.min(...ps), hi = Math.max(...ps), pad = Math.max((hi - lo) * 0.35, Math.abs(profitLine) * 0.12, 1);
  const minY = lo - pad, maxY = hi + pad;
  const X = (v: number) => pl + (v / maxX) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - (v - minY) / (maxY - minY)) * (H - pt - pb);
  const short = (t: string) => {
    if (t.length <= 22) return t;
    const [base, size] = t.split(' · ');
    if (size) { const room = Math.max(6, 21 - size.length - 3); return (base.length > room ? base.slice(0, room).trimEnd() + '…' : base) + ' · ' + size; }
    return t.slice(0, 21) + '…';
  };
  // Place labels beside their dot, nudging them apart so they do not overlap.
  const placed: { x: number; y: number; w: number; right: boolean; key: string; text: string }[] = [];
  items.slice().sort((a, b) => Y(a.profit) - Y(b.profit)).forEach((it) => {
    const text = short(it.name), w = text.length * 6.6, cx = X(it.orders), right = cx + 12 + w < W - pr;
    const x = right ? cx + 12 : cx - 12; let y = Y(it.profit) + 4;
    const hit = (p: typeof placed[number]) => Math.abs(p.y - y) < 15 && (right ? x : x - w) < (p.right ? p.x + p.w : p.x) && (p.right ? p.x : p.x - p.w) < (right ? x + w : x);
    let guard = 0; while (placed.some(hit) && guard++ < 12) y += 15;
    placed.push({ x, y, w, right, key: it.key, text });
  });
  return (
    <figure className="scatter" ref={ref} aria-label={L('Chart of items by orders and profit per order', 'Chart ng items ayon sa orders at tubo per order')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        <rect x={X(popLine)} y={pt} width={Math.max(0, W - pr - X(popLine))} height={Math.max(0, Y(profitLine) - pt)} fill="var(--accent-soft)" />
        <line x1={X(popLine)} x2={X(popLine)} y1={pt} y2={H - pb} stroke="var(--muted)" strokeDasharray="4 4" />
        <line x1={pl} x2={W - pr} y1={Y(profitLine)} y2={Y(profitLine)} stroke="var(--muted)" strokeDasharray="4 4" />
        <line x1={pl} x2={W - pr} y1={H - pb} y2={H - pb} stroke="var(--line)" />
        <line x1={pl} x2={pl} y1={pt} y2={H - pb} stroke="var(--line)" />
        <text x={W - pr} y={pt - 9} textAnchor="end" className="q">{L('Stars', 'Stars')}</text>
        <text x={pl} y={pt - 9} className="q">{L('Puzzles', 'Puzzles')}</text>
        <text x={W - pr} y={H - 8} textAnchor="end" className="q">{L('Workhorses', 'Workhorses')}</text>
        <text x={pl} y={H - 8} className="q">{L('Rethink', 'Pag-isipan')}</text>
        <text x={(pl + W - pr) / 2} y={H - 8} textAnchor="middle" className="ax">{L('More orders →', 'Mas maraming orders →')}</text>
        <text x={12} y={(pt + H - pb) / 2} textAnchor="middle" className="ax" transform={`rotate(-90 12 ${(pt + H - pb) / 2})`}>{L('More profit per order →', 'Mas malaking tubo →')}</text>
        {placed.map((p) => <text key={p.key} x={p.x} y={p.y} textAnchor={p.right ? 'start' : 'end'} className="lbl">{p.text}</text>)}
        {items.map((x) => <circle key={x.key} cx={X(x.orders)} cy={Y(x.profit)} r="7" fill={QCOLOR[x.quad]} stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
    </figure>
  );
}

function PriceHike() {
  const S = useData(); const L = useT();
  const [target, setTarget] = useState('all');
  const [pct, setPct] = useState('10');
  const p = Math.max(-90, Math.min(300, Number(pct) || 0));
  const h = useMemo(() => priceHike(S, target, p), [S, target, p]);
  const lib = S.library.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!lib.length) return null;
  const fixed = h.rows.filter((r) => !r.auto);
  return (
    <section className="card" aria-labelledby="h-hike">
      <div className="card-head"><h2 id="h-hike">{L('What if prices go up?', 'Paano kung tumaas ang presyo?')}</h2>
        <p>{L('Test a supplier price change before it happens. Nothing here changes your saved prices.', 'Subukan ang pagbabago ng presyo ng supplier bago pa ito mangyari. Walang mababago sa mga naka-save mong presyo.')}</p></div>
      <div className="hike-form">
        <div className="field">
          <label htmlFor="hike-item">{L('Which item?', 'Aling item?')}</label>
          <select id="hike-item" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">{L('All ingredients and packaging', 'Lahat ng sangkap at packaging')}</option>
            <option value="all-ing">{L('All ingredients', 'Lahat ng sangkap')}</option>
            <option value="all-pack">{L('All packaging', 'Lahat ng packaging')}</option>
            {lib.map((l) => <option key={l.id} value={l.id}>{l.name || L('Untitled', 'Walang pangalan')}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hike-pct">{L('Price change', 'Pagbabago ng presyo')}</label>
          <Suffix id="hike-pct" value={pct} suffix="%" onChange={(v) => setPct(v.replace(/[^0-9.-]/g, ''))} />
          <div className="chips-row">{[5, 10, 20, 30].map((v) => <button key={v} type="button" className="btn btn-sm" aria-pressed={p === v} onClick={() => setPct(String(v))}>+{v}%</button>)}</div>
        </div>
      </div>
      {!h.rows.length ? <p className="help">{L('No product uses this item yet.', 'Wala pang product na gumagamit ng item na ito.')}</p> : (
        <>
          <div className="hike-sum">
            <div><span>{L('Net profit per month now', 'Net profit kada buwan ngayon')}</span><strong>{peso(h.netBefore, 0)}</strong></div>
            <div><span>{L('After the price change', 'Pagkatapos ng price change')}</span><strong data-tone={tone(h.netAfter)}>{peso(h.netAfter, 0)}</strong>
              <small data-tone={h.monthlyLoss > 0 ? 'bad' : 'good'}>{h.monthlyLoss > 0 ? '−' + peso(h.monthlyLoss, 0) : '+' + peso(-h.monthlyLoss, 0)} {L('a month', 'kada buwan')}</small></div>
            {fixed.length > 0 && <div><span>{L('If you pass on the extra cost', 'Kung ipapasa mo ang dagdag na cost')}</span><strong data-tone={tone(h.netWithSuggested)}>{peso(h.netWithSuggested, 0)}</strong></div>}
          </div>
          <ul className="hike-list">
            {h.rows.map((r) => (
              <li key={r.key}>
                <div className="top"><strong>{r.name}</strong><span className="help">{int(r.orders)} {L('orders/mo', 'orders/buwan')}</span></div>
                <div className="nums">
                  <span>{L('Cost', 'Cost')} {peso(r.costBefore)} → <b>{peso(r.costAfter)}</b></span>
                  <span>{L('Profit', 'Tubo')} {peso(r.profitBefore)} → <b data-tone={tone(r.profitAfter)}>{peso(r.profitAfter)}</b></span>
                </div>
                <p className="act">{r.auto
                  ? L('Price updates by itself to ', 'Kusang magiging ') + peso(r.suggested) + L('.', ' ang presyo.')
                  : r.suggested > r.sell + 0.004
                    ? <>{L('Charge ', 'Gawing ')}<b>{peso(r.suggested)}</b>{L(' (now ', ' (ngayon ') + peso(r.sell) + L(') to keep the same profit per order.', ') para pareho ang tubo per order.')}</>
                    : L('No price change needed.', 'Walang kailangang baguhin sa presyo.')}</p>
              </li>
            ))}
          </ul>
          <p className="help" style={{ marginTop: 10 }}>{L('Products priced with “Suggest a price for me” follow their cost, so their price updates by itself. Products with your own price keep it until you change it.', 'Ang products na naka-“Suggest a price for me” ay sumusunod sa cost, kaya kusang nag-a-update ang presyo. Ang may sariling presyo ay hindi magbabago hangga’t hindi mo binabago.')}</p>
        </>
      )}
    </section>
  );
}
