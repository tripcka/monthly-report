"use client";

import { useState } from "react";
import { CHANNELS, emptyChannelData, isChannelActive } from "../lib/channels";
import ChannelPanel from "../components/ChannelPanel";
import ChannelReportSection from "../components/ChannelReportSection";
import { CoverPage, SummaryPage, ClosingPage } from "../components/FixedSections";
import { exportPptx } from "../lib/pptxExport";
import { exportPreviewPptx } from "../lib/previewPptxExport";
import { useDraft } from "../lib/useDraft";
import { getAccessToken, uploadBlobToDrive, extractFolderId, uploadJsonToDrive, listDraftsFromDrive, downloadJsonFromDrive, deleteFileFromDrive } from "../lib/googleDrive";

const DEFAULT_STATE = {
  hotelName: "",
  month: "",
  driveFolderInput: "",
  channelData: emptyChannelData(),
  hiddenSlides: [], // 사용자가 "이 슬라이드 삭제"로 숨긴 슬라이드 ID 목록 (JSON 저장을 위해 배열로 보관)
};

// 저장된 초안(localStorage)이 이전 버전의 채널 구성으로 만들어졌을 수 있으므로
// (예: 그 사이에 "네이버 플레이스 광고" 같은 채널이 새로 추가됨), 복원 시 현재 CHANNELS
// 기준으로 채널별 데이터가 다 있는지 보정한다. 없는 채널은 빈 데이터로 채우고,
// 지금은 없는(삭제된) 채널의 예전 데이터는 조용히 버린다.
function migrateDraft(saved, defaults) {
  const savedChannelData = saved?.channelData || {};
  const channelData = {};
  for (const ch of CHANNELS) {
    const savedForChannel = savedChannelData[ch.id];
    const savedTables = { ...(savedForChannel?.tables || {}) };
    // 광고 인사이트가 3개 고정이던 이전 초안은 새 구조의 첫 번째 피드로 자동 이관한다.
    if (ch.id === "instagram" && savedTables.adInsights && !savedTables.adInsights1) {
      savedTables.adInsights1 = savedTables.adInsights;
    }
    channelData[ch.id] = {
      kpis: { ...(savedForChannel?.kpis || {}) },
      tables: savedTables,
      images: { ...(savedForChannel?.images || {}) },
    };
  }
  return { ...defaults, ...saved, channelData };
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// 같은 호텔·같은 달로 "Drive에 임시저장"을 여러 번 누르면 파일이 계속 늘어나지 않도록,
// 어떤 (호텔,달) 조합을 어떤 Drive 파일ID에 마지막으로 저장했는지 브라우저에 기억해둔다.
// (이 정보 자체는 데이터가 아니라 "어디에 저장했는지" 포인터라 useDraft와 분리해서 관리)
const DRAFT_ID_MAP_KEY = "tripicka-draft-drive-ids";

function draftMapKey(hotelName, month) {
  return `${(hotelName || "").trim()}|${(month || "").trim()}`;
}
function getTrackedDraftId(hotelName, month) {
  try {
    const map = JSON.parse(window.localStorage.getItem(DRAFT_ID_MAP_KEY) || "{}");
    return map[draftMapKey(hotelName, month)] || null;
  } catch {
    return null;
  }
}
function setTrackedDraftId(hotelName, month, fileId) {
  try {
    const map = JSON.parse(window.localStorage.getItem(DRAFT_ID_MAP_KEY) || "{}");
    map[draftMapKey(hotelName, month)] = fileId;
    window.localStorage.setItem(DRAFT_ID_MAP_KEY, JSON.stringify(map));
  } catch {
    // localStorage 접근 실패는 조용히 무시 — 다음 저장 때 새 파일이 하나 더 생기는 정도의 부작용뿐
  }
}
function clearTrackedDraftIdByFileId(fileId) {
  try {
    const map = JSON.parse(window.localStorage.getItem(DRAFT_ID_MAP_KEY) || "{}");
    const nextMap = Object.fromEntries(Object.entries(map).filter(([, id]) => id !== fileId));
    window.localStorage.setItem(DRAFT_ID_MAP_KEY, JSON.stringify(nextMap));
  } catch {
    // 무시 — 지워진 파일ID가 다음 저장 때 한 번 404 나고 자동으로 새로 만들어질 뿐 큰 문제 없음
  }
}

export default function Page() {
  const [state, setState, clearDraft, restored] = useDraft(DEFAULT_STATE, migrateDraft);
  const [exporting, setExporting] = useState(null); // 'preview' | 'editable' | null
  const [driveStatus, setDriveStatus] = useState(null); // { type: 'saving'|'done'|'error', message }
  const [saveAsGoogleSlides, setSaveAsGoogleSlides] = useState(true);
  const [drivePptxMode, setDrivePptxMode] = useState("preview");
  const [draftSyncStatus, setDraftSyncStatus] = useState(null);
  const [draftList, setDraftList] = useState(null); // null=아직 안 불러옴, [] 이상=목록
  const [showDraftPicker, setShowDraftPicker] = useState(false);

  const { hotelName, month, channelData, driveFolderInput, hiddenSlides } = state;
  const hiddenSlidesSet = new Set(hiddenSlides || []);

  function handleToggleSlide(slideId) {
    setState((prev) => {
      const current = new Set(prev.hiddenSlides || []);
      if (current.has(slideId)) current.delete(slideId);
      else current.add(slideId);
      return { ...prev, hiddenSlides: [...current] };
    });
  }
  const activeChannels = CHANNELS.filter((ch) => isChannelActive(channelData[ch.id], ch));

  function patch(partial) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function updateChannel(id, next) {
    setState((prev) => ({ ...prev, channelData: { ...prev.channelData, [id]: next } }));
  }

  async function handleDownload(mode) {
    setExporting(mode);
    try {
      if (mode === "preview") {
        await exportPreviewPptx({ hotelName, month });
      } else {
        await exportPptx({ hotelName, month, channels: CHANNELS, channelData, hiddenSlides: hiddenSlidesSet });
      }
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setExporting(null);
    }
  }

  async function handleSaveToDrive() {
    setDriveStatus({ type: "saving", message: "Google 로그인 확인 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      setDriveStatus({ type: "saving", message: "보고서 생성 중..." });
      const { blob, fileName } = drivePptxMode === "preview"
        ? await exportPreviewPptx({ hotelName, month, outputType: "blob" })
        : await exportPptx({ hotelName, month, channels: CHANNELS, channelData, outputType: "blob", hiddenSlides: hiddenSlidesSet });
      setDriveStatus({ type: "saving", message: "Google Drive에 업로드 중..." });
      const folderId = extractFolderId(driveFolderInput);
      const result = await uploadBlobToDrive({ accessToken: token, blob, fileName, folderId, asGoogleSlides: saveAsGoogleSlides });
      setDriveStatus({
        type: "done",
        message: "저장 완료!",
        link: result.webViewLink,
      });
    } catch (e) {
      setDriveStatus({ type: "error", message: e.message || String(e) });
    }
  }

  async function handleSaveDraftToDrive() {
    if (!hotelName.trim() || !month.trim()) {
      setDraftSyncStatus({ type: "error", message: "호텔명과 보고 월을 먼저 입력해 주세요 (임시저장 파일명·구분 기준입니다)." });
      return;
    }
    setDraftSyncStatus({ type: "saving", message: "Google 로그인 확인 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      setDraftSyncStatus({ type: "saving", message: "Drive에 저장 중..." });
      const folderId = extractFolderId(driveFolderInput);
      const fileName = `${hotelName}_${month}_임시저장.json`;
      const existingId = getTrackedDraftId(hotelName, month);
      let result;
      try {
        result = await uploadJsonToDrive({ accessToken: token, data: state, fileName, folderId, fileId: existingId });
      } catch (e) {
        // 기억해둔 fileId가 더 이상 유효하지 않으면(삭제됨 등) 새 파일로 다시 시도
        if (existingId && (e.status === 404 || e.status === 403)) {
          result = await uploadJsonToDrive({ accessToken: token, data: state, fileName, folderId });
        } else {
          throw e;
        }
      }
      setTrackedDraftId(hotelName, month, result.id);
      setDraftSyncStatus({ type: "done", message: "임시저장 완료! 다른 기기·브라우저에서도 아래 '불러오기'로 이어서 작업할 수 있어요.", link: result.webViewLink });
      setDraftList(null); // 목록 캐시 무효화 (다음에 열 때 새로 불러오도록)
    } catch (e) {
      setDraftSyncStatus({ type: "error", message: e.message || String(e) });
    }
  }

  async function handleOpenDraftPicker() {
    setShowDraftPicker(true);
    if (draftList !== null) return; // 이미 불러온 목록 있으면 재사용
    setDraftSyncStatus({ type: "saving", message: "임시저장 목록 불러오는 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      const files = await listDraftsFromDrive({ accessToken: token });
      setDraftList(files);
      setDraftSyncStatus(null);
    } catch (e) {
      setDraftSyncStatus({ type: "error", message: e.message || String(e) });
    }
  }

  async function handleLoadDraft(fileId) {
    setDraftSyncStatus({ type: "saving", message: "불러오는 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      const data = await downloadJsonFromDrive({ accessToken: token, fileId });
      setState(migrateDraft(data, DEFAULT_STATE));
      setShowDraftPicker(false);
      setDraftSyncStatus({ type: "done", message: `"${data.hotelName || "-"} · ${data.month || "-"}" 불러왔습니다.` });
    } catch (e) {
      setDraftSyncStatus({ type: "error", message: e.message || String(e) });
    }
  }

  async function handleDeleteDraft(fileId, name) {
    if (!window.confirm(`"${name}" 임시저장을 Drive에서 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDraftSyncStatus({ type: "saving", message: "삭제 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      await deleteFileFromDrive({ accessToken: token, fileId });
      clearTrackedDraftIdByFileId(fileId);
      setDraftList((current) => (current || []).filter((f) => f.id !== fileId));
      setDraftSyncStatus({ type: "done", message: `"${name}" 삭제했습니다.` });
    } catch (e) {
      setDraftSyncStatus({ type: "error", message: e.message || String(e) });
    }
  }

  if (!restored) return null; // 임시저장 복원 전 깜빡임 방지

  return (
    <div className="flex h-screen">
      {/* Left: edit panel */}
      <div className="w-[420px] shrink-0 border-r border-lightgray h-screen overflow-y-auto p-5 bg-[#FAF8F5]">
        <div className="flex items-center justify-between mb-1">
          <div className="text-orange font-bold text-lg tracking-widest">TRIPICKA</div>
          <span className="text-[10px] text-muted">자동 임시저장됨</span>
        </div>
        <div className="text-navy font-bold text-xl mb-4">마케팅 보고서 생성기</div>

        <div className="space-y-2 mb-3">
          <input
            placeholder="호텔명 (예: SL호텔강릉)"
            value={hotelName}
            onChange={(e) => patch({ hotelName: e.target.value })}
            className="border border-lightgray rounded-md px-3 py-2 text-sm w-full"
          />
          <input
            placeholder="보고 월 (예: 2026년 7월)"
            value={month}
            onChange={(e) => patch({ month: e.target.value })}
            className="border border-lightgray rounded-md px-3 py-2 text-sm w-full"
          />
        </div>

        <button
          onClick={() => {
            if (confirm("임시저장된 내용을 전부 지우고 새로 시작할까요?")) clearDraft();
          }}
          className="w-full text-xs text-muted underline mb-4"
        >
          임시저장 지우고 새로 시작하기
        </button>

        <div className="space-y-2 mb-3">
          <button
            onClick={() => handleDownload("preview")}
            disabled={!!exporting}
            className="w-full bg-orange text-white font-bold rounded-md py-2.5 disabled:opacity-50"
          >
            {exporting === "preview" ? "미리보기 캡처 중..." : "미리보기 그대로 PPTX"}
          </button>
          <button
            onClick={() => handleDownload("editable")}
            disabled={!!exporting}
            className="w-full bg-white text-navy border border-navy font-bold rounded-md py-2.5 disabled:opacity-50"
          >
            {exporting === "editable" ? "편집형 생성 중..." : "편집 가능한 PPTX"}
          </button>
          <div className="text-[10px] text-muted leading-relaxed">
            미리보기 그대로 PPTX는 화면과 동일하지만 슬라이드 안의 글자·표를 개별 편집할 수 없습니다.
          </div>
        </div>

        <div className="border border-lightgray rounded-md p-3 mb-5 bg-white">
          <div className="text-xs font-bold text-graytxt mb-2">Google Drive에 저장</div>
          <input
            placeholder="저장할 폴더 URL 또는 ID (비우면 내 드라이브 최상위)"
            value={driveFolderInput}
            onChange={(e) => patch({ driveFolderInput: e.target.value })}
            className="border border-lightgray rounded-md px-3 py-2 text-xs w-full mb-2"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="flex items-center gap-1.5 text-[11px] text-graytxt cursor-pointer">
              <input
                type="radio"
                name="drivePptxMode"
                checked={drivePptxMode === "preview"}
                onChange={() => setDrivePptxMode("preview")}
              />
              미리보기 그대로
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-graytxt cursor-pointer">
              <input
                type="radio"
                name="drivePptxMode"
                checked={drivePptxMode === "editable"}
                onChange={() => setDrivePptxMode("editable")}
              />
              편집 가능
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-graytxt mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsGoogleSlides}
              onChange={(e) => setSaveAsGoogleSlides(e.target.checked)}
            />
            구글 슬라이드로 변환해서 저장 (체크 해제 시 PPTX 파일 그대로 저장)
          </label>
          {saveAsGoogleSlides && (
            <div className="text-[10px] text-muted mb-2">
              변환 과정에서 표/폰트 간격이 원본 PPTX와 미세하게 달라질 수 있습니다.
            </div>
          )}
          <button
            onClick={handleSaveToDrive}
            disabled={driveStatus?.type === "saving"}
            className="w-full bg-navy text-white font-bold rounded-md py-2.5 text-sm disabled:opacity-50"
          >
            {driveStatus?.type === "saving" ? driveStatus.message : "Google Drive에 저장"}
          </button>
          {driveStatus?.type === "done" && (
            <div className="text-xs text-green-700 mt-2">
              ✓ 저장 완료 —{" "}
              <a href={driveStatus.link} target="_blank" rel="noreferrer" className="underline">
                Drive에서 열기
              </a>
            </div>
          )}
          {driveStatus?.type === "error" && (
            <div className="text-xs text-red-600 mt-2 whitespace-pre-wrap">⚠ {driveStatus.message}</div>
          )}
          {!GOOGLE_CLIENT_ID && (
            <div className="text-[10px] text-muted mt-2">
              (Google 저장 기능을 쓰려면 배포 환경에 NEXT_PUBLIC_GOOGLE_CLIENT_ID 설정 필요 — README 참고)
            </div>
          )}
        </div>

        <div className="border border-lightgray rounded-md p-3 mb-5 bg-white">
          <div className="text-xs font-bold text-graytxt mb-1">임시저장 (Drive에서 이어서 작업하기)</div>
          <div className="text-[10px] text-muted mb-2">
            지금 입력한 내용(업로드한 표·이미지 포함) 전체를 Drive에 저장합니다. 같은 호텔·같은 달로 다시
            저장하면 새 파일을 또 만들지 않고 기존 파일을 덮어써요. 다른 컴퓨터·브라우저에서도 아래
            "불러오기"로 이어서 작업할 수 있습니다 (자동 임시저장은 이 브라우저에만 남는 것과 달리, 이건
            Drive를 거쳐 어디서든 불러올 수 있어요).
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSaveDraftToDrive}
              disabled={draftSyncStatus?.type === "saving"}
              className="bg-navy text-white font-bold rounded-md py-2 text-xs disabled:opacity-50"
            >
              {draftSyncStatus?.type === "saving" ? "저장 중..." : "Drive에 임시저장"}
            </button>
            <button
              onClick={handleOpenDraftPicker}
              disabled={draftSyncStatus?.type === "saving"}
              className="bg-white text-navy border border-navy font-bold rounded-md py-2 text-xs disabled:opacity-50"
            >
              Drive에서 불러오기
            </button>
          </div>
          {draftSyncStatus?.type === "done" && (
            <div className="text-xs text-green-700 mt-2">✓ {draftSyncStatus.message}</div>
          )}
          {draftSyncStatus?.type === "error" && (
            <div className="text-xs text-red-600 mt-2 whitespace-pre-wrap">⚠ {draftSyncStatus.message}</div>
          )}

          {showDraftPicker && (
            <div className="mt-3 border-t border-lightgray pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-graytxt">임시저장 목록</div>
                <button onClick={() => setShowDraftPicker(false)} className="text-[11px] text-muted underline">
                  닫기
                </button>
              </div>
              {draftList === null && draftSyncStatus?.type === "saving" && (
                <div className="text-xs text-muted">불러오는 중...</div>
              )}
              {draftList?.length === 0 && (
                <div className="text-xs text-muted">아직 Drive에 저장된 임시저장 파일이 없습니다.</div>
              )}
              {draftList && draftList.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {draftList.map((f) => {
                    const displayName = f.name.replace(/_임시저장\.json$/, "");
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 border border-lightgray rounded-md px-2.5 py-2 text-xs hover:bg-card"
                      >
                        <button onClick={() => handleLoadDraft(f.id)} className="flex-1 text-left min-w-0">
                          <div className="font-bold text-navy truncate">{displayName}</div>
                          <div className="text-[10px] text-muted">
                            {new Date(f.modifiedTime).toLocaleString("ko-KR")}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(f.id, displayName)}
                          title="Drive에서 완전히 삭제"
                          className="shrink-0 text-muted hover:text-red-600 text-base leading-none px-1"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted mb-2">
          채널별로 데이터를 입력/업로드하세요. 아무것도 채우지 않은 채널은 보고서에서 자동으로 빠집니다.
        </div>

        {CHANNELS.map((ch) => (
          <ChannelPanel
            key={ch.id}
            channel={ch}
            data={channelData[ch.id]}
            reportMonth={month}
            hotelName={hotelName}
            onChange={(next) => updateChannel(ch.id, next)}
          />
        ))}
      </div>

      {/* Right: live report preview */}
      <div data-report-preview className="flex-1 h-screen overflow-y-auto bg-[#E9E5DE] py-8">
        <div className="space-y-8 flex flex-col items-center">
          {!hiddenSlidesSet.has("cover") && (
            <CoverPage hotelName={hotelName} month={month} onRemove={() => handleToggleSlide("cover")} />
          )}
          {!hiddenSlidesSet.has("summary") && (
            <SummaryPage
              hotelName={hotelName}
              activeChannels={activeChannels}
              channelData={channelData}
              onRemove={() => handleToggleSlide("summary")}
            />
          )}
          {activeChannels.map((ch) => (
            <ChannelReportSection
              key={ch.id}
              channel={ch}
              data={channelData[ch.id]}
              hotelName={hotelName}
              hiddenSlides={hiddenSlidesSet}
              onToggleSlide={handleToggleSlide}
            />
          ))}
          {!hiddenSlidesSet.has("closing") && (
            <ClosingPage hotelName={hotelName} month={month} onRemove={() => handleToggleSlide("closing")} />
          )}
        </div>
      </div>
    </div>
  );
}
