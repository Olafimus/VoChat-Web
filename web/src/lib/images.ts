/**
 * Bilder vor dem Hochladen verkleinern (max. 1600 px, WebP bzw. JPEG ~82 %): typische Handyfotos
 * schrumpfen von 3–8 MB auf 150–400 KB. GIFs bleiben unverändert (Animation).
 */
export const MAX_IMAGE_SIDE = 1600;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function prepareImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width: w0, height: h0 } = bitmap;
  if (file.type === "image/gif") {
    bitmap.close();
    if (file.size > MAX_IMAGE_BYTES) throw new Error("GIF zu groß (max. 5 MB)");
    return { blob: file, width: w0, height: h0 };
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG kennt keine Transparenz
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.82));
  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg"); // Safari kann kein WebP kodieren
  if (!blob) throw new Error("Bild konnte nicht verarbeitet werden");
  return { blob, width, height };
}
