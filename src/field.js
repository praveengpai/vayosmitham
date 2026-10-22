// Field-worker API: enrolment, consent, screening, photos, viewing opinions, referral outcomes.
import { HttpError, json, body, personId, caseId, uid, str, int, oneOf, parseJSON, audit, addMonths, nowIso } from './util.js';
import { requireRole } from './auth.js';
import { putMedia, cleanJpeg } from './media.js';
import { KNOWN_VERSIONS } from '../public/shared/consent.js';
import { triage, flagMedicines, ohatTotal, gohaiTotal, ageBand, OHAT_ITEMS, COMPLAINTS, PHOTO_VIEWS, LOCATION_OVERRIDE_REASONS, LSGD_TYPES, detectLang } from '../public/shared/clinical.js';

const FIELD_ROLES = ['worker', 'coordinator', 'admin'];

// Can this user see this person?
async function personAccess(env, user, pid) {
  const p = await env.IDENTITY.prepare('SELECT * FROM persons WHERE id = ?').bind(pid).first();
  if (!p) throw new HttpError(404, 'Person not found');
  if (user.role === 'admin') return p;
  if (user.role === 'worker' && p.worker_id === user.id) return p;
  if (user.role === 'coordinator' && p.district === user.district) return p;
  throw new HttpError(403, 'This person is not in your list');
}

async function caseAccess(env, user, cid) {
  const c = await env.CLINICAL.prepare('SELECT * FROM cases WHERE id = ?').bind(cid).first();
  if (!c) throw new HttpError(404, 'Case not found');
  const p = await personAccess(env, user, c.person_id);
  return { c, p };
}

export async function listPersons(env, req, user) {
  requireRole(user, ...FIELD_ROLES);
  const url = new URL(req.url);
  const q = str(url.searchParams.get('q'), 80);
  let sql = 'SELECT id, name, sex, birth_year, lsgd_name, ward, status, created_at FROM persons WHERE ';
  const args = [];
  if (user.role === 'worker') { sql += 'worker_id = ?'; args.push(user.id); }
  else if (user.role === 'coordinator') { sql += 'district = ?'; args.push(user.district); }
  else sql += '1=1';
  if (q) { sql += ' AND (name LIKE ? OR id LIKE ? OR phone LIKE ?)'; args.push(`%${q}%`, `%${q.toUpperCase()}%`, `%${q}%`); }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  const { results: persons } = await env.IDENTITY.prepare(sql).bind(...args).all();
  if (!persons.length) return json({ persons: [] });
  // latest case status for each person
  const ids = persons.map(p => p.id);
  const ph = ids.map(() => '?').join(',');
  const { results: cases } = await env.CLINICAL.prepare(
    `SELECT person_id, id, status, urgency, submitted_at FROM cases WHERE person_id IN (${ph}) ORDER BY submitted_at DESC`).bind(...ids).all();
  const latest = {};
  for (const c of cases) if (!latest[c.person_id]) latest[c.person_id] = c;
  return json({ persons: persons.map(p => ({ ...p, latest_case: latest[p.id] || null })) });
}

export async function checkDuplicate(env, req, user) {
  requireRole(user, ...FIELD_ROLES);
  const b = await body(req);
  const name = str(b.name, 120);
  if (!name) return json({ matches: [] });
  const { results } = await env.IDENTITY.prepare(
    `SELECT id, name, sex, birth_year, lsgd_name, ward FROM persons
     WHERE lower(name) = lower(?) AND (birth_year IS NULL OR ? IS NULL OR abs(birth_year - ?) <= 2) AND (? IS NULL OR lsgd_name = ?) LIMIT 5`)
    .bind(name, int(b.birth_year, 1900, 2100), int(b.birth_year, 1900, 2100), str(b.lsgd_name), str(b.lsgd_name)).all();
  return json({ matches: results });
}

