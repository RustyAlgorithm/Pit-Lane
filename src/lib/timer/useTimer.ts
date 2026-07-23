/**
 * @file useTimer.ts
 * @description React hook that connects to a Raspberry Pi lap timer over a
 * LAN WebSocket and streams lap events to the caller.
 *
 * Pi event contract (JSON per message):
 *   { type: "lap",       lane?: number, ms: number, ts?: number }
 *   { type: "run_end",   lane?: number, ms: number, ts?: number }
 *   { type: "run_start", lane?: number, ts?: number }
 *   { type: "hello",     device?: string, version?: string }
 *
 * Only `type` + `ms` (for lap/run_end) + optional `lane` are required.
 */

import { useEffect, useRef, useState } from "react";

export type TimerStatus = "offline" | "connecting" | "live" | "reconnecting" | "error";

export interface LapEvent {
  lane: number | null;
  ms: number;
  ts: number;
}

interface RawMsg {
  type?: string;
  lane?: number;
  ms?: number;
  ts?: number;
}

export function useTimer(url: string | null, onLap: (e: LapEvent) => void) {
  const [status, setStatus] = useState<TimerStatus>("offline");
  const [lastEvent, setLastEvent] = useState<LapEvent | null>(null);
  const onLapRef = useRef(onLap);
  useEffect(() => { onLapRef.current = onLap; }, [onLap]);

  useEffect(() => {
    if (!url) { setStatus("offline"); return; }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      if (cancelled) return;
      try {
        setStatus(attempt === 0 ? "connecting" : "reconnecting");
        ws = new WebSocket(url!);
      } catch {
        setStatus("error");
        schedule();
        return;
      }
      ws.onopen = () => { attempt = 0; setStatus("live"); };
      ws.onmessage = (ev) => {
        let msg: RawMsg;
        try { msg = JSON.parse(String(ev.data)) as RawMsg; } catch { return; }
        if (msg.type !== "lap" && msg.type !== "run_end") return;
        const ms = Number(msg.ms);
        if (!Number.isFinite(ms) || ms <= 0) return;
        const e: LapEvent = {
          lane: typeof msg.lane === "number" ? msg.lane : null,
          ms,
          ts: typeof msg.ts === "number" ? msg.ts : Date.now(),
        };
        setLastEvent(e);
        onLapRef.current(e);
      };
      ws.onerror = () => { /* handled by onclose */ };
      ws.onclose = () => {
        if (cancelled) return;
        schedule();
      };
    }

    function schedule() {
      attempt++;
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4));
      setStatus("reconnecting");
      retryTimer = setTimeout(connect, delay);
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) { try { ws.close(); } catch { /* ignore */ } }
    };
  }, [url]);

  return { status, lastEvent };
}