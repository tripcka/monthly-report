import { parseNaverKeywords } from "./naverKeywords";
import { parseNaverHourly } from "./naverHourly";
import { parseKakao } from "./kakao";
import { parseBlogExperience } from "./blogExperience";
import { parseGoogleAds } from "./googleAds";
import { parseGeneric } from "./generic";

export const PARSERS = {
  naverKeywords: parseNaverKeywords,
  naverHourly: parseNaverHourly,
  kakao: parseKakao,
  blogExperience: parseBlogExperience,
  googleAds: parseGoogleAds,
  generic: parseGeneric,
};

/**
 * 업로드된 CSV(rows)를 파싱해서 { kpis, tables } 형태로 반환.
 * generic 파서는 tables._raw로 반환하므로, upload.targetTable이 있으면 그 키로 옮겨준다.
 */
export function runParser(upload, rows) {
  const parserFn = PARSERS[upload.parser] || PARSERS.generic;
  const result = parserFn(rows);
  if (result.tables && result.tables._raw && upload.targetTable) {
    const raw = result.tables._raw;
    delete result.tables._raw;
    result.tables[upload.targetTable] = raw;
  }
  return result;
}
