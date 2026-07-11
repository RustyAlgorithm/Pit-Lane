/**
 * @file api.ts
 * @description Tiny REST client for the Pit Lane self-hosted server.
 */

import type { Car, Team, Tournament } from "@/lib/types";
import { normaliseUrl } from "./server-config";

export interface Snapshot {
  cars: Car[];
  teams: Team[];
  tournaments: Tournament[];
  updatedAt?: number;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string };
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
        ? (body as { error: string }).error
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export async function ping(url: string): Promise<{ ok: boolean; version: string }> {
  const res = await fetch(`${normaliseUrl(url)}/health`, { method: "GET" });
  return json(res);
}

export async function login(url: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${normaliseUrl(url)}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return json(res);
}

export async function register(url: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${normaliseUrl(url)}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return json(res);
}

export async function fetchSnapshot(url: string, token: string): Promise<Snapshot> {
  const res = await fetch(`${normaliseUrl(url)}/snapshot`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return json(res);
}

export async function pushSnapshot(
  url: string,
  token: string,
  snapshot: Snapshot & { clientId: string },
): Promise<{ ok: true; updatedAt: number }> {
  const res = await fetch(`${normaliseUrl(url)}/snapshot`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(snapshot),
  });
  return json(res);
}

/**
 * Build the WebSocket URL from an http(s) base URL.
 */
export function wsUrl(url: string, token: string): string {
  const base = normaliseUrl(url).replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}