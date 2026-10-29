'use client';

import Link from 'next/link';
import { dayStats, progress, totals } from '@/lib/calc';
import { int, peso, todayISO, tone } from '@/lib/format';
import { Icon, PageHead } from '../ui';
import { AlertsCard, BackupNotice, GoalBlock, SampleNotice } from '../blocks';
import { useData, useMeta, useT } from '@/store/store';

export default function Home() {
  const S = useData(); const L = useT(); const meta = useMeta();
  const t = totals(S); const pr = progress(S);
  const today = S.log[todayISO()]; const td = dayStats(S, todayISO());
  const steps: [keyof typeof pr, number, string, string, string][] = [
    ['products', 1, L('Add your products', 'I-add ang mga produkto mo'), L('Enter ingredients and packaging. Saffra computes the cost per serving and a selling price.', 'Ilagay ang sangkap at packaging. Saffra na ang magko-compute ng cost per serving at selling price.'), '/products'],
    ['expenses', 2, L('List your monthly bills', 'Ilista ang buwanang bills'), L('Rent, salaries, electricity and other bills you pay every month.', 'Renta, sweldo, kuryente at iba pang binabayaran mo kada buwan.'), '/expenses'],
    ['sales', 3, L('Plan your sales', 'I-plan ang benta mo'), L('Guess how many of each product you sell in a month.', 'Hulaan kung ilan ang mabebenta mo kada buwan.'), '/sales'],
    ['report', 4, L('See your profit', 'Tingnan ang tubo mo'), L('Profit per day, month and year, your break-even and your goal.', 'Tubo kada araw, buwan at taon, break-even at goal mo.'), '/report'],
  ];
  return (
    <>
      <SampleNotice />
      <BackupNotice local={meta.mode === 'local'} />
      <PageHead title={S.biz.name ? L('Hi, ', 'Hello, ') + S.biz.name : L('Welcome to Saffra', 'Welcome sa Saffra')} lead={L('Here is how your business is doing based on your numbers.', 'Ito ang lagay ng negosyo mo base sa numbers mo.')} />
      <div className="kpis">
        <div className="stat"><span className="k">{L('Net profit per month', 'Net profit kada buwan')}</span><span className="v" data-tone={tone(t.net)}>{peso(t.net, 0)}</span><span className="s">{L('After all costs', 'Bawas na lahat ng gastos')}</span></div>
        <div className="stat"><span className="k">{L('Profit per day', 'Tubo kada araw')}</span><span className="v" data-tone={tone(t.net)}>{peso(t.net / t.days, 0)}</span><span className="s">{L('Open ', 'Bukas ') + t.days + L(' days a month', ' araw kada buwan')}</span></div>
        <div className="stat"><span className="k">Break-even</span><span className="v">{t.avg > 0 ? String(Math.ceil(t.be / t.days)) : '—'}</span><span className="s">{L('Orders needed per day', 'Orders na kailangan kada araw')}</span></div>
        <div className="stat"><span className="k">{L('Logged today', 'Na-log ngayon')}</span><span className="v">{td.o ? int(td.o) + ' orders' : '—'}</span><span className="s"><Link href="/daily">{today ? L('Update today’s sales', 'I-update ang benta ngayon') : L('Log today’s sales', 'I-log ang benta ngayon')}</Link></span></div>
      </div>
      <GoalBlock compact />
      <AlertsCard title="Price alerts" limit={4} />
      <section className="card" aria-labelledby="h-start">
        <div className="card-head"><h2 id="h-start">{L('Get started in 4 steps', 'Magsimula sa 4 steps')}</h2><p>{L('Follow these in order. You can come back and change anything anytime.', 'Sundan in order. Pwede mong balikan at baguhin kahit kailan.')}</p></div>
        <ol className="checklist">
          {steps.map(([k, n, title, desc, href]) => {
            const done = pr[k];
            return (
              <li key={k}>
                <span className={'dot' + (done ? ' done' : '')}>{done ? <Icon name="check" size={16} /> : n}</span>
                <div><h3>{title}{done && <span className="sr"> ({L('done', 'tapos na')})</span>}</h3><p>{desc}</p></div>
                <Link className={'btn btn-sm' + (done ? '' : ' btn-primary')} href={href}>{done ? L('Review', 'Tingnan') : L('Start', 'Simulan')}</Link>
              </li>
            );
          })}
        </ol>
      </section>
      <p className="tip">{L('New here? Read the ', 'Bago ka dito? Basahin ang ')}<Link href="/guide">quick guide</Link>{L('. It takes about 2 minutes.', '. Mga 2 minutes lang.')}</p>
    </>
  );
}
