import { createFileRoute, Link } from "@tanstack/react-router";
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
import type { Car, Tournament, Team } from "@/lib/types";
import { exportBackupZip, importBackupZip, downloadBlob, BackupValidationError } from "@/lib/backup";
import { buildServerBundleZip } from "@/lib/data/server-bundle";
import { useServerConfig, writeServerConfig } from "@/lib/data/server-config";
import { Download, Upload, Database, AlertTriangle, Cloud, CloudOff, Server, LogOut, ExternalLink, Copy, Check, Terminal, HardDrive, Plug } from "lucide-react";
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
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ cars: Car[]; tournaments: Tournament[]; teams: Team[]; warnings: string[] } | null>(null);
  const [mode, setMode] = useState<Mode>("replace");
  const [errorReport, setErrorReport] = useState<{ issues: string[]; warnings: string[] } | null>(null);
  const serverCfg = useServerConfig();
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyCmd(cmd: string, id: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy — copy manually");
    }
  }

  async function downloadServerBundle() {
    setDownloadingBundle(true);
    try {
      const blob = await buildServerBundleZip();
      downloadBlob(blob, "pitlane-server.zip");
      toast.success("Server bundle downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't build server bundle");
    } finally {
      setDownloadingBundle(false);
    }
  }

  function disconnectServer() {
    writeServerConfig(null);
    toast.success("Disconnected. Pit Lane is running on local storage.");
  }

  let serverHost = serverCfg?.url ?? "";
  try { if (serverCfg) serverHost = new URL(serverCfg.url).host; } catch { /* ignore */ }

  async function doExport() {
    try {
      const blob = await exportBackupZip(cars, tournaments, teams);
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
      setTeams(pending.teams);
    } else {
      setCars((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...pending.cars.filter((c) => !ids.has(c.id))];
      });
      setTournaments((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...pending.tournaments.filter((t) => !ids.has(t.id))];
      });
      setTeams((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...pending.teams.filter((t) => !ids.has(t.id))];
      });
    }
    toast.success(`Imported ${pending.cars.length} cars, ${pending.tournaments.length} tournaments, ${pending.teams.length} teams`);
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
            <dt className="text-muted-foreground">Teams</dt>
            <dd className="text-right font-medium">{teams.length}</dd>
          </dl>
        </Card>

        <Card className="p-5 shadow-[var(--shadow-card)]">
          <div className="text-sm font-semibold">Export</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Photos are renamed using each car's unique ID.
          </p>
          <Button onClick={doExport} className="mt-3 w-full" disabled={cars.length === 0 && tournaments.length === 0 && teams.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Download ZIP
          </Button>
        </Card>
      </div>

      <Card className="mt-4 p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {serverCfg ? (
            <><Cloud className="h-4 w-4 text-emerald-500" /> Sync across devices</>
          ) : (
            <><CloudOff className="h-4 w-4 text-muted-foreground" /> Sync across devices</>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Run a small self-hosted server (Docker + Postgres) to share your
          garage, teams, and live tournaments between devices.
        </p>
        {serverCfg ? (
          <div className="mt-3 space-y-3">
            <dl className="grid grid-cols-3 gap-y-1 text-sm">
              <dt className="col-span-1 text-muted-foreground">Server</dt>
              <dd className="col-span-2 truncate font-mono">{serverHost}</dd>
              <dt className="col-span-1 text-muted-foreground">Signed in</dt>
              <dd className="col-span-2 truncate">{serverCfg.email}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/server-connect">Manage connection</Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={disconnectServer}>
                <LogOut className="mr-1 h-4 w-4" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              <div className="font-semibold text-foreground">Before you start</div>
              <p className="mt-1 text-muted-foreground">
                You'll need <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noreferrer" className="underline">Docker Desktop</a> (or Docker Engine) installed on the machine that will host the server. Everything else is included in the bundle.
              </p>
            </div>

            <InstallStep
              n={1}
              icon={<Download className="h-4 w-4" />}
              title="Download the server bundle"
              desc="A small ZIP with Docker Compose, the API, and the database schema."
            >
              <Button onClick={downloadServerBundle} disabled={downloadingBundle} size="sm">
                <Download className="mr-1 h-4 w-4" />
                {downloadingBundle ? "Preparing…" : "Download pitlane-server.zip"}
              </Button>
            </InstallStep>

            <InstallStep
              n={2}
              icon={<HardDrive className="h-4 w-4" />}
              title="Unzip it on your host machine"
              desc="A PC, laptop, NAS, or home server that stays on when you want to sync. Open a terminal inside the unzipped pitlane-server folder."
            />

            <InstallStep
              n={3}
              icon={<Terminal className="h-4 w-4" />}
              title="Create your .env file"
              desc="Copy the example and set a long random JWT_SECRET (32+ characters)."
            >
              <CopyLine text="cp .env.example .env" id="cp" copied={copied === "cp"} onCopy={() => copyCmd("cp .env.example .env", "cp")} />
              <p className="text-[11px] text-muted-foreground">
                Then open <code className="rounded bg-secondary px-1">.env</code> and replace <code className="rounded bg-secondary px-1">JWT_SECRET</code> with a random string.
              </p>
            </InstallStep>

            <InstallStep
              n={4}
              icon={<Server className="h-4 w-4" />}
              title="Start the server"
              desc="Docker will pull Postgres, build the API, and start both."
            >
              <CopyLine text="docker compose up -d" id="up" copied={copied === "up"} onCopy={() => copyCmd("docker compose up -d", "up")} />
              <p className="text-[11px] text-muted-foreground">
                Verify it's running: <code className="rounded bg-secondary px-1">curl http://localhost:8787/health</code>
              </p>
            </InstallStep>

            <InstallStep
              n={5}
              icon={<Plug className="h-4 w-4" />}
              title="Connect Pit Lane"
              desc="Open the wizard, paste your server URL, and create your account."
            >
              <Button asChild size="sm">
                <Link to="/server-connect">
                  <Plug className="mr-1 h-4 w-4" /> Open connect wizard
                </Link>
              </Button>
            </InstallStep>

            <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <span>Accessing from another network or over HTTPS?</span>
              <a
                href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                Cloudflare Tunnel guide <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </Card>

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
                  <strong>{pending?.tournaments.length ?? 0}</strong> tournaments,{" "}
                  <strong>{pending?.teams.length ?? 0}</strong> teams.
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

function InstallStep({
  n,
  icon,
  title,
  desc,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </div>
        <p className="text-xs text-muted-foreground">{desc}</p>
        {children && <div className="space-y-2 pt-1">{children}</div>}
      </div>
    </div>
  );
}

function CopyLine({
  text,
  copied,
  onCopy,
}: {
  text: string;
  id: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-2 py-1.5">
      <code className="flex-1 truncate font-mono text-[12px] text-foreground">{text}</code>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label="Copy command"
      >
        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );
}
