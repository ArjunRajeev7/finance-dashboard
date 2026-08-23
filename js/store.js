/* ============================================================
   store.js — data model + file-based persistence
   ============================================================
   Source of truth is data/data.json, shipped with the site.
   On first load in a browser, it's fetched and cached into
   localStorage as the "working copy" so in-page edits persist
   across refreshes without re-fetching. Two explicit actions
   bridge the working copy back to the real file:
     - Save to file   → downloads current state as data.json
                         (you replace the file in your repo & commit)
     - Reload from file → re-fetches data/data.json, discarding
                         any unsaved local edits in this browser
   This is the honest mechanism for a static, backend-less site:
   the committed file is what "follows you" between devices/browsers,
   not automatic live sync.
   ============================================================ */

const CACHE_KEY = 'ft_portfolio_cache_v1';
const DATA_FILE_PATH = 'data/data.json';

const ASSET_TYPES = ['IN_STOCK', 'IN_MF', 'US_STOCK', 'FD', 'EPF'];

const ASSET_LABELS = {
  IN_STOCK: 'Indian Stocks',
  IN_MF: 'Mutual Funds',
  US_STOCK: 'US Stocks',
  FD: 'Fixed Deposits',
  EPF: 'EPF'
};

const ASSET_PAGES = {
  IN_STOCK: 'stocks-ind.html',
  IN_MF: 'mutual-funds.html',
  US_STOCK: 'stocks-us.html',
  FD: 'fixed-deposits.html',
  EPF: 'epf.html'
};

function defaultData() {
  return {
    version: 1,
    holdings: { IN_STOCK: [], IN_MF: [], US_STOCK: [], FD: [], EPF: [] },
    settings: {
      baseCurrency: 'INR',
      apiKeys: { alphaVantage: '' },
      corsProxy: 'https://corsproxy.io/?url=',
      fxOverride: null,
      priceCache: {},
      lastUpdated: {}
    }
  };
}

function normalize(raw) {
  const def = defaultData();
  const d = Object.assign({}, def, raw || {});
  d.holdings = Object.assign({}, def.holdings, (raw && raw.holdings) || {});
  ASSET_TYPES.forEach(t => { if (!Array.isArray(d.holdings[t])) d.holdings[t] = []; });
  d.settings = Object.assign({}, def.settings, (raw && raw.settings) || {});
  delete d._readme;
  return d;
}

