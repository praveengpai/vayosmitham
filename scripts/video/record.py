#!/usr/bin/env python3
"""Record the Vayosmitham walkthrough: screenshots of every role on the demo data, with the boxes to zoom
and highlight, and the narration for each scene. Output: OUT/scenes.json + OUT/NN.png
Usage: BASE=http://localhost:8788 OUT=/path python3 scripts/video/record.py
"""
import json, os, pathlib, re
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8788')
OUT = pathlib.Path(os.environ['OUT']); OUT.mkdir(parents=True, exist_ok=True)
PIN = '246810'
PHOTO = str(pathlib.Path(__file__).resolve().parents[2] / 'demo' / 'mouth-front.jpg')
scenes, errors = [], []

def box(page, loc, pad=6):
    try:
        loc = loc.first
        loc.scroll_into_view_if_needed(timeout=3000)
        b = loc.bounding_box()
        if not b: return None
        dpr = page.evaluate('devicePixelRatio')
        return [round((b['x'] - pad) * dpr), round((b['y'] - pad) * dpr), round((b['width'] + 2 * pad) * dpr), round((b['height'] + 2 * pad) * dpr)]
    except Exception as e:
        errors.append(f'box: {e}'); return None

def scene(page, device, say, focus=None, highlights=(), click=None, scroll_to=None, hold=0.6):
    """focus/highlights/click: locators (resolved to boxes after scrolling). The first highlight is scrolled into view."""
    if scroll_to is not None: scroll_to.first.scroll_into_view_if_needed(timeout=3000); page.wait_for_timeout(250)
    hb = [box(page, h) for h in highlights]
    fb = box(page, focus, 30) if focus is not None else None
    cb = box(page, click, 0) if click is not None else None
    page.wait_for_timeout(250)
    n = len(scenes) + 1
    name = f'{n:02d}.png'
    page.screenshot(path=str(OUT / name))
    scenes.append({'img': name, 'device': device, 'say': ' '.join(say.split()), 'focus': fb, 'highlights': [h for h in hb if h], 'click': cb, 'hold': hold})
    print(n, device, say[:60])

def login(page, phone, english=True):
    page.goto(BASE + '/'); page.wait_for_selector('input[type=tel]')
    if english: page.locator('.lang-pick button', has_text='English').click(); page.wait_for_timeout(300)
    page.fill('input[type=tel]', phone); page.fill('input[type=password]', PIN)
    page.click('button.btn.primary'); page.wait_for_selector('header.top', timeout=15000); page.wait_for_timeout(1200)

