// 이미지 슬롯 값을 항상 배열로 다룰 수 있게 정규화한다.
// 예전 draft(localStorage 자동저장)는 값이 문자열 1개였을 수 있어서 하위호환 처리.
export function toImgArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

// data URL(base64)의 PNG/JPEG 헤더만 읽어서 원본 픽셀 크기를 알아낸다.
// (이미지를 실제로 디코딩/로드하지 않아도 되므로 웹 미리보기·PPTX 양쪽에서 동기적으로 쓸 수 있음)
export function getImageNaturalSize(src) {
  try {
    const base64 = String(src).split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    let width = 0;
    let height = 0;

    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    // JPEG
    } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          height = (bytes[offset + 5] << 8) + bytes[offset + 6];
          width = (bytes[offset + 7] << 8) + bytes[offset + 8];
          break;
        }
        offset += 2 + Math.max(length, 2);
      }
    }

    if (width > 0 && height > 0) return { width, height };
  } catch (_) {
    // 알 수 없는 형식은 null 반환 — 호출부에서 기본값으로 안전하게 처리
  }
  return null;
}

// 지정 박스(maxW x maxH) 안에서 원본 비율을 유지하는 좌표를 만든다 (가운데 정렬, "contain" 방식).
export function containImageRect(src, x, y, maxW, maxH) {
  const size = getImageNaturalSize(src);
  if (size) {
    const scale = Math.min(maxW / size.width, maxH / size.height);
    const w = size.width * scale;
    const h = size.height * scale;
    return { x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h };
  }
  return { x, y, w: maxW, h: maxH };
}

/**
 * 한 행(row)에 들어가는 이미지들의 "칸 폭(cellW)을 꽉 채우는 데 필요한 높이"를 계산한다.
 * 세로로 긴(인물/영수증 등) 이미지는 폭만 넓혀서는 커지지 않고 높이가 모자라서 작게
 * 들어간다 — 그래서 높이도 "그 행에서 가장 필요한 만큼"으로 같이 키워줘야 실제로
 * 이미지 자체가 커진다. 다만 한 장이 극단적으로 세로로 길면 슬라이드를 넘어설 수 있어
 * minH~maxH 범위로 제한한다 (단위는 호출부에서 맞춰서 넘긴다 — PPTX는 inch, 웹은 px).
 */
export function computeImageRowHeight(rowSrcs, cellW, { minH = 0, maxH = Infinity } = {}) {
  let needed = minH;
  for (const src of rowSrcs) {
    const size = getImageNaturalSize(src);
    if (size && size.width > 0) {
      const h = cellW * (size.height / size.width);
      if (h > needed) needed = h;
    }
  }
  return Math.min(needed, maxH);
}

// 이미지 슬롯 하나의 전체 장수를, 한 "장표(페이지)"에 들어갈 몫씩 잘라준다.
// 3열 x maxRowsPerPage행 = 장당 최대 이미지 수. 이걸 넘으면 다음 장표로 이어서 보여준다.
export function paginateImages(srcs, { maxCols = 3, maxRowsPerPage = 2 } = {}) {
  const perPage = maxCols * maxRowsPerPage;
  const pages = [];
  for (let i = 0; i < srcs.length; i += perPage) pages.push(srcs.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}
