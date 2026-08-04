import { num, fmt, pct, won, findCol } from "./utils";

// 네이버 디스플레이광고 보고서는 CSV 확장자여도 UTF-16 + 탭 구분으로
// 내려올 수 있다. 업로더에서 인코딩/구분자를 처리한 뒤 이 파서에는 행 배열이 전달된다.
const CORE_COLUMNS = ["캠페인이름", "캠페인", "비용", "총비용", "광고비", "노출수", "클릭수", "클릭률", "클릭률(%)", "평균CPC"];

function findHeaderRowIndex(rows) {
  return Math.max(0, rows.findIndex((row) => {
    const cells = (row || []).map((cell) => String(cell).replace(/^\uFEFF/, "").replace(/\s/g, ""));
    return cells.includes("캠페인이름") && cells.includes("노출수") && cells.includes("클릭수");
  }));
}

function hasAnyValue(rows, col) {
  return rows.some((row) => num(row[col]) !== 0);
}

export function parseNaverDisplay(rows) {
  const headerIndex = findHeaderRowIndex(rows);
  const header = (rows[headerIndex] || []).map((cell) => String(cell).replace(/^\uFEFF/, "").trim());
  const body = rows
    .slice(headerIndex + 1)
    .filter((row) => row.length > 1 && row.some((cell) => String(cell ?? "").trim() !== ""));
  const normalizedHeader = header.map((cell) => cell.replace(/\s/g, ""));

  const impressionCol = findCol(header, ["노출수"]);
  const clickCol = findCol(header, ["클릭수"]);
  const costCol = findCol(header, ["비용", "총비용", "광고비"]);
  const campaignCol = findCol(header, ["캠페인이름", "캠페인"]);

  const totalImpressions = impressionCol >= 0 ? body.reduce((sum, row) => sum + num(row[impressionCol]), 0) : 0;
  const totalClicks = clickCol >= 0 ? body.reduce((sum, row) => sum + num(row[clickCol]), 0) : 0;
  const totalCost = costCol >= 0 ? body.reduce((sum, row) => sum + num(row[costCol]), 0) : 0;

  // 발송/재생 지표처럼 전체가 0인 선택 열은 보고서에서 제외한다.
  const optionalColumns = header
    .map((_, index) => index)
    .filter((index) => !CORE_COLUMNS.includes(normalizedHeader[index]) && hasAnyValue(body, index));

  const tableHeader = ["캠페인 이름", "비용", "노출수", "클릭수", "클릭률", "평균 CPC"];
  optionalColumns.forEach((index) => tableHeader.push(header[index]));

  const tableBody = body.map((row) => {
    const impressions = impressionCol >= 0 ? num(row[impressionCol]) : 0;
    const clicks = clickCol >= 0 ? num(row[clickCol]) : 0;
    const cost = costCol >= 0 ? num(row[costCol]) : 0;
    const output = [
      campaignCol >= 0 ? String(row[campaignCol] || "-").trim() : "-",
      won(cost),
      fmt(impressions),
      fmt(clicks),
      impressions > 0 ? pct((clicks / impressions) * 100) : "0.00%",
      clicks > 0 ? won(cost / clicks) : "-",
    ];
    optionalColumns.forEach((index) => output.push(String(row[index] ?? "-")));
    return output;
  });

  return {
    kpis: {
      impressions: fmt(totalImpressions),
      clicks: fmt(totalClicks),
      ctr: totalImpressions > 0 ? pct((totalClicks / totalImpressions) * 100) : "0.00%",
      cpc: totalClicks > 0 ? won(totalCost / totalClicks) : "-",
      cost: won(totalCost),
    },
    tables: { campaigns: [tableHeader, ...tableBody] },
  };
}
