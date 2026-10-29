'use client';

import Link from 'next/link';
import { HELP } from '@/lib/help';
import { Icon, PageHead, Pager } from '../ui';
import { useMeta, useT } from '@/store/store';

export default function Guide() {
  const L = useT(); const meta = useMeta();
  const steps: [string, string, string, string, string][] = [
    ['/products', '1', L('Add your products', 'I-add ang products'), L('List the ingredients and packaging of each item. Add sizes for drinks, and add-ons like an extra shot.', 'Ilista ang sangkap at packaging ng bawat item. Mag-add ng sizes para sa drinks, at add-ons gaya ng extra shot.'), 'Products'],
    ['/expenses', '2', L('Add monthly bills', 'I-add ang bills'), L('Rent, salaries, electricity and LPG. Tap the quick-add buttons to go faster.', 'Renta, sweldo, kuryente at LPG. I-tap ang quick-add para mabilis.'), 'Expenses'],
    ['/sales', '3', L('Plan your sales', 'I-plan ang benta'), L('Type how many orders you expect per month, or tap +10 and −10.', 'I-type ang inaasahang orders kada buwan, o i-tap ang +10 at −10.'), 'Sales plan'],
    ['/report', '4', L('Read your profit report', 'Basahin ang report'), L('Net profit, break-even, best sellers, and how close you are to your goal.', 'Net profit, break-even, best sellers, at gaano ka kalapit sa goal mo.'), 'Profit report'],
  ];
  const words: [string, string][] = [['Usable %', 'usable'], ['Sub-recipe', 'prep'], ['Sizes', 'sizes'], ['Add-ons', 'addon'], ['Profit margin', 'margin'], ['Food cost', 'food'], [L('Delivery app price', 'Presyo sa delivery app'), 'delivery'], ['Break-even', 'be'], ['Price rounding', 'round']];
  return (
    <>
      <PageHead title={L('How to use Kerdion', 'Paano gamitin ang Kerdion')} lead={L('Kerdion (from the Greek word for gain) helps you find your real cost per order, the right selling price and how much you earn each month. No spreadsheet skills needed.', 'Ang Kerdion (galing sa Greek na salita para sa tubo) ay tumutulong malaman ang totoong cost per order, tamang presyo at kita mo kada buwan. Hindi kailangan marunong sa spreadsheet.')} />
      <ol className="gsteps">
        {steps.map(([href, n, title, desc, label]) => (
          <li key={href}><span className="dot">{n}</span><h3>{title}</h3><p>{desc}</p><Link href={href}>{L('Go to ', 'Pumunta sa ')}{label}<Icon name="right" size={16} /></Link></li>
        ))}
      </ol>
      <section className="card" aria-labelledby="h-daily">
        <div className="card-head"><h2 id="h-daily">{L('Every day and every week', 'Araw-araw at linggo-linggo')}</h2></div>
        <div className="rows">
          <div><span><strong>{L('Daily:', 'Araw-araw:')}</strong> {L('log what you sold in ', 'i-log ang nabenta sa ')}<Link href="/daily">{L('Daily sales', 'Benta araw-araw')}</Link>{L(' to compare real results with your plan.', ' para makita ang totoo vs plan.')}</span></div>
          <div><span><strong>{L('After market day:', 'Pagkagaling palengke:')}</strong> {L('update prices in ', 'i-update ang presyo sa ')}<Link href="/ingredients">{L('Ingredient prices', 'Presyo ng sangkap')}</Link>{L('. Every product updates and you get a price alert.', '. Updated lahat ng products at may price alert ka.')}</span></div>
          <div><span><strong>{L('Anytime:', 'Kahit kailan:')}</strong> {L('try meal deals in ', 'subukan ang meal deals sa ')}<Link href="/combos">{L('Combos & upsell', 'Combos at upsell')}</Link>{L(', and download your report in ', ', at i-download ang report sa ')}<Link href="/export">Export</Link>.</span></div>
        </div>
      </section>
      <section className="card" aria-labelledby="h-words">
        <div className="card-head"><h2 id="h-words">{L('Words you will see', 'Mga salitang makikita mo')}</h2><p>{L('Tap the small ? buttons in the app for the same help.', 'I-tap ang maliit na ? sa app para sa parehong paliwanag.')}</p></div>
        <dl className="gloss">{words.map(([w, k]) => <div key={k} style={{ display: 'contents' }}><dt>{w}</dt><dd>{L(HELP[k][0], HELP[k][1])}</dd></div>)}</dl>
      </section>
      <section className="card" aria-labelledby="h-tips">
        <div className="card-head"><h2 id="h-tips">{L('Good to know', 'Dapat mong malaman')}</h2></div>
        <div className="rows">
          <div><span>{meta.mode === 'cloud' ? L('Your data saves to your account automatically. Sign in on any phone or computer to see it.', 'Automatic na naka-save sa account mo ang data. Mag-sign in sa kahit anong phone o computer para makita ito.') : L('Your data is saved in this browser only. Download a backup in Export before switching devices.', 'Naka-save lang ang data sa browser na ito. Mag-download ng backup sa Export bago lumipat ng device.')}</span></div>
          <div><span>{L('Deleted something by mistake? Tap Undo on the message at the bottom of the screen.', 'Nakabura nang hindi sinasadya? I-tap ang Undo sa message sa baba ng screen.')}</span></div>
          <div><span>{L('Units must match: kg goes with g, L goes with ml, and pc goes with pc.', 'Dapat tugma ang units: kg sa g, L sa ml, at pc sa pc.')}</span></div>
          <div><span>{L('Price alerts show when you change a price you saved more than 10 minutes ago, so first-time setup does not create alerts.', 'Lumalabas ang price alert kapag binago ang presyong na-save mahigit 10 minutes na ang nakalipas, para walang alert habang nagse-setup ka pa lang.')}</span></div>
        </div>
      </section>
      <Pager prev={['/dashboard', 'Home']} next={['/products', L('Start with Products', 'Simulan sa Products')]} />
    </>
  );
}
