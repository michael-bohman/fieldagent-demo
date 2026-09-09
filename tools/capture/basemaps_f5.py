"""Basemaps for f5 (Field Scale Elevation and Hydrology) from the 2x zoom captures in eh_shots/.

Region captured: CSS x 130..1150, y 0..765 (the part of the collapsed-panel map free of overlays), as 3x3 tiles for the
fine level and 2x2 tiles for the others. Wheel-zoom pivot (644, 400) is the same world point at every level (the map was
only zoomed, never panned, after the fine capture), so the fine level's boundary fit anchors all coarser levels.
"""
import json, math, pathlib
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SHOTS = HERE / 'eh_shots'
OUT = HERE / 'basemaps_f5'; OUT.mkdir(exist_ok=True)

def merc_x(lon): return (lon + 180) / 360
def merc_y(lat):
    r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2
def merc_lon(x): return x * 360 - 180
def merc_lat(y):
    n = math.pi - 2 * math.pi * y; return math.degrees(math.atan(0.5 * (math.exp(n) - math.exp(-n))))
CIRC_H = 2 * math.pi * 6371008.8

zones = json.load(open(HERE / 'eh_zones.geojson'))
pts = [c for poly in zones['features'][0]['geometry']['coordinates'] for ring in poly for c in ring]
EXT = [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
WX0, WX1 = merc_x(EXT[0]), merc_x(EXT[2]); WY0, WY1 = merc_y(EXT[3]), merc_y(EXT[1])
PIVOT = (644.0, 400.0); RX0, RY0 = 130, 0   # region origin in CSS px
W, H = (1150 - 130) * 2, 765 * 2

def tiles3(a, b, c, d, e, f, g, h, i):
    cols = [(130, 470), (470, 810), (810, 1150)]; rows = [(0, 255), (255, 510), (510, 765)]
    ids = [a, b, c, d, e, f, g, h, i]; out = {}
    for r in range(3):
        for cc in range(3): out[ids[r * 3 + cc]] = (cols[cc][0], rows[r][0], cols[cc][1], rows[r][1])
    return out
def tiles2(a, b, c, d): return {a: (130, 0, 640, 382), b: (640, 0, 1150, 382), c: (130, 382, 640, 765), d: (640, 382, 1150, 765)}

LEVELS = {
  'l0': dict(tiles=tiles3(12, 13, 14, 15, 16, 17, 18, 19, 20), bar=('1,000 ft', 238.174)),
  'l1': dict(tiles=tiles2(23, 24, 25, 26), bar=('1,000 ft', 135.204)),
  'l2': dict(tiles=tiles2(29, 30, 31, 32), bar=('3,000 ft', 212.903)),
  'l3': dict(tiles=tiles2(34, 35, 36, 37), bar=('1 mi', 190.786)),
  'l4': dict(tiles=tiles2(39, 40, 41, 42), bar=('2 mi', 194.28)),
  'l5': dict(tiles=tiles2(45, 46, 47, 48), bar=('5 mi', 244.486)),
  'l6': dict(tiles=tiles2(54, 55, 56, 57), bar=('10 mi', 246.152)),
}
FT = 0.3048; MI = 1609.344
def bar_m(txt): n, u = txt.replace(',', '').split(); return float(n) * (FT if u == 'ft' else MI)
def shot(i):
    m = sorted(SHOTS.glob(f'screenshot-*-{i}.png')); assert len(m) == 1, (i, m); return Image.open(m[0]).convert('RGB')
def stitch(level):
    canvas = Image.new('RGB', (W, H))
    for idx, (x0, y0, x1, y1) in LEVELS[level]['tiles'].items():
        im = shot(idx); ew, eh = (x1 - x0) * 2, (y1 - y0) * 2
        if im.size != (ew, eh): im = im.resize((ew, eh), Image.LANCZOS)
        canvas.paste(im, ((x0 - RX0) * 2, (y0 - RY0) * 2))
    return canvas
def cyan_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (b > 190) & (g > 150) & (g < 235) & (r < 130) & (b - r > 100)
def georef_boundary(a):
    m = cyan_mask(a); ys, xs = np.nonzero(m)
    if len(xs) < 50: return None
    x_min, x_max, y_min, y_max = xs.min(), xs.max(), ys.min(), ys.max()
    # stroke width: median of the short horizontal runs of cyan (the stroke crossings), ignoring runs along the stroke
    runs = []
    for y in range(y_min, y_max + 1, 7):
        row = m[y]; run = 0
        for v in row:
            if v: run += 1
            elif run: runs.append(run); run = 0
        if run: runs.append(run)
    short = [r for r in runs if r <= 40]
    sw = float(np.median(short)) if short else 9.0; hw = sw / 2
    sx = (x_max - x_min - sw) / (WX1 - WX0); sy = (y_max - y_min - sw) / (WY1 - WY0); s = (sx + sy) / 2
    ox = x_min + hw - s * WX0; oy = y_min + hw - s * WY0
    return dict(s=s, ox=ox, oy=oy, sx=sx, sy=sy, stroke=sw)
def blob_centroid(a):
    m = cyan_mask(a); ys, xs = np.nonzero(m)
    return (float(xs.mean()), float(ys.mean()), int(len(xs))) if len(xs) >= 4 else None

results = {}
px, py = (PIVOT[0] - RX0) * 2, (PIVOT[1] - RY0) * 2
im0 = stitch('l0'); g = georef_boundary(np.asarray(im0))
wc = ((px - g['ox']) / g['s'], (py - g['oy']) / g['s'])
lat_c = merc_lat((765 - g['oy']) / g['s'])
txt, bpx = LEVELS['l0']['bar']; s_bar = 2 * CIRC_H * math.cos(math.radians(lat_c)) / (bar_m(txt) / bpx)
print(f"l0: stroke={g['stroke']:.1f} sx={g['sx']:.0f} sy={g['sy']:.0f} ratio={g['sx']/g['sy']:.4f} bar/boundary={(s_bar/g['s']-1)*100:+.2f}%  pivot world={wc[0]:.8f},{wc[1]:.8f}")
results['l0'] = dict(s=g['s'], ox=g['ox'], oy=g['oy'], img=im0, method='boundary')
for lv in ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']:
    im = stitch(lv); a = np.asarray(im); txt, bpx = LEVELS[lv]['bar']; mpp = bar_m(txt) / bpx
    lat_c = merc_lat(wc[1])
    for _ in range(3):
        s = 2 * CIRC_H * math.cos(math.radians(lat_c)) / mpp; ox = px - s * wc[0]; oy = py - s * wc[1]; lat_c = merc_lat((765 - oy) / s)
    gb = georef_boundary(a) if lv in ('l1', 'l2', 'l3') else None
    bc = blob_centroid(a); ex, ey = ox + s * (WX0 + WX1) / 2, oy + s * (WY0 + WY1) / 2
    extra = f" boundary-fit s={gb['s']:.0f} ({(s/gb['s']-1)*100:+.2f}% vs bar)" if gb else ''
    print(f"{lv}: s={s:.1f} blob n={bc[2] if bc else 0} off=({bc[0]-ex:+.1f},{bc[1]-ey:+.1f}) px{extra}" if bc else f"{lv}: s={s:.1f} no blob")
    results[lv] = dict(s=s, ox=ox, oy=oy, img=im, method='bar+pivot')
meta = {}
for lv, r in results.items():
    im = r['img']; s, ox, oy = r['s'], r['ox'], r['oy']
    bounds = dict(W=merc_lon((0 - ox) / s), E=merc_lon((W - ox) / s), N=merc_lat((0 - oy) / s), S=merc_lat((H - oy) / s))
    name = f'bm_f5_{lv}'; im.save(OUT / f'{name}.jpg', quality=82, optimize=True, progressive=True)
    mpp = CIRC_H * math.cos(math.radians((bounds['N'] + bounds['S']) / 2)) / s
    meta[name] = dict(bounds=bounds, size=[W, H], method=r['method'], m_per_px=round(mpp, 3), bytes=(OUT / f'{name}.jpg').stat().st_size)
    print(f"{name}: {mpp:.2f} m/px W={bounds['W']:.5f} E={bounds['E']:.5f} N={bounds['N']:.5f} S={bounds['S']:.5f} {(OUT / f'{name}.jpg').stat().st_size // 1024} KB")
json.dump(meta, open(OUT / 'basemaps.json', 'w'), indent=1)
print('field extent', EXT)
