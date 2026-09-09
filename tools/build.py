"""Assemble the demo site and a single-file preview.

  <root>/demo.html                 hosted version: external css/js, images loaded on demand from img/
  <root>/index.html                catalogue of the demos with their embed snippets
  <root>/build/fa-demos-preview.html   single file (inline css/js, data URIs) for a quick look without hosting
  <root>/build/fa-demos-artifact.html  the same without the document skeleton (for the Claude Artifact tool)

Usage: python3 tools/build.py [site root]   (default: the current directory when it holds demo.template.html,
otherwise ./fa-demos)
"""
import re, json, base64, pathlib, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ('.' if pathlib.Path('demo.template.html').exists() else 'fa-demos'))
outdir = root / 'build'; outdir.mkdir(exist_ok=True)
tpl = (root / 'demo.template.html').read_text(encoding='utf-8')
sprite = (root / 'sprite.svg.html').read_text(encoding='utf-8')
css = (root / 'fa-style.css').read_text(encoding='utf-8')
tour_css = (root / 'fa-tour.css').read_text(encoding='utf-8')
ext_css = (root / 'fa-ext.css').read_text(encoding='utf-8')
ext_js = (root / 'fa-ext.js').read_text(encoding='utf-8')
engine = (root / 'fa-engine.js').read_text(encoding='utf-8')
tour = (root / 'fa-tour.js').read_text(encoding='utf-8')
scen = (root / 'scenarios.js').read_text(encoding='utf-8')
data_js = (root / 'data/fa-data.js').read_text(encoding='utf-8')
data = json.loads(data_js[len('window.FA_DATA = '):-2])

# ---- hosted demo.html ----
hosted = tpl.replace('<!--STYLES-->', '<link rel="stylesheet" href="fa-style.css">\n<link rel="stylesheet" href="fa-tour.css">\n<link rel="stylesheet" href="fa-ext.css">')
hosted = hosted.replace('<!--SPRITE-->', sprite)
hosted = hosted.replace('<!--SCRIPTS-->', '<script src="data/fa-data.js"></script>\n<script src="fa-engine.js"></script>\n<script src="fa-ext.js"></script>\n<script src="fa-tour.js"></script>\n<script src="scenarios.js"></script>')
(root / 'demo.html').write_text(hosted, encoding='utf-8')

# ---- single-file preview: field f1 (the three Mavic flights, satellite, near basemaps) and the stand-count field f3
#      and the tassel-count field f4, each with a couple of sample photos ----
keep_surveys = {'m3m0904', 'm3m0819', 'm3e0904', 'sc0610', 'tc0805', 'eh0430'}
keep_samples = {'ph_f3_sc0610_18_a1', 'ph_f3_sc0610_18_a2', 'ph_f3_sc0610_21_a1', 'ph_f4_tc0805_14_a1', 'ph_f4_tc0805_21_a1'}
slim = json.loads(json.dumps(data))
slim['fields'] = [f for f in slim['fields'] if f['id'] in ('f1', 'f3', 'f4', 'f5')]
for f in slim['fields']:
    f['surveys'] = [s for s in f['surveys'] if s['key'] in keep_surveys]
    for s in f['surveys']:
        for a in s.get('analytics', []):
            for pt in a.get('points', []):
                if 'img' in pt:
                    pt['img'] = {k: v for k, v in pt['img'].items() if v in keep_samples}
                    if not pt['img']: del pt['img']
def keep_key(k):
    if k.startswith('bm_'): return k in ('bm_f1', 'bm_far', 'bm_f3_l0', 'bm_f3_l2', 'bm_f3_l10', 'bm_f5_l0', 'bm_f5_l6')
    if k.startswith('ph_f3_') or k.startswith('ph_f4_'): return k in keep_samples
    m = re.match(r'(ph_)?f[1345]_(sat\d+|[a-z0-9]+)_', k)
    if not m: return False
    grp = m.group(2)
    return grp.startswith('sat') or grp in keep_surveys
inline_img = {}
total = 0
for k, rel in data['img'].items():
    if not keep_key(k): continue
    p = root / rel; b = p.read_bytes(); total += len(b)
    mime = 'image/png' if rel.endswith('.png') else 'image/jpeg'
    inline_img[k] = f'data:{mime};base64,' + base64.b64encode(b).decode('ascii')
