"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { summarize, summarizeByYear, summarizeYoY, summarizeQuotations, quoteMonthId } = require("./calc");
const { buildDeck, buildYoYDeck } = require("./pptx-builder");
const { readXlsxFirstSheet, excelSerialToDate } = require("./xlsx-lite");
const { parseCSV } = require("./public/csv.js");

const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 4173;

function readData() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!Array.isArray(data.quotations)) data.quotations = [];
  return data;
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
function serveStatic(req, res) {
  let reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(reqPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function validateMonth(m) {
  const required = [
    "id", "year", "order", "month", "newPct", "returningPct", "sessions",
    "channelOrganic", "channelPaid", "channelDirect", "channelAI",
    "newLeadLine", "userLine", "salesOnline", "salesAmount",
  ];
  for (const key of required) {
    if (m[key] === undefined || m[key] === null || m[key] === "") {
      throw new Error(`ข้อมูลไม่ครบ: ขาดฟิลด์ "${key}"`);
    }
  }
}

function filterMonthsByRange(months, from, to) {
  return months.filter((m) => (!from || m.id >= from) && (!to || m.id <= to));
}

function filterQuotationsByRange(quotations, from, to) {
  return quotations.filter((q) => {
    const id = quoteMonthId(q);
    return (!from || id >= from) && (!to || id <= to);
  });
}

// Maps one raw ERP export row (from the "ใบเสนอราคา" quotation report) into our
// internal quotation record. Blank SaleAreaName ("ช่องทาง") rows are bucketed as
// "Existing Customers (Not Use)" per how this company's sales team tags repeat business.
function mapQuotationRow(row, rowNum) {
  const docuNo = row.DocuNo ? String(row.DocuNo).trim() : "";
  if (!docuNo) throw new Error(`แถว ${rowNum}: ไม่มีเลขที่ใบเสนอราคา (DocuNo)`);

  let year, month;
  if (row.DocuDate instanceof Date) {
    year = row.DocuDate.getUTCFullYear();
    month = row.DocuDate.getUTCMonth() + 1;
  } else {
    const serial = Number(row.DocuDate);
    if (!isFinite(serial) || serial <= 0) throw new Error(`แถว ${rowNum}: วันที่ (DocuDate) ไม่ถูกต้อง`);
    const d = excelSerialToDate(serial);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
  }

  const channelRaw = row.SaleAreaName ? String(row.SaleAreaName).trim() : "";
  const value = Number(row.NetAmnt);

  return {
    docuNo,
    year,
    month,
    channel: channelRaw || "Existing Customers (Not Use)",
    status: row.QuotStatus ? String(row.QuotStatus).trim() : "ไม่ระบุสถานะ",
    value: isFinite(value) ? value : 0,
    custName: row.custName ? String(row.custName).trim() : "",
  };
}

function upsertQuotations(data, records) {
  if (!Array.isArray(data.quotations)) data.quotations = [];
  const byDocuNo = new Map(data.quotations.map((q) => [q.docuNo, q]));
  records.forEach((rec) => byDocuNo.set(rec.docuNo, rec));
  data.quotations = [...byDocuNo.values()];
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, "http://internal");
    const url = parsedUrl.pathname;
    const from = parsedUrl.searchParams.get("from") || "";
    const to = parsedUrl.searchParams.get("to") || "";

    if (url === "/api/data" && req.method === "GET") {
      const data = readData();
      const filteredMonths = filterMonthsByRange(data.months, from, to);
      const summary = summarize({ months: filteredMonths, costItemsByYear: data.costItemsByYear });
      const summaryByYear = summarizeByYear(data); // always full data, ignores period filter
      const filteredQuotations = filterQuotationsByRange(data.quotations, from, to);
      const quotationSummary = summarizeQuotations(filteredQuotations);
      return sendJSON(res, 200, { data, summary, summaryByYear, quotationSummary });
    }

    if (url === "/api/quotations/import" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.base64) throw new Error("ไม่พบเนื้อหาไฟล์");
      const buffer = Buffer.from(body.base64, "base64");
      const filename = String(body.filename || "");
      const isXlsx = /\.xlsx$/i.test(filename) || (buffer[0] === 0x50 && buffer[1] === 0x4b);

      let rawRows = [];
      if (isXlsx) {
        const { rows } = readXlsxFirstSheet(buffer);
        rawRows = rows;
      } else {
        let text = buffer.toString("utf8");
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        rawRows = parseCSV(text);
      }

      const records = [];
      const errors = [];
      rawRows.forEach((row, i) => {
        try {
          records.push(mapQuotationRow(row, i + 2));
        } catch (e) {
          errors.push(String(e.message || e));
        }
      });

      const data = readData();
      upsertQuotations(data, records);
      writeData(data);
      const quotationSummary = summarizeQuotations(data.quotations);
      return sendJSON(res, 200, {
        ok: true,
        totalRows: rawRows.length,
        imported: records.length,
        skipped: errors.length,
        errors: errors.slice(0, 20),
        data,
        quotationSummary,
      });
    }

    if (url === "/api/quotations" && req.method === "DELETE") {
      const data = readData();
      data.quotations = [];
      writeData(data);
      const quotationSummary = summarizeQuotations(data.quotations);
      return sendJSON(res, 200, { ok: true, data, quotationSummary });
    }

    if (url === "/api/months" && req.method === "POST") {
      const body = await readBody(req);
      validateMonth(body);
      const data = readData();
      const idx = data.months.findIndex((m) => m.id === body.id);
      if (idx >= 0) data.months[idx] = body;
      else data.months.push(body);
      writeData(data);
      const summary = summarize(data);
      const summaryByYear = summarizeByYear(data);
      return sendJSON(res, 200, { ok: true, data, summary, summaryByYear });
    }

    if (url.startsWith("/api/months/") && req.method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop());
      const data = readData();
      data.months = data.months.filter((m) => m.id !== id);
      writeData(data);
      const summary = summarize(data);
      const summaryByYear = summarizeByYear(data);
      return sendJSON(res, 200, { ok: true, data, summary, summaryByYear });
    }

    if (url === "/api/cost-items" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.year) throw new Error("ต้องระบุปี (year)");
      if (!Array.isArray(body.costItems)) throw new Error("รูปแบบข้อมูลค่าใช้จ่ายไม่ถูกต้อง");
      for (const c of body.costItems) {
        if (!c.label || c.valuePerYear === undefined || c.valuePerYear === null) {
          throw new Error("แต่ละรายการต้องมีชื่อ (label) และมูลค่าต่อปี (valuePerYear)");
        }
      }
      const data = readData();
      if (!data.costItemsByYear) data.costItemsByYear = {};
      data.costItemsByYear[String(body.year)] = body.costItems;
      writeData(data);
      const summary = summarize(data);
      const summaryByYear = summarizeByYear(data);
      return sendJSON(res, 200, { ok: true, data, summary, summaryByYear });
    }

    if (url.startsWith("/api/cost-items/") && req.method === "DELETE") {
      const year = decodeURIComponent(url.split("/").pop());
      const data = readData();
      if (data.costItemsByYear) delete data.costItemsByYear[year];
      writeData(data);
      const summary = summarize(data);
      const summaryByYear = summarizeByYear(data);
      return sendJSON(res, 200, { ok: true, data, summary, summaryByYear });
    }

    if (url === "/api/yoy" && req.method === "GET") {
      const focusYear = parsedUrl.searchParams.get("focusYear");
      if (!focusYear) throw new Error("ต้องระบุปีที่ต้องการโฟกัส (focusYear)");
      const data = readData();
      const yoy = summarizeYoY(data, focusYear);
      return sendJSON(res, 200, { yoy });
    }

    if (url === "/api/export-pptx" && req.method === "GET") {
      const mode = parsedUrl.searchParams.get("mode") || "period";
      const data = readData();

      if (mode === "yoy") {
        const focusYear = parsedUrl.searchParams.get("focusYear");
        if (!focusYear) throw new Error("ต้องระบุปีที่ต้องการโฟกัส (focusYear)");
        const yoy = summarizeYoY(data, focusYear);
        if (!yoy.available) {
          throw new Error(`ไม่มีข้อมูลปี ${Number(focusYear) - 1} ให้เปรียบเทียบกับปี ${focusYear} (ต้องมีข้อมูลทั้งสองปีในเดือนที่ตรงกันอย่างน้อย 1 เดือน)`);
        }
        const buffer = await buildYoYDeck(data, yoy);
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="digital_marketing_yoy_${yoy.focusYear}_vs_${yoy.compareYear}.pptx"`,
          "Content-Length": buffer.length,
        });
        return res.end(buffer);
      }

      const filteredMonths = filterMonthsByRange(data.months, from, to);
      const filteredData = { ...data, months: filteredMonths };
      const summary = summarize(filteredData);
      const buffer = await buildDeck(filteredData, summary);
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": 'attachment; filename="digital_marketing_summary.pptx"',
        "Content-Length": buffer.length,
      });
      return res.end(buffer);
    }

    if (req.method === "GET") return serveStatic(req, res);

    sendJSON(res, 404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    sendJSON(res, 400, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Marketing dashboard running: http://localhost:${PORT}`);
});
