/***************************************
STEP 1: Click FPV polygon -> show attributes

***************************************/


var fpv = ee.FeatureCollection('projects/spheric-mesh-330606/assets/FPV_demo');
var wb  = ee.FeatureCollection('projects/spheric-mesh-330606/assets/WB_DEMO');

print('FPV count', fpv.size());
print('WB count', wb.size());

Map.setOptions('SATELLITE');
Map.centerObject(fpv.geometry().centroid(1e4), 4);
Map.addLayer(wb.style({color:'00FFFF', fillColor:'00000000', width:1}), {}, 'WB');
Map.addLayer(
  fpv.style({color: 'FFFF00', fillColor: 'FFFF0055', width: 1}),
  {},
  'FPV polygons',
  true
);


var YEAR = 2023, MONTH = 7;
var start = ee.Date.fromYMD(YEAR, MONTH, 1), end = start.advance(1, 'month');

function s2MonthlyNDCI(geom, start, end) {
  var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom).filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60));

  // NDCI = (B5 - B4)/(B5 + B4)
  var ndci = col.map(function(img){
    return img.normalizedDifference(['B5','B4']).rename('NDCI')
      .copyProperties(img, ['system:time_start']);
  }).median();

  return ndci.clip(geom);
}

function ndciToChla(ndciImg) {
  return ndciImg.multiply(ndciImg).multiply(212.609)
    .add(ndciImg.multiply(87.99)).add(13.55).rename('chla');
}
// ---------------- TEMPERATURE (Landsat-8 WST) ----------------
var L8_ID = 'LANDSAT/LC08/C02/T1_L2';
var SCALE_L8 = 100;           // keep as in your postdoc version (or use 30 for stats)
var VALID_PIXEL_MIN_WST = 5;
var WST_PRIMARY_NDWI = 0.01;
var WST_FALLBACK_NDWI = -0.05;
var USE_WATER_MASK_FOR_WST = false;

function landsatCloudMask(image) {
  var qa = image.select('QA_PIXEL');
  var CLOUD_CONFIDENCE = 2 << 8;
  return image.updateMask(
    qa.bitwiseAnd(1 << 3).eq(0) // cloud shadow
      .and(qa.bitwiseAnd(1 << 4).eq(0)) // snow
      .and(qa.bitwiseAnd(3 << 8).lte(CLOUD_CONFIDENCE)) // cloud confidence
  ).copyProperties(image, ['system:time_start']);
}

function l8ProcessAndWSTAdaptive(rangeStart, rangeEnd, geom, perImageMinPixels) {
  perImageMinPixels = perImageMinPixels || VALID_PIXEL_MIN_WST;

  var base = ee.ImageCollection(L8_ID)
    .filterBounds(geom)
    .filterDate(rangeStart, rangeEnd)
    .select(['SR_B3','SR_B5','ST_B10','QA_PIXEL'])
    .map(landsatCloudMask);

  function processFor(ndwi_thresh, min_pixels) {
    var proc = base.map(function(image) {
      var clipped = image.clip(geom);
      var ndwi = clipped.normalizedDifference(['SR_B3','SR_B5'])
        .rename('NDWI').clamp(-1,1);

      // ST_B10 scale for L2 surface temp band
      var wstRaw = clipped.select('ST_B10')
  .multiply(0.00341802).add(149).subtract(273.15);

// Mask outliers outside [-2, 40] °C
var wstClean = wstRaw
  .updateMask(wstRaw.gte(-2))
  .updateMask(wstRaw.lte(40))
  .rename('WST');

var wstBand = ee.Image(ee.Algorithms.If(
  USE_WATER_MASK_FOR_WST,
  wstClean.updateMask(ndwi.gte(ndwi_thresh)).rename('WST'),
  wstClean.rename('WST')
));

      return clipped.addBands([wstBand, ndwi]);
    });

    var withCount = proc.map(function(img) {
      var count = img.select('WST').reduceRegion({
        reducer: ee.Reducer.count(),
        geometry: geom,
        scale: SCALE_L8,
        maxPixels: 1e9
      }).get('WST');
      return img.set('valid_pixels', count);
    });

    var valid = withCount.filter(ee.Filter.gt('valid_pixels', min_pixels));

    var medianIfValid = ee.Image(ee.Algorithms.If(
      valid.size().gt(0),
      valid.select('WST').median().rename('WST_med'),
      proc.select('WST').median().rename('WST_med')
    ));

    medianIfValid = medianIfValid
      .set('wst_ndwi_thresh', ndwi_thresh)
      .set('wst_valid_count', valid.size());

    return {valid: valid, median: medianIfValid};
  }

  var primary = processFor(WST_PRIMARY_NDWI, perImageMinPixels);
  var fallback = processFor(WST_FALLBACK_NDWI, Math.min(perImageMinPixels, 5));

  var chosenMedian = ee.Image(
    ee.Algorithms.If(primary.valid.size().gt(0), primary.median, fallback.median)
  );
  var method = ee.Algorithms.If(primary.valid.size().gt(0), 'primary', 'fallback');
  chosenMedian = chosenMedian.set('wst_method', method);

  return {median: chosenMedian};
}

