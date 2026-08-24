/* ============================================================
   dividends.js
   ============================================================
   Column order/headers throughout (manual form, table, and the
   CSV importer) mirror Zerodha Console's dividend report export
   — Symbol, Ex-date, Qty, Dividend per share, Total dividend —
   so that file can be imported with no editing. AssetType/Notes
   are optional extras since Zerodha's own export won't have them
   (defaults to Indian Stock).
   ============================================================ */

const _divSortState = { col: null, dir: 'desc' };

function divRowAccessor(row, key) {
  switch (key) {
    case 'date': return row.date;
    case 'assetType': return ASSET_LABELS[row.assetType];
    case 'symbol': return row.symbol;
    case 'qty': return row.qty;
    case 'perShare': return row.perShare;
    case 'amountNative': return row.amount;
    case 'amountInr': return row.amountInr;
    case 'notes': return row.notes || '';
    default: return null;
  }
}

function currencyFor(assetType) { return assetType === 'US_STOCK' ? 'USD' : 'INR'; }
function currencySymbolFor(assetType) { return assetType === 'US_STOCK' ? '$' : '₹'; }

function renderDividendsPage() {
  const usdInr = Store.getPriceCache('fx_usdinr', 1000 * 60 * 60 * 24) || Store.getSettings().fxOverride || 83;
  const raw = Store.getDividends();
  let rows = raw.map(d => ({
    ...d,
    amountInr: d.currency === 'USD' ? d.amount * usdInr : d.amount
  }));

  const totalInr = rows.reduce((s, r) => s + r.amountInr, 0);
  const thisYear = new Date().getFullYear();
  const thisYearInr = rows.filter(r => new Date(r.date).getFullYear() === thisYear).reduce((s, r) => s + r.amountInr, 0);
  const indianTotal = rows.filter(r => r.assetType === 'IN_STOCK').reduce((s, r) => s + r.amountInr, 0);
  const usTotal = rows.filter(r => r.assetType === 'US_STOCK').reduce((s, r) => s + r.amountInr, 0);

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">Total Dividends Received</div><div class="value up">${Fmt.money(totalInr)}</div></div>
    <div class="stat-card"><div class="label">This Year (${thisYear})</div><div class="value up">${Fmt.money(thisYearInr)}</div></div>
    <div class="stat-card"><div class="label">From Indian Stocks</div><div class="value">${Fmt.money(indianTotal)}</div></div>
    <div class="stat-card"><div class="label">From US Stocks</div><div class="value dual-value">${Fmt.money(usTotal)}</div></div>
  `;

  rows = sortRows(rows, _divSortState, divRowAccessor);

  const tableFrame = document.getElementById('tableFrame');
  tableFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Dividend history — ${raw.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th data-sort="symbol">Symbol</th><th data-sort="date">Ex-Date</th><th data-sort="qty">Qty</th>
          <th data-sort="perShare">Dividend/Share</th><th data-sort="amountNative">Total Dividend</th>
          <th data-sort="amountInr">Amount (INR)</th><th data-sort="assetType">Asset Type</th><th data-sort="notes">Notes</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => `
            <tr>
              <td>${r.symbol}</td>
              <td class="num">${Fmt.date(r.date)}</td>
              <td class="num">${r.qty != null ? Fmt.numExact(r.qty) : '—'}</td>
              <td class="num">${r.perShare != null ? Fmt.moneyPrecise(r.perShare, currencySymbolFor(r.assetType)) : '—'}</td>
              <td class="num">${Fmt.moneyPrecise(r.amount, currencySymbolFor(r.assetType))}</td>
              <td class="num">${Fmt.money(r.amountInr)}</td>
              <td>${ASSET_LABELS[r.assetType]}</td>
              <td style="text-align:left; white-space:normal; max-width:180px; color:var(--text-muted);">${r.notes || '—'}</td>
              <td><div class="row-actions">
                <button data-edit-id="${r.id}" class="ghost">Edit</button>
                <button data-del-id="${r.id}" class="danger">Del</button>
              </div></td>
            </tr>
          `).join('') : `<tr><td colspan="9" class="empty-state">No dividends logged yet — add one above</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  attachSortHandlers(tableFrame.querySelector('thead'), _divSortState, renderDividendsPage);
  tableFrame.querySelectorAll('button[data-del-id]').forEach(btn => {
    btn.onclick = () => {
      if (confirm('Delete this dividend entry?')) {
        Store.deleteDividend(btn.dataset.delId);
        toast('Dividend deleted', 'ok');
        renderDividendsPage();
      }
    };
  });
  tableFrame.querySelectorAll('button[data-edit-id]').forEach(btn => {
    btn.onclick = () => openEditDividendModal(btn.dataset.editId);
  });

  // yearly breakdown
  const byYear = {};
  rows.forEach(r => {
    const y = new Date(r.date).getFullYear();
    if (!byYear[y]) byYear[y] = { indian: 0, us: 0 };
    if (r.assetType === 'IN_STOCK') byYear[y].indian += r.amountInr;
    else byYear[y].us += r.amountInr;
  });
  const years = Object.keys(byYear).sort((a, b) => b - a);
  const yearlyHolder = document.getElementById('yearlyHolder');
  if (!years.length) {
    yearlyHolder.innerHTML = '<div class="empty-state">No dividends logged yet</div>';
  } else {
    yearlyHolder.innerHTML = `
      <table>
        <thead><tr><th>Year</th><th>Indian Stocks (INR)</th><th>US Stocks (INR)</th><th>Total (INR)</th></tr></thead>
        <tbody>${years.map(y => `
          <tr>
            <td>${y}</td>
            <td class="num">${Fmt.money(byYear[y].indian)}</td>
            <td class="num">${Fmt.money(byYear[y].us)}</td>
            <td class="num" style="font-weight:600;">${Fmt.money(byYear[y].indian + byYear[y].us)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  }
}

function openEditDividendModal(id) {
  const div = Store.getDividends().find(d => d.id === id);
  if (!div) return;
  openModal(`Edit dividend — ${div.symbol}`, `
    <div class="form-grid">
      <div class="form-field"><label>Symbol</label><input id="editDivSymbol" value="${div.symbol}" /></div>
      <div class="form-field"><label>Ex-Date</label><input id="editDivDate" type="date" value="${div.date}" /></div>
      <div class="form-field"><label>Qty (optional)</label><input id="editDivQty" type="number" step="any" value="${div.qty != null ? div.qty : ''}" /></div>
      <div class="form-field"><label>Dividend/Share (optional)</label><input id="editDivPerShare" type="number" step="any" value="${div.perShare != null ? div.perShare : ''}" /></div>
      <div class="form-field"><label>Total Dividend</label><input id="editDivAmount" type="number" step="any" value="${div.amount}" /></div>
      <div class="form-field"><label>Asset type</label>
        <select id="editDivAssetType">
          <option value="IN_STOCK" ${div.assetType === 'IN_STOCK' ? 'selected' : ''}>Indian Stock</option>
          <option value="US_STOCK" ${div.assetType === 'US_STOCK' ? 'selected' : ''}>US Stock</option>
        </select>
      </div>
      <div class="form-field"><label>Notes</label><input id="editDivNotes" value="${div.notes || ''}" /></div>
      <div class="form-field"><button id="saveDivEditBtn" class="primary">Save changes</button></div>
    </div>
  `, (overlay) => {
    overlay.querySelector('#saveDivEditBtn').onclick = () => {
      const assetType = overlay.querySelector('#editDivAssetType').value;
      const symbol = overlay.querySelector('#editDivSymbol').value.trim().toUpperCase();
      const date = overlay.querySelector('#editDivDate').value;
      const qtyRaw = overlay.querySelector('#editDivQty').value;
      const perShareRaw = overlay.querySelector('#editDivPerShare').value;
      const amount = parseFloat(overlay.querySelector('#editDivAmount').value);
      const notes = overlay.querySelector('#editDivNotes').value.trim();
      if (!symbol || !date || !amount) return toast('Fill symbol, date and total dividend', 'err');
      Store.updateDividend(id, {
        assetType, symbol, date, amount, currency: currencyFor(assetType), notes,
        qty: qtyRaw !== '' ? parseFloat(qtyRaw) : null,
        perShare: perShareRaw !== '' ? parseFloat(perShareRaw) : null
      });
      toast('Dividend updated', 'ok');
      closeModal();
      renderDividendsPage();
    };
  });
}

function openDividendImportModal() {
  Importer.openModal({
    title: 'Import dividends',
    templateFilename: 'dividends-import-template.csv',
    columns: [
      { label: 'Symbol', required: true, hint: 'Matches the "Symbol" column in Zerodha Console\'s dividend report' },
      { label: 'Ex-date', required: true, hint: 'YYYY-MM-DD, or an actual Excel date cell — matches Zerodha\'s "Ex-date"' },
      { label: 'Qty', required: false, hint: 'Shares held on the ex-date — matches Zerodha\'s "Qty"' },
      { label: 'Dividend per share', required: false, hint: 'Matches Zerodha\'s "Dividend per share"' },
      { label: 'Total dividend', required: true, hint: 'The actual amount received — matches Zerodha\'s "Total dividend"' },
      { label: 'AssetType', required: false, hint: 'IN_STOCK or US_STOCK — defaults to IN_STOCK when omitted (Zerodha exports are Indian-only)' },
      { label: 'Notes', required: false }
    ],
    sampleRow: ['NTPC', '2025-09-04', '1', '3.35', '3.35', 'IN_STOCK', ''],
    onImport: async (rows) => {
      const errors = [];
      let success = 0;
      rows.forEach((row, i) => {
        const rowNum = i + 2;
        const symbol = (Importer.getField(row, 'Symbol') || '').toString().trim().toUpperCase();
        if (!symbol) { errors.push(`Row ${rowNum}: missing Symbol`); return; }
        const date = Importer.normalizeDate(Importer.getField(row, 'Ex-date', 'Ex Date', 'ExDate', 'Date'));
        if (!date) { errors.push(`Row ${rowNum} (${symbol}): unrecognized Ex-date`); return; }
        const amount = parseFloat(Importer.getField(row, 'Total dividend', 'TotalDividend', 'Amount'));
        if (!amount || amount <= 0) { errors.push(`Row ${rowNum} (${symbol}): invalid Total dividend`); return; }
        const qtyRaw = Importer.getField(row, 'Qty', 'Quantity');
        const qty = qtyRaw !== undefined ? parseFloat(qtyRaw) : null;
        const perShareRaw = Importer.getField(row, 'Dividend per share', 'DividendPerShare', 'Dividend Per Share');
        const perShare = perShareRaw !== undefined ? parseFloat(perShareRaw) : null;
        const assetTypeRaw = (Importer.getField(row, 'AssetType', 'Asset Type') || 'IN_STOCK').toString().trim().toUpperCase();
        const assetType = ['IN_STOCK', 'US_STOCK'].includes(assetTypeRaw) ? assetTypeRaw : 'IN_STOCK';
        const notes = (Importer.getField(row, 'Notes') || '').toString().trim();
        Store.addDividend({ assetType, symbol, date, qty, perShare, amount, currency: currencyFor(assetType), notes });
        success++;
      });
      renderDividendsPage();
      return { success, errors };
    }
  });
}

(async () => {
  await Store.init();
  renderShell('dividends.html', 'Dividends');
  document.getElementById('divDate').value = Finance.todayStr();

  const addFrame = document.getElementById('addFrame');
  const assetTypeSel = addFrame.querySelector('#divAssetType');
  const perShareLabel = addFrame.querySelector('#divPerShareLabel');
  const amountLabel = addFrame.querySelector('#divAmountLabel');
  const qtyInput = addFrame.querySelector('#divQty');
  const perShareInput = addFrame.querySelector('#divPerShare');
  const amountInput = addFrame.querySelector('#divAmount');

  assetTypeSel.onchange = () => {
    const sym = currencySymbolFor(assetTypeSel.value);
    perShareLabel.textContent = `Dividend/Share (${sym}, optional)`;
    amountLabel.textContent = `Total Dividend (${sym})`;
  };

  // convenience: auto-fill Total Dividend from Qty × Dividend/Share, still editable/overridable after
  function autoFillTotal() {
    const qty = parseFloat(qtyInput.value);
    const perShare = parseFloat(perShareInput.value);
    if (qty && perShare) amountInput.value = (qty * perShare).toFixed(2);
  }
  qtyInput.oninput = autoFillTotal;
  perShareInput.oninput = autoFillTotal;

  addFrame.querySelector('#addDivBtn').onclick = () => {
    const assetType = assetTypeSel.value;
    const symbol = addFrame.querySelector('#divSymbol').value.trim().toUpperCase();
    const date = addFrame.querySelector('#divDate').value;
    const qty = qtyInput.value !== '' ? parseFloat(qtyInput.value) : null;
    const perShare = perShareInput.value !== '' ? parseFloat(perShareInput.value) : null;
    const amount = parseFloat(amountInput.value);
    const notes = addFrame.querySelector('#divNotes').value.trim();
    if (!symbol || !date || !amount) return toast('Fill symbol, date and total dividend', 'err');
    Store.addDividend({ assetType, symbol, date, qty, perShare, amount, currency: currencyFor(assetType), notes });
    toast('Dividend logged', 'ok');
    addFrame.querySelector('#divSymbol').value = '';
    qtyInput.value = '';
    perShareInput.value = '';
    amountInput.value = '';
    addFrame.querySelector('#divNotes').value = '';
    renderDividendsPage();
  };

  addFrame.querySelector('#importDivBtn').onclick = openDividendImportModal;

  renderDividendsPage();
})();
window.addEventListener('ft-store-updated', renderDividendsPage);
window.addEventListener('ft-theme-changed', renderDividendsPage);
