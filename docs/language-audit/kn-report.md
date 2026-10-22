# Kannada (kn) pack audit — Vayosmitham

**Grade before:** B+. The pack is fluent and clinically sound, and it uses Karnataka terms throughout (ಹಲ್ಲಿನ ಸೆಟ್, ವಸಡು, ಹುಳುಕು, ಕಿಟ್ಟ, ಸಕ್ಕರೆ ಕಾಯಿಲೆ, ಗ್ರಾಮ ಪಂಚಾಯಿತಿ, ಪುರಸಭೆ, ಮಹಾನಗರ ಪಾಲಿಕೆ). The notice and consent layers match the English, with no gaps in legal meaning. A few UI meaning errors and fragment problems remain.
**Grade after:** A−

## Changes by category (40 entries: 30 ui, 6 clinical, 4 layers; notice array replaced for 6 small edits)
| Category | Count |
|---|---|
| Meaning errors | 7 |
| Clinical terminology / clarity | 5 |
| Register / plain language (elders, consent) | 9 |
| Consistency (one term per concept) | 9 |
| UI fit / fragments next to numbers or dates | 8 |
| Grammar / honorific agreement / typos | 4 |

## Top 10 fixes (English → old → new)
1. **From / To** (date filter) → ಇಂದಿನಿಂದ / ಇಲ್ಲಿಯವರೆಗೆ → ಆರಂಭ ದಿನಾಂಕ / ಕೊನೆಯ ದಿನಾಂಕ. The old "ಇಂದಿನಿಂದ" means "from today", which is wrong.
2. **Complete** (denture type: none/partial/complete) → ಪೂರ್ಣಗೊಂಡಿದೆ ("finished") → ಪೂರ್ಣ. The old word was the wrong sense for a complete denture.
3. **Research extract: "coded subject number"** → ಕೋಡ್ ಮಾಡಿದ ವಿಷಯ ಸಂಖ್ಯೆ ("topic number") → ಕೋಡ್ ಮಾಡಿದ ಭಾಗವಹಿಸುವವರ ಸಂಖ್ಯೆ. This "subject" means a study participant, not a topic.
4. **GOHAI "Often"** → ಆಗಾಗ್ಗೆ → ಹಲವು ಬಾರಿ. ಆಗಾಗ್ಗೆ also means "now and then", which overlaps with ಕೆಲವೊಮ್ಮೆ (Sometimes) and blurs the 5-point scale.
5. **GOHAI Q4 "prevent you from speaking…"** → …ಮಾತನಾಡಲು ಆಗಲಿಲ್ಲವೇ? → …ಮಾತನಾಡಲು ತೊಂದರೆ ಆಯಿತೇ?. The negative question made "Always/Never" answers ambiguous.
6. **May cause gum overgrowth** → ವಸಡು ಬೆಳೆಯುವಂತೆ ("gums grow") → ವಸಡು ಅತಿಯಾಗಿ ಬೆಳೆಯುವಂತೆ (ಉಬ್ಬುವಂತೆ). The old text dropped "over-", so the medicine flag lost its meaning.
7. **Home-based dental visit (bedbound)** → …ದಂತ ಚಿಕಿತ್ಸೆ ("treatment") → …ದಂತ ವೈದ್ಯರ ಭೇಟಿ. The referral is for a visit, and "treatment" overstated it.
8. **Female / Male** → ಹೆಣ್ಣು / ಗಂಡು → ಮಹಿಳೆ / ಪುರುಷ. The old words are blunt for older people and appear on the patient view.
9. **Optional layer help (photos, research, messaging, ABHA)** → ಐಚ್ಛಿಕ → ಬೇಕಿದ್ದರೆ ಮಾತ್ರ. These are read aloud to elders, so a plain spoken phrase replaces the Sanskritised word. This matches the Malayalam "ആവശ്യമെങ്കിൽ മാത്രം".
10. **Notice "under our instructions"** → ನಮ್ಮ ಸೂಚನೆಗಳ ಪ್ರಕಾರ → ನಮ್ಮ ನಿರ್ದೇಶನದಂತೆ. ಸೂಚನೆ is the pack's word for "notice", so the old phrase was ambiguous inside the notice. In the same line, "stores" changed from ಸಂಗ್ರಹಿಸುತ್ತದೆ (also "collects") to ಶೇಖರಿಸಿ ಇಡುತ್ತದೆ.

