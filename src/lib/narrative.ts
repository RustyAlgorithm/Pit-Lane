/**
 * @file narrative.ts
 * @description Narrative mode engine — hero/villain roles, rivalries,
 * collision-aware seeding, deterministic story events, arcs and commentary.
 * Pure functions only; all state lives on the Tournament (`t.narrative`).
 */

import { uid } from "./storage";
import type {
  Car,
  NarrativeEvent,
  NarrativeEventType,
  NarrativeRole,
  Rivalry,
  StoryEntry,
  Team,
  Tournament,
  TournamentNarrative,
} from "./types";

export const ROLE_LABEL: Record<NarrativeRole, string> = {
  hero: "Hero",
  villain: "Villain",
  neutral: "Neutral",
};

export const EVENT_LABEL: Record<NarrativeEventType, string> = {
  rematch: "Rematch",
  "driver-swap": "Driver swap",
  handicap: "Handicap",
  "story-beat": "Story beat",
};

export function defaultNarrative(): TournamentNarrative {
  return {
    enabled: false,
    roleOverrides: {},
    rivalries: [],
    heroBias: 0,
    eventFrequency: "occasional",
    collision: "late",
    enabledEvents: ["rematch", "driver-swap", "handicap", "story-beat"],
    events: [],
    log: [],
  };
}

export function getNarrative(t: Tournament): TournamentNarrative {
  return { ...defaultNarrative(), ...(t.narrative ?? {}) };
}

export function isNarrativeOn(t: Tournament): boolean {
  return !!t.narrative?.enabled;
}

/* ------------------------------------------------------------------ roles */

export function globalRoleOf(id: string, cars: Car[], teams: Team[]): NarrativeRole {
  const c = cars.find((x) => x.id === id);
  if (c) return c.role ?? "neutral";
  const tm = teams.find((x) => x.id === id);
  return tm?.role ?? "neutral";
}

/** Per-tournament override wins over the global car/team role. */
export function makeRoleResolver(
  n: TournamentNarrative,
  cars: Car[],
  teams: Team[],
): (id: string | null | undefined) => NarrativeRole {
  return (id) => {
    if (!id) return "neutral";
    return n.roleOverrides[id] ?? globalRoleOf(id, cars, teams);
  };
}

export function participantIdsOf(t: Tournament): string[] {
  return (t.participationType === "teams" ? t.teamIds : t.carIds) ?? [];
}

export function nameOf(id: string | null | undefined, cars: Car[], teams: Team[]): string {
  if (!id) return "TBD";
  return cars.find((c) => c.id === id)?.name ?? teams.find((t) => t.id === id)?.name ?? "Unknown";
}

/* -------------------------------------------------------------- rivalries */

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** Hero-vs-villain pairs that have no explicit rivalry yet. */
export function autoRivalries(
  ids: string[],
  roleOf: (id: string) => NarrativeRole,
  existing: Rivalry[],
  cars: Car[],
  teams: Team[],
): Rivalry[] {
  const have = new Set(existing.map((r) => pairKey(r.aId, r.bId)));
  const heroes = ids.filter((id) => roleOf(id) === "hero");
  const villains = ids.filter((id) => roleOf(id) === "villain");
  const out: Rivalry[] = [];
  for (const h of heroes) {
    for (const v of villains) {
      const key = pairKey(h, v);
      if (have.has(key)) continue;
      have.add(key);
      out.push({
        id: `auto-${key}`,
        aId: h,
        bId: v,
        auto: true,
        reason: `${nameOf(h, cars, teams)} has unfinished business with ${nameOf(v, cars, teams)}.`,
      });
    }
  }
  return out;
}

export function allRivalries(
  t: Tournament,
  n: TournamentNarrative,
  cars: Car[],
  teams: Team[],
): Rivalry[] {
  const roleOf = makeRoleResolver(n, cars, teams);
  const ids = participantIdsOf(t);
  return [...n.rivalries, ...autoRivalries(ids, roleOf, n.rivalries, cars, teams)];
}

export function findRivalry(
  rivalries: Rivalry[],
  a?: string | null,
  b?: string | null,
): Rivalry | undefined {
  if (!a || !b) return undefined;
  const key = pairKey(a, b);
  return rivalries.find((r) => pairKey(r.aId, r.bId) === key);
}

/* ---------------------------------------------------------------- seeding */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Order participants so rivals collide.
 * - "early": rivals sit next to each other (round-1 grudge matches).
 * - "late": rivals are split into opposite halves so they can only meet late.
 * Falls back to a plain shuffle for anyone not in a rivalry.
 */
