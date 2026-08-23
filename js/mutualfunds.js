/* ============================================================
   mutualfunds.js
   ============================================================ */

const _mfSortState = { col: null, dir: 'desc' };

function mfRowAccessor(row, key) {
  switch (key) {
    case 'name': return row.h.name;
    case 'category': return row.h.category || '';
    case 'units': return row.val.qty;
    case 'avgNav': return row.val.avgCost;
    case 'invested': return row.val.investedINR;
    case 'currentNav': return row.val.priceInfo ? row.val.priceInfo.price : null;
    case 'currentValue': return row.val.currentValueINR;
    case 'pnl': return row.val.gainINR;
    case 'pctChange': return row.val.gainPct;
    case 'xirr': return row.val.xirr;
    default: return null;
  }
}

function renderMfPage() {
  const holdings = Store.load().holdings.IN_MF;
  let rows = holdings.map(h => ({ h, val: Valuation.evalStockLike('IN_MF', h, 1) }));
  const totalCurrent = rows.reduce((s, r) => s + (r.val.currentValueINR || r.val.investedINR), 0);
  const totalInvested = rows.reduce((s, r) => s + r.val.investedINR, 0);
  const totalGain = totalCurrent - totalInvested;

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">Funds Held</div><div class="value">${holdings.length}</div></div>
    <div class="stat-card"><div class="label">Invested</div><div class="value">${Fmt.money(totalInvested)}</div></div>
    <div class="stat-card"><div class="label">Current Value</div><div class="value">${Fmt.money(totalCurrent)}</div></div>
    <div class="stat-card"><div class="label">Gain / Loss</div><div class="value ${Fmt.gainClass(totalGain)}">${Fmt.gainMoney(totalGain)}</div>
      <div class="sub ${Fmt.gainClass(totalGain)}">${Fmt.pct(totalInvested ? (totalGain / totalInvested) * 100 : 0)}</div></div>
  `;

  const allocHolder = document.getElementById('allocHolder');
  Charts.renderDonut(allocHolder, rows.map(r => ({ label: r.h.name, value: r.val.currentValueINR || 0 })), {
    r: 58, cx: 74, cy: 74, strokeW: 20, centerLine1: holdings.length + ' funds', ariaLabel: 'allocation across mutual funds'
  });
  Charts.renderLegend(document.getElementById('allocLegend'), rows.map(r => ({ label: r.h.name })));

  rows = sortRows(rows, _mfSortState, mfRowAccessor);

  const tableFrame = document.getElementById('tableFrame');
  tableFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Holdings — ${holdings.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th data-sort="name">Scheme</th><th data-sort="category">Category</th><th data-sort="units">Units</th><th data-sort="avgNav">Avg NAV</th><th data-sort="invested">Invested</th>
          <th data-sort="currentNav">Current NAV</th><th data-sort="currentValue">Current Value</th><th data-sort="pnl">P&amp;L</th><th data-sort="pctChange">% Change</th><th data-sort="xirr">XIRR</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ h, val }) => `
            <tr>
              <td>${h.name}<br><span class="row-name-sub">Code ${h.schemeCode}${h.folio ? ' · Folio ' + h.folio : ''}</span></td>
              <td>${h.category || '—'}</td>
              <td class="num">${Fmt.num(val.qty, 3)}</td>
              <td class="num">${Fmt.moneyPrecise(val.avgCost)}</td>
              <td class="num">${Fmt.money(val.investedINR)}</td>
              <td class="num">${Fmt.pulseDot(h)} ${val.priceInfo ? Fmt.moneyPrecise(val.priceInfo.price) : '—'}</td>
              <td class="num">${Fmt.money(val.currentValueINR)}</td>
              <td class="num ${Fmt.gainClass(val.gainINR)}">${Fmt.gainMoney(val.gainINR)}</td>
              <td class="num ${Fmt.gainClass(val.gainPct)}">${Fmt.pct(val.gainPct)}</td>
              <td class="num ${Fmt.gainClass(val.xirr != null ? val.xirr * 100 : null)}">${val.xirr != null ? Fmt.pct(val.xirr * 100) : '—'}</td>
              <td><div class="row-actions">
                <button data-act="txns" data-id="${h.id}">Txns</button>
                <button data-act="price" data-id="${h.id}" class="ghost">Price</button>
                <button data-act="del" data-id="${h.id}" class="danger">Del</button>
              </div></td>
            </tr>
          `).join('') : `<tr><td colspan="11" class="empty-state">No funds yet — add a scheme above</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  attachSortHandlers(tableFrame.querySelector('thead'), _mfSortState, renderMfPage);
  tableFrame.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const h = Store.getHolding('IN_MF', id);
      if (btn.dataset.act === 'txns') openTxnModal('IN_MF', h, false);
      else if (btn.dataset.act === 'price') openManualPriceModal('IN_MF', h);
      else if (btn.dataset.act === 'del') {
        if (confirm(`Delete ${h.name} and all its transactions?`)) {
          Store.deleteHolding('IN_MF', id);
          toast('Fund deleted', 'ok');
          renderMfPage();
        }
      }
    };
  });

  const catHolder = document.getElementById('categoryHolder');
  const byCat = {};
  rows.forEach(({ h, val }) => {
    const cat = h.category || 'Uncategorized';
    byCat[cat] = (byCat[cat] || 0) + (val.currentValueINR || 0);
  });
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!catEntries.length) {
    catHolder.innerHTML = '<div class="empty-state">No funds yet</div>';
  } else {
    catHolder.innerHTML = `
      <table>
        <thead><tr><th>Category</th><th>Value</th><th>Weight</th></tr></thead>
        <tbody>${catEntries.map(([cat, val]) => `
          <tr><td>${cat}</td><td class="num">${Fmt.money(val)}</td><td class="num">${Fmt.num(totalCurrent ? (val / totalCurrent) * 100 : 0, 1)}%</td></tr>
        `).join('')}</tbody>
      </table>
    `;
  }
}

