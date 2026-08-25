/* ============================================================
   dividends.js
   ============================================================
   Indian dividends are split across 3 user-nameable "accounts"
   (each with its own table), since the same stock can be held
   across multiple family broker accounts. US dividends are kept
   in a single separate section/table — deliberately never merged
   with Indian rows. Column order/headers mirror Zerodha Console's
   dividend report (Symbol, Ex-date, Qty, Dividend per share,
   Total dividend) so that export can be imported with no editing.
   ============================================================ */

const _indianDivSortStates = { 1: { col: null, dir: 'desc' }, 2: { col: null, dir: 'desc' }, 3: { col: null, dir: 'desc' } };
const _usDivSortState = { col: null, dir: 'desc' };

function divRowAccessor(row, key) {
  switch (key) {
    case 'date': return row.date;
    case 'symbol': return row.symbol;
    case 'qty': return row.qty;
    case 'perShare': return row.perShare;
    case 'amountNative': return row.amount;
    case 'notes': return row.notes || '';
    default: return null;
  }
}

function divRowHtml(r, isUS, usdInr) {
  const sym = isUS ? '$' : '₹';
  return `
    <tr>
      <td>${r.symbol}</td>
      <td class="num">${Fmt.date(r.date)}</td>
      <td class="num">${r.qty != null ? Fmt.numExact(r.qty) : '—'}</td>
      <td class="num">${r.perShare != null ? Fmt.moneyPrecise(r.perShare, sym) : '—'}</td>
      <td class="num">${Fmt.moneyPrecise(r.amount, sym)}</td>
      ${isUS ? `<td class="num">${Fmt.money(r.amount * usdInr)}</td>` : ''}
      <td style="text-align:left; white-space:normal; max-width:180px; color:var(--text-muted);">${r.notes || '—'}</td>
      <td><div class="row-actions">
        <button data-edit-id="${r.id}" class="ghost">Edit</button>
        <button data-del-id="${r.id}" class="danger">Del</button>
      </div></td>
    </tr>
  `;
}

function wireDivRowActions(container) {
  container.querySelectorAll('button[data-del-id]').forEach(btn => {
    btn.onclick = () => {
      if (confirm('Delete this dividend entry?')) {
        Store.deleteDividend(btn.dataset.delId);
        toast('Dividend deleted', 'ok');
        renderDividendsPage();
      }
    };
  });
  container.querySelectorAll('button[data-edit-id]').forEach(btn => {
    btn.onclick = () => openEditDividendModal(btn.dataset.editId);
  });
}

