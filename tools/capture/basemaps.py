"""Stitch the 2x zoom captures of the FieldAgent map into basemap images and georeference them.

Each level was captured as 2x tiles of the CSS region x 200..1150, y 0..801 (the part of the map free of UI overlays).
Georeferencing: the cyan field boundary (known geometry) where it is large enough, otherwise the scale bar
(mapbox ScaleControl: ground distance across the viewport centre row) plus a shared anchor point.
"""
import json, math, sys, pathlib
import numpy as np
from PIL import Image

SHOTS = pathlib.Path('/tmp/claude-chrome-screenshots-gJ1MSV')
OUT = pathlib.Path(__file__).resolve().parent / 'basemaps'
OUT.mkdir(exist_ok=True)

def merc_x(lon): return (lon + 180) / 360
def merc_y(lat):
    r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2
def merc_lon(x): return x * 360 - 180
def merc_lat(y):
    n = math.pi - 2 * math.pi * y; return math.degrees(math.atan(0.5 * (math.exp(n) - math.exp(-n))))

R_HAVERSINE = 6371008.8            # mapbox LngLat.distanceTo
CIRC_H = 2 * math.pi * R_HAVERSINE  # 40 030 229 m

# field extent (bbox of the boundary) from the zones export
EXT = [-94.70129013061523, 44.181511499119196, -94.69622611999513, 44.188728057149156]  # W S E N
WX0, WX1 = merc_x(EXT[0]), merc_x(EXT[2]); WY0, WY1 = merc_y(EXT[3]), merc_y(EXT[1])   # y grows southwards
CURSOR = (803.0, 400.0)  # CSS px: wheel zoom pivot for levels 0..8 and 10

# level definitions: tiles (shot index -> css region), scale bar (text, px), method
LEVELS = {
  'l0': dict(tiles={25: (200, 0, 675, 267), 26: (675, 0, 1150, 267), 27: (200, 267, 675, 534), 28: (675, 267, 1150, 534), 29: (200, 534, 675, 801), 30: (675, 534, 1150, 801)}, bar=('1,000 ft', 243.404)),
  'l1': dict(tiles={31: (200, 0, 675, 400), 32: (675, 0, 1150, 400), 33: (200, 400, 675, 801), 34: (675, 400, 1150, 801)}, bar=('1,000 ft', 138.172)),
  'l2': dict(tiles={38: (200, 0, 675, 400), 39: (675, 0, 1150, 400), 40: (200, 400, 675, 801), 41: (675, 400, 1150, 801)}, bar=('3,000 ft', 217.577)),
  'l3': dict(tiles={45: (200, 0, 675, 400), 46: (675, 0, 1150, 400), 47: (200, 400, 675, 801), 48: (675, 400, 1150, 801)}, bar=('1 mi', 194.975)),
  'l4': dict(tiles={52: (200, 0, 675, 400), 53: (675, 0, 1150, 400), 54: (200, 400, 675, 801), 55: (675, 400, 1150, 801)}, bar=('2 mi', 198.546)),
  'l5': dict(tiles={59: (200, 0, 675, 400), 60: (675, 0, 1150, 400), 61: (200, 400, 675, 801), 62: (675, 400, 1150, 801)}, bar=('5 mi', 249.854)),
  'l6': dict(tiles={66: (200, 0, 675, 400), 67: (675, 0, 1150, 400), 68: (200, 400, 675, 801), 69: (675, 400, 1150, 801)}, bar=('10 mi', 251.537)),
  'l7': dict(tiles={73: (200, 0, 675, 400), 74: (675, 0, 1150, 400), 75: (200, 400, 675, 801), 76: (675, 400, 1150, 801)}, bar=('10 mi', 126.615)),
  'l8': dict(tiles={80: (200, 0, 675, 400), 81: (675, 0, 1150, 400), 82: (200, 400, 675, 801), 83: (675, 400, 1150, 801)}, bar=('30 mi', 191.202)),
  'l9': dict(tiles={86: (200, 0, 675, 400), 87: (675, 0, 1150, 400), 88: (200, 400, 675, 801), 89: (675, 400, 1150, 801)}, bar=('30 mi', 192.388), anchor='blob'),
  'l10': dict(tiles={95: (200, 0, 675, 400), 96: (675, 0, 1150, 400), 97: (200, 400, 675, 801), 98: (675, 400, 1150, 801)}, bar=('50 mi', 161.402), anchor='cursor_l9'),
}
FT = 0.3048; MI = 1609.344
def bar_m(txt):
    n, u = txt.replace(',', '').split(); n = float(n); return n * (FT if u == 'ft' else MI)

