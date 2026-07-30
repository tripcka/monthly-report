// ============================================================================
// Instagram Graph API 클라이언트 (서버 전용)
// ⚠️ 이 파일은 절대 클라이언트 컴포넌트("use client")에서 import하면 안 됩니다.
//    accessToken이 브라우저 번들에 노출될 수 있습니다. app/api/instagram/route.js
//    같은 서버 라우트에서만 사용하세요.
// ============================================================================

const GRAPH_BASE = "https://graph.instagram.com";

async function graphGet(path, params) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || "Instagram API 오류");
    err.igError = json.error;
    throw err;
  }
  return json;
}

/** 계정 기본 정보: 총 팔로워 수 / 총 게시물 수 */
export async function getAccountSummary(igUserId, accessToken) {
  return graphGet(`/${igUserId}`, {
    fields: "id,username,followers_count,media_count",
    access_token: accessToken,
  });
}

/**
 * 지정 기간(since~until, Date 객체) 동안의 일별 도달(reach) 합계.
 * period=day 지표는 since/until(unix timestamp)로 범위 조회 가능.
 * 계정/API 버전에 따라 일부 지표가 아예 없을 수 있어 실패해도 throw하지 않고 0을 반환한다.
 */
export async function getMonthlyReach(igUserId, accessToken, since, until) {
  try {
    const json = await graphGet(`/${igUserId}/insights`, {
      metric: "reach",
      period: "day",
      since: Math.floor(since.getTime() / 1000),
      until: Math.floor(until.getTime() / 1000),
      access_token: accessToken,
    });
    const values = json?.data?.[0]?.values || [];
    return values.reduce((sum, v) => sum + (Number(v.value) || 0), 0);
  } catch (e) {
    console.warn("[instagram] reach 조회 실패, 0으로 대체:", e.message);
    return 0;
  }
}

/**
 * 지정 월(since~until, Date 객체) 안에 올라온 게시물만 모아서 반환.
 * /media는 자체 since/until 필터를 안전하게 지원하지 않는 계정이 있어,
 * 최신순(timestamp desc)으로 페이지네이션하며 범위를 벗어나면 중단하는 방식으로 직접 필터링한다.
 */
export async function getMediaInRange(igUserId, accessToken, since, until) {
  const fields = "id,caption,like_count,comments_count,media_type,media_product_type,timestamp,permalink";
  let url = `${GRAPH_BASE}/${igUserId}/media?fields=${fields}&access_token=${accessToken}&limit=50`;
  const collected = [];
  let guard = 0; // 무한 루프 방지 (최대 10페이지 = 500개)

  while (url && guard < 10) {
    guard += 1;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      throw Object.assign(new Error(json.error.message || "media 조회 실패"), { igError: json.error });
    }
    const items = json.data || [];
    let sawOlderThanRange = false;
    for (const item of items) {
      const ts = new Date(item.timestamp);
      if (ts >= since && ts < until) {
        collected.push(item);
      } else if (ts < since) {
        sawOlderThanRange = true;
      }
    }
    if (sawOlderThanRange) break; // 최신순 정렬이므로 범위보다 오래된 글을 만나면 더 볼 필요 없음
    url = json.paging?.next || null;
  }
  return collected;
}

/**
 * 게시물 하나의 도달/저장/공유 인사이트.
 * 이미지/캐러셀과 릴스(VIDEO)는 지원 지표가 달라서 media_type에 따라 다른 metric을 요청한다.
 * 계정/게시물 조합에 따라 특정 지표가 아예 없을 수 있으므로 실패해도 조용히 "-"로 대체한다.
 */
export async function getMediaInsights(mediaId, mediaType, accessToken) {
  const isVideo = mediaType === "VIDEO" || mediaType === "REELS";
  const metrics = isVideo ? "plays,reach,saved,shares" : "reach,saved";
  try {
    const json = await graphGet(`/${mediaId}/insights`, { metric: metrics, access_token: accessToken });
    const byName = {};
    for (const m of json.data || []) {
      byName[m.name] = m.values?.[0]?.value ?? m.values?.[0]?.values ?? null;
    }
    return {
      views: byName.plays ?? "-",
      reach: byName.reach ?? "-",
      saved: byName.saved ?? "-",
      shares: byName.shares ?? "-",
    };
  } catch (e) {
    console.warn(`[instagram] media ${mediaId} 인사이트 조회 실패, "-"로 대체:`, e.message);
    return { views: "-", reach: "-", saved: "-", shares: "-" };
  }
}
