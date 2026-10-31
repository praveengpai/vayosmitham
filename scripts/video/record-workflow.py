#!/usr/bin/env python3
"""Record the end-to-end workflow video: home visit -> dentist on phone -> opinion back in the worker's language
-> video and referral -> admin dashboard. Output: OUT/scenes.json + OUT/NN.jpg
Translation calls are answered from TX (a JSON file of "src|tgt|text": translation) so the recording does not
need Workers AI; any text not in TX is listed at the end so it can be added.
Usage: BASE=http://localhost:8788 OUT=/path TX=/path/tx.json PLAYER=/path/player.html python3 scripts/video/record-workflow.py
"""
import json, os, pathlib, re
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8788')
OUT = pathlib.Path(os.environ['OUT']); OUT.mkdir(parents=True, exist_ok=True)
TX = json.load(open(os.environ['TX']))
PLAYER = open(os.environ['PLAYER']).read()
PIN = '246810'
DEMO = pathlib.Path(__file__).resolve().parents[2] / 'demo'
scenes, errors, missing = [], [], []
COMPLAINT = 'താഴത്തെ പല്ല്സെറ്റ് ഇളകുന്നു, ചവയ്ക്കാൻ പറ്റുന്നില്ല. പല്ല്സെറ്റിനടിയിൽ മൂന്നാഴ്ചയായി ഒരു വ്രണമുണ്ട്, നല്ല വേദനയും.'
IMPRESSION = 'The lower denture is loose and rubs on the gum. The sore under it is most likely caused by the denture.'
ADVICE = 'Keep the lower denture out until the sore heals. Rinse the mouth with warm salt water three times a day. Clean the denture every day with a soft brush and water, and keep it in a cup of water at night.'
PLAN = 'A new lower denture, or a reline of the present one, at the dental college. If the sore has not healed in two weeks, she must see a dentist within a week.'

def on_translate(route):
    b = json.loads(route.request.post_data or '{}')
    k = f"{b.get('src')}|{b.get('tgt')}|{str(b.get('text', '')).strip()}"
    out = TX.get(k)
    if out is None: missing.append(k); out = '[[' + b.get('text', '') + ']]'
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'text': out, 'engine': 'indictrans2', 'cached': True, 'glossary': []}))

