#!/usr/bin/env python3
"""Render the workflow MP4 (1920x1080, 30 fps) from scenes.json + screenshots + narration WAVs.
Adds "pair" scenes: worker and dentist phones side by side, with an animated, encrypted hand-off between them.
Camera: wide view, then an eased zoom into each scene's focus area with a slow push; highlights use a
spotlight (the rest dims) with a marigold outline; taps show a ripple. No music, no captions.
Usage: python3 scripts/video/render.py <video-dir> <out.mp4>
"""
import json, math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

V, OUTFILE = sys.argv[1], sys.argv[2]
FPS, W, H, S = 30, 1920, 1080, 2          # output size; canvas is S times larger for crisp zooms
CW, CH = W * S, H * S
LEAD, TAIL, XFADE = 0.35, 0.75, 0.4
GREEN, MARIGOLD = (12, 95, 86), (229, 162, 27)
scenes = json.load(open(f'{V}/shots/scenes.json'))['scenes']

def background():
    y = np.linspace(0, 1, CH)[:, None]; x = np.linspace(0, 1, CW)[None, :]
    a = np.array([233, 243, 241]); b = np.array([247, 250, 249]); c = np.array([214, 233, 229])
    t = (0.6 * y + 0.4 * x)[..., None]
    img = a * (1 - t) + b * t
    r = np.sqrt((x - 0.92) ** 2 + (y - 0.1) ** 2)[..., None]
    img = img * (r > 0.22) + (img * 0.6 + c * 0.4) * (r <= 0.22)
    return Image.fromarray(img.astype(np.uint8))
BG = background()

def shadow(canvas, rect, radius, blur=40, opacity=90):
    sh = Image.new('L', canvas.size, 0); d = ImageDraw.Draw(sh)
    x0, y0, x1, y1 = rect; d.rounded_rectangle([x0 + 10, y0 + 30, x1 + 10, y1 + 30], radius, fill=opacity)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(Image.new('RGB', canvas.size, (20, 40, 38)), (0, 0), sh)

def compose(sc):
    """Place the screenshot in a phone or browser frame on the canvas. Returns canvas and a mapper from screenshot px to canvas px."""
    shot = Image.open(f"{V}/shots/{sc['img']}").convert('RGB')
    cv = BG.copy(); d = ImageDraw.Draw(cv)
    if sc['device'] == 'phone':
        s = (CH - 2 * 120) / shot.height
        sw, sh_ = int(shot.width * s), int(shot.height * s)
        ox, oy = (CW - sw) // 2, (CH - sh_) // 2
        bez = 34
        shadow(cv, (ox - bez, oy - bez, ox + sw + bez, oy + sh_ + bez), 110)
        d.rounded_rectangle([ox - bez, oy - bez, ox + sw + bez, oy + sh_ + bez], 110, fill=(24, 30, 32))
        scr = shot.resize((sw, sh_), Image.LANCZOS)
        m = Image.new('L', (sw, sh_), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, sw, sh_], 80, fill=255)
        cv.paste(scr, (ox, oy), m)
        frame = (ox - bez, oy - bez, ox + sw + bez, oy + sh_ + bez)
    else:
        bar = 70
        s = min((CW - 2 * 220) / shot.width, (CH - 2 * 90 - bar) / shot.height)
        sw, sh_ = int(shot.width * s), int(shot.height * s)
        ox, oy = (CW - sw) // 2, (CH - sh_ - bar) // 2 + bar
        shadow(cv, (ox, oy - bar, ox + sw, oy + sh_), 24)
        d.rounded_rectangle([ox, oy - bar, ox + sw, oy + sh_], 24, fill=(232, 236, 235))
        for i, col in enumerate([(236, 106, 94), (244, 190, 79), (97, 197, 84)]):
            d.ellipse([ox + 30 + i * 46, oy - bar / 2 - 13, ox + 56 + i * 46, oy - bar / 2 + 13], fill=col)
        d.rounded_rectangle([ox + 200, oy - bar + 16, ox + sw - 200, oy - 16], 18, fill=(255, 255, 255))
        cv.paste(shot.resize((sw, sh_), Image.LANCZOS), (ox, oy))
        frame = (ox, oy - bar, ox + sw, oy + sh_)
    mp = lambda b: (ox + b[0] * s, oy + b[1] * s, ox + (b[0] + b[2]) * s, oy + (b[1] + b[3]) * s)
    return cv, mp, frame

