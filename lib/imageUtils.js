// 이미지 슬롯 값을 항상 배열로 다룰 수 있게 정규화한다.
// 예전 draft(localStorage 자동저장)는 값이 문자열 1개였을 수 있어서 하위호환 처리.
export function toImgArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

// data URL의 원본 픽셀 크기를 읽어, 지정 박스 안에서 비율을 유지하는 PPT 좌표를 만든다.
export function containImageRect(src, x, y, maxW, maxH) {
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

    if (width > 0 && height > 0) {
      const scale = Math.min(maxW / width, maxH / height);
      const w = width * scale;
      const h = height * scale;
      return { x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h };
    }
  } catch (_) {
    // 알 수 없는 형식은 아래 기본값으로 안전하게 처리한다.
  }
  return { x, y, w: maxW, h: maxH };
}
