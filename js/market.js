/* ============================================================
   market.js — live price fetching with caching + manual fallback
   ============================================================
   Browsers block most price sites (no CORS headers), so those
   requests go through a chain of public CORS proxies. Public
   proxies are individually flaky — rate limits, blocks, downtime —
   so this layer is built to fail FAST and move on:

     • every request has a timeout (nothing can hang forever)
     • routes (direct, proxies) are health-tracked: the one that
       worked last is tried first; one that just failed is skipped
       for the rest of the refresh instead of being retried per symbol
     • a definitive "no such symbol" (HTTP 404) stops the chain
       immediately instead of asking five more proxies
     • Indian stocks, mutual funds and US stocks refresh IN PARALLEL
       with each other, and a few symbols at a time within each, so a
       slow section can't hold up the others

   Sources
     Indian stocks : Yahoo Finance (.NS, then .BO for BSE-only), NSE official as last resort
     Mutual funds  : mfapi.in (also gives the previous NAV), then AMFI's NAVAll.txt
     US stocks     : Alpha Vantage (if a key is set and its daily quota isn't spent), then Yahoo
   ============================================================ */

const Market = {};

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

Market.config = {
  timeoutMs: 8000,       // per request
  poolIndia: 3,          // simultaneous Indian-stock requests
  poolMf: 3,
  poolUs: 2,
  deadOnBlockMs: 180000, // proxy answered 403/429 (blocked / rate-limited)
  deadOnTimeoutMs: 60000,
  deadOnOtherMs: 30000,
  deadOnCorsMs: 6 * 60 * 60 * 1000 // direct call blocked by CORS: won't fix itself this session
};

// ---------------- routes: direct + CORS proxies ----------------
const BUILTIN_PROXIES = [
  { id: 'corsproxy.io', build: (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u) },
  { id: 'allorigins', build: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) },
  { id: 'codetabs', build: (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u) },
  { id: 'thingproxy', build: (u) => 'https://thingproxy.freeboard.io/fetch/' + u }
];

const routeState = {}; // routeId -> { okAt, deadUntil }
const st = (id) => routeState[id] || (routeState[id] = { okAt: 0, deadUntil: 0 });

Market.resetRoutes = function () { Object.keys(routeState).forEach(id => { routeState[id].deadUntil = 0; }); };

function proxyRoutes() {
  const custom = (Store.getSettings().corsProxy || '').trim();
  const routes = [];
  // the Settings proxy goes first — unless it is just one of the built-ins (the default is), which would double every attempt
  if (custom && !BUILTIN_PROXIES.some(b => b.build('') === custom)) {
    routes.push({ id: 'custom-proxy', build: (u) => custom + encodeURIComponent(u) });
  }
  BUILTIN_PROXIES.forEach(b => routes.push(b));
  const now = Date.now();
  return routes
    .filter(r => st(r.id).deadUntil <= now)
    .sort((a, b) => st(b.id).okAt - st(a.id).okAt); // recently-working first (stable for ties)
}

function netError(kind, e) {
  const err = new Error(kind === 'timeout' ? 'timed out' : kind === 'network' ? 'blocked or unreachable' : 'unreadable response');
  err.kind = kind; err.cause = e;
  return err;
}

// One request with a hard timeout covering headers AND body.
async function timedGet(url, as, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Market.config.timeoutMs);
  try {
    let r;
    try { r = await fetch(url, Object.assign({}, opts, { signal: ctrl.signal })); }
    catch (e) { throw netError(ctrl.signal.aborted ? 'timeout' : 'network', e); }
    if (!r.ok) { const err = new Error('HTTP ' + r.status); err.kind = 'http'; err.status = r.status; throw err; }
    try { return as === 'text' ? await r.text() : await r.json(); }
    catch (e) { throw netError(ctrl.signal.aborted ? 'timeout' : 'parse', e); }
  } finally { clearTimeout(timer); }
}

function markFail(route, e) {
  const c = Market.config, s = st(route.id), now = Date.now();
  if (e.kind === 'http' && (e.status === 403 || e.status === 429)) s.deadUntil = now + c.deadOnBlockMs;
  else if (e.kind === 'timeout') s.deadUntil = now + c.deadOnTimeoutMs;
  else if (e.kind === 'network' && route.direct) s.deadUntil = now + c.deadOnCorsMs;
  else s.deadUntil = now + c.deadOnOtherMs;
}

