const geojsonUrl = 'data.geojson';

const view = new ol.View({ center: [0, 0], zoom: 3 });

const mapA = new ol.Map({
  target: 'mapA',
  layers: [], // No base map layer
  view: view
});

const mapB = new ol.Map({
  target: 'mapB',
  layers: [], // No base map layer
  view: view
});
let layerA = null;
let layerB = null;

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function blendColors(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(
    Math.round((r1 + r2) / 2),
    Math.round((g1 + g2) / 2),
    Math.round((b1 + b2) / 2)
  );
}
function getBreakClass(value, breaks) {
  if (!breaks || !Array.isArray(breaks) || breaks.length < 2) return 0;
  if (value === undefined || value === null || isNaN(value)) return 0;
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i] && value <= breaks[i + 1]) return i;
  }
  return 0;
}

function renderDotDensityLegend(containerId, prodBreaks, areaBreaks) {
  const container = document.getElementById(containerId);
  const prodColors = ['#f7fbff','#e3eef7','#d0e2ef','#bcd5e7','#a9c9df','#95bcd6','#82b0ce','#6ea3c6','#5b97be','#478ab6'];

  const colorLegend = `<div class="legend-title">Production (Background Color)</div><div class="color-legend">` +
    prodBreaks.slice(0, -1).map((b, i) => {
      const label = abbrev(prodBreaks[i]) + '–' + abbrev(prodBreaks[i + 1]);
      return `<div class="swatch-row">
        <span class="swatch" style="background:${prodColors[i]}"></span>${label}
      </div>`;
    }).join('') + `</div>`;

  const dotLegend = `<div class="legend-title">Area Harvested (Dot Size)</div><div class="dot-legend">` +
    areaBreaks.slice(0, -1).map((b, i) => {
      const size = 2 + i * 0.6;
      const label = abbrev(areaBreaks[i]) + '–' + abbrev(areaBreaks[i + 1]);
      return `<div class="dot-swatch">
        <span class="dot-circle" style="width:${size * 2}px;height:${size * 2}px;"></span>${label}
      </div>`;
    }).join('') + `</div>`;

  container.innerHTML = colorLegend + dotLegend;
}

function renderDotDensityLayer(features, year, containerId) {
  const areaField = `Area_${year}`;
  const prodField = `Prod_${year}`;
  const areaVals = features.map(f => f.get(areaField)).filter(v => typeof v === 'number');
  const prodVals = features.map(f => f.get(prodField)).filter(v => typeof v === 'number');
  if (!areaVals.length || !prodVals.length) return null;

  const areaBreaks = ss.jenks(areaVals, 8);
  const prodBreaks = ss.jenks(prodVals, 10);
  const prodRamp = ['#f7fbff','#e3eef7','#d0e2ef','#bcd5e7','#a9c9df','#95bcd6','#82b0ce','#6ea3c6','#5b97be','#478ab6'];

  const background = new ol.layer.Vector({
    source: new ol.source.Vector({ features }),
    style: f => {
      const v = f.get(prodField);
      const idx = getBreakClass(v, prodBreaks);
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: prodRamp[idx] }),
        stroke: new ol.style.Stroke({ color: '#666', width: 0.3 })
      });
    }
  });

  const dots = [];
  features.forEach(f => {
    const area = f.get(areaField);
    const geometry = f.getGeometry();
    const cls = getBreakClass(area, areaBreaks);
    const dotCount = cls + 1;
    const extent = geometry.getExtent();
    for (let i = 0; i < dotCount; i++) {
      let tries = 0;
      let point;
      do {
        const [minX, minY, maxX, maxY] = extent;
        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);
        point = new ol.geom.Point([x, y]);
        tries++;
      } while (!geometry.intersectsCoordinate(point.getCoordinates()) && tries < 10);
      if (tries < 10) {
        const dot = new ol.Feature({ geometry: point });
        dot.set('class', cls);
        dots.push(dot);
      }
    }
  });

  renderDotDensityLegend(containerId, prodBreaks, areaBreaks);

  const dotLayer = new ol.layer.Vector({
    source: new ol.source.Vector({ features: dots }),
    style: f => {
      const cls = f.get('class');
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 2 + cls * 0.6,
          fill: new ol.style.Fill({ color: '#654321' }),
          stroke: new ol.style.Stroke({ color: '#222', width: 0.3 })
        })
      });
    }
  });

  return new ol.layer.Group({ layers: [background, dotLayer] });
}
function createLayerByMode(mode, year, callback) {
  fetch(geojsonUrl)
    .then(res => res.json())
    .then(data => {
      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(data, {
        featureProjection: 'EPSG:3857'
      });

      if (features.length === 0) {
        console.warn(`⚠️ No features loaded for year ${year}`);
        return callback(null);
      }

      let styleFn;

      if (mode === 'yield') {
        const field = `Yield_${year}`;
        const values = features.map(f => f.get(field)).filter(v => typeof v === 'number');
        if (!values.length) return callback(null);
        const breaks = ss.jenks(values, 6);
        const colors = ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c','#00441b'];
        styleFn = f => {
          const v = f.get(field);
          const idx = getBreakClass(v, breaks);
          return new ol.style.Style({
            fill: new ol.style.Fill({ color: colors[idx] }),
            stroke: new ol.style.Stroke({ color: '#555', width: 0.5 })
          });
        };
      }

  else if (mode === 'dotdensity') {
  const pf = `Prod_${year}`;
  const af = `Area_${year}`;
  const pvals = features.map(f => f.get(pf)).filter(v => typeof v === 'number');
  const avals = features.map(f => f.get(af)).filter(v => typeof v === 'number');
  if (!pvals.length || !avals.length) return callback(null);
  const pbreaks = ss.jenks(pvals, 10);
  const abreaks = ss.jenks(avals, 10);
  const ramp = ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6',
                '#4292c6','#2171b5','#08519c','#08306b','#041f49'];

  // 🌟 Background: color by production
  const bgLayer = new ol.layer.Vector({
    source: new ol.source.Vector({ features }),
    style: f => {
      const val = f.get(pf);
      const cls = getBreakClass(val, pbreaks);
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: ramp[cls] }),
        stroke: new ol.style.Stroke({ color: '#555', width: 0.5 })
      });
    }
  });

  // 🌟 Dot layer: random dots inside polygons based on area
  const dots = [];
  features.forEach(f => {
    const area = f.get(af);
    const geom = f.getGeometry();
    const cls = getBreakClass(area, abreaks);
    const count = cls + 1;
    const extent = geom.getExtent();
    for (let i = 0; i < count; i++) {
      let pt, tries = 0;
      do {
        const x = extent[0] + Math.random() * (extent[2] - extent[0]);
        const y = extent[1] + Math.random() * (extent[3] - extent[1]);
        pt = new ol.geom.Point([x, y]);
        tries++;
      } while (!geom.intersectsCoordinate(pt.getCoordinates()) && tries < 10);
      if (tries < 10) {
        const dot = new ol.Feature({ geometry: pt });
        dot.set('class', cls);
        dots.push(dot);
      }
    }
  });

  const dotLayer = new ol.layer.Vector({
    source: new ol.source.Vector({ features: dots }),
    style: f => {
      const cls = f.get('class');
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 2 + cls * 0.6,
          fill: new ol.style.Fill({ color: '#654321' }),
          stroke: new ol.style.Stroke({ color: '#222', width: 0.3 })
        })
      });
    }
  });

  const group = new ol.layer.Group({ layers: [bgLayer, dotLayer] });
  return callback(group);
}


      else if (mode === 'bivariate') {
        const pf = `Prod_${year}`;
        const af = `Area_${year}`;
        const pvals = features.map(f => f.get(pf)).filter(v => typeof v === 'number');
        const avals = features.map(f => f.get(af)).filter(v => typeof v === 'number');
        if (!pvals.length || !avals.length) return callback(null);
        const pbreaks = ss.jenks(pvals, 5);
        const abreaks = ss.jenks(avals, 5);
        const pcolors = ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c'];
        const acolors = ['#fff5eb','#fee6ce','#fdae6b','#e6550d','#a63603'];
        const showArea = document.getElementById('showArea').checked;
        const showProd = document.getElementById('showProd').checked;
        styleFn = f => {
          const a = f.get(af), p = f.get(pf);
          const ai = getBreakClass(a, abreaks);
          const pi = getBreakClass(p, pbreaks);
          let color = '#ccc';
          if (showArea && showProd) color = blendColors(acolors[ai], pcolors[pi]);
          else if (showArea) color = acolors[ai];
          else if (showProd) color = pcolors[pi];
          return new ol.style.Style({
            fill: new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#444', width: 0.5 })
          });
        };
      }

      const vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features }),
        style: styleFn
      });

      callback(vectorLayer);
    })
    .catch(err => {
      console.error("Error loading GeoJSON:", err);
      callback(null);
    });
}

