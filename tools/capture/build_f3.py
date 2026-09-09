"""Add field f3 — "Field Scale Stand Count (71301-00)" from the Sentera Demo Account — to fa-demos/data/fa-data.js,
with its stand-count analytics (heatmap raster + individual sample points), the 41 photo positions, the four zones,
the sample-viewer captures and the six new basemaps. Idempotent: re-running replaces the f3 entries.
"""
import json, math, pathlib, shutil
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'fa-demos'
DATA = SITE / 'data' / 'fa-data.js'
IMG = SITE / 'img'

def acres_of(ring):
    # shoelace on an equirectangular projection around the ring's mean latitude (good to ~0.1% at field scale)
    lat0 = sum(p[1] for p in ring) / len(ring); k = math.cos(math.radians(lat0)) * 111319.49; ky = 111132.95
    a = 0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0] * k, ring[i][1] * ky; x2, y2 = ring[i + 1][0] * k, ring[i + 1][1] * ky
        a += x1 * y2 - x2 * y1
    return abs(a) / 2 / 4046.8564224

zones_fc = json.load(open(HERE / 'sc_zones_all.geojson'))
samples_fc = json.load(open(HERE / 'sc_samples.geojson'))
bm_meta = json.load(open(HERE / 'basemaps' / 'basemaps.json'))

boundary_f = zones_fc['features'][0]; assert boundary_f['properties']['name'] == 'Field Boundary'
ring = boundary_f['geometry']['coordinates'][0][0]
ring = [[round(x, 8), round(y, 8)] for x, y in ring]
lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
extent = [min(lons), min(lats), max(lons), max(lats)]
center = [round((extent[0] + extent[2]) / 2, 8), round((extent[1] + extent[3]) / 2, 8)]
print('boundary pts', len(ring), 'acres check', round(acres_of(ring), 2), 'vs', boundary_f['properties']['acres'])

zones = []
for f in zones_fc['features'][1:]:
    rings = [[[round(x, 7), round(y, 7)] for x, y in poly[0]] for poly in f['geometry']['coordinates']]
    zones.append({'name': f['properties']['name'], 'acres': f['properties']['acres'], 'rings': rings})
    print(' zone', f['properties']['name'], f['properties']['acres'], 'ac; calc', round(sum(acres_of(r) for r in rings), 2))

# sample points, in the order FieldAgent's viewer uses (the export order) — index i is 1-based like the viewer's "18 / 41"
CAPTURED = {17: ['a1'], 18: ['a1', 'a2'], 19: ['a1', 'a2'], 20: ['a1', 'a2'], 21: ['a1', 'a2'], 22: ['a1', 'a2'], 23: ['a1', 'a2'], 24: ['a1', 'a2']}
points = []; positions = []
for i, f in enumerate(samples_fc['features'], 1):
    p = f['properties']; lon, lat = f['geometry']['coordinates']
    pt = {'i': i, 'lon': round(lon, 7), 'lat': round(lat, 7), 'density': p['Plant Density (per acre)'], 'emergence': p['Emergence (%)'],
          'rowSpacing': round(p['RowSpacing'] / 2.54, 1), 'file': p['ImageName'], 'gsd': p['GSD'], 'angle': p['Angle']}
    if i in CAPTURED:
        pt['img'] = {}
        for tag in CAPTURED[i]:
            key = f'ph_f3_sc0610_{i}_{tag}'; pt['img']['ANNOTATION' if tag == 'a1' else 'ANNOTATION 2'] = key
    points.append(pt); positions.append([round(lon, 6), round(lat, 6)])
dens = [pt['density'] for pt in points]
print('samples', len(points), 'density min/avg/max', min(dens), round(sum(dens) / len(dens), 2), max(dens))

# raster range, from the GeoTIFF statistics measured when the heatmap PNG was made
HEAT_RANGE = [29616.47, 34876.63]

# ---- images
copies = {}
for lv in ['l0', 'l2', 'l4', 'l6', 'l9', 'l10']:
    src = HERE / 'basemaps' / f'bm_f3_{lv}.jpg'; copies[f'bm_f3_{lv}'] = (src, f'bm_f3_{lv}.jpg')
