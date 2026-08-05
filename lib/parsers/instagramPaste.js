function cleanLine(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const text = cleanLine(value).replace(/,/g, "");
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(만|천)?/);
  if (!match) return null;
  const multiplier = match[2] === "만" ? 10000 : match[2] === "천" ? 1000 : 1;
  return Number(match[1]) * multiplier;
}

function parsePercent(value) {
  const match = cleanLine(value).match(/(-?\d+(?:\.\d+)?)\s*%?/);
  return match ? Number(match[1]) : null;
}

function formatNumber(value) {
  return value === null ? null : Math.round(value).toLocaleString("ko-KR");
}

function formatPercent(value) {
  return value === null ? null : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

function valueAfter(lines, label, options = {}) {
  const start = options.start || 0;
  const end = options.end ?? lines.length;
  for (let i = start; i < end; i += 1) {
    if (lines[i] !== label) continue;
    for (let j = i + 1; j < Math.min(i + 4, end); j += 1) {
      if (options.reject?.includes(lines[j])) continue;
      const value = options.percent ? parsePercent(lines[j]) : parseNumber(lines[j]);
      if (value !== null) return value;
    }
  }
  return null;
}

function valueBefore(lines, label, options = {}) {
  const start = options.start || 0;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i] !== label) continue;
    for (let j = i - 1; j >= Math.max(start, i - 3); j -= 1) {
      const value = options.percent ? parsePercent(lines[j]) : parseNumber(lines[j]);
      if (value !== null) return value;
    }
  }
  return null;
}

function sectionIndex(lines, label, start = 0) {
  return lines.findIndex((line, index) => index >= start && line === label);
}

function parseSplit(lines, start, end) {
  if (start < 0) return null;
  let follower = null;
  let nonFollower = null;
  for (let i = start; i < end; i += 1) {
    if (lines[i] === "팔로워" && follower === null) {
      follower = parsePercent(lines[i + 1]);
    }
    if (lines[i] === "팔로워가 아닌 사람" && nonFollower === null) {
      nonFollower = parsePercent(lines[i + 1]);
    }
  }
  if (follower === null && nonFollower === null) return null;
  return {
    follower: formatPercent(follower),
    nonFollower: formatPercent(nonFollower),
  };
}

function parseDemographicPairs(lines, labels, stopLabels) {
  const start = lines.findIndex((line) => labels.includes(line));
  if (start < 0) return [];
  const isAge = labels.includes("연령대");
  const labelPattern = isAge
    ? /^(?:\d{1,2}\s*-\s*\d{1,2}세|(?:65|[7-9]\d)세\s*이상)$/
    : /^(?:여성|남성|기타|직접 지정)$/;
  const sectionLines = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (stopLabels.includes(lines[i])) break;
    sectionLines.push(lines[i]);
  }

  const pairs = [];
  const consumed = new Set();
  sectionLines.forEach((line, index) => {
    const inline = line.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*%\)$/);
    if (inline) {
      pairs.push({ label: inline[1].trim(), value: Number(inline[2]) });
      consumed.add(index);
    }
  });

  const remainingLabels = sectionLines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => !consumed.has(index) && labelPattern.test(line));
  const remainingValues = sectionLines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => !consumed.has(index) && /^\d+(?:\.\d+)?\s*%?$/.test(line))
    .map(({ line }) => parsePercent(line));

  remainingLabels.forEach(({ line }, index) => {
    if (remainingValues[index] !== undefined) {
      pairs.push({ label: line.replace(/\s+/g, ""), value: remainingValues[index] });
    }
  });
  return pairs.sort((a, b) => b.value - a.value);
}

function joinPairs(pairs) {
  return pairs.map(({ label, value }) => `${label}(${formatPercent(value)})`).join(" > ");
}