// ✅ SAFE updateMaps function
function updateMaps() {
  const mode = document.getElementById('mapMode').value;
  const yearA = document.getElementById('yearA').value;
  const yearB = document.getElementById('yearB').value;

  document.getElementById('yearLabelA').innerText = yearA;
  document.getElementById('yearLabelB').innerText = yearB;

  if (layerA) { mapA.removeLayer(layerA); layerA = null; }
  if (layerB) { mapB.removeLayer(layerB); layerB = null; }

  createLayerByMode(mode, yearA, layer => {
    if (layer) {
      layerA = layer;
      mapA.addLayer(layerA);
      console.log(`✅ Map A (${yearA}) loaded`);
    } else {
      console.warn(`⚠️ Map A (${yearA}) failed to load`);
    }
  });

  createLayerByMode(mode, yearB, layer => {
    if (layer) {
      layerB = layer;
      mapB.addLayer(layerB);
      console.log(`✅ Map B (${yearB}) loaded`);
    } else {
      console.warn(`⚠️ Map B (${yearB}) failed to load`);
    }
  });
}

// Tooltip logic
const tooltip = document.getElementById('tooltip');
function setupTooltip(map, id) {
  map.on('pointermove', function (evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
    if (feature) {
      const props = feature.getProperties();
      const year = document.getElementById(id === 'mapA' ? 'yearA' : 'yearB').value;
      tooltip.style.left = evt.originalEvent.pageX + 10 + 'px';
      tooltip.style.top = evt.originalEvent.pageY + 10 + 'px';
      tooltip.innerHTML = `<strong>${props.Country || props.ADMIN}</strong><br/>
        Area: ${props['Area_' + year] || '–'}<br/>
        Prod: ${props['Prod_' + year] || '–'}<br/>
        Yield: ${props['Yield_' + year] || '–'}`;
      tooltip.style.display = 'block';
    } else {
      tooltip.style.display = 'none';
    }
  });
}
setupTooltip(mapA, 'mapA');
setupTooltip(mapB, 'mapB');

// Event bindings
document.getElementById('mapMode').addEventListener('change', updateMaps);
document.getElementById('yearA').addEventListener('input', updateMaps);
document.getElementById('yearB').addEventListener('input', updateMaps);
document.getElementById('showArea').addEventListener('change', updateMaps);
document.getElementById('showProd').addEventListener('change', updateMaps);

// Initial load
updateMaps();