copies['f3_sc0610_standheat'] = (HERE / 'sc_standheat.png', 'f3_sc0610_standheat.png')
copies['f3_sc0610_mask'] = (HERE / 'sc_standheat_mask.png', 'f3_sc0610_mask.png')
for i, tags in CAPTURED.items():
    for tag in tags:
        copies[f'ph_f3_sc0610_{i}_{tag}'] = (HERE / 'samples_out' / f's{i}_{tag}.jpg', f'ph_f3_sc0610_{i}_{tag}.jpg')

src_js = DATA.read_text(encoding='utf-8'); prefix = 'window.FA_DATA = '
assert src_js.startswith(prefix)
j = json.loads(src_js[len(prefix):].rstrip().rstrip(';'))

# drop earlier f3 entries
j['fields'] = [f for f in j['fields'] if f['id'] != 'f3']
j['basemaps'] = [b for b in j['basemaps'] if not b['key'].startswith('bm_f3_')]
for k in [k for k in j['img'] if k.startswith('bm_f3_') or k.startswith('f3_') or k.startswith('ph_f3_')]:
    j['img'].pop(k, None); j['dims'].pop(k, None)

for key, (src, dst) in copies.items():
    shutil.copyfile(src, IMG / dst); w, h = Image.open(IMG / dst).size
    j['img'][key] = f'img/{dst}'; j['dims'][key] = [w, h]
for lv in ['l0', 'l2', 'l4', 'l6', 'l9', 'l10']:
    j['basemaps'].append({'key': f'bm_f3_{lv}', 'bounds': bm_meta[f'bm_f3_{lv}']['bounds']})

survey = {
    'key': 'sc0610', 'name': '', 'date': '06-10-2022', 'bands': 'rgb',
    'photos': {'count': 41, 'positions': positions, 'samples': []},
    'ranges': {'stand': HEAT_RANGE},
    'tif': {'standheat': '1.31 MB'},
    'analytics': [
        {'id': 'standheat', 'kind': 'raster', 'name': 'Stand Count Heatmap', 'viz': 'stand', 'product': 'Field Scale Stand Count', 'code': '71301-00'},
        {'id': 'standpts', 'kind': 'samples', 'name': 'Stand Count - Individual', 'viz': 'stand', 'product': 'Field Scale Stand Count', 'code': '71301-00',
         'props': [{'id': 'density', 'label': 'Plant Density (per acre)', 'viz': 'stand'}, {'id': 'emergence', 'label': 'Emergence (%)', 'viz': 'emerg'}],
         'points': points, 'downloads': ['GeoJSON', 'CSV', 'Shapefile']},
    ],
}
f3 = {
    'id': 'f3', 'name': 'Field Scale Stand Count (71301-00)', 'acres': boundary_f['properties']['acres'], 'center': center, 'boundary': ring, 'extent': extent,
    'share': 'https://fieldagent.sentera.com/fieldview/gvy2xsa_OR_qi4cFieldScal_CV_prod_f1afe41d_220831_155142/ybte993_AS_qi4cFieldScal_CV_prod_ed2ddfab_220919_204928',
    'surveys': [survey], 'zones': zones,
    # what FieldAgent Web printed for these layers on 9 Sep 2026 — used to check the demo's statistics
    'refStats': {'standheat': {'Field Boundary': 32800, 'weed pressure area': 32900, 'Planting Strip 1': 32600, 'Planting Strip 2': 32800, 'Water pooling area': 32600},
                 'standpts': {'Field Boundary': [29600, 32600, 34900], 'weed pressure area': [29600, 32400, 33300], 'Planting Strip 1': [30300, 32300, 33400], 'Planting Strip 2': [31600, 32900, 34900], 'Water pooling area': [32200, 32200, 32200]}},
}
j['fields'].append(f3)
DATA.write_text(prefix + json.dumps(j) + ';\n', encoding='utf-8')
print('fa-data.js written:', DATA.stat().st_size, 'bytes; images copied:', len(copies))
