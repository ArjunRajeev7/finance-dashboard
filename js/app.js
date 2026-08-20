/* ============================================================
   app.js — shared UI chrome
   ============================================================ */

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
  { href: 'stocks-ind.html', label: 'Stocks [IND]', icon: 'stocksIn' },
  { href: 'stocks-us.html', label: 'Stocks [US]', icon: 'stocksUs' },
  { href: 'mutual-funds.html', label: 'Mutual Funds', icon: 'mutualFunds' },
  { href: 'fixed-deposits.html', label: 'Fixed Deposits', icon: 'fd' },
  { href: 'epf.html', label: 'EPF', icon: 'epf' }
];

function renderShell(activeHref, pageTitle) {
  const sidebar = document.getElementById('sidebar');
  const header = document.getElementById('pageHeader');
  const bottomNav = document.getElementById('bottomNav');
  const scrim = document.getElementById('sidebarScrim');

  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-brand">${Icons.brand}<span>Finance Tracker</span></div>
      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(t => `<a href="${t.href}" class="${t.href === activeHref ? 'active' : ''}">${Icons[t.icon]}<span>${t.label}</span></a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <a href="#" id="settingsLink" style="display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text-muted);font-size:13px;font-weight:500;">${Icons.settings}<span>Settings</span></a>
      </div>
    `;
    sidebar.querySelector('#settingsLink').onclick = (e) => { e.preventDefault(); openSettingsModal(); closeSidebarMobile(); };
  }

  if (bottomNav) {
    const mobileItems = NAV_ITEMS.slice(0, 5);
    bottomNav.innerHTML = mobileItems.map(t =>
      `<a href="${t.href}" class="${t.href === activeHref ? 'active' : ''}">${Icons[t.icon]}<span>${t.label.replace(' [IND]', '').replace(' [US]', ' US')}</span></a>`
    ).join('');
  }

  if (header) {
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <button class="icon-btn ghost hamburger-btn" id="hamburgerBtn" aria-label="Menu">${Icons.menu}</button>
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
    if (hb) hb.onclick = () => { sidebar.classList.add('open'); scrim.classList.add('open'); };
  }

  if (scrim) scrim.onclick = closeSidebarMobile;

  updateFxChip();
  updateSourceChip();
}
window.renderShell = renderShell;

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
    if (failed.length) toast(`${failed.length} failed: ${failed.map(f => f.holding).join(', ')} — check symbol or set manually`, 'err');
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
      <b style="color:var(--text-muted);">How data persists:</b> data/data.json in the site is the source of truth.
      Edits in this browser are cached locally so you don't lose work on refresh —
      but to make them show up on another device, click <b>Save to file</b>, then
      replace data/data.json in your repo with the downloaded file and commit.
      <b>Reload from file</b> discards local edits and re-reads data/data.json.
    </p>
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
  });
}
window.openSettingsModal = openSettingsModal;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
