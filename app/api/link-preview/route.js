import { NextResponse } from "next/server";
import iconv from "iconv-lite";

export const runtime = "nodejs";

function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);
  if (og && og[1]) return decodeHtmlEntities(og[1]);
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleTag && titleTag[1]) return decodeHtmlEntities(titleTag[1]);
  return "";
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// 응답의 실제 인코딩을 찾아서(Content-Type 헤더 -> HTML meta charset 순) 정확히 디코딩한다.
// 네이버 카페 등 일부 페이지는 UTF-8이 아니라 EUC-KR로 내려주는 경우가 있어서,
// 무조건 UTF-8로 읽으면 제목이 깨진 문자로 나온다.
function normalizeCharset(raw) {
  const c = String(raw || "").trim().toLowerCase();
  if (!c) return "";
  if (c === "utf8" || c === "utf-8") return "utf-8";
  if (["euc-kr", "euckr", "ks_c_5601-1987", "ks_c_5601", "x-windows-949", "cp949", "949"].includes(c)) return "euc-kr";
  return c;
}

function decodeBuffer(buffer, headerCharset) {
  const bytes = Buffer.from(buffer);
  let charset = normalizeCharset(headerCharset);
  if (!charset) {
    // 헤더에 charset이 없으면 앞부분을 latin1으로 대충 읽어서 <meta charset=...>을 찾는다
    const peek = bytes.slice(0, 2048).toString("latin1");
    const metaMatch =
      peek.match(/<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i) ||
      peek.match(/<meta[^>]+content=["'][^"']*charset=([a-zA-Z0-9_-]+)/i);
    charset = normalizeCharset(metaMatch ? metaMatch[1] : "utf-8");
  }
  if (charset === "utf-8" || !iconv.encodingExists(charset)) {
    return bytes.toString("utf-8");
  }
  return iconv.decode(bytes, charset);
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || !url.trim()) {
      return NextResponse.json({ error: "URL을 입력해 주세요." }, { status: 400 });
    }
    const res = await fetch(url.trim(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TripickaBot/1.0)" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `페이지를 불러오지 못했습니다 (${res.status}). 비공개 글일 수 있습니다.` }, { status: 400 });
    }
    const contentType = res.headers.get("content-type") || "";
    const headerCharset = (contentType.match(/charset=([^;]+)/i) || [])[1];
    const buffer = await res.arrayBuffer();
    const html = decodeBuffer(buffer, headerCharset);
    const title = extractTitle(html);
    if (!title) {
      return NextResponse.json({ error: "제목을 찾지 못했습니다. 비공개 글이거나 로그인 후에만 보이는 글일 수 있습니다." }, { status: 400 });
    }
    return NextResponse.json({ title });
  } catch (error) {
    return NextResponse.json({ error: error.message || "링크를 불러오지 못했습니다." }, { status: 400 });
  }
}
