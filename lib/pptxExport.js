import { isChannelActive } from "./channels";
import { containImageRect, toImgArray } from "./imageUtils";
import { summarizeChannel } from "./summarize";
import { normalizeInstagramPostsRows } from "./postsTable";
import { LOGO_WHITE } from "./brandAssets";

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
    x: 0.42, y: 7.15, w: 12.5, h: 0.25, fontSize: 8, color: MUTED, fontFace: FONT, align: "left", margin: 0,
  });
}

function pageTitle(pres, s, kicker, title) {
  s.addText(kicker, { x: 0.42, y: 0.42, w: 9, h: 0.24, fontSize: 11, color: ORANGE, bold: true, fontFace: FONT, charSpacing: 1, margin: 0 });
  s.addText(title, { x: 0.42, y: 0.66, w: 11.5, h: 0.5, fontSize: 22, color: NAVY, bold: true, fontFace: FONT, margin: 0 });
  s.addShape(pres.ShapeType.rect, { x: 0.42, y: 1.13, w: 12.5, h: 0.014, fill: { color: LIGHTGRAY } });
}

// 슬라이드 안에서 섹션을 구분하는 소제목("■ ...")
function sectionTitle(pres, s, x, y, w, text) {
  s.addText(
    [
      { text: "■ ", options: { color: ORANGE, bold: true } },
      { text, options: { color: NAVY, bold: true } },
    ],
    { x, y, w, h: 0.28, fontSize: 12, fontFace: FONT, margin: 0, valign: "middle" }
  );
}

function statCard(pres, s, x, y, w, h, label, value, sub) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: CARD }, line: { color: LIGHTGRAY, width: 0.75 } });
  s.addText(label, { x: x + 0.17, y: y + 0.13, w: w - 0.34, h: 0.16, fontSize: 9, color: GRAYTXT, bold: true, fontFace: FONT, margin: 0, valign: "top" });
  s.addText(value || "-", { x: x + 0.17, y: y + 0.35, w: w - 0.34, h: 0.32, fontSize: 18, color: ORANGE, bold: true, fontFace: FONT, margin: 0, valign: "top" });
  if (sub) s.addText(sub, { x: x + 0.17, y: y + 0.68, w: w - 0.34, h: Math.max(0.15, h - 0.72), fontSize: 8, color: GRAYTXT, fontFace: FONT, margin: 0, valign: "top" });
}

// KPI 카드 여러 개를 한 줄에 배치하다가, 한 줄에 다 못 들어가면(최대 6장) 다음 줄로 감싼다.
// 웹 미리보기(StatCardRow)는 flex-wrap이라 카드가 많으면 자동으로 줄바꿈되는데,
// PPTX는 고정 좌표라 이 함수 없이 개수만큼 폭을 나누면 카드가 슬라이드 밖으로 넘어갈 수 있어서
// 반드시 이 함수를 통해서만 KPI 카드 줄을 그린다.
function renderKpiGrid(pres, s, x, y, w, kpis, dataKpis, cardH = 0.78) {
  const n = kpis.length;
  if (n === 0) return 0;
  const MAX_PER_ROW = 6;
  const cols = Math.min(n, MAX_PER_ROW);
  const rows = Math.ceil(n / cols);
  const gap = 0.125;
  const rowGap = 0.167;
  const cardW = (w - (cols - 1) * gap) / cols;
  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    statCard(pres, s, x + col * (cardW + gap), y + row * (cardH + rowGap), cardW, cardH, k.label, dataKpis[k.key]);
  });
  return rows * cardH + (rows - 1) * rowGap;
}

function summaryBox(pres, s, x, y, w, h, title, body) {
  s.addTable([
    [{ text: title, options: { bold: true, color: NAVY, fill: { color: WHITE }, fontFace: FONT, fontSize: 11, align: "left", valign: "middle" } }],
    [{ text: body, options: { color: GRAYTXT, fill: { color: WHITE }, fontFace: FONT, fontSize: 9, align: "left", valign: "top" } }],
  ], {
    x, y, w, colW: [w], rowH: [0.5, h - 0.5],
    border: { type: "solid", color: LIGHTGRAY, pt: 0.75 }, autoPage: false, fontFace: FONT,
  });
}

