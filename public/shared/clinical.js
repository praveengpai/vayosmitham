// Shared clinical definitions — used by both the browser app and the API worker,
// so triage rules and scores are computed identically everywhere.
// Content to be reviewed and approved by the AGeD clinical governance group.

export const OHAT_ITEMS = [
  { key: 'lips', en: 'Lips', ml: 'ചുണ്ടുകൾ',
    levels: [
      { en: 'Smooth, pink, moist', ml: 'മിനുസമുള്ളത്, പിങ്ക്, നനവുള്ളത്' },
      { en: 'Dry, chapped, or red at corners', ml: 'വരണ്ടത്, വിണ്ടുകീറിയത്, അല്ലെങ്കിൽ കോണുകളിൽ ചുവപ്പ്' },
      { en: 'Swelling or lump, white/red/ulcerated patch, bleeding, ulcer at corners', ml: 'വീക്കം അല്ലെങ്കിൽ മുഴ, വെള്ള/ചുവപ്പ്/വ്രണമുള്ള പാട്, രക്തസ്രാവം, ചുണ്ടിന്റെ കോണുകളിൽ വ്രണം' } ] },
  { key: 'tongue', en: 'Tongue', ml: 'നാവ്',
    levels: [
      { en: 'Normal, moist, rough, pink', ml: 'സാധാരണ, നനവുള്ളത്, പരുപരുത്തത്, പിങ്ക്' },
      { en: 'Patchy, fissured, red, coated', ml: 'പാടുകൾ, വിള്ളലുകൾ, ചുവപ്പ്, പൂപ്പൽ പോലെ ആവരണം' },
      { en: 'Patch that is red and/or white, ulcerated, swollen', ml: 'ചുവപ്പ്/വെള്ള പാട്, വ്രണം, വീക്കം' } ] },
  { key: 'gums', en: 'Gums and tissues', ml: 'മോണയും വായിലെ മൃദുഭാഗങ്ങളും',
    levels: [
      { en: 'Moist, pink, smooth, no bleeding', ml: 'നനവുള്ളത്, പിങ്ക്, മിനുസമുള്ളത്, രക്തസ്രാവമില്ല' },
      { en: 'Dry, shiny, rough, red, swollen; one ulcer/sore spot under dentures', ml: 'വരണ്ടത്, തിളക്കമുള്ളത്, പരുപരുത്തത്, ചുവപ്പ്, വീക്കം; പല്ല്സെറ്റിനടിയിൽ ഒരു വ്രണം/വേദനയുള്ള ഭാഗം' },
      { en: 'Swollen, bleeding, ulcers, white/red patches, generalised redness under dentures', ml: 'വീക്കം, രക്തസ്രാവം, വ്രണങ്ങൾ, വെള്ള/ചുവപ്പ് പാടുകൾ, പല്ല്സെറ്റിനടിയിൽ മുഴുവൻ ചുവപ്പ്' } ] },
  { key: 'saliva', en: 'Saliva', ml: 'ഉമിനീര്',
    levels: [
      { en: 'Moist tissues, watery and free-flowing', ml: 'ആവശ്യത്തിന് ഉമിനീര്, നനവുള്ള വായ' },
      { en: 'Dry, sticky tissues, little saliva; person thinks mouth is dry', ml: 'വരണ്ട, ഒട്ടിപ്പിടിക്കുന്ന വായ; ഉമിനീര് കുറവ്; വായ വരളുന്നതായി വ്യക്തിക്ക് തോന്നുന്നു' },
      { en: 'Tissues parched and red, very little or no saliva, saliva thick', ml: 'വളരെ വരണ്ടതും ചുവന്നതും, ഉമിനീര് ഇല്ല അല്ലെങ്കിൽ കട്ടിയുള്ളത്' } ] },
  { key: 'teeth', en: 'Natural teeth', ml: 'സ്വന്തം പല്ലുകൾ',
    levels: [
      { en: 'No decayed or broken teeth or roots', ml: 'കേടുള്ളതോ പൊട്ടിയതോ ആയ പല്ലുകളോ വേരുകളോ ഇല്ല' },
      { en: '1–3 decayed or broken teeth/roots, or very worn teeth', ml: '1–3 കേടുള്ള/പൊട്ടിയ പല്ലുകൾ/വേരുകൾ, അല്ലെങ്കിൽ വളരെ തേഞ്ഞ പല്ലുകൾ' },
      { en: '4 or more decayed or broken teeth/roots, or fewer than 4 teeth', ml: '4-ഓ അതിലധികമോ കേടുള്ള/പൊട്ടിയ പല്ലുകൾ/വേരുകൾ, അല്ലെങ്കിൽ 4-ൽ താഴെ പല്ലുകൾ മാത്രം' } ] },
  { key: 'dentures', en: 'Dentures', ml: 'പല്ല്സെറ്റ്',
    levels: [
      { en: 'No broken areas or teeth; worn regularly and named (or no denture needed)', ml: 'പൊട്ടിയ ഭാഗമോ പല്ലോ ഇല്ല; പതിവായി ഉപയോഗിക്കുന്നു, പേര് എഴുതിയിട്ടുണ്ട് (അല്ലെങ്കിൽ പല്ല്സെറ്റ് ആവശ്യമില്ല)' },
      { en: '1 broken area/tooth, or worn only 1–2 hours a day, or loose', ml: 'ഒരു ഭാഗം/പല്ല് പൊട്ടി, അല്ലെങ്കിൽ ദിവസം 1–2 മണിക്കൂർ മാത്രം ഉപയോഗം, അല്ലെങ്കിൽ ഇളകുന്നു' },
      { en: 'More than 1 broken area/tooth, denture missing or not worn, needs adhesive', ml: 'ഒന്നിലധികം ഭാഗം/പല്ല് പൊട്ടി, പല്ല്സെറ്റ് കാണാനില്ല അല്ലെങ്കിൽ ഉപയോഗിക്കുന്നില്ല, ഉറപ്പിക്കാൻ പശ വേണ്ടിവരുന്നു' } ] },
  { key: 'cleanliness', en: 'Oral cleanliness', ml: 'വായയുടെ വൃത്തി',
    levels: [
      { en: 'Clean, no food particles or tartar', ml: 'വൃത്തിയുള്ളത്, ഭക്ഷണാവശിഷ്ടമോ കക്കയോ (ടാർട്ടർ) ഇല്ല' },
      { en: 'Food, tartar or plaque in 1–2 areas, or on a small area of dentures; or bad breath', ml: '1–2 ഭാഗത്തോ പല്ല്സെറ്റിന്റെ ചെറിയ ഭാഗത്തോ ഭക്ഷണാവശിഷ്ടം/കക്ക/പ്ലാക്ക്; അല്ലെങ്കിൽ വായ്നാറ്റം' },
      { en: 'Food, tartar or plaque in most areas, or on most of dentures; or severe bad breath', ml: 'മിക്ക ഭാഗത്തും അല്ലെങ്കിൽ പല്ല്സെറ്റിന്റെ മിക്ക ഭാഗത്തും ഭക്ഷണാവശിഷ്ടം/കക്ക/പ്ലാക്ക്; അല്ലെങ്കിൽ കടുത്ത വായ്നാറ്റം' } ] },
  { key: 'pain', en: 'Dental pain', ml: 'പല്ലുവേദന',
    levels: [
      { en: 'No behavioural, verbal or physical signs of pain', ml: 'വേദനയുടെ ലക്ഷണങ്ങളൊന്നുമില്ല' },
      { en: 'Verbal or behavioural signs of pain (pulling at face, chewing lips, not eating, aggression)', ml: 'വേദനയുണ്ടെന്ന് പറയുന്നു/പെരുമാറ്റത്തിൽ കാണുന്നു (മുഖത്ത് പിടിച്ചുവലിക്കുക, ചുണ്ട് കടിക്കുക, ഭക്ഷണം കഴിക്കാതിരിക്കുക, ദേഷ്യം/അക്രമസ്വഭാവം)' },
      { en: 'Physical pain signs (swelling of cheek or gum, broken teeth, ulcers) plus verbal/behavioural signs', ml: 'കവിളിൽ/മോണയിൽ വീക്കം, പൊട്ടിയ പല്ല്, വ്രണം എന്നിവ കാണുന്നു; ഒപ്പം വേദനയുണ്ടെന്ന് പറയുന്നു/പെരുമാറ്റത്തിൽ കാണുന്നു' } ] },
];

