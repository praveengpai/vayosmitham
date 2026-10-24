// Questionnaire editor: the AGeD clinical admin edits and publishes; the CIF super admin can roll back.
// OHAT and GOHAI keep their validated structure and scoring — only their wording and translations can change.
import { html, useState, useEffect, useAppState, t, L, LIn, adviceIn, toast, useLoad, Loading, Field, loadRef, roleName } from './ui.js';
import { api } from './api.js';
import { loadLang } from './i18n.js';
import { STATES, LANGUAGES } from '/shared/clinical.js';
import { Q_LANGS, validateQuestionnaire } from '/shared/questionnaire.js';

const TABS = [
  ['questions', 'Questions'], ['complaints', 'Complaints'], ['red_flags', 'Warning signs and advice'], ['medicine_flags', 'Medicines to flag'],
  ['ohat', 'Mouth check (OHAT)'], ['gohai', 'Daily-life questions (GOHAI)'], ['photo_views', 'Photo views'], ['referral_types', 'Referral types'], ['history', 'Versions'],
];
const STEP_LABELS = { teeth: 'Teeth and dentures', health: 'Health', habits: 'Habits' };
const TYPE_LABELS = { yesno: 'Yes / No', habit: 'Never / Stopped / Now', choice: 'Choose one answer', number: 'Number', text: 'Short text' };
const LIST_ID = { medicine_flags: 'flag' };
const langName = code => LANGUAGES.find(l => l.code === code)?.native || code;
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'item';

// Fill empty translations from the language packs, so the editor shows (and a publish keeps) today's wording.
function hydrate(c) {
  const fill = (o, prefix = '') => {
    if (!o || typeof o !== 'object') return;
    for (const l of Q_LANGS) {
      if (l === 'en' || o[prefix + l]) continue;
      const v = prefix === 'advice_' ? adviceIn(l, o) : LIn(l, o);
      if (v && v !== o[prefix + 'en']) o[prefix + l] = v;
    }
  };
  c.ohat.forEach(it => { fill(it); it.levels.forEach(lv => fill(lv)); });
  [...c.gohai, ...c.gohai_options, ...c.complaints, ...c.medicine_flags, ...c.photo_views, ...c.referral_types].forEach(o => fill(o));
  c.red_flags.forEach(o => { fill(o); fill(o, 'advice_'); });
  c.questions.forEach(q => { fill(q); (q.options || []).forEach(o => fill(o)); });
  return c;
}

