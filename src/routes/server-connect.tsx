import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useServerConfig,
  writeServerConfig,
  normaliseUrl,
  type ServerConfig,
} from "@/lib/data/server-config";
import { login, ping, register } from "@/lib/data/api";
import { Cloud, CloudOff, Copy, ExternalLink, LogOut, ShieldCheck, Terminal } from "lucide-react";

export const Route = createFileRoute("/server-connect")({
  head: () => ({
    meta: [
      { title: "Connect a server — Pit Lane" },
      { name: "description", content: "Sync Pit Lane data across devices with a self-hosted server." },
    ],
  }),
  component: ServerConnectPage,
});

type Step = "intro" | "install" | "connect" | "account";

function ServerConnectPage() {
  const cfg = useServerConfig();
  if (cfg) return <Connected cfg={cfg} />;
  return <Wizard />;
}

function Connected({ cfg }: { cfg: ServerConfig }) {
  const navigate = useNavigate();

  function disconnect() {
    writeServerConfig(null);
    toast.success("Disconnected. Pit Lane is now running on local storage.");
  }

  let host = cfg.url;
  try { host = new URL(cfg.url).host; } catch { /* ignore */ }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Server connection</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pit Lane is syncing with your self-hosted server.
      </p>

      <Card className="mt-6 space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Cloud className="h-4 w-4 text-emerald-500" /> Connected
        </div>
        <dl className="grid grid-cols-3 gap-y-1 text-sm">
          <dt className="col-span-1 text-muted-foreground">Server</dt>
          <dd className="col-span-2 font-mono">{host}</dd>
          <dt className="col-span-1 text-muted-foreground">Signed in as</dt>
          <dd className="col-span-2">{cfg.email}</dd>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>Back to app</Button>
          <Button variant="destructive" onClick={disconnect}>
            <LogOut className="mr-1 h-4 w-4" /> Disconnect & go offline
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <ShieldCheck className="h-4 w-4" /> What syncs
        </div>
        <p className="mt-2">
          Your cars, teams, and tournaments are stored in Postgres on your server.
          Multiple browsers signed into the same account see live updates over WebSockets.
          Local data on this device is not deleted when you disconnect.
        </p>
      </Card>
    </main>
  );
}

