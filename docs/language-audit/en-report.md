# Vayosmitham English source audit (en)

**Grade: A−.** The English is plain, consistent and clinically correct. It uses Indian/British spelling throughout (programme, organisation, behavioural). The OHAT and GOHAI wording follows Chalmers 2005 and Atchison & Dolan 1990 closely. The approved notice (2026-10-22-v2) has no typos or grammar errors. I found one grammar error that should be fixed. Everything else is advisory.

## Must-fix (1)
1. **clinical.js, GOHAI item 12.** "Had your teeth or gums sensitive to hot, cold or sweets?" → "Found your teeth or gums sensitive to hot, cold or sweets?"
   - Reason: grammar. The question is read after the stem "In the last 3 months, how often have you…", which gives "have you had your teeth or gums sensitive". That is not grammatical, and an interviewer will reword it on the spot. The new wording keeps the meaning of the validated item ("were your teeth or gums sensitive…").
   - Knock-on: this string is also a key in the `clinical` section of all six packs. Re-key it there (keep the existing translations).

No UI keys need renaming. No consent.js text needs changing.
## Advisory (do not change keys unless bundled with other work)
- **Stale UI keys (14, unused anywhere in the code).** Remove them from the packs:
  - "Use this person " (trailing space; a duplicate of "Use this person")
  - "Caregiver giving assent" and "Enter the name of the caregiver giving assent". Legally wrong: assent comes from the person who lacks capacity, and the substitute decider gives *consent*.
  - "Ask a family member or caregiver to agree on their behalf…"
  - "Can the person understand and decide for themselves?"
  - "I explained this information and answered their questions"
  - "Optional. Name and contact details are never shared." This contradicts the notice, which says the referral report shows the name to the clinic.
  - "The person agrees to", "Needed to continue", "6-digit PIN code", "Choose your language", "Village Panchayat", "Gram Panchayat"
  - "Write in English or Malayalam. The field worker sees…"
- **Language hints say "Malayalam" in all six states.** Affected keys: "Type in English or Malayalam", "Type in Malayalam or English. The dentist sees…" and "You can type in Malayalam or English. To add…". Translators will copy "Malayalam" into the Tamil, Kannada and other packs. Next time keys change, use "your own language", as the dentist screen already does.
- **PIN vs PIN code.** "PIN code (optional)" means the postal code and "6-digit PIN" means the login PIN. Both are 6-digit numeric fields, so a worker could type their login PIN into a person's record. Consider "Postal PIN code" in a later key revision.
- **Visit-type and status enums are shown raw** through `t(c.visit_type)` and `t(s)`: "followup", "baseline", "problem", "lost", "died". In the English UI the worker sees "followup" (should be "follow-up"), and "lost" is unclear (it means "lost to follow-up"). Fix this with a display map in code, not by renaming the keys, because the keys are data values.
- **OHAT dentures level 0, "worn regularly and named".** This is faithful to Chalmers, but field workers may not know that "named" means the person's name is marked on the denture. Add that explanation to the training material.
- **OHAT dashboard bands** ("0–2 healthy, 3–6 some changes, 7+ unhealthy"). These cut-offs are set by the programme, not by Chalmers. AGeD governance should confirm them, and the dashboard should say they are programme bands.
- **GOHAI "Seldom"** is hard for low-literacy listeners. "Rarely" is plainer. Translators should use the plain spoken word.
- **Areca nut terms.** The UI uses "Areca nut (adakka)" (adakka is Malayalam) and the 'patch' advice says "tobacco or areca". Prefer "areca nut" in both places and drop "adakka" outside Kerala.
- **"Chewing tobacco, pan, gutka".** "paan" is clearer than "pan". Optional.
- **Apostrophes are mixed:** "Dentist's opinion" uses a straight apostrophe and "Field worker’s note" uses a curly one. This is cosmetic, but the two must stay byte-exact as keys.
- **"Relation" (UI) vs "relationship" (notice and printed form).** Harmonise at the next key revision.
- **Notice (advisory only; the approved text is unchanged):**
  - "whether you reached treatment" would read more naturally as "got treatment".
  - "her coordinator" assumes every field worker is a woman.
  - The provider list mixes companies with a service ("machine translation of notes").
  - The capacity section names only a guardian or a close family member as decider, but the decider list also offers "Person nominated earlier by the older person". Ask counsel to align the two in v3.
- **Consent layer label** "ABHA health ID link" is in `consentLabel()` but has no UI key. It is not displayed today. Add the key before ABHA is enabled.

## Core terminology (use one term per concept)
| # | Concept | Use | Avoid |
|---|---|---|---|
| 1 | Participant | older person / the person | patient, beneficiary |
| 2 | Community worker (staff screens) | field worker | volunteer, ASHA |
| 3 | Same, in person-facing text (notice, printed form) | health worker | — |
| 4 | Remote reviewer | dentist (AGeD volunteer dentist) | doctor, specialist |
| 5 | Supervisor | coordinator | — |
| 6 | Family helper | caregiver | carer, attendant |
| 7 | Substitute decision-maker | person deciding for them | assent, caregiver giving assent |
| 8 | Agreement | consent / withdraw consent | permission, assent |
| 9 | Data-protection text | privacy notice | consent form (except the printed form itself) |
| 10 | Field activity | visit / follow-up visit | case (for workers), checkup |
| 11 | Remote output | dentist’s opinion: an advisory screening opinion, not a diagnosis or prescription | diagnosis, report (except the printed report) |
| 12 | Sending onward | referral / referral report / referral centre | reference |
| 13 | Red flags | warning signs | danger signs, red flags (in UI) |
| 14 | Priority | urgent / routine | emergency (reserve for hospital-now advice) |
| 15 | Own teeth | natural teeth | real teeth |
| 16 | Prosthesis | denture(s), upper / lower | set, false teeth |
| 17 | Lesions | sore, ulcer or patch | lesion (only in dentist-facing text) |
| 18 | Mouth examination | Look in the mouth (OHAT) | OHAT alone in worker text |
| 19 | Quality of life | How teeth affect daily life (GOHAI) | GOHAI alone in worker text |
| 20 | Area | local body (LSGD) and ward; Person ID | panchayat (generic), patient ID |
