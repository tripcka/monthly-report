"use client";

import { PageShell, SummaryBox, Footer } from "./ReportUI";
import { summarizeChannel } from "../lib/summarize";
import { LOGO_WHITE, SYMBOL_WHITE } from "../lib/brandAssets";

export function CoverPage({ hotelName, month, activeChannels }) {
  return (
    <PageShell dark>
      <img src={LOGO_WHITE} alt="Tripicka" className="mt-6 h-8" />
      <div className="mt-40 text-white font-bold text-5xl">{hotelName || "[호텔명]"}</div>
      <div className="mt-4 text-gray-300 text-2xl">월별 마케팅 운영 보고서</div>
      <div className="mt-6 text-orange font-bold text-base">{month || "[YYYY년 M월]"}</div>
      <div className="mt-4 w-16 h-1 bg-orange" />
      <div className="mt-4 text-muted text-sm">
        {activeChannels.map((c) => c.title).join("  ·  ") || "채널을 업로드하면 여기에 표시됩니다"}
      </div>
      <div className="absolute right-14 bottom-14 w-64 h-56 bg-orange rounded-[28px] flex items-center justify-center">
        <img src={SYMBOL_WHITE} alt="" className="w-28 h-28" />
      </div>
    </PageShell>
  );
}

export function SummaryPage({ hotelName, activeChannels, channelData }) {
  return (
    <PageShell>
      <div className="mb-6">
        <div className="text-orange font-bold text-sm tracking-widest mb-1">OVERVIEW</div>
        <div className="text-navy font-bold text-3xl">운영 요약 Summary</div>
        <div className="mt-3 h-px bg-lightgray" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {activeChannels.map((ch) => (
          <SummaryBox key={ch.id} title={ch.title} body={summarizeChannel(ch, channelData[ch.id])} />
        ))}
        {activeChannels.length % 3 !== 0 &&
          Array.from({ length: 3 - (activeChannels.length % 3) }).map((_, i) => (
            <SummaryBox key={`empty-${i}`} title="-" body="-" />
          ))}
      </div>
      <Footer hotelName={hotelName} />
    </PageShell>
  );
}

export function ClosingPage({ hotelName, month }) {
  return (
    <PageShell dark>
      <div className="pt-40">
        <img src={LOGO_WHITE} alt="Tripicka" className="h-8" />
        <div className="mt-4 text-white font-bold text-4xl">감사합니다.</div>
        <div className="mt-4 text-muted text-sm">
          {hotelName || "[호텔명]"} &nbsp;·&nbsp; {month || "[YYYY년 M월]"} 마케팅 운영 보고서
        </div>
      </div>
    </PageShell>
  );
}
