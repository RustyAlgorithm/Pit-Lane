import JSZip from "jszip";
import { z } from "zod";
import type { Car, Tournament, Team } from "./types";
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
  teams?: Team[];
}

export class BackupValidationError extends Error {
  issues: string[];
  warnings: string[];
  constructor(issues: string[], warnings: string[] = []) {
    super(issues[0] ?? "Backup validation failed");
    this.name = "BackupValidationError";
    this.issues = issues;
    this.warnings = warnings;
  }
}

const carSchema = z.object({
  id: z.string().min(1, "missing id"),
  name: z.string().min(1, "missing name").max(120),
  driver: z.string().max(120),
  make: z.string().max(80),
  model: z.string().max(80),
  weightG: z.number().nonnegative().max(10000),
  brand: z.string().max(80),
  photo: z.string().max(2048).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  createdAt: z.number().int().nonnegative(),
  wins: z.number().nonnegative().optional(),
  losses: z.number().nonnegative().optional(),
  championshipWins: z.number().nonnegative().optional(),
  role: z.enum(["hero", "villain", "neutral"]).optional(),
  story: z.string().max(500).optional(),
});

const matchSchema = z.object({
  id: z.string().min(1, "missing id"),
  round: z.number().int().nonnegative(),
  slot: z.number().int().nonnegative(),
  bracket: z.enum(["winners", "losers", "final"]).optional(),
  carAId: z.string().nullable().optional(),
  carBId: z.string().nullable().optional(),
  teamAId: z.string().nullable().optional(),
  teamBId: z.string().nullable().optional(),
  winnerId: z.string().nullable().optional(),
  winnerType: z.enum(["car", "team"]).nullable().optional(),
  isGroup: z.boolean().optional(),
  series: z
    .array(
      z.object({
        id: z.string().min(1),
        carAId: z.string().nullable(),
        carBId: z.string().nullable(),
        winnerCarId: z.string().nullable(),
      }),
    )
    .optional(),
  seriesLength: z.number().int().min(1).max(64).optional(),
  heatRound: z.number().int().positive().optional(),
  heatIndex: z.number().int().nonnegative().optional(),
  participantIds: z.array(z.string().nullable()).optional(),
  finishOrder: z.array(z.string().nullable()).optional(),
  isConsolation: z.boolean().optional(),
});

const previousSeasonSchema = z.object({
  season: z.number().int().positive(),
  champion: z.string().min(1),
  championType: z.enum(["car", "team"]),
  dateEnded: z.number().int().nonnegative(),
});

const tournamentSchema = z.object({
  id: z.string().min(1, "missing id"),
  name: z.string().min(1, "missing name").max(120),
  format: z.enum(["single", "double", "round-robin", "time-trial", "championship", "heats"]),
  participationType: z.enum(["cars", "teams"]),
  carIds: z.array(z.string()).optional(),
  teamIds: z.array(z.string()).optional(),
  matches: z.array(matchSchema),
  createdAt: z.number().int().nonnegative(),
  champion: z.string().nullable().optional(),
  championType: z.enum(["car", "team"]).nullable().optional(),
  trackLength: z.number().positive().max(100000).optional(),
  trackUnit: z.enum(["cm", "m", "ft"]).optional(),
  times: z
    .array(
      z.object({
        id: z.string().min(1),
        carId: z.string().min(1),
        seconds: z.number().positive().max(86400),
        recordedAt: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  qualifyingType: z.enum(["time-trial", "round-robin"]).optional(),
  qualifyingFormat: z.enum(["single", "double"]).optional(),
  advanceCount: z.number().int().min(2).max(256).optional(),
  qualifyingMatches: z.array(matchSchema).optional(),
  qualifyingLocked: z.boolean().optional(),
  seeds: z
    .array(z.object({ participantId: z.string().min(1), seed: z.number().int().positive() }))
    .optional(),
  persistent: z.boolean().optional(),
  previousSeasons: z.array(previousSeasonSchema).optional(),
  fullTeamMode: z.boolean().optional(),
  seriesLength: z.number().int().min(1).max(64).optional(),
  heatRounds: z
    .array(z.object({ lanes: z.number().int().min(2).max(32), advance: z.number().int().min(1).max(32) }))
    .optional(),
  consolation: z.boolean().optional(),
  narrative: z.any().optional(),
});

const teamSchema = z.object({
  id: z.string().min(1, "missing id"),
  name: z.string().min(1, "missing name").max(80),
  color: z.string().min(1).max(32),
  carIds: z.array(z.string()),
  sponsor: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  createdAt: z.number().int().nonnegative(),
  wins: z.number().nonnegative().optional(),
  losses: z.number().nonnegative().optional(),
  championshipWins: z.number().nonnegative().optional(),
  role: z.enum(["hero", "villain", "neutral"]).optional(),
  story: z.string().max(500).optional(),
});

const manifestSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number().int().nonnegative(),
  cars: z.array(z.unknown()),
  tournaments: z.array(z.unknown()).optional(),
  teams: z.array(z.unknown()).optional(),
});

export async function exportBackupZip(cars: Car[], tournaments: Tournament[], teams: Team[] = []): Promise<Blob> {
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
    teams,
  };
  zip.file("data.json", JSON.stringify(manifest, null, 2));
  return await zip.generateAsync({ type: "blob" });
}

