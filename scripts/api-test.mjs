// End-to-end API test: worker → dentist → worker → auditor → admin.
// Usage: BASE=http://localhost:8787 PIN=482913 node scripts/api-test.mjs
import { readFileSync } from 'node:fs';
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
  consents: [{ layer: 'care', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml' },
    { layer: 'photos', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml' },
    { layer: 'research', granted: true, method: 'thumb', capacity: 'has_capacity', notice_language: 'ml' }],
  red_flags: ['ulcer_2wk'],
  screening: { complaints: ['pain', 'denture_problem'], complaint_text: 'താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു, ഇടതുവശത്ത് മൂന്നാഴ്ചയായി ഒരു വ്രണം ഉണ്ട്', ohat: { lips: 0, tongue: 1, gums: 2, saliva: 1, teeth: 2, dentures: 2, cleanliness: 1, pain: 1 },
    gohai: [2, 2, 4, 3, 2, 4, 3, 3, 2, 3, 3, 4], natural_teeth: 6, denture_upper: 'none', denture_lower: 'partial', denture_fit: 'loose',
    context: { diabetes: true, bedbound: false }, medicines: ['Amlodipine 5mg', 'Metformin', 'Aspirin 75'], risks: { tobacco_chew: 'former', areca: 'current', brushing: 'once' } },
};
// location override without reason must fail
const bad = await w.call('/api/visits', { method: 'POST', json: { ...visit, client_uuid: crypto.randomUUID(), person: { ...visit.person, client_uuid: crypto.randomUUID(), ward: '3' } } });
ok(bad.status === 400 && /why the location/i.test(bad.data.error), 'location change without a reason is refused');
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
const nu = await ad.call('/api/admin/users', { method: 'POST', json: { role: 'dentist', name: 'Dr Second', phone: '98' + String(Date.now()).slice(-8), reg_council: 'KSDC', reg_number: 'KSDC-2' } });
ok(nu.status === 200 && /^\d{6}$/.test(nu.data.temporary_pin), 'admin creates a user with a temporary PIN');
const log = await ad.call('/api/admin/audit-log');
ok(log.data.entries.some(e => e.action === 'opinion.sign'), 'access log records the opinion');

console.log('worker cannot see admin');
ok((await w.call('/api/admin/dashboard')).status === 403, 'worker blocked from dashboard');
ok((await d.call('/api/persons')).status === 403, 'dentist blocked from the person list');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