export const OHAT_SOURCE = 'Oral Health Assessment Tool (Chalmers et al., 2005), adapted for field use. Malayalam wording pending validation.';

// GOHAI: response 1=Always … 5=Never. Positive items (3, 5, 7) are reverse-scored.
// Total 12–60, higher = better oral-health-related quality of life.
export const GOHAI_ITEMS = [
  { n: 1,  pos: false, en: 'Limited the kinds or amounts of food you eat because of problems with your teeth or dentures?', ml: 'പല്ലിന്റെയോ പല്ല്സെറ്റിന്റെയോ പ്രശ്നം കാരണം കഴിക്കുന്ന ഭക്ഷണത്തിന്റെ തരമോ അളവോ കുറയ്ക്കേണ്ടി വരാറുണ്ടോ?' },
  { n: 2,  pos: false, en: 'Had trouble biting or chewing any kinds of food, such as firm meat or apples?', ml: 'ഇറച്ചി, ആപ്പിൾ പോലുള്ള കട്ടിയുള്ള ഭക്ഷണം കടിക്കാനോ ചവയ്ക്കാനോ ബുദ്ധിമുട്ട് തോന്നാറുണ്ടോ?' },
  { n: 3,  pos: true,  en: 'Been able to swallow comfortably?', ml: 'സുഖമായി വിഴുങ്ങാൻ കഴിയാറുണ്ടോ?' },
  { n: 4,  pos: false, en: 'Had your teeth or dentures prevent you from speaking the way you wanted?', ml: 'പല്ലോ പല്ല്സെറ്റോ കാരണം ഉദ്ദേശിച്ചതുപോലെ സംസാരിക്കാൻ കഴിയാതെ വരാറുണ്ടോ?' },
  { n: 5,  pos: true,  en: 'Been able to eat anything without feeling discomfort?', ml: 'ഒരു അസ്വസ്ഥതയും കൂടാതെ എന്തും കഴിക്കാൻ കഴിയാറുണ്ടോ?' },
  { n: 6,  pos: false, en: 'Limited contacts with people because of the condition of your teeth or dentures?', ml: 'പല്ലിന്റെയോ പല്ല്സെറ്റിന്റെയോ അവസ്ഥ കാരണം ആളുകളുമായുള്ള ഇടപെടൽ കുറയ്ക്കാറുണ്ടോ?' },
  { n: 7,  pos: true,  en: 'Been pleased or happy with the look of your teeth and gums, or dentures?', ml: 'പല്ലിന്റെയും മോണയുടെയും, അല്ലെങ്കിൽ പല്ല്സെറ്റിന്റെ, കാഴ്ചയിൽ തൃപ്തിയും സന്തോഷവും തോന്നാറുണ്ടോ?' },
  { n: 8,  pos: false, en: 'Used medication to relieve pain or discomfort around your mouth?', ml: 'വായിലെ വേദനയോ അസ്വസ്ഥതയോ മാറാൻ മരുന്ന് ഉപയോഗിക്കേണ്ടി വരാറുണ്ടോ?' },
  { n: 9,  pos: false, en: 'Been worried or concerned about problems with your teeth, gums or dentures?', ml: 'പല്ലിന്റെയോ മോണയുടെയോ പല്ല്സെറ്റിന്റെയോ പ്രശ്നങ്ങളെക്കുറിച്ച് വിഷമമോ ആശങ്കയോ തോന്നാറുണ്ടോ?' },
  { n: 10, pos: false, en: 'Felt nervous or self-conscious because of problems with your teeth, gums or dentures?', ml: 'പല്ലിന്റെയോ മോണയുടെയോ പല്ല്സെറ്റിന്റെയോ പ്രശ്നം കാരണം പരിഭ്രമമോ നാണക്കേടോ തോന്നാറുണ്ടോ?' },
  { n: 11, pos: false, en: 'Felt uncomfortable eating in front of people because of problems with your teeth or dentures?', ml: 'പല്ലിന്റെയോ പല്ല്സെറ്റിന്റെയോ പ്രശ്നം കാരണം മറ്റുള്ളവരുടെ മുന്നിൽ ഭക്ഷണം കഴിക്കാൻ മടിയോ ബുദ്ധിമുട്ടോ തോന്നാറുണ്ടോ?' },
  { n: 12, pos: false, en: 'Found your teeth or gums sensitive to hot, cold or sweets?', ml: 'ചൂടോ തണുപ്പോ മധുരമോ തട്ടുമ്പോൾ പല്ലിനോ മോണയ്ക്കോ പുളിപ്പ് തോന്നാറുണ്ടോ?' },
];
export const GOHAI_OPTIONS = [
  { v: 1, en: 'Always', ml: 'എപ്പോഴും' },
  { v: 2, en: 'Often', ml: 'പലപ്പോഴും' },
  { v: 3, en: 'Sometimes', ml: 'ചിലപ്പോൾ' },
  { v: 4, en: 'Seldom', ml: 'അപൂർവ്വമായി' },
  { v: 5, en: 'Never', ml: 'ഒരിക്കലുമില്ല' },
];

