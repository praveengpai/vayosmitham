// Dentist API. Works ONLY on the clinical store: no query in this file touches persons or consents,
// so a dentist can never receive a patient's name, phone or address.
import { HttpError, json, body, uid, str, int, oneOf, parseJSON, audit, addMinutes, addMonths, randomCode, getSettings } from './util.js';
import { requireRole } from './auth.js';
import { expandScreening } from './field.js';
import { REFERRAL_TYPES, detectLang } from '../public/shared/clinical.js';

const CASE_FIELDS = 'c.id, c.person_id, c.visit_type, c.status, c.urgency, c.red_flags, c.age_band, c.sex, c.state, c.district, c.lsgd_type, c.bedbound, c.claimed_by, c.claim_expires, c.submitted_at, c.assigned_to, c.institution_id, c.worker_lang';

export async function queue(env, req, user) {
  requireRole(user, 'dentist');
  const { results } = await env.CLINICAL.prepare(
    `SELECT ${CASE_FIELDS}, s.complaints, s.ohat_total, i.name AS institution_name,
       (SELECT COUNT(*) FROM images i WHERE i.case_id = c.id AND i.view <> 'voice_note') AS photo_count,
       (SELECT COUNT(*) FROM cases p WHERE p.person_id = c.person_id AND p.id <> c.id) AS previous_visits
     FROM cases c LEFT JOIN screenings s ON s.case_id = c.id LEFT JOIN institutions i ON i.id = c.institution_id
     WHERE c.status = 'submitted' AND (c.claimed_by IS NULL OR c.claim_expires < datetime('now') OR c.claimed_by = ?)
     ORDER BY CASE WHEN c.claimed_by = ? AND c.assigned_to = c.claimed_by THEN 0 WHEN c.claimed_by = ? THEN 1 ELSE 2 END, CASE c.urgency WHEN 'urgent' THEN 0 ELSE 1 END, c.submitted_at
     LIMIT 100`).bind(user.id, user.id, user.id).all();
  const mine = await env.CLINICAL.prepare('SELECT COUNT(*) AS n FROM opinions WHERE dentist_id = ?').bind(user.id).first();
  return json({
    cases: results.map(r => ({ ...strip(r), mine: r.claimed_by === user.id && r.claim_expires > sqlNow(),
      assigned: r.assigned_to === user.id && r.claimed_by === user.id && r.claim_expires > sqlNow(), red_flags: parseJSON(r.red_flags, []), complaints: parseJSON(r.complaints, []) })),
    my_opinion_count: mine.n,
  });
}

function sqlNow() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
// person_id is pseudonymous, but the dentist UI does not need it; keep it out of list views.
function strip(r) { const { person_id, claimed_by, assigned_to, ...rest } = r; void person_id; void claimed_by; void assigned_to; return rest; }

export async function claim(env, req, user, cid) {
  requireRole(user, 'dentist');
  const s = await getSettings(env);
  const r = await env.CLINICAL.prepare(
    `UPDATE cases SET claimed_by = ?, claim_expires = MAX(?, CASE WHEN claimed_by = ? THEN COALESCE(claim_expires, '') ELSE '' END)
       WHERE id = ? AND status = 'submitted' AND (claimed_by IS NULL OR claim_expires < datetime('now') OR claimed_by = ?)`)
    .bind(user.id, addMinutes(Number(s.claim_minutes || 30)), user.id, cid, user.id).run();
  if (!r.meta.changes) throw new HttpError(409, 'Another dentist has already taken this case. It has been removed from your list.');
  await audit(env, user, 'case.claim', 'case', cid);
  return json({ ok: true, minutes: Number(s.claim_minutes || 30) });
}

export async function release(env, req, user, cid) {
  requireRole(user, 'dentist');
  // Putting back an institution-assigned case also ends the assignment, so the institution can reassign it.
  await env.CLINICAL.prepare(`UPDATE cases SET claimed_by = NULL, claim_expires = NULL,
      assigned_to = CASE WHEN assigned_to = ? THEN NULL ELSE assigned_to END, institution_id = CASE WHEN assigned_to = ? THEN NULL ELSE institution_id END
    WHERE id = ? AND claimed_by = ? AND status = 'submitted'`).bind(user.id, user.id, cid, user.id).run();
  await audit(env, user, 'case.release', 'case', cid);
  return json({ ok: true });
}

async function dentistCase(env, user, cid) {
  const c = await env.CLINICAL.prepare(`SELECT ${CASE_FIELDS} FROM cases c WHERE c.id = ?`).bind(cid).first();
  if (!c) throw new HttpError(404, 'Case not found');
  const holds = c.claimed_by === user.id && c.claim_expires > sqlNow() && c.status === 'submitted';
  const signed = await env.CLINICAL.prepare('SELECT 1 FROM opinions WHERE case_id = ? AND dentist_id = ?').bind(cid, user.id).first();
  const asked = await env.CLINICAL.prepare('SELECT 1 FROM info_requests WHERE case_id = ? AND dentist_id = ?').bind(cid, user.id).first();
  if (!holds && !signed && !asked) throw new HttpError(403, 'Open this case from your queue first');
  return { c, holds };
}

