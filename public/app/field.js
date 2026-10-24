// Field-worker screens: home, people, a person's record, a case with the dentist's opinion.
import { html, answerLines, useState, useEffect, state, useAppState, go, t, L, toast, useLoad, Loading, Field, Choices, TranslatedText, Thumbs, ago, fmtDate,
  UrgencyChip, StatusChip, Smile, Icon, youtubeEmbed, loadRef, uiLang, tIn, adviceIn } from './ui.js';
import { loadLang } from './i18n.js';
import { api, removeOutbox } from './api.js';
import { refreshOutbox, runSync } from './main.js';
import { RED_FLAGS, REFERRAL_TYPES, PHOTO_VIEWS, COMPLAINTS, OHAT_ITEMS } from '/shared/clinical.js';

const personLine = p => p ? `${p.name}${p.ward ? ` · ${t('ward')} ${p.ward}` : ''}` : '';

export function WorkerHome() {
  const s = useAppState();
  const d = useLoad(() => api('/api/worker/home'), []);
  const pending = s.outbox || [];
  return html`
    <h1>${t('Hello')}, ${s.user.name.split(' ')[0]}</h1>
    <a class="btn primary big" href="#/visit">${Icon.plus} ${t('Start a home visit')}</a>
    ${pending.length > 0 && html`<div class="callout warn" style="margin-top:16px"><div class="row between">
      <span>${pending.length} ${t('visit(s) saved on this phone, not yet sent')}</span>
      <a class="btn" href="#/outbox">${t('View')}</a></div></div>`}
    ${d.loading || d.error ? html`<${Loading} error=${d.error} retry=${d.reload} />` : html`
      ${section(t('Questions from the dentist'), d.data.info_requests, r => html`<a class="item" href=${'#/case/' + r.id}>
        <span class="grow"><span class="title">${personLine(r.person)}</span><br /><span class="small muted">${r.message.slice(0, 90)}</span></span><span class="chip warn">${t('Reply')}</span></a>`)}
      ${section(t('Opinions ready to explain'), d.data.opinions_ready, r => html`<a class="item" href=${'#/case/' + r.id}>
        <span class="grow"><span class="title">${personLine(r.person)}</span><br /><span class="small muted">${ago(r.opinion_at)}</span></span>
        ${r.referral_needed ? html`<span class="chip warn">${t('Referral')}</span>` : html`<span class="chip routine">${t('Advice')}</span>`}</a>`)}
      ${section(t('Follow-up visits due'), d.data.followups_due, r => html`<a class="item" href=${'#/people/' + r.person_id}>
        <span class="grow"><span class="title">${personLine(r.person)}</span><br /><span class="small muted">${t('Due')} ${fmtDate(r.due_date)}</span></span>
        <span class=${'chip ' + (r.due_date < new Date().toISOString().slice(0, 10) ? 'urgent' : 'gold')}>${t('Visit')}</span></a>`)}
      ${section(t('Referral outcome to record'), d.data.referrals_pending, r => html`<a class="item" href=${'#/case/' + r.id}>
        <span class="grow title">${personLine(r.person)}</span><span class="chip info">${t('Did they go?')}</span></a>`)}
      ${section(t('Waiting for a dentist'), d.data.awaiting_dentist, r => html`<a class="item" href=${'#/case/' + r.id}>
        <span class="grow"><span class="title">${personLine(r.person)}</span><br /><span class="small muted">${t('Sent')} ${ago(r.submitted_at)}</span></span><${UrgencyChip} u=${r.urgency} /></a>`)}
    `}`;
}

function section(title, rows, item) {
  if (!rows?.length) return '';
  return html`<div class="section-title"><h2>${title}</h2><span class="chip">${rows.length}</span></div>
    <ul class="list">${rows.map(r => html`<li>${item(r)}</li>`)}</ul>`;
}

