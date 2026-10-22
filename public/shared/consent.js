// Vayosmitham privacy notice and consent text.
//
// The notice is written to meet:
//   • Digital Personal Data Protection Act 2023, s.5–6, s.9, s.11–14, and DPDP Rules 2025, Rule 3 (itemised notice,
//     specified purposes, how to withdraw, exercise rights and complain to the Data Protection Board);
//   • IT (Reasonable Security Practices…) Rules 2011, Rule 5 (purpose, recipients, the agency collecting and retaining,
//     grievance officer) — applies until the DPDP Rules fully commence on 13 May 2027;
//   • ICMR National Ethical Guidelines 2017 (separate, optional research consent; legally acceptable representative).
//
// It is NOT yet approved by counsel. While CONSENT_VERSION contains "DRAFT" the app shows a test-data banner.
// When counsel approves the text: change the text if needed, set a new CONSENT_VERSION without "DRAFT",
// and add the old version to PREVIOUS_VERSIONS so consents already recorded stay valid.

export const CONSENT_VERSION = '2026-10-22-v2-DRAFT';
export const PREVIOUS_VERSIONS = ['2026-10-draft'];
export const KNOWN_VERSIONS = [CONSENT_VERSION, ...PREVIOUS_VERSIONS];
export const isDraft = v => /draft/i.test(v || '');

// Values filled from Admin → Settings. Missing ones are shown as a visible gap so the notice is never silently incomplete.
export const CONTACT_KEYS = ['org_legal_name', 'org_address', 'grievance_name', 'grievance_phone', 'grievance_email', 'retention_years', 'grievance_days'];
export function contactGaps(s = {}) {
  return ['org_address', 'grievance_name', 'grievance_phone', 'grievance_email'].filter(k => !String(s[k] || '').trim());
}

function fill(s, lang) {
  const gap = lang === 'ml' ? '[ചേർക്കാനുണ്ട്]' : '[to be added]';
  return {
    org: s.org_legal_name || 'Community Innovation Foundation',
    address: s.org_address || gap,
    gName: s.grievance_name || gap,
    gPhone: s.grievance_phone || gap,
    gEmail: s.grievance_email || gap,
    years: s.retention_years || '5',
    days: s.grievance_days || '30',
  };
}

