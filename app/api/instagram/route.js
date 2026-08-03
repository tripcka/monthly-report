import { NextResponse } from "next/server";
import { resolveInstagramAccount } from "../../../lib/instagramAccounts";
import {
  getAccountSummary,
  getMonthlyReach,
  getMediaInRange,
  getMediaInsights,
} from "../../../lib/instagramApi";
import { fmt } from "../../../lib/parsers/utils";
import { parseYearMonth, monthRange, toKstMD } from "../../../lib/monthUtil";
import { buildInstagramPostsTable } from "../../../lib/postsTable";

// GET /api/instagram?hotel=SL호텔강릉&month=2026년 7월
// 액세스 토큰은 서버 환경변수에서만 읽고 응답에는 절대 포함하지 않는다.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hotelName = searchParams.get("hotel") || "";
  const monthParam = searchParams.get("month") || "";

  let account;
  try {
    account = resolveInstagramAccount(hotelName);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if (!account) {
    return NextResponse.json(
      {
        error: `"${hotelName}"에 매칭되는 인스타그램 계정 설정을 찾을 수 없습니다. lib/instagramAccounts.js에 등록되어 있는지 확인해주세요.`,
      },
      { status: 404 }
    );
  }

  const ym = parseYearMonth(monthParam);
  if (!ym) {
    return NextResponse.json(
      {
        error: `"${monthParam}"에서 연/월을 인식하지 못했습니다. "2026년 7월" 또는 "2026-07" 형식으로 입력해주세요.`,
      },
      { status: 400 }
    );
  }
  const { since, until } = monthRange(ym.year, ym.month);

  try {
    const [summary, reachSum, mediaList] = await Promise.all([
      getAccountSummary(account.igUserId, account.accessToken),
      getMonthlyReach(account.igUserId, account.accessToken, since, until),
      getMediaInRange(account.igUserId, account.accessToken, since, until),
    ]);

    // 게시물별 인사이트는 월 단위라 보통 수십 건 이내라서 병렬 호출로 처리
    const mediaWithInsights = await Promise.all(
      mediaList.map(async (m) => ({
        ...m,
        _insights: await getMediaInsights(m.id, m.media_type, account.accessToken),
      }))
    );

    const totalReactions = mediaList.reduce(
      (sum, m) => sum + (Number(m.like_count) || 0) + (Number(m.comments_count) || 0),
      0
    );

    const kpis = {
      followers: fmt(Number(summary.followers_count) || 0),
      views30d: fmt(reachSum),
      reactions30d: fmt(totalReactions),
      // Instagram API에는 계정 단위 "프로필 활동" 지표가 더 이상 제공되지 않아 자동 수집 불가.
      // Meta Business Suite 화면에서 수동으로 확인해서 채워야 함.
      profileActivity30d: "-",
    };

    const postsInput = mediaWithInsights
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((m) => ({
        date: toKstMD(m.timestamp),
        topic: "-", // 담당자가 수동으로 분류해서 채우던 항목 (API로 대체 불가)
        isAd: "N", // 광고 진행 여부는 Marketing API 권한이 없어 자동 판별 불가, 수동 입력 필요
        views: m._insights.views === "-" ? "-" : fmt(m._insights.views),
        reach: m._insights.reach === "-" ? "-" : fmt(m._insights.reach),
        likes: fmt(Number(m.like_count) || 0),
        comments: fmt(Number(m.comments_count) || 0),
        saved: m._insights.saved === "-" ? "-" : fmt(m._insights.saved),
        shares: m._insights.shares === "-" ? "-" : fmt(m._insights.shares),
        profileActivity: "-", // 게시물 단위 프로필 활동 지표는 API에 없음
        adCost: "-", // 광고비는 Meta Ads Manager에서 수동 확인 필요
      }));
    const postsTable = buildInstagramPostsTable(postsInput);

    return NextResponse.json({
      account: { label: account.label, igUserId: account.igUserId, username: summary.username },
      kpis,
      tables: { posts: postsTable },
      meta: { postCount: mediaList.length, since: since.toISOString(), until: until.toISOString() },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.igError?.message || e.message || "인스타그램 데이터를 가져오는 중 오류가 발생했습니다." },
      { status: 502 }
    );
  }
}
