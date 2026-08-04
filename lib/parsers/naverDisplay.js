import { num, fmt, pct, won, findCol } from "./utils";

// 네이버 디스플레이광고 보고서는 CSV 확장자여도 UTF-16 + 탭 구분으로
// 내려올 수 있다. 업로더에서 인코딩/구분자를 처리한 뒤 이 파서에는 행 배열이 전달된다.
const CORE_COLUMNS = [
  "ON/OFF", "캠페인ID", "캠페인이름", "캠페인", "상태", "보조상태", "캠페인예산",
  "비용", "총비용", "광고비", "노출수", "평균CPM", "클릭수", "평균CPC", "클릭률", "클릭률(%)",
];

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
  const cpmCol = findCol(header, ["평균CPM"]);

  const totalImpressions = impressionCol >= 0 ? body.reduce((sum, row) => sum + num(row[impressionCol]), 0) : 0;
  const totalClicks = clickCol >= 0 ? body.reduce((sum, row) => sum + num(row[clickCol]), 0) : 0;
  const totalCost = costCol >= 0 ? body.reduce((sum, row) => sum + num(row[costCol]), 0) : 0;

  // 발송/재생 지표처럼 전체가 0인 선택 열은 보고서에서 제외한다.
  const optionalColumns = header
    .map((_, index) => index)
    .filter((index) => !CORE_COLUMNS.includes(normalizedHeader[index]) && hasAnyValue(body, index));

  const tableHeader = ["캠페인 이름", "비용", "노출수"];
  if (cpmCol >= 0) tableHeader.push("평균 CPM");
  tableHeader.push("클릭수", "클릭률", "평균 CPC");
  optionalColumns.forEach((index) => tableHeader.push(header[index]));

  const tableBody = body.map((row) => {
    const impressions = impressionCol >= 0 ? num(row[impressionCol]) : 0;
    const clicks = clickCol >= 0 ? num(row[clickCol]) : 0;
    const cost = costCol >= 0 ? num(row[costCol]) : 0;
    const output = [
      campaignCol >= 0 ? String(row[campaignCol] || "-").trim() : "-",
      won(cost),
      fmt(impressions),
    ];
    // 새 네이버 엑셀 형식의 평균 CPM을 그대로 쓰지 않고 합계값에서 다시 계산해
    // 원본의 반올림 여부와 관계없이 보고서 지표를 일관되게 표시한다.
    if (cpmCol >= 0) output.push(impressions > 0 ? won((cost / impressions) * 1000) : "-");
    output.push(
      fmt(clicks),
      impressions > 0 ? pct((clicks / impressions) * 100) : "0.00%",
      clicks > 0 ? won(cost / clicks) : "-",
    );
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
