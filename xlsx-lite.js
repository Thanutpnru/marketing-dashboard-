"use strict";
// Minimal, dependency-free reader for .xlsx (OOXML spreadsheet) files.
// Reads a ZIP central directory, inflates the entries we need (sharedStrings.xml,
// workbook.xml, and the first worksheet), and parses cells into row objects
// keyed by the header row. No external packages — npm registry isn't reachable
// in this deployment's build/runtime environment.
const zlib = require("zlib");

function readZipEntries(buf, wantedNames) {
  // Locate End Of Central Directory record (signature 0x06054b50), scanning from the end
  // since a ZIP comment (rare) could follow it.
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error("ไม่พบโครงสร้างไฟล์ ZIP ที่ถูกต้อง (ไม่ใช่ไฟล์ .xlsx)");
  const cdEntryCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const wanted = new Set(wantedNames);
  const found = {};
  let ptr = cdOffset;
  for (let i = 0; i < cdEntryCount; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    if (wanted.has(name)) {
      found[name] = extractLocalFile(buf, localHeaderOffset, compMethod, compSize);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return found;
}

function extractLocalFile(buf, localHeaderOffset, compMethod, compSize) {
  if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error("โครงสร้างไฟล์ ZIP ผิดพลาด (local file header)");
  const nameLen = buf.readUInt16LE(localHeaderOffset + 26);
  const extraLen = buf.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + compSize);
  if (compMethod === 0) return raw; // stored, no compression
  if (compMethod === 8) return zlib.inflateRawSync(raw); // deflate
  throw new Error(`ไม่รองรับวิธีบีบอัดไฟล์ในรูปแบบนี้ (method ${compMethod})`);
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const inner = m[1];
    const parts = [];
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRegex.exec(inner))) parts.push(decodeXmlEntities(tm[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

function colLettersToIndex(letters) {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1; // 0-based
}

function excelSerialToDate(serial) {
  // Excel epoch is Dec 30 1899; this is off by one day for serials before ~60
  // (the famous 1900 leap-year bug) but exact for any real-world modern date.
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(ms);
}

// Parses the first worksheet into an array of row-arrays (0-based columns, sparse).
function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRegex.exec(xml))) {
    const rowNum = parseInt(rm[1], 10);
    const rowXml = rm[2];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    const rowArr = [];
    let cm;
    while ((cm = cellRegex.exec(rowXml))) {
      const attrs = cm[1] !== undefined ? cm[1] : cm[3];
      const inner = cm[2] || "";
      const refMatch = /r="([A-Z]+)\d+"/.exec(attrs);
      if (!refMatch) continue;
      const colIdx = colLettersToIndex(refMatch[1]);
      const typeMatch = /t="([a-zA-Z]+)"/.exec(attrs);
      const type = typeMatch ? typeMatch[1] : "n";
      let value = null;
      if (type === "s") {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = vMatch ? sharedStrings[parseInt(vMatch[1], 10)] : "";
      } else if (type === "inlineStr") {
        const tMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        value = tMatch ? decodeXmlEntities(tMatch[1]) : "";
      } else if (type === "str" || type === "e" || type === "b") {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = vMatch ? decodeXmlEntities(vMatch[1]) : "";
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = vMatch ? Number(vMatch[1]) : null;
      }
      rowArr[colIdx] = value;
    }
    rows[rowNum - 1] = rowArr;
  }
  return rows;
}

// Reads the first worksheet of an .xlsx buffer and returns { headers, rows }
// where `rows` is an array of objects keyed by the header-row text.
function readXlsxFirstSheet(buffer) {
  const entries = readZipEntries(buffer, [
    "xl/sharedStrings.xml",
    "xl/worksheets/sheet1.xml",
  ]);
  if (!entries["xl/worksheets/sheet1.xml"]) {
    throw new Error("ไม่พบชีทข้อมูลในไฟล์ (คาดว่าเป็นชีทแรก xl/worksheets/sheet1.xml)");
  }
  const sharedStrings = parseSharedStrings(entries["xl/sharedStrings.xml"] ? entries["xl/sharedStrings.xml"].toString("utf8") : "");
  const rawRows = parseSheetRows(entries["xl/worksheets/sheet1.xml"].toString("utf8"), sharedStrings);

  const headerRow = rawRows[0] || [];
  const headers = headerRow.map((h) => (h == null ? "" : String(h).trim()));
  const objRows = [];
  for (let r = 1; r < rawRows.length; r++) {
    const rowArr = rawRows[r];
    if (!rowArr) continue;
    const obj = {};
    let hasAny = false;
    headers.forEach((h, c) => {
      if (!h) return;
      const v = rowArr[c];
      if (v !== undefined && v !== null && v !== "") hasAny = true;
      obj[h] = v === undefined ? null : v;
    });
    if (hasAny) objRows.push(obj);
  }
  return { headers, rows: objRows };
}

module.exports = { readXlsxFirstSheet, excelSerialToDate, readZipEntries, parseSharedStrings, parseSheetRows };
