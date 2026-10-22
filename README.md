# Vayosmitham — വയോസ്മിതം

Community geriatric oral health platform of **Community Innovation Foundation (CIF)** with the **Association of Geriatric Dentistry (AGeD)**.

Field health workers screen older people at home on a phone. Volunteer dentists review each case **without seeing who the person is**, and send back an opinion, a care plan and, when needed, a referral. The worker shows the opinion to the person in their own language, prints a verifiable referral report, and records whether the person reached care. The same person is re-screened over time, building a longitudinal record for policy.

## What is built

| Area | Features |
| --- | --- |
| Field worker (phone, works offline) | Enrolment with duplicate check; State/District/LSGD/ward defaulting from the worker's own profile, with a logged reason if changed; layered consent with capacity check and caregiver assent; read-aloud consent notice (Malayalam/English); warning-sign triage with same-day advice; OHAT (8 items); teeth and dentures; health and medicines with automatic dental drug warnings; habits; GOHAI (12 items); guided intraoral photos with blur/brightness check and EXIF removal; encrypted offline outbox (AES-GCM, key from PIN); follow-ups due; dentist questions; full-screen "show to the person" view; referral outcome |
| Dentist (laptop/tablet) | Queue of unseen cases only, urgent first; case lock (30 min, configurable) so two dentists never work on the same case; no name/phone/address anywhere; original text plus English machine translation side by side (toggle); photos with zoom; earlier visits of the same person; structured opinion; referral tick-box that fills a template letter; "cannot assess remotely"; education links from the knowledge base; ask the worker a question; corrections as new versions |
| Translation | Free text in any Indian script. English → Indian languages via IndicTrans2 (Cloudflare Workers AI); Indian → English via an instruction model; Bhashini (Government of India) is used automatically when its keys are added. Every translation is cached and labelled as machine translation. Glossary terms are shown alongside. |
| Report | A4 printable referral report with dentist name and registration number and a QR code; public `/v/<code>` page verifies a report without showing any patient details |
| Admin / coordinator | Dashboard (screened, time to opinion, urgent within target, referral completion, OHAT bands, teeth by age, GOHAI, districts, overdue cases); users and PIN resets; referral centres; knowledge base with approval; glossary; 1,034 Kerala local bodies (one click); settings; access log; consent log; indicator CSV with small-cell suppression |
| Clinical audit (AGeD) | Random sample of opinions (10%, configurable) for rating and safety review; feedback visible to the dentist |
| Research | De-identified extract (coded subject IDs, only people who gave research consent) |

## Architecture

- One Cloudflare Worker (`src/`) serves the API and the static app (`public/`).
- Three D1 databases:
  - `vayosmitham-identity` — users, people, consents (the identity vault)
  - `vayosmitham-clinical` — pseudonymised cases, screenings, opinions, audit log
  - `vayosmitham-media` — interim photo store until R2 is enabled
- Dentist code paths (`src/dentist.js`) never query the identity vault for patients.
- Front end: Preact + htm (vendored, no build step), service worker for offline use, IndexedDB outbox.
- Shared clinical rules (OHAT, GOHAI, red flags, medicine warnings) live in `public/shared/clinical.js` and are used by both browser and server.

## Running locally

```bash
npm install
npm run db:migrate:local
node scripts/user-sql.mjs '{"role":"admin","name":"Admin","phone":"9000000001","pin":"482913","must_change":0}' > /tmp/u.sql
npx wrangler d1 execute vayosmitham-identity --local --file /tmp/u.sql
npm run dev          # http://localhost:8787
npm run test:api     # end-to-end API test (needs worker/dentist/auditor test users, see scripts/api-test.mjs)
```

## Deploying

Pushing to `main` deploys through Cloudflare Workers Builds. Database changes go in `migrations/<db>/NNNN_name.sql` and are applied with `npm run db:migrate:remote` (needs a Cloudflare API token with D1 edit rights).

Optional secrets (Cloudflare dashboard → Workers → vayosmitham → Settings → Variables and secrets):

- `BHASHINI_USER_ID`, `BHASHINI_API_KEY` — switch translation to Bhashini.

To enable R2 photo storage: enable R2 on the account, create bucket `vayosmitham-media`, and uncomment the `r2_buckets` block in `wrangler.jsonc`.

## Before real patient data

- Legal review of the consent notice, dentist disclosure on reports, and data-sharing agreements (see the concept note and SRS).
- Change **Settings → Consent notice version** from the draft value once the reviewed notice is adopted (this removes the test-data banner).
- Enable R2, move to a paid plan, and raise `PBKDF2_ITER` in `src/auth.js`.
- Validate the Malayalam wording of OHAT, GOHAI and the interface with field staff.

## Licences

Code: licence to be chosen by CIF (an open licence such as Apache-2.0 is needed for Digital Public Good registration). Kerala local-body list: © OpenStreetMap contributors, ODbL 1.0, via the OSM Kerala community. Preact and htm (MIT), qrcode-generator (MIT).
