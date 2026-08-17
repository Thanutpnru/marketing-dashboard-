"use strict";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const state = { data: { months: [], costItemsByYear: {}, quotations: [] }, summary: null, summaryByYear: [], quotationSummary: null, periodFrom: "", periodTo: "", dashboardMode: "period", costYear: "" };

function fmtInt(n) { return n == null || !isFinite(n) ? "-" : Math.round(n).toLocaleString("en-US"); }
function fmtMoney(n, d = 2) { return n == null || !isFinite(n) ? "-" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtPct(n, d = 0) { return n == null || !isFinite(n) ? "-" : n.toFixed(d) + "%"; }

function toast(msg, isError) {
  const el = document.createElement("div");
  el.className = "error-toast" + (isError ? "" : " success-toast");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- API ----------
async function apiGet(from, to) {
  const qs = [];
  if (from) qs.push("from=" + encodeURIComponent(from));
  if (to) qs.push("to=" + encodeURIComponent(to));
  const r = await fetch("/api/data" + (qs.length ? "?" + qs.join("&") : ""));
  if (!r.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
  return r.json();
}
async function apiSaveMonth(month) {
  const r = await fetch("/api/months", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(month) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "บันทึกไม่สำเร็จ");
  return j;
}
async function apiDeleteMonth(id) {
  const r = await fetch("/api/months/" + encodeURIComponent(id), { method: "DELETE" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "ลบไม่สำเร็จ");
  return j;
}
async function apiSaveCostItems(year, costItems) {
  const r = await fetch("/api/cost-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, costItems }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "บันทึกไม่สำเร็จ");
  return j;
}
async function apiDeleteCostYear(year) {
  const r = await fetch("/api/cost-items/" + encodeURIComponent(year), { method: "DELETE" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "ลบไม่สำเร็จ");
  return j;
}

// ---------- Init ----------
async function refresh() {
  const j = await apiGet(state.periodFrom, state.periodTo);
  state.data = j.data;
  state.summary = j.summary;
  state.summaryByYear = j.summaryByYear || [];
  state.quotationSummary = j.quotationSummary || null;
  renderAll();
}

function safeRender(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`renderAll: ${name} failed`, err);
    toast(`ส่วน "${name}" แสดงผลผิดพลาด: ${err.message}`, true);
  }
}

function renderAll() {
  safeRender("ตัวเลือกช่วงเวลา", populatePeriodSelectors);
  safeRender("แดชบอร์ด", renderDashboard);
  safeRender("เปรียบเทียบระหว่างปี", renderCompareView);
  safeRender("ตารางข้อมูลรายเดือน", renderMonthTable);
  safeRender("ตัวเลือกปีค่าใช้จ่าย", populateCostYearSelect);
  safeRender("ตารางค่าใช้จ่าย", renderCostTable);
  safeRender("ใบเสนอราคา", renderQuotesTab);
  safeRender("สไลด์สรุป", renderSlideTab);
  safeRender("สไลด์เปรียบเทียบปีต่อปี", () => {
    if (state.slideMode === "yoy") {
      populateYoYYearSelect();
      loadYoYPreview();
    }
  });
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ---------- Dashboard mode toggle ----------
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.dashboardMode = btn.dataset.mode;
    document.getElementById("periodView").style.display = state.dashboardMode === "period" ? "block" : "none";
    document.getElementById("compareView").style.display = state.dashboardMode === "compare" ? "block" : "none";
  });
});

function renderCompareView() {
  const byYear = state.summaryByYear || [];
  const emptyEl = document.getElementById("compareEmpty");
  const contentEl = document.getElementById("compareContent");

  if (byYear.length < 1) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = "ยังไม่มีข้อมูล กรุณาเพิ่มข้อมูลรายเดือนในแท็บ \"กรอกข้อมูล\" ก่อน";
    return;
  }
  contentEl.style.display = "block";
  emptyEl.style.display = "none";

  const years = byYear.map((y) => y.year);
  const sessions = byYear.map((y) => y.summary.totalSessions);
  const leads = byYear.map((y) => y.summary.totalLeads);
  const sales = byYear.map((y) => (y.summary.totalSalesAmount || 0) / 1e6);
  const spend = byYear.map((y) => y.summary.totalSpend || 0);
  const roas = byYear.map((y) => y.summary.roasRaw || 0);
  const cpl = byYear.map((y) => (y.summary.totalLeads > 0 ? y.summary.totalSpend / y.summary.totalLeads : 0));

  barChart(document.getElementById("cmpSessions"), { labels: years, values: sessions, color: PALETTE.terra });
  barChart(document.getElementById("cmpLeads"), { labels: years, values: leads, color: PALETTE.navy });
  barChart(document.getElementById("cmpSales"), { labels: years, values: sales, color: PALETTE.navy, format: (v) => v.toFixed(1) });
  barChart(document.getElementById("cmpSpend"), { labels: years, values: spend, color: PALETTE.terra, format: (v) => fmtInt(v) });
  barChart(document.getElementById("cmpRoas"), { labels: years, values: roas, color: PALETTE.terra, format: (v) => v.toFixed(0) + "x" });
  barChart(document.getElementById("cmpCPL"), { labels: years, values: cpl, color: PALETTE.navy, format: (v) => fmtInt(v) });

  const table = document.getElementById("compareTable");
  const rows = byYear.map((y) => `
    <tr>
      <td>${y.year}</td>
      <td>${y.summary.n}</td>
      <td>${fmtInt(y.summary.totalSessions)}</td>
      <td>${fmtInt(y.summary.totalLeads)}</td>
      <td>${fmtMoney(y.summary.totalSalesAmount / 1e6, 1)}M</td>
      <td>${fmtInt(y.summary.totalSpend)}</td>
      <td>${y.summary.roasRaw ? Math.round(y.summary.roasRaw) + "x" : "-"}</td>
      <td>${y.summary.totalLeads > 0 ? fmtInt(y.summary.totalSpend / y.summary.totalLeads) : "-"}</td>
    </tr>
  `).join("");
  table.innerHTML = `
    <tr><th>ปี</th><th>จำนวนเดือน</th><th>Sessions</th><th>Lead</th><th>ยอดขายรวม</th><th>งบการตลาด</th><th>ROAS</th><th>ต้นทุน/Lead</th></tr>
    ${rows}
  `;
}

// ---------- Period filter ----------
function sortedFullMonths() {
  return [...(state.data.months || [])].sort((a, b) => (a.year - b.year) || (a.order - b.order));
}

