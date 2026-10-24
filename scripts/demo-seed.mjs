// Generates the DEMO data set: 500 fictional older people across six states, with visits, opinions,
// referrals, follow-ups and audits. Output: demo/identity.sql, demo/clinical.sql, demo/lsgds.sql.
// Deterministic (seeded) so every nightly reset gives the same people. Dates are written relative to the
// moment of reset (datetime('now', '-N minutes')), so the demo always looks current.
// Usage: node scripts/demo-seed.mjs
import { webcrypto as crypto, createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { CONSENT_VERSION } from '../public/shared/consent.js';
import { QUESTIONS, OHAT_ITEMS } from '../public/shared/clinical.js';

export const DEMO_PIN = '246810';
const OUT = new URL('../demo/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- deterministic random ----------
let seed = 20261024;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = n => Array.from({ length: n }, () => ALPHA[Math.floor(rnd() * ALPHA.length)]).join('');
const q = v => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const ago = mins => `datetime('now', '-${Math.max(0, Math.round(mins))} minutes')`;
const when = mins => `datetime('now', '${mins >= 0 ? '-' : '+'}${Math.abs(Math.round(mins))} minutes')`; // past (+) or future (-)
const dateIn = days => `date('now', '${days >= 0 ? '+' : ''}${Math.round(days)} days')`;
const sha = s => createHash('sha256').update(s).digest('hex');
const DAY = 1440;

// ---------- staff ----------
async function pinHash(pin) {
  const salt = new Uint8Array(16).fill(7);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 20000 }, key, 256);
  return { hash: Buffer.from(bits).toString('base64'), salt: Buffer.from(salt).toString('base64') };
}
const CIF = 'Community Innovation Foundation', AGED = 'Association of Geriatric Dentistry (AGeD)';
export const STAFF = [
  { id: 'U-demo-super', role: 'superadmin', name: 'Demo CIF Super Admin', phone: '9000100001', organisation: CIF },
  { id: 'U-demo-admin', role: 'admin', name: 'Demo CIF Programme Admin', phone: '9000100002', organisation: CIF },
  { id: 'U-demo-aged', role: 'clinical_admin', name: 'Demo AGeD Clinical Admin', phone: '9000100003', organisation: AGED },
  { id: 'U-demo-coord', role: 'coordinator', name: 'Demo Coordinator (Ernakulam)', phone: '9000100004', organisation: CIF, state: 'Kerala', district: 'Ernakulam' },
  { id: 'U-demo-w-ekm', role: 'worker', name: 'Demo Worker Sindhu (Ernakulam)', phone: '9000100011', state: 'Kerala', district: 'Ernakulam', lsgd_type: 'municipality', lsgd_name: 'Kalamassery', ward: '12', content_lang: 'ml', ui_lang: 'ml' },
  { id: 'U-demo-w-tsr', role: 'worker', name: 'Demo Worker Bindu (Thrissur)', phone: '9000100012', state: 'Kerala', district: 'Thrissur', lsgd_type: 'grama_panchayat', lsgd_name: 'Kodakara', ward: '5', content_lang: 'ml', ui_lang: 'ml' },
  { id: 'U-demo-w-cbe', role: 'worker', name: 'Demo Worker Selvi (Coimbatore)', phone: '9000100013', state: 'Tamil Nadu', district: 'Coimbatore', lsgd_type: 'town_panchayat', lsgd_name: 'Thondamuthur', ward: '3', content_lang: 'ta', ui_lang: 'ta' },
  { id: 'U-demo-w-mys', role: 'worker', name: 'Demo Worker Lakshmi (Mysuru)', phone: '9000100014', state: 'Karnataka', district: 'Mysuru', lsgd_type: 'grama_panchayat', lsgd_name: 'Varuna', ward: '7', content_lang: 'kn', ui_lang: 'kn' },
  { id: 'U-demo-w-hyd', role: 'worker', name: 'Demo Worker Padma (Rangareddy)', phone: '9000100015', state: 'Telangana', district: 'Rangareddy', lsgd_type: 'municipality', lsgd_name: 'Shamshabad', ward: '9', content_lang: 'te', ui_lang: 'te' },
  { id: 'U-demo-w-vsp', role: 'worker', name: 'Demo Worker Swathi (Visakhapatnam)', phone: '9000100016', state: 'Andhra Pradesh', district: 'Visakhapatnam', lsgd_type: 'grama_panchayat', lsgd_name: 'Bheemunipatnam', ward: '4', content_lang: 'te', ui_lang: 'te' },
  { id: 'U-demo-w-pune', role: 'worker', name: 'Demo Worker Sunita (Pune)', phone: '9000100017', state: 'Maharashtra', district: 'Pune', lsgd_type: 'grama_panchayat', lsgd_name: 'Khed', ward: '2', content_lang: 'mr', ui_lang: 'mr' },
  { id: 'U-demo-d1', role: 'dentist', name: 'Dr Demo Anitha (Prosthodontist)', phone: '9000100021', organisation: AGED, reg_council: 'Kerala State Dental Council', reg_number: 'DEMO-KSDC-101' },
  { id: 'U-demo-d2', role: 'dentist', name: 'Dr Demo Ravi (Oral Medicine)', phone: '9000100022', organisation: AGED, reg_council: 'Tamil Nadu State Dental Council', reg_number: 'DEMO-TNSDC-202' },
  { id: 'U-demo-d3', role: 'dentist', name: 'Dr Demo Farah (Public Health Dentistry)', phone: '9000100023', organisation: AGED, reg_council: 'Maharashtra State Dental Council', reg_number: 'DEMO-MSDC-303' },
  { id: 'U-demo-audit', role: 'auditor', name: 'Dr Demo Auditor', phone: '9000100031', organisation: AGED },
  { id: 'U-demo-dpo', role: 'dpo', name: 'Demo Data Protection Lead', phone: '9000100032', organisation: CIF },
  { id: 'U-demo-research', role: 'researcher', name: 'Demo Researcher', phone: '9000100033', organisation: 'Demo University' },
];
const WORKERS = STAFF.filter(s => s.role === 'worker');
const DENTISTS = STAFF.filter(s => s.role === 'dentist');
const SHARE = { 'U-demo-w-ekm': 110, 'U-demo-w-tsr': 90, 'U-demo-w-cbe': 70, 'U-demo-w-mys': 60, 'U-demo-w-hyd': 55, 'U-demo-w-vsp': 55, 'U-demo-w-pune': 60 };

