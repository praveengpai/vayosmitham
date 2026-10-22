# Malayalam (ml) audit — Vayosmitham

**Scope:** `lang/ml.js` ui (622 strings), plus the inline `ml:` / `advice_ml` text in `shared/clinical.js` (OHAT, GOHAI, complaints, red flags, medicine flags, photo views, referral types, LSGD and location reasons) and `shared/consent.js` (notice, layers, deciders). `privacy.html` has no Malayalam.

**Grade:** before **B−** (the UI was mostly good, but the clinical inline text had many shortened translations that left out parts of the meaning) → after **A−** (still needs a native field check, see below).

**Changes:** 126 in total. 58 are ui keys. 68 are `inline` replacements (52 in clinical.js, 16 in consent.js). Each `old` was checked to occur exactly once, and both patched files pass `node --check`.
- Meaning errors and omissions (clinical and legal): ~79
- Clinical and lay terminology: ~10
- Register and plain language (older person, gender-neutral caregiver, her → their): ~11
- Consistency (sign in/out, PIN, പദ്ധതി, ദന്ത ഡോക്ടർ, വിവർത്തനം, print/save): ~20
- Grammar and UI fit (fragments, പ്രദേശത്ത്): ~6

## Top 10 fixes
1. **Red flag "ulcer >2 weeks" advice.** Old: "…ഡെന്റൽ കോളേജിലോ ജില്ലാ ആശുപത്രി ദന്ത വിഭാഗത്തിലോ കാണിക്കുക." New: adds "ഓറൽ മെഡിസിൻ ക്ലിനിക്കിലോ" and "ദന്ത ഡോക്ടറുടെ അഭിപ്രായത്തിനായി കാത്തിരിക്കരുത്." Reason: the most important instruction, "do not wait for the dentist", was missing.
2. **Red flag "bleeding" advice.** Old: "…നിൽക്കുന്നില്ലെങ്കിൽ ഇന്നുതന്നെ ആശുപത്രിയിൽ പോകുക." New: "…എന്നിട്ടും നിൽക്കുന്നില്ലെങ്കിലോ, വ്യക്തി രക്തം നേർപ്പിക്കുന്ന മരുന്ന് കഴിക്കുന്നുണ്ടെങ്കിലോ ഇന്നുതന്നെ…". Reason: the blood-thinner trigger was missing. The label also now says "വായിൽ നിന്ന്".
3. **Jaw osteonecrosis flag.** Old: "താടിയെല്ല് ക്ഷയ സാധ്യത". New: "താടിയെല്ല് നശിക്കാനുള്ള (ഓസ്റ്റിയോനെക്രോസിസ്) സാധ്യത — ബിസ്ഫോസ്ഫൊണേറ്റ്/ഡെനോസുമാബ്". Reason: in common speech "ക്ഷയം" means tuberculosis.
4. **"Complaint(s)" / "No complaint".** Old: പരാതി / പരാതിയില്ല. New: പ്രശ്നം / പ്രശ്നങ്ങൾ / പ്രശ്നമൊന്നുമില്ല (in the UI and in the clinical `checkup` item). Reason: പരാതി means a grievance, and the notice uses it for grievances.
5. **GOHAI item 11.** Old: "മറ്റുള്ളവരുടെ മുന്നിൽ ഭക്ഷണം കഴിക്കാൻ അസ്വസ്ഥത…". New: "പല്ലിന്റെയോ പല്ല്സെറ്റിന്റെയോ പ്രശ്നം കാരണം…മടിയോ ബുദ്ധിമുട്ടോ തോന്നാറുണ്ടോ?". Reason: the cause was missing. Items 6, 7, 8, 9, 10 and 12 also left out dentures, gums or "discomfort". All 12 items are now in the habitual form ‑ആറുണ്ടോ?, which fits the frequency answers (എപ്പോഴും…ഒരിക്കലുമില്ല).
6. **"Difficulty swallowing or choking".** Old: "…/ ശ്വാസം മുട്ടൽ". New: "…/ ഭക്ഷണം തൊണ്ടയിൽ കുടുങ്ങൽ". Reason: ശ്വാസം മുട്ടൽ means breathlessness or asthma, not choking on food, and choking matters for aspiration risk.
7. **Medical referral type.** Old: "ഡോക്ടറുടെ പരിശോധന (PHC)". New: "മെഡിക്കൽ പരിശോധന (ഫിസിഷ്യൻ / PHC)". Reason: everywhere else in the app ഡോക്ടർ means the dentist. The cannot-eat advice also now says "കുടുംബ ഡോക്ടറെയോ PHC-യെയോ" and adds the malnutrition risk.
8. **OHAT tongue level 0.** Old: "സാധാരണ, നനവുള്ളത്, പിങ്ക്". New: adds "പരുപരുത്തത്". Reason: a normal tongue is rough, so without this a worker may over-score it. Many other OHAT omissions were also fixed: "at corners", "shiny/rough", "person thinks mouth is dry", roots, "very worn", "named", "needs adhesive", denture plaque, "aggression". Tartar is now കക്ക rather than കറ (stain).
9. **"Optional" in the consent layers.** Old: "ആവശ്യമെങ്കിൽ മാത്രം" (means "only if needed"). New: "നിർബന്ധമില്ല". Reason: consent must show that the choice belongs to the person, not to the programme.
10. **"Yes".** Old: ഉണ്ട് ("there is"). New: അതെ. Reason: the generic Yes is used for "Can the person understand and decide?", where ഉണ്ട് is ungrammatical.