function populatePeriodSelectors() {
  // Period options are the union of months that have marketing data AND months that have
  // quotation data, so the shared period filter works even if only one of the two is filled in yet.
  const months = sortedFullMonths();
  const optMap = new Map(months.map((m) => [m.id, `${m.month} ${m.year}`]));
  (state.data.quotations || []).forEach((q) => {
    const id = `${q.year}-${String(q.month).padStart(2, "0")}`;
    if (!optMap.has(id)) optMap.set(id, `${THAI_MONTHS[q.month - 1]} ${q.year}`);
  });
  const ids = [...optMap.keys()].sort();
  const opts = ids.map((id) => `<option value="${id}">${optMap.get(id)}</option>`).join("");
  // Three synced pairs: the dashboard, slide-summary, and quotations tabs each have their own
  // selectors, all reading/writing the same state.periodFrom/periodTo so choosing a range in
  // any one tab applies everywhere.
  [["periodFrom", "periodTo"], ["slidePeriodFrom", "slidePeriodTo"], ["quotePeriodFrom", "quotePeriodTo"]].forEach(([fromId, toId]) => {
    const fromSel = document.getElementById(fromId);
    const toSel = document.getElementById(toId);
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    if (ids.length) {
      fromSel.value = state.periodFrom || ids[0];
      toSel.value = state.periodTo || ids[ids.length - 1];
    }
    fromSel.disabled = toSel.disabled = ids.length === 0;
  });
}

function onPeriodFromChange(e) {
  state.periodFrom = e.target.value;
  refresh().catch((err) => toast(err.message, true));
}
function onPeriodToChange(e) {
  state.periodTo = e.target.value;
  refresh().catch((err) => toast(err.message, true));
}
function onPeriodReset() {
  state.periodFrom = "";
  state.periodTo = "";
  refresh().catch((err) => toast(err.message, true));
}
document.getElementById("periodFrom").addEventListener("change", onPeriodFromChange);
document.getElementById("periodTo").addEventListener("change", onPeriodToChange);
document.getElementById("periodReset").addEventListener("click", onPeriodReset);
document.getElementById("slidePeriodFrom").addEventListener("change", onPeriodFromChange);
document.getElementById("slidePeriodTo").addEventListener("change", onPeriodToChange);
document.getElementById("slidePeriodReset").addEventListener("click", onPeriodReset);
document.getElementById("quotePeriodFrom").addEventListener("change", onPeriodFromChange);
document.getElementById("quotePeriodTo").addEventListener("change", onPeriodToChange);
document.getElementById("quotePeriodReset").addEventListener("click", onPeriodReset);

// ---------- Dashboard ----------
function statCardEl(big, label) {
  const div = document.createElement("div");
  div.className = "stat-card";
  div.innerHTML = `<div class="big">${big}</div><div class="label">${label}</div>`;
  return div;
}

function renderStatCards(containerId) {
  const s = state.summary;
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  const costPerLeadAvg = s.totalLeads > 0 ? s.totalSpend / s.totalLeads : null;
  const growthTxt = (g) => (g == null ? "" : ` (${g >= 0 ? "+" : ""}${g.toFixed(0)}%)`);
  el.appendChild(statCardEl(`฿${fmtInt(s.totalSpend)}`, `งบการตลาดรวม ${s.n} เดือน (${fmtPct(s.pctOfRevenue, 2)} ของยอดขายรวม)`));
  el.appendChild(statCardEl(fmtInt(s.totalSessions), `Site sessions สะสม${growthTxt(s.sessionGrowthPct)}`));
  el.appendChild(statCardEl(`${fmtInt(s.totalLeads)} ราย`, `Lead ใหม่สะสม${growthTxt(s.leadGrowthPct)}`));
  el.appendChild(statCardEl(`฿${fmtInt(costPerLeadAvg)}`, `ต้นทุนเฉลี่ยต่อ Lead (${s.n} เดือน)`));
  el.appendChild(statCardEl(`${Math.round(s.roasRaw || 0)} เท่า`, `ROAS ดิบ (ยอดขายออนไลน์ ÷ งบโฆษณา)`));
}

const PALETTE = { navy: "#1E2761", terra: "#C1652F", ice: "#CADCFC", gray: "#9AA7C2" };

