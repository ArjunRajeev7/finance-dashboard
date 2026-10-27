/* ============================================================
   app.js — shared UI chrome
   ============================================================ */

// Single source of truth for the version shown in every page's footer and
// referenced in README/CHANGELOG. Bump this alongside a new CHANGELOG entry.
const APP_VERSION = 'v1.12.0';
window.APP_VERSION = APP_VERSION;

const Fmt = {
  money(n, currency) {
    if (n == null || isNaN(n)) return '—';
    currency = currency || '₹';
    return (n < 0 ? '-' : '') + currency + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },
  moneyPrecise(n, currency) {
    if (n == null || isNaN(n)) return '—';
    currency = currency || '₹';
    return (n < 0 ? '-' : '') + currency + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  // full precision, no rounding — used in the purchase-lot tooltip where
  // "exact" matters more than tidy alignment
  moneyExact(n, currency) {
    if (n == null || isNaN(n)) return '—';
    currency = currency || '₹';
    return (n < 0 ? '-' : '') + currency + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 10 });
  },
  numExact(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { maximumFractionDigits: 10 });
  },
  gainMoney(n, currency) {
    if (n == null || isNaN(n)) return '—';
    currency = currency || '₹';
    const sign = n >= 0 ? '+' : '-';
    return sign + currency + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },
  moneyCompact(n, currency) {
    if (n == null || isNaN(n)) return '—';
    currency = currency || '₹';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1e7) return sign + currency + (abs / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return sign + currency + (abs / 1e5).toFixed(2) + 'L';
    if (abs >= 1e3) return sign + currency + (abs / 1e3).toFixed(1) + 'k';
    return sign + currency + Math.round(abs);
  },
  pct(n) {
    if (n == null || isNaN(n)) return '<span class="mono">—</span>';
    const glyph = n >= 0 ? '▲' : '▼';
    return `<span class="mono">${glyph} ${Math.abs(n).toFixed(2)}%</span>`;
  },
  num(n, dp) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { maximumFractionDigits: dp != null ? dp : 2 });
  },
  date(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  gainClass(n) {
    if (n == null) return '';
    return n >= 0 ? 'up' : 'down';
  },
  pulseDot(h) {
    if (h.manualPrice != null && !h.lastPriceAt) return `<span class="pulse-dot manual" title="Manual price"></span>`;
    if (!h.lastPriceAt) return `<span class="pulse-dot manual" title="No price yet"></span>`;
    const age = Date.now() - new Date(h.lastPriceAt).getTime();
    if (age < 15 * 60 * 1000) return `<span class="pulse-dot fresh" title="Live — refreshed recently"></span>`;
    return `<span class="pulse-dot stale" title="Price may be stale — refresh"></span>`;
  }
};
window.Fmt = Fmt;

const NAV_ITEMS = [
  { href: 'index.html', label: 'Dashboard', icon: 'dashboard' },
  { href: 'stocks-ind.html', label: 'Indian Stocks', icon: 'stocksIn' },
  { href: 'stocks-us.html', label: 'US Stocks', icon: 'stocksUs' },
  { href: 'mutual-funds.html', label: 'Mutual Funds', icon: 'mutualFunds' },
  { href: 'fixed-deposits.html', label: 'Fixed Deposits', icon: 'fd' },
  { href: 'epf.html', label: 'EPF', icon: 'epf' },
  { href: 'dividends.html', label: 'Dividends', icon: 'coin' }
];

