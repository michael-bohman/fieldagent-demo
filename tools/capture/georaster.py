"""Warp a FieldAgent GeoTIFF into the demo's image contract: a Web-Mercator image covering the field's bbox.

  python3 georaster.py <tif> <boundary.geojson> <out_prefix> [--gray lo hi | --rgb] [--width N]

Writes <out_prefix>.png (grayscale value image or RGB), <out_prefix>_mask.png (valid data, white inside) and prints
JSON with the extent [W,S,E,N], the value range and the image size.
"""
import sys, json, math, numpy as np, rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
from PIL import Image

def merc_x(lon): return lon * 20037508.342789244 / 180
def merc_y(lat): return math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180) * 20037508.342789244 / 180

def bbox_of(geojson):
    def walk(c, acc):
        if isinstance(c[0], (int, float)): acc.append(c); return
        for x in c: walk(x, acc)
    pts = []
    for f in geojson['features']: walk(f['geometry']['coordinates'], pts)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]

def main():
    tif, gj, out = sys.argv[1:4]; args = sys.argv[4:]
    width = int(args[args.index('--width') + 1]) if '--width' in args else 640
    g = json.load(open(gj)); W, S, E, N = bbox_of(g)
    left, right = merc_x(W), merc_x(E); bottom, top = merc_y(S), merc_y(N)
    height = int(round(width * (top - bottom) / (right - left)))
    dst_transform = from_bounds(left, bottom, right, top, width, height)
    with rasterio.open(tif) as ds:
        nod = ds.nodata
        bands = ds.count
        dst = np.full((bands, height, width), np.nan, dtype='float64')
        for b in range(bands):
            src = ds.read(b + 1).astype('float64')
            if nod is not None: src[src == nod] = np.nan
            reproject(src, dst[b], src_transform=ds.transform, src_crs=ds.crs, dst_transform=dst_transform, dst_crs='EPSG:3857', src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.bilinear)
    valid = ~np.isnan(dst[0])
    if '--rgb' in args and bands >= 3:
        rgb = np.nan_to_num(dst[:3]).clip(0, 255).astype('uint8').transpose(1, 2, 0)
        Image.fromarray(rgb).save(out + '.png', optimize=True); rng = None
    else:
        v = dst[0]; lo = float(np.nanmin(v)); hi = float(np.nanmax(v))
        if '--gray' in args: lo, hi = float(args[args.index('--gray') + 1]), float(args[args.index('--gray') + 2])
        gray = np.nan_to_num((v - lo) / (hi - lo) * 255, nan=0).clip(0, 255).round().astype('uint8')
        Image.fromarray(gray, 'L').save(out + '.png', optimize=True); rng = [lo, hi]
    Image.fromarray((valid * 255).astype('uint8'), 'L').save(out + '_mask.png', optimize=True)
    print(json.dumps({'extent': [W, S, E, N], 'range': rng, 'size': [width, height], 'valid_frac': round(float(valid.mean()), 3)}))

main()
