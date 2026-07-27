"use client";

export function CsvUploader({ label, onFile, hasData }) {
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onFile(file);
  }
  return (
    <label className="flex items-center justify-between gap-3 border border-lightgray rounded-md px-3 py-2 cursor-pointer hover:bg-card text-sm">
      <span className="text-graytxt">{label}</span>
      <span className={`text-xs font-bold ${hasData ? "text-orange" : "text-muted"}`}>
        {hasData ? "업로드됨 ✓" : "CSV 선택"}
      </span>
      <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
    </label>
  );
}

export function ImageUploader({ label, onLoaded, hasData }) {
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoaded(reader.result);
    reader.readAsDataURL(file);
  }
  return (
    <label className="flex items-center justify-between gap-3 border border-lightgray rounded-md px-3 py-2 cursor-pointer hover:bg-card text-sm">
      <span className="text-graytxt">{label}</span>
      <span className={`text-xs font-bold ${hasData ? "text-orange" : "text-muted"}`}>
        {hasData ? "첨부됨 ✓" : "이미지 선택"}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </label>
  );
}