function cleanPerson(p, user) {
  const name = str(p.name, 120);
  if (!name) throw new HttpError(400, 'Name is required');
  const sex = oneOf(p.sex, ['F', 'M', 'O']);
  if (!sex) throw new HttpError(400, 'Sex is required');
  const loc = {
    state: str(p.state, 60) || user.state,
    district: str(p.district, 60) || user.district,
    lsgd_type: oneOf(p.lsgd_type, LSGD_TYPES.map(t => t.key)) || user.lsgd_type,
    lsgd_name: str(p.lsgd_name, 120) || user.lsgd_name,
    ward: str(p.ward, 20) || user.ward,
  };
  if (!loc.state || !loc.district || !loc.lsgd_type || !loc.lsgd_name) throw new HttpError(400, 'State, district and LSGD are required');
  const changed = ['state', 'district', 'lsgd_type', 'lsgd_name', 'ward'].some(k => (loc[k] || '') !== (user[k] || ''));
  let reason = null;
  if (changed) {
    reason = oneOf(p.location_override_reason, LOCATION_OVERRIDE_REASONS.map(r => r.key));
    if (!reason) throw new HttpError(400, 'Please choose why the location differs from your own area');
  }
  return {
    name, sex, birth_year: int(p.birth_year, 1900, new Date().getFullYear()),
    phone: str(p.phone, 15), address: str(p.address, 300), ...loc, location_override_reason: reason,
    abha: str(p.abha, 20), caregiver_name: str(p.caregiver_name, 120), caregiver_phone: str(p.caregiver_phone, 15), caregiver_relation: str(p.caregiver_relation, 40),
  };
}

