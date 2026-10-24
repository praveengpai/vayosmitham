// Versioned questionnaire: the parts of clinical.js the AGeD clinical admin may edit.
// Version 1 is the built-in content of clinical.js. A published version replaces the lists in place, so every
// screen and the server use it without further changes. Shared by the browser app and the API worker.
//
// Locks (clinical governance decision, Oct 2026): the validated OHAT (8 items × 3 levels, scored 0–2) and
// GOHAI (12 items, 5 answers, items 3/5/7 reverse-scored) keep their structure and scoring — only wording and
// translations can change. Everything else can be edited, added or retired. Items are never deleted, only
// retired, so old screenings can still be read.
import { OHAT_ITEMS, GOHAI_ITEMS, GOHAI_OPTIONS, COMPLAINTS, RED_FLAGS, MEDICINE_FLAGS, PHOTO_VIEWS, REFERRAL_TYPES, QUESTIONS, QUESTION_STEPS } from './clinical.js';

export const Q_LANGS = ['en', 'ml', 'ta', 'kn', 'te', 'hi', 'mr'];
export const LISTS = ['complaints', 'red_flags', 'medicine_flags', 'questions', 'photo_views', 'referral_types'];
export const Q_TYPES = ['yesno', 'habit', 'choice', 'number', 'text'];

export const BASE = structuredClone({
  ohat: OHAT_ITEMS, gohai: GOHAI_ITEMS, gohai_options: GOHAI_OPTIONS, complaints: COMPLAINTS, red_flags: RED_FLAGS,
  medicine_flags: MEDICINE_FLAGS, questions: QUESTIONS, photo_views: PHOTO_VIEWS, referral_types: REFERRAL_TYPES,
});

let applied = 1;
export const questionnaireVersion = () => applied;

const TARGETS = { complaints: COMPLAINTS, red_flags: RED_FLAGS, medicine_flags: MEDICINE_FLAGS, questions: QUESTIONS, photo_views: PHOTO_VIEWS, referral_types: REFERRAL_TYPES };
const replace = (arr, next) => arr.splice(0, arr.length, ...structuredClone(next));
function texts(src, prefix = '') {
  const o = {};
  for (const l of Q_LANGS) if (src?.[prefix + l]) o[prefix + l] = src[prefix + l];
  return o;
}
// Locked instruments: structure from the built-in version, wording from the published one.
function lockedOhat(src = []) {
  return BASE.ohat.map(b => { const s = src.find(x => x.key === b.key) || b;
    return { key: b.key, ...texts(b), ...texts(s), levels: b.levels.map((lv, i) => ({ ...texts(lv), ...texts(s.levels?.[i]) })) }; });
}
function lockedGohai(src = []) {
  return BASE.gohai.map(b => { const s = src.find(x => x.n === b.n) || b; return { n: b.n, pos: b.pos, ...texts(b), ...texts(s) }; });
}
function lockedOptions(src = []) {
  return BASE.gohai_options.map(b => { const s = src.find(x => x.v === b.v) || b; return { v: b.v, ...texts(b), ...texts(s) }; });
}

// q = { version, content } from the server, or null for the built-in version.
export function applyQuestionnaire(q) {
  const version = q?.version || 1;
  if (version === applied) return false;
  const c = version === 1 ? BASE : q.content;
  replace(OHAT_ITEMS, lockedOhat(c.ohat));
  replace(GOHAI_ITEMS, lockedGohai(c.gohai));
  replace(GOHAI_OPTIONS, lockedOptions(c.gohai_options));
  for (const k of LISTS) replace(TARGETS[k], c[k] || BASE[k]);
  applied = version;
  return true;
}

// The content currently in force, in the shape the editor and the server store.
export function currentContent() {
  return structuredClone({ ohat: OHAT_ITEMS, gohai: GOHAI_ITEMS, gohai_options: GOHAI_OPTIONS, complaints: COMPLAINTS, red_flags: RED_FLAGS,
    medicine_flags: MEDICINE_FLAGS, questions: QUESTIONS, photo_views: PHOTO_VIEWS, referral_types: REFERRAL_TYPES });
}

