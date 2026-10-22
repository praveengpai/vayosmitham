# Browser walkthrough of the main flows. Saves screenshots to OUT.
# Usage: BASE=http://localhost:8787 OUT=/tmp/shots python3 scripts/ui-test.py
import os, sys, pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8787')
OUT = pathlib.Path(os.environ.get('OUT', '/tmp/shots')); OUT.mkdir(parents=True, exist_ok=True)
PIN = os.environ.get('PIN', '482913')
PHOTO = str(pathlib.Path(__file__).parent / 'test-photo.jpg')
errors = []

def watch(page, who):
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{who}: {m.text}'))
    page.on('pageerror', lambda e: errors.append(f'{who} pageerror: {e}'))

def login(page, phone):
    page.goto(BASE + '/')
    page.fill('input[type=tel]', phone)
    page.fill('input[type=password]', PIN)
    page.click('button.btn.primary')
    page.wait_for_selector('header.top', timeout=15000)

def shot(page, name):
    page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- field worker on a phone ----------
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    w = ctx.new_page(); watch(w, 'worker')
    login(w, '9000000002')
    w.wait_for_timeout(800); shot(w, '01-worker-home')
    w.click('a[href="#/visit"].btn')
    w.wait_for_selector('text=About the person, text=വ്യക്തിയെക്കുറിച്ച്', timeout=5000) if False else w.wait_for_timeout(500)
    w.fill('input[type=text] >> nth=0', 'Sarojini Teacher')
    w.locator('label.choice', has_text='സ്ത്രീ').click()
    w.fill('input[type=number] >> nth=0', '78')
    w.fill('input[type=text] >> nth=1', 'Sreenilayam, Near Temple')
    shot(w, '02-visit-person')
    nxt = lambda: w.locator('.wizard-foot .btn.primary').click()
    nxt(); w.wait_for_timeout(300)
    # consent
    w.locator('label.choice.block', has_text='ഞാൻ ഈ വിവരങ്ങൾ').click()
    shot(w, '03-visit-consent')
    nxt(); w.wait_for_timeout(300)
    # flags: none
    w.locator('label.choice.block', has_text='ഇവയൊന്നുമില്ല').click()
    nxt(); w.wait_for_timeout(300)
    # complaints
    w.locator('label.choice', has_text='ചവയ്ക്കാൻ ബുദ്ധിമുട്ട്').click()
    w.fill('textarea', 'ചവയ്ക്കുമ്പോൾ വലതുവശത്ത് വേദന. പല്ല്സെറ്റ് ഇല്ല.')
    shot(w, '04-visit-complaints')
    nxt(); w.wait_for_timeout(300)
    # OHAT: choose level 1 for each
    for btn in w.locator('.scale').all():
        btn.locator('button').nth(1).click()
    shot(w, '05-visit-ohat')
    nxt(); w.wait_for_timeout(300)
    w.fill('input[type=number]', '14')
    w.locator('.choices').nth(0).locator('label.choice').nth(0).click()
    w.locator('.choices').nth(1).locator('label.choice').nth(0).click()
    nxt(); w.wait_for_timeout(300)
    # health
    w.fill('input[list=med-list]', 'Amlodipine'); w.locator('button', has_text='ചേർക്കുക').click()
    shot(w, '06-visit-health')
    nxt(); w.wait_for_timeout(300)
    nxt(); w.wait_for_timeout(300)  # habits optional
    # GOHAI skip
    w.locator('label.choice.block').first.click()
    nxt(); w.wait_for_timeout(300)
    # photos
    w.locator('input[type=file]').set_input_files(PHOTO) if False else None
    w.locator('button.photo-slot').first.click(); w.locator('input[type=file]').set_input_files(PHOTO); w.wait_for_timeout(800)
    shot(w, '07-visit-photos')
    nxt(); w.wait_for_timeout(300)
    shot(w, '08-visit-review')
    w.locator('.wizard-foot .btn.primary').click()
    w.wait_for_timeout(3000)
    shot(w, '09-worker-home-after')

    # ---------- dentist on a laptop ----------
    dctx = b.new_context(viewport={'width': 1366, 'height': 900})
    d = dctx.new_page(); watch(d, 'dentist')
    login(d, '9000000003')
    d.wait_for_timeout(800); shot(d, '10-dentist-queue')
    d.locator('table.t button.btn.primary').first.click()
    d.wait_for_selector('.workspace', timeout=8000); d.wait_for_timeout(1000)
    shot(d, '11-dentist-case')
    d.fill('.opinion-col textarea >> nth=0', 'Worn and broken teeth on the right side causing pain on chewing. No denture.')
    d.fill('.opinion-col textarea >> nth=2', 'Chew on the left for now. Brush twice daily with fluoride toothpaste, soft brush.')
    d.fill('.opinion-col textarea >> nth=3', 'Dental check for the broken right lower teeth; consider a partial denture.')
    d.locator('.opinion-col label.choice.block', has_text='Referral needed').click()
    d.select_option('.opinion-col select', 'general_dental')
    shot(d, '12-dentist-opinion-form')
    d.locator('.opinion-col button.btn.primary.big').click()
    d.wait_for_timeout(1500)

    # ---------- worker sees opinion ----------
    w.goto(BASE + '/#/'); w.wait_for_timeout(1500)
    w.locator('a.item').first.click(); w.wait_for_timeout(1500)
    shot(w, '13-worker-opinion')
    w.locator('button', has_text='വ്യക്തിയെ കാണിക്കുക').click(); w.wait_for_timeout(800)
    shot(w, '14-show-to-patient')
    w.locator('.pv-close').click()
    w.locator('a', has_text='റഫറൽ റിപ്പോർട്ട്').click(); w.wait_for_timeout(1500)
    shot(w, '15-report')

    # ---------- admin ----------
    actx = b.new_context(viewport={'width': 1366, 'height': 900})
    a = actx.new_page(); watch(a, 'admin')
    login(a, '9000000001'); a.wait_for_timeout(1500)
    shot(a, '16-admin-dashboard')
    a.goto(BASE + '/#/admin/users'); a.wait_for_timeout(1000); shot(a, '17-admin-users')
    b.close()

print('\n'.join(errors) if errors else 'no console errors')
