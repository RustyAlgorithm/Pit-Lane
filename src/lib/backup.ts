import JSZip from "jszip";
import type { Car, Tournament } from "./types";
import { uid } from "./storage";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = MIME_EXT[mime] ?? "bin";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export interface BackupManifest {
  version: 1;
  exportedAt: number;
  cars: Car[]; // photo replaced with `images/<id>.<ext>` path
  tournaments: Tournament[];
}

export async function exportBackupZip(cars: Car[], tournaments: Tournament[]): Promise<Blob> {
  const zip = new JSZip();
  const imagesDir = zip.folder("images")!;

  const carsOut: Car[] = cars.map((c) => {
    const id = c.id || uid();
    let photoRef: string | undefined;
    if (c.photo?.startsWith("data:")) {
      const conv = dataUrlToBlob(c.photo);
      if (conv) {
        const filename = `${id}.${conv.ext}`;
        imagesDir.file(filename, conv.blob);
        photoRef = `images/${filename}`;
      }
    } else if (c.photo) {
      photoRef = c.photo;
    }
    return { ...c, id, photo: photoRef };
  });

  const manifest: BackupManifest = {
    version: 1,
    exportedAt: Date.now(),
    cars: carsOut,
    tournaments,
  };
  zip.file("data.json", JSON.stringify(manifest, null, 2));
  return await zip.generateAsync({ type: "blob" });
}

export async function importBackupZip(file: File): Promise<{ cars: Car[]; tournaments: Tournament[] }> {
  const zip = await JSZip.loadAsync(file);
  const dataFile = zip.file("data.json");
  if (!dataFile) throw new Error("Invalid backup: data.json missing");
  const manifest = JSON.parse(await dataFile.async("string")) as BackupManifest;
  if (!manifest || !Array.isArray(manifest.cars)) throw new Error("Invalid backup format");

  const cars: Car[] = [];
  for (const c of manifest.cars) {
    const id = c.id || uid();
    let photo: string | undefined = c.photo;
    if (photo && !photo.startsWith("data:") && !photo.startsWith("http")) {
      const f = zip.file(photo);
      if (f) {
        const ext = photo.split(".").pop()?.toLowerCase() ?? "";
        const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] ?? "image/png";
        const blob = await f.async("blob");
        const typed = new Blob([blob], { type: mime });
        photo = await blobToDataUrl(typed);
      } else {
        photo = undefined;
      }
    }
    cars.push({ ...c, id, photo });
  }

  const tournaments: Tournament[] = (manifest.tournaments ?? []).map((t) => ({
    ...t,
    id: t.id || uid(),
    matches: (t.matches ?? []).map((m) => ({ ...m, id: m.id || uid() })),
  }));

  return { cars, tournaments };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