// ---------- fictional names (common first names + generic family names; combinations are invented) ----------
const NAMES = {
  ml: { F: ['Kamalakshi', 'Saraswathi', 'Ammini', 'Thankamma', 'Mariamma', 'Kunjamma', 'Devaki', 'Lakshmikutty', 'Fathima', 'Annamma', 'Sumathi', 'Rajamma', 'Kousalya', 'Aleyamma'],
    M: ['Gopalan', 'Kuttappan', 'Raghavan', 'Varghese', 'Abdul Rahman', 'Sankaran', 'Krishnan Nair', 'Joseph', 'Velayudhan', 'Narayanan', 'Mathai', 'Kunjiraman', 'Moideen'], S: ['K.', 'P.', 'M.', 'T.', 'V.', 'C.', 'N.'] },
  ta: { F: ['Pappammal', 'Rukmani', 'Valliammai', 'Muniyammal', 'Saroja', 'Kamatchi', 'Pushpa', 'Meenakshi', 'Chellammal', 'Ponnammal'],
    M: ['Murugesan', 'Ramasamy', 'Palanisamy', 'Kandasamy', 'Subramani', 'Arumugam', 'Velusamy', 'Chinnasamy', 'Karuppusamy'], S: ['R.', 'S.', 'K.', 'P.', 'M.'] },
  kn: { F: ['Gowramma', 'Lakshmamma', 'Shantamma', 'Nagamma', 'Parvathamma', 'Siddamma', 'Jayamma', 'Kempamma'],
    M: ['Basavaraju', 'Siddaiah', 'Ningappa', 'Mahadevappa', 'Puttaswamy', 'Chikkanna', 'Rangaswamy', 'Shivanna'], S: ['B.', 'H.', 'K.', 'M.', 'S.'] },
  te: { F: ['Venkatamma', 'Lakshmamma', 'Satyavathi', 'Ramulamma', 'Anasuya', 'Kanakamma', 'Sujatha', 'Pydamma', 'Yashoda'],
    M: ['Venkataiah', 'Narasimha Rao', 'Ramaiah', 'Satyanarayana', 'Yadagiri', 'Appa Rao', 'Pentaiah', 'Mallaiah', 'Suryanarayana'], S: ['G.', 'K.', 'P.', 'Ch.', 'V.'] },
  mr: { F: ['Shantabai', 'Sakhubai', 'Indubai', 'Kamalabai', 'Rukhmini', 'Parvatibai', 'Sushila', 'Mandabai'],
    M: ['Dnyaneshwar', 'Pandurang', 'Vitthal', 'Baburao', 'Tukaram', 'Shankarrao', 'Dattatray', 'Marutirao'], S: ['Jadhav', 'Pawar', 'Shinde', 'Kale', 'More'] },
};
const RELATIONS = ['Son', 'Daughter', 'Daughter-in-law', 'Spouse', 'Grandson', 'Neighbour'];

// ---------- complaint texts in each language, with English translations (seeded into the translation cache) ----------
const COMPLAINT_TEXTS = {
  ml: [['താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു, ചവയ്ക്കാൻ പറ്റുന്നില്ല', 'The lower denture is loose; cannot chew.'],
    ['വലതുവശത്ത് താഴെ പല്ലുവേദന, രാത്രി ഉറങ്ങാൻ പറ്റുന്നില്ല', 'Tooth pain on the lower right side; cannot sleep at night.'],
    ['നാവിന്റെ വശത്ത് ഒരു മാസമായി ഉണങ്ങാത്ത ഒരു വ്രണം', 'A sore on the side of the tongue that has not healed for a month.'],
    ['ബ്രഷ് ചെയ്യുമ്പോൾ മോണയിൽ നിന്ന് രക്തം വരുന്നു', 'Gums bleed when brushing.'],
    ['വായ എപ്പോഴും വരണ്ടിരിക്കുന്നു, ഭക്ഷണം ഇറക്കാൻ ബുദ്ധിമുട്ട്', 'Mouth is always dry; difficulty swallowing food.'],
    ['പല്ലുകൾ മിക്കതും പോയി, പല്ല്സെറ്റ് വേണം', 'Most teeth are gone; would like a denture.']],
  ta: [['கீழ் பல் செட் தளர்வாக உள்ளது, சாப்பிட முடியவில்லை', 'The lower denture is loose; cannot eat.'],
    ['இடது பக்கம் பல் வலி, சூடான உணவு பட்டால் அதிகம்', 'Tooth pain on the left side, worse with hot food.'],
    ['கன்னத்தின் உள்ளே வெள்ளை நிறப் படலம் உள்ளது', 'There is a white patch inside the cheek.'],
    ['ஈறுகளில் இருந்து ரத்தம் வருகிறது, வாய் நாற்றம்', 'Bleeding from the gums and bad breath.']],
  kn: [['ಕೆಳಗಿನ ಹಲ್ಲಿನ ಸೆಟ್ ಸಡಿಲವಾಗಿದೆ, ನೋವಾಗುತ್ತದೆ', 'The lower denture is loose and painful.'],
    ['ಬಲ ಬದಿಯಲ್ಲಿ ಹಲ್ಲು ನೋವು, ತಣ್ಣೀರು ಕುಡಿದರೆ ಜುಮ್ಮೆನ್ನುತ್ತದೆ', 'Tooth pain on the right side; cold water causes a shooting sensation.'],
    ['ಹಲ್ಲುಗಳು ಅಲುಗಾಡುತ್ತಿವೆ, ಅಗಿಯಲು ಕಷ್ಟ', 'Teeth are loose; difficult to chew.']],
  te: [['కింది కట్టుడు పళ్ళు వదులుగా ఉన్నాయి', 'The lower dentures are loose.'],
    ['పళ్ళ నొప్పి, చెంప వాపు రెండు రోజులుగా', 'Tooth pain and swelling of the cheek for two days.'],
    ['చిగుళ్ళ నుండి రక్తం, నోటి దుర్వాసన', 'Bleeding from the gums and bad breath.'],
    ['పళ్ళు చాలా వరకు ఊడిపోయాయి, కట్టుడు పళ్ళు కావాలి', 'Most teeth have fallen out; wants dentures.']],
  mr: [['खालची कवळी सैल झाली आहे, चावता येत नाही', 'The lower denture has become loose; cannot chew.'],
    ['गालाच्या आतून पांढरा चट्टा आहे, मिश्री लावतात', 'There is a white patch inside the cheek; uses mishri.'],
    ['दात दुखतात, थंड पाणी लागले की कळ येते', 'Teeth hurt; cold water causes a sharp pain.']],
};

