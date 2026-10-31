// Institution coordinator (dental college / hospital / clinic): sees the anonymised open queue, assigns cases to the
// institution's own dentists, and sees what the institution has contributed. Clinical store only — no patient identity.
import { HttpError, json, str, parseJSON, audit, getSettings, selectIn } from './util.js';
import { requireRole } from './auth.js';

async function myInstitution(env, user) {
  if (!user.institution_id) throw new HttpError(403, 'Your account is not linked to an institution. Ask the AGeD admin.');
  const i = await env.CLINICAL.prepare('SELECT * FROM institutions WHERE id = ?').bind(user.institution_id).first();
  if (!i || !i.active) throw new HttpError(403, 'Your institution is not active in the programme');
  return i;
}
async function myDentists(env, inst) {
  const { results } = await env.IDENTITY.prepare(
    "SELECT id, name, reg_number FROM users WHERE role = 'dentist' AND active = 1 AND institution_id = ? ORDER BY name").bind(inst.id).all();
  return results;
}

export async function queue(env, req, user) {
  requireRole(user, 'institution_admin');
  const inst = await myInstitution(env, user);
  const url = new URL(req.url);
  const state = str(url.searchParams.get('state'), 60), district = str(url.searchParams.get('district'), 60);
  const filt = (state ? ' AND c.state = ?' : '') + (district ? ' AND c.district = ?' : '');
  const fargs = [state, district].filter(Boolean);
  const [open, mine, dentists] = await Promise.all([
    env.CLINICAL.prepare(
      `SELECT c.id, c.visit_type, c.urgency, c.red_flags, c.age_band, c.sex, c.state, c.district, c.bedbound, c.submitted_at, s.complaints, s.ohat_total,
         (SELECT COUNT(*) FROM images i WHERE i.case_id = c.id AND i.view <> 'voice_note') AS photo_count
       FROM cases c LEFT JOIN screenings s ON s.case_id = c.id
       WHERE c.status = 'submitted' AND (c.claimed_by IS NULL OR c.claim_expires < datetime('now'))${filt}
       ORDER BY CASE c.urgency WHEN 'urgent' THEN 0 ELSE 1 END, c.submitted_at LIMIT 150`).bind(...fargs).all(),
    env.CLINICAL.prepare(
      `SELECT c.id, c.urgency, c.age_band, c.sex, c.state, c.district, c.status, c.assigned_to, c.assigned_at, c.claim_expires, c.opinion_at,
         o.dentist_id AS signed_by, o.referral_needed
       FROM cases c LEFT JOIN opinions o ON o.case_id = c.id AND o.superseded_by IS NULL
       WHERE c.institution_id = ? ORDER BY COALESCE(c.opinion_at, c.assigned_at) DESC LIMIT 200`).bind(inst.id).all(),
    myDentists(env, inst),
  ]);
  const names = Object.fromEntries(dentists.map(d => [d.id, d.name]));
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return json({
    institution: { id: inst.id, name: inst.name, kind: inst.kind, state: inst.state, district: inst.district },
    dentists,
    open: open.results.map(r => ({ ...r, red_flags: parseJSON(r.red_flags, []), complaints: parseJSON(r.complaints, []) })),
    assigned: mine.results.map(r => ({ ...r, dentist: names[r.signed_by || r.assigned_to] || null,
      state_label: r.status === 'opinion' ? 'done' : r.status === 'info_requested' ? 'question' : r.claim_expires && r.claim_expires > now ? 'assigned' : 'expired' })),
  });
}

