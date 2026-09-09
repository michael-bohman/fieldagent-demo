"""Add field f4 — "Field Scale Tassel Count (71302-00)" (Sentera Demo Account; the same L-shaped field as f3, so it shares
the bm_f3_* basemaps) — to fa-demos/data/fa-data.js: two tassel heatmap rasters (the 2026 re-run and the 2022 original,
84002-00), the two individual-count layers, eight annotated sample photos (samples 14–21 of the 2026 layer), the 41 photo
positions, the two hybrid-comparison zones and the field's 2023 Corn season with its Plant activity. Idempotent.
"""
import json, pathlib, shutil
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'fa-demos'
DATA = SITE / 'data' / 'fa-data.js'
IMG = SITE / 'img'

zones_fc = json.load(open(HERE / 'tc_zones_all.geojson'))
pts26 = json.load(open(HERE / 'tc_samples.geojson'))['features']
pts22 = json.load(open(HERE / 'tc22_samples.geojson'))['features']

boundary_f = zones_fc['features'][0]; assert boundary_f['properties']['name'] == 'Field Boundary'
ring = [[round(x, 8), round(y, 8)] for x, y in boundary_f['geometry']['coordinates'][0][0]]
lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
extent = [min(lons), min(lats), max(lons), max(lats)]
center = [round((extent[0] + extent[2]) / 2, 8), round((extent[1] + extent[3]) / 2, 8)]
zones = []
for f in zones_fc['features'][1:]:
    rings = [[[round(x, 7), round(y, 7)] for x, y in poly[0]] for poly in f['geometry']['coordinates']]
    zones.append({'name': f['properties']['name'], 'acres': f['properties']['acres'], 'rings': rings})

CAPTURED = [14, 15, 16, 17, 18, 19, 20, 21]   # 2026 layer, viewer order = export order
def points_of(features, with_images):
    out = []; positions = []
    for i, f in enumerate(features, 1):
        p = f['properties']; lon, lat = f['geometry']['coordinates']
        fname = (p.get('files') or [''])[0]; fname = fname[fname.index('IMG_'):] if 'IMG_' in fname else fname   # '21b2f354ef_32_IMG_00030.jpg' -> 'IMG_00030.jpg'
        pt = {'i': i, 'lon': round(lon, 7), 'lat': round(lat, 7), 'density': round(p['TasselPPA'], 2), 'perimg': p['TasselsPerImage'], 'rowSpacing': 30.0, 'file': fname}
        if with_images and i in CAPTURED: pt['img'] = {'ANNOTATION': f'ph_f4_tc0805_{i}_a1'}
        out.append(pt); positions.append([round(lon, 6), round(lat, 6)])
    return out, positions
points26, positions = points_of(pts26, True)
points22, _ = points_of(pts22, False)
d26 = [p['density'] for p in points26]; d22 = [p['density'] for p in points22]
print('2026 density min/avg/max', min(d26), round(sum(d26) / len(d26)), max(d26), '| 2022', min(d22), round(sum(d22) / len(d22)), max(d22))

RANGE26 = [26004.318359375, 33466.890625]; RANGE22 = [24696.05859375, 34009.48828125]
copies = {
    'f4_tc0805_tasselheat': (HERE / 'tc_tasselheat.png', 'f4_tc0805_tasselheat.png'),
    'f4_tc0805_tassel22': (HERE / 'tc_tassel22.png', 'f4_tc0805_tassel22.png'),
    'f4_tc0805_mask': (HERE / 'tc_tasselheat_mask.png', 'f4_tc0805_mask.png'),
}
for i in CAPTURED: copies[f'ph_f4_tc0805_{i}_a1'] = (HERE / 'tc_samples_out' / f's{i}_a1.jpg', f'ph_f4_tc0805_{i}_a1.jpg')

src_js = DATA.read_text(encoding='utf-8'); prefix = 'window.FA_DATA = '
j = json.loads(src_js[len(prefix):].rstrip().rstrip(';'))
j['fields'] = [f for f in j['fields'] if f['id'] != 'f4']
for k in [k for k in j['img'] if k.startswith('f4_') or k.startswith('ph_f4_')]:
    j['img'].pop(k, None); j['dims'].pop(k, None)