// ---------- opinion templates (English; Malayalam versions seeded into the translation cache) ----------
const OPINIONS = {
  healthy: { impression: 'Mouth looks healthy for age. No urgent problem seen.', advice: 'Brush twice a day with a soft brush and fluoride toothpaste. Clean the tongue daily.',
    care_plan: 'Routine check in 12 months.', months: 12 },
  caries: { impression: 'Decay in some back teeth and a broken root on the lower right.', advice: 'Avoid sugary tea and sweets between meals. Use fluoride toothpaste twice a day.',
    care_plan: 'Fillings and removal of the broken root at a dental clinic.', months: 6, referral: 'general_dental' },
  denture: { impression: 'Lower denture is loose and has a sore spot underneath.', advice: 'Remove the denture at night and clean it with a brush and water. Do not wear it while the sore is painful.',
    care_plan: 'New lower denture or reline at a dental college.', months: 6, referral: 'prosthodontic' },
  gums: { impression: 'Gum disease with tartar and bleeding gums. Two teeth are loose.', advice: 'Brush gently twice a day, including the gum line. Rinse with warm salt water.',
    care_plan: 'Cleaning (scaling) and gum treatment at a dental clinic.', months: 6, referral: 'periodontal' },
  lesion: { impression: 'Ulcer or patch that needs examination by a specialist to rule out cancer.', advice: 'Stop tobacco and areca nut. Go for the examination within one week.',
    care_plan: 'Examination at an oral medicine department, and biopsy if needed.', months: 3, referral: 'oral_medicine', urgency: 'within_7d' },
  drymouth: { impression: 'Dry mouth, probably from medicines, with early decay at the gum line.', advice: 'Sip water often. Avoid dry snacks between meals. Use fluoride toothpaste.',
    care_plan: 'Ask the doctor whether a medicine can be changed. Dental check in 6 months.', months: 6 },
  bedbound: { impression: 'Bedbound person with plaque on teeth and coated tongue.', advice: 'Caregiver should clean the teeth and tongue twice a day with a soft brush, with the person sitting up.',
    care_plan: 'Home-based dental visit for cleaning.', months: 6, referral: 'domiciliary' },
};
const ML = {
  'Mouth looks healthy for age. No urgent problem seen.': 'പ്രായത്തിനനുസരിച്ച് വായ ആരോഗ്യമുള്ളതാണ്. അടിയന്തര പ്രശ്നമൊന്നും കാണുന്നില്ല.',
  'Brush twice a day with a soft brush and fluoride toothpaste. Clean the tongue daily.': 'മൃദുവായ ബ്രഷും ഫ്ലൂറൈഡ് ടൂത്ത്പേസ്റ്റും ഉപയോഗിച്ച് ദിവസം രണ്ടുനേരം പല്ല് തേക്കുക. ദിവസവും നാവ് വൃത്തിയാക്കുക.',
  'Routine check in 12 months.': '12 മാസത്തിനുശേഷം സാധാരണ പരിശോധന.',
  'Decay in some back teeth and a broken root on the lower right.': 'പിന്നിലെ ചില പല്ലുകളിൽ കേടും താഴെ വലതുവശത്ത് ഒരു പൊട്ടിയ വേരും ഉണ്ട്.',
  'Avoid sugary tea and sweets between meals. Use fluoride toothpaste twice a day.': 'ഭക്ഷണത്തിനിടയിൽ മധുരമുള്ള ചായയും പലഹാരങ്ങളും ഒഴിവാക്കുക. ദിവസം രണ്ടുനേരം ഫ്ലൂറൈഡ് ടൂത്ത്പേസ്റ്റ് ഉപയോഗിക്കുക.',
  'Fillings and removal of the broken root at a dental clinic.': 'ദന്ത ക്ലിനിക്കിൽ പല്ല് അടയ്ക്കലും പൊട്ടിയ വേര് എടുത്തുമാറ്റലും.',
  'Lower denture is loose and has a sore spot underneath.': 'താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു; അതിനടിയിൽ ഒരു വ്രണമുണ്ട്.',
  'Remove the denture at night and clean it with a brush and water. Do not wear it while the sore is painful.': 'രാത്രി പല്ല്സെറ്റ് ഊരിവച്ച് ബ്രഷും വെള്ളവും ഉപയോഗിച്ച് വൃത്തിയാക്കുക. വ്രണത്തിന് വേദനയുള്ളപ്പോൾ ഇത് ഉപയോഗിക്കരുത്.',
  'New lower denture or reline at a dental college.': 'ഡെന്റൽ കോളേജിൽ പുതിയ താഴത്തെ പല്ല്സെറ്റ് അല്ലെങ്കിൽ റീലൈൻ.',
  'Gum disease with tartar and bleeding gums. Two teeth are loose.': 'കക്കയും മോണയിൽ നിന്നുള്ള രക്തസ്രാവവുമുള്ള മോണരോഗം. രണ്ട് പല്ലുകൾ ഇളകുന്നു.',
  'Brush gently twice a day, including the gum line. Rinse with warm salt water.': 'മോണയുടെ അരികുൾപ്പെടെ ദിവസം രണ്ടുനേരം മൃദുവായി ബ്രഷ് ചെയ്യുക. ചെറുചൂടുള്ള ഉപ്പുവെള്ളം കൊണ്ട് വായ കഴുകുക.',
  'Cleaning (scaling) and gum treatment at a dental clinic.': 'ദന്ത ക്ലിനിക്കിൽ ക്ലീനിംഗും (സ്കെയിലിംഗ്) മോണ ചികിത്സയും.',
  'Ulcer or patch that needs examination by a specialist to rule out cancer.': 'കാൻസർ അല്ലെന്ന് ഉറപ്പാക്കാൻ വിദഗ്ധ പരിശോധന ആവശ്യമുള്ള വ്രണം അല്ലെങ്കിൽ പാട്.',
  'Stop tobacco and areca nut. Go for the examination within one week.': 'പുകയിലയും അടയ്ക്കയും നിർത്തുക. ഒരാഴ്ചയ്ക്കുള്ളിൽ പരിശോധനയ്ക്ക് പോകുക.',
  'Examination at an oral medicine department, and biopsy if needed.': 'ഓറൽ മെഡിസിൻ വിഭാഗത്തിൽ പരിശോധന; ആവശ്യമെങ്കിൽ ബയോപ്സി.',
  'Dry mouth, probably from medicines, with early decay at the gum line.': 'മരുന്നുകൾ കാരണമാകാവുന്ന വായ് വരൾച്ച; മോണയുടെ അരികിൽ തുടക്കത്തിലുള്ള കേട്.',
  'Sip water often. Avoid dry snacks between meals. Use fluoride toothpaste.': 'ഇടയ്ക്കിടെ കുറേശ്ശെ വെള്ളം കുടിക്കുക. ഭക്ഷണത്തിനിടയിൽ ഉണങ്ങിയ പലഹാരങ്ങൾ ഒഴിവാക്കുക. ഫ്ലൂറൈഡ് ടൂത്ത്പേസ്റ്റ് ഉപയോഗിക്കുക.',
  'Ask the doctor whether a medicine can be changed. Dental check in 6 months.': 'ഏതെങ്കിലും മരുന്ന് മാറ്റാനാകുമോ എന്ന് ഡോക്ടറോട് ചോദിക്കുക. 6 മാസത്തിനുശേഷം ദന്ത പരിശോധന.',
  'Bedbound person with plaque on teeth and coated tongue.': 'കിടപ്പിലായ വ്യക്തി; പല്ലിൽ പ്ലാക്കും നാവിൽ ആവരണവും.',
  'Caregiver should clean the teeth and tongue twice a day with a soft brush, with the person sitting up.': 'വ്യക്തിയെ ഇരുത്തിയശേഷം പരിചാരകർ ദിവസം രണ്ടുനേരം മൃദുവായ ബ്രഷ് കൊണ്ട് പല്ലും നാവും വൃത്തിയാക്കണം.',
  'Home-based dental visit for cleaning.': 'വൃത്തിയാക്കലിനായി വീട്ടിലെത്തിയുള്ള ദന്ത പരിശോധന.',
};
const ML_OPINION = { // a few opinions written directly in Malayalam by a dentist, with English for the cache
  impression: ['താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു. മോണയിൽ ചെറിയ വ്രണം.', 'The lower denture is loose. Small sore on the gum.'],
  advice: ['രാത്രി പല്ല്സെറ്റ് ഊരിവയ്ക്കുക. വ്രണം ഉണങ്ങുന്നതുവരെ ഉപയോഗിക്കരുത്.', 'Remove the denture at night. Do not use it until the sore heals.'],
  care_plan: ['ഡെന്റൽ കോളേജിൽ റീലൈൻ ചെയ്യുക.', 'Get a reline done at the dental college.'],
};
const MEDICINES = ['Amlodipine 5mg', 'Metformin 500mg', 'Aspirin 75mg', 'Atorvastatin 10mg', 'Telmisartan 40mg', 'Amitriptyline 10mg', 'Furosemide 40mg', 'Clopidogrel 75mg',
  'Alendronate 70mg weekly', 'Levothyroxine 50mcg', 'Glimepiride 1mg', 'Pantoprazole 40mg', 'Losartan 50mg', 'Prednisolone 5mg', 'Calcium + Vitamin D'];
