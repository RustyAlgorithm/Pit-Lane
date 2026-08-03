/**
 * @file car-import.ts
 * @description Pure helpers for bulk-importing cars from a CSV file
 * (optionally paired with a set of photo files or a ZIP of photos).
 */
import type { Car } from "./types";

export type DuplicateMode = "skip" | "update" | "add";

export interface ParsedRow {
  index: number; // 1-based data row number (excludes header)
  name: string;
  driver: string;
  make: string;
  model: string;
  weightG: number;
  brand: string;
  notes?: string;
  photoRef?: string;
  errors: string[];
  warnings: string[];
  duplicateOf?: string; // existing car id
}

export const CSV_HEADERS = [
  "name",
  "driver",
  "make",
  "model",
  "weight_g",
  "brand",
  "notes",
  "photo",
] as const;

export const CSV_TEMPLATE = `${CSV_HEADERS.join(",")}
Crimson Reaper,Dale Vortex,Ford,Mustang,35,Hot Wheels,Custom paint job,reaper.jpg
Midnight Runner,,Nissan,Skyline,42,Matchbox,,midnight-runner.png
`;

/** Aliases so slightly different headers still map cleanly. */
const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  car: "name",
  "car name": "name",
  driver: "driver",
  "driver name": "driver",
  make: "make",
  manufacturer: "make",
  model: "model",
  weight_g: "weight_g",
  weight: "weight_g",
  "weight (g)": "weight_g",
  weightg: "weight_g",
  grams: "weight_g",
  brand: "brand",
  diecast: "brand",
  "diecast brand": "brand",
  notes: "notes",
  note: "notes",
  comments: "notes",
  photo: "photo",
  image: "photo",
  picture: "photo",
  filename: "photo",
};

/**
 * Minimal RFC4180-ish CSV parser. Handles quoted fields, escaped quotes,
 * embedded commas/newlines and CRLF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normKey(s: string) {
  return s.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/\s+/g, " ");
}

/** Loose key used to spot duplicates: name + make + model, case-insensitive. */
export function carKey(name: string, make: string, model: string) {
  return [name, make, model].map((s) => s.trim().toLowerCase()).join("|");
}

/** Slug used to match photo filenames against car names. */
export function slug(s: string) {
  return s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "");
}

export interface ParseResult {
  rows: ParsedRow[];
  fatal?: string;
  missingColumns: string[];
}

export function parseCarCsv(text: string, existing: Car[]): ParseResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], fatal: "The CSV file is empty.", missingColumns: [] };

  const rawHeader = table[0].map((h) => normKey(h));
  const map: Record<string, number> = {};
  rawHeader.forEach((h, i) => {
    const key = HEADER_ALIASES[h] ?? HEADER_ALIASES[h.replace(/\s+/g, "_")];
    if (key && !(key in map)) map[key] = i;
  });

  if (!("name" in map)) {
    return {
      rows: [],
      fatal: `No "name" column found. Expected headers: ${CSV_HEADERS.join(", ")}.`,
      missingColumns: [],
    };
  }

  const missingColumns = CSV_HEADERS.filter((h) => !(h in map));
  const existingByKey = new Map(existing.map((c) => [carKey(c.name, c.make, c.model), c.id]));
  const seen = new Map<string, number>();

  const rows: ParsedRow[] = table.slice(1).map((cells, i) => {
    const get = (k: string) => (map[k] === undefined ? "" : (cells[map[k]] ?? "").trim());
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = get("name").slice(0, 60);
    if (!name) errors.push("Missing car name");

    const rawWeight = get("weight_g");
    let weightG = 0;
    if (rawWeight) {
      const n = Number(rawWeight.replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        warnings.push(`Weight "${rawWeight}" is not a number — using 0`);
      } else {
        weightG = Math.min(n, 10000);
      }
    }

    const row: ParsedRow = {
      index: i + 1,
      name,
      driver: get("driver").slice(0, 60),
      make: get("make").slice(0, 40),
      model: get("model").slice(0, 40),
      weightG,
      brand: get("brand").slice(0, 40) || "Other",
      notes: get("notes").slice(0, 300) || undefined,
      photoRef: get("photo") || undefined,
      errors,
      warnings,
    };

    if (name) {
      const key = carKey(row.name, row.make, row.model);
      const dupRow = seen.get(key);
      if (dupRow !== undefined) {
        errors.push(`Duplicate of row ${dupRow} in this file`);
      } else {
        seen.set(key, row.index);
      }
      const existingId = existingByKey.get(key);
      if (existingId) row.duplicateOf = existingId;
    }

    return row;
  });

  return { rows, missingColumns };
}

export type RowStatus = "error" | "duplicate" | "new";

export function rowStatus(row: ParsedRow): RowStatus {
  if (row.errors.length > 0) return "error";
  if (row.duplicateOf) return "duplicate";
  return "new";
}

/** Pick the best photo for a row from the available image map (key = filename). */
export function matchPhoto(row: ParsedRow, photoNames: string[]): string | undefined {
  if (photoNames.length === 0) return undefined;
  if (row.photoRef) {
    const wanted = row.photoRef.split("/").pop()!.toLowerCase();
    const exact = photoNames.find((n) => n.split("/").pop()!.toLowerCase() === wanted);
    if (exact) return exact;
    const bySlug = photoNames.find((n) => slug(n.split("/").pop()!) === slug(wanted));
    if (bySlug) return bySlug;
  }
  const byName = photoNames.find((n) => slug(n.split("/").pop()!) === slug(row.name));
  return byName;
}