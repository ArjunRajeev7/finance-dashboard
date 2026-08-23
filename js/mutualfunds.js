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
  const render = () => {
    const holding = Store.getHolding(assetType, h.id);
    const txnRows = holding.txns.map(t => `
      <tr>
        <td>${Fmt.date(t.date)}</td>
        <td>${t.type}</td>
        <td class="num">${Fmt.num(t.qty, 3)}</td>
        <td class="num">${Fmt.moneyPrecise(t.price)}</td>
        <td class="num">${Fmt.money(t.fees || 0)}</td>
        <td><button data-tid="${t.id}" class="danger" style="padding:4px 8px;font-size:11.5px;">Del</button></td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>`;
    return `
      <div class="table-scroll" style="max-height:260px; overflow-y:auto; margin-bottom:14px;">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Units</th><th>NAV</th><th>Fees</th><th></th></tr></thead>
          <tbody>${txnRows}</tbody>
        </table>
      </div>
      <div class="form-grid">
        <div class="form-field"><label>Date</label><input id="txDate" type="date" value="${Finance.todayStr()}" /></div>
        <div class="form-field"><label>Type</label><select id="txType"><option value="BUY">BUY (purchase/SIP)</option><option value="SELL">SELL (redemption)</option></select></div>
        <div class="form-field"><label>Units</label><input id="txQty" type="number" step="any" /></div>
        <div class="form-field"><label>NAV (INR)</label><input id="txPrice" type="number" step="any" /></div>
        <div class="form-field"><label>Fees (optional)</label><input id="txFees" type="number" step="any" value="0" /></div>
        <div class="form-field"><button id="addTxnBtn" class="primary">+ Add txn</button></div>
      </div>
    `;
  };
  const overlay = openModal(`Transactions — ${h.name}`, render(), (overlay) => wireTxnModal(overlay, assetType, h.id, render));
}

function wireTxnModal(overlay, assetType, holdingId, render) {
  overlay.querySelectorAll('button[data-tid]').forEach(btn => {
    btn.onclick = () => {
      Store.deleteTxn(assetType, holdingId, btn.dataset.tid);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTxnModal(overlay, assetType, holdingId, render);
      renderMfPage();
    };
  });
  const addBtn = overlay.querySelector('#addTxnBtn');
  if (addBtn) addBtn.onclick = () => {
    const date = overlay.querySelector('#txDate').value;
    const type = overlay.querySelector('#txType').value;
    const qty = parseFloat(overlay.querySelector('#txQty').value);
    const price = parseFloat(overlay.querySelector('#txPrice').value);
    const fees = parseFloat(overlay.querySelector('#txFees').value) || 0;
    if (!date || !qty || !price) return toast('Fill date, units and nav', 'err');
    Store.addTxn(assetType, holdingId, { date, type, qty, price, fees });
    toast('Transaction added', 'ok');
    overlay.querySelector('.modal-body').innerHTML = render();
    wireTxnModal(overlay, assetType, holdingId, render);
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

  renderMfPage();
})();
window.addEventListener('ft-store-updated', renderMfPage);
window.addEventListener('ft-prices-updated', renderMfPage);
window.addEventListener('ft-theme-changed', renderMfPage);
