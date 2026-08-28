import { findCol } from "./utils";

// 트리피카 체험단 관리 시트는 업체마다 컬럼 구성이 다르고, 한 탭 안에도
// "[블로그] 객실 체험단 3팀" / "[블로그] 식음 체험단 4팀" / "[인스타그램] 2팀" 처럼
// 성격이 다른 섹션이 여러 개 세로로 쌓여있는 경우가 많다. 섹션마다 "성함" 헤더가
// 다시 나오고 컬럼 의미도 달라서, "성함"이 나오는 모든 위치를 각각 새 섹션으로 보고
// 섹션별로 컬럼을 다시 찾아 하나의 표로 합친다.
//
// 2026-08부터는 "통합 시트" 형식도 지원한다: 모든 호텔·모든 월이 한 탭에 함께 들어있고,
// "캠페인ID"(예: "SL 2609" = SL호텔강릉·2026년9월) + "호텔ID"(예: "SL호텔강릉") 두 열로
// 어느 호텔·몇 월 데이터인지 구분한다. 이 형식이면 호텔명/보고월로 행을 먼저 걸러낸 뒤
// 기존과 동일한 방식으로 표를 만든다.

function normalizeHotel(name) {
  return String(name || "").replace(/\s/g, "").toLowerCase();
}

/** "2026년 7월", "2026-07" 등에서 캠페인ID 뒤 4자리와 비교할 "YYMM" 문자열을 뽑는다 */
function toYYMM(monthInput) {
  const s = String(monthInput || "").trim();
  let m = s.match(/(\d{4})\s*[년.\-\/]?\s*(\d{1,2})\s*월?/);
  if (!m) m = s.match(/^(\d{1,2})\s*월$/) && [null, String(new Date().getFullYear()), s.match(/^(\d{1,2})\s*월$/)[1]];
  if (!m) return null;
  const year = String(m[1]).slice(-2);
  const month = String(Number(m[2])).padStart(2, "0");
  return `${year}${month}`;
}

function findUnifiedHeaderIndex(rows) {
  return rows.findIndex((row) => row.some((c) => String(c).trim() === "호텔ID"));
}

// "포스팅 URL" / "업로드 URL" / "영수증 리뷰 URL"처럼 실제 게시물 링크만 모으고,
// "블로그URL" / "인스타URL"처럼 그 사람의 프로필 링크는 제외한다.
function findPostUrlCols(header) {
  return header
    .map((h, i) => ({ stripped: String(h).replace(/\s/g, ""), i }))
    .filter(({ stripped }) => /url/i.test(stripped) && /(포스팅|업로드|리뷰)/.test(stripped))
    .map(({ i }) => i);
}

function buildRow(header, r) {
  const nameCol = findCol(header, ["성함", "이름"]);
  const followerCol = findCol(header, ["팔로워"]);
  const visitorCol = findCol(header, ["일방문자"]);
  const dateCol = findCol(header, ["방문일", "업로드일"]);
  const exposureCol = findCol(header, ["상위노출"]);
  const urlCols = findPostUrlCols(header);
  const isInstagram = followerCol >= 0;

  const name = nameCol >= 0 ? String(r[nameCol] ?? "").trim() : "";
  if (!name) return null;
  const reach = isInstagram
    ? (r[followerCol] ? String(r[followerCol]).trim() : "")
    : (visitorCol >= 0 && r[visitorCol] ? `${String(r[visitorCol]).trim()}명` : "");
  const date = dateCol >= 0 ? String(r[dateCol] ?? "").trim() : "";
  const urls = urlCols.map((i) => r[i]).filter((v) => String(v ?? "").trim() !== "");
  const exposure = exposureCol >= 0 ? String(r[exposureCol] ?? "").trim() : "";
  if (!reach && !date && urls.length === 0 && !exposure) return null;
  return [name, isInstagram ? "인스타그램" : "블로그", date || "-", reach || "-", urls.length ? urls.join(" / ") : "-", exposure || "-"];
}

function parseSection(rows, headerIndex, nextHeaderIndex) {
  const header = rows[headerIndex] || [];
  const body = rows.slice(headerIndex + 1, nextHeaderIndex).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  return body.map((r) => buildRow(header, r)).filter(Boolean);
}

/** 통합 시트(호텔ID 열 있음): 호텔명 + 보고월로 행을 걸러서 하나의 표로 만든다 */
function parseUnifiedSheet(rows, headerIndex, context) {
  const header = rows[headerIndex];
  const campaignCol = findCol(header, ["캠페인ID"]);
  const hotelCol = findCol(header, ["호텔ID"]);
  const body = rows.slice(headerIndex + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const targetHotel = normalizeHotel(context?.hotelName);
  const targetYYMM = toYYMM(context?.month);

  const filtered = body.filter((r) => {
    if (targetHotel && hotelCol >= 0) {
      const hotelVal = normalizeHotel(r[hotelCol]);
      if (!hotelVal || (!hotelVal.includes(targetHotel) && !targetHotel.includes(hotelVal))) return false;
    }
    if (targetYYMM && campaignCol >= 0) {
      const campaignVal = String(r[campaignCol] ?? "").trim();
      const m = campaignVal.match(/(\d{4})\s*$/);
      if (m && m[1] !== targetYYMM) return false;
      // 캠페인ID에 4자리 월 코드가 아예 없는 행은 걸러내지 않고 남겨둔다(형식이 다를 수 있어 안전하게 처리)
    }
    return true;
  });

  return filtered.map((r) => buildRow(header, r)).filter(Boolean);
}

export function parseBlogExperience(rows, context) {
  const table = [["이름", "채널", "방문일", "방문자수·팔로워", "포스팅 URL", "상위노출 키워드"]];

  const unifiedHeaderIndex = findUnifiedHeaderIndex(rows);
  if (unifiedHeaderIndex !== -1) {
    const unifiedRows = parseUnifiedSheet(rows, unifiedHeaderIndex, context);
    table.push(...unifiedRows);
    const note =
      !context?.hotelName || !context?.month
        ? " (호텔명·보고월 정보가 없어 전체 행이 표시됐을 수 있습니다 — 확인해 주세요)"
        : "";
    return {
      kpis: { teamCount: `${table.length - 1}팀` },
      tables: { roster: table },
      _note: unifiedRows.length === 0 ? `"${context?.hotelName || "-"}" / "${context?.month || "-"}"에 해당하는 행을 찾지 못했습니다.${note}` : undefined,
    };
  }

  // ---- 기존 방식: 호텔별 개별 시트, "성함" 섹션이 여러 개 세로로 쌓인 구조 ----
  const headerIndexes = [];
  rows.forEach((row, i) => {
    if (row.some((c) => { const s = String(c).trim(); return s === "성함" || s === "이름"; })) headerIndexes.push(i);
  });
  if (headerIndexes.length === 0) {
    return { kpis: { teamCount: "0팀" }, tables: { roster: table } };
  }
  headerIndexes.forEach((headerIndex, i) => {
    const nextHeaderIndex = headerIndexes[i + 1] ?? rows.length;
    table.push(...parseSection(rows, headerIndex, nextHeaderIndex));
  });

  return {
    kpis: { teamCount: `${table.length - 1}팀` },
    tables: { roster: table },
  };
}

