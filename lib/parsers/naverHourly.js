import { num, fmt, pct, won } from "./utils";

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}시~${String((i + 1) % 24).padStart(2, "0")}시`);

// 실제 검증된 형식: "캠페인유형,캠페인,시간대별,노출수,클릭수,클릭률(%),평균 CPC,총비용"
// 캠페인 열 값 예: "2. PC", "1. MO" (매체 구분이 이 열에 들어있음) / 시간대별 예: "00시~01시"
export function parseNaverHourly(rows) {
  const dataRows = rows.filter((r) => r.length >= 8 && /PC|MO/i.test(String(r[1])));

  function buildTable() {
    const byHour = {};
    dataRows.forEach((r) => {
      const hour = r[2];
      const current = byHour[hour] || { impr: 0, clicks: 0, cost: 0 };
      current.impr += num(r[3]);
      current.clicks += num(r[4]);
      current.cost += num(r[7]);
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
      searchHourly: buildTable(),
    },
  };
}
