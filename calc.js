"use strict";

function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function costTotals(costItems) {
  const items = Array.isArray(costItems) ? costItems : [];
  const totalYear = items.reduce((s, c) => s + num(c.valuePerYear), 0);
  const totalMonth = totalYear / 12;
  return { totalYear, totalMonth };
}

function getYearItems(costItemsByYear, year) {
  const key = String(year);
  const items = costItemsByYear && costItemsByYear[key];
  return Array.isArray(items) ? items : [];
}

function yearHasCostData(costItemsByYear, year) {
  const items = getYearItems(costItemsByYear, year);
  return items.length > 0;
}

function monthMetrics(month, monthlySpend) {
  const sessions = num(month.sessions);
  const leads = num(month.newLeadLine);
  const salesOnline = num(month.salesOnline);
  const salesAmount = num(month.salesAmount);
  const costPerLead = leads > 0 ? monthlySpend / leads : null;
  const costPerSession = sessions > 0 ? monthlySpend / sessions : null;
  const portionOnline = salesAmount > 0 ? (salesOnline / salesAmount) * 100 : null;
  const conversionRate = sessions > 0 ? (leads / sessions) * 100 : null;
  const channelSum =
    num(month.channelOrganic) + num(month.channelPaid) + num(month.channelDirect) + num(month.channelAI);
  return { costPerLead, costPerSession, portionOnline, conversionRate, channelSum };
}

function fmtInt(n) {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-US");
}
function fmtMoney(n, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n, decimals = 0) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(decimals) + "%";
}

// Master summary object consumed by the dashboard API and the PPTX builder.
// `data` = { months: [...], costItemsByYear: { "2025": [...], ... } }
// Each month's cost metrics use ITS OWN year's cost items — costs can differ year to year.
function summarize(data) {
  const costItemsByYear = data.costItemsByYear || {};
  const months = Array.isArray(data.months)
    ? [...data.months].sort((a, b) => {
        const ay = num(a.year), by = num(b.year);
        if (ay !== by) return ay - by;
        return num(a.order) - num(b.order);
      })
    : [];
  const n = months.length;

  const perMonth = months.map((m) => {
    const items = getYearItems(costItemsByYear, m.year);
    const { totalMonth } = costTotals(items);
    return { ...m, ...monthMetrics(m, totalMonth), monthlySpend: totalMonth };
  });

  const totalSessions = months.reduce((s, m) => s + num(m.sessions), 0);
  const totalLeads = months.reduce((s, m) => s + num(m.newLeadLine), 0);
  const totalSalesOnline = months.reduce((s, m) => s + num(m.salesOnline), 0);
  const totalSalesAmount = months.reduce((s, m) => s + num(m.salesAmount), 0);
  const totalSpend = perMonth.reduce((s, m) => s + (m.monthlySpend || 0), 0);
  const avgMonthlySpend = n > 0 ? totalSpend / n : null;

  const channelTotals = months.reduce(
    (acc, m) => {
      acc.organic += num(m.channelOrganic);
      acc.paid += num(m.channelPaid);
      acc.direct += num(m.channelDirect);
      acc.ai += num(m.channelAI);
      return acc;
    },
    { organic: 0, paid: 0, direct: 0, ai: 0 }
  );
  const channelSum = channelTotals.organic + channelTotals.paid + channelTotals.direct + channelTotals.ai;
  const channelPct = {
    organic: channelSum > 0 ? (channelTotals.organic / channelSum) * 100 : 0,
    paid: channelSum > 0 ? (channelTotals.paid / channelSum) * 100 : 0,
    direct: channelSum > 0 ? (channelTotals.direct / channelSum) * 100 : 0,
    ai: channelSum > 0 ? (channelTotals.ai / channelSum) * 100 : 0,
  };

  const first = months[0] || null;
  const last = months[n - 1] || null;
  const sessionGrowthPct =
    first && last && num(first.sessions) > 0
      ? ((num(last.sessions) - num(first.sessions)) / num(first.sessions)) * 100
      : null;
  const leadGrowthPct =
    first && last && num(first.newLeadLine) > 0
      ? ((num(last.newLeadLine) - num(first.newLeadLine)) / num(first.newLeadLine)) * 100
      : null;

  const avgConversion = n > 0 ? perMonth.reduce((s, m) => s + (m.conversionRate || 0), 0) / n : null;

  const cplList = perMonth.filter((m) => m.costPerLead != null);
  const maxCPL = cplList.length ? cplList.reduce((a, b) => (b.costPerLead > a.costPerLead ? b : a)) : null;
  const minCPL = cplList.length ? cplList.reduce((a, b) => (b.costPerLead < a.costPerLead ? b : a)) : null;

  const pctOfRevenue = totalSalesAmount > 0 ? (totalSpend / totalSalesAmount) * 100 : null;
  const roasRaw = totalSpend > 0 ? totalSalesOnline / totalSpend : null;

  const onlineList = perMonth.filter((m) => m.portionOnline != null);
  const peakOnline = onlineList.length
    ? onlineList.reduce((a, b) => (b.portionOnline > a.portionOnline ? b : a))
    : null;
  const salesSorted = [...months].sort((a, b) => num(a.salesAmount) - num(b.salesAmount));
  const peakOnlineSalesRank = peakOnline ? salesSorted.findIndex((m) => m.id === peakOnline.id) + 1 : null;

  const avgSalesAmount = n > 0 ? totalSalesAmount / n : null;
  const maxSalesMonth = months.length ? months.reduce((a, b) => (num(b.salesAmount) > num(a.salesAmount) ? b : a)) : null;
  const minSalesMonth = months.length ? months.reduce((a, b) => (num(b.salesAmount) < num(a.salesAmount) ? b : a)) : null;

  const latestUserLine = last ? num(last.userLine) : null;

  // Cost breakdown by year for whatever years are present in this month-set
  const yearsInRange = [...new Set(months.map((m) => String(m.year)))].sort();
  const costByYear = yearsInRange.map((y) => {
    const items = getYearItems(costItemsByYear, y);
    const { totalYear, totalMonth } = costTotals(items);
    const monthsInRange = months.filter((m) => String(m.year) === y).length;
    return { year: y, items, totalYear, totalMonth, monthsInRange };
  });
  const missingCostYears = yearsInRange.filter((y) => !yearHasCostData(costItemsByYear, y));

  const singleYear = yearsInRange.length === 1 ? yearsInRange[0] : null;
  const singleYearTotals = singleYear ? costTotals(getYearItems(costItemsByYear, singleYear)) : { totalYear: null, totalMonth: null };

  return {
    n,
    months,
    perMonth,
    totalSessions,
    totalLeads,
    totalSalesOnline,
    totalSalesAmount,
    totalSpend,
    avgMonthlySpend,
    channelTotals,
    channelPct,
    channelSum,
    first,
    last,
    sessionGrowthPct,
    leadGrowthPct,
    avgConversion,
    maxCPL,
    minCPL,
    pctOfRevenue,
    roasRaw,
    peakOnline,
    peakOnlineSalesRank,
    avgSalesAmount,
    maxSalesMonth,
    minSalesMonth,
    latestUserLine,
    costByYear,
    missingCostYears,
    yearsInRange,
    singleYear,
    totalYear: singleYearTotals.totalYear,
    totalMonth: singleYearTotals.totalMonth,
  };
}