function Wizard() {
  const [step, setStep] = useState<Step>("intro");
  const [url, setUrl] = useState("http://localhost:8787");
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function testConnection() {
    setTesting(true);
    setServerVersion(null);
    try {
      const r = await ping(url);
      if (!r.ok) throw new Error("Server responded with ok:false");
      setServerVersion(r.version);
      toast.success(`Connected to server v${r.version}`);
      setStep("account");
    } catch (err) {
      toast.error(`Couldn't reach server: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const r = mode === "login" ? await login(url, email, password) : await register(url, email, password);
      const cfg: ServerConfig = {
        url: normaliseUrl(url),
        token: r.token,
        email: r.user.email,
        clientId: crypto.randomUUID(),
      };
      writeServerConfig(cfg);
      toast.success(`Signed in as ${r.user.email}`);
      navigate({ to: "/" });
    } catch (err) {
      const msg = (err as Error).message;
      const friendly =
        msg === "invalid_credentials" ? "Wrong email or password."
        : msg === "email_taken" ? "An account with that email already exists — try signing in instead."
        : msg === "password_too_short" ? "Password must be at least 6 characters."
        : msg === "invalid_email" ? "That doesn't look like a valid email."
        : msg;
      toast.error(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <CloudOff className="h-3.5 w-3.5" /> Optional
      </div>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Connect a self-hosted server</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        By default Pit Lane stores everything in your browser. Run a small server on
        your PC or NAS to sync across devices and share live tournaments.
      </p>

      <StepIndicator step={step} />

      {step === "intro" && (
        <Card className="mt-6 space-y-4 p-5">
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">What you get</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Data stored in Postgres on your machine — full ownership.</li>
              <li>Same garage/tournaments on every device where you sign in.</li>
              <li>Live updates over WebSockets during a running tournament.</li>
              <li>Toggle off anytime — local data is preserved.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setStep("install")}>I need to install it</Button>
            <Button variant="outline" onClick={() => setStep("connect")}>My server is already running</Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/" })}>Keep using local only</Button>
          </div>
        </Card>
      )}

      {step === "install" && <InstallStep onNext={() => setStep("connect")} />}

      {step === "connect" && (
        <Card className="mt-6 space-y-4 p-5">
          <div>
            <div className="text-sm font-semibold">Server URL</div>
            <p className="text-xs text-muted-foreground">
              Include the port. Use https:// if your server is behind a tunnel or reverse proxy.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-url">Server URL</Label>
            <Input
              id="server-url"
              placeholder="http://192.168.1.20:8787"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          {serverVersion && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              Reached server v{serverVersion}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={testConnection} disabled={testing || !url.trim()}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("intro")}>Back</Button>
          </div>
        </Card>
      )}

      {step === "account" && (
        <Card className="mt-6 space-y-4 p-5">
          <div className="flex gap-1 rounded-md bg-secondary/60 p-1">
            <button
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("login")}
            >Sign in</button>
            <button
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("register")}
            >Create account</button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={submitting || !email || !password}>
              {submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("connect")}>Back</Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "intro", label: "Overview" },
    { id: "install", label: "Install" },
    { id: "connect", label: "Connect" },
    { id: "account", label: "Sign in" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
              i <= idx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "text-foreground font-medium" : ""}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-border">›</span>}
        </div>
      ))}
    </div>
  );
}

function InstallStep({ onNext }: { onNext: () => void }) {
  function copyCmd(cmd: string) {
    void navigator.clipboard.writeText(cmd);
    toast.success("Copied to clipboard");
  }

  const steps: { title: string; body: React.ReactNode; cmd?: string }[] = [
    {
      title: "Install Docker Desktop",
      body: (
        <>Download and install{" "}
          <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noreferrer" className="underline">
            Docker Desktop
          </a>{" "}on the machine that will host the server (your PC, Mac, or NAS). Make sure it's running before continuing.</>
      ),
    },
    {
      title: "Download the server bundle",
      body: (
        <>Go to the <strong>Backup</strong> page in Pit Lane and click <em>Download server bundle</em>. Unzip it on the host machine — you'll get a <code className="rounded bg-secondary px-1 text-[11px]">pitlane-server</code> folder.</>
      ),
    },
    {
      title: "Open a terminal in that folder",
      body: <>On Windows use PowerShell; on macOS/Linux use Terminal. Then <code className="rounded bg-secondary px-1 text-[11px]">cd</code> into the unzipped <code className="rounded bg-secondary px-1 text-[11px]">pitlane-server</code> folder.</>,
    },
    {
      title: "Create your .env file",
      body: <>Copy the example env file, then open <code className="rounded bg-secondary px-1 text-[11px]">.env</code> in a text editor and change <code className="rounded bg-secondary px-1 text-[11px]">JWT_SECRET</code> to a long random string.</>,
      cmd: "cp .env.example .env",
    },
    {
      title: "Start the server",
      body: <>Docker will pull Postgres and build the API. First run takes a minute or two.</>,
      cmd: "docker compose up -d",
    },
    {
      title: "Confirm it's running",
      body: <>You should see <code className="rounded bg-secondary px-1 text-[11px]">{`{"ok":true}`}</code>. The server URL you'll paste in the next step is <code className="rounded bg-secondary px-1 text-[11px]">http://&lt;host&gt;:8787</code>.</>,
      cmd: "curl http://localhost:8787/health",
    },
  ];

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-foreground">Install the companion server</p>
        <p className="text-muted-foreground">
          Follow these steps on the machine that will host the server. It doesn't need to be this device — any always-on computer on your network works.
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-md border border-border bg-secondary/20 p-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <div className="font-medium text-foreground">{s.title}</div>
              <div className="text-muted-foreground">{s.body}</div>
              {s.cmd && (
                <div className="relative">
                  <pre className="overflow-auto rounded border border-border bg-background px-2 py-1.5 pr-14 text-xs font-mono">{s.cmd}</pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCmd(s.cmd!)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 gap-1 px-2 text-[11px]"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
          <Terminal className="h-3.5 w-3.5" /> HTTPS note
        </div>
        <p className="mt-1 text-amber-800 dark:text-amber-200">
          Because Pit Lane is served over HTTPS, browsers block plain-HTTP requests to a
          different host. Easiest fix: run{" "}
          <a
            href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline"
          >
            <code>cloudflared tunnel --url http://localhost:8787</code>
            <ExternalLink className="h-3 w-3" />
          </a>{" "}
          and paste the HTTPS URL it prints into the next step.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onNext}>I've started the server</Button>
      </div>
    </Card>
  );
}