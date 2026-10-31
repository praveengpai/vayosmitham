// End-to-end API test: worker → dentist → worker → auditor → admin.
// Usage: BASE=http://localhost:8787 PIN=482913 node scripts/api-test.mjs
import { readFileSync } from 'node:fs';
import { CONSENT_VERSION as CV } from '../public/shared/consent.js';
const BASE = process.env.BASE || 'http://localhost:8787';
const PIN = process.env.PIN || '482913';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

async function session(phone) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, pin: PIN }) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const body = await r.json();
  if (!r.ok) throw new Error('login failed ' + phone + ' ' + JSON.stringify(body));
  const call = async (path, opts = {}) => {
    const res = await fetch(BASE + path, { ...opts, headers: { cookie, ...(opts.json ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
      body: opts.json ? JSON.stringify(opts.json) : opts.body });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
  };
  return { user: body.user, call };
}

console.log('worker');
const w = await session('9000000002');
ok(w.user.role === 'worker', 'worker signs in');
const visit = {
  client_uuid: crypto.randomUUID(), visit_type: 'baseline',
  person: { client_uuid: crypto.randomUUID(), name: 'Kamalakshi Amma', sex: 'F', birth_year: 1948, phone: '9876543210', address: 'Puthenveedu', state: 'Kerala', district: 'Ernakulam',
    lsgd_type: 'municipality', lsgd_name: 'Kalamassery', ward: '12' },
  consents: [{ layer: 'care', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml', notice_version: CV, copy_offered: true },
    { layer: 'photos', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml', notice_version: CV },
    { layer: 'research', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml', notice_version: CV }],
  red_flags: ['ulcer_2wk'],
  screening: { complaints: ['pain', 'denture_problem'], complaint_text: 'താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു, ഇടതുവശത്ത് മൂന്നാഴ്ചയായി ഒരു വ്രണം ഉണ്ട്', ohat: { lips: 0, tongue: 1, gums: 2, saliva: 1, teeth: 2, dentures: 2, cleanliness: 1, pain: 1 },
    gohai: [2, 2, 4, 3, 2, 4, 3, 3, 2, 3, 3, 4], natural_teeth: 6, denture_upper: 'none', denture_lower: 'partial', denture_fit: 'loose',
    context: { diabetes: true, bedbound: false }, medicines: ['Amlodipine 5mg', 'Metformin', 'Aspirin 75'], risks: { tobacco_chew: 'former', areca: 'current', brushing: 'once' } },
};
// location override without reason must fail
const bad = await w.call('/api/visits', { method: 'POST', json: { ...visit, client_uuid: crypto.randomUUID(), person: { ...visit.person, client_uuid: crypto.randomUUID(), ward: '3' } } });
ok(bad.status === 400 && /why the location/i.test(bad.data.error), 'location change without a reason is refused');
const badV = await w.call('/api/visits', { method: 'POST', json: { ...visit, client_uuid: crypto.randomUUID(), person: { ...visit.person, client_uuid: crypto.randomUUID() }, consents: [{ ...visit.consents[0], notice_version: 'made-up' }] } });
ok(badV.status === 400 && /unknown notice version/i.test(badV.data.error), 'consent with an unknown notice version is refused');
const noDecider = await w.call('/api/visits', { method: 'POST', json: { ...visit, client_uuid: crypto.randomUUID(), person: { ...visit.person, client_uuid: crypto.randomUUID() }, consents: [{ ...visit.consents[0], capacity: 'doubtful', method: 'caregiver_assent', assent_by: 'Son' }] } });
ok(noDecider.status === 400 && /who is deciding/i.test(noDecider.data.error), 'assent without saying who decides is refused');
const v = await w.call('/api/visits', { method: 'POST', json: visit });
ok(v.status === 200 && v.data.urgency === 'urgent', 'visit submitted and marked urgent');
const again = await w.call('/api/visits', { method: 'POST', json: visit });
ok(again.data.duplicate && again.data.case_id === v.data.case_id, 'replayed offline visit is not duplicated');
const caseId = v.data.case_id, personId = v.data.person_id;
// tiny JPEG with an EXIF segment
const jpeg = readFileSync(new URL('./test-photo.jpg', import.meta.url));
const img = await w.call(`/api/cases/${caseId}/images?view=front&client_uuid=${crypto.randomUUID()}`, { method: 'POST', body: jpeg, headers: { 'content-type': 'image/jpeg' } });
ok(img.status === 200, 'photo uploaded');
const home = await w.call('/api/worker/home');
ok(home.data.awaiting_dentist.some(c => c.id === caseId), 'case shows as waiting for a dentist');

console.log('dentist');
const d = await session('9000000003');
const q = await d.call('/api/dentist/queue');
const qc = q.data.cases.find(c => c.id === caseId);
ok(!!qc, 'case appears in the dentist queue');
ok(qc && !('person_id' in qc) && !JSON.stringify(q.data).includes('Kamalakshi'), 'queue has no patient identity');
const blocked = await d.call('/api/dentist/cases/' + caseId);
ok(blocked.status === 403, 'dentist cannot open a case without claiming it');
ok((await d.call(`/api/dentist/cases/${caseId}/claim`, { method: 'POST' })).status === 200, 'dentist claims the case');
const dc = await d.call('/api/dentist/cases/' + caseId);
ok(dc.status === 200 && !JSON.stringify(dc.data).includes('Kamalakshi') && !JSON.stringify(dc.data).includes('9876543210') && !JSON.stringify(dc.data).includes('Puthenveedu'), 'case view has no name, phone or address');
ok(dc.data.screening.complaint_text.startsWith('താഴത്തെ'), 'dentist sees the original Malayalam text');
ok(dc.data.screening.medicine_flags.some(f => f.flag === 'gum_overgrowth') && dc.data.screening.medicine_flags.some(f => f.flag === 'bleeding'), 'medicine warnings computed');
const media = await d.call('/api/media/' + dc.data.images[0].id);
ok(media.status === 200 && !String(media.data).includes('TestPhoneMaker'), 'photo served with EXIF removed');

console.log('second dentist');
// second dentist created by admin later; for now try to claim with auditor (should be refused by role)
const a = await session('9000000004');
ok((await a.call(`/api/dentist/cases/${caseId}/claim`, { method: 'POST' })).status === 403, 'non-dentist cannot claim');

const op = await d.call(`/api/dentist/cases/${caseId}/opinion`, { method: 'POST', json: {
  impression: 'Non-healing ulcer on the left lateral border of the tongue near a sharp broken tooth, with a loose lower partial denture.',
  advice: 'Do not wear the lower denture until it is checked. Rinse with salt water after food. Avoid areca nut.',
  care_plan: 'Biopsy evaluation of the ulcer within 7 days. Smooth or extract the sharp tooth. New lower denture after healing.',
  followup_months: 3, referral_needed: true, referral_type: 'oral_medicine', referral_urgency: 'within_7d', referral_message: 'Please evaluate non-healing ulcer.' } });
ok(op.status === 200, 'opinion signed');
const q2 = await d.call('/api/dentist/queue');
ok(!q2.data.cases.some(c => c.id === caseId), 'case leaves the queue after the opinion');

console.log('worker sees opinion');
const wc = await w.call('/api/cases/' + caseId);
ok(wc.data.opinion && !('dentist_id' in wc.data.opinion), 'worker sees the opinion without dentist identity');
const tr = await w.call('/api/translate', { method: 'POST', json: { text: wc.data.opinion.advice, src: 'en', tgt: 'ml' } });
console.log('    translation →', tr.status, (tr.data.text || tr.data.error || '').slice(0, 80), tr.data.engine || '');
const rep = await w.call(`/api/cases/${caseId}/report`);
ok(rep.data.dentist?.reg_number === 'KSDC-12345', 'referral report carries dentist name and registration');
const vpage = await fetch(BASE + '/v/' + rep.data.opinion.verify_code).then(r => r.text());
ok(vpage.includes('Valid') && !vpage.includes('Kamalakshi'), 'public verify page works and shows no patient name');
ok((await w.call(`/api/cases/${caseId}/referral-outcome`, { method: 'POST', json: { status: 'reached', reached_date: '2026-10-25', treatment: 'Biopsy done' } })).status === 200, 'referral outcome recorded');
const p = await w.call('/api/persons/' + personId);
ok(p.data.followups.length === 1, 'follow-up visit scheduled');

console.log('admin');
const ad = await session('9000000001');
const dash = await ad.call('/api/admin/dashboard');
ok(dash.status === 200 && dash.data.totals.cases >= 1, 'dashboard returns totals');
const csv = await ad.call('/api/admin/indicators.csv');
ok(typeof csv.data === 'string' && csv.data.includes('indicator'), 'indicator CSV exports');
const rx = await ad.call('/api/research/extract.csv');
ok(typeof rx.data === 'string' && !rx.data.includes(personId) && !rx.data.includes('Kamalakshi'), 'research extract is de-identified');
const nu = await ad.call('/api/admin/users', { method: 'POST', json: { role: 'coordinator', name: 'Coord Second', phone: '98' + String(Date.now()).slice(-8), state: 'Kerala', district: 'Thrissur' } });
ok(nu.status === 200 && /^\d{6}$/.test(nu.data.temporary_pin), 'admin creates a user with a temporary PIN');
ok((await ad.call('/api/admin/users', { method: 'POST', json: { role: 'dentist', name: 'Dr X', phone: '97' + String(Date.now()).slice(-8), reg_council: 'KSDC', reg_number: 'X1' } })).status === 403, 'CIF admin cannot create dentists (AGeD does)');
ok((await ad.call('/api/admin/users', { method: 'POST', json: { role: 'superadmin', name: 'X', phone: '96' + String(Date.now()).slice(-8) } })).status === 403, 'CIF admin cannot create a super admin');
const log = await ad.call('/api/admin/audit-log');
ok(log.data.entries.some(e => e.action === 'opinion.sign'), 'access log records the opinion');

console.log('AGeD clinical admin');
const ag = await session('9000000011');
ok(ag.user.role === 'clinical_admin', 'AGeD admin signs in');
const dn = await ag.call('/api/admin/users', { method: 'POST', json: { role: 'dentist', name: 'Dr Second', phone: '98' + String(Date.now() + 7).slice(-8), reg_council: 'KSDC', reg_number: 'KSDC-2' } });
ok(dn.status === 200, 'AGeD admin creates a volunteer dentist');
const agUsers = await ag.call('/api/admin/users');
ok(agUsers.status === 200 && agUsers.data.users.every(u => ['dentist', 'auditor', 'institution_admin'].includes(u.role)), 'AGeD admin sees only dentists, auditors and institution coordinators');
ok((await ag.call('/api/admin/users', { method: 'POST', json: { role: 'worker', name: 'W', phone: '95' + String(Date.now()).slice(-8), state: 'Kerala', district: 'Ernakulam', lsgd_type: 'municipality', lsgd_name: 'X' } })).status === 403, 'AGeD admin cannot create field workers');
ok((await ag.call('/api/persons')).status === 403, 'AGeD admin cannot open identifiable person records');
ok((await ag.call('/api/admin/consents')).status === 403, 'AGeD admin cannot read the consent log');
ok((await ag.call('/api/admin/dashboard')).status === 200, 'AGeD admin sees the aggregate dashboard');
const q0 = await ag.call('/api/admin/questionnaire');
ok(q0.status === 200 && q0.data.can_edit && !q0.data.can_restore, 'AGeD admin can edit (not restore) the questionnaire');
const content = q0.data.content;
// locked: removing an OHAT item is refused
const badO = structuredClone(content); badO.ohat.pop();
ok((await ag.call('/api/admin/questionnaire', { method: 'POST', json: { content: badO, note: 'x', based_on: q0.data.version } })).status === 400, 'OHAT items cannot be removed');
const bad2 = structuredClone(content); bad2.complaints = bad2.complaints.filter(c => c.key !== 'pain');
ok((await ag.call('/api/admin/questionnaire', { method: 'POST', json: { content: bad2, note: 'x', based_on: q0.data.version } })).status === 400, 'used items cannot be deleted, only retired');
const good = structuredClone(content);
good.questions.push({ key: 'test_q_' + Date.now(), step: 'health', type: 'yesno', en: 'Uses a walking aid', ml: 'നടക്കാൻ സഹായ ഉപകരണം ഉപയോഗിക്കുന്നു' });
good.complaints.find(c => c.key === 'bad_breath').active = false;
const pub = await ag.call('/api/admin/questionnaire', { method: 'POST', json: { content: good, note: 'Test: walking aid question, retire bad breath', based_on: q0.data.version } });
ok(pub.status === 200 && pub.data.version === q0.data.version + 1, 'AGeD admin publishes a new questionnaire version');
const stale = await ag.call('/api/admin/questionnaire', { method: 'POST', json: { content: good, note: 'again', based_on: q0.data.version } });
ok(stale.status === 409, 'publishing over a newer version is refused');
const ref2 = await w.call('/api/ref');
ok(ref2.data.questionnaire?.version === pub.data.version, 'field app receives the new version');
const newKey = good.questions.at(-1).key;
const v2 = { ...visit, client_uuid: crypto.randomUUID(), person: undefined, person_id: personId, visit_type: 'followup', consents: [], questionnaire_version: pub.data.version,
  screening: { ...visit.screening, context: { ...visit.screening.context, [newKey]: true, made_up: true }, extra: { denture_out_night: false } } };
const sub2 = await w.call('/api/visits', { method: 'POST', json: v2 });
ok(sub2.status === 200, 'visit with the new question is accepted');
const voice = new Uint8Array(4000).fill(7);
const vn = await w.call(`/api/cases/${sub2.data.case_id}/voice?client_uuid=${crypto.randomUUID()}`, { method: 'POST', body: voice, headers: { 'content-type': 'audio/webm' } });
ok(vn.status === 200, 'voice note uploads');
ok((await w.call(`/api/cases/${sub2.data.case_id}/voice`, { method: 'POST', body: voice, headers: { 'content-type': 'text/plain' } })).status === 415, 'non-audio voice upload refused');
const wc2 = await w.call('/api/cases/' + sub2.data.case_id);
ok(wc2.data.screening.context[newKey] === true && !('made_up' in wc2.data.screening.context) && wc2.data.screening.extra.denture_out_night === false, 'answers stored; unknown keys dropped');
ok(wc2.data.images.some(i => i.view === 'voice_note'), 'voice note listed with the visit');

console.log('CIF super admin');
const sa = await session('9000000010');
ok(sa.user.role === 'superadmin', 'super admin signs in');
const sq = await sa.call('/api/admin/questionnaire');
ok(sq.data.can_restore && sq.data.history[0].note.startsWith('Test:'), 'super admin sees the AGeD change in the history');
const rs = await sa.call('/api/admin/questionnaire/restore', { method: 'POST', json: { version: q0.data.version } });
ok(rs.status === 200, 'super admin restores the previous version');
const after = await sa.call('/api/admin/questionnaire');
ok(after.data.content.complaints.find(c => c.key === 'bad_breath').active !== false && after.data.content.questions.find(q => q.key === newKey)?.active === false,
  'restore brings back retired items and retires newer ones (kept for old visits)');
ok((await ag.call('/api/admin/questionnaire/restore', { method: 'POST', json: { version: 1 } })).status === 403, 'AGeD admin cannot restore');
ok((await sa.call('/api/admin/consents')).status === 200 && (await sa.call('/api/persons')).status === 200, 'super admin has full admin access');
ok((await ad.call('/api/admin/settings', { method: 'POST', json: { grievance_days: '29' } })).status === 200, 'admin saves settings');
const st = await w.call('/api/ref');
ok(st.data.settings.grievance_days !== '29', 'only the super admin can change privacy notice details');

console.log('institutions');
const insRes = await ag.call('/api/admin/institutions', { method: 'POST', json: { name: 'Test Dental College ' + Date.now(), kind: 'dental_college', state: 'Kerala', district: 'Ernakulam' } });
ok(insRes.status === 200, 'AGeD admin creates an institution');
const instId = insRes.data.id;
const pinFor = async (s0, role, extra) => {
  const ph = '97' + String(Date.now() + Math.floor(Math.random() * 1e5)).slice(-8);
  const r = await s0.call('/api/admin/users', { method: 'POST', json: { role, name: role + ' test', phone: ph, ...extra } });
  return { ...r, phone: ph };
};
const ia = await pinFor(ag, 'institution_admin', { institution_id: instId });
ok(ia.status === 200, 'AGeD admin creates the institution coordinator');
ok((await pinFor(ag, 'institution_admin', {})).status === 400, 'institution coordinator needs an institution');
// first sign-in: change the temporary PIN
const firstLogin = async (phone, temp) => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, pin: temp }) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  await fetch(BASE + '/api/me/pin', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ current: temp, new: PIN }) });
  return session(phone);
};
const isess = await firstLogin(ia.phone, ia.data.temporary_pin);
ok(isess.user.role === 'institution_admin', 'institution coordinator signs in');
const idn = await isess.call('/api/admin/users', { method: 'POST', json: { role: 'dentist', name: 'Dr Inst Dentist', phone: '96' + String(Date.now()).slice(-8), reg_council: 'KSDC', reg_number: 'INST-1', institution_id: 'someone-else' } });
ok(idn.status === 200, 'institution coordinator adds a dentist (always to her own institution)');
ok((await isess.call('/api/admin/users', { method: 'POST', json: { role: 'worker', name: 'x', phone: '95' + String(Date.now()).slice(-8), state: 'Kerala', district: 'Ernakulam', lsgd_type: 'municipality', lsgd_name: 'x' } })).status === 403, 'institution coordinator cannot add field workers');
const iu = await isess.call('/api/admin/users');
ok(iu.data.users.length === 1 && iu.data.users[0].institution_id === instId, 'institution coordinator sees only her dentists');
const dsess = await firstLogin(iu.data.users[0].phone, idn.data.temporary_pin);
// a fresh case to assign
const v3 = { ...visit, client_uuid: crypto.randomUUID(), person: undefined, person_id: personId, visit_type: 'problem', consents: [], red_flags: [], screening: { ...visit.screening } };
const sub3 = await w.call('/api/visits', { method: 'POST', json: v3 });
const iq = await isess.call('/api/institution/queue?state=Kerala');
ok(iq.status === 200 && iq.data.open.some(c => c.id === sub3.data.case_id), 'open queue (filtered by state) shows the new case');
ok(!JSON.stringify(iq.data.open).includes('Kamalakshi'), 'institution queue shows no patient names');
const as = await isess.call(`/api/institution/cases/${sub3.data.case_id}/assign`, { method: 'POST', json: { dentist_id: iu.data.users[0].id } });
ok(as.status === 200, 'institution assigns the case to its dentist');
const dq2 = await d.call('/api/dentist/queue');
ok(!dq2.data.cases.some(c => c.id === sub3.data.case_id), 'other dentists no longer see the assigned case');
const myq = await dsess.call('/api/dentist/queue');
ok(myq.data.cases[0]?.id === sub3.data.case_id && myq.data.cases[0].assigned && myq.data.cases[0].institution_name, 'assigned dentist sees it first, marked as assigned');
await dsess.call(`/api/dentist/cases/${sub3.data.case_id}/claim`, { method: 'POST' });
const dcase = await dsess.call('/api/dentist/cases/' + sub3.data.case_id);
ok(dcase.data.case.worker_lang, 'dentist knows the field worker\'s language for the translation preview');
const sg = await dsess.call(`/api/dentist/cases/${sub3.data.case_id}/opinion`, { method: 'POST', json: { impression: 'Loose lower denture.', advice: 'Remove at night.', followup_months: 6 } });
ok(sg.status === 200, 'assigned dentist signs the opinion');
const rep2 = await w.call(`/api/cases/${sub3.data.case_id}/report`);
ok(rep2.data.dentist.institution && rep2.data.opinion.institution_name, 'referral report shows the institution');
const vp = await fetch(BASE + '/v/' + rep2.data.opinion.verify_code).then(r => r.text());
ok(vp.includes('Institution'), 'verify page shows the institution');
const ir = await isess.call('/api/institution/report');
ok(ir.data.totals.opinions === 1 && ir.data.by_dentist[0].opinions === 1, 'institution report counts its opinions');
const iq2 = await isess.call('/api/institution/queue');
ok(iq2.data.assigned.some(a => a.id === sub3.data.case_id && a.state_label === 'done'), 'institution sees the case as done');
const dash2 = await sa.call('/api/admin/dashboard?state=Kerala');
ok(dash2.data.institutions.some(r => r.institution_id === instId && r.opinions === 1) && dash2.data.by_state.some(r => r.state === 'Kerala'), 'dashboard lists participating institutions and states');
const dashI = await sa.call('/api/admin/dashboard?institution=' + instId);
ok(dashI.data.totals.cases === 1, 'dashboard filters by institution');
ok((await sa.call('/api/admin/dashboard?state=Maharashtra')).data.totals.cases === 0, 'dashboard filters by state');
const csv2 = await sa.call('/api/admin/indicators.csv');
ok(csv2.data.includes('institution:Test Dental College'), 'indicator export includes institutions');

console.log('worker cannot see admin');
ok((await w.call('/api/admin/dashboard')).status === 403, 'worker blocked from dashboard');
ok((await d.call('/api/persons')).status === 403, 'dentist blocked from the person list');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