def fit169(r, minw=CW * 0.36, pad=1.12):
    x0, y0, x1, y1 = r; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = (x1 - x0) * pad, (y1 - y0) * pad
    w = max(w, h * 16 / 9, minw); h = w * 9 / 16
    if w > CW: w, h = CW, CH
    cx = min(max(cx, w / 2), CW - w / 2); cy = min(max(cy, h / 2), CH - h / 2)
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]

ease = lambda t: 0.5 - 0.5 * math.cos(math.pi * min(max(t, 0), 1))
lerp = lambda a, b, t: [a[i] + (b[i] - a[i]) * t for i in range(4)]

def overlay(sc, mp):
    """Spotlight layer (RGBA, canvas size): dim outside highlight boxes, marigold outline around them."""
    if not sc['highlights']: return None
    ov = Image.new('RGBA', (CW, CH), (10, 25, 23, 120)); d = ImageDraw.Draw(ov)
    rects = [mp(h) for h in sc['highlights']]
    for r in rects: d.rounded_rectangle(r, 22, fill=(0, 0, 0, 0))
    glow = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    for r in rects: g.rounded_rectangle([r[0] - 6, r[1] - 6, r[2] + 6, r[3] + 6], 26, outline=MARIGOLD + (150,), width=22)
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    ov = Image.alpha_composite(ov, glow); d = ImageDraw.Draw(ov)
    for r in rects: d.rounded_rectangle([r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4], 24, outline=MARIGOLD + (255,), width=9)
    return ov

def clamp(b, w, h, m=8):
    x0, y0 = max(b[0], m), max(b[1], m); x1, y1 = min(b[0] + b[2], w - m), min(b[1] + b[3], h - m)
    return [x0, y0, max(x1 - x0, 1), max(y1 - y0, 1)]

def prepare(sc):
    sw_, sh_ = Image.open(f"{V}/shots/{sc['img']}").size
    sc = dict(sc, highlights=[clamp(h, sw_, sh_) for h in sc.get('highlights') or []], focus=clamp(sc['focus'], sw_, sh_) if sc.get('focus') else None)
    cv, mp, frame = compose(sc)
    wide = fit169(frame, minw=CW * 0.0, pad=1.06) if sc['device'] == 'phone' else [0, 0, CW, CH]
    if sc['device'] == 'phone': wide = [0, 0, CW, CH]
    tgt = fit169(mp(sc['focus'])) if sc.get('focus') else fit169(frame, pad=1.02)
    if sc.get('highlights') and not sc.get('focus'):
        hx = [mp(h) for h in sc['highlights']]
        u = (min(r[0] for r in hx), min(r[1] for r in hx), max(r[2] for r in hx), max(r[3] for r in hx))
        tgt = fit169(u, pad=1.9)
    return {'cv': np.asarray(cv), 'ov': overlay(sc, mp), 'wide': wide, 'tgt': tgt, 'click': mp(sc['click']) if sc.get('click') else None,
            'dur': LEAD + sc['secs'] + TAIL + sc.get('hold', 0)}

def crop_resize(arr, rect, size):
    x0, y0, x1, y1 = [int(round(v)) for v in rect]
    return np.asarray(Image.fromarray(arr[y0:y1, x0:x1]).resize(size, Image.BILINEAR))

def frame_at(p, t, sc):
    zoom_t = ease((t - 0.25) / 1.3)
    cam = lerp(p['wide'], p['tgt'], zoom_t)
    if zoom_t >= 1:  # slow push for the rest of the scene
        k = 0.035 * ease((t - 1.55) / max(p['dur'] - 1.55, 0.1))
        cx, cy = (cam[0] + cam[2]) / 2, (cam[1] + cam[3]) / 2; w, h = (cam[2] - cam[0]) * (1 - k), (cam[3] - cam[1]) * (1 - k)
        cam = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    img = crop_resize(p['cv'], cam, (W, H)).astype(np.float32)
    if p['ov'] is not None:
        a = ease((t - 1.45) / 0.45)
        if a > 0:
            if 'ova' not in p: p['ova'] = np.asarray(p['ov'])
            o = crop_resize(p['ova'], cam, (W, H)).astype(np.float32)
            al = o[..., 3:4] / 255 * a
            img = img * (1 - al) + o[..., :3] * al
    if p['click']:
        ct = t - 0.9
        if 0 <= ct <= 0.9:
            x0, y0, x1, y1 = p['click']; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            sx = W / (cam[2] - cam[0]); px, py = (cx - cam[0]) * sx, (cy - cam[1]) * sx
            rr = 18 + 70 * ease(ct / 0.9); alpha = 0.55 * (1 - ct / 0.9)
            yy, xx = np.ogrid[:H, :W]; ring = np.abs(np.sqrt((xx - px) ** 2 + (yy - py) ** 2) - rr) < 6
            dot = np.sqrt((xx - px) ** 2 + (yy - py) ** 2) < 16
            m = (ring | dot)[..., None] * alpha
            img = img * (1 - m) + np.array(MARIGOLD, np.float32) * m
    return img

