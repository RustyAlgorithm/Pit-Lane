import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Tournament } from "@/lib/types";
import { exportBackupZip, importBackupZip, downloadBlob, BackupValidationError } from "@/lib/backup";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [
      { title: "Backup — Pit Lane" },
      { name: "description", content: "Export and restore your garage and tournaments." },
    ],
  }),
  component: BackupPage,
});

type Mode = "replace" | "merge";

function BackupPage() {
  const [cars, setCars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [tournaments, setTournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ cars: Car[]; tournaments: Tournament[]; warnings: string[] } | null>(null);
  const [mode, setMode] = useState<Mode>("replace");
  const [errorReport, setErrorReport] = useState<{ issues: string[]; warnings: string[] } | null>(null);

  async function doExport() {
    try {
      const blob = await exportBackupZip(cars, tournaments);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `pitlane-backup-${stamp}.zip`);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Export failed");
    }
  }

  async function onPick(file: File) {
    try {
      const data = await importBackupZip(file);
      setPending(data);
      setErrorReport(null);
    } catch (e) {
      if (e instanceof BackupValidationError) {
        setErrorReport({ issues: e.issues, warnings: e.warnings });
        toast.error(`Backup is invalid — ${e.issues.length} issue(s) found`);
      } else {
        toast.error((e as Error).message || "Invalid backup file");
      }
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyImport() {
    if (!pending) return;
    if (mode === "replace") {
      setCars(pending.cars);
      setTournaments(pending.tournaments);
    } else {
      setCars((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...pending.cars.filter((c) => !ids.has(c.id))];
      });
      setTournaments((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...pending.tournaments.filter((t) => !ids.has(t.id))];
      });
    }
    toast.success(`Imported ${pending.cars.length} cars, ${pending.tournaments.length} tournaments`);
    setPending(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Backup</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Export your garage and tournaments as a single ZIP file (data + images), or restore from a previous backup.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" /> Current data
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Cars</dt>
            <dd className="text-right font-medium">{cars.length}</dd>
            <dt className="text-muted-foreground">Tournaments</dt>
            <dd className="text-right font-medium">{tournaments.length}</dd>
          </dl>
        </Card>

        <Card className="p-5 shadow-[var(--shadow-card)]">
          <div className="text-sm font-semibold">Export</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Photos are renamed using each car's unique ID.
          </p>
          <Button onClick={doExport} className="mt-3 w-full" disabled={cars.length === 0 && tournaments.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Download ZIP
          </Button>
        </Card>
      </div>

      <Card className="mt-4 p-5 shadow-[var(--shadow-card)]">
        <div className="text-sm font-semibold">Import</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a previously exported ZIP. You'll confirm before anything is changed.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="mt-3 w-full">
          <Upload className="mr-1 h-4 w-4" /> Choose backup file
        </Button>
      </Card>

      {errorReport && (
        <Card className="mt-4 border-destructive/40 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Import blocked — {errorReport.issues.length} issue{errorReport.issues.length === 1 ? "" : "s"}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setErrorReport(null)}>Dismiss</Button>
          </div>
          <ul className="mt-3 max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-foreground">
            {errorReport.issues.map((m, i) => <li key={`e${i}`}>{m}</li>)}
          </ul>
          {errorReport.warnings.length > 0 && (
            <>
              <div className="mt-3 text-xs font-semibold text-muted-foreground">Warnings</div>
              <ul className="mt-1 max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
                {errorReport.warnings.map((m, i) => <li key={`w${i}`}>{m}</li>)}
              </ul>
            </>
          )}
        </Card>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Backup contains <strong>{pending?.cars.length ?? 0}</strong> cars and{" "}
                  <strong>{pending?.tournaments.length ?? 0}</strong> tournaments.
                </div>
                {pending && pending.warnings.length > 0 && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" /> {pending.warnings.length} warning{pending.warnings.length === 1 ? "" : "s"}
                    </div>
                    <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-muted-foreground">
                      {pending.warnings.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1" />
                    <div>
                      <div className="font-medium text-foreground">Replace</div>
                      <div className="text-xs text-muted-foreground">Overwrite all current data with the backup.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="mode" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-1" />
                    <div>
                      <div className="font-medium text-foreground">Merge</div>
                      <div className="text-xs text-muted-foreground">Add entries that don't already exist (matched by ID).</div>
                    </div>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyImport}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