def shot(i):
    m = sorted(SHOTS.glob(f'screenshot-*-{i}.png')); assert len(m) == 1, (i, m); return Image.open(m[0]).convert('RGB')

def stitch(level):
    tiles = LEVELS[level]['tiles']; W, H = 950 * 2, 801 * 2
    canvas = Image.new('RGB', (W, H))
    for idx, (x0, y0, x1, y1) in tiles.items():
        im = shot(idx); ew, eh = (x1 - x0) * 2, (y1 - y0) * 2
        if im.size != (ew, eh): im = im.resize((ew, eh), Image.LANCZOS)
        canvas.paste(im, ((x0 - 200) * 2, y0 * 2))
    return canvas

def cyan_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (b > 190) & (g > 150) & (g < 235) & (r < 130) & (b - r > 100)

def georef_boundary(a):
    """image px (2x) per merc unit + origin from the cyan boundary bbox; returns (s, ox, oy) with px = o + s*world."""
    m = cyan_mask(a); ys, xs = np.nonzero(m)
    if len(xs) < 50: return None
    # stroke half width: median thickness of vertical runs on the left edge column band
    x_min, x_max, y_min, y_max = xs.min(), xs.max(), ys.min(), ys.max()
    # estimate stroke width from the row through the middle: runs of cyan
    mid = (y_min + y_max) // 2; row = m[mid]; runs = []; run = 0
    for v in row:
        if v: run += 1
        elif run: runs.append(run); run = 0
    if run: runs.append(run)
    sw = float(np.median(runs)) if runs else 6.0
    hw = sw / 2
    px_x0, px_x1 = x_min + hw, x_max - hw; px_y0, px_y1 = y_min + hw, y_max - hw
    sx = (px_x1 - px_x0) / (WX1 - WX0); sy = (px_y1 - px_y0) / (WY1 - WY0)
    s = (sx + sy) / 2
    ox = px_x0 - s * WX0; oy = px_y0 - s * WY0
    return dict(s=s, ox=ox, oy=oy, sx=sx, sy=sy, stroke=sw, bbox=(int(x_min), int(y_min), int(x_max), int(y_max)))

def blob_centroid(a):
    m = cyan_mask(a); ys, xs = np.nonzero(m)
    if len(xs) < 4: return None
    return float(xs.mean()), float(ys.mean()), int(len(xs))

def scale_from_bar(level, lat_center):
    txt, px = LEVELS[level]['bar']; mpp_css = bar_m(txt) / px              # ground metres per CSS px at the centre row
    world_per_css = mpp_css / (CIRC_H * math.cos(math.radians(lat_center)))
    return 1 / world_per_css / 2                                              # world units -> image px (2x) : px per world unit... inverted below

