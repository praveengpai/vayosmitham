// Admin, coordinator, auditor, DPO and researcher endpoints.
import { HttpError, json, body, uid, str, int, oneOf, parseJSON, audit, getSettings, sha256, randomCode } from './util.js';
import { requireRole, hashPin, normPhone, validPin } from './auth.js';
import { LSGD_TYPES, LANG_CODES, validPincode, QUESTIONS, QUESTION_STEPS } from '../public/shared/clinical.js';
import { expandScreening } from './field.js';

const ROLES = ['superadmin', 'admin', 'clinical_admin', 'coordinator', 'worker', 'dentist', 'auditor', 'dpo', 'researcher'];
// Which accounts each role may create, edit and reset. CIF super admin: everyone. CIF admin: field programme staff.
// AGeD clinical admin: volunteer dentists and clinical auditors. Coordinator: field workers in her district.
export const MANAGES = {
  superadmin: ROLES,
  admin: ['coordinator', 'worker', 'dpo', 'researcher'],
  clinical_admin: ['dentist', 'auditor'],
  coordinator: ['worker'],
};
const canManage = (user, role) => (MANAGES[user.role] || []).includes(role);
const AGED = 'Association of Geriatric Dentistry (AGeD)';

// ---------- users ----------
export async function listUsers(env, req, user) {
  requireRole(user, 'admin', 'coordinator', 'clinical_admin');
  let sql = `SELECT id, role, name, phone, email, active, organisation, state, district, lsgd_type, lsgd_name, ward, pincode, reg_council, reg_number, reg_verified_at,
    trained_at, must_change, created_at FROM users`;
  const args = [];
  const roles = MANAGES[user.role];
  sql += ` WHERE role IN (${roles.map(() => '?').join(',')})`; args.push(...roles);
  if (user.role === 'coordinator') { sql += ' AND district = ?'; args.push(user.district); }
  sql += ' ORDER BY role, name';
  const { results } = await env.IDENTITY.prepare(sql).bind(...args).all();
  return json({ users: results });
}

function cleanUser(b, existing = {}) {
  const role = oneOf(b.role, ROLES, existing.role);
  const name = str(b.name, 120) || existing.name;
  const phone = b.phone ? normPhone(b.phone) : existing.phone;
  if (!role || !name || !/^\d{10}$/.test(phone || '')) throw new HttpError(400, 'Role, name and a 10-digit mobile number are required');
  const u = {
    role, name, phone, email: str(b.email, 120) ?? existing.email ?? null,
    organisation: str(b.organisation, 120) ?? existing.organisation ?? null,
    state: str(b.state, 60) ?? existing.state ?? null, district: str(b.district, 60) ?? existing.district ?? null,
    lsgd_type: oneOf(b.lsgd_type, LSGD_TYPES.map(t => t.key), existing.lsgd_type ?? null), lsgd_name: str(b.lsgd_name, 120) ?? existing.lsgd_name ?? null,
    ward: str(b.ward, 20) ?? existing.ward ?? null,
    reg_council: str(b.reg_council, 80) ?? existing.reg_council ?? null, reg_number: str(b.reg_number, 40) ?? existing.reg_number ?? null,
    content_lang: oneOf(b.content_lang, LANG_CODES, existing.content_lang || 'ml'),
    pincode: b.pincode !== undefined ? (validPincode(b.pincode) ? String(b.pincode).trim() : null) : (existing.pincode ?? null),
  };
  if (role === 'worker' && (!u.state || !u.district || !u.lsgd_type || !u.lsgd_name)) throw new HttpError(400, 'Field workers need state, district and LSGD');
  if (role === 'coordinator' && !u.district) throw new HttpError(400, 'Coordinators need a district');
  if (role === 'dentist' && (!u.reg_number || !u.reg_council)) throw new HttpError(400, 'Dentists need their council and registration number');
  return u;
}

function tempPin() {
  let p;
  do { p = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); } while (!validPin(p));
  return p;
}

