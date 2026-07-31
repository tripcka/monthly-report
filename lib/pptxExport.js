import { isChannelActive, buildNaverMediaBreakdownTable } from "./channels";
import { toImgArray } from "./imageUtils";

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

function imgPlaceholder(pres, s, x, y, w, h, label) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: "FDFCFB" }, line: { color: "D6D0C6", width: 1, dashType: "dash" } });
  s.addText(label, { x: x + 0.2, y: y + h / 2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 10.5, color: "B3ABA0", fontFace: FONT, align: "center", valign: "middle", margin: 0, italic: true });
}

const IMG_COLS = 3;
const IMG_GAP = 0.25;
const IMG_CELL_W = (12.1 - (IMG_COLS - 1) * IMG_GAP) / IMG_COLS;
const IMG_CELL_H = 2.2;

/**
 * 이미지 슬롯 하나(예: "영수증 이미지")를 실제로 그린다.
 * - 업로드된 이미지가 없으면 기존처럼 점선 안내 박스만 표시.
 * - 있으면 3열 그리드로 실제 이미지를 삽입. 한 슬라이드에 다 못 들어가면
 *   같은 제목("... (이미지 N)")으로 새 슬라이드를 이어서 만들어 계속 배치한다.
 * ctx: { pres, kicker, title, hotelName, newSlide: () => Slide } — newSlide는 배경/타이틀까지 세팅된 새 슬라이드를 만들어줌
 * 반환값: 마지막에 사용 중인 슬라이드와 그 슬라이드에서 다음에 그릴 수 있는 y좌표
 */
function layoutImageSlot(ctx, s, y, label, srcs) {
  if (srcs.length === 0) {
    if (y <= 6.0) {
      imgPlaceholder(ctx.pres, s, 0.6, y, 12.1, Math.min(1.8, 7.0 - y), label);
      y += 1.9;
    }
    return { slide: s, y };
  }

  let remaining = srcs.slice();
  let curSlide = s;
  let curY = y;
  let page = 1;
  const LABEL_H = 0.32;
  const SAFE_BOTTOM = 6.9; // 이 아래로는(푸터 7.18 전까지) 안전하게 못 그림

  while (remaining.length > 0) {
    // 라벨 + 이미지 최소 한 줄(1행)조차 들어갈 공간이 없으면, 억지로 그리지 말고 새 슬라이드로 넘어간다
    const roomForOneRow = SAFE_BOTTOM - (curY + LABEL_H) >= IMG_CELL_H;
    if (!roomForOneRow) {
      footer(ctx.pres, curSlide, ctx.hotelName);
      page += 1;
      curSlide = ctx.newSlide(`${ctx.title} (이미지 ${page})`);
      curY = 1.65;
    }

    curSlide.addText(page === 1 ? label : `${label} (이어서)`, {
      x: 0.6, y: curY, w: 12.1, h: LABEL_H, fontSize: 12, color: NAVY, bold: true, fontFace: FONT, margin: 0,
    });
    curY += LABEL_H;

    // roomForOneRow 체크 덕분에 여기서는 항상 1행 이상 들어갈 공간이 보장됨
    const availRows = Math.floor((SAFE_BOTTOM - curY + IMG_GAP) / (IMG_CELL_H + IMG_GAP));
    const perPage = availRows * IMG_COLS;
    const pageImgs = remaining.slice(0, perPage);
    remaining = remaining.slice(perPage);

    pageImgs.forEach((src, i) => {
      const col = i % IMG_COLS;
      const row = Math.floor(i / IMG_COLS);
      const ix = 0.6 + col * (IMG_CELL_W + IMG_GAP);
      const iy = curY + row * (IMG_CELL_H + IMG_GAP);
      curSlide.addImage({ data: src, x: ix, y: iy, w: IMG_CELL_W, h: IMG_CELL_H, sizing: { type: "contain", w: IMG_CELL_W, h: IMG_CELL_H } });
      curSlide.addShape(ctx.pres.ShapeType.rect, { x: ix, y: iy, w: IMG_CELL_W, h: IMG_CELL_H, fill: { type: "none" }, line: { color: LIGHTGRAY, width: 0.75 } });
    });

    const rowsUsed = Math.ceil(pageImgs.length / IMG_COLS);
    curY += rowsUsed * (IMG_CELL_H + IMG_GAP);
  }

  return { slide: curSlide, y: curY };
}

