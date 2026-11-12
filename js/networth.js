/* ============================================================
   networth.js — net worth over time, milestone, dividend journey
   ============================================================ */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLASS_LABELS = { IN_STOCK: 'Indian Stocks', IN_MF: 'Mutual Funds', US_STOCK: 'US Stocks', FD: 'Fixed Deposits', EPF: 'EPF' };
const GOAL_PRESETS = [['10L', '₹10 lakh'], ['25L', '₹25 lakh'], ['50L', '₹50 lakh'], ['1cr', '₹1 crore'], ['2cr', '₹2 crore'], ['5cr', '₹5 crore'], ['10cr', '₹10 crore']];

const _snapSort = { col: 'month', dir: 'desc' };
const _snapSelection = new Set();

function monthLabel(key) { const [y, m] = key.split('-'); return MONTH_NAMES[+m - 1] + ' ' + y; }
function monthLabelShort(key) { const [y, m] = key.split('-'); return MONTH_NAMES[+m - 1] + " '" + y.slice(2); }
function lastDayOfMonth(key) { const [y, m] = key.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function humanMonths(n) { return n >= 12 ? `${Math.floor(n / 12)} yr${Math.floor(n / 12) > 1 ? 's' : ''}${n % 12 ? ' ' + (n % 12) + ' mo' : ''}` : `${n} month${n === 1 ? '' : 's'}`; }

function snapRowAccessor(row, key) {
  switch (key) {
    case 'month': return row.s.month;
    case 'date': return row.s.date;
    case 'total': return row.s.total;
    case 'change': return row.delta;
    default: return (row.s.byClass || {})[key];
  }
}

function renderNetWorthPage() {
  const live = Snapshots.live();
  const snaps = Store.getSnapshots();
  renderSummary(live, snaps);
  renderGoal(live, snaps);
  renderTimeline(snaps);
  renderSnapshotAdd(live);
  renderSnapshotTable(snaps);
  renderDividendJourney(live.usdInr);
}

// ---------------- summary cards ----------------
function changeCard(label, cur, base, subIfMissing, subWhenPresent) {
  if (base == null) return `<div class="stat-card"><div class="label">${label}</div><div class="value">—</div><div class="sub">${subIfMissing}</div></div>`;
  const delta = cur - base.total, pct = Finance.yoyPct(base.total, cur);
  return `<div class="stat-card"><div class="label">${label}</div><div class="value ${Fmt.gainClass(delta)}">${Fmt.gainMoney(delta)}</div>
    <div class="sub ${Fmt.gainClass(delta)}">${pct != null ? Fmt.pct(pct) : '—'} · ${subWhenPresent(base)}</div></div>`;
}

function renderSummary(live, snaps) {
  const today = Finance.todayStr(), curMonth = today.slice(0, 7), curYear = +today.slice(0, 4);
  const prevMonth = [...snaps].reverse().find(s => s.month < curMonth) || null;
  const lastYearEnd = [...snaps].reverse().find(s => s.month <= (curYear - 1) + '-12') || null;
  const first = snaps[0] || null;
  const pace = Finance.avgMonthlyGrowth(snaps, 6);
  const sinceFirst = first && first.month < curMonth ? first : null;

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card"><div class="label">Net worth today</div><div class="value">${Fmt.money(live.total)}</div>
      <div class="sub">same as the Dashboard's Current Value</div></div>
    ${changeCard('This month so far', live.total, prevMonth, 'no earlier month yet', b => 'vs end of ' + monthLabel(b.month))}
    ${changeCard('This year so far', live.total, lastYearEnd, 'needs a snapshot from last year', b => 'vs end of ' + monthLabel(b.month))}
    ${changeCard('Since you started tracking', live.total, sinceFirst, 'tracking began this month', b => 'since ' + monthLabel(b.month))}
    <div class="stat-card"><div class="label">Average monthly growth</div>
      <div class="value ${pace ? Fmt.gainClass(pace.perMonth) : ''}">${pace ? Fmt.gainMoney(pace.perMonth) : '—'}</div>
      <div class="sub">${pace ? 'over the last ' + pace.months + ' month' + (pace.months === 1 ? '' : 's') : 'needs 2+ months of snapshots'}</div></div>
  `;
}

// ---------------- milestone ----------------
function renderGoal(live, snaps) {
  const goal = Store.getNetWorthGoal();
  const frame = document.getElementById('goalFrame');
  const target = goal.target;
  let body = '';

  if (target) {
    const pct = (live.total / target) * 100;
    const hit = live.total >= target;
    const fill = live.total > 0 ? Math.max(0.8, Math.min(100, pct)) : 0;
    const pace = Finance.avgMonthlyGrowth(snaps, 6);
    let eta;
    if (hit) eta = 'Milestone reached — set your next one below.';
    else if (pace && pace.perMonth > 0) {
      const m = Finance.etaMonths(live.total, target, pace.perMonth);
      eta = `At your recent average of ${Fmt.gainMoney(pace.perMonth)} a month (last ${pace.months} month${pace.months === 1 ? '' : 's'}), roughly <b>${humanMonths(m)}</b> to go. This is only an estimate — markets and the money you add will change it.`;
    } else if (pace) eta = `Your net worth hasn't been rising over the last ${pace.months} month${pace.months === 1 ? '' : 's'}, so there's no estimate yet.`;
    else eta = 'Once you have a couple of month-end snapshots, an estimate of the time remaining appears here.';

    body += `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
        <div>
          <div class="label" style="color:var(--text-muted); font-size:12px;">${goal.label ? goal.label : 'Net worth milestone'}</div>
          <div style="font-family:var(--font-mono); font-size:26px; font-weight:600; margin-top:4px;">${Fmt.money(live.total)} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">of ${Fmt.money(target)}</span></div>
        </div>
        <div style="font-family:var(--font-mono); font-size:26px; font-weight:600; color:${hit ? 'var(--gain)' : 'var(--accent)'};">${Fmt.num(pct, 1)}%</div>
      </div>
      <div class="goal-track ${hit ? 'goal-hit' : ''}" id="goalTrack" role="progressbar" aria-valuenow="${Math.round(Math.min(100, pct))}" aria-valuemin="0" aria-valuemax="100">
        <div class="weight-bar-fill" style="width:${fill}%;"></div>
        <div class="goal-ticks"><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>
      </div>
      <div class="goal-meta"><span>₹0</span><span>${hit ? 'reached' : Fmt.money(target - live.total) + ' to go'}</span><span>${Fmt.money(target)}</span></div>
      <p style="margin:12px 0 4px; font-size:12.5px; color:var(--text-muted); line-height:1.6;">${eta}</p>`;
  } else {
    body += `<p style="margin:0 0 4px; color:var(--text-muted); font-size:13px; line-height:1.6;">Set a net worth figure you're aiming for and this bar fills as your net worth grows. Type an amount such as <b>50L</b>, <b>1cr</b> or <b>2.5cr</b>, or pick one below.</p>`;
  }

  body += `
    <div class="goal-form" style="margin-top:14px;">
      <div class="form-field" style="min-width:160px;"><label>Target amount</label><input id="goalTarget" placeholder="e.g. 1cr or 10000000" value="${target ? Math.round(target) : ''}" /></div>
      <div class="form-field" style="min-width:180px;"><label>Name (optional)</label><input id="goalLabel" placeholder="e.g. First crore" value="${(goal.label || '').replace(/"/g, '&quot;')}" /></div>
      <div class="form-field" style="flex:0; display:flex; gap:6px;"><button id="goalSave" class="primary">${target ? 'Update' : 'Set milestone'}</button>${target ? '<button id="goalClear" class="ghost">Clear</button>' : ''}</div>
    </div>
    <div class="goal-chips">${GOAL_PRESETS.map(([v, l]) => `<button class="ghost" data-goal-preset="${v}">${l}</button>`).join('')}</div>`;

  frame.innerHTML = `<div class="card-head"><span class="eyebrow">Milestone</span></div><div class="card-body">${body}</div>`;

  frame.querySelectorAll('[data-goal-preset]').forEach(b => { b.onclick = () => { frame.querySelector('#goalTarget').value = b.dataset.goalPreset; frame.querySelector('#goalTarget').focus(); }; });
  frame.querySelector('#goalSave').onclick = () => {
    const amount = Finance.parseInrAmount(frame.querySelector('#goalTarget').value);
    if (!amount || amount <= 0) return toast("Couldn't read that amount — try 50L, 1cr or 10000000", 'err');
    Store.setNetWorthGoal({ target: amount, label: frame.querySelector('#goalLabel').value });
    toast('Milestone saved', 'ok');
    renderNetWorthPage();
  };
  const clear = frame.querySelector('#goalClear');
  if (clear) clear.onclick = () => { Store.setNetWorthGoal({ target: null, label: '' }); toast('Milestone cleared', 'ok'); renderNetWorthPage(); };
}

