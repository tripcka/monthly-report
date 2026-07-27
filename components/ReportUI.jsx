"use client";

// ============================================================================
// TRIPICKA 디자인 시스템 — pptxgenjs 템플릿과 동일한 색상/스타일을 웹 컴포넌트로 재구현
// 컬러: 오렌지(#E8562C) · 네이비(#1B1B2F) · 크림카드(#F3EFE9) · 회색텍스트(#4B5563)
// 폰트: Noto Sans KR
// ============================================================================

export function PageShell({ dark = false, children }) {
  return (
    <div
      className={`report-page relative w-[1280px] min-h-[720px] mx-auto p-10 ${
        dark ? "bg-navy text-white" : "bg-white text-graytxt"
      }`}
    >
      {children}
    </div>
  );
}

export function PageTitle({ kicker, title }) {
  return (
    <div className="mb-6">
      <div className="text-orange font-bold text-sm tracking-widest mb-1">{kicker}</div>
      <div className="text-navy font-bold text-3xl">{title}</div>
      <div className="mt-3 h-px bg-lightgray" />
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "text-orange" }) {
  return (
    <div className="bg-card border border-lightgray rounded-lg p-4 flex-1 min-w-[180px]">
      <div className="text-graytxt text-xs font-bold mb-2">{label}</div>
      <div className={`text-2xl font-bold mb-2 ${accent}`}>{value || "-"}</div>
      {sub ? <div className="text-graytxt text-[11px] leading-snug">{sub}</div> : null}
    </div>
  );
}

export function StatCardRow({ children }) {
  return <div className="flex gap-3 flex-wrap mb-6">{children}</div>;
}

export function SummaryBox({ title, body }) {
  return (
    <div className="border border-lightgray rounded-md overflow-hidden bg-white">
      <div className="px-3 py-2 font-bold text-navy text-sm">{title}</div>
      <div className="px-3 py-2 text-graytxt text-xs whitespace-pre-line border-t border-lightgray min-h-[70px]">
        {body}
      </div>
    </div>
  );
}

/** 원본 CSV를 그대로 표로 렌더링 (열 자동 감지, 첫 행이 헤더) */
export function CsvTable({ label, rows }) {
  if (!rows || rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);
  return (
    <div className="mb-6">
      {label ? <div className="text-navy font-bold text-sm mb-2">{label}</div> : null}
      <div className="overflow-x-auto border border-lightgray rounded-md">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-navy text-white">
              {header.map((h, i) => (
                <th key={i} className="px-3 py-2 text-center font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-[#FAF8F5]" : "bg-white"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-center border-t border-lightgray whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImageSlot({ label, src }) {
  if (src) {
    return (
      <div className="mb-6">
        <img src={src} alt={label} className="max-h-[260px] rounded-md border border-lightgray mx-auto" />
      </div>
    );
  }
  return (
    <div className="mb-6 border border-dashed border-[#D6D0C6] bg-[#FDFCFB] rounded-md h-[110px] flex items-center justify-center">
      <span className="text-[#B3ABA0] text-xs italic">{label}</span>
    </div>
  );
}

export function Footer({ hotelName }) {
  return (
    <div className="absolute bottom-6 left-10 text-muted text-[10px]">
      TRIPICKA &nbsp;·&nbsp; {hotelName || "[호텔명]"} 마케팅 운영 보고서
    </div>
  );
}