function summarizeChannel(channel, data) {
  const lines = [];
  for (const k of channel.kpis) if (data.kpis[k.key]) lines.push(`- ${k.label}: ${data.kpis[k.key]}`);
  for (const t of channel.tables) {
    const rows = data.tables[t.key];
    if (rows && rows.length > 1) lines.push(`- ${t.label}: ${rows.length - 1}건`);
  }
  for (const img of channel.images) {
    const n = toImgArray(data.images[img.key]).length;
    if (n > 0) lines.push(`- ${img.label.replace("첨부 공간", "첨부됨")} ${n}장`);
  }
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
      // 3-1. 개요 슬라이드 (KPI 카드 + 매체 비중처럼 개요에 합칠 그룹 + 어느 그룹에도 속하지 않은 이미지 슬롯)
      const usedImageKeys = new Set((ch.slideGroups || []).flatMap((g) => g.imageKeys || []));
      const overviewImages = ch.images.filter((img) => !usedImageKeys.has(img.key));
      const mediaBreakdownGroup = ch.slideGroups.find((g) => g.type === "mediaBreakdown");
      const hasMediaBreakdown = mediaBreakdownGroup && !!(data.tables?.pcSummary || data.tables?.moSummary);

      if (ch.kpis.length > 0 || hasMediaBreakdown || overviewImages.length > 0) {
        let s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, ch.title);
        let y = 1.65;
        if (ch.kpis.length > 0) {
          const w = (12.1 - (ch.kpis.length - 1) * 0.28) / ch.kpis.length;
          ch.kpis.forEach((k, i) => statCard(pres, s, 0.6 + i * (w + 0.28), y, w, 1.3, k.label, data.kpis[k.key]));
          y += 1.55;
        }
        if (hasMediaBreakdown) {
          const { mediaTable } = buildNaverMediaBreakdownTable(data);
          s.addText(mediaBreakdownGroup.title, { x: 0.6, y, w: 12.1, h: 0.28, fontSize: 12, color: NAVY, bold: true, fontFace: FONT, margin: 0 });
          y += 0.32;
          const used = csvTable(pres, s, mediaTable, 0.6, y, 12.1);
          y += used + 0.3;
        }
        const imgCtx = {
          pres, kicker: ch.kicker, title: ch.title, hotelName,
          newSlide: (title) => { const ns = pres.addSlide(); bgLight(ns); pageTitle(pres, ns, ch.kicker, title); return ns; },
        };
        for (const img of overviewImages) {
          const result = layoutImageSlot(imgCtx, s, y, img.label, toImgArray(data.images[img.key]));
          s = result.slide;
          y = result.y;
        }
        footer(pres, s, hotelName);
      }
      // 3-2. 그룹별 슬라이드 (매체 비중은 위 개요 슬라이드에 이미 포함했으므로 건너뜀)
      for (const group of ch.slideGroups) {
        if (group.type === "mediaBreakdown") continue;
        const tablesInGroup = group.tableKeys.map((k) => ch.tables.find((t) => t.key === k)).filter(Boolean);
        const imagesInGroup = (group.imageKeys || [])
          .map((k) => ch.images.find((i) => i.key === k))
          .filter(Boolean);
        const hasAnyData =
          tablesInGroup.some((t) => data.tables[t.key] && data.tables[t.key].length > 0) ||
          imagesInGroup.some((img) => toImgArray(data.images[img.key]).length > 0);
        if (!hasAnyData) continue;
        let s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, group.title);
        let y = 1.65;
        for (const t of tablesInGroup) {
          const rows = data.tables[t.key];
          if (!rows || rows.length === 0) continue;
          const used = renderTable(s, t, rows, 0.6, y, 12.1);
          y += used + 0.35;
        }
        const imgCtx = {
          pres, kicker: ch.kicker, title: group.title, hotelName,
          newSlide: (title) => { const ns = pres.addSlide(); bgLight(ns); pageTitle(pres, ns, ch.kicker, title); return ns; },
        };
        for (const img of imagesInGroup) {
          const result = layoutImageSlot(imgCtx, s, y, img.label, toImgArray(data.images[img.key]));
          s = result.slide;
          y = result.y;
        }
        footer(pres, s, hotelName);
      }
      continue;
    }

    // ---- 일반 채널 (표 1~2개 정도, 한 슬라이드에 KPI+표+이미지) ----
    let s = pres.addSlide(); bgLight(s);
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
      if (y > 6.6) break; // 표 헤더 + 최소 1행조차 넣을 공간이 없으면 중단 (억지로 그려서 슬라이드 밖으로 잘리는 것 방지)
      // 남은 공간 기준으로 표시 가능한 행 수 계산 (헤더 포함)
      const maxRowsThatFit = Math.floor((6.9 - y) / 0.3);
      if (maxRowsThatFit < 2) break;
      const rowsToShow = rows.length > maxRowsThatFit ? [rows[0], ...rows.slice(1, maxRowsThatFit)] : rows;
      s.addText(t.label, { x: 0.6, y, w: 12.1, h: 0.28, fontSize: 12, color: NAVY, bold: true, fontFace: FONT, margin: 0 });
      y += 0.32;
      const usedHeight = renderTable(s, t, rowsToShow, 0.6, y, 12.1);
      y += usedHeight + 0.3;
      if (y > 6.9) break;
    }
    {
      const imgCtx = {
        pres, kicker: ch.kicker, title: ch.title, hotelName,
        newSlide: (title) => { const ns = pres.addSlide(); bgLight(ns); pageTitle(pres, ns, ch.kicker, title); return ns; },
      };
      for (const img of ch.images) {
        const result = layoutImageSlot(imgCtx, s, y, img.label, toImgArray(data.images[img.key]));
        s = result.slide;
        y = result.y;
      }
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
