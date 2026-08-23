/* ============================================================
   valuation.js — turns raw holdings + cached prices into
   current values, gain/loss and XIRR, in INR.
   ============================================================ */

const Valuation = {};

// price used for a stock/MF holding: live cached price if present, else manual override, else null
function priceFor(holding) {
  if (holding.manualPrice != null) return { price: holding.manualPrice, source: 'manual', asOf: holding.manualPriceAt };
  if (holding.lastPrice != null) return { price: holding.lastPrice, source: holding.priceSource || 'api', asOf: holding.lastPriceAt };
  return null;
}

Valuation.evalStockLike = function (assetType, holding, usdInr) {
  const qty = Finance.currentQty(holding);
  const invested = Finance.investedAmount(holding);
  const priceInfo = priceFor(holding);
  const fxMult = assetType === 'US_STOCK' ? (usdInr || 83) : 1;
  const currentValueNative = priceInfo ? qty * priceInfo.price : null;
  const currentValueINR = currentValueNative != null ? currentValueNative * fxMult : null;
  const investedINR = invested * fxMult;
  const gainINR = currentValueINR != null ? currentValueINR - investedINR : null;
  const gainPct = (currentValueINR != null && investedINR !== 0) ? (gainINR / Math.abs(investedINR)) * 100 : null;

  const cashflows = priceInfo ? Finance.holdingCashflows(holding, priceInfo.price).map(cf => ({
    date: cf.date, amount: cf.amount * fxMult
  })) : [];
  const xirr = cashflows.length >= 2 ? Finance.xirr(cashflows) : null;

  return {
    id: holding.id, assetType, name: holding.name || holding.symbol,
    symbol: holding.symbol, qty, avgCost: Finance.avgCost(holding),
    investedINR, currentValueINR, gainINR, gainPct,
    investedNative: invested, currentValueNative, gainNative: currentValueNative != null ? currentValueNative - invested : null,
    fxRate: fxMult,
    xirr, priceInfo, hasPrice: !!priceInfo
  };
};

Valuation.evalFD = function (fd) {
  const cur = Finance.fdCurrentValue(fd);
  const gainINR = cur.value - fd.principal;
  const gainPct = fd.principal ? (gainINR / fd.principal) * 100 : null;
  const cashflows = Finance.fdCashflows(fd);
  const xirr = Finance.xirr(cashflows);
  return {
    id: fd.id, assetType: 'FD', name: fd.bank,
    investedINR: fd.principal, currentValueINR: cur.value,
    gainINR, gainPct, xirr, isMatured: cur.isMatured, maturityDate: cur.maturityDate,
    hasPrice: true
  };
};

Valuation.evalEPF = function (epf) {
  const result = Finance.epfCalculate(epf);
  const totalContrib = (epf.openingBalance || 0) + result.employeeTotal + result.employerTotal;
  const gainINR = result.totalBalance - totalContrib;
  const gainPct = totalContrib ? (gainINR / totalContrib) * 100 : null;
  const cashflows = Finance.epfCashflows(epf);
  const xirr = Finance.xirr(cashflows);
  return {
    id: epf.id, assetType: 'EPF', name: epf.employerName,
    investedINR: totalContrib, currentValueINR: result.totalBalance,
    gainINR, gainPct, xirr, yearlyBreakdown: result.yearlyBreakdown,
    epsTotal: result.epsTotal, employeeTotal: result.employeeTotal, employerTotal: result.employerTotal,
    hasPrice: true
  };
};

// Full portfolio snapshot
Valuation.snapshot = function () {
  const d = Store.load();
  const usdInr = Store.getPriceCache('fx_usdinr', 1000 * 60 * 60 * 24) || Store.getSettings().fxOverride || 83;

  const rows = [];
  d.holdings.IN_STOCK.forEach(h => rows.push(Valuation.evalStockLike('IN_STOCK', h, 1)));
  d.holdings.IN_MF.forEach(h => rows.push(Valuation.evalStockLike('IN_MF', h, 1)));
  d.holdings.US_STOCK.forEach(h => rows.push(Valuation.evalStockLike('US_STOCK', h, usdInr)));
  d.holdings.FD.forEach(h => rows.push(Valuation.evalFD(h)));
  d.holdings.EPF.forEach(h => rows.push(Valuation.evalEPF(h)));

  const totalInvested = rows.reduce((s, r) => s + (r.investedINR || 0), 0);
  const totalCurrent = rows.reduce((s, r) => s + (r.currentValueINR != null ? r.currentValueINR : r.investedINR), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPct = totalInvested ? (totalGain / totalInvested) * 100 : 0;

  // portfolio-level XIRR: pool all cashflows across everything
  let allFlows = [];
  d.holdings.IN_STOCK.forEach(h => { const p = priceFor(h); if (p) allFlows = allFlows.concat(Finance.holdingCashflows(h, p.price)); });
  d.holdings.IN_MF.forEach(h => { const p = priceFor(h); if (p) allFlows = allFlows.concat(Finance.holdingCashflows(h, p.price)); });
  d.holdings.US_STOCK.forEach(h => { const p = priceFor(h); if (p) allFlows = allFlows.concat(Finance.holdingCashflows(h, p.price).map(cf => ({ date: cf.date, amount: cf.amount * usdInr }))); });
  d.holdings.FD.forEach(h => { allFlows = allFlows.concat(Finance.fdCashflows(h)); });
  d.holdings.EPF.forEach(h => { allFlows = allFlows.concat(Finance.epfCashflows(h)); });
  const portfolioXirr = allFlows.length >= 2 ? Finance.xirr(allFlows) : null;

  const byAssetType = {};
  ASSET_TYPES.forEach(t => {
    const rs = rows.filter(r => r.assetType === t);
    const inv = rs.reduce((s, r) => s + (r.investedINR || 0), 0);
    const cur = rs.reduce((s, r) => s + (r.currentValueINR != null ? r.currentValueINR : r.investedINR), 0);
    byAssetType[t] = { invested: inv, current: cur, gain: cur - inv, gainPct: inv ? ((cur - inv) / inv) * 100 : 0, count: rs.length };
  });

  return { rows, totalInvested, totalCurrent, totalGain, totalGainPct, portfolioXirr, byAssetType, usdInr };
};

window.Valuation = Valuation;