const TABLE_BASE_ROW_H = 0.3; // 한 줄짜리 셀의 기본 행 높이(in)
const TABLE_LINE_H = 0.24; // 한 줄당 높이(in), 실측 기준

// 셀 안에 줄바꿈(\n)이 있으면 그 줄 수만큼, 그리고 각 줄이 칸보다 길면 자동 word-wrap으로
// 추가로 몇 줄이 더 필요한지까지 더해서 표의 실제 필요 높이를 미리 계산한다.
// (좁은 칸에 긴 문장이 들어가는 "상위노출 키워드" 같은 셀에서, 줄바꿈 개수만 보면 실제보다
// 훨씬 작게 잡혀서 다음 내용과 겹치는 문제가 있었음 — 넉넉하게 잡아서 겹치지 않는 쪽을 우선한다.)
const TABLE_MAX_LINES_PER_CELL = 3; // 한 셀당 이 줄 수까지만 행 높이에 반영 (그 이상은 칸 안에서 알아서 줄바꿈, 행이 과도하게 커지는 것 방지)
const LATIN_UNIT_WIDTH = 0.078; // 숫자/영문/기호 한 글자의 대략적인 너비(in), 10pt 기준
const HANGUL_UNIT_RATIO = 1.9; // 한글 완성형 글자는 숫자/영문보다 이 배수만큼 넓다고 취급

// 문자열의 "시각적 너비"를 라틴 문자 단위로 환산한다. 한글/숫자/영문을 같은 폭으로 치면
// "1,987원"(7자) 같은 짧은 숫자도 좁은 칸에서 2줄로 잘못 계산되는 문제가 있어서,
// 한글은 더 넓게, 숫자/영문/기호는 좁게 따로 계산한다.
function visualCharWidth(text) {
  let units = 0;
  for (const ch of String(text ?? "")) {
    units += /[\uAC00-\uD7A3\u3131-\u318E]/.test(ch) ? HANGUL_UNIT_RATIO : 1;
  }
  return units;
}

function computeTableRowHeights(rows, w, fontSize = 10) {
  if (!rows || rows.length === 0) return [];
  const scale = fontSize / 10;
  const nCols = rows[0].length;
  const cellW = w / nCols;
  const unitsPerLine = Math.max(8, Math.floor((cellW - 0.2) / (LATIN_UNIT_WIDTH * scale)));
  const estimateLines = (text) =>
    Math.min(
      TABLE_MAX_LINES_PER_CELL,
      String(text ?? "")
        .split("\n")
        .reduce((sum, seg) => sum + Math.max(1, Math.ceil(visualCharWidth(seg) / unitsPerLine)), 0)
    );
  return rows.map((r) => Math.max(TABLE_BASE_ROW_H * scale, Math.max(...r.map(estimateLines)) * TABLE_LINE_H * scale + 0.08));
}

function computeTableHeight(rows, w, fontSize = 10) {
  return computeTableRowHeights(rows, w, fontSize).reduce((sum, h) => sum + h, 0);
}

// t.layout === "split"인 표는 실제로 좌/우 두 칸으로 나눠 그려지기 때문에, 안 나눈 것처럼
// 전체를 한 줄로 쳐서 높이를 예상하면 실제보다 훨씬 크게(거의 2배로) 잡혀서 불필요하게
// 다음 슬라이드로 넘어가버린다. renderTable의 실제 분할 방식과 똑같이 계산해야 한다.
function computeTableDisplayHeight(t, rows, w) {
  const fontSize = t.fontSize || 9;
  if (t.layout === "split" && rows.length > 1) {
    const header = rows[0];
    const dataRows = rows.slice(1);
    const splitAt = t.splitAt || Math.ceil(dataRows.length / 2);
    const left = [header, ...dataRows.slice(0, splitAt)];
    const right = dataRows.length > splitAt ? [header, ...dataRows.slice(splitAt)] : null;
    const halfW = (w - 0.3) / 2;
    const hLeft = computeTableHeight(left, halfW, fontSize);
    const hRight = right ? computeTableHeight(right, halfW, fontSize) : 0;
    return Math.max(hLeft, hRight);
  }
  return computeTableHeight(rows, w, fontSize);
}