with sync_playwright() as p:
    b = p.chromium.launch()
    phone = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    desk = lambda: b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1.5)
    w = phone.new_page(); w.on('pageerror', lambda e: errors.append(f'worker: {e}'))
    nxt = lambda: (w.locator('.wizard-foot .btn.primary').click(), w.wait_for_timeout(450))

    # ---------- 1. Sign-in ----------
    w.goto(BASE + '/'); w.wait_for_selector('input[type=tel]'); w.wait_for_timeout(800)
    scene(w, 'phone', """Welcome to Vayosmitham — a community oral health programme for older people, by Community Innovation Foundation
      with the Association of Geriatric Dentistry. Field workers screen older people at home, and volunteer dentists review each case online.
      This walkthrough uses the demo site, where every person and every record is fictional.""", focus=w.locator('.login-card'))
    scene(w, 'phone', """The app works in seven languages. The language is chosen right here on the sign-in page, and the phone remembers it.""",
      focus=w.locator('.lang-pick'), highlights=[w.locator('.lang-pick')])
    w.locator('.lang-pick button', has_text='മലയാളം').click(); w.wait_for_timeout(700)
    scene(w, 'phone', """Tap Malayalam, and every screen, button and question changes at once. Tamil, Kannada, Telugu, Hindi and Marathi work the same way.""",
      focus=w.locator('.login-card'), click=w.locator('.lang-pick button', has_text='മലയാളം'))
    w.locator('.lang-pick button', has_text='English').click(); w.wait_for_timeout(500)
    scene(w, 'phone', """Staff sign in with their mobile number and a six-digit PIN. On the demo site, the demo accounts are listed below — tap one to sign in.""",
      focus=w.locator('.demo-accounts'), highlights=[w.locator('input[type=tel]'), w.locator('input[type=password]')], scroll_to=w.locator('.demo-accounts'))

    # ---------- 2. Field worker ----------
    login(w, '9000100011')
    scene(w, 'phone', """This is the field worker's home screen. At a glance she sees dentist opinions that are ready to share, visits waiting for a dentist,
      questions from dentists, follow-up visits that are due, and referrals to check on.""", focus=w.locator('main'))
    w.click('a[href="#/visit"].btn'); w.wait_for_timeout(600)
    w.fill('input[type=text] >> nth=0', 'Kamalakshi Amma'); w.locator('label.choice', has_text='Female').click()
    w.fill('input[type=number] >> nth=0', '78'); w.fill('input[type=text] >> nth=1', 'House 14, Ward 12 (demo)')
    scene(w, 'phone', """A new visit starts with the person's details. The State, District, local body and ward are filled in from the worker's own area,
      and can be changed only with a reason. The postal PIN code is optional.""", focus=w.locator('main'))
    nxt()
    scene(w, 'phone', """Next comes consent. The privacy notice is shown in the person's language, can be read aloud by the phone, and a printed copy can be offered.""",
      focus=w.locator('.notice'), highlights=[w.locator('button', has_text='Read aloud')])
    w.locator('label.choice.block', has_text='പരിശോധനയും ദന്ത ഡോക്ടറുടെ').click()
    w.locator('label.choice.block', has_text='വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ').click()
    w.locator('label.choice.block', has_text='explained this information').click()
    w.locator('label.choice.block', has_text='offered them a copy').click()
    scene(w, 'phone', """Each use of the data is a separate tick box, and none is ticked in advance — care, photographs, research and messages.
      If the person cannot decide for themselves, the worker records who is deciding for them.""",
      highlights=[w.locator('label.choice.block', has_text='പരിശോധനയും ദന്ത ഡോക്ടറുടെ'), w.locator('label.choice.block', has_text='വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ')])
    nxt()
    w.locator('label.choice.block', has_text='Ulcer, sore or lump').click(); w.wait_for_timeout(300)
    scene(w, 'phone', """Then the warning signs. If any is present — here, an ulcer for more than two weeks — the visit is marked urgent,
      and advice for the same day appears at once, without waiting for a dentist.""", highlights=[w.locator('.callout.urgent')], click=w.locator('label.choice.block', has_text='Ulcer, sore or lump'))
    w.locator('label.choice.block', has_text='Ulcer, sore or lump').click(); w.locator('label.choice.block', has_text='None of these').click(); nxt()
    w.locator('label.choice', has_text='Denture loose').click()
    w.fill('textarea', 'താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു, ചവയ്ക്കാൻ പറ്റുന്നില്ല')
    scene(w, 'phone', """Complaints are tapped from a list. The worker can also type the person's own words in her own language — the dentist will see the original,
      with a translation. She can add a short voice note in her own voice, too.""", highlights=[w.locator('textarea'), w.locator('button', has_text='Record voice')])
    nxt()
    for sc in w.locator('.scale').all(): sc.locator('button').nth(0).click()
    w.locator('.scale').nth(5).locator('button').nth(2).click(); w.locator('.scale').nth(2).locator('button').nth(1).click()
    scene(w, 'phone', """The mouth check uses the Oral Health Assessment Tool. For each of eight areas, the worker picks the picture-like description that fits best.
      The score is added up automatically.""", highlights=[w.locator('.panel').nth(5)], scroll_to=w.locator('.panel').nth(5))
    nxt()
    w.fill('input[type=number]', '6'); w.locator('.choices').nth(0).locator('label.choice').nth(2).click(); w.locator('.choices').nth(1).locator('label.choice').nth(2).click()
    w.wait_for_timeout(300)
    scene(w, 'phone', """Teeth and dentures: the number of natural teeth, upper and lower dentures, and how they fit. When there is a denture,
      questions on denture care appear — like whether it is taken out at night.""", highlights=[w.locator('label.field', has_text='taken out at night').or_(w.locator('.row', has_text='out at night'))],
      scroll_to=w.locator('text=How are the dentures cleaned?'))
    nxt()
    w.fill('input[list=med-list]', 'Amlodipine'); w.locator('button', has_text='Add').click(); w.wait_for_timeout(300)
    scene(w, 'phone', """Health questions follow, and the medicines the person takes. Medicines that matter to the dentist are flagged automatically —
      here, a blood-pressure tablet that can cause gum overgrowth.""", highlights=[w.locator('.callout.info').last], scroll_to=w.locator('.callout.info').last)
    nxt()
    scene(w, 'phone', """Habits include tobacco, areca nut and local forms like khaini. Questions can be shown only in the states where they apply.""", focus=w.locator('main'))
    nxt()
    scene(w, 'phone', """The twelve daily-life questions of the Geriatric Oral Health Assessment Index show how teeth affect eating, speaking and comfort.
      They can be skipped if the person is too unwell to answer.""", focus=w.locator('.panel').first)
    w.locator('label.choice.block').first.click(); nxt()
    w.locator('button.photo-slot').first.click(); w.locator('input[type=file]').set_input_files(PHOTO); w.wait_for_timeout(1000)
    scene(w, 'phone', """Photos are guided view by view: front, upper, lower, sides and a close-up. The phone checks for blur and darkness,
      and removes location and device details. Only the mouth is photographed, never the face.""", focus=w.locator('.photo-grid'))
    nxt()
    scene(w, 'phone', """Finally, a summary to check. The visit is saved, encrypted, on the phone first, so it works without internet,
      and it is sent to the dentists as soon as there is a connection.""", focus=w.locator('main'))
    w.locator('.wizard-foot .btn.primary').click(); w.wait_for_timeout(2500)

    # ---------- 3. Dentist ----------
    dctx = desk(); d = dctx.new_page(); d.on('pageerror', lambda e: errors.append(f'dentist: {e}'))
    login(d, '9000100021')
    scene(d, 'desktop', """Now the volunteer dentist. The queue shows only cases that no dentist has seen yet, urgent ones first.
      The dentist never sees the person's name, phone number or address — only age group, sex, district and the clinical findings.""",
      highlights=[d.locator('table.t thead')], focus=d.locator('main'))
    row = d.locator('table.t tbody tr', has_text='Ernakulam').filter(has_text='Denture')
    if not row.count(): row = d.locator('table.t tbody tr', has_text='Denture')
    row.first.locator('button.btn.primary').click(); d.wait_for_selector('.workspace', timeout=8000); d.wait_for_timeout(1500)
    case_id = re.search(r'#/case/([^/?]+)', d.url).group(1)
    scene(d, 'desktop', """Opening a case reserves it for thirty minutes, so two dentists never work on the same person.""", highlights=[d.locator('.chip', has_text='Reserved')])
    scene(d, 'desktop', """The worker's words appear exactly as typed. With the translation switch on, an English translation appears beside them.
      A dentist can also write the opinion in a regional language.""", highlights=[d.locator('.panel', has_text='Complaint')], focus=d.locator('.panel', has_text='Complaint'))
    scene(d, 'desktop', """Photos, the mouth-check scores, teeth and dentures, health, medicines and habits are laid out on one screen,
      along with the person's earlier visits.""", focus=d.locator('.workspace .stack').first, scroll_to=d.locator('.panel', has_text='OHAT'))
    oc = d.locator('.opinion-col')
    oc.locator('textarea').nth(0).fill('Lower denture is loose and has a sore spot underneath.')
    oc.locator('textarea').nth(2).fill('Remove the denture at night and clean it with a brush and water. Do not wear it while the sore is painful.')
    oc.locator('textarea').nth(3).fill('New lower denture or reline at a dental college.')
    oc.locator('label.choice.block', has_text='Referral needed').click(); d.wait_for_timeout(300)
    oc.locator('select').first.select_option('prosthodontic'); d.wait_for_timeout(300)
    kb = oc.locator('label', has_text='Cleaning dentures')
    if kb.count(): kb.first.click()
    scene(d, 'desktop', """The opinion is structured: what the dentist sees, advice and a care plan. Ticking referral inserts a ready referral message,
      and education leaflets or videos approved by AGeD can be attached.""", focus=oc, highlights=[oc.locator('label.choice.block', has_text='Referral needed')], scroll_to=oc.locator('label.choice.block', has_text='Referral needed'))
    oc.locator('button.btn.primary.big').click(); d.wait_for_timeout(1500)
    scene(d, 'desktop', """Every opinion is labelled as an advisory screening opinion, signed with the dentist's registration, and cannot be changed afterwards —
      corrections create a new version with a reason.""", focus=d.locator('main'))

    # ---------- 4. Back to the worker ----------
    w.goto(BASE + f'/#/case/{case_id}'); w.wait_for_timeout(2000)
    scene(w, 'phone', """Back on the worker's phone, the opinion arrives in her language. She can show it to the older person and their family.""", focus=w.locator('main'))
    w.locator('button', has_text='Show to the person').click(); w.wait_for_timeout(2500)
    scene(w, 'phone', """This large-type view is turned towards the person. It is translated into the language they understand,
      and labelled as a machine translation, with the dentist's original kept as the authoritative version.""", focus=w.locator('.patient-view'))
    w.locator('.pv-close').click(); w.wait_for_timeout(400)
    rctx = b.new_context(viewport={'width': 1000, 'height': 1300}, device_scale_factor=1.5)
    rctx.add_cookies(phone.cookies())
    rp = rctx.new_page(); rp.goto(BASE + f'/#/report/{case_id}'); rp.wait_for_timeout(2000)
    if rp.locator('text=Enter your PIN').count():
        rp.fill('input[type=password]', PIN); rp.locator('button.btn.primary').click(); rp.wait_for_timeout(2500)
        rp.goto(BASE + f'/#/report/{case_id}'); rp.wait_for_timeout(2500)
    scene(rp, 'desktop', """For referrals, the worker downloads a referral report to carry to the clinic. It carries the dentist's name and registration,
      and a QR code that anyone can scan to check that the report is genuine — without revealing anything about the patient.""", focus=rp.locator('main'), highlights=[rp.locator('.qr')])
    w.goto(BASE + '/#/people'); w.wait_for_timeout(1500)
    w.locator('a.item').nth(3).click(); w.wait_for_timeout(1500)
    scene(w, 'phone', """Each person has a record of all visits, consent, and how their mouth-check score, daily-life score and teeth have changed over time —
      the longitudinal record that matters for policy. Consent can be withdrawn here at any time.""", focus=w.locator('main'), scroll_to=w.locator('text=Visits'))

    # ---------- 5. Coordinator and CIF ----------
    cctx = desk(); c = cctx.new_page(); login(c, '9000100004'); c.goto(BASE + '/#/admin/dashboard'); c.wait_for_timeout(2000)
    scene(c, 'desktop', """Coordinators see a dashboard for their district and manage their field workers' accounts.""", focus=c.locator('main'))
    actx = desk(); a = actx.new_page(); a.on('pageerror', lambda e: errors.append(f'admin: {e}')); login(a, '9000100001'); a.wait_for_timeout(1500)
    scene(a, 'desktop', """The CIF super admin sees the whole programme: people screened, visits, urgent cases, how quickly dentists respond,
      and how many referrals actually reached a clinic.""", focus=a.locator('main'))
    a.mouse.wheel(0, 700); a.wait_for_timeout(600)
    scene(a, 'desktop', """Charts show mouth-health bands, teeth by age group, the monthly trend and overdue cases. Small numbers are hidden in exports to protect privacy.""", focus=a.locator('main'))

    # ---------- 6. AGeD ----------
    gctx = desk(); g = gctx.new_page(); g.on('pageerror', lambda e: errors.append(f'aged: {e}')); login(g, '9000100003')
    g.goto(BASE + '/#/admin/questionnaire'); g.wait_for_timeout(3000)
    scene(g, 'desktop', """AGeD has its own clinical admin portal. Here the clinical team edits the questionnaire itself — complaints, warning signs and their advice,
      medicines to flag, health and habit questions, photo views and referral types.""", focus=g.locator('main'), highlights=[g.locator('.row', has_text='Questions').first])
    g.locator('text=How are the dentures cleaned?').first.click(); g.wait_for_timeout(600)
    scene(g, 'desktop', """Every question shows the English beside any of the six languages, with a button to suggest a machine translation for checking.
      The validated mouth-check and daily-life instruments keep their items and scoring; only their wording can change.""",
      focus=g.locator('.panel', has_text='How are the dentures cleaned?'), highlights=[g.locator('.grid-2').first])
    g.locator('button', has_text='Warning signs and advice').click(); g.wait_for_timeout(400)
    g.locator('text=Ulcer, sore or lump').first.click(); g.wait_for_timeout(400)
    scene(g, 'desktop', """The advice that appears to the worker for each warning sign is also maintained here, by the clinical team.""", focus=g.locator('.panel', has_text='Ulcer, sore or lump'))
    g.locator('button', has_text='Questions').first.click(); g.wait_for_timeout(300)
    g.locator('button', has_text='Add a question').last.click(); g.wait_for_timeout(300)
    g.locator('text=(new item)').last.click(); g.wait_for_timeout(300)
    g.locator('.panel').filter(has_text='(new item)').last.locator('input[type=text]').first.fill('Uses snuff (nasal tobacco)')
    g.fill('input[maxlength="500"]', 'Added snuff, used in parts of Maharashtra')
    scene(g, 'desktop', """Nothing is ever deleted — items are retired, so earlier visits stay readable. Each publish creates a new version with a note,
      and every visit records the version it used, so five years of data stay comparable.""", highlights=[g.locator('button', has_text='Publish new version')], focus=g.locator('button', has_text='Publish new version'))
    g.once('dialog', lambda dlg: dlg.accept()); g.locator('button', has_text='Publish new version').click(); g.wait_for_timeout(2000)
    g.goto(BASE + '/#/admin/users'); g.wait_for_timeout(1500)
    scene(g, 'desktop', """AGeD also manages the volunteer dentists and clinical auditors, the education library and the clinical glossary.
      It never sees names, phone numbers or addresses of the people screened.""", focus=g.locator('main'))
    g.goto(BASE + '/#/audit'); g.wait_for_timeout(1500)
    scene(g, 'desktop', """A sample of opinions — ten percent by default — is picked for clinical audit, rated for quality and safety by AGeD auditors.""", focus=g.locator('main'))

    # ---------- 7. CIF control ----------
    a.goto(BASE + '/#/admin/dashboard'); a.reload(); a.wait_for_timeout(2500)
    scene(a, 'desktop', """The CIF super admin is told about every questionnaire change AGeD publishes, right on the dashboard.""", highlights=[a.locator('.callout.info').first], focus=a.locator('.callout.info').first)
    a.goto(BASE + '/#/admin/questionnaire'); a.wait_for_timeout(2500); a.locator('button', has_text='Versions').click(); a.wait_for_timeout(600)
    scene(a, 'desktop', """And any earlier version can be restored with one click.""", highlights=[a.locator('button', has_text='Restore').first], focus=a.locator('table.t'))
    a.goto(BASE + '/#/admin/users'); a.wait_for_timeout(1500)
    scene(a, 'desktop', """CIF manages all accounts — including creating AGeD admin accounts — and holds the privacy notice details, the access log,
      consent records and data exports.""", focus=a.locator('main'), highlights=[a.locator('.side-nav')])
    a.goto(BASE + '/#/admin/audit-log'); a.wait_for_timeout(1500)
    scene(a, 'desktop', """Every sign-in, view, change and export is recorded in an access log that cannot be edited.""", focus=a.locator('main'))
    pv = desk().new_page(); pv.goto(BASE + '/privacy.html?lang=ta'); pv.wait_for_timeout(2000)
    scene(pv, 'desktop', """The privacy notice and consent form, written for India's Digital Personal Data Protection Act, can be printed in all seven languages.""", focus=pv.locator('body'))
    w = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    w.goto(BASE + '/'); w.wait_for_selector('input[type=tel]'); w.wait_for_timeout(800)
    scene(w, 'phone', """That is Vayosmitham: simple screening at home, expert dentist opinion online, privacy by design, and data that can guide policy for older people.
      Try every role on the demo site — it resets every night.""", focus=w.locator('.login-card'))
    b.close()

json.dump({'scenes': scenes}, open(OUT / 'scenes.json', 'w'), indent=1, ensure_ascii=False)
print('errors:', errors or 'none')
