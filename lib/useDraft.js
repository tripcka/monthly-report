"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "tripicka-report-draft-v1";

/**
 * 브라우저 localStorage에 자동 저장/복원하는 훅.
 * (이 앱은 실제 배포된 독립 웹사이트라 localStorage를 정상적으로 사용할 수 있음 —
 *  Claude.ai 아티팩트 미리보기 같은 샌드박스 제약이 없는 환경임)
 *
 * migrate(saved, defaultValue)를 넘기면, 복원 직후 저장된 값을 현재 스키마에 맞춰
 * 보정할 수 있다 (예: 그 사이에 새로 추가된 채널의 빈 데이터를 채워 넣기).
 * 안 넘기면 저장된 값을 그대로 쓴다.
 */
export function useDraft(defaultValue, migrate) {
  const [value, setValue] = useState(defaultValue);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef(null);

  // 최초 마운트 시 복원
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsed = JSON.parse(saved);
        if (migrate) {
          try {
            parsed = migrate(parsed, defaultValue);
          } catch (e) {
            console.warn("임시저장 데이터 마이그레이션 실패, 저장된 값을 그대로 사용합니다:", e);
          }
        }
        setValue(parsed);
      }
    } catch (e) {
      console.warn("임시저장 데이터를 불러오지 못했습니다:", e);
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 변경될 때마다 저장 (약간의 디바운스)
  useEffect(() => {
    if (!restored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (e) {
        console.warn("임시저장 실패(용량 초과 가능성):", e);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [value, restored]);

  function clearDraft() {
    window.localStorage.removeItem(STORAGE_KEY);
    setValue(defaultValue);
  }

  return [value, setValue, clearDraft, restored];
}
