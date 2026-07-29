import { isChannelActive, buildNaverMediaBreakdownTable } from "./channels";

const NAVY = "1B1B2F";
const ORANGE = "E8562C";
const WHITE = "FFFFFF";
const GRAYTXT = "4B5563";
const MUTED = "9CA3AF";
const LIGHTGRAY = "E5E2DD";
const CARD = "F3EFE9";
const FONT = "Noto Sans KR";

function bgDark(s) { s.background = { color: NAVY }; }
function bgLight(s) { s.background = { color: WHITE }; }

function footer(pres, s, hotelName) {
  s.addText(`TRIPICKA  ·  ${hotelName || "[호텔명]"} 마케팅 운영 보고서`, {
    x: 0.6, y: 7.18, w: 12.1, h: 0.28, fontSize: 9, color: MUTED, fontFace: FONT, align: "left", margin: 0,
  });
}

function pageTitle(pres, s, kicker, title) {
  s.addText(kicker, { x: 0.6, y: 0.32, w: 9, h: 0.32, fontSize: 13, color: ORANGE, bold: true, fontFace: FONT, charSpacing: 1, margin: 0 });
  s.addText(title, { x: 0.6, y: 0.62, w: 11.5, h: 0.6, fontSize: 26, color: NAVY, bold: true, fontFace: FONT, margin: 0 });
  s.addShape(pres.ShapeType.rect, { x: 0.6, y: 1.3, w: 12.1, h: 0.018, fill: { color: LIGHTGRAY } });
}

function statCard(pres, s, x, y, w, h, label, value, sub) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: CARD }, line: { color: LIGHTGRAY, width: 0.75 } });
  s.addText(label, { x: x + 0.22, y: y + 0.15, w: w - 0.44, h: 0.3, fontSize: 11.5, color: GRAYTXT, bold: true, fontFace: FONT, margin: 0, valign: "top" });
  s.addText(value || "-", { x: x + 0.22, y: y + 0.48, w: w - 0.44, h: 0.55, fontSize: 22, color: ORANGE, bold: true, fontFace: FONT, margin: 0, valign: "top" });
  if (sub) s.addText(sub, { x: x + 0.22, y: y + 1.06, w: w - 0.44, h: h - 1.16, fontSize: 10, color: GRAYTXT, fontFace: FONT, margin: 0, valign: "top" });
}

function summaryBox(pres, s, x, y, w, h, title, body) {
  s.addTable([
    [{ text: title, options: { bold: true, color: NAVY, fill: { color: WHITE }, fontFace: FONT, fontSize: 13, align: "left", valign: "middle" } }],
    [{ text: body, options: { color: GRAYTXT, fill: { color: WHITE }, fontFace: FONT, fontSize: 10.5, align: "left", valign: "top" } }],
  ], {
    x, y, w, colW: [w], rowH: [0.5, h - 0.5],
    border: { type: "solid", color: LIGHTGRAY, pt: 0.75 }, autoPage: false, fontFace: FONT,
  });
}

function csvTable(pres, s, rows, x, y, w) {
  if (!rows || rows.length === 0) return 0;
  const nCols = rows[0].length;
  const colW = new Array(nCols).fill(w / nCols);
  const ROW_H = 0.3; // 고정 행 높이(in) — 아래 y 전진 계산과 반드시 일치시킬 것
  const tblRows = rows.map((r, ri) => r.map((cell) => ({
    text: String(cell ?? ""),
    options: {
      bold: ri === 0, color: ri === 0 ? WHITE : GRAYTXT,
      fill: ri === 0 ? { color: NAVY } : (ri % 2 === 0 ? { color: "FAF8F5" } : { color: WHITE }),
      fontFace: FONT, fontSize: 10, align: "center", valign: "middle",
    },
  })));
  s.addTable(tblRows, {
    x, y, w, colW,
    rowH: new Array(rows.length).fill(ROW_H),
    border: { type: "solid", color: LIGHTGRAY, pt: 0.5 }, autoPage: false, fontFace: FONT,
  });
  return rows.length * ROW_H; // 실제 사용한 높이를 반환해서 호출부가 정확히 y를 전진시키게 함
}

