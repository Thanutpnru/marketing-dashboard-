"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { summarize, summarizeByYear, summarizeYoY } = require("./calc");
const { buildDeck, buildYoYDeck } = require("./pptx-builder");

const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 4173;

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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
      return sendJSON(res, 200, { data, summary, summaryByYear });
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
