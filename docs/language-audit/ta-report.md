# Tamil (ta) pack audit — Vayosmitham

**Grade:** A− before → A after. The pack is fluent, natural Tamil Nadu Tamil. It uses நீங்கள்/உங்கள் consistently, keeps terms consistent (ஒப்புதல், பல் மருத்துவர், களப் பணியாளர், பரிந்துரை, கருத்து, பல் செட், ஈறு), and all placeholders are intact. The notice, layers and deciders match the English in every legal point: rights, withdrawal, research, retention and grievance. I found one real meaning error, plus a few fragment and wording problems.

## Changes (19 entries: 12 ui, 6 clinical, 1 notice line; layers and deciders unchanged)
- Meaning errors: 3 (Complete denture, Missing teeth, Next-screening fragment)
- Clinical terminology: 4 (Seldom, osteonecrosis, palliative, "refer" verb ×2 counted once)
- Register / plain language: 4 (GOHAI stem, dentist prompt, notice "reached treatment", LSGD reason)
- UI fit / fragments: 4 (Due, Me tab, Stopped, "you have given")
- Consistency: 2 (PIN குறியீடு, கைரேகை)
- Script/technical: 0. There are no wrong-script characters, double spaces or broken placeholders.

## Top 10 fixes (English → old → new)
1. **Complete** (denture type: None / Partial / Complete) → முடிந்தது ("finished") → முழுமையானது. Meaning error: this is a complete denture, not a finished task.
2. **Missing teeth, no denture** → பற்கள் இல்லை, பல் செட்டும் இல்லை ("no teeth") → பற்கள் விழுந்துள்ளன, பல் செட் இல்லை. Some missing teeth is not the same as having no teeth.
3. **Next screening in** + "6 மாதங்கள்" → அடுத்த பரிசோதனை → அடுத்த பரிசோதனை — இன்னும். The old text read "Next screening 6 months" with "in" dropped. Older people see this line.
4. **GOHAI stem** "how often have you…" → எத்தனை முறை ("how many times") → எவ்வளவு அடிக்கடி. This now matches the frequency scale (Always…Never).
5. **Seldom** (GOHAI scale) → எப்போதாவது → அரிதாக. The old word overlapped with "Sometimes" (சில நேரங்களில்), which blurred two scale points.
6. **Oral-cancer and pre-cancer red flags**: "Refer…" → பரிந்துரையுங்கள் (non-standard imperative) → பரிந்துரைத்து அனுப்புங்கள். This is clear action wording for ASHA-level workers.
7. **Due** + date (follow-up list) → நிலுவை ("arrears/outstanding dues") → வருகை நாள்.
8. **Stopped** (habit: Never / Stopped / Now) → நிறுத்தப்பட்டது (passive, "was stopped") → நிறுத்திவிட்டார் ("has given it up").
9. **Jaw osteonecrosis risk** → தாடை எலும்பு அழுகல் ("rotting") → தாடை எலும்புத் திசு இறப்பு (osteonecrosis). This is the correct medical register.
10. **Notice: "whether you reached treatment"** → சிகிச்சையை அடைந்தீர்களா (literal calque) → சிகிச்சைக்குச் சென்றீர்களா. This is plain spoken Tamil. The full notice array is resent with this one line changed.

Also changed:
- Me tab: நான் → என் கணக்கு
- you have given: → நீங்கள் வழங்கியவை
- Dentist prompt: now reads as a label, not a statement
- PIN கோடு → PIN குறியீடு (consistency)
- கைவிரல் ரேகை → கைரேகை (consistency)
- Palliative care: பாலியேட்டிவ் (நோய்த்தணிப்பு) instead of வலி நிவாரண, which meant "pain relief" and narrowed the meaning
- "different LSGD from mine": removed a comparative விட

## Left as is (deliberate)
- **"Type in English or Malayalam" hints** are rendered as "Tamil or English". This is a sensible localisation for TN field workers. Confirm the app accepts Tamil input and that translation from Tamil works.
- **Admin fields** that really mean Malayalam ("Title (Malayalam)", "Malayalam term") correctly stay மலையாளம்.
- **"Vayosmitham"** stays in Latin script in the notice. A Tamil text-to-speech voice may mispronounce it, so consider வயோஸ்மிதம் if the notice is read aloud by TTS.
- **சம்மதம்** for the caregiver's assent versus **ஒப்புதல்** for consent is kept as a useful distinction.

## Needs native-speaker / field check
- **Case = நேர்வு** is formal government Tamil. Dentists and coordinators usually say "கேஸ்". Check with AGeD TN dentists.
- **Tartar = காரை, plaque = பற்படலம் (plaque).** Confirm field workers understand these, or use "பல் காரை / அழுக்கு".
- **பல் செட்** is the right spoken word. "பொய்ப் பல்" is also common in southern districts, so it could go in the glossary.
- **ஆக்ரோஷம்** (OHAT pain: aggression) may be too Sanskritised for some workers. A plainer option is "கோபமாக நடந்துகொள்ளுதல்".
- **Local-body names for other states** (Gram/Nagar Panchayat) are transliterated. TN users see கிராம ஊராட்சி / பேரூராட்சி / நகராட்சி / மாநகராட்சி, which is correct.
- **"d ago" / "h ago"** use the singular நாள்/மணி நேரம் after numbers. This is acceptable in speech, but a stricter written form would need plural handling.
- **Chin:** "Lower jaw — chin down" uses தாடை for chin. முகவாய் is more precise, though தாடை is widely used.

## GOHAI note
A validated Tamil GOHAI exists. PubMed lists it as **GOHAI-Tml**: Appukuttan DP, Vinayagavel M, Balasundaram A, et al. *Linguistic adaptation and psychometric properties of Tamil version of General Oral Health Assessment Index-Tml.* Ann Med Health Sci Res. 2015;5(6):413–22. [doi:10.4103/2141-9248.177987](https://doi.org/10.4103/2141-9248.177987). It used forward/backward translation, Cronbach α 0.8 and test–retest 0.8–0.9, in 265 dental outpatients aged 20–70 in Chennai.

Caveat: the sample was urban, outpatient and partly younger adults. I did not have access to the item wording. Our 12 items are correct in meaning, including the positively worded items 3, 5 and 7. Recommendation: get the GOHAI-Tml items from the authors (SRM Dental College) and align the wording, or cite the scale as "adapted from GOHAI-Tml" if any differences are kept.