// ---------------- timeline ----------------
function renderTimeline(snaps) {
  const frame = document.getElementById('timelineFrame');
  frame.innerHTML = `<div class="card-head"><span class="eyebrow">Net worth over time</span></div><div class="card-body"><div id="timelineChart"></div><p id="timelineNote" style="margin:10px 0 0; font-size:11.5px; color:var(--text-faint); line-height:1.6;"></p></div>`;
  const note = frame.querySelector('#timelineNote');
  if (!snaps.length) {
    frame.querySelector('#timelineChart').innerHTML = '<div class="empty-state">No snapshots yet — once you have holdings, the first one is saved automatically the next time you open any page.</div>';
    note.textContent = '';
    return;
  }
  Charts.renderStacked(frame.querySelector('#timelineChart'), {
    labels: snaps.map(s => monthLabelShort(s.month)),
    series: Snapshots.CLASSES.map((t, i) => ({ name: CLASS_LABELS[t], colorIndex: i, values: snaps.map(s => (s.byClass || {})[t] || 0) })),
    ariaLabel: 'Net worth by asset class, month by month'
  });
  const last = snaps[snaps.length - 1];
  note.textContent = (snaps.length === 1 ? 'Your timeline starts this month — each month adds another column. ' : '') +
    `Each column is the value as of the last time that month's snapshot was updated (latest: ${Fmt.date(last.date)}). Open the app near month end, and refresh prices first, for the most accurate figure — or add or correct a month below.`;
}