// ---------------- UI PANEL + CONTROLS ----------------
var panel = ui.Panel({style:{width:'360px', padding:'8px'}});
ui.root.insert(0, panel);
panel.add(ui.Label('Click an FPV polygon'));

// Date range slider
panel.add(ui.Label('Select date range:'));
var dateSlider = ui.DateSlider({
  start: '2018-01-01',
  end: '2026-01-01',
  value: ['2023-07-01', '2023-08-01'],
  period: 30,
  style: {stretch: 'horizontal'}
});
panel.add(dateSlider);

panel.add(ui.Label('Window length:'));

var windowSelect = ui.Select({
  items: [
    {label: '7 days', value: '7'},
    {label: '30 days', value: '30'},
    {label: '90 days', value: '90'},
    {label: '365 days', value: '365'}
  ],
  value: '30'
});
panel.add(windowSelect);


// Mean/Median selector
panel.add(ui.Label('Composite type:'));
var compSelect = ui.Select({
  items: ['median', 'mean'],
  value: 'median'
});
panel.add(compSelect);

// ---- Charts UI ----
panel.add(ui.Label('Time series charts:'));
var chartPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
panel.add(chartPanel);

var loadChartsBtn = ui.Button('Load monthly charts (2016–now)', function() {
  // this will be set on click (we store last geometry)
  if (!lastWbGeom) {
    chartPanel.clear();
    chartPanel.add(ui.Label('Click an FPV / WB first.'));
    return;
  }
  chartPanel.clear();
  chartPanel.add(ui.Label('Loading charts...'));
  buildMonthlyCharts(lastWbGeom);
});
panel.add(loadChartsBtn);

// Stores the most recently selected WB geometry (set on click)
var lastWbGeom = null;


// Persistent chlorophyll layer (updates on click, no spamming new layers)
var chlaVis = {
  min: 0, max: 50,
  palette: ['00441b','1b7837','5aae61','a6dba0','ffffcc','fdae61','d73027']
};
var chlaLayer = ui.Map.Layer(ee.Image(), chlaVis, 'Chl-a (WB)', true);
Map.layers().add(chlaLayer);

// Persistent temperature layer
var wstVis = {min: 10, max: 35, palette: ['0000FF','00FFFF','FFFF00','FF0000']};
var wstLayer = ui.Map.Layer(ee.Image(), wstVis, 'WST (°C)', false);
Map.layers().add(wstLayer);


// Optional: selection layers (keep if you already had them)
var selFPV = ui.Map.Layer(ee.Image(), {}, 'Selected FPV', true);
var selWB  = ui.Map.Layer(ee.Image(), {}, 'Selected WB',  true);
Map.layers().add(selFPV);
Map.layers().add(selWB);

function s2NDCI(geom, start, end, reducerName) {
  var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom).filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60));

  var ndciCol = col.map(function(img){
    return img.normalizedDifference(['B5','B4']).rename('NDCI')
      .copyProperties(img, ['system:time_start']);
  });

  var ndci = ee.Image(ee.Algorithms.If(
    ee.String(reducerName).compareTo('mean').eq(0),
    ndciCol.mean(),
    ndciCol.median()
  ));

  return ndci.clip(geom);
}
function statsOverGeom(img, geom, scale, bandName) {
  // returns {<band>_mean: ..., <band>_median: ...}
  return img.select(bandName).reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.median(),
      sharedInputs: true
    }),
    geometry: geom,
    scale: scale,
    bestEffort: true,
    maxPixels: 1e13
  });
}
// ---- Monthly median helpers for charts ----
function calcularMedianNDCI(startDate, endDate, geometry) {
  var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
    .map(function(img) {
      var ndci = img.normalizedDifference(['B5','B4']).rename('NDCI');
      return ndci.copyProperties(img, ['system:time_start']);
    });

  return ee.Algorithms.If(
    collection.size().gt(0),
    collection.median().reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: geometry,
      scale: 20,
      maxPixels: 1e9
    }).get('NDCI'),
    null
  );
}

