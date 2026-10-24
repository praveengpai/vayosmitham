// Dentist screens: the queue of unseen cases, the review workspace, and the dentist's own past opinions.
// The dentist never receives a name, phone number or address — only age band, sex and district.
import { html, answerLines, useState, useEffect, state, useAppState, setState, go, t, L, toast, useLoad, Loading, Field, Choices, Switch, TranslatedText, Thumbs, ago, fmtDate,
  UrgencyChip, loadRef } from './ui.js';
import { api } from './api.js';
import { OHAT_ITEMS, GOHAI_OPTIONS, COMPLAINTS, RED_FLAGS, PHOTO_VIEWS, REFERRAL_TYPES, MEDICINE_FLAGS } from '/shared/clinical.js';

const sexLabel = s => ({ F: t('Female'), M: t('Male'), O: t('Other') }[s] || s);

export function DentistQueue() {
  const d = useLoad(() => api('/api/dentist/queue'), []);
  useEffect(() => { const h = setInterval(d.reload, 60000); return () => clearInterval(h); }, []);
  const open = async c => {
    try { await api(`/api/dentist/cases/${c.id}/claim`, { method: 'POST' }); go('/case/' + c.id); }
    catch (e) { toast(e.message, true); d.reload(); }
  };
  if (d.loading && !d.data) return html`<${Loading} />`;
  if (d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const cases = d.data.cases;
  const urgent = cases.filter(c => c.urgency === 'urgent').length;
  return html`
    <div class="row between"><h1 style="margin:0">${t('Cases waiting for an opinion')}</h1><button class="btn" onClick=${d.reload}>${t('Refresh')}</button></div>
    <p class="muted">${cases.length} ${t('waiting')}${urgent ? html` · <strong style="color:var(--red)">${urgent} ${t('urgent')}</strong>` : ''} · ${t('you have given')} ${d.data.my_opinion_count} ${t('opinions')}.
      ${t('Opening a case reserves it for you so no one else works on it.')}</p>
    ${cases.length === 0 ? html`<div class="panel empty">${t('No cases are waiting. Thank you.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr><th></th><th>${t('Person')}</th><th>${t('Complaints')}</th><th class="num">OHAT</th><th class="num">${t('Photos')}</th><th>${t('Waiting')}</th><th></th></tr></thead>
      <tbody>${cases.map(c => html`<tr>
        <td><${UrgencyChip} u=${c.urgency} />${c.mine ? html` <span class="chip gold">${t('Yours')}</span>` : ''}</td>
        <td>${sexLabel(c.sex)}, ${c.age_band}<br /><span class="tiny">${c.district}${c.bedbound ? ' · ' + t('bedbound') : ''}${c.previous_visits ? ` · ${c.previous_visits} ${t('earlier visit(s)')}` : ''}</span></td>
        <td class="small">${c.red_flags.map(k => html`<strong style="color:var(--red)">${L(RED_FLAGS.find(r => r.key === k))}</strong><br />`)}
          ${c.complaints.map(k => L(COMPLAINTS.find(x => x.key === k))).join(', ')}</td>
        <td class="num">${c.ohat_total ?? '—'}</td><td class="num">${c.photo_count}</td>
        <td class="nowrap small">${ago(c.submitted_at)}</td>
        <td><button class="btn primary" onClick=${() => open(c)}>${c.mine ? t('Continue') : t('Open')}</button></td></tr>`)}</tbody></table></div>`}`;
}

function useCountdown(until) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!until) return;
    const end = new Date(until.replace(' ', 'T') + 'Z').getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [until]);
  return left;
}