// ---------------- add / take snapshot ----------------
function renderSnapshotAdd(live) {
  const frame = document.getElementById('snapAddFrame');
  const curMonth = Finance.todayStr().slice(0, 7);
  frame.innerHTML = collapsibleCardHead('Take a snapshot, or add / correct a month') + `
    <div class="card-body collapsible-body">
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px;">
        <button id="snapNow" class="primary">Take snapshot now</button>
        <span style="font-size:12px; color:var(--text-muted);">Saves today's values as ${monthLabel(curMonth)}'s snapshot (replacing what's there). This also happens automatically, once a day.</span>
      </div>
      <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:8px;">Add or correct a past month (amounts in ₹)</div>
      <div class="form-grid">
        <div class="form-field"><label>Month</label><input id="snapMonth" type="month" value="${curMonth}" max="${curMonth}" /></div>
        ${Snapshots.CLASSES.map(t => `<div class="form-field"><label>${CLASS_LABELS[t]}</label><input id="snap_${t}" type="number" step="any" placeholder="0" /></div>`).join('')}
        <div class="form-field" style="display:flex; gap:6px;"><button id="snapSave" class="primary">Save month</button><button id="snapFill" class="ghost" title="Fill the boxes with today's values">Use today's values</button></div>
      </div>
      <p style="margin:10px 0 0; font-size:11.5px; color:var(--text-faint);">A month you enter by hand is never overwritten by the automatic snapshots.</p>
    </div>`;
  wireCollapsible(frame, 'networth-add', false);

  frame.querySelector('#snapNow').onclick = () => {
    const r = Snapshots.autoTake({ ever: true, manualOverride: true });
    toast(r === 'none' ? 'Nothing to snapshot yet — add some holdings first' : `${monthLabel(curMonth)} snapshot saved`, r === 'none' ? 'err' : 'ok');
    renderNetWorthPage();
  };
  frame.querySelector('#snapFill').onclick = () => { Snapshots.CLASSES.forEach(t => { frame.querySelector('#snap_' + t).value = live.byClass[t]; }); };
  frame.querySelector('#snapSave').onclick = () => {
    const month = frame.querySelector('#snapMonth').value;
    if (!/^\d{4}-\d{2}$/.test(month)) return toast('Choose a month', 'err');
    if (month > curMonth) return toast("That month hasn't happened yet", 'err');
    const byClass = {};
    Snapshots.CLASSES.forEach(t => { byClass[t] = Math.max(0, parseFloat(frame.querySelector('#snap_' + t).value) || 0); });
    const total = Snapshots.CLASSES.reduce((s, t) => s + byClass[t], 0);
    if (!(total > 0)) return toast('Enter at least one amount', 'err');
    if (Store.getSnapshots().some(s => s.month === month) && !confirm(`${monthLabel(month)} already has a snapshot. Replace it with these figures?`)) return;
    const end = lastDayOfMonth(month), today = Finance.todayStr();
    Store.upsertSnapshot({ month, date: end < today ? end : today, total, invested: null, byClass, usdInr: live.usdInr, source: 'manual' }, { log: true });
    toast(`${monthLabel(month)} saved`, 'ok');
    renderNetWorthPage();
  };
}

