'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayStats, logItems, uCalc, units } from '@/lib/calc';
import { daysAgo, int, peso, pct, todayISO } from '@/lib/format';
import { lowStock, qtyText } from '@/lib/inventory';
import { BRANCH_LIMIT, MULTI_PRICE, entMulti } from '@/lib/plan';
import { addBranch, editBranch, loadBranchData, loadBranches, removeBranch, type Branch } from '@/lib/branches';
import type { AppData } from '@/lib/types';
import { closeBranch, openBranch, useEnt, useMeta, useT } from '@/store/store';
import { ConfirmBox, Icon, PageHead, Pill } from '../ui';

const n0 = (v: number) => v.toLocaleString('en-US');

function ago(iso: string | null, L: (en: string, tl?: string) => string) {
  if (!iso) return L('never', 'wala pa');
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return L('just now', 'ngayon lang');
  if (m < 60) return m + L(' min ago', ' min ang nakaraan');
  const h = Math.floor(m / 60);
  if (h < 48) return h + L(' hours ago', ' oras ang nakaraan');
  return Math.floor(h / 24) + L(' days ago', ' araw ang nakaraan');
}

/** Sales, profit and stock numbers for one business, from its own daily log and inventory. */
function summary(s: AppData) {
  const items = logItems(s);
  const today = todayISO(), week = daysAgo(6), mo = today.slice(0, 7);
  const out = { today: { o: 0, rev: 0, gross: 0 }, week: { o: 0, rev: 0, gross: 0 }, month: { o: 0, rev: 0, gross: 0 }, lastSale: '' };
  Object.keys(s.log).forEach((d) => {
    if (d > today || (d < week && d.slice(0, 7) !== mo)) return;
    const st = dayStats(s, d, items);
    if (st.o > 0 && d > out.lastSale) out.lastSale = d;
    const add = (t: typeof out.today) => { t.o += st.o; t.rev += st.rev; t.gross += st.gross; };
    if (d === today) add(out.today);
    if (d >= week) add(out.week);
    if (d.slice(0, 7) === mo) add(out.month);
  });
  // Latest sale day can be older than this week or month.
  if (!out.lastSale) Object.keys(s.log).forEach((d) => { if (d <= today && d > out.lastSale && dayStats(s, d, items).o > 0) out.lastSale = d; });
  const low = lowStock(s);
  const products = s.recipes.filter((r) => r.kind !== 'addon').length;
  return { ...out, low, products };
}

interface Row { key: string; branch: Branch | null; name: string; data: AppData | null; updatedAt: string | null }