export async function createUser(env, req, user) {
  requireRole(user, 'admin', 'coordinator', 'clinical_admin');
  const b = await body(req);
  if (user.role === 'coordinator') { b.role = 'worker'; b.district = user.district; b.state = user.state; }
  if (user.role === 'clinical_admin' && !str(b.organisation)) b.organisation = AGED;
  const u = cleanUser(b);
  if (!canManage(user, u.role)) throw new HttpError(403, 'You cannot create this kind of account');
  const exists = await env.IDENTITY.prepare('SELECT 1 FROM users WHERE phone = ?').bind(u.phone).first();
  if (exists) throw new HttpError(409, 'A user with this mobile number already exists');
  const pin = tempPin();
  const { hash, salt } = await hashPin(pin);
  const id = uid('U-');
  await env.IDENTITY.prepare(
    `INSERT INTO users (id, role, name, phone, email, pin_hash, pin_salt, must_change, organisation, state, district, lsgd_type, lsgd_name, ward, reg_council, reg_number, reg_verified_at, content_lang, ui_lang)
     VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, u.role, u.name, u.phone, u.email, hash, salt, u.organisation, u.state, u.district, u.lsgd_type, u.lsgd_name, u.ward,
    u.reg_council, u.reg_number, b.reg_verified ? new Date().toISOString().slice(0, 10) : null, u.content_lang, 'en').run();
  if (u.pincode) await env.IDENTITY.prepare('UPDATE users SET pincode = ? WHERE id = ?').bind(u.pincode, id).run();
  await audit(env, user, 'user.create', 'user', id, { role: u.role });
  return json({ id, temporary_pin: pin });
}

export async function updateUser(env, req, user, id) {
  requireRole(user, 'admin', 'coordinator', 'clinical_admin');
  const existing = await env.IDENTITY.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) throw new HttpError(404, 'User not found');
  if (!canManage(user, existing.role) || (user.role === 'coordinator' && existing.district !== user.district)) throw new HttpError(403, 'Not allowed');
  const b = await body(req);
  if (user.role === 'coordinator') { b.role = 'worker'; b.district = user.district; }
  const u = cleanUser(b, existing);
  if (!canManage(user, u.role)) throw new HttpError(403, 'You cannot give this role');
  if (id === user.id && (u.role !== existing.role || b.active === false)) throw new HttpError(400, 'You cannot change your own role or deactivate yourself');
  if (existing.role === 'superadmin' && (u.role !== 'superadmin' || b.active === false)) {
    const others = await env.IDENTITY.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND active = 1 AND id <> ?").bind(id).first();
    if (!others.n) throw new HttpError(400, 'There must always be at least one active CIF super admin');
  }
  await env.IDENTITY.prepare(
    `UPDATE users SET role=?, name=?, phone=?, email=?, organisation=?, state=?, district=?, lsgd_type=?, lsgd_name=?, ward=?, reg_council=?, reg_number=?,
       reg_verified_at = CASE WHEN ? THEN date('now') ELSE reg_verified_at END, active=?, trained_at = CASE WHEN ? THEN date('now') ELSE trained_at END,
       content_lang=?, pincode=?, updated_at=datetime('now') WHERE id=?`)
    .bind(u.role, u.name, u.phone, u.email, u.organisation, u.state, u.district, u.lsgd_type, u.lsgd_name, u.ward, u.reg_council, u.reg_number,
      b.reg_verified ? 1 : 0, b.active === false ? 0 : 1, b.mark_trained ? 1 : 0, u.content_lang, u.pincode, id).run();
  if (b.active === false) await env.IDENTITY.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await audit(env, user, 'user.update', 'user', id, { active: b.active !== false });
  return json({ ok: true });
}

export async function resetPin(env, req, user, id) {
  requireRole(user, 'admin', 'coordinator', 'clinical_admin');
  const existing = await env.IDENTITY.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!existing) throw new HttpError(404, 'User not found');
  if (!canManage(user, existing.role) || (user.role === 'coordinator' && existing.district !== user.district)) throw new HttpError(403, 'Not allowed');
  const pin = tempPin();
  const { hash, salt } = await hashPin(pin);
  await env.IDENTITY.batch([
    env.IDENTITY.prepare("UPDATE users SET pin_hash=?, pin_salt=?, must_change=1, failed_attempts=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?").bind(hash, salt, id),
    env.IDENTITY.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ]);
  await audit(env, user, 'user.reset_pin', 'user', id);
  return json({ temporary_pin: pin });
}

// ---------- dashboard ----------
export async function dashboard(env, req, user) {
  requireRole(user, 'admin', 'coordinator', 'dpo', 'clinical_admin');
  const url = new URL(req.url);
  const district = user.role === 'coordinator' ? user.district : str(url.searchParams.get('district'), 60);
  const from = str(url.searchParams.get('from'), 10) || '2000-01-01';
  const to = str(url.searchParams.get('to'), 10) || '2999-12-31';
  const where = "c.submitted_at >= ? AND c.submitted_at < date(?, '+1 day')" + (district ? ' AND c.district = ?' : '');
  const args = district ? [from, to, district] : [from, to];
  const s = await getSettings(env);
  const urgentH = Number(s.sla_urgent_hours || 24), routineH = Number(s.sla_routine_hours || 72);
  const q = (sql, extra = []) => env.CLINICAL.prepare(sql).bind(...args, ...extra);
  const [totals, byStatus, byDistrict, tat, red, refs, ohatBand, teeth, overdue, sexAge, auditsRow, trend] = await Promise.all([
    q(`SELECT COUNT(*) AS cases, COUNT(DISTINCT c.person_id) AS persons, SUM(c.urgency='urgent') AS urgent, SUM(c.visit_type='followup') AS followups FROM cases c WHERE ${where}`).first(),
    q(`SELECT c.status, COUNT(*) AS n FROM cases c WHERE ${where} GROUP BY c.status`).all(),
    q(`SELECT c.district, COUNT(*) AS cases, COUNT(DISTINCT c.person_id) AS persons, SUM(c.urgency='urgent') AS urgent FROM cases c WHERE ${where} GROUP BY c.district ORDER BY cases DESC`).all(),
    q(`SELECT (julianday(c.opinion_at) - julianday(c.submitted_at)) * 24 AS hours, c.urgency FROM cases c WHERE ${where} AND c.opinion_at IS NOT NULL ORDER BY hours`).all(),
    q(`SELECT COUNT(*) AS n, SUM((julianday(COALESCE(c.opinion_at, datetime('now'))) - julianday(c.submitted_at)) * 24 <= ${urgentH}) AS in_sla FROM cases c WHERE ${where} AND c.urgency = 'urgent' AND c.status <> 'withdrawn'`).first(),
    q(`SELECT r.status, COUNT(*) AS n FROM referrals r JOIN cases c ON c.id = r.case_id WHERE ${where} GROUP BY r.status`).all(),
    q(`SELECT CASE WHEN s.ohat_total <= 2 THEN '0-2 healthy' WHEN s.ohat_total <= 6 THEN '3-6 some changes' ELSE '7+ unhealthy' END AS band, COUNT(*) AS n
       FROM cases c JOIN screenings s ON s.case_id = c.id WHERE ${where} GROUP BY band ORDER BY band`).all(),
    q(`SELECT c.age_band, COUNT(*) AS n, SUM(s.functional_dentition = 1) AS functional, SUM(s.natural_teeth = 0) AS edentulous, AVG(s.gohai_total) AS gohai
       FROM cases c JOIN screenings s ON s.case_id = c.id WHERE ${where} AND c.visit_type = 'baseline' GROUP BY c.age_band ORDER BY c.age_band`).all(),
    q(`SELECT c.id, c.urgency, c.district, c.submitted_at, c.status, (julianday('now') - julianday(c.submitted_at)) * 24 AS age_hours FROM cases c
       WHERE ${where} AND c.status = 'submitted' AND ((c.urgency='urgent' AND age_hours > ${urgentH}) OR (c.urgency='routine' AND age_hours > ${routineH})) ORDER BY c.submitted_at LIMIT 50`).all(),
    q(`SELECT c.sex, COUNT(*) AS n FROM cases c WHERE ${where} GROUP BY c.sex`).all(),
    q(`SELECT COUNT(*) AS sampled, SUM(a.id IS NOT NULL) AS done, AVG(a.rating) AS avg_rating, SUM(a.safe = 0) AS unsafe
       FROM cases c JOIN opinions o ON o.case_id = c.id AND o.superseded_by IS NULL LEFT JOIN audits a ON a.opinion_id = o.id WHERE ${where} AND c.sampled_for_audit = 1`).first(),
    q(`SELECT strftime('%Y-%m', c.submitted_at) AS month, COUNT(*) AS cases, SUM(c.urgency='urgent') AS urgent FROM cases c WHERE ${where} GROUP BY month ORDER BY month`).all(),
  ]);
  const hrs = tat.results.map(r => r.hours);
  const median = hrs.length ? hrs[Math.floor(hrs.length / 2)] : null;
  const [workers, dentists] = await Promise.all([
    env.IDENTITY.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='worker' AND active=1 ${district ? 'AND district = ?' : ''}`).bind(...(district ? [district] : [])).first(),
    env.IDENTITY.prepare("SELECT COUNT(*) AS n FROM users WHERE role='dentist' AND active=1").first(),
  ]);
  const threshold = Number(s.small_cell_threshold || 10);
  return json({
    filters: { district, from, to }, small_cell_threshold: threshold,
    totals: { ...totals, workers: workers.n, dentists: dentists.n },
    by_status: byStatus.results, by_district: byDistrict.results,
    turnaround_hours_median: median, opinions: hrs.length,
    urgent_sla: { total: red.n, within: red.in_sla, hours: urgentH },
    referrals: refs.results, ohat_bands: ohatBand.results, teeth_by_age: teeth.results, sex: sexAge.results,
    overdue: overdue.results, audit: auditsRow, trend: trend.results,
  });
}

