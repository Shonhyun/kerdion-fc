'use client';

import { useState } from 'react';
import type { AppData } from '@/lib/types';
import { isValid, normalize } from '@/lib/data';
import { exportBackup, exportPdf, exportXlsx } from '@/lib/exporters';
import { ConfirmBox, Icon, PageHead } from '../ui';
import { replaceData, update, useData, useMeta, useT } from '@/store/store';

export default function Export() {
  const S = useData(); const L = useT(); const meta = useMeta();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [restore, setRestore] = useState<AppData | null>(null);
  const age = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : -1;

  const run = async (k: string, fn: () => Promise<void> | void) => {
    setBusy(k); setMsg(L('Preparing your file…', 'Inihahanda ang file…'));
    try { await fn(); setMsg(L('Your download has started.', 'Nagsimula na ang download.')); }
    catch { setMsg(L('Could not create the file. Please try again.', 'Hindi nagawa ang file. Subukan ulit.')); }
    setBusy('');
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const s = JSON.parse(String(rd.result)); if (!isValid(s)) throw new Error('bad'); setRestore(normalize(s)); setMsg(''); }
      catch { setRestore(null); setMsg(L('That file is not a Kerdion backup.', 'Hindi Kerdion backup ang file na iyan.')); }
    };
    rd.readAsText(f);
  };
  return (
    <>
      <PageHead title={L('Export & backup', 'Export at backup')} lead={meta.mode === 'cloud'
        ? L('Your data is saved to your account automatically. Download a copy to share, print or keep for your records.', 'Automatic na naka-save ang data mo sa account mo. Mag-download ng kopya para i-share, i-print o itago.')
        : L('Download your numbers to share, print or keep. A backup file lets you move your data to another device.', 'I-download ang numbers mo para i-share, i-print o itago. Gamit ang backup file, mailipat mo ang data mo sa ibang device.')} />
      <div className="grid2">
        <section className="card xcard">
          <span className="x-ic"><Icon name="disk" size={22} /></span>
          <h2 style={{ fontSize: 19 }}>Backup</h2>
          <p className="help">{L('Save a backup file, or restore one, including backups from the Kerdion preview version.', 'Mag-save ng backup file, o mag-restore, kasama ang backup galing sa Kerdion preview version.')}</p>
          <p className="help"><strong>{age < 0 ? L('No backup file yet.', 'Wala pang backup file.') : age === 0 ? L('Last backup: today.', 'Huling backup: ngayon.') : L('Last backup: ', 'Huling backup: ') + age + L(' days ago.', ' araw na ang nakalipas.')}</strong></p>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={!!busy} onClick={() => run('json', () => { exportBackup(S); update((d) => { d.lastBackup = Date.now(); }); })}>{L('Download backup', 'I-download ang backup')}</button>
            <label className="btn file-btn">Restore<input type="file" accept="application/json,.json" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
          </div>
          {restore && <ConfirmBox msg={L('Replace everything with this backup?', 'Palitan lahat ng laman ng backup na ito?')} yes={L('Replace', 'Palitan')}
            onYes={() => { replaceData({ ...restore, onboarded: true }); setRestore(null); setMsg(L('Backup restored.', 'Na-restore ang backup.')); }} onNo={() => setRestore(null)} />}
        </section>
        <section className="card xcard">
          <span className="x-ic"><Icon name="sheet" size={22} /></span>
          <h2 style={{ fontSize: 19 }}>Excel workbook</h2>
          <p className="help">{L('All your data in sheets: summary, products, recipe details, ingredients, sub-recipes, expenses, combos and daily sales.', 'Lahat ng data mo in sheets: summary, products, recipe details, sangkap, sub-recipes, bayarin, combos at daily sales.')}</p>
          <button className="btn btn-primary" disabled={!!busy} onClick={() => run('xlsx', () => exportXlsx(S))}>{busy === 'xlsx' ? L('Preparing…', 'Inihahanda…') : L('Download .xlsx', 'I-download ang .xlsx')}</button>
        </section>
        <section className="card xcard">
          <span className="x-ic"><Icon name="pdf" size={22} /></span>
          <h2 style={{ fontSize: 19 }}>PDF report</h2>
          <p className="help">{L('A clean summary you can print or send to a partner, lender or investor.', 'Malinis na summary na pwedeng i-print o i-send sa partner, lender o investor.')}</p>
          <button className="btn btn-primary" disabled={!!busy} onClick={() => run('pdf', () => exportPdf(S))}>{busy === 'pdf' ? L('Preparing…', 'Inihahanda…') : L('Download PDF', 'I-download ang PDF')}</button>
        </section>
      </div>
      <p className="status" role="status">{msg}</p>
    </>
  );
}