export async function getCase(env, req, user, cid) {
  requireRole(user, 'dentist');
  const { c, holds } = await dentistCase(env, user, cid);
  const [s, images, opinions, info, history] = await Promise.all([
    env.CLINICAL.prepare('SELECT * FROM screenings WHERE case_id = ?').bind(cid).first(),
    env.CLINICAL.prepare('SELECT id, view FROM images WHERE case_id = ? ORDER BY created_at').bind(cid).all(),
    env.CLINICAL.prepare('SELECT * FROM opinions WHERE case_id = ? ORDER BY version DESC').bind(cid).all(),
    env.CLINICAL.prepare('SELECT message, message_lang, response, response_lang, created_at, resolved_at FROM info_requests WHERE case_id = ? ORDER BY created_at').bind(cid).all(),
    // Earlier visits of the same (pseudonymous) person — the longitudinal view.
    env.CLINICAL.prepare(
      `SELECT p.id, p.submitted_at, p.visit_type, s.ohat_total, s.gohai_total, s.natural_teeth, o.impression, o.care_plan
       FROM cases p LEFT JOIN screenings s ON s.case_id = p.id
       LEFT JOIN opinions o ON o.case_id = p.id AND o.superseded_by IS NULL
       WHERE p.person_id = ? AND p.id <> ? ORDER BY p.submitted_at DESC LIMIT 10`).bind(c.person_id, cid).all(),
  ]);
  await audit(env, user, 'case.view', 'case', cid);
  return json({
    case: { ...strip(c), red_flags: parseJSON(c.red_flags, []), holds, claim_expires: holds ? c.claim_expires : null },
    screening: s ? expandScreening(s) : null,
    images: images.results,
    opinions: opinions.results.map(o => ({ ...o, mine: o.dentist_id === user.id, dentist_id: undefined, kb_items: parseJSON(o.kb_items, []) })),
    info_requests: info.results,
    history: history.results,
  });
}

