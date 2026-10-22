# Marathi (mr) pack audit — Vayosmitham

**Grade:** before **B+**, after **A−**. The pack is good, natural Maharashtra Marathi. I found **no Hindi words or Hindi grammar** (no है/में/और/के/सहमति/जाँच etc.). Every verb form is Marathi (आहे/नाही/करा/का). The notice, layers and deciders match the English legal meaning exactly, including withdrawal, research-only-with-separate-consent, retention, grievance and the DPB. The register (तुम्ही/तुमचे) is the same throughout. All placeholders are intact. The main problems were gender agreement, fragments joined to numbers or names, a few imprecise technical words, and term consistency.

## Changes by category (35 entries)
- Meaning: 3 (subject number, median, GOHAI pleased item)
- Clinical terminology: 3 (stroke, diabetes, OHAT summary)
- Register / plain language: 3 (GOHAI stem, habit status Stopped/Now)
- Consistency: 9 (indicators ×4, worker ×2, dpo, PDF label, मंजूर, field worker in the dentist note)
- UI fit / fragments / grammar: 15 (consent chips, Yours, Due, Next screening in, Reset PIN, photo-quality toast ×3, denture Complete, Sign in as…, Me, Play here, Answer all 12, PIN code)
- Script / technical: 0 needed. There are no broken conjuncts. ॲ is used correctly for "app" and "adhesive".

## Top 10 fixes (English → old → new — reason)
1. GOHAI stem "In the last 3 months, how often have you…" → «गेल्या 3 महिन्यांत, तुम्हाला किती वेळा…» → «गेल्या 3 महिन्यांत किती वेळा…». The dative तुम्हाला is ungrammatical with items 1, 6 and 8 (कमी केले, औषध घेतले), which need तुम्ही. A neutral stem fits all 12 items.
2. GOHAI "Been pleased or happy with the look…" → «…समाधानी किंवा आनंदी होतात?» → «…समाधान किंवा आनंद वाटला?». The old text was in the present tense and did not agree with the stem. It is now past tense, like the other items, and works with "how often".
3. "Given" / "Not given" (consent chips) → «दिले / दिले नाही» → «दिली / दिली नाही». संमती is feminine.
4. Research extract "coded subject number" → «सांकेतिक विषय क्रमांक» → «सांकेतिक सहभागी क्रमांक». विषय means "topic", not "research subject".
5. "median time to opinion" → «मध्यम (median)» → «मध्यगा (median)». मध्यम means "medium". मध्यगा is the Marathi statistical term.
6. "Indicators" (4 keys) → «निर्देशांक» → «निर्देशक». निर्देशांक means "index", as in a share-price index. Marathi public-health usage is आरोग्य निर्देशक.
7. "Stroke or paralysis" → «स्ट्रोक (पक्षाघात) किंवा लकवा» → «स्ट्रोक (मेंदूचा झटका) किंवा लकवा/अर्धांगवायू». पक्षाघात means paralysis, so it was the wrong gloss for stroke. People call a stroke मेंदूचा झटका.
8. "Next screening in" + "6 महिने" → «पुढील तपासणी 6 महिने» → «पुढील तपासणीपर्यंतचा कालावधी: 6 महिने». The old fragment read wrongly next to the number.
9. "Photo may be" + dark/bright → «फोटो कदाचित अंधारा, जास्त उजेड» → «फोटोत अडचण असू शकते: खूप अंधारलेला, खूप उजळ». The old string had no grammar, and अंधारा is not standard.
10. "Due" + date → «बाकी 12/10» → «नियोजित तारीख 12/10». बाकी means "remaining/balance". It does not mean a due date.

Other fixes:
- "Yours" (a case, प्रकरण, which is neuter) → तुमचे.
- "Reset the PIN for" {name}? → «PIN रीसेट करायचा का — {name}?»
- Denture "Complete" → «पूर्ण (सर्व दातांची)», to match "Partial".
- Tobacco/alcohol status → सोडले / सध्या.
- Diabetes → «मधुमेह (शुगर)», because older people say शुगर.
- "worker" role, "Question to worker" and the dentist-note «फील्ड कार्यकर्ती» → क्षेत्र कार्यकर्ता/कार्यकर्ती, for one term throughout.
- dpo → डेटा संरक्षण प्रमुख, the same as "Data protection lead".
- The unused "Write in English or Malayalam…" now says Marathi, as the hi and ta packs do.

## Remaining issues for a native speaker or field check
- **Habits list (product issue, not wording).** Maharashtra has common local forms that the options do not capture: **मिश्री** (roasted tobacco used to clean teeth, especially by women), **खर्रा / मावा** (Vidarbha/Nagpur), and tapkir (snuff). Consider adding मिश्री to "Cleans with" and खर्रा/मावा to the chewing-tobacco hint.
- "Field worker" = क्षेत्र कार्यकर्ता is correct but formal. Field teams may prefer «आरोग्य सेविका» or «आशा ताई». Ask the Maharashtra coordinators.
- «कीट (टार्टर)» for tartar is understood in western Maharashtra. Check that it is also understood in Vidarbha/Marathwada.
- «दातण काडी» (neem twig): दातवण / दातून vary by district.
- "Municipality" = नगरपरिषद is correct for Maharashtra. "Town/Nagar Panchayat" are both नगरपंचायत, which is fine.
- Plural fragments: "1 दिवसांपूर्वी" and "1 तासांपूर्वी" are grammatically plural, which is acceptable in a UI. The fix would need code support for singular forms.
- "urgent cases seen within" + "24 h (n)" is readable but stiff. It is only on the admin dashboard.
- In the notice, «आमच्या सूचनांनुसार» (instructions) uses the same word as सूचना (notice). This is acceptable, but «निर्देशांनुसार» would remove the ambiguity if counsel prefers.

## GOHAI note
I do not confidently know of a published, validated **Marathi** GOHAI, so I have not cited one. A Hindi GOHAI was validated by investigators in Nagpur (Deshmukh & Radke, c. 2012). Verify this citation before using it. Our Marathi items keep the meaning of the English GOHAI. The only change is the stem/tense fix above, which needs no validation. The 5-point scale is unchanged (नेहमी / बऱ्याच वेळा / कधी कधी / क्वचित / कधीच नाही). Before any research use, do a forward-backward translation and pilot it, or adopt a validated Marathi version if one is found.
