import { won } from "./utils";

// ============================================================================
// 인스타그램(Meta) 광고비 인보이스 + 카드매출전표 붙여넣기 파서
// 웹페이지(인보이스)나 PDF/이미지(카드전표)에서 그대로 복사한 원문은 실제 화면
// 순서와 다르게 붙여지는 경우가 많아서(DOM 복사 특성 / 줄바꿈 깨짐 등),
// 줄 순서에 의존하지 않고 "라벨을 찾아 그 값을 뽑는" 방식으로 파싱한다.
// ============================================================================

function normalizeLabel(line) {
  return String(line || "")
    .replace(/[:：]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function splitLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim());
}

/** labelCandidates 중 하나와 일치하는 줄을 찾아, 같은 줄의 콜론 뒤 내용이나
 * 그 다음에 나오는 첫 비어있지 않은 줄을 값으로 반환한다. */
function findLabelValue(lines, labelCandidates, options = {}) {
  const targets = labelCandidates.map(normalizeLabel);
  for (let i = 0; i < lines.length; i += 1) {
    if (!targets.includes(normalizeLabel(lines[i]))) continue;
    const sameLine = lines[i].match(/[:：]\s*(.+)$/);
    if (sameLine && sameLine[1].trim()) return sameLine[1].trim();
    for (let j = i + 1; j < Math.min(i + (options.lookahead || 4), lines.length); j += 1) {
      const value = lines[j].trim();
      if (!value) continue;
      if (options.reject?.some((r) => normalizeLabel(value) === normalizeLabel(r))) continue;
      return value;
    }
  }
  return null;
}

/** "41.277 이렇게 줄수 있을듯" 처럼 뒤에 다른 말이 붙어 있어도 앞의 숫자만 뽑고,
 * 콤마 대신 마침표로 천단위를 구분해 적혀 있어도(41.277 = 41,277원) 정상 인식한다. */
function parseAmount(text) {
  if (text === null || text === undefined) return null;
  const match = String(text).match(/-?[\d][\d.,]*/);
  if (!match) return null;
  let raw = match[0].replace(/,/g, "");
  raw = raw.replace(/\.(?=\d{3}(?:\D|$))/g, ""); // 41.277 -> 41277 (마침표 천단위 구분 보정)
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function wonOrDash(n) {
  return n === null || n === undefined ? "-" : won(n);
}

// ── 메타(페이스북) 광고비 인보이스 원문 1건 파싱 ──────────────────────────
// Meta 결제 내역/인보이스 페이지에서 복사한 텍스트를 그대로 붙여넣으면 된다.
export function parseMetaInvoiceText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const lines = splitLines(raw);

  const dateMatch = raw.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
  const date = dateMatch
    ? `${dateMatch[1]}.${String(dateMatch[2]).padStart(2, "0")}.${String(dateMatch[3]).padStart(2, "0")}`
    : null;

  let total = null;
  for (const line of lines) {
    const m = line.match(/^₩\s*([\d,]+)\s*$/);
    if (m) {
      total = parseAmount(m[1]);
      break;
    }
  }

  const subtotalMatch = raw.match(/소계[:：]?\s*([\d,]+)\s*KRW/);
  const subtotal = subtotalMatch ? parseAmount(subtotalMatch[1]) : null;

  const vatMatch = raw.match(/VAT[:：]?\s*₩?\s*([\d,]+)\s*\(?\s*세율[:：]?\s*(\d+)\s*%\)?/i);
  const vat = vatMatch ? parseAmount(vatMatch[1]) : null;
  const vatRate = vatMatch ? Number(vatMatch[2]) : null;

  const refMatch = raw.match(/참조\s*번호[:：]?\s*([A-Za-z0-9]+)/);
  const refNo = refMatch ? refMatch[1] : null;

  const accountId = findLabelValue(lines, ["계정 ID", "광고 계정 ID"]);
  const transactionId = findLabelValue(lines, ["거래 ID", "거래ID"]);
  // "제품 유형" 라벨 바로 다음 줄이 항상 실제 값은 아니고(VAT 등 다른 항목이 사이에 끼어
  // 나오는 경우가 있음), "Meta 광고" 문구가 원문에 그대로 있으면 그걸 우선 사용한다.
  const productTypeLine = lines.find((l) => /^Meta\s*(광고|Ads)/i.test(l));
  const productType = productTypeLine || findLabelValue(lines, ["제품 유형"]);

  const cardMatch = raw.match(/Visa[^\d]{0,10}(\d{4})/i);
  const cardLast4 = cardMatch ? cardMatch[1] : null;

  const noteLine = lines.find((l) => /지출\s*비용입니다/.test(l));

  const recognized = [date, total, subtotal, vat, refNo].some((v) => v !== null && v !== undefined);
  if (!recognized) return null;

  return {
    date,
    total,
    subtotal,
    vat,
    vatRate: vatRate ?? 10,
    refNo,
    accountId,
    transactionId,
    productType: productType || "Meta 광고",
    cardLast4,
    note: noteLine || null,
    campaigns: [],
  };
}

