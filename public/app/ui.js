// Shared state, translations and UI building blocks.
import { html, render, useState, useEffect, useRef } from '/vendor/preact-htm.js';
import { api } from './api.js';
import { DICTS, loadLang } from './i18n.js';
import { registerNotice } from '/shared/consent.js';

export { html, render, useState, useEffect, useRef };

// ---------------- app state ----------------
export const state = { user: null, ref: null, online: navigator.onLine, listeners: new Set() };
export function setState(patch) { Object.assign(state, patch); state.listeners.forEach(f => f()); }
export function useAppState() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); state.listeners.add(f); return () => state.listeners.delete(f); }, []);
  return state;
}

// Interface language: chosen on the sign-in page (stored on this device) or in the profile. Default English.
// Strings without a translation fall back to English.
export const uiLang = () => state.lang || state.user?.ui_lang || 'en';
// Stored values (visit types, person status) shown through t(): readable English labels.
const EN_LABELS = { followup: 'Follow-up visit', baseline: 'First visit', problem: 'Problem visit',
  active: 'Active', migrated: 'Moved away', died: 'Died', lost: 'Lost to follow-up' };
export function tIn(lang, s) { return (lang !== 'en' && DICTS[lang]?.ui?.[s]) || (lang === 'en' && EN_LABELS[s]) || s; }
export function t(s) { return tIn(uiLang(), s); }
export function LIn(lang, obj) {
  if (!obj) return '';
  if (lang === 'en') return obj.en;
  return obj[lang] || DICTS[lang]?.clinical?.[obj.en] || DICTS[lang]?.ui?.[obj.en] || obj.en;
}
export function L(obj) { return LIn(uiLang(), obj); }
// Advice text for a red flag in a language
export function adviceIn(lang, r) { if (!r) return ''; return lang === 'en' ? r.advice_en : (r['advice_' + lang] || DICTS[lang]?.clinical?.[r.advice_en] || r.advice_en); }
// A recorded answer to a questionnaire question, in the interface language.
export function answerText(q, v) {
  if (v == null || v === '') return null;
  if (q.type === 'yesno') return v ? t('Yes') : t('No');
  if (q.type === 'habit') return L(HABIT_OPTIONS.find(o => o.key === v)) || v;
  if (q.type === 'choice') return L((q.options || []).find(o => o.key === v)) || v;
  return String(v);
}
// "Label: answer" lines for one step's answers (yes/no questions answered "no" are left out to keep it short).
export function answerLines(step, answers = {}) {
  return QUESTIONS.filter(q => q.step === step && answers[q.key] != null && answers[q.key] !== '' && !(q.type === 'yesno' && answers[q.key] === false))
    .map(q => (q.type === 'yesno' ? L(q) : `${L(q)}: ${answerText(q, answers[q.key])}`));
}
export async function useLanguage(code) {
  const pack = await loadLang(code);
  if (pack?.notice) registerNotice(code, pack);
  document.documentElement.lang = code || 'en';
  setState({ lang: code });
}
export const LOCALE = { en: 'en-IN', ml: 'ml-IN', ta: 'ta-IN', kn: 'kn-IN', te: 'te-IN', hi: 'hi-IN', mr: 'mr-IN' };

export async function loadRef(force = false) {
  if (state.ref && !force) return state.ref;
  try {
    const ref = await api('/api/ref');
    try { localStorage.setItem('vs_ref', JSON.stringify(ref)); } catch { /* storage full or blocked */ }
    applyQuestionnaire(ref.questionnaire);
    setState({ ref });
  } catch {
    try { const cached = JSON.parse(localStorage.getItem('vs_ref') || 'null'); if (cached) { applyQuestionnaire(cached.questionnaire); setState({ ref: cached }); } } catch { /* ignore */ }
  }
  return state.ref || { lsgds: [], referral_centres: [], kb_items: [], glossary: [], settings: {} };
}

export function roleName(r) {
  return { superadmin: 'CIF super admin', admin: 'Administrator', clinical_admin: 'AGeD clinical admin', worker: 'Field worker', coordinator: 'Coordinator', dentist: 'Dentist',
    auditor: 'Clinical auditor', dpo: 'Data protection lead', researcher: 'Researcher' }[r] || r;
}