function calcularMedianWST(startDate, endDate, geometry) {
  var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .select(['ST_B10','QA_PIXEL'])
    .map(landsatCloudMask)
    .map(function(image) {
  var wstRaw = image.select('ST_B10')
    .multiply(0.00341802).add(149).subtract(273.15);

  var wst = wstRaw
    .updateMask(wstRaw.gte(-2))
    .updateMask(wstRaw.lte(40))
    .rename('WST');

  return wst.copyProperties(image, ['system:time_start']);
});

  return ee.Algorithms.If(
    collection.size().gt(0),
    collection.median().reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e9
    }).get('WST'),
    null
  );
}
function buildMonthlyCharts(geom) {
  var chartStart = ee.Date.fromYMD(2016, 1, 1);
  var chartEnd = ee.Date(Date.now());
  var nMonths = chartEnd.difference(chartStart, 'month').round();
  var months = ee.List.sequence(0, nMonths.subtract(1));

  var monthlyData = months.map(function(mOffset) {
    mOffset = ee.Number(mOffset);
    var start = chartStart.advance(mOffset, 'month');
    var end = start.advance(1, 'month');

    var ndci = calcularMedianNDCI(start, end, geom);
    var wst  = calcularMedianWST(start, end, geom);

    return ee.Feature(null, {
      'system:time_start': start.millis(),
      'NDCI': ndci,
      'WST': wst
    });
  });

  var monthlyFC = ee.FeatureCollection(monthlyData);

  // NDCI chart (only valid months)
  var ndciFC = monthlyFC.filter(ee.Filter.notNull(['NDCI']));
  var ndciChart = ui.Chart.feature.byFeature({
    features: ndciFC,
    xProperty: 'system:time_start',
    yProperties: ['NDCI']
  })
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Monthly Median NDCI',
    hAxis: {title: 'Date'},
    vAxis: {title: 'Median NDCI'},
    pointSize: 3,
    lineWidth: 2,
    legend: {position: 'none'}
  });

  // WST chart (only valid months)
  var wstFC = monthlyFC.filter(ee.Filter.notNull(['WST']));
  var wstChart = ui.Chart.feature.byFeature({
    features: wstFC,
    xProperty: 'system:time_start',
    yProperties: ['WST']
  })
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Monthly Median WST (°C)',
    hAxis: {title: 'Date'},
    vAxis: {title: 'Median WST (°C)'},
    pointSize: 3,
    lineWidth: 2,
    legend: {position: 'none'}
  });

  chartPanel.clear();
  chartPanel.add(ndciChart);
  chartPanel.add(wstChart);
}