export function ohatTotal(ohat) {
  return OHAT_ITEMS.reduce((s, it) => s + (Number.isInteger(ohat?.[it.key]) ? ohat[it.key] : 0), 0);
}
export function gohaiTotal(answers) {
  if (!Array.isArray(answers) || answers.length !== 12 || answers.some(a => !(a >= 1 && a <= 5))) return null;
  return answers.reduce((s, a, i) => s + (GOHAI_ITEMS[i].pos ? 6 - a : a), 0);
}

export const COMPLAINTS = [
  { key: 'pain', en: 'Tooth or mouth pain', ml: 'പല്ലുവേദന / വായിൽ വേദന' },
  { key: 'chewing', en: 'Difficulty chewing', ml: 'ചവയ്ക്കാൻ ബുദ്ധിമുട്ട്' },
  { key: 'swallowing', en: 'Difficulty swallowing', ml: 'വിഴുങ്ങാൻ ബുദ്ധിമുട്ട്' },
  { key: 'loose_teeth', en: 'Loose teeth', ml: 'ഇളകുന്ന പല്ലുകൾ' },
  { key: 'bleeding_gums', en: 'Bleeding gums', ml: 'മോണയിൽ നിന്ന് രക്തം' },
  { key: 'denture_problem', en: 'Denture loose, broken or painful', ml: 'പല്ല്സെറ്റ് ഇളകുന്നു / പൊട്ടി / വേദന' },
  { key: 'no_denture', en: 'Missing teeth, no denture', ml: 'പല്ലുകൾ പോയി, പല്ല്സെറ്റില്ല' },
  { key: 'dry_mouth', en: 'Dry mouth', ml: 'വായ് വരൾച്ച' },
  { key: 'bad_breath', en: 'Bad breath', ml: 'വായ്നാറ്റം' },
  { key: 'sore_ulcer', en: 'Sore, ulcer or patch in mouth', ml: 'വായിൽ വ്രണം അല്ലെങ്കിൽ പാട്' },
  { key: 'swelling', en: 'Swelling of face, jaw or gum', ml: 'മുഖത്തോ താടിയെല്ലിലോ മോണയിലോ വീക്കം' },
  { key: 'sensitivity', en: 'Sensitivity to hot/cold/sweet', ml: 'ചൂട്/തണുപ്പ്/മധുരം തട്ടുമ്പോൾ പുളിപ്പ്' },
  { key: 'checkup', en: 'No complaint — routine check', ml: 'പ്രശ്നമൊന്നുമില്ല — സാധാരണ പരിശോധന' },
];