export function QuestionnaireEditor() {
  const s = useAppState();
  const d = useLoad(() => api('/api/admin/questionnaire'), []);
  const [c, setC] = useState(null);
  const [orig, setOrig] = useState(null);
  const [tab, setTab] = useState('questions');
  const [lang, setLang] = useState(s.user.content_lang && s.user.content_lang !== 'en' ? s.user.content_lang : 'ml');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!d.data) return;
    Promise.all(Q_LANGS.filter(l => l !== 'en').map(loadLang)).then(() => {
      const h = hydrate(structuredClone(d.data.content));
      setC(h); setOrig(structuredClone(h)); setNote('');
    });
  }, [d.data]);
  if (d.loading || d.error) return html`<${Loading} error=${d.error} retry=${d.reload} />`;
  if (!c) return html`<${Loading} />`;
  const canEdit = d.data.can_edit;
  const dirty = JSON.stringify(c) !== JSON.stringify(orig);
  const set = fn => setC(prev => { const n = structuredClone(prev); fn(n); return n; });

  const publish = async () => {
    if (!note.trim()) { toast(t('Write a short note on what changed and why'), true); return; }
    // New items get a permanent code from their English name.
    const content = structuredClone(c);
    for (const k of ['complaints', 'red_flags', 'medicine_flags', 'questions', 'photo_views', 'referral_types']) {
      const id = LIST_ID[k] || 'key';
      const used = new Set(content[k].filter(x => !x._new).map(x => x[id]));
      for (const it of content[k]) {
        if (it._new) { let base = slug(it.en), key = base, i = 2; while (used.has(key)) key = `${base}_${i++}`; it[id] = key; used.add(key); delete it._new; }
        if (it.options) {
          const ou = new Set(it.options.filter(o => !o._new).map(o => o.key));
          for (const o of it.options) if (o._new) { let base = slug(o.en), key = base, i = 2; while (ou.has(key)) key = `${base}_${i++}`; o.key = key; ou.add(key); delete o._new; }
        }
      }
    }
    try { validateQuestionnaire(content, d.data.content); } catch (e) { toast(e.message, true); return; }
    if (!confirm(t('Publish this questionnaire? It goes live for every field worker as soon as their phone is online.'))) return;
    setBusy(true);
    try {
      const r = await api('/api/admin/questionnaire', { method: 'POST', body: { content, note, based_on: d.data.version } });
      toast(`${t('Published version')} ${r.version}`);
      await loadRef(true); d.reload();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const ctx = { c, set, orig, lang, canEdit };
  let body;
  if (tab === 'history') body = html`<${History} d=${d} />`;
  else if (tab === 'ohat') body = html`<${OhatTab} ...${ctx} />`;
  else if (tab === 'gohai') body = html`<${GohaiTab} ...${ctx} />`;
  else if (tab === 'questions') body = html`<${QuestionsTab} ...${ctx} />`;
  else body = html`<${ListTab} list=${tab} ...${ctx} />`;

  return html`
    <div class="row between"><h1 style="margin:0">${t('Questionnaire')}</h1>
      <span class="chip info">${t('Version')} ${d.data.version}</span></div>
    <p class="muted small">${canEdit
      ? t('Changes go live for every field worker when you publish. Nothing is ever deleted: retire an item to hide it from new visits; earlier visits keep it.')
      : t('View only. The AGeD clinical admin edits the questionnaire; the CIF super admin can restore an earlier version.')}
      ${' '}${t('The validated OHAT and GOHAI keep their items and scoring; only the wording and translations can be changed.')}</p>
    <div class="row" style="margin:10px 0;flex-wrap:wrap;gap:6px">${TABS.map(([k, label]) => html`<button type="button" class=${'btn' + (tab === k ? ' primary' : '')} onClick=${() => setTab(k)}>${t(label)}</button>`)}</div>
    ${tab !== 'history' && html`<label class="row small" style="margin-bottom:10px">${t('Second language shown')}
      <select style="max-width:180px" value=${lang} onChange=${e => setLang(e.target.value)}>${Q_LANGS.filter(l => l !== 'en').map(l => html`<option value=${l}>${langName(l)}</option>`)}</select></label>`}
    ${body}
    ${canEdit && dirty && html`<div class="panel stack" style="position:sticky;bottom:8px;margin-top:16px;box-shadow:0 4px 18px rgba(0,0,0,.18)">
      <${Field} label=${t('What changed and why (kept in the version history)')}><input type="text" maxlength="500" value=${note} onInput=${e => setNote(e.target.value)} /><//>
      <div class="btn-row"><button class="btn primary" disabled=${busy} onClick=${publish}>${t('Publish new version')}</button>
        <button class="btn" onClick=${() => { if (confirm(t('Discard your changes?'))) setC(structuredClone(orig)); }}>${t('Discard changes')}</button></div></div>`}`;
}

// English + one other language, side by side. Warns when the English changed but the translation did not.
function TextPair({ o, prefix = '', path, set, orig, lang, canEdit, multiline, label }) {
  const en = o[prefix + 'en'] || '', tx = o[prefix + lang] || '';
  const enChanged = orig && orig[prefix + 'en'] !== undefined && orig[prefix + 'en'] !== en;
  const stale = enChanged && (orig[prefix + lang] || '') === tx;
  const tag = multiline ? 'textarea' : 'input';
  const upd = (l, v) => set(n => { path(n)[prefix + l] = v; });
  const suggest = async () => {
    try { const r = await api('/api/translate', { method: 'POST', body: { text: en, src: 'en', tgt: lang } }); upd(lang, r.text); toast(t('Machine translation added — please check it')); }
    catch (e) { toast(e.message, true); }
  };
  return html`<div class="grid-2">
    <label class="field"><span class="lbl">${label ? t(label) + ' — ' : ''}English</span>
      ${html`<${tag} type="text" value=${en} disabled=${!canEdit} onInput=${e => upd('en', e.target.value)} rows=${multiline ? 3 : undefined} />`}</label>
    <label class="field"><span class="lbl">${langName(lang)}${stale ? html` <span class="chip warn">${t('update translation')}</span>` : ''}</span>
      ${html`<${tag} type="text" value=${tx} disabled=${!canEdit} placeholder=${t('Not translated — English will be shown')} onInput=${e => upd(lang, e.target.value)} rows=${multiline ? 3 : undefined} />`}
      ${canEdit && en && html`<button type="button" class="btn link tiny" style="align-self:flex-start;padding:2px 0" onClick=${suggest}>${t('Suggest machine translation')}</button>`}</label>
  </div>`;
}

function ItemHead({ title, retired, onUp, onDown, onRetire, open, setOpen, canEdit, isNew }) {
  return html`<div class="row between">
    <button type="button" class="btn link" style="text-align:left;justify-content:flex-start;flex:1" onClick=${() => setOpen(!open)}>${open ? '▾' : '▸'} <strong>${title || t('(new item)')}</strong>
      ${retired ? html` <span class="chip">${t('retired')}</span>` : ''}${isNew ? html` <span class="chip info">${t('new')}</span>` : ''}</button>
    ${canEdit && html`<span class="nowrap"><button type="button" class="btn link" aria-label=${t('Move up')} onClick=${onUp}>▲</button><button type="button" class="btn link" aria-label=${t('Move down')} onClick=${onDown}>▼</button>
      <button type="button" class="btn link" onClick=${onRetire}>${retired ? t('Bring back') : t('Retire')}</button></span>`}
  </div>`;
}

function useOpen() { const [o, setO] = useState({}); return [k => !!o[k], (k, v) => setO({ ...o, [k]: v })]; }
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

// Complaints, warning signs, medicine groups, photo views, referral types.
function ListTab({ list, c, set, orig, lang, canEdit }) {
  const [isOpen, setOpen] = useOpen();
  const id = LIST_ID[list] || 'key';
  const items = c[list];
  const add = () => set(n => { const it = { [id]: 'new_' + Math.random().toString(36).slice(2, 7), en: '', _new: true }; if (list === 'medicine_flags') it.names = []; if (list === 'red_flags') it.advice_en = ''; n[list].push(it); });
  return html`<div class="stack">
    ${list === 'red_flags' && html`<div class="callout info small">${t('Any warning sign makes the visit urgent and shows the advice to the field worker immediately.')}</div>`}
    ${list === 'medicine_flags' && html`<div class="callout info small">${t('A medicine is flagged when its name contains any of the listed names (generic names, lower case).')}</div>`}
    ${items.map((it, i) => {
      const k = it[id], o = orig[list].find(x => x[id] === k);
      return html`<div class="panel stack" style=${it.active === false ? 'opacity:.6' : ''}>
        <${ItemHead} title=${it.en} retired=${it.active === false} isNew=${it._new} open=${isOpen(k)} setOpen=${v => setOpen(k, v)} canEdit=${canEdit}
          onUp=${() => set(n => move(n[list], i, -1))} onDown=${() => set(n => move(n[list], i, 1))}
          onRetire=${() => set(n => { const x = n[list][i]; if (x.active === false) delete x.active; else x.active = false; })} />
        ${isOpen(k) && html`<div class="stack">
          <${TextPair} o=${it} path=${n => n[list][i]} set=${set} orig=${o} lang=${lang} canEdit=${canEdit} label=${list === 'red_flags' ? 'Warning sign' : 'Name'} />
          ${list === 'red_flags' && html`<${TextPair} o=${it} prefix="advice_" path=${n => n[list][i]} set=${set} orig=${o} lang=${lang} canEdit=${canEdit} multiline label="Advice shown to the field worker" />`}
          ${list === 'medicine_flags' && html`<${Field} label=${t('Medicine names (one per line or separated by commas)')}>
            <textarea rows="4" disabled=${!canEdit} value=${(it.names || []).join(', ')} onInput=${e => set(n => { n[list][i].names = e.target.value.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean); })}></textarea><//>`}
          <p class="tiny muted">${t('Code')}: ${it._new ? t('set when published') : k}</p></div>`}
      </div>`;
    })}
    ${canEdit && html`<div><button type="button" class="btn" onClick=${add}>+ ${t('Add')}</button></div>`}
  </div>`;
}

function QuestionsTab({ c, set, orig, lang, canEdit }) {
  const [isOpen, setOpen] = useOpen();
  const add = step => set(n => n.questions.push({ key: 'new_' + Math.random().toString(36).slice(2, 7), step, type: 'yesno', en: '', _new: true }));
  return html`<div class="stack">${Object.entries(STEP_LABELS).map(([step, stepLabel]) => html`
    <h2 style="margin:8px 0 0">${t(stepLabel)}</h2>
    ${step === 'teeth' && html`<p class="tiny muted">${t('Number of natural teeth, upper and lower dentures and denture fit are fixed core questions and always asked.')}</p>`}
    ${step === 'health' && html`<p class="tiny muted">${t('The medicines list is always asked after these questions.')}</p>`}
    ${c.questions.map((q, i) => {
      if (q.step !== step) return '';
      const o = orig.questions.find(x => x.key === q.key);
      const locked = !q._new;
      return html`<div class="panel stack" style=${q.active === false ? 'opacity:.6' : ''}>
        <${ItemHead} title=${q.en} retired=${q.active === false} isNew=${q._new} open=${isOpen(q.key)} setOpen=${v => setOpen(q.key, v)} canEdit=${canEdit}
          onUp=${() => set(n => move(n.questions, i, -1))} onDown=${() => set(n => move(n.questions, i, 1))}
          onRetire=${() => set(n => { const x = n.questions[i]; if (x.active === false) delete x.active; else x.active = false; })} />
        ${!isOpen(q.key) && html`<p class="tiny muted" style="margin:0">${t(TYPE_LABELS[q.type])}${q.states?.length ? ' · ' + q.states.join(', ') : ''}${q.when === 'denture' ? ' · ' + t('only if dentures') : ''}</p>`}
        ${isOpen(q.key) && html`<div class="stack">
          <${TextPair} o=${q} path=${n => n.questions[i]} set=${set} orig=${o} lang=${lang} canEdit=${canEdit} label="Question" />
          <div class="grid-2">
            <${Field} label=${t('Step')} hint=${locked ? t('Cannot change once published') : ''}><select disabled=${!canEdit || locked} value=${q.step} onChange=${e => set(n => { n.questions[i].step = e.target.value; })}>
              ${Object.entries(STEP_LABELS).map(([k, v]) => html`<option value=${k}>${t(v)}</option>`)}</select><//>
            <${Field} label=${t('Answer type')} hint=${locked ? t('Cannot change once published') : ''}><select disabled=${!canEdit || locked} value=${q.type} onChange=${e => set(n => { const x = n.questions[i]; x.type = e.target.value; if (x.type === 'choice' && !x.options) x.options = []; if (x.type === 'number') { x.min ??= 0; x.max ??= 20; } })}>
              ${Object.entries(TYPE_LABELS).map(([k, v]) => html`<option value=${k}>${t(v)}</option>`)}</select><//>
          </div>
          ${q.type === 'number' && html`<div class="grid-2">
            <${Field} label=${t('Lowest')}><input type="number" disabled=${!canEdit} value=${q.min ?? 0} onInput=${e => set(n => { n.questions[i].min = Number(e.target.value); })} /><//>
            <${Field} label=${t('Highest')}><input type="number" disabled=${!canEdit} value=${q.max ?? 99} onInput=${e => set(n => { n.questions[i].max = Number(e.target.value); })} /><//></div>`}
          ${q.type === 'choice' && html`<${Options} q=${q} i=${i} set=${set} o=${o} lang=${lang} canEdit=${canEdit} />`}
          <div><span class="lbl">${t('Ask only in these states (none ticked = all states)')}</span>
            <div class="row" style="flex-wrap:wrap;gap:4px 14px">${STATES.filter(x => x !== 'Other').map(st => html`<label class="choice small"><input type="checkbox" disabled=${!canEdit} checked=${(q.states || []).includes(st)}
              onChange=${e => set(n => { const x = n.questions[i]; const ss = new Set(x.states || []); e.target.checked ? ss.add(st) : ss.delete(st); x.states = [...ss]; if (!x.states.length) delete x.states; })} /> ${st}</label>`)}</div></div>
          <label class="choice small"><input type="checkbox" disabled=${!canEdit} checked=${q.when === 'denture'} onChange=${e => set(n => { const x = n.questions[i]; if (e.target.checked) x.when = 'denture'; else delete x.when; })} /> ${t('Ask only if the person has a denture')}</label>
          <p class="tiny muted">${t('Code')}: ${q._new ? t('set when published') : q.key}</p></div>`}
      </div>`;
    })}
    ${canEdit && html`<div><button type="button" class="btn" onClick=${() => add(step)}>+ ${t('Add a question')} (${t(stepLabel)})</button></div>`}`)}
  </div>`;
}

