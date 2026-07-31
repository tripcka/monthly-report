import { num, fmt, won, findCol, splitHeaderBody } from "./utils";

// Meta Ads Manager에서 내보낸 "광고" 단위 CSV를 읽어 필요한 5개 항목만 추출한다.
// (원본 CSV에는 결과당비용/입찰/품질순위 등 20개 안팎의 열이 있지만, 보고서에는
//  광고명/노출/도달/결과/지출금액만 사용)
//
// 주의: Meta 내보내기에서 날짜 열 이름이 "종료"로 되어 있어도 실제로는 그 광고(게시물)가
// 시작된 날짜가 들어있는 경우가 많다(내보내기 방식에 따라 달라짐). 이름만 보고 찾다가
// 실패하면, 값 자체가 전부 YYYY-MM-DD 형태이면서 행마다 값이 다른 첫 번째 열을 날짜로 추정한다.
function guessDateCol(header, dataRows) {
  const named = findCol(header, ["종료", "게재시작", "시작일", "날짜"]);
  if (named >= 0) {
    const vals = dataRows.map((r) => String(r[named] || "").trim());
    if (vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return named;
  }
  for (let c = 0; c < header.length; c++) {
    const vals = dataRows.map((r) => String(r[c] || "").trim());
    const allDates = vals.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v));
    const varies = new Set(vals).size > 1;
    if (allDates && varies) return c;
  }
  return -1;
}

export function parseInstagramAds(rows) {
  const { header, body } = splitHeaderBody(rows);
  const nameCol = findCol(header, ["광고이름", "광고명", "캠페인이름", "캠페인명"]);
  const impressionsCol = findCol(header, ["노출"]);
  const reachCol = findCol(header, ["도달"]);
  const resultCol = findCol(header, ["결과"]);
  const spendCol = findCol(header, ["지출금액", "지출액"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));
  const dateCol = guessDateCol(header, dataRows);

  let ads = dataRows.map((r) => ({
    date: dateCol >= 0 ? String(r[dateCol]).slice(0, 10) : "-",
    // 광고이름 원본은 보통 게시물 캡션 전체(여러 줄)라, 표에는 첫 줄만 사용
    name: nameCol >= 0 ? String(r[nameCol]).split("\n")[0].trim() : "-",
    impressions: impressionsCol >= 0 ? fmt(num(r[impressionsCol])) : "-",
    reach: reachCol >= 0 ? fmt(num(r[reachCol])) : "-",
    result: resultCol >= 0 ? fmt(num(r[resultCol])) : "-",
    spend: spendCol >= 0 ? won(num(r[spendCol])) : "-",
    _sortTs: dateCol >= 0 ? new Date(r[dateCol]).getTime() : NaN,
  }));

  // 오래된 순으로 왼쪽부터 배치 (날짜를 못 찾은 행이 하나라도 있으면 원본 순서를 그대로 둔다)
  if (ads.length > 0 && ads.every((a) => !isNaN(a._sortTs))) {
    ads = [...ads].sort((a, b) => a._sortTs - b._sortTs);
  }

  const header2 = ["날짜", ...ads.map((a) => a.date)];
  const row = (label, key) => [label, ...ads.map((a) => a[key])];

  const table = [header2, row("광고명", "name"), row("노출", "impressions"), row("도달", "reach"), row("결과", "result"), row("지출금액", "spend")];

  return { kpis: {}, tables: { ads: table } };
}
