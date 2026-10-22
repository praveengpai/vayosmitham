// The home-visit wizard: person → consent → warning signs → complaints → OHAT → teeth → health → habits → GOHAI → photos → review.
// Everything is saved to the encrypted outbox first, then sent when there is a connection.
import { html, useState, useEffect, useRef, state, useAppState, go, t, L, toast, Field, Choices, YesNo, loadRef, Icon, useLoad, Loading } from './ui.js';
import { api, putOutbox, uuid, vaultUnlocked } from './api.js';
import { refreshOutbox, runSync } from './main.js';
import { processPhoto } from './photo.js';
import { CONSENT_VERSION, noticeSections, noticeText, LAYERS, DECIDER_TYPES, contactGaps } from '/shared/consent.js';
import { OHAT_ITEMS, GOHAI_ITEMS, GOHAI_OPTIONS, COMPLAINTS, RED_FLAGS, PHOTO_VIEWS, STATES, KERALA_DISTRICTS, LSGD_TYPES, LOCATION_OVERRIDE_REASONS,
  flagMedicines, MEDICINE_FLAGS, ohatTotal, gohaiTotal, detectLang } from '/shared/clinical.js';

const STEPS = ['person', 'consent', 'flags', 'complaints', 'ohat', 'teeth', 'health', 'habits', 'gohai', 'photos', 'review'];
const DRAFT_KEY = 'vs_visit_draft';

function blankVisit(user, personId) {
  return {
    client_uuid: uuid(), visit_type: personId ? 'followup' : 'baseline', person_id: personId || null,
    person: { client_uuid: uuid(), name: '', sex: '', birth_year: '', age: '', phone: '', address: '', state: user.state || 'Kerala', district: user.district || '',
      lsgd_type: user.lsgd_type || '', lsgd_name: user.lsgd_name || '', ward: user.ward || '', location_override_reason: '', caregiver_name: '', caregiver_phone: '', caregiver_relation: '' },
    consent: { capacity: 'has_capacity', method: 'signature', witness_name: '', assent_by: '', assent_relation: '', decider_type: '', layers: { care: false, photos: false, research: false, messaging: false }, read: false, notice_language: 'ml', copy_offered: false },
    red_flags: [], none_flags: false,
    screening: { complaints: [], complaint_text: '', ohat: {}, gohai: Array(12).fill(null), skip_gohai: false, natural_teeth: '', denture_upper: '', denture_lower: '', denture_fit: '',
      context: {}, medicines: [], risks: {}, worker_notes: '' },
  };
}

