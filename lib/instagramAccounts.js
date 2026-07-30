// ============================================================================
// 호텔명 → Instagram 비즈니스 계정 매핑
// - igUserId: Meta 개발자 콘솔에서 확인한 Instagram 계정 ID (예: 27601895239462252)
// - tokenEnvKey: 실제 액세스 토큰이 들어있는 "환경변수 이름" (토큰 값 자체는 절대 이 파일에 넣지 않음)
//
// 새 호텔을 인스타그램 자동 수집에 추가할 때:
//   1) 아래 테이블에 { igUserId, tokenEnvKey } 한 줄 추가
//   2) Vercel 프로젝트 설정 > Environment Variables에 tokenEnvKey 이름으로 실제 토큰 값 등록
//   3) sl__hotel 계정과 마찬가지로 Meta 개발자 앱에 해당 계정을 테스터로 등록 + 토큰 발급
//      (또는 향후 정식 OAuth 플로우 구축 시 그 토큰으로 대체)
// ============================================================================

export const INSTAGRAM_ACCOUNTS = {
  "sl호텔강릉": {
    label: "SL호텔강릉",
    igUserId: "27601895239462252",
    tokenEnvKey: "INSTAGRAM_TOKEN_SLHOTELGANGNEUNG",
  },
};

function normalizeHotelName(name) {
  return String(name || "").replace(/\s/g, "").toLowerCase();
}

/**
 * 화면에 입력된 호텔명(예: "SL호텔강릉", "SL 호텔 강릉")으로 계정 설정을 찾는다.
 * 정확히 일치 → 포함 관계 순으로 매칭.
 * 매칭되는 계정이 없거나, 있어도 토큰 환경변수가 서버에 설정 안 되어 있으면 null 대신
 * 원인을 알 수 있는 에러를 던진다 (호출 측에서 사용자에게 그대로 보여줄 수 있도록).
 */
export function resolveInstagramAccount(hotelName) {
  const key = normalizeHotelName(hotelName);
  if (!key) return null;

  let entry = INSTAGRAM_ACCOUNTS[key];
  let matchedKey = key;
  if (!entry) {
    const found = Object.entries(INSTAGRAM_ACCOUNTS).find(
      ([k]) => key.includes(k) || k.includes(key)
    );
    if (found) {
      matchedKey = found[0];
      entry = found[1];
    }
  }
  if (!entry) return null;

  const accessToken = process.env[entry.tokenEnvKey];
  if (!accessToken) {
    const err = new Error(
      `"${entry.label}" 계정은 등록되어 있지만, 서버 환경변수 ${entry.tokenEnvKey}에 액세스 토큰이 설정되어 있지 않습니다. Vercel 프로젝트 설정에서 등록해주세요.`
    );
    err.code = "MISSING_TOKEN";
    throw err;
  }

  return { key: matchedKey, label: entry.label, igUserId: entry.igUserId, accessToken };
}
