/**
 * @file image.ts
 * @description Image processing utilities for handling car photos.
 * Provides functions for loading, cropping, resizing, and compressing images.
 */

/**
 * Defines the rectangular area to crop from an image.
 */
export interface CropArea {
  /** X coordinate of the top-left corner of the crop area (pixels) */
  x: number;
  /** Y coordinate of the top-left corner of the crop area (pixels) */
  y: number;
  /** Width of the crop area (pixels) */
  width: number;
  /** Height of the crop area (pixels) */
  height: number;
}

/**
 * Load an image from a URL or data URL.
 * Returns a promise that resolves when the image has loaded.
 * 
 * @param src URL or data URL of the image to load
 * @returns Promise resolving to the loaded HTMLImageElement
 * @throws Error if the image fails to load
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Convert a File object to a data URL (base64 encoded string).
 * 
 * @param file The File object to convert
 * @returns Promise resolving to a data URL string
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Crop, resize, and compress an image to a data URL.
 * Keeps photos under ~1600px on the long edge to avoid bloating localStorage.
 * Applies JPEG compression to further reduce file size.
 * 
 * @param src Image source (URL or data URL)
 * @param crop Optional CropArea to crop the image (if null, uses full image)
 * @param opts Options for processing:
 *   - maxDim: Maximum dimension in pixels (default: 1600)
 *   - quality: JPEG quality 0-1 (default: 0.85)
 *   - mime: Output MIME type (default: "image/jpeg")
 * @returns Promise resolving to a data URL string of the processed image
 * 
 * @example
 * const src = await fileToDataUrl(file);
 * const processed = await processImage(src, { x: 10, y: 10, width: 200, height: 200 });
 */
export async function processImage(
  src: string,
  crop: CropArea | null,
  opts: { maxDim?: number; quality?: number; mime?: "image/jpeg" | "image/webp" } = {},
): Promise<string> {
  const { maxDim = 1600, quality = 0.85, mime = "image/jpeg" } = opts;
  
  // Load the image
  const img = await loadImage(src);
  
  // Get crop area (or use full image)
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = crop?.width ?? img.naturalWidth;
  const sh = crop?.height ?? img.naturalHeight;

  // Calculate scale to keep max dimension under limit
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  // Draw image to canvas
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  
  // For JPEG, fill background with white (JPEG doesn't support transparency)
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, dw, dh);
  }
  
  // Draw the cropped and scaled image
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  
  // Return as data URL with specified mime type and quality
  return canvas.toDataURL(mime, quality);
}