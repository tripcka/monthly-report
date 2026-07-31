import * as XLSX from "xlsx";

export const BLOG_POST_HEADER = ["업로드 일자", "제목", "포스팅 링크", "조회수", "유입 키워드"];

export function normalizeBlogTitle(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u200b\u00a0]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function cleanRows(rows) {
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim())));
}

function metadataValue(rows, label) {
  const row = rows.find((cells) => cells.some((cell) => cell === label));
  if (!row) return "";
  const index = row.findIndex((cell) => cell === label);
  return row.slice(index + 1).find(Boolean) || "";
}

function parseViews(rows) {
  const headerIndex = rows.findIndex((row) => row.includes("전체"));
  if (headerIndex < 0) return "";
  const totalIndex = rows[headerIndex].indexOf("전체");
  const value = rows.slice(headerIndex + 1).map((row) => row[totalIndex]).find((cell) => cell !== "");
  if (value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric.toLocaleString("ko-KR") : String(value);
}

function parseTopKeywords(rows) {
  const headerIndex = rows.findIndex((row) => row.includes("유입경로") && row.includes("비율"));
  if (headerIndex < 0) return [];
  const pathIndex = rows[headerIndex].indexOf("유입경로");
  const ratioIndex = rows[headerIndex].indexOf("비율", pathIndex + 1);
  const bestByKeyword = new Map();

  for (const row of rows.slice(headerIndex + 1)) {
    const keyword = row[pathIndex];
    if (!keyword || keyword === "기타") continue;
    const ratio = Number(String(row[ratioIndex] || "").replace(/[% ,]/g, ""));
    const score = Number.isFinite(ratio) ? ratio : 0;
    if (!bestByKeyword.has(keyword) || bestByKeyword.get(keyword) < score) {
      bestByKeyword.set(keyword, score);
    }
  }

  return [...bestByKeyword.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword);
}

export function parseBlogInsightWorkbook(arrayBuffer, fileName = "") {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = cleanRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }));
  const title = metadataValue(rows, "게시물 제목");
  if (!title) throw new Error(`${fileName || "파일"}: 게시물 제목을 찾지 못했습니다.`);

  const dataName = metadataValue(rows, "데이터명");
  const views = dataName === "조회수" || rows.some((row) => row.includes("전체")) ? parseViews(rows) : "";
  const keywords = dataName === "유입분석" || rows.some((row) => row.includes("유입경로"))
    ? parseTopKeywords(rows)
    : [];

  if (!views && keywords.length === 0) {
    throw new Error(`${fileName || "파일"}: 조회수 또는 유입 키워드를 찾지 못했습니다.`);
  }
  return { title, normalizedTitle: normalizeBlogTitle(title), views, keywords, fileName };
}

export function ensureBlogPostColumns(rows = []) {
  const body = rows.length > 0 ? rows.slice(1) : [];
  return [
    BLOG_POST_HEADER,
    ...body.map((row) => [
      row[0] || "",
      row[1] || "",
      row[2] || "",
      row[3] || "",
      row[4] || "",
    ]),
  ];
}

function dateTime(value) {
  const match = String(value || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : Number.MAX_SAFE_INTEGER;
}

export function sortBlogPostsOldestFirst(rows = []) {
  const normalized = ensureBlogPostColumns(rows);
  return [normalized[0], ...normalized.slice(1).sort((a, b) => dateTime(a[0]) - dateTime(b[0]))];
}

export function mergeBlogInsights(rows, insights) {
  const nextRows = ensureBlogPostColumns(rows);
  const rowByTitle = new Map(
    nextRows.slice(1).map((row, index) => [normalizeBlogTitle(row[1]), index + 1]).filter(([key]) => key)
  );
  const matchedTitles = new Set();
  const unmatchedFiles = [];

  for (const insight of insights) {
    const rowIndex = rowByTitle.get(insight.normalizedTitle);
    if (!rowIndex) {
      unmatchedFiles.push(insight.fileName);
      continue;
    }
    if (insight.views) nextRows[rowIndex][3] = insight.views;
    if (insight.keywords.length > 0) nextRows[rowIndex][4] = insight.keywords.join(" / ");
    matchedTitles.add(insight.normalizedTitle);
  }

  return {
    rows: sortBlogPostsOldestFirst(nextRows),
    matchedPostCount: matchedTitles.size,
    unmatchedFiles,
  };
}