function renderShell(activeHref, pageTitle) {
  const sidebar = document.getElementById('sidebar');
  const header = document.getElementById('pageHeader');
  const bottomNav = document.getElementById('bottomNav');
  const scrim = document.getElementById('sidebarScrim');
  const appShell = document.querySelector('.app-shell');

  if (appShell && localStorage.getItem('ft_sidebar_collapsed') === 'true' && window.innerWidth > 860) {
    appShell.classList.add('collapsed');
  }

  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-brand">${Icons.brand}<span>Finance Tracker</span></div>
      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(t => `<a href="${t.href}" class="${t.href === activeHref ? 'active' : ''}" title="${t.label}">${Icons[t.icon]}<span>${t.label}</span></a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <a href="#" id="settingsLink" title="Settings">${Icons.settings}<span>Settings</span></a>
      </div>
    `;
    sidebar.querySelector('#settingsLink').onclick = (e) => { e.preventDefault(); openSettingsModal(); closeSidebarMobile(); };
  }

  if (bottomNav) {
    bottomNav.innerHTML = NAV_ITEMS.map(t =>
      `<a href="${t.href}" class="${t.href === activeHref ? 'active' : ''}">${Icons[t.icon]}<span>${t.label.replace('Indian ', '')}</span></a>`
    ).join('') + `<button type="button" class="bottom-nav-item" id="bottomNavSettings">${Icons.settings}<span>Settings</span></button>`;
    const bnSettings = document.getElementById('bottomNavSettings');
    if (bnSettings) bnSettings.onclick = () => openSettingsModal();
  }

  if (header) {
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <button class="icon-btn ghost hamburger-btn" id="hamburgerBtn" aria-label="Toggle menu">${Icons.menu}</button>
        <div class="header-title">${pageTitle}</div>
      </div>
      <div class="header-actions">
        <span class="status-chip" id="fxChip"><span class="pulse-dot manual"></span>fx —</span>
        <span class="status-chip" id="sourceChip">—</span>
        <div id="themeToggleHolder"></div>
        <button id="saveFileBtn" class="ghost icon-btn" title="Save to file">${Icons.download}</button>
        <button id="refreshBtn" class="ghost icon-btn" title="Refresh prices">${Icons.refresh}</button>
      </div>
    `;
    renderThemeToggle(document.getElementById('themeToggleHolder'));
    document.getElementById('refreshBtn').onclick = () => refreshPrices();
    document.getElementById('saveFileBtn').onclick = () => {
      Store.saveToFile();
      toast('data.json downloaded — replace it in your repo and commit to sync across devices', 'ok');
      updateSourceChip();
    };
    const hb = document.getElementById('hamburgerBtn');
    if (hb) hb.onclick = () => {
      if (window.innerWidth > 860) {
        appShell.classList.toggle('collapsed');
        localStorage.setItem('ft_sidebar_collapsed', appShell.classList.contains('collapsed') ? 'true' : 'false');
      } else {
        sidebar.classList.toggle('open');
        scrim.classList.toggle('open');
      }
    };
  }

  if (scrim) scrim.onclick = closeSidebarMobile;

  updateFxChip();
  updateSourceChip();
  stampFooterVersion();
}
window.renderShell = renderShell;

// Every page has a `.footer-note` div with its own text — this appends the
// current version once, so every page shows it without duplicating the
// version string across seven separate HTML files.
function stampFooterVersion() {
  document.querySelectorAll('.footer-note').forEach(footer => {
    if (footer.dataset.versioned) return;
    footer.textContent = footer.textContent.replace(/\s*$/, '') + ` · ${APP_VERSION}`;
    footer.dataset.versioned = 'true';
  });
}
window.stampFooterVersion = stampFooterVersion;

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebarScrim');
  if (sidebar) sidebar.classList.remove('open');
  if (scrim) scrim.classList.remove('open');
}

function updateSourceChip() {
  const chip = document.getElementById('sourceChip');
  if (!chip) return;
  const src = Store.dataSource();
  const dirty = Store.isDirty();
  const label = { file: 'data.json', cache: 'browser cache', default: 'no data.json' }[src] || src;
  chip.innerHTML = `<span class="pulse-dot ${dirty || src === 'default' ? 'stale' : 'fresh'}"></span>${label}${dirty ? ' · unsaved' : ''}`;
}
window.updateSourceChip = updateSourceChip;

async function updateFxChip() {
  const chip = document.getElementById('fxChip');
  if (!chip) return;
  try {
    const rate = await Market.fetchUsdInr();
    chip.innerHTML = `<span class="pulse-dot fresh"></span>USD/INR ${rate.toFixed(2)}`;
  } catch (e) {
    chip.innerHTML = `<span class="pulse-dot stale"></span>fx unavailable`;
  }
}

async function refreshPrices() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.style.opacity = '0.5';
  try {
    const { updated, failed } = await Market.refreshAll();
    if (updated.length) toast(`Updated ${updated.length} price(s)`, 'ok');
    if (failed.length) {
      const first = failed[0];
      toast(`${failed.length} failed. ${first.holding}: ${first.error}`, 'err');
    }
    updateFxChip();
    updateSourceChip();
    window.dispatchEvent(new CustomEvent('ft-prices-updated'));
  } catch (e) {
    toast('Refresh failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '';
  }
}
window.refreshPrices = refreshPrices;

function toast(msg, kind) {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    document.body.appendChild(region);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  region.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}
window.toast = toast;

function openModal(titleHtml, bodyHtml, onMount) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="card-head"><span class="eyebrow">${titleHtml}</span><button class="ghost icon-btn" id="modalClose">${Icons.close}</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  document.getElementById('modalClose').onclick = closeModal;
  if (onMount) onMount(overlay);
  return overlay;
}
function closeModal() {
  const m = document.getElementById('activeModal');
  if (m) m.remove();
}
window.openModal = openModal;
window.closeModal = closeModal;

function openSettingsModal() {
  const s = Store.getSettings();
  const logs = Store.getLogs();
  openModal('Settings', `
    <div class="form-field" style="margin-bottom:12px;">
      <label>Alpha Vantage API key (US stocks)</label>
      <input id="setAlphaKey" value="${s.apiKeys.alphaVantage || ''}" placeholder="paste key…" />
    </div>
    <div class="form-field" style="margin-bottom:12px;">
      <label>CORS proxy base URL (used for NSE + AMFI)</label>
      <input id="setProxy" value="${s.corsProxy || 'https://corsproxy.io/?url='}" />
    </div>
    <div class="form-field" style="margin-bottom:12px;">
      <label>Manual USD/INR override (blank = auto)</label>
      <input id="setFx" value="${s.fxOverride || ''}" placeholder="e.g. 87.5" />
    </div>
    <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
      <button id="saveSettings" class="primary">Save</button>
      <button class="ghost" id="saveFileBtn2">Save to file</button>
      <button class="ghost" id="reloadFileBtn">Reload from file</button>
      <button class="ghost" id="importBtn">Import JSON</button>
      <button class="danger" id="resetBtn">Reset all data</button>
    </div>
    <input type="file" id="importFile" accept="application/json" style="display:none;" />
    <p style="color:var(--text-faint); font-size:11.5px; margin-top:16px; line-height:1.6;">
      <b style="color:var(--text-muted);">How data persists:</b> data/data.json in the site is the source of truth,
      including these settings (your API key and proxy URL are saved into the file too — importing/reloading
      a data.json restores them along with your holdings).
      Edits in this browser are cached locally so you don't lose work on refresh —
      but to make them show up on another device, click <b>Save to file</b>, then
      replace data/data.json in your repo with the downloaded file and commit.
      <b>Reload from file</b> discards local edits and re-reads data/data.json.
    </p>

    <div style="margin-top:22px; padding-top:16px; border-top:1px solid var(--border);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <span class="eyebrow" style="font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted);">Activity log</span>
        <button class="ghost" id="clearLogsBtn" style="font-size:11.5px; padding:4px 9px;">Clear</button>
      </div>
      <div class="log-list" id="logList">${renderLogRows(logs)}</div>
      <p style="color:var(--text-faint); font-size:11px; margin-top:8px;">Every add/edit/delete and price-refresh result is recorded here (and saved into data.json). Only the latest 25 are kept — older entries drop off automatically.</p>
    </div>
  `, (overlay) => {
    overlay.querySelector('#saveSettings').onclick = () => {
      Store.updateSettings({
        apiKeys: { alphaVantage: overlay.querySelector('#setAlphaKey').value.trim() },
        corsProxy: overlay.querySelector('#setProxy').value.trim(),
        fxOverride: parseFloat(overlay.querySelector('#setFx').value) || null
      });
      toast('Settings saved', 'ok');
      closeModal();
    };
    overlay.querySelector('#saveFileBtn2').onclick = () => {
      Store.saveToFile();
      toast('data.json downloaded', 'ok');
      updateSourceChip();
    };
    overlay.querySelector('#reloadFileBtn').onclick = async () => {
      if (Store.isDirty() && !confirm('This discards unsaved local edits and re-reads data/data.json. Continue?')) return;
      try {
        await Store.reloadFromFile();
        toast('Reloaded from data/data.json', 'ok');
        closeModal();
        setTimeout(() => location.reload(), 400);
      } catch (e) { toast('Reload failed: ' + e.message, 'err'); }
    };
    overlay.querySelector('#importBtn').onclick = () => overlay.querySelector('#importFile').click();
    overlay.querySelector('#importFile').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importJSON(reader.result);
          toast('Import successful', 'ok');
          closeModal();
          setTimeout(() => location.reload(), 400);
        } catch (err) { toast('Import failed: ' + err.message, 'err'); }
      };
      reader.readAsText(file);
    };
    overlay.querySelector('#resetBtn').onclick = () => {
      if (confirm('This clears the working copy in this browser (data/data.json on disk is untouched). Continue?')) {
        Store.resetAll();
        toast('Local working copy cleared', 'ok');
        closeModal();
        setTimeout(() => location.reload(), 400);
      }
    };
    overlay.querySelector('#clearLogsBtn').onclick = () => {
      Store.clearLogs();
      overlay.querySelector('#logList').innerHTML = renderLogRows([]);
      toast('Logs cleared', 'ok');
    };
  });
}
window.openSettingsModal = openSettingsModal;

function renderLogRows(logs) {
  if (!logs.length) return '<div class="empty-state" style="padding:18px;">No activity yet</div>';
  return logs.map(l => `
    <div class="log-row">
      <span class="log-time">${new Date(l.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      <span class="log-badge ${l.level}">${l.level}</span>
      <span class="log-msg">${l.message}</span>
    </div>
  `).join('');
}

// ---------------- Sortable table helper ----------------
// state: {col: string|null, dir: 'asc'|'desc'}. accessor(row, key) returns the raw comparable value.
function attachSortHandlers(theadEl, state, onChange) {
  theadEl.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.add('sortable');
    const key = th.dataset.sort;
    th.classList.toggle('active', state.col === key);
    let arrow = th.querySelector('.sort-arrow');
    if (!arrow) {
      arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      th.appendChild(arrow);
    }
    arrow.textContent = state.col === key ? (state.dir === 'asc' ? '▲' : '▼') : '↕';
    th.onclick = () => {
      if (state.col === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.col = key; state.dir = 'desc'; }
      onChange();
    };
  });
}
window.attachSortHandlers = attachSortHandlers;

function sortRows(rows, state, accessor) {
  if (!state.col) return rows;
  return [...rows].sort((a, b) => {
    const va = accessor(a, state.col), vb = accessor(b, state.col);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return state.dir === 'asc' ? cmp : -cmp;
  });
}
window.sortRows = sortRows;

// ---------------- Info popover helper (purchase-lot tooltips etc) ----------------
let _infoContentMap = {};
function registerInfoContent(id, html) { _infoContentMap[id] = html; }
window.registerInfoContent = registerInfoContent;

function closeInfoPopovers() {
  document.querySelectorAll('.info-popover').forEach(p => p.remove());
}
window.closeInfoPopovers = closeInfoPopovers;

function wireInfoTriggers(container) {
  container.querySelectorAll('.info-trigger[data-info-key]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wasOpenForThis = btn._popoverOpen;
      closeInfoPopovers();
      if (wasOpenForThis) { btn._popoverOpen = false; return; }
      const html = _infoContentMap[btn.dataset.infoKey];
      if (!html) return;
      const popover = document.createElement('div');
      popover.className = 'info-popover';
      popover.innerHTML = html;
      document.body.appendChild(popover);
      const rect = btn.getBoundingClientRect();
      let left = window.scrollX + rect.left;
      const maxLeft = window.scrollX + window.innerWidth - popover.offsetWidth - 12;
      if (left > maxLeft) left = Math.max(8, maxLeft);
      popover.style.position = 'absolute';
      popover.style.top = (window.scrollY + rect.bottom + 6) + 'px';
      popover.style.left = left + 'px';
      btn._popoverOpen = true;
      setTimeout(() => document.addEventListener('click', () => { closeInfoPopovers(); btn._popoverOpen = false; }, { once: true }), 0);
    };
  });
}
window.wireInfoTriggers = wireInfoTriggers;

// ---------------- Tag badges (used on Indian Stocks) ----------------
function renderTagBadges(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="badge tag">${t}</span>`).join(' ');
}
window.renderTagBadges = renderTagBadges;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}