// Red flags — any one makes the case URGENT and shows same-day advice to the worker.
export const RED_FLAGS = [
  { key: 'ulcer_2wk', en: 'Ulcer, sore or lump in the mouth for more than 2 weeks', ml: 'വായിൽ 2 ആഴ്ചയിലധികമായി ഉണങ്ങാത്ത വ്രണം/മുഴ',
    advice_en: 'Possible oral cancer warning sign. Refer to the nearest dental college, district hospital dental department or oral medicine clinic within 7 days. Do not wait for the dentist\'s opinion.',
    advice_ml: 'വായിലെ കാൻസറിന്റെ മുന്നറിയിപ്പ് ലക്ഷണമാകാം. 7 ദിവസത്തിനുള്ളിൽ അടുത്തുള്ള ഡെന്റൽ കോളേജിലോ ജില്ലാ ആശുപത്രി ദന്ത വിഭാഗത്തിലോ ഓറൽ മെഡിസിൻ ക്ലിനിക്കിലോ കാണിക്കുക. ദന്ത ഡോക്ടറുടെ അഭിപ്രായത്തിനായി കാത്തിരിക്കരുത്.' },
  { key: 'patch', en: 'White or red patch that does not rub off', ml: 'തുടച്ചാൽ മാറാത്ത വെള്ള/ചുവപ്പ് പാട്',
    advice_en: 'Possible pre-cancerous change. Refer for examination within 7 days, especially if the person uses tobacco or areca.',
    advice_ml: 'കാൻസറിന് മുമ്പുള്ള മാറ്റമാകാം. 7 ദിവസത്തിനുള്ളിൽ പരിശോധനയ്ക്ക് അയക്കുക — പ്രത്യേകിച്ച് പുകയിലയോ അടയ്ക്കയോ ഉപയോഗിക്കുന്നവരാണെങ്കിൽ.' },
  { key: 'facial_swelling', en: 'Swelling of face or neck, or fever with tooth pain', ml: 'മുഖത്തോ കഴുത്തിലോ വീക്കം, അല്ലെങ്കിൽ പല്ലുവേദനയോടൊപ്പം പനി',
    advice_en: 'Possible spreading infection. Take the person to a hospital TODAY. If there is difficulty breathing or swallowing, treat as an emergency.',
    advice_ml: 'അണുബാധ പടരുന്നതാകാം. ഇന്നുതന്നെ ആശുപത്രിയിൽ എത്തിക്കുക. ശ്വസിക്കാനോ വിഴുങ്ങാനോ ബുദ്ധിമുട്ടുണ്ടെങ്കിൽ അടിയന്തര സാഹചര്യമായി കണക്കാക്കി ഉടൻ എത്തിക്കുക.' },
  { key: 'bleeding', en: 'Bleeding from the mouth that does not stop', ml: 'വായിൽ നിന്ന് നിൽക്കാത്ത രക്തസ്രാവം',
    advice_en: 'Apply firm pressure with clean gauze for 15 minutes. If it continues, or the person takes blood thinners, go to a hospital TODAY.',
    advice_ml: 'വൃത്തിയുള്ള ഗോസോ തുണിയോ വച്ച് 15 മിനിറ്റ് നന്നായി അമർത്തിപ്പിടിക്കുക. എന്നിട്ടും നിൽക്കുന്നില്ലെങ്കിലോ, വ്യക്തി രക്തം നേർപ്പിക്കുന്ന മരുന്ന് കഴിക്കുന്നുണ്ടെങ്കിലോ ഇന്നുതന്നെ ആശുപത്രിയിൽ പോകുക.' },
  { key: 'trauma', en: 'Recent injury to mouth, teeth or jaw', ml: 'വായിലോ പല്ലിലോ താടിയെല്ലിലോ അടുത്തിടെ പരിക്ക്',
    advice_en: 'After a fall, check for other injuries first. Arrange dental or hospital review within 24 hours.',
    advice_ml: 'വീഴ്ചയ്ക്ക് ശേഷമാണെങ്കിൽ മറ്റ് പരിക്കുകൾ ആദ്യം പരിശോധിക്കുക. 24 മണിക്കൂറിനുള്ളിൽ ദന്ത ഡോക്ടറെയോ ആശുപത്രിയിലോ കാണിക്കാൻ ഏർപ്പാട് ചെയ്യുക.' },
  { key: 'cannot_eat', en: 'Unable to eat or drink because of mouth problem', ml: 'വായിലെ പ്രശ്നം കാരണം ഭക്ഷണമോ വെള്ളമോ കഴിക്കാൻ കഴിയുന്നില്ല',
    advice_en: 'Risk of dehydration and malnutrition. Offer soft food and fluids; inform the family doctor or PHC today.',
    advice_ml: 'ശരീരത്തിൽ വെള്ളം കുറയാനും പോഷകക്കുറവിനും സാധ്യത. മൃദുവായ ഭക്ഷണവും വെള്ളവും മറ്റു പാനീയങ്ങളും നൽകുക; ഇന്നുതന്നെ കുടുംബ ഡോക്ടറെയോ PHC-യെയോ അറിയിക്കുക.' },
];