// ---------------- routing ----------------
export function go(path) { location.hash = '#' + path; }
export function useRoute() {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const f = () => { setR(location.hash.slice(1) || '/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

// ---------------- toast ----------------
let toastTimer;
export function toast(msg, err = false) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, err ? 6000 : 3500);
}

// ---------------- data hook ----------------
export function useLoad(fn, deps = []) {
  const [s, setS] = useState({ loading: true, data: null, error: null });
  const reload = async () => {
    setS(x => ({ ...x, loading: true }));
    try { setS({ loading: false, data: await fn(), error: null }); } catch (e) { setS({ loading: false, data: null, error: e }); }
  };
  useEffect(() => { reload(); }, deps);
  return { ...s, reload };
}
export function Loading({ error, retry }) {
  if (error) return html`<div class="callout warn" role="alert"><p>${error.message}</p>${retry && html`<button class="btn" onClick=${retry}>${t('Try again')}</button>`}</div>`;
  return html`<div class="spinner" role="status" aria-label=${t('Loading')}></div>`;
}

// ---------------- form pieces ----------------
export function Field({ label, hint, children }) {
  return html`<label class="field"><span class="lbl">${label}</span>${children}${hint && html`<span class="hint">${hint}</span>`}</label>`;
}
export function Choices({ options, value, onChange, multi = false, name }) {
  const isOn = k => (multi ? (value || []).includes(k) : value === k);
  const toggle = k => {
    if (!multi) return onChange(k);
    const v = new Set(value || []);
    v.has(k) ? v.delete(k) : v.add(k);
    onChange([...v]);
  };
  return html`<div class="choices" role=${multi ? 'group' : 'radiogroup'}>
    ${options.map(o => html`<label class=${'choice' + (isOn(o.key) ? ' on' : '') + (o.desc ? ' block' : '')}>
      <input type=${multi ? 'checkbox' : 'radio'} name=${name} checked=${isOn(o.key)} onChange=${() => toggle(o.key)} />
      ${o.desc ? html`<span><span class="t">${o.label}</span><span class="d">${o.desc}</span></span>` : o.label}
    </label>`)}
  </div>`;
}
export function YesNo({ value, onChange, name }) {
  return html`<${Choices} name=${name} value=${value === true ? 'y' : value === false ? 'n' : null}
    options=${[{ key: 'y', label: t('Yes') }, { key: 'n', label: t('No') }]} onChange=${k => onChange(k === 'y')} />`;
}
export function Switch({ checked, onChange, label }) {
  return html`<label class="switch"><input type="checkbox" role="switch" checked=${checked} onChange=${e => onChange(e.target.checked)} /><span>${label}</span></label>`;
}

// ---------------- translation display ----------------
const txCache = new Map();
export async function translateText(text, src, tgt) {
  const k = `${src}|${tgt}|${text}`;
  if (txCache.has(k)) return txCache.get(k);
  const r = await api('/api/translate', { method: 'POST', body: { text, src, tgt } });
  txCache.set(k, r);
  return r;
}
const LANG_NAMES = { en: 'English', ml: 'മലയാളം', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', te: 'తెలుగు', hi: 'हिन्दी', mr: 'मराठी' };

// Original text, and when `show` is on and languages differ, a machine translation in the box beside it.
export function TranslatedText({ text, lang, target, show = true, label }) {
  const [tx, setTx] = useState(null);
  const [err, setErr] = useState(null);
  const need = show && text && lang && target && lang !== target;
  useEffect(() => {
    setTx(null); setErr(null);
    if (!need) return;
    translateText(text, lang, target).then(r => (r.text ? setTx(r) : setErr(r.error || t('Translation not available')))).catch(e => setErr(e.message));
  }, [text, lang, target, need]);
  if (!text) return html`<p class="muted">—</p>`;
  return html`<div class=${'tx-pair' + (need ? '' : ' single')}>
    <div class="tx-box" lang=${lang}><span class="tx-label">${label || t('Original')} · ${LANG_NAMES[lang] || lang}</span>${text}</div>
    ${need && html`<div class="tx-box machine" lang=${target} aria-live="polite">
      <span class="tx-label">${t('Machine translation — the original is authoritative')} · ${LANG_NAMES[target] || target}</span>
      ${tx ? tx.text : err ? html`<span class="muted">${err}</span>` : html`<span class="muted">${t('Translating…')}</span>`}
      ${tx?.glossary?.length ? html`<span class="tiny" style="display:block;margin-top:6px">${t('Approved terms')}: ${tx.glossary.map(g => `${g.en} = ${g.ml}`).join('; ')}</span>` : ''}
    </div>`}
  </div>`;
}

// ---------------- photos ----------------
export function Thumbs({ images: all, labelFor }) {
  const [open, setOpen] = useState(null);
  const voices = (all || []).filter(i => i.view === 'voice_note');
  const images = (all || []).filter(i => i.view !== 'voice_note');
  const audio = voices.map(i => html`<div style="margin-bottom:8px"><span class="lbl">${t('Voice note')}</span><audio controls preload="none" src=${'/api/media/' + i.id} style="width:100%"></audio></div>`);
  if (!images.length) return html`${audio}<p class="muted">${t('No photos')}</p>`;
  return html`${audio}<div class="thumbs">
    ${images.map((im, i) => html`<button type="button" onClick=${() => setOpen(i)} aria-label=${t('Open photo') + ' ' + (labelFor ? labelFor(im.view) : im.view)}>
      <img src=${'/api/media/' + im.id} alt="" loading="lazy" /><span class="cap">${labelFor ? labelFor(im.view) : im.view}</span></button>`)}
  </div>
  ${open !== null && html`<div class="lightbox" role="dialog" aria-modal="true" onKeyDown=${e => e.key === 'Escape' && setOpen(null)}>
    <div class="bar"><span>${labelFor ? labelFor(images[open].view) : images[open].view} (${open + 1}/${images.length})</span>
      <span class="row"><button onClick=${() => setOpen((open - 1 + images.length) % images.length)}>‹</button>
      <button onClick=${() => setOpen((open + 1) % images.length)}>›</button>
      <button onClick=${() => setOpen(null)} autofocus>${t('Close')}</button></span></div>
    <img src=${'/api/media/' + images[open].id} alt="" />
  </div>`}`;
}

// ---------------- misc ----------------
export function ago(sqlTime) {
  if (!sqlTime) return '';
  const d = new Date(sqlTime.replace(' ', 'T') + (sqlTime.includes('Z') ? '' : 'Z'));
  const h = (Date.now() - d.getTime()) / 3600000;
  if (h < 1) return t('just now');
  if (h < 24) return `${Math.floor(h)} ${t('h ago')}`;
  return `${Math.floor(h / 24)} ${t('d ago')}`;
}
export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(LOCALE[uiLang()] || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function UrgencyChip({ u }) { return html`<span class=${'chip ' + u}>${u === 'urgent' ? t('Urgent') : t('Routine')}</span>`; }
export function StatusChip({ s }) {
  const map = { submitted: ['info', 'With dentist'], info_requested: ['warn', 'Question for you'], opinion: ['routine', 'Opinion ready'], closed: ['', 'Closed'], withdrawn: ['', 'Withdrawn'] };
  const [c, l] = map[s] || ['', s];
  return html`<span class=${'chip ' + c}>${t(l)}</span>`;
}
export function Smile({ cls = '' }) {
  return html`<svg class=${cls} viewBox="0 0 92 46" aria-hidden="true"><path d="M6 8 C 26 44, 66 44, 86 8" fill="none" stroke="#e5a21b" stroke-width="9" stroke-linecap="round"/></svg>`;
}
export function Logo() {
  return html`<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#fff" fill-opacity=".14"/><path d="M176 132c-34 0-62 28-62 66 0 46 16 78 28 118 9 31 14 66 36 66 18 0 22-28 30-54 6-20 14-32 28-32s22 12 28 32c8 26 12 54 30 54 22 0 27-35 36-66 12-40 28-72 28-118 0-38-28-66-62-66-26 0-38 14-60 14s-34-14-60-14z" fill="#fff"/><path d="M128 400c70 52 186 52 256 0" stroke="#e5a21b" stroke-width="30" stroke-linecap="round" fill="none"/></svg>`;
}
export const Icon = {
  home: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`,
  plus: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  people: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 2 5.3 5"/></svg>`,
  me: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7"/></svg>`,
  queue: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
  sync: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 0 1-14 5.3M4 12A8 8 0 0 1 18 6.7"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>`,
  print: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/></svg>`,
  eye: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  camera: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>`,
};

export function youtubeEmbed(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

// District picker: a list for the states we know, free text otherwise (or when "Other" is chosen).
import { DISTRICTS } from '/shared/clinical.js';
export function DistrictInput({ state: st, value, onChange, disabled }) {
  const list = DISTRICTS[st];
  const [free, setFree] = useState(!!(value && list && !list.includes(value)));
  if (!list || free) return html`<span class="row" style="flex-wrap:nowrap"><input type="text" value=${value || ''} disabled=${disabled} onInput=${e => onChange(e.target.value)} />
    ${list && !disabled ? html`<button type="button" class="btn link" onClick=${() => { setFree(false); onChange(''); }}>${t('List')}</button>` : ''}</span>`;
  return html`<select value=${value || ''} disabled=${disabled} onChange=${e => { if (e.target.value === '__other') { setFree(true); onChange(''); } else onChange(e.target.value); }}>
    <option value="">—</option>${list.map(x => html`<option>${x}</option>`)}<option value="__other">${t('Other')}…</option></select>`;
}

import { QUESTIONS, HABIT_OPTIONS } from '/shared/clinical.js';
import { applyQuestionnaire } from '/shared/questionnaire.js';
// Use the questionnaire version saved on this phone straight away (works offline); /api/ref refreshes it.
try { const c = JSON.parse(localStorage.getItem('vs_ref') || 'null'); if (c?.questionnaire) applyQuestionnaire(c.questionnaire); } catch { /* ignore */ }
