
# Optional Self-Hosted Backend for Pit Lane

Add an **optional** self-hosted server that Pit Lane can connect to. When connected, all data (cars, teams, tournaments, matches) lives in Postgres, users log in, and everyone watching the same tournament sees results update live over WebSockets. When not connected, the app behaves exactly as today (localStorage only).

## What ships

Two things in one repo:

1. **Companion server** — new `/server/` folder, distributed as a Docker Compose bundle (Postgres + API). Runs on the user's PC/NAS/LAN.
2. **Web app changes** — a data-source layer so every existing read/write goes through one abstraction; a first-run wizard; a login screen; live subscription hooks.

The Lovable-hosted web app stays the same URL. Only its data destination changes based on wizard config.

## Companion server (`/server/`)

```text
server/
  docker-compose.yml       # postgres + api
  Dockerfile
  package.json
  src/
    index.ts               # Fastify HTTP + WebSocket server
    db.ts                  # pg client + migrations runner
    auth.ts                # bcrypt + JWT (HS256, secret from env)
    routes/
      auth.ts              # POST /auth/register, /auth/login, /auth/me
      cars.ts              # CRUD
      teams.ts              # CRUD
      tournaments.ts       # CRUD + match updates
      health.ts            # GET /health → { ok, version }
    ws.ts                  # /ws — broadcasts tournament change events
    migrations/
      001_init.sql         # users, cars, teams, team_cars, tournaments,
                           # matches, series_games, time_entries, heat_rounds
```

- **Tech**: Node 20, Fastify, `pg`, `bcryptjs`, `jsonwebtoken`, `ws`. Small, no ORM.
- **Auth**: email + password, bcrypt, JWT in `Authorization: Bearer …`. Each user owns their own cars/teams/tournaments (`owner_id` FK); shared-league support is not in scope.
- **Realtime**: WebSocket at `/ws?token=…`. Server publishes `{type: "tournament.updated", id, tournament}` after any write. Clients subscribe per tournament id.
- **CORS**: env `CORS_ORIGIN` (defaults to `*` for LAN dev). Wizard test hits `/health`.
- **Config** (env in docker-compose): `POSTGRES_*`, `JWT_SECRET`, `PORT` (default 8787), `CORS_ORIGIN`.
- **README** with one-line install: `docker compose up -d`, prints server URL. Included in the wizard.

## Web app changes

### 1. Data-source abstraction

Everywhere the app currently uses `useLocalStorage<Car[]>("pitlane.cars", …)` etc., route through a new `useCollection("cars")` hook.

`src/lib/data/`:
- `source.ts` — reads `pitlane.server` from localStorage; if a `{url, token}` is set → remote source, else → local source.
- `local.ts` — thin wrapper around existing localStorage hooks. Zero behaviour change.
- `remote.ts` — fetches/writes via `${url}/…` with `Bearer token`; caches in TanStack Query; on mutations POSTs then relies on WS event to refresh.
- `ws.ts` — one shared WebSocket, reconnect w/ backoff, invalidates query keys on event.
- `hooks.ts` — `useCollection`, `useItem`, `useMutateItem`, `useTournamentLive(id)`.

All existing `useLocalStorage("pitlane.cars", …)` call sites in `garage.tsx`, `teams.tsx`, `tournaments.index.tsx`, `tournaments.$id.tsx`, `leaderboard.tsx`, `backup.tsx` swap to the new hooks. Shapes unchanged.

### 2. Setup wizard

New route `src/routes/settings.server.tsx` (also opened as a modal on first launch if the user clicks a new "Connect server" button in the header).

Steps:

1. **Intro** — "Pit Lane can run against your own server for multi-device sync and live events. Skip to keep everything on this device."
2. **Install** — collapsible instructions: download `docker-compose.yml` (served from `/server/docker-compose.yml` as a static asset copy), run `docker compose up -d`, note the URL (`http://<host>:8787`). External link to the README.
3. **Connect** — URL input, "Test connection" button → hits `/health`. On success show version + go to step 4.
4. **Account** — tabs for Sign in / Register (email + password). On success, save `{url, token, userEmail}` to localStorage under `pitlane.server`, close wizard.

A **Disconnect** button on the same settings page clears `pitlane.server` and reverts to local mode. Local data is untouched.

### 3. Header state

`SiteHeader.tsx` gains a small pill:
- Not connected → "Local only" (click → wizard)
- Connected → server hostname + green dot; menu with "Sign out", "Server settings"
- Connected but WS disconnected → amber dot "Reconnecting…"

### 4. Migration on connect

Not in this plan (user chose "just push to DB when linked, otherwise use local"). On connect, the app simply starts reading/writing against the server. Existing local data stays in localStorage — the ZIP backup/restore flow still works and can be used to seed the server later if the user wants. If a "push local data to server" button is wanted, we can add it as a follow-up.

## Non-goals (for this pass)

- Shared leagues / multi-user shared tournaments (each user's data is private).
- HTTPS/TLS setup on the companion server (user's responsibility; docs mention Caddy / Cloudflare Tunnel).
- Automatic migration of existing localStorage data.
- Mobile app / native installer for the server (Docker only).

## Technical notes

- Cloudflare Workers can't reach a `192.168.x.x` LAN server, but the Lovable-hosted web app runs client-side in the user's browser — the browser talks to the LAN server directly. Mixed-content: the app is HTTPS, so the LAN server needs HTTPS too for browsers to allow requests (or the user accesses Pit Lane via `http://localhost` in dev). This is called out in the wizard's Install step with three options: (a) HTTP + browser flag, (b) self-signed cert + trust, (c) Cloudflare Tunnel. Recommended: **Cloudflare Tunnel**, one command, gives an HTTPS URL.
- All server calls are direct browser → LAN. No changes to Cloudflare Workers server code.
- Auth token stored in localStorage (`pitlane.server.token`). Acceptable for LAN self-hosted context; documented.

## Rollout order

1. `/server/` — Postgres schema, Fastify API, WS, Dockerfile, docker-compose, README.
2. Web: `src/lib/data/` abstraction + swap call sites. No UI change yet; local source only.
3. Web: wizard route + header pill + auth screens + remote source + WS hook.
4. Manual smoke test: two browsers pointed at same server, run a tournament, confirm live updates.

Estimated diff: ~1.5k lines server, ~800 lines web (mostly the data layer + wizard; call-site edits are mechanical).