// ── 신용카드사 카드매출전표(카드 결제 내역서) 원문 1건 파싱 ────────────────
// "카드매출전표 인터넷 재발급용" 같은 PDF/이미지에서 복사한 텍스트를 그대로
// 붙여넣으면 된다. 라벨/값이 서로 다른 줄에 떨어져 나오거나 줄바꿈이 깨져도
// (예: 매장명이 두 줄로 쪼개짐) 라벨 기준으로 값을 찾으므로 크게 문제되지 않는다.
export function parseCardSlipText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const lines = splitLines(raw);

  const date = findLabelValue(lines, ["거래일시"]);
  const cardNumberRaw = findLabelValue(lines, ["카드번호"]);
  // "매장명"은 원문에서 줄바꿈이 깨져 잘리는 경우가 있어(예: FACEBK *4H7PSZZPN / 2),
  // 보통 뒤에 온전하게 다시 나오는 "가맹점명" 값을 우선 사용한다.
  const merchantName = findLabelValue(lines, ["가맹점명"]) || findLabelValue(lines, ["매장명"]);
  const approvalNo = findLabelValue(lines, ["승인번호"]);
  const merchantNo = findLabelValue(lines, ["가맹점번호"]);
  const merchantAddress = findLabelValue(lines, ["가맹점주소"]);
  const amountRaw = findLabelValue(
    lines,
    ["금액(AMOUNT)", "금액(AMOLNT)", "금액"],
    { lookahead: 3 }
  );
  const vatRaw = findLabelValue(lines, ["부가세(VAT)", "부가세"]);
  const serviceRaw = findLabelValue(lines, ["봉사료(S/C)", "봉사료"]);
  const totalRaw = findLabelValue(lines, ["합계(TOTAL)", "합계"]);

  const amount = parseAmount(amountRaw);
  const vat = parseAmount(vatRaw) || 0;
  const service = parseAmount(serviceRaw) || 0;
  const total = totalRaw !== null ? parseAmount(totalRaw) : amount !== null ? amount + vat + service : null;

  const recognized = [date, merchantName, amount].some((v) => v !== null && v !== undefined && v !== "");
  if (!recognized) return null;

  return {
    date: date || null,
    cardLast4: cardNumberRaw ? (cardNumberRaw.match(/(\d{4})\s*$/) || [])[1] || null : null,
    merchantName: merchantName || null,
    approvalNo: approvalNo || null,
    merchantNo: merchantNo || null,
    merchantAddress: merchantAddress || null,
    amount,
    vat,
    service,
    total,
  };
}

// ── 요약 표 빌더 — "광고비 인보이스"/"카드 결제 내역서" 좌측 병합칸 +
// "합계"/"최종 청구액" 우측 병합칸까지 포함한 표를 만든다.
// (렌더러가 알아보는 규칙: 맨 끝 행이 ["__TOTAL__", 합계값] 이면 그 값을
// 우측 병합칸에 표시한다 — 브랜드 블로그 "총유입" 표와 동일한 관례)
export function buildInvoiceSummaryTable(invoices) {
  const rows = [["인보이스 발행일", "지출 금액", "VAT", "최종 금액 (+vat)"]];
  let sum = 0;
  invoices.forEach((inv) => {
    if (inv.total) sum += inv.total;
    rows.push([inv.date || "-", wonOrDash(inv.subtotal), wonOrDash(inv.vat), wonOrDash(inv.total)]);
  });
  rows.push(["__TOTAL__", wonOrDash(sum)]);
  return rows;
}

// cardSlips는 각 항목에 localAmount(=매칭되는 인보이스의 최종 금액)가 미리 채워져 있어야 한다.
export function buildCardSummaryTable(cardSlips) {
  const rows = [["결제일", "결제명", "현지 금액 (+vat)", "청구 금액 (+vat)"]];
  let sum = 0;
  cardSlips.forEach((c) => {
    if (c.total) sum += c.total;
    rows.push([c.date || "-", c.merchantName || "-", wonOrDash(c.localAmount), wonOrDash(c.total)]);
  });
  rows.push(["__TOTAL__", wonOrDash(sum)]);
  return rows;
}
