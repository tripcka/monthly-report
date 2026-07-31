import { num, fmt, pct, won, findCol } from "./utils";

// 네이버 플레이스광고 "캠페인 보고서" CSV는 진짜 헤더 위에
// `캠페인 보고서(2026.07.01.~2026.07.30.)` 같은 제목 행이 하나 더 있어서,
// "캠페인"과 "노출수"가 같이 들어있는 행을 진짜 헤더로 찾는다.
function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const stripped = (rows[i] || []).map((c) => String(c).replace(/\s/g, ""));
    if (stripped.includes("캠페인") && stripped.some((c) => c.includes("노출수"))) return i;
  }
  return 0; // 못 찾으면 안전하게 첫 행 사용
}

// 항상 남기는 열(라벨 + 핵심 지표). 전환/매출 관련 열들은 실제 값이 있을 때만 남긴다
// ("결과값 있는 항목만" 요청 반영 — 전부 0이면 보고서에서 자동으로 빠짐).
const ALWAYS_KEEP = ["캠페인", "PC/모바일매체", "노출수", "클릭수", "클릭률(%)", "평균CPC", "총비용"];

function hasAnyResult(rows, col) {
  return rows.some((r) => {
    const v = String(r[col] ?? "").trim();
    return v !== "" && v !== "0" && v !== "0.0" && v !== "0.00";
  });
}

export function parseNaverPlace(rows) {
  const headerIndex = findHeaderRowIndex(rows);
  const header = rows[headerIndex] || [];
  const body = rows.slice(headerIndex + 1).filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));
  const strippedHeader = header.map((h) => String(h).replace(/\s/g, ""));

  const keepCol = header.map((_, i) => ALWAYS_KEEP.includes(strippedHeader[i]) || hasAnyResult(body, i));
  const filteredHeader = header.filter((_, i) => keepCol[i]);
  const table = [filteredHeader, ...body.map((r) => r.filter((_, i) => keepCol[i]))];

  const imprCol = findCol(header, ["노출수"]);
  const clickCol = findCol(header, ["클릭수"]);
  const costCol = findCol(header, ["총비용", "비용"]);

  const totalImpr = imprCol >= 0 ? body.reduce((s, r) => s + num(r[imprCol]), 0) : 0;
  const totalClick = clickCol >= 0 ? body.reduce((s, r) => s + num(r[clickCol]), 0) : 0;
  const totalCost = costCol >= 0 ? body.reduce((s, r) => s + num(r[costCol]), 0) : 0;

  const kpis = {};
  if (imprCol >= 0) kpis.impressions = fmt(totalImpr);
  if (clickCol >= 0) kpis.clicks = fmt(totalClick);
  if (imprCol >= 0 && clickCol >= 0) kpis.ctr = totalImpr > 0 ? pct((totalClick / totalImpr) * 100) : "0.00%";
  if (clickCol >= 0 && costCol >= 0) kpis.cpc = totalClick > 0 ? won(totalCost / totalClick) : "-";
  if (costCol >= 0) kpis.cost = won(totalCost);

  return { kpis, tables: { campaigns: table } };
}