# ---------- pair scenes: the hand-off between two phones ----------
def phone_img(name, height):
    shot = Image.open(f"{V}/shots/{name}").convert('RGB')
    s = height / shot.height; sw, sh_ = int(shot.width * s), int(shot.height * s)
    bez = int(34 * height / (CH - 240))
    img = Image.new('RGBA', (sw + 2 * bez, sh_ + 2 * bez), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, sw + 2 * bez - 1, sh_ + 2 * bez - 1], int(110 * height / (CH - 240)), fill=(24, 30, 32, 255))
    m = Image.new('L', (sw, sh_), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, sw, sh_], int(80 * height / (CH - 240)), fill=255)
    img.paste(shot.resize((sw, sh_), Image.LANCZOS), (bez, bez), m)
    return img

def prepare_pair(sc):
    ph = int(CH * 0.68)
    A, B = phone_img(sc['img'], ph), phone_img(sc['img2'], ph)
    base = BG.copy()
    ax, bx = int(CW * 0.27 - A.width / 2), int(CW * 0.73 - B.width / 2)
    y = int(CH * 0.62 - A.height / 2)
    for im, x in ((A, ax), (B, bx)):
        shadow(base, (x, y, x + im.width, y + im.height), 90)
        base.paste(im, (x, y), im)
    # the cloud hub with a lock, between and above the phones
    hub = (CW // 2, int(CH * 0.15)); r = int(CH * 0.07)
    d = ImageDraw.Draw(base)
    d.ellipse([hub[0] - r - 14, hub[1] - r - 14, hub[0] + r + 14, hub[1] + r + 14], fill=(214, 233, 229))
    d.ellipse([hub[0] - r, hub[1] - r, hub[0] + r, hub[1] + r], fill=GREEN)
    lw, lh = r * 0.8, r * 0.62
    d.rounded_rectangle([hub[0] - lw / 2, hub[1] - lh * 0.15, hub[0] + lw / 2, hub[1] + lh * 0.85], 14, fill=(255, 255, 255))
    d.arc([hub[0] - lw * 0.32, hub[1] - lh * 0.95, hub[0] + lw * 0.32, hub[1] + lh * 0.25], 180, 360, fill=(255, 255, 255), width=int(r * 0.13))
    d.ellipse([hub[0] - 12, hub[1] + lh * 0.25, hub[0] + 12, hub[1] + lh * 0.25 + 24], fill=GREEN)
    # dashed path: top of phone A -> hub -> top of phone B (quadratic curves)
    pa = (ax + A.width / 2, y - 50); pb = (bx + B.width / 2, y - 50)
    def curve(p0, p1, c, n=60): return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in np.linspace(0, 1, n)]
    path = curve(pa, hub, (pa[0], hub[1])) + curve(hub, pb, (pb[0], hub[1]))[1:]
    for i in range(0, len(path) - 1, 2): d.line([path[i], path[i + 1]], fill=(150, 185, 178), width=10)
    if sc['dir'] == 'rl': path = path[::-1]
    dst = (bx, y, B) if sc['dir'] == 'lr' else (ax, y, A)
    return {'cv': np.asarray(base), 'path': np.array(path), 'dst': (dst[0], dst[1], dst[0] + dst[2].width, dst[1] + dst[2].height), 'dur': LEAD + sc['secs'] + TAIL + sc.get('hold', 0)}

