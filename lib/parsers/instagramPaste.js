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