// ---------------- Collapsible sections ----------------
// Markup: a `.card-head.collapsible` (with an empty `.collapse-chevron` span
// inside) followed by a `.collapsible-body`. Clicking the head — except on a
// nested button/select/input/link — toggles it. The open/closed state is
// remembered per storageKey across visits and across re-renders.
function collapsibleCardHead(titleHtml, extraHtml) {
  return `<div class="card-head collapsible"><span class="eyebrow"><span class="collapse-chevron"></span>${titleHtml}</span>${extraHtml || ''}</div>`;
}
window.collapsibleCardHead = collapsibleCardHead;

function wireCollapsible(cardEl, storageKey, defaultExpanded) {
  const head = cardEl.querySelector('.card-head.collapsible');
  const body = cardEl.querySelector('.collapsible-body');
  if (!head || !body) return;
  const chev = head.querySelector('.collapse-chevron');
  if (chev && !chev.innerHTML.trim()) chev.innerHTML = Icons.chevronRight;
  const saved = localStorage.getItem('ft_collapse_' + storageKey);
  const expanded = saved != null ? saved === '1' : !!defaultExpanded;
  head.classList.toggle('expanded', expanded);
  body.classList.toggle('expanded', expanded);
  head.onclick = (e) => {
    if (e.target.closest('button, select, input, a')) return;
    const isOpen = body.classList.toggle('expanded');
    head.classList.toggle('expanded', isOpen);
    localStorage.setItem('ft_collapse_' + storageKey, isOpen ? '1' : '0');
  };
}
window.wireCollapsible = wireCollapsible;


