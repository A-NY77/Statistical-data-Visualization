// legend.js – with abbreviated ranges and dynamic bivariate matrix rendering

function renderYieldLegend(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="legend-title">Yield (kg/ha)</div>
    <div>
      <div style="background:#edf8e9; height:20px;">0–1500</div>
      <div style="background:#bae4b3; height:20px;">1500–2500</div>
      <div style="background:#74c476; height:20px;">2500–3500</div>
      <div style="background:#31a354; height:20px;">3500–4500</div>
      <div style="background:#006d2c; height:20px;">4500–5500</div>
      <div style="background:#00441b; height:20px;">5500+</div>
    </div>
  `;
  document.querySelector('.legend-controls')?.classList.remove('active');
}

function renderBivariateMatrix(containerId, showProd, showArea, prodBreaks, areaBreaks) {
  const container = document.getElementById(containerId);
  const pColors = ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c'];
  const aColors = ['#fff5eb','#fee6ce','#fdae6b','#e6550d','#a63603'];

  container.innerHTML = `<div class="legend-title">Bivariate Matrix</div><table></table>`;
  const table = container.querySelector('table');

  for (let r = 4; r >= 0; r--) {
    const row = document.createElement('tr');
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement('td');
      let color = '#eee';
      if (showArea && showProd) color = blendColors(aColors[r], pColors[c]);
      else if (showArea) color = aColors[r];
      else if (showProd) color = pColors[c];
      cell.style.backgroundColor = color;

      const prodLabel = abbrev(prodBreaks[c]) + '–' + abbrev(prodBreaks[c + 1]);
      const areaLabel = abbrev(areaBreaks[r]) + '–' + abbrev(areaBreaks[r + 1]);
      cell.innerHTML = showArea && showProd ? `${areaLabel}<br>${prodLabel}`
                    : showArea ? areaLabel
                    : showProd ? prodLabel : '';
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  document.querySelector('.legend-controls')?.classList.add('active');
}

function renderDotDensityLegend(containerId, prodBreaks, areaBreaks) {
  const container = document.getElementById(containerId);
  const prodColors = ['#f7fbff','#e3eef7','#d0e2ef','#bcd5e7','#a9c9df','#95bcd6','#82b0ce','#6ea3c6','#5b97be','#478ab6'];

  const colorLegend = `<div class="legend-title">Production (Color Intensity)</div><div class="color-legend">` +
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

function blendColors(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(
    Math.round((r1 + r2) / 2),
    Math.round((g1 + g2) / 2),
    Math.round((b1 + b2) / 2)
  );
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function abbrev(value) {
  if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(0) + 'k';
  return value.toString();
}
