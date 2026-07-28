import { findCol } from "./utils";

// 실제 트리피카 체험단 리스트 시트는 상단에 업체명/제공내역 같은 메모 행이 여러 줄
// 섞여 있고, 진짜 헤더("성함,연락처,블로그URL,일 방문자 수,...")는 몇 줄 아래에 있음.
// 그래서 "성함" 또는 "이름"이 들어있는 행을 직접 찾아서 그걸 헤더로 쓴다.
function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => String(c).trim() === "성함" || String(c).trim() === "이름")) {
      return i;
    }
  }
  return 0; // 못 찾으면 기존처럼 첫 행 사용 (안전한 폴백)
}

export function parseBlogExperience(rows) {
  const headerIndex = findHeaderRowIndex(rows);
  const header = rows[headerIndex] || [];
  const body = rows
    .slice(headerIndex + 1)
    .filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const nameCol = findCol(header, ["성함", "이름"]);
  const visitorCol = findCol(header, ["일방문자"]); // "일 방문자 수" -> 공백 제거 후 매칭됨
  const uploadDateCol = findCol(header, ["업로드일"]);
  const urlCol = findCol(header, ["포스팅URL"]);
  const exposureCol = findCol(header, ["상위노출"]);

  // 이름 칸이 비어있는 행(빈 줄, 요약행 등)은 제외
  const dataRows = nameCol >= 0 ? body.filter((r) => r[nameCol] && String(r[nameCol]).trim() !== "") : body;

  const table = [["이름", "업로드일", "일방문자", "포스팅 URL", "상위노출 키워드"]];
  dataRows.forEach((r) => {
    table.push([
      nameCol >= 0 ? r[nameCol] : "-",
      uploadDateCol >= 0 ? r[uploadDateCol] : "-",
      visitorCol >= 0 ? `${r[visitorCol]}명` : "-",
      urlCol >= 0 ? r[urlCol] : "-",
      exposureCol >= 0 && r[exposureCol] ? r[exposureCol] : "-",
    ]);
  });

  return {
    kpis: { teamCount: `${dataRows.length}팀` },
    tables: { roster: table },
  };
}
