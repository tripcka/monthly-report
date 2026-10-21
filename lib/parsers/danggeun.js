import { num, fmt, pct, won, findCol } from "./utils";

// 당근마켓 광고(비즈프로필) 캠페인 리포트 CSV/엑셀.
// 보통 아래 헤더로 내려온다 (공백 유무는 섞여 있을 수 있어 findCol이 공백을 지우고 비교함):
// 기간, 캠페인 이름, 광고그룹 이름, 비용 (VAT 포함), 노출 수, 도달 수, 클릭 수, 클릭률, 클릭당 비용(CPC), 노출당 비용(CPM)
// 클릭률은 "1.23" 처럼 % 기호 없는 숫자로, CPC/CPM은 원 단위 숫자로 내려온다.
export function parseDanggeun(rows) {
  const header = (rows[0] || []).map((cell) => String(cell).replace(/^﻿/, "").trim());
  const body = rows
    .slice(1)
    .filter((row) => row.length > 1 && row.some((cell) => String(cell ?? "").trim() !== ""));

  const campaignCol = findCol(header, ["캠페인이름", "캠페인"]);
  const groupCol = findCol(header, ["광고그룹이름", "광고그룹"]);
  const costCol = findCol(header, ["비용(VAT포함)", "비용", "총비용"]);
  const imprCol = findCol(header, ["노출수", "노출"]);
  const reachCol = findCol(header, ["도달수", "도달"]);
  const clickCol = findCol(header, ["클릭수", "클릭"]);

  const totalCost = costCol >= 0 ? body.reduce((s, r) => s + num(r[costCol]), 0) : 0;
  const totalImpr = imprCol >= 0 ? body.reduce((s, r) => s + num(r[imprCol]), 0) : 0;
  const totalReach = reachCol >= 0 ? body.reduce((s, r) => s + num(r[reachCol]), 0) : 0;
  const totalClicks = clickCol >= 0 ? body.reduce((s, r) => s + num(r[clickCol]), 0) : 0;

  const table = [["캠페인", "광고그룹", "노출수", "도달수", "클릭수", "클릭률", "CPC", "광고비"]];
  body.forEach((r) => {
    const impr = imprCol >= 0 ? num(r[imprCol]) : 0;
    const reach = reachCol >= 0 ? num(r[reachCol]) : 0;
    const clicks = clickCol >= 0 ? num(r[clickCol]) : 0;
    const cost = costCol >= 0 ? num(r[costCol]) : 0;
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    table.push([
      campaignCol >= 0 ? String(r[campaignCol] || "-").trim() : "-",
      groupCol >= 0 ? String(r[groupCol] || "-").trim() : "-",
      fmt(impr),
      fmt(reach),
      fmt(clicks),
      pct(ctr),
      won(cpc),
      won(cost),
    ]);
  });

  return {
    kpis: {
      impressions: fmt(totalImpr),
      reach: fmt(totalReach),
      clicks: fmt(totalClicks),
      ctr: totalImpr > 0 ? pct((totalClicks / totalImpr) * 100) : "0.00%",
      cpc: totalClicks > 0 ? won(totalCost / totalClicks) : "-",
      cost: won(totalCost),
    },
    tables: { campaigns: table },
  };
}