// ---------- Quotations (ใบเสนอราคา) ----------
function renderQuotesTab() {
  const qs = state.quotationSummary;
  const emptyEl = document.getElementById("quotesEmpty");
  const contentEl = document.getElementById("quotesContent");

  if (!qs || qs.n === 0) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = (state.data.quotations || []).length === 0
      ? 'ยังไม่มีข้อมูลใบเสนอราคา กด "นำเข้าไฟล์ใบเสนอราคา" ด้านบนเพื่อเริ่มต้น'
      : "ไม่พบใบเสนอราคาในช่วงเวลาที่เลือก ลองปรับช่วงเวลาด้านบน";
    return;
  }
  contentEl.style.display = "block";
  emptyEl.style.display = "none";

  const cardsEl = document.getElementById("quotesStatCards");
  cardsEl.innerHTML = "";
  cardsEl.appendChild(statCardEl(fmtInt(qs.n), `ใบเสนอราคาทั้งหมด (${qs.monthCount} เดือน)`));
  cardsEl.appendChild(statCardEl(`฿${fmtInt(qs.totalValue)}`, "มูลค่าใบเสนอราคารวม"));
  cardsEl.appendChild(statCardEl(`฿${fmtInt(qs.avgValue)}`, "มูลค่าเฉลี่ยต่อใบ"));
  cardsEl.appendChild(statCardEl(`฿${fmtInt(qs.avgWonValue)}`, "มูลค่าเฉลี่ยใบเสนอราคาที่ปิดได้"));
  cardsEl.appendChild(statCardEl(
    qs.winRate == null ? "-" : fmtPct(qs.winRate, 0),
    `อัตราปิดการขาย (${fmtInt(qs.wonCount)} ปิดได้ / ${fmtInt(qs.n)} ใบทั้งหมด)`
  ));

  const labels = qs.byMonth.map((m) => (qs.multiYear ? `${THAI_MONTHS[m.month - 1]} '${String(m.year + 543).slice(-2)}` : THAI_MONTHS[m.month - 1]));
  barLineChart(document.getElementById("chartQuoteCount"), {
    labels,
    barValues: qs.byMonth.map((m) => m.count),
    lineValues: qs.byMonth.map((m) => m.wonCount),
    barColor: PALETTE.navy, lineColor: PALETTE.terra,
    barLabel: "ใบเสนอราคาทั้งหมด", lineLabel: "ปิดการขายได้",
    format: (v) => fmtInt(v),
  });
  barChart(document.getElementById("chartQuoteValue"), {
    labels, values: qs.byMonth.map((m) => m.value / 1e6), color: PALETTE.terra, format: (v) => v.toFixed(1),
  });
  lineChart(document.getElementById("chartQuoteCloseRate"), {
    labels, values: qs.byMonth.map((m) => Math.round(m.closeRate * 10) / 10), color: PALETTE.navy, format: (v) => v.toFixed(0) + "%",
  });

  // Group channels that make up a small sliver of total volume into "อื่นๆ" so
  // donut/close-rate charts stay readable and aren't skewed by tiny sample sizes.
  const groupedChannels = groupSmallChannels(qs.byChannel, qs.n, 2);
  const channelColors = [PALETTE.navy, PALETTE.terra, PALETTE.ice, "#6B8F71", "#D9A441", "#8E5572", "#4C6E5D", PALETTE.gray];
  donutChart(document.getElementById("chartQuoteChannel"), {
    labels: groupedChannels.map((c) => c.channel), values: groupedChannels.map((c) => c.count), colors: channelColors,
  });

  const statusColors = { "ปิดการขายแล้ว": "#1E7A34", "ปิดการขายไม่ได้": "#B3261E", "ยกเลิก": "#9AA7C2", "รอลูกค้าตัดสินใจ": PALETTE.terra, "ประมูลงาน": PALETTE.navy };
  donutChart(document.getElementById("chartQuoteStatus"), {
    labels: qs.byStatus.map((s) => s.status),
    values: qs.byStatus.map((s) => s.count),
    colors: qs.byStatus.map((s) => statusColors[s.status] || PALETTE.gray),
  });

  // Channel effectiveness: sort by close rate (best first), "อื่นๆ" bucket pinned to the bottom
  // since it's a mix of channels rather than one comparable thing.
  const others = groupedChannels.find((c) => c.isOther);
  const closeRanked = groupedChannels.filter((c) => !c.isOther).sort((a, b) => b.closeRate - a.closeRate);
  const closeChartList = others ? [...closeRanked, others] : closeRanked;
  hBarChart(document.getElementById("chartQuoteChannelClose"), {
    labels: closeChartList.map((c) => `${c.channel} (${fmtInt(c.count)} ใบ)`),
    values: closeChartList.map((c) => Math.round(c.closeRate * 10) / 10),
    colors: closeChartList.map((c) => (c.isOther ? PALETTE.gray : c.closeRate >= qs.winRate ? "#1E7A34" : "#B3261E")),
    format: (v) => v.toFixed(0) + "%",
    labelWidth: 190,
  });

  const table = document.getElementById("quoteChannelTable");
  const rows = qs.byChannel.map((c) => `
    <tr>
      <td>${c.channel}</td>
      <td style="text-align:right">${fmtInt(c.count)}</td>
      <td style="text-align:right">${fmtPct(c.pctCount, 1)}</td>
      <td style="text-align:right">฿${fmtInt(c.value)}</td>
      <td style="text-align:right">${fmtPct(c.pctValue, 1)}</td>
      <td style="text-align:right">${fmtInt(c.wonCount)}</td>
      <td style="text-align:right">${fmtPct(c.closeRate, 1)}</td>
    </tr>
  `).join("");
  table.innerHTML = `
    <tr><th>ช่องทาง</th><th>จำนวนใบ</th><th>% ของจำนวน</th><th>มูลค่ารวม</th><th>% ของมูลค่า</th><th>ปิดได้</th><th>% ปิดได้</th></tr>
    ${rows}
  `;

  renderQuotesInsights(qs, closeRanked, others);
}

// Merge channels below `thresholdPct` share of total count into a single "อื่นๆ" bucket
// so pie/bar charts aren't cluttered by many near-invisible slivers.
function groupSmallChannels(byChannel, totalCount, thresholdPct) {
  const big = [];
  const small = [];
  byChannel.forEach((c) => {
    const pct = totalCount > 0 ? (c.count / totalCount) * 100 : 0;
    (pct >= thresholdPct ? big : small).push(c);
  });
  if (!small.length) return big;
  const merged = small.reduce((acc, c) => {
    acc.count += c.count;
    acc.value += c.value;
    acc.wonCount += c.wonCount;
    acc.wonValue += c.wonValue;
    acc.members.push(c.channel);
    return acc;
  }, { channel: "อื่นๆ (ช่องทางสัดส่วนน้อย)", count: 0, value: 0, wonCount: 0, wonValue: 0, members: [], isOther: true });
  merged.pctCount = totalCount > 0 ? (merged.count / totalCount) * 100 : 0;
  merged.closeRate = merged.count > 0 ? (merged.wonCount / merged.count) * 100 : 0;
  return [...big, merged];
}