function openSnapshotEdit(month) {
  const s = Store.getSnapshots().find(x => x.month === month);
  if (!s) return;
  openModal(`Edit snapshot — ${monthLabel(month)}`, `
    <p style="color:var(--text-muted); font-size:12.5px; margin-top:0;">Amounts in ₹. Saving marks this month as entered by hand, so automatic snapshots won't change it.</p>
    <div class="form-grid">
      ${Snapshots.CLASSES.map(t => `<div class="form-field"><label>${CLASS_LABELS[t]}</label><input id="edit_${t}" type="number" step="any" value="${(s.byClass || {})[t] || 0}" /></div>`).join('')}
      <div class="form-field"><button id="editSnapSave" class="primary">Save changes</button></div>
    </div>`, (overlay) => {
    overlay.querySelector('#editSnapSave').onclick = () => {
      const byClass = {};
      Snapshots.CLASSES.forEach(t => { byClass[t] = Math.max(0, parseFloat(overlay.querySelector('#edit_' + t).value) || 0); });
      const total = Snapshots.CLASSES.reduce((sum, t) => sum + byClass[t], 0);
      if (!(total > 0)) return toast('Enter at least one amount', 'err');
      Store.upsertSnapshot(Object.assign({}, s, { byClass, total, source: 'manual' }), { log: true });
      toast('Snapshot updated', 'ok');
      closeModal();
      renderNetWorthPage();
    };
  });
}