const Store = {
  _data: null,
  _dirty: false,     // true if working copy has edits not yet exported
  _source: null,      // 'cache' | 'file' | 'default'

  // Must be awaited once before any page renders.
  async init() {
    if (this._data) return this._data;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        this._data = normalize(JSON.parse(cached));
        this._source = 'cache';
        return this._data;
      } catch (e) { /* fall through to file */ }
    }
    try {
      const res = await fetch(DATA_FILE_PATH, { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        this._data = normalize(raw);
        this._source = 'file';
        localStorage.setItem(CACHE_KEY, JSON.stringify(this._data));
        return this._data;
      }
    } catch (e) { /* fall through to defaults */ }
    this._data = defaultData();
    this._source = 'default';
    return this._data;
  },

  load() {
    if (!this._data) throw new Error('Store.init() must be awaited before Store.load()');
    return this._data;
  },

  save() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(this._data));
    this._dirty = true;
    window.dispatchEvent(new CustomEvent('ft-store-updated'));
  },

  isDirty() { return this._dirty; },
  dataSource() { return this._source; },

  uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  // ---------- Holdings CRUD ----------
  addHolding(assetType, holding) {
    const d = this.load();
    holding.id = holding.id || this.uid();
    if (['IN_STOCK', 'IN_MF', 'US_STOCK'].includes(assetType) && !holding.txns) holding.txns = [];
    if (assetType === 'IN_STOCK' && !holding.tags) holding.tags = [];
    if (assetType === 'EPF') {
      if (!holding.txns) holding.txns = [];
      if (!holding.interestRates) holding.interestRates = [];
    }
    d.holdings[assetType].push(holding);
    this.save();
    return holding;
  },

  updateHolding(assetType, id, patch) {
    const d = this.load();
    const h = d.holdings[assetType].find(x => x.id === id);
    if (h) Object.assign(h, patch);
    this.save();
    return h;
  },

  deleteHolding(assetType, id) {
    const d = this.load();
    d.holdings[assetType] = d.holdings[assetType].filter(x => x.id !== id);
    this.save();
  },

  getHolding(assetType, id) {
    return this.load().holdings[assetType].find(x => x.id === id);
  },

  // ---------- Transactions ----------
  addTxn(assetType, holdingId, txn) {
    const h = this.getHolding(assetType, holdingId);
    if (!h) return null;
    txn.id = txn.id || this.uid();
    h.txns.push(txn);
    h.txns.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
    return txn;
  },

  updateTxn(assetType, holdingId, txnId, patch) {
    const h = this.getHolding(assetType, holdingId);
    if (!h) return null;
    const t = h.txns.find(x => x.id === txnId);
    if (t) Object.assign(t, patch);
    h.txns.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
    return t;
  },

  deleteTxn(assetType, holdingId, txnId) {
    const h = this.getHolding(assetType, holdingId);
    if (!h) return;
    h.txns = h.txns.filter(x => x.id !== txnId);
    this.save();
  },

  addEpfContribution(holdingId, contrib) {
    return this.addTxn('EPF', holdingId, Object.assign({ type: 'contribution' }, contrib));
  },

  // ---------- Tags (Indian Stocks: IPO, broker account, etc.) ----------
  addTag(assetType, holdingId, tag) {
    const h = this.getHolding(assetType, holdingId);
    if (!h) return;
    if (!h.tags) h.tags = [];
    tag = (tag || '').trim();
    if (tag && !h.tags.includes(tag)) h.tags.push(tag);
    this.save();
  },
  removeTag(assetType, holdingId, tag) {
    const h = this.getHolding(assetType, holdingId);
    if (!h) return;
    h.tags = (h.tags || []).filter(t => t !== tag);
    this.save();
  },

  // ---------- Settings ----------
  getSettings() { return this.load().settings; },
  updateSettings(patch) {
    const d = this.load();
    Object.assign(d.settings, patch);
    this.save();
  },
  setPriceCache(key, value) {
    const d = this.load();
    d.settings.priceCache[key] = { value, ts: Date.now() };
    this.save();
  },
  getPriceCache(key, maxAgeMs) {
    const d = this.load();
    const entry = d.settings.priceCache[key];
    if (!entry) return null;
    if (maxAgeMs && Date.now() - entry.ts > maxAgeMs) return null;
    return entry.value;
  },

  // ---------- File bridge ----------
  exportJSON() {
    const d = this.load();
    const out = Object.assign({
      _readme: "This file is the single source of truth for Finance Tracker. Replace data/data.json in your repo with this file and commit to sync across devices."
    }, d);
    return JSON.stringify(out, null, 2);
  },

  saveToFile() {
    const blob = new Blob([this.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.json';
    a.click();
    this._dirty = false;
  },

  async reloadFromFile() {
    const res = await fetch(DATA_FILE_PATH + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not fetch ' + DATA_FILE_PATH);
    const raw = await res.json();
    this._data = normalize(raw);
    this._source = 'file';
    this._dirty = false;
    localStorage.setItem(CACHE_KEY, JSON.stringify(this._data));
    window.dispatchEvent(new CustomEvent('ft-store-updated'));
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.holdings) throw new Error('Invalid file: missing holdings');
    this._data = normalize(parsed);
    this._dirty = true;
    this.save();
  },

  resetAll() {
    this._data = defaultData();
    this.save();
  }
};

window.Store = Store;
window.ASSET_TYPES = ASSET_TYPES;
window.ASSET_LABELS = ASSET_LABELS;
window.ASSET_PAGES = ASSET_PAGES;