export async function indicatorsCsv(env, req, user) {
  requireRole(user, 'admin', 'coordinator', 'researcher', 'clinical_admin');
  const res = await dashboard(env, req, { ...user, role: user.role === 'researcher' ? 'admin' : user.role, must_change: false });
  const d = await res.json();
  const t = d.small_cell_threshold;
  const cell = n => (n == null ? '' : n > 0 && n < t ? `<${t}` : String(n));
  const lines = [['indicator', 'group', 'value']];
  lines.push(['cases', 'all', cell(d.totals.cases)], ['persons', 'all', cell(d.totals.persons)], ['urgent_cases', 'all', cell(d.totals.urgent)]);
  lines.push(['median_hours_to_opinion', 'all', d.turnaround_hours_median == null ? '' : d.turnaround_hours_median.toFixed(1)]);
  for (const r of d.by_district) lines.push(['cases', `district:${r.district}`, cell(r.cases)]);
  for (const r of d.ohat_bands) lines.push(['ohat_band', r.band, cell(r.n)]);
  for (const r of d.teeth_by_age) {
    lines.push(['screened_baseline', `age:${r.age_band}`, cell(r.n)], ['functional_dentition_20plus', `age:${r.age_band}`, cell(r.functional)],
      ['edentulous', `age:${r.age_band}`, cell(r.edentulous)], ['mean_gohai', `age:${r.age_band}`, r.n >= t && r.gohai ? r.gohai.toFixed(1) : '']);
  }
  for (const r of d.referrals) lines.push(['referrals', `status:${r.status}`, cell(r.n)]);
  await audit(env, user, 'export.indicators', null, null, d.filters);
  return new Response(lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="vayosmitham-indicators.csv"' },
  });
}

