"use strict";

const pptxgen = require("pptxgenjs");
const { fmtInt, fmtMoney, fmtPct } = require("./calc");

const NAVY = "1E2761";
const NAVY_DARK = "141B47";
const ICE = "CADCFC";
const ICE_LIGHT = "EEF3FE";
const TERRA = "C1652F";
const WHITE = "FFFFFF";
const GRAY = "5B6472";
const FONT = "Tahoma";
const PGW = 13.3;
const PGH = 7.5;

function addFooter(s, pageNum, dark, subtitle) {
  s.addText(subtitle || "สรุปผลการตลาดดิจิทัล", {
    x: 0.5, y: PGH - 0.42, w: 8, h: 0.3,
    fontFace: FONT, fontSize: 9, color: dark ? ICE : GRAY, align: "left",
  });
  s.addText(String(pageNum), {
    x: PGW - 1.0, y: PGH - 0.42, w: 0.5, h: 0.3,
    fontFace: FONT, fontSize: 9, color: dark ? ICE : GRAY, align: "right",
  });
}

function sectionHeader(s, title, sub) {
  s.addText(title, {
    x: 0.6, y: 0.45, w: 11.5, h: 0.6,
    fontFace: FONT, fontSize: 28, bold: true, color: NAVY, align: "left", margin: 0,
  });
  if (sub) {
    s.addText(sub, {
      x: 0.6, y: 1.02, w: 11.5, h: 0.35,
      fontFace: FONT, fontSize: 13, color: GRAY, align: "left", margin: 0,
    });
  }
}

function statCard(s, x, y, w, h, bigText, label) {
  s.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: ICE_LIGHT },
    line: { color: ICE, width: 1 },
  });
  s.addText(bigText, {
    x: x + 0.15, y: y + 0.12, w: w - 0.3, h: h * 0.55,
    fontFace: FONT, fontSize: 26, bold: true, color: TERRA, align: "left", margin: 0,
  });
  s.addText(label, {
    x: x + 0.15, y: y + h * 0.6, w: w - 0.3, h: h * 0.38,
    fontFace: FONT, fontSize: 11.5, color: NAVY, align: "left", margin: 0, valign: "top",
  });
}

function bulletList(s, x, y, w, h, items, opts) {
  opts = opts || {};
  const paras = items.map((t, i) => ({
    text: t,
    options: {
      bullet: { code: "25CF", indent: 14 },
      color: opts.color || NAVY,
      fontSize: opts.fontSize || 13.5,
      fontFace: FONT,
      breakLine: i !== items.length - 1,
      paraSpaceAfter: 12,
    },
  }));
  s.addText(paras, { x, y, w, h, valign: "top", margin: 0 });
}

function motifCircles(s, dark) {
  s.addShape("ellipse", {
    x: PGW - 2.6, y: -1.3, w: 4.2, h: 4.2,
    fill: { color: dark ? NAVY_DARK : ICE_LIGHT, transparency: dark ? 0 : 40 },
    line: { type: "none" },
  });
  s.addShape("ellipse", {
    x: PGW - 1.1, y: PGH - 1.6, w: 2.6, h: 2.6,
    fill: { color: TERRA, transparency: dark ? 55 : 85 },
    line: { type: "none" },
  });
}

