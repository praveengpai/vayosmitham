import { html, render, useState, useEffect, state, setState, useAppState, useRoute, go, t, toast, Field, Logo, Icon, loadRef, Switch, useLanguage, uiLang } from './ui.js';
import { api, unlockVault, vaultUnlocked, vaultOwner, listOutbox, syncOutbox, rekeyVault, lockVault } from './api.js';
import { WorkerHome, PeopleList, PersonView, CaseView, Outbox } from './field.js';
import { VisitWizard } from './visit.js';
import { DentistQueue, DentistCase, DentistHistory } from './dentist.js';
import { AdminArea, AuditQueue, AuditCase } from './admin.js';
import { ReportView } from './report.js';
import { LANGUAGES, UI_LANGUAGES } from '/shared/clinical.js';
import { CONSENT_VERSION, isDraft, contactGaps } from '/shared/consent.js';

// ---------- boot ----------
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  addEventListener('online', () => { setState({ online: true }); runSync(); });
  addEventListener('offline', () => setState({ online: false }));
  try {
    const { user } = await api('/api/me');
    try { localStorage.setItem('vs_user', JSON.stringify(user)); } catch { /* ignore */ }
    setState({ user });
  } catch (e) {
    if (e.code === 'offline') {
      try { const cached = JSON.parse(localStorage.getItem('vs_user') || 'null'); if (cached) setState({ user: cached, offlineSession: true }); } catch { /* ignore */ }
    }
  }
  await useLanguage(deviceLang() || state.user?.ui_lang || 'en');
  render(html`<${App} />`, document.getElementById('app'));
  if (state.user) { loadRef(); refreshOutbox(); }
  setInterval(() => { if (state.user && navigator.onLine) runSync(); }, 60000);
}

// The language picked on the sign-in page is remembered on this device.
export function deviceLang() { try { return localStorage.getItem('vs_lang'); } catch { return null; } }
function setDeviceLang(code) { try { localStorage.setItem('vs_lang', code); } catch { /* ignore */ } }
const nativeName = code => LANGUAGES.find(l => l.code === code)?.native || code;

export async function refreshOutbox() {
  try { setState({ outbox: await listOutbox() }); } catch { /* IndexedDB unavailable */ }
}
export async function runSync() {
  if (!vaultUnlocked()) return;
  const r = await syncOutbox(refreshOutbox);
  await refreshOutbox();
  if (r?.sent) toast(`${r.sent} ${t('saved visit(s) sent to the dentists')}`);
}

// ---------- shell ----------
function App() {
  const s = useAppState();
  const route = useRoute();
  if (!s.user) return html`<${Login} />`;
  if (s.user.must_change) return html`<${ChangePin} first />`;
  if (s.user.role === 'worker' && !s.vaultChecked) return html`<${VaultGate} />`;
  if (route.startsWith('/report/')) return html`<${Frame}><${ReportView} caseId=${route.split('/')[2]} /><//>`;
  return html`<${Frame}>${routeFor(s.user, route)}<//>`;
}

function routeFor(user, route) {
  const [, a, b, c] = route.split('/');
  if (a === 'me') return html`<${Profile} />`;
  if (user.role === 'worker' || user.role === 'coordinator') {
    if (a === 'visit') return html`<${VisitWizard} personId=${b || null} />`;
    if (a === 'people' && b) return html`<${PersonView} id=${b} />`;
    if (a === 'people') return html`<${PeopleList} />`;
    if (a === 'case') return html`<${CaseView} id=${b} />`;
    if (a === 'outbox') return html`<${Outbox} />`;
    if (user.role === 'coordinator' && a === 'admin') return html`<${AdminArea} section=${b || 'dashboard'} id=${c} />`;
    return html`<${WorkerHome} />`;
  }
  if (user.role === 'dentist') {
    if (a === 'case') return html`<${DentistCase} id=${b} />`;
    if (a === 'history') return html`<${DentistHistory} />`;
    return html`<${DentistQueue} />`;
  }
  if (user.role === 'auditor') {
    if (a === 'audit' && b) return html`<${AuditCase} id=${b} />`;
    if (a === 'admin') return html`<${AdminArea} section=${b || 'kb_items'} id=${c} />`;
    return html`<${AuditQueue} />`;
  }
  if (a === 'audit' && b) return html`<${AuditCase} id=${b} />`;
  if (a === 'audit') return html`<${AuditQueue} />`;
  return html`<${AdminArea} section=${a === 'admin' ? (b || 'dashboard') : 'dashboard'} id=${c} />`;
}