const STATES_LANG = { Kerala: 'ml', 'Tamil Nadu': 'ta', Karnataka: 'kn', Telangana: 'te', 'Andhra Pradesh': 'te', Maharashtra: 'mr' };

// ---------- build ----------
const idSql = [], clSql = [], translations = new Map();
const addTx = (src, tgt, text, out, engine = 'demo-reviewed') => translations.set(sha(`${src}|${tgt}|${text}`), [src, tgt, out, engine]);
for (const [en, ml] of Object.entries(ML)) addTx('en', 'ml', en, ml);
for (const [ml, en] of Object.values(ML_OPINION)) addTx('ml', 'en', ml, en);
for (const [lang, list] of Object.entries(COMPLAINT_TEXTS)) for (const [txt, en] of list) addTx(lang, 'en', txt, en);

idSql.push('-- DEMO identity data (fictional). Regenerate with: node scripts/demo-seed.mjs',
  'DELETE FROM sessions;', 'DELETE FROM consents;', 'DELETE FROM persons;', 'DELETE FROM users;');
const { hash, salt } = await pinHash(DEMO_PIN);
for (const s of STAFF) {
  idSql.push(`INSERT INTO users (id, role, name, phone, pin_hash, pin_salt, must_change, organisation, state, district, lsgd_type, lsgd_name, ward, reg_council, reg_number, reg_verified_at, ui_lang, content_lang, trained_at) VALUES (${[
    s.id, s.role, s.name, s.phone, hash, salt, 0, s.organisation, s.state, s.district, s.lsgd_type, s.lsgd_name, s.ward, s.reg_council, s.reg_number,
    s.reg_number ? '2026-09-01' : null, s.ui_lang || 'en', s.content_lang || 'en', s.role === 'worker' ? '2026-09-15' : null].map(q).join(', ')});`);
}

clSql.push('-- DEMO clinical data (fictional). Regenerate with: node scripts/demo-seed.mjs',
  ...['audits', 'referrals', 'opinions', 'info_requests', 'images', 'followups', 'screenings', 'cases', 'questionnaires', 'audit_log', 'referral_centres', 'kb_items', 'translations'].map(t => `DELETE FROM ${t};`));
clSql.push(`INSERT OR REPLACE INTO settings (key, value) VALUES ('org_legal_name', ${q(CIF)}), ('org_address', '1st Floor, Krishna Bhat Towers, Pullepady, Ernakulam, Kerala, India'),
  ('grievance_name', 'Dr. Praveen G Pai'), ('grievance_phone', '+91-8129060055'), ('grievance_email', 'praveengpai@gmail.com'), ('retention_years', '5'), ('grievance_days', '30'),
  ('claim_minutes', '30'), ('sla_urgent_hours', '24'), ('sla_routine_hours', '72'), ('audit_sample_percent', '10'), ('small_cell_threshold', '5');`);