// Try direct, then the healthiest proxies. Returns parsed data or throws a short, readable error.
async function getViaRoutes(url, as, opts) {
  const host = new URL(url).host;
  const direct = { id: 'direct:' + host, label: 'direct', direct: true, build: (u) => u };
  const candidates = [];
  if (st(direct.id).deadUntil <= Date.now()) candidates.push(direct);
  proxyRoutes().forEach(r => candidates.push(Object.assign({ label: r.id }, r)));

  const notes = [];
  for (const route of candidates) {
    try {
      const data = await timedGet(route.build(url), as, route.direct ? opts : undefined);
      const s = st(route.id); s.okAt = Date.now(); s.deadUntil = 0;
      return data;
    } catch (e) {
      // 404 = the service itself says "no such symbol". Believe it when it comes from a source that has
      // answered before (or directly); a never-seen-working proxy returning 404 just counts as a bad route.
      if (e.kind === 'http' && e.status === 404 && (route.direct || st(route.id).okAt > 0)) {
        const nf = new Error('not found'); nf.notFound = true; throw nf;
      }
      markFail(route, e);
      notes.push(`${route.label}: ${e.message}`);
    }
  }
  throw new Error(candidates.length
    ? 'no source answered (' + notes.join('; ') + ')'
    : 'all routes are paused after repeated failures — try again in a minute');
}

// Run worker(item) over items, at most `limit` at a time.
async function runPool(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; await worker(item); }
  });
  await Promise.all(runners);
}

// ---------------- Yahoo Finance chart (Indian + US) ----------------
async function yahooQuote(yahooSymbol, source) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
  const data = await getViaRoutes(url, 'json');
  const meta = data && data.chart && data.chart.result && data.chart.result[0] ? data.chart.result[0].meta : null;
  const price = meta ? meta.regularMarketPrice : null;
  if (price == null) { const nf = new Error('not found'); nf.notFound = true; throw nf; }
  const prev = meta.previousClose != null ? meta.previousClose : meta.chartPreviousClose;
  return { price, asOf: new Date().toISOString(), exchange: source, source, previousClose: prev != null ? prev : null };
}

// ---------------- Indian Stocks ----------------
Market.fetchNseQuote = async function (symbol) {
  const cacheKey = 'nse_' + symbol;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  let result = null;
  const tried = [];
  for (const [suffix, source] of [['.NS', 'NSE'], ['.BO', 'BSE']]) {
    try { result = await yahooQuote(symbol + suffix, source); break; }
    catch (e) { tried.push(`${suffix}: ${e.notFound ? 'not listed' : e.message}`); }
  }
  if (!result) {
    // last resort: NSE's own endpoint (usually blocked without a browser session, so it rarely helps)
    try {
      const data = await getViaRoutes(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, 'json', { headers: { Accept: 'application/json' } });
      const price = data && data.priceInfo ? data.priceInfo.lastPrice : null;
      if (price != null) {
        const prev = data.priceInfo.previousClose != null ? data.priceInfo.previousClose : null;
        result = { price, asOf: new Date().toISOString(), exchange: 'NSE', source: 'NSE', previousClose: prev };
      }
    } catch (e) { tried.push('NSE official: ' + (e.notFound ? 'not listed' : e.message)); }
  }
  if (!result) throw new Error('no price found — ' + tried.join(' | '));
  Store.setPriceCache(cacheKey, result);
  return result;
};

// ---------------- Indian Mutual Funds ----------------
// AMFI publishes one big text file of every scheme's latest NAV. Funds share a single download.
const AMFI_URLS = ['https://www.amfiindia.com/spages/NAVAll.txt', 'https://portal.amfiindia.com/spages/NAVAll.txt'];
let _amfiPromise = null, _amfiTs = 0;

