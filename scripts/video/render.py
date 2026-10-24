#!/usr/bin/env python3
"""Render the walkthrough MP4 (1920x1080, 25 fps) from scenes.json + screenshots + narration WAVs.
Camera: wide view, then an eased zoom into each scene's focus area with a slow push; highlights use a
spotlight (the rest dims) with a marigold outline; taps show a ripple. No music, no captions.
Usage: python3 scripts/video/render.py <video-dir> <out.mp4>
"""
import json, math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

V, OUTFILE = sys.argv[1], sys.argv[2]
FPS, W, H, S = 25, 1920, 1080, 2          # output size; canvas is S times larger for crisp zooms
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

def prepare(sc):
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
    p = prepare(sc)
    frames = int(round(p['dur'] * FPS))
    for f in range(frames):
        tt = f / FPS
        img = frame_at(p, tt, sc)
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