const CENTRES = [
  ['RC-demo-1', 'Government Dental College (demo listing), Ernakulam', 'Dental college', 'All dental treatment, dentures, oral medicine, biopsy', 'Ernakulam', 'Mon–Sat 8am–1pm', 'Free'],
  ['RC-demo-2', 'District Hospital Dental Unit (demo listing), Thrissur', 'District hospital', 'Extraction, filling, scaling, dentures', 'Thrissur', 'Mon–Sat 9am–4pm', 'Free'],
  ['RC-demo-3', 'PHC Dental Clinic (demo listing), Kalamassery', 'PHC', 'Extraction, filling, scaling', 'Ernakulam', 'Tue and Fri 9am–1pm', 'Free'],
  ['RC-demo-4', 'Government Dental College (demo listing), Coimbatore', 'Dental college', 'All dental treatment, oral medicine', 'Coimbatore', 'Mon–Sat 8am–2pm', 'Free'],
  ['RC-demo-5', 'Dental College Hospital (demo listing), Mysuru', 'Dental college', 'Dentures, gum treatment, oral surgery', 'Mysuru', 'Mon–Sat 9am–4pm', 'Subsidised'],
  ['RC-demo-6', 'Area Hospital Dental Wing (demo listing), Visakhapatnam', 'Area hospital', 'Extraction, dentures', 'Visakhapatnam', 'Mon–Sat 9am–2pm', 'Free'],
  ['RC-demo-7', 'Government Dental College (demo listing), Hyderabad', 'Dental college', 'All dental treatment', 'Rangareddy', 'Mon–Sat 8am–1pm', 'Free'],
  ['RC-demo-8', 'Rural Hospital Dental OPD (demo listing), Khed', 'Rural hospital', 'Extraction, filling, oral cancer screening', 'Pune', 'Mon, Wed, Fri 10am–2pm', 'Free'],
];
for (const c of CENTRES) clSql.push(`INSERT INTO referral_centres (id, name, kind, services, district, timings, cost_category, accessibility, phone) VALUES (${[...c, 'Ramp, wheelchair', '0000 000 000 (demo)'].map(q).join(', ')});`);
const KB = [
  ['KB-demo-1', 'Oral health — WHO fact sheet', 'വായയുടെ ആരോഗ്യം — WHO', 'leaflet', 'https://www.who.int/news-room/fact-sheets/detail/oral-health', 'en', 'worker', 'prevention', 1],
  ['KB-demo-2', 'Cleaning dentures every day (demo leaflet)', 'പല്ല്സെറ്റ് ദിവസവും വൃത്തിയാക്കാം (ഡെമോ)', 'leaflet', 'https://www.who.int/news-room/fact-sheets/detail/oral-health', 'ml', 'patient', 'denture', 1],
  ['KB-demo-3', 'Mouth care for bedbound people (demo leaflet)', 'കിടപ്പിലായവരുടെ വായ പരിചരണം (ഡെമോ)', 'leaflet', 'https://www.who.int/news-room/fact-sheets/detail/oral-health', 'ml', 'caregiver', 'bedbound', 1],
  ['KB-demo-4', 'Tobacco and mouth cancer warning signs (demo, awaiting approval)', null, 'leaflet', 'https://www.who.int/news-room/fact-sheets/detail/oral-health', 'en', 'patient', 'tobacco,cancer', 0],
];
for (const k of KB) clSql.push(`INSERT INTO kb_items (id, title, title_ml, kind, url, language, audience, tags, approved_by, approved_at) VALUES (${[...k.slice(0, 8)].map(q).join(', ')}, ${k[8] ? "'U-demo-aged', datetime('now', '-30 days')" : 'NULL, NULL'});`);

// questions per step, in the stored shapes
const habitQ = QUESTIONS.filter(x => x.step === 'habits'), healthQ = QUESTIONS.filter(x => x.step === 'health');
const IMG_KEYS = ['demo/mouth-front.jpg', 'demo/mouth-upper.jpg', 'demo/mouth-lower.jpg', 'demo/mouth-lesion.jpg', 'demo/denture.jpg'];
let personN = 0, caseN = 0, pending = 0;
const stats = { persons: 0, cases: 0, urgent: 0, opinions: 0, referrals: 0, waiting: 0 };