// Medicines that matter to the dentist. Matching is by lower-case substring of the generic name.
export const MEDICINE_FLAGS = [
  { flag: 'dry_mouth', en: 'May cause dry mouth', ml: 'വായ് വരൾച്ചയ്ക്ക് കാരണമാകാം',
    names: ['amitriptyline','nortriptyline','imipramine','dosulepin','oxybutynin','tolterodine','solifenacin','trihexyphenidyl','benzhexol','benztropine','chlorpheniramine','hydroxyzine','diphenhydramine','promethazine','olanzapine','quetiapine','risperidone','haloperidol','paroxetine','fluoxetine','sertraline','escitalopram','citalopram','venlafaxine','duloxetine','mirtazapine','furosemide','frusemide','torsemide','hydrochlorothiazide','chlorthalidone','clonidine','tramadol','morphine','gabapentin','pregabalin','scopolamine','hyoscine','dicyclomine'] },
  { flag: 'bleeding', en: 'Bleeding risk (anticoagulant/antiplatelet)', ml: 'രക്തസ്രാവ സാധ്യത (രക്തം നേർപ്പിക്കുന്ന മരുന്ന്)',
    names: ['warfarin','acenocoumarol','apixaban','rivaroxaban','dabigatran','edoxaban','clopidogrel','prasugrel','ticagrelor','aspirin','heparin','enoxaparin'] },
  { flag: 'gum_overgrowth', en: 'May cause gum overgrowth', ml: 'മോണ വളർച്ചയ്ക്ക് കാരണമാകാം',
    names: ['amlodipine','nifedipine','felodipine','diltiazem','verapamil','phenytoin','cyclosporine','ciclosporin','sodium valproate','valproate'] },
  { flag: 'jaw_osteonecrosis', en: 'Jaw osteonecrosis risk (bisphosphonate/denosumab)', ml: 'താടിയെല്ല് നശിക്കാനുള്ള (ഓസ്റ്റിയോനെക്രോസിസ്) സാധ്യത — ബിസ്ഫോസ്ഫൊണേറ്റ്/ഡെനോസുമാബ്',
    names: ['alendronate','risedronate','ibandronate','zoledronic','zoledronate','pamidronate','denosumab'] },
  { flag: 'steroid_immuno', en: 'Steroid or immunosuppressant — infection/thrush risk', ml: 'സ്റ്റിറോയ്ഡ്/പ്രതിരോധശേഷി കുറയ്ക്കുന്ന മരുന്ന് — അണുബാധ/പൂപ്പൽ (ത്രഷ്) സാധ്യത',
    names: ['prednisolone','prednisone','dexamethasone','methylprednisolone','methotrexate','azathioprine','tacrolimus','mycophenolate','budesonide inhaler','fluticasone inhaler'] },
];

