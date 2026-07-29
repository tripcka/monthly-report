import { num, fmt, findCol, splitHeaderBody } from "./utils";

// 제안하는 시트 구조: "계정 인사이트" 탭
// 열: 날짜, 팔로워, 조회수, 반응, 프로필활동, 도달한계정, 참여계정
// (매일/매주 한 행씩 쌓아가는 로그 형태. 이 중 "가장 최근 날짜" 행을 이번 달 KPI로 사용)
export function parseInstagramAccount(rows) {
  const { header, body } = splitHeaderBody(rows);
  const dateCol = findCol(header, ["날짜"]);
  const followersCol = findCol(header, ["팔로워"]);
  const viewsCol = findCol(header, ["조회수"]);
  const reactionsCol = findCol(header, ["반응"]);
  const profileCol = findCol(header, ["프로필활동", "프로필 활동"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));
  if (dataRows.length === 0) return { kpis: {}, tables: {} };

  // 날짜 열이 있으면 그 기준으로 정렬해서 가장 최근 행을 사용, 없으면 마지막 행을 사용
  let latest = dataRows[dataRows.length - 1];
  if (dateCol >= 0) {
    const sorted = [...dataRows].sort((a, b) => new Date(a[dateCol]) - new Date(b[dateCol]));
    latest = sorted[sorted.length - 1];
  }

  const kpis = {};
  if (followersCol >= 0) kpis.followers = fmt(num(latest[followersCol]));
  if (viewsCol >= 0) kpis.views30d = fmt(num(latest[viewsCol]));
  if (reactionsCol >= 0) kpis.reactions30d = fmt(num(latest[reactionsCol]));
  if (profileCol >= 0) kpis.profileActivity30d = fmt(num(latest[profileCol]));

  return { kpis, tables: {} };
}