for key, (src, dst) in copies.items():
    shutil.copyfile(src, IMG / dst); w, h = Image.open(IMG / dst).size
    j['img'][key] = f'img/{dst}'; j['dims'][key] = [w, h]

props = [{'id': 'density', 'label': 'Tassels (per acre)', 'viz': 'tassel'}, {'id': 'perimg', 'label': 'Tassels (per image)', 'viz': 'tasselimg'}]
survey = {
    'key': 'tc0805', 'name': '', 'date': '08-05-2022', 'bands': 's12',
    'photos': {'count': 41, 'positions': positions, 'samples': []},
    'tif': {'tasselheat': '1.31 MB', 'tassel22': '1.31 MB'},
    'analytics': [
        {'id': 'tasselheat', 'kind': 'raster', 'name': 'Tassel Count Heatmap (2026)', 'viz': 'tassel', 'range': RANGE26, 'product': 'Field Scale Tassel Count', 'code': '71302-00'},
        {'id': 'tassel22', 'kind': 'raster', 'name': 'Tassel (84002-00)', 'viz': 'tassel', 'range': RANGE22, 'product': 'Field Scale Tassel Count', 'code': '84002-00'},
        {'id': 'tasselpts', 'kind': 'samples', 'name': 'Tassel Count (2026)', 'viz': 'tassel', 'product': 'Field Scale Tassel Count', 'code': '71302-00',
         'props': props, 'points': points26, 'tabs': ['ANNOTATION'], 'detectedLabel': 'Tassels Detected', 'yieldEstimate': True, 'opacity': True, 'downloads': ['GeoJSON', 'CSV', 'Shapefile']},
        {'id': 'tasselpts22', 'kind': 'samples', 'name': 'Tassel Count (84002-00)', 'viz': 'tassel', 'product': 'Field Scale Tassel Count', 'code': '84002-00',
         'props': props, 'points': points22, 'tabs': ['ANNOTATION'], 'detectedLabel': 'Tassels Detected', 'yieldEstimate': True, 'opacity': True, 'downloads': ['GeoJSON', 'CSV', 'Shapefile']},
    ],
}
f4 = {
    'id': 'f4', 'name': 'Field Scale Tassel Count (71302-00)', 'acres': boundary_f['properties']['acres'], 'center': center, 'boundary': ring, 'extent': extent,
    'share': 'https://fieldagent.sentera.com/fieldview/gvy2xsa_OR_qi4cFieldScal_CV_prod_f1afe41d_220831_155142/ns1qujn_AS_qi4cFieldScal_CV_prod_7287f835_220928_172548',
    'surveys': [survey], 'zones': zones,
    # the field's real crop season (FieldAgent Web, 9 Sep 2026): 2023 Corn, Plant 05-31-2023, 13,759.32 seeds/acre, row spacing 11.81 in
    'seasons': [{'name': '2023 Corn', 'type': 'Corn', 'start': '', 'end': ''}],
    'activities': [{'season': 0, 'type': 'Plant', 'applied': '2023-05-31', 'rate': '13759.32', 'unit': 'seeds/acre', 'variety': '', 'spacing': '11.81', 'maturity': '', 'ears': []}],
    'refStats': {'tasselheat': {'Field Boundary': 31700, 'Hybrid comparison zone A': 31500, 'Hybrid comparison zone B': 32000},
                 'tassel22': {'Field Boundary': 31500, 'Hybrid comparison zone A': 31400, 'Hybrid comparison zone B': 31800},
                 'tasselpts': {'Field Boundary': [26000, 31500, 33500], 'Hybrid comparison zone A': [26000, 31200, 33500], 'Hybrid comparison zone B': [28000, 31700, 33400]},
                 'tasselpts22': {'Field Boundary': [24700, 31300, 34000], 'Hybrid comparison zone A': [24700, 31000, 34000], 'Hybrid comparison zone B': [27800, 31500, 33400]}},
}
j['fields'].append(f4)
DATA.write_text(prefix + json.dumps(j) + ';\n', encoding='utf-8')
print('fa-data.js written:', DATA.stat().st_size, 'bytes; images copied:', len(copies), '; sample files e.g.', points26[13]['file'])