Other notable fixes:
- 20+ teeth: "20-ൽ കൂടുതൽ" (more than 20) → "20-ഓ അതിലധികമോ" (20 or more, which is the WHO indicator).
- Median is no longer called ശരാശരി (average).
- "An adult" was മുതിർന്ന വ്യക്തി, which is also used for "older person". It is now പ്രായപൂർത്തിയായ ഒരാൾ.
- Caregiver: പരിചാരകൻ (masculine) → പരിചരിക്കുന്നയാൾ (gender-neutral).
- Sign in and sign out now use the same terms everywhere (സൈൻ ഇൻ / സൈൻ ഔട്ട്). The old പുറത്തിറങ്ങുക means "go outdoors".
- PIN is always പിൻ and the postal code is always പിൻകോഡ്.
- Delete is now മായ്ക്കുക, so it no longer clashes with Skip (ഒഴിവാക്കുക).
- Charcoal → ഉമിക്കരി.
- The fragments "Photo may be", "Next screening in" and "Due" now read correctly next to their values.

## Not changed (tests depend on them)
`scripts/ui-test.py` matches these strings, so they were left as they are: സ്ത്രീ, പരിശോധനയും ദന്ത ഡോക്ടറുടെ…, വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ, അവർക്ക് മനസ്സിലാകുന്ന ഭാഷയിൽ…, പകർപ്പ്, ഇവയൊന്നുമില്ല, ചവയ്ക്കാൻ ബുദ്ധിമുട്ട്, ചേർക്കുക, വ്യക്തിയെ കാണിക്കുക, റഫറൽ റിപ്പോർട്ട്.

## Needs a native-speaker or field check
- **Short "ഡോക്ടർ" for the dentist.** About 25 field-worker strings use plain ഡോക്ടർ. I kept it because it is short and clear within the app. A field check should decide between "ഡോക്ടർ", "ദന്ത ഡോക്ടർ" and "ഡെന്റിസ്റ്റ്".
- **പല്ല്സെറ്റ് vs വെപ്പുപല്ല്.** പല്ല്സെറ്റ് is the common spoken word in central Kerala. North Kerala may also use വെപ്പുപല്ല്.
- **Colloquial terms to confirm with ASHAs.** കക്ക (tartar), പുളിപ്പ് (sensitivity), ഉമിക്കരി, മുറുക്കാൻ.
- **Pain and aggression wording for dementia.** ദേഷ്യം/അക്രമസ്വഭാവം in the OHAT pain item should be checked by the geriatric team.
- **GOHAI frequency form.** The new ‑ആറുണ്ടോ? phrasing should be cognitively pre-tested with about 10 older people before the pilot.
- **Code issues (not translation):**
  - The dentist case view shows raw denture values (`partial`, `complete`) after മുകളിൽ/താഴെ.
  - Admin table headers call `t('Accessibility')`, `t('Title')`, `t('Link')` and `t('Tags')`, which are not in the pack, so they show in English.
  - `OHAT_SOURCE` still says "Malayalam wording pending validation".
- **Programme word.** The notice now uses പദ്ധതി ("programme"), the same word as the UI. Counsel and the CIF approver should re-sign the ML notice after these changes, because the notice text changed.

## GOHAI note
A Malayalam GOHAI exists. Its reliability was tested in one pilot study: Shekhawat KS, Chauhan A, Koshy AA, Rekha P, Kumar H. *Reliability of Malayalam version of Geriatric Oral Health Assessment Index among institutionalized elderly in Alleppey, Kerala (India): A pilot study.* Contemp Clin Dent 2016;7(2):153–157. doi:10.4103/0976-237X.183050.
- n = 50 institutionalised elders; α = 0.677; ICC = 0.65, which is moderate. Item 12 had a negative item-total correlation.
- I did not see its item wording, so our items are our own back-checked translation, not the validated text.
- Recommendation: get the published GOHAI-m items, use them where they match, and cite them.
