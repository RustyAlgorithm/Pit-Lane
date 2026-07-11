import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { WebSocket } from "@fastify/websocket";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const DATABASE_URL = process.env.DATABASE_URL;
const VERSION = "0.1.0";

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error("JWT_SECRET is required (32+ chars recommended).");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// --- migrations ---------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, "schema.sql"), "utf8");
await pool.query(schemaSql);
console.log("[pitlane] schema ready");

// --- app ----------------------------------------------------------------
const app = Fastify({ logger: { level: "info" } });
await app.register(cors, { origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()) });
await app.register(websocket);

interface JwtPayload { uid: number; email: string; }

function sign(user: { id: number; email: string }): string {
  return jwt.sign({ uid: user.id, email: user.email } satisfies JwtPayload, JWT_SECRET!, { expiresIn: "30d" });
}

function verify(token: string): JwtPayload | null {
  try { return jwt.verify(token, JWT_SECRET!) as JwtPayload; } catch { return null; }
}

function tokenFromRequest(req: { headers: Record<string, unknown> }): string | null {
  const raw = (req.headers.authorization as string | undefined) ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m ? m[1] : null;
}

// --- routes -------------------------------------------------------------
app.get("/health", async () => ({ ok: true, version: VERSION }));

app.post("/auth/register", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !email.includes("@")) return reply.code(400).send({ error: "invalid_email" });
  if (password.length < 6) return reply.code(400).send({ error: "password_too_short" });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query<{ id: number; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash],
    );
    const user = rows[0];
    await pool.query("INSERT INTO snapshots (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);
    return { token: sign(user), user: { id: user.id, email: user.email } };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") return reply.code(409).send({ error: "email_taken" });
    throw err;
  }
});

app.post("/auth/login", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const { rows } = await pool.query<{ id: number; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];
  if (!user) return reply.code(401).send({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return reply.code(401).send({ error: "invalid_credentials" });
  await pool.query("INSERT INTO snapshots (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);
  return { token: sign(user), user: { id: user.id, email: user.email } };
});

app.get("/auth/me", async (req, reply) => {
  const token = tokenFromRequest(req);
  const payload = token && verify(token);
  if (!payload) return reply.code(401).send({ error: "unauthorized" });
  return { user: { id: payload.uid, email: payload.email } };
});

app.get("/snapshot", async (req, reply) => {
  const token = tokenFromRequest(req);
  const payload = token && verify(token);
  if (!payload) return reply.code(401).send({ error: "unauthorized" });
  const { rows } = await pool.query<{ cars: unknown; teams: unknown; tournaments: unknown; updated_at: Date }>(
    "SELECT cars, teams, tournaments, updated_at FROM snapshots WHERE user_id = $1",
    [payload.uid],
  );
  const row = rows[0];
  if (!row) return { cars: [], teams: [], tournaments: [], updatedAt: 0 };
  return { cars: row.cars, teams: row.teams, tournaments: row.tournaments, updatedAt: row.updated_at.getTime() };
});

app.put("/snapshot", async (req, reply) => {
  const token = tokenFromRequest(req);
  const payload = token && verify(token);
  if (!payload) return reply.code(401).send({ error: "unauthorized" });

  const body = (req.body ?? {}) as { cars?: unknown; teams?: unknown; tournaments?: unknown; clientId?: string };
  const cars = Array.isArray(body.cars) ? body.cars : [];
  const teams = Array.isArray(body.teams) ? body.teams : [];
  const tournaments = Array.isArray(body.tournaments) ? body.tournaments : [];
  const clientId = typeof body.clientId === "string" ? body.clientId : null;

  const { rows } = await pool.query<{ updated_at: Date }>(
    `INSERT INTO snapshots (user_id, cars, teams, tournaments, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET cars = EXCLUDED.cars,
           teams = EXCLUDED.teams,
           tournaments = EXCLUDED.tournaments,
           updated_at = NOW()
     RETURNING updated_at`,
    [payload.uid, JSON.stringify(cars), JSON.stringify(teams), JSON.stringify(tournaments)],
  );
  const updatedAt = rows[0].updated_at.getTime();
  broadcast(payload.uid, {
    type: "snapshot.updated",
    origin: clientId,
    updatedAt,
    cars,
    teams,
    tournaments,
  });
  return { ok: true, updatedAt };
});

// --- websocket ----------------------------------------------------------
const sockets = new Map<number, Set<WebSocket>>();

function broadcast(userId: number, payload: Record<string, unknown>) {
  const set = sockets.get(userId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    try { ws.send(msg); } catch { /* ignore */ }
  }
}

app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const token = url.searchParams.get("token") ?? "";
    const payload = verify(token);
    if (!payload) {
      socket.close(4001, "unauthorized");
      return;
    }
    const set = sockets.get(payload.uid) ?? new Set<WebSocket>();
    set.add(socket);
    sockets.set(payload.uid, set);
    socket.send(JSON.stringify({ type: "hello", version: VERSION }));
    socket.on("close", () => {
      const s = sockets.get(payload.uid);
      if (!s) return;
      s.delete(socket);
      if (s.size === 0) sockets.delete(payload.uid);
    });
  });
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`[pitlane] listening on :${PORT}`);
});