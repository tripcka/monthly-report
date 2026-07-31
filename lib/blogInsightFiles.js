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

function normalizeMetadataLabel(value = "") {
  return String(value).normalize("NFKC").replace(/\s+/g, "").replace(/[:：]$/, "");
}

function metadataValue(rows, label) {
  const normalizedLabel = normalizeMetadataLabel(label);
  for (const row of rows) {
    const index = row.findIndex((cell) => normalizeMetadataLabel(cell) === normalizedLabel);
    if (index < 0) continue;
    const adjacentValue = row.slice(index + 1).find(Boolean);
    if (adjacentValue) return adjacentValue;
  }
  return "";
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
  const sheets = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    rows: cleanRows(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    })),
  }));
  const titleSheet = sheets.find(({ rows }) => metadataValue(rows, "게시물 제목"));
  const title = titleSheet ? metadataValue(titleSheet.rows, "게시물 제목") : "";
  if (!title) throw new Error(`${fileName || "파일"}: 게시물 제목을 찾지 못했습니다.`);

  let views = "";
  let keywords = [];
  for (const { rows } of sheets) {
    const dataName = metadataValue(rows, "데이터명");
    if (!views && (dataName === "조회수" || rows.some((row) => row.includes("전체")))) {
      views = parseViews(rows);
    }
    if (keywords.length === 0 && (dataName === "유입분석" || rows.some((row) => row.includes("유입경로")))) {
      keywords = parseTopKeywords(rows);
    }
  }

  if (!views && keywords.length === 0) {
    throw new Error(`${fileName || "파일"}: 조회수 또는 유입 키워드를 찾지 못했습니다.`);
  }
  return {
    title,
    normalizedTitle: normalizeBlogTitle(title),
    views,
    keywords,
    fileName,
    sheetName: titleSheet.sheetName,
  };
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
  const rowByTitle = new Map();
  nextRows.slice(1).forEach((row, index) => {
    const key = normalizeBlogTitle(row[1]);
    if (key && !rowByTitle.has(key)) rowByTitle.set(key, index + 1);
  });

  // 조회수 파일과 유입분석 파일이 따로 내려받아져도 엑셀 내부 제목을
  // 기준으로 먼저 하나의 게시물 통계로 합친다. 파일명은 매칭에 사용하지 않는다.
  const insightByTitle = new Map();
  for (const insight of insights) {
    const key = insight.normalizedTitle || normalizeBlogTitle(insight.title);
    if (!key) continue;
    const combined = insightByTitle.get(key) || {
      title: insight.title,
      normalizedTitle: key,
      views: "",
      keywords: [],
      sourceFiles: [],
    };
    if (insight.views) combined.views = insight.views;
    if (insight.keywords?.length) combined.keywords = insight.keywords;
    if (insight.fileName) combined.sourceFiles.push(insight.fileName);
    insightByTitle.set(key, combined);
  }

  const matchedTitles = new Set();
  const unmatched = [];

  for (const insight of insightByTitle.values()) {
    const rowIndex = rowByTitle.get(insight.normalizedTitle);
    if (!rowIndex) {
      unmatched.push({ title: insight.title, sourceFiles: insight.sourceFiles });
      continue;
    }
    if (insight.views) nextRows[rowIndex][3] = insight.views;
    if (insight.keywords.length > 0) nextRows[rowIndex][4] = insight.keywords.join(" / ");
    matchedTitles.add(insight.normalizedTitle);
  }

  return {
    rows: sortBlogPostsOldestFirst(nextRows),
    matchedPostCount: matchedTitles.size,
    unmatched,
  };
}