function Options({ q, i, set, o, lang, canEdit }) {
  return html`<div class="stack" style="border-left:3px solid var(--line, #ddd);padding-left:10px">
    <span class="lbl">${t('Answers')}</span>
    ${(q.options || []).map((op, j) => html`<div style=${op.active === false ? 'opacity:.6' : ''}>
      <${TextPair} o=${op} path=${n => n.questions[i].options[j]} set=${set} orig=${o?.options?.find(x => x.key === op.key)} lang=${lang} canEdit=${canEdit} label=${`${t('Answer')} ${j + 1}`} />
      ${canEdit && html`<button type="button" class="btn link tiny" onClick=${() => set(n => { const x = n.questions[i].options[j]; if (x._new) n.questions[i].options.splice(j, 1); else if (x.active === false) delete x.active; else x.active = false; })}>
        ${op._new ? t('Remove') : op.active === false ? t('Bring back') : t('Retire')}</button>`}</div>`)}
    ${canEdit && html`<div><button type="button" class="btn link" onClick=${() => set(n => { (n.questions[i].options ||= []).push({ key: 'new_' + Math.random().toString(36).slice(2, 7), en: '', _new: true }); })}>+ ${t('Add an answer')}</button></div>`}
  </div>`;
}

function OhatTab({ c, set, orig, lang, canEdit }) {
  const [isOpen, setOpen] = useOpen();
  return html`<div class="stack">${c.ohat.map((it, i) => html`<div class="panel stack">
    <button type="button" class="btn link" style="text-align:left;justify-content:flex-start" onClick=${() => setOpen(it.key, !isOpen(it.key))}>${isOpen(it.key) ? '▾' : '▸'} <strong>${it.en}</strong></button>
    ${isOpen(it.key) && html`<div class="stack">
      <${TextPair} o=${it} path=${n => n.ohat[i]} set=${set} orig=${orig.ohat[i]} lang=${lang} canEdit=${canEdit} label="Item" />
      ${it.levels.map((lv, j) => html`<${TextPair} o=${lv} path=${n => n.ohat[i].levels[j]} set=${set} orig=${orig.ohat[i].levels[j]} lang=${lang} canEdit=${canEdit} multiline label=${`${t('Score')} ${j}`} />`)}</div>`}
  </div>`)}</div>`;
}

