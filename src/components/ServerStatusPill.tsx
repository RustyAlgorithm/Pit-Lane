/**
 * @file ServerStatusPill.tsx
 * @description Header indicator showing whether Pit Lane is running on local
 * storage or connected to a self-hosted server. Clickable — takes the user
 * to the connection wizard.
 */

import { Link } from "@tanstack/react-router";
import { useServerConfig } from "@/lib/data/server-config";
import { useConnectionStatus } from "@/lib/data/ServerSync";
import { Cloud, CloudOff, Loader2, WifiOff } from "lucide-react";

export function ServerStatusPill() {
  const cfg = useServerConfig();
  const status = useConnectionStatus();

  if (!cfg) {
    return (
      <Link
        to="/server-connect"
        className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary sm:inline-flex"
        title="Data stored on this device only. Click to connect a server."
      >
        <CloudOff className="h-3 w-3" />
        Local only
      </Link>
    );
  }

  let hostname = cfg.url;
  try { hostname = new URL(cfg.url).host; } catch { /* ignore */ }

  const dot =
    status === "live" ? "bg-emerald-500"
    : status === "connecting" ? "bg-amber-500"
    : status === "reconnecting" ? "bg-amber-500"
    : status === "error" ? "bg-red-500"
    : "bg-muted-foreground";

  const icon =
    status === "connecting" || status === "reconnecting"
      ? <Loader2 className="h-3 w-3 animate-spin" />
      : status === "error"
      ? <WifiOff className="h-3 w-3" />
      : <Cloud className="h-3 w-3" />;

  return (
    <Link
      to="/server-connect"
      className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
      title={`${cfg.email} @ ${hostname} (${status})`}
    >
      {icon}
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="max-w-[10rem] truncate">{hostname}</span>
    </Link>
  );
}