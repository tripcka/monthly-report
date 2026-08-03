import { NextResponse } from "next/server";
import { loadGoogleSheetRows } from "../../../lib/googleSheet";
import { parseBlogExperience } from "../../../lib/parsers/blogExperience";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { sheetUrl } = await request.json();
    if (!sheetUrl || !sheetUrl.trim()) {
      return NextResponse.json({ error: "구글 시트 URL을 입력해 주세요." }, { status: 400 });
    }
    const rows = await loadGoogleSheetRows(sheetUrl.trim());
    const { kpis, tables } = parseBlogExperience(rows);
    return NextResponse.json({ kpis, tables });
  } catch (error) {
    return NextResponse.json({ error: error.message || "구글 시트를 불러오지 못했습니다." }, { status: 400 });
  }
}