export function flagMedicines(list) {
  const out = [];
  for (const raw of list || []) {
    const name = String(raw || '').toLowerCase();
    if (!name.trim()) continue;
    for (const g of MEDICINE_FLAGS) {
      if (g.active === false) continue;
      if (g.names.some(n => name.includes(n))) out.push({ medicine: raw, flag: g.flag });
    }
  }
  return out;
}

export function triage(redFlagKeys) {
  const valid = (redFlagKeys || []).filter(k => RED_FLAGS.some(r => r.key === k));
  return { urgency: valid.length ? 'urgent' : 'routine', red_flags: valid };
}

export function ageBand(birthYear, now = new Date()) {
  if (!birthYear) return 'unknown';
  const age = now.getFullYear() - Number(birthYear);
  if (age < 60) return '<60';
  if (age >= 90) return '90+';
  const lo = Math.floor(age / 5) * 5;
  return `${lo}-${lo + 4}`;
}

export const PHOTO_VIEWS = [
  { key: 'front', en: 'Front — teeth together, lips apart', ml: 'മുൻവശം — പല്ലുകൾ ചേർത്ത്, ചുണ്ട് അകറ്റി' },
  { key: 'upper', en: 'Upper jaw — head tilted back, mouth wide', ml: 'മേൽത്താടി — തല പിന്നോട്ട് ചരിച്ച്, വായ നന്നായി തുറന്ന്' },
  { key: 'lower', en: 'Lower jaw — chin down, mouth wide', ml: 'കീഴ്ത്താടി — താടി താഴ്ത്തി, വായ നന്നായി തുറന്ന്' },
  { key: 'left', en: 'Left side — cheek pulled back', ml: 'ഇടതുവശം — കവിൾ പിന്നോട്ട് വലിച്ച്' },
  { key: 'right', en: 'Right side — cheek pulled back', ml: 'വലതുവശം — കവിൾ പിന്നോട്ട് വലിച്ച്' },
  { key: 'lesion', en: 'Close-up of sore, patch or swelling', ml: 'വ്രണം/പാട്/വീക്കം അടുത്തുനിന്ന്' },
  { key: 'denture', en: 'Denture (out of mouth)', ml: 'പല്ല്സെറ്റ് (വായ്ക്ക് പുറത്ത്)' },
];

export const REFERRAL_TYPES = [
  { key: 'general_dental', en: 'General dental care (extraction, filling, scaling)', ml: 'സാധാരണ ദന്ത ചികിത്സ (പല്ല് എടുക്കൽ, അടയ്ക്കൽ, ക്ലീനിംഗ്)' },
  { key: 'prosthodontic', en: 'Denture (new, repair or reline)', ml: 'പല്ല്സെറ്റ് (പുതിയത്, നന്നാക്കൽ, റീലൈൻ)' },
  { key: 'oral_medicine', en: 'Oral medicine / biopsy — suspicious lesion', ml: 'ഓറൽ മെഡിസിൻ / ബയോപ്സി — സംശയകരമായ വ്രണം/പാട്' },
  { key: 'oral_surgery', en: 'Oral surgery', ml: 'ഓറൽ സർജറി' },
  { key: 'periodontal', en: 'Gum treatment', ml: 'മോണ ചികിത്സ' },
  { key: 'medical', en: 'Medical review (physician / PHC)', ml: 'മെഡിക്കൽ പരിശോധന (ഫിസിഷ്യൻ / PHC)' },
  { key: 'domiciliary', en: 'Home-based dental visit (bedbound)', ml: 'വീട്ടിലെത്തിയുള്ള ദന്ത പരിശോധന (കിടപ്പിലായവർക്ക്)' },
];

