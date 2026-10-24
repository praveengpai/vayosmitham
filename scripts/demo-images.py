#!/usr/bin/env python3
"""Draw the illustrated DEMO pictures used instead of real mouth photos on the demo site -> demo/media.sql."""
import io, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 960, 720
out = os.path.join(os.path.dirname(__file__), '..', 'demo')
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except Exception: font = ImageFont.load_default()
def base(bg=(40, 22, 24)):
    im = Image.new('RGB', (W, H), bg); return im, ImageDraw.Draw(im)
def teeth_row(d, cx, cy, n, w, h, gum, up=True, missing=(), stain=()):
    d.rounded_rectangle([cx - n * w / 2 - 30, cy - (h + 50 if up else -10), cx + n * w / 2 + 30, cy + (10 if up else h + 50)], 60, fill=gum)
    for i in range(n):
        x = cx - n * w / 2 + i * w
        if i in missing: continue
        col = (238, 230, 205) if i not in stain else (190, 160, 100)
        y0, y1 = (cy - h, cy) if up else (cy, cy + h)
        d.rounded_rectangle([x + 4, y0, x + w - 4, y1], 14, fill=col, outline=(200, 190, 160), width=2)
def mark(im):
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 80, W, H], fill=(12, 95, 86)); d.text((24, H - 62), 'DEMO IMAGE — not a real person', font=font, fill='white')
    return im
imgs = {}
im, d = base(); d.ellipse([90, 120, W - 90, H - 180], fill=(150, 40, 50))
teeth_row(d, W / 2, 330, 10, 62, 95, (205, 95, 105), True, missing=(2,), stain=(7,)); teeth_row(d, W / 2, 345, 10, 62, 85, (205, 95, 105), False, missing=(6, 7))
imgs['mouth-front.jpg'] = mark(im.filter(ImageFilter.GaussianBlur(1.2)))
im, d = base(); d.ellipse([110, 80, W - 110, H - 120], fill=(205, 95, 105)); d.ellipse([260, 200, W - 260, H - 260], fill=(225, 130, 140))
for i in range(12):
    a = math.pi * (0.1 + 0.8 * i / 11); x = W / 2 - 300 * math.cos(a); y = 470 - 260 * math.sin(a)
    if i not in (3, 8): d.ellipse([x - 32, y - 32, x + 32, y + 32], fill=(238, 230, 205), outline=(200, 190, 160), width=2)
imgs['mouth-upper.jpg'] = mark(im.filter(ImageFilter.GaussianBlur(1.2)))
im, d = base(); d.ellipse([110, 100, W - 110, H - 140], fill=(205, 95, 105)); d.ellipse([300, 210, W - 300, H - 230], fill=(190, 80, 95))
for i in range(10):
    a = math.pi * (0.15 + 0.7 * i / 9); x = W / 2 - 280 * math.cos(a); y = 200 + 240 * math.sin(a)
    if i not in (0, 4, 5): d.ellipse([x - 30, y - 30, x + 30, y + 30], fill=(230, 220, 190), outline=(180, 160, 120), width=3)
imgs['mouth-lower.jpg'] = mark(im.filter(ImageFilter.GaussianBlur(1.2)))
im, d = base((60, 30, 34)); d.ellipse([60, 60, W - 60, H - 140], fill=(200, 110, 120))
d.ellipse([380, 250, 600, 380], fill=(245, 245, 240)); d.ellipse([440, 290, 520, 340], fill=(230, 120, 120))
imgs['mouth-lesion.jpg'] = mark(im.filter(ImageFilter.GaussianBlur(1.5)))
im, d = base((210, 205, 195)); d.ellipse([170, 160, W - 170, H - 200], fill=(225, 120, 130), outline=(180, 90, 100), width=6); d.ellipse([290, 260, W - 290, H - 300], fill=(210, 205, 195))
for i in range(12):
    a = math.pi * (1.05 + 0.9 * i / 11); x = W / 2 + 300 * math.cos(a); y = 400 + 200 * math.sin(a)
    d.ellipse([x - 30, y - 30, x + 30, y + 30], fill=(245, 240, 225), outline=(200, 190, 170), width=2)
d.line([560, 300, 640, 330], fill=(120, 60, 60), width=5)
imgs['denture.jpg'] = mark(im)
sql = ['-- Illustrated DEMO pictures (no real people).']
for name, im in imgs.items():
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=62, optimize=True); b = buf.getvalue()
    assert len(b) < 45000, (name, len(b))
    im.save(os.path.join(out, name), 'JPEG', quality=62)
    sql.append(f"INSERT OR REPLACE INTO media (key, mime, bytes) VALUES ('demo/{name}', 'image/jpeg', X'{b.hex()}');")
    print(name, len(b))
open(os.path.join(out, 'media.sql'), 'w').write('\n'.join(x for x in sql if not x.startswith('--')) + '\n')
