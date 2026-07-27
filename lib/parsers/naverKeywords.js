import { num, fmt, pct, won } from "./utils";

// 실제 검증된 형식: "PC/모바일 매체,키워드,노출수,클릭수,클릭률(%),평균 CPC,총비용"
// 데이터 행 예: "PC,삼척숙소,6516,10,0.15,839,8389" / "모바일,낙산사숙소,2262,15,..."
export function parseNaverKeywords(rows) {
  // 집계(총 노출/클릭/비용)에는 "-"(기타) 행도 포함, TOP20 순위에서만 "-" 제외
  const allRows = rows.filter((r) => r.length >= 7 && (r[0] === "PC" || r[0] === "모바일"));
  const rankableRows = allRows.filter((r) => r[1] && r[1] !== "-");

  function aggregate(media) {
    const filtered = allRows.filter((r) => r[0] === media);
    const impr = filtered.reduce((s, r) => s + num(r[2]), 0);
    const clicks = filtered.reduce((s, r) => s + num(r[3]), 0);
    const cost = filtered.reduce((s, r) => s + num(r[6]), 0);
    const ctr = impr ? (clicks / impr) * 100 : 0;
    const cpc = clicks ? cost / clicks : 0;
    return { impr, clicks, cost, ctr, cpc };
  }

  function top20Table(media) {
    const filtered = rankableRows.filter((r) => r[0] === media);
    const sorted = [...filtered].sort((a, b) => num(b[3]) - num(a[3]) || num(b[2]) - num(a[2]));
    const top = sorted.slice(0, 20);
    const table = [["순위", "키워드", "노출", "클릭", "CPC"]];
    top.forEach((r, i) => table.push([i + 1, r[1], fmt(num(r[2])), String(num(r[3])), won(num(r[5]))]));
    return table;
  }

  const pc = aggregate("PC");
  const mo = aggregate("모바일");

  return {
    kpis: {
      impressions: fmt(pc.impr + mo.impr),
      clicks: fmt(pc.clicks + mo.clicks),
      ctr: pct(((pc.clicks + mo.clicks) / Math.max(pc.impr + mo.impr, 1)) * 100),
      cost: won(pc.cost + mo.cost),
    },
    tables: {
      pcSummary: [
        ["항목", "노출수", "클릭수", "CTR", "CPC", "광고비"],
        ["PC 당월 데이터", fmt(pc.impr), fmt(pc.clicks), pct(pc.ctr), won(pc.cpc), won(pc.cost)],
      ],
      keywordsPc: top20Table("PC"),
      moSummary: [
        ["항목", "노출수", "클릭수", "CTR", "CPC", "광고비"],
        ["MO 당월 데이터", fmt(mo.impr), fmt(mo.clicks), pct(mo.ctr), won(mo.cpc), won(mo.cost)],
      ],
      keywordsMo: top20Table("모바일"),
    },
  };
}
