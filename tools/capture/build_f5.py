"""Add field f5 — "Field Scale Elevation and Hydrology (71309-00)" (Sentera Demo Account, 115.20 ac near Twin Lakes, MN) —
to fa-demos/data/fa-data.js: the Hillshade and Digital Elevation Model rasters, the 2-ft contour lines, the flow lines and the
depressions as vector feature layers, and seven basemaps around the field. Idempotent.
"""
import json, pathlib, shutil
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'fa-demos'
DATA = SITE / 'data' / 'fa-data.js'
IMG = SITE / 'img'
R = lambda v, n=6: round(v, n)

zones_fc = json.load(open(HERE / 'eh_zones.geojson'))
boundary_f = zones_fc['features'][0]; assert boundary_f['properties']['name'] == 'Field Boundary'
polys = boundary_f['geometry']['coordinates']; assert len(polys) == 1 and len(polys[0]) == 1
ring = [[R(x, 7), R(y, 7)] for x, y in polys[0][0]]
lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
extent = [min(lons), min(lats), max(lons), max(lats)]
center = [R((extent[0] + extent[2]) / 2, 7), R((extent[1] + extent[3]) / 2, 7)]

def rings_of(geom):
    if geom['type'] == 'LineString': return [[[R(x), R(y)] for x, y in geom['coordinates']]]
    if geom['type'] == 'MultiLineString': return [[[R(x), R(y)] for x, y in line] for line in geom['coordinates']]
    if geom['type'] == 'Polygon': return [[[R(x), R(y)] for x, y in r] for r in geom['coordinates']]
    if geom['type'] == 'MultiPolygon': return [[[R(x), R(y)] for x, y in r] for poly in geom['coordinates'] for r in poly]
    raise ValueError(geom['type'])

dep = json.load(open(HERE / 'eh_depressions.geojson'))['features']
depressions = [{'i': i, 'area': f['properties']['Area(Acres)'], 'rings': rings_of(f['geometry'])} for i, f in enumerate(dep, 1)]
flow = json.load(open(HERE / 'eh_flowlines.geojson'))['features']
flowlines = [{'i': i, 'cls': f['properties']['class'], 'width': f['properties'].get('stroke-width', 2), 'rings': rings_of(f['geometry'])} for i, f in enumerate(flow, 1)]
con = json.load(open(HERE / 'eh_contours.geojson'))['features']
contours = [{'i': i, 'elev': f['properties']['Elevation'], 'kind': f['properties'].get('Contour_Ty', ''), 'rings': rings_of(f['geometry'])} for i, f in enumerate(con, 1)]
areas = [d['area'] for d in depressions]; elevs = [c['elev'] for c in contours]
print(f'depressions {len(depressions)} area {min(areas)}–{max(areas)} | flow lines {len(flowlines)} classes {sorted(set(f["cls"] for f in flowlines))} widths {sorted(set(f["width"] for f in flowlines))} | contours {len(contours)} elev {min(elevs)}–{max(elevs)} ft')
print('vertices', sum(len(r) for d in depressions for r in d['rings']), sum(len(r) for f in flowlines for r in f['rings']), sum(len(r) for c in contours for r in c['rings']))

DEM_RANGE = [379.3599853515625, 390.6600036621094]; HILL_RANGE = [50.0, 245.0]
bm_meta = json.load(open(HERE / 'basemaps_f5' / 'basemaps.json'))
KEEP_BM = ['l0', 'l2', 'l4', 'l6']
copies = {'f5_eh0430_dem': (HERE / 'eh_dem.png', 'f5_eh0430_dem.png'), 'f5_eh0430_hill': (HERE / 'eh_hillshade.png', 'f5_eh0430_hill.png'), 'f5_eh0430_mask': (HERE / 'eh_dem_mask.png', 'f5_eh0430_mask.png')}
for lv in KEEP_BM: copies[f'bm_f5_{lv}'] = (HERE / 'basemaps_f5' / f'bm_f5_{lv}.jpg', f'bm_f5_{lv}.jpg')

src_js = DATA.read_text(encoding='utf-8'); prefix = 'window.FA_DATA = '
j = json.loads(src_js[len(prefix):].rstrip().rstrip(';'))
j['fields'] = [f for f in j['fields'] if f['id'] != 'f5']
j['basemaps'] = [b for b in j['basemaps'] if not b['key'].startswith('bm_f5_')]
for k in [k for k in j['img'] if k.startswith('f5_') or k.startswith('bm_f5_')]:
    j['img'].pop(k, None); j['dims'].pop(k, None)
