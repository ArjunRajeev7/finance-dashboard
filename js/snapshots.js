/* ============================================================
   snapshots.js — month-end net worth snapshots
   ============================================================
   A static site can't run on a schedule, so snapshots are taken
   when you use the app:
     • the CURRENT month's snapshot is created the first time you
       open any page that month, and refreshed at most once a day
       (and right after a successful price refresh)
     • when a new month starts, the previous month's snapshot is
       simply left as it was last updated — that is its month-end value
     • a month you typed in by hand is never overwritten automatically
   Net worth = the total of the tracked asset classes (the same
   "Current Value" the Dashboard shows) — no loans, property or cash.
   ============================================================ */

const Snapshots = {};
Snapshots.CLASSES = ['IN_STOCK', 'IN_MF', 'US_STOCK', 'FD', 'EPF'];

const _r2 = (n) => Math.round((n || 0) * 100) / 100;

// What your portfolio is worth right now, from the latest prices stored in this browser.
Snapshots.live = function () {
  const s = Valuation.snapshot();
  const byClass = {};
  Snapshots.CLASSES.forEach(t => { byClass[t] = _r2(((s.byAssetType[t] || {}).current) || 0); });
  const total = _r2(Snapshots.CLASSES.reduce((sum, t) => sum + byClass[t], 0));
  return { total, invested: _r2(s.totalInvested), byClass, usdInr: s.usdInr };
};

Snapshots.build = (live, date, source) => ({
  month: String(date).slice(0, 7), date, total: live.total, invested: live.invested,
  byClass: live.byClass, usdInr: live.usdInr, source: source || 'auto'
});

// opts: { ever: true }  -> ignore the once-a-day limit (used right after a price refresh)
//       { manualOverride: true } -> may replace a month you entered by hand (the "Take snapshot now" button)
// Returns 'created' | 'updated' | 'skipped' | 'none'.
Snapshots.autoTake = function (opts) {
  opts = opts || {};
  let live;
  try { live = Snapshots.live(); } catch (e) { return 'none'; }
  if (!(live.total > 0)) return 'none'; // nothing tracked yet — don't record an empty month
  const today = Finance.todayStr();
  const month = today.slice(0, 7);
  const existing = Store.getSnapshots().find(s => s.month === month);
  if (existing) {
    if (existing.source === 'manual' && !opts.manualOverride) return 'skipped';
    if (existing.date === today && !opts.ever && !opts.manualOverride) return 'skipped';
    const same = existing.total === live.total && existing.source === 'auto' &&
      Snapshots.CLASSES.every(t => existing.byClass && existing.byClass[t] === live.byClass[t]);
    if (same) { if (existing.date !== today) { existing.date = today; Store.upsertSnapshot(existing, { silent: true }); } return 'skipped'; }
  }
  Store.upsertSnapshot(Snapshots.build(live, today, 'auto'), { silent: !opts.manualOverride, log: !!opts.manualOverride });
  return existing ? 'updated' : 'created';
};

window.Snapshots = Snapshots;
