// Institution coordinator (dental college / hospital / clinic): assign open cases to the institution's dentists,
// follow them, and see the institution's contribution. Cases are anonymised exactly as in the dentist queue.
import { html, useState, useAppState, t, L, toast, useLoad, Loading, ago, fmtDate, UrgencyChip } from './ui.js';
import { api } from './api.js';
import { STATES, DISTRICTS, RED_FLAGS, COMPLAINTS } from '/shared/clinical.js';

export const INSTITUTION_KINDS = { dental_college: 'Dental college', hospital: 'Hospital', clinic: 'Clinic', organisation: 'Organisation', other: 'Other' };
const sexLabel = s => ({ F: t('Female'), M: t('Male'), O: t('Other') }[s] || s);

export function InstitutionQueue() {
  const s = useAppState();
  const [f, setF] = useState({ state: '', district: '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const d = useLoad(() => api('/api/institution/queue?' + qs), [qs]);
  const [pick, setPick] = useState({});
  if (d.loading && !d.data) return html`<${Loading} />`;
  if (d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { institution, dentists, open, assigned } = d.data;
  const assign = async c => {
    const dentist_id = pick[c.id] || (dentists.length === 1 ? dentists[0].id : '');
    if (!dentist_id) { toast(t('Choose a dentist first'), true); return; }
    try { const r = await api(`/api/institution/cases/${c.id}/assign`, { method: 'POST', body: { dentist_id } }); toast(`${t('Assigned to')} ${r.dentist} (${r.hours} h)`); d.reload(); }
    catch (e) { toast(e.message, true); d.reload(); }
  };
  const unassign = async c => {
    if (!confirm(t('Return this case to the open queue?'))) return;
    try { await api(`/api/institution/cases/${c.id}/unassign`, { method: 'POST' }); toast(t('Returned to the open queue')); d.reload(); } catch (e) { toast(e.message, true); }
  };
  const label = { assigned: t('With dentist'), question: t('Question to field worker'), done: t('Opinion signed'), expired: t('Time ran out — back in open queue') };
  const active = assigned.filter(a => a.state_label !== 'done').length;
  return html`
    <div class="row between"><div><h1 style="margin:0">${institution.name}</h1><p class="muted small" style="margin:0">${t(INSTITUTION_KINDS[institution.kind] || institution.kind)}${institution.district ? ' · ' + institution.district : ''}${institution.state ? ', ' + institution.state : ''}</p></div>
      <button class="btn" onClick=${d.reload}>${t('Refresh')}</button></div>
    ${dentists.length === 0 && html`<div class="callout warn" style="margin-top:12px">${t('No dentists are linked to your institution yet. Add them under “Our dentists”.')}</div>`}
    <h2 style="margin-top:16px">${t('Cases assigned by us')} <span class="muted small">(${active} ${t('open')})</span></h2>
    ${assigned.length === 0 ? html`<div class="panel empty">${t('None yet. Assign cases from the open queue below.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr><th></th><th>${t('Person')}</th><th>${t('Dentist')}</th><th>${t('Status')}</th><th>${t('Assigned')}</th><th></th></tr></thead>
      <tbody>${assigned.slice(0, 60).map(a => html`<tr><td><${UrgencyChip} u=${a.urgency} /></td><td>${sexLabel(a.sex)}, ${a.age_band}<br /><span class="tiny">${a.district}${a.state ? ', ' + a.state : ''} · ${a.id}</span></td>
        <td>${a.dentist || '—'}</td><td class="small">${label[a.state_label]}${a.state_label === 'done' && a.referral_needed ? ' · ' + t('referral advised') : ''}</td>
        <td class="small nowrap">${a.assigned_at ? ago(a.assigned_at) : fmtDate(a.opinion_at)}</td>
        <td>${a.state_label === 'assigned' && html`<button class="btn link" onClick=${() => unassign(a)}>${t('Return')}</button>`}</td></tr>`)}</tbody></table></div>`}
    <h2 style="margin-top:20px">${t('Open queue — not yet taken by any dentist')}</h2>
    <p class="muted small">${t('No names, phone numbers or addresses are shown. Assigning reserves the case for the chosen dentist.')}</p>
    <div class="row" style="margin:8px 0">
      <select style="max-width:200px" value=${f.state} onChange=${e => setF({ state: e.target.value, district: '' })} aria-label=${t('State')}>
        <option value="">${t('All states')}</option>${STATES.filter(x => x !== 'Other').map(x => html`<option value=${x}>${x}</option>`)}</select>
      <select style="max-width:220px" value=${f.district} disabled=${!f.state} onChange=${e => setF({ ...f, district: e.target.value })} aria-label=${t('District')}>
        <option value="">${f.state ? t('All districts') : t('Choose a state first')}</option>${(DISTRICTS[f.state] || []).map(x => html`<option value=${x}>${x}</option>`)}</select>
    </div>
    ${open.length === 0 ? html`<div class="panel empty">${t('No open cases right now.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr><th></th><th>${t('Person')}</th><th>${t('Complaints')}</th><th class="num">OHAT</th><th class="num">${t('Photos')}</th><th>${t('Waiting')}</th><th>${t('Assign to')}</th></tr></thead>
      <tbody>${open.map(c => html`<tr>
        <td><${UrgencyChip} u=${c.urgency} /></td>
        <td>${sexLabel(c.sex)}, ${c.age_band}<br /><span class="tiny">${c.district}${c.state ? ', ' + c.state : ''}${c.bedbound ? ' · ' + t('bedbound') : ''}</span></td>
        <td class="small">${c.red_flags.map(k => html`<strong style="color:var(--red)">${L(RED_FLAGS.find(r => r.key === k))}</strong><br />`)}${c.complaints.map(k => L(COMPLAINTS.find(x => x.key === k))).join(', ')}</td>
        <td class="num">${c.ohat_total ?? '—'}</td><td class="num">${c.photo_count}</td><td class="small nowrap">${ago(c.submitted_at)}</td>
        <td class="nowrap"><select style="max-width:180px" value=${pick[c.id] || ''} onChange=${e => setPick({ ...pick, [c.id]: e.target.value })} aria-label=${t('Dentist')}>
          <option value="">${t('Choose dentist')}</option>${dentists.map(x => html`<option value=${x.id}>${x.name}</option>`)}</select>
          <button class="btn primary" disabled=${!dentists.length} onClick=${() => assign(c)}>${t('Assign')}</button></td></tr>`)}</tbody></table></div>`}`;
}

export function InstitutionReport() {
  const d = useLoad(() => api('/api/institution/report'), []);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { institution, totals: T, by_dentist, by_month } = d.data;
  const max = Math.max(1, ...by_month.map(m => m.opinions));
  return html`
    <h1 style="margin:0">${t('Our contribution')} — ${institution.name}</h1>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="v">${T.opinions || 0}</div><div class="l">${t('opinions given')}</div></div>
      <div class="kpi"><div class="v">${T.dentists || 0}</div><div class="l">${t('dentists who took part')}</div></div>
      <div class="kpi"><div class="v">${T.urgent || 0}</div><div class="l">${t('urgent cases reviewed')}</div></div>
      <div class="kpi"><div class="v">${T.referrals || 0}</div><div class="l">${t('referrals advised')}</div></div>
      <div class="kpi"><div class="v">${T.avg_hours == null ? '—' : Math.round(T.avg_hours) + ' h'}</div><div class="l">${t('average time to opinion')}</div></div>
    </div>
    <div class="cols-2" style="margin-top:16px">
      <div class="panel"><h2>${t('By dentist')}</h2><div class="table-wrap"><table class="t"><thead><tr><th>${t('Dentist')}</th><th class="num">${t('Opinions')}</th><th class="num">${t('Referrals')}</th><th class="num">${t('Avg hours')}</th><th class="num">${t('Audit rating')}</th></tr></thead>
        <tbody>${by_dentist.map(r => html`<tr><td>${r.name}<br /><span class="tiny">${r.reg_number}</span></td><td class="num">${r.opinions}</td><td class="num">${r.referrals || 0}</td>
          <td class="num">${r.avg_hours == null ? '—' : Math.round(r.avg_hours)}</td><td class="num">${r.audit_rating ? r.audit_rating.toFixed(1) : '—'}</td></tr>`)}</tbody></table></div></div>
      <div class="panel"><h2>${t('Opinions by month')}</h2><div class="bars">${by_month.map(m => html`<div class="bar-row"><span>${m.month}</span>
        <span class="bar-track"><span class="bar-fill" style=${`display:block;width:${(100 * m.opinions) / max}%`}></span></span>
        <span class="right" style="font-variant-numeric:tabular-nums">${m.opinions}</span></div>`)}</div></div>
    </div>
    <p class="tiny muted" style="margin-top:12px">${t('Each signed opinion records the institution the dentist belonged to at that time. This also appears on the referral report and in programme reports.')}</p>`;
}