// Questions on the teeth, health and habits steps. Editable by the AGeD clinical admin (see questionnaire.js).
// step → where the answer is stored: teeth → screening.extra, health → screening.context, habits → screening.risks.
// type: yesno | habit (never / stopped / now) | choice | number | text. states: show only for people in these states ([] = all).
// when: 'denture' shows the question only if the person has an upper or lower denture.
export const QUESTIONS = [
  { key: 'denture_out_night', step: 'teeth', type: 'yesno', when: 'denture', en: 'Takes the dentures out at night' },
  { key: 'denture_cleaning', step: 'teeth', type: 'choice', when: 'denture', en: 'How are the dentures cleaned?', options: [
    { key: 'brush_soap_water', en: 'Brush with soap or water' }, { key: 'brush_paste', en: 'Brush with toothpaste' }, { key: 'soak', en: 'Soaked in denture cleaner' },
    { key: 'rinse_only', en: 'Only rinsed with water' }, { key: 'not_cleaned', en: 'Not cleaned' }] },
  { key: 'bedbound', step: 'health', type: 'yesno', en: 'Bedbound or housebound' },
  { key: 'dementia', step: 'health', type: 'yesno', en: 'Memory problems / dementia' },
  { key: 'swallowing_difficulty', step: 'health', type: 'yesno', en: 'Difficulty swallowing or choking' },
  { key: 'diabetes', step: 'health', type: 'yesno', en: 'Diabetes' },
  { key: 'stroke', step: 'health', type: 'yesno', en: 'Stroke or paralysis' },
  { key: 'cancer_treatment', step: 'health', type: 'yesno', en: 'Cancer treatment now or before' },
  { key: 'lives_alone', step: 'health', type: 'yesno', en: 'Lives alone' },
  { key: 'needs_help_cleaning', step: 'health', type: 'yesno', en: 'Needs help to clean teeth or dentures' },
  { key: 'weight_loss', step: 'health', type: 'yesno', en: 'Recent weight loss or poor appetite' },
  { key: 'palliative', step: 'health', type: 'yesno', en: 'Under palliative care' },
  { key: 'tobacco_chew', step: 'habits', type: 'habit', en: 'Chewing tobacco, pan, gutka' },
  { key: 'khaini', step: 'habits', type: 'habit', en: 'Khaini (tobacco with lime)' },
  { key: 'mishri', step: 'habits', type: 'habit', states: ['Maharashtra'], en: 'Mishri (roasted tobacco rubbed on teeth)' },
  { key: 'kharra_mawa', step: 'habits', type: 'habit', states: ['Maharashtra'], en: 'Kharra or mawa' },
  { key: 'areca', step: 'habits', type: 'habit', en: 'Areca nut (adakka)' },
  { key: 'tobacco_smoke', step: 'habits', type: 'habit', en: 'Smoking (beedi, cigarette)' },
  { key: 'alcohol', step: 'habits', type: 'habit', en: 'Alcohol' },
  { key: 'sugar_per_day', step: 'habits', type: 'number', min: 0, max: 20, en: 'Sweet things or sweet tea/coffee — times a day' },
  { key: 'brushing', step: 'habits', type: 'choice', en: 'Cleans teeth or dentures', options: [
    { key: 'twice', en: 'Twice a day' }, { key: 'once', en: 'Once a day' }, { key: 'irregular', en: 'Sometimes' }, { key: 'never', en: 'Never' }, { key: 'assisted', en: 'Someone helps' }] },
  { key: 'brush_aid', step: 'habits', type: 'choice', en: 'Cleans with', options: [
    { key: 'toothbrush', en: 'Toothbrush' }, { key: 'finger', en: 'Finger' }, { key: 'neem_stick', en: 'Neem/twig' }, { key: 'charcoal_powder', en: 'Charcoal or powder' }, { key: 'other', en: 'Other' }] },
  { key: 'fluoride_paste', step: 'habits', type: 'yesno', en: 'Uses fluoride toothpaste' },
  { key: 'last_dental_visit', step: 'habits', type: 'choice', en: 'Last visit to a dentist', options: [
    { key: '<1y', en: 'Within a year' }, { key: '1-3y', en: '1–3 years' }, { key: '>3y', en: 'More than 3 years' }, { key: 'never', en: 'Never' }] },
];
export const QUESTION_STEPS = { teeth: 'extra', health: 'context', habits: 'risks' };
export const HABIT_OPTIONS = [{ key: 'never', en: 'Never' }, { key: 'former', en: 'Stopped' }, { key: 'current', en: 'Now' }];

// Questions to show for a person: active, matching their state, and their denture status.
export function questionsFor(step, { state, hasDenture } = {}) {
  return QUESTIONS.filter(q => q.step === step && q.active !== false && (!q.states?.length || q.states.includes(state)) && (q.when !== 'denture' || hasDenture));
}
// Clean answers for one step against the question list (unknown keys dropped; retired questions still accepted).
export function cleanAnswers(step, src = {}) {
  const out = {};
  for (const q of QUESTIONS.filter(q => q.step === step)) {
    const v = src?.[q.key];
    if (q.type === 'yesno') out[q.key] = v === true ? true : v === false ? false : null;
    else if (q.type === 'habit') out[q.key] = HABIT_OPTIONS.some(o => o.key === v) ? v : null;
    else if (q.type === 'choice') out[q.key] = (q.options || []).some(o => o.key === v) ? v : null;
    else if (q.type === 'number') { const n = Number(v); out[q.key] = v !== '' && v != null && Number.isInteger(n) && n >= (q.min ?? 0) && n <= (q.max ?? 999) ? n : null; }
    else if (q.type === 'text') { const s = String(v ?? '').trim().slice(0, 300); out[q.key] = s || null; }
  }
  return out;
}