function renderQuotesInsights(qs, closeRanked, others) {
  // Trend commentary: compare first half vs second half of the period to describe direction.
  const trendEl = document.getElementById("quotesTrendInsight");
  const trendBullets = [];
  if (qs.byMonth.length >= 2) {
    const mid = Math.ceil(qs.byMonth.length / 2);
    const firstHalf = qs.byMonth.slice(0, mid);
    const secondHalf = qs.byMonth.slice(mid);
    const avg = (arr, key) => arr.reduce((s, m) => s + m[key], 0) / (arr.length || 1);
    const volChange = avg(firstHalf, "count") > 0
      ? ((avg(secondHalf, "count") - avg(firstHalf, "count")) / avg(firstHalf, "count")) * 100
      : null;
    if (volChange != null && Math.abs(volChange) >= 5) {
      trendBullets.push(`จำนวนใบเสนอราคาต่อเดือนโดยเฉลี่ย${volChange > 0 ? "เพิ่มขึ้น" : "ลดลง"} ${fmtPct(Math.abs(volChange), 0)} เมื่อเทียบครึ่งแรกกับครึ่งหลังของช่วงเวลาที่เลือก`);
    } else if (volChange != null) {
      trendBullets.push("จำนวนใบเสนอราคาต่อเดือนค่อนข้างทรงตัวตลอดช่วงเวลาที่เลือก");
    }
    const crFirst = avg(firstHalf, "closeRate");
    const crSecond = avg(secondHalf, "closeRate");
    const crDiff = crSecond - crFirst;
    if (Math.abs(crDiff) >= 3) {
      trendBullets.push(`อัตราปิดการขายเฉลี่ย${crDiff > 0 ? "ดีขึ้น" : "แย่ลง"}จาก ${fmtPct(crFirst, 0)} เป็น ${fmtPct(crSecond, 0)} เมื่อเทียบครึ่งแรกกับครึ่งหลัง`);
    }
    const bestMonth = [...qs.byMonth].sort((a, b) => b.closeRate - a.closeRate)[0];
    const worstMonth = [...qs.byMonth].sort((a, b) => a.closeRate - b.closeRate)[0];
    if (bestMonth && worstMonth && bestMonth !== worstMonth) {
      const label = (m) => `${THAI_MONTHS[m.month - 1]} ${m.year + 543}`;
      trendBullets.push(`เดือนที่ปิดการขายได้ดีที่สุดคือ ${label(bestMonth)} (${fmtPct(bestMonth.closeRate, 0)}) ส่วนเดือนที่ต่ำที่สุดคือ ${label(worstMonth)} (${fmtPct(worstMonth.closeRate, 0)})`);
    }
  }
  trendEl.innerHTML = trendBullets.length
    ? `<div class="title">ข้อสังเกตแนวโน้มรายเดือน</div><ul>${trendBullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
    : "";

  // Channel commentary: only compare channels with a meaningful sample size (>=5 quotes)
  // so a single-quote channel at 100%/0% doesn't distort the "best/worst" read.
  const chEl = document.getElementById("quotesChannelInsight");
  const chBullets = [];
  const meaningful = closeRanked.filter((c) => c.count >= 5);
  const topVolume = [...qs.byChannel].sort((a, b) => b.count - a.count)[0];
  if (topVolume) {
    chBullets.push(`ช่องทางที่มีจำนวนใบเสนอราคามากที่สุดคือ "${topVolume.channel}" คิดเป็น ${fmtPct(topVolume.pctCount, 0)} ของทั้งหมด (${fmtInt(topVolume.count)} ใบ)`);
  }
  if (meaningful.length) {
    const best = meaningful[0];
    chBullets.push(`ช่องทางที่มีประสิทธิภาพสูงสุด (อัตราปิดการขาย) คือ "${best.channel}" ที่ ${fmtPct(best.closeRate, 0)} จาก ${fmtInt(best.count)} ใบ`);
    const worst = meaningful[meaningful.length - 1];
    if (worst !== best) {
      const flag = worst.closeRate < qs.winRate ? " ซึ่งต่ำกว่าอัตราปิดการขายเฉลี่ยรวม ควรพิจารณาทบทวนแนวทางของช่องทางนี้" : "";
      chBullets.push(`ช่องทางที่มีอัตราปิดการขายต่ำสุด (ในกลุ่มที่มีจำนวนใบมากพอจะเทียบได้) คือ "${worst.channel}" ที่ ${fmtPct(worst.closeRate, 0)} จาก ${fmtInt(worst.count)} ใบ${flag}`);
    }
  }
  if (others && others.count > 0) {
    chBullets.push(`มี ${others.members.length} ช่องทางที่มีจำนวนใบน้อย (รวมกัน ${fmtInt(others.count)} ใบ, ${fmtPct(others.pctCount, 0)} ของทั้งหมด) ถูกจัดกลุ่มเป็น "อื่นๆ" ในกราฟด้านบนเพื่อความชัดเจน ได้แก่ ${others.members.join(", ")}`);
  }
  chEl.innerHTML = chBullets.length
    ? `<div class="title">ข้อสังเกตประสิทธิภาพตามช่องทาง</div><ul>${chBullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
    : "";
}

document.getElementById("importQuotesBtn").addEventListener("click", () => {
  document.getElementById("importQuotesFile").click();
});

document.getElementById("importQuotesFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const r = await fetch("/api/quotations/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, base64 }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "นำเข้าไม่สำเร็จ");
    toast(`นำเข้าสำเร็จ ${j.imported} ใบ จากทั้งหมด ${j.totalRows} แถว${j.skipped ? ` (ข้าม ${j.skipped} แถวที่มีปัญหา)` : ""}`);
    if (j.skipped) console.error("Quotation import errors:", j.errors);
    await refresh();
  } catch (err) {
    toast("นำเข้าไฟล์ไม่สำเร็จ: " + err.message, true);
  } finally {
    e.target.value = "";
  }
});

