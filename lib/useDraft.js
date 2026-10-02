"use client";

import { useEffect, useRef, useState } from "react";

const LEGACY_LOCALSTORAGE_KEY = "tripicka-report-draft-v1";

const DB_NAME = "tripicka-report-db";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const DRAFT_KEY = "current-draft";

/**
 * 아주 단순한 IndexedDB key-value 래퍼.
 *
 * ⚠️ 예전에는 localStorage를 썼는데, localStorage는 보통 5~10MB로 용량이 작다.
 * 이 앱은 영수증·광고소재 등 이미지를 base64로 그대로 state에 들고 있기 때문에,
 * 사진 몇 장만 첨부해도 임시저장 JSON이 수 MB를 넘기기 쉽다. 용량을 넘으면
 * localStorage.setItem()이 QuotaExceededError를 던지는데, 기존 코드는 이걸
 * console.warn으로만 조용히 삼키고 화면엔 "자동 임시저장됨"이라고 그대로 떠 있었다
 * — 즉 사용자는 저장되는 줄 알고 계속 작업했지만 실제로는 그 이후 변경사항이
 * 전혀 저장되지 않고 있다가, 새로고침하면 마지막으로 "저장에 성공했던" 시점으로
 * 되돌아가 버리는 문제가 있었다 (실제로 이 문제로 작업 내용이 날아간 사례 있음).
 *
 * IndexedDB는 브라우저별로 보통 수백 MB~그 이상(디스크 여유 공간에 비례)까지
 * 쓸 수 있어서 이미지가 꽤 많아져도 훨씬 안전하다. 그래도 만에 하나 저장이
 * 실패하는 경우에 대비해 useDraft가 saveStatus를 밖으로 내보내서, 화면에
 * "자동저장 실패" 경고를 실제로 띄울 수 있게 했다 (예전처럼 무조건 "저장됨"이라고
 * 표시하지 않음).
 */
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저는 IndexedDB를 지원하지 않습니다."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB를 열지 못했습니다."));
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbRemove(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readLegacyLocalStorageDraft() {
  try {
    const saved = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.warn("예전 localStorage 임시저장 데이터를 읽지 못했습니다:", e);
    return null;
  }
}

/**
 * IndexedDB에 자동 저장/복원하는 훅 (이전엔 localStorage 기반이었음 — 위 설명 참고).
 *
 * migrate(saved, defaultValue)를 넘기면, 복원 직후 저장된 값을 현재 스키마에 맞춰
 * 보정할 수 있다 (예: 그 사이에 새로 추가된 채널의 빈 데이터를 채워 넣기).
 * 안 넘기면 저장된 값을 그대로 쓴다.
 *
 * 반환값: [value, setValue, clearDraft, restored, saveStatus]
 * saveStatus: "idle" | "saving" | "saved" | "error" — 실제 저장 성공 여부를 반영한다.
 */
export function useDraft(defaultValue, migrate) {
  const [value, setValue] = useState(defaultValue);
  const [restored, setRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimer = useRef(null);

  // 최초 마운트 시 복원: IndexedDB를 우선 쓰고, 비어 있으면 예전 localStorage 임시저장을
  // 한 번 불러와 준다 (이번 업데이트 이전에 저장해둔 사용자를 위한 1회성 이전 경로).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = null;
      let usedLegacy = false;
      try {
        saved = await idbGet(DRAFT_KEY);
      } catch (e) {
        console.warn("IndexedDB에서 임시저장 데이터를 불러오지 못했습니다:", e);
      }
      if (!saved) {
        const legacy = readLegacyLocalStorageDraft();
        if (legacy) {
          saved = legacy;
          usedLegacy = true;
        }
      }
      if (!cancelled && saved) {
        let parsed = saved;
        if (migrate) {
          try {
            parsed = migrate(parsed, defaultValue);
          } catch (e) {
            console.warn("임시저장 데이터 마이그레이션 실패, 저장된 값을 그대로 사용합니다:", e);
          }
        }
        setValue(parsed);
      }
      if (!cancelled) {
        setRestored(true);
        // 예전 localStorage 임시저장을 썼다면, 이제부턴 IndexedDB를 기준으로 저장하도록
        // 바로 한 번 옮겨 쓴다 (다음 자동저장 주기를 기다릴 필요 없이).
        if (usedLegacy) {
          try {
            await idbSet(DRAFT_KEY, saved);
          } catch (e) {
            console.warn("IndexedDB로 이전 저장 실패:", e);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 변경될 때마다 저장 (약간의 디바운스)
  useEffect(() => {
    if (!restored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await idbSet(DRAFT_KEY, value);
        setSaveStatus("saved");
      } catch (e) {
        // 용량 초과 등으로 실제로 저장이 안 된 경우 — 화면에서 "저장 실패"로 보여줘야
        // 사용자가 모르고 새로고침해서 작업 내용을 잃어버리는 일이 없다.
        console.warn("임시저장 실패:", e);
        setSaveStatus("error");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [value, restored]);

  async function clearDraft() {
    try {
      await idbRemove(DRAFT_KEY);
    } catch (e) {
      console.warn("임시저장 삭제 실패:", e);
    }
    try {
      window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setValue(defaultValue);
    setSaveStatus("idle");
  }

  return [value, setValue, clearDraft, restored, saveStatus];
}
