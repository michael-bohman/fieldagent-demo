"""Refresh pkg2/ from the working copies and zip it: python3 pkg.py <n> [<previous full zip for the delta>]

Writes /mnt/user-data/outputs/fieldagent-demos-update-<n>.zip (full) and -<n>-delta.zip (files changed since the previous
package). README.md / SETUP.md in pkg2/ are edited by hand before running this.
"""
import sys, shutil, pathlib, hashlib, zipfile, os
root = pathlib.Path(__file__).resolve().parent
n = sys.argv[1]; prev = sys.argv[2] if len(sys.argv) > 2 else None
dst = root / 'pkg2' / 'fieldagent-demos'
shutil.rmtree(dst); shutil.copytree(root / 'fa-demos', dst, ignore=shutil.ignore_patterns('build', '.DS_Store', 'tools', 'node_modules'))
tools = dst / 'tools'; tools.mkdir(exist_ok=True); (tools / 'capture').mkdir(exist_ok=True)
for f in ['patch_engine.py', 'build.py', 'lookalike_logic.js', 'pw_tour.js', 'pw_restart.js', 'pw_switch.js', 'pw_views.js', 'pw_standcount.js', 'pw_frames.js', 'pw_autoplay.js', 'pw_midshot.js', 'pw_video.js', 'sheet.py', 'pkg.py']:
    shutil.copy(root / f, tools / f)
for f in sorted(p.name for p in (root / 'cap').glob('*.py')):
    shutil.copy(root / 'cap' / f, tools / 'capture' / f)
(dst / '.nojekyll').touch(); (dst / '.gitignore').write_text('build/\nnode_modules/\n.DS_Store\n')
idst = root / 'pkg2' / 'fa-demos-integration'
shutil.rmtree(idst); shutil.copytree(root / 'fa-demos-integration', idst, ignore=shutil.ignore_patterns('node_modules', '.DS_Store', 'dist', '.gitbook'))
out = f'/mnt/user-data/outputs/fieldagent-demos-update-{n}.zip'
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in (root / 'pkg2').rglob('*'):
        if p.is_file() and '.DS_Store' not in p.name: z.write(p, str(p.relative_to(root / 'pkg2')))
print('full', round(os.path.getsize(out) / 1e6, 2), 'MB')
if prev:
    tmp = pathlib.Path('/tmp/pkg_prev'); shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
    with zipfile.ZipFile(prev) as z: z.extractall(tmp)
    h = lambda p: hashlib.md5(p.read_bytes()).hexdigest()
    changed = [p.relative_to(root / 'pkg2') for p in (root / 'pkg2').rglob('*') if p.is_file() and '.DS_Store' not in p.name and (not (tmp / p.relative_to(root / 'pkg2')).exists() or h(tmp / p.relative_to(root / 'pkg2')) != h(p))]
    outd = f'/mnt/user-data/outputs/fieldagent-demos-update-{n}-delta.zip'
    with zipfile.ZipFile(outd, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in changed: z.write(root / 'pkg2' / rel, str(rel))
        z.writestr('DELTA-README.txt', f'Update {n} delta: only the files that changed since the previous update package. Copy the contents of fieldagent-demos/ over your fieldagent-demo repo (and fa-demos-integration/ over the integration folder), replacing files. If you skipped a package, use the full fieldagent-demos-update-{n}.zip instead.\n')
    print(len(changed), 'changed files; delta', round(os.path.getsize(outd) / 1e6, 2), 'MB'); print('\n'.join(sorted(str(c) for c in changed)))
