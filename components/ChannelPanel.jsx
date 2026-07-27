"use client";

import Papa from "papaparse";
import { CsvUploader, ImageUploader } from "./Uploader";
import { runParser } from "../lib/parsers";

export default function ChannelPanel({ channel, data, onChange }) {
  function setKpi(key, value) {
    onChange({ ...data, kpis: { ...data.kpis, [key]: value } });
  }
  function setImage(key, src) {
    onChange({ ...data, images: { ...data.images, [key]: src } });
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

  return (
    <details className="border border-lightgray rounded-lg mb-3 bg-white open:shadow-sm">
      <summary className="px-4 py-3 cursor-pointer font-bold text-navy flex items-center justify-between">
        <span>
          <span className="text-orange text-xs tracking-widest mr-2">{channel.kicker}</span>
          {channel.title}
        </span>
      </summary>
      <div className="px-4 pb-4 space-y-4">
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

        {channel.tables.length > 0 && (
          <div className="text-xs text-muted">
            표 미리보기: 오른쪽 보고서 화면에서 바로 확인하세요. (
            {channel.tables.filter((t) => data.tables[t.key]?.length).map((t) => t.label).join(", ") || "아직 없음"}
            )
          </div>
        )}

        {channel.images.length > 0 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">이미지 (선택)</div>
            <div className="space-y-2">
              {channel.images.map((img) => (
                <ImageUploader
                  key={img.key}
                  label={img.label}
                  hasData={!!data.images[img.key]}
                  onLoaded={(src) => setImage(img.key, src)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
