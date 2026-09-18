import { num, fmt, pct, won, findCol } from "./utils";

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}시~${String((i + 1) % 24).padStart(2, "0")}시`);

function emptyTable() {
  const table = [["시간대", "노출수", "클릭수", "CTR", "CPC", "광고비"]];
  for (const h of HOURS) table.push([h, "-", "-", "-", "-", "-"]);
  return table;
}

// 네이버 검색광고 시간대별 리포트는 다운로드 시점/화면에 따라 열 순서가 다르게 나올 수 있다.
// A) "캠페인유형,캠페인,시간대별,노출수,클릭수,클릭률(%),평균 CPC,총비용" (캠페인 열에 "1. MO"/"2. PC")
// B) "시간대별,캠페인,노출수,클릭수,클릭률(%),평균 CPC,총비용" (시간대가 먼저, 캠페인 열에 "MO(N)"/"PC(N)")
// 열 순서·개수가 달라도 항상 맞게 읽히도록, 고정된 인덱스 대신 헤더 이름으로 각 열의 위치를 찾는다.
export function parseNaverHourly(rows) {
  let headerIndex = -1;
  let timeIdx = -1;
  let mediaIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const t = findCol(row, ["시간대별", "시간대"]);
    const impr = findCol(row, ["노출수"]);
    if (t !== -1 && impr !== -1) {
      headerIndex = i;
      timeIdx = t;
      mediaIdx = findCol(row, ["캠페인", "매체"]);
      break;
    }
  }
  if (headerIndex === -1 || mediaIdx === -1) {
    return { kpis: {}, tables: { hourlyMo: emptyTable(), hourlyPc: emptyTable() } };
  }

  const header = rows[headerIndex];
  const imprIdx = findCol(header, ["노출수"]);
  const clickIdx = findCol(header, ["클릭수"]);
  const costIdx = findCol(header, ["총비용"]);
  const minCols = Math.max(timeIdx, mediaIdx, imprIdx, clickIdx, costIdx) + 1;

  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((r) => r.length >= minCols && /PC|MO/i.test(String(r[mediaIdx])));

  function buildTable(mediaKeyword) {
    const filtered = dataRows.filter((r) => String(r[mediaIdx]).toUpperCase().includes(mediaKeyword));
    const byHour = {};
    filtered.forEach((r) => {
      const hour = String(r[timeIdx]).trim();
      const current = byHour[hour] || { impr: 0, clicks: 0, cost: 0 };
      current.impr += num(r[imprIdx]);
      current.clicks += num(r[clickIdx]);
      current.cost += num(r[costIdx]);
      byHour[hour] = current;
    });
    const table = [["시간대", "노출수", "클릭수", "CTR", "CPC", "광고비"]];
    for (const h of HOURS) {
      const item = byHour[h];
      if (item) {
        const ctr = item.impr ? (item.clicks / item.impr) * 100 : 0;
        const cpc = item.clicks ? item.cost / item.clicks : 0;
        table.push([h, fmt(item.impr), String(item.clicks), pct(ctr), won(cpc), won(item.cost)]);
      } else {
        table.push([h, "-", "-", "-", "-", "-"]);
      }
    }
    return table;
  }

  return {
    kpis: {},
    tables: {
      hourlyMo: buildTable("MO"),
      hourlyPc: buildTable("PC"),
    },
  };
}
