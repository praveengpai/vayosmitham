# Hindi (hi) pack audit — Vayosmitham

**Grade: B+ before → A− after.** The pack was already well written. It uses natural spoken Hindustani (सेहत, इलाक़ा, नकली दाँत, झनझनाहट, दवा के पत्ते), addresses the person as आप throughout, gets the clinical meaning right, and keeps all placeholders. The fixes are mostly about how fragments read next to numbers, a few wrong senses in option lists, the guardian term in the legal text, and keeping terms consistent.

## Changes (40 edits: ui 29, clinical 1, layers 4, deciders 2, notice 4 paragraphs/headings)
| Category | Count |
|---|---|
| Meaning errors (wrong sense / legal ambiguity) | 9 |
| Clinical / legal terminology | 5 |
| Register / plain language (consent + patient-facing) | 9 |
| Consistency (one term per concept) | 7 |
| UI fit (fragments next to numbers, grammar/gender) | 9 |
| Script / spelling (nukta, यदि→अगर) | 1 (also folded into others) |

## Top 10 fixes
1. **Complete** (denture type: None/Partial/Complete): पूरा हुआ → **पूरा सेट**. The old text meant "finished", which is the wrong sense in a denture-type choice.
2. **Notice §6, nominee right**: "अगर आप … असमर्थ हो जाएँ, या आपकी मृत्यु के बाद, तो आप … नामित कर सकते हैं" → "आप किसी व्यक्ति को नामित कर सकते हैं, जो आपके असमर्थ हो जाने पर या आपकी मृत्यु के बाद आपकी ओर से…". The old wording could be read as "after your death you can nominate".
3. **Lawful guardian** (deciders, notice §7, capacity help text): क़ानूनी अभिभावक → **क़ानूनी संरक्षक / गार्जियन**. In everyday Hindi अभिभावक means a child's parent. संरक्षक/गार्जियन is the word used for a guardian of an adult.
4. **Notice §4, emergency**: "…सूजन, … कठिनाई या ऐसा ख़ून बहना जो रुक न रहा हो, तो…" → "अगर चेहरे पर सूजन हो, साँस लेने में कठिनाई हो, या ख़ून बहना न रुके, तो तुरंत अस्पताल जाएँ". The old sentence was ungrammatical and had no condition clause.
5. **Photo may be** + problems: फ़ोटो शायद → **फ़ोटो शायद ठीक नहीं है:**. Before, the toast read "फ़ोटो शायद बहुत अंधेरी, धुंधली" with no verb.
6. **Next screening in** + "6 महीने": अगली जाँच → **अगली जाँच इतने समय बाद:**. Before, it read "अगली जाँच 6 महीने", with no "after/in".
7. **Due** + date: बाकी → **तय तारीख़**. "बाकी 12 Oct" reads as "remaining", which is the wrong sense.
8. **Stopped** (tobacco/alcohol: Never/Stopped/Now): बंद किया → **छोड़ दिया**. This is how people say they quit a habit.
9. **PIN code must be 6 digits**: डाक PIN कोड → **पिन कोड**. In this pack "PIN" is the login PIN and "पिन कोड" is the postal code, and the old text mixed the two.
10. **Please see a dentist in person** / **cannot assess…**: दाँतों के डॉक्टर से खुद जाकर मिलें → **कृपया ख़ुद जाकर डेंटिस्ट को दिखाएँ**. This keeps one term for "dentist" (डेंटिस्ट, as in the notice), uses the natural verb "दिखाना", and fixes the nukta.

Other fixes: coordinator समन्वयक→कोऑर्डिनेटर, field worker फ़ील्ड कार्यकर्ता→फ़ील्ड वर्कर, role labels `worker`/`dpo` aligned with "फ़ील्ड वर्कर"/"डेटा सुरक्षा प्रमुख", प्रति→कॉपी. The OHAT tongue item had a gender mismatch and is now neutral ("लाल और/या सफ़ेद धब्बा, छाला, सूजन"). Other changes: Charcoal or powder → कोयला/राख या मंजन (पाउडर); Impression अनुमान ("guess") → क्लिनिकल इम्प्रेशन; Teeth, dentures, function "काम-काज" → चबाना-निगलना-बोलना; Too unwell to travel → इतने बीमार कि जा नहीं सकते. Fragment order is fixed for "you have given N opinions" and "urgent cases seen within N h". In the optional consent layers, "वैकल्पिक" (form-Hindi) becomes "ज़रूरी नहीं, आपकी मर्ज़ी" for older listeners.

## Needs a native-speaker / field check
- **"Type in English or Malayalam"** is rendered as "अंग्रेज़ी या हिंदी" on purpose, and the ta/mr/kn/te packs adapt it the same way. Please confirm the name field and notes really accept Devanagari and translate it. The dentist-side string "Write in English or Malayalam" is kept literal.
- **डेंटिस्ट vs दाँत के डॉक्टर.** I standardised on डेंटिस्ट, which migrants in cities understand. Older rural listeners from UP/Bihar may follow "दाँत के डॉक्टर" better. Field-test this when the notice is read aloud.
- **जाँच** is used for both "screening" and "examination". That is natural in Hindi, but the dentist screens use them as separate concepts. Consider "स्क्रीनिंग" for the screening step if workers get confused.
- **Areca**: सुपारी is right, but Hindi speakers in Kerala/Karnataka may also know the local words. Bihari/Purvanchali migrants say "खैनी" for chewing tobacco, so consider "तंबाकू, खैनी, पान, गुटखा".
- **GOHAI "firm meat or apples"** is kept as in the source. Many Hindi-speaking elders are vegetarian, so field workers may need to give a local example (e.g. "सख़्त रोटी, भुने चने").
- **Notice heading "वयोस्मितम्"** has a Sanskrit halant. Plain "वयोस्मितम" may read more easily. This is cosmetic, so I left it.
- **Data Protection Board name.** Before legal sign-off, counsel should confirm "भारतीय डेटा संरक्षण बोर्ड" against the official Hindi text of the DPDP Act 2023 (the Gazette uses "भारतीय डाटा संरक्षण बोर्ड").
- **Local-body names** (Village/Town Panchayat for TN, Nagar Panchayat) are fine for a Hindi reader, but the Maharashtra terms (नगर परिषद) are not in the pack.

## GOHAI
A validated Hindi GOHAI exists: Jain R, Dupare R, Chitguppi R, Basavaraj P. *Assessment of validity and reliability of Hindi version of geriatric oral health assessment index (GOHAI) in Indian population.* Indian J Public Health 2015;59(4):272–278. doi:10.4103/0019-557X.169654 (n=420, age 55+, Cronbach's α 0.774). Our 12 items match the English meaning, and I did not change them. If the programme wants to report scores as "Hindi GOHAI", compare our item wording with the published version and get the authors' permission.