function renderDividendsPage() {
  const usdInr = Store.getPriceCache('fx_usdinr', 1000 * 60 * 60 * 24) || Store.getSettings().fxOverride || 83;
  const all = Store.getDividends();
  const indian = all.filter(d => d.assetType === 'IN_STOCK').map(d => Object.assign({}, d, { account: d.account || 1 }));
  const us = all.filter(d => d.assetType === 'US_STOCK');
  const accounts = Store.getDividendAccounts();

  const indianTotal = indian.reduce((s, d) => s + d.amount, 0);
  const usTotalUSD = us.reduce((s, d) => s + d.amount, 0);
  const usTotalINR = usTotalUSD * usdInr;
  const grandTotal = indianTotal + usTotalINR;
  const thisYear = new Date().getFullYear();
  const thisYearIndian = indian.filter(d => new Date(d.date).getFullYear() === thisYear).reduce((s, d) => s + d.amount, 0);
  const thisYearUsInr = us.filter(d => new Date(d.date).getFullYear() === thisYear).reduce((s, d) => s + d.amount, 0) * usdInr;

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">Total Dividends Received</div><div class="value up">${Fmt.money(grandTotal)}</div></div>
    <div class="stat-card"><div class="label">This Year (${thisYear})</div><div class="value up">${Fmt.money(thisYearIndian + thisYearUsInr)}</div></div>
    <div class="stat-card"><div class="label">From Indian Stocks</div><div class="value">${Fmt.money(indianTotal)}</div><div class="sub">across all accounts</div></div>
    <div class="stat-card"><div class="label">From US Stocks</div><div class="value dual-value">${Fmt.money(usTotalINR)}<span class="secondary">${Fmt.moneyPrecise(usTotalUSD, '$')}</span></div></div>
  `;

  // ---- per-account cards (user-nameable) ----
  const accountCardsEl = document.getElementById('accountCards');
  accountCardsEl.innerHTML = accounts.map(acc => {
    const total = indian.filter(d => d.account === acc.id).reduce((s, d) => s + d.amount, 0);
    return `
      <div class="stat-card">
        <input class="inline-edit-label" data-account-id="${acc.id}" value="${acc.name}" spellcheck="false" />
        <div class="value up">${Fmt.money(total)}</div>
        <div class="sub">Total dividends received</div>
      </div>
    `;
  }).join('');
  accountCardsEl.querySelectorAll('.inline-edit-label').forEach(input => {
    input.addEventListener('blur', () => {
      const id = parseInt(input.dataset.accountId, 10);
      if (input.value.trim() && input.value.trim() !== accounts.find(a => a.id === id).name) {
        Store.renameDividendAccount(id, input.value);
        renderDividendsPage();
      }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  });

  // ---- Indian manual-add account dropdown ----
  const accSelect = document.getElementById('inDivAccount');
  const prevSelected = accSelect.value;
  accSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  if (prevSelected) accSelect.value = prevSelected;

  // ---- Indian per-account tables ----
  const tablesHolder = document.getElementById('indianAccountTables');
  tablesHolder.innerHTML = '';
  accounts.forEach(acc => {
    const rows = sortRows(indian.filter(d => d.account === acc.id), _indianDivSortStates[acc.id], divRowAccessor);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head"><span class="eyebrow">${acc.name} — ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span></div>
      <div class="table-scroll">
        <table>
          <thead><tr>
            <th data-sort="symbol">Symbol</th><th data-sort="date">Ex-Date</th><th data-sort="qty">Qty</th>
            <th data-sort="perShare">Dividend/Share</th><th data-sort="amountNative">Total Dividend</th>
            <th data-sort="notes">Notes</th><th></th>
          </tr></thead>
          <tbody>${rows.length ? rows.map(r => divRowHtml(r, false)).join('') : `<tr><td colspan="7" class="empty-state">No dividends logged yet for ${acc.name}</td></tr>`}</tbody>
        </table>
      </div>
    `;
    tablesHolder.appendChild(card);
    attachSortHandlers(card.querySelector('thead'), _indianDivSortStates[acc.id], renderDividendsPage);
    wireDivRowActions(card);
  });

  // ---- US table ----
  const usRows = sortRows(us, _usDivSortState, divRowAccessor);
  const usTableFrame = document.getElementById('usTableFrame');
  usTableFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">US dividend history — ${usRows.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th data-sort="symbol">Symbol</th><th data-sort="date">Ex-Date</th><th data-sort="qty">Qty</th>
          <th data-sort="perShare">Dividend/Share</th><th data-sort="amountNative">Total Dividend</th>
          <th>Amount (INR)</th><th data-sort="notes">Notes</th><th></th>
        </tr></thead>
        <tbody>${usRows.length ? usRows.map(r => divRowHtml(r, true, usdInr)).join('') : `<tr><td colspan="8" class="empty-state">No US dividends logged yet</td></tr>`}</tbody>
      </table>
    </div>
  `;
  attachSortHandlers(usTableFrame.querySelector('thead'), _usDivSortState, renderDividendsPage);
  wireDivRowActions(usTableFrame);

  // ---- yearly breakdown (combined across all Indian accounts + US) ----
  const byYear = {};
  indian.forEach(d => {
    const y = new Date(d.date).getFullYear();
    if (!byYear[y]) byYear[y] = { indian: 0, us: 0 };
    byYear[y].indian += d.amount;
  });
  us.forEach(d => {
    const y = new Date(d.date).getFullYear();
    if (!byYear[y]) byYear[y] = { indian: 0, us: 0 };
    byYear[y].us += d.amount * usdInr;
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
  const isUS = div.assetType === 'US_STOCK';
  const sym = isUS ? '$' : '₹';
  const accounts = Store.getDividendAccounts();
  openModal(`Edit dividend — ${div.symbol}`, `
    <div class="form-grid">
      <div class="form-field"><label>Symbol</label><input id="editDivSymbol" value="${div.symbol}" /></div>
      <div class="form-field"><label>Ex-Date</label><input id="editDivDate" type="date" value="${div.date}" /></div>
      <div class="form-field"><label>Qty (optional)</label><input id="editDivQty" type="number" step="any" value="${div.qty != null ? div.qty : ''}" /></div>
      <div class="form-field"><label>Dividend/Share (${sym}, optional)</label><input id="editDivPerShare" type="number" step="any" value="${div.perShare != null ? div.perShare : ''}" /></div>
      <div class="form-field"><label>Total Dividend (${sym})</label><input id="editDivAmount" type="number" step="any" value="${div.amount}" /></div>
      ${!isUS ? `<div class="form-field"><label>Account</label><select id="editDivAccount">${accounts.map(a => `<option value="${a.id}" ${(div.account || 1) === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select></div>` : ''}
      <div class="form-field"><label>Notes</label><input id="editDivNotes" value="${div.notes || ''}" /></div>
      <div class="form-field"><button id="saveDivEditBtn" class="primary">Save changes</button></div>
    </div>
  `, (overlay) => {
    overlay.querySelector('#saveDivEditBtn').onclick = () => {
      const symbol = overlay.querySelector('#editDivSymbol').value.trim().toUpperCase();
      const date = overlay.querySelector('#editDivDate').value;
      const qtyRaw = overlay.querySelector('#editDivQty').value;
      const perShareRaw = overlay.querySelector('#editDivPerShare').value;
      const amount = parseFloat(overlay.querySelector('#editDivAmount').value);
      const notes = overlay.querySelector('#editDivNotes').value.trim();
      if (!symbol || !date || !amount) return toast('Fill symbol, date and total dividend', 'err');
      const patch = {
        symbol, date, amount, notes,
        qty: qtyRaw !== '' ? parseFloat(qtyRaw) : null,
        perShare: perShareRaw !== '' ? parseFloat(perShareRaw) : null
      };
      if (!isUS) patch.account = parseInt(overlay.querySelector('#editDivAccount').value, 10);
      Store.updateDividend(id, patch);
      toast('Dividend updated', 'ok');
      closeModal();
      renderDividendsPage();
    };
  });
}