// ---------- validation (run on the server before a version is stored; also used by the editor) ----------
const KEY = /^[a-z<>0-9][a-z0-9_<>-]{0,39}$/;
function cleanText(src, prefix, max, label) {
  const o = {};
  for (const l of Q_LANGS) {
    const v = String(src?.[prefix + l] ?? '').replace(/\s+/g, ' ').trim();
    if (v.length > max) throw new Error(`${label}: text is too long (max ${max} characters)`);
    if (v) o[prefix + l] = v;
  }
  if (!o[prefix + 'en']) throw new Error(`${label}: English text is required`);
  return o;
}
function cleanItems(list, prev, label, idKey, extra) {
  if (!Array.isArray(list)) throw new Error(`${label}: list is missing`);
  const seen = new Set();
  const out = list.map((it, i) => {
    const id = String(it?.[idKey] ?? '').trim();
    if (!KEY.test(id)) throw new Error(`${label} ${i + 1}: code "${id}" must be 1–40 lower-case letters, numbers or _`);
    if (seen.has(id)) throw new Error(`${label}: code "${id}" is used twice`);
    seen.add(id);
    const name = `${label} "${id}"`;
    return { [idKey]: id, ...cleanText(it, '', 300, name), ...(it.active === false ? { active: false } : {}), ...(extra ? extra(it, name, (prev || []).find(p => p[idKey] === id)) : {}) };
  });
  for (const p of prev || []) if (!seen.has(p[idKey])) throw new Error(`${label} "${p[idKey]}" cannot be deleted because earlier visits use it. Retire it instead.`);
  if (label !== 'Medicine group' && !out.some(x => x.active !== false) && ['Complaint', 'Photo view', 'Referral type'].includes(label)) throw new Error(`${label}: keep at least one active`);
  return out;
}

export function validateQuestionnaire(c, prev = currentContent()) {
  if (!c || typeof c !== 'object') throw new Error('Questionnaire is missing');
  // Locked instruments: only wording may change.
  const ohat = BASE.ohat.map(b => {
    const s = (c.ohat || []).find(x => x.key === b.key);
    if (!s) throw new Error(`OHAT item "${b.en}" is missing`);
    if (!Array.isArray(s.levels) || s.levels.length !== 3) throw new Error(`OHAT item "${b.en}" must keep its 3 levels`);
    return { key: b.key, ...cleanText(s, '', 120, `OHAT "${b.en}"`), levels: s.levels.map((lv, i) => cleanText(lv, '', 300, `OHAT "${b.en}" level ${i}`)) };
  });
  if ((c.ohat || []).length !== BASE.ohat.length) throw new Error('OHAT items cannot be added or removed');
  const gohai = BASE.gohai.map(b => {
    const s = (c.gohai || []).find(x => x.n === b.n);
    if (!s) throw new Error(`GOHAI question ${b.n} is missing`);
    return { n: b.n, pos: b.pos, ...cleanText(s, '', 300, `GOHAI question ${b.n}`) };
  });
  if ((c.gohai || []).length !== 12) throw new Error('GOHAI must keep its 12 questions');
  const gohai_options = BASE.gohai_options.map(b => {
    const s = (c.gohai_options || []).find(x => x.v === b.v);
    if (!s) throw new Error(`GOHAI answer ${b.v} is missing`);
    return { v: b.v, ...cleanText(s, '', 60, `GOHAI answer ${b.v}`) };
  });
  const complaints = cleanItems(c.complaints, prev.complaints, 'Complaint', 'key');
  const red_flags = cleanItems(c.red_flags, prev.red_flags, 'Warning sign', 'key', it => cleanText(it, 'advice_', 1000, 'Advice for warning sign'));
  const medicine_flags = cleanItems(c.medicine_flags, prev.medicine_flags, 'Medicine group', 'flag', (it, name) => {
    const names = [...new Set((Array.isArray(it.names) ? it.names : String(it.names || '').split(/[,\n]/)).map(n => String(n).toLowerCase().trim()).filter(Boolean))];
    if (names.some(n => n.length > 40)) throw new Error(`${name}: medicine names must be under 40 characters`);
    if (!names.length) throw new Error(`${name}: add at least one medicine name`);
    return { names: names.slice(0, 300) };
  });
  const questions = cleanItems(c.questions, prev.questions, 'Question', 'key', (it, name, old) => {
    const step = it.step, type = it.type;
    if (!QUESTION_STEPS[step]) throw new Error(`${name}: choose the step (teeth, health or habits)`);
    if (!Q_TYPES.includes(type)) throw new Error(`${name}: choose the answer type`);
    if (old && (old.step !== step || old.type !== type)) throw new Error(`${name}: the step and answer type cannot change once used. Retire it and add a new question.`);
    const out = { step, type };
    const states = Array.isArray(it.states) ? it.states.map(s => String(s).trim()).filter(Boolean).slice(0, 20) : [];
    if (states.length) out.states = states;
    if (it.when === 'denture') out.when = 'denture';
    if (type === 'number') {
      const min = Number(it.min ?? 0), max = Number(it.max ?? 99);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min > max || max > 9999) throw new Error(`${name}: check the lowest and highest number`);
      Object.assign(out, { min, max });
    }
    if (type === 'choice') {
      const opts = cleanItems(it.options || [], old?.options || [], `${name} option`, 'key');
      if (opts.filter(o => o.active !== false).length < 2) throw new Error(`${name}: needs at least two answers`);
      out.options = opts;
    }
    return out;
  });
  const photo_views = cleanItems(c.photo_views, prev.photo_views, 'Photo view', 'key');
  const referral_types = cleanItems(c.referral_types, prev.referral_types, 'Referral type', 'key');
  return { ohat, gohai, gohai_options, complaints, red_flags, medicine_flags, questions, photo_views, referral_types };
}
