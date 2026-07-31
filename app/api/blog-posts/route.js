import { NextResponse } from "next/server";
import { loadBlogPosts } from "../../../lib/blogFeed";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { blogUrl, yearMonth } = await request.json();
    if (!blogUrl || !yearMonth) {
      return NextResponse.json({ error: "블로그 주소와 조회 연월을 입력해 주세요." }, { status: 400 });
    }
    const posts = await loadBlogPosts(blogUrl, yearMonth);
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json({ error: error.message || "블로그 글을 불러오지 못했습니다." }, { status: 400 });
  }
}
