import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Images, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Car } from "@/lib/types";
import { uid } from "@/lib/storage";
import { generateDriverName } from "@/lib/driver-names";
import { fileToDataUrl, processImage } from "@/lib/image";
import { downloadBlob } from "@/lib/backup";
import {
  CSV_TEMPLATE,
  matchPhoto,
  parseCarCsv,
  rowStatus,
  type DuplicateMode,
  type ParsedRow,
} from "@/lib/car-import";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: Car[];
  onImport: (result: { added: Car[]; updated: Car[] }) => void;
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

export function BulkImportDialog({ open, onOpenChange, existing, onImport }: Props) {
  const csvRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Record<string, Blob>>({});
  const [photoSource, setPhotoSource] = useState<string | null>(null);
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [busy, setBusy] = useState(false);

  const photoNames = useMemo(() => Object.keys(photos), [photos]);

  const assignments = useMemo(() => {
    const used = new Set<string>();
    const map = new Map<number, string>();
    for (const row of rows) {
      if (rowStatus(row) === "error") continue;
      const available = photoNames.filter((n) => !used.has(n));
      const hit = matchPhoto(row, available);
      if (hit) {
        used.add(hit);
        map.set(row.index, hit);
      }
    }
    return { map, unused: photoNames.filter((n) => !used.has(n)) };
  }, [rows, photoNames]);

  const counts = useMemo(() => {
    let neu = 0;
    let dup = 0;
    let err = 0;
    for (const r of rows) {
      const s = rowStatus(r);
      if (s === "new") neu++;
      else if (s === "duplicate") dup++;
      else err++;
    }
    return { neu, dup, err };
  }, [rows]);

  function reset() {
    setCsvName(null);
    setRows([]);
    setFatal(null);
    setMissingColumns([]);
    setPhotos({});
    setPhotoSource(null);
    setMode("skip");
    if (csvRef.current) csvRef.current.value = "";
    if (photoRef.current) photoRef.current.value = "";
  }

  async function handleCsv(file: File) {
    try {
      const text = await file.text();
      const result = parseCarCsv(text, existing);
      setCsvName(file.name);
      setRows(result.rows);
      setFatal(result.fatal ?? null);
      setMissingColumns(result.missingColumns);
      if (!result.fatal && result.rows.length === 0) setFatal("No data rows found in the CSV.");
    } catch {
      setFatal("Could not read that file.");
    }
  }

  async function handlePhotos(files: FileList) {
    const next: Record<string, Blob> = {};
    let labels: string[] = [];
    for (const file of Array.from(files)) {
      if (/\.zip$/i.test(file.name)) {
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter((f) => !f.dir && IMAGE_RE.test(f.name));
          for (const entry of entries) next[entry.name] = await entry.async("blob");
          labels.push(`${file.name} (${entries.length} image${entries.length === 1 ? "" : "s"})`);
        } catch {
          toast.error(`Could not read ${file.name} as a ZIP`);
        }
      } else if (IMAGE_RE.test(file.name)) {
        next[file.name] = file;
      }
    }
    const loose = Object.keys(next).length - 0;
    setPhotos(next);
    if (labels.length === 0) labels = [`${loose} image${loose === 1 ? "" : "s"} selected`];
    setPhotoSource(labels.join(", "));
  }

  async function photoDataUrl(name: string): Promise<string | undefined> {
    try {
      const blob = photos[name];
      if (!blob) return undefined;
      const file = blob instanceof File ? blob : new File([blob], name);
      const raw = await fileToDataUrl(file);
      return await processImage(raw, null, { maxDim: 1600 });
    } catch {
      return undefined;
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const byId = new Map(existing.map((c) => [c.id, c]));
      const added: Car[] = [];
      const updated: Car[] = [];
      let skipped = 0;

      for (const row of rows) {
        const status = rowStatus(row);
        if (status === "error") continue;
        const photoName = assignments.map.get(row.index);
        const photo = photoName ? await photoDataUrl(photoName) : undefined;

        if (status === "duplicate" && mode === "skip") {
          skipped++;
          continue;
        }

        if (status === "duplicate" && mode === "update") {
          const prev = byId.get(row.duplicateOf!);
          if (!prev) continue;
          updated.push({
            ...prev,
            name: row.name || prev.name,
            driver: row.driver || prev.driver,
            make: row.make || prev.make,
            model: row.model || prev.model,
            weightG: row.weightG || prev.weightG,
            brand: row.brand || prev.brand,
            notes: row.notes ?? prev.notes,
            photo: photo ?? prev.photo,
          });
          continue;
        }

        added.push({
          id: uid(),
          name: row.name,
          driver: row.driver || generateDriverName(),
          make: row.make,
          model: row.model,
          weightG: row.weightG,
          brand: row.brand,
          notes: row.notes,
          photo,
          createdAt: Date.now(),
        });
      }

      onImport({ added, updated });
      const parts = [
        `${added.length} added`,
        updated.length ? `${updated.length} updated` : null,
        skipped ? `${skipped} skipped` : null,
        counts.err ? `${counts.err} failed` : null,
      ].filter(Boolean);
      toast.success(`Import complete — ${parts.join(", ")}`);
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const importable = rows.filter((r) => rowStatus(r) !== "error").length;
  const willWrite = mode === "skip" ? counts.neu : importable;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import cars</DialogTitle>
          <DialogDescription>
            Load a CSV of cars, optionally with a ZIP or selection of photos. Nothing is saved
            until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4" /> CSV file
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {csvName ?? "No file chosen"}
              </p>
              <input
                ref={csvRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCsv(e.target.files[0])}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button type="button" size="sm" onClick={() => csvRef.current?.click()}>
                  Choose CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadBlob(
                      new Blob([CSV_TEMPLATE], { type: "text/csv" }),
                      "pitlane-cars-template.csv",
                    )
                  }
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Template
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Images className="h-4 w-4" /> Photos (optional)
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {photoSource ?? "No photos chosen"}
              </p>
              <input
                ref={photoRef}
                type="file"
                multiple
                accept="image/*,.zip,application/zip"
                className="hidden"
                onChange={(e) => e.target.files?.length && handlePhotos(e.target.files)}
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => photoRef.current?.click()}
                >
                  Choose images or ZIP
                </Button>
              </div>
            </div>
          </div>

          {fatal ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{fatal}</span>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{counts.neu} new</Badge>
                <Badge variant="secondary">{counts.dup} duplicate</Badge>
                {counts.err ? <Badge variant="destructive">{counts.err} with errors</Badge> : null}
                {missingColumns.length > 0 ? (
                  <span className="text-muted-foreground">
                    Missing optional columns: {missingColumns.join(", ")}
                  </span>
                ) : null}
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-secondary/80 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Make / model</th>
                      <th className="px-3 py-2 font-medium">Photo</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const s = rowStatus(r);
                      const photoName = assignments.map.get(r.index);
                      return (
                        <tr key={r.index} className="border-t border-border align-top">
                          <td className="px-3 py-2 text-muted-foreground">{r.index}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.name || "—"}</div>
                            {r.warnings.map((w) => (
                              <div key={w} className="text-[11px] text-muted-foreground">
                                {w}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {[r.make, r.model].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {photoName ? photoName.split("/").pop() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {s === "error" ? (
                              <span className="text-destructive">{r.errors.join("; ")}</span>
                            ) : s === "duplicate" ? (
                              <span className="text-muted-foreground">Duplicate</span>
                            ) : (
                              <span className="text-muted-foreground">New</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {assignments.unused.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {assignments.unused.length} image
                  {assignments.unused.length === 1 ? "" : "s"} not matched to any row:{" "}
                  {assignments.unused
                    .slice(0, 5)
                    .map((n) => n.split("/").pop())
                    .join(", ")}
                  {assignments.unused.length > 5 ? "…" : ""}
                </p>
              ) : null}

              <div>
                <Label className="mb-2 block">If a row matches an existing car</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as DuplicateMode)}
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {(
                    [
                      ["skip", "Skip", "Leave the existing car alone"],
                      ["update", "Update existing", "Overwrite with CSV values"],
                      ["add", "Add as new", "Create a second car"],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3"
                    >
                      <RadioGroupItem value={value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy || willWrite === 0}>
            {busy ? "Importing…" : `Import ${willWrite} car${willWrite === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}