// Returns the notice as a list of { h: heading, p: [paragraphs or bullet lines] }.
export function noticeSections(lang, settings = {}) {
  const f = fill(settings, lang);
  if (lang === 'ml') return [
    { h: 'വയോസ്മിതം — സ്വകാര്യതാ അറിയിപ്പും സമ്മതവും', p: [
      `പ്രായമായവർക്കുള്ള സൗജന്യ ദന്താരോഗ്യ പരിപാടിയാണ് വയോസ്മിതം. ഇത് നടത്തുന്നത് ${f.org} (വിലാസം: ${f.address}) ആണ്; ക്ലിനിക്കൽ പങ്കാളി അസോസിയേഷൻ ഓഫ് ജെറിയാട്രിക് ഡെന്റിസ്ട്രി (AGeD). നിങ്ങളുടെ വിവരങ്ങളുടെ ഉത്തരവാദിത്തം ${f.org}-നാണ്.`,
      'പങ്കെടുക്കുന്നത് നിങ്ങളുടെ ഇഷ്ടമാണ്. വേണ്ട എന്ന് പറഞ്ഞാൽ നിങ്ങൾക്ക് ലഭിക്കുന്ന മറ്റ് ചികിത്സയോ സർക്കാർ ആനുകൂല്യങ്ങളോ ഒരു തരത്തിലും ബാധിക്കില്ല.'] },
    { h: 'എന്തൊക്കെ വിവരങ്ങൾ ശേഖരിക്കും', p: [
      '• പേര്, ലിംഗം, വയസ്സ്/ജനന വർഷം, ഫോൺ നമ്പർ, വിലാസം, തദ്ദേശ സ്ഥാപനം, വാർഡ്',
      '• പരിചാരകന്റെ പേര്, ബന്ധം, ഫോൺ (ഉണ്ടെങ്കിൽ)',
      '• വായ, പല്ല്, പല്ല്സെറ്റ് എന്നിവയുടെ അവസ്ഥ; ആരോഗ്യ പ്രശ്നങ്ങൾ; കഴിക്കുന്ന മരുന്നുകൾ; പുകയില, അടയ്ക്ക, മദ്യം തുടങ്ങിയ ശീലങ്ങൾ',
      '• നിങ്ങൾ സമ്മതിച്ചാൽ മാത്രം: വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ (മുഖം ഉൾപ്പെടുത്തില്ല)',
      '• ഡോക്ടറുടെ അഭിപ്രായം, റഫറൽ, നിങ്ങൾ ചികിത്സയ്ക്ക് പോയോ എന്ന വിവരം',
      '• നിങ്ങൾ ആവശ്യപ്പെട്ടാൽ മാത്രം: ABHA നമ്പർ'] },
    { h: 'എന്തിനാണ് ഈ വിവരങ്ങൾ', p: [
      '1. ഒരു ദന്ത ഡോക്ടറുടെ അഭിപ്രായവും ചികിത്സാ നിർദ്ദേശവും നൽകാൻ',
      '2. റഫറലിനുള്ള റിപ്പോർട്ട് തയ്യാറാക്കാനും, ചികിത്സ ലഭിച്ചോ എന്ന് അന്വേഷിക്കാനും, തുടർ സന്ദർശനങ്ങൾ നടത്താനും',
      '3. മുതിർന്ന ദന്ത ഡോക്ടർമാർ ഉപദേശത്തിന്റെ ഗുണനിലവാരം പരിശോധിക്കാൻ',
      '4. ആരെയും തിരിച്ചറിയാനാവാത്ത എണ്ണങ്ങളായി മാത്രം, പ്രായമായവർക്കുള്ള സേവനങ്ങൾ ആസൂത്രണം ചെയ്യാൻ',
      '5. ഗവേഷണത്തിന് — താഴെ പ്രത്യേകം സമ്മതിച്ചാൽ മാത്രം, എത്തിക്സ് കമ്മിറ്റിയുടെ അംഗീകാരത്തോടെ',
      'നിങ്ങളുടെ വിവരങ്ങൾ വിൽക്കുകയോ പരസ്യത്തിന് ഉപയോഗിക്കുകയോ ചെയ്യില്ല.'] },
    { h: 'ആരൊക്കെ കാണും', p: [
      '• നിങ്ങളെ സന്ദർശിക്കുന്ന ആരോഗ്യ പ്രവർത്തകയും അവരുടെ കോർഡിനേറ്ററും ആവശ്യമുള്ള CIF ജീവനക്കാരും',
      '• AGeD-യുടെ സന്നദ്ധ ദന്ത ഡോക്ടർമാർ — നിങ്ങളുടെ പേര്, ഫോൺ, വിലാസം എന്നിവ അവർ കാണില്ല; വയസ്സ് വിഭാഗം, ലിംഗം, ജില്ല, ആരോഗ്യ വിവരങ്ങൾ, ഫോട്ടോകൾ എന്നിവ മാത്രം',
      '• ഞങ്ങൾക്കുവേണ്ടി പ്രവർത്തിക്കുന്ന സാങ്കേതിക സേവന ദാതാക്കൾ: Cloudflare (വിവരങ്ങൾ സൂക്ഷിക്കാൻ; ഇന്ത്യക്ക് പുറത്തുള്ള സെർവറുകളിൽ ആകാം), കുറിപ്പുകളുടെ യന്ത്ര വിവർത്തന സേവനം (ഉദാ. Cloudflare AI, ഭാരത സർക്കാരിന്റെ ഭാഷിണി). ഇവർക്ക് ഞങ്ങളുടെ നിർദ്ദേശപ്രകാരം മാത്രമേ ഇവ ഉപയോഗിക്കാൻ അനുവാദമുള്ളൂ.',
      '• നിങ്ങൾ റിപ്പോർട്ട് കൊണ്ടുപോകുന്ന ക്ലിനിക്ക് — റിപ്പോർട്ടിൽ നിങ്ങളുടെ പേരും പരിശോധിച്ച ഡോക്ടറുടെ പേരും രജിസ്ട്രേഷൻ നമ്പറും ഉണ്ടാകും',
      '• നിയമപ്രകാരം ആവശ്യപ്പെട്ടാൽ മാത്രം അധികൃതർക്ക്'] },
    { h: 'ഇത് എന്തല്ല', p: [
      'ഇത് ഫോട്ടോകളും ചോദ്യങ്ങളും അടിസ്ഥാനമാക്കിയുള്ള ഉപദേശം മാത്രമാണ്; പൂർണ്ണ ദന്ത പരിശോധനയോ ചികിത്സയോ കുറിപ്പടിയോ അല്ല. അടിയന്തര സേവനമല്ല — മുഖത്ത് വീക്കം, ശ്വാസതടസ്സം, നിൽക്കാത്ത രക്തസ്രാവം എന്നിവ ഉണ്ടെങ്കിൽ ഉടൻ ആശുപത്രിയിൽ പോകുക.'] },
    { h: 'എത്ര കാലം സൂക്ഷിക്കും', p: [
      `നിങ്ങൾ പരിപാടിയിൽ ഉള്ളിടത്തോളം. അവസാന സന്ദർശനത്തിന് ശേഷം ${f.years} വർഷം കഴിഞ്ഞോ, നിങ്ങൾ സമ്മതം പിൻവലിച്ചാലോ, നിയമപ്രകാരം സൂക്ഷിക്കേണ്ടവ ഒഴികെ നിങ്ങളെ തിരിച്ചറിയാവുന്ന വിവരങ്ങൾ മായ്ക്കും.`] },
    { h: 'നിങ്ങളുടെ അവകാശങ്ങൾ', p: [
      '• ഏത് സമയത്തും സമ്മതം പിൻവലിക്കാം — ആരോഗ്യ പ്രവർത്തകയോട് പറഞ്ഞാലോ താഴെയുള്ള നമ്പറിൽ വിളിച്ചാലോ മതി. സമ്മതം നൽകിയതുപോലെ എളുപ്പമാണ് പിൻവലിക്കാനും. പിൻവലിച്ചാൽ പിന്നീട് വിവരങ്ങൾ ഉപയോഗിക്കില്ല; എന്നാൽ അതിനുമുമ്പ് പേരില്ലാതെ തയ്യാറാക്കിയ എണ്ണങ്ങൾ മാറ്റാനാവില്ല.',
      '• നിങ്ങളുടെ വിവരങ്ങളുടെ സംഗ്രഹം ചോദിക്കാം, തെറ്റ് തിരുത്താം, മായ്ക്കാൻ ആവശ്യപ്പെടാം.',
      '• നിങ്ങൾക്ക് കഴിയാതെ വരികയോ മരണപ്പെടുകയോ ചെയ്താൽ നിങ്ങൾക്കുവേണ്ടി ഈ അവകാശങ്ങൾ ഉപയോഗിക്കാൻ ഒരാളെ നാമനിർദ്ദേശം ചെയ്യാം.',
      `• പരാതികൾക്ക്: ${f.gName}, ഫോൺ ${f.gPhone}, ഇമെയിൽ ${f.gEmail}. ${f.days} ദിവസത്തിനുള്ളിൽ മറുപടി നൽകും.`,
      '• മറുപടിയിൽ തൃപ്തിയില്ലെങ്കിൽ ഇന്ത്യയുടെ ഡാറ്റ പ്രൊട്ടക്ഷൻ ബോർഡിൽ പരാതി നൽകാം.'] },
    { h: 'സ്വയം തീരുമാനിക്കാൻ ബുദ്ധിമുട്ടുള്ളവർക്ക്', p: [
      'ഓർമ്മക്കുറവ് പോലുള്ള കാരണങ്ങളാൽ വ്യക്തിക്ക് സ്വയം തീരുമാനിക്കാൻ കഴിയുന്നില്ലെങ്കിൽ, നിയമപരമായ രക്ഷിതാവോ (ഉണ്ടെങ്കിൽ) അടുത്ത കുടുംബാംഗമോ വ്യക്തിയുടെ താൽപ്പര്യം മുൻനിർത്തി തീരുമാനിക്കും. എങ്കിലും വ്യക്തിയോട് വിശദീകരിക്കും; അവർ എതിർത്താൽ പരിശോധന നിർത്തും.'] },
  ];
  return [
    { h: 'Vayosmitham — privacy notice and consent', p: [
      `Vayosmitham is a free oral health programme for older people, run by ${f.org} (address: ${f.address}) with the Association of Geriatric Dentistry (AGeD) as clinical partner. ${f.org} is responsible for your information.`,
      'Taking part is your choice. Saying no will not affect any other care or any government benefit you receive.'] },
    { h: 'What information we collect', p: [
      '• Name, sex, age or year of birth, phone number, address, local body (LSGD) and ward',
      '• Caregiver’s name, relationship and phone (if any)',
      '• Condition of your mouth, teeth and dentures; health problems; medicines you take; habits such as tobacco, areca nut and alcohol',
      '• Only if you agree: photographs inside your mouth (your face is not included)',
      '• The dentist’s opinion, any referral, and whether you reached treatment',
      '• Only if you ask: your ABHA number'] },
    { h: 'Why we use it', p: [
      '1. To get a dentist’s opinion and care plan for you',
      '2. To prepare a referral report, check whether you received treatment, and visit you again for follow-up',
      '3. For senior dentists to check the quality of the advice',
      '4. As counts that cannot identify anyone, to plan services for older people',
      '5. For research — only if you separately agree below, and only with ethics committee approval',
      'Your information is never sold or used for advertising.'] },
    { h: 'Who will see it', p: [
      '• The health worker who visits you, her coordinator, and CIF staff who need it',
      '• AGeD volunteer dentists — they do NOT see your name, phone number or address; only your age group, sex, district, health answers and photos',
      '• Technical service providers who work for us under our instructions: Cloudflare (stores the information; its servers may be outside India) and machine translation of notes (for example Cloudflare AI and the Government of India’s Bhashini)',
      '• The clinic you take your report to — the report shows your name and the reviewing dentist’s name and registration number',
      '• Authorities, only when the law requires it'] },
    { h: 'What this is not', p: [
      'This is advice based on photographs and questions. It is not a full dental examination, treatment or prescription. It is not an emergency service — for facial swelling, difficulty breathing or bleeding that will not stop, go to a hospital at once.'] },
    { h: 'How long we keep it', p: [
      `While you are in the programme. ${f.years} years after your last visit, or when you withdraw consent, we delete the information that identifies you, except anything the law requires us to keep.`] },
    { h: 'Your rights', p: [
      '• You can withdraw consent at any time, as easily as you gave it — tell the health worker or call the number below. We then stop using your information; counts already made without names cannot be undone.',
      '• You can ask for a summary of your information, correct mistakes, and ask us to delete it.',
      '• You can name someone to use these rights for you if you become unable to, or after your death.',
      `• Grievances: ${f.gName}, phone ${f.gPhone}, email ${f.gEmail}. We will reply within ${f.days} days.`,
      '• If you are not satisfied with our reply, you can complain to the Data Protection Board of India.'] },
    { h: 'If the person cannot decide for themselves', p: [
      'If the person cannot decide because of memory problems or a similar condition, their lawful guardian (if one has been appointed) or a close family member decides in the person’s best interests. We still explain to the person, and we stop if they object.'] },
  ];
}