function screeningFor(p, scenario, visitMins) {
  const age = 2026 - p.birth_year;
  const teeth = scenario === 'bedbound' || chance(0.25) ? int(0, 6) : Math.max(0, Math.min(32, Math.round(28 - (age - 60) * 0.5 + (rnd() - 0.5) * 12)));
  const hasDenture = teeth < 12 && chance(0.7);
  const ohat = {};
  for (const it of OHAT_ITEMS) ohat[it.key] = chance(0.6) ? 0 : chance(0.75) ? 1 : 2;
  if (scenario === 'healthy') for (const k in ohat) ohat[k] = chance(0.85) ? 0 : 1;
  if (scenario === 'denture') { ohat.dentures = 2; ohat.gums = Math.max(ohat.gums, 1); }
  if (scenario === 'gums') { ohat.gums = 2; ohat.cleanliness = 2; }
  if (scenario === 'lesion') { ohat.tongue = 2; ohat.gums = Math.max(ohat.gums, 1); }
  if (scenario === 'drymouth') ohat.saliva = 2;
  if (scenario === 'caries') { ohat.teeth = 2; ohat.pain = 1; }
  if (!hasDenture) ohat.dentures = 0;
  const gohai = Array.from({ length: 12 }, (_, i) => {
    const good = scenario === 'healthy' ? 0.75 : 0.35;
    const v = chance(good) ? int(4, 5) : int(1, 3);
    return [2, 4, 6].includes(i) ? 6 - v : v; // positive items 3, 5, 7
  });
  const tobaccoBias = { Maharashtra: 0.35, Karnataka: 0.25, 'Andhra Pradesh': 0.25, Telangana: 0.25, 'Tamil Nadu': 0.2, Kerala: 0.15 }[p.state];
  const risks = {};
  for (const h of habitQ) {
    if (h.states?.length && !h.states.includes(p.state)) continue;
    if (h.type === 'habit') {
      const base = h.key === 'alcohol' ? 0.12 : h.key === 'areca' ? tobaccoBias + 0.1 : ['mishri', 'kharra_mawa'].includes(h.key) ? 0.3 : h.key === 'khaini' ? 0.05 : tobaccoBias;
      const lesionBoost = scenario === 'lesion' && ['tobacco_chew', 'areca', 'mishri'].includes(h.key) ? 0.5 : 0;
      risks[h.key] = chance(base + lesionBoost) ? 'current' : chance(0.15) ? 'former' : 'never';
    } else if (h.type === 'number') risks[h.key] = int(0, 6);
    else if (h.type === 'yesno') risks[h.key] = chance(0.55);
    else if (h.type === 'choice') risks[h.key] = pick(h.options.filter(o => o.active !== false)).key;
  }
  const context = {};
  for (const h of healthQ) context[h.key] = h.key === 'bedbound' ? scenario === 'bedbound' : h.key === 'diabetes' ? chance(0.35) : h.key === 'dementia' ? chance(0.12) : chance(0.1);
  const meds = [...new Set(Array.from({ length: int(0, 4) }, () => pick(MEDICINES)))];
  if (scenario === 'drymouth' && !meds.includes('Amitriptyline 10mg')) meds.push('Amitriptyline 10mg');
  const flags = [];
  const FL = { dry_mouth: ['amitriptyline', 'furosemide'], bleeding: ['aspirin', 'clopidogrel'], gum_overgrowth: ['amlodipine'], jaw_osteonecrosis: ['alendronate'], steroid_immuno: ['prednisolone'] };
  for (const m of meds) for (const [flag, names] of Object.entries(FL)) if (names.some(n => m.toLowerCase().includes(n))) flags.push({ medicine: m, flag });
  const complaints = { healthy: ['checkup'], caries: ['pain', 'sensitivity'], denture: ['denture_problem', 'chewing'], gums: ['bleeding_gums', 'loose_teeth', 'bad_breath'],
    lesion: ['sore_ulcer'], drymouth: ['dry_mouth', 'swallowing'], bedbound: ['bad_breath'] }[scenario];
  const lang = STATES_LANG[p.state];
  const txtPool = COMPLAINT_TEXTS[lang] || [];
  const ct = scenario !== 'healthy' && chance(0.6) && txtPool.length ? pick(txtPool)[0] : null;
  const extra = hasDenture ? { denture_out_night: chance(0.4), denture_cleaning: pick(['brush_soap_water', 'brush_paste', 'rinse_only', 'not_cleaned', 'soak']) } : {};
  const ohatTotal = Object.values(ohat).reduce((a, b) => a + b, 0);
  const gTotal = gohai.reduce((s, a, i) => s + ([2, 4, 6].includes(i) ? 6 - a : a), 0);
  return { ohat, ohatTotal, gohai, gTotal, teeth, hasDenture, risks, context, meds, flags, complaints, ct, lang, extra,
    denture_upper: hasDenture ? pick(['complete', 'partial']) : 'none', denture_lower: hasDenture ? pick(['complete', 'partial', 'none']) : 'none',
    denture_fit: hasDenture ? (scenario === 'denture' ? pick(['loose', 'painful']) : pick(['good', 'good', 'loose'])) : null };
}