// 표 하나(헤더 + 데이터 행)를 한 슬라이드에 다 못 담으면, 헤더를 반복하면서
// 데이터 행 단위로 다음 슬라이드로 이어서 그린다. (이미지 여러 장 페이지네이션과 같은 원리)
// ctx: { pres, kicker, title, hotelName, newSlide(title) => Slide }
function renderTablePaginated(ctx, s, y, sectionLabel, rows) {
  const SAFE_BOTTOM = 6.95;
  if (!rows || rows.length === 0) return { slide: s, y };
  const header = rows[0];
  const dataRows = rows.slice(1);
  let curSlide = s;
  let curY = y;
  let remaining = dataRows.slice();
  let firstPage = true;

  while (firstPage || remaining.length > 0) {
    if (!firstPage) {
      footer(ctx.pres, curSlide, ctx.hotelName);
      curSlide = ctx.newSlide(ctx.title);
      curY = 1.4;
      sectionTitle(ctx.pres, curSlide, 0.42, curY, 12.5, sectionLabel);
      curY += 0.3;
    }
    const headerH = computeTableHeight([header], 12.5);
    const budget = SAFE_BOTTOM - curY;
    let acc = headerH;
    const pageRows = [header];
    let idx = 0;
    while (idx < remaining.length) {
      const rowH = computeTableHeight([remaining[idx]], 12.5);
      if (pageRows.length > 1 && acc + rowH > budget) break;
      acc += rowH;
      pageRows.push(remaining[idx]);
      idx += 1;
    }
    if (pageRows.length === 1 && remaining.length > 0) {
      // 헤더 하나만으로 이미 공간이 부족한 극단적인 경우라도, 최소 1행은 그려서 무한루프를 막는다.
      pageRows.push(remaining[0]);
      idx = 1;
    }
    const used = csvTable(ctx.pres, curSlide, pageRows, 0.42, curY, 12.5);
    curY += used;
    remaining = remaining.slice(idx);
    firstPage = false;
  }
  return { slide: curSlide, y: curY + 0.25 };
}

function csvTable(pres, s, rows, x, y, w, fontSize = 9) {
  if (!rows || rows.length === 0) return 0;
  const nCols = rows[0].length;
  const colW = new Array(nCols).fill(w / nCols);
  const rowHeights = computeTableRowHeights(rows, w, fontSize);
  const tblRows = rows.map((r, ri) => r.map((cell) => ({
    text: /^https?:\/\//i.test(String(cell ?? "")) ? "바로가기" : String(cell ?? ""),
    options: {
      bold: ri === 0, color: ri === 0 ? WHITE : GRAYTXT,
      fill: ri === 0 ? { color: NAVY } : (ri % 2 === 0 ? { color: "FAF8F5" } : { color: WHITE }),
      fontFace: FONT, fontSize, align: "center", valign: "middle",
      ...(/^https?:\/\//i.test(String(cell ?? "")) ? { hyperlink: { url: String(cell) }, color: "2563EB", underline: true } : {}),
    },
  })));
  s.addTable(tblRows, {
    x, y, w, colW,
    rowH: rowHeights,
    border: { type: "solid", color: LIGHTGRAY, pt: 0.5 }, autoPage: false, fontFace: FONT,
  });
  return rowHeights.reduce((sum, h) => sum + h, 0); // 실제 사용한 높이를 반환해서 호출부가 정확히 y를 전진시키게 함
}

function imgPlaceholder(pres, s, x, y, w, h, label) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: "FDFCFB" }, line: { color: "D6D0C6", width: 1, dashType: "dash" } });
  s.addText(label, { x: x + 0.2, y: y + h / 2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 10.5, color: "B3ABA0", fontFace: FONT, align: "center", valign: "middle", margin: 0, italic: true });
}

