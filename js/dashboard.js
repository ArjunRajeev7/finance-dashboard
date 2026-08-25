/* ============================================================
   dashboard.js
   ============================================================ */

function renderSummaryCards(snap) {
  const el = document.getElementById('summaryCards');
  const gc = Fmt.gainClass(snap.totalGain);
  el.innerHTML = `
    <div class="stat-card">
      <div class="label">Total Invested</div>
      <div class="value">${Fmt.money(snap.totalInvested)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Current Value</div>
      <div class="value">${Fmt.money(snap.totalCurrent)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Gain / Loss</div>
      <div class="value ${gc}">${Fmt.gainMoney(snap.totalGain)}</div>
      <div class="sub ${gc}">${Fmt.pct(snap.totalGainPct)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Portfolio XIRR</div>
      <div class="value ${Fmt.gainClass(snap.portfolioXirr)}">${snap.portfolioXirr != null ? Fmt.pct(snap.portfolioXirr * 100) : '—'}</div>
    </div>
  `;
}

function renderDiversityCards(snap) {
  const el = document.getElementById('diversityCards');
  const totalInstruments = snap.rows.length;
  const assetClassesUsed = ASSET_TYPES.filter(t => snap.byAssetType[t].count > 0).length;
  const sorted = [...snap.rows].sort((a, b) => (b.currentValueINR || 0) - (a.currentValueINR || 0));
  const largest = sorted[0];
  const largestWeight = largest && snap.totalCurrent ? ((largest.currentValueINR || 0) / snap.totalCurrent) * 100 : 0;
  const hhi = ASSET_TYPES.reduce((s, t) => {
    const w = snap.totalCurrent ? (snap.byAssetType[t].current / snap.totalCurrent) : 0;
    return s + w * w;
  }, 0) * 100;
  const diversificationLabel = hhi < 25 ? 'well spread' : hhi < 45 ? 'moderately concentrated' : 'concentrated';

  const dividends = Store.getDividends();
  const totalDividendsInr = dividends.reduce((s, d) => s + (d.currency === 'USD' ? d.amount * snap.usdInr : d.amount), 0);

  el.innerHTML = `
    <div class="stat-card">
      <div class="label">Instruments Held</div>
      <div class="value">${totalInstruments}</div>
      <div class="sub">across ${assetClassesUsed} of ${ASSET_TYPES.length} asset classes</div>
    </div>
    <div class="stat-card">
      <div class="label">Largest Single Holding</div>
      <div class="value">${largest ? Fmt.num(largestWeight, 1) + '%' : '—'}</div>
      <div class="sub">${largest ? largest.name : 'no holdings yet'}</div>
    </div>
    <div class="stat-card">
      <div class="label">Asset-Class Concentration</div>
      <div class="value">${Fmt.num(hhi, 0)}</div>
      <div class="sub">${diversificationLabel} (lower = more diversified)</div>
    </div>
    <div class="stat-card">
      <div class="label">USD/INR Used</div>
      <div class="value">${Fmt.num(snap.usdInr, 2)}</div>
      <div class="sub">applied to US Stocks valuation</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Dividends Earned</div>
      <div class="value up">${Fmt.money(totalDividendsInr)}</div>
      <div class="sub"><a href="dividends.html">Indian + US, see breakdown →</a></div>
    </div>
  `;
}

function renderDonut(snap) {
  const holder = document.getElementById('donutHolder');
  const entries = ASSET_TYPES.map(t => ({ label: ASSET_LABELS[t], value: snap.byAssetType[t].current }));
  const total = entries.reduce((s, e) => s + e.value, 0);
  Charts.renderDonut(holder, entries, {
    centerLine1: `${entries.filter(e => e.value > 0).length} classes`,
    centerLine2: Fmt.moneyCompact(total),
    ariaLabel: 'allocation by asset class'
  });
}

