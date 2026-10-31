/* ============================================================
   Finance Tracker — your own tiny price proxy (Cloudflare Worker)
   ============================================================
   Why: browsers can't call Yahoo Finance etc. directly (no CORS
   headers), and free public proxies get rate-limited or blocked.
   This runs under YOUR Cloudflare account (free plan is plenty:
   100,000 requests/day) and does three things:
     1. fetches the price site on the server side, with a normal
        browser User-Agent (Yahoo throttles anonymous clients)
     2. adds the CORS header so your tracker page may read the reply
     3. caches successful replies for 2 minutes
   It ONLY forwards the sites listed in ALLOWED_HOSTS, GET only —
   it cannot be used as a general-purpose open proxy.

   Setup is in README.md → "Run your own proxy".
   ============================================================ */

const ALLOWED_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'www.amfiindia.com',
  'portal.amfiindia.com',
  'api.mfapi.in',
  'www.nseindia.com'
];

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CACHE_SECONDS = 120;

export default {
  async fetch(request, env, ctx) {
    // Optional hardening: in the Worker's Settings → Variables add ALLOWED_ORIGIN = https://YOURNAME.github.io
    // so only your own site can use it. Left unset, any page may call it (it still only reaches ALLOWED_HOSTS).
    const cors = {
      'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'X-FT-Proxy',
      'X-FT-Proxy': '1', // lets the tracker tell "my proxy relayed a real 404" from "this URL isn't my proxy"
      'Vary': 'Origin'
    };
    const reply = (body, status) => new Response(body, { status, headers: cors });

    if (request.method === 'OPTIONS') return reply(null, 204);
    if (request.method !== 'GET') return reply('GET only', 405);

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) {
      // opening the Worker's address in a browser should confirm it is alive (the tracker's "Test price sources" also checks this)
      if (reqUrl.pathname === '/' && !reqUrl.search) {
        return reply('Finance Tracker proxy is running ✓\n\nIn the tracker: Settings → CORS proxy base URL = this address followed by /?url=', 200);
      }
      return reply('Usage: ?url=<address-of-the-price-page, URL-encoded>', 400);
    }

    let t;
    try { t = new URL(target); } catch (e) { return reply('That is not a valid address', 400); }
    if (t.protocol !== 'https:' || !ALLOWED_HOSTS.includes(t.hostname)) {
      return reply('Host not allowed: ' + t.hostname, 403);
    }

    const cache = caches.default;
    const cacheKey = new Request(t.toString());
    let res = await cache.match(cacheKey);

    if (!res) {
      let upstream;
      try {
        upstream = await fetch(t.toString(), { headers: { 'User-Agent': BROWSER_UA, 'Accept': '*/*' } });
      } catch (e) {
        return reply('Could not reach ' + t.hostname, 502);
      }
      // keep the upstream status (e.g. 404 for an unknown symbol) so the tracker can tell "no such symbol" from "blocked"
      res = new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
      });
      if (upstream.ok) {
        res.headers.set('Cache-Control', 'public, max-age=' + CACHE_SECONDS);
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
    }

    const out = new Response(res.body, res);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  }
};