export function narrativeOrder(
  ids: string[],
  rivalries: Rivalry[],
  collision: "early" | "late",
): string[] {
  const pool = shuffle(ids);
  const used = new Set<string>();
  const pairs: [string, string][] = [];
  for (const r of rivalries) {
    if (used.has(r.aId) || used.has(r.bId)) continue;
    if (!pool.includes(r.aId) || !pool.includes(r.bId)) continue;
    used.add(r.aId);
    used.add(r.bId);
    pairs.push([r.aId, r.bId]);
  }
  const rest = pool.filter((id) => !used.has(id));

  if (collision === "early") {
    const out: string[] = [];
    pairs.forEach(([a, b]) => out.push(a, b));
    return [...out, ...rest];
  }

  // late: first halves get the A side, second half gets the B side
  const left: string[] = [];
  const right: string[] = [];
  pairs.forEach(([a, b]) => {
    left.push(a);
    right.push(b);
  });
  rest.forEach((id, i) => (i % 2 === 0 ? left : right).push(id));
  // interleave halves back into a single ordering (first half then second half)
  return [...left, ...right];
}

/* ------------------------------------------------------- events (rolling) */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const FREQ_CHANCE: Record<TournamentNarrative["eventFrequency"], number> = {
  off: 0,
  rare: 0.2,
  occasional: 0.4,
  frequent: 0.75,
};

const TEMPLATES: Record<NarrativeEventType, { title: string; text: (a: string, b: string, f: string) => string }[]> = {
  rematch: [
    {
      title: "Sabotage in the pits!",
      text: (a, b) => `Someone loosened the wheels. The stewards order ${a} and ${b} to settle it over two races — best of two, and a decider if they split it.`,
    },
    {
      title: "Photo finish dispute",
      text: (a, b) => `The timing gear glitched. ${a} and ${b} must run it again — this one goes to two legs.`,
    },
  ],
  "driver-swap": [
    {
      title: "The driver is sick",
      text: (a) => `${a}'s driver has come down with something rotten. A reserve steps into the cockpit for this race.`,
    },
    {
      title: "Last-minute call-up",
      text: (a) => `${a} swaps drivers on the grid — the crowd has no idea who is behind the wheel.`,
    },
  ],
  handicap: [
    {
      title: "Track gremlins",
      text: (a, b, f) => `Loose track section on the outside lane. ${f} gets the clean line for this race.`,
    },
    {
      title: "Fresh rubber",
      text: (a, b, f) => `The crew found a set of fresh tyres — ${f} rolls out with a real advantage.`,
    },
  ],
  "story-beat": [
    {
      title: "The crowd is on its feet",
      text: (a, b) => `The stands fall silent as ${a} lines up against ${b}. Everyone knows what this one means.`,
    },
    {
      title: "Rain on the horizon",
      text: () => `Dark clouds roll over the circuit. Whatever happens next, it will be remembered.`,
    },
  ],
};

/** Deterministic per-match event roll — same match always yields the same twist. */
export function rollEvent(
  n: TournamentNarrative,
  matchId: string,
  aId: string,
  bId: string,
  cars: Car[],
  teams: Team[],
  isRivalry: boolean,
): NarrativeEvent | null {
  const types = n.enabledEvents.filter((t) => TEMPLATES[t]);
  if (!n.enabled || types.length === 0) return null;
  const base = FREQ_CHANCE[n.eventFrequency];
  if (base === 0) return null;
  const chance = Math.min(0.95, isRivalry ? base + 0.25 : base);
  const roll = hash(`${matchId}:roll`);
  if (roll > chance) return null;

  const type = types[Math.floor(hash(`${matchId}:type`) * types.length) % types.length];
  const list = TEMPLATES[type];
  const tpl = list[Math.floor(hash(`${matchId}:tpl`) * list.length) % list.length];
  const favouredId = biasedPick(n.heroBias, aId, bId, n, cars, teams, `${matchId}:fav`);
  const aName = nameOf(aId, cars, teams);
  const bName = nameOf(bId, cars, teams);
  const fName = nameOf(favouredId ?? aId, cars, teams);

  return {
    id: `${matchId}-ev`,
    matchId,
    type,
    title: tpl.title,
    text: tpl.text(aName, bName, fName),
    favouredId,
    legWinnerIds: [],
    accepted: false,
    resolved: false,
    at: Date.now(),
  };
}

/** Which side the story favours, given the hero-bias slider. */
export function biasedPick(
  heroBias: number,
  aId: string,
  bId: string,
  n: TournamentNarrative,
  cars: Car[],
  teams: Team[],
  seed: string,
): string | null {
  const roleOf = makeRoleResolver(n, cars, teams);
  const ra = roleOf(aId);
  const rb = roleOf(bId);
  const score = (r: NarrativeRole) => (r === "hero" ? heroBias : r === "villain" ? -heroBias : 0);
  const sa = score(ra);
  const sb = score(rb);
  if (sa === sb) return null;
  const favoured = sa > sb ? aId : bId;
  // stronger bias = more likely the story actually points that way
  const strength = Math.abs(sa - sb) / 200;
  return hash(seed) < 0.15 + strength ? favoured : null;
}

