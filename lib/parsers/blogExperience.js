import { findCol } from "./utils";

// 실제 검증된 트리피카 체험단 리스트 시트 컬럼:
// 성함,연락처,블로그URL,일방문자수,방문일,인원,제공사항,확정여부,업로드일,포스팅URL,상위노출,비고
export function parseBlogExperience(rows) {
  const header = rows[0] || [];
  const body = rows.slice(1).filter((r) => r.length > 1 && r.some((c) => String(c).trim() !== ""));

  const nameCol = findCol(header, ["성함", "이름"]);
  const visitorCol = findCol(header, ["일방문자"]);
  const uploadDateCol = findCol(header, ["업로드일"]);
  const urlCol = findCol(header, ["포스팅URL", "포스팅 URL"]);
  const exposureCol = findCol(header, ["상위노출"]);

  const table = [["이름", "업로드일", "일방문자", "포스팅 URL", "상위노출 키워드"]];
  body.forEach((r) => {
    table.push([
      nameCol >= 0 ? r[nameCol] : "-",
      uploadDateCol >= 0 ? r[uploadDateCol] : "-",
      visitorCol >= 0 ? `${r[visitorCol]}명` : "-",
      urlCol >= 0 ? r[urlCol] : "-",
      exposureCol >= 0 && r[exposureCol] ? r[exposureCol] : "-",
    ]);
  });

  return {
    kpis: { teamCount: `${body.length}팀` },
    tables: { roster: table },
  };
}
