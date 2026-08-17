"use strict";
/* Minimal, dependency-free CSV helpers for template download / bulk import. */

function csvEscape(val) {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  });
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens Thai text as UTF-8 correctly
}

// Parses CSV text (handles quoted fields with embedded commas/newlines/escaped quotes).
// Returns array of objects keyed by the header row. Blank lines are skipped.
function parseCSV(text) {
  text = text.replace(/^﻿/, ""); // strip BOM if present
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) pushRow();

  const nonEmpty = rows.filter((r) => r.some((v) => String(v).trim() !== ""));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx].trim() : "";
    });
    return obj;
  });
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Dual browser/Node usage: this file is loaded as a plain <script> in the browser
// (no `module` global there) and also require()'d server-side for parsing CSV imports.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { csvEscape, toCSV, parseCSV };
}