// ---------------- CLICK LOGIC ----------------
Map.onClick(function(coords){
  var pt = ee.Geometry.Point([coords.lon, coords.lat]);
  var hit = fpv.filterBounds(pt).first();

  hit.evaluate(function(f){
    panel.clear();

    // Rebuild the top UI every click (since you clear the panel)
    panel.add(ui.Label('Click an FPV polygon'));
    panel.add(ui.Label('Select date range:'));
    panel.add(dateSlider);
    panel.add(ui.Label('Window length:'));
    panel.add(windowSelect);

    panel.add(ui.Label('Composite type:'));
    panel.add(compSelect);
    // Re-add charts UI (since panel.clear() removed it)
    panel.add(ui.Label('Time series charts:'));
    panel.add(chartPanel);
    panel.add(loadChartsBtn);


    if (!f) {
      panel.add(ui.Label('No FPV polygon here'));
      selFPV.setEeObject(ee.Image());
      selWB.setEeObject(ee.Image());
      chlaLayer.setEeObject(ee.Image());
      return;
    }

    var p = f.properties || {};
    var wbRaw = p.wb_ids || p.wb_id || p.matched_wb || null;
    var wbId = wbRaw ? ('' + wbRaw).split(',')[0].trim() : null;

    panel.add(ui.Label('FPV clicked'));
    panel.add(ui.Label('id: ' + (p.id || '(missing)')));
    panel.add(ui.Label('wb_ids: ' + (wbRaw || '(missing)')));
    panel.add(ui.Label('country: ' + (p.country || '(missing)')));
    panel.add(ui.Label('city: ' + (p.city || '(missing)')));

    // Highlight FPV polygon (red)
    selFPV.setEeObject(
      ee.FeatureCollection([ee.Feature(hit)])
        .style({color:'FF0000', fillColor:'FF000033', width:2})
    );

    if (!wbId) {
      panel.add(ui.Label('No waterbody id found to clip chlorophyll.'));
      selWB.setEeObject(ee.Image());
      chlaLayer.setEeObject(ee.Image());
      return;
    }

    // Try WB match by 'id' first, else 'system:index'
    var wbById = wb.filter(ee.Filter.eq('id', wbId)).limit(1);
    var wbByIndex = wb.filter(ee.Filter.eq('system:index', wbId)).limit(1);
    var wbHit = ee.FeatureCollection(
      ee.Algorithms.If(wbById.size().gt(0), wbById, wbByIndex)
    ).first();

    wbHit.evaluate(function(wbf){
      if (!wbf) {
        panel.add(ui.Label('WB not found for: ' + wbId));
        selWB.setEeObject(ee.Image());
        chlaLayer.setEeObject(ee.Image());
        return;
      }

      panel.add(ui.Label('WB found: ' + wbId));

      // Outline WB (cyan)
      selWB.setEeObject(
        ee.FeatureCollection([ee.Feature(wbHit)])
          .style({color:'00FFFF', fillColor:'00000000', width:2})
      );

      var wbGeom = ee.Feature(wbHit).geometry();
      lastWbGeom = wbGeom;
      chartPanel.clear();
      chartPanel.add(ui.Label('Loading charts...'));
      buildMonthlyCharts(wbGeom);



      // Read slider dates + reducer
      var range = dateSlider.getValue();    // returns [startMillis, endMillis]
var start = ee.Date(range[0]);
var end   = ee.Date(range[1]);

      var reducerName = compSelect.getValue();

      // Build Sentinel-2 collection FIRST (for the empty-collection guard)
      var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(wbGeom)
        .filterDate(start, end)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60));

      col.size().evaluate(function(n){
        if (n === 0) {
          panel.add(ui.Label('No Sentinel-2 images in this date range for this WB.'));
          chlaLayer.setEeObject(ee.Image()); // clear layer
          return;
          
        }

        // Compute NDCI composite (mean/median) using your function
        // NOTE: make sure you have s2NDCI(geom,start,end,reducerName) defined earlier.
        var ndci = s2NDCI(wbGeom, start, end, reducerName);

        // Convert to chlorophyll-a
        var chla = ndciToChla(ndci).clip(wbGeom);
        // ---------------- WST computation ----------------
var wstStart = start.advance(-15, 'day');
var wstEnd   = end.advance(15, 'day');

var l8_result = l8ProcessAndWSTAdaptive(wstStart, wstEnd, wbGeom, VALID_PIXEL_MIN_WST);
var wst_med = ee.Image(l8_result.median).clip(wbGeom);

// Update temperature layer
wstLayer.setEeObject(wst_med.select('WST_med'));
wstLayer.setVisParams(wstVis);

// Print WST stats
var wstStats = wst_med.select('WST_med').reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.median(),
    sharedInputs: true
  }),
  geometry: wbGeom,
  scale: 30,
  bestEffort: true,
  maxPixels: 1e13
});

wstStats.evaluate(function(d){
  var mean = d.WST_med_mean;
  var med  = d.WST_med_median;
  panel.add(ui.Label('WST mean (°C): ' + (mean === null ? 'NA' : mean.toFixed(2))));
  panel.add(ui.Label('WST median (°C): ' + (med  === null ? 'NA' : med.toFixed(2))));
});
        var chlaStats = chla.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.median(),
    sharedInputs: true
  }),
  geometry: wbGeom,
  scale: 20,
  bestEffort: true,
  maxPixels: 1e13
});

chlaStats.evaluate(function(d){
  var mean = d.chla_mean;
  var med  = d.chla_median;
  panel.add(ui.Label('Chl-a mean (WB): ' + (mean === null ? 'NA' : mean.toFixed(2))));
  panel.add(ui.Label('Chl-a median (WB): ' + (med  === null ? 'NA' : med.toFixed(2))));
});

        // Update layer
        chlaLayer.setEeObject(chla);
        chlaLayer.setVisParams(chlaVis);

        panel.add(ui.Label('Chl-a layer updated (' + reducerName + ')'));
      });
    });
  });
});







