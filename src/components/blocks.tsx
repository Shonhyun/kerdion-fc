'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { alertText, totals } from '@/lib/calc';
import { fresh } from '@/lib/data';
import { fmtDate, int, num, peso, tone } from '@/lib/format';
import { ConfirmBox, Icon, Peso } from './ui';
import { afterSetup, replaceData, update, useData, useT } from '@/store/store';

const DAY = 86400000;

export function SampleNotice() {
  const S = useData(); const L = useT(); const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (!S.sample || S.bannerHidden) return null;
  if (confirm) return <ConfirmBox msg={L('This removes the sample data and opens the quick setup. Continue?', 'Mabubura ang sample data at bubukas ang quick setup. Tuloy?')} yes={L('Yes, start fresh', 'Oo, start fresh')}
    onYes={() => { afterSetup.path = '/products'; replaceData(fresh(S.lang)); router.replace('/welcome'); }} onNo={() => setConfirm(false)} />;
  return (
    <div className="notice">
      <div className="txt"><strong>{L('You are looking at sample data.', 'Sample data ang nakikita mo.')}</strong> {L('This is a pretend silog stall so you can see how Kerdion works. Explore it, then start your own.', 'Pretend silog stall lang ito para makita mo kung paano gumagana ang Kerdion. I-explore mo muna, tapos simulan ang sa’yo.')}</div>
      <div className="acts">
        <button className="btn btn-sm btn-primary" onClick={() => setConfirm(true)}>{L('Set up my business', 'I-set up ang negosyo ko')}</button>
        <button className="btn btn-sm" onClick={() => update((d) => { d.bannerHidden = true; })}>{L('Keep exploring', 'Explore muna')}</button>
      </div>
    </div>
  );
}

/** Only shown in local mode, where the data lives in this browser alone. */
export function BackupNotice({ local }: { local: boolean }) {
  const S = useData(); const L = useT();
  if (!local || S.sample || !S.recipes.length) return null;
  const age = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / DAY) : -1;
  if (age >= 0 && age < 7) return null;
  const when = age < 0 ? L('You have not made a backup yet.', 'Wala ka pang backup.') : L('Last backup was ', 'Huling backup: ') + age + L(' days ago.', ' araw na ang nakalipas.');
  return (
    <div className="notice">
      <div className="txt"><strong>{when}</strong> {L('Your data lives only on this device. If the browser data is cleared, it is gone. A backup file keeps it safe.', 'Nasa device lang na ito ang data mo. Kapag na-clear ang browser data, mawawala ito. Ligtas ito kapag may backup file ka.')}</div>
      <div className="acts"><Link className="btn btn-sm btn-primary" href="/export">{L('Back up now', 'Mag-backup ngayon')}</Link></div>
    </div>
  );
}

export function AlertsList({ limit = 8 }: { limit?: number }) {
  const S = useData(); const L = useT();
  if (!S.alerts.length) return null;
  return (
    <ul className="alerts">
      {S.alerts.slice(0, limit).map((a) => {
        const tx = alertText(S, a);
        return (
          <li key={a.id}>
            <span className={'a-ic' + (a.up ? '' : ' down')}><Icon name={a.up ? 'up' : 'dn'} size={18} /></span>
            <div><strong>{tx.title}</strong><span className="a-txt">{tx.body} · {fmtDate(a.d, S.lang)}</span></div>
            <button className="icon-btn" aria-label={L('Dismiss', 'Isara')} onClick={() => update((d) => { d.alerts = d.alerts.filter((x) => x.id !== a.id); })}><Icon name="x" size={18} /></button>
          </li>
        );
      })}
    </ul>
  );
}

export function AlertsCard({ title, limit }: { title: string; limit: number }) {
  const S = useData(); const L = useT();
  if (!S.alerts.length) return null;
  return (
    <section className="card" aria-label={title}>
      <div className="card-head row"><h2>{title}</h2>
        <button className="btn btn-sm" onClick={() => update((d) => { d.alerts = []; }, L('Cleared price alerts', 'Na-clear ang price alerts'))}>{L('Clear all', 'I-clear lahat')}</button>
      </div>
      <AlertsList limit={limit} />
    </section>
  );
}

export function GoalBlock({ compact }: { compact: boolean }) {
  const S = useData(); const L = useT();
  const g = num(S.goal); const t = totals(S);
  if (compact && g <= 0) return null;
  const gp = g > 0 ? Math.max(0, Math.min(100, t.net / g * 100)) : 0;
  let need = L('Set a goal to see how many orders you need.', 'Mag-set ng goal para makita kung ilang orders ang kailangan.');
  if (g > 0) need = t.avg > 0
    ? (t.net >= g ? L('Goal reached with your current plan. ', 'Naabot na ang goal sa plan mo. ') : '') + L('To earn ', 'Para kumita ng ') + peso(g, 0) + L(' a month, you need about ', ' kada buwan, kailangan mo ng mga ') + int(Math.ceil((g + t.fixed) / t.avg)) + L(' orders a month (', ' orders kada buwan (') + int(Math.ceil((g + t.fixed) / t.avg / t.days)) + L(' a day) with your current product mix.', ' kada araw) sa kasalukuyang mix ng products mo.')
    : L('Add products with a profit and some orders to see what it takes.', 'Mag-add ng products na may tubo at orders para makita ang kailangan.');
  return (
    <section className="card" aria-labelledby="h-goal">
      <div className="card-head row"><h2 id="h-goal"><Icon name="target" /> {L('Monthly profit goal', 'Monthly profit goal')}</h2>
        {compact && <Link className="btn btn-sm" href="/report">{L('Change goal', 'Palitan ang goal')}</Link>}</div>
      {!compact && (
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="goal-input">{L('How much net profit do you want each month?', 'Magkano ang gusto mong net profit kada buwan?')}</label>
          <Peso id="goal-input" value={S.goal} placeholder={L('e.g. 30000', 'hal. 30000')} onChange={(v) => update((d) => { d.goal = v; })} />
        </div>
      )}
      <div className="bars">
        <div className="bar-row">
          <span className="name">{L('Your plan', 'Plan mo')}<small data-tone={g > 0 && t.net >= g ? 'good' : undefined}>{g > 0 ? Math.round(t.net / g * 100) + L('% of goal', '% ng goal') : ''}</small></span>
          <span className="track goal-bar" aria-hidden="true"><span className={'fill cur' + (t.net < 0 ? ' neg' : '')} style={{ width: gp + '%' }} /></span>
          <span className="val" data-tone={g > 0 ? tone(t.net) : undefined}>{g > 0 ? peso(t.net, 0) + ' / ' + peso(g, 0) : '—'}</span>
        </div>
      </div>
      <p className="help">{need}</p>
    </section>
  );
}
