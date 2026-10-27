# Changelog

All notable changes to Finance Tracker are logged here — newest at the top.
Each entry is tagged with a version number (`vMAJOR.MINOR.PATCH`): a new
feature bumps MINOR, a fix/tweak bumps PATCH. The current version also
appears in the footer of every page — if what you see live doesn't match
the latest entry here, the site hasn't been redeployed with the newest
build yet.

> **A note on the historical entries below:** they were compiled retroactively
> on 2026-08-24 from our conversation history. Exact clock-times for each past
> session weren't preserved anywhere I could pull them from, so the entries
> below are grouped by update batch (in the order they happened) rather than
> stamped with a fabricated time of day. Version numbers were assigned
> retroactively too, in the order the batches happened. **From this entry
> onward, every change gets a real date/time and the next version number.**

---

## v1.12.0 — 2026-10-27 02:52 UTC — Tables that fit without sideways scrolling
- **Measured first**: before changing anything, the widest tables were measured at five common screen widths (1280, 1366, 1440, 1536, 1920 px) with realistic data (long company and fund names, tags, US dual-currency figures). Indian Stocks was 322 px too wide at 1280 and still 66 px too wide at 1920, because the page was capped at 1320 px; Mutual Funds was worse.
- **Changed**: the page content area now grows up to 1760 px on large monitors (was 1320 px), so wide screens actually use their width.
- **Changed**: table cells use slightly tighter side padding; column headers may wrap onto two lines (e.g. "Today's / Change") instead of stretching the column; and the first column (symbol / scheme name, with its sub-line) wraps instead of forcing the table wider. On windows 1320 px wide or narrower, tables are a touch denser still.
- **Changed**: the five summary boxes on the stock and fund pages now fit on one row down to ~1280 px wide (the new Today's Change box was dropping onto a row of its own); on phones, an odd last box spans the full width.
- **Fixed**: on phones, large summary figures (such as a big loss with its minus sign) wrapped across two lines — they now scale to fit the card on one line.
- **Result**: Indian Stocks, US Stocks, Mutual Funds, both dividend tables, Fixed Deposits, and the Dashboard table all fit with no sideways scrolling at every width tested. A very narrow window or a table with unusually long content can still scroll sideways inside its own card, as a last resort. Phones are unchanged in behaviour (tables scroll within their card; the page itself never scrolls sideways — checked at 360, 390, and 430 px).
- **Verified**: width measurements across 5 screen widths × 7 tables, plus a full re-run of every earlier test suite against the new styling — 37 collapsible/glow/nav checks, 17 Today's Change checks, 38 bulk-selection checks, 19 logic checks — all passing, no page errors.

---

## v1.11.0 — 2026-10-25 09:30 UTC — Checkbox selection and bulk actions
- **Changed**: the Indian Stocks, US Stocks, and Mutual Funds holdings tables and all four dividend tables (the three account tables and the US table) now have a checkbox on every row plus a select-all box in the header. The per-row Txns / Tags / Price / Del buttons are gone, which frees a whole column of width.
- **Added**: **Edit**, **Price**, **Tags**, and **Delete** buttons in the top-right corner of each table's header (Dividends have Edit and Delete only; Mutual Funds have no Tags). **Edit** and **Price** work on exactly one checked row and are greyed out otherwise; **Tags** and **Delete** work on one or many. Edit on the stock and fund pages opens that holding's Transactions; on Dividends it opens the entry's edit dialog.
- **Added**: bulk Tags — with several holdings checked, the tag you pick is added to all of them; with one checked, the full add/remove view opens as before.
- **Added**: Delete asks for confirmation first, listing what will be removed, and clears the selection afterwards.
- **Changed**: checking boxes updates the page in place rather than redrawing it, so text typed in an Add form and your scroll position are not lost. Selections survive sorting. Each dividend table keeps its own independent selection.
- **Unchanged**: Fixed Deposits keeps its per-row Edit / Del buttons (not in scope for this change).
- **Fixed**: with the checkbox column in front, the Symbol / Scheme column briefly became right-aligned — it is left-aligned again, while numeric columns stay right-aligned.
- **Verified**: 43 automated browser checks — one row vs several rows enabling/greying the right buttons, select-all and partial state, row highlighting, Edit opening the right holding, header buttons not collapsing the table, selection surviving a sort, typed form text surviving a checkbox click, bulk tag and bulk delete on stocks, funds and each dividend table, tables not affecting each other, Fixed Deposits unchanged, and column alignment — all passing, no page errors.

---

## v1.10.0 — 2026-10-20 10:06 UTC — Today's Change
- **Added**: a **Today's Change** column on Indian Stocks, US Stocks, and Mutual Funds, placed right after Current Value — the day's move in rupees with the % move underneath, green for gains and red for losses, sortable like the other columns.
- **Added**: a **Today's Change** box on each of those three pages, right after Gain / Loss, totalling the whole page's portfolio (amount and % against the previous day's value). If only some holdings have data it says so, e.g. "2 of 4 holdings".
- **Changed**: price refresh now also saves each holding's previous close — from Yahoo (NSE/BSE), NSE's official quote, or Alpha Vantage (US). AMFI publishes no previous NAV, so for funds the earlier NAV is used, and only when the NAV date has actually changed (refreshing twice in one day cannot create a fake change).
- **Note**: the change is measured against the previous close **as of your last price refresh**. It shows a dash for manually priced holdings, holdings never refreshed since this update (click refresh once to populate), prices last refreshed more than 4 days ago (4 days so a weekend still shows Friday's move), and fully sold holdings. US stock changes are converted to INR at the current rate.
- **Verified**: 19 logic checks (change maths incl. bonus shares and USD conversion, the stale/manual/no-previous-close cases, and the refresh rules for stocks, US stocks and funds) and 17 browser checks on rendered pages (column position, values, dashes, summary box, sorting) — all passing, no page errors.
- **Not verified live**: the sandbox can't reach the live price services, so the exact field each service returns for "previous close" is unconfirmed until you refresh prices on the deployed site. If a column stays on dashes after refreshing, tell me which page and I'll investigate.

---

## v1.9.0 — 2026-10-13 12:34 UTC — Collapsible sections, glow bars, mobile nav order
- **Added**: the Add / Import sections on Indian Stocks, US Stocks, Mutual Funds, Fixed Deposits, and Dividends (both the Indian and US forms) now start collapsed behind a small arrow — click the section header to open it only when you have something to add. Clicking the Import button inside a header does not toggle it.
- **Added**: the Holdings tables on Indian Stocks, US Stocks, and Mutual Funds, the three Dividend account tables, and the US dividend history table are collapsible the same way (they start expanded). Each section's open/closed state is remembered between visits and survives edits and re-renders. The Fixed Deposits holdings table and Maturity Timeline stay always visible.
- **Added**: slow, subtle moving glow on the progress bars under Fixed Deposits → Maturity Timeline and the Dashboard's Top holdings by weight, suggesting the bar is filling toward the right. Respects the reduced-motion setting.
- **Changed**: mobile bottom navigation now includes every page (EPF and Dividends were previously missing) with Settings always the last button; the bar scrolls sideways if the screen is too narrow for all eight items.
- **Verified**: 38 automated browser checks (collapsed/expanded defaults, toggling, Import button not toggling, state remembered across reloads, glow animation applied, mobile nav order, mobile Settings opening the modal) with no page errors.

---

## v1.8.1 — 2026-10-08 09:58 UTC — Version tracking and documentation cleanup
- **Added**: version number now shown at the end of every page's footer (single source of truth: `APP_VERSION` in `js/app.js`), so you can always confirm which build is actually live.
- **Added**: every CHANGELOG entry is now tagged with a version number, following `vMAJOR.MINOR.PATCH` (new feature = minor bump, fix/tweak = patch bump). Historical entries were numbered retroactively in the order they happened.
- **Changed**: README fully rewritten — the "What's new" section had accumulated duplicated and stale bullets from repeated updates, so it was replaced with a pointer to this file (the CHANGELOG is now the single place for change history). README now also documents Dividends, tags/owner chips, BONUS shares, BSE fallback, and the current data.json schema, none of which it covered before.
- **Changed**: removed leftover wording in a prior changelog entry referring to specific family-account tag presets.
- **Verified**: full integrity pass — all 31 files present, all JS syntactically valid, JSON files valid, `data.json` ships empty (no test data), every HTML script/link reference resolves to a real file, and the service worker's offline cache list exactly matches what's on disk.

---

## v1.8.0 — 2026-08-26 — US dividend tax withholding
- **Added**: `Tax Withheld` column to the US dividend history table. Column order is now Symbol, Date, Qty, Dividend/Share, Dividend Received, Tax Withheld, Total Dividend (Amount in INR and Notes follow).
- **Changed**: US dividend entries now track gross `Dividend Received` and `Tax Withheld` separately — Total Dividend auto-calculates as Received minus Tax (still editable). Applies to manual entry, CSV import (new `Dividend Received` / `Tax Withheld` columns, with the old single `Total dividend` column still accepted for backward compatibility), and the edit modal.
- **Added**: a small line in the "From US Stocks" summary card at the top of the Dividends page showing total tax withheld across all US dividends.

---

## v1.7.0 — 2026-08-25 — Multi-account dividend tracking
- **Added**: Indian stock dividends can now be split across 3 user-nameable "accounts" (e.g. rename to your own names) — each with its own separate history table, its own running total card, and its own row in the manual-entry form's account dropdown. Renaming is done inline right on the account's summary card.
- **Changed**: US stock dividends are now fully separate from Indian ones — their own "Log a dividend" form, own "Import CSV/Excel" button, own history table — never merged into the same rows/columns as Indian entries. US amounts shown with INR as the primary figure and USD as smaller text underneath, both in the top summary card and per-row in the table.
- **Added**: multi-sheet Excel import for Indian dividends — upload one .xlsx with up to 3 sheet tabs (one per account, in order); a missing or empty sheet is skipped with no error, so accounts with nothing to import are simply left out.
- **Added**: new "Total Dividends Earned" card on the main Dashboard — combines Indian (all accounts) + US (converted to INR), links through to the Dividends page.
- **Changed**: top summary cards on the Dividends page now correctly total across all 3 Indian accounts plus US, rather than assuming a single Indian pool.

---

## v1.6.0 — Account tags, BSE fallback, Zerodha import, bonus shares
- **Added**: 1–2 letter "owner" account tag on individual transactions (e.g. `AR`, `AS`, `RN`) — a small circle shown before the Date column in both the transactions modal and the purchase-lot tooltip. Editable per-transaction in the UI, and importable via a new optional `Owner` column in the CSV/Excel importer.
- **Added**: `BONUS` transaction type for bonus share issues — enter quantity received, price stays at 0. Correctly dilutes average cost per share without changing invested amount.
- **Fixed**: a real bug where entering a purchase price of exactly `0` was rejected by form validation as if the field were empty — this was blocking bonus-share entry entirely.
- **Changed**: Indian stock price lookup now tries NSE first, then falls back to BSE (for NSE-only-listed misses like NSDL, POLYMED), before trying NSE's official API as a last resort.
- **Changed**: Dividends CSV import column order and headers now match Zerodha Console's dividend report export exactly (`Symbol`, `Ex-date`, `Qty`, `Dividend per share`, `Total dividend`), so that file can be downloaded from Zerodha and imported here with no editing.

## v1.5.0 — CSV/Excel import, Dividends page, tooltip polish
- **Added**: CSV/Excel import for stock and mutual fund transactions, with an info tooltip listing the exact required columns and a downloadable template file.
- **Added**: new **Dividends** page — manual entry or CSV/Excel import, tracks both Indian and US stock dividends, with total/yearly/per-market breakdowns and a sortable history table.
- **Changed**: purchase-lot tooltip — removed the redundant "Cost" column (it was just Qty×Price, already visible as separate columns).
- **Fixed**: tooltip popover was clipping text that exceeded its fixed width — it now sizes itself to fit its content.

## v1.4.0 — Activity log, editable entries, fee separation, hover charts
- **Added**: activity log under Settings — every add/edit/delete and price-refresh result is recorded (errors flagged distinctly), saved into `data.json` itself, capped at the most recent 25 entries.
- **Added**: ability to edit existing stock, mutual fund, and FD entries (previously delete-and-re-add was the only option).
- **Added**: hover interactivity on the "Allocation by asset class" donut charts — hovering a segment pops it slightly and shows a tooltip with the exact label and value.
- **Fixed**: the "i" info button was rendering as an oval, not a circle (a CSS padding conflict) — now a clean, smaller perfect circle.
- **Fixed**: purchase-lot tooltip was rounding small decimal costs down to a misleading "0" — now shows full precision with no rounding, specifically for US stock quantities/prices/costs.
- **Changed**: Avg Cost now excludes brokerage/fees (shown separately, itemized per lot, with a running total) instead of blending fees into the displayed price. Applies to both Indian and US stocks.
- **Changed**: reduced Indian-stock tag presets down to just "IPO" plus a free-text custom tag (removed the other family-account presets, which took up too much space).
- **Added**: sortable Tags column on the Indian Stocks table.
- **Confirmed** (no code change needed): Alpha Vantage API key and CORS proxy URL were already being saved into `data.json` and correctly restored on import — verified this works end-to-end.

## v1.3.0 — Settings/sidebar fixes, renamed pages, FD days, dual currency, tags
- **Fixed**: Settings button in the sidebar was rendering oversized (icon had no size constraint outside the nav).
- **Fixed**: hamburger icon on desktop did nothing — now toggles a proper icon-only collapsed sidebar (previously only worked as a mobile overlay).
- **Changed**: renamed "Stocks [IND]" → **Indian Stocks** and "Stocks [US]" → **US Stocks** throughout the site.
- **Added**: Fixed Deposit tenure can now be entered in days as well as months (for FDs like "555 days" that don't round to whole months).
- **Added**: dual-currency display on the US Stocks page — INR as the primary figure, USD shown as a smaller line underneath, in both summary cards and the table.
- **Added**: purchase-lot info tooltip (the small "i" next to Qty) showing every buy lot's date/quantity/price/cost.
- **Added**: sortable column headers on the Stocks and Mutual Funds tables.
- **Added**: tags on Indian Stocks to mark holdings (e.g. IPO allotment, held on a family member's broker account).
- **Investigated/improved**: mutual fund NAVs and Indian stock prices not updating — added a multi-proxy fallback chain for NSE/AMFI fetches and switched the primary Indian-stock data source to Yahoo Finance for better reliability.

## v1.2.0 — Full UI redesign
- **Changed**: dropped the monochrome black-and-white terminal aesthetic entirely for a proper light/dark fintech design system — Inter for UI text, IBM Plex Mono for tabular numerals, a left sidebar with a mobile bottom-nav fallback, color-coded allocation charts, and a live-price "freshness pulse" indicator on every quoted price.
- **Added**: light/dark theme toggle, remembers your preference, defaults to your OS setting.

## v1.1.0 — Live price reliability fixes
- **Fixed**: a caching bug in the USD/INR exchange-rate lookup was silently producing `NaN` for US stock Invested/Current Value/P&L, while leaving LTP looking fine — root-caused and fixed at the source.
- **Improved**: NSE and AMFI price fetches given a multi-proxy fallback chain after continued reports of failures, since single public CORS proxies are individually unreliable.

## v1.0.0 — Initial build
- **Added**: Finance Tracker site — Dashboard, Indian Stocks, US Stocks, Mutual Funds, Fixed Deposits, and EPF pages.
- **Added**: file-based persistence (`data/data.json` as the source of truth, editable by hand or via the UI, exportable/re-importable to sync across devices).
- **Added**: live price integration — NSE stocks, AMFI mutual fund NAVs, Alpha Vantage for US stocks, live USD/INR conversion.
- **Added**: EPF engine — EPFO-accurate monthly-running-balance interest, EPS contribution split from salary, auto-accruing monthly contributions, and a forward balance projection chart.
- **Added**: XIRR, average cost, and P&L calculations across all asset classes.
- **Added**: PWA support (installable, works offline for the UI).
