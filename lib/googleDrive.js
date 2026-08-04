"use client";

// ============================================================================
// Google Drive 저장 기능
// - Google Identity Services(GIS)로 브라우저에서 바로 로그인/토큰 발급 (서버 불필요)
// - scope: drive.file  → 이 앱이 만든 파일에만 접근 (드라이브 전체를 보는 권한이 아님, 더 안전)
// - 사용하려면 Google Cloud Console에서 OAuth Client ID를 만들어
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수로 등록해야 함 (README 참고)
// ============================================================================

const SCOPE = "https://www.googleapis.com/auth/drive.file";
let gisLoaded = false;
let tokenClient = null;
let cachedToken = null;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (gisLoaded && window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => {
        gisLoaded = true;
        resolve();
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Google Identity Services 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export async function getAccessToken(clientId) {
  if (!clientId) {
    throw new Error(
      "Google Client ID가 설정되지 않았습니다. Vercel 프로젝트 설정에서 NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수를 추가해주세요 (README 참고)."
    );
  }
  await loadGisScript();

  if (cachedToken) return cachedToken;

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: () => {}, // overridden per-request below
      });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(`Google 인증 실패: ${resp.error}`));
        return;
      }
      cachedToken = resp.access_token;
      // 토큰은 보통 1시간 유효. 만료되면 다음 저장 시 다시 로그인 창이 뜸.
      setTimeout(() => {
        cachedToken = null;
      }, 55 * 60 * 1000);
      resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: cachedToken ? "" : "consent" });
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Drive에 파일 업로드. folderId가 있으면 그 폴더 안에, 없으면 내 드라이브 최상위에 저장.
 * asGoogleSlides가 true면, 업로드하면서 구글 슬라이드 네이티브 형식으로 자동 변환해서 저장한다
 * (Drive API가 pptx → Google Slides 변환을 지원함. false면 pptx 파일 그대로 저장).
 *
 * 참고: multipart 업로드는 브라우저 FormData가 아니라, Drive API가 요구하는
 * "multipart/related" 형식을 직접 만들어서 보내야 한다. FormData를 쓰면
 * 브라우저가 자동으로 "multipart/form-data"로 보내버려서 Drive가 400 Bad Request로
 * 거부하는 문제가 있었다.
 *
 * 반환값: { id, webViewLink }
 */
export async function uploadBlobToDrive({ accessToken, blob, fileName, folderId, asGoogleSlides = false }) {
  const displayName = asGoogleSlides ? fileName.replace(/\.pptx$/i, "") : fileName;
  const metadata = {
    name: displayName,
    mimeType: asGoogleSlides
      ? "application/vnd.google-apps.presentation"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = `tripicka-boundary-${Date.now()}`;
  const fileBase64 = await blobToBase64(blob);
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${fileBase64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive 업로드 실패 (${res.status}): ${errText}`);
  }
  return res.json();
}

/** 폴더 URL이나 ID를 붙여넣어도 알아서 ID만 뽑아내기 */
export function extractFolderId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed; // 이미 순수 ID를 붙여넣은 경우
}
