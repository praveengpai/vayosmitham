// Vayosmitham API — Cloudflare Worker entry point.
import { HttpError, json, body, str, oneOf, audit, parseJSON } from './util.js';
import { login, logout, currentUser, publicUser, hashPin, validPin, requireRole } from './auth.js';
import { translate, glossaryHits } from './translate.js';
import { getMedia } from './media.js';
import * as field from './field.js';
import * as dentist from './dentist.js';
import * as admin from './admin.js';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'geolocation=(), microphone=(self), camera=(self)',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

// [method, pattern, handler(env, req, user, ...params)]
const ROUTES = [
  ['GET', '/api/health', async () => json({ ok: true, app: 'vayosmitham' })],
  ['GET', '/api/me', async (env, req, user) => { if (!user) throw new HttpError(401, 'Please sign in'); return json({ user: publicUser(user) }); }],
  ['POST', '/api/me/pin', changePin],
  ['POST', '/api/me/verify-pin', verifyPin],
  ['PATCH', '/api/me/prefs', savePrefs],
  ['GET', '/api/ref', reference],
  ['POST', '/api/translate', translateApi],
  ['GET', '/api/media/:id', media],

  // field workers
  ['GET', '/api/worker/home', field.workerHome],
  ['GET', '/api/persons', field.listPersons],
  ['POST', '/api/persons/check-duplicate', field.checkDuplicate],
  ['GET', '/api/persons/:id', field.getPerson],
  ['PATCH', '/api/persons/:id', field.updatePerson],
  ['POST', '/api/persons/:id/withdraw-consent', field.withdrawConsent],
  ['POST', '/api/visits', field.submitVisit],
  ['POST', '/api/cases/:id/images', field.uploadImage],
  ['GET', '/api/cases/:id', field.getCaseForWorker],
  ['POST', '/api/cases/:id/info-response', field.respondInfo],
  ['GET', '/api/cases/:id/report', field.reportData],
  ['POST', '/api/cases/:id/referral-outcome', field.referralOutcome],

  // dentists
  ['GET', '/api/dentist/queue', dentist.queue],
  ['GET', '/api/dentist/history', dentist.history],
  ['POST', '/api/dentist/cases/:id/claim', dentist.claim],
  ['POST', '/api/dentist/cases/:id/release', dentist.release],
  ['GET', '/api/dentist/cases/:id', dentist.getCase],
  ['POST', '/api/dentist/cases/:id/opinion', dentist.saveOpinion],
  ['POST', '/api/dentist/cases/:id/info-request', dentist.requestInfo],
  ['POST', '/api/dentist/opinions/:id/correct', dentist.correctOpinion],

  // clinical audit
  ['GET', '/api/audit/queue', admin.auditQueue],
  ['GET', '/api/audit/opinions/:id', admin.auditCase],
  ['POST', '/api/audit/opinions/:id', admin.saveAudit],

  // administration
  ['GET', '/api/admin/users', admin.listUsers],
  ['POST', '/api/admin/users', admin.createUser],
  ['PATCH', '/api/admin/users/:id', admin.updateUser],
  ['POST', '/api/admin/users/:id/reset-pin', admin.resetPin],
  ['GET', '/api/admin/dashboard', admin.dashboard],
  ['GET', '/api/admin/indicators.csv', admin.indicatorsCsv],
  ['GET', '/api/admin/audit-log', admin.auditLog],
  ['GET', '/api/admin/consents', admin.consentLog],
  ['POST', '/api/admin/settings', admin.saveSettings],
  ['POST', '/api/admin/lsgds/import', admin.importLsgds],
  ['POST', '/api/admin/kb_items/:id/approve', admin.approveKb],
  ['POST', '/api/admin/:table', (env, req, user, table) => admin.upsertRef(env, req, user, table, null)],
  ['PUT', '/api/admin/:table/:id', admin.upsertRef],
  ['DELETE', '/api/admin/:table/:id', admin.deleteRef],
  ['GET', '/api/research/extract.csv', admin.researchExtract],
];

