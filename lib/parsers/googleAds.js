import { num, fmt, pct, won, findCol } from "./utils";

// 실제 검증된 구글 광고 "캠페인 보고서" 내보내기 형식.
// 파일 구조: 제목행 / 기간행 / 헤더행 / 캠페인별 상세행... / "전체: 캠페인" / "전체: 계정" / "전체: {유형}"...
// 요청사항: 개별 캠페인행은 빼고, 맨 아래 "전체: {유형}"(검색/디스플레이/스마트 등) 행만 사용.
//          이름은 "전체: " 접두어를 떼고 유형명만("디스플레이","스마트") 표시.
//          표 열은 노출수/클릭수/CTR/CPC/광고비 5개만.
export function parseGoogleAds(rows) {
  // 헤더 행 찾기: "캠페인"과 "노출수"가 같이 있는 행
  const headerIndex = rows.findIndex(
    (r) => r.some((c) => String(c).trim() === "캠페인") && r.some((c) => String(c).replace(/\s/g, "") === "노출수")
  );
  const header = headerIndex >= 0 ? rows[headerIndex] : rows[0];
  const body = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 1);

  const nameCol = findCol(header, ["캠페인"]);
  const imprCol = findCol(header, ["노출수"]);
  const clickCol = findCol(header, ["클릭수"]);
  const ctrCol = findCol(header, ["클릭률(CTR)", "클릭률"]);
  const cpcCol = findCol(header, ["평균CPC", "평균 CPC"]);
  const costCol = findCol(header, ["비용"]);

  // "전체: {유형}" 행만 추림 — 이 라벨은 캠페인명 열이 아니라 첫 번째 열(평소엔 "캠페인 상태"가
  // 들어가는 자리)에 나온다. "전체: 캠페인"/"전체: 계정"(합계 행)은 제외하고 유형별 합계만 남긴다.
  // 광고비가 0원인 유형(운영 안 하는 캠페인 유형)도 제외.
  const totalRows = body.filter((r) => {
    const label = String(r[0] || "").trim();
    if (!label.startsWith("전체:") || label.includes("캠페인") || label.includes("계정")) return false;
    if (costCol >= 0 && num(r[costCol]) === 0) return false;
    return true;
  });

  const table = [["유형", "노출수", "클릭수", "CTR", "CPC", "광고비"]];
  totalRows.forEach((r) => {
    const label = String(r[0]).replace("전체:", "").trim();
    table.push([
      label,
      imprCol >= 0 ? fmt(num(r[imprCol])) : "-",
      clickCol >= 0 ? fmt(num(r[clickCol])) : "-",
      ctrCol >= 0 ? pct(num(r[ctrCol])) : "-",
      cpcCol >= 0 ? won(num(r[cpcCol])) : "-",
      costCol >= 0 ? won(num(r[costCol])) : "-",
    ]);
  });

  // KPI 카드용 전체 합계는 "전체: 캠페인" 행(계정 전체 합계)에서 그대로 가져온다.
  const grandTotalRow = body.find((r) => String(r[0] || "").trim() === "전체: 캠페인");

  const kpis = {};
  if (grandTotalRow) {
    if (imprCol >= 0) kpis.impressions = fmt(num(grandTotalRow[imprCol]));
    if (clickCol >= 0) kpis.clicks = fmt(num(grandTotalRow[clickCol]));
    if (costCol >= 0) kpis.cost = won(num(grandTotalRow[costCol]));
  }

  return {
    kpis,
    tables: { monthlyCompare: table },
  };
}
