import { NextResponse } from "next/server";

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
    const html = await res.text();
    const title = extractTitle(html);
    if (!title) {
      return NextResponse.json({ error: "제목을 찾지 못했습니다. 비공개 글이거나 로그인 후에만 보이는 글일 수 있습니다." }, { status: 400 });
    }
    return NextResponse.json({ title });
  } catch (error) {
    return NextResponse.json({ error: error.message || "링크를 불러오지 못했습니다." }, { status: 400 });
  }
}