// De-identified research extract: only people with research consent; Person ID replaced by a salted hash.
export async function researchExtract(env, req, user) {
  requireRole(user, 'researcher', 'admin');
  const { results: consented } = await env.IDENTITY.prepare(
    "SELECT DISTINCT person_id FROM consents WHERE layer = 'research' AND granted = 1 AND withdrawn_at IS NULL").all();
  const allowed = new Set(consented.map(r => r.person_id));
  const { results } = await env.CLINICAL.prepare(
    `SELECT c.person_id, c.visit_type, c.urgency, c.age_band, c.sex, c.district, c.bedbound, substr(c.submitted_at,1,7) AS month,
       s.ohat, s.ohat_total, s.gohai_total, s.natural_teeth, s.functional_dentition, s.denture_upper, s.denture_lower, s.denture_fit, s.risks, s.context, s.extra, s.questionnaire_version,
       o.referral_needed, o.referral_type, r.status AS referral_status
     FROM cases c JOIN screenings s ON s.case_id = c.id LEFT JOIN opinions o ON o.case_id = c.id AND o.superseded_by IS NULL
     LEFT JOIN referrals r ON r.case_id = c.id WHERE c.status <> 'withdrawn' ORDER BY c.person_id, c.submitted_at`).all();
  const salt = (await env.CLINICAL.prepare("SELECT value FROM settings WHERE key='research_salt'").first())?.value || randomCode(16);
  await env.CLINICAL.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('research_salt', ?)").bind(salt).run();
  const header = ['subject', 'visit_type', 'month', 'age_band', 'sex', 'district', 'bedbound', 'urgency', 'ohat_total', 'gohai_total', 'natural_teeth', 'functional_dentition',
    'denture_upper', 'denture_lower', 'denture_fit', 'referral_needed', 'referral_type', 'referral_status', 'questionnaire_version', ...QUESTIONS.map(q => q.key)];
  const rows = [header];
  for (const r of results) {
    if (!allowed.has(r.person_id)) continue;
    const answers = { extra: parseJSON(r.extra, {}), context: parseJSON(r.context, {}), risks: parseJSON(r.risks, {}) };
    rows.push([(await sha256(salt + r.person_id)).slice(0, 12), r.visit_type, r.month, r.age_band, r.sex, r.district, r.bedbound, r.urgency, r.ohat_total, r.gohai_total,
      r.natural_teeth, r.functional_dentition, r.denture_upper, r.denture_lower, r.denture_fit, r.referral_needed, r.referral_type, r.referral_status, r.questionnaire_version,
      ...QUESTIONS.map(q => answers[QUESTION_STEPS[q.step]][q.key])]);
  }
  await audit(env, user, 'export.research', null, null, { rows: rows.length - 1 });
  return new Response(rows.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="vayosmitham-research-extract.csv"' },
  });
}