export function PeopleList() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const h = setTimeout(() => setQuery(q), 300); return () => clearTimeout(h); }, [q]);
  const d = useLoad(() => api('/api/persons' + (query ? '?q=' + encodeURIComponent(query) : '')), [query]);
  return html`
    <div class="row between"><h1>${t('People')}</h1><a class="btn primary" href="#/visit">${t('New person')}</a></div>
    <input type="search" placeholder=${t('Search by name, phone or Person ID')} value=${q} onInput=${e => setQ(e.target.value)} aria-label=${t('Search')} style="margin-bottom:12px" />
    ${d.loading || d.error ? html`<${Loading} error=${d.error} retry=${d.reload} />` : d.data.persons.length === 0
      ? html`<div class="panel empty">${query ? t('No one matches that search.') : t('No one enrolled yet. Start a home visit to add the first person.')}</div>`
      : html`<ul class="list">${d.data.persons.map(p => html`<li><a class="item" href=${'#/people/' + p.id}>
          <span class="grow"><span class="title">${p.name}</span> <span class="muted small">${p.sex} · ${p.birth_year ? new Date().getFullYear() - p.birth_year + ' ' + t('yrs') : ''}</span><br />
          <span class="small muted">${p.id} · ${p.lsgd_name}${p.ward ? ', ' + t('ward') + ' ' + p.ward : ''}</span></span>
          ${p.status !== 'active' ? html`<span class="chip">${t(p.status)}</span>` : p.latest_case ? html`<${StatusChip} s=${p.latest_case.status} />` : ''}
        </a></li>`)}</ul>`}`;
}

export function PersonView({ id }) {
  const d = useLoad(() => api('/api/persons/' + id), [id]);
  const [editing, setEditing] = useState(false);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { person: p, consents, cases, followups } = d.data;
  const active = layer => consents.find(c => c.layer === layer && c.granted && !c.withdrawn_at);
  const withdraw = async layer => {
    const reason = prompt(t('Reason for withdrawing consent (optional)'));
    if (reason === null) return;
    try { await api(`/api/persons/${id}/withdraw-consent`, { method: 'POST', body: { layer, reason } }); toast(t('Consent withdrawn')); d.reload(); } catch (e) { toast(e.message, true); }
  };
  return html`
    <div class="row between"><h1 style="margin:0">${p.name}</h1>${p.status === 'active' && html`<a class="btn primary" href=${'#/visit/' + p.id}>${t('New visit')}</a>`}</div>
    <p class="muted">${p.id} · ${p.sex} · ${p.birth_year ? `${t('born')} ${p.birth_year} (${new Date().getFullYear() - p.birth_year} ${t('yrs')})` : ''}</p>
    ${p.status !== 'active' && html`<div class="callout warn">${t('Status')}: ${t(p.status)} ${p.status_reason ? '— ' + p.status_reason : ''}</div>`}
    ${followups.length > 0 && html`<div class="callout info" style="margin-bottom:12px">${t('Next screening due')} ${fmtDate(followups[0].due_date)}</div>`}
    <div class="panel">
      <dl class="kv">
        <dt>${t('Address')}</dt><dd>${p.address || '—'}${p.pincode ? ' – ' + p.pincode : ''}</dd>
        <dt>${t('Area')}</dt><dd>${p.lsgd_name}${p.ward ? `, ${t('ward')} ${p.ward}` : ''} · ${p.district}, ${p.state}</dd>
        <dt>${t('Phone')}</dt><dd>${p.phone || '—'}</dd>
        ${p.caregiver_name && html`<dt>${t('Caregiver')}</dt><dd>${p.caregiver_name} (${p.caregiver_relation || ''}) ${p.caregiver_phone || ''}</dd>`}
      </dl>
      <div class="btn-row" style="margin-top:12px"><button class="btn" onClick=${() => setEditing(!editing)}>${t('Update details or status')}</button></div>
      ${editing && html`<${PersonEdit} p=${p} onDone=${() => { setEditing(false); d.reload(); }} />`}
    </div>
    <div class="section-title"><h2>${t('Visits')}</h2></div>
    ${cases.length === 0 ? html`<div class="panel empty">${t('No visits yet')}</div>` : html`<ul class="list">${cases.map(c => html`<li><a class="item" href=${'#/case/' + c.id}>
      <span class="grow"><span class="title">${fmtDate(c.submitted_at)}</span> <span class="small muted">${t(c.visit_type)}</span><br />
      <span class="small muted">OHAT ${c.ohat_total ?? '—'} · GOHAI ${c.gohai_total ?? '—'} · ${t('teeth')} ${c.natural_teeth ?? '—'}</span></span>
      <${UrgencyChip} u=${c.urgency} /> <${StatusChip} s=${c.status} /></a></li>`)}</ul>`}
    ${cases.length > 1 && html`<${Trend} cases=${cases} />`}
    <div class="section-title"><h2>${t('Consent')}</h2></div>
    <div class="panel"><table class="t"><tbody>
      ${['care', 'photos', 'research', 'messaging'].map(l => html`<tr><td>${t(consentLabel(l))}</td>
        <td>${active(l) ? html`<span class="chip routine">${t('Given')}</span> <span class="tiny">${fmtDate(active(l).recorded_at)}</span>` : html`<span class="chip">${t('Not given')}</span>`}</td>
        <td class="right">${active(l) && html`<button class="btn link" onClick=${() => withdraw(l)}>${t('Withdraw')}</button>`}</td></tr>`)}
    </tbody></table></div>`;
}

