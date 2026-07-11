/**
 * @file server-config.ts
 * @description Optional self-hosted server connection settings.
 * Stored in localStorage; when set, the ServerSync component mirrors
 * cars/teams/tournaments to that server and receives live updates.
 */

import { useEffect, useState } from "react";

export interface ServerConfig {
  url: string;
  token: string;
  email: string;
  clientId: string;
}

const STORAGE_KEY = "pitlane.server";
const EVENT_NAME = "pitlane:server-config";

export function readServerConfig(): ServerConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ServerConfig>;
    if (!v.url || !v.token || !v.email) return null;
    if (!v.clientId) v.clientId = crypto.randomUUID();
    return v as ServerConfig;
  } catch {
    return null;
  }
}

export function writeServerConfig(cfg: ServerConfig | null) {
  if (typeof window === "undefined") return;
  if (cfg) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Normalise a server base URL (strip trailing slash).
 */
export function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * React hook returning the current server config, updating when it changes
 * in this tab (via the custom event) or another tab (via storage event).
 */
export function useServerConfig(): ServerConfig | null {
  const [cfg, setCfg] = useState<ServerConfig | null>(null);

  useEffect(() => {
    setCfg(readServerConfig());
    const onLocal = () => setCfg(readServerConfig());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCfg(readServerConfig());
    };
    window.addEventListener(EVENT_NAME, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return cfg;
}