export default function Branches() {
  const L = useT(); const meta = useMeta(); const ent = useEnt();
  const [list, setList] = useState<Branch[]>([]);
  const [biz, setBiz] = useState<Awaited<ReturnType<typeof loadBranchData>>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const multi = entMulti(ent);

  const load = useCallback(async () => {
    if (meta.mode !== 'cloud' || !meta.userId || ent.branchOf || meta.viewing) { setLoading(false); return; }
    setLoading(true); setErr('');
    try {
      const b = await loadBranches(meta.userId);
      setList(b);
      setBiz(multi ? await loadBranchData(meta.userId, b) : {});
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [meta.mode, meta.userId, meta.viewing, ent.branchOf, multi]);
  useEffect(() => { load(); }, [load]);

  const head = <PageHead title={L('Branches', 'Mga branch')} eyebrow="Saffra Multi-Branch"
    lead={L('Watch the sales, profit and stock of every branch in one place, and open any branch to check or fix its data.', 'Makikita mo dito ang benta, tubo at stock ng bawat branch, at pwede mong buksan ang kahit anong branch para i-check o ayusin ang data nila.')}
    actions={multi && !loading ? <button className="btn" onClick={load}>{L('Refresh', 'I-refresh')}</button> : undefined} />;

  if (meta.mode !== 'cloud') return <>{head}<div className="empty"><strong>{L('Branches need an account', 'Kailangan ng account para sa branches')}</strong></div></>;
  if (meta.viewing) {
    return <>{head}<div className="empty"><strong>{L('You are inside the ' + meta.viewing.name + ' branch', 'Nasa loob ka ng ' + meta.viewing.name + ' branch')}</strong>
      <p>{L('Go back to your own business to see all branches.', 'Bumalik sa sarili mong business para makita lahat ng branch.')}</p>
      <button className="btn btn-primary" onClick={() => closeBranch()}>{L('Back to main branch', 'Balik sa main branch')}</button></div></>;
  }
  if (ent.branchOf) {
    return <>{head}<div className="empty"><strong>{L('This is the ' + ent.branchName + ' branch account', 'Ito ang account ng ' + ent.branchName + ' branch')}</strong>
      <p>{L('Your main branch manages branches and your plan. Everything you save here, your main branch can see.', 'Ang main branch mo ang nag-aasikaso ng branches at ng plan. Lahat ng ise-save mo dito, makikita ng main branch.')}</p></div></>;
  }
  if (!multi) {
    return (
      <>
        {head}
        <section className="card" aria-labelledby="h-mb">
          <div className="card-head"><h2 id="h-mb">{L('Run more than one branch?', 'May higit sa isang branch?')}</h2>
            <p>{L('With Saffra Multi-Branch, your account becomes the main branch. Add up to ' + BRANCH_LIMIT + ' branch logins, each with its own products, sales and stock, and see all of them from here.', 'Sa Saffra Multi-Branch, magiging main branch ang account mo. Pwede kang mag-add ng hanggang ' + BRANCH_LIMIT + ' branch logins, may sariling products, benta at stock ang bawat isa, at makikita mo lahat dito.')}</p></div>
          <ul className="pro-list">
            {[L('Everything in Pro, for every branch', 'Lahat ng nasa Pro, para sa bawat branch'),
              L('Up to ' + BRANCH_LIMIT + ' branch accounts with their own email and password', 'Hanggang ' + BRANCH_LIMIT + ' branch accounts na may sariling email at password'),
              L('Sales today, this week and this month for every branch', 'Benta ngayon, ngayong linggo at ngayong buwan ng bawat branch'),
              L('Low-stock alerts from all branches in one list', 'Paubos na stock ng lahat ng branch sa iisang list'),
              L('Compare prices and margins across branches', 'Ikumpara ang presyo at margin sa bawat branch'),
              L('Open any branch to add, edit or delete its data', 'Buksan ang kahit anong branch para mag-add, edit o delete ng data nila')].map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}
          </ul>
          <p><strong>₱{n0(MULTI_PRICE.monthly)}</strong> {L('per month', 'kada buwan')} · <strong>₱{n0(MULTI_PRICE.yearly)}</strong> {L('per year (2 months free)', 'kada taon (2 buwang libre)')}</p>
          <Link className="btn btn-primary" style={{ alignSelf: 'flex-start' }} href="/upgrade?tier=multi">{L('Get Multi-Branch', 'Kumuha ng Multi-Branch')}</Link>
          {list.length > 0 && <p className="help">{L('Your ' + list.length + ' branch accounts and their data are kept. Renew Multi-Branch to see them again.', 'Naka-save pa rin ang ' + list.length + ' branch accounts mo at ang data nila. Mag-renew ng Multi-Branch para makita ulit.')}</p>}
        </section>
      </>
    );
  }

  return <Dashboard head={head} list={list} biz={biz} loading={loading} err={err} reload={load} />;
}

function Dashboard({ head, list, biz, loading, err, reload }: {
  head: React.ReactNode; list: Branch[]; biz: Awaited<ReturnType<typeof loadBranchData>>; loading: boolean; err: string; reload: () => void;
}) {
  const L = useT(); const meta = useMeta();
  const mainLabel = L('Main branch', 'Main branch');
  const rows: Row[] = useMemo(() => {
    const own = biz[meta.userId];
    return [
      { key: meta.userId, branch: null, name: mainLabel, data: own?.data || null, updatedAt: own?.updatedAt || null },
      ...list.map((b) => ({ key: b.user_id, branch: b, name: b.name, data: biz[b.user_id]?.data || null, updatedAt: biz[b.user_id]?.updatedAt || null })),
    ];
  }, [biz, list, meta.userId, mainLabel]);
  const stats = useMemo(() => {
    const m: Record<string, ReturnType<typeof summary>> = {};
    rows.forEach((r) => { if (r.data) m[r.key] = summary(r.data); });
    return m;
  }, [rows]);
  const activeCount = list.filter((b) => b.active).length;

  if (loading) return <>{head}<p className="help" role="status">{L('Loading branches…', 'Nilo-load ang branches…')}</p></>;

  const all = rows.reduce((a, r) => { const s = stats[r.key]; if (!s) return a;
    a.today += s.today.rev; a.todayO += s.today.o; a.month += s.month.rev; a.gross += s.month.gross; a.low += s.low.length; return a; },
  { today: 0, todayO: 0, month: 0, gross: 0, low: 0 });

  return (
    <>
      {head}
      {err && <p className="confirm" role="alert">{err}</p>}

      <div className="kpis" aria-label={L('All branches', 'Lahat ng branch')}>
        <div className="stat"><span className="k">{L('Sales today, all branches', 'Benta ngayon, lahat')}</span><span className="v">{peso(all.today, 0)}</span><span className="s">{int(all.todayO)} orders</span></div>
        <div className="stat"><span className="k">{L('Sales this month', 'Benta ngayong buwan')}</span><span className="v">{peso(all.month, 0)}</span><span className="s">{L('from daily logs', 'galing sa daily logs')}</span></div>
        <div className="stat"><span className="k">{L('Gross profit this month', 'Gross profit ngayong buwan')}</span><span className="v">{peso(all.gross, 0)}</span><span className="s">{L('before monthly bills', 'bago ang bills')}</span></div>
        <div className="stat"><span className="k">{L('Items low or out', 'Paubos o ubos na')}</span><span className="v">{int(all.low)}</span><span className="s">{L('across all branches', 'sa lahat ng branch')}</span></div>
      </div>

      {rows.map((r) => <BranchCard key={r.key} row={r} s={stats[r.key]} onChanged={reload} />)}

      {rows.length > 1 && <Compare rows={rows} />}

      {activeCount < BRANCH_LIMIT
        ? <AddBranch left={BRANCH_LIMIT - activeCount} onAdded={reload} />
        : <p className="help">{L('You have ' + BRANCH_LIMIT + ' branches turned on, the most Multi-Branch allows. Turn one off to add another.', 'May ' + BRANCH_LIMIT + ' branch ka nang naka-on, ito ang max sa Multi-Branch. Mag-off ng isa para makapag-add.')}</p>}
    </>
  );
}

function BranchCard({ row, s, onChanged }: { row: Row; s: ReturnType<typeof summary> | undefined; onChanged: () => void }) {
  const L = useT();
  const b = row.branch;
  const [mode, setMode] = useState<'' | 'edit' | 'off' | 'delete'>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const id = 'br-' + row.key.slice(0, 8);

  const toggle = async (active: boolean) => {
    if (!b) return; setBusy(true); setErr('');
    try { await editBranch(b.id, { active }); setMode(''); onChanged(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!b) return; setBusy(true); setErr('');
    try { await removeBranch(b.id); setMode(''); onChanged(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <section className="card" aria-labelledby={id}>
      <div className="card-head" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 id={id}>{row.name}</h2>
          <p>{b ? b.email : L('Your own business', 'Ang sarili mong business')} · {L('last saved ', 'huling na-save ')}{ago(row.updatedAt, L)}</p>
        </div>
        <div className="chips">
          {!b && <Pill tone="good">{L('You', 'Ikaw')}</Pill>}
          {b && (b.active ? <Pill tone="good">{L('On', 'Naka-on')}</Pill> : <Pill tone="bad">{L('Turned off', 'Naka-off')}</Pill>)}
          {s && s.low.length > 0 && <Pill tone="warn">{s.low.length} {L('low stock', 'paubos na')}</Pill>}
        </div>
      </div>

      {!row.data ? <p className="help">{L('No data saved yet.', 'Wala pang naka-save na data.')}</p> : s && (
        <>
          <div className="kpis">
            <div className="stat"><span className="k">{L('Today', 'Ngayon')}</span><span className="v">{peso(s.today.rev, 0)}</span><span className="s">{int(s.today.o)} orders · {L('profit ', 'tubo ')}{peso(s.today.gross, 0)}</span></div>
            <div className="stat"><span className="k">{L('Last 7 days', 'Huling 7 araw')}</span><span className="v">{peso(s.week.rev, 0)}</span><span className="s">{int(s.week.o)} orders</span></div>
            <div className="stat"><span className="k">{L('This month', 'Ngayong buwan')}</span><span className="v">{peso(s.month.rev, 0)}</span><span className="s">{L('profit ', 'tubo ')}{peso(s.month.gross, 0)}</span></div>
            <div className="stat"><span className="k">Products</span><span className="v">{int(s.products)}</span><span className="s">{s.lastSale ? L('last sale logged ', 'huling benta: ') + s.lastSale : L('no sales logged yet', 'wala pang benta')}</span></div>
          </div>
          {s.low.length > 0 && (
            <ul className="adm-list" aria-label={L('Low stock', 'Paubos na')}>
              {s.low.slice(0, 5).map((x) => (
                <li key={x.l.id}><div><strong>{x.l.name || L('Untitled', 'Walang pangalan')}</strong>
                  <span className="help">{x.daysLeft != null ? L('about ' + Math.floor(x.daysLeft) + ' days left', 'mga ' + Math.floor(x.daysLeft) + ' araw na lang') : ''}</span></div>
                  <Pill tone={x.status === 'out' ? 'bad' : 'warn'}>{x.status === 'out' ? L('Out', 'Ubos') : qtyText(Math.max(0, x.onHand), x.l.unit)}</Pill></li>
              ))}
            </ul>
          )}
        </>
      )}

      {b && (
        <>
          {mode === 'edit' ? <EditBranch b={b} onDone={() => { setMode(''); onChanged(); }} onCancel={() => setMode('')} />
            : mode === 'off' ? (
              <ConfirmBox msg={L('Turn off ' + b.name + '? Its login stops working. Its data stays, and you can still see it here. You can turn it back on anytime.', 'I-off ang ' + b.name + '? Hindi na makaka-login ang branch. Naka-save pa rin ang data nila at makikita mo pa rin dito. Pwede mo itong i-on ulit kahit kailan.')}
                yes={busy ? L('Turning off…', 'Ino-off…') : L('Turn off', 'I-off')} onYes={() => toggle(false)} onNo={() => setMode('')} />
            ) : mode === 'delete' ? (
              <ConfirmBox msg={L('Delete ' + b.name + ' for good? Its login, products, sales and stock are erased and cannot be brought back. To keep the data, turn the branch off instead.', 'Burahin nang tuluyan ang ' + b.name + '? Mabubura ang login, products, benta at stock nila at hindi na maibabalik. Kung gusto mong i-keep ang data, i-off na lang ang branch.')}
                yes={busy ? L('Deleting…', 'Binubura…') : L('Delete for good', 'Burahin nang tuluyan')} onYes={remove} onNo={() => setMode('')} />
            ) : (
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => openBranch(b.user_id, b.name)} disabled={!row.data}><Icon name="right" size={16} />{L('Open and edit', 'Buksan at i-edit')}</button>
                <button className="btn" onClick={() => setMode('edit')}><Icon name="edit" size={16} />{L('Login details', 'Login details')}</button>
                {b.active
                  ? <button className="btn" onClick={() => setMode('off')}><Icon name="lock" size={16} />{L('Turn off', 'I-off')}</button>
                  : <button className="btn" disabled={busy} onClick={() => toggle(true)}><Icon name="check" size={16} />{busy ? L('Turning on…', 'Ino-on…') : L('Turn on', 'I-on')}</button>}
                <button className="btn btn-danger" onClick={() => setMode('delete')}><Icon name="trash" size={16} />{L('Delete', 'Burahin')}</button>
              </div>
            )}
          {err && <p className="confirm" role="alert">{err}</p>}
        </>
      )}
    </section>
  );
}

function EditBranch({ b, onDone, onCancel }: { b: Branch; onDone: () => void; onCancel: () => void }) {
  const L = useT();
  const [name, setName] = useState(b.name);
  const [email, setEmail] = useState(b.email);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await editBranch(b.id, { name, email, password: password || undefined }); onDone(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  const p = 'ed-' + b.id.slice(0, 8);
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grid2">
        <div className="field"><label htmlFor={p + '-n'}>{L('Branch name', 'Pangalan ng branch')}</label><input className="input" id={p + '-n'} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor={p + '-e'}>{L('Login email', 'Login email')}</label><input className="input" id={p + '-e'} type="email" value={email} maxLength={200} autoComplete="off" onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor={p + '-p'}>{L('New password (leave empty to keep)', 'Bagong password (iwan na blangko kung hindi papalitan)')}</label>
          <input className="input" id={p + '-p'} type={show ? 'text' : 'password'} value={password} maxLength={72} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} /></div>
      </div>
      <label className="switch" htmlFor={p + '-s'}><input type="checkbox" id={p + '-s'} checked={show} onChange={(e) => setShow(e.target.checked)} /><span>{L('Show password', 'Ipakita ang password')}</span></label>
      {err && <p className="confirm" role="alert">{err}</p>}
      <div className="btn-row">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? L('Saving…', 'Sine-save…') : L('Save', 'I-save')}</button>
        <button className="btn" type="button" onClick={onCancel}>{L('Cancel', 'Cancel')}</button>
      </div>
      <p className="help">{L('Changing the email or password signs the branch in with the new details next time. Tell the branch staff.', 'Pag pinalitan ang email o password, yung bago na ang gagamitin ng branch sa susunod na login. Sabihan ang staff ng branch.')}</p>
    </form>
  );
}

function AddBranch({ left, onAdded }: { left: number; onAdded: () => void }) {
  const L = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [copy, setCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ name: string; email: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await addBranch({ name, email, password, copy });
      setDone({ name: name.trim(), email: email.trim().toLowerCase(), password });
      setName(''); setEmail(''); setPassword(''); setOpen(false); onAdded();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  return (
    <section className="card" aria-labelledby="h-add">
      <div className="card-head"><h2 id="h-add">{L('Add a branch', 'Mag-add ng branch')}</h2>
        <p>{L('You can add ' + left + ' more. You set the email and password, then give them to the branch staff.', 'Pwede ka pang mag-add ng ' + left + '. Ikaw ang maglalagay ng email at password, tapos ibigay mo sa staff ng branch.')}</p></div>
      {done && (
        <div className="status-box" role="status"><Icon name="check" /><div>
          <strong>{L(done.name + ' is ready', 'Ready na ang ' + done.name)}</strong>
          <p className="help">{L('The branch signs in at this website with ', 'Mag-sign in ang branch sa website na ito gamit ang ')}<strong>{done.email}</strong>{L(' and the password you set. Send these to the branch staff now: the password is not shown again.', ' at ang password na nilagay mo. Ipadala na ito sa staff ng branch: hindi na ulit ipapakita ang password.')}</p>
        </div></div>
      )}
      {!open ? (
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => { setOpen(true); setDone(null); }}><Icon name="plus" size={16} />{L('Add branch', 'Mag-add ng branch')}</button>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid2">
            <div className="field"><label htmlFor="nb-name">{L('Branch name', 'Pangalan ng branch')}</label><input className="input" id="nb-name" value={name} maxLength={80} placeholder={L('e.g. Dagupan', 'hal. Dagupan')} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="field"><label htmlFor="nb-email">{L('Login email for the branch', 'Login email ng branch')}</label><input className="input" id="nb-email" type="email" value={email} maxLength={200} autoComplete="off" placeholder="dagupan@yourbusiness.com" onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="field"><label htmlFor="nb-pw">{L('Password (at least 8 characters)', 'Password (at least 8 characters)')}</label><input className="input" id="nb-pw" type={show ? 'text' : 'password'} value={password} minLength={8} maxLength={72} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} required /></div>
          </div>
          <label className="switch" htmlFor="nb-show"><input type="checkbox" id="nb-show" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>{L('Show password', 'Ipakita ang password')}</span></label>
          <label className="switch" htmlFor="nb-copy"><input type="checkbox" id="nb-copy" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
            <span>{L('Start with a copy of my products, ingredient prices and expenses', 'Kopyahin ang products, presyo ng sangkap at expenses ko')}<span className="help" style={{ display: 'block', fontWeight: 400 }}>{L('Sales and stock start empty. The branch can change its own prices after.', 'Blangko ang benta at stock. Pwedeng palitan ng branch ang sarili nilang presyo pagkatapos.')}</span></span></label>
          {err && <p className="confirm" role="alert">{err}</p>}
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? L('Adding…', 'Ina-add…') : L('Add branch', 'I-add ang branch')}</button>
            <button className="btn" type="button" onClick={() => setOpen(false)}>{L('Cancel', 'Cancel')}</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** The same product across branches: selling price and margin side by side, matched by name. */
function Compare({ rows }: { rows: Row[] }) {
  const L = useT();
  const cols = useMemo(() => rows.filter((r) => r.data), [rows]);
  const table = useMemo(() => {
    const names: string[] = []; const seen = new Set<string>();
    const per = cols.map((r) => {
      const m = new Map<string, { sell: number; margin: number }>();
      units(r.data!, 'product').forEach((u) => {
        const k = u.name.trim().toLowerCase(); const c = uCalc(r.data!, u);
        m.set(k, { sell: c.sell, margin: c.margin });
        if (!seen.has(k)) { seen.add(k); names.push(u.name); }
      });
      return m;
    });
    return { names: names.slice(0, 40), per };
  }, [cols]);
  if (!table.names.length) return null;
  return (
    <section className="card" aria-labelledby="h-cmp">
      <div className="card-head"><h2 id="h-cmp">{L('Prices and margins by branch', 'Presyo at margin bawat branch')}</h2>
        <p>{L('Products with the same name are matched. A low margin in one branch usually means its ingredient prices are higher there.', 'Pinagtatapat ang products na pareho ang pangalan. Kapag mababa ang margin sa isang branch, kadalasan mas mahal ang sangkap doon.')}</p></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="adm-table">
          <thead><tr><th>Product</th>{cols.map((r) => <th key={r.key}>{r.name}</th>)}</tr></thead>
          <tbody>{table.names.map((n) => { const k = n.trim().toLowerCase(); return (
            <tr key={k}><td><strong>{n}</strong></td>{table.per.map((m, i) => { const v = m.get(k); return (
              <td key={cols[i].key}>{v ? <>{peso(v.sell)}<br /><span className="help">{pct(v.margin)}</span></> : <span className="help">—</span>}</td>
            ); })}</tr>
          ); })}</tbody>
        </table>
      </div>
    </section>
  );
}