export async function importBackupZip(
  file: File,
): Promise<{ cars: Car[]; tournaments: Tournament[]; teams: Team[]; warnings: string[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupValidationError(["File is not a valid ZIP archive."]);
  }
  const dataFile = zip.file("data.json");
  if (!dataFile) throw new BackupValidationError(["Backup is missing data.json at the archive root."]);

  const raw = await dataFile.async("string");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new BackupValidationError([`data.json is not valid JSON: ${(e as Error).message}`]);
  }

  const manifestResult = manifestSchema.safeParse(parsed);
  if (!manifestResult.success) {
    throw new BackupValidationError(
      manifestResult.error.issues.map((i) => `manifest: ${i.path.join(".") || "root"} — ${i.message}`),
    );
  }
  const manifest = manifestResult.data;

  const issues: string[] = [];
  const warnings: string[] = [];
  const validCars: Car[] = [];
  const carIds = new Set<string>();

  manifest.cars.forEach((rawCar, idx) => {
    const r = carSchema.safeParse(rawCar);
    if (!r.success) {
      r.error.issues.forEach((i) =>
        issues.push(`cars[${idx}]: ${i.path.join(".") || "field"} — ${i.message}`),
      );
      return;
    }
    if (carIds.has(r.data.id)) {
      issues.push(`cars[${idx}]: duplicate id "${r.data.id}"`);
      return;
    }
    carIds.add(r.data.id);
    validCars.push({
      ...r.data,
      photo: r.data.photo ?? undefined,
      notes: r.data.notes ?? undefined,
    });
  });

  const validTournaments: Tournament[] = [];
  const tournamentIds = new Set<string>();
  (manifest.tournaments ?? []).forEach((rawT, idx) => {
    const r = tournamentSchema.safeParse(rawT);
    if (!r.success) {
      r.error.issues.forEach((i) =>
        issues.push(`tournaments[${idx}]: ${i.path.join(".") || "field"} — ${i.message}`),
      );
      return;
    }
    if (tournamentIds.has(r.data.id)) {
      issues.push(`tournaments[${idx}]: duplicate id "${r.data.id}"`);
      return;
    }
    tournamentIds.add(r.data.id);

    const matchIds = new Set<string>();
    let matchDup = false;
    for (const m of r.data.matches) {
      if (matchIds.has(m.id)) {
        issues.push(`tournaments[${idx}] "${r.data.name}": duplicate match id "${m.id}"`);
        matchDup = true;
        break;
      }
      matchIds.add(m.id);
    }
    if (matchDup) return;

    const missingRoster = (r.data.carIds ?? []).filter((id) => !carIds.has(id));
    if (missingRoster.length > 0) {
      warnings.push(
        `tournaments[${idx}] "${r.data.name}": ${missingRoster.length} roster car id(s) not found in cars`,
      );
    }
    validTournaments.push(r.data as Tournament);
  });

  const validTeams: Team[] = [];
  const teamIds = new Set<string>();
  (((manifest as unknown) as { teams?: unknown[] }).teams ?? []).forEach((rawT, idx) => {
    const r = teamSchema.safeParse(rawT);
    if (!r.success) {
      r.error.issues.forEach((i) =>
        issues.push(`teams[${idx}]: ${i.path.join(".") || "field"} — ${i.message}`),
      );
      return;
    }
    if (teamIds.has(r.data.id)) {
      issues.push(`teams[${idx}]: duplicate id "${r.data.id}"`);
      return;
    }
    teamIds.add(r.data.id);
    const missing = r.data.carIds.filter((id) => !carIds.has(id));
    if (missing.length > 0) {
      warnings.push(`teams[${idx}] "${r.data.name}": ${missing.length} member car id(s) not found`);
    }
    validTeams.push({
      ...r.data,
      sponsor: r.data.sponsor ?? undefined,
      notes: r.data.notes ?? undefined,
    });
  });

  if (issues.length > 0) throw new BackupValidationError(issues, warnings);

  // Resolve photo refs against the zip
  const cars: Car[] = [];
  for (const c of validCars) {
    let photo = c.photo;
    if (photo && !photo.startsWith("data:") && !photo.startsWith("http")) {
      const f = zip.file(photo);
      if (f) {
        const ext = photo.split(".").pop()?.toLowerCase() ?? "";
        const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] ?? "image/png";
        const blob = await f.async("blob");
        photo = await blobToDataUrl(new Blob([blob], { type: mime }));
      } else {
        warnings.push(`cars "${c.name}": image file "${photo}" missing from archive`);
        photo = undefined;
      }
    }
    cars.push({ ...c, photo });
  }

  return { cars, tournaments: validTournaments, teams: validTeams, warnings };
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
