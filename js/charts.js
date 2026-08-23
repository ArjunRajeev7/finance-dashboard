/* ============================================================
   charts.js — SVG chart primitives, theme-aware color palette
   ============================================================
   The categorical palette (for asset-class/holding breakdowns)
   deliberately avoids saturated green/red — those hues are
   reserved everywhere else for gain/loss, so reusing them here
   would make a chart segment look like a "loss" by accident.
   ============================================================ */

const Charts = {};

Charts.palette = function () {
  const dark = Theme.get() === 'dark';
  return dark
    ? ['#5B8DEF', '#A78BFA', '#E0A840', '#22D3EE', '#F472B6', '#94A3B8']
    : ['#2952CC', '#7C3AED', '#B7791F', '#0E7490', '#BE185D', '#475569'];
};

Charts.cssVar = function (name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

// shared floating tooltip element for chart hovers
function getChartTooltipEl() {
  let el = document.getElementById('chartTooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chartTooltip';
    el.className = 'chart-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

// entries: [{label, value}]
Charts.renderDonut = function (holder, entries, opts) {
  opts = opts || {};
  entries = entries.filter(e => e.value > 0);
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (!total) { holder.innerHTML = '<div class="empty-state">No data yet</div>'; return; }
  const palette = Charts.palette();
  const r = opts.r || 68, cx = opts.cx || 88, cy = opts.cy || 88, strokeW = opts.strokeW || 24;
  const circumference = 2 * Math.PI * r;
  let offset = 0, arcs = '';
  entries.forEach((e, i) => {
    const len = (e.value / total) * circumference;
    arcs += `<circle class="donut-arc" data-label="${e.label}" data-value="${e.value}" data-base-width="${strokeW}"
      cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${palette[i % 6]}"
      stroke-width="${strokeW}" stroke-dasharray="${Math.max(len - 2, 0)} ${circumference - len + 2}"
      stroke-linecap="round" style="cursor:pointer; transition: stroke-width .12s;"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
    offset += len;
  });
  holder.innerHTML = `
    <svg width="${cx * 2}" height="${cy * 2}" viewBox="0 0 ${cx * 2} ${cy * 2}" role="img" aria-label="${opts.ariaLabel || 'donut chart'}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Charts.cssVar('--surface-sunken')}" stroke-width="${strokeW}" />
      ${arcs}
      ${opts.centerLine1 ? `<text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="${Charts.cssVar('--text')}" font-size="13" font-weight="600" font-family="var(--font-ui)">${opts.centerLine1}</text>` : ''}
      ${opts.centerLine2 ? `<text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="${Charts.cssVar('--text-muted')}" font-size="10.5" font-family="var(--font-mono)">${opts.centerLine2}</text>` : ''}
    </svg>
  `;

  const tooltip = getChartTooltipEl();
  holder.querySelectorAll('.donut-arc').forEach(arc => {
    const baseWidth = parseFloat(arc.dataset.baseWidth);
    arc.addEventListener('mouseenter', () => {
      arc.setAttribute('stroke-width', baseWidth + 6);
      const label = arc.dataset.label;
      const value = parseFloat(arc.dataset.value);
      const pct = ((value / total) * 100).toFixed(1);
      tooltip.innerHTML = `${label}<span class="val">${Fmt.moneyCompact(value)} · ${pct}%</span>`;
      tooltip.style.display = 'block';
    });
    arc.addEventListener('mousemove', (e) => {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY + 14) + 'px';
    });
    arc.addEventListener('mouseleave', () => {
      arc.setAttribute('stroke-width', baseWidth);
      tooltip.style.display = 'none';
    });
  });
};

Charts.renderLegend = function (holder, entries) {
  const palette = Charts.palette();
  holder.innerHTML = entries.map((e, i) => `
    <span class="legend-item"><span class="legend-swatch" style="background:${palette[i % 6]};"></span>${e.label}</span>
  `).join('');
};

// entries: [{label, a, b}] renders paired bars (e.g. invested vs current)
Charts.renderGroupedBar = function (holder, entries, opts) {
  opts = opts || {};
  if (!entries.length) { holder.innerHTML = '<div class="empty-state">No data yet</div>'; return; }
  const accent = Charts.cssVar('--accent');
  const sunken = Charts.cssVar('--surface-sunken');
  const borderStrong = Charts.cssVar('--border-strong');
  const textMuted = Charts.cssVar('--text-muted');
  const max = Math.max(...entries.map(e => Math.max(e.a, e.b)), 1);
  const barW = 90, gap = 50, chartH = 200, leftPad = 40;
  const w = leftPad + entries.length * (barW * 2 + gap);
  let bars = '';
  entries.forEach((e, i) => {
    const x = leftPad + i * (barW * 2 + gap);
    const aH = (e.a / max) * chartH, bH = (e.b / max) * chartH;
    bars += `
      <rect x="${x}" y="${chartH - aH}" width="${barW * 0.42}" height="${aH}" rx="3" fill="${sunken}" stroke="${borderStrong}" stroke-width="1" />
      <rect x="${x + barW * 0.46}" y="${chartH - bH}" width="${barW * 0.42}" height="${bH}" rx="3" fill="${accent}" />
      <text x="${x + barW * 0.44}" y="${chartH + 18}" text-anchor="middle" fill="${textMuted}" font-size="10" font-family="var(--font-ui)">${e.label}</text>
    `;
  });
  holder.innerHTML = `
    <svg width="100%" height="${chartH + 40}" viewBox="0 0 ${w} ${chartH + 40}" preserveAspectRatio="xMinYMid meet">
      <line x1="0" y1="${chartH}" x2="${w}" y2="${chartH}" stroke="${borderStrong}" />
      ${bars}
    </svg>
    <div style="display:flex; gap:16px; margin-top:8px;">
      <span class="legend-item"><span class="legend-swatch" style="background:${sunken}; border:1px solid ${borderStrong};"></span>${opts.labelA || 'a'}</span>
      <span class="legend-item"><span class="legend-swatch" style="background:${accent};"></span>${opts.labelB || 'b'}</span>
    </div>
  `;
};

// points: [{x:number, y:number}]
Charts.renderLineChart = function (holder, points, opts) {
  opts = opts || {};
  if (!points || points.length < 2) { holder.innerHTML = '<div class="empty-state">Not enough data to project</div>'; return; }
  const accent = Charts.cssVar('--accent');
  const gridColor = Charts.cssVar('--border');
  const axisColor = Charts.cssVar('--border-strong');
  const textMuted = Charts.cssVar('--text-muted');
  const w = opts.width || 720, h = opts.height || 260, padL = 78, padR = 20, padT = 20, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 0, yMax = Math.max(...ys) * 1.08;
  const sx = (x) => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y) => padT + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const areaPath = path + ` L ${sx(xs[xs.length - 1]).toFixed(1)} ${sy(yMin).toFixed(1)} L ${sx(xMin).toFixed(1)} ${sy(yMin).toFixed(1)} Z`;

  let grid = '';
  const gridN = 4;
  for (let i = 0; i <= gridN; i++) {
    const gy = padT + (plotH / gridN) * i;
    const val = yMax - (yMax / gridN) * i;
    grid += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="${gridColor}" />`;
    grid += `<text x="${padL - 10}" y="${gy + 4}" text-anchor="end" fill="${textMuted}" font-size="10" font-family="var(--font-mono)">${Fmt.moneyCompact(val)}</text>`;
  }
  const xLabelStep = Math.max(1, Math.round((xMax - xMin) / 8));
  let xLabels = '';
  for (let x = xMin; x <= xMax; x += xLabelStep) {
    xLabels += `<text x="${sx(x)}" y="${h - padB + 16}" text-anchor="middle" fill="${textMuted}" font-size="10" font-family="var(--font-mono)">${opts.xLabel ? opts.xLabel(x) : x}</text>`;
  }
  const dots = points.filter((p, i) => i % Math.max(1, Math.round(points.length / 12)) === 0 || i === points.length - 1)
    .map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3" fill="${accent}" stroke="${Charts.cssVar('--surface')}" stroke-width="1.5" />`).join('');

  const gradId = 'lg' + Math.random().toString(36).slice(2, 8);
  holder.innerHTML = `
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${opts.ariaLabel || 'projection chart'}">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#${gradId})" />
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}
      ${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="${axisColor}" />
      <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="${axisColor}" />
    </svg>
  `;
};

window.Charts = Charts;
