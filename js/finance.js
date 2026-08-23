/* ============================================================
   finance.js — XIRR, FD accrual, EPF accrual, currency helpers
   ============================================================ */

const Finance = {};

// ---------------- Date helpers ----------------
function daysBetween(d1, d2) {
  const a = new Date(d1), b = new Date(d2);
  return (b - a) / (1000 * 60 * 60 * 24);
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
Finance.todayStr = todayStr;
Finance.daysBetween = daysBetween;

// ---------------- XIRR (Newton-Raphson + bisection fallback) ----------------
// cashflows: [{date:'YYYY-MM-DD', amount:number}] negative = outflow(invested), positive = inflow(current value / redemption)
function xirrNPV(rate, cashflows, t0) {
  return cashflows.reduce((sum, cf) => {
    const t = daysBetween(t0, cf.date) / 365;
    return sum + cf.amount / Math.pow(1 + rate, t);
  }, 0);
}
function xirrDerivative(rate, cashflows, t0) {
  return cashflows.reduce((sum, cf) => {
    const t = daysBetween(t0, cf.date) / 365;
    if (t === 0) return sum;
    return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
}

Finance.xirr = function (cashflows) {
  if (!cashflows || cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted[0].date;
  const hasPos = sorted.some(c => c.amount > 0);
  const hasNeg = sorted.some(c => c.amount < 0);
  if (!hasPos || !hasNeg) return null;

  let rate = 0.15; // initial guess 15%
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const npv = xirrNPV(rate, sorted, t0);
    const d = xirrDerivative(rate, sorted, t0);
    if (Math.abs(d) < 1e-10) break;
    const newRate = rate - npv / d;
    if (!isFinite(newRate)) break;
    if (Math.abs(newRate - rate) < 1e-7) { rate = newRate; converged = true; break; }
    rate = newRate;
    if (rate <= -0.999) rate = -0.999 + 1e-6;
  }

  if (!converged || !isFinite(rate) || rate < -0.999 || rate > 100) {
    // bisection fallback over a wide range
    let lo = -0.9999, hi = 10;
    let fLo = xirrNPV(lo, sorted, t0);
    let fHi = xirrNPV(hi, sorted, t0);
    if (fLo * fHi > 0) return null; // no sign change, cannot bracket root
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fMid = xirrNPV(mid, sorted, t0);
      if (Math.abs(fMid) < 1e-6) { rate = mid; break; }
      if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
      rate = mid;
    }
  }
  return rate; // decimal e.g. 0.142 = 14.2%
};

// Build cashflows for a stock/MF holding given a current market price
Finance.holdingCashflows = function (holding, currentPrice, asOfDate) {
  asOfDate = asOfDate || todayStr();
  const flows = (holding.txns || []).map(t => ({
    date: t.date,
    amount: t.type === 'BUY'
      ? -(t.qty * t.price + (t.fees || 0))
      : (t.qty * t.price - (t.fees || 0))
  }));
  const qtyHeld = Finance.currentQty(holding);
  if (qtyHeld > 0 && currentPrice != null) {
    flows.push({ date: asOfDate, amount: qtyHeld * currentPrice });
  }
  return flows;
};

Finance.currentQty = function (holding) {
  return (holding.txns || []).reduce((q, t) => q + (t.type === 'BUY' ? t.qty : -t.qty), 0);
};

Finance.investedAmount = function (holding) {
  // net capital currently deployed (buys - sells) INCLUDING fees — this is
  // the real cost basis used for P&L/XIRR, since fees are money actually spent.
  return (holding.txns || []).reduce((sum, t) => {
    return sum + (t.type === 'BUY' ? (t.qty * t.price + (t.fees || 0)) : -(t.qty * t.price - (t.fees || 0)));
  }, 0);
};

// Average cost EXCLUDING fees — this is "what you paid per share", the number
// people mean by "average cost" on a broker statement. Fees are shown
// separately (Finance.totalFees) rather than blended into the price.
Finance.avgCost = function (holding) {
  const qty = Finance.currentQty(holding);
  if (qty <= 0) return 0;
  const costExFees = (holding.txns || []).reduce((sum, t) => {
    return sum + (t.type === 'BUY' ? t.qty * t.price : -(t.qty * t.price));
  }, 0);
  return costExFees / qty;
};

Finance.totalFees = function (holding) {
  return (holding.txns || []).reduce((sum, t) => sum + (t.fees || 0), 0);
};

// ---------------- Fixed Deposits ----------------
// n = compounding periods per year
const COMPOUNDING_N = { monthly: 12, quarterly: 4, yearly: 1, cumulative: 4 };

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

// Tenure can be entered in months (legacy default, fd.tenureMonths) or days
// (fd.tenureUnit === 'days', fd.tenureValue) — e.g. many Indian FD schemes
// are quoted as "555 days" rather than a round number of months.
function fdTenureInfo(fd) {
  if (fd.tenureUnit === 'days') return { unit: 'days', value: fd.tenureValue, years: fd.tenureValue / 365 };
  const months = fd.tenureUnit === 'months' ? fd.tenureValue : fd.tenureMonths;
  return { unit: 'months', value: months, years: months / 12 };
}
Finance.fdTenureInfo = fdTenureInfo;

function fdMaturityDateStr(fd) {
  const info = fdTenureInfo(fd);
  const d = info.unit === 'days' ? addDays(fd.startDate, info.value) : addMonths(fd.startDate, info.value);
  return d.toISOString().slice(0, 10);
}

Finance.fdCurrentValue = function (fd, asOfDate) {
  asOfDate = asOfDate || todayStr();
  const maturity = fdMaturityDateStr(fd);
  const isMatured = asOfDate >= maturity;
  if (isMatured) {
    // use the exact tenure-based maturity calculation, not day-counted, so it
    // never drifts from fdMaturityValue due to leap-year day counts
    return { value: Finance.fdMaturityValue(fd).value, isMatured: true, maturityDate: maturity };
  }
  const years = Math.max(0, daysBetween(fd.startDate, asOfDate) / 365);
  const n = COMPOUNDING_N[fd.compounding] || 4;
  const rate = fd.rate / 100;
  const value = fd.principal * Math.pow(1 + rate / n, n * years);
  return { value, isMatured: false, maturityDate: maturity };
};

Finance.fdMaturityValue = function (fd) {
  const maturity = fdMaturityDateStr(fd);
  const years = fdTenureInfo(fd).years;
  const n = COMPOUNDING_N[fd.compounding] || 4;
  const rate = fd.rate / 100;
  const value = fd.principal * Math.pow(1 + rate / n, n * years);
  return { value, maturityDate: maturity };
};

// FD XIRR is deterministic from the compounding rate, but we compute via cashflows too for consistency
Finance.fdCashflows = function (fd, asOfDate) {
  asOfDate = asOfDate || todayStr();
  const cur = Finance.fdCurrentValue(fd, asOfDate);
  return [
    { date: fd.startDate, amount: -fd.principal },
    { date: asOfDate < cur.maturityDate ? asOfDate : cur.maturityDate, amount: cur.value }
  ];
};

// ---------------- EPF ----------------
// Model: opening balance + a "recurring" monthly contribution (employee +
// employer-EPF-portion + employer-EPS-portion) that auto-applies every
// month from its start date up to "today" without needing manual monthly
// entries, plus optional one-off manual txns for adjustments (transfers,
// bonus contributions, etc). EPS (pension scheme) contributions are
// tracked as a separate informational pool — EPS does not earn account
// interest the way the EPF corpus does, so it's excluded from the
// interest-bearing balance and shown separately.
//
// Interest uses EPFO's monthly running-balance method: each month's
// interest = balance × (declared annual rate ÷ 12), summed across the
// financial year (Apr–Mar) and credited at year end.
Finance.epfCalculate = function (epf, asOfDate) {
  asOfDate = asOfDate || todayStr();
  const rates = (epf.interestRates || []).slice().sort((a, b) => a.fyLabel.localeCompare(b.fyLabel));
  const defaultRate = rates.length ? rates[rates.length - 1].ratePct : 8.25;

  function rateForFY(fyStartYear) {
    const label = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
    const found = rates.find(r => r.fyLabel === label);
    return (found ? found.ratePct : defaultRate) / 100;
  }

  const start = new Date(epf.openingDate);
  const end = new Date(asOfDate);
  let balance = epf.openingBalance || 0;
  let epsTotal = 0;
  let employeeTotal = 0;
  let employerTotal = 0;

  const txns = (epf.txns || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  let txnIdx = 0;
  const rec = epf.recurring;
  const recStart = rec && rec.active && rec.startDate ? new Date(rec.startDate) : null;

  function fyStartYearOf(d) { return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  let currentFY = fyStartYearOf(cursor);
  let fyInterestAccum = 0;
  const yearlyBreakdown = [];

  while (cursor <= endMonth) {
    const y = cursor.getFullYear(), m = cursor.getMonth();

    // recurring contribution for this month
    if (recStart && cursor >= new Date(recStart.getFullYear(), recStart.getMonth(), 1)) {
      const emp = rec.employeeAmt || 0, erEpf = rec.employerEpfAmt || 0, erEps = rec.employerEpsAmt || 0;
      balance += emp + erEpf;
      epsTotal += erEps;
      employeeTotal += emp;
      employerTotal += erEpf + erEps;
    }

    // one-off manual txns dated within this month
    while (txnIdx < txns.length) {
      const td = new Date(txns[txnIdx].date);
      if (td.getFullYear() === y && td.getMonth() === m) {
        const emp = txns[txnIdx].employeeAmt || 0, er = txns[txnIdx].employerAmt || 0;
        balance += emp + er;
        employeeTotal += emp;
        employerTotal += er;
        txnIdx++;
      } else break;
    }

    const fy = fyStartYearOf(cursor);
    if (fy !== currentFY) {
      balance += fyInterestAccum;
      yearlyBreakdown.push({ fyLabel: `${currentFY}-${String((currentFY + 1) % 100).padStart(2, '0')}`, interest: fyInterestAccum });
      fyInterestAccum = 0;
      currentFY = fy;
    }
    const r = rateForFY(currentFY);
    fyInterestAccum += balance * (r / 12);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const accruedThisFY = fyInterestAccum;
  yearlyBreakdown.push({ fyLabel: `${currentFY}-${String((currentFY + 1) % 100).padStart(2, '0')} (accruing)`, interest: accruedThisFY });

  return {
    balanceExclAccrued: balance,
    accruedThisFY,
    totalBalance: balance + accruedThisFY,
    epsTotal,
    employeeTotal,
    employerTotal,
    yearlyBreakdown
  };
};

Finance.epfCashflows = function (epf, asOfDate) {
  asOfDate = asOfDate || todayStr();
  const flows = [{ date: epf.openingDate, amount: -(epf.openingBalance || 0) }];
  (epf.txns || []).forEach(t => {
    flows.push({ date: t.date, amount: -((t.employeeAmt || 0) + (t.employerAmt || 0)) });
  });
  // approximate recurring contributions as one flow per elapsed month for XIRR purposes
  const rec = epf.recurring;
  if (rec && rec.active && rec.startDate) {
    const monthly = (rec.employeeAmt || 0) + (rec.employerEpfAmt || 0);
    if (monthly > 0) {
      let cursor = new Date(rec.startDate);
      const end = new Date(asOfDate);
      while (cursor <= end) {
        flows.push({ date: cursor.toISOString().slice(0, 10), amount: -monthly });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  }
  const result = Finance.epfCalculate(epf, asOfDate);
  flows.push({ date: asOfDate, amount: result.totalBalance });
  return flows;
};

// EPFO standard contribution split from a monthly basic+DA figure.
// Employee: 12% of basic. Employer: 12% of basic, split into EPS
// (8.33% of basic, capped at the EPS wage ceiling of ₹15,000/month,
// i.e. max ₹1,250) with the remainder going to the EPF account itself.
Finance.epfFromSalary = function (basicPlusDA) {
  const EPS_WAGE_CEILING = 15000;
  const employee = basicPlusDA * 0.12;
  const epsWage = Math.min(basicPlusDA, EPS_WAGE_CEILING);
  const eps = epsWage * 0.0833;
  const employerEpf = (basicPlusDA * 0.12) - eps;
  return {
    employee: Math.round(employee),
    employerEpf: Math.round(employerEpf),
    eps: Math.round(eps),
    employerTotal: Math.round(employerEpf + eps),
    totalToEpfAccount: Math.round(employee + employerEpf)
  };
};

// Forward projection: continues the recurring contribution (or explicit
// override amounts) from today out to N years, compounding monthly at an
// assumed rate, with an optional annual contribution step-up (e.g. yearly
// increments).
Finance.epfProjection = function (epf, opts) {
  opts = opts || {};
  const monthlyEmployee = opts.monthlyEmployee != null ? opts.monthlyEmployee : ((epf.recurring && epf.recurring.employeeAmt) || 0);
  const monthlyEmployerEpf = opts.monthlyEmployerEpf != null ? opts.monthlyEmployerEpf : ((epf.recurring && epf.recurring.employerEpfAmt) || 0);
  const annualStepUpPct = opts.annualStepUpPct || 0;
  const assumedRatePct = opts.assumedRatePct != null ? opts.assumedRatePct : 8.25;
  const yearsForward = opts.yearsForward || 20;

  const current = Finance.epfCalculate(epf, todayStr());
  let balance = current.totalBalance;
  let empC = monthlyEmployee, erC = monthlyEmployerEpf;
  const monthlyRate = assumedRatePct / 100 / 12;
  const checkpoints = [{ x: 0, y: Math.round(balance) }];

  for (let yr = 1; yr <= yearsForward; yr++) {
    for (let m = 0; m < 12; m++) {
      balance += empC + erC;
      balance += balance * monthlyRate;
    }
    empC *= (1 + annualStepUpPct / 100);
    erC *= (1 + annualStepUpPct / 100);
    checkpoints.push({ x: yr, y: Math.round(balance) });
  }
  return { checkpoints, finalBalance: Math.round(balance) };
};

// ---------------- Currency ----------------
Finance.toINR = function (amount, currency, fxRate) {
  if (currency === 'INR' || !currency) return amount;
  if (currency === 'USD') return amount * (fxRate || 83);
  return amount;
};

window.Finance = Finance;
