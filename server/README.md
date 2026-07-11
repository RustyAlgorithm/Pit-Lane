# Pit Lane Self-Hosted Server

Optional companion server for [Pit Lane](https://lovable.dev). Runs a Postgres
database + small Fastify API + WebSocket bridge so multiple devices can share
a garage, teams, and live tournaments.

If you don't run this server, Pit Lane works exactly as before with data
stored in your browser's localStorage.

## Quick start (Docker)

```bash
# 1. Copy .env.example to .env and set JWT_SECRET to a long random string
cp .env.example .env

# 2. Bring the stack up
docker compose up -d

# 3. Server is now on http://<your-host>:8787
curl http://localhost:8787/health
```

Then open Pit Lane, click **Local only** in the header, and paste the URL
into the wizard.

## HTTPS / mixed content

Pit Lane is served over HTTPS. Browsers block HTTPS pages from talking to
plain-HTTP servers on other hosts. Three options:

1. **Same-machine** — open Pit Lane as `http://localhost:5173` (dev) or point
   your browser at an HTTP mirror. Simplest for a single laptop.
2. **Self-signed cert** — put Caddy or nginx in front of this server with a
   cert your browsers trust.
3. **Cloudflare Tunnel** — recommended.
   `cloudflared tunnel --url http://localhost:8787` gives you an HTTPS URL
   you paste into the wizard.

## Environment variables

| Var             | Default          | Notes                              |
|-----------------|------------------|------------------------------------|
| `PORT`          | `8787`           | Server port                        |
| `DATABASE_URL`  | (from compose)   | Postgres connection string         |
| `JWT_SECRET`    | **required**     | 32+ random chars; change from default |
| `CORS_ORIGIN`   | `*`              | Set to your Pit Lane origin in prod |

## Data model

Each user has a private snapshot with three JSON blobs: `cars`, `teams`,
`tournaments`. Writes replace the whole blob; the server broadcasts
`snapshot.updated` on WebSocket so other browsers refresh instantly.

## Endpoints

```
GET  /health                → { ok, version }
POST /auth/register         { email, password } → { token, user }
POST /auth/login            { email, password } → { token, user }
GET  /auth/me                                    → { user }
GET  /snapshot                                   → { cars, teams, tournaments }
PUT  /snapshot              { cars, teams, tournaments, clientId? }
GET  /ws?token=…                                 → WebSocket
```