function Frame({ children }) {
  const s = useAppState();
  const route = useRoute();
  const u = s.user;
  const field = u.role === 'worker' || u.role === 'coordinator';
  const pending = (s.outbox || []).length;
  const tab = (path, label, icon, dot) => html`<a href=${'#' + path} class=${(path === '/' ? route === '/' : route.startsWith(path)) ? 'on' : ''}>${icon}<span>${label}</span>${dot ? html`<span class="dot">${dot}</span>` : ''}</a>`;
  return html`
    <header class="top"><div class="top-in">
      <a class="brand" href="#/"><${Logo} /><span>Vayosmitham</span></a>
      ${u.role === 'dentist' && html`<nav class="row" style="margin-left:16px"><a href="#/" style="color:#fff">${t('Queue')}</a><a href="#/history" style="color:#fff">${t('My opinions')}</a></nav>`}
      <a class="who" href="#/me" style="color:#fff;text-decoration:none">${u.name}<br /><span class="tiny" style="color:#d8ece8">${t(roleName(u.role))}</span></a>
    </div></header>
    ${(isDraft(CONSENT_VERSION) || contactGaps(s.ref?.settings || {}).length > 0) && html`<div class="demo-bar">${t('Pilot version — use test data only until the legal review is complete')}</div>`}
    ${!s.online && html`<div class="offline-bar">${t('No internet. You can keep recording visits; they will be sent when you are back online.')}</div>`}
    <main>${children}</main>
    ${field && html`<nav class="bottom-nav" aria-label=${t('Main')}>
      ${tab('/', t('Home'), Icon.home)}
      ${tab('/visit', t('New visit'), Icon.plus)}
      ${tab('/people', t('People'), Icon.people)}
      ${tab('/outbox', t('To send'), Icon.sync, pending || null)}
      ${tab('/me', t('Me'), Icon.me)}
    </nav>`}`;
}

export function roleName(r) {
  return { worker: 'Field worker', coordinator: 'Coordinator', dentist: 'Dentist', admin: 'Administrator', auditor: 'Clinical auditor', dpo: 'Data protection lead', researcher: 'Researcher' }[r] || r;
}

