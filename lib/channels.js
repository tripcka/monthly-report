// ============================================================================
// 채널 스키마 정의 — 트리피카 호텔 마케팅 보고서 전 채널
// 각 채널: uploads(실제 업로드하는 파일 + 어떤 파서를 쓸지) → kpis/tables(화면에 보여줄 결과)
// 파서는 lib/parsers/에 있고, 정확한 포맷을 검증한 4개 채널은 전용 파서를,
// 나머지는 generic(범용 자동인식) 파서를 사용한다.
// ============================================================================

export const CHANNELS = [
  {
    id: "instagram",
    kicker: "INSTAGRAM",
    title: "인스타그램",
    kpis: [
      { key: "followers", label: "팔로워", detailOnly: true },
      { key: "views30d", label: "조회수", detailOnly: true },
      { key: "reach30d", label: "도달수", detailOnly: true },
      { key: "reactions30d", label: "반응", detailOnly: true },
      { key: "engagedAccounts30d", label: "참여한 계정", detailOnly: true },
      { key: "profileActivity30d", label: "프로필 활동", detailOnly: true },
      { key: "profileVisits30d", label: "프로필 방문", detailOnly: true },
      { key: "linkClicks30d", label: "외부 링크 누름", detailOnly: true },
      { key: "addressClicks30d", label: "비즈니스 주소 누름", detailOnly: true },
    ],
    tables: [
      { key: "posts", label: "게시물/릴스별 성과" },
      { key: "adInsights", label: "피드 광고 인사이트", legacyOnly: true },
      ...Array.from({ length: 6 }, (_, index) => ({
        key: `adInsights${index + 1}`,
        label: `피드 ${index + 1} 광고 인사이트`,
      })),
      { key: "audienceDetails", label: "팔로워 상세 정보" },
      { key: "accountComposition", label: "조회·반응 계정 구성" },
      { key: "ads", label: "광고 진행 내역" },
    ],
    images: [{ key: "receipt", label: "영수증 이미지 첨부 공간" }],
    // 계정 핵심 수치와 조회·반응·프로필 활동 상세는 한 장에 모으고,
    // 게시물/릴스 성과는 그 다음 장에 배치한다.
    slideGroups: [
      {
        title: "조회수·반응 상세",
        kpiKeys: [
          "followers",
          "views30d",
          "reach30d",
          "reactions30d",
          "engagedAccounts30d",
          "profileActivity30d",
        ],
        tableKeys: ["accountComposition"],
        kpiDetail: {
          title: "프로필 활동 상세",
          keys: ["profileVisits30d", "linkClicks30d", "addressClicks30d"],
        },
      },
      { title: "게시물/릴스별 성과", tableKeys: ["posts"] },
      // 광고 피드는 한 화면에 2개씩, 가로로 나란히 배치한다 (최대 6개 피드 → 3장).
      // 세로로 쌓으면 표 하나만으로도 길어서 두 번째 표가 잘리기 때문에 반드시 가로 배치.
      ...Array.from({ length: 3 }, (_, i) => ({
        title: "광고 인사이트",
        tableKeys: [`adInsights${i * 2 + 1}`, `adInsights${i * 2 + 2}`],
        layout: "sideBySide",
      })),
      { title: "팔로워 상세 정보", tableKeys: ["audienceDetails"] },
      { title: "광고 진행 내역", tableKeys: ["ads"], imageKeys: ["receipt"] },
    ],
    uploads: [
      { key: "adsCsv", label: "광고 진행 내역 CSV (Meta Ads Manager 다운로드)", parser: "instagramAds" },
    ],
  },
  {
    id: "blogExperience",
    kicker: "블로그체험단",
    title: "블로그체험단",
    kpis: [],
    tables: [{ key: "roster", label: "체험단 진행 현황" }],
    images: [{ key: "exposureCapture", label: "체험단 상위노출" }],
    // 체험단을 많이 진행하는 호텔은 리스트/이미지가 길어질 수 있어 페이지를 분리한다.
    slideGroups: [
      { title: "체험단 진행 현황", tableKeys: ["roster"] },
      { title: "체험단 상위노출", imageKeys: ["exposureCapture"] },
    ],
    uploads: [
      { key: "rosterCsv", label: "체험단 리스트 CSV (성함/일방문자수/업로드일/포스팅URL/상위노출)", parser: "blogExperience" },
    ],
  },
  {
    id: "naverSearch",
    kicker: "NAVER 검색광고",
    title: "네이버 검색광고 (파워링크)",
    kpis: [
      { key: "impressions", label: "노출수" },
      { key: "clicks", label: "클릭수" },
      { key: "ctr", label: "CTR" },
      { key: "cpc", label: "CPC" },
      { key: "cost", label: "광고비" },
    ],
    tables: [
      { key: "moSummary", label: "MO 당월 데이터" },
      { key: "keywordsMo", label: "MO 클릭 키워드 TOP 20", layout: "split", splitAt: 10, fontSize: 8 },
      { key: "hourlyMo", label: "시간대별 데이터 (모바일)", layout: "split", splitAt: 12 },
      { key: "pcSummary", label: "PC 당월 데이터" },
      { key: "keywordsPc", label: "PC 클릭 키워드 TOP 20", layout: "split", splitAt: 10, fontSize: 8 },
      { key: "hourlyPc", label: "시간대별 데이터 (PC)", layout: "split", splitAt: 12 },
    ],
    // 여러 표를 한 슬라이드에 몰아넣지 않고, 원래 합의했던 구성대로 슬라이드를 분리한다.
    // (개요 1장 + 아래 5개 그룹 각 1장씩 = 총 6장)
    slideGroups: [
      { title: "PC / 모바일 매체 비중", type: "mediaBreakdown", mergeIntoOverview: true },
      { title: "MO 클릭 키워드 TOP 20", tableKeys: ["moSummary", "keywordsMo"] },
      { title: "시간대별 데이터 (모바일)", tableKeys: ["hourlyMo"] },
      { title: "PC 클릭 키워드 TOP 20", tableKeys: ["pcSummary", "keywordsPc"] },
      { title: "시간대별 데이터 (PC)", tableKeys: ["hourlyPc"] },
    ],
    images: [{ key: "exposureCapture", label: "노출 페이지 캡쳐 이미지 첨부 공간" }],
    uploads: [
      { key: "keywordCsv", label: "키워드 리포트 CSV (PC/모바일 매체,키워드,노출수,클릭수,클릭률,평균CPC,총비용)", parser: "naverKeywords" },
      { key: "hourlyCsv", label: "시간대별 리포트 CSV (매체,시간대,노출수,클릭수,클릭률,평균CPC,총비용)", parser: "naverHourly" },
    ],
  },
  {
    id: "naverDisplay",
    kicker: "NAVER 디스플레이",
    title: "네이버 디스플레이 (배너)",
    kpis: [
      { key: "impressions", label: "노출수" },
      { key: "clicks", label: "클릭수" },
      { key: "ctr", label: "CTR" },
      { key: "cpc", label: "CPC" },
      { key: "cost", label: "광고비" },
    ],
    tables: [{ key: "campaigns", label: "캠페인별 성과" }],
    images: [{ key: "creative", label: "소재 이미지 첨부 공간" }],
    uploads: [{ key: "reportCsv", label: "네이버 디스플레이 캠페인 보고서 CSV·엑셀 (캠페인 이름/총비용/노출수/평균 CPM/클릭수/평균 CPC/클릭률)", parser: "naverDisplay" }],
  },
  {
    id: "naverPowerContent",
    kicker: "NAVER 파워컨텐츠",
    title: "네이버 파워컨텐츠 (블로그) 광고",
    kpis: [
      { key: "impressions", label: "노출수" },
      { key: "clicks", label: "클릭수" },
      { key: "cost", label: "광고비" },
    ],
    tables: [{ key: "campaigns", label: "캠페인별 인사이트" }],
    images: [],
    uploads: [{ key: "reportCsv", label: "캠페인 리포트 CSV", parser: "generic", targetTable: "campaigns" }],
  },
  {
    id: "naverPlace",
    kicker: "NAVER 플레이스",
    title: "네이버 플레이스 광고",
    kpis: [
      { key: "impressions", label: "노출수" },
      { key: "clicks", label: "클릭수" },
      { key: "ctr", label: "CTR" },
      { key: "cpc", label: "CPC" },
      { key: "cost", label: "광고비" },
    ],
    tables: [{ key: "campaigns", label: "캠페인별 성과" }],
    images: [{ key: "creative", label: "소재 이미지 첨부 공간" }],
    // 전환/매출 관련 열은 값이 전부 0이면 파서가 자동으로 제외한다 (결과값 있는 항목만 표시)
    uploads: [{ key: "reportCsv", label: "캠페인 보고서 CSV (네이버 플레이스광고 관리자 다운로드)", parser: "naverPlace" }],
  },
  {
    id: "brandBlog",
    kicker: "브랜드 블로그",
    title: "브랜드 블로그",
    kpis: [],
    tables: [
      { key: "posts", label: "포스팅 현황" },
      { key: "weeklyInflow", label: "주간/월간 유입", layout: "weeklyInflow" },
      { key: "inflowKeywords", label: "유입 키워드", layout: "split", splitAt: 5 },
    ],
    images: [],
    slideGroups: [
      { title: "포스팅 현황", tableKeys: ["posts"] },
      { title: "유입 분석", tableKeys: ["weeklyInflow", "inflowKeywords"] },
    ],
    // 예전엔 CSV/엑셀 파일 업로드로 받았지만, 지금은 붙여넣기(ChannelPanel의 3개 텍스트 박스)로
    // 대체했다 — 업로드가 잘 안 되는 문제가 있었고, 네이버 통계 페이지를 그대로 복사해서
    // 붙여넣는 게 더 간단하기 때문. uploads를 비워두면 공용 "파일 업로드" 섹션이 안 뜬다.
    uploads: [],
  },
  {
    id: "cafeViral",
    kicker: "카페 바이럴",
    title: "카페 바이럴",
    kpis: [{ key: "postCount", label: "이번 달 포스팅 건수" }],
    tables: [{ key: "posts", label: "포스팅 리스트" }],
    images: [{ key: "capture", label: "포스팅 캡쳐 이미지 첨부 공간" }],
    uploads: [{ key: "postsCsv", label: "포스팅 리스트 CSV (제목/URL/작성일)", parser: "generic", targetTable: "posts" }],
  },
  {
    id: "kakaoMoment",
    kicker: "카카오모먼트",
    title: "카카오모먼트",
    kpis: [
      { key: "impressions", label: "노출수 합계" },
      { key: "clicks", label: "클릭수 합계" },
      { key: "cost", label: "광고비 합계" },
    ],
    tables: [{ key: "campaigns", label: "캠페인별 성과" }],
    images: [{ key: "creative", label: "소재 이미지 첨부 공간" }],
    uploads: [{ key: "campaignCsv", label: "캠페인 리포트 CSV", parser: "kakao" }],
  },
  {
    id: "googleAds",
    kicker: "GOOGLE 광고",
    title: "구글 광고",
    kpis: [
      { key: "impressions", label: "노출수" },
      { key: "clicks", label: "클릭수" },
      { key: "cost", label: "광고비" },
    ],
    tables: [{ key: "monthlyCompare", label: "캠페인 유형별 성과" }],
    images: [{ key: "creative", label: "소재 이미지 첨부 공간" }],
    uploads: [{ key: "reportCsv", label: "캠페인 보고서 CSV (Google Ads 내보내기)", parser: "googleAds" }],
  },
];

// naverSearch 전용: "PC / 모바일 매체 비중" 그룹에서 쓰는 표.
export function buildNaverMediaBreakdownTable(data) {
  const pcRow = data.tables?.pcSummary?.[1];
  const moRow = data.tables?.moSummary?.[1];
  const mediaTable = [["매체", "노출수", "클릭수", "CTR", "CPC", "광고비"]];
  if (moRow) mediaTable.push(["모바일(MO)", ...moRow.slice(1)]);
  if (pcRow) mediaTable.push(["PC", ...pcRow.slice(1)]);
  return { mediaTable };
}

export function emptyChannelData() {
  const data = {};
  for (const ch of CHANNELS) {
    data[ch.id] = { kpis: {}, tables: {}, images: {} };
  }
  return data;
}

// 채널에 아무 데이터도 없으면 보고서에서 자동 제외 (4-1번 규칙)
export function isChannelActive(channelData, channel) {
  if (!channelData) return false;
  const hasKpi = Object.values(channelData.kpis || {}).some((v) => v && String(v).trim() !== "");
  const hasTable = Object.values(channelData.tables || {}).some((t) => t && t.length > 0);
  const hasImage = Object.values(channelData.images || {}).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
  return hasKpi || hasTable || hasImage;
}