function addCase(p, worker, minsAgo, visitType, scenario, opts = {}) {
  caseN++;
  const id = `C-DEMO-${String(caseN).padStart(4, '0')}`;
  const s = screeningFor(p, scenario, minsAgo);
  const redFlags = scenario === 'lesion' ? [chance(0.6) ? 'ulcer_2wk' : 'patch'] : opts.urgentOther ? [pick(['facial_swelling', 'bleeding', 'cannot_eat'])] : [];
  const urgency = redFlags.length ? 'urgent' : 'routine';
  const ageBand = (() => { const a = 2026 - p.birth_year; if (a >= 90) return '90+'; const lo = Math.floor(a / 5) * 5; return `${lo}-${lo + 4}`; })();
  let status = opts.status || 'opinion';
  const dentist = pick(DENTISTS);
  const responseMins = urgency === 'urgent' ? int(60, 20 * 60) : int(4 * 60, 70 * 60);
  const opinionMins = Math.max(0, minsAgo - responseMins);
  if (status === 'opinion' && opinionMins <= 0) status = 'submitted';
  const sampled = status === 'opinion' && chance(0.1) ? 1 : 0;
  clSql.push(`INSERT INTO cases (id, person_id, worker_id, visit_type, status, urgency, red_flags, age_band, sex, district, lsgd_type, bedbound, created_at, submitted_at, opinion_at, sampled_for_audit, escalated_at) VALUES (${[
    id, p.id, worker.id, visitType, status, urgency, JSON.stringify(redFlags), ageBand, p.sex, p.district, p.lsgd_type, scenario === 'bedbound' ? 1 : 0].map(q).join(', ')}, ${ago(minsAgo)}, ${ago(minsAgo)}, ${status === 'opinion' ? ago(opinionMins) : 'NULL'}, ${sampled}, ${status === 'submitted' && minsAgo > (urgency === 'urgent' ? 24 : 72) * 60 ? ago(minsAgo - 72 * 60) : 'NULL'});`);
  clSql.push(`INSERT INTO screenings (case_id, ohat, ohat_total, gohai, gohai_total, natural_teeth, functional_dentition, denture_upper, denture_lower, denture_fit, complaints, complaint_text, complaint_lang, risks, context, medicines, medicine_flags, worker_notes, worker_notes_lang, extra, questionnaire_version) VALUES (${[
    id, JSON.stringify(s.ohat), s.ohatTotal, chance(0.92) ? JSON.stringify(s.gohai) : null, null, s.teeth, s.teeth >= 20 ? 1 : 0, s.denture_upper, s.denture_lower, s.denture_fit,
    JSON.stringify(s.complaints), s.ct, s.ct ? s.lang : null, JSON.stringify(s.risks), JSON.stringify(s.context), JSON.stringify(s.meds), JSON.stringify(s.flags),
    scenario === 'bedbound' ? 'Daughter-in-law looks after her; she cannot sit up for long.' : null, scenario === 'bedbound' ? 'en' : null, JSON.stringify(s.extra), 1].map(q).join(', ')});`);
  // fix gohai_total for rows that have GOHAI
  clSql.push(`UPDATE screenings SET gohai_total = ${s.gTotal} WHERE case_id = '${id}' AND gohai IS NOT NULL;`);
  if (p.photos && !opts.noPhotos) {
    const views = scenario === 'lesion' ? [['front', 0], ['lower', 2], ['lesion', 3]] : s.hasDenture ? [['front', 0], ['upper', 1], ['denture', 4]] : [['front', 0], ['upper', 1], ['lower', 2]];
    views.forEach(([view, k], i) => clSql.push(`INSERT INTO images (id, case_id, view, media_key, width, height, bytes, quality, created_at) VALUES ('IM-${id}-${i}', '${id}', '${view}', '${IMG_KEYS[k]}', 1280, 960, 30000, 0.9, ${ago(minsAgo)});`));
  }
  stats.cases++; if (urgency === 'urgent') stats.urgent++;
  if (status === 'submitted') stats.waiting++;
  if (status === 'info_requested') {
    clSql.push(`INSERT INTO info_requests (id, case_id, dentist_id, message, message_lang, created_at) VALUES ('IR-${id}', '${id}', '${dentist.id}', 'Please take a clear photo of the lower gums with the denture removed. Does it hurt when she eats?', 'en', ${ago(minsAgo - 120)});`);
  }
  if (status !== 'opinion') return { id, s, scenario };
  const o = OPINIONS[scenario];
  const inMl = p.state === 'Kerala' && scenario === 'denture' && chance(0.4);
  const t = inMl ? { impression: ML_OPINION.impression[0], advice: ML_OPINION.advice[0], care_plan: ML_OPINION.care_plan[0] } : o;
  const ref = !!o.referral && chance({ caries: 0.5, gums: 0.45, denture: 0.7, lesion: 1, bedbound: 0.6 }[scenario] ?? 0);
  const kb = scenario === 'denture' ? ['KB-demo-2'] : scenario === 'bedbound' ? ['KB-demo-3'] : [];
  const verify = code(8);
  const oid = `OP-${id}`;
  clSql.push(`INSERT INTO opinions (id, case_id, version, dentist_id, findings, impression, advice, care_plan, text_lang, followup_months, referral_needed, referral_type, referral_urgency, referral_message, kb_items, verify_code, signed_at) VALUES (${[
    oid, id, 1, dentist.id, `OHAT ${s.ohatTotal}/16. ${s.teeth} natural teeth.`, t.impression, t.advice, t.care_plan, inMl ? 'ml' : 'en', o.months, ref ? 1 : 0, o.referral || null,
    ref ? (o.urgency || 'within_30d') : null, ref ? 'Please examine and treat as needed. Screening by the Vayosmitham programme.' : null, JSON.stringify(kb), verify].map(q).join(', ')}, ${ago(opinionMins)});`);
  stats.opinions++;
  if (sampled && chance(0.6)) clSql.push(`INSERT INTO audits (id, opinion_id, auditor_id, rating, safe, notes, created_at) VALUES ('AU-${id}', '${oid}', 'U-demo-audit', ${int(3, 5)}, 1, 'Appropriate advice and referral.', ${ago(Math.max(0, opinionMins - 2 * DAY))});`);
  if (ref) {
    stats.referrals++;
    const daysSince = opinionMins / DAY;
    const st = daysSince < 10 ? 'pending' : chance(0.62) ? 'reached' : chance(0.6) ? 'not_reached' : 'pending';
    const centre = pick(CENTRES.filter(c => c[4] === p.district).concat(CENTRES.slice(0, 1)))[0];
    clSql.push(`INSERT INTO referrals (id, case_id, centre_id, status, reached_date, treatment, barrier, recorded_by, recorded_at) VALUES (${[
      `RF-${id}`, id, centre, st, null, st === 'reached' ? pick(['Extraction done', 'New denture made', 'Scaling done', 'Biopsy done — benign', 'Fillings done']) : null,
      st === 'not_reached' ? pick(['No one to accompany', 'Travel cost', 'Feeling better', 'Long wait at hospital']) : null, st === 'pending' ? null : worker.id].map(q).join(', ')}, ${st === 'pending' ? 'NULL' : ago(Math.max(0, opinionMins - 7 * DAY))});`);
    if (st === 'reached') clSql.push(`UPDATE referrals SET reached_date = date(${ago(Math.max(0, opinionMins - 6 * DAY))}) WHERE id = 'RF-${id}';`);
  }
  return { id, s, scenario, opinionMins, months: o.months };
}

const SCEN = [['healthy', 18], ['caries', 22], ['denture', 22], ['gums', 18], ['lesion', 7], ['drymouth', 7], ['bedbound', 6]];
const scenario = () => { let r = rnd() * 100; for (const [k, w] of SCEN) { if ((r -= w) < 0) return k; } return 'healthy'; };