// ---------- sign in ----------
function Login() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { user } = await api('/api/auth/login', { method: 'POST', body: { phone, pin } });
      try { localStorage.setItem('vs_user', JSON.stringify(user)); } catch { /* ignore */ }
      if (user.role === 'worker') { await unlockVault(user.id, pin); setState({ vaultChecked: true }); }
      // A language chosen on this device's sign-in page wins; otherwise use the profile's language.
      const chosen = deviceLang();
      if (chosen && chosen !== user.ui_lang) {
        const patch = { ui_lang: chosen };
        if ((user.role === 'worker' || user.role === 'coordinator') && chosen !== 'en') patch.content_lang = chosen;
        Object.assign(user, patch);
        api('/api/me/prefs', { method: 'PATCH', body: patch }).catch(() => {});
      }
      await useLanguage(user.ui_lang || 'en');
      setState({ user });
      loadRef(true); refreshOutbox(); runSync();
      go('/');
    } catch (e2) { setErr(e2.code === 'offline' ? t('You need internet to sign in.') : e2.message); }
    setBusy(false);
  };
  const lang = uiLang();
  const pick = async code => { setDeviceLang(code); await useLanguage(code); };
  return html`<div class="login"><form class="login-card stack" onSubmit=${submit}>
    <div class="lang-pick" role="radiogroup" aria-label="Language">
      ${UI_LANGUAGES.map(code => html`<button type="button" role="radio" aria-checked=${lang === code} class=${lang === code ? 'on' : ''} lang=${code} onClick=${() => pick(code)}>${nativeName(code)}</button>`)}
    </div>
    <div class="login-mark"><svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#0c5f56"/><path d="M176 132c-34 0-62 28-62 66 0 46 16 78 28 118 9 31 14 66 36 66 18 0 22-28 30-54 6-20 14-32 28-32s22 12 28 32c8 26 12 54 30 54 22 0 27-35 36-66 12-40 28-72 28-118 0-38-28-66-62-66-26 0-38 14-60 14s-34-14-60-14z" fill="#fff"/><path d="M128 400c70 52 186 52 256 0" stroke="#e5a21b" stroke-width="30" stroke-linecap="round" fill="none"/></svg>
      <div><div class="name">Vayosmitham</div><div class="sub">${t('Oral health for older people')}</div></div></div>
    <${Field} label=${t('Mobile number')}><input type="tel" inputmode="numeric" autocomplete="username" value=${phone} onInput=${e => setPhone(e.target.value)} required /><//>
    <${Field} label=${t('6-digit PIN')}><input class="pin-input" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" value=${pin} onInput=${e => setPin(e.target.value)} required /><//>
    ${err && html`<div class="callout urgent" role="alert">${err}</div>`}
    <button class="btn primary big" disabled=${busy}>${busy ? t('Signing in…') : t('Sign in')}</button>
    <p class="tiny">${t('Forgot your PIN? Ask your coordinator to reset it.')} ${t('A project of Community Innovation Foundation with the Association of Geriatric Dentistry (AGeD).')}</p>
  </form></div>`;
}

// Workers: saved offline visits are encrypted; the PIN unlocks them after the app is reopened.
function VaultGate() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  // The app opens with the PIN (like a phone lock), because visits saved on the phone are encrypted with it.
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const owner = await vaultOwner().catch(() => null);
      if (owner !== state.user.id) {
        // First use on this phone: check the PIN with the server before creating the lock.
        try { await api('/api/me/verify-pin', { method: 'POST', body: { pin } }); }
        catch (e2) { if (e2.code !== 'offline') { setErr(e2.message); setBusy(false); return; } }
      }
      if (await unlockVault(state.user.id, pin)) { setState({ vaultChecked: true }); refreshOutbox(); runSync(); }
      else setErr(t('That PIN does not open the saved visits on this phone.'));
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  return html`<div class="login"><form class="login-card stack" onSubmit=${submit}>
    <h1>${t('Enter your PIN')}</h1>
    <p>${t('Visits saved on this phone are locked. Enter your PIN to open them.')}</p>
    <input class="pin-input" type="password" inputmode="numeric" maxlength="6" value=${pin} onInput=${e => setPin(e.target.value)} autofocus />
    ${err && html`<div class="callout urgent">${err}</div>`}
    <button class="btn primary big" disabled=${busy}>${t('Unlock')}</button>
    <button type="button" class="btn link" onClick=${async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setState({ user: null }); }}>${t('Sign in as someone else')}</button>
  </form></div>`;
}

