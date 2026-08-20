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
          <th>Bank</th><th>Principal</th><th>Rate</th><th>Start</th><th>Maturity Date</th>
          <th>Current Value</th><th>Interest Accrued</th><th>At Maturity</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ h, val }) => {
            const maturity = Finance.fdMaturityValue(h);
            const accrued = val.currentValueINR - h.principal;
            const daysLeft = Math.max(0, Math.ceil(Finance.daysBetween(Finance.todayStr(), val.maturityDate)));
            return `
            <tr>
              <td>${h.bank}</td>
              <td class="num">${Fmt.money(h.principal)}</td>
              <td class="num">${h.rate}% ${h.compounding[0].toUpperCase()}</td>
              <td class="num">${Fmt.date(h.startDate)}</td>
              <td class="num">${Fmt.date(val.maturityDate)}</td>
              <td class="num">${Fmt.money(val.currentValueINR)}</td>
              <td class="num up">${Fmt.gainMoney(accrued)}</td>
              <td class="num">${Fmt.money(maturity.value)}</td>
              <td>${val.isMatured ? '<span class="badge">Matured</span>' : `<span class="badge">${daysLeft}d left</span>`}</td>
              <td><div class="row-actions"><button data-id="${h.id}" class="danger">Del</button></div></td>
            </tr>`;
          }).join('') : `<tr><td colspan="10" class="empty-state">No FDs yet — add one above</td></tr>`}
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
    const tenureMonths = parseInt(addFrame.querySelector('#fdTenure').value, 10);
    const compounding = addFrame.querySelector('#fdComp').value;
    if (!bank || !principal || !rate || !startDate || !tenureMonths) return toast('Fill all fields', 'err');
    Store.addHolding('FD', { bank, principal, rate, startDate, tenureMonths, compounding });
    toast('FD added', 'ok');
    renderFdPage();
  };

  renderFdPage();
})();
window.addEventListener('ft-store-updated', renderFdPage);
window.addEventListener('ft-theme-changed', renderFdPage);