function loadAmfiFile() {
  if (_amfiPromise && Date.now() - _amfiTs < CACHE_TTL_MS) return _amfiPromise;
  _amfiTs = Date.now();
  _amfiPromise = (async () => {
    const notes = [];
    for (const u of AMFI_URLS) {
      try {
        const text = await getViaRoutes(u, 'text');
        const map = {};
        for (const line of text.split('\n')) {
          const p = line.split(';');           // code;ISIN;ISIN;name;NAV;date
          if (p.length >= 6) {
            const code = p[0].trim(), nav = parseFloat(p[4]);
            if (code && !isNaN(nav)) map[code] = { price: nav, asOf: p[5].trim(), name: p[3].trim() };
          }
        }
        if (Object.keys(map).length) return map;
        notes.push('empty file');
      } catch (e) { notes.push(e.message); }
    }
    throw new Error(notes.join(' | '));
  })().catch(e => { _amfiPromise = null; throw e; });
  return _amfiPromise;
}

Market.fetchMfNav = async function (schemeCode) {
  const code = String(schemeCode).trim();
  const cacheKey = 'mf_' + code;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  let first = null;
  try { // mfapi.in: small JSON, newest NAV first — and it also gives us the previous day's NAV
    const json = await getViaRoutes(`https://api.mfapi.in/mf/${encodeURIComponent(code)}`, 'json');
    const rows = json && json.data;
    const nav = rows && rows.length ? parseFloat(rows[0].nav) : NaN;
    if (!isNaN(nav)) {
      const prev = rows[1] ? parseFloat(rows[1].nav) : NaN;
      const result = { price: nav, asOf: rows[0].date, previousClose: isNaN(prev) ? null : prev, source: 'mfapi.in', name: json.meta && json.meta.scheme_name };
      Store.setPriceCache(cacheKey, result);
      return result;
    }
    first = new Error('mfapi.in has no NAV for this code');
  } catch (e) { first = e; }

  try { // fall back to AMFI's own file
    const map = await loadAmfiFile();
    const entry = map[code];
    if (!entry) throw new Error('scheme code not in the AMFI file');
    const result = Object.assign({ source: 'AMFI' }, entry);
    Store.setPriceCache(cacheKey, result);
    return result;
  } catch (e2) {
    throw new Error(`NAV for scheme ${code} not found — mfapi.in: ${first.message}; AMFI: ${e2.message}`);
  }
};

// ---------------- US Stocks ----------------
async function alphaVantageQuote(symbol, key) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
  const data = await timedGet(url, 'json');
  const q = data && data['Global Quote'];
  if (!q || !q['05. price']) {
    const err = new Error(data && (data['Note'] || data['Information']) ? 'daily request limit reached' : 'no price returned');
    if (data && (data['Note'] || data['Information'])) err.rateLimited = true;
    throw err;
  }
  const prev = q['08. previous close'] != null ? parseFloat(q['08. previous close']) : null;
  return { price: parseFloat(q['05. price']), asOf: new Date().toISOString(), source: 'AlphaVantage', previousClose: prev };
}

Market.fetchUsQuote = async function (symbol) {
  const cacheKey = 'us_' + symbol;
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  const key = (Store.getSettings().apiKeys.alphaVantage || '').trim();
  const limited = Store.getPriceCache('av_limited', 6 * 60 * 60 * 1000); // quota spent earlier — don't waste calls
  let avNote;
  if (!key) avNote = 'no Alpha Vantage key set';
  else if (limited) avNote = 'daily limit already reached';
  else {
    try {
      const result = await alphaVantageQuote(symbol, key);
      Store.setPriceCache(cacheKey, result);
      return result;
    } catch (e) {
      avNote = e.message;
      if (e.rateLimited) Store.setPriceCache('av_limited', true);
    }
  }
  try { // Yahoo has no daily cap; its tickers use "-" where US tickers use "." (BRK.B -> BRK-B)
    const result = await yahooQuote(symbol.replace(/\./g, '-'), 'Yahoo');
    Store.setPriceCache(cacheKey, result);
    return result;
  } catch (e2) {
    throw new Error(`Alpha Vantage: ${avNote}; Yahoo: ${e2.notFound ? 'symbol not found' : e2.message}`);
  }
};

