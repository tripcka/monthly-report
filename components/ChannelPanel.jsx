"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CsvUploader, ImageUploader } from "./Uploader";
import { runParser } from "../lib/parsers";
import { parseInstagramInsightText, parseInstagramPostInsightText } from "../lib/parsers/instagramPaste";
import { toImgArray } from "../lib/imageUtils";
import { buildInstagramPostsTable, formatWon } from "../lib/postsTable";
import {
  BLOG_POST_HEADER,
  ensureBlogPostColumns,
  mergeBlogInsights,
  parseBlogInsightWorkbook,
  sortBlogPostsOldestFirst,
} from "../lib/blogInsightFiles";

const EMPTY_POST_INSIGHT = { date: "", topic: "", isAd: "N", adCost: "", text: "" };

function reportMonthToInput(value = "") {
  const match = String(value).match(/(\d{4})\D+(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

export default function ChannelPanel({ channel, data, onChange, reportMonth }) {
  const [igStatus, setIgStatus] = useState(null);
  const [igPasteText, setIgPasteText] = useState("");
  const [postInsights, setPostInsights] = useState([{ ...EMPTY_POST_INSIGHT }]);
  const [blogUrl, setBlogUrl] = useState("");
  const [blogYearMonth, setBlogYearMonth] = useState(() => reportMonthToInput(reportMonth));
  const [blogStatus, setBlogStatus] = useState(null);
  const [blogInsightStatus, setBlogInsightStatus] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetStatus, setSheetStatus] = useState(null);

  function setKpi(key, value) {
    onChange({ ...data, kpis: { ...data.kpis, [key]: value } });
  }
  function addImages(key, newSrcs) {
    const existing = toImgArray(data.images[key]);
    onChange({ ...data, images: { ...data.images, [key]: [...existing, ...newSrcs] } });
  }
  function removeImage(key, index) {
    const existing = toImgArray(data.images[key]);
    onChange({ ...data, images: { ...data.images, [key]: existing.filter((_, i) => i !== index) } });
  }

  function applyUploadedRows(upload, inputRows) {
    const rows = (inputRows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
    const { kpis, tables } = runParser(upload, rows);
    const nextTables = { ...data.tables, ...tables };
    if (channel.id === "brandBlog" && upload.targetTable === "posts" && nextTables.posts) {
      nextTables.posts = sortBlogPostsOldestFirst(nextTables.posts);
    }
    onChange({
      ...data,
      kpis: { ...data.kpis, ...kpis },
      tables: nextTables,
    });
  }

  async function handleCsv(upload, file, decodeText) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls") {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
      applyUploadedRows(upload, rows);
      return;
    }

    const text = decodeText(await file.arrayBuffer());
    // 파일 확장자와 실제 구분자가 달라도 Papa Parse가 콤마/탭/세미콜론을 자동 인식한다.
    Papa.parse(new Blob([text], { type: "text/plain" }), {
      skipEmptyLines: true,
      complete: (result) => {
        applyUploadedRows(upload, result.data);
      },
    });
  }

  function handleInstagramPaste() {
    const { kpis, tables } = parseInstagramInsightText(igPasteText);
    const foundCount = Object.keys(kpis).length + Object.keys(tables).length;
    if (!igPasteText.trim() || foundCount === 0) {
      setIgStatus({ type: "error", message: "인식할 수 있는 인사이트 항목이 없습니다. 복사한 원문 전체를 붙여넣어 주세요." });
      return;
    }
    onChange({
      ...data,
      kpis: { ...data.kpis, ...kpis },
      tables: { ...data.tables, ...tables },
    });
    setIgStatus({ type: "done", message: `붙여넣기 분석 완료 — ${foundCount}개 항목/표 반영` });
  }

  function patchPostInsight(index, patch) {
    setPostInsights((current) => current.map((post, i) => (i === index ? { ...post, ...patch } : post)));
  }

  function handlePostInsightsPaste() {
    const posts = postInsights
      .map((post) => parseInstagramPostInsightText(post.text, post))
      .filter(Boolean);
    if (posts.length === 0) {
      setIgStatus({ type: "error", message: "인식할 수 있는 게시물 인사이트가 없습니다." });
      return;
    }
    onChange({ ...data, tables: { ...data.tables, posts: buildInstagramPostsTable(posts) } });
    setIgStatus({ type: "done", message: `게시물 인사이트 ${posts.length}건 반영 완료` });
  }

  function setInstagramDetail(tableKey, rowIndex, colIndex, value) {
    const defaults = {
      audienceDetails: [["팔로워 상세 정보", "분포"], ["연령대", "-"], ["성별", "-"]],
      accountComposition: [
        ["구분", "팔로워", "팔로워가 아닌 사람"],
        ["조회한 계정", "-", "-"],
        ["반응한 계정", "-", "-"],
      ],
    };
    const rows = (data.tables[tableKey] || defaults[tableKey]).map((row) => [...row]);
    rows[rowIndex][colIndex] = value;
    onChange({ ...data, tables: { ...data.tables, [tableKey]: rows } });
  }

  async function handleLoadBlogPosts() {
    const yearMonth = blogYearMonth || reportMonthToInput(reportMonth);
    if (!blogUrl.trim() || !yearMonth) {
      setBlogStatus({ type: "error", message: "블로그 주소와 조회 연월을 입력해 주세요." });
      return;
    }
    setBlogStatus({ type: "loading", message: "공개 포스팅을 불러오는 중..." });
    try {
      const response = await fetch("/api/blog-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogUrl: blogUrl.trim(), yearMonth }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "블로그 글을 불러오지 못했습니다.");
      const rows = [
        BLOG_POST_HEADER,
        ...result.posts.map((post) => [post.date, post.title, post.link, "", ""]),
      ];
      onChange({
        ...data,
        tables: { ...data.tables, posts: sortBlogPostsOldestFirst(rows) },
      });
      setBlogStatus({
        type: "done",
        message: result.posts.length > 0
          ? `${yearMonth} 포스팅 ${result.posts.length}건을 반영했습니다.`
          : `${yearMonth}에 공개된 포스팅이 없습니다.`,
      });
    } catch (error) {
      setBlogStatus({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleLoadBlogSheet() {
    if (!sheetUrl.trim()) {
      setSheetStatus({ type: "error", message: "구글 시트 URL을 입력해 주세요." });
      return;
    }
    setSheetStatus({ type: "loading", message: "구글 시트에서 불러오는 중..." });
    try {
      const response = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "구글 시트를 불러오지 못했습니다.");
      onChange({
        ...data,
        kpis: { ...data.kpis, ...result.kpis },
        tables: { ...data.tables, ...result.tables },
      });
      const rowCount = (result.tables?.roster?.length || 1) - 1;
      setSheetStatus({ type: "done", message: `체험단 ${rowCount}건을 반영했습니다.` });
    } catch (error) {
      setSheetStatus({ type: "error", message: error.message || String(error) });
    }
  }

  function patchBlogPost(rowIndex, colIndex, value) {
    const rows = ensureBlogPostColumns(data.tables.posts).map((row) => [...row]);
    rows[rowIndex][colIndex] = value;
    onChange({ ...data, tables: { ...data.tables, posts: colIndex === 0 ? sortBlogPostsOldestFirst(rows) : rows } });
  }

  function removeBlogPost(rowIndex) {
    const rows = data.tables.posts.filter((_, index) => index !== rowIndex);
    onChange({
      ...data,
      tables: { ...data.tables, posts: rows },
    });
  }

  async function handleBlogInsightFiles(files) {
    const selected = [...files];
    if (selected.length === 0) return;
    setBlogInsightStatus({ type: "loading", message: `${selected.length}개 파일 분석 중...` });
    const parsed = [];
    const errors = [];
    for (const file of selected) {
      try {
        parsed.push(parseBlogInsightWorkbook(await file.arrayBuffer(), file.name));
      } catch (error) {
        errors.push(error.message || `${file.name}: 분석 실패`);
      }
    }
    const result = mergeBlogInsights(data.tables.posts, parsed);
    onChange({ ...data, tables: { ...data.tables, posts: result.rows } });

    const messages = [`엑셀 내부 제목 기준으로 포스팅 ${result.matchedPostCount}건에 조회수·유입 키워드를 반영했습니다.`];
    if (result.unmatched.length > 0) {
      messages.push(
        `제목 불일치 ${result.unmatched.length}건:\n${result.unmatched
          .map(({ title }) => `- ${title}`)
          .join("\n")}`
      );
    }
    if (errors.length > 0) messages.push(errors.join("\n"));
    setBlogInsightStatus({
      type: result.unmatched.length > 0 || errors.length > 0 ? "error" : "done",
      message: messages.join("\n"),
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
        {channel.id === "instagram" && (
          <div className="border border-lightgray rounded-md p-3 bg-[#FAF8F5] space-y-3">
            <div>
              <div className="text-xs font-bold text-graytxt mb-2">
                계정 인사이트 붙여넣기
              </div>
              <textarea
                value={igPasteText}
                onChange={(e) => setIgPasteText(e.target.value)}
                placeholder="인스타그램 계정 인사이트에서 복사한 내용을 그대로 붙여넣으세요."
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full h-36 resize-y bg-white"
              />
              <button
                onClick={handleInstagramPaste}
                className="w-full bg-orange text-white font-bold rounded-md py-2 text-sm mt-2"
              >
                붙여넣은 내용 자동 분석
              </button>
            </div>
            <div className="border-t border-lightgray pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-graytxt">게시물 인사이트 붙여넣기 (최대 6개)</div>
                {postInsights.length < 6 && (
                  <button
                    onClick={() => setPostInsights((current) => [...current, { ...EMPTY_POST_INSIGHT }])}
                    className="text-[11px] font-bold text-orange"
                  >
                    + 게시물 추가
                  </button>
                )}
              </div>
              {postInsights.map((post, index) => (
                <div key={index} className="border border-lightgray rounded-md p-2 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-navy">게시물 {index + 1}</span>
                    {postInsights.length > 1 && (
                      <button
                        onClick={() => setPostInsights((current) => current.filter((_, i) => i !== index))}
                        className="text-[10px] text-red-600"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="업로드일"
                      value={post.date}
                      onChange={(e) => patchPostInsight(index, { date: e.target.value })}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      placeholder="피드 주제"
                      value={post.topic}
                      onChange={(e) => patchPostInsight(index, { topic: e.target.value })}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs"
                    />
                    <select
                      value={post.isAd}
                      onChange={(e) => patchPostInsight(index, { isAd: e.target.value })}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="N">N</option>
                      <option value="Y">Y</option>
                    </select>
                    <input
                      placeholder="광고비 (선택)"
                      value={post.adCost}
                      onChange={(e) => patchPostInsight(index, { adCost: e.target.value })}
                      onBlur={(e) => {
                        if (e.target.value.trim()) patchPostInsight(index, { adCost: formatWon(e.target.value) });
                      }}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                  <textarea
                    value={post.text}
                    onChange={(e) => patchPostInsight(index, { text: e.target.value })}
                    placeholder="이 게시물의 인사이트 원문을 붙여넣으세요."
                    className="border border-lightgray rounded px-2 py-1.5 text-xs w-full h-24 resize-y"
                  />
                </div>
              ))}
              <button
                onClick={handlePostInsightsPaste}
                className="w-full bg-navy text-white font-bold rounded-md py-2 text-sm"
              >
                게시물 인사이트 표에 반영
              </button>
              {igStatus?.type === "done" && (
                <div className="text-xs text-green-700">✓ {igStatus.message}</div>
              )}
              {igStatus?.type === "error" && (
                <div className="text-xs text-red-600 whitespace-pre-wrap">⚠ {igStatus.message}</div>
              )}
            </div>
          </div>
        )}

        {channel.id === "blogExperience" && (
          <div className="border border-lightgray rounded-md p-3 bg-[#FAF8F5] space-y-3">
            <div className="text-xs font-bold text-graytxt">구글 시트로 체험단 리스트 자동 불러오기</div>
            <input
              type="url"
              placeholder="구글 시트 URL (링크가 있는 모든 사용자로 공유되어 있어야 함)"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="border border-lightgray rounded-md px-3 py-2 text-xs w-full bg-white"
            />
            <button
              onClick={handleLoadBlogSheet}
              disabled={sheetStatus?.type === "loading"}
              className="w-full bg-orange text-white font-bold rounded-md py-2 text-sm disabled:opacity-50"
            >
              {sheetStatus?.type === "loading" ? sheetStatus.message : "구글 시트 불러오기"}
            </button>
            <div className="text-[10px] text-muted">
              시트 공유 설정에서 "링크가 있는 모든 사용자 - 뷰어" 이상으로 열려 있어야 불러올 수 있습니다. 헤더 행 위치는 자동으로 찾습니다 (성함/이름 열 기준).
            </div>
            {sheetStatus?.type === "done" && <div className="text-xs text-green-700">✓ {sheetStatus.message}</div>}
            {sheetStatus?.type === "error" && (
              <div className="text-xs text-red-600 whitespace-pre-wrap">⚠ {sheetStatus.message}</div>
            )}
          </div>
        )}

        {channel.id === "brandBlog" && (
          <div className="border border-lightgray rounded-md p-3 bg-[#FAF8F5] space-y-3">
            <div className="text-xs font-bold text-graytxt">해당 월 포스팅 자동 불러오기</div>
            <input
              type="url"
              placeholder="브랜드 블로그 주소"
              value={blogUrl}
              onChange={(e) => setBlogUrl(e.target.value)}
              className="border border-lightgray rounded-md px-3 py-2 text-xs w-full bg-white"
            />
            <input
              type="month"
              value={blogYearMonth || reportMonthToInput(reportMonth)}
              onChange={(e) => setBlogYearMonth(e.target.value)}
              className="border border-lightgray rounded-md px-3 py-2 text-xs w-full bg-white"
            />
            <button
              onClick={handleLoadBlogPosts}
              disabled={blogStatus?.type === "loading"}
              className="w-full bg-orange text-white font-bold rounded-md py-2 text-sm disabled:opacity-50"
            >
              {blogStatus?.type === "loading" ? blogStatus.message : "포스팅 불러오기"}
            </button>
            <div className="text-[10px] text-muted">
              공개 RSS/Atom 기준으로 업로드 일자·제목·링크를 가져옵니다. 네이버 블로그 주소는 RSS로 자동 변환됩니다.
            </div>
            {blogStatus?.type === "done" && <div className="text-xs text-green-700">✓ {blogStatus.message}</div>}
            {blogStatus?.type === "error" && (
              <div className="text-xs text-red-600 whitespace-pre-wrap">⚠ {blogStatus.message}</div>
            )}
            <div className="border-t border-lightgray pt-3 space-y-2">
              <div className="text-xs font-bold text-graytxt">게시물 통계 엑셀 한 번에 업로드</div>
              <label className="block border border-dashed border-[#C8C0B6] rounded-md p-3 text-center text-xs cursor-pointer bg-white hover:border-orange">
                조회수·유입분석 엑셀 여러 개 선택
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleBlogInsightFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="text-[10px] text-muted">
                파일명이 아닌 각 엑셀 시트 내부의 ‘게시물 제목’을 기준으로, 불러온 포스팅에 조회수와 상위 유입 키워드 5개를 자동 매칭합니다.
              </div>
              {blogInsightStatus?.type === "loading" && <div className="text-xs text-graytxt">{blogInsightStatus.message}</div>}
              {blogInsightStatus?.type === "done" && (
                <div className="text-xs text-green-700 whitespace-pre-wrap">✓ {blogInsightStatus.message}</div>
              )}
              {blogInsightStatus?.type === "error" && (
                <div className="text-xs text-red-600 whitespace-pre-wrap">⚠ {blogInsightStatus.message}</div>
              )}
            </div>
          </div>
        )}

        {channel.uploads && channel.uploads.length > 0 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">
              파일 업로드 · CSV/엑셀 (자동으로 아래 항목이 채워집니다)
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

        {channel.id === "instagram" && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">
              계정 인사이트 상세 (자동 입력 후 직접 수정 가능)
            </div>
            <div className="space-y-2">
              <input
                placeholder="연령대 예: 35-44세(38.5%) > 25-34세(26.8%)"
                value={data.tables.audienceDetails?.[1]?.[1] || ""}
                onChange={(e) => setInstagramDetail("audienceDetails", 1, 1, e.target.value)}
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
              />
              <input
                placeholder="성별 예: 여성(52.4%) > 남성(47.6%)"
                value={data.tables.audienceDetails?.[2]?.[1] || ""}
                onChange={(e) => setInstagramDetail("audienceDetails", 2, 1, e.target.value)}
                className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["조회 팔로워", "accountComposition", 1, 1],
                  ["조회 비팔로워", "accountComposition", 1, 2],
                  ["반응 팔로워", "accountComposition", 2, 1],
                  ["반응 비팔로워", "accountComposition", 2, 2],
                ].map(([label, tableKey, row, col]) => (
                  <input
                    key={label}
                    placeholder={`${label} 예: 8.4%`}
                    value={data.tables[tableKey]?.[row]?.[col] || ""}
                    onChange={(e) => setInstagramDetail(tableKey, row, col, e.target.value)}
                    className="border border-lightgray rounded-md px-3 py-2 text-xs w-full"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {channel.id === "brandBlog" && data.tables.posts?.length > 1 && (
          <div>
            <div className="text-xs font-bold text-graytxt mb-2">불러온 포스팅 (직접 수정·삭제 가능)</div>
            <div className="space-y-2">
              {data.tables.posts.slice(1).map((row, index) => {
                const rowIndex = index + 1;
                return (
                  <div key={`${row[2]}-${rowIndex}`} className="border border-lightgray rounded-md p-2 bg-white space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={row[0] || ""}
                        onChange={(e) => patchBlogPost(rowIndex, 0, e.target.value)}
                        className="border border-lightgray rounded px-2 py-1.5 text-xs w-[110px]"
                      />
                      <button onClick={() => removeBlogPost(rowIndex)} className="ml-auto text-[10px] text-red-600">
                        삭제
                      </button>
                    </div>
                    <input
                      value={row[1] || ""}
                      onChange={(e) => patchBlogPost(rowIndex, 1, e.target.value)}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs w-full"
                    />
                    <input
                      value={row[2] || ""}
                      onChange={(e) => patchBlogPost(rowIndex, 2, e.target.value)}
                      className="border border-lightgray rounded px-2 py-1.5 text-xs w-full text-blue-700"
                    />
                    <div className="grid grid-cols-[140px_1fr] gap-2">
                      <input
                        placeholder="조회수"
                        value={row[3] || ""}
                        onChange={(e) => patchBlogPost(rowIndex, 3, e.target.value)}
                        className="border border-lightgray rounded px-2 py-1.5 text-xs w-full"
                      />
                      <input
                        placeholder="유입 키워드 5개 (/로 구분)"
                        value={row[4] || ""}
                        onChange={(e) => patchBlogPost(rowIndex, 4, e.target.value)}
                        className="border border-lightgray rounded px-2 py-1.5 text-xs w-full"
                      />
                    </div>
                  </div>
                );
              })}
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
            <div className="text-xs font-bold text-graytxt mb-2">이미지 (선택, 여러 장 첨부 가능)</div>
            <div className="space-y-3">
              {channel.images.map((img) => {
                const srcs = toImgArray(data.images[img.key]);
                return (
                  <div key={img.key}>
                    <ImageUploader
                      label={img.label}
                      count={srcs.length}
                      onFilesLoaded={(newSrcs) => addImages(img.key, newSrcs)}
                    />
                    {srcs.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {srcs.map((src, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={src}
                              alt={`${img.label} ${i + 1}`}
                              className="w-full h-16 object-cover rounded-md border border-lightgray"
                            />
                            <button
                              onClick={() => removeImage(img.key, i)}
                              title="삭제"
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-navy text-white text-xs leading-5 text-center opacity-80 hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