// ---------------- Today's Change (shared by Indian Stocks, US Stocks, Mutual Funds) ----------------
// Per-holding cell: amount (INR) with the % move underneath, or a dash when there's
// no live previous-close to compare against (manual price, never refreshed, or stale).
function dayChangeCellHtml(val) {
  if (val.dayChangeINR == null) {
    return '<span style="color:var(--text-faint);" title="Needs a live price with a previous close — refresh prices">—</span>';
  }
  const cls = Fmt.gainClass(val.dayChangeINR);
  return `<span class="dual-value ${cls}">${Fmt.gainMoney(val.dayChangeINR)}<span class="secondary" style="color:inherit; opacity:.85;">${Fmt.pct(val.dayChangePct)}</span></span>`;
}
window.dayChangeCellHtml = dayChangeCellHtml;

// Summary box for the page's whole portfolio, placed right after Gain / Loss.
function dayChangeCardHtml(rows) {
  const withDay = rows.filter(r => r.val.dayChangeINR != null);
  if (!withDay.length) {
    return '<div class="stat-card"><div class="label">Today\'s Change</div><div class="value">—</div><div class="sub">refresh prices to load</div></div>';
  }
  const amount = withDay.reduce((s, r) => s + r.val.dayChangeINR, 0);
  const prevValue = withDay.reduce((s, r) => s + r.val.prevValueINR, 0);
  const pct = prevValue ? (amount / prevValue) * 100 : null;
  const cls = Fmt.gainClass(amount);
  const partial = withDay.length < rows.length ? ` · ${withDay.length} of ${rows.length} holdings` : '';
  return `<div class="stat-card"><div class="label">Today's Change</div><div class="value ${cls}">${Fmt.gainMoney(amount)}</div><div class="sub ${cls}">${Fmt.pct(pct)}${partial}</div></div>`;
}
window.dayChangeCardHtml = dayChangeCardHtml;