for (const w of WORKERS) {
  const lang = STATES_LANG[w.state];
  for (let i = 0; i < SHARE[w.id]; i++) {
    personN++;
    const sex = chance(0.58) ? 'F' : 'M';
    const nm = NAMES[lang];
    const name = lang === 'mr' ? `${pick(nm[sex])} ${pick(nm.S)}` : `${pick(nm[sex])} ${pick(nm.S)}`;
    const p = { id: `VS-D${String(personN).padStart(5, '0')}`, sex, birth_year: 2026 - int(60, 94), state: w.state, district: w.district, lsgd_type: w.lsgd_type, lsgd_name: w.lsgd_name, photos: chance(0.75) };
    const caregiver = chance(0.55);
    const status = chance(0.03) ? 'died' : chance(0.03) ? 'migrated' : chance(0.02) ? 'lost' : 'active';
    const enrolMins = chance(0.065) ? int(90, 3 * DAY) : int(5 * DAY, 360 * DAY);
    idSql.push(`INSERT INTO persons (id, name, sex, birth_year, phone, address, pincode, state, district, lsgd_type, lsgd_name, ward, caregiver_name, caregiver_phone, caregiver_relation, worker_id, status, status_reason, created_at, updated_at) VALUES (${[
      p.id, name, sex, p.birth_year, chance(0.6) ? '90000' + String(int(10000, 99999)) : null, `House ${int(1, 400)}, Ward ${int(1, 20)} (demo address)`, null, p.state, p.district, p.lsgd_type, p.lsgd_name, String(int(1, 20)),
      caregiver ? `${pick(nm.F)} (demo)` : null, caregiver ? '90000' + String(int(10000, 99999)) : null, caregiver ? pick(RELATIONS) : null, w.id, status,
      status === 'died' ? 'Died at home (demo)' : status === 'migrated' ? 'Moved to live with son in another district' : status === 'lost' ? 'Not found at three visits' : null].map(q).join(', ')}, ${ago(enrolMins)}, ${ago(enrolMins)});`);
    const capacity = chance(0.1) ? 'doubtful' : 'has_capacity';
    const method = capacity === 'has_capacity' ? pick(['signature', 'signature', 'thumb', 'verbal_witnessed']) : 'caregiver_assent';
    const layers = { care: true, photos: p.photos, research: chance(0.7), messaging: chance(0.5) };
    for (const [layer, granted] of Object.entries(layers)) {
      idSql.push(`INSERT INTO consents (id, person_id, layer, granted, method, witness_name, capacity, assent_by, assent_relation, decider_type, copy_offered, notice_version, notice_language, recorded_by, recorded_at) VALUES (${[
        `CN-${p.id}-${layer}`, p.id, layer, granted ? 1 : 0, method, method === 'verbal_witnessed' ? 'Neighbour (demo)' : null, capacity, method === 'caregiver_assent' ? `${pick(nm.F)} (demo)` : null,
        method === 'caregiver_assent' ? pick(RELATIONS) : null, method === 'caregiver_assent' ? 'family' : null, 1, CONSENT_VERSION, lang, w.id].map(q).join(', ')}, ${ago(enrolMins)});`);
    }
    stats.persons++;
    // baseline visit; recent ones are still waiting for a dentist
    const sc = scenario();
    const waiting = enrolMins < 3 * DAY;
    const infoReq = !waiting && enrolMins < 40 * DAY && chance(0.12);
    if (waiting) pending++;
    const base = addCase(p, w, enrolMins, 'baseline', sc, { status: waiting ? 'submitted' : infoReq ? 'info_requested' : 'opinion', urgentOther: sc !== 'lesion' && chance(0.03) });
    // follow-up visit(s)
    let last = base;
    if (base.opinionMins && status === 'active') {
      const dueMins = base.opinionMins - base.months * 30 * DAY;
      if (dueMins > 2 * DAY && chance(0.93)) {
        const fsc = sc === 'lesion' ? 'caries' : chance(0.5) ? 'healthy' : sc;
        last = addCase(p, w, dueMins, 'followup', fsc, { status: dueMins < 3 * DAY ? 'submitted' : 'opinion' });
        clSql.push(`INSERT INTO followups (id, person_id, worker_id, due_date, reason, source_case_id, status, done_case_id) VALUES ('FU-${base.id}', '${p.id}', '${w.id}', date(${when(dueMins)}), 'rescreen', '${base.id}', 'done', '${last.id}');`);
      } else {
        clSql.push(`INSERT INTO followups (id, person_id, worker_id, due_date, reason, source_case_id, status) VALUES ('FU-${base.id}', '${p.id}', '${w.id}', date(${when(dueMins)}), 'rescreen', '${base.id}', 'due');`);
      }
      if (last !== base && last.opinionMins) {
        clSql.push(`INSERT INTO followups (id, person_id, worker_id, due_date, reason, source_case_id, status) VALUES ('FU-${last.id}', '${p.id}', '${w.id}', date(${when(last.opinionMins - last.months * 30 * DAY)}), 'rescreen', '${last.id}', 'due');`);
      }
    }
  }
}
for (const [hash, [src, tgt, out, engine]] of translations) clSql.push(`INSERT OR REPLACE INTO translations (hash, src_lang, tgt_lang, out_text, engine) VALUES (${[hash, src, tgt, out, engine].map(q).join(', ')});`);

// ---------- Kerala local bodies, split into small statements (D1 limits statement size) ----------
const lsgdSrc = readFileSync(new URL('../migrations/clinical/0002_kerala_lsgds.sql', import.meta.url), 'utf8');
const rows = [...lsgdSrc.matchAll(/^\('LS-[^\n]*?\)(?=[,;]\s*$)/gm)].map(m => m[0]);
const lsgdSql = ['-- Kerala local bodies (OpenStreetMap contributors, ODbL) for the demo site.'];
for (let i = 0; i < rows.length; i += 150) lsgdSql.push(`INSERT OR IGNORE INTO lsgds (id, state, district, kind, name, name_ml, lgd_code) VALUES\n${rows.slice(i, i + 150).join(',\n')};`);
const glossary = lsgdSrc.slice(lsgdSrc.indexOf('INSERT OR IGNORE INTO glossary'));
if (glossary.startsWith('INSERT')) lsgdSql.push(glossary.trim());

// D1's exec() runs one statement per line, so every file is flattened: comments removed, one statement per line.
export function flatten(sql) {
  const out = []; let cur = '', inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) { cur += c; if (c === "'") { if (sql[i + 1] === "'") { cur += "'"; i++; } else inStr = false; } continue; }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; cur += ' '; continue; }
    if (c === ';') { const st = cur.replace(/\s+/g, ' ').trim(); if (st) out.push(st + ';'); cur = ''; continue; }
    cur += c === '\n' || c === '\r' ? ' ' : c;
  }
  const st = cur.replace(/\s+/g, ' ').trim(); if (st) out.push(st + ';');
  return out.join('\n') + '\n';
}
const mig = (db, files) => flatten(files.map(f => readFileSync(new URL(`../migrations/${db}/${f}`, import.meta.url), 'utf8')).join('\n;\n'));
writeFileSync(new URL('schema-identity.sql', OUT), mig('identity', ['0001_init.sql', '0002_consent_v2.sql', '0003_pincode.sql', '0004_admin_roles.sql']));
writeFileSync(new URL('schema-clinical.sql', OUT), mig('clinical', ['0001_init.sql', '0003_notice_settings.sql', '0004_questionnaire.sql']));
writeFileSync(new URL('schema-media.sql', OUT), mig('media', ['0001_init.sql']));
writeFileSync(new URL('identity.sql', OUT), flatten(idSql.join('\n')));
writeFileSync(new URL('clinical.sql', OUT), flatten(clSql.join('\n')));
writeFileSync(new URL('lsgds.sql', OUT), flatten(lsgdSql.join('\n')));
console.log(JSON.stringify({ ...stats, lsgds: rows.length, translations: translations.size }));
