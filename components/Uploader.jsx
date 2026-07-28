"use client";

function detectEncodingAndDecode(buffer) {
  const bytes = new Uint8Array(buffer);
  // UTF-16 LE BOM: FF FE / UTF-16 BE BOM: FE FF / UTF-8 BOM: EF BB BF
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  // BOM 없어도 널바이트가 촘촘히 섞여 있으면 UTF-16으로 저장된 파일일 가능성이 높음
  // (일부 카카오/네이버 다운로드 파일은 BOM 없이 UTF-16으로 저장되기도 함)
  let nullCount = 0;
  const sampleLen = Math.min(bytes.length, 200);
  for (let i = 1; i < sampleLen; i += 2) if (bytes[i] === 0x00) nullCount++;
  if (nullCount > sampleLen / 2 / 2) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  return new TextDecoder("utf-8").decode(buffer);
}

export function CsvUploader({ label, onFile, hasData }) {
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = detectEncodingAndDecode(reader.result);
      // 실제 파일이 파일명은 .csv지만 탭으로 구분된 경우가 있어(카카오모먼트 다운로드 등),
      // Blob으로 감싸서 넘기면 Papa.parse가 구분자(콤마/탭/세미콜론)를 자동으로 인식한다.
      onFile(new Blob([text], { type: "text/plain" }));
    };
    reader.readAsArrayBuffer(file);
  }
  return (
    <label className="flex items-center justify-between gap-3 border border-lightgray rounded-md px-3 py-2 cursor-pointer hover:bg-card text-sm">
      <span className="text-graytxt">{label}</span>
      <span className={`text-xs font-bold ${hasData ? "text-orange" : "text-muted"}`}>
        {hasData ? "업로드됨 ✓" : "CSV 선택"}
      </span>
      <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
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
