# TRIPICKA 마케팅 보고서 생성기

호텔별 월간 마케팅 운영 보고서를 웹에서 채워 넣고, TRIPICKA 표준 디자인으로 미리보기 + PPTX 다운로드까지
할 수 있는 앱입니다. 채널별로 데이터를 입력/업로드하면 그 채널만 보고서에 나타나고, 아무것도 입력하지
않은 채널은 자동으로 빠집니다 (Cowork 지침 문서 4-1번 규칙을 그대로 구현).

## 로컬에서 실행해보기

```bash
npm install
npm run dev
```
브라우저에서 http://localhost:3000 접속.

## GitHub에 올리기

1. GitHub에서 새 저장소 생성 (예: `tripicka-report-app`)
2. 이 폴더에서:
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/{내계정}/tripicka-report-app.git
git push -u origin main
```

## Vercel에 배포하기

**방법 A (GitHub 연동, 권장)**
1. vercel.com 로그인 → "Add New Project"
2. 방금 만든 GitHub 저장소 선택 → Import
3. 설정 그대로 두고 "Deploy" 클릭 (Next.js는 자동 인식됨)
4. 이후 GitHub에 코드를 푸시할 때마다 자동으로 재배포됩니다

**방법 B (계정/깃 없이 바로)**
1. vercel.com 로그인 → "Add New Project" → "Deploy without Git" (또는 CLI: `npx vercel`)
2. 이 프로젝트 폴더를 그대로 업로드/드래그

## 임시저장 (자동 저장)

입력하신 내용(호텔명, 채널별 데이터 등)은 브라우저의 localStorage에 자동으로 저장됩니다.
페이지를 새로고침하거나 나갔다 다시 들어와도 그대로 남아있습니다. 새로 시작하고 싶으면
왼쪽 패널의 "임시저장 지우고 새로 시작하기"를 누르면 됩니다.

- 이 저장은 **그 브라우저/그 컴퓨터에만** 남습니다 (다른 사람과 공유되지 않음, 서버에 안 올라감).
- 이미지를 여러 개 첨부하면 브라우저 저장 용량 한도(보통 5~10MB)를 넘어 저장이 실패할 수 있어요 —
  이 경우 콘솔에 경고만 남고 앱은 정상 작동하니, 다운로드/Drive 저장부터 먼저 하시는 걸 권장합니다.

## Google Drive에 직접 저장하기 (선택 기능)

PPTX를 다운로드하는 대신, 버튼 하나로 Google Drive에 바로 저장할 수 있습니다. 이건 사장님의
Google 계정으로 직접 인증하는 방식이라, 아래 설정을 **한 번만** 해두시면 됩니다.

### 설정 방법 (Google Cloud Console, 최초 1회)

1. [console.cloud.google.com](https://console.cloud.google.com) 접속 → 새 프로젝트 생성 (이름 아무거나, 예: "tripicka-report")
2. 좌측 메뉴 **"API 및 서비스" → "라이브러리"** → "Google Drive API" 검색 → **사용 설정**
3. **"API 및 서비스" → "OAuth 동의 화면"**
   - User Type: **외부(External)** 선택 → 만들기
   - 앱 이름/이메일 등 필수 항목만 채우고 저장 (게시 상태는 "테스트"로 두어도 본인 계정은 계속 사용 가능)
4. **"API 및 서비스" → "사용자 인증 정보" → "+ 사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"**
   - 애플리케이션 유형: **웹 애플리케이션**
   - "승인된 자바스크립트 원본"에 Vercel 배포 주소 추가 (예: `https://monthly-report-xxxx.vercel.app`)
     - 로컬에서 테스트하려면 `http://localhost:3000`도 추가
   - 만들기 → **클라이언트 ID** 복사 (`xxxxx.apps.googleusercontent.com` 형태)
5. Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**
   - Key: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - Value: 방금 복사한 클라이언트 ID
   - 저장 후 **재배포**(Deployments 탭에서 최신 배포 옆 "..." → Redeploy)

### 사용 방법
1. 앱에서 (선택) 저장하고 싶은 Drive 폴더를 웹브라우저로 열어서 주소창 URL을 그대로 복사해
   "저장할 폴더 URL 또는 ID" 칸에 붙여넣기 — 비워두면 내 드라이브 최상위에 저장됩니다
2. **"Google Drive에 저장"** 클릭 → 처음엔 Google 로그인 팝업이 뜸 → 로그인/권한 허용
3. 저장 완료되면 "Drive에서 열기" 링크가 나타남

이 앱은 `drive.file` 권한만 요청합니다 — 즉 **이 앱이 만든 파일에만 접근**하고, 기존 드라이브
파일은 보거나 건드릴 수 없습니다 (더 안전한 최소 권한).



## 채널 추가/수정하기

`lib/channels.js` 파일 하나만 수정하면 전체 앱에 반영됩니다. 배열에 항목을 추가/수정하면
왼쪽 업로드 패널, 오른쪽 미리보기, PPTX 다운로드에 자동으로 반영됩니다.

## 디자인 시스템

- 컬러: 오렌지(#E8562C) · 네이비(#1B1B2F) · 크림카드(#F3EFE9) · 회색텍스트(#4B5563)
- 폰트: Noto Sans KR
- 관련 컴포넌트: `components/ReportUI.jsx`

이 값들은 Cowork로 만들던 pptxgenjs 스크립트와 동일한 디자인 토큰입니다. 색상을 바꾸려면
`tailwind.config.js`와 `lib/pptxExport.js` 상단의 색상 값을 함께 수정하세요.

## 알아두실 점 (한계)

- 이 앱은 채널별로 **실제 검증된 파일 포맷을 자동으로 인식해서 계산**합니다:
  - 네이버 검색광고 키워드 리포트 CSV → PC/모바일 집계 + TOP20 키워드 자동 정렬
  - 네이버 검색광고 시간대별 리포트 CSV → 00~23시 표 자동 생성 (없는 시간대는 "-")
  - 카카오모먼트 캠페인 리포트 CSV → 노출/클릭/비용 합계 자동 계산
  - 블로그체험단 리스트 CSV → 이름/일방문자/포스팅URL/상위노출 자동 매핑
  - 이 4개는 SL호텔강릉 실제 파일로 결과값까지 대조 검증했습니다 (`lib/parsers/`).
- 나머지 5개 채널(네이버 디스플레이·파워컨텐츠, 브랜드블로그, 카페바이럴, 구글광고)은 아직
  실제 원본 파일을 본 적이 없어서, 헤더에서 "노출/클릭/비용" 같은 흔한 열 이름을 찾아
  자동 계산하는 **범용 파서**를 씁니다 (`lib/parsers/generic.js`). 실제 파일을 받아보시면
  전용 파서로 업그레이드할 수 있습니다.
- 자동 계산된 KPI 숫자는 모두 **입력창에 다시 표시되어 직접 수정 가능**합니다 — 자동 계산이
  틀렸다 싶으면 그 자리에서 바로 고치면 됩니다.
- 이 앱은 네이버/카카오/인스타그램에서 데이터를 직접 긁어오지는 않습니다 — 각 채널 관리자
  페이지에서 CSV를 받아 이 앱에 업로드하는 방식입니다.