// ---------------- Bulk selection (checkbox column + header toolbar) ----------------
// Edit / Price need exactly one row checked (greyed out otherwise); Tags / Delete
// work on one or many. Per-page code only supplies the ids and an onAction callback.
function selectionToolbarHtml(count, opts) {
  opts = opts || {};
  return `<div class="bulk-actions">
    ${count ? `<span class="bulk-count">${count} selected</span>` : ''}
    <button type="button" data-bulk="edit" class="ghost" ${count === 1 ? '' : 'disabled'} title="Edit — select exactly one row">Edit</button>
    ${opts.showPrice ? `<button type="button" data-bulk="price" class="ghost" ${count === 1 ? '' : 'disabled'} title="Set a manual price — select exactly one row">Price</button>` : ''}
    ${opts.showTags ? `<button type="button" data-bulk="tags" class="ghost" ${count ? '' : 'disabled'} title="Add tags to the selected rows">Tags</button>` : ''}
    <button type="button" data-bulk="delete" class="danger" ${count ? '' : 'disabled'} title="Delete the selected rows">Delete</button>
  </div>`;
}
window.selectionToolbarHtml = selectionToolbarHtml;

// frame: the card element. cfg: { selection:Set, ids:[ids of rows in this table], toolbarOpts, onAction(action, ids) }
// Checking a box updates the page in place (no re-render), so typed form text and scroll position are untouched.
function setupBulkSelection(frame, cfg) {
  const sel = cfg.selection;
  Array.from(sel).forEach(id => { if (!cfg.ids.includes(id)) sel.delete(id); });

  function wireButtons() {
    frame.querySelectorAll('.bulk-actions button[data-bulk]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        cfg.onAction(btn.dataset.bulk, Array.from(sel));
      };
    });
  }
  function paint() {
    frame.querySelectorAll('input.row-select').forEach(cb => {
      cb.checked = sel.has(cb.dataset.id);
      const tr = cb.closest('tr');
      if (tr) tr.classList.toggle('row-selected', cb.checked);
    });
    const all = frame.querySelector('input.select-all');
    if (all) {
      const everyOn = cfg.ids.length > 0 && cfg.ids.every(id => sel.has(id));
      all.checked = everyOn;
      all.indeterminate = !everyOn && cfg.ids.some(id => sel.has(id));
    }
    const host = frame.querySelector('.bulk-actions');
    if (host) { host.outerHTML = selectionToolbarHtml(sel.size, cfg.toolbarOpts); wireButtons(); }
  }

  frame.querySelectorAll('input.row-select').forEach(cb => {
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = () => { if (cb.checked) sel.add(cb.dataset.id); else sel.delete(cb.dataset.id); paint(); };
  });
  const all = frame.querySelector('input.select-all');
  if (all) {
    all.onclick = (e) => e.stopPropagation();
    all.onchange = () => { cfg.ids.forEach(id => { if (all.checked) sel.add(id); else sel.delete(id); }); paint(); };
  }
  wireButtons();
  paint();
}
window.setupBulkSelection = setupBulkSelection;
