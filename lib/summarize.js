import { toImgArray } from "./imageUtils";

// 운영요약(Summary) 박스에 채널별로 보여줄 내용을 만든다.
// 예전에는 KPI 수치/건수를 전부 나열했지만, 지금은 그 채널 안에 어떤 섹션(소제목)이
// 실제로 채워져 있는지만 "■ 소제목" 형태로 보여준다.
export function summarizeChannel(channel, data) {
  const lines = [];

  if (channel.slideGroups && channel.slideGroups.length > 0) {
    for (const g of channel.slideGroups) {
      const hasTable = (g.tableKeys || []).some((k) => data.tables[k] && data.tables[k].length > 0);
      const hasImg = (g.imageKeys || []).some((k) => toImgArray(data.images[k]).length > 0);
      if (hasTable || hasImg) lines.push(`■ ${g.title}`);
    }
  } else {
    for (const t of channel.tables) {
      const rows = data.tables[t.key];
      if (rows && rows.length > 0) lines.push(`■ ${t.label}`);
    }
    for (const img of channel.images) {
      if (toImgArray(data.images[img.key]).length > 0) lines.push(`■ ${img.label}`);
    }
  }

  return lines.length ? lines.join("\n") : "- 데이터 확인 필요";
}