// ---------------- snapshot table ----------------
function renderSnapshotTable(snaps) {
  const frame = document.getElementById('snapTableFrame');
  const rows = snaps.map((s, i) => {
    const prev = snaps[i - 1];
    return { s, delta: prev ? s.total - prev.total : null, pct: prev ? Finance.yoyPct(prev.total, s.total) : null };
  });
  const sorted = sortRows(rows, _snapSort, snapRowAccessor);
  const classCols = Snapshots.CLASSES.map(t => `<th data-sort="${t}">${CLASS_LABELS[t]}</th>`).join('');

  frame.innerHTML = collapsibleCardHead(`Monthly snapshots — ${snaps.length}`, selectionToolbarHtml(_snapSelection.size, {})) + `
    <div class="table-scroll collapsible-body">
      <table>
        <thead><tr>
          <th class="select-col"><input type="checkbox" class="select-checkbox select-all" title="Select all" /></th>
          <th data-sort="month">Month</th><th data-sort="date">As of</th><th data-sort="total">Net worth</th><th data-sort="change">Change</th>${classCols}
        </tr></thead>
        <tbody>
          ${sorted.length ? sorted.map(({ s, delta, pct }) => `
            <tr>
              <td class="select-col"><input type="checkbox" class="select-checkbox row-select" data-id="${s.month}" /></td>
              <td style="font-weight:600;">${monthLabel(s.month)}</td>
              <td class="num">${Fmt.date(s.date)}${s.source === 'manual' ? ' <span class="badge" title="Entered by hand — never overwritten automatically">manual</span>' : ''}</td>
              <td class="num" style="font-weight:600;">${Fmt.money(s.total)}</td>
              <td class="num ${Fmt.gainClass(delta)}">${delta != null ? `<span class="dual-value">${Fmt.gainMoney(delta)}<span class="secondary" style="color:inherit; opacity:.85;">${pct != null ? Fmt.pct(pct) : ''}</span></span>` : '<span style="color:var(--text-faint);">—</span>'}</td>
              ${Snapshots.CLASSES.map(t => `<td class="num">${(s.byClass || {})[t] ? Fmt.money(s.byClass[t]) : '<span style="color:var(--text-faint);">—</span>'}</td>`).join('')}
            </tr>`).join('') : `<tr><td colspan="${5 + Snapshots.CLASSES.length}" class="empty-state">No snapshots yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
  wireCollapsible(frame, 'networth-table', true);
  attachSortHandlers(frame.querySelector('thead'), _snapSort, renderNetWorthPage);
  setupBulkSelection(frame, {
    selection: _snapSelection,
    ids: snaps.map(s => s.month),
    toolbarOpts: {},
    onAction: (action, ids) => {
      if (action === 'edit' && ids.length === 1) openSnapshotEdit(ids[0]);
      else if (action === 'delete' && ids.length) {
        const curMonth = Finance.todayStr().slice(0, 7);
        const note = ids.includes(curMonth) ? `\n\n(${monthLabel(curMonth)}'s snapshot is recreated automatically the next time you open the app.)` : '';
        if (confirm(`Delete ${ids.length} snapshot(s): ${ids.map(monthLabel).join(', ')}?${note}`)) {
          Store.deleteSnapshots(ids);
          _snapSelection.clear();
          toast(`${ids.length} snapshot(s) deleted`, 'ok');
          renderNetWorthPage();
        }
      }
    }
  });
}