function openMfImportModal() {
  Importer.openModal({
    title: 'Import mutual fund transactions',
    templateFilename: 'mutual-funds-import-template.csv',
    columns: [
      { label: 'SchemeCode', required: true, hint: 'AMFI scheme code — used to match/create the fund' },
      { label: 'SchemeName', required: true, hint: 'Full scheme name, used when creating a new fund' },
      { label: 'Category', required: false, hint: 'e.g. Large Cap, Flexi/Multi Cap' },
      { label: 'Folio', required: false },
      { label: 'Date', required: true, hint: 'YYYY-MM-DD, or an actual Excel date cell' },
      { label: 'Type', required: true, hint: 'BUY or SELL' },
      { label: 'Units', required: true },
      { label: 'NAV', required: true, hint: 'Per-unit NAV in INR, excluding fees' },
      { label: 'Fees', required: false, hint: 'Default 0' }
    ],
    sampleRow: ['120503', 'Axis Bluechip Fund - Direct Growth', 'Large Cap', '12345', '2024-01-15', 'BUY', '100', '45.20', '0'],
    onImport: async (rows) => {
      const errors = [];
      let success = 0;
      const holdings = Store.load().holdings.IN_MF;
      rows.forEach((row, i) => {
        const rowNum = i + 2;
        const schemeCode = (Importer.getField(row, 'SchemeCode', 'Scheme Code', 'Code') || '').toString().trim();
        if (!schemeCode) { errors.push(`Row ${rowNum}: missing SchemeCode`); return; }
        const date = Importer.normalizeDate(Importer.getField(row, 'Date'));
        if (!date) { errors.push(`Row ${rowNum} (${schemeCode}): unrecognized Date`); return; }
        const typeRaw = (Importer.getField(row, 'Type') || '').toString().trim().toUpperCase();
        const type = typeRaw === 'BUY' || typeRaw === 'SELL' ? typeRaw : null;
        if (!type) { errors.push(`Row ${rowNum} (${schemeCode}): Type must be BUY or SELL`); return; }
        const qty = parseFloat(Importer.getField(row, 'Units', 'Quantity'));
        if (!qty || qty <= 0) { errors.push(`Row ${rowNum} (${schemeCode}): invalid Units`); return; }
        const price = parseFloat(Importer.getField(row, 'NAV', 'Price'));
        if (!price || price <= 0) { errors.push(`Row ${rowNum} (${schemeCode}): invalid NAV`); return; }
        const fees = parseFloat(Importer.getField(row, 'Fees')) || 0;

        let holding = holdings.find(h => h.schemeCode === schemeCode);
        if (!holding) {
          const name = (Importer.getField(row, 'SchemeName', 'Scheme Name', 'Name') || schemeCode).toString().trim();
          holding = Store.addHolding('IN_MF', {
            schemeCode, name, symbol: name,
            category: (Importer.getField(row, 'Category') || '').toString().trim(),
            folio: (Importer.getField(row, 'Folio') || '').toString().trim()
          });
        }
        Store.addTxn('IN_MF', holding.id, { date, type, qty, price, fees });
        success++;
      });
      renderMfPage();
      return { success, errors };
    }
  });
}