function imgSpace(pres, s, x, y, w, h, label) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: "FDFCFB" }, line: { color: "D6D0C6", width: 1, dashType: "dash" } });
  s.addText(label, { x: x + 0.2, y: y + h / 2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 10.5, color: "B3ABA0", fontFace: FONT, align: "center", valign: "middle", margin: 0, italic: true });
}

function summarizeChannel(channel, data) {
  const lines = [];
  for (const k of channel.kpis) if (data.kpis[k.key]) lines.push(`- ${k.label}: ${data.kpis[k.key]}`);
  for (const t of channel.tables) {
    const rows = data.tables[t.key];
    if (rows && rows.length > 1) lines.push(`- ${t.label}: ${rows.length - 1}건`);
  }
  for (const img of channel.images) if (data.images[img.key]) lines.push(`- ${img.label.replace("첨부 공간", "첨부됨")}`);
  return lines.length ? lines.join("\n") : "- 데이터 확인 필요";
}

export async function exportPptx({ hotelName, month, channels, channelData, outputType }) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const active = channels.filter((ch) => isChannelActive(channelData[ch.id], ch));

  // 1. Cover
  {
    const s = pres.addSlide(); bgDark(s);
    s.addText("TRIPICKA", { x: 0.7, y: 0.6, w: 4, h: 0.5, fontSize: 18, color: ORANGE, bold: true, fontFace: FONT, charSpacing: 2, margin: 0 });
    s.addText(hotelName || "[호텔명]", { x: 0.7, y: 2.5, w: 10, h: 1.1, fontSize: 50, color: WHITE, bold: true, fontFace: FONT, margin: 0 });
    s.addText("월별 마케팅 운영 보고서", { x: 0.7, y: 3.5, w: 10, h: 0.6, fontSize: 22, color: "CBD5E1", fontFace: FONT, margin: 0 });
    s.addText(month || "[YYYY년 M월]", { x: 0.7, y: 4.2, w: 10, h: 0.5, fontSize: 15, color: ORANGE, bold: true, fontFace: FONT, margin: 0 });
    s.addShape(pres.ShapeType.rect, { x: 0.7, y: 4.9, w: 1.2, h: 0.06, fill: { color: ORANGE } });
    s.addText(active.map((c) => c.title).join("  ·  "), { x: 0.7, y: 5.1, w: 11, h: 0.4, fontSize: 12.5, color: MUTED, fontFace: FONT, margin: 0 });
  }

  // 2. Summary
  {
    const s = pres.addSlide(); bgLight(s);
    pageTitle(pres, s, "OVERVIEW", "운영 요약  Summary");
    const bw = 3.85, bh = 1.9, gapx = 0.3, gapy = 0.3, x0 = 0.6, y0 = 1.65;
    active.forEach((ch, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      summaryBox(pres, s, x0 + col * (bw + gapx), y0 + row * (bh + gapy), bw, bh, ch.title, summarizeChannel(ch, channelData[ch.id]));
    });
    footer(pres, s, hotelName);
  }

  // 표 하나를 그리고 실제 사용한 높이(in)를 반환. layout:'split'이면 좌/우 반반으로 나눠 그림.
  function renderTable(s, t, rows, x, y, w) {
    if (t.layout === "split" && rows.length > 1) {
      const header = rows[0];
      const dataRows = rows.slice(1);
      const splitAt = t.splitAt || Math.ceil(dataRows.length / 2);
      const left = [header, ...dataRows.slice(0, splitAt)];
      const right = dataRows.length > splitAt ? [header, ...dataRows.slice(splitAt)] : null;
      const halfW = (w - 0.3) / 2;
      const hLeft = csvTable(pres, s, left, x, y, halfW);
      const hRight = right ? csvTable(pres, s, right, x + halfW + 0.3, y, halfW) : 0;
      return Math.max(hLeft, hRight);
    }
    return csvTable(pres, s, rows, x, y, w);
  }

  // 3. Channel slides
  for (const ch of active) {
    const data = channelData[ch.id];

    if (ch.slideGroups) {
      // ---- 표를 여러 슬라이드로 분리하는 채널 (예: 네이버 검색광고) ----
      // 3-1. 개요 슬라이드 (KPI 카드만)
      if (ch.kpis.length > 0) {
        const s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, ch.title);
        const w = (12.1 - (ch.kpis.length - 1) * 0.28) / ch.kpis.length;
        ch.kpis.forEach((k, i) => statCard(pres, s, 0.6 + i * (w + 0.28), 1.65, w, 1.3, k.label, data.kpis[k.key]));
        footer(pres, s, hotelName);
      }
      // 3-2. 그룹별 슬라이드
      for (const group of ch.slideGroups) {
        if (group.type === "mediaBreakdown") {
          const hasData = !!(data.tables?.pcSummary || data.tables?.moSummary);
          if (!hasData) continue;
          const { mediaTable } = buildNaverMediaBreakdownTable(data);
          const s = pres.addSlide(); bgLight(s);
          pageTitle(pres, s, ch.kicker, group.title);
          csvTable(pres, s, mediaTable, 0.6, 1.65, 12.1);
          footer(pres, s, hotelName);
          continue;
        }
        const tablesInGroup = group.tableKeys.map((k) => ch.tables.find((t) => t.key === k)).filter(Boolean);
        const hasAnyData = tablesInGroup.some((t) => data.tables[t.key] && data.tables[t.key].length > 0);
        if (!hasAnyData) continue;
        const s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, group.title);
        let y = 1.65;
        for (const t of tablesInGroup) {
          const rows = data.tables[t.key];
          if (!rows || rows.length === 0) continue;
          const used = renderTable(s, t, rows, 0.6, y, 12.1);
          y += used + 0.35;
        }
        footer(pres, s, hotelName);
      }
      continue;
    }

    // ---- 일반 채널 (표 1~2개 정도, 한 슬라이드에 KPI+표+이미지) ----
    const s = pres.addSlide(); bgLight(s);
    pageTitle(pres, s, ch.kicker, ch.title);

    let y = 1.65;
    if (ch.kpis.length > 0) {
      const w = (12.1 - (ch.kpis.length - 1) * 0.28) / ch.kpis.length;
      ch.kpis.forEach((k, i) => statCard(pres, s, 0.6 + i * (w + 0.28), y, w, 1.3, k.label, data.kpis[k.key]));
      y += 1.55;
    }
    for (const t of ch.tables) {
      const rows = data.tables[t.key];
      if (!rows || rows.length === 0) continue;
      // 남은 공간 기준으로 표시 가능한 행 수 계산 (헤더 제외하고 최소 1행은 보여줌)
      const maxRowsThatFit = Math.max(2, Math.floor((6.9 - y) / 0.3));
      if (maxRowsThatFit < 2) break;
      const rowsToShow = rows.length > maxRowsThatFit ? [rows[0], ...rows.slice(1, maxRowsThatFit)] : rows;
      s.addText(t.label, { x: 0.6, y, w: 12.1, h: 0.28, fontSize: 12, color: NAVY, bold: true, fontFace: FONT, margin: 0 });
      y += 0.32;
      const usedHeight = renderTable(s, t, rowsToShow, 0.6, y, 12.1);
      y += usedHeight + 0.3;
      if (y > 6.9) break;
    }
    for (const img of ch.images) {
      if (y > 6.0) break;
      imgSpace(pres, s, 0.6, y, 12.1, Math.min(1.8, 7.0 - y), img.label);
      y += 1.9;
    }
    footer(pres, s, hotelName);
  }

  // 4. Closing
  {
    const s = pres.addSlide(); bgDark(s);
    s.addText("TRIPICKA", { x: 0.7, y: 3.0, w: 6, h: 0.5, fontSize: 18, color: ORANGE, bold: true, fontFace: FONT, charSpacing: 2, margin: 0 });
    s.addText("감사합니다.", { x: 0.7, y: 3.4, w: 8, h: 0.9, fontSize: 32, color: WHITE, bold: true, fontFace: FONT, margin: 0 });
    s.addText(`${hotelName || "[호텔명]"}  ·  ${month || "[YYYY년 M월]"} 마케팅 운영 보고서`, { x: 0.7, y: 4.2, w: 8, h: 0.4, fontSize: 13, color: MUTED, fontFace: FONT, margin: 0 });
  }

  const fileName = `${hotelName || "호텔명"}_${month || "YYYY-MM"}_마케팅운영보고서.pptx`;
  if (outputType === "blob") {
    const blob = await pres.write({ outputType: "blob" });
    return { blob, fileName };
  }
  await pres.writeFile({ fileName });
  return { fileName };
}