async function buildDeck(data, summary) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const multiYear = (summary.yearsInRange || []).length > 1;
  const MONTHS = summary.months.map((m) => (multiYear ? `${m.month} '${String(m.year + 543).slice(-2)}` : m.month));
  const SESSIONS = summary.months.map((m) => m.sessions || 0);
  const LEADS = summary.months.map((m) => m.newLeadLine || 0);
  const SALES_TOTAL_M = summary.months.map((m) => (m.salesAmount || 0) / 1e6);
  const ONLINE_PORTION = summary.perMonth.map((m) => (m.portionOnline == null ? 0 : Math.round(m.portionOnline * 10) / 10));
  const COST_PER_LEAD = summary.perMonth.map((m) => (m.costPerLead == null ? 0 : Math.round(m.costPerLead * 10) / 10));

  const beYear = (y) => y + 543;
  const dateRange = summary.first && summary.last
    ? (summary.first.year === summary.last.year
        ? `${summary.first.month} – ${summary.last.month} ${beYear(summary.first.year)}`
        : `${summary.first.month} ${beYear(summary.first.year)} – ${summary.last.month} ${beYear(summary.last.year)}`)
    : "";
  const footerSub = `Metropolitan Products  |  สรุปผลการตลาดดิจิทัล ${dateRange}`;

  // ---------- Slide 1: Title ----------
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    motifCircles(s, true);
    s.addText("ผลการดำเนินงานการตลาดดิจิทัล", {
      x: 0.8, y: 2.55, w: 11.2, h: 1.0,
      fontFace: FONT, fontSize: 40, bold: true, color: WHITE, align: "left", margin: 0,
    });
    s.addText("ภาพรวมการลงทุน SEO / Ads / Bidding และผลลัพธ์ด้านยอดขาย", {
      x: 0.8, y: 3.55, w: 9.5, h: 0.5,
      fontFace: FONT, fontSize: 17, color: ICE, align: "left", margin: 0,
    });
    s.addShape("rect", { x: 0.85, y: 4.35, w: 1.4, h: 0.03, fill: { color: TERRA }, line: { type: "none" } });
    s.addText(dateRange, {
      x: 0.8, y: 4.55, w: 6, h: 0.4,
      fontFace: FONT, fontSize: 14, color: WHITE, align: "left", margin: 0,
    });
    s.addText("นำเสนอต่อคณะผู้บริหาร  |  บริษัท เมโทรโปลิแทน โปรดักส์ จำกัด", {
      x: 0.8, y: 6.6, w: 9, h: 0.4,
      fontFace: FONT, fontSize: 12, color: ICE, align: "left", margin: 0,
    });
  }

  // ---------- Slide 2: Executive Summary ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "สรุปสำหรับผู้บริหาร", `ภาพรวมผลลัพธ์หลัก ${summary.n} เดือน (${dateRange})`);

    const cardY = 1.65, cardH = 1.5, gap = 0.35;
    const cardW = (PGW - 1.2 - gap * 3) / 4;
    const costPerLeadAvg = summary.totalLeads > 0 ? summary.totalSpend / summary.totalLeads : null;
    const stats = [
      [`฿${fmtInt(summary.totalSpend)}`, `งบการตลาดรวม ${summary.n} เดือน (${fmtPct(summary.pctOfRevenue, 2)} ของยอดขายรวม)`],
      [fmtInt(summary.totalSessions), `Site sessions สะสม${summary.sessionGrowthPct != null ? ` (${summary.sessionGrowthPct >= 0 ? "+" : ""}${summary.sessionGrowthPct.toFixed(0)}%)` : ""}`],
      [`${fmtInt(summary.totalLeads)} ราย`, `Lead ใหม่สะสม${summary.leadGrowthPct != null ? ` (${summary.leadGrowthPct >= 0 ? "+" : ""}${summary.leadGrowthPct.toFixed(0)}%)` : ""}`],
      [`฿${fmtInt(costPerLeadAvg)}`, `ต้นทุนเฉลี่ยต่อ Lead (${summary.n} เดือน)`],
    ];
    stats.forEach((st, i) => statCard(s, 0.6 + i * (cardW + gap), cardY, cardW, cardH, st[0], st[1]));

    s.addShape("roundRect", {
      x: 0.6, y: cardY + cardH + 0.45, w: PGW - 1.2, h: 1.55, rectRadius: 0.08,
      fill: { color: NAVY }, line: { type: "none" },
    });
    s.addText("ประเด็นสำคัญที่สุด", {
      x: 0.95, y: cardY + cardH + 0.62, w: 6, h: 0.35,
      fontFace: FONT, fontSize: 13, bold: true, color: TERRA, margin: 0,
    });
    const peakTxt = summary.peakOnline ? `สูงสุด ${fmtPct(summary.peakOnline.portionOnline, 0)} ในเดือน ${summary.peakOnline.month}` : "";
    s.addText(
      `สัดส่วนยอดขายที่มาจากช่องทางออนไลน์ ${summary.first ? `เริ่มที่ ${fmtPct(summary.perMonth[0].portionOnline, 0)} (${summary.first.month})` : ""} ` +
      `และ${peakTxt ? ` ${peakTxt}` : ""} รวมยอดขายออนไลน์สะสม ${fmtMoney(summary.totalSalesOnline / 1e6, 1)} ล้านบาท หรือคิดเป็น ` +
      `${fmtPct((summary.totalSalesOnline / (summary.totalSalesAmount || 1)) * 100, 0)} ของยอดขายรวมทั้งบริษัท ขณะที่งบการตลาดใช้เฉลี่ยเพียง ` +
      `${fmtMoney(summary.avgMonthlySpend, 2)} บาท/เดือน ตลอด ${summary.n} เดือน`,
      {
        x: 0.95, y: cardY + cardH + 0.98, w: PGW - 1.9, h: 0.95,
        fontFace: FONT, fontSize: 13.5, color: WHITE, align: "left", margin: 0, valign: "top", lineSpacingMultiple: 1.15,
      }
    );
    addFooter(s, 2, false, footerSub);
  }

  // ---------- Slide 3: Cost breakdown (year-aware) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    const costByYear = summary.costByYear || [];
    const isSingleYear = costByYear.length <= 1;

    if (isSingleYear) {
      sectionHeader(s, "รายละเอียดค่าใช้จ่ายการตลาด", `ต้นทุนตามรายการ ปี ${costByYear[0] ? costByYear[0].year : "-"} (บาท/ปี)`);
      const items = costByYear[0] ? costByYear[0].items : [];
      const totalYear = costByYear[0] ? costByYear[0].totalYear : 0;
      const totalMonth = costByYear[0] ? costByYear[0].totalMonth : 0;

      const tableRows = [
        [
          { text: "รายการค่าใช้จ่าย", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, valign: "middle" } },
          { text: "บาท/ปี", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
        ],
      ];
      items.forEach((item, i) => {
        const rowFill = i % 2 === 0 ? WHITE : ICE_LIGHT;
        tableRows.push([
          { text: `${i + 1}. ${item.label}${item.period ? ` (${item.period})` : ""}`, options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, valign: "middle" } },
          { text: fmtMoney(item.valuePerYear), options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
        ]);
      });
      tableRows.push([
        { text: "รวมต่อปี", options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12.5, fontFace: FONT, valign: "middle" } },
        { text: fmtMoney(totalYear), options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
      ]);
      tableRows.push([
        { text: "รวมต่อเดือน", options: { bold: true, color: NAVY, fill: { color: ICE_LIGHT }, fontSize: 12.5, fontFace: FONT, valign: "middle" } },
        { text: fmtMoney(totalMonth), options: { bold: true, color: NAVY, fill: { color: ICE_LIGHT }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
      ]);

      s.addTable(tableRows, {
        x: 0.6, y: 1.65, w: 6.2, h: 3.75,
        colW: [4.15, 2.05],
        border: { type: "solid", color: "E4E9F2", pt: 0.75 },
        autoPage: false,
        rowH: 0.47,
      });

      const sortedItems = [...items].sort((a, b) => (b.valuePerYear || 0) - (a.valuePerYear || 0));
      if (sortedItems.length) {
        s.addChart(
          pres.ChartType.bar,
          [{ name: "บาท/ปี", labels: sortedItems.map((i) => i.label), values: sortedItems.map((i) => i.valuePerYear || 0) }],
          {
            x: 7.15, y: 1.65, w: 5.55, h: 3.75,
            barDir: "bar",
            chartColors: [TERRA],
            showTitle: true, title: "สัดส่วนค่าใช้จ่ายตามรายการ (บาท/ปี)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
            showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9.5, dataLabelColor: NAVY, dataLabelFontFace: FONT,
            dataLabelFormatCode: "#,##0",
            showLegend: false,
            catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10,
            valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
            valGridLine: { color: "E4E9F2", size: 1 },
            catGridLine: { style: "none" },
          }
        );
      }

      const top3 = sortedItems.slice(0, 3).map((i) => `${i.label} (${fmtPct((i.valuePerYear / (totalYear || 1)) * 100, 0)})`);
      const lineItems = items.filter((i) => /line/i.test(i.label));
      const lineTotal = lineItems.reduce((s2, i) => s2 + (i.valuePerYear || 0), 0);
      const bullets = [];
      if (sortedItems.length) {
        bullets.push(`${sortedItems[0].label} คิดเป็นสัดส่วนใหญ่ที่สุดที่ ${fmtPct((sortedItems[0].valuePerYear / (totalYear || 1)) * 100, 0)} ของงบทั้งหมด${top3.length > 1 ? ` รองลงมาคือ ${top3.slice(1).join(" และ ")}` : ""}`);
      } else {
        bullets.push(`ยังไม่ได้กรอกรายการค่าใช้จ่ายสำหรับปี ${costByYear[0] ? costByYear[0].year : "-"}`);
      }
      if (lineItems.length) {
        bullets.push(`ต้นทุน LINE OA รวม ${fmtInt(lineTotal)} บาท/ปี ใช้สนับสนุนฐาน LINE user ที่เพิ่มขึ้นต่อเนื่องถึง ${fmtInt(summary.latestUserLine)} ราย (${summary.last ? summary.last.month : "-"})`);
      }
      bulletList(s, 0.6, 5.65, PGW - 1.2, 1.5, bullets, { fontSize: 13 });
    } else {
      // Multi-year: compare annual marketing budget across years
      sectionHeader(s, "รายละเอียดค่าใช้จ่ายการตลาด", "เปรียบเทียบงบประมาณตามปี (บาท)");

      const tableRows = [
        [
          { text: "ปี", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, valign: "middle" } },
          { text: "จำนวนรายการ", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
          { text: "รวมต่อปี", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
          { text: "รวมต่อเดือน", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
        ],
      ];
      costByYear.forEach((cy, i) => {
        const rowFill = i % 2 === 0 ? WHITE : ICE_LIGHT;
        tableRows.push([
          { text: cy.year + (cy.items.length === 0 ? " (ยังไม่กรอกค่าใช้จ่าย)" : ""), options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, valign: "middle" } },
          { text: String(cy.items.length), options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
          { text: fmtMoney(cy.totalYear), options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
          { text: fmtMoney(cy.totalMonth), options: { color: NAVY, fill: { color: rowFill }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
        ]);
      });
      tableRows.push([
        { text: "เฉลี่ยต่อเดือน (ตลอดช่วงที่แสดง)", options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 11.5, fontFace: FONT, valign: "middle" } },
        { text: "", options: { fill: { color: TERRA } } },
        { text: "", options: { fill: { color: TERRA } } },
        { text: fmtMoney(summary.avgMonthlySpend), options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12.5, fontFace: FONT, align: "right", valign: "middle" } },
      ]);

      s.addTable(tableRows, {
        x: 0.6, y: 1.65, w: 6.5, h: 3.75,
        colW: [2.2, 1.3, 1.5, 1.5],
        border: { type: "solid", color: "E4E9F2", pt: 0.75 },
        autoPage: false,
        rowH: 0.5,
      });

      s.addChart(
        pres.ChartType.bar,
        [{ name: "งบรวมต่อปี (บาท)", labels: costByYear.map((cy) => cy.year), values: costByYear.map((cy) => cy.totalYear) }],
        {
          x: 7.4, y: 1.65, w: 5.3, h: 3.75,
          chartColors: [TERRA],
          showTitle: true, title: "งบการตลาดรวมต่อปี (บาท)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
          showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: NAVY, dataLabelFontFace: FONT,
          dataLabelFormatCode: "#,##0",
          showLegend: false,
          catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11,
          valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
          valGridLine: { color: "E4E9F2", size: 1 },
          catGridLine: { style: "none" },
        }
      );

      const maxYear = costByYear.reduce((a, b) => (b.totalYear > a.totalYear ? b : a));
      const minYear = costByYear.reduce((a, b) => (b.totalYear < a.totalYear ? b : a));
      const bullets = [
        `ปี ${maxYear.year} มีงบการตลาดสูงสุดที่ ${fmtInt(maxYear.totalYear)} บาท/ปี ขณะที่ปี ${minYear.year} ใช้งบต่ำสุดที่ ${fmtInt(minYear.totalYear)} บาท/ปี`,
      ];
      if (summary.missingCostYears && summary.missingCostYears.length) {
        bullets.push(`⚠ ยังไม่ได้กรอกค่าใช้จ่ายสำหรับปี: ${summary.missingCostYears.join(", ")} — ตัวเลขต้นทุนของปีเหล่านี้จะถูกนับเป็น 0 จนกว่าจะกรอกข้อมูล`);
      }
      bulletList(s, 0.6, 5.65, PGW - 1.2, 1.5, bullets, { fontSize: 13 });
    }
    addFooter(s, 3, false, footerSub);
  }

  // ---------- Slide 4: Traffic & Lead growth ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "การเติบโตของ Traffic และ Lead", "Site sessions และ Lead ใหม่จาก LINE OA รายเดือน");

    s.addChart(
      pres.ChartType.bar,
      [{ name: "Site sessions", labels: MONTHS, values: SESSIONS }],
      {
        x: 0.6, y: 1.6, w: 6.0, h: 2.35,
        chartColors: [TERRA],
        showTitle: true, title: "Site sessions รายเดือน", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        showLegend: false,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
        barGapWidthPct: 35,
      }
    );
    s.addChart(
      pres.ChartType.bar,
      [{ name: "Lead ใหม่จาก LINE OA", labels: MONTHS, values: LEADS }],
      {
        x: 0.6, y: 4.15, w: 6.0, h: 2.2,
        chartColors: [NAVY],
        showTitle: true, title: "Lead ใหม่จาก LINE OA รายเดือน (ราย)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        showLegend: false,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
        barGapWidthPct: 35,
      }
    );

    const maxS = summary.months.reduce((a, b) => (b.sessions > a.sessions ? b : a), summary.months[0] || {});
    bulletList(
      s, 7.05, 1.75, 5.65, 4.6,
      [
        summary.first && summary.last
          ? `Session เติบโตต่อเนื่อง จาก ${fmtInt(summary.first.sessions)} ครั้ง (${summary.first.month}) เป็นสูงสุด ${fmtInt(maxS.sessions)} ครั้ง (${maxS.month}) รวม ${summary.sessionGrowthPct >= 0 ? "+" : ""}${summary.sessionGrowthPct.toFixed(0)}% ตลอดช่วง`
          : "",
        summary.first && summary.last
          ? `Lead ใหม่จาก LINE OA โต ${summary.leadGrowthPct >= 0 ? "+" : ""}${summary.leadGrowthPct.toFixed(0)}% (${fmtInt(summary.first.newLeadLine)} → ${fmtInt(summary.last.newLeadLine)} ราย) ${summary.leadGrowthPct > summary.sessionGrowthPct ? `เร็วกว่าการเติบโตของ session (${summary.sessionGrowthPct.toFixed(0)}%) ชี้ว่าคุณภาพ traffic และอัตราแปลงดีขึ้น` : `เทียบกับ session ที่โต ${summary.sessionGrowthPct.toFixed(0)}%`}`
          : "",
        `อัตราแปลง session → lead เฉลี่ยอยู่ที่ราว ${fmtPct(summary.avgConversion, 1)} ต่อเดือน ถือว่าสม่ำเสมอสำหรับกลุ่มลูกค้าอุตสาหกรรม B2B`,
      ].filter(Boolean),
      { fontSize: 13 }
    );
    addFooter(s, 4, false, footerSub);
  }

  // ---------- Slide 5: Channel mix ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "สัดส่วนช่องทางเข้าเว็บไซต์", `สะสม ${summary.n} เดือน (${dateRange})`);

    s.addChart(
      pres.ChartType.pie,
      [{
        name: "Channel",
        labels: ["Organic (SEO)", "Paid Ads", "Direct", "AI"],
        values: [summary.channelPct.organic, summary.channelPct.paid, summary.channelPct.direct, summary.channelPct.ai],
      }],
      {
        x: 0.9, y: 1.7, w: 5.9, h: 4.6,
        chartColors: [NAVY, TERRA, ICE, "9AA7C2"],
        showTitle: false,
        showValue: true, dataLabelFormatCode: '0.0"%"', dataLabelPosition: "outEnd",
        dataLabelFontSize: 11, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        showLegend: true, legendPos: "b", legendColor: NAVY, legendFontFace: FONT, legendFontSize: 11,
      }
    );

    bulletList(
      s, 7.15, 1.75, 5.55, 4.4,
      [
        `Organic (SEO) เป็นช่องทางหลักที่ ${fmtPct(summary.channelPct.organic, 0)} ของ session ทั้งหมด สะท้อนว่าการลงทุน SEO สร้างฐาน traffic ระยะยาวได้ดี`,
        `Paid ads ยังจำเป็นเพื่อรักษาปริมาณ traffic ในระยะสั้น (${fmtPct(summary.channelPct.paid, 0)}) ควบคู่กับ SEO`,
        `Direct traffic ${fmtPct(summary.channelPct.direct, 0)} แสดงถึงการรับรู้แบรนด์ในกลุ่มลูกค้าเดิม`,
        `ช่องทาง AI (เช่น การอ้างอิงจาก AI search) เริ่มมีปริมาณแม้ยังน้อย (${fmtPct(summary.channelPct.ai, 1)}) ควรจับตาเป็นเทรนด์ใหม่`,
      ],
      { fontSize: 13 }
    );
    addFooter(s, 5, false, footerSub);
  }

  // ---------- Slide 6: Cost efficiency ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "ประสิทธิภาพต้นทุนการตลาด", "ต้นทุนเฉลี่ยต่อ Lead รายเดือน (บาท)");

    s.addChart(
      pres.ChartType.line,
      [{ name: "ต้นทุนต่อ Lead (บาท)", labels: MONTHS, values: COST_PER_LEAD }],
      {
        x: 0.6, y: 1.65, w: 7.3, h: 4.7,
        chartColors: [TERRA],
        lineSize: 3, lineSmooth: false,
        showTitle: false,
        showValue: true, dataLabelPosition: "t", dataLabelFontSize: 10, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        dataLabelFormatCode: "#,##0",
        showLegend: false,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
        valAxisMinVal: 0,
      }
    );

    bulletList(
      s, 8.15, 1.75, 4.55, 4.4,
      [
        summary.maxCPL && summary.minCPL
          ? `ต้นทุนต่อ Lead อยู่ในช่วง ${fmtMoney(summary.minCPL.costPerLead, 1)} บาท (${summary.minCPL.month}) ถึง ${fmtMoney(summary.maxCPL.costPerLead, 1)} บาท (${summary.maxCPL.month})`
          : "",
        `งบการตลาดเฉลี่ย ${fmtMoney(summary.avgMonthlySpend)} บาท/เดือน ตลอด ${summary.n} เดือน ควบคุมต้นทุนได้ดี ไม่มีการใช้จ่ายเกินแผน`,
        `เมื่อเทียบกับยอดขายรวมของบริษัท งบการตลาดคิดเป็นเพียง ${fmtPct(summary.pctOfRevenue, 2)} ของยอดขาย ถือว่าใช้ทรัพยากรน้อยมากเมื่อเทียบกับผลลัพธ์`,
      ].filter(Boolean),
      { fontSize: 13.5 }
    );
    addFooter(s, 6, false, footerSub);
  }

  // ---------- Slide 7: Sales performance & online contribution ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "ยอดขายรวม และสัดส่วนยอดขายออนไลน์", "รายเดือน (ล้านบาท / %)");

    s.addChart(
      pres.ChartType.bar,
      [{ name: "ยอดขายรวม (ล้านบาท)", labels: MONTHS, values: SALES_TOTAL_M }],
      {
        x: 0.6, y: 1.6, w: 6.0, h: 2.35,
        chartColors: [NAVY],
        showTitle: true, title: "ยอดขายรวมต่อเดือน (ล้านบาท)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        dataLabelFormatCode: "0.0",
        showLegend: false,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
      }
    );
    s.addChart(
      pres.ChartType.line,
      [{ name: "สัดส่วนยอดขายออนไลน์ (%)", labels: MONTHS, values: ONLINE_PORTION }],
      {
        x: 0.6, y: 4.15, w: 6.0, h: 2.2,
        chartColors: [TERRA],
        lineSize: 3,
        showTitle: true, title: "สัดส่วนยอดขายออนไลน์ (%)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: true, dataLabelPosition: "t", dataLabelFontSize: 9, dataLabelColor: NAVY, dataLabelFontFace: FONT,
        dataLabelFormatCode: '0"%"',
        showLegend: false,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
        valAxisMinVal: 0,
      }
    );

    bulletList(
      s, 7.05, 1.75, 5.65, 4.6,
      [
        summary.minSalesMonth && summary.maxSalesMonth
          ? `ยอดขายรวมเฉลี่ยเดือนละ ${fmtMoney(summary.avgSalesAmount / 1e6, 1)} ล้านบาท แต่ผันผวน อยู่ในช่วง ${fmtMoney(summary.minSalesMonth.salesAmount / 1e6, 1)}–${fmtMoney(summary.maxSalesMonth.salesAmount / 1e6, 1)} ล้านบาท`
          : "",
        summary.first && summary.peakOnline
          ? `สัดส่วนยอดขายออนไลน์ขยับจาก ${fmtPct(summary.perMonth[0].portionOnline, 0)} (${summary.first.month}) เป็น ${fmtPct(summary.perMonth[summary.n - 1].portionOnline, 0)} (${summary.last.month}) พีคสูงสุดที่ ${fmtPct(summary.peakOnline.portionOnline, 0)} (${summary.peakOnline.month})`
          : "",
        `ยอดขายออนไลน์สะสม ${summary.n} เดือน = ${fmtMoney(summary.totalSalesOnline / 1e6, 1)} ล้านบาท คิดเป็น ${fmtPct((summary.totalSalesOnline / (summary.totalSalesAmount || 1)) * 100, 0)} ของยอดขายรวมทั้งหมด`,
        "แนวโน้มสัดส่วนออนไลน์ที่เพิ่มขึ้น สะท้อนว่าการลงทุนดิจิทัลเริ่มมีบทบาทต่อยอดขายบริษัทชัดเจนขึ้น",
      ].filter(Boolean),
      { fontSize: 13 }
    );
    addFooter(s, 7, false, footerSub);
  }

  // ---------- Slide 8: Key insight (auto anomaly detection) ----------
  {
    const s = pres.addSlide();
    s.background = { color: ICE_LIGHT };
    sectionHeader(s, "ประเด็นที่ต้องจับตา: ความผันผวนของยอดขายรวม", null);

    const po = summary.peakOnline;
    const isLow = po && summary.peakOnlineSalesRank && summary.peakOnlineSalesRank <= Math.ceil(summary.n / 2);
    const headline = po
      ? `เดือน${po.month}: สัดส่วนยอดขายออนไลน์สูงสุด (${fmtPct(po.portionOnline, 0)}) แต่ยอดขายรวม${isLow ? `กลับอยู่ในกลุ่มต่ำ (อันดับ ${summary.peakOnlineSalesRank} จาก ${summary.n} เดือน)` : `อยู่ในกลุ่มปานกลาง-สูง (อันดับ ${summary.peakOnlineSalesRank} จาก ${summary.n} เดือน)`}`
      : "ยังไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์ความผันผวน";

    s.addShape("roundRect", {
      x: 0.6, y: 1.4, w: PGW - 1.2, h: 1.7, rectRadius: 0.08,
      fill: { color: WHITE }, line: { color: TERRA, width: 1.5 },
    });
    s.addText(headline, {
      x: 0.95, y: 1.55, w: PGW - 1.9, h: 1.4,
      fontFace: FONT, fontSize: 16.5, bold: true, color: NAVY, align: "left", margin: 0, valign: "top", lineSpacingMultiple: 1.2,
    });

    const bullets = isLow
      ? [
          `แม้ช่องทางออนไลน์จะทำงานได้ดีขึ้นในเดือน${po.month} (ยอดขายออนไลน์ ${fmtMoney(po.salesOnline / 1e6, 2)} ล้านบาท) แต่ยอดขายรวมของบริษัทกลับไม่สูงตาม แสดงว่ายอดขายฝั่ง offline ลดลงมากในช่วงเดียวกัน`,
          "สรุปได้ว่า ยอดขายรวมของบริษัทยังผูกกับปัจจัย offline (ทีมขายเดิม / ดีลขนาดใหญ่) เป็นหลัก มากกว่าช่องทางดิจิทัล",
          "ควรตรวจสอบสาเหตุความผันผวนของยอดขายรวมในแต่ละเดือน (ดีลหลุด ฤดูกาลก่อสร้าง หรือปัจจัยคู่แข่ง) เพื่อแยกผลกระทบออกจากผลของงานการตลาดดิจิทัล",
          "แนะนำให้ติดตาม pipeline ฝั่ง offline คู่ขนานกับตัวชี้วัดดิจิทัล เพื่อประเมินภาพรวมยอดขายได้แม่นยำขึ้น",
        ]
      : [
          `เดือนที่สัดส่วนออนไลน์สูงสุดยังคงมียอดขายรวมอยู่ในระดับปานกลางถึงสูง แสดงว่าช่องทางออนไลน์และ offline เติบโตไปในทิศทางที่สอดคล้องกันมากขึ้น`,
          "ควรติดตามแนวโน้มนี้ต่อเนื่องเพื่อยืนยันว่าการลงทุนดิจิทัลเสริมยอดขายรวม ไม่ได้เพียงแย่งส่วนแบ่งจากช่องทาง offline",
          "แนะนำให้ติดตาม pipeline ฝั่ง offline คู่ขนานกับตัวชี้วัดดิจิทัล เพื่อประเมินภาพรวมยอดขายได้แม่นยำขึ้น",
        ];
    bulletList(s, 0.6, 3.5, PGW - 1.2, 3.3, bullets, { fontSize: 14, color: NAVY });
    addFooter(s, 8, false, footerSub);
  }

  // ---------- Slide 9: ROI ----------
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    motifCircles(s, true);
    s.addText("การประเมินผลตอบแทนจากการลงทุน (ROI)", {
      x: 0.6, y: 0.5, w: 10.5, h: 0.6,
      fontFace: FONT, fontSize: 28, bold: true, color: WHITE, margin: 0,
    });

    s.addShape("roundRect", { x: 0.6, y: 1.7, w: 4.3, h: 3.2, rectRadius: 0.08, fill: { color: NAVY_DARK }, line: { type: "none" } });
    s.addText(`${Math.round(summary.roasRaw || 0)} เท่า`, {
      x: 0.6, y: 2.15, w: 4.3, h: 1.1, align: "center",
      fontFace: FONT, fontSize: 48, bold: true, color: TERRA, margin: 0,
    });
    s.addText(`ROAS ดิบ (ยอดขายออนไลน์ ÷ งบโฆษณา)\nสะสม ${summary.n} เดือน`, {
      x: 0.85, y: 3.3, w: 3.8, h: 0.9, align: "center",
      fontFace: FONT, fontSize: 13, color: ICE, margin: 0,
    });
    s.addText(`${fmtMoney(summary.totalSalesOnline / 1e6, 1)}M ÷ ${fmtMoney(summary.totalSpend / 1e6, 3)}M บาท`, {
      x: 0.85, y: 4.3, w: 3.8, h: 0.4, align: "center",
      fontFace: FONT, fontSize: 11, color: "8FA3D0", margin: 0, italic: true,
    });

    bulletList(
      s, 5.35, 1.85, 7.35, 4.9,
      [
        "ตัวเลข ROAS นี้คำนวณจากยอดขายออนไลน์ทั้งหมดหารด้วยงบโฆษณา ซึ่งยังไม่ได้แยกว่ามาจาก paid ads, SEO (organic) หรือ direct traffic ล้วนๆ จึงเป็นตัวเลขที่ \"สูงเกินจริง\" หากใช้วัด paid ads เพียงอย่างเดียว",
        "ควรแยก tracking เพื่อดูว่า lead และยอดขายส่วนใดมาจาก channel-paid โดยเฉพาะ จะได้ ROAS ที่แม่นยำและใช้ตัดสินใจเพิ่ม/ลดงบได้ถูกต้อง",
        `ในภาพรวม แม้ ROAS ที่แท้จริงจะต่ำกว่าตัวเลขนี้ งบการตลาดที่ใช้เพียง ${fmtPct(summary.pctOfRevenue, 2)} ของยอดขายรวม ก็ยังถือว่าคุ้มค่าอย่างมากเมื่อเทียบกับอุตสาหกรรม B2B ทั่วไป`,
      ],
      { fontSize: 14, color: WHITE }
    );
    addFooter(s, 9, true, footerSub);
  }

  // ---------- Slide 10: Risks & Recommendations ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "ความเสี่ยงและข้อเสนอแนะ", null);

    const avgReturning = summary.months.length
      ? summary.months.reduce((sum, m) => sum + (m.returningPct || 0), 0) / summary.months.length
      : 0;

    const items = [
      [`Returning visitor ต่ำ (เฉลี่ย ${avgReturning.toFixed(0)}%)`, "ยังไม่มีการทำ remarketing กับผู้เคยเข้าเว็บไซต์ เป็นโอกาสเพิ่มยอด lead โดยไม่ต้องเพิ่มงบมาก"],
      ["Attribution ยังไม่ชัดเจน", "ควรแยกวัดผล lead/ยอดขายที่มาจาก paid ads โดยเฉพาะ เพื่อคำนวณ ROAS ที่แท้จริง"],
      ["ยอดขายรวมผันผวนจาก offline", "ควรเสริมความแข็งแกร่งของ pipeline ฝั่งขายตรง ควบคู่กับการเติบโตของช่องทางดิจิทัล"],
      ["งบยังต่ำเทียบขนาดตลาด EEC", "พิจารณาขยายงบ bidding เฉพาะพื้นที่เป้าหมาย EEC เพื่อเร่งการเติบโตของ lead คุณภาพสูง"],
    ];

    const rowH = 1.15, startY = 1.7, gapY = 0.18;
    items.forEach((it, i) => {
      const y = startY + i * (rowH + gapY);
      s.addShape("ellipse", { x: 0.6, y: y + 0.12, w: 0.55, h: 0.55, fill: { color: TERRA }, line: { type: "none" } });
      s.addText(String(i + 1), {
        x: 0.6, y: y + 0.12, w: 0.55, h: 0.55, align: "center", valign: "middle",
        fontFace: FONT, fontSize: 18, bold: true, color: WHITE, margin: 0,
      });
      s.addText(it[0], {
        x: 1.35, y: y, w: 3.5, h: rowH, valign: "middle",
        fontFace: FONT, fontSize: 14.5, bold: true, color: NAVY, margin: 0,
      });
      s.addText(it[1], {
        x: 5.0, y: y, w: PGW - 5.6, h: rowH, valign: "middle",
        fontFace: FONT, fontSize: 13, color: GRAY, margin: 0, lineSpacingMultiple: 1.15,
      });
    });
    addFooter(s, 10, false, footerSub);
  }

  // ---------- Slide 11: Closing / Next steps ----------
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    motifCircles(s, true);
    s.addText("ก้าวต่อไป", {
      x: 0.7, y: 0.6, w: 8, h: 0.7,
      fontFace: FONT, fontSize: 30, bold: true, color: WHITE, margin: 0,
    });

    const steps = [
      "ตั้งเป้าติดตาม cost-per-lead และ paid-only ROAS เป็นตัวชี้วัดหลักทุกเดือน",
      "เริ่มแคมเปญ remarketing กับกลุ่มผู้เคยเข้าเว็บไซต์ เพื่อเพิ่มอัตราแปลงโดยไม่เพิ่มงบมาก",
      "ตรวจสอบสาเหตุความผันผวนของยอดขาย offline และเสริม pipeline คู่ขนาน",
      "ประเมินการขยายงบ bidding ในพื้นที่เป้าหมาย EEC เพื่อเพิ่ม lead คุณภาพสูง",
    ];
    const stepY = 1.55, stepH = 1.0, gapY = 0.15;
    steps.forEach((t, i) => {
      const y = stepY + i * (stepH + gapY);
      s.addShape("roundRect", { x: 0.7, y, w: PGW - 1.4, h: stepH, rectRadius: 0.08, fill: { color: NAVY_DARK }, line: { type: "none" } });
      s.addShape("ellipse", { x: 0.95, y: y + (stepH - 0.5) / 2, w: 0.5, h: 0.5, fill: { color: TERRA }, line: { type: "none" } });
      s.addText(String(i + 1), {
        x: 0.95, y: y + (stepH - 0.5) / 2, w: 0.5, h: 0.5, align: "center", valign: "middle",
        fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
      });
      s.addText(t, {
        x: 1.65, y, w: PGW - 2.5, h: stepH, valign: "middle",
        fontFace: FONT, fontSize: 14, color: WHITE, margin: 0, lineSpacingMultiple: 1.15,
      });
    });

    s.addText("ขอบคุณครับ", {
      x: 0.7, y: PGH - 0.75, w: 6, h: 0.4,
      fontFace: FONT, fontSize: 13, color: ICE, margin: 0,
    });
  }

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer;
}