export function DentistCase({ id }) {
  const s = useAppState();
  const d = useLoad(() => api('/api/dentist/cases/' + id), [id]);
  useEffect(() => { loadRef(); }, []);
  const showTx = s.user.translate_on;
  const setTx = async v => {
    setState({ user: { ...s.user, translate_on: v } });
    api('/api/me/prefs', { method: 'PATCH', body: { translate_on: v } }).catch(() => {});
  };
  const left = useCountdown(d.data?.case?.claim_expires);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  const { case: c, screening: sc, images, opinions, info_requests, history } = d.data;
  const target = 'en';
  const reclaim = async () => { try { await api(`/api/dentist/cases/${id}/claim`, { method: 'POST' }); d.reload(); } catch (e) { toast(e.message, true); go('/'); } };
  const release = async () => { await api(`/api/dentist/cases/${id}/release`, { method: 'POST' }).catch(() => {}); go('/'); };
  const viewLabel = v => L(PHOTO_VIEWS.find(x => x.key === v)) || v;
  const current = opinions.find(o => !o.superseded_by);

  return html`
    <div class="row between no-print">
      <a href="#/">‹ ${t('Queue')}</a>
      <div class="row">
        <${Switch} checked=${showTx} onChange=${setTx} label=${t('Translate to English')} />
        ${c.holds && html`<span class=${'chip ' + (left < 300 ? 'urgent' : 'info')}>${t('Reserved for you')} <span class="timer">${Math.floor((left ?? 0) / 60)}:${String((left ?? 0) % 60).padStart(2, '0')}</span></span>
          ${left < 300 && html`<button class="btn" onClick=${reclaim}>${t('More time')}</button>`}
          <button class="btn" onClick=${release}>${t('Put back in queue')}</button>`}
      </div>
    </div>
    <h1 style="margin-top:8px">${sexLabel(c.sex)}, ${c.age_band} ${t('years')} <span class="muted small">· ${c.district} · ${c.id}</span></h1>
    <div class="workspace">
      <div class="stack">
        ${c.red_flags.length > 0 && html`<div class="callout urgent"><h3>${t('Warning signs reported')}</h3><ul style="margin:0;padding-left:20px">
          ${c.red_flags.map(k => html`<li>${L(RED_FLAGS.find(r => r.key === k))}</li>`)}</ul></div>`}
        <div class="panel stack">
          <h2>${t('Complaint')}</h2>
          <p>${sc.complaints.map(k => L(COMPLAINTS.find(x => x.key === k))).join(' · ') || '—'}</p>
          ${sc.complaint_text && html`<${TranslatedText} text=${sc.complaint_text} lang=${sc.complaint_lang} target=${target} show=${showTx} label=${t('Typed by the field worker')} />`}
          ${sc.worker_notes && html`<div><span class="lbl">${t('Field worker’s note')}</span><${TranslatedText} text=${sc.worker_notes} lang=${sc.worker_notes_lang} target=${target} show=${showTx} /></div>`}
          ${info_requests.length > 0 && html`<div><span class="lbl">${t('Questions and answers')}</span>${info_requests.map(r => html`<div class="stack" style="margin-bottom:8px">
            <${TranslatedText} text=${r.message} lang=${r.message_lang} target=${target} show=${showTx} label=${t('Dentist asked')} />
            ${r.response && html`<${TranslatedText} text=${r.response} lang=${r.response_lang} target=${target} show=${showTx} label=${t('Field worker replied')} />`}</div>`)}</div>`}
        </div>
        <div class="panel"><h2>${t('Photos')}</h2><${Thumbs} images=${images} labelFor=${viewLabel} /></div>
        <div class="panel">
          <h2>OHAT <span class="muted small">${sc.ohat_total}/16</span></h2>
          <table class="t"><tbody>${OHAT_ITEMS.map(it => html`<tr><td>${L(it)}</td><td><span class=${'score-dot s' + sc.ohat[it.key]}></span>${sc.ohat[it.key]} — ${L(it.levels[sc.ohat[it.key]])}</td></tr>`)}</tbody></table>
        </div>
        <div class="panel"><h2>${t('Teeth, dentures, function')}</h2><dl class="kv">
          <dt>${t('Natural teeth')}</dt><dd>${sc.natural_teeth ?? '—'} ${sc.functional_dentition ? '(≥20)' : ''}</dd>
          <dt>${t('Dentures')}</dt><dd>${t('upper')} ${sc.denture_upper || '—'}, ${t('lower')} ${sc.denture_lower || '—'}${sc.denture_fit ? ` · ${sc.denture_fit}` : ''}</dd>
          <dt>GOHAI</dt><dd>${sc.gohai_total != null ? `${sc.gohai_total}/60` : t('not asked')}</dd>
          ${answerLines('teeth', sc.extra).map(x => html`<dt></dt><dd>${x}</dd>`)}
        </dl>
        ${sc.gohai && html`<details><summary class="small">${t('GOHAI answers')}</summary><ol class="small">${sc.gohai.map(a => html`<li>${GOHAI_OPTIONS.find(o => o.v === a)?.en}</li>`)}</ol></details>`}</div>
        <div class="panel"><h2>${t('Health and medicines')}</h2>
          <p>${answerLines('health', sc.context).join(' · ') || t('Nothing reported')}</p>
          ${sc.medicines.length ? html`<p><strong>${t('Medicines')}:</strong> ${sc.medicines.join(', ')}</p>` : ''}
          ${sc.medicine_flags.length > 0 && html`<div class="callout warn small">${sc.medicine_flags.map(f => html`<div><strong>${f.medicine}</strong>: ${L(MEDICINE_FLAGS.find(g => g.flag === f.flag))}</div>`)}</div>`}
          <p class="small muted" style="margin-top:8px">${t('Habits')}: ${answerLines('habits', sc.risks).join(' · ') || '—'}</p>
        </div>
        ${history.length > 0 && html`<div class="panel"><h2>${t('Earlier visits of this person')}</h2><div class="table-wrap"><table class="t">
          <thead><tr><th>${t('Date')}</th><th class="num">OHAT</th><th class="num">GOHAI</th><th class="num">${t('Teeth')}</th><th>${t('Earlier opinion')}</th></tr></thead>
          <tbody>${history.map(h => html`<tr><td class="nowrap">${fmtDate(h.submitted_at)}</td><td class="num">${h.ohat_total ?? '—'}</td><td class="num">${h.gohai_total ?? '—'}</td>
            <td class="num">${h.natural_teeth ?? '—'}</td><td class="small">${h.impression || '—'}</td></tr>`)}</tbody></table></div></div>`}
      </div>
      <div class="opinion-col">
        ${c.holds ? html`<${OpinionForm} caseId=${id} onDone=${() => go('/')} />`
          : current ? html`<${SignedOpinion} o=${current} caseId=${id} onChanged=${d.reload} />`
          : html`<div class="callout info">${t('This case is no longer reserved for you.')} <button class="btn" onClick=${reclaim}>${t('Open again')}</button></div>`}
      </div>
    </div>`;
}

