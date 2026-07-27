// 공통 유틸: 숫자 파싱, 콤마 포맷, 헤더 행 자동 탐색
export function num(v) {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[,%원]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

export function fmt(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

export function pct(n) {
  return `${n.toFixed(2)}%`;
}

export function won(n) {
  return `${fmt(n)}원`;
}

/** 헤더로 보이는 행(문자열이 절반 이상인 행)을 찾아 그 이후를 데이터로 취급 */
export function splitHeaderBody(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const numericCount = row.filter((c) => !isNaN(parseFloat(String(c).replace(/[,%원]/g, "")))).length;
    if (numericCount <= row.length / 2 && row.length > 1) {
      return { header: row, body: rows.slice(i + 1), headerIndex: i };
    }
  }
  return { header: rows[0] || [], body: rows.slice(1), headerIndex: 0 };
}

/** 헤더에서 특정 키워드가 포함된 열 인덱스 찾기 (여러 후보 중 첫 매치) */
export function findCol(header, keywords) {
  for (const kw of keywords) {
    const idx = header.findIndex((h) => String(h).replace(/\s/g, "").includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}
