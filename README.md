# Finance Tracker

**Current version: v1.9.0** — see [CHANGELOG.md](CHANGELOG.md) for the full history of what's changed. The same version number is shown in the footer of every page, so you can confirm a deployment is actually live.

A local-first personal investment tracker with a light/dark theme system built for a data-dense fintech feel — not a generic dashboard template. Seven pages: Dashboard, Indian Stocks (NSE/BSE), US Stocks (incl. ETFs), Mutual Funds, Fixed Deposits, EPF, and Dividends. Live prices for NSE/BSE stocks, mutual fund NAVs, and US stocks/ETFs.

**Design**: Inter for UI text, IBM Plex Mono (tabular numerals) for money figures and ticker symbols. Every live-fetched price shows a small freshness pulse — green (refreshed <15 min ago), amber (stale, refresh recommended), or gray (manually entered) — so you can see at a glance which numbers are current. Light/dark toggle in the header, remembers your choice, defaults to your OS setting on first visit.

## Pages

- **`index.html`** — Dashboard: totals, gain/loss, XIRR, diversification metrics, allocation donut, top holdings by weight, full holdings table, invested-vs-current chart, total dividends earned.
- **`stocks-ind.html`** — Indian Stocks: NSE/BSE holdings, qty, avg cost (ex-fees), LTP, current value, P&L, % change, weight, XIRR, purchase-lot tooltip, tags, account-ownership chips.
- **`stocks-us.html`** — US Stocks: same breakdown for US stocks/ETFs, dual-currency (INR primary, USD secondary) throughout.
- **`mutual-funds.html`** — individual fund holdings, units, NAV, P&L, XIRR, category breakdown.
- **`fixed-deposits.html`** — principal, rate, interest accrued so far, value at maturity (tenure in months or days), maturity timeline, editable entries.
- **`epf.html`** — accounts, EPS-aware contribution split, auto-accruing monthly contributions, forward balance projection graph.
- **`dividends.html`** — Indian dividends split across 3 user-nameable accounts (separate history tables + totals each), a fully separate US dividends section with gross/tax-withheld/net tracking, yearly breakdown, CSV/Excel import for both (Indian import matches Zerodha Console's export format exactly).

## How your data persists — read this first

This is a static site with no backend, so there's no real database. The mechanism here is honest but manual:

- **`data/data.json`** is the single source of truth, shipped with the site. You can **hand-edit this file directly** (it's plain JSON — see the schema below) or use the forms on each page.
- On first visit in a browser, the site fetches `data/data.json` and caches a working copy in that browser's `localStorage`, so your edits survive page refreshes without needing to re-save constantly.
- To make edits visible on **another device or browser**, click **save-to-file** in the top bar (or Settings). This downloads an updated `data.json` — replace `data/data.json` in your repo with it and commit. Anyone loading the page after that sees the update.
- **Reload-from-file** (in Settings) discards local edits in the current browser and re-reads `data/data.json` — use this after committing an update from elsewhere.
- **Activity log** (Settings): every add/edit/delete and price-refresh result is recorded here too, capped at the most recent 25 entries, so it travels with your data file.

This is **not live multi-device sync** — there's a manual "commit the file" step — but it's the real mechanism a backend-less GitHub Pages site can offer.

### Editing `data/data.json` by hand

Top-level shape:

```json
{
  "holdings": {
    "IN_STOCK": [ { "id": "...", "symbol": "RELIANCE", "name": "Reliance Industries", "exchange": "NSE", "tags": ["IPO"],
                    "txns": [ { "id": "...", "date": "2024-01-10", "type": "BUY", "qty": 10, "price": 2400, "fees": 20, "owner": "AR" },
                              { "id": "...", "date": "2025-07-18", "type": "BONUS", "qty": 5, "price": 0, "fees": 0, "owner": "AR" } ] } ],
    "IN_MF":    [ { "id": "...", "schemeCode": "120503", "name": "Axis Bluechip Fund - Direct Growth", "category": "Large Cap", "folio": "12345",
                    "txns": [ { "id": "...", "date": "2023-06-01", "type": "BUY", "qty": 500, "price": 40, "fees": 0 } ] } ],
    "US_STOCK": [ { "id": "...", "symbol": "AAPL", "name": "Apple Inc", "exchange": "US",
                    "txns": [ { "id": "...", "date": "2023-03-01", "type": "BUY", "qty": 5, "price": 150, "fees": 1 } ] } ],
    "FD":       [ { "id": "...", "bank": "HDFC Bank", "principal": 200000, "rate": 7.1, "startDate": "2024-01-01",
                    "tenureUnit": "days", "tenureValue": 555, "compounding": "quarterly" } ],
    "EPF":      [ { "id": "...", "employerName": "Acme Corp", "uan": "1234567890", "openingBalance": 150000, "openingDate": "2022-04-01",
                    "recurring": { "active": true, "mode": "salary", "basicSalary": 50000, "startDate": "2022-04-01",
                                    "employeeAmt": 6000, "employerEpfAmt": 4751, "employerEpsAmt": 1250 },
                    "interestRates": [ { "fyLabel": "2023-24", "ratePct": 8.15 }, { "fyLabel": "2024-25", "ratePct": 8.25 } ],
                    "txns": [] } ]
  },
  "dividends": [
    { "id": "...", "assetType": "IN_STOCK", "symbol": "NTPC", "date": "2025-09-04", "qty": 1, "perShare": 3.35, "amount": 3.35, "currency": "INR", "notes": "", "account": 1 },
    { "id": "...", "assetType": "US_STOCK", "symbol": "AAPL", "date": "2024-08-15", "qty": 10, "perShare": 0.25, "grossAmount": 2.5, "taxWithheld": 0.63, "amount": 1.87, "currency": "USD", "notes": "" }
  ],
  "dividendAccounts": [ { "id": 1, "name": "Account 1" }, { "id": 2, "name": "Account 2" }, { "id": 3, "name": "Account 3" } ],
  "activityLog": [ { "ts": "2026-08-26T10:00:00.000Z", "level": "info", "message": "Added Indian Stocks holding: RELIANCE" } ],
  "settings": { "baseCurrency": "INR", "apiKeys": { "alphaVantage": "" }, "corsProxy": "https://corsproxy.io/?url=", "fxOverride": null }
}
```

IDs can be any unique string when hand-editing (e.g. `"s1"`, `"mf-axis"`). Dates are always `YYYY-MM-DD`. Money is INR for `IN_STOCK`/`IN_MF`/`FD`/`EPF`; `US_STOCK` transaction prices and dividends are USD. `FD` tenure uses `tenureUnit` (`"months"` or `"days"`) + `tenureValue` (the older `tenureMonths`-only field is still read for backward compatibility). Stock `txns` support `type: "BONUS"` for free bonus-issue shares (price 0, dilutes average cost correctly without changing invested amount) and an optional 1–2 letter `owner` tag per transaction (e.g. to track which family member's broker account a lot sits in).

## Deploying to GitHub Pages

1. Upload the whole folder to your repo, keeping `js/`, `css/`, `icons/`, `data/` as siblings of `index.html`.
2. Repo Settings → Pages → set source to the branch/folder you pushed.
3. Visit the published URL. Any device that loads it reads the same `data/data.json`.
4. Optional: "Add to Home Screen" (Android Chrome / iOS Safari) installs it like an app.

## Live price setup

Open **Settings** (top bar) on any page:

| Source | Setup | Notes |
|---|---|---|
| Indian Stocks | none — routed through a CORS proxy | Price lookup tries NSE first, then falls back to BSE (for NSE-only-listed misses like NSDL, POLYMED), then NSE's official API as a last resort. Swap the proxy or set a manual price per row if it stops working. |
| Mutual Funds | none | Uses AMFI's free daily NAV file, matched by scheme code. |
| US Stocks | Alpha Vantage API key (free) | Get one at alphavantage.co/support/#api-key. Free tier is rate-limited (25 requests/day) — refresh sparingly with many US holdings. |
| USD → INR | none | frankfurter.app (ECB rates) with a fallback; pin a manual rate in Settings if you prefer. |

**Refresh prices** (top bar) pulls fresh prices + FX. Cached 15 minutes locally to avoid hammering free APIs. If a symbol won't resolve, use the **price** button on that row for a manual value — used until the next successful live fetch. Manually-priced holdings don't show a "Today's Change," since there's no live previous-close to compare against.

## Tags & account ownership (Indian Stocks)

- **Tags**: mark a holding as an IPO allotment, or add any free-text custom tag — shown as small badges, sortable as their own column.
- **Owner chips**: a tiny 1–2 letter circle on each individual transaction (e.g. `AR`, `AS`, `RN`) — useful when the same stock is held across multiple family members' broker accounts, so you can see at a glance which lot belongs to whom. Editable per-transaction in the UI, or bulk-set via an optional `Owner` column in the CSV/Excel importer.

## Dividends

- Indian dividends are split across **3 user-nameable accounts** (rename them to whatever you like — the app never hardcodes "mine/spouse's/parent's", etc.) — each with its own history table and running total.
- US dividends are kept in a **fully separate section** — own form, own import, own table — never merged into the Indian rows.
- US entries track **Dividend Received** (gross) and **Tax Withheld** separately; **Total Dividend** auto-calculates as Received minus Tax (still editable), matching how US brokers commonly withhold ~25% for NRIs under the US–India tax treaty.
- The Indian importer accepts a **multi-sheet Excel file** (up to 3 sheets, one per account, in order) with columns matching **Zerodha Console's dividend report export exactly** (`Symbol`, `Ex-date`, `Qty`, `Dividend per share`, `Total dividend`) — download your Zerodha report and import it with no editing. A missing or empty sheet is skipped silently, no error.

## How the numbers are calculated

- **Stocks / mutual funds**: every logged BUY/SELL/BONUS builds a cash-flow series; XIRR is solved on that plus current value. **Average cost excludes fees** (it's the pure per-share price you paid); fees are itemized separately in the purchase-lot tooltip with a running total. BONUS shares add quantity at zero cost, correctly diluting average cost without touching invested amount or XIRR cash flow.
- **Fixed Deposits**: compound interest (`principal × (1 + rate/n)^(n×years)`, `n` = compounding frequency) up to the earlier of today or maturity, then flat at the maturity value. Tenure can be months or days.
- **Portfolio XIRR** (dashboard): pools every cash flow across every holding and asset class into one series and solves once.
- **Diversification metrics** (dashboard): largest single holding as % of portfolio, and an asset-class concentration score (sum of squared class weights ×100 — lower means more evenly spread).
- **Dividends → INR**: USD dividends are converted using the *current* USD/INR rate, not the historical rate on the actual payment date (noted on the Dividends page itself).

## File structure

```
index.html, stocks-ind.html, stocks-us.html,
mutual-funds.html, fixed-deposits.html, epf.html, dividends.html   the seven pages
data/data.json                                       source of truth (hand-editable)
css/theme.css                                         design system — light/dark tokens, sidebar, cards, tables
js/icons.js                                           inline SVG line-icon set
js/theme.js                                           theme state + toggle widget
js/store.js                                          file-based data model + localStorage cache + activity log
js/finance.js                                         XIRR / FD / EPF (+EPS, projection) / BONUS-share math
js/market.js                                          live price fetching + caching (NSE→BSE→official, AMFI, Alpha Vantage)
js/valuation.js                                        combines store + prices into current values
js/charts.js                                          SVG donut/bar/line charts, theme-aware palette, hover tooltips
js/importer.js                                        CSV/Excel import (SheetJS via CDN), incl. multi-sheet support
js/app.js                                             shared sidebar/header, version stamping, save/reload-from-file, settings
js/dashboard.js, js/stocklike.js, js/mutualfunds.js,
js/fixeddeposits.js, js/epf.js, js/dividends.js       per-page logic
manifest.json, sw.js                                  PWA support
robots.txt                                            blocks search-engine indexing
CHANGELOG.md                                          full version history
```

Not investment advice — this is a personal tracking tool.