function GohaiTab({ c, set, orig, lang, canEdit }) {
  return html`<div class="stack">
    <div class="callout info small">${t('Read after: "In the last 3 months, how often have you…". Items 3, 5 and 7 are positive and reverse-scored. Where a validated translation exists for a language, use its exact wording.')}</div>
    ${c.gohai.map((q, i) => html`<div class="panel"><${TextPair} o=${q} path=${n => n.gohai[i]} set=${set} orig=${orig.gohai[i]} lang=${lang} canEdit=${canEdit} label=${`${t('Question')} ${q.n}${q.pos ? ' (+)' : ''}`} /></div>`)}
    <h2>${t('Answers')}</h2>
    ${c.gohai_options.map((op, i) => html`<div class="panel"><${TextPair} o=${op} path=${n => n.gohai_options[i]} set=${set} orig=${orig.gohai_options[i]} lang=${lang} canEdit=${canEdit} label=${`${op.v}`} /></div>`)}
  </div>`;
}

function History({ d }) {
  const { history, version, can_restore } = d.data;
  const restore = async v => {
    if (!confirm(`${t('Restore version')} ${v}? ${t('This publishes it again as a new version for every field worker.')}`)) return;
    try { const r = await api('/api/admin/questionnaire/restore', { method: 'POST', body: { version: v } }); toast(`${t('Published version')} ${r.version}`); await loadRef(true); d.reload(); }
    catch (e) { toast(e.message, true); }
  };
  const rows = [...history, { version: 1, note: t('Built-in questionnaire'), created_at: null, created_by_name: 'Vayosmitham', created_by_role: '' }];
  return html`<div class="table-wrap"><table class="t">
    <thead><tr><th>${t('Version')}</th><th>${t('When (UTC)')}</th><th>${t('By')}</th><th>${t('What changed')}</th><th></th></tr></thead>
    <tbody>${rows.map(r => html`<tr><td><strong>${r.version}</strong>${r.version === version ? html` <span class="chip routine">${t('in use')}</span>` : ''}</td>
      <td class="nowrap small">${r.created_at || '—'}</td><td class="small">${r.created_by_name || ''} <span class="tiny">${r.created_by_role ? t(roleName(r.created_by_role)) : ''}</span></td>
      <td class="small">${r.note}${r.restored_from ? html` <span class="tiny">(${t('restored from')} ${r.restored_from})</span>` : ''}</td>
      <td>${can_restore && r.version !== version && html`<button class="btn link" onClick=${() => restore(r.version)}>${t('Restore')}</button>`}</td></tr>`)}</tbody></table></div>
    ${!can_restore && html`<p class="tiny muted" style="margin-top:8px">${t('Only the CIF super admin can restore an earlier version.')}</p>`}`;
}
