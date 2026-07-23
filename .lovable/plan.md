
# Raspberry Pi Timer → Pit Lane (browser LAN link)

Direct browser ↔ Pi connection over your local network. No companion server required, no auth (LAN-only). Works while the Time Trial view is open in the browser.

## How it will work

```text
[Pi timer box]  --WebSocket (ws://pi.local:8790)-->  [Pit Lane tab]
   sensors                 lap events                   Time Trial view
```

- The Pi runs a tiny WebSocket server that emits events when a sensor fires.
- Pit Lane's Time Trial view opens that WebSocket, listens for events, and appends runs to the active tournament automatically.
- If a lane/sensor isn't mapped yet, the time drops into an **Unassigned times** queue where the user taps a car to assign it.

## Pi event contract (what the Pi sends)

Small JSON, one per pass. This is the only contract the Pi has to honour — you can build the Pi firmware later in any language.

```json
{ "type": "lap",       "lane": 1, "ms": 4238, "ts": 1730000000000 }
{ "type": "run_start", "lane": 1, "ts": 1730000000000 }
{ "type": "run_end",   "lane": 1, "ms": 4238, "ts": 1730000000000 }
{ "type": "hello",     "device": "pitlane-timer", "version": "0.1" }
```

Pit Lane will only require `type` + `ms` + (optional) `lane`. Everything else is ignored gracefully.

## Web app changes

New settings, all client-side:

1. **Timer settings panel** on the Time Trial tournament view:
   - Timer URL input (default `ws://pitlane-timer.local:8790`), Connect / Disconnect, live status dot (offline / connecting / live).
   - Lane → Car mapping table (one row per lane the Pi reports, dropdown of tournament roster).
   - Toggle: *Auto-record* (add straight to the leaderboard) vs *Review first* (drop into unassigned queue).
   - Persisted in `localStorage` under `pitlane.timer.<tournamentId>`.

2. **Unassigned times queue** (in the same view): list of times received without a mapped lane, each with a "Assign to…" car picker and a discard button.

3. **New hook** `src/lib/timer/useTimer.ts` — opens the WebSocket, auto-reconnects with backoff, exposes `{status, lastEvent, onLap(cb)}`.

4. **Wire into existing time-trial recording** in `src/routes/tournaments.$id.tsx` — reuses the same `addTimeEntry` path the manual UI already calls, so leaderboards, backups, and championship qualifying keep working with zero changes.

Nothing about tournament data model, backup schema, or the self-hosted server changes.

## Mixed-content note (important, non-blocking)

The Lovable-hosted app is HTTPS. Browsers block `ws://` from an HTTPS page. Two workable options, documented in the settings panel:

- Run Pit Lane locally at `http://localhost` while using the timer (simplest for a garage setup).
- Put the Pi behind a Cloudflare Tunnel or self-signed cert so it's reachable at `wss://…`.

We'll surface both in a small "Can't connect?" help popover next to the Timer URL field.

## Out of scope (this pass)

- The actual Pi firmware / hardware code (separate project — the event contract above is the interface).
- Server-side ingestion (not needed for browser-direct mode; can be added later if you want cross-device sync of timer events).
- Start/finish remote control from Pi (you didn't ask for it; can be added once basic capture works).

## Rollout

1. `src/lib/timer/useTimer.ts` + types for the event contract.
2. Timer settings + unassigned queue UI inside `tournaments.$id.tsx` Time Trial view.
3. Manual smoke test with a tiny Node/Python WS script simulating the Pi.
4. Short docs section on the Backup / server-connect area linking the event contract for whoever builds the Pi.

Estimated diff: ~300 lines web, zero server changes.