export function VisitWizard({ personId }) {
  const s = useAppState();
  const user = s.user;
  const [v, setV] = useState(() => {
    try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); if (d && d.person_id === (personId || null)) return d; } catch { /* ignore */ }
    return blankVisit(user, personId);
  });
  const [photos, setPhotos] = useState({}); // view -> {blob, url, w, h, q, problems}
  const [step, setStep] = useState(personId ? 1 : 0);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const existing = useLoad(() => (personId ? api('/api/persons/' + personId) : Promise.resolve(null)), [personId]);
  useEffect(() => { loadRef(); }, []);
  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch { /* ignore */ } }, [v]);

  const upd = (path, value) => setV(prev => {
    const next = structuredClone(prev);
    let o = next; const keys = path.split('.');
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys.at(-1)] = value;
    return next;
  });

  // If the person already has care consent, the consent step only offers optional layers.
  const priorConsent = existing.data?.consents?.filter(c => c.granted && !c.withdrawn_at).map(c => c.layer) || [];
  const hasCare = priorConsent.includes('care');
  const photosAllowed = v.consent.layers.photos || priorConsent.includes('photos');

  const validate = name => {
    const p = v.person, sc = v.screening;
    if (name === 'person' && !personId) {
      if (!p.name.trim()) return t('Enter the name');
      if (!p.sex) return t('Choose sex');
      if (!p.birth_year && !p.age) return t('Enter age or year of birth');
      if (!p.state || !p.district || !p.lsgd_type || !p.lsgd_name) return t('State, district and LSGD are needed');
      if (locationChanged(p, user) && !p.location_override_reason) return t('Choose why the location is different from your area');
    }
    if (name === 'consent') {
      if (!hasCare && !v.consent.layers.care) return t('Without consent for screening the visit cannot be recorded. Thank the person and end the visit.');
      if (!v.consent.read) return t('Confirm that you explained the information');
      if (v.consent.capacity !== 'has_capacity' && !v.consent.assent_by.trim()) return t('Enter the name of the person deciding for them');
      if (v.consent.capacity !== 'has_capacity' && !v.consent.decider_type) return t('Choose who is deciding for them');
      if (!v.consent.copy_offered) return t('Confirm that you offered a copy of the notice');
      if (v.consent.capacity === 'has_capacity' && v.consent.method === 'verbal_witnessed' && !v.consent.witness_name.trim()) return t('Enter the witness name');
    }
    if (name === 'flags' && !v.red_flags.length && !v.none_flags) return t('Tick the warning signs, or "None of these"');
    if (name === 'complaints' && !sc.complaints.length) return t('Choose at least one, or "No complaint"');
    if (name === 'ohat' && OHAT_ITEMS.some(it => sc.ohat[it.key] == null)) return t('Score all 8 parts');
    if (name === 'teeth' && sc.natural_teeth === '') return t('Enter the number of natural teeth (0 if none)');
    if (name === 'gohai' && !sc.skip_gohai && sc.gohai.some(x => x == null)) return t('Answer all 12 questions, or choose to skip');
    return null;
  };
  const next = () => { const e = validate(STEPS[step]); if (e) { setErr(e); return; } setErr(null); let n = step + 1; if (STEPS[n] === 'photos' && !photosAllowed) n++; setStep(n); window.scrollTo(0, 0); };
  const back = () => { setErr(null); let n = step - 1; if (STEPS[n] === 'photos' && !photosAllowed) n--; if (n < (personId ? 1 : 0)) return history.back(); setStep(n); window.scrollTo(0, 0); };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!vaultUnlocked()) throw new Error(t('Saved visits are locked. Sign out and in again.'));
      const payload = buildPayload(v, user, personId, hasCare);
      const photoList = Object.entries(photos).map(([view, p]) => ({ view, blob: p.blob, w: p.w, h: p.h, q: p.q, client_uuid: uuid() }));
      const label = personId ? (existing.data?.person?.name || personId) : v.person.name;
      await putOutbox(v.client_uuid, { visit: payload, photos: photoList, label });
      sessionStorage.removeItem(DRAFT_KEY);
      await refreshOutbox();
      if (navigator.onLine) {
        await runSync();
        const left = (state.outbox || []).find(i => i.id === v.client_uuid);
        if (left?.error) { toast(left.error, true); go('/outbox'); return; }
        toast(left ? t('Saved on the phone. It will be sent when there is internet.') : t('Sent to the dentists'));
      } else toast(t('Saved on the phone. It will be sent when there is internet.'));
      go('/');
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  if (personId && (existing.loading || existing.error)) return html`<${Loading} error=${existing.error} retry=${existing.reload} />`;
  const name = STEPS[step];
  const titleName = personId ? existing.data?.person?.name : v.person.name;
  return html`<div class="narrow">
    <div class="row between"><h1 style="margin:0">${personId ? t('Follow-up visit') : t('New person')}</h1>
      <button class="btn link" onClick=${() => { if (confirm(t('Discard this visit?'))) { sessionStorage.removeItem(DRAFT_KEY); go('/'); } }}>${t('Cancel')}</button></div>
    ${titleName && html`<p class="muted">${titleName}</p>`}
    <div class="steps" aria-hidden="true">${STEPS.map((_, i) => html`<span class=${i < step ? 'done' : i === step ? 'cur' : ''}></span>`)}</div>
    ${name === 'person' && html`<${PersonStep} p=${v.person} upd=${upd} user=${user} />`}
    ${name === 'consent' && html`<${ConsentStep} c=${v.consent} upd=${upd} hasCare=${hasCare} prior=${priorConsent} />`}
    ${name === 'flags' && html`<${FlagsStep} v=${v} upd=${upd} />`}
    ${name === 'complaints' && html`<${ComplaintsStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'ohat' && html`<${OhatStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'teeth' && html`<${TeethStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'health' && html`<${HealthStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'habits' && html`<${HabitsStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'gohai' && html`<${GohaiStep} sc=${v.screening} upd=${upd} />`}
    ${name === 'photos' && html`<${PhotosStep} photos=${photos} setPhotos=${setPhotos} />`}
    ${name === 'review' && html`<${ReviewStep} v=${v} photos=${photos} name=${titleName} upd=${upd} />`}
    ${err && html`<div class="callout urgent" role="alert" style="margin-top:12px">${err}</div>`}
    <div class="wizard-foot">
      <button class="btn" onClick=${back}>${t('Back')}</button>
      ${name === 'review'
        ? html`<button class="btn primary" disabled=${saving} onClick=${save}>${saving ? t('Saving…') : t('Save and send')}</button>`
        : html`<button class="btn primary" onClick=${next}>${t('Next')}</button>`}
    </div>
  </div>`;
}

function locationChanged(p, user) {
  return ['state', 'district', 'lsgd_type', 'lsgd_name', 'ward'].some(k => (p[k] || '') !== (user[k] || ''));
}

function buildPayload(v, user, personId, hasCare) {
  const c = v.consent, sc = v.screening;
  const method = c.capacity === 'has_capacity' ? c.method : 'caregiver_assent';
  const consents = Object.entries(c.layers).filter(([layer]) => !(layer === 'care' && hasCare && !c.layers.care)).map(([layer, granted]) => ({
    layer, granted, method, capacity: c.capacity, witness_name: c.witness_name, assent_by: c.assent_by, assent_relation: c.assent_relation, decider_type: c.decider_type, notice_language: c.notice_language, notice_version: CONSENT_VERSION,
  }));
  const p = { ...v.person };
  if (!p.birth_year && p.age) p.birth_year = new Date().getFullYear() - Number(p.age);
  return {
    client_uuid: v.client_uuid, visit_type: personId ? (v.screening.complaints.includes('checkup') ? 'followup' : 'problem') : 'baseline',
    person_id: personId || undefined, person: personId ? undefined : p, consents: hasCare && !c.read ? [] : consents,
    red_flags: v.red_flags,
    screening: { ...sc, gohai: sc.skip_gohai ? null : sc.gohai, natural_teeth: Number(sc.natural_teeth) },
  };
}

// ---------- steps ----------
function PersonStep({ p, upd, user }) {
  const s = useAppState();
  const [dups, setDups] = useState([]);
  const [showLoc, setShowLoc] = useState(locationChanged(p, user));
  const lsgds = (s.ref?.lsgds || []).filter(l => l.district === p.district && (!p.lsgd_type || l.kind === p.lsgd_type));
  const checkDup = async () => {
    if (!p.name.trim() || !navigator.onLine) return;
    try { const r = await api('/api/persons/check-duplicate', { method: 'POST', body: { name: p.name, birth_year: p.birth_year || (p.age ? new Date().getFullYear() - p.age : null), lsgd_name: p.lsgd_name } }); setDups(r.matches); } catch { /* offline */ }
  };
  const resetLoc = () => { ['state', 'district', 'lsgd_type', 'lsgd_name', 'ward'].forEach(k => upd('person.' + k, user[k] || '')); upd('person.location_override_reason', ''); setShowLoc(false); };
  return html`<div class="stack">
    <h2>${t('About the person')}</h2>
    <${Field} label=${t('Full name')} hint=${t('Type in English or Malayalam')}><input type="text" value=${p.name} onInput=${e => upd('person.name', e.target.value)} onBlur=${checkDup} autocomplete="off" /><//>
    ${dups.length > 0 && html`<div class="callout warn"><strong>${t('Already enrolled?')}</strong>
      ${dups.map(d => html`<div class="row between" style="margin-top:6px"><span>${d.name} · ${d.birth_year || ''} · ${d.lsgd_name} ${d.ward ? t('ward') + ' ' + d.ward : ''} (${d.id})</span>
        <a class="btn" href=${'#/visit/' + d.id} onClick=${() => sessionStorage.removeItem(DRAFT_KEY)}>${t('Use this person')}</a></div>`)}</div>`}
    <${Field} label=${t('Sex')}><${Choices} name="sex" value=${p.sex} onChange=${x => upd('person.sex', x)} options=${[{ key: 'F', label: t('Female') }, { key: 'M', label: t('Male') }, { key: 'O', label: t('Other') }]} /><//>
    <div class="grid-2">
      <${Field} label=${t('Age in years')}><input type="number" inputmode="numeric" min="40" max="120" value=${p.age} onInput=${e => { upd('person.age', e.target.value); upd('person.birth_year', ''); }} /><//>
      <${Field} label=${t('or year of birth')}><input type="number" inputmode="numeric" min="1900" max="2000" value=${p.birth_year} onInput=${e => { upd('person.birth_year', e.target.value); upd('person.age', ''); }} /><//>
    </div>
    <${Field} label=${t('Phone (optional)')}><input type="tel" inputmode="tel" value=${p.phone} onInput=${e => upd('person.phone', e.target.value)} /><//>
    <${Field} label=${t('House name / address')}><input type="text" value=${p.address} onInput=${e => upd('person.address', e.target.value)} /><//>

    <div class="panel">
      <div class="row between"><div><span class="lbl">${t('Location')}</span>
        <span>${p.lsgd_name || '—'}${p.ward ? `, ${t('ward')} ${p.ward}` : ''} · ${p.district}, ${p.state}</span></div>
        ${showLoc ? html`<button class="btn link" onClick=${resetLoc}>${t('Use my area')}</button>` : html`<button class="btn link" onClick=${() => setShowLoc(true)}>${t('Change')}</button>`}</div>
      ${!showLoc && html`<p class="tiny">${t('Filled in from your own area.')}</p>`}
      ${showLoc && html`<div class="stack" style="margin-top:12px">
        <div class="grid-2">
          <${Field} label=${t('State')}><select value=${p.state} onChange=${e => upd('person.state', e.target.value)}>${STATES.map(x => html`<option>${x}</option>`)}</select><//>
          <${Field} label=${t('District')}>${p.state === 'Kerala'
            ? html`<select value=${p.district} onChange=${e => { upd('person.district', e.target.value); upd('person.lsgd_name', ''); }}><option value="">—</option>${KERALA_DISTRICTS.map(x => html`<option>${x}</option>`)}</select>`
            : html`<input type="text" value=${p.district} onInput=${e => upd('person.district', e.target.value)} />`}<//>
        </div>
        <${Field} label=${t('LSGD type')}><select value=${p.lsgd_type} onChange=${e => upd('person.lsgd_type', e.target.value)}><option value="">—</option>${LSGD_TYPES.map(x => html`<option value=${x.key}>${L(x)}</option>`)}</select><//>
        <div class="grid-2">
          <${Field} label=${t('LSGD name')}><input type="text" list="lsgd-list" value=${p.lsgd_name} onInput=${e => upd('person.lsgd_name', e.target.value)} />
            <datalist id="lsgd-list">${lsgds.map(l => html`<option value=${l.name} />`)}</datalist><//>
          <${Field} label=${t('Ward number')}><input type="text" inputmode="numeric" value=${p.ward} onInput=${e => upd('person.ward', e.target.value)} /><//>
        </div>
        ${locationChanged(p, user) && html`<${Field} label=${t('Why is this different from your area?')}>
          <select value=${p.location_override_reason} onChange=${e => upd('person.location_override_reason', e.target.value)}><option value="">—</option>
            ${LOCATION_OVERRIDE_REASONS.map(r => html`<option value=${r.key}>${L(r)}</option>`)}</select><//>`}
      </div>`}
    </div>

    <details class="panel"><summary><strong>${t('Caregiver (if any)')}</strong></summary>
      <div class="stack" style="margin-top:12px">
        <${Field} label=${t('Caregiver name')}><input type="text" value=${p.caregiver_name} onInput=${e => upd('person.caregiver_name', e.target.value)} /><//>
        <div class="grid-2"><${Field} label=${t('Relation')}><input type="text" value=${p.caregiver_relation} onInput=${e => upd('person.caregiver_relation', e.target.value)} /><//>
          <${Field} label=${t('Caregiver phone')}><input type="tel" value=${p.caregiver_phone} onInput=${e => upd('person.caregiver_phone', e.target.value)} /><//></div>
      </div>
    </details>
  </div>`;
}

function ConsentStep({ c, upd, hasCare, prior }) {
  const s = useAppState();
  const settings = s.ref?.settings || {};
  const lang = c.notice_language;
  const speak = () => {
    if (!('speechSynthesis' in window)) return toast(t('Reading aloud is not available on this phone'), true);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(noticeText(lang, settings));
    u.lang = lang === 'ml' ? 'ml-IN' : 'en-IN';
    u.rate = 0.9;
    speechSynthesis.speak(u);
  };
  const layers = ['care', 'photos', 'research', 'messaging'].filter(l => !(prior.includes(l)));
  const gaps = contactGaps(settings);
  return html`<div class="stack">
    <h2>${t('Information and consent')}</h2>
    ${hasCare && html`<div class="callout ok">${t('Consent for screening was recorded at an earlier visit. Check that the person is still happy to continue.')}</div>`}
    ${gaps.length > 0 && html`<div class="callout warn small">${t('The notice is missing contact details. Ask the administrator to fill them in under Settings.')}</div>`}
    <div class="row between">
      <${Choices} name="nl" value=${lang} onChange=${x => upd('consent.notice_language', x)} options=${[{ key: 'ml', label: 'മലയാളം' }, { key: 'en', label: 'English' }]} />
      <span class="row"><button type="button" class="btn" onClick=${speak}>🔊 ${t('Read aloud')}</button>
        <a class="btn" href=${'/privacy.html?lang=' + lang} target="_blank" rel="noopener">${t('Printable copy')}</a></span>
    </div>
    <div class="panel notice" lang=${lang}>${noticeSections(lang, settings).map(sec => html`<h3>${sec.h}</h3>${sec.p.map(p => html`<p>${p}</p>`)}`)}
      <p class="tiny">${t('Notice version')} ${CONSENT_VERSION}</p></div>
    <${Field} label=${t('Can the person understand this information and decide for themselves?')}>
      <${Choices} name="cap" value=${c.capacity} onChange=${x => upd('consent.capacity', x)} options=${[
        { key: 'has_capacity', label: t('Yes') }, { key: 'doubtful', label: t('Not sure (e.g. memory problems)') }, { key: 'lacks', label: t('No') }]} /><//>
    ${c.capacity === 'has_capacity' ? html`
      <${Field} label=${t('How did they agree?')}><${Choices} name="m" value=${c.method} onChange=${x => upd('consent.method', x)} options=${[
        { key: 'signature', label: t('Signed on paper form') }, { key: 'thumb', label: t('Thumb impression on paper form') }, { key: 'verbal_witnessed', label: t('Spoken, with a witness') }]} /><//>
      ${c.method === 'verbal_witnessed' && html`<${Field} label=${t('Witness name')} hint=${t('An adult who is not a programme worker')}><input type="text" value=${c.witness_name} onInput=${e => upd('consent.witness_name', e.target.value)} /><//>`}`
    : html`<div class="callout warn">${t('Someone must decide in the person’s best interests. Prefer a lawful guardian if one exists. Still explain to the person, and stop if they object or seem distressed.')}</div>
      <${Field} label=${t('Who is deciding for them?')}><${Choices} name="dt" value=${c.decider_type} onChange=${x => upd('consent.decider_type', x)}
        options=${DECIDER_TYPES.map(d => ({ key: d.key, label: L(d) }))} /><//>
      <div class="grid-2"><${Field} label=${t('Name of the person deciding')}><input type="text" value=${c.assent_by} onInput=${e => upd('consent.assent_by', e.target.value)} /><//>
        <${Field} label=${t('Relation')}><input type="text" value=${c.assent_relation} onInput=${e => upd('consent.assent_relation', e.target.value)} /><//></div>`}
    <div><span class="lbl">${t('Tick only what the person agrees to')}</span>
      <div class="stack">${layers.map(l => html`<label class=${'choice block' + (c.layers[l] ? ' on' : '')}>
        <input type="checkbox" checked=${c.layers[l]} onChange=${e => upd('consent.layers.' + l, e.target.checked)} />
        <span><span class="t">${LAYERS[l][lang][0]}</span><span class="d">${LAYERS[l][lang][1]}</span></span></label>`)}</div></div>
    <label class=${'choice block' + (c.read ? ' on' : '')}><input type="checkbox" checked=${c.read} onChange=${e => upd('consent.read', e.target.checked)} />
      <span class="t">${t('I explained this information in a language they understand and answered their questions')}</span></label>
    <label class=${'choice block' + (c.copy_offered ? ' on' : '')}><input type="checkbox" checked=${c.copy_offered} onChange=${e => upd('consent.copy_offered', e.target.checked)} />
      <span class="t">${t('I offered them a copy of this notice (printed, or the link)')}</span></label>
  </div>`;
}

function FlagsStep({ v, upd }) {
  const toggle = k => { const set = new Set(v.red_flags); set.has(k) ? set.delete(k) : set.add(k); upd('red_flags', [...set]); upd('none_flags', false); };
  return html`<div class="stack">
    <h2>${t('Warning signs')}</h2>
    <p class="muted">${t('Ask and look. Tick every sign that is present.')}</p>
    ${RED_FLAGS.map(r => html`<label class=${'choice block' + (v.red_flags.includes(r.key) ? ' on' : '')}>
      <input type="checkbox" checked=${v.red_flags.includes(r.key)} onChange=${() => toggle(r.key)} /><span class="t">${L(r)}</span></label>`)}
    <label class=${'choice block' + (v.none_flags ? ' on' : '')}><input type="checkbox" checked=${v.none_flags} onChange=${e => { upd('none_flags', e.target.checked); if (e.target.checked) upd('red_flags', []); }} />
      <span class="t">${t('None of these')}</span></label>
    ${v.red_flags.length > 0 && html`<div class="callout urgent"><h3>${t('Act now — do not wait for the dentist')}</h3>
      ${v.red_flags.map(k => { const r = RED_FLAGS.find(x => x.key === k); return html`<p>${state.user.ui_lang === 'ml' ? r.advice_ml : r.advice_en}</p>`; })}
      <p class="small">${t('This visit will be marked urgent for the dentists.')}</p></div>`}
  </div>`;
}

function ComplaintsStep({ sc, upd }) {
  return html`<div class="stack">
    <h2>${t('What problems does the person have?')}</h2>
    <${Choices} multi name="cmp" value=${sc.complaints} onChange=${x => upd('screening.complaints', x)} options=${COMPLAINTS.map(c => ({ key: c.key, label: L(c) }))} />
    <${Field} label=${t('In the person’s own words (optional)')} hint=${t('Type in Malayalam or English. The dentist sees exactly what you type, with a translation.')}>
      <textarea value=${sc.complaint_text} onInput=${e => upd('screening.complaint_text', e.target.value)}></textarea><//>
    ${sc.complaint_text && html`<p class="tiny">${t('Language detected')}: ${detectLang(sc.complaint_text)}</p>`}
  </div>`;
}

function OhatStep({ sc, upd }) {
  return html`<div class="stack">
    <h2>${t('Look in the mouth (OHAT)')}</h2>
    <p class="muted small">${t('Use a torch. Remove dentures to look at the gums. Choose the description that fits best.')}</p>
    ${OHAT_ITEMS.map(it => html`<div class="panel">
      <h3>${L(it)}</h3>
      <div class="scale" role="radiogroup" aria-label=${L(it)}>${it.levels.map((lv, i) => html`<button type="button" role="radio" aria-checked=${sc.ohat[it.key] === i}
        class=${`l${i}` + (sc.ohat[it.key] === i ? ' on' : '')} onClick=${() => upd('screening.ohat.' + it.key, i)}><span class="n">${i}</span>${L(lv)}</button>`)}</div>
    </div>`)}
    <p class="tiny">${t('Score')}: ${ohatTotal(sc.ohat)} / 16</p>
  </div>`;
}

function TeethStep({ sc, upd }) {
  const n = sc.natural_teeth === '' ? null : Number(sc.natural_teeth);
  const bump = d => upd('screening.natural_teeth', String(Math.max(0, Math.min(32, (n ?? 0) + d))));
  const dent = [{ key: 'none', label: t('None') }, { key: 'partial', label: t('Partial') }, { key: 'complete', label: t('Complete') }];
  return html`<div class="stack">
    <h2>${t('Teeth and dentures')}</h2>
    <${Field} label=${t('How many natural teeth (including broken ones and roots)?')} hint=${t('Count upper and lower. 0 if none.')}>
      <div class="row"><button type="button" class="btn" onClick=${() => bump(-1)} aria-label=${t('One less')}>−</button>
        <input type="number" inputmode="numeric" min="0" max="32" style="max-width:110px;text-align:center;font-size:1.3rem" value=${sc.natural_teeth} onInput=${e => upd('screening.natural_teeth', e.target.value)} />
        <button type="button" class="btn" onClick=${() => bump(1)} aria-label=${t('One more')}>+</button></div><//>
    <${Field} label=${t('Upper denture')}><${Choices} name="du" value=${sc.denture_upper} onChange=${x => upd('screening.denture_upper', x)} options=${dent} /><//>
    <${Field} label=${t('Lower denture')}><${Choices} name="dl" value=${sc.denture_lower} onChange=${x => upd('screening.denture_lower', x)} options=${dent} /><//>
    ${(sc.denture_upper && sc.denture_upper !== 'none') || (sc.denture_lower && sc.denture_lower !== 'none') ? html`<${Field} label=${t('How do the dentures fit?')}>
      <${Choices} name="df" value=${sc.denture_fit} onChange=${x => upd('screening.denture_fit', x)} options=${[
        { key: 'good', label: t('Fit well') }, { key: 'loose', label: t('Loose') }, { key: 'painful', label: t('Painful / sore') }, { key: 'broken', label: t('Broken') }, { key: 'not_worn', label: t('Not worn') }]} /><//>` : ''}
  </div>`;
}

function HealthStep({ sc, upd }) {
  const [med, setMed] = useState('');
  const flags = flagMedicines(sc.medicines);
  const addMed = () => { const m = med.trim(); if (m && !sc.medicines.includes(m)) upd('screening.medicines', [...sc.medicines, m]); setMed(''); };
  const ctx = [['bedbound', 'Bedbound or housebound'], ['dementia', 'Memory problems / dementia'], ['swallowing_difficulty', 'Difficulty swallowing or choking'],
    ['diabetes', 'Diabetes'], ['stroke', 'Stroke or paralysis'], ['cancer_treatment', 'Cancer treatment now or before'], ['lives_alone', 'Lives alone'],
    ['needs_help_cleaning', 'Needs help to clean teeth or dentures'], ['weight_loss', 'Recent weight loss or poor appetite'], ['palliative', 'Under palliative care']];
  return html`<div class="stack">
    <h2>${t('Health')}</h2>
    ${ctx.map(([k, label]) => html`<div class="row between"><span>${t(label)}</span><${YesNo} name=${'ctx' + k} value=${sc.context[k]} onChange=${x => upd('screening.context.' + k, x)} /></div>`)}
    <${Field} label=${t('Medicines taken regularly')} hint=${t('Copy the names from the strips or prescription, one at a time.')}>
      <div class="row"><input type="text" class="grow" value=${med} onInput=${e => setMed(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); addMed(); } }} list="med-list" />
        <button type="button" class="btn" onClick=${addMed}>${t('Add')}</button></div>
      <datalist id="med-list">${MEDICINE_FLAGS.flatMap(g => g.names).map(n => html`<option value=${n} />`)}</datalist><//>
    ${sc.medicines.length > 0 && html`<div class="choices">${sc.medicines.map(m => html`<span class="chip" style="padding:6px 10px">${m}
      <button type="button" class="btn link" style="padding:0 0 0 6px" aria-label=${t('Remove') + ' ' + m} onClick=${() => upd('screening.medicines', sc.medicines.filter(x => x !== m))}>×</button></span>`)}</div>`}
    ${flags.length > 0 && html`<div class="callout info small">${flags.map(f => html`<div><strong>${f.medicine}</strong>: ${L(MEDICINE_FLAGS.find(g => g.flag === f.flag))}</div>`)}</div>`}
  </div>`;
}

function HabitsStep({ sc, upd }) {
  const r = sc.risks;
  const nfc = [{ key: 'never', label: t('Never') }, { key: 'former', label: t('Stopped') }, { key: 'current', label: t('Now') }];
  return html`<div class="stack">
    <h2>${t('Habits')}</h2>
    <${Field} label=${t('Chewing tobacco, pan, gutka')}><${Choices} name="tc" value=${r.tobacco_chew} onChange=${x => upd('screening.risks.tobacco_chew', x)} options=${nfc} /><//>
    <${Field} label=${t('Areca nut (adakka)')}><${Choices} name="ar" value=${r.areca} onChange=${x => upd('screening.risks.areca', x)} options=${nfc} /><//>
    <${Field} label=${t('Smoking (beedi, cigarette)')}><${Choices} name="ts" value=${r.tobacco_smoke} onChange=${x => upd('screening.risks.tobacco_smoke', x)} options=${nfc} /><//>
    <${Field} label=${t('Alcohol')}><${Choices} name="al" value=${r.alcohol} onChange=${x => upd('screening.risks.alcohol', x)} options=${nfc} /><//>
    <${Field} label=${t('Sweet things or sweet tea/coffee — times a day')}><input type="number" inputmode="numeric" min="0" max="20" value=${r.sugar_per_day ?? ''} onInput=${e => upd('screening.risks.sugar_per_day', e.target.value === '' ? null : Number(e.target.value))} /><//>
    <${Field} label=${t('Cleans teeth or dentures')}><${Choices} name="br" value=${r.brushing} onChange=${x => upd('screening.risks.brushing', x)} options=${[
      { key: 'twice', label: t('Twice a day') }, { key: 'once', label: t('Once a day') }, { key: 'irregular', label: t('Sometimes') }, { key: 'never', label: t('Never') }, { key: 'assisted', label: t('Someone helps') }]} /><//>
    <${Field} label=${t('Cleans with')}><${Choices} name="ba" value=${r.brush_aid} onChange=${x => upd('screening.risks.brush_aid', x)} options=${[
      { key: 'toothbrush', label: t('Toothbrush') }, { key: 'finger', label: t('Finger') }, { key: 'neem_stick', label: t('Neem/twig') }, { key: 'charcoal_powder', label: t('Charcoal or powder') }, { key: 'other', label: t('Other') }]} /><//>
    <${Field} label=${t('Uses fluoride toothpaste')}><${YesNo} name="fl" value=${r.fluoride_paste} onChange=${x => upd('screening.risks.fluoride_paste', x)} /><//>
    <${Field} label=${t('Last visit to a dentist')}><${Choices} name="lv" value=${r.last_dental_visit} onChange=${x => upd('screening.risks.last_dental_visit', x)} options=${[
      { key: '<1y', label: t('Within a year') }, { key: '1-3y', label: t('1–3 years') }, { key: '>3y', label: t('More than 3 years') }, { key: 'never', label: t('Never') }]} /><//>
  </div>`;
}

function GohaiStep({ sc, upd }) {
  return html`<div class="stack">
    <h2>${t('How teeth affect daily life (GOHAI)')}</h2>
    <p class="muted small">${t('Ask each question. "In the last 3 months, how often have you…"')}</p>
    <label class=${'choice block' + (sc.skip_gohai ? ' on' : '')}><input type="checkbox" checked=${sc.skip_gohai} onChange=${e => upd('screening.skip_gohai', e.target.checked)} />
      <span class="t">${t('Skip — the person cannot answer today')}</span></label>
    ${!sc.skip_gohai && GOHAI_ITEMS.map((q, i) => html`<div class="panel"><p><strong>${q.n}.</strong> ${L(q)}</p>
      <${Choices} name=${'g' + i} value=${sc.gohai[i]} onChange=${x => { const g = [...sc.gohai]; g[i] = x; upd('screening.gohai', g); }}
        options=${GOHAI_OPTIONS.map(o => ({ key: o.v, label: L(o) }))} /></div>`)}
    ${!sc.skip_gohai && gohaiTotal(sc.gohai) != null && html`<p class="tiny">GOHAI: ${gohaiTotal(sc.gohai)} / 60</p>`}
  </div>`;
}

function PhotosStep({ photos, setPhotos }) {
  const input = useRef();
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = v => { setView(v); input.current.value = ''; input.current.click(); };
  const onFile = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const p = await processPhoto(f);
      if (photos[view]?.url) URL.revokeObjectURL(photos[view].url);
      setPhotos({ ...photos, [view]: { ...p, url: URL.createObjectURL(p.blob) } });
      if (p.problems.length) toast(t('Photo may be') + ' ' + p.problems.map(x => t(x)).join(', ') + '. ' + t('Retake if you can.'), true);
    } catch { toast(t('Could not read that photo'), true); }
    setBusy(false);
  };
  const remove = v => { const n = { ...photos }; if (n[v]?.url) URL.revokeObjectURL(n[v].url); delete n[v]; setPhotos(n); };
  return html`<div class="stack">
    <h2>${t('Photos of the mouth')}</h2>
    <div class="callout info small">${t('Good light (torch or daylight), phone close, mouth only — no face. Ask someone to hold the torch. Take at least front, upper and lower; add a close-up of any sore or patch.')}</div>
    <input ref=${input} type="file" accept="image/*" capture="environment" class="sr" onChange=${onFile} />
    <div class="photo-grid">${PHOTO_VIEWS.map(v => photos[v.key]
      ? html`<div class="photo-slot has"><img src=${photos[v.key].url} alt=${L(v)} />
          ${photos[v.key].problems.length ? html`<span class="chip warn bad">${photos[v.key].problems.map(x => t(x)).join(', ')}</span>` : ''}
          <div class="cap row between"><span>${L(v).split(' — ')[0]}</span><span><button type="button" class="btn link" onClick=${() => pick(v.key)}>${t('Retake')}</button>
          <button type="button" class="btn link" onClick=${() => remove(v.key)}>×</button></span></div></div>`
      : html`<button type="button" class="photo-slot" onClick=${() => pick(v.key)} disabled=${busy}>${Icon.camera}<strong>${L(v).split(' — ')[0]}</strong><span class="tiny">${L(v).split(' — ')[1] || ''}</span></button>`)}
    </div>
    ${busy && html`<p class="muted">${t('Preparing photo…')}</p>`}
    <p class="tiny">${t('Photos are stored without location or phone details.')}</p>
  </div>`;
}

function ReviewStep({ v, photos, name, upd }) {
  const sc = v.screening;
  return html`<div class="stack">
    <h2>${t('Check and send')}</h2>
    ${v.red_flags.length > 0 ? html`<div class="callout urgent"><strong>${t('Urgent')}</strong>: ${v.red_flags.map(k => L(RED_FLAGS.find(r => r.key === k))).join('; ')}</div>`
      : html`<div class="callout ok">${t('No warning signs. This will go to the dentists as routine.')}</div>`}
    <div class="panel"><dl class="kv">
      <dt>${t('Person')}</dt><dd>${name}</dd>
      <dt>${t('Complaints')}</dt><dd>${sc.complaints.map(k => L(COMPLAINTS.find(c => c.key === k))).join(', ')}</dd>
      <dt>OHAT</dt><dd>${ohatTotal(sc.ohat)} / 16</dd>
      <dt>${t('Natural teeth')}</dt><dd>${sc.natural_teeth}</dd>
      <dt>GOHAI</dt><dd>${sc.skip_gohai ? t('Skipped') : gohaiTotal(sc.gohai) + ' / 60'}</dd>
      <dt>${t('Medicines')}</dt><dd>${sc.medicines.join(', ') || '—'}</dd>
      <dt>${t('Photos')}</dt><dd>${Object.keys(photos).length}</dd>
    </dl></div>
    <${Field} label=${t('Anything else the dentist should know? (optional)')}><textarea value=${sc.worker_notes} onInput=${e => upd('screening.worker_notes', e.target.value)}></textarea><//>
  </div>`;
}