const IMG_COLS = 3;
const IMG_GAP = 0.25;
const IMG_CELL_W = (12.5 - (IMG_COLS - 1) * IMG_GAP) / IMG_COLS;
const IMG_CELL_H = 1.9;

/**
 * 이미지 슬롯 하나(예: "영수증 이미지")를 실제로 그린다.
 * - 업로드된 이미지가 없으면 기존처럼 점선 안내 박스만 표시.
 * - 있으면 원본 비율을 유지해 3열 그리드에 삽입한다.
 * ctx: { pres, kicker, title, hotelName, newSlide: () => Slide } — newSlide는 배경/타이틀까지 세팅된 새 슬라이드를 만들어줌
 * 반환값: 마지막에 사용 중인 슬라이드와 그 슬라이드에서 다음에 그릴 수 있는 y좌표
 */
function layoutImageSlot(ctx, s, y, label, srcs) {
  if (srcs.length === 0) {
    if (y <= 6.0) {
      imgPlaceholder(ctx.pres, s, 0.42, y, 12.5, Math.min(1.8, 7.0 - y), label);
      y += 1.9;
    }
    return { slide: s, y };
  }

  let remaining = srcs.slice();
  let curSlide = s;
  let curY = y;
  const SAFE_BOTTOM = 6.95; // 이 아래로는(푸터 7.18 전까지) 안전하게 못 그림

  while (remaining.length > 0) {
    const roomForOneRow = SAFE_BOTTOM - curY >= IMG_CELL_H;
    if (!roomForOneRow) {
      footer(ctx.pres, curSlide, ctx.hotelName);
      curSlide = ctx.newSlide(ctx.title);
      curY = 1.4;
      continue; // 새 슬라이드 기준으로 여유공간을 다시 계산
    }

    const availRows = Math.floor((SAFE_BOTTOM - curY + IMG_GAP) / (IMG_CELL_H + IMG_GAP));
    const perPage = availRows * IMG_COLS;
    const pageImgs = remaining.slice(0, perPage);
    remaining = remaining.slice(perPage);

    pageImgs.forEach((src, i) => {
      const col = i % IMG_COLS;
      const row = Math.floor(i / IMG_COLS);
      const ix = 0.42 + col * (IMG_CELL_W + IMG_GAP);
      const iy = curY + row * (IMG_CELL_H + IMG_GAP);
      const rect = containImageRect(src, ix, iy, IMG_CELL_W, IMG_CELL_H);
      curSlide.addImage({ data: src, ...rect });
      curSlide.addShape(ctx.pres.ShapeType.rect, { ...rect, fill: { type: "none" }, line: { color: LIGHTGRAY, width: 0.75 } });
    });

    const rowsUsed = Math.ceil(pageImgs.length / IMG_COLS);
    curY += rowsUsed * (IMG_CELL_H + IMG_GAP);
  }

  return { slide: curSlide, y: curY };
}

