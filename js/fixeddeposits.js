/* ============================================================
   fixeddeposits.js
   ============================================================ */

function renderFdPage() {
  const holdings = Store.load().holdings.FD;
  const rows = holdings.map(h => ({ h, val: Valuation.evalFD(h) }));
  const totalInvested = rows.reduce((s, r) => s + r.h.principal, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.val.currentValueINR, 0);
  const totalAccrued = totalCurrent - totalInvested;
  const totalMaturity = rows.reduce((s, r) => s + Finance.fdMaturityValue(r.h).value, 0);

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">FDs Held</div><div class="value">${holdings.length}</div></div>
    <div class="stat-card"><div class="label">Total Invested</div><div class="value">${Fmt.money(totalInvested)}</div></div>
    <div class="stat-card"><div class="label">Interest Accrued So Far</div><div class="value up">${Fmt.gainMoney(totalAccrued)}</div>
      <div class="sub">current value ${Fmt.money(totalCurrent)}</div></div>
    <div class="stat-card"><div class="label">Total at Maturity</div><div class="value">${Fmt.money(totalMaturity)}</div>
      <div class="sub">across all FDs, at their respective maturity dates</div></div>
  `;

  const tableFrame = document.getElementById('tableFrame');
  tableFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Holdings — ${holdings.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th>Bank</th><th>Principal</th><th>Rate</th><th>Tenure</th><th>Start</th><th>Maturity Date</th>
          <th>Current Value</th><th>Interest Accrued</th><th>At Maturity</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ h, val }) => {
            const maturity = Finance.fdMaturityValue(h);
            const accrued = val.currentValueINR - h.principal;
            const daysLeft = Math.max(0, Math.ceil(Finance.daysBetween(Finance.todayStr(), val.maturityDate)));
            const tenureInfo = Finance.fdTenureInfo(h);
            const tenureLabel = tenureInfo.unit === 'days' ? `${tenureInfo.value} days` : `${tenureInfo.value} mo`;
            return `
            <tr>
              <td>${h.bank}</td>
              <td class="num">${Fmt.money(h.principal)}</td>
              <td class="num">${h.rate}% ${h.compounding[0].toUpperCase()}</td>
              <td class="num">${tenureLabel}</td>
              <td class="num">${Fmt.date(h.startDate)}</td>
              <td class="num">${Fmt.date(val.maturityDate)}</td>
              <td class="num">${Fmt.money(val.currentValueINR)}</td>
              <td class="num up">${Fmt.gainMoney(accrued)}</td>
              <td class="num">${Fmt.money(maturity.value)}</td>
              <td>${val.isMatured ? '<span class="badge">Matured</span>' : `<span class="badge">${daysLeft}d left</span>`}</td>
              <td><div class="row-actions"><button data-edit-id="${h.id}" class="ghost">Edit</button><button data-id="${h.id}" class="danger">Del</button></div></td>
            </tr>`;
          }).join('') : `<tr><td colspan="11" class="empty-state">No FDs yet — add one above</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  tableFrame.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = () => {
      const h = Store.getHolding('FD', btn.dataset.id);
      if (confirm(`Delete FD with ${h.bank}?`)) {
        Store.deleteHolding('FD', btn.dataset.id);
        toast('FD deleted', 'ok');
        renderFdPage();
      }
    };
  });
  tableFrame.querySelectorAll('button[data-edit-id]').forEach(btn => {
    btn.onclick = () => openFdEditModal(btn.dataset.editId);
  });

  const timeline = document.getElementById('timelineHolder');
  if (!rows.length) {
    timeline.innerHTML = '<div class="empty-state">No FDs yet</div>';
  } else {
    const sorted = [...rows].sort((a, b) => a.val.maturityDate.localeCompare(b.val.maturityDate));
    timeline.innerHTML = sorted.map(({ h, val }) => {
      const totalSpan = Finance.daysBetween(h.startDate, val.maturityDate);
      const elapsed = Math.min(totalSpan, Math.max(0, Finance.daysBetween(h.startDate, Finance.todayStr())));
      const pct = totalSpan ? (elapsed / totalSpan) * 100 : 100;
      return `
        <div style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
            <span>${h.bank} <span class="badge">${h.rate}%</span></span>
            <span class="mono" style="color:var(--text-muted);">${Fmt.date(h.startDate)} → ${Fmt.date(val.maturityDate)}</span>
          </div>
          <div class="weight-bar-track" style="height:10px;"><div class="weight-bar-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
    }).join('');
  }
}

function openFdEditModal(id) {
  const h = Store.getHolding('FD', id);
  const tenureInfo = Finance.fdTenureInfo(h);
  openModal(`Edit FD — ${h.bank}`, `
    <div class="form-grid">
      <div class="form-field"><label>Bank / issuer</label><input id="efdBank" value="${h.bank}" /></div>
      <div class="form-field"><label>Principal (₹)</label><input id="efdPrincipal" type="number" step="any" value="${h.principal}" /></div>
      <div class="form-field"><label>Rate % p.a.</label><input id="efdRate" type="number" step="any" value="${h.rate}" /></div>
      <div class="form-field"><label>Start date</label><input id="efdStart" type="date" value="${h.startDate}" /></div>
      <div class="form-field">
        <label>Tenure</label>
        <div class="input-group">
          <input id="efdTenureValue" type="number" step="1" value="${tenureInfo.value}" />
          <select id="efdTenureUnit">
            <option value="months" ${tenureInfo.unit === 'months' ? 'selected' : ''}>Months</option>
            <option value="days" ${tenureInfo.unit === 'days' ? 'selected' : ''}>Days</option>
          </select>
        </div>
      </div>
      <div class="form-field"><label>Compounding</label>
        <select id="efdComp">
          <option value="quarterly" ${h.compounding === 'quarterly' ? 'selected' : ''}>Quarterly</option>
          <option value="monthly" ${h.compounding === 'monthly' ? 'selected' : ''}>Monthly</option>
          <option value="yearly" ${h.compounding === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
      </div>
      <div class="form-field"><button id="saveFdEditBtn" class="primary">Save changes</button></div>
    </div>
  `, (overlay) => {
    overlay.querySelector('#saveFdEditBtn').onclick = () => {
      const bank = overlay.querySelector('#efdBank').value.trim();
      const principal = parseFloat(overlay.querySelector('#efdPrincipal').value);
      const rate = parseFloat(overlay.querySelector('#efdRate').value);
      const startDate = overlay.querySelector('#efdStart').value;
      const tenureValue = parseInt(overlay.querySelector('#efdTenureValue').value, 10);
      const tenureUnit = overlay.querySelector('#efdTenureUnit').value;
      const compounding = overlay.querySelector('#efdComp').value;
      if (!bank || !principal || !rate || !startDate || !tenureValue) return toast('Fill all fields', 'err');
      Store.updateHolding('FD', id, { bank, principal, rate, startDate, tenureUnit, tenureValue, compounding });
      Store.log('info', `Edited FD — ${bank}`);
      toast('FD updated', 'ok');
      closeModal();
      renderFdPage();
    };
  });
}

(async () => {
  await Store.init();
  renderShell('fixed-deposits.html', 'Fixed Deposits');
  document.getElementById('fdStart').value = Finance.todayStr();

  const addFrame = document.getElementById('addFrame');
  addFrame.querySelector('#addFdBtn').onclick = () => {
    const bank = addFrame.querySelector('#fdBank').value.trim();
    const principal = parseFloat(addFrame.querySelector('#fdPrincipal').value);
    const rate = parseFloat(addFrame.querySelector('#fdRate').value);
    const startDate = addFrame.querySelector('#fdStart').value;
    const tenureValue = parseInt(addFrame.querySelector('#fdTenureValue').value, 10);
    const tenureUnit = addFrame.querySelector('#fdTenureUnit').value;
    const compounding = addFrame.querySelector('#fdComp').value;
    if (!bank || !principal || !rate || !startDate || !tenureValue) return toast('Fill all fields', 'err');
    Store.addHolding('FD', { bank, principal, rate, startDate, tenureUnit, tenureValue, compounding });
    toast('FD added', 'ok');
    renderFdPage();
  };

  renderFdPage();
})();
window.addEventListener('ft-store-updated', renderFdPage);
window.addEventListener('ft-theme-changed', renderFdPage);
