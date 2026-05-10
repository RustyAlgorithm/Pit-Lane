export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Crop, resize, and compress an image to a JPEG/PNG data URL.
 * Keeps photos under ~1600px on the long edge to avoid bloating localStorage.
 */
export async function processImage(
  src: string,
  crop: CropArea | null,
  opts: { maxDim?: number; quality?: number; mime?: "image/jpeg" | "image/webp" } = {},
): Promise<string> {
  const { maxDim = 1600, quality = 0.85, mime = "image/jpeg" } = opts;
  const img = await loadImage(src);
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = crop?.width ?? img.naturalWidth;
  const sh = crop?.height ?? img.naturalHeight;

  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, dw, dh);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas.toDataURL(mime, quality);
}