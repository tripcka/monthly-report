import { num, fmt, findCol, splitHeaderBody } from "./utils";

// 제안하는 시트 구조: "게시물_릴스 인사이트" 탭
// 열: 업로드일, 유형(게시물/릴스), 주제, 조회수, 도달수, 좋아요, 댓글, 저장, 공유, 프로필방문
export function parseInstagramPosts(rows) {
  const { header, body } = splitHeaderBody(rows);
  const dateCol = findCol(header, ["업로드일"]);
  const typeCol = findCol(header, ["유형"]);
  const topicCol = findCol(header, ["주제"]);
  const viewsCol = findCol(header, ["조회수"]);
  const reachCol = findCol(header, ["도달수", "도달"]);
  const likesCol = findCol(header, ["좋아요"]);
  const commentsCol = findCol(header, ["댓글"]);
  const savesCol = findCol(header, ["저장"]);
  const sharesCol = findCol(header, ["공유"]);
  const profileCol = findCol(header, ["프로필방문", "프로필 방문"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const table = [["업로드일", "유형", "주제", "조회수", "도달수", "좋아요", "댓글", "저장", "공유", "프로필방문"]];
  dataRows.forEach((r) => {
    table.push([
      dateCol >= 0 ? r[dateCol] : "-",
      typeCol >= 0 ? r[typeCol] : "-",
      topicCol >= 0 ? r[topicCol] : "-",
      viewsCol >= 0 ? fmt(num(r[viewsCol])) : "-",
      reachCol >= 0 ? fmt(num(r[reachCol])) : "-",
      likesCol >= 0 ? fmt(num(r[likesCol])) : "-",
      commentsCol >= 0 ? fmt(num(r[commentsCol])) : "-",
      savesCol >= 0 ? fmt(num(r[savesCol])) : "-",
      sharesCol >= 0 ? fmt(num(r[sharesCol])) : "-",
      profileCol >= 0 ? fmt(num(r[profileCol])) : "-",
    ]);
  });

  return { kpis: {}, tables: { posts: table } };
}
