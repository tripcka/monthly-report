// ============================================================================
// 인스타그램 "게시물/릴스별 성과" 표를 만드는 공용 함수.
// 게시물이 많아지면 표가 세로로 길어지는 대신 가로로 늘어나는 형태(지표별 행 × 게시물별 열)로 통일한다.
// CSV 파서(instagramPosts.js)와 API 자동수집 라우트(app/api/instagram/route.js)가 공통으로 사용.
//
// posts: 배열, 각 원소는 다음 필드를 가진 객체 (없는 값은 "-"로 표시됨)
//   { date, topic, isAd, views, reach, likes, comments, saved, shares, profileActivity, adCost }
// ============================================================================

function cell(v) {
  return v === undefined || v === null || v === "" ? "-" : v;
}

export function buildInstagramPostsTable(posts) {
  const header = ["업로드일", ...posts.map((p) => cell(p.date))];
  const row = (label, key) => [label, ...posts.map((p) => cell(p[key]))];

  return [
    header,
    row("피드주제", "topic"),
    row("광고 진행여부", "isAd"),
    row("조회수", "views"),
    row("도달한 계정", "reach"),
    row("좋아요", "likes"),
    row("댓글", "comments"),
    row("저장", "saved"),
    row("공유", "shares"),
    row("프로필 활동 수", "profileActivity"),
    row("광고비", "adCost"),
  ];
}
