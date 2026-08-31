"use client";

// ============================================================================
// TRIPICKA 디자인 시스템 — pptxgenjs 템플릿과 동일한 색상/스타일을 웹 컴포넌트로 재구현
// 컬러: 오렌지(#E8562C) · 네이비(#1B1B2F) · 크림카드(#F3EFE9) · 회색텍스트(#4B5563)
// 폰트: Noto Sans KR
// ============================================================================

export function PageShell({ dark = false, children, onRemove }) {
  return (
    <div
      className={`report-page relative w-[1280px] h-[720px] overflow-hidden mx-auto p-10 ${
        dark ? "bg-navy text-white" : "bg-white text-graytxt"
      }`}
    >
      {onRemove && (
        <button
          onClick={onRemove}
          className={`export-ignore absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
            dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/5 text-graytxt hover:bg-black/10"
          }`}
          title="이 슬라이드 삭제"
        >
          ✕
        </button>
      )}
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

/** 슬라이드 안에서 섹션을 구분하는 소제목. 큰 제목(PageTitle)은 채널명으로 고정하고,
 * 실제 내용 구분은 이 소제목("■ ...")으로 한다. */
export function SectionTitle({ text }) {
  if (!text) return null;
  return (
    <div className="text-navy font-bold text-base mb-3">
      <span className="text-orange">■</span> {text}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "text-orange" }) {
  return (
    <div className="bg-card border border-lightgray rounded-lg px-4 pt-3 pb-2.5 min-w-0">
      <div className="text-graytxt text-xs font-bold mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${sub ? "mb-1.5" : ""} ${accent}`}>{value || "-"}</div>
      {sub ? <div className="text-graytxt text-[11px] leading-snug">{sub}</div> : null}
    </div>
  );
}

export function StatCardRow({ children }) {
  return (
    <div
      className="grid gap-3 mb-4"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, Array.isArray(children) ? children.length : 1)}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
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
export function CsvTable({ label, rows, noBottomMargin }) {
  if (!rows || rows.length === 0) return null;
  const groupedAdHeader = rows.length >= 3 && rows[0]?.[0] === "구분" && rows[1]?.[0] === "" && rows[2]?.[0] === "타겟";
  if (groupedAdHeader) {
    const body = rows.slice(3);
    return (
      <div className={noBottomMargin ? "" : "mb-6"}>
        {label ? <div className="text-navy font-bold text-sm mb-2"><span className="text-orange">■</span> {label}</div> : null}
        <div className="overflow-hidden border border-lightgray rounded-md">
          <table className="w-full text-xs border-collapse table-fixed">
            <thead className="bg-navy text-white">
              <tr>
                <th rowSpan={3} className="w-[14%] px-3 py-2 border-r border-[#666676]">구분</th>
                <th colSpan={rows[0].length - 1} className="px-3 py-1.5 border-b border-[#666676]">{rows[0][1]}</th>
              </tr>
              <tr>
                <th colSpan={rows[1].length - 1} className="px-3 py-1.5 border-b border-[#666676]">{rows[1][1]}</th>
              </tr>
              <tr>
                {rows[2].slice(1).map((cell, index) => <th key={index} className="px-3 py-1.5 border-l border-[#666676]">{cell}</th>)}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-[#FAF8F5]" : "bg-white"}>
                  {row.map((cell, ci) => <td key={ci} className="px-3 py-1 text-center border-t border-lightgray whitespace-pre-line break-words">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const header = rows[0];
  const body = rows.slice(1);
  return (
    <div className={noBottomMargin ? "" : "mb-6"}>
      {label ? <div className="text-navy font-bold text-sm mb-2"><span className="text-orange">■</span> {label}</div> : null}
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
                  <td key={ci} className="px-3 py-1.5 text-center border-t border-lightgray whitespace-pre-line">
                    {/^https?:\/\//i.test(String(cell || "")) ? (
                      <a href={cell} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                        바로가기
                      </a>
                    ) : cell}
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

export function SplitCsvTable({ label, rows, splitAt }) {
  if (!rows || rows.length <= 1) return null;
  const header = rows[0];
  const dataRows = rows.slice(1);
  const at = splitAt || Math.ceil(dataRows.length / 2);
  const left = [header, ...dataRows.slice(0, at)];
  const right = dataRows.length > at ? [header, ...dataRows.slice(at)] : null;
  return (
    <div className="mb-6">
      {label ? <div className="text-navy font-bold text-sm mb-2"><span className="text-orange">■</span> {label}</div> : null}
      <div className="flex gap-3">
        <div className="flex-1">
          <CsvTable rows={left} />
        </div>
        {right ? (
          <div className="flex-1">
            <CsvTable rows={right} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "주간/월간 유입" 표 전용 렌더러 — 왼쪽은 주차별 방문횟수, 오른쪽은 그 합계("총유입")를
 * 세로로 병합해서 딱 한 번만 보여준다 (네이버 블로그 통계에서 흔히 쓰는 레이아웃).
 * rows의 마지막 행이 ["__TOTAL__", 합계]로 들어온다는 약속 하에 동작한다.
 */
export function WeeklyInflowTable({ label, rows, noBottomMargin }) {
  if (!rows || rows.length < 2) return null;
  const totalRowIndex = rows.findIndex((r) => r[0] === "__TOTAL__");
  const total = totalRowIndex >= 0 ? rows[totalRowIndex][1] : null;
  const weekRows = rows.slice(1, totalRowIndex >= 0 ? totalRowIndex : undefined);
  if (weekRows.length === 0) return null;
  return (
    <div className={noBottomMargin ? "" : "mb-6"}>
      {label ? <div className="text-navy font-bold text-sm mb-2"><span className="text-orange">■</span> {label}</div> : null}
      <div className="flex border border-lightgray rounded-md overflow-hidden">
        <table className="flex-1 text-xs border-collapse">
          <thead className="bg-[#F0EDE7] text-navy">
            <tr>
              <th className="px-3 py-2 border-b border-lightgray">기간</th>
              <th className="px-3 py-2 border-b border-lightgray">방문 횟수</th>
            </tr>
          </thead>
          <tbody>
            {weekRows.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-[#FAF8F5]" : "bg-white"}>
                <td className="px-3 py-1.5 text-center border-t border-lightgray">{r[0]}</td>
                <td className="px-3 py-1.5 text-center border-t border-lightgray">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {total !== null && (
          <div className="w-40 shrink-0 border-l border-lightgray bg-[#F0EDE7] flex flex-col items-center justify-center">
            <div className="text-navy font-bold text-xs mb-1">총유입</div>
            <div className="text-orange font-bold text-lg">{total}회</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** table.layout === 'split'이면 좌/우 분할, 'weeklyInflow'면 총유입 병합 표, 아니면 일반 표 */
export function AutoTable({ label, table, rows, noBottomMargin }) {
  if (table.layout === "split") return <SplitCsvTable label={label} rows={rows} splitAt={table.splitAt} />;
  if (table.layout === "weeklyInflow") return <WeeklyInflowTable label={label} rows={rows} noBottomMargin={noBottomMargin} />;
  return <CsvTable label={label} rows={rows} noBottomMargin={noBottomMargin} />;
}
export function ImageSlot({ label, src }) {
  const srcs = Array.isArray(src) ? src.filter(Boolean) : src ? [src] : [];
  if (srcs.length > 0) {
    return (
      <div className="mb-6">
        <div className="flex flex-wrap items-start gap-3">
          {srcs.map((s, i) => (
            <img
              key={i}
              src={s}
              alt={`${label} ${i + 1}`}
              className="block max-h-[220px] max-w-[32%] w-auto h-auto object-contain rounded-md border border-lightgray bg-white p-1"
            />
          ))}
        </div>
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
