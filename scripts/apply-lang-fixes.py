#!/usr/bin/env python3
"""Apply reviewed translation fixes to the language packs.

Usage: python3 scripts/apply-lang-fixes.py <audit-dir> [codes...]
Reads <code>-fixes.json ({ui, clinical, layers, deciders, notice?, inline?}) and patches
public/app/lang/<code>.js in place (and inline text in shared files for 'inline' entries).
Refuses unknown keys and changed placeholders, so a fix can never silently miss.
"""
import json, os, re, sys

root = os.path.join(os.path.dirname(__file__), '..')
src = sys.argv[1]
codes = sys.argv[2:] or ['ml', 'ta', 'kn', 'te', 'hi', 'mr']
PH = re.compile(r'\{[a-zA-Z]+\}')
problems = []

def ph(s):
    return sorted(PH.findall(json.dumps(s, ensure_ascii=False)))

for code in codes:
    f = os.path.join(src, f'{code}-fixes.json')
    if not os.path.exists(f):
        print('no fixes for', code); continue
    fx = json.load(open(f, encoding='utf-8'))
    path = os.path.join(root, 'public', 'app', 'lang', f'{code}.js')
    text = open(path, encoding='utf-8').read()
    head, body = text.split('export default ', 1)
    pack = json.loads(body.rstrip().rstrip(';'))
    n = 0
    for sec in ('ui', 'clinical', 'layers', 'deciders'):
        for k, v in (fx.get(sec) or {}).items():
            if k not in pack.get(sec, {}):
                problems.append(f'{code}.{sec}: unknown key {k!r}'); continue
            if ph(pack[sec][k]) != ph(v):
                problems.append(f'{code}.{sec}: placeholder change in {k!r}'); continue
            if pack[sec][k] != v:
                pack[sec][k] = v; n += 1
    if fx.get('notice'):
        if 'notice' not in pack:
            problems.append(f'{code}: notice given but pack has none')
        elif ph(pack['notice']) != ph(fx['notice']):
            problems.append(f'{code}: notice placeholders differ {ph(pack["notice"])} vs {ph(fx["notice"])}')
        elif len(fx['notice']) != len(pack['notice']):
            problems.append(f'{code}: notice section count differs')
        else:
            pack['notice'] = fx['notice']; n += 1
    open(path, 'w', encoding='utf-8').write(head + 'export default ' + json.dumps(pack, ensure_ascii=False, indent=1) + ';\n')
    m = 0
    for it in fx.get('inline') or []:
        p = os.path.join(root, it['file'])
        t = open(p, encoding='utf-8').read()
        c = t.count(it['old'])
        if c != 1:
            problems.append(f'{code} inline {it["file"]}: old text found {c} times: {it["old"][:50]!r}'); continue
        open(p, 'w', encoding='utf-8').write(t.replace(it['old'], it['new'])); m += 1
    print(code, n, 'pack changes', m, 'inline changes')

if problems:
    print('\nPROBLEMS:'); print('\n'.join(problems)); sys.exit(1)
