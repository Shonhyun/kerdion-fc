'use client';

import Link from 'next/link';
import { totals } from '@/lib/calc';
import { int, peso, tone } from '@/lib/format';
import { Icon, PageHead, Pager, useHelp } from '../ui';
import { GoalBlock } from '../blocks';
import { useData, useT } from '@/store/store';

export default function Report() {
  const S = useData(); const L = useT(); const t = totals(S); const hBe = useHelp('be');
  const maxG = Math.max(1, ...t.rows.map((x) => Math.abs(x.gross)));
  const sc = [0.5, 0.75, 1, 1.25, 1.5].map((f) => ({ f, o: Math.round(t.orders * f), net: t.gross * f - t.fixed }));
  const maxN = Math.max(1, ...sc.map((s) => Math.abs(s.net)));
  const periods: [string, number][] = [[L('Per day', 'Kada araw'), t.net / t.days], [L('Per week', 'Kada linggo'), t.net * 12 / 52], [L('Per month', 'Kada buwan'), t.net], [L('In 3 months', 'Sa 3 buwan'), t.net * 3], [L('In 1 year', 'Sa 1 taon'), t.net * 12]];
  return (
    <>
      <PageHead title="Profit report" eyebrow="Step 4 of 4" lead={L('Your estimated profit based on your products, expenses and sales plan. Update your numbers as you learn more.', 'Estimated na tubo base sa products, bayarin at sales plan mo. I-update habang may bago kang nalalaman.')}
        actions={<Link className="btn" href="/export"><Icon name="down" size={18} />Export</Link>} />
      <div className="net-hero" data-tone={tone(t.net)}>
        <span className="k">{L('Net profit per month', 'Net profit kada buwan')}</span>
        <span className="big">{peso(t.net, 0)}</span>
        <span className="msg">{t.orders === 0 ? L('Add your orders in the Sales plan to see your profit.', 'Ilagay ang orders sa Sales plan para makita ang tubo.') : t.net >= 0 ? L('You make money. Nice work!', 'Kumikita ka. Ayos!') : L('You are losing money. Try selling more, raising prices, adding a drink or cutting a bill.', 'Lugi ka. Subukang magbenta ng mas marami, taasan ang presyo, mag-upsell ng drinks, o bawasan ang bills.')}</span>
      </div>
      <GoalBlock compact={false} />
      <div className="two">
        <section className="card" aria-labelledby="h-where">
          <div className="card-head"><h2 id="h-where">{L('Where your money goes', 'Saan napupunta ang pera')}</h2><p>{L('Per month, from ', 'Kada buwan, mula sa ') + int(t.orders) + ' orders.'}</p></div>
          <div className="rows">
            <div><span>{L('Total sales', 'Total benta')}</span><span className="v">{peso(t.rev, 0)}</span></div>
            <div><span>{L('Ingredients and packaging', 'Sangkap at packaging')}</span><span className="v" data-tone="bad">−{peso(t.cogs, 0)}</span></div>
            {S.biz.taxOn && <div><span>{L('Tax to pay', 'Tax na babayaran')}</span><span className="v" data-tone="bad">−{peso(t.tax, 0)}</span></div>}
            <div><span><strong>{L('Profit before bills', 'Tubo bago bills')}</strong></span><span className="v">{peso(t.gross, 0)}</span></div>
            <div><span>{L('Monthly bills', 'Buwanang bills')}</span><span className="v" data-tone="bad">−{peso(t.fixed, 0)}</span></div>
            <div><span><strong>Net profit</strong></span><span className="v" data-tone={tone(t.net)}><strong>{peso(t.net, 0)}</strong></span></div>
          </div>
        </section>
        <section className="card" aria-labelledby="h-time">
          <div className="card-head"><h2 id="h-time">{L('Over time', 'Sa paglipas ng panahon')}</h2><p>{L('If you keep the same sales every month.', 'Kung pareho ang benta kada buwan.')}</p></div>
          <div className="rows">{periods.map(([k, v]) => <div key={k}><span>{k}</span><span className="v" data-tone={tone(v)}>{peso(v, 0)}</span></div>)}</div>
        </section>
      </div>
      <div className="be">
        <span>{L('Break-even point', 'Break-even point')}{hBe.btn}</span>
        {t.avg > 0 ? <>
          <strong>{int(t.be) + L(' orders a month (about ', ' orders kada buwan (mga ') + Math.ceil(t.be / t.days) + L(' a day)', ' kada araw)')}</strong>
          <span>{t.orders >= t.be ? L('Your plan is ', 'Lampas ka ng ') + int(t.orders - t.be) + L(' orders above it.', ' orders dito.') : L('You need ', 'Kailangan mo pa ng ') + int(t.be - t.orders) + L(' more orders a month to stop losing money.', ' orders kada buwan para hindi malugi.')}</span>
        </> : <>
          <strong>{L('Not reachable yet', 'Hindi pa maaabot')}</strong>
          <span>{L('Your products do not make a profit per order. Check your prices.', 'Walang tubo per order ang products mo. I-check ang presyo.')}</span>
        </>}
        {hBe.text}
      </div>
      {t.rows.length > 0 && (
        <section className="card" aria-labelledby="h-byp">
          <div className="card-head"><h2 id="h-byp">{L('Profit by product', 'Tubo kada produkto')}</h2><p>{L('Which items bring in the most profit before bills.', 'Alin ang may pinakamalaking tubo bago bills.')}</p></div>
          <div className="bars">
            {t.rows.slice().sort((a, b) => b.gross - a.gross).map((x) => (
              <div className="bar-row" key={x.key}>
                <span className="name">{x.name}<small>{int(x.o)} orders{x.kind === 'c' ? ' · combo' : x.kind === 'a' ? ' · add-on' : ''}</small></span>
                <span className="track" aria-hidden="true"><span className={'fill cur' + (x.gross < 0 ? ' neg' : '')} style={{ width: Math.round(Math.abs(x.gross) / maxG * 100) + '%' }} /></span>
                <span className="val" data-tone={tone(x.gross)}>{peso(x.gross, 0)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {t.orders > 0 && (
        <section className="card" aria-labelledby="h-whatif">
          <div className="card-head"><h2 id="h-whatif">{L('What if you sell more or less?', 'Paano kung mas marami o mas konti ang benta?')}</h2><p>{L('Net profit per month at different sales levels.', 'Net profit kada buwan sa iba’t ibang dami ng benta.')}</p></div>
          <div className="bars">
            {sc.map((s) => {
              const cur = s.f === 1;
              return (
                <div className="bar-row" key={s.f}>
                  <span className="name">{int(s.o)} orders{cur && <small className="cur">{L('your plan', 'plan mo')}</small>}</span>
                  <span className="track" aria-hidden="true"><span className={'fill' + (cur ? ' cur' : '') + (s.net < 0 ? ' neg' : '')} style={{ width: Math.round(Math.abs(s.net) / maxN * 100) + '%' }} /></span>
                  <span className="val" data-tone={tone(s.net)}>{peso(s.net, 0)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <Pager prev={['/sales', 'Sales plan']} next={['/dashboard', L('Back to Home', 'Balik sa Home')]} />
    </>
  );
}
