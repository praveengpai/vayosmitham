// Administration, coordinator dashboard, clinical audit, data protection and research exports.
import { html, useState, useEffect, state, useAppState, go, t, L, toast, DistrictInput, useLoad, Loading, Field, Choices, Thumbs, fmtDate, ago, UrgencyChip, loadRef, roleName } from './ui.js';
import { api } from './api.js';
import { ScreeningSummary } from './field.js';
import { STATES, ALL_DISTRICTS, LANGUAGES, LSGD_TYPES, PHOTO_VIEWS, REFERRAL_TYPES, RED_FLAGS } from '/shared/clinical.js';
import { CONSENT_VERSION, isDraft } from '/shared/consent.js';
import { QuestionnaireEditor } from './questionnaire-editor.js';

// Which accounts each role manages (mirrors src/admin.js MANAGES).
const MANAGES = {
  superadmin: ['superadmin', 'admin', 'clinical_admin', 'coordinator', 'worker', 'dentist', 'auditor', 'dpo', 'researcher'],
  admin: ['coordinator', 'worker', 'dpo', 'researcher'],
  clinical_admin: ['dentist', 'auditor'],
  coordinator: ['worker'],
};
const ADMINS = ['admin', 'superadmin'];

const ADMIN_SECTIONS = [['dashboard', 'Dashboard'], ['users', 'Users'], ['questionnaire', 'Questionnaire'], ['referral_centres', 'Referral centres'], ['kb_items', 'Knowledge base'], ['glossary', 'Glossary'],
  ['lsgds', 'Local bodies'], ['settings', 'Settings'], ['audit-log', 'Access log'], ['consents', 'Consent log'], ['exports', 'Exports'], ['audit', 'Clinical audit']];
const SECTIONS = {
  superadmin: ADMIN_SECTIONS,
  admin: ADMIN_SECTIONS,
  clinical_admin: [['dashboard', 'Dashboard'], ['questionnaire', 'Questionnaire'], ['users', 'Dentists and auditors'], ['kb_items', 'Knowledge base'], ['glossary', 'Glossary'], ['audit', 'Clinical audit']],
  coordinator: [['dashboard', 'Dashboard'], ['users', 'Field workers']],
  dpo: [['dashboard', 'Dashboard'], ['audit-log', 'Access log'], ['consents', 'Consent log']],
  researcher: [['exports', 'Exports']],
  auditor: [['audit', 'Clinical audit'], ['kb_items', 'Knowledge base'], ['questionnaire', 'Questionnaire']],
};

export function AdminArea({ section, id }) {
  const s = useAppState();
  const role = s.user.role;
  const nav = SECTIONS[role] || [];
  const base = role === 'coordinator' || role === 'auditor' ? '#/admin/' : '#/admin/';
  if (!nav.some(([k]) => k === section) && nav.length) section = nav[0][0];
  let body;
  if (section === 'audit') body = html`<${AuditQueue} />`;
  else if (section === 'dashboard') body = html`<${Dashboard} />`;
  else if (section === 'users') body = html`<${Users} />`;
  else if (section === 'settings') body = html`<${Settings} />`;
  else if (section === 'questionnaire') body = html`<${QuestionnaireEditor} />`;
  else if (section === 'audit-log') body = html`<${AccessLog} />`;
  else if (section === 'consents') body = html`<${ConsentLog} />`;
  else if (section === 'exports') body = html`<${Exports} />`;
  else if (section === 'lsgds') body = html`<${RefList} table="lsgds" />`;
  else if (REF_DEFS[section]) body = html`<${RefList} table=${section} />`;
  else body = html`<${Dashboard} />`;
  return html`<div class="side-layout">
    <nav class="side-nav" aria-label=${t('Sections')}>${nav.map(([k, label]) => html`<a href=${k === 'audit' ? '#/audit' : base + k} class=${section === k ? 'on' : ''}>${t(label)}</a>`)}
      ${role === 'coordinator' && html`<a href="#/">${t('Field view')}</a>`}</nav>
    <div>${body}</div></div>`;
}

