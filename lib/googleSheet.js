import Papa from "papaparse";

// 구글 시트 URL(예: https://docs.google.com/spreadsheets/d/xxxx/edit#gid=123)에서
// 스프레드시트 ID와 시트(gid)를 뽑아서 CSV로 내보내기하는 공개 URL을 만든다.
// "링크가 있는 모든 사용자" 이상으로 공유된 시트여야 로그인 없이 접근 가능.
function parseSheetUrl(sheetUrl) {
  const idMatch = String(sheetUrl || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("올바른 구글 시트 URL이 아닙니다. 주소창의 https://docs.google.com/spreadsheets/d/... 전체를 복사해 주세요.");
  }
  const gidMatch = String(sheetUrl).match(/[#&?]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
}

export async function loadGoogleSheetRows(sheetUrl) {
  const { id, gid } = parseSheetUrl(sheetUrl);
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error("구글 시트를 불러오지 못했습니다. 링크 공유 설정(링크가 있는 모든 사용자 - 뷰어 이상)을 확인해 주세요.");
  }
  const text = await res.text();

  // 비공개 시트는 200을 반환하면서 로그인 페이지(HTML)를 CSV라고 주는 경우가 있어 별도 확인
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error("비공개 시트로 보입니다. 구글 시트 공유 설정을 '링크가 있는 모든 사용자'로 바꾸고 다시 시도해 주세요.");
  }

  const parsed = Papa.parse(text, { skipEmptyLines: true });
  const rows = (parsed.data || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (rows.length === 0) {
    throw new Error("시트에서 데이터를 찾지 못했습니다. 시트 안에 내용이 있는지 확인해 주세요.");
  }
  return rows;
}
