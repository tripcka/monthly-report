"use client";

import { useState } from "react";
import Papa from "papaparse";
import { CsvUploader, ImageUploader } from "./Uploader";
import { runParser } from "../lib/parsers";
import { parseInstagramInsightText } from "../lib/parsers/instagramPaste";
import { toImgArray } from "../lib/imageUtils";

export default function ChannelPanel({ channel, data, onChange, hotelName, month }) {
  const [igStatus, setIgStatus] = useState(null); // { type: 'loading'|'done'|'error', message }
  const [igPasteText, setIgPasteText] = useState("");

  function setKpi(key, value) {
    onChange({ ...data, kpis: { ...data.kpis, [key]: value } });
  }
  function addImages(key, newSrcs) {
    const existing = toImgArray(data.images[key]);
    onChange({ ...data, images: { ...data.images, [key]: [...existing, ...newSrcs] } });
  }
  function removeImage(key, index) {
    const existing = toImgArray(data.images[key]);
    onChange({ ...data, images: { ...data.images, [key]: existing.filter((_, i) => i !== index) } });
  }

  function handleCsv(upload, file) {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data || []).filter((r) => r.some((c) => String(c).trim() !== ""));
        const { kpis, tables } = runParser(upload, rows);
        onChange({
          ...data,
          kpis: { ...data.kpis, ...kpis },
          tables: { ...data.tables, ...tables },
        });
      },
    });
  }

  async function handleInstagramFetch() {
    if (!hotelName || !month) {
      setIgStatus({ type: "error", message: "호텔명과 보고 월을 먼저 입력해주세요." });
      return;
    }
    setIgStatus({ type: "loading", message: "인스타그램에서 불러오는 중..." });
    try {
      const params = new URLSearchParams({ hotel: hotelName, month });
      const res = await fetch(`/api/instagram?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "불러오기 실패");
      onChange({
        ...data,
        kpis: { ...data.kpis, ...json.kpis },
        tables: { ...data.tables, ...json.tables },
      });
      setIgStatus({
        type: "done",
        message: `완료 — 게시물 ${json.meta?.postCount ?? 0}건 (@${json.account?.username || ""})`,
      });
    } catch (e) {
      setIgStatus({ type: "error", message: e.message || String(e) });
    }
  }

  function handleInstagramPaste() {
    const { kpis, tables } = parseInstagramInsightText(igPasteText);
    const foundCount = Object.keys(kpis).length + Object.keys(tables).length;
    if (!igPasteText.trim() || foundCount === 0) {
      setIgStatus({ type: "error", message: "인식할 수 있는 인사이트 항목이 없습니다. 복사한 원문 전체를 붙여넣어 주세요." });
      return;
    }
    onChange({
      ...data,
      kpis: { ...data.kpis, ...kpis },
      tables: { ...data.tables, ...tables },
    });
    setIgStatus({ type: "done", message: `붙여넣기 분석 완료 — ${foundCount}개 항목/표 반영` });
  }

  function setInstagramDetail(tableKey, rowIndex, colIndex, value) {
    const defaults = {
      audienceDetails: [["팔로워 상세 정보", "분포"], ["연령대", "-"], ["성별", "-"]],
      accountComposition: [
        ["구분", "팔로워", "팔로워가 아닌 사람"],
        ["조회한 계정", "-", "-"],
        ["반응한 계정", "-", "-"],
      ],
    };
    const rows = (data.tables[tableKey] || defaults[tableKey]).map((row) => [...row]);
    rows[rowIndex][colIndex] = value;
    onChange({ ...data, tables: { ...data.tables, [tableKey]: rows } });
  }

  return (
    <details className="border border-lightgray rounded-lg mb-3 bg-white open:shadow-sm">
      <summary className="px-4 py-3 cursor-pointer font-bold text-navy flex items-center justify-between">
        <span>
          <span className="text-orange text-xs tracking-widest mr-2">{channel.kicker}</span>
          {channel.title}
        </span>
      </summary>
      <div className="px-4 pb-4 space-y-4">
        {channel.id === "instagram" && (
          <div className="border border-lightgray rounded-md p-3 bg-[#FAF8F5] space-y-3">
            <div>
              <div className="text-xs font-bold text-graytxt mb-2">
                계정·게시물 인사이트 붙여넣기
              </div>
              <textarea
                value={igPasteText}
                onChange={(e) => setIgPasteText(e.target.value)}
                placeholder="인스타그램 인사이트에서 복사한 내용을 그대로 붙여넣으세요."
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full h-36 resize-y bg-white"
              />
              <button
                onClick={handleInstagramPaste}
                className="w-full bg-orange text-white font-bold rounded-md py-2 text-sm mt-2"
              >
                붙여넣은 내용 자동 분석
              </button>
            </div>
            <div className="border-t border-lightgray pt-3">
            <div className="text-xs font-bold text-graytxt mb-2">
              계정 인사이트 + 게시물별 성과 자동 불러오기 (계정 인사이트/게시물_릴스 인사이트 CSV 업로드 대체)
            </div>
            <button
              onClick={handleInstagramFetch}
              disabled={igStatus?.type === "loading"}
              className="w-full bg-navy text-white font-bold rounded-md py-2 text-sm disabled:opacity-50"
            >
              {igStatus?.type === "loading" ? igStatus.message : "인스타그램 자동 불러오기"}
            </button>
            {igStatus?.type === "done" && (
              <div className="text-xs text-green-700 mt-2">✓ {igStatus.message}</div>
            )}
            {igStatus?.type === "error" && (
              <div className="text-xs text-red-600 mt-2 whitespace-pre-wrap">⚠ {igStatus.message}</div>
            )}
            <div className="text-[10px] text-muted mt-2">
              "피드주제", "광고 진행여부", "광고비", "프로필 활동 수", 이미지 게시물 "조회수"는 API로 채울 수 없어 "-"로 남습니다. CSV로 직접 채워서 다시 업로드하거나 PPTX에서 수정하세요.
            </div>
            </div>
          </div>
        )}

        {channel.uploads && channel.uploads.length > 0 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">
              파일 업로드 (자동으로 아래 항목이 채워집니다)
            </div>
            <div className="space-y-2">
              {channel.uploads.map((u) => (
                <CsvUploader
                  key={u.key}
                  label={u.label}
                  hasData={Object.keys(data.tables || {}).length > 0 || Object.keys(data.kpis || {}).length > 0}
                  onFile={(file) => handleCsv(u, file)}
                />
              ))}
            </div>
          </div>
        )}

        {channel.kpis.length > 0 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">
              KPI 수치 (업로드하면 자동 입력됨 · 필요하면 직접 수정 가능)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {channel.kpis.map((k) => (
                <input
                  key={k.key}
                  placeholder={k.label}
                  value={data.kpis[k.key] || ""}
                  onChange={(e) => setKpi(k.key, e.target.value)}
                  className="border border-lightgray rounded-md px-3 py-2 text-sm w-full"
                />
              ))}
            </div>
          </div>
        )}

        {channel.id === "instagram" && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">
              계정 인사이트 상세 (자동 입력 후 직접 수정 가능)
            </div>
            <div className="space-y-2">
              <input
                placeholder="연령대 예: 35-44세(38.5%) > 25-34세(26.8%)"
                value={data.tables.audienceDetails?.[1]?.[1] || ""}
                onChange={(e) => setInstagramDetail("audienceDetails", 1, 1, e.target.value)}
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
              />
              <input
                placeholder="성별 예: 여성(52.4%) > 남성(47.6%)"
                value={data.tables.audienceDetails?.[2]?.[1] || ""}
                onChange={(e) => setInstagramDetail("audienceDetails", 2, 1, e.target.value)}
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["조회 팔로워", "accountComposition", 1, 1],
                  ["조회 비팔로워", "accountComposition", 1, 2],
                  ["반응 팔로워", "accountComposition", 2, 1],
                  ["반응 비팔로워", "accountComposition", 2, 2],
                ].map(([label, tableKey, row, col]) => (
                  <input
                    key={label}
                    placeholder={`${label} 예: 8.4%`}
                    value={data.tables[tableKey]?.[row]?.[col] || ""}
                    onChange={(e) => setInstagramDetail(tableKey, row, col, e.target.value)}
                    className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {channel.tables.length > 0 && (
          <div className="text-xs text-muted">
            표 미리보기: 오른쪽 보고서 화면에서 바로 확인하세요. (
            {channel.tables.filter((t) => data.tables[t.key]?.length).map((t) => t.label).join(", ") || "아직 없음"}
            )
          </div>
        )}

        {channel.images.length > 0 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">이미지 (선택, 여러 장 첨부 가능)</div>
            <div className="space-y-3">
              {channel.images.map((img) => {
                const srcs = toImgArray(data.images[img.key]);
                return (
                  <div key={img.key}>
                    <ImageUploader
                      label={img.label}
                      count={srcs.length}
                      onFilesLoaded={(newSrcs) => addImages(img.key, newSrcs)}
                    />
                    {srcs.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {srcs.map((src, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={src}
                              alt={`${img.label} ${i + 1}`}
                              className="w-full h-16 object-cover rounded-md border border-lightgray"
                            />
                            <button
                              onClick={() => removeImage(img.key, i)}
                              title="삭제"
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-navy text-white text-xs leading-5 text-center opacity-80 hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