// ---------- dashboard ----------
function Dashboard() {
  const s = useAppState();
  const [f, setF] = useState({ district: '', from: '', to: '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const d = useLoad(() => api('/api/admin/dashboard?' + qs), [qs]);
  const coord = s.user.role === 'coordinator';
  return html`
    <div class="row between"><h1 style="margin:0">${coord ? `${t('Dashboard')} — ${s.user.district}` : t('Programme dashboard')}</h1>
      <a class="btn" href=${'/api/admin/indicators.csv?' + qs}>${t('Download indicators (CSV)')}</a></div>
    <div class="row" style="margin:12px 0">
      ${!coord && html`<select style="max-width:220px" value=${f.district} onChange=${e => setF({ ...f, district: e.target.value })} aria-label=${t('District')}>
        <option value="">${t('All districts')}</option>${ALL_DISTRICTS.map(x => html`<option>${x}</option>`)}</select>`}
      <label class="row small">${t('From')} <input type="date" style="max-width:170px" value=${f.from} onInput=${e => setF({ ...f, from: e.target.value })} /></label>
      <label class="row small">${t('To')} <input type="date" style="max-width:170px" value=${f.to} onInput=${e => setF({ ...f, to: e.target.value })} /></label>
    </div>
    ${['superadmin', 'admin', 'clinical_admin'].includes(s.user.role) && html`<${QuestionnaireChanges} />`}
    ${d.loading || d.error ? html`<${Loading} error=${d.error} retry=${d.reload} />` : html`<${DashBody} d=${d.data} />`}`;
}

// Recent questionnaire versions, so CIF sees every change AGeD publishes (and can restore an earlier one).
function QuestionnaireChanges() {
  const q = useLoad(() => api('/api/admin/questionnaire'), []);
  const recent = (q.data?.history || []).filter(h => Date.now() - Date.parse(h.created_at + 'Z') < 30 * 864e5).slice(0, 3);
  if (!recent.length) return '';
  return html`<div class="callout info small" style="margin-bottom:12px"><strong>${t('Questionnaire changes in the last 30 days')}</strong>
    <ul style="margin:6px 0 0;padding-left:18px">${recent.map(h => html`<li>${t('Version')} ${h.version} · ${h.created_at.slice(0, 10)} · ${h.created_by_name} — ${h.note}</li>`)}</ul>
    <a href="#/admin/questionnaire">${t('Open the questionnaire')}</a></div>`;
}

function bars(rows, labelKey, valueKey, cls = '') {
  const max = Math.max(1, ...rows.map(r => r[valueKey] || 0));
  return html`<div class="bars">${rows.map(r => html`<div class="bar-row"><span>${r[labelKey] ?? '—'}</span>
    <span class="bar-track"><span class=${'bar-fill ' + cls} style=${`display:block;width:${((r[valueKey] || 0) / max) * 100}%`}></span></span>
    <span class="right" style="font-variant-numeric:tabular-nums">${r[valueKey] || 0}</span></div>`)}</div>`;
}

function DashBody({ d }) {
  const T = d.totals;
  const pct = (a, b) => (b ? Math.round((100 * (a || 0)) / b) + '%' : '—');
  const reached = d.referrals.find(r => r.status === 'reached')?.n || 0;
  const totalRef = d.referrals.reduce((s, r) => s + r.n, 0);
  const statusName = { submitted: 'With dentist', info_requested: 'Question to worker', opinion: 'Opinion given', closed: 'Closed', withdrawn: 'Withdrawn' };
  return html`
    <div class="kpis">
      <div class="kpi"><div class="v">${T.persons || 0}</div><div class="l">${t('older people screened')}</div></div>
      <div class="kpi"><div class="v">${T.cases || 0}</div><div class="l">${t('visits')} (${T.followups || 0} ${t('follow-up')})</div></div>
      <div class="kpi"><div class="v">${d.turnaround_hours_median == null ? '—' : Math.round(d.turnaround_hours_median) + ' h'}</div><div class="l">${t('median time to opinion')}</div></div>
      <div class="kpi"><div class="v" style=${(d.urgent_sla.total && d.urgent_sla.within / d.urgent_sla.total < 0.9) ? 'color:var(--red)' : ''}>${pct(d.urgent_sla.within, d.urgent_sla.total)}</div>
        <div class="l">${t('urgent cases seen within')} ${d.urgent_sla.hours} h (${d.urgent_sla.total || 0})</div></div>
      <div class="kpi"><div class="v">${pct(reached, totalRef)}</div><div class="l">${t('referrals completed')} (${reached}/${totalRef})</div></div>
      <div class="kpi"><div class="v">${T.workers}/${T.dentists}</div><div class="l">${t('active field workers / dentists')}</div></div>
    </div>
    ${d.overdue.length > 0 && html`<div class="panel" style="margin-top:16px;border-color:#eab4ae"><h2 style="color:var(--red)">${t('Waiting too long for a dentist')} (${d.overdue.length})</h2>
      <table class="t"><tbody>${d.overdue.map(o => html`<tr><td><${UrgencyChip} u=${o.urgency} /></td><td>${o.id}</td><td>${o.district}</td><td>${Math.round(o.age_hours)} h</td></tr>`)}</tbody></table></div>`}
    <div class="cols-2" style="margin-top:16px">
      <div class="panel"><h2>${t('Where cases are')}</h2>${bars(d.by_status.map(r => ({ ...r, label: t(statusName[r.status] || r.status) })), 'label', 'n')}</div>
      <div class="panel"><h2>${t('Oral health (OHAT)')}</h2>${bars(d.ohat_bands, 'band', 'n', 'gold')}<p class="tiny">${t('0–2 healthy, 3–6 some changes, 7+ unhealthy.')}</p></div>
      <div class="panel"><h2>${t('Visits by month')}</h2>${bars(d.trend, 'month', 'cases')}</div>
      <div class="panel"><h2>${t('Referral outcomes')}</h2>${bars(d.referrals.map(r => ({ ...r, label: t({ pending: 'Not yet known', reached: 'Went', not_reached: 'Did not go' }[r.status]) })), 'label', 'n')}</div>
    </div>
    <div class="panel" style="margin-top:16px"><h2>${t('Teeth by age (first visits)')}</h2><div class="table-wrap"><table class="t">
      <thead><tr><th>${t('Age')}</th><th class="num">${t('Screened')}</th><th class="num">${t('20+ teeth')}</th><th class="num">${t('No teeth')}</th><th class="num">${t('Mean GOHAI')}</th></tr></thead>
      <tbody>${d.teeth_by_age.map(r => html`<tr><td>${r.age_band}</td><td class="num">${r.n}</td><td class="num">${pct(r.functional, r.n)}</td><td class="num">${pct(r.edentulous, r.n)}</td>
        <td class="num">${r.gohai ? r.gohai.toFixed(1) : '—'}</td></tr>`)}</tbody></table></div>
      <p class="tiny">${t('Indicators follow WHO oral health survey definitions. Exports hide counts below')} ${d.small_cell_threshold}.</p></div>
    <div class="cols-2" style="margin-top:16px">
      <div class="panel"><h2>${t('By district')}</h2><div class="table-wrap"><table class="t"><thead><tr><th>${t('District')}</th><th class="num">${t('People')}</th><th class="num">${t('Visits')}</th><th class="num">${t('Urgent')}</th></tr></thead>
        <tbody>${d.by_district.map(r => html`<tr><td>${r.district}</td><td class="num">${r.persons}</td><td class="num">${r.cases}</td><td class="num">${r.urgent}</td></tr>`)}</tbody></table></div></div>
      <div class="panel"><h2>${t('Clinical audit')}</h2><dl class="kv"><dt>${t('Sampled')}</dt><dd>${d.audit?.sampled || 0}</dd><dt>${t('Reviewed')}</dt><dd>${d.audit?.done || 0}</dd>
        <dt>${t('Average rating')}</dt><dd>${d.audit?.avg_rating ? d.audit.avg_rating.toFixed(1) + ' / 5' : '—'}</dd><dt>${t('Flagged unsafe')}</dt><dd>${d.audit?.unsafe || 0}</dd></dl></div>
    </div>`;
}

// ---------- users ----------
function Users() {
  const s = useAppState();
  const d = useLoad(() => api('/api/admin/users'), []);
  const [edit, setEdit] = useState(null);
  const [pinShown, setPinShown] = useState(null);
  const [filter, setFilter] = useState('');
  const resetPin = async u => {
    if (!confirm(`${t('Reset the PIN for')} ${u.name}?`)) return;
    try { const r = await api(`/api/admin/users/${u.id}/reset-pin`, { method: 'POST' }); setPinShown({ name: u.name, phone: u.phone, pin: r.temporary_pin }); } catch (e) { toast(e.message, true); }
  };
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const users = d.data.users.filter(u => !filter || u.role === filter);
  return html`
    <div class="row between"><h1 style="margin:0">${s.user.role === 'coordinator' ? t('Field workers') : t('Users')}</h1><button class="btn primary" onClick=${() => setEdit({})}>${t('Add user')}</button></div>
    ${pinShown && html`<div class="callout ok" style="margin:12px 0"><strong>${pinShown.name}</strong> (${pinShown.phone}) — ${t('temporary PIN')}: <strong style="font-size:1.3rem;letter-spacing:.2em">${pinShown.pin}</strong>
      <p class="small">${t('Give this PIN to the person in person or by phone call. They must change it at first sign-in. It will not be shown again.')}</p>
      <button class="btn" onClick=${() => setPinShown(null)}>${t('Done')}</button></div>`}
    ${edit && html`<${UserForm} u=${edit} onDone=${r => { setEdit(null); if (r?.temporary_pin) setPinShown(r); d.reload(); }} />`}
    ${(MANAGES[s.user.role] || []).length > 2 && html`<div class="row" style="margin:12px 0"><select style="max-width:220px" value=${filter} onChange=${e => setFilter(e.target.value)}>
      <option value="">${t('All roles')}</option>${MANAGES[s.user.role].map(r => html`<option value=${r}>${t(roleName(r))}</option>`)}</select></div>`}
    <div class="table-wrap" style="margin-top:12px"><table class="t">
      <thead><tr><th>${t('Name')}</th><th>${t('Role')}</th><th>${t('Mobile')}</th><th>${t('Area / registration')}</th><th></th></tr></thead>
      <tbody>${users.map(u => html`<tr style=${u.active ? '' : 'opacity:.55'}>
        <td><strong>${u.name}</strong>${u.must_change ? html` <span class="chip warn">${t('PIN not set')}</span>` : ''}${!u.active ? html` <span class="chip">${t('inactive')}</span>` : ''}</td>
        <td>${t(roleName(u.role))}</td><td>${u.phone}</td>
        <td class="small">${u.role === 'dentist' ? `${u.reg_council || ''} ${u.reg_number || ''}${u.reg_verified_at ? ' ✓' : ''}` : [u.lsgd_name, u.ward && `${t('ward')} ${u.ward}`, u.district].filter(Boolean).join(', ')}</td>
        <td class="nowrap"><button class="btn link" onClick=${() => setEdit(u)}>${t('Edit')}</button><button class="btn link" onClick=${() => resetPin(u)}>${t('Reset PIN')}</button></td></tr>`)}</tbody></table></div>`;
}

function UserForm({ u, onDone }) {
  const s = useAppState();
  const coord = s.user.role === 'coordinator';
  const [f, setF] = useState({ role: u.role || ((MANAGES[s.user.role] || []).includes('worker') ? 'worker' : 'dentist'), name: u.name || '', phone: u.phone || '', email: u.email || '', organisation: u.organisation || '',
    state: u.state || (coord ? s.user.state : 'Kerala'), district: u.district || (coord ? s.user.district : ''), lsgd_type: u.lsgd_type || '', lsgd_name: u.lsgd_name || '', ward: u.ward || '',
    reg_council: u.reg_council || 'Kerala State Dental Council', reg_number: u.reg_number || '', reg_verified: false, active: u.active !== 0, content_lang: u.content_lang || 'ml', pincode: u.pincode || '' });
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const lsgds = (s.ref?.lsgds || []).filter(l => l.district === f.district && (!f.lsgd_type || l.kind === f.lsgd_type));
  useEffect(() => { loadRef(); }, []);
  const save = async e => {
    e.preventDefault();
    try {
      const r = u.id ? await api('/api/admin/users/' + u.id, { method: 'PATCH', body: f }) : await api('/api/admin/users', { method: 'POST', body: f });
      toast(t('Saved'));
      onDone(r.temporary_pin ? { name: f.name, phone: f.phone, temporary_pin: r.temporary_pin, pin: r.temporary_pin } : null);
    } catch (e2) { toast(e2.message, true); }
  };
  return html`<form class="panel stack" style="margin-top:12px" onSubmit=${save}>
    <h2>${u.id ? t('Edit user') : t('New user')}</h2>
    ${!coord && html`<${Field} label=${t('Role')}><select value=${f.role} onChange=${set('role')}>${(MANAGES[s.user.role] || []).map(r => html`<option value=${r}>${t(roleName(r))}</option>`)}</select><//>`}
    <div class="grid-2"><${Field} label=${t('Name')}><input type="text" value=${f.name} onInput=${set('name')} required /><//>
      <${Field} label=${t('Mobile (10 digits)')}><input type="tel" value=${f.phone} onInput=${set('phone')} required /><//></div>
    <div class="grid-2"><${Field} label=${t('Email (optional)')}><input type="email" value=${f.email} onInput=${set('email')} /><//>
      <${Field} label=${t('Organisation')}><input type="text" value=${f.organisation} onInput=${set('organisation')} /><//></div>
    ${(f.role === 'worker' || f.role === 'coordinator') && html`
      <div class="grid-2"><${Field} label=${t('State')}><select value=${f.state} onChange=${set('state')} disabled=${coord}>${STATES.map(x => html`<option>${x}</option>`)}</select><//>
        <${Field} label=${t('District')}><${DistrictInput} state=${f.state} value=${f.district} disabled=${coord} onChange=${x => setF({ ...f, district: x })} /><//></div>
      ${f.role === 'worker' && html`<div class="grid-3">
        <${Field} label=${t('LSGD type')}><select value=${f.lsgd_type} onChange=${set('lsgd_type')}><option value="">—</option>${LSGD_TYPES.map(x => html`<option value=${x.key}>${L(x)}</option>`)}</select><//>
        <${Field} label=${t('LSGD name')}><input type="text" list="u-lsgd" value=${f.lsgd_name} onInput=${set('lsgd_name')} /><datalist id="u-lsgd">${lsgds.map(l => html`<option value=${l.name} />`)}</datalist><//>
        <${Field} label=${t('Ward')}><input type="text" value=${f.ward} onInput=${set('ward')} /><//></div>
        <${Field} label=${t('Postal PIN code (optional)')}><input type="text" inputmode="numeric" maxlength="6" style="max-width:160px" value=${f.pincode} onInput=${set('pincode')} /><//>
        <${Field} label=${t('Reads and writes in')}><select value=${f.content_lang} onChange=${set('content_lang')}>${LANGUAGES.map(l => html`<option value=${l.code}>${l.native}</option>`)}</select><//>`}`}
    ${f.role === 'dentist' && html`<div class="grid-2"><${Field} label=${t('Dental council')}><input type="text" value=${f.reg_council} onInput=${set('reg_council')} /><//>
      <${Field} label=${t('Registration number')}><input type="text" value=${f.reg_number} onInput=${set('reg_number')} /><//></div>
      <label class="choice"><input type="checkbox" checked=${f.reg_verified} onChange=${set('reg_verified')} /> ${t('I have checked this registration with the council')}</label>`}
    ${u.id && html`<label class="choice"><input type="checkbox" checked=${f.active} onChange=${set('active')} /> ${t('Active')}</label>`}
    <div class="btn-row"><button class="btn primary">${t('Save')}</button><button type="button" class="btn" onClick=${() => onDone(null)}>${t('Cancel')}</button></div>
  </form>`;
}

// ---------- reference lists ----------
const REF_DEFS = {
  referral_centres: { title: 'Referral centres', fields: [['name', 'Name'], ['kind', 'Type (e.g. Dental college, District hospital, PHC, Private)'], ['services', 'Services'], ['district', 'District'],
    ['address', 'Address'], ['timings', 'Timings'], ['phone', 'Phone'], ['cost_category', 'Cost (Free / Subsidised / Paid)'], ['accessibility', 'Accessibility (ramp, wheelchair)']], list: ['name', 'district', 'services'] },
  kb_items: { title: 'Knowledge base', fields: [['title', 'Title (English)'], ['title_ml', 'Title (Malayalam)'], ['kind', 'Kind', ['video', 'leaflet', 'pictogram', 'training']], ['url', 'Link (https://…)'],
    ['language', 'Language', ['en', 'ml', 'ta', 'kn', 'te', 'hi', 'mr']], ['audience', 'For', ['patient', 'caregiver', 'worker', 'dentist']], ['tags', 'Tags (comma separated)']], list: ['title', 'kind', 'audience'] },
  glossary: { title: 'Glossary', fields: [['en', 'English term'], ['ml', 'Malayalam term'], ['notes', 'Notes']], list: ['en', 'ml'] },
  lsgds: { title: 'Local bodies (LSGDs)', fields: [['state', 'State'], ['district', 'District'], ['kind', 'Type', LSGD_TYPES.map(x => x.key)], ['name', 'Name'], ['name_ml', 'Name in Malayalam'], ['lgd_code', 'LGD code']], list: ['district', 'name', 'kind'] },
};

function RefList({ table }) {
  const s = useAppState();
  const def = REF_DEFS[table];
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const key = { referral_centres: 'referral_centres', kb_items: 'kb_items', glossary: 'glossary', lsgds: 'lsgds' }[table];
  const load = async () => { const ref = await loadRef(true); setRows(ref[key] || []); };
  useEffect(() => { load(); }, [table]);
  const save = async e => {
    e.preventDefault();
    try { if (edit.id) await api(`/api/admin/${table}/${edit.id}`, { method: 'PUT', body: edit }); else await api(`/api/admin/${table}`, { method: 'POST', body: edit }); toast(t('Saved')); setEdit(null); load(); }
    catch (e2) { toast(e2.message, true); }
  };
  const del = async r => { if (!confirm(t('Remove this item?'))) return; try { await api(`/api/admin/${table}/${r.id}`, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, true); } };
  const approve = async r => { try { await api(`/api/admin/kb_items/${r.id}/approve`, { method: 'POST' }); toast(t('Approved')); load(); } catch (e) { toast(e.message, true); } };
  const importCsv = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const r = await api('/api/admin/lsgds/import', { method: 'POST', raw: await file.text(), headers: { 'content-type': 'text/csv' } }); toast(`${r.imported} ${t('imported')}`); load(); } catch (e2) { toast(e2.message, true); }
  };
  const loadKerala = async () => {
    try { const csv = await fetch('/data/kerala-lsgds.csv').then(r => r.text()); const r = await api('/api/admin/lsgds/import', { method: 'POST', raw: csv, headers: { 'content-type': 'text/csv' } }); toast(`${r.imported} ${t('imported')}`); load(); }
    catch (e) { toast(e.message, true); }
  };
  if (!rows) return html`<${Loading} />`;
  const canEdit = ADMINS.includes(s.user.role) || (s.user.role === 'clinical_admin' && (table === 'kb_items' || table === 'glossary'));
  const shown = rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return html`
    <div class="row between"><h1 style="margin:0">${t(def.title)}</h1>${canEdit && html`<button class="btn primary" onClick=${() => setEdit({})}>${t('Add')}</button>`}</div>
    ${table === 'lsgds' && canEdit && html`<div class="callout info small" style="margin:12px 0">${t('Import a CSV with columns: state, district, kind (grama_panchayat / municipality / corporation), name, name_ml, lgd_code.')}
      <div class="row" style="margin-top:8px"><input type="file" accept=".csv,text/csv" onChange=${importCsv} style="width:auto" />
      <button class="btn" onClick=${loadKerala}>${t('Load all Kerala local bodies (1,034)')}</button></div>
      <p class="tiny" style="margin-top:6px">${t('Kerala list: © OpenStreetMap contributors (ODbL), via the OSM Kerala community.')}</p></div>`}
    ${table === 'kb_items' && html`<p class="muted small">${t('Items must be approved by the clinical governance group before dentists share them.')}</p>`}
    ${edit && html`<form class="panel stack" style="margin:12px 0" onSubmit=${save}>${def.fields.map(([k, label, opts]) => html`<${Field} label=${t(label)}>${opts
      ? html`<select value=${edit[k] || ''} onChange=${e => setEdit({ ...edit, [k]: e.target.value })}><option value="">—</option>${opts.map(o => html`<option value=${o}>${o}</option>`)}</select>`
      : html`<input type="text" value=${edit[k] || ''} onInput=${e => setEdit({ ...edit, [k]: e.target.value })} />`}<//>`)}
      <div class="btn-row"><button class="btn primary">${t('Save')}</button><button type="button" class="btn" onClick=${() => setEdit(null)}>${t('Cancel')}</button></div></form>`}
    <input type="search" placeholder=${t('Search')} value=${q} onInput=${e => setQ(e.target.value)} style="margin:12px 0" />
    ${shown.length === 0 ? html`<div class="panel empty">${t('Nothing here yet.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr>${def.list.map(k => html`<th>${t(def.fields.find(f => f[0] === k)?.[1].split(' (')[0] || k)}</th>`)}${table === 'kb_items' ? html`<th>${t('Approved')}</th>` : ''}<th></th></tr></thead>
      <tbody>${shown.slice(0, 300).map(r => html`<tr>${def.list.map(k => html`<td>${k === 'title' && r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r[k]}</a>` : r[k]}</td>`)}
        ${table === 'kb_items' ? html`<td>${r.approved_at ? fmtDate(r.approved_at) : html`<button class="btn link" onClick=${() => approve(r)}>${t('Approve')}</button>`}</td>` : ''}
        <td class="nowrap">${canEdit && html`<button class="btn link" onClick=${() => setEdit(r)}>${t('Edit')}</button><button class="btn link" onClick=${() => del(r)}>${t('Remove')}</button>`}</td></tr>`)}</tbody></table></div>
      ${shown.length > 300 ? html`<p class="tiny">${t('Showing first 300. Use search to narrow.')}</p>` : ''}`}`;
}

function Settings() {
  const s = useAppState();
  const [f, setF] = useState(null);
  useEffect(() => { loadRef(true).then(r => setF({ ...r.settings })); }, []);
  if (!f) return html`<${Loading} />`;
  const save = async e => { e.preventDefault(); try { await api('/api/admin/settings', { method: 'POST', body: f }); toast(t('Saved')); loadRef(true); } catch (e2) { toast(e2.message, true); } };
  const sup = s.user.role === 'superadmin';
  const num = (k, label, hint, off) => html`<${Field} label=${t(label)} hint=${hint && t(hint)}><input type="number" disabled=${off} value=${f[k]} onInput=${e => setF({ ...f, [k]: e.target.value })} /><//>`;
  return html`<h1>${t('Settings')}</h1><form class="panel stack" onSubmit=${save}>
    ${num('claim_minutes', 'Minutes a case stays reserved for a dentist')}
    ${num('sla_urgent_hours', 'Target hours for urgent cases')}
    ${num('sla_routine_hours', 'Target hours for routine cases')}
    ${num('audit_sample_percent', 'Percent of opinions sampled for clinical audit')}
    ${num('small_cell_threshold', 'Hide counts below this number in exports')}
    <h2 style="margin-top:12px">${t('Privacy notice details')}</h2>
    <p class="small muted">${t('These appear in the notice read to every person. The notice is incomplete until all are filled.')} ${t('Notice version')}: <strong>${CONSENT_VERSION}</strong>${isDraft(CONSENT_VERSION) ? ' — ' + t('awaiting legal approval') : ''}. <a href="/privacy.html" target="_blank" rel="noopener">${t('View notice')}</a></p>
    ${[['org_legal_name', 'Organisation legal name'], ['org_address', 'Registered address'], ['grievance_name', 'Grievance officer / data protection contact (name and designation)'],
      ['grievance_phone', 'Grievance phone'], ['grievance_email', 'Grievance email']].map(([k, label]) => html`<${Field} label=${t(label)}><input type="text" disabled=${!sup} value=${f[k] || ''} onInput=${e => setF({ ...f, [k]: e.target.value })} /><//>`)}
    ${num('retention_years', 'Years to keep identifiable records after the last visit', null, !sup)}
    ${num('grievance_days', 'Days within which grievances are answered', null, !sup)}
    ${!sup && html`<p class="tiny muted">${t('Only the CIF super admin can change the privacy notice details.')}</p>`}
    <p class="small muted">${t('Photo storage')}: ${s.ref?.media_backend === 'r2' ? 'Cloudflare R2' : t('interim database (enable R2 before scale-up)')}</p>
    <div class="btn-row"><button class="btn primary">${t('Save')}</button></div></form>`;
}

function AccessLog() {
  const [entries, setEntries] = useState(null);
  const load = async before => { const r = await api('/api/admin/audit-log' + (before ? '?before=' + before : '')); setEntries(prev => (before ? [...prev, ...r.entries] : r.entries)); };
  useEffect(() => { load(); }, []);
  if (!entries) return html`<${Loading} />`;
  return html`<h1>${t('Access log')}</h1><p class="muted">${t('Every sign-in, view, change and export is recorded here and cannot be edited.')}</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>${t('When (UTC)')}</th><th>${t('Who')}</th><th>${t('Action')}</th><th>${t('Record')}</th></tr></thead>
    <tbody>${entries.map(e => html`<tr><td class="nowrap small">${e.at}</td><td class="small">${e.user_name || '—'} <span class="tiny">${e.role || ''}</span></td><td>${e.action}</td>
      <td class="small">${e.object_type || ''} ${e.object_id || ''}</td></tr>`)}</tbody></table></div>
    ${entries.length >= 200 && html`<button class="btn" style="margin-top:12px" onClick=${() => load(entries.at(-1).id)}>${t('Older entries')}</button>`}`;
}

function ConsentLog() {
  const d = useLoad(() => api('/api/admin/consents'), []);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  return html`<h1>${t('Consent log')}</h1><div class="table-wrap"><table class="t"><thead><tr><th>${t('Person ID')}</th><th>${t('Consent')}</th><th>${t('Given')}</th>
    <th>${t('How')}</th><th>${t('Capacity')}</th><th>${t('Decided by')}</th><th>${t('Notice')}</th><th>${t('Recorded')}</th><th>${t('Withdrawn')}</th></tr></thead>
    <tbody>${d.data.consents.map(c => html`<tr><td>${c.person_id}</td><td>${c.layer}</td><td>${c.granted ? t('Yes') : t('No')}</td><td class="small">${c.method}</td><td class="small">${c.capacity}</td><td class="small">${c.decider_type || ''}</td>
      <td class="small">${c.notice_version}</td><td class="small nowrap">${c.recorded_at}</td><td class="small">${c.withdrawn_at || ''} ${c.withdrawn_reason || ''}</td></tr>`)}</tbody></table></div>`;
}

function Exports() {
  return html`<h1>${t('Exports')}</h1>
    <div class="panel stack"><h2>${t('Indicators')}</h2><p>${t('Aggregate indicators by district, age band and status. Small counts are hidden.')}</p>
      <a class="btn" href="/api/admin/indicators.csv">${t('Download indicators (CSV)')}</a></div>
    <div class="panel stack"><h2>${t('Research extract')}</h2><p>${t('One row per visit for people who gave research consent. No names, contacts or Person IDs — each person has a coded subject number. Use only under an approved ethics protocol.')}</p>
      <a class="btn" href="/api/research/extract.csv">${t('Download research extract (CSV)')}</a></div>`;
}

// ---------- clinical audit ----------
export function AuditQueue() {
  const d = useLoad(() => api('/api/audit/queue'), []);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const s = state.user;
  return html`<div class="row between"><h1 style="margin:0">${t('Clinical audit')}</h1>${s.role === 'auditor' && html`<a class="btn" href="#/admin/kb_items">${t('Knowledge base')}</a>`}${s.role === 'admin' && html`<a class="btn" href="#/admin">${t('Back to admin')}</a>`}</div>
    <p class="muted">${t('A random sample of signed opinions. Rate each for clinical quality and safety.')}</p>
    ${d.data.items.length === 0 ? html`<div class="panel empty">${t('No opinions sampled yet.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr><th>${t('Signed')}</th><th>${t('Dentist')}</th><th>${t('Person')}</th><th>${t('Impression')}</th><th>${t('Rating')}</th></tr></thead>
      <tbody>${d.data.items.map(i => html`<tr><td class="nowrap"><a href=${'#/audit/' + i.id}>${fmtDate(i.signed_at)}</a></td><td class="small">${i.dentist?.name || '—'}</td>
        <td class="small">${i.sex}, ${i.age_band} · ${i.district} <${UrgencyChip} u=${i.urgency} /></td><td class="small">${i.impression || '—'}</td>
        <td>${i.rating ? html`${i.rating}/5 ${i.safe ? '' : html`<span class="chip urgent">${t('unsafe')}</span>`}` : html`<a class="btn" href=${'#/audit/' + i.id}>${t('Review')}</a>`}</td></tr>`)}</tbody></table></div>`}`;
}

export function AuditCase({ id }) {
  const d = useLoad(() => api('/api/audit/opinions/' + id), [id]);
  const [f, setF] = useState(null);
  useEffect(() => { if (d.data) setF({ rating: d.data.audit?.rating || null, safe: d.data.audit ? !!d.data.audit.safe : true, notes: d.data.audit?.notes || '' }); }, [d.data]);
  if (d.loading || d.error || !f) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { opinion: o, dentist, case: c, screening, images } = d.data;
  const save = async e => { e.preventDefault(); try { await api('/api/audit/opinions/' + id, { method: 'POST', body: f }); toast(t('Saved')); go('/audit'); } catch (e2) { toast(e2.message, true); } };
  return html`<a href="#/audit">‹ ${t('Clinical audit')}</a>
    <h1>${c.sex}, ${c.age_band} · ${c.district} <${UrgencyChip} u=${c.urgency} /></h1>
    <div class="workspace"><div class="stack">
      ${c.red_flags.length > 0 && html`<div class="callout urgent">${c.red_flags.map(k => RED_FLAGS.find(r => r.key === k)?.en).join('; ')}</div>`}
      <div class="panel"><h2>${t('Screening')}</h2><${ScreeningSummary} s=${screening} /></div>
      <div class="panel"><h2>${t('Photos')}</h2><${Thumbs} images=${images} labelFor=${v => PHOTO_VIEWS.find(x => x.key === v)?.en || v} /></div>
    </div><div class="opinion-col stack">
      <div class="panel"><h2>${t('Opinion')} <span class="muted small">v${o.version} · ${dentist?.name} (${dentist?.reg_number})</span></h2>
        <dl class="kv"><dt>${t('Impression')}</dt><dd>${o.impression || '—'}</dd><dt>${t('Findings')}</dt><dd>${o.findings || '—'}</dd><dt>${t('Advice')}</dt><dd>${o.advice || '—'}</dd>
          <dt>${t('Care plan')}</dt><dd>${o.care_plan || '—'}</dd><dt>${t('Referral')}</dt><dd>${o.referral_needed ? `${REFERRAL_TYPES.find(r => r.key === o.referral_type)?.en} · ${o.referral_urgency}` : t('No')}</dd>
          <dt>${t('Follow-up')}</dt><dd>${o.followup_months ? o.followup_months + ' ' + t('months') : '—'}</dd></dl></div>
      <form class="panel stack" onSubmit=${save}><h2>${t('Your review')}</h2>
        <${Field} label=${t('Clinical quality (1 poor – 5 excellent)')}><${Choices} name="rt" value=${f.rating} onChange=${v => setF({ ...f, rating: v })} options=${[1, 2, 3, 4, 5].map(n => ({ key: n, label: String(n) }))} /><//>
        <${Field} label=${t('Was the advice safe?')}><${Choices} name="sf" value=${f.safe ? 'y' : 'n'} onChange=${v => setF({ ...f, safe: v === 'y' })} options=${[{ key: 'y', label: t('Safe') }, { key: 'n', label: t('Not safe — needs action') }]} /><//>
        <${Field} label=${t('Feedback for the dentist')}><textarea value=${f.notes} onInput=${e => setF({ ...f, notes: e.target.value })}></textarea><//>
        <button class="btn primary">${t('Save review')}</button></form>
    </div></div>`;
}
