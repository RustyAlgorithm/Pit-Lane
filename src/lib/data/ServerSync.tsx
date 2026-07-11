/**
 * @file ServerSync.tsx
 * @description When a server connection is configured, this component:
 * 1. Pulls the latest snapshot from the server on mount / reconnect and
 *    replaces localStorage (cars / teams / tournaments).
 * 2. Watches local changes and pushes them back to the server (debounced).
 * 3. Opens a WebSocket and applies remote updates from other clients.
 *
 * All page components continue to use `useLocalStorage` as before — this
 * component just keeps localStorage in sync with the server on both sides.
 */

import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Team, Tournament } from "@/lib/types";
import { useServerConfig, writeServerConfig } from "./server-config";
import { fetchSnapshot, pushSnapshot, wsUrl } from "./api";
import { toast } from "sonner";

export type ConnectionStatus = "offline" | "connecting" | "live" | "reconnecting" | "error";

const STATUS_EVENT = "pitlane:server-status";

export function readConnectionStatus(): ConnectionStatus {
  if (typeof window === "undefined") return "offline";
  return (window as unknown as { __pitlaneStatus?: ConnectionStatus }).__pitlaneStatus ?? "offline";
}

export function useConnectionStatus(): ConnectionStatus {
  const [s, setS] = useState<ConnectionStatus>(() => readConnectionStatus());
  useEffect(() => {
    const on = (e: Event) => setS((e as CustomEvent<ConnectionStatus>).detail);
    window.addEventListener(STATUS_EVENT, on);
    return () => window.removeEventListener(STATUS_EVENT, on);
  }, []);
  return s;
}

function setStatus(s: ConnectionStatus) {
  (window as unknown as { __pitlaneStatus?: ConnectionStatus }).__pitlaneStatus = s;
  window.dispatchEvent(new CustomEvent<ConnectionStatus>(STATUS_EVENT, { detail: s }));
}

export function ServerSync() {
  const cfg = useServerConfig();
  const [cars, setCars, carsReady] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams, setTeams, teamsReady] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [tournaments, setTournaments, tournamentsReady] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);

  const applyingRemote = useRef(false);
  const lastPushed = useRef<string>("");
  const initialised = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Reset when connection is dropped.
  useEffect(() => {
    if (!cfg) {
      setStatus("offline");
      initialised.current = false;
      lastPushed.current = "";
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  }, [cfg]);

  // Initial pull + WS lifecycle.
  useEffect(() => {
    if (!cfg) return;
    if (!carsReady || !teamsReady || !tournamentsReady) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    async function initialPull() {
      if (!cfg) return;
      setStatus("connecting");
      try {
        const snap = await fetchSnapshot(cfg.url, cfg.token);
        if (cancelled) return;
        applyingRemote.current = true;
        setCars(snap.cars ?? []);
        setTeams(snap.teams ?? []);
        setTournaments(snap.tournaments ?? []);
        lastPushed.current = JSON.stringify({
          cars: snap.cars ?? [],
          teams: snap.teams ?? [],
          tournaments: snap.tournaments ?? [],
        });
        // Release the guard on the next tick, after React commits.
        setTimeout(() => {
          applyingRemote.current = false;
          initialised.current = true;
        }, 0);
        connectWs();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        toast.error(`Server unreachable: ${(err as Error).message}`);
      }
    }

    function connectWs() {
      if (!cfg || cancelled) return;
      try {
        ws = new WebSocket(wsUrl(cfg.url, cfg.token));
        wsRef.current = ws;
        ws.onopen = () => {
          reconnectAttempt = 0;
          setStatus("live");
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as {
              type: string;
              origin?: string | null;
              cars?: Car[];
              teams?: Team[];
              tournaments?: Tournament[];
            };
            if (msg.type !== "snapshot.updated") return;
            if (msg.origin && cfg && msg.origin === cfg.clientId) return; // our own write
            applyingRemote.current = true;
            if (msg.cars) setCars(msg.cars);
            if (msg.teams) setTeams(msg.teams);
            if (msg.tournaments) setTournaments(msg.tournaments);
            lastPushed.current = JSON.stringify({
              cars: msg.cars ?? [],
              teams: msg.teams ?? [],
              tournaments: msg.tournaments ?? [],
            });
            setTimeout(() => { applyingRemote.current = false; }, 0);
          } catch { /* ignore malformed */ }
        };
        ws.onclose = () => {
          wsRef.current = null;
          if (cancelled) return;
          setStatus("reconnecting");
          reconnectAttempt++;
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
          reconnectTimer = setTimeout(connectWs, delay);
        };
        ws.onerror = () => { /* handled by onclose */ };
      } catch {
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connectWs, 2000);
      }
    }

    void initialPull();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, carsReady, teamsReady, tournamentsReady]);

  // Push local changes to the server (debounced).
  useEffect(() => {
    if (!cfg) return;
    if (!initialised.current) return;
    if (applyingRemote.current) return;
    const snap = JSON.stringify({ cars, teams, tournaments });
    if (snap === lastPushed.current) return;

    const t = setTimeout(async () => {
      try {
        await pushSnapshot(cfg.url, cfg.token, { cars, teams, tournaments, clientId: cfg.clientId });
        lastPushed.current = snap;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "unauthorized") {
          toast.error("Server session expired. Please sign in again.");
          writeServerConfig(null);
        } else {
          setStatus("reconnecting");
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cars, teams, tournaments, cfg]);

  return null;
}