for key, (src, dst) in copies.items():
    shutil.copyfile(src, IMG / dst); w, h = Image.open(IMG / dst).size
    j['img'][key] = f'img/{dst}'; j['dims'][key] = [w, h]
for lv in KEEP_BM: j['basemaps'].append({'key': f'bm_f5_{lv}', 'bounds': bm_meta[f'bm_f5_{lv}']['bounds']})

survey = {
    'key': 'eh0430', 'name': '', 'date': '04-30-2020', 'bands': 'rgb',
    'photos': {'count': 0, 'positions': [], 'samples': []},
    'tif': {'hill': '4.13 MB', 'dem': '791 kB'},
    'analytics': [
        {'id': 'hill', 'kind': 'raster', 'name': 'Hillshade (84007-00)', 'viz': 'hill', 'range': HILL_RANGE, 'product': 'Field Scale Elevation and Hydrology', 'code': '84007-00', 'opacity': 0.33,
         'note': 'Shaded relief computed from the elevation model: light from the north-west, so slopes facing it are bright and the lee sides dark.'},
        {'id': 'dem', 'kind': 'raster', 'name': 'Digital Elevation Model (82201-01)', 'viz': 'dem', 'range': DEM_RANGE, 'product': 'Field Scale Elevation and Hydrology', 'code': '82201-01',
         'note': 'Ground elevation in metres above sea level, sampled from the same flight.'},
        {'id': 'contours', 'kind': 'features', 'geom': 'line', 'name': 'Contour Lines (2ft) (84007-00)', 'noun': 'contour line', 'props': [{'id': 'elev', 'label': 'Elevation', 'viz': 'contour'}], 'features': contours, 'opacity': 0.6, 'style': {'width': 2},
         'note': 'One line every 2 ft of elevation; closer lines mean steeper ground.', 'product': 'Field Scale Elevation and Hydrology', 'code': '84007-00'},
        {'id': 'flowlines', 'kind': 'features', 'geom': 'line', 'name': 'Flow Lines (84008-00)', 'noun': 'flow line', 'props': [{'id': 'cls', 'label': 'class'}], 'features': flowlines, 'opacity': 1, 'style': {'color': '#009dff', 'width': 2},
         'note': 'Where surface water runs when it rains — wider lines carry more of the field.', 'product': 'Field Scale Elevation and Hydrology', 'code': '84008-00'},
        {'id': 'depressions', 'kind': 'features', 'geom': 'polygon', 'name': 'Depressions (84008-00)', 'noun': 'depression', 'props': [{'id': 'area', 'label': 'Area(Acres)', 'viz': 'acres'}], 'features': depressions, 'opacity': 0.6, 'style': {'outline': 1, 'outlineColor': 'rgba(255,255,255,.55)'},
         'note': 'Closed low spots where water can pool, with the area each one covers.', 'product': 'Field Scale Elevation and Hydrology', 'code': '84008-00'},
    ],
}
f5 = {
    'id': 'f5', 'name': 'Field Scale Elevation and Hydrology (71309-00)', 'acres': boundary_f['properties']['acres'], 'center': center, 'boundary': ring, 'extent': extent,
    'share': 'https://fieldagent.sentera.com/fieldview/gvy2xsa_OR_qi4cFieldScal_CV_prod_f1afe41d_220831_155142/cboplv0_AS_qi4cFieldScal_CV_prod_ba1a796c_220929_192319',
    'surveys': [survey], 'zones': [],
    # FieldAgent Web, 9 Sep 2026: Hillshade 5 bins 50.0–242 avg 179 (opacity 33%); DEM 20 bins 379–391 avg 384; contours 20 bins 1.25k–1.28k (60%); depressions 0.04–15.4 ac (60%)
    'refStats': {'hill': {'Field Boundary': 179}, 'dem': {'Field Boundary': 384}, 'contours': {'range': [1250, 1280]}, 'depressions': {'range': [0.04, 15.4]}},
}
j['fields'].append(f5)
DATA.write_text(prefix + json.dumps(j) + ';\n', encoding='utf-8')
print('fa-data.js written:', DATA.stat().st_size, 'bytes; images copied:', len(copies))