// ---------------- FX Rate (USD -> INR) ----------------
Market.fetchUsdInr = async function () {
  const cacheKey = 'fx_usdinr';
  const cached = Store.getPriceCache(cacheKey, CACHE_TTL_MS);
  if (cached != null) return cached;

  const settings = Store.getSettings();
  if (settings.fxOverride) return settings.fxOverride;

  try {
    const data = await timedGet('https://api.frankfurter.app/latest?from=USD&to=INR', 'json');
    const rate = data.rates && data.rates.INR;
    if (rate) { Store.setPriceCache(cacheKey, rate); return rate; }
  } catch (e) { /* try fallback below */ }

  try {
    const data2 = await timedGet('https://open.er-api.com/v6/latest/USD', 'json');
    const rate2 = data2.rates && data2.rates.INR;
    if (rate2) { Store.setPriceCache(cacheKey, rate2); return rate2; }
  } catch (e) { /* give up */ }

  return 83; // last-resort static fallback so the app never breaks
};

// ---------------- Bulk refresh ----------------
// Refreshes every holding's price. The three asset classes run in parallel; within each, a few symbols at a time.
// onProgress({done, total}) fires after every holding. Returns { updated:[], failed:[{holding, error}], usdInr }.
Market.refreshAll = async function (onProgress) {
  Market.resetRoutes(); // a manual refresh means "try again now" — forget earlier pauses
  const d = Store.load();
  const { IN_STOCK, IN_MF, US_STOCK } = d.holdings;
  const total = IN_STOCK.length + IN_MF.length + US_STOCK.length;
  const updated = [], failed = [];
  let done = 0, logged = 0;
  const MAX_LOGGED = 6; // don't let one bad refresh flood the 25-entry activity log
  const step = () => { done++; onProgress && onProgress({ done, total }); };
  const nowIso = () => new Date().toISOString();
  const fail = (label, what, e) => {
    failed.push({ holding: label, error: e.message });
    if (logged++ < MAX_LOGGED) Store.log('error', `${what} failed — ${label}: ${e.message}`);
  };

  const fxPromise = Market.fetchUsdInr().catch(() => 83).then(rate => {
    Store.updateSettings({ lastUpdated: Object.assign({}, Store.getSettings().lastUpdated, { fx: nowIso() }) });
    return rate;
  });

  const stocks = runPool(IN_STOCK, Market.config.poolIndia, async (h) => {
    try {
      const q = await Market.fetchNseQuote(h.symbol);
      Store.updateHolding('IN_STOCK', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: q.exchange || 'NSE', previousClose: q.previousClose != null ? q.previousClose : h.previousClose, priceFetchedAt: nowIso() });
      updated.push(h.symbol);
    } catch (e) { fail(h.symbol, 'Price refresh', e); }
    step();
  });

  const funds = runPool(IN_MF, Market.config.poolMf, async (h) => {
    try {
      const q = await Market.fetchMfNav(h.schemeCode);
      // mfapi.in supplies the previous NAV directly. AMFI doesn't: there, a new NAV date means the stored NAV is the
      // previous day's; the same date means keep the earlier value (refreshing twice must not fake a change).
      let prev;
      if (q.previousClose != null) prev = q.previousClose;
      else prev = h.lastPriceAt === q.asOf ? h.previousClose : (h.lastPrice != null ? h.lastPrice : undefined);
      Store.updateHolding('IN_MF', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: q.source || 'AMFI', previousClose: prev, priceFetchedAt: nowIso() });
      updated.push(h.name);
    } catch (e) { fail(h.name, 'NAV refresh', e); }
    step();
  });

  const us = runPool(US_STOCK, Market.config.poolUs, async (h) => {
    try {
      const q = await Market.fetchUsQuote(h.symbol);
      Store.updateHolding('US_STOCK', h.id, { lastPrice: q.price, lastPriceAt: q.asOf, priceSource: q.source || 'AlphaVantage', previousClose: q.previousClose != null ? q.previousClose : h.previousClose, priceFetchedAt: nowIso() });
      updated.push(h.symbol);
    } catch (e) { fail(h.symbol, 'Price refresh', e); }
    step();
  });

  const [usdInr] = await Promise.all([fxPromise, stocks, funds, us]);
  const extra = failed.length > MAX_LOGGED ? ` (first ${MAX_LOGGED} errors logged above)` : '';
  Store.log(failed.length ? 'error' : 'info', `Refresh complete: ${updated.length} updated, ${failed.length} failed${failed.length ? extra : ''}`);
  return { updated, failed, usdInr };
};

Market._internals = { getViaRoutes, runPool, routeState, loadAmfiFile };
window.Market = Market;