export const STATES = ['Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Puducherry', 'Goa', 'Other'];
export const DISTRICTS = {
  'Kerala': ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'],
  'Tamil Nadu': ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur',
    'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
    'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'Karnataka': ['Bagalkote', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bengaluru South (Ramanagara)', 'Bidar', 'Chamarajanagar', 'Chikkaballapura', 'Chikkamagaluru',
    'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Shivamogga',
    'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir'],
  'Andhra Pradesh': ['Alluri Sitharama Raju', 'Anakapalli', 'Anantapur', 'Annamayya', 'Bapatla', 'Chittoor', 'Dr. B.R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur',
    'Kakinada', 'Krishna', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tirupati',
    'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  'Telangana': ['Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar',
    'Khammam', 'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal',
    'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri'],
  'Maharashtra': ['Ahilyanagar (Ahmednagar)', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar (Aurangabad)', 'Dharashiv (Osmanabad)',
    'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Palghar',
    'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
};
export const KERALA_DISTRICTS = DISTRICTS.Kerala;
export const ALL_DISTRICTS = Object.values(DISTRICTS).flat().sort();
export const validPincode = p => /^[1-9]\d{5}$/.test(String(p || '').trim());
export const LSGD_TYPES = [
  { key: 'grama_panchayat', en: 'Grama Panchayat', ml: 'ഗ്രാമപഞ്ചായത്ത്' },
  { key: 'town_panchayat', en: 'Town Panchayat', ml: 'ടൗൺ പഞ്ചായത്ത്' },
  { key: 'nagar_panchayat', en: 'Nagar Panchayat', ml: 'നഗർ പഞ്ചായത്ത്' },
  { key: 'municipality', en: 'Municipality', ml: 'മുനിസിപ്പാലിറ്റി' },
  { key: 'corporation', en: 'Municipal Corporation', ml: 'കോർപ്പറേഷൻ' },
  { key: 'other', en: 'Other', ml: 'മറ്റുള്ളവ' },
];
export const LOCATION_OVERRIDE_REASONS = [
  { key: 'lives_other_lsgd', en: 'Person lives in a different LSGD/ward from mine', ml: 'വ്യക്തി മറ്റൊരു തദ്ദേശ സ്ഥാപനത്തിൽ/വാർഡിൽ താമസിക്കുന്നു' },
  { key: 'temporary_stay', en: 'Temporary stay with family', ml: 'കുടുംബത്തോടൊപ്പം താൽക്കാലിക താമസം' },
  { key: 'camp_or_institution', en: 'Seen at a camp, care home or institution', ml: 'ക്യാമ്പ്, കെയർ ഹോം അല്ലെങ്കിൽ സ്ഥാപനത്തിൽ വെച്ച്' },
  { key: 'cover_for_colleague', en: 'Covering a colleague\'s area', ml: 'സഹപ്രവർത്തകയ്ക്ക് പകരം അവരുടെ പ്രദേശത്ത്' },
  { key: 'other', en: 'Other (explain in address)', ml: 'മറ്റുള്ളവ (വിലാസത്തിൽ വിശദീകരിക്കുക)' },
];

// Detect language from Unicode script. Returns an ISO 639-1 code.
export function detectLang(text, hint) {
  const s = String(text || '');
  const counts = {};
  const ranges = [
    ['ml', 0x0D00, 0x0D7F], ['ta', 0x0B80, 0x0BFF], ['kn', 0x0C80, 0x0CFF], ['te', 0x0C00, 0x0C7F],
    ['hi', 0x0900, 0x097F], ['bn', 0x0980, 0x09FF], ['gu', 0x0A80, 0x0AFF], ['pa', 0x0A00, 0x0A7F],
    ['or', 0x0B00, 0x0B7F], ['ur', 0x0600, 0x06FF],
  ];
  let latin = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { latin++; continue; }
    for (const [lang, lo, hi] of ranges) if (c >= lo && c <= hi) { counts[lang] = (counts[lang] || 0) + 1; break; }
  }
  let best = null, n = 0;
  for (const [k, v] of Object.entries(counts)) if (v > n) { best = k; n = v; }
  if (best === 'hi' && hint === 'mr') best = 'mr'; // Marathi and Hindi share the Devanagari script
  if (best && n >= latin * 0.3) return best;
  return latin ? 'en' : (best || 'en');
}

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

// Interface languages offered on the sign-in page (English is the default).
export const UI_LANGUAGES = ['en', 'ml', 'ta', 'kn', 'te', 'hi', 'mr'];
export const LANG_CODES = LANGUAGES.map(l => l.code);