document.getElementById("clearQuotesBtn").addEventListener("click", async () => {
  if (!confirm("ต้องการลบข้อมูลใบเสนอราคาทั้งหมดใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้")) return;
  try {
    const r = await fetch("/api/quotations", { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "ลบไม่สำเร็จ");
    toast("ลบข้อมูลใบเสนอราคาทั้งหมดเรียบร้อย");
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

function renderDashboard() {
  const s = state.summary;
  const emptyEl = document.getElementById("dashboardEmpty");
  const contentEl = document.getElementById("dashboardContent");

  if (!s || s.n === 0) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = (state.data.months || []).length === 0
      ? "ยังไม่มีข้อมูล กรุณาเพิ่มข้อมูลรายเดือนในแท็บ \"กรอกข้อมูล\" ก่อน"
      : "ไม่พบข้อมูลในช่วงเวลาที่เลือก ลองปรับช่วงเวลาใหม่";
    return;
  }
  contentEl.style.display = "block";
  emptyEl.style.display = "none";

  const warnEl = document.getElementById("costWarningBanner");
  if (s.missingCostYears && s.missingCostYears.length) {
    warnEl.style.display = "block";
    warnEl.textContent = `⚠ ยังไม่ได้กรอกค่าใช้จ่ายสำหรับปี: ${s.missingCostYears.join(", ")} — ตัวเลขต้นทุน/ROAS ของช่วงนี้จะนับต้นทุนปีดังกล่าวเป็น 0 ไปกรอกได้ในแท็บ "กรอกข้อมูล"`;
  } else {
    warnEl.style.display = "none";
  }

  renderStatCards("statCards");
  const multiYear = new Set(s.months.map((m) => m.year)).size > 1;
  const labels = s.months.map((m) => (multiYear ? `${m.month} '${String(m.year + 543).slice(-2)}` : m.month));

  barChart(document.getElementById("chartSessions"), {
    labels, values: s.months.map((m) => m.sessions), color: PALETTE.terra,
  });

  barChart(document.getElementById("chartLeads"), {
    labels, values: s.months.map((m) => m.newLeadLine), color: PALETTE.navy,
  });

  barChart(document.getElementById("chartSales"), {
    labels, values: s.months.map((m) => (m.salesAmount || 0) / 1e6), color: PALETTE.navy,
    format: (v) => v.toFixed(1),
  });

  lineChart(document.getElementById("chartOnline"), {
    labels, values: s.perMonth.map((m) => (m.portionOnline == null ? null : Math.round(m.portionOnline * 10) / 10)), color: PALETTE.terra,
    format: (v) => v.toFixed(0) + "%",
  });

  donutChart(document.getElementById("chartChannel"), {
    labels: ["Organic (SEO)", "Paid Ads", "Direct", "AI"],
    values: [s.channelPct.organic, s.channelPct.paid, s.channelPct.direct, s.channelPct.ai],
    colors: [PALETTE.navy, PALETTE.terra, PALETTE.ice, PALETTE.gray],
  });

  lineChart(document.getElementById("chartCPL"), {
    labels, values: s.perMonth.map((m) => (m.costPerLead == null ? null : Math.round(m.costPerLead * 10) / 10)), color: PALETTE.terra,
    format: (v) => fmtInt(v),
  });

  const singleYearItems = s.costByYear && s.costByYear.length === 1 ? s.costByYear[0].items : [];
  const costChartItems = [...singleYearItems].sort((a, b) => (b.valuePerYear || 0) - (a.valuePerYear || 0));
  hBarChart(document.getElementById("chartCost"), {
    labels: costChartItems.map((i) => i.label), values: costChartItems.map((i) => i.valuePerYear || 0), color: PALETTE.terra,
    format: (v) => fmtInt(v),
  });
}

// ---------- CSV import: flexible number parsing ----------
// Tolerates values as typed/exported from Excel: percent signs ("91%"),
// thousand separators ("1,234,567.89"), currency-style blanks/dashes ("-", " - "),
// and stray whitespace — instead of only accepting a bare number.
function parseFlexNum(raw) {
  if (raw === undefined || raw === null) return NaN;
  let s = String(raw).trim();
  if (s === "") return NaN;
  if (/^[-–—]+$/.test(s)) return 0; // Excel-style dash for zero/blank
  s = s.replace(/[%,\s]/g, "").replace(/บาท|THB|฿/gi, "");
  if (s === "" || s === "-") return 0;
  const v = Number(s);
  return v;
}

// ---------- Data entry: months — CSV template / bulk import ----------
const MONTH_FIELD_DEFS = [
  { key: "year", label: "ปี (เช่น 2025)" },
  { key: "order", label: "เดือนที่ (1-12)" },
  { key: "newPct", label: "New visitor (%)" },
  { key: "returningPct", label: "Returning (%)" },
  { key: "sessions", label: "Site sessions" },
  { key: "channelOrganic", label: "Channel Organic" },
  { key: "channelPaid", label: "Channel Paid" },
  { key: "channelDirect", label: "Channel Direct" },
  { key: "channelAI", label: "Channel AI" },
  { key: "newLeadLine", label: "New Lead (LINE)" },
  { key: "userLine", label: "User สะสม (LINE)" },
  { key: "salesOnline", label: "ยอดขายออนไลน์ (บาท)" },
  { key: "salesAmount", label: "ยอดขายรวม (บาท)" },
];

document.getElementById("downloadMonthTemplate").addEventListener("click", () => {
  const headers = MONTH_FIELD_DEFS.map((f) => f.label);
  downloadTextFile("template_ข้อมูลรายเดือน.csv", toCSV(headers, []));
});

document.getElementById("downloadMonthCurrent").addEventListener("click", () => {
  const headers = MONTH_FIELD_DEFS.map((f) => f.label);
  const months = sortedFullMonths();
  const rows = months.map((m) => {
    const row = {};
    MONTH_FIELD_DEFS.forEach((f) => (row[f.label] = m[f.key]));
    return row;
  });
  downloadTextFile("ข้อมูลรายเดือน_ปัจจุบัน.csv", toCSV(headers, rows));
  if (!months.length) toast("ยังไม่มีข้อมูล ระบบดาวน์โหลด Template เปล่าให้แทน");
});

document.getElementById("importMonthCSVBtn").addEventListener("click", () => {
  document.getElementById("importMonthCSVFile").click();
});

document.getElementById("importMonthCSVFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsedRows = parseCSV(text);
    if (!parsedRows.length) {
      toast("ไม่พบข้อมูลในไฟล์ (หรือมีแต่แถวหัวตาราง)", true);
      return;
    }
    const labelToKey = {};
    MONTH_FIELD_DEFS.forEach((f) => (labelToKey[f.label] = f.key));

    let successCount = 0;
    const errors = [];
    for (let i = 0; i < parsedRows.length; i++) {
      const raw = parsedRows[i];
      const rowNum = i + 2; // +1 for header row, +1 for 1-based
      try {
        const rec = {};
        for (const label in raw) {
          const key = labelToKey[label];
          if (key) rec[key] = raw[label];
        }
        const year = parseInt(rec.year, 10);
        const order = parseInt(rec.order, 10);
        if (!year || year < 2000 || year > 2100) throw new Error("ปีไม่ถูกต้อง");
        if (!order || order < 1 || order > 12) throw new Error("เดือนที่ต้องเป็นตัวเลข 1-12");
        const numFields = ["newPct", "returningPct", "sessions", "channelOrganic", "channelPaid", "channelDirect", "channelAI", "newLeadLine", "userLine", "salesOnline", "salesAmount"];
        const month = { id: `${year}-${String(order).padStart(2, "0")}`, year, order, month: THAI_MONTHS[order - 1] };
        for (const f of numFields) {
          const v = parseFlexNum(rec[f]);
          if (!isFinite(v)) throw new Error(`ค่า "${f}" ไม่ถูกต้องหรือว่างเปล่า`);
          month[f] = v;
        }
        await apiSaveMonth(month);
        successCount++;
      } catch (err) {
        errors.push(`แถว ${rowNum}: ${err.message}`);
      }
    }

    if (successCount) toast(`นำเข้าสำเร็จ ${successCount} แถว${errors.length ? ` (ผิดพลาด ${errors.length} แถว)` : ""}`);
    if (errors.length) {
      console.error("Import errors:", errors);
      toast(errors.slice(0, 3).join(" | ") + (errors.length > 3 ? ` และอีก ${errors.length - 3} รายการ (ดูใน console)` : ""), true);
    }
    await refresh();
  } catch (err) {
    toast("อ่านไฟล์ไม่สำเร็จ: " + err.message, true);
  } finally {
    e.target.value = "";
  }
});

// ---------- Data entry: months ----------
function populateMonthSelect() {
  const sel = document.getElementById("f_order");
  sel.innerHTML = THAI_MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
}
populateMonthSelect();

document.getElementById("clearForm").addEventListener("click", () => {
  document.getElementById("monthForm").reset();
});

document.getElementById("monthForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const order = Number(document.getElementById("f_order").value);
  const year = Number(document.getElementById("f_year").value);
  const month = {
    id: `${year}-${String(order).padStart(2, "0")}`,
    year, order,
    month: THAI_MONTHS[order - 1],
    newPct: Number(document.getElementById("f_newPct").value),
    returningPct: Number(document.getElementById("f_returningPct").value),
    sessions: Number(document.getElementById("f_sessions").value),
    channelOrganic: Number(document.getElementById("f_channelOrganic").value),
    channelPaid: Number(document.getElementById("f_channelPaid").value),
    channelDirect: Number(document.getElementById("f_channelDirect").value),
    channelAI: Number(document.getElementById("f_channelAI").value),
    newLeadLine: Number(document.getElementById("f_newLeadLine").value),
    userLine: Number(document.getElementById("f_userLine").value),
    salesOnline: Number(document.getElementById("f_salesOnline").value),
    salesAmount: Number(document.getElementById("f_salesAmount").value),
  };
  try {
    await apiSaveMonth(month);
    toast(`บันทึกข้อมูลเดือน ${month.month} ${month.year} เรียบร้อย`);
    document.getElementById("monthForm").reset();
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

function editMonth(m) {
  document.getElementById("f_year").value = m.year;
  document.getElementById("f_order").value = m.order;
  document.getElementById("f_newPct").value = m.newPct;
  document.getElementById("f_returningPct").value = m.returningPct;
  document.getElementById("f_sessions").value = m.sessions;
  document.getElementById("f_channelOrganic").value = m.channelOrganic;
  document.getElementById("f_channelPaid").value = m.channelPaid;
  document.getElementById("f_channelDirect").value = m.channelDirect;
  document.getElementById("f_channelAI").value = m.channelAI;
  document.getElementById("f_newLeadLine").value = m.newLeadLine;
  document.getElementById("f_userLine").value = m.userLine;
  document.getElementById("f_salesOnline").value = m.salesOnline;
  document.getElementById("f_salesAmount").value = m.salesAmount;
  document.querySelector('.tab-btn[data-tab="entry"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteMonth(id) {
  if (!confirm("ต้องการลบข้อมูลเดือนนี้ใช่หรือไม่?")) return;
  try {
    await apiDeleteMonth(id);
    toast("ลบข้อมูลเรียบร้อย");
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderMonthTable() {
  const table = document.getElementById("monthTable");
  const months = sortedFullMonths(); // always show ALL months here regardless of dashboard period filter
  const rows = months.map((m) => `
    <tr>
      <td>${m.month} ${m.year}</td>
      <td>${fmtInt(m.sessions)}</td>
      <td>${fmtInt(m.newLeadLine)}</td>
      <td>${fmtInt(m.userLine)}</td>
      <td>${fmtMoney(m.salesOnline)}</td>
      <td>${fmtMoney(m.salesAmount)}</td>
      <td><button class="link" data-edit="${m.id}">แก้ไข</button><button class="link danger" data-del="${m.id}">ลบ</button></td>
    </tr>
  `).join("");
  table.innerHTML = `
    <tr><th>เดือน</th><th>Sessions</th><th>Lead ใหม่</th><th>User LINE</th><th>ยอดขายออนไลน์</th><th>ยอดขายรวม</th><th></th></tr>
    ${rows || '<tr><td colspan="7" style="text-align:center;color:var(--gray)">ยังไม่มีข้อมูล — กรอกฟอร์มด้านบนเพื่อเริ่มเพิ่มข้อมูลเดือนแรก</td></tr>'}
  `;
  table.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => editMonth(months.find((m) => m.id === b.dataset.edit))));
  table.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteMonth(b.dataset.del)));
}

// ---------- Data entry: cost items (per year) ----------
function availableCostYears() {
  const fromCosts = Object.keys(state.data.costItemsByYear || {});
  const fromMonths = (state.data.months || []).map((m) => String(m.year));
  return [...new Set([...fromCosts, ...fromMonths])].sort();
}

function populateCostYearSelect() {
  const years = availableCostYears();
  const sel = document.getElementById("costYearSelect");
  if (!years.length) {
    sel.innerHTML = "";
    state.costYear = "";
    return;
  }
  if (!state.costYear || !years.includes(state.costYear)) {
    state.costYear = years[years.length - 1];
  }
  sel.innerHTML = years.map((y) => `<option value="${y}"${y === state.costYear ? " selected" : ""}>${y}</option>`).join("");
}

document.getElementById("costYearSelect").addEventListener("change", (e) => {
  state.costYear = e.target.value;
  renderCostTable();
});

document.getElementById("addCostYear").addEventListener("click", () => {
  const input = prompt("ระบุปีที่ต้องการเพิ่ม (เช่น 2027):");
  if (!input) return;
  const year = String(parseInt(input, 10));
  if (!/^\d{4}$/.test(year)) {
    toast("กรุณาระบุปีเป็นตัวเลข 4 หลัก", true);
    return;
  }
  if (!state.data.costItemsByYear) state.data.costItemsByYear = {};
  if (!state.data.costItemsByYear[year]) state.data.costItemsByYear[year] = [];
  state.costYear = year;
  populateCostYearSelect();
  renderCostTable();
});

document.getElementById("deleteCostYear").addEventListener("click", async () => {
  if (!state.costYear) return;
  if (!confirm(`ต้องการลบข้อมูลค่าใช้จ่ายทั้งหมดของปี ${state.costYear} ใช่หรือไม่?`)) return;
  try {
    await apiDeleteCostYear(state.costYear);
    toast(`ลบข้อมูลค่าใช้จ่ายปี ${state.costYear} เรียบร้อย`);
    state.costYear = "";
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

function renderCostTable() {
  const table = document.getElementById("costTable");
  const years = availableCostYears();
  if (!years.length) {
    table.innerHTML = '<tr><td style="text-align:center;color:var(--gray)">ยังไม่มีปีให้กรอกค่าใช้จ่าย — เพิ่มข้อมูลรายเดือนก่อน หรือกด "เพิ่มปีใหม่"</td></tr>';
    return;
  }
  const items = (state.data.costItemsByYear && state.data.costItemsByYear[state.costYear]) || [];
  const rows = items.map((c, i) => `
    <tr>
      <td><input type="text" data-field="label" data-idx="${i}" value="${c.label}"></td>
      <td><input type="text" data-field="period" data-idx="${i}" value="${c.period || ""}"></td>
      <td><input type="number" step="0.01" data-field="valuePerYear" data-idx="${i}" value="${c.valuePerYear}"></td>
      <td><button class="link danger" data-delrow="${i}">ลบ</button></td>
    </tr>
  `).join("");
  table.innerHTML = `
    <tr><th>รายการ</th><th>คาบเวลา / หมายเหตุ</th><th>บาท/ปี</th><th></th></tr>
    ${rows || `<tr><td colspan="4" style="text-align:center;color:var(--gray)">ยังไม่มีรายการค่าใช้จ่ายสำหรับปี ${state.costYear} — กด "เพิ่มรายการค่าใช้จ่าย" ด้านล่าง</td></tr>`}
  `;
  table.querySelectorAll("[data-delrow]").forEach((b) => b.addEventListener("click", () => {
    state.data.costItemsByYear[state.costYear].splice(Number(b.dataset.delrow), 1);
    renderCostTable();
  }));
}

document.getElementById("addCostRow").addEventListener("click", () => {
  if (!state.costYear) {
    toast("กรุณาเลือกหรือเพิ่มปีก่อน", true);
    return;
  }
  if (!state.data.costItemsByYear) state.data.costItemsByYear = {};
  if (!state.data.costItemsByYear[state.costYear]) state.data.costItemsByYear[state.costYear] = [];
  state.data.costItemsByYear[state.costYear].push({ label: "รายการใหม่", period: "", valuePerYear: 0 });
  renderCostTable();
});

document.getElementById("saveCostItems").addEventListener("click", async () => {
  if (!state.costYear) {
    toast("กรุณาเลือกหรือเพิ่มปีก่อน", true);
    return;
  }
  const table = document.getElementById("costTable");
  const items = [...((state.data.costItemsByYear && state.data.costItemsByYear[state.costYear]) || [])];
  table.querySelectorAll("input").forEach((inp) => {
    const idx = Number(inp.dataset.idx);
    const field = inp.dataset.field;
    items[idx][field] = field === "valuePerYear" ? Number(inp.value) : inp.value;
  });
  try {
    await apiSaveCostItems(state.costYear, items);
    toast(`บันทึกค่าใช้จ่ายปี ${state.costYear} เรียบร้อย`);
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- Cost items: CSV template / bulk import ----------
const COST_FIELD_DEFS = [
  { key: "year", label: "ปี" },
  { key: "label", label: "รายการ" },
  { key: "period", label: "คาบเวลา / หมายเหตุ" },
  { key: "valuePerYear", label: "บาท/ปี" },
];

document.getElementById("downloadCostTemplate").addEventListener("click", () => {
  const headers = COST_FIELD_DEFS.map((f) => f.label);
  downloadTextFile("template_ค่าใช้จ่าย.csv", toCSV(headers, []));
});

document.getElementById("downloadCostCurrent").addEventListener("click", () => {
  const headers = COST_FIELD_DEFS.map((f) => f.label);
  const byYear = state.data.costItemsByYear || {};
  const years = Object.keys(byYear).sort();
  const rows = [];
  years.forEach((y) => {
    (byYear[y] || []).forEach((c) => {
      const row = {};
      COST_FIELD_DEFS.forEach((f) => (row[f.label] = f.key === "year" ? y : c[f.key]));
      rows.push(row);
    });
  });
  downloadTextFile("ค่าใช้จ่ายทุกปี.csv", toCSV(headers, rows));
  if (!rows.length) toast("ยังไม่มีรายการค่าใช้จ่าย ระบบดาวน์โหลด Template เปล่าให้แทน");
});

document.getElementById("importCostCSVBtn").addEventListener("click", () => {
  document.getElementById("importCostCSVFile").click();
});

document.getElementById("importCostCSVFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsedRows = parseCSV(text);
    if (!parsedRows.length) {
      toast("ไม่พบข้อมูลในไฟล์ (หรือมีแต่แถวหัวตาราง)", true);
      return;
    }
    const labelToKey = {};
    COST_FIELD_DEFS.forEach((f) => (labelToKey[f.label] = f.key));

    const itemsByYear = {}; // { "2025": [items...] }
    const errors = [];
    parsedRows.forEach((raw, i) => {
      const rowNum = i + 2;
      try {
        const rec = {};
        for (const label in raw) {
          const key = labelToKey[label];
          if (key) rec[key] = raw[label];
        }
        const year = parseInt(rec.year, 10);
        if (!year || year < 2000 || year > 2100) throw new Error('ค่า "ปี" ไม่ถูกต้องหรือว่างเปล่า');
        if (!rec.label || !String(rec.label).trim()) throw new Error('ต้องระบุ "รายการ"');
        const v = parseFlexNum(rec.valuePerYear);
        if (!isFinite(v)) throw new Error('ค่า "บาท/ปี" ไม่ถูกต้องหรือว่างเปล่า');
        const yearKey = String(year);
        if (!itemsByYear[yearKey]) itemsByYear[yearKey] = [];
        itemsByYear[yearKey].push({ label: String(rec.label).trim(), period: rec.period || "", valuePerYear: v });
      } catch (err) {
        errors.push(`แถว ${rowNum}: ${err.message}`);
      }
    });

    const years = Object.keys(itemsByYear).sort();
    if (!years.length) {
      toast("ไม่มีแถวที่ถูกต้องให้นำเข้า" + (errors.length ? " — " + errors.slice(0, 3).join(" | ") : ""), true);
      return;
    }
    const summary = years.map((y) => `ปี ${y} (${itemsByYear[y].length} รายการ)`).join(", ");
    if (!confirm(`นำเข้าไฟล์นี้จะแทนที่รายการค่าใช้จ่ายทั้งหมดของ: ${summary} (ปีอื่นจะไม่ถูกแตะต้อง) ยืนยันหรือไม่?`)) {
      return;
    }

    let savedYears = 0;
    for (const y of years) {
      try {
        await apiSaveCostItems(y, itemsByYear[y]);
        savedYears++;
      } catch (err) {
        errors.push(`ปี ${y}: บันทึกไม่สำเร็จ (${err.message})`);
      }
    }
    if (savedYears) {
      state.costYear = years[years.length - 1];
      toast(`นำเข้าสำเร็จ ${savedYears} ปี${errors.length ? ` (มีข้อผิดพลาด ${errors.length} รายการ)` : ""}`);
    }
    if (errors.length) {
      console.error("Import errors:", errors);
      toast(errors.slice(0, 3).join(" | ") + (errors.length > 3 ? ` และอีก ${errors.length - 3} รายการ (ดูใน console)` : ""), true);
    }
    await refresh();
  } catch (err) {
    toast("อ่านไฟล์ไม่สำเร็จ: " + err.message, true);
  } finally {
    e.target.value = "";
  }
});

// ---------- Slide summary tab ----------
function renderSlideTab() {
  const s = state.summary;
  const emptyEl = document.getElementById("slideEmpty");
  const contentEl = document.getElementById("slideContent");
  const note = document.getElementById("slidePeriodNote");

  if (s && s.first && s.last) {
    note.textContent = `แสดงข้อมูลช่วง: ${s.first.month} ${s.first.year} – ${s.last.month} ${s.last.year} (${s.n} เดือน)`;
  } else {
    note.textContent = "เลือกช่วงเวลาที่ต้องการสรุปได้จากด้านบน";
  }

  if (!s || s.n === 0) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = (state.data.months || []).length === 0
      ? "ยังไม่มีข้อมูล กรุณาเพิ่มข้อมูลรายเดือนในแท็บ \"กรอกข้อมูล\" ก่อน จึงจะสร้างสไลด์สรุปได้"
      : "ไม่พบข้อมูลในช่วงเวลาที่เลือก ลองปรับช่วงเวลาในแท็บแดชบอร์ด";
    return;
  }
  contentEl.style.display = "block";
  emptyEl.style.display = "none";

  renderStatCards("statCardsSlide");
  const box = document.getElementById("slideSummaryText");
  const peakTxt = s.peakOnline ? `สูงสุด ${fmtPct(s.peakOnline.portionOnline, 0)} ในเดือน ${s.peakOnline.month}` : "";
  box.innerHTML = `
    <div class="title">ประเด็นสำคัญที่สุด</div>
    <div>สัดส่วนยอดขายที่มาจากช่องทางออนไลน์ ${s.first ? `เริ่มที่ ${fmtPct(s.perMonth[0].portionOnline, 0)} (${s.first.month})` : ""}
    และ${peakTxt ? " " + peakTxt : ""} รวมยอดขายออนไลน์สะสม ${fmtMoney(s.totalSalesOnline / 1e6, 1)} ล้านบาท
    หรือคิดเป็น ${fmtPct((s.totalSalesOnline / (s.totalSalesAmount || 1)) * 100, 0)} ของยอดขายรวมทั้งบริษัท
    ขณะที่งบการตลาดใช้เฉลี่ยเพียง ${fmtMoney(s.avgMonthlySpend, 2)} บาท/เดือน ตลอด ${s.n} เดือน</div>
  `;
}

document.getElementById("exportPptx").addEventListener("click", () => {
  const qs = [];
  if (state.periodFrom) qs.push("from=" + encodeURIComponent(state.periodFrom));
  if (state.periodTo) qs.push("to=" + encodeURIComponent(state.periodTo));
  window.location.href = "/api/export-pptx" + (qs.length ? "?" + qs.join("&") : "");
});

// ---------- Slide summary: normal vs year-over-year mode ----------
state.slideMode = "period";
state.yoyFocusYear = "";

document.querySelectorAll(".slidemode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".slidemode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.slideMode = btn.dataset.slidemode;
    document.getElementById("slidePeriodModeBox").style.display = state.slideMode === "period" ? "block" : "none";
    document.getElementById("slideYoYModeBox").style.display = state.slideMode === "yoy" ? "block" : "none";
    if (state.slideMode === "yoy") {
      populateYoYYearSelect();
      loadYoYPreview();
    }
  });
});

function populateYoYYearSelect() {
  const years = [...new Set((state.data.months || []).map((m) => String(m.year)))].sort().reverse();
  const sel = document.getElementById("yoyFocusYear");
  const prev = state.yoyFocusYear;
  if (!years.length) {
    sel.innerHTML = "";
    state.yoyFocusYear = "";
    return;
  }
  if (!prev || !years.includes(prev)) state.yoyFocusYear = years[0];
  sel.innerHTML = years.map((y) => `<option value="${y}"${y === state.yoyFocusYear ? " selected" : ""}>${y}</option>`).join("");
}

document.getElementById("yoyFocusYear").addEventListener("change", (e) => {
  state.yoyFocusYear = e.target.value;
  loadYoYPreview();
});

async function loadYoYPreview() {
  const emptyEl = document.getElementById("yoyEmpty");
  const contentEl = document.getElementById("yoyContent");
  if (!state.yoyFocusYear) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = "ยังไม่มีข้อมูลรายเดือนเพียงพอสำหรับเปรียบเทียบปีต่อปี กรุณาเพิ่มข้อมูลในแท็บ \"กรอกข้อมูล\" ก่อน";
    return;
  }
  try {
    const r = await fetch("/api/yoy?focusYear=" + encodeURIComponent(state.yoyFocusYear));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "โหลดข้อมูลเปรียบเทียบไม่สำเร็จ");
    const yoy = j.yoy;
    if (!yoy.available) {
      contentEl.style.display = "none";
      emptyEl.style.display = "block";
      emptyEl.textContent = `ไม่มีข้อมูลปี ${yoy.compareYear} ให้เปรียบเทียบกับปี ${yoy.focusYear} (ต้องมีข้อมูลทั้งสองปีในเดือนที่ตรงกันอย่างน้อย 1 เดือน) — ลองเลือกปีอื่น หรือเพิ่มข้อมูลปี ${yoy.compareYear} ในแท็บ "กรอกข้อมูล"`;
      return;
    }
    emptyEl.style.display = "none";
    contentEl.style.display = "block";
    const box = document.getElementById("yoySummaryBox");
    const monthsTxt = yoy.focus.months.length
      ? `${yoy.focus.months[0].month} – ${yoy.focus.months[yoy.focus.months.length - 1].month}`
      : "";
    const rows = yoy.metrics.map((m) => {
      const good = m.higherIsBetter === null ? null : (m.higherIsBetter ? m.pctChange >= 0 : m.pctChange <= 0);
      const color = m.pctChange == null ? "var(--gray)" : good === null ? "var(--navy)" : good ? "#1E7A34" : "#B3261E";
      const sign = m.pctChange == null ? "N/A" : (m.pctChange >= 0 ? "+" : "") + m.pctChange.toFixed(1) + "%";
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--ice)">
        <span>${m.label}</span>
        <span style="color:${color};font-weight:700">${sign}</span>
      </div>`;
    }).join("");
    box.innerHTML = `
      <div class="title">เปรียบเทียบปี ${state.yoyFocusYear} กับปี ${yoy.compareYear} (ช่วง ${monthsTxt}, ${yoy.monthCount} เดือน)</div>
      <div style="margin-top:8px">${rows}</div>
    `;
  } catch (err) {
    contentEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = err.message;
  }
}

document.getElementById("exportYoYPptx").addEventListener("click", () => {
  if (!state.yoyFocusYear) {
    toast("กรุณาเลือกปีที่ต้องการเปรียบเทียบก่อน", true);
    return;
  }
  window.location.href = "/api/export-pptx?mode=yoy&focusYear=" + encodeURIComponent(state.yoyFocusYear);
});

// ---------- Boot ----------
refresh().catch((err) => toast(err.message, true));