function openIndianDivImportModal() {
  const accounts = Store.getDividendAccounts();
  Importer.openModal({
    title: 'Import Indian dividends (3 accounts)',
    multiSheet: true,
    templateFilename: 'dividends-3-accounts-template.xlsx',
    sheetNames: accounts.map(a => a.name),
    columns: [
      { label: 'Symbol', required: true, hint: 'Matches Zerodha Console\'s "Symbol" column' },
      { label: 'Ex-date', required: true, hint: 'YYYY-MM-DD, or an actual Excel date cell' },
      { label: 'Qty', required: false, hint: 'Shares held on the ex-date' },
      { label: 'Dividend per share', required: false },
      { label: 'Total dividend', required: true, hint: 'The actual amount received' },
      { label: 'Notes', required: false }
    ],
    sampleRow: ['NTPC', '2025-09-04', '1', '3.35', '3.35', ''],
    onImport: async (sheets) => {
      const errors = [];
      let success = 0;
      accounts.forEach((acc, idx) => {
        const sheet = sheets[idx];
        if (!sheet || !sheet.rows || !sheet.rows.length) return; // missing/empty sheet — not an error
        sheet.rows.forEach((row, i) => {
          const rowNum = i + 2;
          const symbol = (Importer.getField(row, 'Symbol') || '').toString().trim().toUpperCase();
          if (!symbol) { errors.push(`${acc.name}, Row ${rowNum}: missing Symbol`); return; }
          const date = Importer.normalizeDate(Importer.getField(row, 'Ex-date', 'Ex Date', 'ExDate', 'Date'));
          if (!date) { errors.push(`${acc.name}, Row ${rowNum} (${symbol}): unrecognized Ex-date`); return; }
          const amount = parseFloat(Importer.getField(row, 'Total dividend', 'TotalDividend', 'Amount'));
          if (!amount || amount <= 0) { errors.push(`${acc.name}, Row ${rowNum} (${symbol}): invalid Total dividend`); return; }
          const qtyRaw = Importer.getField(row, 'Qty', 'Quantity');
          const qty = qtyRaw !== undefined ? parseFloat(qtyRaw) : null;
          const perShareRaw = Importer.getField(row, 'Dividend per share', 'DividendPerShare', 'Dividend Per Share');
          const perShare = perShareRaw !== undefined ? parseFloat(perShareRaw) : null;
          const notes = (Importer.getField(row, 'Notes') || '').toString().trim();
          Store.addDividend({ assetType: 'IN_STOCK', symbol, date, qty, perShare, amount, currency: 'INR', notes, account: acc.id });
          success++;
        });
      });
      renderDividendsPage();
      return { success, errors };
    }
  });
}

