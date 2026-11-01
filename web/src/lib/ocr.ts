import type { LangCode } from "@vochat/shared";

/**
 * Texterkennung im Browser mit Tesseract.js. Worker, WASM-Kern und Sprachdaten liegen unter
 * /tesseract (siehe scripts/copy-ocr-assets.mjs) – kein CDN, das Bild verlässt das Gerät nicht.
 */
const TESS_LANG: Record<LangCode, string> = { de: "deu", en: "eng", es: "spa", fa: "fas", ja: "jpn" };
const MAX_SIDE = 2400;

/** Große Handyfotos verkleinern: schneller, und Tesseract wird dadurch nicht schlechter. */
async function prepare(file: Blob): Promise<Blob | HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function recognize(
  file: Blob,
  lang: LangCode,
  onProgress: (status: string, progress: number) => void,
): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  const base = `${import.meta.env.BASE_URL}tesseract`;
  const worker = await createWorker(TESS_LANG[lang], 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => onProgress(m.status, m.progress),
  });
  try {
    const image = await prepare(file);
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