def wire(ctx):
    ctx.route('**/api/translate', on_translate)
    ctx.route('**/*youtube-nocookie.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body=PLAYER))

def box(page, loc, pad=6):
    try:
        b = loc.first.bounding_box(timeout=3000)
        if not b: return None
        dpr = page.evaluate('devicePixelRatio')
        return [round((b['x'] - pad) * dpr), round((b['y'] - pad) * dpr), round((b['width'] + 2 * pad) * dpr), round((b['height'] + 2 * pad) * dpr)]
    except Exception as e:
        errors.append(f'box: {e}'); return None

SHOTS = [0]
def shot(page):
    SHOTS[0] += 1; name = f'{SHOTS[0]:02d}.jpg'
    page.screenshot(path=str(OUT / name), type='jpeg', quality=92)
    return name

def scene(page, device, say, focus=None, highlights=(), click=None, scroll_to=None, hold=0.5, top=False):
    anchor = scroll_to if scroll_to is not None else (highlights[0] if highlights else click)
    if top: page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(250)
    elif anchor is not None:
        try: anchor.first.evaluate("el => el.scrollIntoView({block: 'center'})", timeout=3000)
        except Exception as e: errors.append(f'scroll: {e}')
        page.wait_for_timeout(350)
    hb = [box(page, h) for h in highlights]
    fb = box(page, focus, 24) if focus is not None else None
    cb = box(page, click, 0) if click is not None else None
    page.wait_for_timeout(200)
    name = shot(page)
    scenes.append({'img': name, 'device': device, 'say': ' '.join(say.split()), 'focus': fb, 'highlights': [h for h in hb if h], 'click': cb, 'hold': hold})
    print(len(scenes), device, say[:70], flush=True)

def pair(img_a, img_b, direction, say, hold=0.5):
    """Animated hand-off between two phones (drawn by the renderer)."""
    scenes.append({'img': img_a, 'img2': img_b, 'device': 'pair', 'dir': direction, 'say': ' '.join(say.split()), 'focus': None, 'highlights': [], 'click': None, 'hold': hold})
    print(len(scenes), 'pair', say[:70], flush=True)

def login(page, phone):
    page.goto(BASE + '/'); page.wait_for_selector('input[type=tel]')
    page.locator('.lang-pick button', has_text='English').click(); page.wait_for_timeout(300)
    page.fill('input[type=tel]', phone); page.fill('input[type=password]', PIN)
    page.click('button.btn.primary'); page.wait_for_selector('header.top', timeout=15000); page.wait_for_timeout(1300)

with sync_playwright() as p:
    b = p.chromium.launch()
    mk_phone = lambda: b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='en-IN')
    mk_desk = lambda: b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1.5, locale='en-IN')
    wctx = mk_phone(); wire(wctx)
    w = wctx.new_page(); w.on('pageerror', lambda e: errors.append(f'worker: {e}'))
    nxt = lambda: (w.locator('.wizard-foot .btn.primary').click(), w.wait_for_timeout(500))

    # ================= ACT 1: the home visit =================
    w.goto(BASE + '/'); w.wait_for_selector('input[type=tel]'); w.wait_for_timeout(800)
    scene(w, 'phone', """Meet Sindhu, an ASHA worker in Kalamassery, in Ernakulam district. This morning she is visiting Kamalakshi Amma,
      seventy-eight, at her home. All Sindhu needs is her phone and the Vayosmitham app.""", focus=w.locator('.login-card'))
    login(w, '9000100011')
    scene(w, 'phone', """Sindhu signs in with her mobile number and PIN. Her home screen shows what needs her attention today —
      opinions from dentists, visits waiting, and referrals to follow up.""", focus=w.locator('main'))
    w.click('a[href="#/visit"].btn'); w.wait_for_timeout(700)
    w.fill('input[type=text] >> nth=0', 'Kamalakshi Amma'); w.locator('label.choice', has_text='Female').click()
    w.fill('input[type=number] >> nth=0', '78'); w.fill('input[type=text] >> nth=1', 'Kollamkudy House, Ward 12 (demo)')
    scene(w, 'phone', """She taps New visit and enters Amma's name, age and address. Her state, district, panchayat and ward are filled in already.""",
      focus=w.locator('main'), click=w.locator('label.choice', has_text='Female'), top=True)
    nxt()
    w.locator('label.choice.block', has_text='പരിശോധനയും ദന്ത ഡോക്ടറുടെ').click()
    w.locator('label.choice.block', has_text='വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ').click()
    w.locator('label.choice.block', has_text='explained this information').click()
    w.locator('label.choice.block', has_text='offered them a copy').click()
    scene(w, 'phone', """Consent comes first. The phone reads the privacy notice aloud in Malayalam, and Amma agrees, choice by choice,
      to the dental check and to photos of her mouth.""", highlights=[w.locator('label.choice.block', has_text='പരിശോധനയും ദന്ത ഡോക്ടറുടെ'), w.locator('label.choice.block', has_text='വായയ്ക്കുള്ളിലെ ഫോട്ടോകൾ')])
    nxt()
    ulcer = w.locator('label.choice.block', has_text='Ulcer, sore or lump')
    ulcer.click(); w.wait_for_timeout(400)
    scene(w, 'phone', """Amma has had a painful sore under her denture for three weeks. Sindhu ticks the warning sign — and the case is marked urgent at once,
      with advice for today shown right away, before any dentist has seen it.""", highlights=[w.locator('.callout.urgent')], click=ulcer)
    nxt()
    w.locator('label.choice', has_text='Denture loose').click()
    w.locator('label.choice', has_text='Pain').first.click() if w.locator('label.choice', has_text='Pain').count() else None
    w.fill('textarea', COMPLAINT); w.wait_for_timeout(300)
    scene(w, 'phone', """She taps Amma's complaints from a list, and types Amma's own words — in Malayalam, the language they both speak.""",
      highlights=[w.locator('textarea')])
    nxt()
    for sc in w.locator('.scale').all(): sc.locator('button').nth(0).click()
    w.locator('.scale').nth(1).locator('button').nth(1).click(); w.locator('.scale').nth(2).locator('button').nth(1).click()
    w.locator('.scale').nth(5).locator('button').nth(2).click(); w.locator('.scale').nth(6).locator('button').nth(1).click()
    scene(w, 'phone', """Then a simple mouth check, area by area — lips, tongue, gums, dentures, cleanliness and pain. The app adds up the score.""",
      highlights=[w.locator('.panel').nth(5)], scroll_to=w.locator('.panel').nth(5))
    nxt()
    w.fill('input[type=number]', '4'); w.locator('.choices').nth(0).locator('label.choice').nth(2).click(); w.locator('.choices').nth(1).locator('label.choice').nth(2).click()
    w.wait_for_timeout(300)
    scene(w, 'phone', """Teeth and dentures: Amma has four natural teeth, and wears upper and lower dentures.""", focus=w.locator('main'), top=True)
    nxt(); nxt(); nxt()   # health, habits: defaults
    if w.locator('label.choice.block').count(): w.locator('label.choice.block').first.click()
    nxt()
    pics = [('mouth-front.jpg', 0), ('mouth-upper.jpg', 1), ('mouth-lower.jpg', 2), ('mouth-lesion.jpg', -1)]
    for f, i in pics:
        slots = w.locator('button.photo-slot')
        if not slots.count(): break
        (slots.last if i == -1 else slots.first).click()
        w.locator('input[type=file]').set_input_files(str(DEMO / f)); w.wait_for_timeout(1100)
    scene(w, 'phone', """Now the photos. The app guides her view by view — front, upper, lower — and a close-up of the sore.
      It checks each photo for blur and darkness. Only the mouth is photographed, never the face.""", focus=w.locator('.photo-grid'), scroll_to=w.locator('.photo-grid > *').nth(1))
    nxt()
    send_btn = w.locator('.wizard-foot .btn.primary')
    scene(w, 'phone', """A last look at the summary, and Sindhu taps Send. If there is no signal, the visit waits safely on the phone, locked with her PIN,
      and goes out by itself when the network returns.""", highlights=[send_btn], click=send_btn)
    send_btn.click(); w.wait_for_timeout(3000)
    sent_img = shot(w)

    # ================= ACT 2: the dentist, on her phone =================
    dctx = mk_phone(); wire(dctx)
    d = dctx.new_page(); d.on('pageerror', lambda e: errors.append(f'dentist: {e}'))
    login(d, '9000100021')
    q = d.evaluate("fetch('/api/dentist/queue').then(r => r.json())")
    cases = q.get('cases', q) if isinstance(q, dict) else q
    mine = [c for c in cases if not c['id'].startswith('C-DEMO')][-1]
    case_id = mine['id']
    row = d.locator('table.t tbody tr').nth([c['id'] for c in cases].index(case_id))
    queue_img = shot(d)
    pair(sent_img, queue_img, 'lr', """In seconds, the visit reaches the dentists' queue — encrypted all the way. Amma's name, phone number and address
      stay behind with the field worker. The dentist sees only what she needs to give an opinion.""")
    scene(d, 'phone', """Dr Anitha, a prosthodontist at a dental college, volunteers with the Association of Geriatric Dentistry.
      Between patients, she opens the queue on her phone. Urgent cases come first — and Amma's is right there.""",
      highlights=[row], focus=d.locator('main'))
    row.first.locator('button.btn.primary').click(); d.wait_for_timeout(2000)
    tx_panel = d.locator('.tx-pair').first
    scene(d, 'phone', """She opens the case. It is reserved for her, so no other dentist works on it at the same time.
      Here is the key moment: Sindhu's note in Malayalam, and right beside it, an English translation, produced instantly.""",
      highlights=[tx_panel], scroll_to=tx_panel, hold=0.8)
    ph = d.locator('.thumbs').first if d.locator('.thumbs').count() else d.locator('img').first
    scene(d, 'phone', """The photos, the mouth-check scores, dentures, health and medicines are all here, on one screen.
      She can tap any photo to see it full size.""", focus=ph, scroll_to=ph)
    oc = d.locator('.opinion-col') if d.locator('.opinion-col').count() else d.locator('main')
    tas = oc.locator('textarea')
    tas.nth(0).fill(IMPRESSION); tas.nth(2).fill(ADVICE); tas.nth(3).fill(PLAN)
    scene(d, 'phone', """Dr Anitha writes her opinion in English, in plain words: what she sees, advice for Amma and her family, and a care plan.""",
      highlights=[tas.nth(0), tas.nth(2)], scroll_to=tas.nth(2))
    oc.locator('label.choice.block', has_text='Referral needed').click(); d.wait_for_timeout(300)
    oc.locator('select').first.select_option('prosthodontic'); d.wait_for_timeout(200)
    oc.locator('label.choice', has_text='7 days').click(); d.wait_for_timeout(300)
    letter = oc.locator('label.field', has_text='Referral letter')
    scene(d, 'phone', """Amma needs a new denture, so she ticks Referral needed — for a denture, within seven days.
      A referral letter is filled in for her from a template, ready to edit.""", highlights=[oc.locator('select').first, letter], scroll_to=letter)
    vid = oc.locator('label.choice.block', has_text='How to clean your denture')
    vid.click(); d.wait_for_timeout(300)
    scene(d, 'phone', """She also attaches a short video, approved by AGeD, on how to clean a denture — so Amma and her family can watch it at home.""",
      highlights=[vid], click=vid)
    pv = oc.locator('button', has_text='Preview translation')
    pv.click(); d.wait_for_timeout(1500)
    prev = oc.locator('.panel', has_text='What the field worker will see').last
    scene(d, 'phone', """Before signing, she taps Preview translation. She sees exactly what Sindhu and Amma will read in Malayalam —
      and a translation back into English, so she can check that the meaning has not changed. The translation is done by AI, and it is always labelled as such.""",
      focus=prev, highlights=[prev.locator('.preview-list')], scroll_to=prev.locator('.preview-item').first, hold=1.0)
    oc.locator('button.btn.primary.big').click(); d.wait_for_timeout(2000)
    scene(d, 'phone', """She signs. The opinion carries her registration and her institution, and cannot be altered afterwards — any correction becomes a new version, with a reason.""",
      focus=d.locator('main'), top=True)
    signed_img = scenes[-1]['img']

    # ================= ACT 3: back at Amma's home =================
    w.goto(BASE + '/#/'); w.reload(); w.wait_for_timeout(2500)
    if w.locator('input[type=password]').count():
        w.fill('input[type=password]', PIN); w.locator('button.btn.primary').first.click(); w.wait_for_timeout(2500)
    w.goto(BASE + '/#/'); w.wait_for_timeout(1500)
    home_img = shot(w)
    pair(home_img, signed_img, 'rl', """And the opinion travels back to Sindhu's phone.""", hold=0.3)
    item = w.locator('a', has_text='Kamalakshi A').first
    scene(w, 'phone', """On Sindhu's home screen, Amma's visit now shows that the dentist's opinion is ready.""",
      highlights=[item] if item.count() else [], focus=w.locator('main'), top=not item.count())
    w.goto(BASE + f'/#/case/{case_id}'); w.wait_for_timeout(2500)
    op = w.locator('.panel', has_text="Dentist's opinion").first
    scene(w, 'phone', """She opens it. Dr Anitha wrote in English — and Sindhu reads it in Malayalam. The English original stays alongside,
      as the authoritative version.""", highlights=[op.locator('.tx-pair').first], scroll_to=op.locator('.tx-pair').first, hold=0.8)
    w.locator('button', has_text='Show to the person').click(); w.wait_for_timeout(2500)
    scene(w, 'phone', """Then she taps Show to the person, and turns the phone towards Amma. Large type, entirely in Malayalam —
      Sindhu reads the advice aloud, and Amma's daughter listens too.""", focus=w.locator('.patient-view .pv-text'), hold=0.8)
    play = w.locator('.patient-view button', has_text='Play here')
    scene(w, 'phone', """Below the advice is the video Dr Anitha suggested.""", highlights=[play], click=play)
    play.click(); w.wait_for_timeout(2000)
    frame = w.locator('.patient-view .video-frame')
    scene(w, 'phone', """One tap, and it plays right inside the app — how to brush the denture over a bowl of water, and keep it in water at night.""",
      highlights=[frame], scroll_to=frame, hold=0.8)
    w.locator('.pv-close').click(); w.wait_for_timeout(500)
    refbox = w.locator('.callout.warn', has_text='Referral needed').first
    scene(w, 'phone', """The opinion also says Amma needs a new denture, within seven days. The referral letter is shown in Malayalam for Sindhu, too.""",
      highlights=[refbox], scroll_to=refbox)
    rctx = b.new_context(viewport={'width': 1000, 'height': 1300}, device_scale_factor=1.5); wire(rctx)
    rctx.add_cookies(wctx.cookies())
    rp = rctx.new_page(); rp.goto(BASE + f'/#/report/{case_id}'); rp.wait_for_timeout(2500)
    if rp.locator('text=Enter your PIN').count():
        rp.fill('input[type=password]', PIN); rp.locator('button.btn.primary').click(); rp.wait_for_timeout(2500)
        rp.goto(BASE + f'/#/report/{case_id}'); rp.wait_for_timeout(2500)
    scene(rp, 'desktop', """Sindhu downloads the referral report for Amma to carry to the dental college. It has the dentist's name, registration and institution,
      and a QR code that the clinic can scan to confirm the report is genuine.""", focus=rp.locator('main'), highlights=[rp.locator('.qr')])
    ro = w.locator('form', has_text='Did the person get the referred care?')
    ro.locator('label.choice', has_text='Yes, went').click(); w.wait_for_timeout(300)
    ro.locator('input[type=date]').fill('2026-11-06')
    sel = ro.locator('select').first
    try:
        opts = sel.locator('option').all()
        if len(opts) > 1: sel.select_option(index=1)
    except Exception as e: errors.append(f'centre: {e}')
    ro.locator('input[type=text]').fill('New lower denture made')
    scene(w, 'phone', """A week later, Sindhu records that Amma went to the dental college and got her new denture. That closes the loop —
      and tells the programme whether referrals really reach care.""", focus=ro, scroll_to=ro, highlights=[ro.locator('label.choice', has_text='Yes, went')])
    ro.locator('button.btn.primary').click(); w.wait_for_timeout(1200)

    # ================= ACT 4: the programme view =================
    actx = mk_desk(); wire(actx)
    a = actx.new_page(); a.on('pageerror', lambda e: errors.append(f'admin: {e}'))
    login(a, '9000100001'); a.goto(BASE + '/#/admin/dashboard'); a.wait_for_timeout(2500)
    scene(a, 'desktop', """Every visit like Amma's adds up. This is the programme dashboard, for C.I.F. and AGeD. At the top: older people screened, visits and follow-ups,
      how quickly dentists respond, how many urgent cases were seen in time, how many referrals were completed, and the active workers and dentists.""",
      focus=a.locator('.kpis'), highlights=[a.locator('.kpis')], top=True, hold=0.6)
    sels = a.locator('main select')
    filt = a.locator('main .row').filter(has=a.locator('select')).first
    try:
        sels.nth(0).select_option('Kerala'); a.wait_for_timeout(1200)
        sels.nth(1).select_option('Ernakulam'); a.wait_for_timeout(1800)
    except Exception as e: errors.append(f'filters: {e}')
    scene(a, 'desktop', """Filters narrow everything down — by state, then district, and by the institution whose dentists gave the opinions.
      Here: Kerala, Ernakulam.""", highlights=[filt], focus=a.locator('main'), top=True)
    try:
        sels.nth(1).select_option(''); a.wait_for_timeout(500); sels.nth(0).select_option(''); a.wait_for_timeout(1800)
    except Exception as e: errors.append(f'filters reset: {e}')
    ch = a.locator('.cols-2').first
    scene(a, 'desktop', """Charts show where every case stands, mouth-health bands, visits month by month, and referral outcomes — went, did not go, or not yet known.""",
      focus=ch, scroll_to=ch)
    inst = a.locator('.panel', has_text='Participating institutions')
    scene(a, 'desktop', """The participating institutions — dental colleges, hospitals, clinics and individual volunteers — with the opinions and referrals each has contributed.""",
      focus=inst, highlights=[inst], scroll_to=inst)
    bs = a.locator('.panel', has_text='By state').first
    scene(a, 'desktop', """Teeth by age group, numbers by state and district, and the clinical audit, where AGeD reviewers rate a sample of opinions for quality and safety.""",
      focus=bs.locator('xpath=..'), scroll_to=bs)
    a.goto(BASE + '/#/admin/exports'); a.wait_for_timeout(1500)
    scene(a, 'desktop', """Reports can be downloaded: indicators by district, age group and status, with small numbers hidden to protect privacy,
      and an anonymised research extract for approved studies.""", focus=a.locator('main'), highlights=[a.locator('main .panel').nth(0), a.locator('main .panel').nth(1)])
    a.goto(BASE + '/#/admin/audit-log'); a.wait_for_timeout(1500)
    scene(a, 'desktop', """And every sign-in, view, change and download is written to an access log that cannot be edited.""", focus=a.locator('main'), top=True)
    ictx = mk_desk(); wire(ictx); ip = ictx.new_page(); login(ip, '9000100005'); ip.goto(BASE + '/#/admin/inst-report'); ip.wait_for_timeout(2000)
    scene(ip, 'desktop', """Each dental college or hospital also sees its own contribution — opinions given, its dentists, urgent cases, referrals and turnaround.""",
      focus=ip.locator('main'), top=True)
    end = mk_phone().new_page(); end.goto(BASE + '/'); end.wait_for_selector('input[type=tel]'); end.wait_for_timeout(900)
    scene(end, 'phone', """One home visit. One dentist, on her phone. Advice in Amma's own language, a video to learn from, and a referral that reached care.
      That is Vayosmitham.""", focus=end.locator('.login-card'), hold=1.2)
    b.close()

scenes = [s for s in scenes if not s.get('skip')]
json.dump({'scenes': scenes}, open(OUT / 'scenes.json', 'w'), indent=1, ensure_ascii=False)
print('case', case_id)
print('errors:', errors or 'none')
print('missing translations:', json.dumps(missing, ensure_ascii=False, indent=1) if missing else 'none')
