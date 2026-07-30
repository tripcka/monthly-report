import { num, fmt, findCol, splitHeaderBody } from "./utils";
import { buildInstagramPostsTable } from "../postsTable";

// 제안하는 시트 구조: "게시물_릴스 인사이트" 탭
// 열: 업로드일, 유형(게시물/릴스), 주제, 조회수, 도달수, 좋아요, 댓글, 저장, 공유, 프로필방문
// (선택) 광고진행여부, 광고비 열이 있으면 함께 읽어온다. 없으면 "-"로 표시.
export function parseInstagramPosts(rows) {
  const { header, body } = splitHeaderBody(rows);
  const dateCol = findCol(header, ["업로드일"]);
  const topicCol = findCol(header, ["주제"]);
  const adCol = findCol(header, ["광고진행여부", "광고진행", "광고여부"]);
  const viewsCol = findCol(header, ["조회수"]);
  const reachCol = findCol(header, ["도달수", "도달"]);
  const likesCol = findCol(header, ["좋아요"]);
  const commentsCol = findCol(header, ["댓글"]);
  const savesCol = findCol(header, ["저장"]);
  const sharesCol = findCol(header, ["공유"]);
  const profileCol = findCol(header, ["프로필활동수", "프로필활동"]);
  const adCostCol = findCol(header, ["광고비"]);

  const dataRows = body.filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const posts = dataRows.map((r) => ({
    date: dateCol >= 0 ? r[dateCol] : "-",
    topic: topicCol >= 0 ? r[topicCol] : "-",
    isAd: adCol >= 0 ? r[adCol] : "-",
    views: viewsCol >= 0 ? fmt(num(r[viewsCol])) : "-",
    reach: reachCol >= 0 ? fmt(num(r[reachCol])) : "-",
    likes: likesCol >= 0 ? fmt(num(r[likesCol])) : "-",
    comments: commentsCol >= 0 ? fmt(num(r[commentsCol])) : "-",
    saved: savesCol >= 0 ? fmt(num(r[savesCol])) : "-",
    shares: sharesCol >= 0 ? fmt(num(r[sharesCol])) : "-",
    profileActivity: profileCol >= 0 ? fmt(num(r[profileCol])) : "-",
    adCost: adCostCol >= 0 ? fmt(num(r[adCostCol])) : "-",
  }));

  return { kpis: {}, tables: { posts: buildInstagramPostsTable(posts) } };
}