export function parseInstagramInsightText(text) {
  const lines = String(text || "").split(/\r?\n/).map(cleanLine).filter(Boolean);
  const kpis = {};
  const tables = {};

  const reactionSection = sectionIndex(lines, "반응");
  const profileSection = sectionIndex(lines, "프로필");
  const followersSection = sectionIndex(lines, "팔로워", Math.max(profileSection, 0));

  const views = valueAfter(lines, "조회수", { end: reactionSection > 0 ? reactionSection : lines.length });
  const reactions = valueAfter(lines, "반응", { start: Math.max(reactionSection, 0) });
  const profileActivity =
    valueBefore(lines, "프로필 활동", { start: Math.max(profileSection, 0) }) ??
    valueAfter(lines, "프로필 활동", { start: Math.max(profileSection, 0) });
  const reach = valueAfter(lines, "도달한 계정");
  const engaged = valueAfter(lines, "참여한 계정");
  const profileVisits = valueAfter(lines, "프로필 방문");
  const linkClicks = valueAfter(lines, "외부 링크 누름");
  const addressClicks = valueAfter(lines, "비즈니스 주소 누름");
  const followers =
    valueBefore(lines, "총 팔로워", { start: Math.max(followersSection, 0) }) ??
    valueAfter(lines, "총 팔로워", { start: Math.max(followersSection, 0) });

  if (views !== null) kpis.views30d = formatNumber(views);
  if (reactions !== null) kpis.reactions30d = formatNumber(reactions);
  if (profileActivity !== null) kpis.profileActivity30d = formatNumber(profileActivity);
  if (reach !== null) kpis.reach30d = formatNumber(reach);
  if (engaged !== null) kpis.engagedAccounts30d = formatNumber(engaged);
  if (profileVisits !== null) kpis.profileVisits30d = formatNumber(profileVisits);
  if (linkClicks !== null) kpis.linkClicks30d = formatNumber(linkClicks);
  if (addressClicks !== null) kpis.addressClicks30d = formatNumber(addressClicks);
  if (followers !== null) kpis.followers = formatNumber(followers);

  const viewSplit = parseSplit(lines, 0, reactionSection > 0 ? reactionSection : lines.length);
  const reactionSplit = parseSplit(
    lines,
    Math.max(reactionSection, 0),
    profileSection > reactionSection ? profileSection : lines.length
  );
  if (viewSplit || reactionSplit) {
    tables.accountComposition = [
      ["구분", "팔로워", "팔로워가 아닌 사람"],
      ["조회한 계정", viewSplit?.follower || "-", viewSplit?.nonFollower || "-"],
      ["반응한 계정", reactionSplit?.follower || "-", reactionSplit?.nonFollower || "-"],
    ];
  }

  const agePairs = parseDemographicPairs(
    lines,
    ["연령대", "연령"],
    ["성별", "가장 활동이 많은 시간", "조회수", "반응", "프로필"]
  );
  const genderPairs = parseDemographicPairs(
    lines,
    ["성별"],
    ["가장 활동이 많은 시간", "조회수", "반응", "프로필", "연령대"]
  );
  if (agePairs.length || genderPairs.length) {
    tables.audienceDetails = [
      ["팔로워 상세 정보", "분포"],
      ["연령대", joinPairs(agePairs) || "-"],
      ["성별", joinPairs(genderPairs) || "-"],
    ];
  }

  return { kpis, tables };
}

function metricValue(lines, labels) {
  for (const label of labels) {
    const value = valueAfter(lines, label);
    if (value !== null) return formatNumber(value);
  }
  return "-";
}

/** 인스타그램 개별 게시물 인사이트 원문 한 건을 기존 게시물 성과표 데이터로 변환한다. */
export function parseInstagramPostInsightText(text, meta = {}) {
  const lines = String(text || "").split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (lines.length === 0) return null;

  const views = metricValue(lines, ["조회수", "재생 횟수"]);
  const reach = metricValue(lines, ["도달한 계정", "도달수", "도달"]);
  const likes = metricValue(lines, ["좋아요"]);
  const comments = metricValue(lines, ["댓글"]);
  const saved = metricValue(lines, ["저장"]);
  const shares = metricValue(lines, ["공유"]);
  const profileActivity = metricValue(lines, ["프로필 활동", "프로필 활동 수", "프로필 방문"]);
  const recognized = [views, reach, likes, comments, saved, shares, profileActivity].some((value) => value !== "-");
  if (!recognized) return null;

  return {
    date: meta.date || "-",
    topic: meta.topic || "-",
    isAd: meta.isAd || "N",
    views,
    reach,
    likes,
    comments,
    saved,
    shares,
    profileActivity,
    adCost: meta.adCost || "-",
  };
}

function textAfter(lines, label, options = {}) {
  const start = options.start || 0;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i] !== label) continue;
    for (let j = i + 1; j < Math.min(i + (options.lookahead || 5), lines.length); j += 1) {
      if (!options.reject?.includes(lines[j])) return lines[j];
    }
  }
  return null;
}