// =====================================================================
// Year-over-year comparison deck — dedicated export mode.
// `yoy` = output of calc.js summarizeYoY(): { focusYear, compareYear, focus, compare, metrics, ... }
// `focus`/`compare` are full summarize() results, restricted to the overlapping month range
// (e.g. Jan-Jul in both years) so a partial current year is never unfairly compared to a full one.
// =====================================================================
function pctChangeColor(higherIsBetter, pct) {
  if (pct == null) return GRAY;
  if (higherIsBetter === null) return NAVY;
  const good = higherIsBetter ? pct >= 0 : pct <= 0;
  return good ? "1E7A34" : "B3261E";
}
function pctChangeText(pct) {
  if (pct == null) return "N/A";
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}
function pctChangeArrow(higherIsBetter, pct) {
  if (pct == null) return "";
  const good = higherIsBetter === null ? null : (higherIsBetter ? pct >= 0 : pct <= 0);
  if (good === null) return pct >= 0 ? " ▲" : " ▼";
  return good ? " ▲" : " ▼";
}
function formatMetricValue(m, v) {
  if (v == null) return "-";
  return m.isMoney ? `฿${fmtInt(v)}` : fmtInt(v);
}

function yoyCard(s, x, y, w, h, metric, focusYear, compareYear) {
  s.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: ICE_LIGHT },
    line: { color: ICE, width: 1 },
  });
  s.addText(metric.label, {
    x: x + 0.18, y: y + 0.14, w: w - 0.36, h: 0.32,
    fontFace: FONT, fontSize: 12.5, bold: true, color: NAVY, align: "left", margin: 0,
  });
  s.addText(`${formatMetricValue(metric, metric.focus)}`, {
    x: x + 0.18, y: y + 0.46, w: w - 0.36, h: 0.55,
    fontFace: FONT, fontSize: 22, bold: true, color: TERRA, align: "left", margin: 0,
  });
  s.addText(`ปี ${focusYear}`, {
    x: x + 0.18, y: y + 1.0, w: w - 0.36, h: 0.25,
    fontFace: FONT, fontSize: 10, color: GRAY, align: "left", margin: 0,
  });
  s.addText(
    `ปี ${compareYear}: ${formatMetricValue(metric, metric.compare)}`,
    {
      x: x + 0.18, y: y + 1.28, w: w - 0.36, h: 0.25,
      fontFace: FONT, fontSize: 10.5, color: GRAY, align: "left", margin: 0,
    }
  );
  const color = pctChangeColor(metric.higherIsBetter, metric.pctChange);
  s.addText(pctChangeText(metric.pctChange) + pctChangeArrow(metric.higherIsBetter, metric.pctChange), {
    x: x + 0.18, y: y + h - 0.42, w: w - 0.36, h: 0.32,
    fontFace: FONT, fontSize: 13, bold: true, color, align: "left", margin: 0,
  });
}