function renderAllocTable(snap) {
  const holder = document.getElementById('allocTableHolder');
  const palette = Charts.palette();
  const rows = ASSET_TYPES.map((t, i) => {
    const a = snap.byAssetType[t];
    if (!a.count) return '';
    const pct = snap.totalCurrent ? (a.current / snap.totalCurrent) * 100 : 0;
    return `<tr>
      <td><span class="legend-swatch" style="background:${palette[i % 6]}; margin-right:8px; vertical-align:-1px;"></span><a href="${ASSET_PAGES[t]}">${ASSET_LABELS[t]}</a></td>
      <td class="num">${a.count}</td>
      <td class="num">${Fmt.money(a.current)}</td>
      <td class="num">${Fmt.num(pct, 1)}%</td>
      <td class="num ${Fmt.gainClass(a.gain)}">${Fmt.pct(a.gainPct)}</td>
    </tr>`;
  }).join('');
  holder.innerHTML = `
    <table>
      <thead><tr><th>Class</th><th>#</th><th>Value</th><th>Weight</th><th>Gain %</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty-state">No holdings yet — add some via the asset-class pages</td></tr>'}</tbody>
    </table>
  `;
}

function renderTopHoldings(snap) {
  const holder = document.getElementById('topHoldingsHolder');
  if (!snap.rows.length) { holder.innerHTML = '<div class="empty-state">No holdings yet</div>'; return; }
  const sorted = [...snap.rows].sort((a, b) => (b.currentValueINR || 0) - (a.currentValueINR || 0)).slice(0, 8);
  const max = sorted[0].currentValueINR || 1;
  holder.innerHTML = sorted.map(r => {
    const weight = snap.totalCurrent ? ((r.currentValueINR || 0) / snap.totalCurrent) * 100 : 0;
    const barPct = ((r.currentValueINR || 0) / max) * 100;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
          <span>${r.name} <span class="badge">${ASSET_LABELS[r.assetType]}</span></span>
          <span class="mono">${Fmt.money(r.currentValueINR)} · ${Fmt.num(weight, 1)}%</span>
        </div>
        <div class="weight-bar-track"><div class="weight-bar-fill" style="width:${barPct}%;"></div></div>
      </div>
    `;
  }).join('');
}

function renderHoldingsTable(snap) {
  const body = document.getElementById('holdingsBody');
  if (!snap.rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state"><span class="arrow">→</span> No holdings yet. Add some via the asset-class pages in the nav.</td></tr>`;
    return;
  }
  const sorted = [...snap.rows].sort((a, b) => (b.currentValueINR || 0) - (a.currentValueINR || 0));
  body.innerHTML = sorted.map(r => `
    <tr>
      <td><a href="${ASSET_PAGES[r.assetType]}">${r.name}</a>${!r.hasPrice ? ' <span class="badge warn">no price</span>' : ''}</td>
      <td>${ASSET_LABELS[r.assetType]}</td>
      <td class="num">${r.qty != null ? Fmt.num(r.qty, r.qty % 1 === 0 ? 0 : 3) : '—'}</td>
      <td class="num">${Fmt.money(r.investedINR)}</td>
      <td class="num">${Fmt.money(r.currentValueINR)}</td>
      <td class="num ${Fmt.gainClass(r.gainINR)}">${Fmt.gainMoney(r.gainINR)}</td>
      <td class="num ${Fmt.gainClass(r.gainPct)}">${Fmt.pct(r.gainPct)}</td>
      <td class="num ${Fmt.gainClass(r.xirr != null ? r.xirr * 100 : null)}">${r.xirr != null ? Fmt.pct(r.xirr * 100) : '—'}</td>
    </tr>
  `).join('');
}

function renderBarChart(snap) {
  const holder = document.getElementById('barChart');
  const entries = ASSET_TYPES.filter(t => snap.byAssetType[t].count)
    .map(t => ({ label: ASSET_LABELS[t].split(' ')[0], a: snap.byAssetType[t].invested, b: snap.byAssetType[t].current }));
  Charts.renderGroupedBar(holder, entries, { labelA: 'Invested', labelB: 'Current value' });
}

function renderTicker(snap) {
  // no scrolling ticker in the new design — freshness pulses on each table row communicate live status instead
}

function renderDashboard() {
  const snap = Valuation.snapshot();
  renderSummaryCards(snap);
  renderDiversityCards(snap);
  renderDonut(snap);
  renderAllocTable(snap);
  renderTopHoldings(snap);
  renderHoldingsTable(snap);
  renderBarChart(snap);
}

(async () => {
  await Store.init();
  renderShell('index.html', 'Dashboard');
  renderDashboard();
})();
window.addEventListener('ft-store-updated', renderDashboard);
window.addEventListener('ft-prices-updated', renderDashboard);
window.addEventListener('ft-theme-changed', renderDashboard);