export async function assign(env, req, user, cid) {
  requireRole(user, 'institution_admin');
  const inst = await myInstitution(env, user);
  const b = await req.json().catch(() => ({}));
  const d = await env.IDENTITY.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'dentist' AND active = 1 AND institution_id = ?").bind(str(b.dentist_id, 80), inst.id).first();
  if (!d) throw new HttpError(400, 'Choose one of your institution’s dentists');
  const hours = Number((await getSettings(env)).assign_hours || 48);
  const r = await env.CLINICAL.prepare(
    `UPDATE cases SET claimed_by = ?, claim_expires = datetime('now', '+' || ? || ' hours'), assigned_to = ?, assigned_by = ?, assigned_at = datetime('now'), institution_id = ?
     WHERE id = ? AND status = 'submitted' AND (claimed_by IS NULL OR claim_expires < datetime('now') OR institution_id = ?)`)
    .bind(d.id, hours, d.id, user.id, inst.id, cid, inst.id).run();
  if (!r.meta.changes) throw new HttpError(409, 'Another dentist or institution has already taken this case');
  await audit(env, user, 'case.assign', 'case', cid, { dentist: d.id, institution: inst.id });
  return json({ ok: true, hours, dentist: d.name });
}

export async function unassign(env, req, user, cid) {
  requireRole(user, 'institution_admin');
  const inst = await myInstitution(env, user);
  const r = await env.CLINICAL.prepare(
    `UPDATE cases SET claimed_by = NULL, claim_expires = NULL, assigned_to = NULL, assigned_by = NULL, assigned_at = NULL, institution_id = NULL
     WHERE id = ? AND institution_id = ? AND status = 'submitted'`).bind(cid, inst.id).run();
  if (!r.meta.changes) throw new HttpError(409, 'This case can no longer be returned (an opinion may already be signed)');
  await audit(env, user, 'case.unassign', 'case', cid, { institution: inst.id });
  return json({ ok: true });
}

// What the institution has contributed: opinions by its dentists, turnaround, referrals.
export async function report(env, req, user) {
  requireRole(user, 'institution_admin');
  const inst = await myInstitution(env, user);
  const [totals, byDentist, byMonth] = await Promise.all([
    env.CLINICAL.prepare(
      `SELECT COUNT(*) AS opinions, COUNT(DISTINCT o.dentist_id) AS dentists, SUM(o.referral_needed) AS referrals, SUM(c.urgency = 'urgent') AS urgent,
         AVG((julianday(o.signed_at) - julianday(c.submitted_at)) * 24) AS avg_hours
       FROM opinions o JOIN cases c ON c.id = o.case_id WHERE o.institution_id = ? AND o.superseded_by IS NULL`).bind(inst.id).first(),
    env.CLINICAL.prepare(
      `SELECT o.dentist_id, COUNT(*) AS opinions, SUM(o.referral_needed) AS referrals, AVG((julianday(o.signed_at) - julianday(c.submitted_at)) * 24) AS avg_hours,
         AVG(a.rating) AS audit_rating
       FROM opinions o JOIN cases c ON c.id = o.case_id LEFT JOIN audits a ON a.opinion_id = o.id
       WHERE o.institution_id = ? AND o.superseded_by IS NULL GROUP BY o.dentist_id ORDER BY opinions DESC`).bind(inst.id).all(),
    env.CLINICAL.prepare(
      `SELECT strftime('%Y-%m', o.signed_at) AS month, COUNT(*) AS opinions FROM opinions o WHERE o.institution_id = ? AND o.superseded_by IS NULL GROUP BY month ORDER BY month`).bind(inst.id).all(),
  ]);
  const ids = byDentist.results.map(r => r.dentist_id);
  const names = Object.fromEntries((await selectIn(env.IDENTITY, 'SELECT id, name, reg_number FROM users WHERE id IN (?)', ids)).map(u => [u.id, u]));
  return json({
    institution: { id: inst.id, name: inst.name, kind: inst.kind, state: inst.state, district: inst.district },
    totals, by_month: byMonth.results,
    by_dentist: byDentist.results.map(r => ({ ...r, name: names[r.dentist_id]?.name || '—', reg_number: names[r.dentist_id]?.reg_number || '' })),
  });
}
