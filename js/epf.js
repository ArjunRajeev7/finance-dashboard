/* ============================================================
   epf.js
   ============================================================ */

function renderEpfPage() {
  const holdings = Store.load().holdings.EPF;
  const rows = holdings.map(h => ({ h, val: Valuation.evalEPF(h) }));
  const totalCorpus = rows.reduce((s, r) => s + r.val.currentValueINR, 0);
  const totalEps = rows.reduce((s, r) => s + (r.val.epsTotal || 0), 0);
  const totalContrib = rows.reduce((s, r) => s + r.val.investedINR, 0);
  const accruedThisFY = rows.reduce((s, r) => {
    const last = r.val.yearlyBreakdown[r.val.yearlyBreakdown.length - 1];
    return s + (last ? last.interest : 0);
  }, 0);

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">EPF Corpus (all accounts)</div><div class="value">${Fmt.money(totalCorpus)}</div></div>
    <div class="stat-card"><div class="label">Total Contributed</div><div class="value">${Fmt.money(totalContrib)}</div>
      <div class="sub up">${Fmt.gainMoney(totalCorpus - totalContrib)} interest earned</div></div>
    <div class="stat-card"><div class="label">Accruing This FY</div><div class="value up">${Fmt.gainMoney(accruedThisFY)}</div>
      <div class="sub">not yet officially credited by EPFO</div></div>
    <div class="stat-card"><div class="label">EPS (Pension) Pool</div><div class="value">${Fmt.money(totalEps)}</div>
      <div class="sub">separate from EPF corpus — funds monthly pension, not a lump sum</div></div>
  `;

  const summaryFrame = document.getElementById('summaryTableFrame');
  summaryFrame.innerHTML = `
    <div class="card-head"><span class="eyebrow">Accounts — ${holdings.length}</span></div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Employer</th><th>Contributed</th><th>Current Balance</th><th>Gain</th><th>XIRR</th><th>EPS Pool</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ h, val }) => `
            <tr>
              <td><a href="#acc-${h.id}">${h.employerName}</a>${h.uan ? `<br><span class="row-name-sub">UAN ${h.uan}</span>` : ''}</td>
              <td class="num">${Fmt.money(val.investedINR)}</td>
              <td class="num">${Fmt.money(val.currentValueINR)}</td>
              <td class="num ${Fmt.gainClass(val.gainINR)}">${Fmt.gainMoney(val.gainINR)}</td>
              <td class="num ${Fmt.gainClass(val.xirr != null ? val.xirr * 100 : null)}">${val.xirr != null ? Fmt.pct(val.xirr * 100) : '—'}</td>
              <td class="num">${Fmt.money(val.epsTotal)}</td>
            </tr>
          `).join('') : `<tr><td colspan="6" class="empty-state">No PF accounts yet — add one above</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const holder = document.getElementById('accountsHolder');
  holder.innerHTML = '';
  holdings.forEach(h => holder.appendChild(buildAccountCard(h)));
}

function buildAccountCard(h) {
  const val = Valuation.evalEPF(h);
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.id = 'acc-' + h.id;
  const rec = h.recurring || {};

  wrap.innerHTML = `
    <div class="card-head">
      <span class="eyebrow">${h.employerName}</span>
      <button data-del="${h.id}" class="danger" style="padding:5px 10px;font-size:11.5px;">Delete account</button>
    </div>
    <div class="card-body">
      <div class="card-grid" style="margin-bottom:18px;">
        <div class="stat-card"><div class="label">Current Balance</div><div class="value">${Fmt.money(val.currentValueINR)}</div></div>
        <div class="stat-card"><div class="label">Employee Contributed</div><div class="value">${Fmt.money(val.employeeTotal)}</div></div>
        <div class="stat-card"><div class="label">Employer Contributed (EPF)</div><div class="value">${Fmt.money(val.employerTotal - val.epsTotal)}</div></div>
        <div class="stat-card"><div class="label">EPS Pool</div><div class="value">${Fmt.money(val.epsTotal)}</div></div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;" class="epf-grid">
        <div>
          <h4 style="margin:0 0 10px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600;">Monthly contribution</h4>
          <div class="inline-form" style="margin-bottom:8px;">
            <label style="display:flex; align-items:center; gap:6px; font-size:12.5px;"><input type="radio" name="mode-${h.id}" value="manual" ${rec.mode !== 'salary' ? 'checked' : ''} style="width:auto;" /> Manual amounts</label>
            <label style="display:flex; align-items:center; gap:6px; font-size:12.5px;"><input type="radio" name="mode-${h.id}" value="salary" ${rec.mode === 'salary' ? 'checked' : ''} style="width:auto;" /> Calculate from salary</label>
          </div>

          <div id="manualBlock-${h.id}" style="${rec.mode === 'salary' ? 'display:none;' : ''}">
            <div class="form-grid">
              <div class="form-field"><label>Employee amt (₹/mo)</label><input id="manEmp-${h.id}" type="number" step="any" value="${rec.mode !== 'salary' ? (rec.employeeAmt || '') : ''}" /></div>
              <div class="form-field"><label>Employer → EPF (₹/mo)</label><input id="manErEpf-${h.id}" type="number" step="any" value="${rec.mode !== 'salary' ? (rec.employerEpfAmt || '') : ''}" /></div>
              <div class="form-field"><label>Employer → EPS (₹/mo)</label><input id="manErEps-${h.id}" type="number" step="any" value="${rec.mode !== 'salary' ? (rec.employerEpsAmt || '') : ''}" /></div>
            </div>
          </div>

          <div id="salaryBlock-${h.id}" style="${rec.mode === 'salary' ? '' : 'display:none;'}">
            <div class="form-field" style="margin-bottom:10px;">
              <label>Basic + DA (₹/month)</label>
              <input id="salBasic-${h.id}" type="number" step="any" value="${rec.basicSalary || ''}" />
            </div>
            <div id="salBreakdown-${h.id}" class="mono" style="font-size:12px; color:var(--text-muted); margin-bottom:10px; line-height:1.7; background:var(--surface-sunken); border-radius:var(--radius-sm); padding:10px 12px;"></div>
            <p style="color:var(--text-faint); font-size:11px; margin:0 0 10px;">Standard EPFO split: employee 12% of basic; employer 12% of basic split into 8.33% (capped ₹1,250) to EPS and the remainder to EPF. Uses basic+DA, not gross salary.</p>
          </div>

          <div class="form-field" style="margin:10px 0;"><label>Effective from</label><input id="recStart-${h.id}" type="date" value="${rec.startDate || Finance.todayStr()}" /></div>
          <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:10px;">
            <input type="checkbox" id="recActive-${h.id}" style="width:auto;" ${rec.active !== false ? 'checked' : ''} /> Auto-accrue this monthly, going forward
          </label>
          <button id="saveRec-${h.id}" class="primary">Save contribution setup</button>
        </div>

        <div>
          <h4 style="margin:0 0 10px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600;">Declared interest rate by FY</h4>
          <div id="ratesTable-${h.id}" style="margin-bottom:12px;"></div>
          <div class="inline-form">
            <div class="form-field"><label>FY (e.g. 2024-25)</label><input id="rFy-${h.id}" placeholder="2024-25" /></div>
            <div class="form-field"><label>Rate % p.a.</label><input id="rRate-${h.id}" type="number" step="any" /></div>
            <div class="form-field" style="flex:0;"><button id="addRateBtn-${h.id}">+ Add</button></div>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;">
        <h4 style="margin:0 0 10px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600;">Balance projection</h4>
        <div class="form-grid" style="margin-bottom:12px;">
          <div class="form-field"><label>Assumed rate %/yr</label><input id="projRate-${h.id}" type="number" step="any" value="8.25" /></div>
          <div class="form-field"><label>Annual step-up % (raises)</label><input id="projStepUp-${h.id}" type="number" step="any" value="0" /></div>
          <div class="form-field"><label>Years forward</label><input id="projYears-${h.id}" type="number" step="1" value="20" /></div>
          <div class="form-field"><button id="projBtn-${h.id}" class="primary">Update projection</button></div>
        </div>
        <div class="chart-box" id="projChart-${h.id}"></div>
        <div id="projFinal-${h.id}" style="margin-top:10px; font-size:13.5px;"></div>
      </div>
    </div>
  `;

  wrap.querySelectorAll(`input[name="mode-${h.id}"]`).forEach(radio => {
    radio.onchange = () => {
      const isSalary = wrap.querySelector(`input[name="mode-${h.id}"]:checked`).value === 'salary';
      wrap.querySelector(`#manualBlock-${h.id}`).style.display = isSalary ? 'none' : '';
      wrap.querySelector(`#salaryBlock-${h.id}`).style.display = isSalary ? '' : 'none';
    };
  });

  const basicInput = wrap.querySelector(`#salBasic-${h.id}`);
  function updateBreakdown() {
    const basic = parseFloat(basicInput.value);
    const out = wrap.querySelector(`#salBreakdown-${h.id}`);
    if (!basic || basic <= 0) { out.innerHTML = ''; return; }
    const split = Finance.epfFromSalary(basic);
    out.innerHTML = `
      Employee (12%): <b style="color:var(--text);">${Fmt.money(split.employee)}</b>/mo ·
      Employer → EPF: <b style="color:var(--text);">${Fmt.money(split.employerEpf)}</b>/mo ·
      Employer → EPS: <b style="color:var(--text);">${Fmt.money(split.eps)}</b>/mo<br>
      Total to EPF account: <b style="color:var(--text);">${Fmt.money(split.totalToEpfAccount)}</b>/mo
    `;
  }
  basicInput.oninput = updateBreakdown;
  updateBreakdown();

  wrap.querySelector(`#saveRec-${h.id}`).onclick = () => {
    const mode = wrap.querySelector(`input[name="mode-${h.id}"]:checked`).value;
    const startDate = wrap.querySelector(`#recStart-${h.id}`).value;
    const active = wrap.querySelector(`#recActive-${h.id}`).checked;
    if (!startDate) return toast('Set an effective-from date', 'err');

    let recurring;
    if (mode === 'salary') {
      const basic = parseFloat(wrap.querySelector(`#salBasic-${h.id}`).value);
      if (!basic) return toast('Enter basic + DA', 'err');
      const split = Finance.epfFromSalary(basic);
      recurring = { active, mode: 'salary', basicSalary: basic, startDate, employeeAmt: split.employee, employerEpfAmt: split.employerEpf, employerEpsAmt: split.eps };
    } else {
      const employeeAmt = parseFloat(wrap.querySelector(`#manEmp-${h.id}`).value) || 0;
      const employerEpfAmt = parseFloat(wrap.querySelector(`#manErEpf-${h.id}`).value) || 0;
      const employerEpsAmt = parseFloat(wrap.querySelector(`#manErEps-${h.id}`).value) || 0;
      if (!employeeAmt && !employerEpfAmt && !employerEpsAmt) return toast('Enter at least one contribution amount', 'err');
      recurring = { active, mode: 'manual', startDate, employeeAmt, employerEpfAmt, employerEpsAmt };
    }
    Store.updateHolding('EPF', h.id, { recurring });
    toast('Contribution setup saved — accruing automatically from ' + Fmt.date(startDate), 'ok');
    renderEpfPage();
  };

  function renderRatesTable() {
    const holding = Store.getHolding('EPF', h.id);
    const rt = wrap.querySelector(`#ratesTable-${h.id}`);
    const list = (holding.interestRates || []).slice().sort((a, b) => a.fyLabel.localeCompare(b.fyLabel));
    rt.innerHTML = `
      <table>
        <thead><tr><th>FY</th><th>Rate</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((r) => `
          <tr><td>${r.fyLabel}</td><td class="num">${r.ratePct}%</td><td><button data-ridx="${holding.interestRates.indexOf(r)}" class="danger" style="padding:4px 8px;font-size:11.5px;">Del</button></td></tr>
        `).join('') : `<tr><td colspan="3" class="empty-state">Using default 8.25% — add declared rates for accuracy</td></tr>`}</tbody>
      </table>
    `;
    rt.querySelectorAll('button[data-ridx]').forEach(btn => {
      btn.onclick = () => {
        holding.interestRates.splice(parseInt(btn.dataset.ridx, 10), 1);
        Store.save();
        renderRatesTable();
        renderEpfPage();
      };
    });
  }
  renderRatesTable();
  wrap.querySelector(`#addRateBtn-${h.id}`).onclick = () => {
    const fyLabel = wrap.querySelector(`#rFy-${h.id}`).value.trim();
    const ratePct = parseFloat(wrap.querySelector(`#rRate-${h.id}`).value);
    if (!fyLabel || isNaN(ratePct)) return toast('Enter FY label and rate', 'err');
    const holding = Store.getHolding('EPF', h.id);
    holding.interestRates = (holding.interestRates || []).filter(r => r.fyLabel !== fyLabel);
    holding.interestRates.push({ fyLabel, ratePct });
    Store.save();
    wrap.querySelector(`#rFy-${h.id}`).value = '';
    wrap.querySelector(`#rRate-${h.id}`).value = '';
    renderRatesTable();
    toast('Rate saved', 'ok');
  };

  function runProjection() {
    const holding = Store.getHolding('EPF', h.id);
    const assumedRatePct = parseFloat(wrap.querySelector(`#projRate-${h.id}`).value) || 8.25;
    const annualStepUpPct = parseFloat(wrap.querySelector(`#projStepUp-${h.id}`).value) || 0;
    const yearsForward = parseInt(wrap.querySelector(`#projYears-${h.id}`).value, 10) || 20;
    const proj = Finance.epfProjection(holding, { assumedRatePct, annualStepUpPct, yearsForward });
    Charts.renderLineChart(wrap.querySelector(`#projChart-${h.id}`), proj.checkpoints, {
      xLabel: (x) => '+' + x + 'y', ariaLabel: 'EPF balance projection for ' + h.employerName
    });
    wrap.querySelector(`#projFinal-${h.id}`).innerHTML =
      `Projected balance in ${yearsForward} years: <b class="mono" style="font-size:17px;">${Fmt.money(proj.finalBalance)}</b>
       <span style="color:var(--text-faint);">(current: ${Fmt.money(val.currentValueINR)})</span>`;
  }
  wrap.querySelector(`#projBtn-${h.id}`).onclick = runProjection;
  if (h.recurring && (h.recurring.employeeAmt || h.recurring.employerEpfAmt)) runProjection();
  else wrap.querySelector(`#projChart-${h.id}`).innerHTML = '<div class="empty-state">Set up a monthly contribution above, then click "Update projection"</div>';

  wrap.querySelector(`button[data-del]`).onclick = () => {
    if (confirm(`Delete PF account with ${h.employerName}? This removes all its history.`)) {
      Store.deleteHolding('EPF', h.id);
      toast('PF account deleted', 'ok');
      renderEpfPage();
    }
  };

  return wrap;
}

(async () => {
  await Store.init();
  renderShell('epf.html', 'EPF');
  document.getElementById('epfOpenDate').value = Finance.todayStr();

  const addFrame = document.getElementById('addFrame');
  addFrame.querySelector('#addEpfBtn').onclick = () => {
    const employerName = addFrame.querySelector('#epfEmployer').value.trim();
    const openingDate = addFrame.querySelector('#epfOpenDate').value;
    if (!employerName || !openingDate) return toast('Enter employer and opening date', 'err');
    Store.addHolding('EPF', {
      employerName, uan: addFrame.querySelector('#epfUan').value.trim(),
      openingBalance: parseFloat(addFrame.querySelector('#epfOpening').value) || 0,
      openingDate
    });
    toast('PF account added — set up its monthly contribution below', 'ok');
    renderEpfPage();
  };

  renderEpfPage();
})();
window.addEventListener('ft-store-updated', () => { if (typeof updateSourceChip === 'function') updateSourceChip(); });
window.addEventListener('ft-theme-changed', renderEpfPage);