def main():
    results = {}
    # ---- fine levels: boundary fit
    world_cursor = None
    for lv in ['l0', 'l1', 'l2']:
        im = stitch(lv); a = np.asarray(im)
        g = georef_boundary(a)
        # cursor world coordinate for this level
        cx, cy = (CURSOR[0] - 200) * 2, CURSOR[1] * 2
        wc = ((cx - g['ox']) / g['s'], (cy - g['oy']) / g['s'])
        # scale bar cross-check: centre-row latitude
        lat_c = merc_lat((801 - g['oy']) / g['s'])   # css y=400.5 -> 2x px 801
        txt, px = LEVELS[lv]['bar']; mpp_css = bar_m(txt) / px
        s_bar = 2 * CIRC_H * math.cos(math.radians(lat_c)) / mpp_css     # px(2x) per world unit
        print(f"{lv}: stroke={g['stroke']:.1f} sx={g['sx']:.1f} sy={g['sy']:.1f} (ratio {g['sx']/g['sy']:.4f}) s_bar={s_bar:.1f} diff={(s_bar/g['s']-1)*100:+.2f}%  cursor world={wc[0]:.8f},{wc[1]:.8f}")
        if lv == 'l0': world_cursor = wc
        results[lv] = dict(s=g['s'], ox=g['ox'], oy=g['oy'], method='boundary', img=im)
    # ---- coarse levels: scale bar + cursor anchor
    for lv in ['l3', 'l4', 'l5', 'l6', 'l7', 'l8']:
        im = stitch(lv); a = np.asarray(im)
        txt, px = LEVELS[lv]['bar']; mpp_css = bar_m(txt) / px
        # iterate centre latitude
        lat_c = merc_lat(world_cursor[1])
        for _ in range(3):
            s = 2 * CIRC_H * math.cos(math.radians(lat_c)) / mpp_css
            cx, cy = (CURSOR[0] - 200) * 2, CURSOR[1] * 2
            ox = cx - s * world_cursor[0]; oy = cy - s * world_cursor[1]
            lat_c = merc_lat((801 - oy) / s)
        bc = blob_centroid(a)
        if bc:
            bx, by, n = bc; ex, ey = ox + s * (WX0 + WX1) / 2, oy + s * (WY0 + WY1) / 2
            print(f"{lv}: s={s:.1f} blob n={n} centroid=({bx:.1f},{by:.1f}) expected field centre=({ex:.1f},{ey:.1f}) off=({bx-ex:+.1f},{by-ey:+.1f}) px")
        results[lv] = dict(s=s, ox=ox, oy=oy, method='bar+cursor', img=im)
    # ---- l9: same zoom as l8 (pan only), anchor = blob centroid vs field centre
    im = stitch('l9'); a = np.asarray(im)
    txt, px = LEVELS['l9']['bar']; mpp_css = bar_m(txt) / px
    bx, by, n = blob_centroid(a)
    lat_c = merc_lat((WY0 + WY1) / 2)
    for _ in range(3):
        s = 2 * CIRC_H * math.cos(math.radians(lat_c)) / mpp_css
        ox = bx - s * (WX0 + WX1) / 2; oy = by - s * (WY0 + WY1) / 2
        lat_c = merc_lat((801 - oy) / s)
    print(f"l9: s={s:.1f} (l8 s={results['l8']['s']:.1f}) blob n={n} at ({bx:.1f},{by:.1f})")
    results['l9'] = dict(s=s, ox=ox, oy=oy, method='bar+blob', img=im)
    cx, cy = (CURSOR[0] - 200) * 2, CURSOR[1] * 2
    wc9 = ((cx - ox) / s, (cy - oy) / s)
    # ---- l10: zoom around the cursor from l9
    im = stitch('l10'); a = np.asarray(im)
    txt, px = LEVELS['l10']['bar']; mpp_css = bar_m(txt) / px
    lat_c = merc_lat(wc9[1])
    for _ in range(3):
        s = 2 * CIRC_H * math.cos(math.radians(lat_c)) / mpp_css
        ox = cx - s * wc9[0]; oy = cy - s * wc9[1]
        lat_c = merc_lat((801 - oy) / s)
    bc = blob_centroid(a)
    if bc:
        bx, by, n = bc; ex, ey = ox + s * (WX0 + WX1) / 2, oy + s * (WY0 + WY1) / 2
        print(f"l10: s={s:.1f} blob n={n} centroid=({bx:.1f},{by:.1f}) expected=({ex:.1f},{ey:.1f}) off=({bx-ex:+.1f},{by-ey:+.1f}) px")
    results['l10'] = dict(s=s, ox=ox, oy=oy, method='bar+cursor9', img=im)

    # ---- export
    meta = {}
    for lv, r in results.items():
        im = r['img']; W, H = im.size; s, ox, oy = r['s'], r['ox'], r['oy']
        bounds = dict(W=merc_lon((0 - ox) / s), E=merc_lon((W - ox) / s), N=merc_lat((0 - oy) / s), S=merc_lat((H - oy) / s))
        name = f'bm_f3_{lv}'
        im.save(OUT / f'{name}.jpg', quality=82, optimize=True, progressive=True)
        mpp = CIRC_H * math.cos(math.radians((bounds['N'] + bounds['S']) / 2)) / s
        meta[name] = dict(bounds=bounds, size=[W, H], method=r['method'], m_per_px=round(mpp, 3), bytes=(OUT / f'{name}.jpg').stat().st_size)
        print(f"{name}: {W}x{H} {mpp:.2f} m/px bounds W={bounds['W']:.5f} E={bounds['E']:.5f} N={bounds['N']:.5f} S={bounds['S']:.5f} {(OUT / f'{name}.jpg').stat().st_size//1024} KB")
    json.dump(meta, open(OUT / 'basemaps.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