function openUsDivImportModal() {
  Importer.openModal({
    title: 'Import US dividends',
    templateFilename: 'us-dividends-import-template.csv',
    columns: [
      { label: 'Symbol', required: true, hint: 'e.g. AAPL' },
      { label: 'Ex-date', required: true, hint: 'YYYY-MM-DD, or an actual Excel date cell' },
      { label: 'Qty', required: false, hint: 'Shares held on the ex-date' },
      { label: 'Dividend per share', required: false, hint: 'In USD' },
      { label: 'Total dividend', required: true, hint: 'The actual amount received, in USD' },
      { label: 'Notes', required: false }
    ],
    sampleRow: ['AAPL', '2024-08-15', '10', '0.25', '2.50', ''],
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
        const notes = (Importer.getField(row, 'Notes') || '').toString().trim();
        Store.addDividend({ assetType: 'US_STOCK', symbol, date, qty, perShare, amount, currency: 'USD', notes });
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
  document.getElementById('inDivDate').value = Finance.todayStr();
  document.getElementById('usDivDate').value = Finance.todayStr();

  // ---- Indian add form ----
  const inQty = document.getElementById('inDivQty');
  const inPerShare = document.getElementById('inDivPerShare');
  const inAmount = document.getElementById('inDivAmount');
  function autoFillIndian() {
    const q = parseFloat(inQty.value), p = parseFloat(inPerShare.value);
    if (q && p) inAmount.value = (q * p).toFixed(2);
  }
  inQty.oninput = autoFillIndian;
  inPerShare.oninput = autoFillIndian;

  document.getElementById('addInDivBtn').onclick = () => {
    const symbol = document.getElementById('inDivSymbol').value.trim().toUpperCase();
    const date = document.getElementById('inDivDate').value;
    const qty = inQty.value !== '' ? parseFloat(inQty.value) : null;
    const perShare = inPerShare.value !== '' ? parseFloat(inPerShare.value) : null;
    const amount = parseFloat(inAmount.value);
    const account = parseInt(document.getElementById('inDivAccount').value, 10);
    const notes = document.getElementById('inDivNotes').value.trim();
    if (!symbol || !date || !amount) return toast('Fill symbol, date and total dividend', 'err');
    Store.addDividend({ assetType: 'IN_STOCK', symbol, date, qty, perShare, amount, currency: 'INR', notes, account });
    toast('Dividend logged', 'ok');
    document.getElementById('inDivSymbol').value = '';
    inQty.value = ''; inPerShare.value = ''; inAmount.value = '';
    document.getElementById('inDivNotes').value = '';
    renderDividendsPage();
  };
  document.getElementById('importIndianDivBtn').onclick = openIndianDivImportModal;

  // ---- US add form ----
  const usQty = document.getElementById('usDivQty');
  const usPerShare = document.getElementById('usDivPerShare');
  const usAmount = document.getElementById('usDivAmount');
  function autoFillUs() {
    const q = parseFloat(usQty.value), p = parseFloat(usPerShare.value);
    if (q && p) usAmount.value = (q * p).toFixed(2);
  }
  usQty.oninput = autoFillUs;
  usPerShare.oninput = autoFillUs;

  document.getElementById('addUsDivBtn').onclick = () => {
    const symbol = document.getElementById('usDivSymbol').value.trim().toUpperCase();
    const date = document.getElementById('usDivDate').value;
    const qty = usQty.value !== '' ? parseFloat(usQty.value) : null;
    const perShare = usPerShare.value !== '' ? parseFloat(usPerShare.value) : null;
    const amount = parseFloat(usAmount.value);
    const notes = document.getElementById('usDivNotes').value.trim();
    if (!symbol || !date || !amount) return toast('Fill symbol, date and total dividend', 'err');
    Store.addDividend({ assetType: 'US_STOCK', symbol, date, qty, perShare, amount, currency: 'USD', notes });
    toast('Dividend logged', 'ok');
    document.getElementById('usDivSymbol').value = '';
    usQty.value = ''; usPerShare.value = ''; usAmount.value = '';
    document.getElementById('usDivNotes').value = '';
    renderDividendsPage();
  };
  document.getElementById('importUsDivBtn').onclick = openUsDivImportModal;

  renderDividendsPage();
})();
window.addEventListener('ft-store-updated', renderDividendsPage);
window.addEventListener('ft-theme-changed', renderDividendsPage);