// ---------------- dividend growth journey ----------------
function renderDividendJourney(usdInr) {
  const frame = document.getElementById('divJourneyFrame');
  const years = Finance.dividendsByYear(Store.getDividends(), usdInr);
  if (!years.length) {
    frame.innerHTML = `<div class="card-head"><span class="eyebrow">Dividend growth</span></div><div class="card-body"><div class="empty-state">No dividends logged yet — add them on the <a href="dividends.html">Dividends page</a> and your year-by-year growth shows up here.</div></div>`;
    return;
  }
  const curYear = +Finance.todayStr().slice(0, 4);
  const complete = years.filter(y => y.year < curYear);
  const thisYear = years.find(y => y.year === curYear);
  const lastFull = complete[complete.length - 1] || null;
  const beforeLast = complete.length > 1 ? complete[complete.length - 2] : null;
  const firstPos = complete.find(y => y.total > 0);
  const cagr = (firstPos && lastFull && lastFull.year > firstPos.year) ? Finance.cagr(firstPos.total, lastFull.total, lastFull.year - firstPos.year) : null;
  const total = years.reduce((s, y) => s + y.total, 0);
  const max = Math.max(...years.map(y => y.total), 1);
  let cum = 0;

  const rowsHtml = years.map((y, i) => {
    cum += y.total;
    const prev = years[i - 1];
    const yoy = prev ? Finance.yoyPct(prev.total, y.total) : null;
    const yoyHtml = y.year === curYear ? '<span style="color:var(--text-faint);" title="This year isn\'t finished yet">so far</span>'
      : yoy == null ? '<span style="color:var(--text-faint);">—</span>' : `<span class="${Fmt.gainClass(yoy)}">${Fmt.pct(yoy)}</span>`;
    return `<div class="journey-row">
      <span class="yr">${y.year}</span>
      <div class="goal-track" style="height:10px;"><div class="weight-bar-fill" style="width:${y.total > 0 ? Math.max(1.5, (y.total / max) * 100) : 0}%;"></div></div>
      <span class="amt">${Fmt.money(y.total)}<br><span style="font-size:10.5px; color:var(--text-faint);">total so far ${Fmt.money(cum)}</span></span>
      <span class="yoy">${yoyHtml}</span>
    </div>`;
  }).join('');

  frame.innerHTML = `<div class="card-head"><span class="eyebrow">Dividend growth — year after year</span></div>
    <div class="card-body">
      <div class="card-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div class="label">Received, all years</div><div class="value up">${Fmt.money(total)}</div><div class="sub">across ${years.length} year${years.length === 1 ? '' : 's'}</div></div>
        <div class="stat-card"><div class="label">This year so far (${curYear})</div><div class="value">${Fmt.money(thisYear ? thisYear.total : 0)}</div><div class="sub">${lastFull ? 'last full year: ' + Fmt.money(lastFull.total) : 'no full year yet'}</div></div>
        <div class="stat-card"><div class="label">${lastFull ? 'Last full year (' + lastFull.year + ')' : 'Last full year'}</div>
          <div class="value ${beforeLast ? Fmt.gainClass(Finance.yoyPct(beforeLast.total, lastFull.total)) : ''}">${lastFull ? (beforeLast && Finance.yoyPct(beforeLast.total, lastFull.total) != null ? Fmt.pct(Finance.yoyPct(beforeLast.total, lastFull.total)) : Fmt.money(lastFull.total)) : '—'}</div>
          <div class="sub">${beforeLast ? 'growth vs ' + beforeLast.year : 'needs two full years'}</div></div>
        <div class="stat-card"><div class="label">Average yearly growth</div><div class="value ${cagr != null ? Fmt.gainClass(cagr) : ''}">${cagr != null ? Fmt.pct(cagr) : '—'}</div>
          <div class="sub">${cagr != null ? firstPos.year + ' to ' + lastFull.year + ' (compound)' : 'needs two full years'}</div></div>
      </div>
      <div id="divJourneyChart"></div>
      <div style="margin-top:16px;">${rowsHtml}</div>
      <p style="margin:12px 0 0; font-size:11.5px; color:var(--text-faint); line-height:1.6;">US dividends are counted after tax withheld and converted at today's USD/INR (${Number(usdInr).toFixed(2)}), not the rate on the payment date.</p>
    </div>`;
  Charts.renderStacked(frame.querySelector('#divJourneyChart'), {
    labels: years.map(y => y.year === curYear ? y.year + ' (so far)' : String(y.year)),
    series: [
      { name: 'Indian stocks', colorIndex: 0, values: years.map(y => y.indian) },
      { name: 'US stocks', colorIndex: 2, values: years.map(y => y.us) }
    ],
    height: 220, ariaLabel: 'Dividends received per year'
  });
}

(async () => {
  await Store.init();
  renderShell('networth.html', 'Net Worth');
  renderNetWorthPage();
})();
window.addEventListener('ft-store-updated', () => { if (document.getElementById('goalFrame')) renderNetWorthPage(); });
window.addEventListener('ft-prices-updated', () => { if (document.getElementById('goalFrame')) renderNetWorthPage(); });
window.addEventListener('ft-theme-changed', () => { if (document.getElementById('goalFrame')) renderNetWorthPage(); });