export async function exportPptx({ hotelName, month, channels, channelData, outputType }) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const active = channels.filter((ch) => isChannelActive(channelData[ch.id], ch));

  // 1. Cover — 웹 미리보기(PageShell p-10, 로고 h-8, mt-40/mt-4/mt-6)의 실제 좌표를
  // 96px/in 기준으로 환산해서 그대로 맞춤
  {
    const s = pres.addSlide(); bgDark(s);
    const logoH = 0.333, logoW = logoH * (852 / 206);
    s.addImage({ data: LOGO_WHITE, x: 0.42, y: 0.67, w: logoW, h: logoH });
    s.addText(hotelName || "[호텔명]", { x: 0.42, y: 2.67, w: 10, h: 0.7, fontSize: 35, color: WHITE, bold: true, fontFace: FONT, margin: 0 });
    s.addText("월별 마케팅 운영 보고서", { x: 0.42, y: 3.42, w: 10, h: 0.6, fontSize: 35, color: "CBD5E1", fontFace: FONT, margin: 0 });
    s.addText(month || "[YYYY년 M월]", { x: 0.42, y: 4.26, w: 10, h: 0.35, fontSize: 15, color: ORANGE, bold: true, fontFace: FONT, margin: 0 });
  }

  // 2. Summary
  {
    const s = pres.addSlide(); bgLight(s);
    pageTitle(pres, s, "OVERVIEW", "운영 요약  Summary");
    const bw = 3.85, bh = 1.9, gapx = 0.3, gapy = 0.3, x0 = 0.42, y0 = 1.4;
    active.forEach((ch, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      summaryBox(pres, s, x0 + col * (bw + gapx), y0 + row * (bh + gapy), bw, bh, ch.title, summarizeChannel(ch, channelData[ch.id]));
    });
    footer(pres, s, hotelName);
  }

  // 표 하나를 그리고 실제 사용한 높이(in)를 반환. layout:'split'이면 좌/우 반반으로 나눠 그림.
  function renderTable(s, t, rows, x, y, w) {
    const fontSize = t.fontSize || 9;
    if (t.layout === "split" && rows.length > 1) {
      const header = rows[0];
      const dataRows = rows.slice(1);
      const splitAt = t.splitAt || Math.ceil(dataRows.length / 2);
      const left = [header, ...dataRows.slice(0, splitAt)];
      const right = dataRows.length > splitAt ? [header, ...dataRows.slice(splitAt)] : null;
      const halfW = (w - 0.3) / 2;
      const hLeft = csvTable(pres, s, left, x, y, halfW, fontSize);
      const hRight = right ? csvTable(pres, s, right, x + halfW + 0.3, y, halfW, fontSize) : 0;
      return Math.max(hLeft, hRight);
    }
    return csvTable(pres, s, rows, x, y, w, fontSize);
  }

  // 그룹 하나(표/이미지)의 내용을 현재 슬라이드에 이어서 그린다.
  // 그룹 제목은 항상 "■ ..." 소제목으로 표시하고, 그 그룹의 유일한 내용이 이미지 하나뿐이면
  // 이미지 쪽 자체 라벨은 생략해서 소제목과 중복되지 않게 한다.
  function renderGroupContent(ch, group, data, s, y) {
    let curSlide = s;
    let curY = y;

    const tablesInGroup = (group.tableKeys || []).map((k) => ch.tables.find((t) => t.key === k)).filter(Boolean);
    const imagesInGroup = (group.imageKeys || []).map((k) => ch.images.find((i) => i.key === k)).filter(Boolean);
    const SAFE_BOTTOM = 6.95; // 이 아래로는(푸터 7.18 전까지) 안전하게 못 그림
    const newSlideForGroup = () => { const ns = pres.addSlide(); bgLight(ns); pageTitle(pres, ns, ch.kicker, ch.title); return ns; };

    sectionTitle(pres, curSlide, 0.42, curY, 12.5, group.title);
    curY += 0.3;

    for (const t of tablesInGroup) {
      const sourceRows = data.tables[t.key];
      const rowIndexes = group.tableRows?.[t.key];
      let rows = rowIndexes ? rowIndexes.map((index) => sourceRows?.[index]).filter(Boolean) : sourceRows;
      if (ch.id === "instagram" && t.key === "posts") rows = normalizeInstagramPostsRows(rows);
      if (!rows || rows.length === 0) continue;

      if (t.layout !== "split" && rows.length > 1) {
        // 상위노출처럼 줄이 많은 셀이 섞여있는 표는, 표 전체가 한 슬라이드에 안 들어가면
        // 헤더를 반복하면서 행 단위로 다음 슬라이드에 이어서 그린다.
        const tableCtx = { pres, kicker: ch.kicker, title: ch.title, hotelName, newSlide: newSlideForGroup };
        const result = renderTablePaginated(tableCtx, curSlide, curY, group.title, rows);
        curSlide = result.slide;
        curY = result.y;
        continue;
      }

      const estimatedHeight = computeTableDisplayHeight(t, rows, 12.5);
      if (curY + estimatedHeight > SAFE_BOTTOM && curY > 1.4) {
        footer(pres, curSlide, hotelName);
        curSlide = newSlideForGroup();
        curY = 1.4;
        sectionTitle(pres, curSlide, 0.42, curY, 12.5, group.title);
        curY += 0.3;
      }
      const used = renderTable(curSlide, t, rows, 0.42, curY, 12.5);
      curY += used + 0.25;
    }

    if (group.kpiDetail) {
      sectionTitle(pres, curSlide, 0.42, curY, 12.5, group.kpiDetail.title);
      curY += 0.3;
      const detailRows = [
        ["구분", "수치"],
        ...group.kpiDetail.keys.map((key) => {
          const kpi = ch.kpis.find((item) => item.key === key);
          return [kpi?.label || key, data.kpis?.[key] || "-"];
        }),
      ];
      const used = csvTable(pres, curSlide, detailRows, 0.42, curY, 12.5);
      curY += used + 0.25;
    }

    const imgCtx = {
      pres, kicker: ch.kicker, title: ch.title, hotelName,
      newSlide: (title) => { const ns = pres.addSlide(); bgLight(ns); pageTitle(pres, ns, ch.kicker, title); return ns; },
    };
    for (const img of imagesInGroup) {
      const result = layoutImageSlot(imgCtx, curSlide, curY, img.label, toImgArray(data.images[img.key]));
      curSlide = result.slide;
      curY = result.y;
    }

    return { slide: curSlide, y: curY };
  }

  // 3. Channel slides
  for (const ch of active) {
    const data = channelData[ch.id];

    if (ch.slideGroups) {
      // ---- 표를 여러 슬라이드로 분리하는 채널 (예: 네이버 검색광고, 인스타그램) ----
      const mergeGroups = ch.slideGroups.filter((g) => g.mergeIntoOverview);
      const otherGroups = ch.slideGroups.filter((g) => !g.mergeIntoOverview);
      const usedImageKeys = new Set(ch.slideGroups.flatMap((g) => g.imageKeys || []));
      const overviewImages = ch.images.filter((img) => !usedImageKeys.has(img.key));

      const mergeGroupsWithData = mergeGroups.filter((g) => {
        const hasTable = (g.tableKeys || []).some((k) => data.tables[k] && data.tables[k].length > 0);
        const hasImg = (g.imageKeys || []).some((k) => toImgArray(data.images[k]).length > 0);
        return hasTable || hasImg;
      });

      // 3-1. 개요 슬라이드 (KPI 카드 + 개요에 합칠 그룹들 + 어느 그룹에도 속하지 않은 이미지 슬롯)
      const overviewKpis = ch.kpis.filter((k) => !k.detailOnly);
      if (overviewKpis.length > 0 || mergeGroupsWithData.length > 0 || overviewImages.length > 0) {
        let s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, ch.title);
        let y = 1.4;
        if (overviewKpis.length > 0) {
          const used = renderKpiGrid(pres, s, 0.42, y, 12.5, overviewKpis, data.kpis);
          y += used + 0.25;
        }
        for (const g of mergeGroupsWithData) {
          const result = renderGroupContent(ch, g, data, s, y);
          s = result.slide;
          y = result.y;
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

      // 3-2. 나머지 그룹은 각각 별도 슬라이드로. 큰 제목은 채널명으로 고정하고 그룹명은 소제목("■")으로.
      for (const group of otherGroups) {
        const tablesInGroup = (group.tableKeys || []).map((k) => ch.tables.find((t) => t.key === k)).filter(Boolean);
        const imagesInGroup = (group.imageKeys || []).map((k) => ch.images.find((i) => i.key === k)).filter(Boolean);
        const hasAnyData =
          tablesInGroup.some((t) => data.tables[t.key] && data.tables[t.key].length > 0) ||
          imagesInGroup.some((img) => toImgArray(data.images[img.key]).length > 0) ||
          (group.kpiKeys || []).some((key) => data.kpis?.[key]) ||
          (group.kpiDetail?.keys || []).some((key) => data.kpis?.[key]);
        if (!hasAnyData) continue;
        let s = pres.addSlide(); bgLight(s);
        pageTitle(pres, s, ch.kicker, ch.title);
        let groupY = 1.4;
        if (group.kpiKeys?.length) {
          const detailKpis = group.kpiKeys
            .map((key) => ch.kpis.find((k) => k.key === key))
            .filter(Boolean);
          if (detailKpis.length > 0) {
            const used = renderKpiGrid(pres, s, 0.42, groupY, 12.5, detailKpis, data.kpis, 0.78);
            groupY += used + 0.2;
          }
        }
        const result = renderGroupContent(ch, group, data, s, groupY);
        s = result.slide;
        footer(pres, s, hotelName);
      }
      continue;
    }

    // ---- 일반 채널 (표 1~2개 정도, 한 슬라이드에 KPI+표+이미지) ----
    let s = pres.addSlide(); bgLight(s);
    pageTitle(pres, s, ch.kicker, ch.title);

    let y = 1.4;
    if (ch.kpis.length > 0) {
      const used = renderKpiGrid(pres, s, 0.42, y, 12.5, ch.kpis, data.kpis);
      y += used + 0.25;
    }
    for (const t of ch.tables) {
      const rows = data.tables[t.key];
      if (!rows || rows.length === 0) continue;
      if (y > 6.6) break; // 표 헤더 + 최소 1행조차 넣을 공간이 없으면 중단 (억지로 그려서 슬라이드 밖으로 잘리는 것 방지)
      // 남은 공간 기준으로 표시 가능한 행 수 계산 (헤더 포함) — 상위노출처럼 줄이 많은 셀은
      // 그만큼 더 큰 높이로 계산해서, 실제보다 많이 들어간다고 잘못 판단하지 않게 한다.
      const rowHeights = computeTableRowHeights(rows, 12.5);
      const budget = 6.9 - y;
      let acc = 0, fitCount = 0;
      for (let i = 0; i < rowHeights.length; i++) {
        if (fitCount >= 1 && acc + rowHeights[i] > budget) break;
        acc += rowHeights[i];
        fitCount++;
      }
      if (fitCount < 2) break;
      const rowsToShow = rows.length > fitCount ? [rows[0], ...rows.slice(1, fitCount)] : rows;
      sectionTitle(pres, s, 0.42, y, 12.5, t.label);
      y += 0.34;
      const usedHeight = renderTable(s, t, rowsToShow, 0.42, y, 12.5);
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
    const logoW = 1.7, logoH = logoW * (206 / 852);
    s.addImage({ data: LOGO_WHITE, x: 0.7, y: 3.0, w: logoW, h: logoH });
    s.addText("감사합니다.", { x: 0.7, y: 3.5, w: 8, h: 0.9, fontSize: 32, color: WHITE, bold: true, fontFace: FONT, margin: 0 });
    s.addText(`${hotelName || "[호텔명]"}  ·  ${month || "[YYYY년 M월]"} 마케팅 운영 보고서`, { x: 0.7, y: 4.3, w: 8, h: 0.4, fontSize: 13, color: MUTED, fontFace: FONT, margin: 0 });
  }

  const fileName = `${hotelName || "호텔명"}_${month || "YYYY-MM"}_마케팅운영보고서.pptx`;
  if (outputType === "blob") {
    const blob = await pres.write({ outputType: "blob" });
    return { blob, fileName };
  }
  await pres.writeFile({ fileName });
  return { fileName };
}
