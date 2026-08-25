# Changelog

All notable changes to Finance Tracker are logged here — newest at the top.

> **A note on the historical entries below:** they were compiled retroactively
> on 2026-08-24 from our conversation history. Exact clock-times for each past
> session weren't preserved anywhere I could pull them from, so the entries
> below are grouped by update batch (in the order they happened) rather than
> stamped with a fabricated time of day. **From this entry onward, every
> change gets a real date/time** recorded at the moment it's made.

---

## 2026-08-25 — Multi-account dividend tracking
- **Added**: Indian stock dividends can now be split across 3 user-nameable "accounts" (e.g. rename to your own names) — each with its own separate history table, its own running total card, and its own row in the manual-entry form's account dropdown. Renaming is done inline right on the account's summary card.
- **Changed**: US stock dividends are now fully separate from Indian ones — their own "Log a dividend" form, own "Import CSV/Excel" button, own history table — never merged into the same rows/columns as Indian entries. US amounts shown with INR as the primary figure and USD as smaller text underneath, both in the top summary card and per-row in the table.
- **Added**: multi-sheet Excel import for Indian dividends — upload one .xlsx with up to 3 sheet tabs (one per account, in order); a missing or empty sheet is skipped with no error, so accounts with nothing to import are simply left out.
- **Added**: new "Total Dividends Earned" card on the main Dashboard — combines Indian (all accounts) + US (converted to INR), links through to the Dividends page.
- **Changed**: top summary cards on the Dividends page now correctly total across all 3 Indian accounts plus US, rather than assuming a single Indian pool.

---

## Batch 7 — Account tags, BSE fallback, Zerodha import, bonus shares
- **Added**: 1–2 letter "owner" account tag on individual transactions — a small circle shown before the Date column in both the transactions modal and the purchase-lot tooltip. Editable per-transaction in the UI, and importable via a new optional `Owner` column in the CSV/Excel importer.
- **Added**: `BONUS` transaction type for bonus share issues — enter quantity received, price stays at 0. Correctly dilutes average cost per share without changing invested amount.
- **Fixed**: a real bug where entering a purchase price of exactly `0` was rejected by form validation as if the field were empty — this was blocking bonus-share entry entirely.
- **Changed**: Indian stock price lookup now tries NSE first, then falls back to BSE (for NSE-only-listed misses like NSDL, POLYMED), before trying NSE's official API as a last resort.
- **Changed**: Dividends CSV import column order and headers now match Zerodha Console's dividend report export exactly (`Symbol`, `Ex-date`, `Qty`, `Dividend per share`, `Total dividend`), so that file can be downloaded from Zerodha and imported here with no editing.

## Batch 6 — CSV/Excel import, Dividends page, tooltip polish
- **Added**: CSV/Excel import for stock and mutual fund transactions, with an info tooltip listing the exact required columns and a downloadable template file.
- **Added**: new **Dividends** page — manual entry or CSV/Excel import, tracks both Indian and US stock dividends, with total/yearly/per-market breakdowns and a sortable history table.
- **Changed**: purchase-lot tooltip — removed the redundant "Cost" column (it was just Qty×Price, already visible as separate columns).
- **Fixed**: tooltip popover was clipping text that exceeded its fixed width — it now sizes itself to fit its content.

## Batch 5 — Activity log, editable entries, fee separation, hover charts
- **Added**: activity log under Settings — every add/edit/delete and price-refresh result is recorded (errors flagged distinctly), saved into `data.json` itself, capped at the most recent 25 entries.
- **Added**: ability to edit existing stock, mutual fund, and FD entries (previously delete-and-re-add was the only option).
- **Added**: hover interactivity on the "Allocation by asset class" donut charts — hovering a segment pops it slightly and shows a tooltip with the exact label and value.
- **Fixed**: the "i" info button was rendering as an oval, not a circle (a CSS padding conflict) — now a clean, smaller perfect circle.
- **Fixed**: purchase-lot tooltip was rounding small decimal costs down to a misleading "0" — now shows full precision with no rounding, specifically for US stock quantities/prices/costs.
- **Changed**: Avg Cost now excludes brokerage/fees (shown separately, itemized per lot, with a running total) instead of blending fees into the displayed price. Applies to both Indian and US stocks.
- **Changed**: reduced Indian-stock tag presets down to just "IPO" plus a free-text custom tag.
- **Added**: sortable Tags column on the Indian Stocks table.
- **Confirmed** (no code change needed): Alpha Vantage API key and CORS proxy URL were already being saved into `data.json` and correctly restored on import — verified this works end-to-end.

## Batch 4 — Settings/sidebar fixes, renamed pages, FD days, dual currency, tags
- **Fixed**: Settings button in the sidebar was rendering oversized (icon had no size constraint outside the nav).
- **Fixed**: hamburger icon on desktop did nothing — now toggles a proper icon-only collapsed sidebar (previously only worked as a mobile overlay).
- **Changed**: renamed "Stocks [IND]" → **Indian Stocks** and "Stocks [US]" → **US Stocks** throughout the site.
- **Added**: Fixed Deposit tenure can now be entered in days as well as months (for FDs like "555 days" that don't round to whole months).
- **Added**: dual-currency display on the US Stocks page — INR as the primary figure, USD shown as a smaller line underneath, in both summary cards and the table.
- **Added**: purchase-lot info tooltip (the small "i" next to Qty) showing every buy lot's date/quantity/price/cost.
- **Added**: sortable column headers on the Stocks and Mutual Funds tables.
- **Added**: tags on Indian Stocks to mark holdings (e.g. IPO allotment, held on a family member's broker account).
- **Investigated/improved**: mutual fund NAVs and Indian stock prices not updating — added a multi-proxy fallback chain for NSE/AMFI fetches and switched the primary Indian-stock data source to Yahoo Finance for better reliability.

## Batch 3 — Full UI redesign
- **Changed**: dropped the monochrome black-and-white terminal aesthetic entirely for a proper light/dark fintech design system — Inter for UI text, IBM Plex Mono for tabular numerals, a left sidebar with a mobile bottom-nav fallback, color-coded allocation charts, and a live-price "freshness pulse" indicator on every quoted price.
- **Added**: light/dark theme toggle, remembers your preference, defaults to your OS setting.

## Batch 2 — Live price reliability fixes
- **Fixed**: a caching bug in the USD/INR exchange-rate lookup was silently producing `NaN` for US stock Invested/Current Value/P&L, while leaving LTP looking fine — root-caused and fixed at the source.
- **Improved**: NSE and AMFI price fetches given a multi-proxy fallback chain after continued reports of failures, since single public CORS proxies are individually unreliable.

## Batch 1 — Initial build
- **Added**: Finance Tracker site — Dashboard, Indian Stocks, US Stocks, Mutual Funds, Fixed Deposits, and EPF pages.
- **Added**: file-based persistence (`data/data.json` as the source of truth, editable by hand or via the UI, exportable/re-importable to sync across devices).
- **Added**: live price integration — NSE stocks, AMFI mutual fund NAVs, Alpha Vantage for US stocks, live USD/INR conversion.
- **Added**: EPF engine — EPFO-accurate monthly-running-balance interest, EPS contribution split from salary, auto-accruing monthly contributions, and a forward balance projection chart.
- **Added**: XIRR, average cost, and P&L calculations across all asset classes.
- **Added**: PWA support (installable, works offline for the UI).