export async function saveOpinion(env, req, user, cid) {
  requireRole(user, 'dentist');
  const { holds } = await dentistCase(env, user, cid);
  if (!holds) throw new HttpError(409, 'Your time on this case has run out. Open it again from the queue.');
  if (!user.reg_number) throw new HttpError(403, 'Your dental registration number is not on record. Ask the admin to add it.');
  const b = await body(req);
  const o = cleanOpinion(b, user.content_lang);
  const s = await getSettings(env);
  const sampled = Math.random() * 100 < Number(s.audit_sample_percent || 10) ? 1 : 0;
  const id = uid('OP-');
  const c = await env.CLINICAL.prepare('SELECT person_id, worker_id FROM cases WHERE id = ?').bind(cid).first();
  const inst = await dentistInstitution(env, user);
  const stmts = [
    env.CLINICAL.prepare(
      `INSERT INTO opinions (id, case_id, version, dentist_id, findings, impression, impression_codes, advice, care_plan, note, text_lang, followup_months,
        referral_needed, referral_type, referral_urgency, referral_message, cannot_assess, kb_items, verify_code, institution_id, institution_name)
       VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, cid, user.id, o.findings, o.impression, '[]', o.advice, o.care_plan, o.note, o.text_lang,
      o.followup_months, o.referral_needed, o.referral_type, o.referral_urgency, o.referral_message, o.cannot_assess, JSON.stringify(o.kb_items), randomCode(10),
      inst?.id || null, inst?.name || null),
    env.CLINICAL.prepare("UPDATE cases SET status = 'opinion', opinion_at = datetime('now'), claimed_by = NULL, claim_expires = NULL, sampled_for_audit = ? WHERE id = ?").bind(sampled, cid),
  ];
  if (o.referral_needed) {
    stmts.push(env.CLINICAL.prepare("INSERT OR IGNORE INTO referrals (id, case_id, status) VALUES (?, ?, 'pending')").bind(uid('RF-'), cid));
  }
  if (o.followup_months) {
    stmts.push(env.CLINICAL.prepare("UPDATE followups SET status='cancelled' WHERE person_id = ? AND status='due' AND reason='rescreen'").bind(c.person_id));
    stmts.push(env.CLINICAL.prepare('INSERT INTO followups (id, person_id, worker_id, due_date, reason, source_case_id) VALUES (?,?,?,?,?,?)')
      .bind(uid('FU-'), c.person_id, c.worker_id, addMonths(o.followup_months), 'rescreen', cid));
  }
  await env.CLINICAL.batch(stmts);
  await audit(env, user, 'opinion.sign', 'case', cid, { opinion: id, referral: o.referral_needed });
  return json({ id });
}

// The institution the dentist belongs to (kept on each opinion for reports). Institutions live in the clinical store.
async function dentistInstitution(env, user) {
  if (!user.institution_id) return null;
  return env.CLINICAL.prepare('SELECT id, name FROM institutions WHERE id = ?').bind(user.institution_id).first();
}

function cleanOpinion(b, hint) {
  const findings = str(b.findings, 3000), impression = str(b.impression, 1000), advice = str(b.advice, 3000), care_plan = str(b.care_plan, 3000);
  const cannot = b.cannot_assess ? 1 : 0;
  if (!cannot && !impression) throw new HttpError(400, 'Please write your impression');
  if (!cannot && !advice && !care_plan) throw new HttpError(400, 'Please write advice or a care plan');
  const referral = b.referral_needed || cannot ? 1 : 0;
  const type = referral ? oneOf(b.referral_type, REFERRAL_TYPES.map(r => r.key)) : null;
  if (referral && !type) throw new HttpError(400, 'Choose the referral type');
  const all = [findings, impression, advice, care_plan, str(b.note)].filter(Boolean).join(' ');
  return {
    findings, impression, advice, care_plan, note: str(b.note, 2000), text_lang: all ? detectLang(all, hint) : 'en',
    followup_months: int(b.followup_months, 1, 24),
    referral_needed: referral, referral_type: type,
    referral_urgency: referral ? oneOf(b.referral_urgency, ['within_24h', 'within_7d', 'within_30d', 'routine'], 'routine') : null,
    referral_message: referral ? str(b.referral_message, 2000) : null,
    cannot_assess: cannot,
    kb_items: (Array.isArray(b.kb_items) ? b.kb_items : []).map(x => str(x, 64)).filter(Boolean).slice(0, 10),
  };
}

export async function requestInfo(env, req, user, cid) {
  requireRole(user, 'dentist');
  const { holds } = await dentistCase(env, user, cid);
  if (!holds) throw new HttpError(409, 'Open this case from the queue first');
  const b = await body(req);
  const message = str(b.message, 2000);
  if (!message) throw new HttpError(400, 'Write what you need from the field worker');
  await env.CLINICAL.batch([
    env.CLINICAL.prepare('INSERT INTO info_requests (id, case_id, dentist_id, message, message_lang) VALUES (?,?,?,?,?)').bind(uid('IR-'), cid, user.id, message, detectLang(message, user.content_lang)),
    env.CLINICAL.prepare("UPDATE cases SET status = 'info_requested', claimed_by = NULL, claim_expires = NULL WHERE id = ?").bind(cid),
  ]);
  await audit(env, user, 'case.info_request', 'case', cid);
  return json({ ok: true });
}

export async function history(env, req, user) {
  requireRole(user, 'dentist');
  const { results } = await env.CLINICAL.prepare(
    `SELECT o.id, o.case_id, o.version, o.impression, o.referral_needed, o.signed_at, o.superseded_by, c.age_band, c.sex, c.district, c.urgency,
       a.rating AS audit_rating, a.notes AS audit_notes
     FROM opinions o JOIN cases c ON c.id = o.case_id LEFT JOIN audits a ON a.opinion_id = o.id
     WHERE o.dentist_id = ? ORDER BY o.signed_at DESC LIMIT 200`).bind(user.id).all();
  return json({ opinions: results });
}

// Corrections create a new version; the old one stays for the audit trail.
export async function correctOpinion(env, req, user, oid) {
  requireRole(user, 'dentist');
  const old = await env.CLINICAL.prepare('SELECT * FROM opinions WHERE id = ?').bind(oid).first();
  if (!old || old.dentist_id !== user.id) throw new HttpError(404, 'Opinion not found');
  if (old.superseded_by) throw new HttpError(409, 'This version has already been corrected');
  const b = await body(req);
  const reason = str(b.correction_reason, 500);
  if (!reason) throw new HttpError(400, 'Give the reason for the correction');
  const o = cleanOpinion(b, user.content_lang);
  const id = uid('OP-');
  await env.CLINICAL.batch([
    env.CLINICAL.prepare(
      `INSERT INTO opinions (id, case_id, version, dentist_id, findings, impression, impression_codes, advice, care_plan, note, text_lang, followup_months,
        referral_needed, referral_type, referral_urgency, referral_message, cannot_assess, kb_items, verify_code, correction_reason, institution_id, institution_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, old.case_id, old.version + 1, user.id, o.findings, o.impression, '[]', o.advice, o.care_plan, o.note,
      o.text_lang, o.followup_months, o.referral_needed, o.referral_type, o.referral_urgency, o.referral_message, o.cannot_assess, JSON.stringify(o.kb_items), randomCode(10), reason,
      old.institution_id, old.institution_name),
    env.CLINICAL.prepare('UPDATE opinions SET superseded_by = ? WHERE id = ?').bind(id, oid),
    ...(o.referral_needed ? [env.CLINICAL.prepare("INSERT OR IGNORE INTO referrals (id, case_id, status) VALUES (?, ?, 'pending')").bind(uid('RF-'), old.case_id)] : []),
  ]);
  await audit(env, user, 'opinion.correct', 'case', old.case_id, { from: oid, to: id, reason });
  return json({ id });
}