export function consentLabel(l) {
  return { care: 'Screening and dentist opinion', photos: 'Mouth photos', research: 'Coded use for approved research', messaging: 'SMS/WhatsApp messages', abha: 'ABHA health ID link' }[l];
}

function Trend({ cases }) {
  const rows = [...cases].reverse();
  return html`<div class="panel" style="margin-top:12px"><h3>${t('Change over time')}</h3><div class="table-wrap"><table class="t">
    <thead><tr><th>${t('Date')}</th><th class="num">OHAT</th><th class="num">GOHAI</th><th class="num">${t('Teeth')}</th></tr></thead>
    <tbody>${rows.map(c => html`<tr><td>${fmtDate(c.submitted_at)}</td><td class="num">${c.ohat_total ?? '—'}</td><td class="num">${c.gohai_total ?? '—'}</td><td class="num">${c.natural_teeth ?? '—'}</td></tr>`)}</tbody>
  </table></div><p class="tiny">${t('OHAT: lower is healthier (0–16). GOHAI: higher is better (12–60).')}</p></div>`;
}

function PersonEdit({ p, onDone }) {
  const [f, setF] = useState({ phone: p.phone || '', address: p.address || '', caregiver_name: p.caregiver_name || '', caregiver_phone: p.caregiver_phone || '',
    caregiver_relation: p.caregiver_relation || '', status: p.status, status_reason: p.status_reason || '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); try { await api('/api/persons/' + p.id, { method: 'PATCH', body: f }); toast(t('Saved')); onDone(); } catch (e2) { toast(e2.message, true); } };
  return html`<form class="stack" style="margin-top:12px" onSubmit=${save}>
    <div class="grid-2"><${Field} label=${t('Phone')}><input type="tel" value=${f.phone} onInput=${set('phone')} /><//>
      <${Field} label=${t('Status')}><select value=${f.status} onChange=${set('status')}>${['active', 'migrated', 'died', 'lost'].map(s => html`<option value=${s}>${t(s)}</option>`)}</select><//></div>
    <${Field} label=${t('Address')}><input type="text" value=${f.address} onInput=${set('address')} /><//>
    <div class="grid-3"><${Field} label=${t('Caregiver name')}><input type="text" value=${f.caregiver_name} onInput=${set('caregiver_name')} /><//>
      <${Field} label=${t('Relation')}><input type="text" value=${f.caregiver_relation} onInput=${set('caregiver_relation')} /><//>
      <${Field} label=${t('Caregiver phone')}><input type="tel" value=${f.caregiver_phone} onInput=${set('caregiver_phone')} /><//></div>
    ${f.status !== 'active' && html`<${Field} label=${t('Reason')}><input type="text" value=${f.status_reason} onInput=${set('status_reason')} /><//>`}
    <div class="btn-row"><button class="btn primary">${t('Save')}</button></div>
  </form>`;
}

// ---------- a case, with the dentist's opinion ----------
export function CaseView({ id }) {
  const s = useAppState();
  const d = useLoad(() => api('/api/cases/' + id), [id]);
  const [patientMode, setPatientMode] = useState(false);
  const [showTx, setShowTx] = useState(s.user.translate_on);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { case: c, person, screening, images, opinion, kb, info_requests, referral } = d.data;
  const target = s.user.content_lang || uiLang();
  const viewLabel = v => L(PHOTO_VIEWS.find(x => x.key === v)) || v;
  const openQ = info_requests.find(r => !r.resolved_at);
  return html`
    <a href=${'#/people/' + person.id} class="small">‹ ${person.name}</a>
    <div class="row between" style="margin-top:4px"><h1 style="margin:0">${t('Visit')} ${fmtDate(c.submitted_at)}</h1><span class="row"><${UrgencyChip} u=${c.urgency} /><${StatusChip} s=${c.status} /></span></div>
    <p class="muted small">${c.id}</p>
    ${c.red_flags.length > 0 && html`<div class="callout urgent" style="margin-bottom:12px"><h3>${t('Warning signs found')}</h3>
      ${c.red_flags.map(k => { const r = RED_FLAGS.find(x => x.key === k); return html`<p><strong>${L(r)}</strong><br />${adviceIn(uiLang(), r)}</p>`; })}</div>`}

    ${openQ && html`<${InfoReply} caseId=${c.id} q=${openQ} target=${target} showTx=${showTx} onDone=${d.reload} />`}

    ${opinion ? html`
      <div class="panel stack">
        <div class="row between"><h2 style="margin:0">${t("Dentist's opinion")}</h2>
          ${opinion.text_lang !== target && html`<label class="switch"><input type="checkbox" role="switch" checked=${showTx} onChange=${e => setShowTx(e.target.checked)} /><span>${t('Translate')}</span></label>`}</div>
        <p class="tiny">${t('Reviewed by an AGeD volunteer dentist on')} ${fmtDate(opinion.signed_at)}. ${t('Advisory screening opinion, not a diagnosis or prescription.')}</p>
        ${opinion.cannot_assess ? html`<div class="callout warn">${t('The dentist could not assess this from the photos and answers. The person needs an in-person dental examination.')}</div>` : ''}
        ${[['impression', 'What the dentist sees'], ['advice', 'Advice'], ['care_plan', 'Care plan'], ['findings', 'Findings']].map(([k, label]) => opinion[k] && html`<div>
          <h3>${t(label)}</h3><${TranslatedText} text=${opinion[k]} lang=${opinion.text_lang} target=${target} show=${showTx} /></div>`)}
        ${opinion.referral_needed ? html`<div class="callout warn"><h3>${t('Referral needed')}</h3>
          <p><strong>${L(REFERRAL_TYPES.find(r => r.key === opinion.referral_type))}</strong> · ${t(urgencyLabel(opinion.referral_urgency))}</p>
          ${opinion.referral_message && html`<${TranslatedText} text=${opinion.referral_message} lang=${opinion.text_lang} target=${target} show=${showTx} />`}</div>` : ''}
        ${opinion.followup_months && html`<p>${t('Next screening in')} <strong>${opinion.followup_months} ${t('months')}</strong></p>`}
        <div class="btn-row">
          <button class="btn primary" onClick=${() => setPatientMode(true)}>${Icon.eye} ${t('Show to the person')}</button>
          <a class="btn" href=${'#/report/' + c.id}>${Icon.print} ${t('Report for referral')}</a>
        </div>
      </div>
      ${kb.length > 0 && html`<div class="panel stack"><h2>${t('Videos and leaflets')}</h2>${kb.map(k => html`<${KbItem} k=${k} />`)}</div>`}
      ${opinion.referral_needed ? html`<${ReferralOutcome} caseId=${c.id} referral=${referral} onDone=${d.reload} />` : ''}
    ` : c.status === 'submitted' && html`<div class="callout info">${t('Sent to the dentists. You will see the opinion here when it is ready.')}</div>`}

    <details class="panel" style="margin-top:16px"><summary><strong>${t('What you recorded')}</strong></summary>
      <${ScreeningSummary} s=${screening} />
      <h3 style="margin-top:12px">${t('Photos')}</h3><${Thumbs} images=${images} labelFor=${viewLabel} />
    </details>
    ${patientMode && html`<${PatientView} person=${person} opinion=${opinion} kb=${kb} target=${target} onClose=${() => setPatientMode(false)} />`}`;
}

function urgencyLabel(u) { return { within_24h: 'Within 24 hours', within_7d: 'Within 7 days', within_30d: 'Within a month', routine: 'When convenient' }[u] || u || ''; }

function InfoReply({ caseId, q, target, showTx, onDone }) {
  const [text, setText] = useState('');
  const send = async e => { e.preventDefault(); try { await api(`/api/cases/${caseId}/info-response`, { method: 'POST', body: { response: text } }); toast(t('Reply sent to the dentist')); onDone(); } catch (e2) { toast(e2.message, true); } };
  return html`<form class="callout warn stack" style="margin-bottom:16px" onSubmit=${send}>
    <h3>${t('The dentist asks')}</h3>
    <${TranslatedText} text=${q.message} lang=${q.message_lang} target=${target} show=${showTx} />
    <${Field} label=${t('Your reply')} hint=${t('You can type in your own language or English. To add a new photo, start a new visit for this person.')}><textarea value=${text} onInput=${e => setText(e.target.value)} required></textarea><//>
    <div class="btn-row"><button class="btn primary">${t('Send reply')}</button></div>
  </form>`;
}

function KbItem({ k }) {
  const yt = youtubeEmbed(k.url);
  const [play, setPlay] = useState(false);
  return html`<div>
    <div class="row between"><strong>${L({ en: k.title, ml: k.title_ml })}</strong><span class="chip">${t(k.kind)}</span></div>
    ${yt && play ? html`<div class="video-frame" style="margin-top:8px"><iframe src=${yt + '?autoplay=1&rel=0'} title=${k.title} allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`
      : html`<div class="btn-row" style="margin-top:6px">${yt ? html`<button class="btn" onClick=${() => setPlay(true)}>▶ ${t('Play here')}</button>` : ''}<a class="btn" href=${k.url} target="_blank" rel="noopener">${t('Open')}</a></div>`}
  </div>`;
}

function ReferralOutcome({ caseId, referral, onDone }) {
  const ref = state.ref || {};
  const [f, setF] = useState({ status: referral?.status || 'pending', reached_date: referral?.reached_date || '', treatment: referral?.treatment || '', barrier: referral?.barrier || '', centre_id: referral?.centre_id || '' });
  useEffect(() => { loadRef(); }, []);
  const save = async e => { e.preventDefault(); try { await api(`/api/cases/${caseId}/referral-outcome`, { method: 'POST', body: f }); toast(t('Saved')); onDone(); } catch (e2) { toast(e2.message, true); } };
  return html`<form class="panel stack" onSubmit=${save}>
    <h2>${t('Did the person get the referred care?')}</h2>
    <${Choices} name="ref-status" value=${f.status} onChange=${v => setF({ ...f, status: v })} options=${[
      { key: 'pending', label: t('Not yet known') }, { key: 'reached', label: t('Yes, went') }, { key: 'not_reached', label: t('No, did not go') }]} />
    ${f.status === 'reached' && html`<div class="grid-2">
      <${Field} label=${t('Date')}><input type="date" value=${f.reached_date} onInput=${e => setF({ ...f, reached_date: e.target.value })} /><//>
      <${Field} label=${t('Where')}><select value=${f.centre_id} onChange=${e => setF({ ...f, centre_id: e.target.value })}><option value="">—</option>
        ${(ref.referral_centres || []).map(r => html`<option value=${r.id}>${r.name}</option>`)}</select><//></div>
      <${Field} label=${t('What was done')}><input type="text" value=${f.treatment} onInput=${e => setF({ ...f, treatment: e.target.value })} /><//>`}
    ${f.status === 'not_reached' && html`<${Field} label=${t('Why not?')}><select value=${f.barrier} onChange=${e => setF({ ...f, barrier: e.target.value })}><option value="">—</option>
      ${['Cost', 'No one to accompany', 'Too far / transport', 'Too unwell to travel', 'Fear or not interested', 'Waiting for appointment', 'Other'].map(b => html`<option value=${b}>${t(b)}</option>`)}</select><//>`}
    <div class="btn-row"><button class="btn primary">${t('Save outcome')}</button></div>
  </form>`;
}

export function ScreeningSummary({ s }) {
  if (!s) return '';
  return html`<dl class="kv" style="margin-top:8px">
    <dt>OHAT</dt><dd>${s.ohat_total} / 16</dd>
    ${s.gohai_total != null && html`<dt>GOHAI</dt><dd>${s.gohai_total} / 60</dd>`}
    <dt>${t('Natural teeth')}</dt><dd>${s.natural_teeth ?? '—'}</dd>
    <dt>${t('Complaints')}</dt><dd>${s.complaints.map(k => L(COMPLAINTS.find(c => c.key === k))).join(', ') || '—'}</dd>
    ${s.complaint_text && html`<dt>${t('In their words')}</dt><dd>${s.complaint_text}</dd>`}
    ${OHAT_ITEMS.filter(it => s.ohat[it.key] > 0).map(it => html`<dt>${L(it)}</dt><dd><span class=${'score-dot s' + s.ohat[it.key]}></span>${L(it.levels[s.ohat[it.key]])}</dd>`)}
    ${[['teeth', s.extra, 'Dentures'], ['health', s.context, 'Health'], ['habits', s.risks, 'Habits']].map(([step, a, label]) => {
      const lines = answerLines(step, a || {});
      return lines.length ? html`<dt>${t(label)}</dt><dd>${lines.join(' · ')}</dd>` : '';
    })}
  </dl>`;
}

// The full-screen, large-type card the worker turns towards the older person.
function PatientView({ person, opinion, kb, target, onClose }) {
  const [tx, setTx] = useState({});
  const parts = ['impression', 'advice', 'care_plan'].filter(k => opinion[k]);
  useEffect(() => {
    if (opinion.text_lang === target) return;
    parts.forEach(k => api('/api/translate', { method: 'POST', body: { text: opinion[k], src: opinion.text_lang, tgt: target } })
      .then(r => setTx(x => ({ ...x, [k]: r.text }))).catch(() => {}));
  }, []);
  const [, setReady] = useState(0);
  useEffect(() => { loadLang(target).then(() => setReady(n => n + 1)); }, [target]);
  const tt = s => tIn(target, s);
  const headings = { impression: tt('What the dentist sees'), advice: tt('Advice'), care_plan: tt('Care plan'), refer: tt('Please see a dentist in person'),
    title: `${person.name} — ${tt("Dentist's opinion")}` };
  return html`<div class="patient-view" role="dialog" aria-modal="true" lang=${target}>
    <div class="pv-in">
      <${Smile} cls="pv-smile" />
      <h1>${headings.title}</h1>
      <div class="pv-text">
        ${parts.map(k => html`<div class="pv-block"><h2>${headings[k]}</h2><p>${opinion.text_lang === target ? opinion[k] : (tx[k] || opinion[k])}</p></div>`)}
        ${opinion.referral_needed ? html`<div class="pv-refer">${headings.refer}${opinion.referral_message ? '' : ''}</div>` : ''}
      </div>
      ${kb.filter(k => youtubeEmbed(k.url)).slice(0, 1).map(k => html`<div style="margin-top:20px"><${KbItem} k=${k} /></div>`)}
      ${opinion.text_lang !== target && html`<p class="tiny" style="margin-top:24px">${t('Machine translation — the original is authoritative')}</p>`}
    </div>
    <button class="btn primary big pv-close" style="width:auto;padding:0 32px" onClick=${onClose}>${t('Close')}</button>
  </div>`;
}

export function Outbox() {
  const s = useAppState();
  const items = s.outbox || [];
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); await runSync(); setBusy(false); };
  const drop = async id => { if (confirm(t('Delete this saved visit from the phone? It has not been sent.'))) { await removeOutbox(id); refreshOutbox(); } };
  return html`<h1>${t('Visits to send')}</h1>
    <p class="muted">${t('Visits are kept here, locked with your PIN, until there is internet.')}</p>
    ${items.length === 0 ? html`<div class="panel empty">${t('Everything has been sent.')}</div>` : html`
      <button class="btn primary big" disabled=${busy || !s.online} onClick=${send}>${busy ? t('Sending…') : s.online ? t('Send now') : t('Waiting for internet')}</button>
      <ul class="list" style="margin-top:12px">${items.map(i => html`<li><div class="item">
        <span class="grow"><span class="title">${i.label}</span><br /><span class="small muted">${fmtDate(i.created_at)} · ${i.photos} ${t('photos')}</span>
        ${i.error && html`<br /><span class="small" style="color:var(--red)">${i.error}</span>`}</span>
        <button class="btn link" onClick=${() => drop(i.id)}>${t('Delete')}</button></div></li>`)}</ul>`}`;
}
