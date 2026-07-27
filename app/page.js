"use client";

import { useState } from "react";
import { CHANNELS, emptyChannelData, isChannelActive } from "../lib/channels";
import ChannelPanel from "../components/ChannelPanel";
import ChannelReportSection from "../components/ChannelReportSection";
import { CoverPage, SummaryPage, ClosingPage } from "../components/FixedSections";
import { exportPptx } from "../lib/pptxExport";

export default function Page() {
  const [hotelName, setHotelName] = useState("");
  const [month, setMonth] = useState("");
  const [channelData, setChannelData] = useState(emptyChannelData());
  const [exporting, setExporting] = useState(false);

  const activeChannels = CHANNELS.filter((ch) => isChannelActive(channelData[ch.id], ch));

  function updateChannel(id, next) {
    setChannelData((prev) => ({ ...prev, [id]: next }));
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportPptx({ hotelName, month, channels: CHANNELS, channelData });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left: edit panel */}
      <div className="w-[420px] shrink-0 border-r border-lightgray h-screen overflow-y-auto p-5 bg-[#FAF8F5]">
        <div className="text-orange font-bold text-lg tracking-widest mb-1">TRIPICKA</div>
        <div className="text-navy font-bold text-xl mb-4">마케팅 보고서 생성기</div>

        <div className="space-y-2 mb-5">
          <input
            placeholder="호텔명 (예: SL호텔강릉)"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
            className="border border-lightgray rounded-md px-3 py-2 text-sm w-full"
          />
          <input
            placeholder="보고 월 (예: 2026년 7월)"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-lightgray rounded-md px-3 py-2 text-sm w-full"
          />
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-orange text-white font-bold rounded-md py-2.5 mb-5 disabled:opacity-50"
        >
          {exporting ? "생성 중..." : "PPTX 다운로드"}
        </button>

        <div className="text-xs text-muted mb-2">
          채널별로 데이터를 입력/업로드하세요. 아무것도 채우지 않은 채널은 보고서에서 자동으로 빠집니다.
        </div>

        {CHANNELS.map((ch) => (
          <ChannelPanel
            key={ch.id}
            channel={ch}
            data={channelData[ch.id]}
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