export function noticeText(lang, settings) {
  return noticeSections(lang, settings).map(s => `${s.h}\n${s.p.join('\n')}`).join('\n\n');
}

// What each consent item means — shown next to its tick box. Every box starts unticked.
export const LAYERS = {
  care: {
    en: ['Screening and a dentist’s opinion', 'Required to take part. Covers purposes 1–4 above.'],
    ml: ['പരിശോധനയും ദന്ത ഡോക്ടറുടെ അഭിപ്രായവും', 'പങ്കെടുക്കാൻ ആവശ്യമാണ്. മുകളിലെ 1–4 ആവശ്യങ്ങൾ ഉൾപ്പെടുന്നു.'] },
  photos: {
    en: ['Photographs inside my mouth', 'Optional. Helps the dentist. No face.'],
    ml: ['വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ', 'ആവശ്യമെങ്കിൽ മാത്രം. ഡോക്ടർക്ക് സഹായകമാണ്. മുഖം ഉൾപ്പെടില്ല.'] },
  research: {
    en: ['Use of my coded information for approved research', 'Optional. Name, phone and address are removed and replaced by a code.'],
    ml: ['കോഡ് ചെയ്ത വിവരങ്ങൾ അംഗീകൃത ഗവേഷണത്തിന് ഉപയോഗിക്കൽ', 'ആവശ്യമെങ്കിൽ മാത്രം. പേര്, ഫോൺ, വിലാസം എന്നിവ മാറ്റി ഒരു കോഡ് നൽകും.'] },
  messaging: {
    en: ['SMS or WhatsApp messages about my visits', 'Optional. Reminders and a link to my report.'],
    ml: ['സന്ദർശനങ്ങളെക്കുറിച്ചുള്ള SMS / വാട്ട്സ്ആപ്പ് സന്ദേശങ്ങൾ', 'ആവശ്യമെങ്കിൽ മാത്രം. ഓർമ്മപ്പെടുത്തലും റിപ്പോർട്ട് ലിങ്കും.'] },
  abha: {
    en: ['Link to my ABHA health ID', 'Optional.'],
    ml: ['എന്റെ ABHA ആരോഗ്യ ഐഡിയുമായി ബന്ധിപ്പിക്കൽ', 'ആവശ്യമെങ്കിൽ മാത്രം.'] },
};

export const DECIDER_TYPES = [
  { key: 'lawful_guardian', en: 'Lawful guardian (appointed by a court or authority)', ml: 'നിയമപരമായ രക്ഷിതാവ് (കോടതി/അധികാരി നിയമിച്ചത്)' },
  { key: 'nominee', en: 'Person nominated earlier by the older person', ml: 'വ്യക്തി മുൻപ് നാമനിർദ്ദേശം ചെയ്ത ആൾ' },
  { key: 'family', en: 'Close family member / caregiver', ml: 'അടുത്ത കുടുംബാംഗം / പരിചാരകൻ' },
];