function wonValue(value) {
  const number = parseNumber(String(value || "").replace(/[₩원]/g, ""));
  return number === null ? "-" : `${Math.round(number).toLocaleString("ko-KR")}원`;
}

function adMetric(lines, labels, options = {}) {
  for (const label of labels) {
    const start = options.start || 0;
    const index = lines.findIndex((line, i) => i >= start && line === label);
    if (index < 0) continue;
    const raw = lines.slice(index + 1, index + 4).find((line) => parseNumber(line) !== null);
    if (raw) return options.won ? wonValue(raw) : formatNumber(parseNumber(raw));
  }
  return "-";
}

function parseAdLocations(lines) {
  const start = sectionIndex(lines, "광고가 표시된 사람");
  if (start < 0) return "-";
  const pairs = [];
  for (let i = start + 1; i < lines.length - 1; i += 1) {
    const percent = parsePercent(lines[i + 1]);
    if (percent === null || !/%/.test(lines[i + 1])) continue;
    pairs.push(`${lines[i]} ${formatPercent(percent)}`);
    i += 1;
  }
  return pairs.slice(0, 5).join(" · ") || "-";
}

/** Meta 광고 개요 원문 한 건을 광고 인사이트 표의 열 데이터로 변환한다. */
export function parseInstagramAdInsightText(text, meta = {}) {
  const lines = String(text || "").split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (lines.length === 0) return null;

  const profileSection = sectionIndex(lines, "프로필 활동");
  const detailSection = sectionIndex(lines, "상세 정보");
  const targetIndex = sectionIndex(lines, "타겟", Math.max(detailSection, 0));
  const target = targetIndex >= 0 ? textAfter(lines, "타겟", { start: targetIndex }) : null;
  const spendRaw = textAfter(lines, "지출", { start: Math.max(detailSection, 0) });
  const period = textAfter(lines, "기간", { start: Math.max(detailSection, 0) });
  const costPerVisitRaw = textAfter(lines, "프로필 방문당 비용");

  const result = {
    name: meta.name || "광고",
    views: adMetric(lines, ["조회수"]),
    reach: adMetric(lines, ["도달"]),
    engagement: adMetric(lines, ["참여"]),
    linkClicks: adMetric(lines, ["링크 클릭"]),
    likes: adMetric(lines, ["좋아요 및 공감", "좋아요"]),
    saved: adMetric(lines, ["저장"]),
    profileVisits: adMetric(lines, ["프로필 방문"], { start: Math.max(profileSection, 0) }),
    follows: adMetric(lines, ["팔로우"], { start: Math.max(profileSection, 0) }),
    externalClicks: adMetric(lines, ["외부 링크 누름"], { start: Math.max(profileSection, 0) }),
    costPerVisit: costPerVisitRaw ? wonValue(costPerVisitRaw) : "-",
    spend: spendRaw ? wonValue(spendRaw.split("/")[0]) : "-",
    period: period || "-",
    target: target || "-",
    locations: parseAdLocations(lines),
  };
  const recognized = [result.views, result.reach, result.spend, result.target, result.locations].some((value) => value !== "-");
  return recognized ? result : null;
}

export function buildInstagramAdInsightsTable(ads, meta = {}) {
  const displayDate = String(meta.date || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => `${Number(m)}/${Number(d)}`) || "집행일 미입력";
  const feedName = meta.feedName || "피드";
  const columns = ads.map((ad, index) => ad?.target && ad.target !== "-" ? ad.target : (ad?.name || `광고 ${index + 1}`));
  const row = (label, key) => [label, ...ads.map((ad) => ad?.[key] || "-")];
  return [
    ["구분", ...ads.map(() => displayDate)],
    ["", ...ads.map(() => feedName)],
    ["타겟", ...columns],
    row("조회수", "views"),
    row("도달", "reach"),
    row("참여", "engagement"),
    row("링크 클릭", "linkClicks"),
    row("좋아요 및 공감", "likes"),
    row("저장", "saved"),
    row("프로필 방문", "profileVisits"),
    row("팔로우", "follows"),
    row("외부 링크 누름", "externalClicks"),
    row("프로필 방문당 비용", "costPerVisit"),
    row("지출", "spend"),
    row("기간", "period"),
    row("주요 위치", "locations"),
  ];
}