slim['img'] = inline_img
slim['dims'] = {k: v for k, v in slim['dims'].items() if k in inline_img}
slim_js = 'window.FA_DATA = ' + json.dumps(slim, separators=(',', ':')) + ';'
single = tpl.replace('<!--STYLES-->', f'<style>\n{css}\n{tour_css}\n{ext_css}\n</style>')
single = single.replace('<!--SPRITE-->', sprite)
single = single.replace('<!--SCRIPTS-->', f'<script>{slim_js}</script>\n<script>{engine}</script>\n<script>{ext_js}</script>\n<script>{tour}</script>\n<script>{scen}</script>')
(outdir / 'fa-demos-preview.html').write_text(single, encoding='utf-8')
print(f'preview: {len(inline_img)} images, {total/1e6:.2f} MB raw, file {len(single)/1e6:.2f} MB')

# ---- artifact body: the same single file without the document skeleton (the Artifact tool adds its own) ----
art = single.split('<body>', 1)[1].rsplit('</body>', 1)[0]
head_styles = single.split('<!--STYLES-->', 1)[0] if '<!--STYLES-->' in single else ''
style_block = single[single.index('<style>'):single.index('</head>')]
fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Condensed:wght@700&display=swap">'
art = ('<title>FieldAgent Guided Demos</title>\n' + fonts + '\n' + style_block + '\n<script>window.FA_MODE = "page";</script>\n' + art)
(outdir / 'fa-demos-artifact.html').write_text(art, encoding='utf-8')
print(f'artifact body {len(art)/1e6:.2f} MB')

# ---- catalogue ----
scen_ids = re.findall(r"S\['([a-z-]+)'\] = \{\s*id: '[a-z-]+', title: '([^']+)', page: PAGE\.(\w+)", scen)
space = re.search(r"const SPACE = '([^']+)'", scen).group(1)
pages = {k: space + v for k, v in re.findall(r"(\w+): P\('([^']+)'\)", scen)}
rows = ''.join(f"""<tr><td><a href="demo.html?s={sid}&mode=page">{title}</a></td><td><code>{pages.get(pg,'')}</code></td>
<td><code>demo.html?s={sid}&amp;mode=embed</code></td></tr>""" for sid, title, pg in scen_ids)
index = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FieldAgent guided demos</title><meta name="robots" content="noindex">
<style>body{{margin:0;padding:32px 24px 60px;background:#0e0e0e;color:#e8e8e8;font:15px/1.5 Roboto,"Helvetica Neue",Arial,sans-serif}}main{{max-width:960px;margin:0 auto}}h1{{font-weight:500;font-size:26px;margin:0 0 6px}}p{{color:#bdbdbd;max-width:70ch}}table{{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}}th,td{{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.12);vertical-align:top}}th{{color:#9b9b9b;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.06em}}a{{color:#aacc6c}}code{{font:13px ui-monospace,Menlo,Consolas,monospace;color:#cfcfcf;word-break:break-all}}pre{{background:#161616;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:12px 14px;overflow:auto}}</style></head>
<body><main><h1>FieldAgent guided demos</h1>
<p>Interactive, view-only copies of FieldAgent Web built from a real field, each with a step-by-step guide for one feature of the support documentation. Open a demo full-size, or embed its URL in the matching support page.</p>
<table><thead><tr><th>Demo</th><th>Support page</th><th>Embed URL</th></tr></thead><tbody>{rows}</tbody></table>
<h2 style="font-weight:500;font-size:18px;margin-top:36px">Embedding in GitBook</h2>
<p>Through the <code>fieldagent-demo</code> GitBook integration the block is written in Markdown as a fenced code block, so it survives Git Sync:</p>
<pre><code>```fieldagent-demo scenario="map-layers"
```</code></pre>
<p>Without the integration, link out from the page instead: <code>&lt;a href="…/demo.html?s=map-layers&amp;mode=page" class="button primary"&gt;Try it in the interactive demo&lt;/a&gt;</code></p>
</main></body></html>"""
(root / 'index.html').write_text(index, encoding='utf-8')
print('hosted demo.html', len(hosted), 'index.html', len(index))
