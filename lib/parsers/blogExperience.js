import { findCol } from "./utils";

// 트리피카 체험단 관리 시트는 업체마다 컬럼 구성이 다르고, 한 탭 안에도
// "[블로그] 객실 체험단 3팀" / "[블로그] 식음 체험단 4팀" / "[인스타그램] 2팀" 처럼
// 성격이 다른 섹션이 여러 개 세로로 쌓여있는 경우가 많다. 섹션마다 "성함" 헤더가
// 다시 나오고 컬럼 의미도 달라서, "성함"이 나오는 모든 위치를 각각 새 섹션으로 보고
// 섹션별로 컬럼을 다시 찾아 하나의 표로 합친다.

function findAllHeaderRowIndexes(rows) {
  const indexes = [];
  rows.forEach((row, i) => {
    if (row.some((c) => { const s = String(c).trim(); return s === "성함" || s === "이름"; })) {
      indexes.push(i);
    }
  });
  return indexes;
}

// "포스팅 URL" / "업로드 URL" / "영수증 리뷰 URL"처럼 실제 게시물 링크만 모으고,
// "블로그URL" / "인스타URL"처럼 그 사람의 프로필 링크는 제외한다.
function findPostUrlCols(header) {
  return header
    .map((h, i) => ({ stripped: String(h).replace(/\s/g, ""), i }))
    .filter(({ stripped }) => /url/i.test(stripped) && /(포스팅|업로드|리뷰)/.test(stripped))
    .map(({ i }) => i);
}

function parseSection(rows, headerIndex, nextHeaderIndex) {
  const header = rows[headerIndex] || [];
  const body = rows.slice(headerIndex + 1, nextHeaderIndex).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const nameCol = findCol(header, ["성함", "이름"]);
  const followerCol = findCol(header, ["팔로워"]);
  const visitorCol = findCol(header, ["일방문자"]);
  const dateCol = findCol(header, ["방문일", "업로드일"]);
  const exposureCol = findCol(header, ["상위노출"]);
  const urlCols = findPostUrlCols(header);
  const isInstagram = followerCol >= 0;

  const sectionRows = [];
  for (const r of body) {
    const name = nameCol >= 0 ? String(r[nameCol] ?? "").trim() : "";
    if (!name) continue;
    const reach = isInstagram
      ? (r[followerCol] ? String(r[followerCol]).trim() : "")
      : (visitorCol >= 0 && r[visitorCol] ? `${String(r[visitorCol]).trim()}명` : "");
    const date = dateCol >= 0 ? String(r[dateCol] ?? "").trim() : "";
    const urls = urlCols.map((i) => r[i]).filter((v) => String(v ?? "").trim() !== "");
    const exposure = exposureCol >= 0 ? String(r[exposureCol] ?? "").trim() : "";
    // 섹션 제목 줄("[블로그] 식음 체험단 4팀" 등)이 병합 셀 때문에 이름 칸에 걸리는 경우가
    // 있는데, 그런 줄은 다른 항목이 전부 비어있으므로 최소 하나는 더 채워진 행만 데이터로 인정
    if (!reach && !date && urls.length === 0 && !exposure) continue;
    sectionRows.push([
      name,
      isInstagram ? "인스타그램" : "블로그",
      date || "-",
      reach || "-",
      urls.length ? urls.join(" / ") : "-",
      exposure || "-",
    ]);
  }
  return sectionRows;
}

export function parseBlogExperience(rows) {
  const headerIndexes = findAllHeaderRowIndexes(rows);
  const table = [["이름", "채널", "방문일", "방문자수·팔로워", "포스팅 URL", "상위노출 키워드"]];

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
