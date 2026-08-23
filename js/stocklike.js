/* ============================================================
   stocklike.js — shared renderer for IN_STOCK and US_STOCK pages
   ============================================================ */

const TAG_PRESETS = ['IPO', "Father's A/C", "Sister's A/C", 'Own A/C'];

const _stockSortState = {
  IN_STOCK: { col: null, dir: 'desc' },
  US_STOCK: { col: null, dir: 'desc' }
};

function stockRowAccessor(row, key) {
  switch (key) {
    case 'symbol': return row.h.symbol;
    case 'qty': return row.val.qty;
    case 'avgCost': return row.val.avgCost;
    case 'invested': return row.val.investedINR;
    case 'ltp': return row.val.priceInfo ? row.val.priceInfo.price : null;
    case 'currentValue': return row.val.currentValueINR;
    case 'pnl': return row.val.gainINR;
    case 'pctChange': return row.val.gainPct;
    case 'weight': return row.weight;
    case 'xirr': return row.val.xirr;
    default: return null;
  }
}

function purchaseLotTooltipHtml(holding, currency) {
  const buys = (holding.txns || []).filter(t => t.type === 'BUY').sort((a, b) => a.date.localeCompare(b.date));
  if (!buys.length) return `<div style="color:var(--text-faint);">No purchases logged yet</div>`;
  const rows = buys.map(t => `
    <tr>
      <td>${Fmt.date(t.date)}</td>
      <td class="num">${Fmt.num(t.qty, t.qty % 1 === 0 ? 0 : 4)}</td>
      <td class="num">${Fmt.moneyPrecise(t.price, currency)}</td>
      <td class="num">${Fmt.money(t.qty * t.price, currency)}</td>
    </tr>
  `).join('');
  return `
    <div style="font-weight:600; margin-bottom:6px;">Purchase lots — ${holding.symbol}</div>
    <table style="width:100%;">
      <thead><tr><th>Date</th><th>Qty</th><th>Price</th><th>Cost</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderStockLikePage(assetType) {
  const isUS = assetType === 'US_STOCK';
  const isIN = assetType === 'IN_STOCK';
  const currency = isUS ? '$' : '₹';
  const d = Store.load();
  const holdings = d.holdings[assetType];
  const usdInr = Store.getPriceCache('fx_usdinr', 1000 * 60 * 60 * 24) || Store.getSettings().fxOverride || 83;
  const fxMult = isUS ? usdInr : 1;

  let rows = holdings.map(h => ({ h, val: Valuation.evalStockLike(assetType, h, fxMult) }));
  const totalCurrent = rows.reduce((s, r) => s + (r.val.currentValueINR || r.val.investedINR), 0);
  const totalInvested = rows.reduce((s, r) => s + r.val.investedINR, 0);
  const totalGain = totalCurrent - totalInvested;
  rows.forEach(r => { r.weight = totalCurrent ? ((r.val.currentValueINR || 0) / totalCurrent) * 100 : 0; });

  // ---- summary cards ----
  if (isUS) {
    const totalInvestedUSD = rows.reduce((s, r) => s + r.val.investedNative, 0);
    const totalCurrentUSD = rows.reduce((s, r) => s + (r.val.currentValueNative || r.val.investedNative), 0);
    const totalGainUSD = totalCurrentUSD - totalInvestedUSD;
    document.getElementById('summaryCards').innerHTML = `
      <div class="stat-card"><div class="label">Holdings</div><div class="value">${holdings.length}</div></div>
      <div class="stat-card"><div class="label">Invested</div><div class="value dual-value">${Fmt.money(totalInvested)}<span class="secondary">${Fmt.moneyPrecise(totalInvestedUSD, '$')}</span></div></div>
      <div class="stat-card"><div class="label">Current Value</div><div class="value dual-value">${Fmt.money(totalCurrent)}<span class="secondary">${Fmt.moneyPrecise(totalCurrentUSD, '$')}</span></div></div>
      <div class="stat-card"><div class="label">Gain / Loss</div><div class="value ${Fmt.gainClass(totalGain)} dual-value">${Fmt.gainMoney(totalGain)}<span class="secondary">${Fmt.gainMoney(totalGainUSD, '$')}</span></div>
        <div class="sub ${Fmt.gainClass(totalGain)}">${Fmt.pct(totalInvested ? (totalGain / totalInvested) * 100 : 0)}</div></div>
    `;
  } else {
    document.getElementById('summaryCards').innerHTML = `
      <div class="stat-card"><div class="label">Holdings</div><div class="value">${holdings.length}</div></div>
      <div class="stat-card"><div class="label">Invested</div><div class="value">${Fmt.money(totalInvested)}</div></div>
      <div class="stat-card"><div class="label">Current Value</div><div class="value">${Fmt.money(totalCurrent)}</div></div>
      <div class="stat-card"><div class="label">Gain / Loss</div><div class="value ${Fmt.gainClass(totalGain)}">${Fmt.gainMoney(totalGain)}</div>
        <div class="sub ${Fmt.gainClass(totalGain)}">${Fmt.pct(totalInvested ? (totalGain / totalInvested) * 100 : 0)}</div></div>
    `;
  }

  const allocHolder = document.getElementById('allocHolder');
  if (allocHolder) {
    Charts.renderDonut(allocHolder, rows.map(r => ({ label: r.h.symbol, value: r.val.currentValueINR || 0 })), {
      r: 58, cx: 74, cy: 74, strokeW: 20, centerLine1: holdings.length + ' held', ariaLabel: 'allocation within ' + ASSET_LABELS[assetType]
    });
    const legendHolder = document.getElementById('allocLegend');
    if (legendHolder) Charts.renderLegend(legendHolder, rows.map(r => ({ label: r.h.symbol })));
  }

  // ---- add form ----
  const addFrame = document.getElementById('addFrame');
  addFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Add ${isUS ? 'US stock / ETF' : 'NSE stock'}</span></div>
    <div class="card-body">
      <div class="inline-form">
        <div class="form-field"><label>Symbol${isUS ? '' : ' (NSE)'}</label><input id="newSym" placeholder="${isUS ? 'AAPL / VOO' : 'RELIANCE'}" /></div>
        <div class="form-field"><label>Display name (optional)</label><input id="newName" placeholder="e.g. ${isUS ? 'Apple Inc' : 'Reliance Industries'}" /></div>
        <div class="form-field" style="flex:0;"><button id="addHoldingBtn" class="primary">+ Add</button></div>
      </div>
    </div>
  `;
  addFrame.querySelector('#addHoldingBtn').onclick = () => {
    const sym = addFrame.querySelector('#newSym').value.trim().toUpperCase();
    if (!sym) return toast('Enter a symbol', 'err');
    if (holdings.some(h => h.symbol === sym)) return toast('Already tracking ' + sym, 'err');
    Store.addHolding(assetType, { symbol: sym, name: addFrame.querySelector('#newName').value.trim() || sym, exchange: isUS ? 'US' : 'NSE' });
    toast(sym + ' added — now log your buy transactions', 'ok');
    renderStockLikePage(assetType);
  };

  // ---- sort + table ----
  const sortState = _stockSortState[assetType];
  rows = sortRows(rows, sortState, stockRowAccessor);

  const tableFrame = document.getElementById('tableFrame');
  const dualCols = isUS;
  tableFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Holdings — ${holdings.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th data-sort="symbol">Symbol</th><th data-sort="qty">Qty</th><th data-sort="avgCost">Avg Cost</th><th data-sort="invested">Invested</th>
          <th data-sort="ltp">LTP</th><th data-sort="currentValue">Current Value</th><th data-sort="pnl">P&amp;L</th><th data-sort="pctChange">% Change</th>
          <th data-sort="weight">Weight</th><th data-sort="xirr">XIRR</th>${isIN ? '<th>Tags</th>' : ''}<th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ h, val, weight }) => {
            const infoKey = 'lots_' + h.id;
            registerInfoContent(infoKey, purchaseLotTooltipHtml(h, currency));
            return `
            <tr>
              <td>${h.symbol}${h.name && h.name !== h.symbol ? `<br><span class="row-name-sub">${h.name}</span>` : ''}</td>
              <td class="num">${Fmt.num(val.qty, val.qty % 1 === 0 ? 0 : 3)}<button class="info-trigger" data-info-key="${infoKey}" title="Purchase lots">i</button></td>
              <td class="num">${Fmt.moneyPrecise(val.avgCost, currency)}</td>
              <td class="num">${dualCols ? `<span class="dual-value">${Fmt.money(val.investedINR)}<span class="secondary">${Fmt.moneyPrecise(val.investedNative, '$')}</span></span>` : Fmt.money(val.investedINR)}</td>
              <td class="num">${Fmt.pulseDot(h)} ${val.priceInfo ? Fmt.moneyPrecise(val.priceInfo.price, currency) : '—'}</td>
              <td class="num">${dualCols ? `<span class="dual-value">${Fmt.money(val.currentValueINR)}<span class="secondary">${val.currentValueNative != null ? Fmt.moneyPrecise(val.currentValueNative, '$') : '—'}</span></span>` : Fmt.money(val.currentValueINR)}</td>
              <td class="num ${Fmt.gainClass(val.gainINR)}">${dualCols ? `<span class="dual-value">${Fmt.gainMoney(val.gainINR)}<span class="secondary">${val.gainNative != null ? Fmt.gainMoney(val.gainNative, '$') : '—'}</span></span>` : Fmt.gainMoney(val.gainINR)}</td>
              <td class="num ${Fmt.gainClass(val.gainPct)}">${Fmt.pct(val.gainPct)}</td>
              <td class="num">${Fmt.num(weight, 1)}%</td>
              <td class="num ${Fmt.gainClass(val.xirr != null ? val.xirr * 100 : null)}">${val.xirr != null ? Fmt.pct(val.xirr * 100) : '—'}</td>
              ${isIN ? `<td style="text-align:left; white-space:normal; max-width:160px;">${renderTagBadges(h.tags)}</td>` : ''}
              <td><div class="row-actions">
                <button data-act="txns" data-id="${h.id}">Txns</button>
                ${isIN ? `<button data-act="tags" data-id="${h.id}" class="ghost">Tags</button>` : ''}
                <button data-act="price" data-id="${h.id}" class="ghost">Price</button>
                <button data-act="del" data-id="${h.id}" class="danger">Del</button>
              </div></td>
            </tr>`;
          }).join('') : `<tr><td colspan="${isIN ? 12 : 11}" class="empty-state">No holdings yet — add a symbol above</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  attachSortHandlers(tableFrame.querySelector('thead'), sortState, () => renderStockLikePage(assetType));
  wireInfoTriggers(tableFrame);

  tableFrame.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const h = Store.getHolding(assetType, id);
      if (btn.dataset.act === 'txns') openTxnModal(assetType, h, isUS);
      else if (btn.dataset.act === 'tags') openTagsModal(assetType, h);
      else if (btn.dataset.act === 'price') openManualPriceModal(assetType, h);
      else if (btn.dataset.act === 'del') {
        if (confirm(`Delete ${h.symbol} and all its transactions?`)) {
          Store.deleteHolding(assetType, id);
          toast(h.symbol + ' deleted', 'ok');
          renderStockLikePage(assetType);
        }
      }
    };
  });
}

function openTagsModal(assetType, h) {
  const render = () => {
    const holding = Store.getHolding(assetType, h.id);
    const current = holding.tags || [];
    return `
      <div style="margin-bottom:12px;">${current.length ? current.map(t => `
        <span class="badge tag" style="margin-right:6px; margin-bottom:6px;">${t} <span class="tag-x" data-remove-tag="${t}">✕</span></span>
      `).join('') : '<span style="color:var(--text-faint); font-size:12.5px;">No tags yet</span>'}</div>
      <div style="margin-bottom:10px;">
        <label style="display:block; font-size:11.5px; color:var(--text-muted); margin-bottom:6px;">Quick add</label>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${TAG_PRESETS.filter(t => !current.includes(t)).map(t => `<button class="ghost" data-preset-tag="${t}" style="font-size:12px;">+ ${t}</button>`).join('')}
        </div>
      </div>
      <div class="tag-input-row">
        <input id="customTag" placeholder="Custom tag…" />
        <button id="addCustomTag" class="primary">Add</button>
      </div>
    `;
  };
  const overlay = openModal(`Tags — ${h.symbol}`, render(), (overlay) => wireTagsModal(overlay, assetType, h.id, render));
}

function wireTagsModal(overlay, assetType, holdingId, render) {
  overlay.querySelectorAll('[data-remove-tag]').forEach(el => {
    el.onclick = () => {
      Store.removeTag(assetType, holdingId, el.dataset.removeTag);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTagsModal(overlay, assetType, holdingId, render);
      renderStockLikePage(assetType);
    };
  });
  overlay.querySelectorAll('[data-preset-tag]').forEach(btn => {
    btn.onclick = () => {
      Store.addTag(assetType, holdingId, btn.dataset.presetTag);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTagsModal(overlay, assetType, holdingId, render);
      renderStockLikePage(assetType);
    };
  });
  const addBtn = overlay.querySelector('#addCustomTag');
  if (addBtn) addBtn.onclick = () => {
    const val = overlay.querySelector('#customTag').value.trim();
    if (!val) return;
    Store.addTag(assetType, holdingId, val);
    overlay.querySelector('.modal-body').innerHTML = render();
    wireTagsModal(overlay, assetType, holdingId, render);
    renderStockLikePage(assetType);
  };
}

function openManualPriceModal(assetType, h) {
  openModal(`Manual price — ${h.symbol}`, `
    <p style="color:var(--text-muted); font-size:12.5px; margin-top:0;">Use this if the live API can't find this symbol. It's used until the next successful live fetch overrides it.</p>
    <div class="form-field" style="margin-bottom:12px;">
      <label>Price per unit</label>
      <input id="manPrice" type="number" step="0.01" value="${h.manualPrice || ''}" />
    </div>
    <button id="saveManPrice" class="primary">Save</button>
  `, (overlay) => {
    overlay.querySelector('#saveManPrice').onclick = () => {
      const p = parseFloat(overlay.querySelector('#manPrice').value);
      if (isNaN(p)) return toast('Enter a valid number', 'err');
      Store.updateHolding(assetType, h.id, { manualPrice: p, manualPriceAt: Finance.todayStr() });
      toast('Manual price saved', 'ok');
      closeModal();
      renderStockLikePage(assetType);
    };
  });
}

function openTxnModal(assetType, h, isUS) {
  const render = () => {
    const holding = Store.getHolding(assetType, h.id);
    const txnRows = holding.txns.map(t => `
      <tr>
        <td>${Fmt.date(t.date)}</td>
        <td>${t.type}</td>
        <td class="num">${Fmt.num(t.qty, t.qty % 1 === 0 ? 0 : 4)}</td>
        <td class="num">${Fmt.moneyPrecise(t.price, isUS ? '$' : '₹')}</td>
        <td class="num">${Fmt.money(t.fees || 0, isUS ? '$' : '₹')}</td>
        <td><button data-tid="${t.id}" class="danger" style="padding:4px 8px;font-size:11.5px;">Del</button></td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>`;
    return `
      <div class="table-scroll" style="max-height:260px; overflow-y:auto; margin-bottom:14px;">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Price</th><th>Fees</th><th></th></tr></thead>
          <tbody>${txnRows}</tbody>
        </table>
      </div>
      <div class="form-grid">
        <div class="form-field"><label>Date</label><input id="txDate" type="date" value="${Finance.todayStr()}" /></div>
        <div class="form-field"><label>Type</label><select id="txType"><option value="BUY">BUY</option><option value="SELL">SELL</option></select></div>
        <div class="form-field"><label>Qty</label><input id="txQty" type="number" step="any" /></div>
        <div class="form-field"><label>Price (${isUS ? 'USD' : 'INR'})</label><input id="txPrice" type="number" step="any" /></div>
        <div class="form-field"><label>Fees (optional)</label><input id="txFees" type="number" step="any" value="0" /></div>
        <div class="form-field"><button id="addTxnBtn" class="primary">+ Add txn</button></div>
      </div>
    `;
  };
  const overlay = openModal(`Transactions — ${h.symbol}`, render(), (overlay) => wireTxnModal(overlay, assetType, h.id, render));
}

function wireTxnModal(overlay, assetType, holdingId, render) {
  overlay.querySelectorAll('button[data-tid]').forEach(btn => {
    btn.onclick = () => {
      Store.deleteTxn(assetType, holdingId, btn.dataset.tid);
      overlay.querySelector('.modal-body').innerHTML = render();
      wireTxnModal(overlay, assetType, holdingId, render);
      renderStockLikePage(assetType);
    };
  });
  const addBtn = overlay.querySelector('#addTxnBtn');
  if (addBtn) addBtn.onclick = () => {
    const date = overlay.querySelector('#txDate').value;
    const type = overlay.querySelector('#txType').value;
    const qty = parseFloat(overlay.querySelector('#txQty').value);
    const price = parseFloat(overlay.querySelector('#txPrice').value);
    const fees = parseFloat(overlay.querySelector('#txFees').value) || 0;
    if (!date || !qty || !price) return toast('Fill date, qty and price', 'err');
    Store.addTxn(assetType, holdingId, { date, type, qty, price, fees });
    toast('Transaction added', 'ok');
    overlay.querySelector('.modal-body').innerHTML = render();
    wireTxnModal(overlay, assetType, holdingId, render);
    renderStockLikePage(assetType);
  };
}

window.renderStockLikePage = renderStockLikePage;
