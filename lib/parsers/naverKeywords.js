import { num, fmt, pct, won } from "./utils";

// 실제 검증된 형식: "PC/모바일 매체,키워드,노출수,클릭수,클릭률(%),평균 CPC,총비용"
// 데이터 행 예: "PC,삼척숙소,6516,10,0.15,839,8389" / "모바일,낙산사숙소,2262,15,..."
export function parseNaverKeywords(rows) {
  // 집계(총 노출/클릭/비용)에는 "-"(기타) 행도 포함, TOP20 순위에서만 "-" 제외
  const allRows = rows.filter((r) => r.length >= 7 && (r[0] === "PC" || r[0] === "모바일"));
  const rankableRows = allRows.filter((r) => r[1] && r[1] !== "-");

  function aggregate(filtered) {
    const impr = filtered.reduce((s, r) => s + num(r[2]), 0);
    const clicks = filtered.reduce((s, r) => s + num(r[3]), 0);
    const cost = filtered.reduce((s, r) => s + num(r[6]), 0);
    const ctr = impr ? (clicks / impr) * 100 : 0;
    const cpc = clicks ? cost / clicks : 0;
    return { impr, clicks, cost, ctr, cpc };
  }

  function top20Table(filtered) {
    const byKeyword = new Map();
    filtered.forEach((r) => {
      const keyword = String(r[1]).trim();
      const current = byKeyword.get(keyword) || { keyword, impr: 0, clicks: 0, cost: 0 };
      current.impr += num(r[2]);
      current.clicks += num(r[3]);
      current.cost += num(r[6]);
      byKeyword.set(keyword, current);
    });
    const top = [...byKeyword.values()]
      .sort((a, b) => b.clicks - a.clicks || b.impr - a.impr)
      .slice(0, 20);
    const table = [["순위", "키워드", "노출", "클릭", "CPC"]];
    top.forEach((r, i) => table.push([
      i + 1,
      r.keyword,
      fmt(r.impr),
      String(r.clicks),
      won(r.clicks ? r.cost / r.clicks : 0),
    ]));
    return table;
  }

  const total = aggregate(allRows);
  const pcRows = allRows.filter((r) => r[0] === "PC");
  const moRows = allRows.filter((r) => r[0] === "모바일");
  const pcRankableRows = rankableRows.filter((r) => r[0] === "PC");
  const moRankableRows = rankableRows.filter((r) => r[0] === "모바일");
  const pc = aggregate(pcRows);
  const mo = aggregate(moRows);

  function summaryTable(label, values) {
    return [
      ["항목", "노출수", "클릭수", "CTR", "CPC", "광고비"],
      [label, fmt(values.impr), fmt(values.clicks), pct(values.ctr), won(values.cpc), won(values.cost)],
    ];
  }

  return {
    kpis: {
      impressions: fmt(total.impr),
      clicks: fmt(total.clicks),
      ctr: pct(total.ctr),
      cpc: won(total.cpc),
      cost: won(total.cost),
    },
    tables: {
      moSummary: summaryTable("MO 당월 데이터", mo),
      keywordsMo: top20Table(moRankableRows),
      pcSummary: summaryTable("PC 당월 데이터", pc),
      keywordsPc: top20Table(pcRankableRows),
    },
  };
}