export function ChangePin({ first }) {
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [err, setErr] = useState(null);
  const submit = async e => {
    e.preventDefault();
    if (n1 !== n2) return setErr(t('The two new PINs do not match'));
    try {
      await api('/api/me/pin', { method: 'POST', body: { current: cur, new: n1 } });
      if (state.user.role === 'worker') {
        if (vaultUnlocked()) await rekeyVault(state.user.id, n1); else await unlockVault(state.user.id, n1);
        setState({ vaultChecked: true });
      }
      setState({ user: { ...state.user, must_change: false } });
      toast(t('PIN changed'));
      go('/');
    } catch (e2) { setErr(e2.message); }
  };
  const form = html`<form class="stack" onSubmit=${submit}>
    ${first && html`<h1>${t('Set your own PIN')}</h1><p>${t('Replace the temporary PIN you were given with a 6-digit PIN only you know.')}</p>`}
    <${Field} label=${t('Current PIN')}><input class="pin-input" type="password" inputmode="numeric" maxlength="6" value=${cur} onInput=${e => setCur(e.target.value)} required /><//>
    <${Field} label=${t('New PIN')} hint=${t('6 digits. Not 111111 or 123456.')}><input class="pin-input" type="password" inputmode="numeric" maxlength="6" value=${n1} onInput=${e => setN1(e.target.value)} required /><//>
    <${Field} label=${t('New PIN again')}><input class="pin-input" type="password" inputmode="numeric" maxlength="6" value=${n2} onInput=${e => setN2(e.target.value)} required /><//>
    ${err && html`<div class="callout urgent" role="alert">${err}</div>`}
    <button class="btn primary big">${t('Save PIN')}</button>
  </form>`;
  return first ? html`<div class="login"><div class="login-card">${form}</div></div>` : form;
}

function Profile() {
  const s = useAppState();
  const u = s.user;
  const save = async patch => {
    try {
      await api('/api/me/prefs', { method: 'PATCH', body: patch });
      const user = { ...u, ...patch };
      setState({ user });
      try { localStorage.setItem('vs_user', JSON.stringify(user)); } catch { /* ignore */ }
    } catch (e) { toast(e.message, true); }
  };
  const logout = async () => {
    if ((s.outbox || []).length && !confirm(t('Some visits have not been sent yet. They stay on this phone, locked with your PIN. Sign out anyway?'))) return;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    lockVault();
    try { localStorage.removeItem('vs_user'); } catch { /* ignore */ }
    setState({ user: null, vaultChecked: false });
    go('/');
  };
  return html`<div class="narrow">
    <h1>${u.name}</h1>
    <div class="panel"><dl class="kv">
      <dt>${t('Role')}</dt><dd>${t(roleName(u.role))}</dd>
      <dt>${t('Mobile')}</dt><dd>${u.phone}</dd>
      ${u.lsgd_name && html`<dt>${t('Area')}</dt><dd>${u.lsgd_name}${u.ward ? `, ${t('ward')} ${u.ward}` : ''} · ${u.district}, ${u.state}</dd>`}
      ${u.reg_number && html`<dt>${t('Registration')}</dt><dd>${u.reg_council} ${u.reg_number}</dd>`}
    </dl></div>
    <div class="panel stack">
      <h2>${t('Language')}</h2>
      <${Field} label=${t('App language')}>
        <select value=${uiLang()} onChange=${async e => { const code = e.target.value; setDeviceLang(code); await useLanguage(code); save({ ui_lang: code }); }}>
          ${UI_LANGUAGES.map(code => html`<option value=${code}>${nativeName(code)}${code !== 'en' ? ` (${LANGUAGES.find(l => l.code === code)?.name})` : ''}</option>`)}</select><//>
      <${Field} label=${t('Translate notes into')} hint=${t('Notes written in another language are shown with a machine translation into this language.')}>
        <select value=${u.content_lang} onChange=${e => save({ content_lang: e.target.value })}>${LANGUAGES.map(l => html`<option value=${l.code}>${l.native}${l.native !== l.name ? ` (${l.name})` : ''}</option>`)}</select><//>
      <${Switch} checked=${u.translate_on} onChange=${v => save({ translate_on: v })} label=${t('Show translations')} />
    </div>
    <div class="panel"><h2>${t('Change PIN')}</h2><${ChangePin} /></div>
    <div class="panel"><button class="btn danger big" onClick=${logout}>${t('Sign out')}</button></div>
    <p class="tiny" style="margin-top:16px">Vayosmitham · Community Innovation Foundation with the Association of Geriatric Dentistry (AGeD). ${t('Opinions are advisory screening opinions, not a diagnosis or prescription.')} <a href="/privacy.html" target="_blank" rel="noopener">${t('Privacy notice')}</a></p>
  </div>`;
}

boot();