/** Suggested ("story pick") winner for a match, or null. */
export function suggestedWinner(
  n: TournamentNarrative,
  matchId: string,
  aId?: string | null,
  bId?: string | null,
  cars: Car[] = [],
  teams: Team[] = [],
): string | null {
  if (!n.enabled || !aId || !bId || n.heroBias === 0) return null;
  return biasedPick(n.heroBias, aId, bId, n, cars, teams, `${matchId}:pick`);
}

export function getEvent(n: TournamentNarrative, matchId: string): NarrativeEvent | undefined {
  return n.events.find((e) => e.matchId === matchId);
}

/* -------------------------------------------------------------- story log */

export function logEntry(kind: StoryEntry["kind"], text: string, matchId?: string): StoryEntry {
  return { id: uid(), at: Date.now(), kind, text, matchId };
}

export function withNarrative(t: Tournament, patch: Partial<TournamentNarrative>): Tournament {
  return { ...t, narrative: { ...getNarrative(t), ...patch } };
}

export function appendLog(t: Tournament, entries: StoryEntry[]): Tournament {
  const n = getNarrative(t);
  return withNarrative(t, { log: [...n.log, ...entries] });
}

export function upsertEvent(t: Tournament, ev: NarrativeEvent): Tournament {
  const n = getNarrative(t);
  const exists = n.events.some((e) => e.id === ev.id);
  return withNarrative(t, {
    events: exists ? n.events.map((e) => (e.id === ev.id ? ev : e)) : [...n.events, ev],
  });
}

/* ------------------------------------------------------------------- arcs */

export type Arc = "Underdog" | "Comeback" | "Dominant" | "Fallen" | "Nemesis" | "Rising";

export function computeArcs(
  t: Tournament,
  n: TournamentNarrative,
  cars: Car[],
  teams: Team[],
): Map<string, { arc: Arc; wins: number; losses: number; note: string }> {
  const isTeams = t.participationType === "teams";
  const ids = participantIdsOf(t);
  const roleOf = makeRoleResolver(n, cars, teams);
  const rivalries = allRivalries(t, n, cars, teams);
  const rec = new Map<string, { w: number; l: number; rivalWins: number }>();
  ids.forEach((id) => rec.set(id, { w: 0, l: 0, rivalWins: 0 }));

  const allMatches = [...t.matches, ...(t.qualifyingMatches ?? [])];
  allMatches.forEach((m) => {
    if (!m.winnerId) return;
    const aId = isTeams ? m.teamAId : m.carAId;
    const bId = isTeams ? m.teamBId : m.carBId;
    if (!aId || !bId) return;
    const loserId = aId === m.winnerId ? bId : aId;
    const w = rec.get(m.winnerId);
    if (w) {
      w.w++;
      if (findRivalry(rivalries, aId, bId)) w.rivalWins++;
    }
    const l = rec.get(loserId);
    if (l) l.l++;
  });

  const out = new Map<string, { arc: Arc; wins: number; losses: number; note: string }>();
  rec.forEach((v, id) => {
    const role = roleOf(id);
    let arc: Arc = "Rising";
    let note = "Still writing their story.";
    if (v.w >= 3 && v.l === 0) {
      arc = "Dominant";
      note = "Untouched so far — nobody has laid a glove on them.";
    } else if (v.l >= 2 && v.w >= 2) {
      arc = "Comeback";
      note = "Written off early, still standing.";
    } else if (v.w === 0 && v.l >= 2) {
      arc = "Fallen";
      note = "A season to forget.";
    } else if (v.rivalWins >= 2) {
      arc = "Nemesis";
      note = "Has made a habit of ending rivals' runs.";
    } else if (v.w >= 1 && v.l >= 1 && role === "hero") {
      arc = "Underdog";
      note = "Bruised but fighting.";
    }
    out.set(id, { arc, wins: v.w, losses: v.l, note });
  });
  return out;
}

export function championNote(
  t: Tournament,
  n: TournamentNarrative,
  cars: Car[],
  teams: Team[],
): string | null {
  if (!t.champion) return null;
  const roleOf = makeRoleResolver(n, cars, teams);
  const name = nameOf(t.champion, cars, teams);
  const role = roleOf(t.champion);
  if (role === "hero") return `${name} takes the crown — the good guys win this one.`;
  if (role === "villain") return `${name} lifts the trophy. Somewhere, a hero is already plotting a comeback.`;
  return `${name} is champion. No script needed.`;
}
