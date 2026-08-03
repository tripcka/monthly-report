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

export function formatWon(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  if (/원$/.test(raw)) return raw;

  const numeric = raw.replace(/,/g, "").replace(/\s/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(numeric)) {
    return `${Number(numeric).toLocaleString("ko-KR")}원`;
  }
  return `${raw}원`;
}

export function formatAdFlag(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "-") return "N";
  if (["y", "yes", "예", "네", "진행", "광고", "true", "1"].includes(raw)) return "Y";
  if (["n", "no", "아니오", "아니요", "미진행", "false", "0"].includes(raw)) return "N";
  return raw.startsWith("y") || raw.includes("예") ? "Y" : "N";
}

export function normalizeInstagramPostsRows(rows) {
  return (rows || []).map((row) => {
    if (!["광고 진행여부", "광고 여부"].includes(String(row?.[0] || "").trim())) return row;
    return ["광고 여부", ...row.slice(1).map(formatAdFlag)];
  });
}

export function buildInstagramPostsTable(posts) {
  const header = ["업로드일", ...posts.map((p) => cell(p.date))];
  const row = (label, key) => [label, ...posts.map((p) => cell(p[key]))];

  return [
    header,
    row("피드주제", "topic"),
    ["광고 여부", ...posts.map((p) => formatAdFlag(p.isAd))],
    row("조회수", "views"),
    row("도달한 계정", "reach"),
    row("좋아요", "likes"),
    row("댓글", "comments"),
    row("저장", "saved"),
    row("공유", "shares"),
    row("프로필 활동 수", "profileActivity"),
    ["광고비", ...posts.map((p) => formatWon(p.adCost))],
  ];
}
