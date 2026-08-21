/* ============================================================
   market.js — live price fetching with caching + manual fallback
   ============================================================
   NSE has no public CORS-enabled API, so NSE + AMFI requests are
   routed through a configurable CORS proxy. Default proxy can be
   changed in Settings if it's rate-limited or down.
   ============================================================ */

const Market = {};

const DEFAULT_CORS_PROXY = 'https://corsproxy.io/?url=';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

function proxyUrl(targetUrl) {
  const s = Store.getSettings();
  const proxy = s.corsProxy || DEFAULT_CORS_PROXY;
  return proxy + encodeURIComponent(targetUrl);
}

async function fetchJsonWithFallback(directUrl, opts) {
  try {
    const r = await fetch(directUrl, opts);
    if (r.ok) return await r.json();
  } catch (e) { /* fall through to proxy */ }
  const r2 = await fetch(proxyUrl(directUrl));
  if (!r2.ok) throw new Error('Fetch failed (direct + proxy): ' + directUrl);
  return await r2.json();
}

async function fetchTextWithFallback(directUrl) {
  try {
    const r = await fetch(directUrl);
    if (r.ok) return await r.text();
  } catch (e) { /* fall through */ }
  const r2 = await fetch(proxyUrl(directUrl));
  if (!r2.ok) throw new Error('Fetch failed (direct + proxy): ' + directUrl);
  return await r2.text();
}

// ---------------- NSE Stocks ----------------
Market.fetchNseQuote = async function (symbol) {
  const cacheKey = 'nse_' + symbol;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
  const data = await fetchJsonWithFallback(url, {
    headers: { 'Accept': 'application/json' }
  });
  const price = data && data.priceInfo ? data.priceInfo.lastPrice : null;
  if (price == null) throw new Error('No price in NSE response for ' + symbol);
  const result = { price, asOf: new Date().toISOString() };
  Store.setPriceCache(cacheKey, result);
  return result;
};

// ---------------- Indian Mutual Funds (AMFI) ----------------
let _amfiCacheParsed = null;
let _amfiCacheTs = 0;

async function loadAmfiFile() {
  if (_amfiCacheParsed && Date.now() - _amfiCacheTs < CACHE_TTL_MS) return _amfiCacheParsed;
  const text = await fetchTextWithFallback('https://www.amfiindia.com/spragainstAll/NAVAll.txt');
  const map = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 6) {
      const code = parts[0].trim();
      const nav = parseFloat(parts[4]);
      const date = parts[5].trim();
      if (code && !isNaN(nav)) {
        map[code] = { price: nav, asOf: date, name: parts[3].trim() };
      }
    }
  }
  _amfiCacheParsed = map;
  _amfiCacheTs = Date.now();
  return map;
}

Market.fetchMfNav = async function (schemeCode) {
  const cacheKey = 'mf_' + schemeCode;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;
  const map = await loadAmfiFile();
  const entry = map[String(schemeCode)];
  if (!entry) throw new Error('Scheme code not found in AMFI file: ' + schemeCode);
  Store.setPriceCache(cacheKey, entry);
  return entry;
};

// ---------------- US Stocks (Alpha Vantage) ----------------
Market.fetchUsQuote = async function (symbol) {
  const cacheKey = 'us_' + symbol;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  const key = Store.getSettings().apiKeys.alphaVantage;
  if (!key) throw new Error('No Alpha Vantage API key set (Settings)');
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
  const r = await fetch(url);
  const data = await r.json();
  const quote = data['Global Quote'];
  if (!quote || !quote['05. price']) {
    if (data['Note'] || data['Information']) throw new Error('Alpha Vantage rate limit hit — try again later');
    throw new Error('No price returned for ' + symbol);
  }
  const result = { price: parseFloat(quote['05. price']), asOf: new Date().toISOString() };
  Store.setPriceCache(cacheKey, result);
  return result;
};

// ---------------- FX Rate (USD -> INR) ----------------
Market.fetchUsdInr = async function () {
  const cacheKey = 'fx_usdinr';
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached != null) return cached;

  const settings = Store.getSettings();
  if (settings.fxOverride) return settings.fxOverride;

  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR');
    const data = await r.json();
    const rate = data.rates && data.rates.INR;
    if (rate) {
      Store.setPriceCache(cacheKey, rate);
      return rate;
    }
  } catch (e) { /* try fallback below */ }

  try {
    const r2 = await fetch('https://open.er-api.com/v6/latest/USD');
    const data2 = await r2.json();
    const rate2 = data2.rates && data2.rates.INR;
    if (rate2) {
      Store.setPriceCache(cacheKey, rate2);
      return rate2;
    }
  } catch (e) { /* give up */ }

  return 83; // last-resort static fallback so the app never breaks
};

// ---------------- Bulk refresh ----------------
Market.refreshAll = async function (onProgress) {
  const d = Store.load();
  const updated = [];
  const failed = [];

  const usdInr = await Market.fetchUsdInr().catch(() => 83);
  Store.updateSettings({ lastUpdated: Object.assign({}, d.settings.lastUpdated, { fx: new Date().toISOString() }) });

  for (const h of d.holdings.IN_STOCK) {
    try {
      const q = await Market.fetchNseQuote(h.symbol);
      Store.updateHolding('IN_STOCK', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: 'NSE' });
      updated.push(h.symbol);
    } catch (e) {
      failed.push({ holding: h.symbol, error: e.message });
    }
    onProgress && onProgress();
  }

  for (const h of d.holdings.IN_MF) {
    try {
      const q = await Market.fetchMfNav(h.schemeCode);
      Store.updateHolding('IN_MF', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: 'AMFI' });
      updated.push(h.name);
    } catch (e) {
      failed.push({ holding: h.name, error: e.message });
    }
    onProgress && onProgress();
  }

  for (const h of d.holdings.US_STOCK) {
    try {
      const q = await Market.fetchUsQuote(h.symbol);
      Store.updateHolding('US_STOCK', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: 'AlphaVantage' });
      updated.push(h.symbol);
    } catch (e) {
      failed.push({ holding: h.symbol, error: e.message });
    }
    onProgress && onProgress();
  }

  return { updated, failed, usdInr };
};

window.Market = Market;
