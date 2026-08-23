# Finance Tracker

A local-first personal investment tracker with a light/dark theme system built for a data-dense fintech feel — not a generic dashboard template. Six pages: Indian Stocks (NSE), Mutual Funds, US Stocks (incl. ETFs), Fixed Deposits, EPF, plus a dashboard for the full picture. Live prices for NSE stocks, mutual fund NAVs, and US stocks/ETFs.

**Design**: Inter for UI text, IBM Plex Mono (tabular numerals) for money figures and ticker symbols. Every live-fetched price shows a small freshness pulse — green (refreshed <15 min ago), amber (stale, refresh recommended), or gray (manually entered) — so you can see at a glance which numbers are current. Light/dark toggle in the header, remembers your choice, defaults to your OS setting on first visit.

## What's new in this revision

- **CSV/Excel import** on Stocks [Indian/US] and Mutual Funds pages: upload a .csv or .xlsx of transactions, matched to existing holdings by symbol/scheme code (creates new holdings automatically for unmatched symbols). Click the **i** next to the modal title for the exact column list, or **Download template** for a ready-made starting file.
- **Dividends page** (new): log dividends manually or via CSV/Excel import, for both Indian and US stocks. Shows total received, this-year total, per-market totals, a sortable full history, and a yearly breakdown table. USD dividends are converted to INR using the *current* FX rate (not the historical rate on the payment date — noted on the page).
- **Purchase-lot tooltip cleanup**: removed the redundant Cost column (it was just Qty×Price, already visible), keeping Date/Qty/Price/Fees. The popover now sizes itself to fit its content instead of clipping text.
- Fixed a z-index bug where the "i" tooltip could render behind an open modal.

- **Activity log** (Settings): every add/edit/delete and price-refresh result is recorded, with errors flagged distinctly. Kept in `data.json` itself (`activityLog` array, capped at the latest 25), so it travels with your data file.
- **Editable transactions**: stock, mutual fund, and FD entries can now be corrected via an **Edit** button, not just deleted and re-added.
- **Purchase-lot tooltip** (the small "i" next to Qty): shows every buy lot's exact date/quantity/price/cost/fees with full decimal precision — no rounding — plus a running fee total. Avg Cost in the main table is now the pure per-share price (fees excluded); fees are itemized separately in the tooltip.
- **Dual-currency display** on the US Stocks page: INR as the primary figure, USD as a smaller line underneath, both in the summary cards and the table.
- **Sortable table headers** (Stocks, Mutual Funds) — click to sort, click again to reverse, including the Tags column.
- **Tags** (Indian Stocks): mark holdings as IPO allotments or anything custom via a free-text tag.
- **Hoverable allocation charts**: hovering a donut segment pops it slightly and shows a tooltip with the exact label/value.
- **Desktop sidebar collapse**: the hamburger icon now toggles an icon-only collapsed sidebar on desktop (not just the mobile overlay).
- Settings (API key, CORS proxy, FX override) are saved into `data.json` and round-trip through export/import.


## Pages

- **`index.html`** — Dashboard: totals, gain/loss, XIRR, diversification metrics, allocation donut, top holdings by weight, full holdings table, invested-vs-current chart.
- **`stocks-ind.html`** — Indian Stocks: NSE holdings, qty, avg cost, LTP, current value, P&L, % change, weight, XIRR.
- **`stocks-us.html`** — US Stocks: same breakdown for US stocks/ETFs, in USD with live INR conversion.
- **`mutual-funds.html`** — individual fund holdings, units, NAV, P&L, XIRR, category breakdown.
- **`fixed-deposits.html`** — principal, rate, interest accrued so far, value at maturity, maturity timeline.
- **`epf.html`** — accounts, EPS-aware contribution split, auto-accruing monthly contributions, and a forward balance projection graph.

## How your data persists — read this first

This is a static site with no backend, so there's no real database. The
mechanism here is honest but manual:

- **`data/data.json`** is the single source of truth, shipped with the site.
  You can **hand-edit this file directly** (it's plain JSON — see the schema
  below) or use the forms on each page.
- On first visit in a browser, the site fetches `data/data.json` and caches
  a working copy in that browser's `localStorage`, so your edits survive
  page refreshes without needing to re-save constantly.
- To make edits visible on **another device or browser**, click **⇩ save to
  file** in the top bar (or Settings). This downloads an updated
  `data.json` — replace `data/data.json` in your repo with it and commit.
  Anyone loading the page after that sees the update.
- **⇧ reload from file** (in Settings) discards local edits in the current
  browser and re-reads `data/data.json` — use this after committing an
  update from elsewhere.

This is **not live multi-device sync** — there's a manual "commit the file"
step — but it's the real mechanism a backend-less GitHub Pages site can
offer, and it means the file itself (not a per-browser cache) is what
"follows you."

### Editing `data/data.json` by hand

Top-level shape:

```json
{
  "holdings": {
    "IN_STOCK": [ { "id": "...", "symbol": "RELIANCE", "name": "Reliance Industries", "exchange": "NSE",
                    "txns": [ { "id": "...", "date": "2024-01-10", "type": "BUY", "qty": 10, "price": 2400, "fees": 20 } ] } ],
    "IN_MF":    [ { "id": "...", "schemeCode": "120503", "name": "Axis Bluechip Fund - Direct Growth", "category": "Large Cap", "folio": "12345",
                    "txns": [ { "id": "...", "date": "2023-06-01", "type": "BUY", "qty": 500, "price": 40, "fees": 0 } ] } ],
    "US_STOCK": [ { "id": "...", "symbol": "AAPL", "name": "Apple Inc", "exchange": "US",
                    "txns": [ { "id": "...", "date": "2023-03-01", "type": "BUY", "qty": 5, "price": 150, "fees": 1 } ] } ],
    "FD":       [ { "id": "...", "bank": "HDFC Bank", "principal": 200000, "rate": 7.1, "startDate": "2024-01-01", "tenureMonths": 24, "compounding": "quarterly" } ],
    "EPF":      [ { "id": "...", "employerName": "Acme Corp", "uan": "1234567890", "openingBalance": 150000, "openingDate": "2022-04-01",
                    "recurring": { "active": true, "mode": "salary", "basicSalary": 50000, "startDate": "2022-04-01",
                                    "employeeAmt": 6000, "employerEpfAmt": 4751, "employerEpsAmt": 1250 },
                    "interestRates": [ { "fyLabel": "2023-24", "ratePct": 8.15 }, { "fyLabel": "2024-25", "ratePct": 8.25 } ],
                    "txns": [] } ]
  },
  "settings": { "baseCurrency": "INR", "apiKeys": { "alphaVantage": "" }, "corsProxy": "https://corsproxy.io/?url=", "fxOverride": null }
}
```

IDs can be any unique string when hand-editing (e.g. `"s1"`, `"mf-axis"`).
Dates are always `YYYY-MM-DD`. Money is INR for `IN_STOCK`/`IN_MF`/`FD`/`EPF`;
`US_STOCK` transaction prices are USD.

## Deploying to GitHub Pages

1. Upload the whole folder to your repo, keeping `js/`, `css/`, `icons/`, `data/` as siblings of `index.html`.
2. Repo Settings → Pages → set source to the branch/folder you pushed.
3. Visit the published URL. Any device that loads it reads the same `data/data.json`.
4. Optional: "Add to Home Screen" (Android Chrome / iOS Safari) installs it like an app.

## Live price setup

Open **Settings** (top bar) on any page:

| Source | Setup | Notes |
|---|---|---|
| Indian Stocks (NSE) | none — routed through a CORS proxy | NSE has no public CORS-enabled API; the app tries a direct request, then the proxy URL in Settings. Swap the proxy or set a manual price per row if it stops working. |
| Mutual Funds | none | Uses AMFI's free daily NAV file, matched by scheme code. |
| US Stocks | Alpha Vantage API key (free) | Get one at alphavantage.co/support/#api-key. Free tier is rate-limited (25 requests/day) — refresh sparingly with many US holdings. |
| USD → INR | none | frankfurter.app (ECB rates) with a fallback; pin a manual rate in Settings if you prefer. |

**↻ refresh prices** (top bar) pulls fresh NSE/MF/US prices + FX. Cached 15
minutes locally to avoid hammering free APIs. If a symbol won't resolve, use
the **price** button on that row for a manual value — used until the next
successful live fetch.

## EPF specifics

- **EPS split**: entering a monthly basic+DA auto-computes the standard
  EPFO split — employee 12% of basic to EPF; employer 12% of basic split
  into 8.33% (capped at ₹1,250, based on the ₹15,000 EPS wage ceiling) to
  the **EPS pension pool**, remainder to the **EPF account**. EPS is shown
  separately since it funds a monthly pension rather than earning account
  interest like the EPF corpus.
- **Auto-accrual**: once you save a monthly contribution (manual amounts or
  salary-based), it's applied every month from its start date up to today
  automatically — no need to log each month by hand. Interest compounds
  using EPFO's actual method: monthly interest on the running balance,
  summed and credited at each financial year-end (March).
- **Projection graph**: continues the current contribution rate (with an
  optional annual step-up for raises) forward at an assumed interest rate,
  and charts the balance growth.
- One-off manual transactions are still available for lump sums (e.g. a PF
  transfer-in from a previous employer) via hand-editing `data.json`'s
  `txns` array on that holding.

## How the numbers are calculated

- **Stocks / mutual funds**: every logged BUY/SELL builds a cash-flow
  series; XIRR is solved on that plus current value. Average cost and
  invested amount are net of sells.
- **Fixed Deposits**: compound interest (`principal × (1 + rate/n)^(n×years)`,
  `n` = compounding frequency) up to the earlier of today or maturity, then
  flat at the maturity value.
- **Portfolio XIRR** (dashboard): pools every cash flow across every
  holding and asset class into one series and solves once.
- **Diversification metrics** (dashboard): largest single holding as % of
  portfolio, and an asset-class concentration score (sum of squared
  class weights ×100 — lower means more evenly spread).

## File structure

```
index.html, stocks-ind.html, stocks-us.html,
mutual-funds.html, fixed-deposits.html, epf.html    the six pages
data/data.json                                       source of truth (hand-editable)
css/theme.css                                         design system — light/dark tokens, sidebar, cards, tables
js/icons.js                                           inline SVG line-icon set
js/theme.js                                           theme state + toggle widget
js/store.js                                          file-based data model + localStorage cache
js/finance.js                                         XIRR / FD / EPF (+EPS, projection) math
js/market.js                                          live price fetching + caching
js/valuation.js                                        combines store + prices into current values
js/charts.js                                          SVG donut/bar/line charts, theme-aware palette
js/app.js                                             shared sidebar/header, save/reload-from-file, settings
js/dashboard.js, js/stocklike.js, js/mutualfunds.js,
js/fixeddeposits.js, js/epf.js                        per-page logic
manifest.json, sw.js                                  PWA support
robots.txt                                            blocks search-engine indexing
```

Not investment advice — this is a personal tracking tool.