Other fixes:
- **Fragments:** 'Next screening in' + N months, 'Due' / 'Next screening due' + date, 'Photo may be' + problems and 'urgent cases seen within' + hours now read correctly before the value.
- **Postal PIN code:** "ಅಂಚೆ ಪಿನ್ ಕೋಡ್" is now used throughout, so it cannot be confused with the login PIN.
- **Field worker:** 'worker' is now ಕ್ಷೇತ್ರ ಕಾರ್ಯಕರ್ತೆ and the consent form uses ಆರೋಗ್ಯ ಕಾರ್ಯಕರ್ತೆ, matching the notice. 'dpo' is aligned with 'Data protection lead'.
- **Honorific agreement:** ತನ್ನ…ನೋಡುತ್ತಾರೆ is now ತಮ್ಮ.
- **Grammar:** fixed in 'Skip — the person cannot answer today' and the front-photo instruction.
- **Plainer verbs:** bookish passives (ತೋರಿಸಲ್ಪಡುವುದಿಲ್ಲ, ಕಳುಹಿಸಲ್ಪಡುತ್ತವೆ) replaced with plain verbs.
- **Small edits:** median is now ಮಧ್ಯಾಂಕ, powder is now ಹಲ್ಲುಪುಡಿ, the 'Me' tab is now ನನ್ನ ವಿವರ, the OHAT "named" denture is clarified, and the notice heading ಇದು ಏನು ಅಲ್ಲ is now ಇದು ಏನಲ್ಲ.
- **Notice verb forms:** ಪಡೆದಿರೋ is now ಪಡೆದಿದ್ದೀರೋ/ಪಡೆದಿದ್ದೀರಾ. "Nominate" is now plain ಹೆಸರಿಸಬಹುದು (ನಾಮನಿರ್ದೇಶನ).

All placeholders ({org}, {address}, {gName}, {gPhone}, {gEmail}, {years}, {days}) were checked and are unchanged.

## Needs a native speaker or field check
- **Plaque and tartar words:** ಪಾಚಿ (ಪ್ಲೇಕ್) and ಕಿಟ್ಟ (ಟಾರ್ಟರ್) are colloquial and fine in North and Central Karnataka. In coastal and Mysuru districts, check whether workers prefer "ಹಲ್ಲಿನ ಕೊಳೆ" for plaque.
- **Sensitivity:** check whether elders say ಜುಮ್ಮೆನಿಸುವುದು or "ಜುಂ ಅನ್ನುವುದು" for tooth sensitivity.
- **Local body types:** Karnataka also has **ನಗರಸಭೆ** (City Municipal Council) and **ಪಟ್ಟಣ ಪಂಚಾಯಿತಿ**. The LSGD list may need a ನಗರಸಭೆ type, which needs a code change and is not a translation fix.
- **ಪಾಲಕರು (guardian):** this is the legal term used in the Kannada Guardians and Wards Act, but lay listeners may hear it as "parents". Consider adding "(ಗಾರ್ಡಿಯನ್)" after legal review.
- **ಕುಂದುಕೊರತೆ (grievance):** this is the standard government term. Check that rural elders understand it; ದೂರು is the plainer fallback.
- **GOHAI item form:** the items are worded as yes/no questions ("…ಮಾಡಿದ್ದೀರಾ?") but are answered on a frequency scale. This works after the lead-in "ಕಳೆದ 3 ತಿಂಗಳಲ್ಲಿ ನೀವು ಎಷ್ಟು ಬಾರಿ…", but a cognitive-interview pilot with 5–10 elders is advised.
- **Impression:** the dentist field label ಅನಿಸಿಕೆ is acceptable. Check whether AGeD Karnataka dentists prefer "ಕ್ಲಿನಿಕಲ್ ಇಂಪ್ರೆಷನ್".
- **'Reset the PIN for' + name + '?':** this reads as an imperative followed by a question mark. It is minor and admin-only, so it was left unchanged.
- **Unchanged Malayalam references:** 'Name in Malayalam', 'Malayalam term' and 'Title (Malayalam)' in admin refer to the ml data fields and were deliberately not changed to Kannada.

## GOHAI note
I know of no published, validated Kannada GOHAI that I can cite confidently. Indian validations exist for other languages, such as Hindi and Malayalam, but I will not name a Kannada citation from memory. Before any research use, search PubMed for "GOHAI Kannada" and ask AGeD Karnataka or the dental colleges in Bengaluru, Davangere and Manipal. The current Kannada wording was kept, apart from fixes 4 and 5.