export async function auditLog(env, req, user) {
  requireRole(user, 'admin', 'dpo');
  const url = new URL(req.url);
  const before = int(url.searchParams.get('before'), 1, 1e12);
  const { results } = await env.CLINICAL.prepare(
    `SELECT * FROM audit_log ${before ? 'WHERE id < ?' : ''} ORDER BY id DESC LIMIT 200`).bind(...(before ? [before] : [])).all();
  const ids = [...new Set(results.map(r => r.user_id).filter(Boolean))];
  const names = {};
  if (ids.length) for (const r of (await env.IDENTITY.prepare(`SELECT id, name FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results) names[r.id] = r.name;
  return json({ entries: results.map(r => ({ ...r, user_name: names[r.user_id] || null })) });
}

export async function consentLog(env, req, user) {
  requireRole(user, 'dpo', 'admin');
  const { results } = await env.IDENTITY.prepare(
    `SELECT c.person_id, c.layer, c.granted, c.method, c.capacity, c.decider_type, c.copy_offered, c.notice_version, c.recorded_at, c.withdrawn_at, c.withdrawn_reason
     FROM consents c ORDER BY c.recorded_at DESC LIMIT 300`).all();
  return json({ consents: results });
}

// ---------- reference data (generic CRUD) ----------
const TABLES = {
  referral_centres: { cols: ['name', 'kind', 'services', 'address', 'district', 'timings', 'phone', 'cost_category', 'accessibility', 'active'], prefix: 'RC-', required: ['name'] },
  kb_items: { cols: ['title', 'title_ml', 'kind', 'url', 'language', 'audience', 'tags', 'active'], prefix: 'KB-', required: ['title', 'kind', 'url'] },
  glossary: { cols: ['en', 'ml', 'notes'], prefix: 'GL-', required: ['en', 'ml'] },
  lsgds: { cols: ['state', 'district', 'kind', 'name', 'name_ml', 'lgd_code'], prefix: 'LS-', required: ['state', 'district', 'kind', 'name'] },
};

// The AGeD clinical admin looks after clinical content (education items, glossary); CIF admins look after the rest.
const CLINICAL_TABLES = ['kb_items', 'glossary'];
const refRoles = table => (CLINICAL_TABLES.includes(table) ? ['admin', 'clinical_admin'] : ['admin']);

export async function upsertRef(env, req, user, table, id) {
  requireRole(user, ...refRoles(table));
  const t = TABLES[table];
  if (!t) throw new HttpError(404, 'Unknown list');
  const b = await body(req);
  const vals = t.cols.map(c => (c === 'active' ? (b.active === false || b.active === 0 ? 0 : 1) : str(b[c], 1000)));
  for (const r of t.required) if (!vals[t.cols.indexOf(r)]) throw new HttpError(400, `${r} is required`);
  if (table === 'kb_items' && !/^https:\/\//.test(vals[t.cols.indexOf('url')])) throw new HttpError(400, 'Link must start with https://');
  if (id) {
    await env.CLINICAL.prepare(`UPDATE ${table} SET ${t.cols.map(c => `${c} = ?`).join(', ')}${table === 'kb_items' ? ', version = version + 1, approved_by = NULL, approved_at = NULL' : ''} WHERE id = ?`)
      .bind(...vals, id).run();
  } else {
    id = uid(t.prefix);
    await env.CLINICAL.prepare(`INSERT INTO ${table} (id, ${t.cols.join(', ')}) VALUES (?, ${t.cols.map(() => '?').join(', ')})`).bind(id, ...vals).run();
  }
  await audit(env, user, `${table}.save`, table, id);
  return json({ id });
}

export async function deleteRef(env, req, user, table, id) {
  requireRole(user, ...refRoles(table));
  if (!TABLES[table]) throw new HttpError(404, 'Unknown list');
  if (table === 'kb_items' || table === 'referral_centres') await env.CLINICAL.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).bind(id).run();
  else await env.CLINICAL.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  await audit(env, user, `${table}.delete`, table, id);
  return json({ ok: true });
}

export async function approveKb(env, req, user, id) {
  requireRole(user, 'admin', 'auditor', 'clinical_admin');
  await env.CLINICAL.prepare("UPDATE kb_items SET approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(user.id, id).run();
  await audit(env, user, 'kb.approve', 'kb_items', id);
  return json({ ok: true });
}

// CSV import for LSGD list: state,district,kind,name[,name_ml,lgd_code]
export async function importLsgds(env, req, user) {
  requireRole(user, 'admin');
  const text = await req.text();
  const rows = parseCsv(text).filter(r => r.length >= 4 && r[0] && r[0].toLowerCase() !== 'state');
  if (!rows.length) throw new HttpError(400, 'No rows found. Expected: state,district,kind,name');
  const kinds = LSGD_TYPES.map(t => t.key);
  const stmts = rows.slice(0, 5000).map(r => env.CLINICAL.prepare('INSERT OR REPLACE INTO lsgds (id, state, district, kind, name, name_ml, lgd_code) VALUES (?,?,?,?,?,?,?)')
    .bind('LS-' + (r[5] || `${r[1]}-${r[3]}`).replace(/\s+/g, '_').slice(0, 80), r[0], r[1], kinds.includes(r[2]) ? r[2] : 'other', r[3], r[4] || null, r[5] || null));
  for (let i = 0; i < stmts.length; i += 100) await env.CLINICAL.batch(stmts.slice(i, i + 100));
  await audit(env, user, 'lsgds.import', null, null, { rows: stmts.length });
  return json({ imported: stmts.length });
}

export async function saveSettings(env, req, user) {
  requireRole(user, 'admin');
  const b = await body(req);
  // Details printed in the legal privacy notice can only be changed by the CIF super admin.
  const allowed = ['claim_minutes', 'sla_urgent_hours', 'sla_routine_hours', 'audit_sample_percent', 'small_cell_threshold',
    ...(user.role === 'superadmin' ? ['org_legal_name', 'org_address', 'grievance_name', 'grievance_phone', 'grievance_email', 'retention_years', 'grievance_days'] : [])];
  const stmts = [];
  for (const k of allowed) if (b[k] != null) stmts.push(env.CLINICAL.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, String(b[k]).slice(0, 300)));
  if (stmts.length) await env.CLINICAL.batch(stmts);
  await audit(env, user, 'settings.save', null, null, b);
  return json({ ok: true });
}

// ---------- clinical audit (AGeD) ----------
export async function auditQueue(env, req, user) {
  requireRole(user, 'auditor', 'admin', 'clinical_admin');
  const { results } = await env.CLINICAL.prepare(
    `SELECT o.id, o.case_id, o.dentist_id, o.impression, o.referral_needed, o.signed_at, c.age_band, c.sex, c.urgency, c.district,
       a.rating, a.safe, a.notes AS audit_notes
     FROM opinions o JOIN cases c ON c.id = o.case_id LEFT JOIN audits a ON a.opinion_id = o.id
     WHERE c.sampled_for_audit = 1 AND o.superseded_by IS NULL ORDER BY (a.id IS NOT NULL), o.signed_at DESC LIMIT 200`).all();
  const ids = [...new Set(results.map(r => r.dentist_id))];
  const names = {};
  if (ids.length) for (const r of (await env.IDENTITY.prepare(`SELECT id, name, reg_number FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results) names[r.id] = r;
  return json({ items: results.map(r => ({ ...r, dentist: names[r.dentist_id] || null, dentist_id: undefined })) });
}

export async function auditCase(env, req, user, oid) {
  requireRole(user, 'auditor', 'admin', 'clinical_admin');
  const o = await env.CLINICAL.prepare('SELECT * FROM opinions WHERE id = ?').bind(oid).first();
  if (!o) throw new HttpError(404, 'Not found');
  const [c, s, images, a] = await Promise.all([
    env.CLINICAL.prepare('SELECT id, visit_type, urgency, red_flags, age_band, sex, district, bedbound, submitted_at FROM cases WHERE id = ?').bind(o.case_id).first(),
    env.CLINICAL.prepare('SELECT * FROM screenings WHERE case_id = ?').bind(o.case_id).first(),
    env.CLINICAL.prepare('SELECT id, view FROM images WHERE case_id = ?').bind(o.case_id).all(),
    env.CLINICAL.prepare('SELECT * FROM audits WHERE opinion_id = ?').bind(oid).first(),
  ]);
  const d = await env.IDENTITY.prepare('SELECT name, reg_number FROM users WHERE id = ?').bind(o.dentist_id).first();
  await audit(env, user, 'audit.view', 'opinion', oid);
  return json({ opinion: { ...o, dentist_id: undefined, kb_items: parseJSON(o.kb_items, []) }, dentist: d, case: { ...c, red_flags: parseJSON(c.red_flags, []) },
    screening: s ? expandScreening(s) : null, images: images.results, audit: a });
}

export async function saveAudit(env, req, user, oid) {
  requireRole(user, 'auditor', 'admin', 'clinical_admin');
  const b = await body(req);
  const rating = int(b.rating, 1, 5);
  if (!rating) throw new HttpError(400, 'Give a rating from 1 to 5');
  await env.CLINICAL.prepare(
    `INSERT INTO audits (id, opinion_id, auditor_id, rating, safe, notes) VALUES (?,?,?,?,?,?)
     ON CONFLICT(opinion_id) DO UPDATE SET rating=excluded.rating, safe=excluded.safe, notes=excluded.notes, auditor_id=excluded.auditor_id, created_at=datetime('now')`)
    .bind(uid('AU-'), oid, user.id, rating, b.safe === false ? 0 : 1, str(b.notes, 2000)).run();
  await audit(env, user, 'audit.save', 'opinion', oid, { rating });
  return json({ ok: true });
}

// Minimal RFC 4180 CSV parser (quoted fields, embedded commas and quotes).
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(f.trim()); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f.trim()); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f.trim()); rows.push(row); }
  return rows;
}
