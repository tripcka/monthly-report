const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 720;

function safeFilePart(value, fallback) {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, "-").trim();
}

async function waitForPreviewAssets(pages) {
  if (document.fonts?.ready) await document.fonts.ready;

  const images = pages.flatMap((page) => Array.from(page.querySelectorAll("img")));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

/**
 * 웹 미리보기의 각 1280x720 페이지를 고해상도 PNG로 캡처한 뒤,
 * 16:9 PPTX 슬라이드 전체에 한 장씩 삽입한다.
 */
export async function exportPreviewPptx({ hotelName, month, outputType }) {
  const pages = Array.from(document.querySelectorAll("[data-report-preview] .report-page"));
  if (pages.length === 0) throw new Error("내보낼 미리보기 페이지를 찾지 못했습니다.");

  await waitForPreviewAssets(pages);

  const [{ toPng, getFontEmbedCSS }, pptxModule] = await Promise.all([
    import("html-to-image"),
    import("pptxgenjs"),
  ]);
  const pptxgen = pptxModule.default;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "TRIPICKA";
  pres.subject = "월별 마케팅 운영 보고서";
  pres.title = `${hotelName || "호텔명"} ${month || ""} 마케팅 운영 보고서`.trim();

  let fontEmbedCSS;
  try {
    fontEmbedCSS = await getFontEmbedCSS(pages[0]);
  } catch {
    // 외부 폰트 스타일을 읽지 못해도 시스템에 로드된 폰트로 캡처를 계속한다.
  }

  for (const page of pages) {
    const backgroundColor = getComputedStyle(page).backgroundColor || "#ffffff";
    const data = await toPng(page, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor,
      fontEmbedCSS,
      style: {
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        minHeight: `${PAGE_HEIGHT}px`,
        maxHeight: `${PAGE_HEIGHT}px`,
        margin: "0",
        overflow: "hidden",
        transform: "none",
      },
    });

    const slide = pres.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  const fileName = `${safeFilePart(hotelName, "호텔명")}_${safeFilePart(month, "YYYY-MM")}_미리보기동일_마케팅운영보고서.pptx`;
  if (outputType === "blob") {
    const blob = await pres.write({ outputType: "blob" });
    return { blob, fileName };
  }
  await pres.writeFile({ fileName });
  return { fileName };
}
