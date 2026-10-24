// Questionnaire versions: AGeD clinical admin publishes; CIF super admin can roll back.
import { HttpError, json, body, str, int, audit } from './util.js';
import { requireRole } from './auth.js';
import { applyQuestionnaire, validateQuestionnaire, currentContent, questionnaireVersion, BASE } from '../public/shared/questionnaire.js';

let cache = { at: 0, q: null };

// Load the latest published version (cached briefly per worker instance) and apply it to the shared lists.
export async function syncQuestionnaire(env, force = false) {
  if (!force && Date.now() - cache.at < 15000) return cache.q;
  let q = null;
  try {
    const row = await env.CLINICAL.prepare('SELECT version, content, created_at FROM questionnaires ORDER BY version DESC LIMIT 1').first();
    if (row) q = { version: row.version, content: JSON.parse(row.content), published_at: row.created_at };
  } catch { /* table not created yet: built-in version */ }
  applyQuestionnaire(q);
  cache = { at: Date.now(), q };
  return q;
}

export async function getQuestionnaire(env, req, user) {
  requireRole(user, 'clinical_admin', 'admin', 'auditor');
  await syncQuestionnaire(env, true);
  const { results } = await env.CLINICAL.prepare(
    'SELECT version, note, restored_from, created_by_name, created_by_role, created_at FROM questionnaires ORDER BY version DESC LIMIT 100').all().catch(() => ({ results: [] }));
  return json({ version: questionnaireVersion(), content: currentContent(), history: results,
    can_edit: ['clinical_admin', 'superadmin'].includes(user.role), can_restore: user.role === 'superadmin' });
}

async function insertVersion(env, user, content, note, restoredFrom = null) {
  const last = await env.CLINICAL.prepare('SELECT MAX(version) AS v FROM questionnaires').first();
  const version = Math.max(1, last?.v || 1) + 1;
  await env.CLINICAL.prepare(
    'INSERT INTO questionnaires (version, content, note, restored_from, created_by, created_by_name, created_by_role) VALUES (?,?,?,?,?,?,?)')
    .bind(version, JSON.stringify(content), note, restoredFrom, user.id, user.name, user.role).run();
  await syncQuestionnaire(env, true);
  return version;
}

export async function publishQuestionnaire(env, req, user) {
  requireRole(user, 'clinical_admin'); // the super admin is covered too
  const b = await body(req);
  const note = str(b.note, 500);
  if (!note) throw new HttpError(400, 'Write a short note on what changed and why');
  await syncQuestionnaire(env, true);
  if (int(b.based_on, 1, 1e6) !== questionnaireVersion()) throw new HttpError(409, `Someone published version ${questionnaireVersion()} while you were editing. Reload and make your changes again.`);
  let content;
  try { content = validateQuestionnaire(b.content, currentContent()); } catch (e) { throw new HttpError(400, e.message); }
  const version = await insertVersion(env, user, content, note);
  await audit(env, user, 'questionnaire.publish', 'questionnaire', String(version), { note });
  return json({ version });
}

export async function restoreQuestionnaire(env, req, user) {
  requireRole(user, 'superadmin');
  const b = await body(req);
  const from = int(b.version, 1, 1e6);
  if (!from) throw new HttpError(400, 'Choose a version');
  let content;
  if (from === 1) content = BASE;
  else {
    const row = await env.CLINICAL.prepare('SELECT content FROM questionnaires WHERE version = ?').bind(from).first();
    if (!row) throw new HttpError(404, 'Version not found');
    content = JSON.parse(row.content);
  }
  await syncQuestionnaire(env, true);
  // Items added after that version are kept but retired, so visits that used them stay readable.
  const cur = currentContent();
  const merged = structuredClone(content);
  for (const [k, id] of [['complaints', 'key'], ['red_flags', 'key'], ['medicine_flags', 'flag'], ['questions', 'key'], ['photo_views', 'key'], ['referral_types', 'key']]) {
    for (const it of cur[k]) if (!merged[k].some(x => x[id] === it[id])) merged[k].push({ ...it, active: false });
  }
  for (const q of merged.questions) {
    const now = cur.questions.find(x => x.key === q.key);
    if (now?.type === 'choice') for (const o of now.options || []) if (!(q.options || []).some(x => x.key === o.key)) (q.options ||= []).push({ ...o, active: false });
  }
  let clean;
  try { clean = validateQuestionnaire(merged, cur); } catch (e) { throw new HttpError(400, e.message); }
  const note = str(b.note, 500) || `Restored version ${from}`;
  const version = await insertVersion(env, user, clean, note, from);
  await audit(env, user, 'questionnaire.restore', 'questionnaire', String(version), { from });
  return json({ version });
}
