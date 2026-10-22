# Telugu (te) pack audit — Vayosmitham

**Grade:** before **B+**, after **A−**. The pack is fluent and consistently uses మీరు. Clinical meaning is mostly accurate. The main problems were a few wrong-sense words, mixed terms for "notice" and "consent" on the printable form, and Sanskritised words in the consent layers.

## Changes by category (35 entries: 27 ui, 3 clinical, 5 layers, notice array)
| Category | Count |
|---|---|
| Meaning errors | 7 (No, Complete, Partial, layer "purposes", gauze, PIN code ×3 counted as 1) |
| Clinical terminology | 5 (Findings ×2, gum overgrowth, stroke, What the dentist sees) |
| Register / plain language | 9 (4 layer helps "ఐచ్ఛికం"→"మీ ఇష్టం", notice "అశక్తులైతే", bureaucratic "ఇవ్వడమైనది", Last visit label, Someone helps, notice heading) |
| Consistency | 9 (సూచన పత్రం→నోటీసు ×3, అంగీకార→సమ్మతి ×2, క్షేత్ర కార్యకర్త→ఆరోగ్య కార్యకర్త, దంత వైద్యుడిని→దంత వైద్యులను, dpo label, "reached treatment") |
| UI fit / grammar | 6 (Broken plural, Next screening fragment, imperative -ండి ×3, inactive, "చూశాను") |
| Script / technical | 0 (no wrong-script characters, double spaces or placeholder damage found) |

## Top 10 fixes (English → old → new)
1. **Denture "Complete"** → పూర్తయింది → పూర్తి సెట్. The old text meant "finished", but here it means a complete denture.
2. **"No"** (Yes/No in tables) → కాదు → లేదు. కాదు means "is not"; లేదు is the right negative answer.
3. **Layer `care` help** "Covers purposes 1–4" → …1–4 ప్రయోజనాలు… → …1–4 ఉద్దేశాలు… ప్రయోజనాలు means "benefits", which changes the legal meaning.
4. **Bleeding red flag** "clean gauze" → గాజు గుడ్డ (గాజ్) → గాజ్ గుడ్డ (కట్టు కట్టే గుడ్డ). గాజు means glass.
5. **"PIN code (optional)"** and the other postal-code labels → PIN కోడ్ → పోస్టల్ PIN కోడ్. Without "postal", field workers confuse it with the login PIN. The validation message already said పోస్టల్.
6. **Denture "Partial"** → పాక్షిక → కొన్ని పళ్ళకే (పాక్షిక). A bare adjective is unclear to field workers.
7. **Printable consent form, 3 strings** → సూచన పత్రం → నోటీసు. This matches the notice heading and the UI ("గోప్యతా నోటీసు").
8. **"Consent record" / "Include consent form"** → అంగీకార… → సమ్మతి… సమ్మతి is used for consent everywhere else. అంగీకారం is kept only for caregiver *assent*.
9. **Notice, rights bullet 3** → మీరు అశక్తులైతే … నియమించవచ్చు → మీరు స్వయంగా చేయలేని స్థితికి వస్తే … నామినేట్ చేయవచ్చు (పేరు చెప్పవచ్చు). This is plainer, and it matches the decider "నామినేట్ చేసిన వ్యక్తి".
10. **Consent layer helps** "Optional." → ఐచ్ఛికం → మీ ఇష్టం (తప్పనిసరి కాదు). Older people hear these lines, and ఐచ్ఛికం is a bookish word. The UI form hints keep ఐచ్ఛికం because field workers know it.

Other notable fixes:
- "Broken" (dentures) → విరిగిపోయాయి, plural to match the other options.
- "Stroke or paralysis" → స్ట్రోక్ / పక్షవాతం. The word "stroke" was missing before.
- "May cause gum overgrowth" → అతిగా పెరిగేలా (ఉబ్బేలా).
- "What the dentist sees" / "Findings" → గమనించినది / పరీక్షలో గమనించినవి. The old కనుగొన్నవి was too literal.
- "Next screening in" was reworded so it reads correctly before "N నెలలు".

## Andhra–Telangana word choices (neutral forms chosen)
- **pan:** "పాన్/కిళ్ళీ". కిళ్ళీ is mainly Andhra; పాన్ is used across Telangana and Hyderabad.
- **areca nut:** వక్క is kept; it is understood in both states. The bracketed "పోక చెక్క" is mainly coastal Andhra and could be dropped if it confuses people.
- **twig brush:** "వేప పుల్ల" is kept; it is common to both states.
- **gums, tartar and dentures:** "చిగుళ్ళు", "గార" and "కట్టుడు పళ్ళు" are kept; all three are understood in both states. Some Telangana speakers say "పళ్ళ సెట్" for dentures.
- **choking:** "పొలమారడం" is kept. It is understood in both states.
- **loanwords:** షుగర్, BP, ఇన్ఫెక్షన్, రిఫరల్, స్క్రీనింగ్, క్యాంపు and సేవ్ are kept as loanwords. Field workers in both states use them.

## Remaining issues for a native speaker or field check
- **Caregiver vs lawful guardian.** "సంరక్షకులు" means both caregiver and guardian; only the qualifier చట్టబద్ధమైన separates them. Field-test whether a separate word for caregiver (for example "చూసుకునేవారు") is clearer. Changing it would touch about 10 strings.
- **Follow-up.** "తదుపరి సందర్శన" (literally "next visit") is used for follow-up. ASHAs commonly say "ఫాలో-అప్", so confirm the preference with coordinators in AP and TS.
- **Malayalam typing hints.** Several hints that say "Malayalam" in English have been localised to "Telugu" (for example "Type in English or Malayalam" → ఇంగ్లీష్ లేదా తెలుగులో). Confirm that Telugu typing and translation of notes is actually supported. If not, the hints promise something the app cannot do.
- **Legal review.** The notice should get a legal read-back by a Telugu-speaking reviewer. My check found no meaning differences from the English beyond the fixes above.
- **GOHAI wording.** The GOHAI items are worded as yes/no questions ("…వచ్చిందా?") while the answers are frequency options. This is acceptable in spoken use. Check it during a pilot with 5–10 older people for comprehension.
- **"Impression" (dentist/admin).** It is translated as "అభిప్రాయ సారాంశం". Dentists may prefer "ప్రాథమిక అంచనా" or the English word.

## GOHAI note
I do not know a published, validated Telugu GOHAI with confidence, so I give no citation. Validated Indian versions exist for other languages, such as Hindi. Before any research use, check whether a validated Telugu version exists and adopt it. If none exists, plan forward/back translation and psychometric validation (Cronbach's α, test–retest). The current wording was kept because it is semantically faithful to Atchison & Dolan's 12 items, and its scoring direction is correct (items 3, 5 and 7 are positively worded).