function openManualPriceModal(assetType, h) {
  openModal(`Manual price — ${h.symbol || h.name}`, `
    <p style="color:var(--text-muted); font-size:12.5px; margin-top:0;">Use this if the live API can't find this scheme. It's used until the next successful live fetch overrides it.</p>
    <div class="form-field" style="margin-bottom:12px;">
      <label>NAV per unit</label>
      <input id="manPrice" type="number" step="0.0001" value="${h.manualPrice || ''}" />
    </div>
    <button id="saveManPrice" class="primary">Save</button>
  `, (overlay) => {
    overlay.querySelector('#saveManPrice').onclick = () => {
      const p = parseFloat(overlay.querySelector('#manPrice').value);
      if (isNaN(p)) return toast('Enter a valid number', 'err');
      Store.updateHolding(assetType, h.id, { manualPrice: p, manualPriceAt: Finance.todayStr() });
      toast('Manual NAV saved', 'ok');
      closeModal();
      renderMfPage();
    };
  });
}

function openTxnModal(assetType, h) {
  let editingId = null;

  const render = () => {
    const holding = Store.getHolding(assetType, h.id);
    const txnRows = holding.txns.map(t => `
      <tr ${editingId === t.id ? 'style="background:var(--accent-tint);"' : ''}>
        <td>${Fmt.date(t.date)}</td>
        <td>${t.type}</td>
        <td class="num">${Fmt.numExact(t.qty)}</td>
        <td class="num">${Fmt.moneyExact(t.price)}</td>
        <td class="num">${Fmt.moneyPrecise(t.fees || 0)}</td>
        <td><div class="row-actions">
          <button data-edit-tid="${t.id}" class="ghost" style="padding:4px 8px;font-size:11.5px;">Edit</button>
          <button data-tid="${t.id}" class="danger" style="padding:4px 8px;font-size:11.5px;">Del</button>
        </div></td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>`;

    const editingTxn = editingId ? holding.txns.find(t => t.id === editingId) : null;
    return `
      <div class="table-scroll" style="max-height:260px; overflow-y:auto; margin-bottom:14px;">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Units</th><th>NAV</th><th>Fees</th><th></th></tr></thead>
          <tbody>${txnRows}</tbody>
        </table>
      </div>
      <div style="${editingTxn ? 'border:1px solid var(--accent); border-radius:var(--radius); padding:10px;' : ''}">
        ${editingTxn ? `<div style="font-size:11.5px; color:var(--accent); font-weight:600; margin-bottom:8px;">Editing transaction from ${Fmt.date(editingTxn.date)} — Cancel below to add a new one instead</div>` : ''}
        <div class="form-grid">
          <div class="form-field"><label>Date</label><input id="txDate" type="date" value="${editingTxn ? editingTxn.date : Finance.todayStr()}" /></div>
          <div class="form-field"><label>Type</label><select id="txType"><option value="BUY" ${editingTxn && editingTxn.type === 'BUY' ? 'selected' : ''}>BUY (purchase/SIP)</option><option value="SELL" ${editingTxn && editingTxn.type === 'SELL' ? 'selected' : ''}>SELL (redemption)</option></select></div>
          <div class="form-field"><label>Units</label><input id="txQty" type="number" step="any" value="${editingTxn ? editingTxn.qty : ''}" /></div>
          <div class="form-field"><label>NAV (INR)</label><input id="txPrice" type="number" step="any" value="${editingTxn ? editingTxn.price : ''}" /></div>
          <div class="form-field"><label>Fees (optional)</label><input id="txFees" type="number" step="any" value="${editingTxn ? (editingTxn.fees || 0) : 0}" /></div>
          <div class="form-field" style="display:flex; gap:6px;">
            <button id="addTxnBtn" class="primary">${editingTxn ? 'Save changes' : '+ Add txn'}</button>
            ${editingTxn ? '<button id="cancelEditBtn" class="ghost">Cancel</button>' : ''}
          </div>
        </div>
      </div>
    `;
  };
  const overlay = openModal(`Transactions — ${h.name}`, render(), (overlay) => wireTxnModal(overlay, assetType, h.id, render, () => editingId, (v) => { editingId = v; }));
}

function wireTxnModal(overlay, assetType, holdingId, render, getEditingId, setEditingId) {
  overlay.querySelectorAll('button[data-tid]').forEach(btn => {
    btn.onclick = () => {
      Store.deleteTxn(assetType, holdingId, btn.dataset.tid);
      if (getEditingId() === btn.dataset.tid) setEditingId(null);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTxnModal(overlay, assetType, holdingId, render, getEditingId, setEditingId);
      renderMfPage();
    };
  });
  overlay.querySelectorAll('button[data-edit-tid]').forEach(btn => {
    btn.onclick = () => {
      setEditingId(btn.dataset.editTid);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTxnModal(overlay, assetType, holdingId, render, getEditingId, setEditingId);
    };
  });
  const cancelBtn = overlay.querySelector('#cancelEditBtn');
  if (cancelBtn) cancelBtn.onclick = () => {
    setEditingId(null);
    overlay.querySelector('.modal-body').innerHTML = render();
    wireTxnModal(overlay, assetType, holdingId, render, getEditingId, setEditingId);
  };
  const addBtn = overlay.querySelector('#addTxnBtn');
  if (addBtn) addBtn.onclick = () => {
    const date = overlay.querySelector('#txDate').value;
    const type = overlay.querySelector('#txType').value;
    const qty = parseFloat(overlay.querySelector('#txQty').value);
    const price = parseFloat(overlay.querySelector('#txPrice').value);
    const fees = parseFloat(overlay.querySelector('#txFees').value) || 0;
    if (!date || !qty || !price) return toast('Fill date, units and nav', 'err');
    const editingId = getEditingId();
    if (editingId) {
      Store.updateTxn(assetType, holdingId, editingId, { date, type, qty, price, fees });
      toast('Transaction updated', 'ok');
      setEditingId(null);
    } else {
      Store.addTxn(assetType, holdingId, { date, type, qty, price, fees });
      toast('Transaction added', 'ok');
    }
    overlay.querySelector('.modal-body').innerHTML = render();
    wireTxnModal(overlay, assetType, holdingId, render, getEditingId, setEditingId);
    renderMfPage();
  };
}

(async () => {
  await Store.init();
  renderShell('mutual-funds.html', 'Mutual Funds');

  const addFrame = document.getElementById('addFrame');
  addFrame.querySelector('#addMfBtn').onclick = () => {
    const holdings = Store.load().holdings.IN_MF;
    const code = addFrame.querySelector('#newCode').value.trim();
    const name = addFrame.querySelector('#newMfName').value.trim();
    if (!code || !name) return toast('Enter scheme code and name', 'err');
    if (holdings.some(h => h.schemeCode === code)) return toast('Already tracking this scheme code', 'err');
    Store.addHolding('IN_MF', {
      schemeCode: code, name, symbol: name,
      category: addFrame.querySelector('#newCategory').value,
      folio: addFrame.querySelector('#newFolio').value.trim()
    });
    toast('Fund added — now log your purchase transactions', 'ok');
    renderMfPage();
  };
  addFrame.querySelector('#importMfBtn').onclick = openMfImportModal;

  renderMfPage();
})();
window.addEventListener('ft-store-updated', renderMfPage);
window.addEventListener('ft-prices-updated', renderMfPage);
window.addEventListener('ft-theme-changed', renderMfPage);