def pair_frame(p, t):
    img = Image.fromarray(p['cv']).copy(); d = ImageDraw.Draw(img, 'RGBA')
    period = 2.2; n = len(p['path'])
    for k in range(3):                        # up to three packets, one after another
        tt = t - 0.4 - k * period
        if tt < 0 or tt > period: continue
        u = ease(tt / (period * 0.8))
        i = min(int(u * (n - 1)), n - 1); x, yy = p['path'][i]
        for j in range(1, 7):                 # trail
            ii = max(i - j * 3, 0); tx, ty = p['path'][ii]; rr = 26 - j * 3
            d.ellipse([tx - rr, ty - rr, tx + rr, ty + rr], fill=MARIGOLD + (150 - j * 20,))
        d.ellipse([x - 34, yy - 34, x + 34, yy + 34], fill=MARIGOLD + (255,))
        d.rounded_rectangle([x - 15, yy - 11, x + 15, yy + 11], 4, fill=(255, 255, 255, 255))   # a small envelope
        d.line([(x - 15, yy - 10), (x, yy + 2), (x + 15, yy - 10)], fill=MARIGOLD + (255,), width=4)
        if u > 0.98:                          # arrival pulse on the receiving phone
            a = min(max((tt - period * 0.8) / (period * 0.2), 0), 1)
            x0, y0, x1, y1 = p['dst']; g = 10 + 50 * a
            d.rounded_rectangle([x0 - g, y0 - g, x1 + g, y1 + g], 140, outline=MARIGOLD + (int(220 * (1 - a)),), width=12)
    # gentle camera drift
    k = 0.03 * ease(t / p['dur']); cx, cy = CW / 2, CH / 2; w, h = CW * (1 - k), CH * (1 - k)
    return crop_resize(np.asarray(img), [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], (W, H)).astype(np.float32)

import os
if os.environ.get('PREVIEW'):                # PREVIEW="scene:sec,scene:sec" writes stills and stops
    for item in os.environ['PREVIEW'].split(','):
        i, tt = item.split(':'); sc = scenes[int(i) - 1]; sc.setdefault('secs', 6)
        p = prepare_pair(sc) if sc['device'] == 'pair' else prepare(sc)
        img = pair_frame(p, float(tt)) if sc['device'] == 'pair' else frame_at(p, float(tt), sc)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f'{V}/prev-{i}-{tt}.jpg', quality=88)
    sys.exit(0)

# ---------- audio track ----------
starts, t = [], 0.0
for sc in scenes:
    starts.append(t); t += LEAD + sc['secs'] + TAIL + sc.get('hold', 0)
total = t
rate = 24000
track = np.zeros(int(total * rate) + rate, np.float32)
import soundfile as sf
for i, sc in enumerate(scenes):
    a, sr = sf.read(f'{V}/audio/{i + 1:02d}.wav', dtype='float32'); assert sr == rate
    s0 = int((starts[i] + LEAD) * rate); track[s0:s0 + len(a)] += a
peak = np.abs(track).max() or 1
sf.write(f'{V}/narration.wav', track / peak * 0.89, rate)

# ---------- video ----------
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-i', f'{V}/narration.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
                       '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUTFILE], stdin=subprocess.PIPE)
prev_last, n = None, 0
for i, sc in enumerate(scenes):
    p = prepare_pair(sc) if sc['device'] == 'pair' else prepare(sc)
    frames = int(round(p['dur'] * FPS))
    for f in range(frames):
        tt = f / FPS
        img = pair_frame(p, tt) if sc['device'] == 'pair' else frame_at(p, tt, sc)
        if prev_last is not None and tt < XFADE:
            k = ease(tt / XFADE); img = prev_last * (1 - k) + img * k
        if i == len(scenes) - 1 and tt > p['dur'] - 0.8:   # gentle fade at the very end
            k = (tt - (p['dur'] - 0.8)) / 0.8; img = img * (1 - k) + np.array([233, 243, 241], np.float32) * k
        out = np.clip(img, 0, 255).astype(np.uint8)
        ff.stdin.write(out.tobytes()); n += 1
        if f == frames - 1: prev_last = img
    print(f'scene {i + 1}/{len(scenes)} {p["dur"]:.1f}s', flush=True)
ff.stdin.close(); ff.wait()
print('frames', n, 'seconds', round(n / FPS, 1))
