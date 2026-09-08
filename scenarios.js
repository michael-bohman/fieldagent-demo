/* ---------------------------------------------------------------------------
   FieldAgent guided demos — scenario catalogue.
   Each scenario maps to one support page. Selectors point at controls the engine renders (data-act attributes);
   events are the ones fa-engine.js emits when the reader completes the action.
--------------------------------------------------------------------------- */
window.FA_SCENARIOS = (function () {
  const F = 'f1';                 // FieldAgent Scout Tier Demo (15.63 ac)
  const MS = 'm3m0904';           // Mavic 3 Multispectral flight, 09-04-2024
  const MS_EARLIER = 'm3m0819';   // same sensor, 08-19-2024
  const PAGE = {
    tour: '/fieldagent/get-started/tour-of-fieldagent-web',
    find: '/fieldagent/fields/find-a-field',
    layers: '/fieldagent/view/map-layers',
    color: '/fieldagent/view/colorization-and-visualization',
    photos: '/fieldagent/view/photo-dots-and-image-viewer',
    zones: '/fieldagent/view/zones-and-zone-statistics',
    sat: '/fieldagent/analytics/satellite-imagery',
    crop: '/fieldagent/analytics/crop-health-mosaics',
    order: '/fieldagent/ordering/order-a-mosaic',
    why: '/fieldagent/ordering/why-cant-i-order',
    upload: '/fieldagent/imagery/import-imagery-in-fieldagent-web',
    qt: '/fieldagent/imagery/quicktiles-and-mosaics',
    report: '/fieldagent/exports/create-a-report',
    rx: '/fieldagent/exports/zone-rx-prescriptions',
    download: '/fieldagent/exports/download-and-export-data',
  };
  const back = { text: 'Click the <b>back arrow</b> at the top of the panel to return to the field view.', target: '[data-act="back"]', event: 'view_changed', match: d => d.view === 'field' };
  const openAdd = { text: 'Open <b>Add Map Layers</b>: click the layers icon in the <b>Map Layers</b> card.', target: '[data-act="add"]', event: 'add_layers_opened' };
  const ndvi = { kind: 'drone', survey: MS, product: 'ms', viz: 'ndvi' };
  const pickMenu = (menuSel, optSel) => (app, root) => { const b = root.querySelector(menuSel); if (!b) return; b.click(); setTimeout(() => { const o = root.querySelector(optSel); if (o) o.click(); }, 180); };

  const S = {};

  S['field-view'] = {
    id: 'field-view', title: 'Tour of the field view', page: PAGE.tour, field: F, seedLayers: true,
    intro: 'This is a working copy of FieldAgent Web built from a real field. Pan and zoom the map, click a layer name to open its details, and use the buttons the way you would in the real application. Nothing you do here changes real data.',
    steps: [],
    finish: { links: [{ label: 'Tour of FieldAgent Web', path: PAGE.tour }, { label: 'Map layers', path: PAGE.layers }] },
  };

  S['map-layers'] = {
    id: 'map-layers', title: 'Add and manage map layers', page: PAGE.layers, field: F, seedLayers: false,
    steps: [
      openAdd,
      { text: 'Under the <b>Mavic 3 Multispectral</b> flight of <b>09-04-2024</b>, turn on <b>Multispectral Mosaic</b>.', target: `[data-act="pick"][data-survey="${MS}"][data-product="ms"]`, event: 'layer_added', match: d => d.survey === MS && d.product === 'ms' },
      { text: 'Turn on <b>Photo Dots</b> for the same flight. Each dot is one photo.', target: `[data-act="pickphotos"][data-survey="${MS}"]`, event: 'layer_added', match: d => d.kind === 'photos' },
      back,
      { text: 'Hover the <b>Photo Dots</b> row and click the <b>eye</b> to hide it. Click again to show it. The <b>×</b> next to it removes a layer from the map.', target: '.layer-row[data-index="0"] [data-act="toggle"]', highlight: '.layer-row[data-index="0"]', event: 'layer_toggled', note: 'Layers higher in the list draw on top. Drag the ⋮⋮ handle to reorder them.' },
      { text: 'Click the <b>Multispectral Mosaic</b> layer name to open its details.', target: '.layer-row[data-index="1"]', event: 'layer_details_opened' },
    ],
    finish: { text: 'You added two layers, hid one, and opened a layer’s details. The details panel is where colorization, zone statistics and downloads live.', links: [{ label: 'Colorization and visualization', path: PAGE.color }, { label: 'Photo dots and the image viewer', path: PAGE.photos }] },
  };

  S['colorization'] = {
    id: 'colorization', title: 'Colorize an NDVI layer', page: PAGE.color, field: F, seedLayers: false,
    setup(app) { app.addLayer(ndvi, true, true); },
    steps: [
      { text: 'Drag the <b>bins</b> slider down to 3. Fewer bins give a simpler map that shows the broad pattern.', target: 'input[data-act="bins"]', event: 'bins_changed', demo: { value: 3 } },
      { text: 'Switch <b>By Area</b> to <b>By Range</b>. By Range uses equal value steps, so the same value always gets the same color.', target: '[data-act="mode"][data-mode="range"]', event: 'color_mode_changed', match: d => d.mode === 'range' },
      { text: 'Open <b>Color Scale</b> and pick another ramp.', target: '[data-act="menu"][data-menu="scale"]', event: 'color_scale_changed', showMe: pickMenu('[data-act="menu"][data-menu="scale"]', '.menu .opt:nth-child(2)') },
      { text: 'Drag the <b>left range handle</b> to the right. Values below it are no longer colored, which isolates the weakest ground.', target: 'input[data-act="rmin"]', event: 'range_changed', match: d => d.end === 'min', demo: { value: 0.35 } },
      { text: 'Click <b>Show More</b> to open the color table: every class with its value range and its area in acres.', target: '[data-act="bintable"]', event: 'bin_table_toggled', match: d => d.open },
    ],
    finish: { text: 'Bins, range, binning method and color scale are the whole toolkit. Set them first when you want to build zones or a prescription from a layer.', links: [{ label: 'Zones and zone statistics', path: PAGE.zones }, { label: 'Zone Rx prescriptions', path: PAGE.rx }] },
  };

  S['compare-dates'] = {
    id: 'compare-dates', title: 'Compare two flight dates', page: PAGE.crop, field: F, seedLayers: false,
    setup(app) { app.addLayer(ndvi, true, false); },
    steps: [
      openAdd,
      { text: 'Turn on the <b>Multispectral Mosaic</b> of the earlier flight, <b>08-19-2024</b>.', target: `[data-act="pick"][data-survey="${MS_EARLIER}"][data-product="ms"]`, event: 'layer_added', match: d => d.survey === MS_EARLIER },
      back,
      { text: 'Click the <b>08-19-2024</b> layer name to open it. It sits on top of the 09-04 layer.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Set <b>Visualization</b> to <b>NDVI</b>, the same index the 09-04 layer shows.', target: '[data-act="menu"][data-menu="viz"]', event: 'visualization_changed', match: d => d.viz === 'ndvi', showMe: pickMenu('[data-act="menu"][data-menu="viz"]', '[data-act="viz"][data-viz="ndvi"]') },
      { text: 'Set <b>By Range</b>. With equal value steps on both layers, the same color means the same NDVI on both dates.', target: '[data-act="mode"][data-mode="range"]', event: 'color_mode_changed', match: d => d.mode === 'range' },
      { text: 'Lower <b>Opacity</b> to about 50% to see the later flight through the earlier one.', target: 'input[data-act="opacity"]', event: 'opacity_changed', demo: { value: 50 } },
    ],
    finish: { text: 'Open the same index from two dates, colorize both By Range, and use opacity or the eye icon to compare them.', links: [{ label: 'Crop Health mosaics', path: PAGE.crop }, { label: 'Satellite imagery', path: PAGE.sat }] },
  };

  S['zones'] = {
    id: 'zones', title: 'Compare zones with zone statistics', page: PAGE.zones, field: F, seedLayers: false,
    setup(app) { app.addLayer(ndvi, true, false); },
    steps: [
      { text: 'In the <b>Zones</b> card, click the layers icon to choose which zones draw on the map.', target: '[data-act="zones"]', event: 'zones_opened' },
      { text: 'Tick <b>Zone 1</b>.', target: '[data-act="zonetoggle"][data-zi="0"]', event: 'zone_toggled' },
      { text: 'Tick <b>Zone 2</b> as well. Selected zones stay on across layers and dates.', target: '[data-act="zonetoggle"][data-zi="1"]', event: 'zone_toggled' },
      back,
      { text: 'Click the <b>Multispectral Mosaic · NDVI</b> layer name to open its details.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Scroll to <b>Zone Statistics</b>. The field boundary and every zone report their average NDVI for this layer.', target: 'section.card:has(.stat-row)', info: true },
    ],
    finish: { text: 'Zones turn a visual impression into numbers. In FieldAgent the + in the Zones card draws new zones, and the ⋯ menu downloads them.', links: [{ label: 'Zones and zone statistics', path: PAGE.zones }, { label: 'Download and export data', path: PAGE.download }] },
  };

  S['satellite'] = {
    id: 'satellite', title: 'View satellite imagery', page: PAGE.sat, field: F, seedLayers: false,
    steps: [
      openAdd,
      { text: 'Switch on <b>Satellite</b>. The list changes from flights to Sentinel-2 dates.', target: '[data-act="src"][data-src="satellite"]', event: 'satellite_opened' },
      { text: 'Pick <b>NDVI</b> under the most recent date. The sun icon shows how clear the sky was on that pass.', target: '[data-act="picksat"][data-product="ndvi"]', event: 'layer_added', match: d => d.kind === 'satellite' },
      back,
      { text: 'Click the satellite layer name to read its date, source and clear-sky share, and to colorize it like any other index layer.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
    ],
    finish: { text: 'Satellite layers need no flight or order. Check the newest clear date each week to decide where to fly or walk.', links: [{ label: 'Satellite imagery', path: PAGE.sat }, { label: 'Zones and zone statistics', path: PAGE.zones }] },
  };

  S['photo-dots'] = {
    id: 'photo-dots', title: 'Open the photos behind a survey', page: PAGE.photos, field: F, seedLayers: false,
    steps: [
      openAdd,
      { text: 'Turn on <b>Photo Dots</b> for the <b>Mavic 3 Multispectral</b> flight.', target: `[data-act="pickphotos"][data-survey="${MS}"]`, event: 'layer_added', match: d => d.kind === 'photos' },
      back,
      { text: 'Every dot on the map is a photo. Click the <b>Photo Dots</b> layer name to see the flight details and the sample photos.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Open a photo. On the map you would click a dot; here the sample photos are listed.', target: '[data-act="openphoto"]', event: 'photo_opened' },
      { text: 'Switch the view to <b>NIR</b>. The buttons above the photo change how it is rendered.', target: '[data-act="pband"][data-band="NIR"]', event: 'photo_band_changed', match: d => d.band === 'NIR' },
      { text: 'Use <b>Next</b> to step to the following photo. The panel on the right shows the capture time, camera and metadata.', target: '[data-act="pnav"][data-dir="1"]', event: 'photo_navigated' },
    ],
    finish: { text: 'Photo dots are the quickest way to see the imagery behind a mosaic and to find the photo of a spot you want to walk to. Close the viewer with the ×.', links: [{ label: 'Photo dots and the image viewer', path: PAGE.photos }, { label: 'Import imagery in FieldAgent Web', path: PAGE.upload }] },
  };

  S['order-mosaic'] = {
    id: 'order-mosaic', title: 'Order a mosaic', page: PAGE.order, field: F, seedLayers: true,
    steps: [
      { text: 'Click <b>ORDER MOSAICS</b>.', target: '[data-act="order"]', event: 'order_mosaics_opened' },
      { text: 'Choose the survey (flight) to stitch under <b>Select Survey</b>.', target: '[data-act="menu"][data-menu="osurvey"]', event: 'order_survey_selected', showMe: pickMenu('[data-act="menu"][data-menu="osurvey"]', '[data-act="osurvey"]') },
      { text: 'Tick <b>RGB Mosaic</b>. Products the survey cannot support are dimmed.', target: '[data-act="opick"][data-key="rgbMosaic"]', event: 'order_product_toggled', match: d => d.product === 'rgbMosaic' && d.on },
      { text: '<b>Precision Aligned</b> appears under the product; leave it off for field-scale work. Check the <b>Order Summary</b>, then click <b>SUBMIT</b>.', target: '[data-act="osubmit"]', event: 'order_submit_attempt', note: 'In this demo the order is not placed. In FieldAgent you receive an email when the mosaic is ready.' },
    ],
    finish: { text: 'Mosaics are ordered per survey. The Order Summary names the product and its catalog number before you submit.', links: [{ label: 'Order a mosaic', path: PAGE.order }, { label: 'Why can’t I order?', path: PAGE.why }] },
  };

  S['import-imagery'] = {
    id: 'import-imagery', title: 'Import imagery', page: PAGE.upload, field: F, seedLayers: true,
    steps: [
      { text: 'Click <b>IMPORT IMAGERY</b>.', target: '[data-act="upload"]', event: 'import_imagery_opened' },
      { text: 'Keep <b>Individual Photos</b> selected. Drag the slider to set the image buffer: photos taken within this distance of the boundary are included.', target: 'input[data-act="alt"]', event: 'upload_buffer_changed', demo: { value: 300 } },
      { text: 'Tick <b>Remove images of horizon?</b> to drop takeoff and landing shots.', target: '[data-act="horizon"]', event: 'upload_horizon_toggled' },
      { text: 'Drop the flight’s JPEG or TIFF photos in the box (or click it to browse). <b>UPLOAD</b> becomes available once files are added.', target: '[data-act="drop"]', event: 'upload_attempt', note: 'Uploads are disabled in this demo.' },
      { text: 'Switch <b>What type is this data?</b> to <b>QuickTile</b> to see the form for a finished QuickTile or mosaic.', target: '[data-act="utype"][data-val="QuickTile"]', event: 'upload_type_changed', match: d => d.type === 'quicktile' },
    ],
    finish: { text: 'After an upload FieldAgent builds the survey, its QuickTiles and photo dots, and emails you when it is ready.', links: [{ label: 'Import imagery in FieldAgent Web', path: PAGE.upload }, { label: 'QuickTiles and mosaics', path: PAGE.qt }] },
  };

  S['report'] = {
    id: 'report', title: 'Create a report', page: PAGE.report, field: F, seedLayers: false,
    setup(app) { app.addLayer(ndvi, true, false); app.state.zonesOn[F] = [0, 1]; app.render(); },
    steps: [
      { text: 'With a layer on the map, click <b>CREATE REPORT</b>.', target: '[data-act="report"]', event: 'report_opened' },
      { text: 'Under <b>Map</b>, switch <b>Show Legend</b> off and on. The preview updates.', target: '[data-act="rtoggle"][data-key="legend"]', event: 'report_toggled', match: d => d.key === 'legend' },
      { text: 'Click the pencil next to <b>Field Report</b> in the preview to rename the report.', target: '[data-act="rtitle-edit"]', event: 'report_title_editing' },
      { text: 'Click <b>DOWNLOAD REPORT</b>.', target: '[data-act="download"][data-what="report"]', event: 'download_attempt', note: 'The demo does not produce a PDF.' },
    ],
    finish: { text: 'A report prints the field details, the map with the layers you have on, a legend, and your summary and notes.', links: [{ label: 'Create a report', path: PAGE.report }, { label: 'Download and export data', path: PAGE.download }] },
  };

  S['find-a-field'] = {
    id: 'find-a-field', title: 'Find a field', page: PAGE.find, field: F, seedLayers: true,
    steps: [
      { text: 'Click the <b>back arrow</b> next to the field name to open the <b>Fields</b> list for the organization.', target: '.panel-head [data-nav="fields"]', event: 'fields_list_opened' },
      { text: 'Type in <b>Search</b>. The list filters as you type. FieldAgent matches the field name, address, farm and grower.', target: 'input[data-act="search"]', event: 'search_changed', match: d => d.query.length > 0, demo: { text: 'Scout' }, note: 'This demo has two fields; the Sentera Demo Account has 55.' },
      { text: 'Open <b>Sort By</b> and choose another order. In FieldAgent the choices are Field Name, Farm, Grower, Notifications and Active Crop Season.', target: '[data-act="menu"][data-menu="sort"]', event: 'sort_changed', showMe: pickMenu('[data-act="menu"][data-menu="sort"]', '[data-act="sort"][data-sort="acres"]') },
      { text: 'Click a field to open it. Clicking its outline on the map does the same.', target: '.field-row', event: 'field_opened' },
    ],
    finish: { text: 'Search, Sort By and the Crop Season filter narrow the list. Fields shared with you appear under the organization “Fields Shared With Me”.', links: [{ label: 'Find a field', path: PAGE.find }, { label: 'Tour of FieldAgent Web', path: PAGE.tour }] },
  };

  S['download-data'] = {
    id: 'download-data', title: 'Download zones and layer files', page: PAGE.download, field: F, seedLayers: false,
    setup(app) { app.addLayer(ndvi, true, false); app.state.zonesOn[F] = [0, 1]; app.render(); },
    steps: [
      { text: 'In the <b>Zones</b> card, open the <b>⋯</b> menu.', target: '[data-act="menu"][data-menu="zmore"]', event: 'menu_toggled', match: d => d.menu === 'zmore' && d.open },
      { text: 'Choose <b>Download as GeoJSON</b>. Shapefile, CSV and KML are the other formats; the file holds every zone of the field.', target: '[data-act="download"][data-what="zones"][data-fmt="GeoJSON"]', event: 'download_attempt', match: d => d.what === 'zones', note: 'Downloads are disabled in this demo.' },
      { text: 'Click the <b>Multispectral Mosaic · NDVI</b> layer name to open its details.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Scroll to <b>Download Files</b> and click the download icon next to <b>TIF File</b>. That is the GeoTIFF of the mosaic for GIS software.', target: '[data-act="download"][data-what="tif"]', event: 'download_attempt', match: d => d.what === 'tif' },
    ],
    finish: { text: 'Zones download from the Zones card, layer files from the layer’s details. Analytics layers add GeoJSON, CSV and Shapefile downloads of their sample points.', links: [{ label: 'Download and export data', path: PAGE.download }, { label: 'Zone Rx prescriptions', path: PAGE.rx }] },
  };

  return S;
})();