const FOLLOWUP = [3, 6, 12];
function referralTemplate(type, urgency) {
  const r = REFERRAL_TYPES.find(x => x.key === type);
  const when = { within_24h: 'within 24 hours', within_7d: 'within 7 days', within_30d: 'within one month', routine: 'at the earliest convenience' }[urgency];
  return `Dear Doctor,\nThis older person was screened at home under the Vayosmitham community geriatric oral health programme (CIF–AGeD). Based on the screening findings and intraoral photographs, referral is advised for: ${r?.en || ''}, ${when}.\nPlease see the screening summary on this report. We would be grateful if you could note the treatment given on this sheet, so the field worker can record the outcome.\nThank you.`;
}

function OpinionForm({ caseId, onDone, initial, correcting }) {
  const s = useAppState();
  const kb = (s.ref?.kb_items || []).filter(k => k.audience === 'patient' || k.audience === 'caregiver');
  const [f, setF] = useState(initial || { findings: '', impression: '', advice: '', care_plan: '', note: '', followup_months: 6, referral_needed: false, referral_type: '',
    referral_urgency: 'within_30d', referral_message: '', cannot_assess: false, kb_items: [] });
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const set = (k, v) => setF(prev => {
    const n = { ...prev, [k]: v };
    if ((k === 'referral_type' || k === 'referral_urgency' || k === 'referral_needed') && n.referral_needed && n.referral_type &&
      (!prev.referral_message || prev.referral_message === referralTemplate(prev.referral_type, prev.referral_urgency))) n.referral_message = referralTemplate(n.referral_type, n.referral_urgency);
    if (k === 'cannot_assess' && v) { n.referral_needed = true; if (!n.referral_type) n.referral_type = 'general_dental'; n.referral_message = referralTemplate(n.referral_type, n.referral_urgency); }
    return n;
  });
  const sign = async () => {
    setBusy(true);
    try {
      if (correcting) await api(`/api/dentist/opinions/${correcting}/correct`, { method: 'POST', body: { ...f, correction_reason: reason } });
      else await api(`/api/dentist/cases/${caseId}/opinion`, { method: 'POST', body: f });
      toast(t('Opinion signed. Thank you.'));
      onDone();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };
  const ask = async () => {
    try { await api(`/api/dentist/cases/${caseId}/info-request`, { method: 'POST', body: { message: q } }); toast(t('Question sent to the field worker')); onDone(); }
    catch (e) { toast(e.message, true); }
  };
  const ta = (k, label, hint, rows = 3) => html`<${Field} label=${label} hint=${hint}><textarea rows=${rows} value=${f[k]} onInput=${e => set(k, e.target.value)}></textarea><//>`;
  return html`<div class="panel stack">
    <h2>${correcting ? t('Correct your opinion') : t('Your opinion')}</h2>
    <p class="tiny">${t('Write in English or your own language. The field worker sees a translation into her language. Write plainly — it will be shown to the older person.')}</p>
    <label class=${'choice block' + (f.cannot_assess ? ' on' : '')}><input type="checkbox" checked=${f.cannot_assess} onChange=${e => set('cannot_assess', e.target.checked)} />
      <span><span class="t">${t('Cannot assess remotely — needs in-person examination')}</span></span></label>
    ${ta('impression', t('Impression'), t('What you think is going on, in plain words'), 2)}
    ${ta('findings', t('Findings (optional)'), t('Clinical detail for the referral clinic'), 2)}
    ${ta('advice', t('Advice for the person and caregiver'), t('Daily care, what to avoid, when to seek help'))}
    ${ta('care_plan', t('Care plan'), t('What should happen next and in what order'))}
    <${Field} label=${t('Next screening')}><${Choices} name="fu" value=${f.followup_months} onChange=${v => set('followup_months', v)}
      options=${FOLLOWUP.map(m => ({ key: m, label: `${m} ${t('months')}` }))} /><//>
    <label class=${'choice block' + (f.referral_needed ? ' on' : '')}><input type="checkbox" checked=${f.referral_needed} onChange=${e => set('referral_needed', e.target.checked)} />
      <span class="t">${t('Referral needed')}</span></label>
    ${f.referral_needed && html`<div class="stack">
      <${Field} label=${t('Refer for')}><select value=${f.referral_type} onChange=${e => set('referral_type', e.target.value)}><option value="">—</option>
        ${REFERRAL_TYPES.filter(r => r.active !== false).map(r => html`<option value=${r.key}>${L(r)}</option>`)}</select><//>
      <${Field} label=${t('How soon')}><${Choices} name="ru" value=${f.referral_urgency} onChange=${v => set('referral_urgency', v)} options=${[
        { key: 'within_24h', label: t('24 hours') }, { key: 'within_7d', label: t('7 days') }, { key: 'within_30d', label: t('1 month') }, { key: 'routine', label: t('Routine') }]} /><//>
      ${ta('referral_message', t('Referral letter'), t('Filled in from the template — edit as needed'), 6)}
    </div>`}
    ${kb.length > 0 && html`<${Field} label=${t('Education to share')}><div class="stack">${kb.map(k => html`<label class=${'choice block' + (f.kb_items.includes(k.id) ? ' on' : '')}>
      <input type="checkbox" checked=${f.kb_items.includes(k.id)} onChange=${e => set('kb_items', e.target.checked ? [...f.kb_items, k.id] : f.kb_items.filter(x => x !== k.id))} />
      <span><span class="t">${k.title}</span><span class="d">${k.kind} · ${k.language}${k.approved_at ? '' : ' · ' + t('not yet approved')}</span></span></label>`)}</div><//>`}
    ${correcting && html`<${Field} label=${t('Reason for correction')}><input type="text" value=${reason} onInput=${e => setReason(e.target.value)} /><//>`}
    <button class="btn primary big" disabled=${busy} onClick=${sign}>${busy ? t('Signing…') : t('Sign opinion')}</button>
    <p class="tiny">${t('Your name and registration number appear on the printed referral report only, not in the app screens.')}</p>
    ${!correcting && html`<details open=${asking} onToggle=${e => setAsking(e.target.open)}><summary>${t('Need more information first?')}</summary>
      <div class="stack" style="margin-top:8px"><${Field} label=${t('Question for the field worker')}><textarea value=${q} onInput=${e => setQ(e.target.value)}></textarea><//>
      <button class="btn" disabled=${!q.trim()} onClick=${ask}>${t('Send question')}</button></div></details>`}
  </div>`;
}

function SignedOpinion({ o, caseId, onChanged }) {
  const [edit, setEdit] = useState(false);
  if (edit) return html`<${OpinionForm} caseId=${caseId} correcting=${o.id} initial=${{ ...o, referral_needed: !!o.referral_needed, cannot_assess: !!o.cannot_assess, kb_items: o.kb_items || [],
    findings: o.findings || '', impression: o.impression || '', advice: o.advice || '', care_plan: o.care_plan || '', note: o.note || '', referral_type: o.referral_type || '',
    referral_message: o.referral_message || '', referral_urgency: o.referral_urgency || 'within_30d' }} onDone=${() => { setEdit(false); onChanged(); }} />`;
  return html`<div class="panel stack"><h2>${t('Signed opinion')} <span class="muted small">v${o.version} · ${fmtDate(o.signed_at)}</span></h2>
    <dl class="kv"><dt>${t('Impression')}</dt><dd>${o.impression || '—'}</dd><dt>${t('Advice')}</dt><dd>${o.advice || '—'}</dd><dt>${t('Care plan')}</dt><dd>${o.care_plan || '—'}</dd>
      <dt>${t('Referral')}</dt><dd>${o.referral_needed ? L(REFERRAL_TYPES.find(r => r.key === o.referral_type)) : t('No')}</dd></dl>
    ${o.mine && html`<button class="btn" onClick=${() => setEdit(true)}>${t('Correct this opinion')}</button>`}</div>`;
}

export function DentistHistory() {
  const d = useLoad(() => api('/api/dentist/history'), []);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  return html`<h1>${t('My opinions')}</h1>
    ${d.data.opinions.length === 0 ? html`<div class="panel empty">${t('You have not signed any opinions yet.')}</div>` : html`<div class="table-wrap"><table class="t">
      <thead><tr><th>${t('Date')}</th><th>${t('Person')}</th><th>${t('Impression')}</th><th>${t('Referral')}</th><th>${t('Peer review')}</th></tr></thead>
      <tbody>${d.data.opinions.map(o => html`<tr><td class="nowrap"><a href=${'#/case/' + o.case_id}>${fmtDate(o.signed_at)}</a>${o.superseded_by ? html`<br /><span class="tiny">${t('corrected')}</span>` : ''}</td>
        <td class="small">${sexLabel(o.sex)}, ${o.age_band} · ${o.district}</td><td class="small">${o.impression || '—'}</td><td>${o.referral_needed ? t('Yes') : t('No')}</td>
        <td class="small">${o.audit_rating ? `${o.audit_rating}/5 ${o.audit_notes ? '— ' + o.audit_notes : ''}` : '—'}</td></tr>`)}</tbody></table></div>`}`;
}
