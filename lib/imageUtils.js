// 이미지 슬롯 값을 항상 배열로 다룰 수 있게 정규화한다.
// 예전 draft(localStorage 자동저장)는 값이 문자열 1개였을 수 있어서 하위호환 처리.
export function toImgArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}