async function buildYoYDeck(data, yoy) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const beYear = (y) => Number(y) + 543;
  const focusYear = yoy.focusYear;
  const compareYear = yoy.compareYear;
  const focus = yoy.focus;
  const compare = yoy.compare;
  const monthsRangeTxt = focus.months.length
    ? `${focus.months[0].month} – ${focus.months[focus.months.length - 1].month}`
    : "";
  const footerSub = `Metropolitan Products  |  เปรียบเทียบผลการตลาดดิจิทัล ปี ${beYear(focusYear)} เทียบ ปี ${beYear(compareYear)}`;

  const MONTHS = focus.months.map((m) => m.month);
  const SESSIONS_F = focus.months.map((m) => m.sessions || 0);
  const SESSIONS_C = compare.months.map((m) => m.sessions || 0);
  const LEADS_F = focus.months.map((m) => m.newLeadLine || 0);
  const LEADS_C = compare.months.map((m) => m.newLeadLine || 0);
  const CPL_F = focus.perMonth.map((m) => (m.costPerLead == null ? 0 : Math.round(m.costPerLead * 10) / 10));
  const CPL_C = compare.perMonth.map((m) => (m.costPerLead == null ? 0 : Math.round(m.costPerLead * 10) / 10));
  const SALES_F = focus.months.map((m) => (m.salesAmount || 0) / 1e6);
  const SALES_C = compare.months.map((m) => (m.salesAmount || 0) / 1e6);

  // ---------- Slide 1: Title ----------
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    motifCircles(s, true);
    s.addText("เปรียบเทียบผลการตลาดดิจิทัล ปีต่อปี", {
      x: 0.8, y: 2.35, w: 11.2, h: 1.0,
      fontFace: FONT, fontSize: 38, bold: true, color: WHITE, align: "left", margin: 0,
    });
    s.addText(`ปี ${beYear(focusYear)} เทียบกับปี ${beYear(compareYear)} — เฉพาะช่วงเดือนเดียวกัน (${monthsRangeTxt}) เพื่อความเป็นธรรม`, {
      x: 0.8, y: 3.35, w: 10.5, h: 0.6,
      fontFace: FONT, fontSize: 15, color: ICE, align: "left", margin: 0,
    });
    s.addShape("rect", { x: 0.85, y: 4.2, w: 1.4, h: 0.03, fill: { color: TERRA }, line: { type: "none" } });
    s.addText(`เทียบ ${yoy.monthCount} เดือน: ${monthsRangeTxt} ปี ${beYear(focusYear)} และ ${beYear(compareYear)}`, {
      x: 0.8, y: 4.4, w: 8, h: 0.4,
      fontFace: FONT, fontSize: 13, color: WHITE, align: "left", margin: 0,
    });
    s.addText("นำเสนอต่อคณะผู้บริหาร  |  บริษัท เมโทรโปลิแทน โปรดักส์ จำกัด", {
      x: 0.8, y: 6.6, w: 9, h: 0.4,
      fontFace: FONT, fontSize: 12, color: ICE, align: "left", margin: 0,
    });
  }

  // ---------- Slide 2: KPI comparison cards ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "สรุปตัวชี้วัดหลัก", `เทียบช่วงเดียวกัน ${monthsRangeTxt} — ปี ${beYear(focusYear)} vs ปี ${beYear(compareYear)}`);

    const gap = 0.35;
    const cardW = (PGW - 1.2 - gap * 2) / 3;
    const cardH = 1.85;
    const startY = 1.7;
    yoy.metrics.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      yoyCard(s, x, y, cardW, cardH, m, beYear(focusYear), beYear(compareYear));
    });
    addFooter(s, 2, false, footerSub);
  }

  // ---------- Slide 3: Sessions & Leads trend comparison ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "แนวโน้ม Session และ Lead รายเดือน", `เทียบปี ${beYear(focusYear)} กับปี ${beYear(compareYear)} รายเดือน`);

    s.addChart(
      pres.ChartType.line,
      [
        { name: `Session ${beYear(focusYear)}`, labels: MONTHS, values: SESSIONS_F },
        { name: `Session ${beYear(compareYear)}`, labels: MONTHS, values: SESSIONS_C },
      ],
      {
        x: 0.6, y: 1.6, w: 11.1, h: 2.6,
        chartColors: [TERRA, "9AA7C2"],
        lineSize: 2.5, lineSmooth: false,
        showTitle: true, title: "Site sessions รายเดือน", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: false,
        showLegend: true, legendPos: "b", legendColor: NAVY, legendFontFace: FONT, legendFontSize: 10,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
      }
    );
    s.addChart(
      pres.ChartType.line,
      [
        { name: `Lead ${beYear(focusYear)}`, labels: MONTHS, values: LEADS_F },
        { name: `Lead ${beYear(compareYear)}`, labels: MONTHS, values: LEADS_C },
      ],
      {
        x: 0.6, y: 4.45, w: 11.1, h: 2.4,
        chartColors: [NAVY, "9AA7C2"],
        lineSize: 2.5, lineSmooth: false,
        showTitle: true, title: "Lead ใหม่จาก LINE OA รายเดือน", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: false,
        showLegend: true, legendPos: "b", legendColor: NAVY, legendFontFace: FONT, legendFontSize: 10,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
      }
    );
    addFooter(s, 3, false, footerSub);
  }

  // ---------- Slide 4: CPL & Sales trend comparison ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "แนวโน้มต้นทุนต่อ Lead และยอดขาย", `เทียบปี ${beYear(focusYear)} กับปี ${beYear(compareYear)} รายเดือน`);

    s.addChart(
      pres.ChartType.line,
      [
        { name: `CPL ${beYear(focusYear)}`, labels: MONTHS, values: CPL_F },
        { name: `CPL ${beYear(compareYear)}`, labels: MONTHS, values: CPL_C },
      ],
      {
        x: 0.6, y: 1.6, w: 11.1, h: 2.6,
        chartColors: [TERRA, "9AA7C2"],
        lineSize: 2.5, lineSmooth: false,
        showTitle: true, title: "ต้นทุนต่อ Lead รายเดือน (บาท)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: false,
        showLegend: true, legendPos: "b", legendColor: NAVY, legendFontFace: FONT, legendFontSize: 10,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
      }
    );
    s.addChart(
      pres.ChartType.bar,
      [
        { name: `ยอดขายรวม ${beYear(focusYear)} (ล้านบาท)`, labels: MONTHS, values: SALES_F },
        { name: `ยอดขายรวม ${beYear(compareYear)} (ล้านบาท)`, labels: MONTHS, values: SALES_C },
      ],
      {
        x: 0.6, y: 4.45, w: 11.1, h: 2.4,
        barDir: "col",
        chartColors: [NAVY, "9AA7C2"],
        showTitle: true, title: "ยอดขายรวมรายเดือน (ล้านบาท)", titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
        showValue: false,
        showLegend: true, legendPos: "b", legendColor: NAVY, legendFontFace: FONT, legendFontSize: 10,
        catAxisLabelColor: NAVY, catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9.5,
        valAxisLabelColor: GRAY, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
        valGridLine: { color: "E4E9F2", size: 1 },
        catGridLine: { style: "none" },
        barGapWidthPct: 40,
      }
    );
    addFooter(s, 4, false, footerSub);
  }

  // ---------- Slide 5: Cost items comparison ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    sectionHeader(s, "เปรียบเทียบค่าใช้จ่ายการตลาด", `รายการค่าใช้จ่ายปี ${beYear(focusYear)} เทียบปี ${beYear(compareYear)} (บาท/ปี)`);

    const focusCost = (focus.costByYear && focus.costByYear[0]) || { items: [], totalYear: 0 };
    const compareCost = (compare.costByYear && compare.costByYear[0]) || { items: [], totalYear: 0 };
    const labelSet = [...new Set([...focusCost.items.map((i) => i.label), ...compareCost.items.map((i) => i.label)])];

    if (!labelSet.length) {
      s.addText("ยังไม่ได้กรอกรายการค่าใช้จ่ายสำหรับปีที่เลือกเปรียบเทียบ", {
        x: 0.6, y: 2.5, w: PGW - 1.2, h: 0.6,
        fontFace: FONT, fontSize: 16, color: GRAY, align: "left", margin: 0,
      });
    } else {
      let rows = labelSet.map((label) => {
        const f = focusCost.items.find((i) => i.label === label);
        const c = compareCost.items.find((i) => i.label === label);
        const fv = f ? f.valuePerYear || 0 : 0;
        const cv = c ? c.valuePerYear || 0 : 0;
        const pct = cv ? ((fv - cv) / cv) * 100 : null;
        return { label, fv, cv, pct };
      });
      rows.sort((a, b) => b.fv - a.fv);
      const shown = rows.slice(0, 8);
      const extra = rows.length - shown.length;

      const tableRows = [
        [
          { text: "รายการ", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, fontFace: FONT, valign: "middle" } },
          { text: `ปี ${beYear(compareYear)}`, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
          { text: `ปี ${beYear(focusYear)}`, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
          { text: "เปลี่ยนแปลง", options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
        ],
      ];
      shown.forEach((r, i) => {
        const rowFill = i % 2 === 0 ? WHITE : ICE_LIGHT;
        tableRows.push([
          { text: r.label, options: { color: NAVY, fill: { color: rowFill }, fontSize: 11.5, fontFace: FONT, valign: "middle" } },
          { text: fmtMoney(r.cv, 0), options: { color: NAVY, fill: { color: rowFill }, fontSize: 11.5, fontFace: FONT, align: "right", valign: "middle" } },
          { text: fmtMoney(r.fv, 0), options: { color: NAVY, fill: { color: rowFill }, fontSize: 11.5, fontFace: FONT, align: "right", valign: "middle" } },
          { text: r.pct == null ? "N/A" : (r.pct >= 0 ? "+" : "") + r.pct.toFixed(0) + "%", options: { color: r.pct == null ? GRAY : (r.pct >= 0 ? "B3261E" : "1E7A34"), fill: { color: rowFill }, fontSize: 11.5, bold: true, fontFace: FONT, align: "right", valign: "middle" } },
        ]);
      });
      const totalPct = compareCost.totalYear ? ((focusCost.totalYear - compareCost.totalYear) / compareCost.totalYear) * 100 : null;
      tableRows.push([
        { text: "รวมทั้งหมด", options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12, fontFace: FONT, valign: "middle" } },
        { text: fmtMoney(compareCost.totalYear, 0), options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
        { text: fmtMoney(focusCost.totalYear, 0), options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
        { text: totalPct == null ? "N/A" : (totalPct >= 0 ? "+" : "") + totalPct.toFixed(0) + "%", options: { bold: true, color: WHITE, fill: { color: TERRA }, fontSize: 12, fontFace: FONT, align: "right", valign: "middle" } },
      ]);

      s.addTable(tableRows, {
        x: 0.6, y: 1.65, w: PGW - 1.2, h: 4.0,
        colW: [(PGW - 1.2) * 0.4, (PGW - 1.2) * 0.2, (PGW - 1.2) * 0.2, (PGW - 1.2) * 0.2],
        border: { type: "solid", color: "E4E9F2", pt: 0.75 },
        autoPage: false,
        rowH: 4.0 / (shown.length + 2),
      });
      if (extra > 0) {
        s.addText(`และรายการอื่นๆ อีก ${extra} รายการ (แสดงเฉพาะ ${shown.length} รายการที่มูลค่าสูงสุด)`, {
          x: 0.6, y: 5.75, w: PGW - 1.2, h: 0.3,
          fontFace: FONT, fontSize: 10.5, italic: true, color: GRAY, margin: 0,
        });
      }
    }
    addFooter(s, 5, false, footerSub);
  }

  // ---------- Slide 6: Closing insights ----------
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    motifCircles(s, true);
    s.addText("สรุปเปรียบเทียบและข้อเสนอแนะ", {
      x: 0.7, y: 0.55, w: 10, h: 0.6,
      fontFace: FONT, fontSize: 28, bold: true, color: WHITE, margin: 0,
    });

    const improved = yoy.metrics.filter((m) => m.higherIsBetter !== null && m.pctChange != null && (m.higherIsBetter ? m.pctChange >= 0 : m.pctChange <= 0));
    const worsened = yoy.metrics.filter((m) => m.higherIsBetter !== null && m.pctChange != null && (m.higherIsBetter ? m.pctChange < 0 : m.pctChange > 0));

    const bullets = [];
    if (improved.length) {
      bullets.push(`ตัวชี้วัดที่ดีขึ้นเทียบปี ${beYear(compareYear)}: ${improved.map((m) => `${m.label} (${pctChangeText(m.pctChange)})`).join(", ")}`);
    }
    if (worsened.length) {
      bullets.push(`ตัวชี้วัดที่ควรจับตาเทียบปี ${beYear(compareYear)}: ${worsened.map((m) => `${m.label} (${pctChangeText(m.pctChange)})`).join(", ")}`);
    }
    bullets.push(`งบการตลาดเปลี่ยนแปลง ${pctChangeText(yoy.metrics.find((m) => m.key === "totalSpend").pctChange)} เทียบช่วงเวลาเดียวกัน — ควรพิจารณาควบคู่กับผลลัพธ์ด้านบนว่าคุ้มค่าเพิ่มขึ้นหรือลดลง`);
    bullets.push("แนะนำให้ใช้การเปรียบเทียบปีต่อปีแบบนี้ทุกไตรมาส เพื่อติดตามว่าแนวโน้มสอดคล้องกับเป้าหมายทางธุรกิจในระยะยาวหรือไม่");

    s.addShape("roundRect", { x: 0.7, y: 1.4, w: PGW - 1.4, h: 4.7, rectRadius: 0.08, fill: { color: NAVY_DARK }, line: { type: "none" } });
    bulletList(s, 1.05, 1.7, PGW - 2.1, 4.2, bullets, { fontSize: 14, color: WHITE });

    s.addText("ขอบคุณครับ", {
      x: 0.7, y: PGH - 0.75, w: 6, h: 0.4,
      fontFace: FONT, fontSize: 13, color: ICE, margin: 0,
    });
  }

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer;
}

module.exports = { buildDeck, buildYoYDeck };
