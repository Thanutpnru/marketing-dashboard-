"use strict";
/* Zero-dependency SVG chart renderers — no CDN, no network required. */

function fmtShort(n) {
  if (n == null || !isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

function emptyChart(container, msg) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9AA7C2;font-size:12px;text-align:center;padding:0 12px">${msg || "ไม่มีข้อมูล"}</div>`;
}

function barChart(container, { labels, values, color = "#C1652F", format }) {
  if (!values || !values.length) return emptyChart(container);
  const W = 420, H = 240, padL = 46, padR = 12, padT = 16, padB = 34;
  const max = Math.max(1, ...values.map((v) => v || 0));
  const n = values.length;
  const plotW = W - padL - padR;
  const bw = plotW / n;
  let grid = "", bars = "", labelsSvg = "";
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const y = padT + (H - padT - padB) * (1 - g / gridLines);
    const val = (max * g) / gridLines;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#E4E9F2" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" font-size="9" fill="#5B6472" text-anchor="end" font-family="Tahoma, sans-serif">${fmtShort(val)}</text>`;
  }
  values.forEach((v, i) => {
    const h = max > 0 ? ((v || 0) / max) * (H - padT - padB) : 0;
    const x = padL + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const y = H - padB - h;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="2"/>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9" fill="#1E2761" text-anchor="middle" font-family="Tahoma, sans-serif">${format ? format(v) : fmtShort(v)}</text>`;
    labelsSvg += `<text x="${(x + w / 2).toFixed(1)}" y="${H - padB + 14}" font-size="9" fill="#5B6472" text-anchor="middle" font-family="Tahoma, sans-serif">${labels[i]}</text>`;
  });
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">${grid}${bars}${labelsSvg}</svg>`;
}

function hBarChart(container, { labels, values, color = "#C1652F", format }) {
  if (!values || !values.length) return emptyChart(container);
  const W = 460, rowH = 34, padL = 10, padR = 60, labelW = 130;
  const H = rowH * values.length + 20;
  const max = Math.max(1, ...values.map((v) => v || 0));
  const plotW = W - labelW - padR;
  let bars = "";
  values.forEach((v, i) => {
    const w = max > 0 ? ((v || 0) / max) * plotW : 0;
    const y = 10 + i * rowH;
    bars += `<text x="${labelW - 8}" y="${y + rowH * 0.55}" font-size="10" fill="#1E2761" text-anchor="end" font-family="Tahoma, sans-serif">${labels[i]}</text>`;
    bars += `<rect x="${labelW}" y="${y + rowH * 0.18}" width="${w.toFixed(1)}" height="${rowH * 0.5}" fill="${color}" rx="2"/>`;
    bars += `<text x="${labelW + w + 6}" y="${y + rowH * 0.55}" font-size="9.5" fill="#1E2761" text-anchor="start" font-family="Tahoma, sans-serif">${format ? format(v) : fmtShort(v)}</text>`;
  });
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">${bars}</svg>`;
}

function lineChart(container, { labels, values, color = "#C1652F", format }) {
  if (!values || !values.length) return emptyChart(container);
  const W = 420, H = 240, padL = 46, padR = 12, padT = 20, padB = 34;
  const nums = values.map((v) => (v == null ? null : v));
  const validNums = nums.filter((v) => v != null);
  const max = Math.max(1, ...validNums);
  const min = Math.min(0, ...validNums);
  const n = values.length;
  const plotW = W - padL - padR;
  const stepX = n > 1 ? plotW / (n - 1) : 0;
  const scaleY = (v) => H - padB - ((v - min) / (max - min || 1)) * (H - padT - padB);
  let grid = "", pts = [], dots = "", labelsSvg = "";
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const val = min + ((max - min) * g) / gridLines;
    const y = scaleY(val);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#E4E9F2" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" font-size="9" fill="#5B6472" text-anchor="end" font-family="Tahoma, sans-serif">${fmtShort(val)}</text>`;
  }
  nums.forEach((v, i) => {
    const x = padL + i * stepX;
    labelsSvg += `<text x="${x.toFixed(1)}" y="${H - padB + 14}" font-size="9" fill="#5B6472" text-anchor="middle" font-family="Tahoma, sans-serif">${labels[i]}</text>`;
    if (v == null) return;
    const y = scaleY(v);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${color}"/>`;
    dots += `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" font-size="9" fill="#1E2761" text-anchor="middle" font-family="Tahoma, sans-serif">${format ? format(v) : fmtShort(v)}</text>`;
  });
  const line = pts.length > 1 ? `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : "";
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">${grid}${line}${dots}${labelsSvg}</svg>`;
}

function donutChart(container, { labels, values, colors }) {
  if (!values || !values.length || values.every((v) => !v)) return emptyChart(container);
  const size = 180, cx = size / 2, cy = size / 2, rOuter = 78, rInner = 46;
  const total = values.reduce((a, b) => a + (b || 0), 0) || 1;
  let angle = -Math.PI / 2;
  let paths = "";
  values.forEach((v, i) => {
    const frac = (v || 0) / total;
    if (frac <= 0) return;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const x0o = cx + rOuter * Math.cos(a0), y0o = cy + rOuter * Math.sin(a0);
    const x1o = cx + rOuter * Math.cos(a1), y1o = cy + rOuter * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a1), y0i = cy + rInner * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a0), y1i = cy + rInner * Math.sin(a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    paths += `<path d="M ${x0o.toFixed(2)} ${y0o.toFixed(2)} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} L ${x0i.toFixed(2)} ${y0i.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z" fill="${colors[i % colors.length]}"/>`;
  });
  const legend = labels
    .map((l, i) => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#1E2761;margin:2px 8px">
        <span style="width:10px;height:10px;border-radius:2px;background:${colors[i % colors.length]};display:inline-block;flex:none"></span>
        <span>${l} (${((values[i] || 0) / total * 100).toFixed(1)}%)</span>
      </div>`)
    .join("");
  container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <svg viewBox="0 0 ${size} ${size}" style="width:130px;height:130px;flex:none">${paths}</svg>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;margin-top:8px;max-width:100%">${legend}</div>
    </div>`;
}
