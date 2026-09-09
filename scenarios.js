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
    elev: '/fieldagent/analytics/elevation-mosaic',
    qtm: '/fieldagent/imagery/quicktiles-and-mosaics',
    edit: '/fieldagent/fields/edit-or-delete-a-field',
    seasons: '/fieldagent/fields/crop-seasons-and-field-activities',
    share: '/fieldagent/fields/share-a-field',
    analytics: '/fieldagent/ordering/order-analytics',
    create: '/fieldagent/fields/create-a-field',
    standcount: '/fieldagent/analytics/stand-count',
    tassel: '/fieldagent/analytics/tassel-count',
    orders: '/fieldagent/ordering/orders-and-flight-tasks',
    hydrology: '/fieldagent/analytics/elevation-and-hydrology',
  };
  const back = { text: 'Click the <b>back arrow</b> at the top of the panel to return to the field view.', target: '[data-act="back"]', event: 'view_changed', match: d => d.view === 'field' };
  const openAdd = { text: 'Open <b>Add Map Layers</b>: click the layers icon in the <b>Map Layers</b> card.', target: '[data-act="add"]', event: 'add_layers_opened' };
  const ndvi = { kind: 'drone', survey: MS, product: 'ms', viz: 'ndvi' };
  // Show me helpers. The tour hands every custom showMe a `bot` whose actions are paced and animated (a pointer glides to
  // the control, menus stay open for a beat, text is typed, sliders are dragged): pickMenu opens a select and chooses an
  // option; typeInto types into a field. Both return promises so several can be chained with await.
  const pickMenu = (menuSel, optSel) => (app, root, bot) => bot.pick(menuSel, optSel);
  const typeInto = (bot, sel, text) => bot.type(sel, text);
  const isoToday = (offsetDays = 0) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

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

  S['elevation'] = {
    id: 'elevation', title: 'Read the Elevation Mosaic', page: PAGE.elev, field: F, seedLayers: false,
    steps: [
      openAdd,
      { text: 'Under the <b>Mavic 3 Multispectral</b> flight of <b>09-04-2024</b>, turn on <b>Elevation Mosaic</b>.', target: `[data-act="pick"][data-survey="${MS}"][data-product="elev"]`, event: 'layer_added', match: d => d.product === 'elev' },
      back,
      { text: 'Click the <b>Elevation Mosaic</b> layer name to open its details. The panel shows the elevation range of the surface model.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Drag the <b>bins</b> slider to 5. Each color band now covers about 1.5 m of elevation.', target: 'input[data-act="bins"]', event: 'bins_changed', demo: { value: 5 } },
      { text: 'Drag the <b>right range handle</b> to the left. Only the lowest ground stays colored — the spots that pond after rain.', target: 'input[data-act="rmax"]', event: 'range_changed', match: d => d.end === 'max', demo: { value: 269.5 } },
      { text: 'Lower <b>Opacity</b> to about 60% to see the RGB mosaic underneath and relate the low ground to what grows there.', target: 'input[data-act="opacity"]', event: 'opacity_changed', demo: { value: 60 } },
    ],
    finish: { text: 'The Elevation Mosaic is a digital surface model from the same photos as the RGB mosaic. Colorize it like any index layer; draw a zone over a low area to read its statistics.', links: [{ label: 'Elevation Mosaic', path: PAGE.elev }, { label: 'Zone Rx prescriptions', path: PAGE.rx }] },
  };

  S['quicktile'] = {
    id: 'quicktile', title: 'QuickTile or stitched mosaic', page: PAGE.qtm, field: F, seedLayers: false,
    steps: [
      openAdd,
      { text: 'Under the <b>09-04-2024</b> flight, turn on <b>QuickTile RGB (DJI)</b>. FieldAgent built it automatically when the photos were imported.', target: `[data-act="pick"][data-survey="${MS}"][data-product="qt_rgb"]`, event: 'layer_added', match: d => d.product === 'qt_rgb' },
      { text: 'Now turn on <b>RGB Mosaic</b> for the same flight — the stitched mosaic that was ordered from the survey.', target: `[data-act="pick"][data-survey="${MS}"][data-product="rgb"]`, event: 'layer_added', match: d => d.product === 'rgb' },
      back,
      { text: 'Hover the <b>RGB Mosaic</b> row and click the <b>eye</b> to hide it. The QuickTile underneath shows each photo placed where it was taken, seams and all. Click again to compare.', target: '.layer-row[data-index="0"] [data-act="toggle"]', highlight: '.layer-row[data-index="0"]', event: 'layer_toggled', note: 'Zoom into the map to see the difference along the seams.' },
    ],
    finish: { text: 'QuickTiles are ready minutes after an import and are good for a first look and for scouting. Stitched mosaics take hours but line up every photo, can be colorized by index, and can be downloaded as one GeoTIFF.', links: [{ label: 'QuickTiles and mosaics', path: PAGE.qtm }, { label: 'Order a mosaic', path: PAGE.order }] },
  };

  S['edit-field'] = {
    id: 'edit-field', title: 'Edit a field’s details', page: PAGE.edit, field: F, seedLayers: true,
    steps: [
      { text: 'Click the <b>pencil</b> in the <b>Field Details</b> card. The Edit Field form opens and the drawing tools appear at the right edge of the map.', target: '[data-blocked="Editing field details"]', event: 'field_edit_opened' },
      { text: 'Type a grower name in <b>Grower</b>.', target: 'input[data-act="ef-grower"]', event: 'field_edit_changed', match: d => d.key === 'grower' && d.value.length > 0, demo: { text: 'Sentera Demo Farms' } },
      { text: 'Type a farm name in <b>Farm</b>. The same form holds the address and postal code.', target: 'input[data-act="ef-farm"]', event: 'field_edit_changed', match: d => d.key === 'farm' && d.value.length > 0, demo: { text: 'Home Farm' } },
      { text: 'The tools on the right edge of the map change the <b>boundary</b>: <b>Edit</b> drags the red points, <b>Cut</b> removes an area, the shape tools add to it.', target: (app, root) => root.querySelector('.draw-tools'), info: true },
      { text: 'Click <b>SAVE</b>. The Field Details card shows the new grower and farm.', target: '[data-act="ef-save"]', event: 'field_saved' },
    ],
    finish: { text: 'Changes made in FieldAgent Web appear in FieldAgent Desktop after its next sync. DELETE at the bottom of the form removes the field for everyone in the organization — this demo stops before that.', links: [{ label: 'Edit or delete a field', path: PAGE.edit }, { label: 'Create a field', path: PAGE.create }] },
  };

  S['crop-season'] = {
    id: 'crop-season', title: 'Add a crop season and a planting activity', page: PAGE.seasons, field: F, seedLayers: true,
    steps: [
      { text: 'Click the <b>plus</b> icon in the <b>Field Activities</b> card at the bottom of the panel.', target: '[data-act="x-activity"]', event: 'activity_opened' },
      { text: 'Open <b>Select Crop Season</b> and choose <b>Add Crop Season</b>.', target: '[data-act="menu"][data-menu="x-season"]', event: 'season_selected', match: d => d.season === 'new', showMe: pickMenu('[data-act="menu"][data-menu="x-season"]', '[data-act="x-season"][data-val="new"]') },
      { text: 'Choose the <b>Crop Type</b>. The list has Alfalfa, Barley, Canola, Corn, Cotton, Potato, Rice, Soybean, Sugar Beet, Wheat and Other.', target: '[data-act="menu"][data-menu="x-croptype"]', event: 'season_type_changed', showMe: pickMenu('[data-act="menu"][data-menu="x-croptype"]', '[data-act="x-croptype"][data-val="Corn"]') },
      { text: 'Name the season, for example <b>Spring Corn</b>, and enter its <b>Start Date</b>.', target: 'input[data-act="x-sname"]', event: 'season_name_changed', match: d => d.name.trim().length > 2, showMe: async (app, root, bot) => { await typeInto(bot, 'input[data-act="x-sstart"]', isoToday(-120)); await typeInto(bot, 'input[data-act="x-sname"]', 'Spring Corn'); } },
      { text: 'Under <b>New Field Activity</b>, set <b>Activity Type</b> to <b>Plant</b>. The form changes with the type.', target: '[data-act="menu"][data-menu="x-atype"]', event: 'activity_type_changed', match: d => d.type === 'Plant', showMe: pickMenu('[data-act="menu"][data-menu="x-atype"]', '[data-act="x-atype"][data-val="Plant"]') },
      { text: 'Enter the <b>Applied At</b> date and the <b>Average Rate</b> from the planter, then click <b>SUBMIT</b>.', target: '[data-act="x-asubmit"]', event: 'activity_added', note: 'Show me enters a planting date and 32,000 seeds/acre before submitting.', showMe: async (app, root, bot) => { await typeInto(bot, 'input[data-act="x-applied"]', isoToday(-118)); await typeInto(bot, 'input[data-act="x-rate"]', '32000'); await typeInto(bot, 'input[data-act="x-spacing"]', '30'); const b = root.querySelector('[data-act="x-asubmit"]'); if (b && !b.disabled) await bot.click(b); } },
    ],
    finish: { text: 'The activity now shows in Field Activities under its season. With a Plant activity recorded, FieldAgent sends growth-stage notifications through the season, and a Kernel Count activity is what turns a tassel count into a yield estimate.', links: [{ label: 'Crop seasons and field activities', path: PAGE.seasons }, { label: 'Tassel Count and yield estimate', path: PAGE.tassel }] },
  };

  S['share-field'] = {
    id: 'share-field', title: 'Share a field', page: PAGE.share, field: F, seedLayers: true,
    steps: [
      { text: 'Click the <b>share</b> icon to the right of the field name at the top of the panel.', target: '.panel-head [data-blocked="Sharing"]', event: 'share_opened' },
      { text: 'Enter the recipient’s <b>email address</b>. They do not need to be in your organization.', target: 'input[data-act="x-email"]', event: 'share_email_changed', match: d => d.valid, demo: { text: 'agronomist@example.com' } },
      { text: 'Click <b>SHARE</b>.', target: '[data-act="x-share"]', event: 'share_attempt', note: 'No email is sent from this demo.' },
    ],
    finish: { text: 'A FieldAgent user finds shared fields under “Fields Shared With Me” in the organization list; anyone else opens the field from the link in the email. Shares made from FieldAgent Web last 365 days and are revoked from FieldAgent Desktop.', links: [{ label: 'Share a field', path: PAGE.share }, { label: 'Organizations and Fields Shared With Me', path: '/fieldagent/account/organizations-and-shared-fields' }] },
  };

  S['order-analytics'] = {
    id: 'order-analytics', title: 'Order a stand count', page: PAGE.analytics, field: F, seedLayers: true,
    steps: [
      { text: 'Click <b>ORDER ANALYTICS</b>.', target: '[data-blocked="Order Analytics"]', event: 'analytics_opened' },
      { text: 'In <b>Select Analytics Type</b>, choose <b>Field Scale Stand Count</b>. The list shows the products your plan includes.', target: '[data-act="menu"][data-menu="x-antype"]', event: 'analytics_type_selected', match: d => d.type === 'stand', showMe: pickMenu('[data-act="menu"][data-menu="x-antype"]', '[data-act="x-antype"][data-val="stand"]') },
      { text: 'In <b>Select Survey</b>, choose the flight. The panel reports how many photos it holds.', target: '[data-act="menu"][data-menu="x-asurvey"]', event: 'analytics_survey_selected', showMe: pickMenu('[data-act="menu"][data-menu="x-asurvey"]', `[data-act="x-asurvey"][data-val="${MS}"]`) },
      { text: 'Set <b>Crop Type</b> to <b>Corn</b>.', target: '[data-act="menu"][data-menu="x-crop"]', event: 'analytics_details_changed', match: d => d.key === 'crop', showMe: pickMenu('[data-act="menu"][data-menu="x-crop"]', '[data-act="x-crop"][data-val="Corn"]') },
      { text: 'Enter the <b>Seeding Rate</b> and <b>Row Spacing</b> from the planter. FieldAgent compares the counted stand with what was planted.', target: 'input[data-act="x-orate"]', event: 'analytics_details_changed', match: d => d.key === 'spacing' && d.value.length > 0, showMe: async (app, root, bot) => { await typeInto(bot, 'input[data-act="x-orate"]', '32000'); await typeInto(bot, 'input[data-act="x-ospacing"]', '30'); } },
      { text: 'Check the <b>Order Summary</b> and click <b>SUBMIT</b>.', target: '[data-act="x-osubmit"]', event: 'analytics_submit_attempt', note: 'In this demo the order is not placed. In FieldAgent you receive an email when the results are ready.' },
    ],
    finish: { text: 'Analytics are ordered from a survey flown to the product’s specification — usually a low-altitude spot-scout pattern. Results arrive as map layers and downloadable data.', links: [{ label: 'Order analytics', path: PAGE.analytics }, { label: 'Stand Count', path: PAGE.standcount }] },
  };

  // ---- Sentera Demo Account fields ----
  const SC = 'f3', SC_SURVEY = 'sc0610';   // Field Scale Stand Count (71301-00), spot-scout flight of 06-10-2022, 41 samples
  const samplesLayer = app => app.layers().find(l => l.kind === 'samples');
  S['stand-count'] = {
    id: 'stand-count', title: 'Read a stand count', page: PAGE.standcount, field: SC, seedLayers: false,
    intro: 'This field was flown for a <b>Field Scale Stand Count</b>: a spot-scout flight of 41 photos, each counted by Sentera’s model. The results arrive as two map layers — an interpolated heatmap and the individual samples.',
    steps: [
      openAdd,
      { text: 'Under the flight of <b>06-10-2022</b>, turn on <b>Stand Count Heatmap</b>. Analytics flights list only the products that were produced for them.', target: `[data-act="pick"][data-survey="${SC_SURVEY}"][data-product="standheat"]`, event: 'layer_added', match: d => d.product === 'standheat' },
      { text: 'Turn on <b>Stand Count - Individual</b> as well — the 41 counted photos as points.', target: `[data-act="pick"][data-survey="${SC_SURVEY}"][data-product="standpts"]`, event: 'layer_added', match: d => d.product === 'standpts' },
      back,
      { text: 'Hover the <b>Stand Count Heatmap</b> row and click the <b>eye</b> to hide it. The circles underneath are the individual samples; each shows the plant density counted in one photo, colored by the same scale.', target: '.layer-row[data-index="1"] [data-act="toggle"]', highlight: '.layer-row[data-index="1"]', event: 'layer_toggled', match: d => !d.visible },
      { text: 'Click the <b>Stand Count - Individual</b> layer name to open its details.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Open <b>Display Property</b> and switch to <b>Emergence (%)</b>: the same samples expressed as the share of the planted population that emerged.', target: '[data-act="menu"][data-menu="sprop"]', event: 'sample_prop_changed', match: d => d.prop === 'emergence', showMe: pickMenu('[data-act="menu"][data-menu="sprop"]', '[data-act="sprop"][data-prop="emergence"]') },
      { text: 'Switch back to <b>Plant Density (per acre)</b>. Below the colorization, <b>Zone Statistics</b> lists the minimum, average and maximum of the samples inside each zone.', target: '[data-act="menu"][data-menu="sprop"]', event: 'sample_prop_changed', match: d => d.prop === 'density', showMe: pickMenu('[data-act="menu"][data-menu="sprop"]', '[data-act="sprop"][data-prop="density"]') },
      { text: 'Click any <b>circle on the map</b> to open that sample in the viewer.', demo: {}, event: 'sample_opened', showMe: (app, root, bot) => { const L = samplesLayer(app); if (L) return bot.sample(L.uid, 17); }, note: 'The demo carries the annotated photos of samples 17–24 — the top of the western column.' },
      { text: 'Switch to <b>ANNOTATION 2</b>: the same photo with the rows and every counted plant marked.', target: '[data-act="pband"][data-band="ANNOTATION 2"]', event: 'sample_tab_changed', match: d => d.band === 'ANNOTATION 2' },
      { text: 'Use <b>Next</b> to step through the samples. The panel shows <b>Crops Detected</b> and <b>Row Spacing</b> for each photo, and the blue validator box lets you check a count by hand.', target: '[data-act="pnav"][data-dir="1"]', event: 'sample_navigated' },
      { text: 'If a photo is not representative — a headland, a wet spot — <b>Exclude Data Point</b> drops it from the averages and zone statistics.', target: '[data-act="pexclude"]', event: 'sample_excluded', match: d => d.excluded },
    ],
    finish: { text: 'Heatmap for the pattern, individual samples for the evidence: that is how a stand count is read. The individual counts download as GeoJSON, CSV or Shapefile from the layer panel, and Create Report captures whichever layer is on the map.', links: [{ label: 'Stand Count', path: PAGE.standcount }, { label: 'Order analytics', path: PAGE.analytics }, { label: 'Create a report', path: PAGE.report }] },
  };

  const TC = 'f4', TC_SURVEY = 'tc0805';   // Field Scale Tassel Count (71302-00): the same field, flown 08-05-2022 after tasseling
  S['tassel-count'] = {
    id: 'tassel-count', title: 'Read a tassel count and estimate yield', page: PAGE.tassel, field: TC, seedLayers: false,
    intro: 'The same demo field, flown again after tasseling for a <b>Field Scale Tassel Count</b>. Two hybrids were planted side by side, so the field carries a zone over each. The count arrives as a heatmap and the individual samples; a kernel count from the field turns it into a yield estimate.',
    steps: [
      openAdd,
      { text: 'Under the flight of <b>08-05-2022</b>, turn on <b>Tassel Count Heatmap (2026)</b>. The list also holds the original 2022 run of the product (84002-00) — FieldAgent keeps every version.', target: `[data-act="pick"][data-survey="${TC_SURVEY}"][data-product="tasselheat"]`, event: 'layer_added', match: d => d.product === 'tasselheat' },
      { text: 'Turn on <b>Tassel Count (2026)</b> — the 41 counted photos as points.', target: `[data-act="pick"][data-survey="${TC_SURVEY}"][data-product="tasselpts"]`, event: 'layer_added', match: d => d.product === 'tasselpts' },
      back,
      { text: 'Click the <b>Tassel Count (2026)</b> layer name to open <b>Tassel Count Details</b>.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Open <b>Display Property</b> and switch to <b>Tassels (per image)</b>: the raw count in each photo instead of the per-acre density.', target: '[data-act="menu"][data-menu="sprop"]', event: 'sample_prop_changed', match: d => d.prop === 'perimg', showMe: pickMenu('[data-act="menu"][data-menu="sprop"]', '[data-act="sprop"][data-prop="perimg"]') },
      { text: 'Switch back to <b>Tassels (per acre)</b>.', target: '[data-act="menu"][data-menu="sprop"]', event: 'sample_prop_changed', match: d => d.prop === 'density', showMe: pickMenu('[data-act="menu"][data-menu="sprop"]', '[data-act="sprop"][data-prop="density"]') },
      { text: 'Scroll to <b>Zone Statistics</b>: the two hybrids are compared here — minimum, average and maximum tassels per acre inside <b>Hybrid comparison zone A</b> and <b>zone B</b>. Press Next when you have looked.', info: true, target: '.stat-row.tri[data-zi="1"]' },
      { text: 'Click a <b>circle on the map</b> to open that sample. Each photo shows the rows FieldAgent found and every tassel it counted.', demo: {}, event: 'sample_opened', showMe: (app, root, bot) => { const L = samplesLayer(app); if (L) return bot.sample(L.uid, 13); }, note: 'The demo carries the annotated photos of samples 14–21.' },
      { text: 'Use <b>Next</b> to step through the samples; <b>Tassels Detected</b> updates for each photo.', target: '[data-act="pnav"][data-dir="1"]', event: 'sample_navigated' },
      { text: 'Close the viewer with the <b>×</b>.', target: '[data-act="pclose"]', event: 'sample_closed' },
      back,
      { text: 'Now the yield estimate. Click the <b>plus</b> icon in the <b>Field Activities</b> card at the bottom of the panel to add a kernel count.', target: '[data-act="x-activity"]', event: 'activity_opened' },
      { text: 'Open <b>Select Crop Season</b> and choose <b>2023 Corn</b>, the season this field already has.', target: '[data-act="menu"][data-menu="x-season"]', event: 'season_selected', match: d => d.season === '0', showMe: pickMenu('[data-act="menu"][data-menu="x-season"]', '[data-act="x-season"][data-val="0"]') },
      { text: 'Set <b>Activity Type</b> to <b>Kernel Count</b>.', target: '[data-act="menu"][data-menu="x-atype"]', event: 'activity_type_changed', match: d => d.type === 'Kernel Count', showMe: pickMenu('[data-act="menu"][data-menu="x-atype"]', '[data-act="x-atype"][data-val="Kernel Count"]') },
      { text: 'Enter the date and, for each ear you pulled, the <b>Kernel Rows</b> and <b>Kernels/Row</b>. Use <b>Add another ear</b> — at least three ears — then <b>SUBMIT</b>.', target: '[data-act="x-asubmit"]', event: 'activity_added', match: d => d.type === 'Kernel Count', note: 'Show me enters three ears of 16 × 34, 16 × 36 and 18 × 32 kernels before submitting.',
        showMe: async (app, root, bot) => {
          await typeInto(bot, 'input[data-act="x-applied"]', isoToday(-2));
          const ears = [[16, 34], [16, 36], [18, 32]];
          for (let k = 0; k < ears.length; k++) {
            if (k > 0) { const add = root.querySelector('[data-act="x-addear"]'); if (add) await bot.click(add); }
            await typeInto(bot, `input[data-act="x-ear-rows-${k}"]`, String(ears[k][0])); await typeInto(bot, `input[data-act="x-ear-per-${k}"]`, String(ears[k][1]));
          }
          const s = root.querySelector('[data-act="x-asubmit"]'); if (s && !s.disabled) await bot.click(s);
        } },
      { text: 'Open the <b>Tassel Count (2026)</b> layer again. <b>Yield Estimate</b> now lists the kernel count and shows the estimated bushels per acre.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
    ],
    finish: { text: 'Tassels per acre from the flight, kernels per ear from the field: the estimate is only as good as the ears you sampled, so re-enter kernel counts later in the season if the ears fill differently. The heatmap on the map goes into Create Report like any other layer.', links: [{ label: 'Tassel Count and yield estimate', path: PAGE.tassel }, { label: 'Crop seasons and field activities', path: PAGE.seasons }, { label: 'Zones and zone statistics', path: PAGE.zones }] },
  };

  const EH = 'f5', EH_SURVEY = 'eh0430';   // Field Scale Elevation and Hydrology (71309-00), 115.20 ac, flown 04-30-2020 on bare soil
  const ehPick = id => `[data-act="pick"][data-survey="${EH_SURVEY}"][data-product="${id}"]`;
  S['hydrology'] = {
    id: 'hydrology', title: 'Read elevation and hydrology layers', page: PAGE.hydrology, field: EH, seedLayers: false,
    intro: 'A 115-acre field flown on bare soil for <b>Field Scale Elevation and Hydrology</b>. The product returns five layers: a hillshade and a digital elevation model, 2-ft contour lines, the flow lines water follows, and the depressions where it pools.',
    steps: [
      openAdd,
      { text: 'Under the flight of <b>04-30-2020</b>, turn on <b>Hillshade</b> — the terrain lit from the north-west, a quick way to see its shape.', target: ehPick('hill'), event: 'layer_added', match: d => d.product === 'hill' },
      { text: 'Turn on the <b>Digital Elevation Model</b>. It is a mosaic like any other, colorized by elevation.', target: ehPick('dem'), event: 'layer_added', match: d => d.product === 'dem' },
      { text: 'Turn on <b>Contour Lines (2ft)</b>, <b>Flow Lines</b> and <b>Depressions</b> as well — these three are vector layers.', target: ehPick('contours'), event: 'layer_added', match: d => d.product === 'contours' },
      { text: 'Now <b>Flow Lines</b>.', target: ehPick('flowlines'), event: 'layer_added', match: d => d.product === 'flowlines' },
      { text: 'And <b>Depressions</b>.', target: ehPick('depressions'), event: 'layer_added', match: d => d.product === 'depressions' },
      back,
      { text: 'Five layers, drawn top to bottom in list order. Click <b>Depressions</b> to open its details.', target: '.layer-row[data-index="0"]', event: 'layer_details_opened' },
      { text: 'Depressions are coloured by <b>Area (acres)</b>. Drag the <b>bins</b> slider to 3 so the small, medium and large ponding areas stand apart.', target: 'input[data-act="bins"]', event: 'bins_changed', demo: { value: 3 } },
      { text: 'Drag <b>Opacity</b> down so the imagery shows through the ponding areas.', target: 'input[data-act="opacity"]', event: 'opacity_changed', demo: { value: 35 } },
      back,
      { text: 'Click <b>Contour Lines (2ft)</b>. The lines are coloured by elevation on the Terrain scale — the same scale as the elevation model beneath them.', target: '.layer-row[data-index="2"]', event: 'layer_details_opened' },
      { text: 'Switch <b>By Area</b> to <b>By Range</b>: with equal elevation steps per colour, the bands read like a topographic map.', target: '[data-act="mode"][data-mode="range"]', event: 'color_mode_changed', match: d => d.mode === 'range' },
      back,
      { text: 'Hover the <b>Hillshade</b> row and click the <b>eye</b> to hide it, then do the same with the elevation model — the flow lines and depressions on the bare imagery are the picture to plan drainage from.', target: '.layer-row[data-index="4"] [data-act="toggle"]', highlight: '.layer-row[data-index="4"]', event: 'layer_toggled', match: d => !d.visible },
    ],
    finish: { text: 'Hillshade for the shape, the elevation model for the numbers, contours for the map, flow lines and depressions for where the water goes. Each vector layer downloads as GeoJSON, CSV or Shapefile from its details panel.', links: [{ label: 'Elevation and hydrology', path: PAGE.hydrology }, { label: 'Elevation Mosaic', path: PAGE.elev }, { label: 'Colorization and visualization', path: PAGE.color }] },
  };

  S['create-field'] = {
    id: 'create-field', title: 'Create a field', page: PAGE.create, field: F, seedLayers: true,
    setup(app) { app.openFields(); },
    intro: 'New fields start from the <b>Fields</b> list. FieldAgent offers two ways in: import from a connected partner, or draw the boundary and fill in the details yourself.',
    steps: [
      { text: 'Click the <b>plus</b> icon at the top of the Fields panel.', target: '[data-blocked="Adding a field"]', event: 'create_field_opened' },
      { text: 'Type a <b>Name</b> for the field. Grower, Farm and the address are optional, and they power the search and the Sort By menu later.', target: 'input[data-act="cf-name"]', event: 'create_field_changed', match: d => d.key === 'name' && d.value.trim().length > 2, demo: { text: 'North 80' }, showMe: async (app, root, bot) => { await typeInto(bot, 'input[data-act="cf-name"]', 'North 80'); await typeInto(bot, 'input[data-act="cf-grower"]', 'Johnson Farms'); await typeInto(bot, 'input[data-act="cf-farm"]', 'Home'); } },
      { text: 'Pick the <b>State</b>.', target: '[data-act="menu"][data-menu="cf-state"]', event: 'create_field_changed', match: d => d.key === 'state', showMe: pickMenu('[data-act="menu"][data-menu="cf-state"]', '[data-act="cf-state"][data-val="Minnesota"]') },
      { text: 'Draw the boundary with the tools on the right edge of the map: <b>Draw Rectangle</b> for a square field, <b>Draw Polygon</b> to click around an irregular one, <b>Draw Circle</b> for a pivot. Press one now.', target: '[data-blocked="Draw Polygon"]', event: 'boundary_drawn', note: 'In this demo the shape is sketched for you. In FieldAgent you click the corners on the map and finish on the first point; Edit, Cut and Erase then refine it.' },
      { text: '<b>SAVE</b> is enabled once the field has a name and a boundary. Click it.', target: '[data-act="cf-save"]', event: 'create_field_attempt' },
    ],
    finish: { text: 'In FieldAgent the new field opens immediately with its acreage computed from the boundary, and it appears in the Fields list and in FieldAgent Mobile for flight planning. Fields can also arrive from a connected John Deere Operations Center or Climate FieldView account through the Partner Fields card.', links: [{ label: 'Create a field', path: PAGE.create }, { label: 'Edit or delete a field', path: PAGE.edit }, { label: 'Find a field', path: PAGE.find }] },
  };

  return S;
})();
