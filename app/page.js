"use client";

import { useState } from "react";
import { CHANNELS, emptyChannelData, isChannelActive } from "../lib/channels";
import ChannelPanel from "../components/ChannelPanel";
import ChannelReportSection from "../components/ChannelReportSection";
import { CoverPage, SummaryPage, ClosingPage } from "../components/FixedSections";
import { exportPptx } from "../lib/pptxExport";
import { useDraft } from "../lib/useDraft";
import { getAccessToken, uploadBlobToDrive, extractFolderId } from "../lib/googleDrive";

const DEFAULT_STATE = {
  hotelName: "",
  month: "",
  driveFolderInput: "",
  channelData: emptyChannelData(),
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
    channelData[ch.id] = {
      kpis: { ...(savedForChannel?.kpis || {}) },
      tables: { ...(savedForChannel?.tables || {}) },
      images: { ...(savedForChannel?.images || {}) },
    };
  }
  return { ...defaults, ...saved, channelData };
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function Page() {
  const [state, setState, clearDraft, restored] = useDraft(DEFAULT_STATE, migrateDraft);
  const [exporting, setExporting] = useState(false);
  const [driveStatus, setDriveStatus] = useState(null); // { type: 'saving'|'done'|'error', message }

  const { hotelName, month, channelData, driveFolderInput } = state;
  const activeChannels = CHANNELS.filter((ch) => isChannelActive(channelData[ch.id], ch));

  function patch(partial) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function updateChannel(id, next) {
    setState((prev) => ({ ...prev, channelData: { ...prev.channelData, [id]: next } }));
  }

  async function handleDownload() {
    setExporting(true);
    try {
      await exportPptx({ hotelName, month, channels: CHANNELS, channelData });
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveToDrive() {
    setDriveStatus({ type: "saving", message: "Google 로그인 확인 중..." });
    try {
      const token = await getAccessToken(GOOGLE_CLIENT_ID);
      setDriveStatus({ type: "saving", message: "보고서 생성 중..." });
      const { blob, fileName } = await exportPptx({
        hotelName,
        month,
        channels: CHANNELS,
        channelData,
        outputType: "blob",
      });
      setDriveStatus({ type: "saving", message: "Google Drive에 업로드 중..." });
      const folderId = extractFolderId(driveFolderInput);
      const result = await uploadBlobToDrive({ accessToken: token, blob, fileName, folderId });
      setDriveStatus({
        type: "done",
        message: "저장 완료!",
        link: result.webViewLink,
      });
    } catch (e) {
      setDriveStatus({ type: "error", message: e.message || String(e) });
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

        <button
          onClick={handleDownload}
          disabled={exporting}
          className="w-full bg-orange text-white font-bold rounded-md py-2.5 mb-3 disabled:opacity-50"
        >
          {exporting ? "생성 중..." : "PPTX 다운로드"}
        </button>

        <div className="border border-lightgray rounded-md p-3 mb-5 bg-white">
          <div className="text-xs font-bold text-graytxt mb-2">Google Drive에 저장</div>
          <input
            placeholder="저장할 폴더 URL 또는 ID (비우면 내 드라이브 최상위)"
            value={driveFolderInput}
            onChange={(e) => patch({ driveFolderInput: e.target.value })}
            className="border border-lightgray rounded-md px-3 py-2 text-xs w-full mb-2"
          />
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

        <div className="text-xs text-muted mb-2">
          채널별로 데이터를 입력/업로드하세요. 아무것도 채우지 않은 채널은 보고서에서 자동으로 빠집니다.
        </div>

        {CHANNELS.map((ch) => (
          <ChannelPanel
            key={ch.id}
            channel={ch}
            data={channelData[ch.id]}
            reportMonth={month}
            onChange={(next) => updateChannel(ch.id, next)}
          />
        ))}
      </div>

      {/* Right: live report preview */}
      <div className="flex-1 h-screen overflow-y-auto bg-[#E9E5DE] py-8">
        <div className="space-y-8 flex flex-col items-center">
          <CoverPage hotelName={hotelName} month={month} activeChannels={activeChannels} />
          <SummaryPage hotelName={hotelName} activeChannels={activeChannels} channelData={channelData} />
          {activeChannels.map((ch) => (
            <ChannelReportSection key={ch.id} channel={ch} data={channelData[ch.id]} hotelName={hotelName} />
          ))}
          <ClosingPage hotelName={hotelName} month={month} />
        </div>
      </div>
    </div>
  );
}
