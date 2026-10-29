'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../ui';
import { applyTemplate, fresh, sample } from '@/lib/data';
import { focusSoon, num } from '@/lib/format';
import { afterSetup, getData, replaceData, showToast, update, useData, useT } from '@/store/store';
import { LogoMark } from '@/components/Logo';

export default function Welcome() {
  const S = useData(); const L = useT();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(S.biz.name || '');
  const [type, setType] = useState('coffee');
  const [days, setDays] = useState('26');
  const [vat, setVat] = useState(false);
  const [del, setDel] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => { const h = document.querySelector('main h1') as HTMLElement | null; h?.focus(); }, [step]);

  const finish = () => {
    const d = fresh(getData().lang, name.trim());
    d.onboarded = true;
    d.biz.daysOpen = String(Math.round(num(days)) || 26); d.biz.taxOn = vat; d.biz.deliveryOn = del;
    const n = type !== 'none' ? applyTemplate(d, type) : 0;
    afterSetup.path = n ? '/products' : '/dashboard';
    replaceData(d);
    showToast(n ? L('All set! We added ', 'Ayos! Nagdagdag kami ng ') + n + L(' example items. Change the prices to what you really pay.', ' example items. Palitan ang presyo ng totoong binabayaran mo.') : L('All set! Start by adding your first product.', 'Ayos! Simulan sa pag-add ng unang produkto.'));
  };
  const useSample = () => { afterSetup.path = '/dashboard'; replaceData(sample(getData().lang)); };
  const next = () => {
    if (step === 1 && !name.trim()) { setErr(true); focusSoon('wiz-name'); showToast(L('Type your business name first.', 'I-type muna ang pangalan ng negosyo mo.')); return; }
    setStep((s) => Math.min(3, s + 1)); window.scrollTo(0, 0);
  };
  const types: [string, string, string][] = [
    ['coffee', L('Coffee shop', 'Coffee shop'), L('Iced and hot coffee drinks', 'Iced at hot coffee')],
    ['milktea', L('Milk tea shop', 'Milk tea shop'), L('Milk tea with pearls', 'Milk tea na may pearls')],
    ['silog', L('Silog or rice meals', 'Silog o rice meals'), 'Tapsilog, Longsilog, Tocilog'],
    ['bakery', 'Bakery', L('Pandesal from a dough batch', 'Pandesal galing sa batch ng dough')],
    ['none', L('Something else', 'Iba pa'), L('Start with an empty list', 'Magsimula sa blangko')],
  ];

  return (
    <div className="wiz">
      <div className="brand" style={{ gap: 12 }}>
        <LogoMark size={48} />
        <span><span className="brand-name" style={{ fontSize: 30 }}>Saffra</span><span className="brand-sub">{L('Know your real cost and profit', 'Alamin ang totoong gastos at tubo')}</span></span>
      </div>
      <div className="wiz-steps" aria-hidden="true"><span className="on" /><span className={step >= 2 ? 'on' : ''} /><span className={step >= 3 ? 'on' : ''} /></div>
      <section className="card">
        <span className="eyebrow">Quick setup · {step} / 3</span>
        {step === 1 && <>
          <h1 tabIndex={-1} style={{ fontSize: 'clamp(26px,5vw,34px)' }}>{L('What is your business called?', 'Ano ang pangalan ng negosyo mo?')}</h1>
          <p className="lead">{L('This shows on your home screen and reports. You can change it later.', 'Lalabas ito sa home at mga report. Pwede mong palitan mamaya.')}</p>
          <div className="field">
            <label htmlFor="wiz-name">{L('Business name', 'Pangalan ng negosyo')}</label>
            <input className="input input-xl" id="wiz-name" value={name} aria-invalid={err && !name.trim()} onChange={(e) => { setName(e.target.value); setErr(false); }} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} placeholder={L('e.g. Wins Coffee', 'hal. Wins Coffee')} autoComplete="organization" />
          </div>
          <div className="pager">
            <button className="btn btn-primary" onClick={next}>Next<Icon name="right" size={18} /></button>
            <button className="btn" onClick={useSample}>{L('Just exploring? See sample data', 'Titingin muna? Tingnan ang sample')}</button>
          </div>
        </>}
        {step === 2 && <>
          <h1 tabIndex={-1} style={{ fontSize: 'clamp(26px,5vw,34px)' }}>{L('What do you sell?', 'Ano ang binebenta mo?')}</h1>
          <p className="lead">{L('We will add example products so you are not starting from zero. Prices are examples, so change them to what you pay.', 'Magdadagdag kami ng example products para hindi ka magsimula sa zero. Example lang ang presyo, palitan mo ng totoong binabayaran mo.')}</p>
          <div className="tgrid" role="group" aria-label={L('Business type', 'Uri ng negosyo')}>
            {types.map(([k, t, d]) => <button key={k} className="tcard" aria-pressed={type === k} onClick={() => setType(k)}><strong>{t}</strong><span>{d}</span></button>)}
          </div>
          <div className="pager">
            <button className="btn btn-primary" onClick={next}>Next<Icon name="right" size={18} /></button>
            <button className="btn" onClick={() => setStep(1)}><Icon name="left" size={18} />Back</button>
          </div>
        </>}
        {step === 3 && <>
          <h1 tabIndex={-1} style={{ fontSize: 'clamp(26px,5vw,34px)' }}>{L('A few quick details', 'Ilang detalye pa')}</h1>
          <div className="field">
            <label htmlFor="wiz-days">{L('Days open per month', 'Araw na bukas kada buwan')}</label>
            <input className="input" id="wiz-days" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" style={{ maxWidth: 160 }} />
            <span className="help">{L('Monday to Saturday is about 26 days. Every day is 30.', 'Monday hanggang Saturday ay mga 26 days. Araw-araw ay 30.')}</span>
          </div>
          <div className="field">
            <span className="lbl" id="wv">{L('Are you VAT-registered?', 'VAT-registered ka ba?')}</span>
            <div className="choice" role="group" aria-labelledby="wv">
              <button aria-pressed={!vat} onClick={() => setVat(false)}><strong>{L('No', 'Hindi')}</strong><span>{L('Most small sellers', 'Karamihan ng maliliit na seller')}</span></button>
              <button aria-pressed={vat} onClick={() => setVat(true)}><strong>{L('Yes', 'Oo')}</strong><span>{L('Add 12% VAT to prices', 'Idagdag ang 12% VAT sa presyo')}</span></button>
            </div>
          </div>
          <div className="field">
            <span className="lbl" id="wd">{L('Do you sell on GrabFood or foodpanda?', 'Nagbebenta ka ba sa GrabFood o foodpanda?')}</span>
            <div className="choice" role="group" aria-labelledby="wd">
              <button aria-pressed={!del} onClick={() => setDel(false)}><strong>{L('No', 'Hindi')}</strong><span>{L('Walk-in and pickup only', 'Walk-in at pickup lang')}</span></button>
              <button aria-pressed={del} onClick={() => setDel(true)}><strong>{L('Yes', 'Oo')}</strong><span>{L('Show delivery app prices', 'Ipakita ang delivery app prices')}</span></button>
            </div>
          </div>
          <div className="pager">
            <button className="btn btn-yolk" onClick={finish}>{L('Finish setup', 'Tapusin ang setup')}<Icon name="check" size={18} /></button>
            <button className="btn" onClick={() => setStep(2)}><Icon name="left" size={18} />Back</button>
          </div>
        </>}
      </section>
      <div className="seg2" role="group" aria-label="Language" style={{ maxWidth: 260, alignSelf: 'center' }}>
        <button aria-pressed={S.lang !== 'tl'} onClick={() => update((d) => { d.lang = 'en'; })}>English</button>
        <button aria-pressed={S.lang === 'tl'} onClick={() => update((d) => { d.lang = 'tl'; })}>Taglish</button>
      </div>
    </div>
  );
}
