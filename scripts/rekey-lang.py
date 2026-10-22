#!/usr/bin/env python3
"""Rename English source strings (pack keys) in every language pack, keeping the translations.

Usage: python3 scripts/rekey-lang.py renames.json   # {"ui": {"old": "new"}, "clinical": {"old": "new"}}
Also replaces the English text in public/app/*.js and public/shared/*.js (must occur in source).
"""
import glob, json, os, sys

root = os.path.join(os.path.dirname(__file__), '..')
ren = json.load(open(sys.argv[1], encoding='utf-8'))
for path in glob.glob(os.path.join(root, 'public/app/lang/*.js')):
    text = open(path, encoding='utf-8').read()
    head, body = text.split('export default ', 1)
    pack = json.loads(body.rstrip().rstrip(';'))
    for sec, m in ren.items():
        d = pack.get(sec, {})
        pack[sec] = {m.get(k, k): v for k, v in d.items()}
    open(path, 'w', encoding='utf-8').write(head + 'export default ' + json.dumps(pack, ensure_ascii=False, indent=1) + ';\n')
srcs = glob.glob(os.path.join(root, 'public/app/*.js')) + glob.glob(os.path.join(root, 'public/shared/*.js'))
for sec, m in ren.items():
    for old, new in m.items():
        hits = 0
        for p in srcs:
            t = open(p, encoding='utf-8').read()
            if old in t:
                hits += t.count(old)
                open(p, 'w', encoding='utf-8').write(t.replace(old, new))
        print(f'{hits:2d} source hits: {old[:60]!r}')
        if not hits: sys.exit(f'not found in source: {old!r}')
