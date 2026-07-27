import { num, fmt, pct, won, splitHeaderBody, findCol } from "./utils";

/**
 * 정확한 포맷을 모르는 채널(네이버 디스플레이/파워컨텐츠, 브랜드블로그, 카페바이럴, 구글광고 등)에 쓰는
 * 범용 파서. 헤더에서 노출/클릭/비용 등 흔한 열 이름을 찾아 KPI를 자동 계산하고,
 * 원본 표는 그대로 보여준다. 채널 전용 파서가 생기면 이 파서 대신 그걸 쓰면 된다.
 */
export function parseGeneric(rows) {
  const { header, body } = splitHeaderBody(rows);
  const imprCol = findCol(header, ["노출수", "노출", "impression"]);
  const clickCol = findCol(header, ["클릭수", "클릭", "click"]);
  const costCol = findCol(header, ["총비용", "광고비", "비용", "cost"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const kpis = {};
  if (imprCol >= 0) kpis.impressions = fmt(dataRows.reduce((s, r) => s + num(r[imprCol]), 0));
  if (clickCol >= 0) kpis.clicks = fmt(dataRows.reduce((s, r) => s + num(r[clickCol]), 0));
  if (costCol >= 0) kpis.cost = won(dataRows.reduce((s, r) => s + num(r[costCol]), 0));

  // 원본 표 그대로 (헤더 + 데이터) 반환 — 특정 채널 표 키에 맞춰 호출부에서 지정
  const passthroughTable = [header, ...dataRows];

  return { kpis, tables: { _raw: passthroughTable } };
}
