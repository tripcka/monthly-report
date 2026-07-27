import { num, fmt, pct, won, splitHeaderBody, findCol } from "./utils";

export function parseKakao(rows) {
  const { header, body } = splitHeaderBody(rows);
  const nameCol = findCol(header, ["캠페인", "이름"]);
  const imprCol = findCol(header, ["노출수", "노출"]);
  const clickCol = findCol(header, ["클릭수", "클릭"]);
  const costCol = findCol(header, ["총비용", "비용"]);
  const ctrCol = findCol(header, ["CTR", "클릭률"]);
  const cpcCol = findCol(header, ["CPC", "클릭비용"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const totalImpr = imprCol >= 0 ? dataRows.reduce((s, r) => s + num(r[imprCol]), 0) : 0;
  const totalClicks = clickCol >= 0 ? dataRows.reduce((s, r) => s + num(r[clickCol]), 0) : 0;
  const totalCost = costCol >= 0 ? dataRows.reduce((s, r) => s + num(r[costCol]), 0) : 0;

  // 원본 표는 그대로 보여주되, 열이 인식됐으면 표준 순서로 재구성
  const table = [["캠페인", "노출수", "클릭수", "CTR", "CPC", "광고비"]];
  dataRows.forEach((r) => {
    const impr = imprCol >= 0 ? num(r[imprCol]) : 0;
    const clicks = clickCol >= 0 ? num(r[clickCol]) : 0;
    const cost = costCol >= 0 ? num(r[costCol]) : 0;
    const ctr = ctrCol >= 0 ? num(r[ctrCol]) : impr ? (clicks / impr) * 100 : 0;
    const cpc = cpcCol >= 0 ? num(r[cpcCol]) : clicks ? cost / clicks : 0;
    table.push([
      nameCol >= 0 ? r[nameCol] : "-",
      fmt(impr),
      String(clicks),
      pct(ctr),
      won(cpc),
      won(cost),
    ]);
  });

  return {
    kpis: {
      impressions: fmt(totalImpr),
      clicks: fmt(totalClicks),
      cost: won(totalCost),
    },
    tables: {
      campaigns: table,
    },
  };
}
