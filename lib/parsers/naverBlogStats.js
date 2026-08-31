import { parseYearMonth } from "../monthUtil";

// 네이버 블로그 "내 블로그 통계 > 방문 횟수" 페이지를 드래그해서 그대로 붙여넣으면 나오는
// 텍스트에서 "기간\t방문 횟수" 형태의 행만 뽑아, 보고 월에 해당하는 주(週)만 걸러낸다.
// "해당 월"의 기준은 주(7일)의 마지막 날짜가 보고 월에 속하는지로 판단한다.
// 예: 보고월 7월 → "06.29. ~ 07.05."(마지막날 7/5) 포함, "07.27. ~ 08.02."(마지막날 8/2) 제외.
export function parseNaverVisitCounts(text, context) {
  const { month } = parseYearMonth(context?.month) || {};
  const targetMonth = month ? String(month).padStart(2, "0") : null;

  const rowRe = /(\d{2}\.\d{2}\.\s*~\s*\d{2}\.\d{2}\.)\s*[\t]\s*(\d+)/g;
  const seen = new Set();
  const allWeeks = [];
  let m;
  while ((m = rowRe.exec(text)) !== null) {
    const range = m[1].replace(/\s+/g, " ").trim();
    const count = Number(m[2]);
    if (seen.has(range)) continue; // 같은 주가 두 번 붙여넣기 되어도 한 번만
    seen.add(range);
    const endMonthMatch = range.match(/~\s*(\d{2})\.\d{2}\.$/);
    const endMonth = endMonthMatch ? endMonthMatch[1] : null;
    allWeeks.push({ range, count, endMonth });
  }

  const filtered = targetMonth ? allWeeks.filter((w) => w.endMonth === targetMonth) : allWeeks;
  const total = filtered.reduce((sum, w) => sum + w.count, 0);

  return {
    weeks: filtered.map((w) => [w.range, String(w.count)]),
    total,
    allWeeksFound: allWeeks.length,
  };
}

// "내 블로그 통계 > 유입분석 > 검색 유입" 페이지의 "유입경로" 목록(왼쪽 열)을 붙여넣으면,
// "키워드  27.78%" 같은 줄에서 키워드+비율을 순서대로 뽑아 순위를 매긴다.
// "검색 유입 27.69%"처럼 그 페이지 자체의 요약 수치는 키워드가 아니므로 제외한다.
const NOT_A_KEYWORD = new Set(["검색 유입", "사이트 유입", "전체", "기타"]);

export function parseNaverInflowKeywords(text, maxCount = 10) {
  const lineRe = /^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/;
  const results = [];
  const seen = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(lineRe);
    if (!match) continue;
    const keyword = match[1].trim();
    if (NOT_A_KEYWORD.has(keyword)) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    results.push(keyword);
    if (results.length >= maxCount) break;
  }
  return results;
}

/** parseNaverInflowKeywords 결과를 "순위/키워드/비고" 2단 표(1~5, 6~10)로 변환 */
export function buildInflowKeywordTable(keywords) {
  const left = [["순위", "키워드", "비고"]];
  const right = [["순위", "키워드", "비고"]];
  keywords.forEach((kw, i) => {
    const row = [i + 1, kw, ""];
    if (i < 5) left.push(row);
    else right.push(row);
  });
  while (left.length < 6) left.push([left.length, "", ""]);
  while (right.length < 6) right.push([right.length + 5, "", ""]);
  return { left, right };
}
