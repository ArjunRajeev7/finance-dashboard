/* ============================================================
   market.js — live price fetching with caching + manual fallback
   ============================================================
   Neither NSE nor a same-origin AMFI request work with a plain
   client-side fetch (no CORS headers), so both go through a
   chain of public CORS proxies — tried in order, first success
   wins. Public proxies are individually flaky (rate limits,
   downtime), so trying several meaningfully improves reliability
   over relying on just one. You can still override/add your own
   in Settings; it's tried first, ahead of the built-in chain.
   ============================================================ */

const Market = {};

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

// Built-in fallback chain of public CORS proxies, tried in order after
// a direct (no-proxy) attempt and after the user's configured proxy (if any).
const BUILTIN_PROXY_CHAIN = [
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://thingproxy.freeboard.io/fetch/' + url,
  (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
];

function proxyList(targetUrl) {
  const s = Store.getSettings();
  const list = [];
  if (s.corsProxy) list.push(s.corsProxy + encodeURIComponent(targetUrl));
  BUILTIN_PROXY_CHAIN.forEach(fn => list.push(fn(targetUrl)));
  return list;
}

async function fetchJsonWithFallback(directUrl, opts) {
  const errors = [];
  try {
    const r = await fetch(directUrl, opts);
    if (r.ok) return await r.json();
    errors.push('direct: HTTP ' + r.status);
  } catch (e) { errors.push('direct: ' + e.message); }

  for (const proxied of proxyList(directUrl)) {
    try {
      const r = await fetch(proxied);
      if (r.ok) return await r.json();
      errors.push(proxied.split('?')[0] + ': HTTP ' + r.status);
    } catch (e) { errors.push(proxied.split('?')[0] + ': ' + e.message); }
  }
  throw new Error('All sources failed for ' + directUrl + ' — ' + errors.join(' | '));
}

async function fetchTextWithFallback(directUrl) {
  const errors = [];
  try {
    const r = await fetch(directUrl);
    if (r.ok) return await r.text();
    errors.push('direct: HTTP ' + r.status);
  } catch (e) { errors.push('direct: ' + e.message); }

  for (const proxied of proxyList(directUrl)) {
    try {
      const r = await fetch(proxied);
      if (r.ok) return await r.text();
      errors.push(proxied.split('?')[0] + ': HTTP ' + r.status);
    } catch (e) { errors.push(proxied.split('?')[0] + ': ' + e.message); }
  }
  throw new Error('All sources failed for ' + directUrl + ' — ' + errors.join(' | '));
}

// ---------------- Indian Stocks ----------------
// NSE's own API needs a real browser session (cookies from visiting the
// homepage first) — a plain proxied fetch usually gets blocked outright,
// even through a working CORS proxy. Yahoo Finance's quote endpoint covers
// NSE-listed symbols (via the ".NS" suffix) without that session
// requirement, so it's tried first; NSE's official endpoint is kept as a
// fallback in case Yahoo doesn't have a given symbol.
// ---------------- Indian Stocks ----------------
// NSE's own API needs a real browser session (cookies from visiting the
// homepage first) — a plain proxied fetch usually gets blocked outright,
// even through a working CORS proxy. Yahoo Finance's quote endpoint covers
// both exchanges without that session requirement, so it's tried first —
// NSE (.NS suffix), then BSE (.BO suffix) for symbols only listed there
// (e.g. NSDL, POLYMED); NSE's official endpoint is kept as a last resort.
Market.fetchNseQuote = async function (symbol) {
  const cacheKey = 'nse_' + symbol;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  async function tryYahoo(suffix, source) {
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${suffix}`;
    const data = await fetchJsonWithFallback(yUrl);
    const price = data && data.chart && data.chart.result && data.chart.result[0]
      ? data.chart.result[0].meta.regularMarketPrice : null;
    if (price == null) throw new Error('no price for ' + suffix);
    return { price, asOf: new Date().toISOString(), exchange: source };
  }

  try {
    const result = await tryYahoo('.NS', 'NSE');
    Store.setPriceCache(cacheKey, result);
    return result;
  } catch (e) { /* not on NSE (or Yahoo has no NSE data for it) — try BSE */ }

  try {
    const result = await tryYahoo('.BO', 'BSE');
    Store.setPriceCache(cacheKey, result);
    return result;
  } catch (e) { /* fall through to NSE official */ }

  // Last resort: NSE's own (unofficial) API
  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
  const data = await fetchJsonWithFallback(url, { headers: { 'Accept': 'application/json' } });
  const price = data && data.priceInfo ? data.priceInfo.lastPrice : null;
  if (price == null) throw new Error('No price found for ' + symbol + ' via Yahoo (NSE/BSE) or NSE official API');
  const result = { price, asOf: new Date().toISOString(), exchange: 'NSE' };
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
// Refreshes all holdings' prices, returns { updated:[], failed:[{holding, error}] }
Market.refreshAll = async function (onProgress) {
  const d = Store.load();
  const updated = [];
  const failed = [];

  const usdInr = await Market.fetchUsdInr().catch(() => 83);
  Store.updateSettings({ lastUpdated: Object.assign({}, d.settings.lastUpdated, { fx: new Date().toISOString() }) });

  for (const h of d.holdings.IN_STOCK) {
    try {
      const q = await Market.fetchNseQuote(h.symbol);
      Store.updateHolding('IN_STOCK', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: q.exchange || 'NSE' });
      updated.push(h.symbol);
    } catch (e) {
      failed.push({ holding: h.symbol, error: e.message });
      Store.log('error', `Price refresh failed — ${h.symbol}: ${e.message}`);
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
      Store.log('error', `NAV refresh failed — ${h.name}: ${e.message}`);
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
      Store.log('error', `Price refresh failed — ${h.symbol}: ${e.message}`);
    }
    onProgress && onProgress();
  }

  Store.log(failed.length ? 'error' : 'info', `Refresh complete: ${updated.length} updated, ${failed.length} failed`);
  return { updated, failed, usdInr };
};

window.Market = Market;