// One home visit, sent as a single bundle so it can be queued offline and replayed safely.
export async function submitVisit(env, req, user) {
  requireRole(user, 'worker', 'coordinator');
  const b = await body(req);
  const clientUuid = str(b.client_uuid, 64);
  if (!clientUuid) throw new HttpError(400, 'client_uuid is required');
  const existing = await env.CLINICAL.prepare('SELECT id, person_id FROM cases WHERE client_uuid = ?').bind(clientUuid).first();
  if (existing) return json({ case_id: existing.id, person_id: existing.person_id, duplicate: true });

  // --- person ---
  let person;
  const stmts = [];
  if (b.person_id) {
    person = await personAccess(env, user, b.person_id);
    if (person.status !== 'active') throw new HttpError(409, 'This person is no longer active in the programme');
  } else {
    const pUuid = str(b.person?.client_uuid, 64);
    if (pUuid) person = await env.IDENTITY.prepare('SELECT * FROM persons WHERE client_uuid = ?').bind(pUuid).first();
    if (!person) {
      const data = cleanPerson(b.person || {}, user);
      const id = personId();
      stmts.push(env.IDENTITY.prepare(
        `INSERT INTO persons (id, client_uuid, name, sex, birth_year, phone, address, state, district, lsgd_type, lsgd_name, ward, location_override_reason, abha, caregiver_name, caregiver_phone, caregiver_relation, worker_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, pUuid, data.name, data.sex, data.birth_year, data.phone, data.address, data.state, data.district,
        data.lsgd_type, data.lsgd_name, data.ward, data.location_override_reason, data.abha, data.caregiver_name, data.caregiver_phone, data.caregiver_relation, user.id));
      person = { id, ...data, worker_id: user.id, status: 'active' };
    }
  }

  // --- consent ---
  const consents = Array.isArray(b.consents) ? b.consents : [];
  const existingCare = await env.IDENTITY.prepare(
    "SELECT 1 FROM consents WHERE person_id = ? AND layer = 'care' AND granted = 1 AND withdrawn_at IS NULL").bind(person.id).first();
  const newCare = consents.find(c => c.layer === 'care' && c.granted);
  if (!existingCare && !newCare) throw new HttpError(400, 'Consent for care is required before screening');
  for (const c of consents) {
    const layer = oneOf(c.layer, ['care', 'photos', 'research', 'messaging', 'abha']);
    const method = oneOf(c.method, ['signature', 'thumb', 'verbal_witnessed', 'caregiver_assent']);
    const capacity = oneOf(c.capacity, ['has_capacity', 'doubtful', 'lacks']);
    if (!layer || !method || !capacity) throw new HttpError(400, 'Consent record is incomplete');
    if (capacity !== 'has_capacity' && method !== 'caregiver_assent') throw new HttpError(400, 'When capacity is doubtful, record caregiver assent');
    if (method === 'caregiver_assent' && !str(c.assent_by)) throw new HttpError(400, 'Name of the person deciding for them is required');
    const deciderType = method === 'caregiver_assent' ? oneOf(c.decider_type, ['lawful_guardian', 'nominee', 'family']) : null;
    if (method === 'caregiver_assent' && !deciderType && c.notice_version && c.notice_version !== '2026-10-draft') throw new HttpError(400, 'Choose who is deciding for the person');
    const noticeVersion = KNOWN_VERSIONS.includes(c.notice_version || '2026-10-draft') ? (c.notice_version || '2026-10-draft') : null;
    if (!noticeVersion) throw new HttpError(400, 'This consent was taken with an unknown notice version. Update the app and take consent again.');
    if (method === 'verbal_witnessed' && !str(c.witness_name)) throw new HttpError(400, 'Witness name is required for verbal consent');
    stmts.push(env.IDENTITY.prepare(
      `INSERT INTO consents (id, person_id, layer, granted, method, witness_name, capacity, assent_by, assent_relation, decider_type, copy_offered, notice_version, notice_language, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('CN-'), person.id, layer, c.granted ? 1 : 0, method, str(c.witness_name, 120), capacity,
      str(c.assent_by, 120), str(c.assent_relation, 40), deciderType, c.copy_offered ? 1 : 0, noticeVersion, oneOf(c.notice_language, ['en', 'ml', 'ta', 'kn', 'te', 'hi'], 'ml'), user.id));
  }
  if (stmts.length) await env.IDENTITY.batch(stmts);

  // --- screening ---
  const s = b.screening || {};
  const ohat = {};
  for (const it of OHAT_ITEMS) {
    const v = int(s.ohat?.[it.key], 0, 2);
    if (v === null) throw new HttpError(400, `OHAT item "${it.en}" is missing`);
    ohat[it.key] = v;
  }
  const gohai = Array.isArray(s.gohai) && s.gohai.length === 12 ? s.gohai.map(v => int(v, 1, 5)) : null;
  const gTotal = gohai && !gohai.includes(null) ? gohaiTotal(gohai) : null;
  const complaints = (Array.isArray(s.complaints) ? s.complaints : []).filter(k => COMPLAINTS.some(c => c.key === k));
  const medicines = (Array.isArray(s.medicines) ? s.medicines : []).map(m => str(m, 80)).filter(Boolean).slice(0, 30);
  const { urgency, red_flags } = triage(b.red_flags);
  const complaintText = str(s.complaint_text, 2000);
  const notes = str(s.worker_notes, 2000);
  const teeth = int(s.natural_teeth, 0, 32);
  const ctx = s.context || {};
  const cid = caseId();
  const visitType = oneOf(b.visit_type, ['baseline', 'followup', 'problem'], 'baseline');

  await env.CLINICAL.batch([
    env.CLINICAL.prepare(
      `INSERT INTO cases (id, client_uuid, person_id, worker_id, visit_type, status, urgency, red_flags, age_band, sex, district, lsgd_type, bedbound)
       VALUES (?,?,?,?,?,'submitted',?,?,?,?,?,?,?)`).bind(cid, clientUuid, person.id, user.id, visitType, urgency, JSON.stringify(red_flags),
      ageBand(person.birth_year), person.sex, person.district, person.lsgd_type, ctx.bedbound ? 1 : 0),
    env.CLINICAL.prepare(
      `INSERT INTO screenings (case_id, ohat, ohat_total, gohai, gohai_total, natural_teeth, functional_dentition, denture_upper, denture_lower, denture_fit,
        complaints, complaint_text, complaint_lang, risks, context, medicines, medicine_flags, worker_notes, worker_notes_lang)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(cid, JSON.stringify(ohat), ohatTotal(ohat), gohai ? JSON.stringify(gohai) : null, gTotal,
      teeth, teeth == null ? null : (teeth >= 20 ? 1 : 0), oneOf(s.denture_upper, ['none', 'complete', 'partial'], null), oneOf(s.denture_lower, ['none', 'complete', 'partial'], null),
      oneOf(s.denture_fit, ['good', 'loose', 'painful', 'broken', 'not_worn'], null), JSON.stringify(complaints), complaintText, complaintText ? detectLang(complaintText) : null,
      JSON.stringify(sanitizeRisks(s.risks)), JSON.stringify(sanitizeContext(ctx)), JSON.stringify(medicines), JSON.stringify(flagMedicines(medicines)),
      notes, notes ? detectLang(notes) : null),
    env.CLINICAL.prepare("UPDATE followups SET status='done', done_case_id=? WHERE person_id=? AND status='due' AND due_date <= date('now', '+30 day')").bind(cid, person.id),
  ]);
  await audit(env, user, 'case.submit', 'case', cid, { person: person.id, urgency });
  return json({ case_id: cid, person_id: person.id, urgency, red_flags });
}

function sanitizeRisks(r = {}) {
  return {
    tobacco_smoke: oneOf(r.tobacco_smoke, ['never', 'former', 'current'], null),
    tobacco_chew: oneOf(r.tobacco_chew, ['never', 'former', 'current'], null),
    areca: oneOf(r.areca, ['never', 'former', 'current'], null),
    alcohol: oneOf(r.alcohol, ['never', 'former', 'current'], null),
    sugar_per_day: int(r.sugar_per_day, 0, 20),
    brushing: oneOf(r.brushing, ['twice', 'once', 'irregular', 'never', 'assisted'], null),
    brush_aid: oneOf(r.brush_aid, ['toothbrush', 'finger', 'neem_stick', 'charcoal_powder', 'other', 'none'], null),
    fluoride_paste: r.fluoride_paste === true ? true : r.fluoride_paste === false ? false : null,
    last_dental_visit: oneOf(r.last_dental_visit, ['<1y', '1-3y', '>3y', 'never'], null),
  };
}
function sanitizeContext(c = {}) {
  const b = v => (v === true ? true : v === false ? false : null);
  return {
    bedbound: b(c.bedbound), dementia: b(c.dementia), swallowing_difficulty: b(c.swallowing_difficulty), diabetes: b(c.diabetes),
    stroke: b(c.stroke), cancer_treatment: b(c.cancer_treatment), lives_alone: b(c.lives_alone), needs_help_cleaning: b(c.needs_help_cleaning),
    weight_loss: b(c.weight_loss), palliative: b(c.palliative),
  };
}

export async function uploadImage(env, req, user, cid) {
  requireRole(user, 'worker', 'coordinator');
  const { c, p } = await caseAccess(env, user, cid);
  const photosOk = await env.IDENTITY.prepare(
    "SELECT 1 FROM consents WHERE person_id = ? AND layer = 'photos' AND granted = 1 AND withdrawn_at IS NULL").bind(p.id).first();
  if (!photosOk) throw new HttpError(403, 'No photo consent recorded for this person');
  const url = new URL(req.url);
  const view = oneOf(url.searchParams.get('view'), PHOTO_VIEWS.map(v => v.key));
  if (!view) throw new HttpError(400, 'Unknown photo view');
  const imgUuid = str(url.searchParams.get('client_uuid'), 64);
  const already = imgUuid ? await env.CLINICAL.prepare('SELECT id FROM images WHERE id = ?').bind('IM-' + imgUuid).first() : null;
  if (already) return json({ id: already.id, duplicate: true });
  const count = await env.CLINICAL.prepare('SELECT COUNT(*) AS n FROM images WHERE case_id = ?').bind(c.id).first();
  if (count.n >= 10) throw new HttpError(409, 'Maximum 10 photos per case');
  const bytes = cleanJpeg(await req.arrayBuffer());
  const id = imgUuid ? 'IM-' + imgUuid : uid('IM-');
  const key = `cases/${c.id}/${id}.jpg`;
  await putMedia(env, key, bytes, 'image/jpeg');
  await env.CLINICAL.prepare('INSERT INTO images (id, case_id, view, media_key, width, height, bytes, quality) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, c.id, view, key, int(url.searchParams.get('w'), 1, 10000), int(url.searchParams.get('h'), 1, 10000), bytes.length,
      Number(url.searchParams.get('q')) || null).run();
  return json({ id });
}

export async function getPerson(env, req, user, pid) {
  requireRole(user, ...FIELD_ROLES);
  const p = await personAccess(env, user, pid);
  const { results: consents } = await env.IDENTITY.prepare('SELECT * FROM consents WHERE person_id = ? ORDER BY recorded_at DESC').bind(pid).all();
  const { results: cases } = await env.CLINICAL.prepare(
    `SELECT c.id, c.visit_type, c.status, c.urgency, c.red_flags, c.submitted_at, c.opinion_at, s.ohat_total, s.gohai_total, s.natural_teeth
     FROM cases c LEFT JOIN screenings s ON s.case_id = c.id WHERE c.person_id = ? ORDER BY c.submitted_at DESC`).bind(pid).all();
  const { results: followups } = await env.CLINICAL.prepare("SELECT * FROM followups WHERE person_id = ? AND status = 'due' ORDER BY due_date").bind(pid).all();
  await audit(env, user, 'person.view', 'person', pid);
  return json({ person: p, consents, cases: cases.map(c => ({ ...c, red_flags: parseJSON(c.red_flags, []) })), followups });
}

export async function updatePerson(env, req, user, pid) {
  requireRole(user, 'worker', 'coordinator', 'admin');
  const p = await personAccess(env, user, pid);
  const b = await body(req);
  const status = oneOf(b.status, ['active', 'died', 'migrated', 'withdrawn', 'lost'], p.status);
  await env.IDENTITY.prepare(
    `UPDATE persons SET phone = ?, address = ?, caregiver_name = ?, caregiver_phone = ?, caregiver_relation = ?, status = ?, status_reason = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(str(b.phone, 15) ?? p.phone, str(b.address, 300) ?? p.address, str(b.caregiver_name, 120) ?? p.caregiver_name, str(b.caregiver_phone, 15) ?? p.caregiver_phone,
      str(b.caregiver_relation, 40) ?? p.caregiver_relation, status, str(b.status_reason, 200) ?? p.status_reason, pid).run();
  if (status !== 'active') await env.CLINICAL.prepare("UPDATE followups SET status='cancelled' WHERE person_id = ? AND status='due'").bind(pid).run();
  await audit(env, user, 'person.update', 'person', pid, { status });
  return json({ ok: true });
}

export async function withdrawConsent(env, req, user, pid) {
  requireRole(user, 'worker', 'coordinator', 'admin', 'dpo');
  if (user.role !== 'dpo') await personAccess(env, user, pid);
  const b = await body(req);
  const layer = oneOf(b.layer, ['care', 'photos', 'research', 'messaging', 'abha']);
  if (!layer) throw new HttpError(400, 'Which consent?');
  await env.IDENTITY.prepare(
    "UPDATE consents SET withdrawn_at = datetime('now'), withdrawn_reason = ? WHERE person_id = ? AND layer = ? AND withdrawn_at IS NULL")
    .bind(str(b.reason, 200), pid, layer).run();
  if (layer === 'care') {
    await env.IDENTITY.prepare("UPDATE persons SET status='withdrawn', status_reason='consent withdrawn', updated_at=datetime('now') WHERE id = ?").bind(pid).run();
    await env.CLINICAL.batch([
      env.CLINICAL.prepare("UPDATE cases SET status='withdrawn' WHERE person_id = ? AND status IN ('submitted','info_requested')").bind(pid),
      env.CLINICAL.prepare("UPDATE followups SET status='cancelled' WHERE person_id = ? AND status='due'").bind(pid),
    ]);
  }
  await audit(env, user, 'consent.withdraw', 'person', pid, { layer });
  return json({ ok: true });
}

export async function workerHome(env, req, user) {
  requireRole(user, 'worker', 'coordinator');
  const scope = user.role === 'worker' ? ['c.worker_id = ?', user.id] : ['c.district = ?', user.district];
  const [ready, waiting, info, due, referrals] = await Promise.all([
    env.CLINICAL.prepare(`SELECT c.id, c.person_id, c.urgency, c.opinion_at, o.referral_needed FROM cases c JOIN opinions o ON o.case_id = c.id AND o.superseded_by IS NULL
      WHERE ${scope[0]} AND c.status = 'opinion' ORDER BY c.opinion_at DESC LIMIT 50`).bind(scope[1]).all(),
    env.CLINICAL.prepare(`SELECT c.id, c.person_id, c.urgency, c.submitted_at FROM cases c WHERE ${scope[0]} AND c.status = 'submitted' ORDER BY c.submitted_at DESC LIMIT 50`).bind(scope[1]).all(),
    env.CLINICAL.prepare(`SELECT c.id, c.person_id, r.message, r.message_lang, r.created_at FROM cases c JOIN info_requests r ON r.case_id = c.id AND r.resolved_at IS NULL
      WHERE ${scope[0]} AND c.status = 'info_requested'`).bind(scope[1]).all(),
    env.CLINICAL.prepare(`SELECT f.* FROM followups f WHERE ${user.role === 'worker' ? 'f.worker_id = ?' : 'f.worker_id IN (SELECT DISTINCT worker_id FROM cases WHERE district = ?)'}
      AND f.status = 'due' AND f.due_date <= date('now', '+30 day') ORDER BY f.due_date LIMIT 100`).bind(scope[1]).all(),
    env.CLINICAL.prepare(`SELECT c.id, c.person_id, r.status FROM cases c JOIN referrals r ON r.case_id = c.id WHERE ${scope[0]} AND r.status = 'pending' LIMIT 100`).bind(scope[1]).all(),
  ]);
  // attach names (identity vault) for the worker's own screen
  const ids = [...new Set([...ready.results, ...waiting.results, ...info.results, ...due.results, ...referrals.results].map(r => r.person_id))];
  const names = {};
  if (ids.length) {
    const { results } = await env.IDENTITY.prepare(`SELECT id, name, lsgd_name, ward FROM persons WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const r of results) names[r.id] = r;
  }
  const withName = rows => rows.map(r => ({ ...r, person: names[r.person_id] || null }));
  return json({
    opinions_ready: withName(ready.results), awaiting_dentist: withName(waiting.results), info_requests: withName(info.results),
    followups_due: withName(due.results), referrals_pending: withName(referrals.results),
  });
}

// Worker's view of a case. The dentist's identity is deliberately not included.
export async function getCaseForWorker(env, req, user, cid) {
  requireRole(user, ...FIELD_ROLES);
  const { c, p } = await caseAccess(env, user, cid);
  const [s, images, opinion, info, referral] = await Promise.all([
    env.CLINICAL.prepare('SELECT * FROM screenings WHERE case_id = ?').bind(cid).first(),
    env.CLINICAL.prepare('SELECT id, view FROM images WHERE case_id = ?').bind(cid).all(),
    env.CLINICAL.prepare('SELECT * FROM opinions WHERE case_id = ? AND superseded_by IS NULL ORDER BY version DESC LIMIT 1').bind(cid).first(),
    env.CLINICAL.prepare('SELECT id, message, message_lang, response, created_at, resolved_at FROM info_requests WHERE case_id = ? ORDER BY created_at').bind(cid).all(),
    env.CLINICAL.prepare('SELECT * FROM referrals WHERE case_id = ?').bind(cid).first(),
  ]);
  let kb = [];
  if (opinion) {
    const ids = parseJSON(opinion.kb_items, []);
    if (ids.length) kb = (await env.CLINICAL.prepare(`SELECT * FROM kb_items WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results;
  }
  await audit(env, user, 'case.view', 'case', cid);
  return json({
    case: { ...c, red_flags: parseJSON(c.red_flags, []) },
    person: { id: p.id, name: p.name, sex: p.sex, birth_year: p.birth_year, lsgd_name: p.lsgd_name, ward: p.ward },
    screening: s ? expandScreening(s) : null,
    images: images.results,
    opinion: opinion ? publicOpinion(opinion) : null,
    kb, info_requests: info.results, referral,
  });
}

export function expandScreening(s) {
  return { ...s, ohat: parseJSON(s.ohat, {}), gohai: parseJSON(s.gohai, null), complaints: parseJSON(s.complaints, []), risks: parseJSON(s.risks, {}),
    context: parseJSON(s.context, {}), medicines: parseJSON(s.medicines, []), medicine_flags: parseJSON(s.medicine_flags, []) };
}

function publicOpinion(o) {
  const { dentist_id, ...rest } = o;
  void dentist_id;
  return { ...rest, impression_codes: parseJSON(o.impression_codes, []), kb_items: parseJSON(o.kb_items, []) };
}

export async function respondInfo(env, req, user, cid) {
  requireRole(user, 'worker', 'coordinator');
  const { c } = await caseAccess(env, user, cid);
  if (c.status !== 'info_requested') throw new HttpError(409, 'No open question on this case');
  const b = await body(req);
  const response = str(b.response, 2000);
  if (!response) throw new HttpError(400, 'Please write a reply');
  await env.CLINICAL.batch([
    env.CLINICAL.prepare("UPDATE info_requests SET response = ?, response_lang = ?, resolved_at = datetime('now') WHERE case_id = ? AND resolved_at IS NULL")
      .bind(response, detectLang(response), cid),
    env.CLINICAL.prepare("UPDATE cases SET status = 'submitted', claimed_by = NULL, claim_expires = NULL WHERE id = ?").bind(cid),
  ]);
  await audit(env, user, 'case.info_response', 'case', cid);
  return json({ ok: true });
}

// Data for the printable referral report. Includes the reviewing dentist's name and registration number (legal requirement).
export async function reportData(env, req, user, cid) {
  requireRole(user, ...FIELD_ROLES);
  const { c, p } = await caseAccess(env, user, cid);
  const o = await env.CLINICAL.prepare('SELECT * FROM opinions WHERE case_id = ? AND superseded_by IS NULL ORDER BY version DESC LIMIT 1').bind(cid).first();
  if (!o) throw new HttpError(404, 'No opinion yet');
  const d = await env.IDENTITY.prepare('SELECT name, reg_council, reg_number FROM users WHERE id = ?').bind(o.dentist_id).first();
  const s = await env.CLINICAL.prepare('SELECT * FROM screenings WHERE case_id = ?').bind(cid).first();
  let kb = [];
  const ids = parseJSON(o.kb_items, []);
  if (ids.length) kb = (await env.CLINICAL.prepare(`SELECT id, title, title_ml, url FROM kb_items WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results;
  await audit(env, user, 'report.generate', 'case', cid);
  return json({
    case: { id: c.id, submitted_at: c.submitted_at, urgency: c.urgency, red_flags: parseJSON(c.red_flags, []) },
    person: { id: p.id, name: p.name, sex: p.sex, birth_year: p.birth_year, address: p.address, lsgd_name: p.lsgd_name, ward: p.ward, district: p.district, state: p.state },
    screening: s ? expandScreening(s) : null,
    opinion: publicOpinion(o),
    dentist: d ? { name: d.name, reg_council: d.reg_council, reg_number: d.reg_number } : null,
    kb, generated_at: nowIso(),
  });
}

export async function referralOutcome(env, req, user, cid) {
  requireRole(user, 'worker', 'coordinator');
  await caseAccess(env, user, cid);
  const b = await body(req);
  const status = oneOf(b.status, ['pending', 'reached', 'not_reached']);
  if (!status) throw new HttpError(400, 'Choose an outcome');
  await env.CLINICAL.prepare(
    `INSERT INTO referrals (id, case_id, centre_id, status, reached_date, treatment, barrier, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(case_id) DO UPDATE SET centre_id=excluded.centre_id, status=excluded.status, reached_date=excluded.reached_date, treatment=excluded.treatment,
       barrier=excluded.barrier, recorded_by=excluded.recorded_by, recorded_at=excluded.recorded_at`)
    .bind(uid('RF-'), cid, str(b.centre_id, 64), status, str(b.reached_date, 10), str(b.treatment, 500), str(b.barrier, 300), user.id).run();
  await audit(env, user, 'referral.outcome', 'case', cid, { status });
  return json({ ok: true });
}

export { addMonths };