const COMPILED = ROUTES.map(([m, p, h]) => {
  const keys = [];
  const re = new RegExp('^' + p.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { m, re, h };
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/v/')) return verifyPage(env, url.pathname.slice(3));
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      // CSRF protection: state-changing requests must come from this origin.
      if (req.method !== 'GET') {
        const origin = req.headers.get('origin');
        if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked');
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const b = await body(req);
        const { user, setCookie } = await login(env, b.phone, b.pin);
        ctx.waitUntil(audit(env, user, 'auth.login'));
        return withHeaders(json({ user }, 200, { 'set-cookie': setCookie }));
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        return withHeaders(json({ ok: true }, 200, { 'set-cookie': await logout(env, req) }));
      }
      const user = await currentUser(env, req);
      for (const r of COMPILED) {
        if (r.m !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (m) return withHeaders(await r.h(env, req, user, ...m.slice(1).map(decodeURIComponent)));
      }
      throw new HttpError(404, 'Not found');
    } catch (e) {
      if (e instanceof HttpError) return withHeaders(json({ error: e.message, code: e.code }, e.status));
      console.error(e.stack || e);
      return withHeaders(json({ error: 'Something went wrong on the server' }, 500));
    }
  },

  // Hourly: mark cases that have passed their response target, so the dashboard and coordinators see them.
  async scheduled(event, env) {
    const s = Object.fromEntries((await env.CLINICAL.prepare('SELECT key, value FROM settings').all()).results.map(r => [r.key, r.value]));
    await env.CLINICAL.prepare(
      `UPDATE cases SET escalated_at = datetime('now') WHERE status = 'submitted' AND escalated_at IS NULL AND (
         (urgency = 'urgent' AND (julianday('now') - julianday(submitted_at)) * 24 > ?) OR
         (urgency = 'routine' AND (julianday('now') - julianday(submitted_at)) * 24 > ?))`)
      .bind(Number(s.sla_urgent_hours || 24), Number(s.sla_routine_hours || 72)).run();
    await env.IDENTITY.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  },
};

function withHeaders(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

async function changePin(env, req, user) {
  if (!user) throw new HttpError(401, 'Please sign in');
  const b = await body(req);
  const cur = await hashPin(String(b.current || ''), user.pin_salt);
  if (cur.hash !== user.pin_hash) {
    await env.IDENTITY.prepare("UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?").bind(user.id).run();
    throw new HttpError(400, 'Current PIN is not correct');
  }
  if (!validPin(b.new)) throw new HttpError(400, 'Choose a 6-digit PIN that is not all the same digit or a simple sequence');
  if (b.new === b.current) throw new HttpError(400, 'New PIN must be different');
  const { hash, salt } = await hashPin(String(b.new));
  await env.IDENTITY.prepare("UPDATE users SET pin_hash = ?, pin_salt = ?, must_change = 0, updated_at = datetime('now') WHERE id = ?").bind(hash, salt, user.id).run();
  await audit(env, user, 'auth.change_pin');
  return json({ ok: true });
}

async function verifyPin(env, req, user) {
  if (!user) throw new HttpError(401, 'Please sign in');
  const b = await body(req);
  if (user.locked_until && user.locked_until > new Date().toISOString().replace('T', ' ').slice(0, 19)) throw new HttpError(423, 'Too many attempts. Try again after 15 minutes.');
  const { hash } = await hashPin(String(b.pin || ''), user.pin_salt);
  if (hash !== user.pin_hash) {
    const fails = user.failed_attempts + 1;
    await env.IDENTITY.prepare("UPDATE users SET failed_attempts = ?, locked_until = CASE WHEN ? >= 5 THEN datetime('now', '+15 minutes') ELSE NULL END WHERE id = ?")
      .bind(fails >= 5 ? 0 : fails, fails, user.id).run();
    throw new HttpError(400, 'PIN is not correct');
  }
  await env.IDENTITY.prepare('UPDATE users SET failed_attempts = 0 WHERE id = ?').bind(user.id).run();
  return json({ ok: true });
}

async function savePrefs(env, req, user) {
  if (!user) throw new HttpError(401, 'Please sign in');
  const b = await body(req);
  const langs = ['en', 'ml', 'ta', 'kn', 'te', 'hi'];
  await env.IDENTITY.prepare('UPDATE users SET ui_lang = ?, content_lang = ?, translate_on = ? WHERE id = ?')
    .bind(oneOf(b.ui_lang, ['en', 'ml'], user.ui_lang), oneOf(b.content_lang, langs, user.content_lang), b.translate_on == null ? user.translate_on : (b.translate_on ? 1 : 0), user.id).run();
  return json({ ok: true });
}

async function reference(env, req, user) {
  if (!user) throw new HttpError(401, 'Please sign in');
  const [lsgds, centres, kb, settings, glossary] = await Promise.all([
    env.CLINICAL.prepare('SELECT id, state, district, kind, name, name_ml FROM lsgds ORDER BY district, name').all(),
    env.CLINICAL.prepare('SELECT * FROM referral_centres WHERE active = 1 ORDER BY district, name').all(),
    env.CLINICAL.prepare('SELECT * FROM kb_items WHERE active = 1 ORDER BY kind, title').all(),
    env.CLINICAL.prepare("SELECT key, value FROM settings WHERE key <> 'research_salt'").all(),
    env.CLINICAL.prepare('SELECT * FROM glossary ORDER BY en').all(),
  ]);
  return json({
    lsgds: lsgds.results, referral_centres: centres.results, kb_items: kb.results, glossary: glossary.results,
    settings: Object.fromEntries(settings.results.map(r => [r.key, r.value])), media_backend: env.MEDIA_BUCKET ? 'r2' : 'd1',
  });
}

async function translateApi(env, req, user) {
  requireRole(user, 'worker', 'coordinator', 'dentist', 'auditor', 'admin');
  const b = await body(req);
  const langs = ['en', 'ml', 'ta', 'kn', 'te', 'hi', 'bn', 'gu', 'pa', 'or', 'mr', 'ur'];
  const src = oneOf(b.src, langs), tgt = oneOf(b.tgt, langs);
  const text = str(b.text, 3000);
  if (!src || !tgt || !text) throw new HttpError(400, 'text, src and tgt are required');
  const r = await translate(env, text, src, tgt);
  const terms = await glossaryHits(env, text);
  return json({ ...r, glossary: terms });
}

async function media(env, req, user, id) {
  requireRole(user, 'worker', 'coordinator', 'dentist', 'auditor', 'admin');
  const img = await env.CLINICAL.prepare('SELECT i.*, c.person_id, c.worker_id, c.claimed_by, c.claim_expires, c.status, c.district, c.sampled_for_audit FROM images i JOIN cases c ON c.id = i.case_id WHERE i.id = ?').bind(id).first();
  if (!img) throw new HttpError(404, 'Photo not found');
  let ok = user.role === 'admin' || (user.role === 'auditor');
  if (user.role === 'worker') {
    const p = await env.IDENTITY.prepare('SELECT worker_id FROM persons WHERE id = ?').bind(img.person_id).first();
    ok = img.worker_id === user.id || p?.worker_id === user.id;
  }
  if (user.role === 'coordinator') ok = img.district === user.district;
  if (user.role === 'dentist') {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    ok = (img.claimed_by === user.id && img.claim_expires > now) ||
      !!(await env.CLINICAL.prepare('SELECT 1 FROM opinions WHERE case_id = ? AND dentist_id = ?').bind(img.case_id, user.id).first()) ||
      !!(await env.CLINICAL.prepare('SELECT 1 FROM info_requests WHERE case_id = ? AND dentist_id = ?').bind(img.case_id, user.id).first());
  }
  if (!ok) throw new HttpError(403, 'Not allowed');
  const m = await getMedia(env, img.media_key);
  if (!m) throw new HttpError(404, 'Photo file missing');
  return new Response(m.body, { headers: { 'content-type': m.mime, 'cache-control': 'private, max-age=3600' } });
}

// Public verification page for the QR code on printed reports. Shows no patient information.
async function verifyPage(env, code) {
  code = String(code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
  const o = code ? await env.CLINICAL.prepare('SELECT o.case_id, o.version, o.signed_at, o.superseded_by, o.dentist_id, o.referral_needed, o.referral_type FROM opinions o WHERE o.verify_code = ?').bind(code).first() : null;
  let d = null;
  if (o) d = await env.IDENTITY.prepare('SELECT name, reg_council, reg_number FROM users WHERE id = ?').bind(o.dentist_id).first();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const status = !o ? ['Not found', 'No Vayosmitham report matches this code. The report may not be genuine.', '#b42318']
    : o.superseded_by ? ['Replaced', 'This report was replaced by a corrected version. Ask the health worker for the latest copy.', '#b54708']
      : ['Valid', 'This is a genuine Vayosmitham advisory screening opinion.', '#067647'];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify report — Vayosmitham</title><meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1d2939;background:#fff}
.badge{display:inline-block;padding:6px 14px;border-radius:999px;color:#fff;font-weight:600;background:${status[2]}}
dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px}dt{color:#667085}dd{margin:0;font-weight:500}</style></head><body>
<h1>Vayosmitham report check</h1><p><span class="badge">${status[0]}</span></p><p>${status[1]}</p>
${o ? `<dl><dt>Case number</dt><dd>${esc(o.case_id)} (version ${o.version})</dd><dt>Issued</dt><dd>${esc(o.signed_at)} UTC</dd>
<dt>Reviewing dentist</dt><dd>${esc(d?.name)}</dd><dt>Registration</dt><dd>${esc(d?.reg_council)} ${esc(d?.reg_number)}</dd>
<dt>Referral advised</dt><dd>${o.referral_needed ? 'Yes' : 'No'}</dd></dl>` : ''}
<p style="color:#667085;font-size:14px;margin-top:32px">Vayosmitham is a community geriatric oral health programme of Community Innovation Foundation with the Association of Geriatric Dentistry (AGeD). Opinions are advisory screening opinions, not a diagnosis or prescription.</p>
</body></html>`;
  return withHeaders(new Response(html, { status: o ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }));
}

export { parseJSON };
