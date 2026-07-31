const MAX_REDIRECTS = 4;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function firstTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]);
  }
  return "";
}

function atomLink(block) {
  const tags = block.match(/<link\b[^>]*\/?>/gi) || [];
  const alternate = tags.find((tag) => /\brel=["']alternate["']/i.test(tag));
  const selected = alternate || tags[0];
  const href = selected?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  return href ? decodeXml(href) : firstTag(block, ["link"]);
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function seoulYearMonth(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function formatSeoulDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}.${get("month")}.${get("day")}`;
}

export function parseFeed(xml, targetYearMonth) {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];
  const seen = new Set();
  return blocks
    .map((block) => {
      const title = firstTag(block, ["title"]);
      const link = atomLink(block);
      const published = firstTag(block, ["pubDate", "published", "updated", "dc:date"]);
      const date = normalizeDate(published);
      if (!title || !link || !date || seoulYearMonth(date) !== targetYearMonth) return null;
      const dedupeKey = `${link}|${date.toISOString()}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return { date: formatSeoulDate(date), title, link, timestamp: date.getTime() };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ timestamp, ...post }) => post);
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("올바른 블로그 주소를 입력해 주세요.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("HTTP 또는 HTTPS 주소만 사용할 수 있습니다.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("공개 블로그 주소만 사용할 수 있습니다.");
  }
  return url;
}

export function naverFeedUrl(blogUrl) {
  const url = validatePublicUrl(blogUrl);
  const hostname = url.hostname.toLowerCase();
  if (!["blog.naver.com", "m.blog.naver.com"].includes(hostname)) return null;
  const blogId = url.pathname.split("/").filter(Boolean)[0];
  if (!blogId) throw new Error("네이버 블로그 ID가 포함된 주소를 입력해 주세요.");
  return `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
}

async function fetchPublic(urlValue, redirects = 0) {
  if (redirects > MAX_REDIRECTS) throw new Error("블로그 주소의 이동 경로가 너무 깁니다.");
  const url = validatePublicUrl(urlValue);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "TripickaMonthlyReport/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html" },
    cache: "no-store",
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error("블로그 주소 이동 정보를 확인할 수 없습니다.");
    return fetchPublic(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error(`블로그를 불러오지 못했습니다. (HTTP ${response.status})`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_FEED_BYTES) throw new Error("블로그 피드의 용량이 너무 큽니다.");
  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) throw new Error("블로그 피드의 용량이 너무 큽니다.");
  return { text, contentType: response.headers.get("content-type") || "", finalUrl: url.toString() };
}

function discoverFeed(html, pageUrl) {
  const matches = [...html.matchAll(/<link\b[^>]*>/gi)];
  for (const match of matches) {
    const tag = match[0];
    if (!/\btype=["']application\/(?:rss|atom)\+xml["']/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) return new URL(decodeXml(href), pageUrl).toString();
  }
  return null;
}

export async function loadBlogPosts(blogUrl, targetYearMonth) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetYearMonth)) {
    throw new Error("조회 연월을 YYYY-MM 형식으로 입력해 주세요.");
  }
  const naverRss = naverFeedUrl(blogUrl);
  if (naverRss) {
    const { text } = await fetchPublic(naverRss);
    return parseFeed(text, targetYearMonth);
  }

  const first = await fetchPublic(blogUrl);
  if (/<(?:rss|feed)\b/i.test(first.text) || /(?:rss|atom)\+xml/i.test(first.contentType)) {
    return parseFeed(first.text, targetYearMonth);
  }
  const discovered = discoverFeed(first.text, first.finalUrl);
  const candidates = discovered
    ? [discovered]
    : [new URL("/feed", first.finalUrl).toString(), new URL("/rss", first.finalUrl).toString()];
  for (const candidate of candidates) {
    try {
      const { text } = await fetchPublic(candidate);
      const posts = parseFeed(text, targetYearMonth);
      if (posts.length > 0 || /<(?:rss|feed)\b/i.test(text)) return posts;
    } catch {
      // 다음 일반 피드 주소를 시도한다.
    }
  }
  throw new Error("공개 RSS/Atom 피드를 찾지 못했습니다. CSV로 입력하거나 블로그의 RSS 주소를 사용해 주세요.");
}