// Focus-year vs previous-year comparison, restricted to the overlapping month range so a
// partial current year (e.g. Jan-Jul) is never unfairly compared against a full previous year.
// Always computed over ALL months (ignores any dashboard period filter).
function summarizeYoY(data, focusYear) {
  const fy = Number(focusYear);
  const cy = fy - 1;
  const allMonths = Array.isArray(data.months) ? data.months : [];
  const monthsOf = (y) => allMonths.filter((m) => num(m.year) === y);
  const focusMonths = monthsOf(fy);
  const compareMonths = monthsOf(cy);

  if (!focusMonths.length || !compareMonths.length) {
    return { available: false, focusYear: fy, compareYear: cy };
  }

  const focusOrders = new Set(focusMonths.map((m) => num(m.order)));
  const compareOrders = new Set(compareMonths.map((m) => num(m.order)));
  const overlapOrders = [...focusOrders].filter((o) => compareOrders.has(o)).sort((a, b) => a - b);

  if (!overlapOrders.length) {
    return { available: false, focusYear: fy, compareYear: cy };
  }

  const overlapSet = new Set(overlapOrders);
  const focusData = { months: focusMonths.filter((m) => overlapSet.has(num(m.order))), costItemsByYear: data.costItemsByYear || {} };
  const compareData = { months: compareMonths.filter((m) => overlapSet.has(num(m.order))), costItemsByYear: data.costItemsByYear || {} };

  const focus = summarize(focusData);
  const compare = summarize(compareData);

  const costPerLead = (s) => (s.totalLeads > 0 ? s.totalSpend / s.totalLeads : null);
  const pctChange = (a, b) => (b == null || b === 0 || a == null ? null : ((a - b) / b) * 100);

  const metrics = [
    { key: "totalSessions", label: "Site sessions", focus: focus.totalSessions, compare: compare.totalSessions, higherIsBetter: true, isMoney: false },
    { key: "totalLeads", label: "Lead ใหม่ (LINE)", focus: focus.totalLeads, compare: compare.totalLeads, higherIsBetter: true, isMoney: false },
    { key: "costPerLead", label: "ต้นทุนเฉลี่ยต่อ Lead", focus: costPerLead(focus), compare: costPerLead(compare), higherIsBetter: false, isMoney: true },
    { key: "totalSalesOnline", label: "ยอดขายออนไลน์", focus: focus.totalSalesOnline, compare: compare.totalSalesOnline, higherIsBetter: true, isMoney: true },
    { key: "totalSalesAmount", label: "ยอดขายรวม", focus: focus.totalSalesAmount, compare: compare.totalSalesAmount, higherIsBetter: true, isMoney: true },
    { key: "totalSpend", label: "งบการตลาดรวม", focus: focus.totalSpend, compare: compare.totalSpend, higherIsBetter: null, isMoney: true },
  ].map((m) => ({ ...m, pctChange: pctChange(m.focus, m.compare) }));

  return {
    available: true,
    focusYear: fy,
    compareYear: cy,
    overlapOrders,
    monthCount: overlapOrders.length,
    focus,
    compare,
    metrics,
  };
}

// One summary per calendar year present in the data — for the year-comparison dashboard view.
// Always computed over ALL months (ignores any dashboard period filter).
function summarizeByYear(data) {
  const months = Array.isArray(data.months) ? data.months : [];
  const years = [...new Set(months.map((m) => String(m.year)))].sort();
  return years.map((y) => {
    const yearMonths = months.filter((m) => String(m.year) === y);
    const s = summarize({ months: yearMonths, costItemsByYear: data.costItemsByYear || {} });
    return { year: y, summary: s };
  });
}

module.exports = {
  num,
  costTotals,
  getYearItems,
  yearHasCostData,
  monthMetrics,
  summarize,
  summarizeByYear,
  summarizeYoY,
  fmtInt,
  fmtMoney,
  fmtPct,
};
