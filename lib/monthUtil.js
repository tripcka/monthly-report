// ============================================================================
// 화면에 자유 텍스트로 입력하는 "보고 월"(예: "2026년 7월")을 연/월 숫자로 변환하고,
// 그 달의 [시작, 끝) UTC 타임스탬프 범위를 계산하는 유틸.
// Instagram 타임스탬프는 UTC 기준이라, 한국시간(KST, UTC+9) 자정을 기준으로 월 경계를
// 맞춰야 6/30 오후~7/1 새벽 사이 게시물이 엉뚱한 달로 새는 걸 방지할 수 있다.
// ============================================================================

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "2026년 7월", "2026-07", "2026.07", "7월"(연도 생략 시 올해로 간주) 등을 { year, month } 로 변환 */
export function parseYearMonth(input) {
  const s = String(input || "").trim();
  if (!s) return null;

  let m = s.match(/(\d{4})\s*[년.\-\/]?\s*(\d{1,2})\s*월?/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  m = s.match(/^(\d{1,2})\s*월$/);
  if (m) {
    const month = Number(m[1]);
    if (month >= 1 && month <= 12) return { year: new Date().getFullYear(), month };
  }

  return null;
}

/** 해당 연/월의 한국시간 기준 [1일 00:00, 다음달 1일 00:00) 범위를 UTC Date로 반환 */
export function monthRange(year, month) {
  const since = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - KST_OFFSET_MS);
  const until = new Date(Date.UTC(year, month, 1, 0, 0, 0) - KST_OFFSET_MS);
  return { since, until };
}

/** ISO 타임스탬프(UTC)를 한국시간 기준 "M/D" 문자열로 변환 (예: "2026-07-24T00:18:22+0000" -> "7/24") */
export function toKstMD(isoString) {
  const utcMs = new Date(isoString).getTime();
  if (isNaN(utcMs)) return "-";
  const kst = new Date(utcMs + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;
}
