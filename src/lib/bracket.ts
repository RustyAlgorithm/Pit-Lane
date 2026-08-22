import type { Car, Match, Tournament, BracketFormat, Team, SeriesGame } from "./types";
import { uid } from "./storage";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function makeSeries(n: number): SeriesGame[] {
  return Array.from({ length: n }, () => ({
    id: uid(),
    carAId: null,
    carBId: null,
    winnerCarId: null,
  }));
}

export function buildMatches(
  format: BracketFormat,
  participantIds: string[],
  participationType: "cars" | "teams" = "cars",
  opts: { seriesLength?: number; preordered?: boolean } = {},
): Match[] {
  if (format === "time-trial") return [];
  if (format === "championship") return [];
  if (format === "heats") return [];
  if (participantIds.length < 2) return [];
  const ids = opts.preordered ? [...participantIds] : shuffle(participantIds);

  const isTeams = participationType === "teams";
  const seriesLength = isTeams && opts.seriesLength && opts.seriesLength > 0 ? opts.seriesLength : 0;
  const attachSeries = () =>
    seriesLength > 0 ? { series: makeSeries(seriesLength), seriesLength } : {};

  if (format === "round-robin") {
    const matches: Match[] = [];
    let slot = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push({
          id: uid(),
          round: 1,
          slot: slot++,
          isGroup: true,
          ...(isTeams ? { teamAId: ids[i], teamBId: ids[j] } : { carAId: ids[i], carBId: ids[j] }),
          winnerId: null,
          ...attachSeries(),
        });
      }
    }
    return matches;
  }

  // single elimination base
  const size = nextPow2(ids.length);
  const seeded: (string | null)[] = [...ids];
  while (seeded.length < size) seeded.push(null);

  const matches: Match[] = [];
  // round 1
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i * 2];
    const b = seeded[i * 2 + 1];
    const baseMatch = {
      id: uid(),
      round: 1,
      slot: i,
      bracket: format === "double" ? "winners" as const : undefined,
      winnerId: a && !b ? a : b && !a ? b : null,
    };
    matches.push({
      ...baseMatch,
      ...(isTeams 
        ? { teamAId: a, teamBId: b } 
        : { carAId: a, carBId: b }),
      ...attachSeries(),
    });
  }
  // subsequent winners-rounds (empty placeholders)
  let prev = size / 2;
  let round = 2;
  while (prev > 1) {
    for (let i = 0; i < prev / 2; i++) {
      const baseMatch = {
        id: uid(),
        round,
        slot: i,
        bracket: format === "double" ? "winners" as const : undefined,
        winnerId: null,
      };
      matches.push({
        ...baseMatch,
        ...(isTeams 
          ? { teamAId: null, teamBId: null } 
          : { carAId: null, carBId: null }),
        ...attachSeries(),
      });
    }
    prev = prev / 2;
    round++;
  }

  if (format === "double") {
    // simple losers bracket: one match per winners round (linear, not bracket-perfect but playable)
    const winnersRounds = Math.log2(size);
    for (let r = 1; r <= winnersRounds; r++) {
      const baseMatch = {
        id: uid(),
        round: r,
        slot: 0,
        bracket: "losers" as const,
        winnerId: null,
      };
      matches.push({
        ...baseMatch,
        ...(isTeams 
          ? { teamAId: null, teamBId: null } 
          : { carAId: null, carBId: null }),
        ...attachSeries(),
      });
    }
    // grand final
    const grandFinal = {
      id: uid(),
      round: winnersRounds + 1,
      slot: 0,
      bracket: "final" as const,
      winnerId: null,
    };
    matches.push({
      ...grandFinal,
      ...(isTeams 
        ? { teamAId: null, teamBId: null } 
        : { carAId: null, carBId: null }),
      ...attachSeries(),
    });
  }

  return matches;
}

/** When a winner is set in an elimination match, propagate winner & loser. */
export function applyWinner(t: Tournament, matchId: string, winnerId: string): Tournament {
  const matches = t.matches.map((m) => ({ ...m }));
  const idx = matches.findIndex((m) => m.id === matchId);
  if (idx === -1) return t;
  const m = matches[idx];
  m.winnerId = winnerId;
  const isTeams = t.participationType === "teams";
  const aId = isTeams ? m.teamAId : m.carAId;
  const bId = isTeams ? m.teamBId : m.carBId;
  const loserId = aId === winnerId ? bId : aId;

  // Championship's bracket stage behaves like its qualifyingFormat (single|double).
  const effFormat: BracketFormat =
    t.format === "championship" ? (t.qualifyingFormat ?? "single") : t.format;

  if (effFormat === "round-robin") {
    return { ...t, matches };
  }

  if (effFormat === "single") {
    // find next round same bracket: slot = floor(slot/2), side = slot%2
    const next = matches.find(
      (n) => n.round === m.round + 1 && n.slot === Math.floor(m.slot / 2),
    );
    if (next) {
      if (m.slot % 2 === 0) {
        if (isTeams) next.teamAId = winnerId;
        else next.carAId = winnerId;
      } else {
        if (isTeams) next.teamBId = winnerId;
        else next.carBId = winnerId;
      }
    } else {
      // this was the final
      return { ...t, matches, champion: winnerId, championType: isTeams ? "team" : "car" };
    }
    return { ...t, matches };
  }

  // double elimination
  if (m.bracket === "winners") {
    const winnersRounds = Math.max(...matches.filter((x) => x.bracket === "winners").map((x) => x.round));
    if (m.round < winnersRounds) {
      const next = matches.find(
        (n) => n.bracket === "winners" && n.round === m.round + 1 && n.slot === Math.floor(m.slot / 2),
      );
      if (next) {
        if (m.slot % 2 === 0) {
          if (isTeams) next.teamAId = winnerId;
          else next.carAId = winnerId;
        } else {
          if (isTeams) next.teamBId = winnerId;
          else next.carBId = winnerId;
        }
      }
    } else {
      // winners final -> grand final A
      const gf = matches.find((n) => n.bracket === "final");
      if (gf) {
        if (isTeams) gf.teamAId = winnerId;
        else gf.carAId = winnerId;
      }
    }
    // send loser to losers bracket linear chain
    if (loserId) {
      const lb = matches.find((n) => n.bracket === "losers" && n.round === m.round && !(isTeams ? n.teamAId : n.carAId));
      if (lb) {
        if (isTeams) lb.teamAId = loserId;
        else lb.carAId = loserId;
      } else {
        const lb2 = matches.find((n) => n.bracket === "losers" && n.round === m.round && !(isTeams ? n.teamBId : n.carBId));
        if (lb2) {
          if (isTeams) lb2.teamBId = loserId;
          else lb2.carBId = loserId;
        }
      }
    }
  } else if (m.bracket === "losers") {
    const losersRounds = Math.max(...matches.filter((x) => x.bracket === "losers").map((x) => x.round));
    if (m.round < losersRounds) {
      const next = matches.find((n) => n.bracket === "losers" && n.round === m.round + 1);
      if (next) {
        if (isTeams) {
          if (!next.teamAId) next.teamAId = winnerId;
          else if (!next.teamBId) next.teamBId = winnerId;
        } else {
          if (!next.carAId) next.carAId = winnerId;
          else if (!next.carBId) next.carBId = winnerId;
        }
      }
    } else {
      const gf = matches.find((n) => n.bracket === "final");
      if (gf) {
        if (isTeams) gf.teamBId = winnerId;
        else gf.carBId = winnerId;
      }
    }
  } else if (m.bracket === "final") {
    return { ...t, matches, champion: winnerId, championType: isTeams ? "team" : "car" };
  }

  return { ...t, matches };
}

export function standingsFor(t: Tournament, cars: Car[], teams: Team[] = []) {
  const map = new Map<string, { name: string; w: number; l: number }>();
  const isTeams = t.participationType === "teams";
  
  if (isTeams) {
    (t.teamIds ?? []).forEach((id) => {
      const team = teams.find((entry) => entry.id === id);
      map.set(id, { name: team?.name ?? "", w: 0, l: 0 });
    });
  } else {
    (t.carIds ?? []).forEach((id) => {
      const c = cars.find((x) => x.id === id);
      if (c) map.set(id, { name: c.name, w: 0, l: 0 });
    });
  }
  
  t.matches.forEach((m) => {
    if (!m.winnerId) return;
    const aId = isTeams ? m.teamAId : m.carAId;
    const bId = isTeams ? m.teamBId : m.carBId;
    if (!aId || !bId) return;
    const winner = map.get(m.winnerId);
    if (winner) winner.w++;
    const loserId = aId === m.winnerId ? bId : aId;
    const loser = map.get(loserId);
    if (loser) loser.l++;
  });
  return [...map.values()].sort((a, b) => b.w - a.w || a.l - b.l);
}

/** Standard tournament bracket order for N seeds (N power of 2). e.g. 8 -> [1,8,4,5,2,7,3,6] */
export function bracketOrder(n: number): number[] {
  if (n <= 1) return [1];
  if (n === 2) return [1, 2];
  const prev = bracketOrder(n / 2);
  const out: number[] = [];
  for (const p of prev) out.push(p, n + 1 - p);
  return out;
}

export function nextPow2Down(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/** Build a single/double elimination bracket from already-ordered seeds (no shuffle).
 *  rankedIds must be sorted best→worst. Top `size` (power of 2) are seeded into round 1. */
export function buildSeededBracket(
  format: "single" | "double",
  rankedIds: string[],
  isTeams: boolean,
  seriesLength: number = 0,
): Match[] {
  const size = nextPow2Down(rankedIds.length);
  if (size < 2) return [];
  const top = rankedIds.slice(0, size);
  const order = bracketOrder(size); // 1-indexed seed numbers in round-1 slot order
  const seeded: string[] = order.map((s) => top[s - 1]);
  const attachSeries = () =>
    isTeams && seriesLength > 0 ? { series: makeSeries(seriesLength), seriesLength } : {};

  const matches: Match[] = [];
  // round 1
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i * 2];
    const b = seeded[i * 2 + 1];
    matches.push({
      id: uid(),
      round: 1,
      slot: i,
      bracket: format === "double" ? "winners" : undefined,
      winnerId: null,
      ...(isTeams ? { teamAId: a, teamBId: b } : { carAId: a, carBId: b }),
      ...attachSeries(),
    });
  }
  let prev = size / 2;
  let round = 2;
  while (prev > 1) {
    for (let i = 0; i < prev / 2; i++) {
      matches.push({
        id: uid(),
        round,
        slot: i,
        bracket: format === "double" ? "winners" : undefined,
        winnerId: null,
        ...(isTeams ? { teamAId: null, teamBId: null } : { carAId: null, carBId: null }),
        ...attachSeries(),
      });
    }
    prev = prev / 2;
    round++;
  }

  if (format === "double") {
    const winnersRounds = Math.log2(size);
    for (let r = 1; r <= winnersRounds; r++) {
      matches.push({
        id: uid(),
        round: r,
        slot: 0,
        bracket: "losers",
        winnerId: null,
        ...(isTeams ? { teamAId: null, teamBId: null } : { carAId: null, carBId: null }),
        ...attachSeries(),
      });
    }
    matches.push({
      id: uid(),
      round: winnersRounds + 1,
      slot: 0,
      bracket: "final",
      winnerId: null,
      ...(isTeams ? { teamAId: null, teamBId: null } : { carAId: null, carBId: null }),
      ...attachSeries(),
    });
  }

  return matches;
}

/** Rank championship qualifiers best→worst based on qualifying type. */
export function rankQualifiers(t: Tournament, cars: Car[]): string[] {
  const isTeams = t.participationType === "teams";
  const ids = (isTeams ? t.teamIds : t.carIds) ?? [];

  if (t.qualifyingType === "time-trial") {
    const best = new Map<string, number>();
    (t.times ?? []).forEach((e) => {
      // For team championships time entries are still per-car; aggregate the team's best car time.
      const ownerId = isTeams
        ? ids.find((tid) => {
            // we don't have team rosters here; fall back to carId itself if team membership not available
            return tid === e.carId;
          }) ?? e.carId
        : e.carId;
      const cur = best.get(ownerId);
      if (cur === undefined || e.seconds < cur) best.set(ownerId, e.seconds);
    });
    return [...ids].sort((a, b) => {
      const va = best.get(a);
      const vb = best.get(b);
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      return va - vb;
    });
  }

  // round-robin qualifying: compute W/L from qualifyingMatches
  const wl = new Map<string, { w: number; l: number }>();
  ids.forEach((id) => wl.set(id, { w: 0, l: 0 }));
  (t.qualifyingMatches ?? []).forEach((m) => {
    if (!m.winnerId) return;
    const aId = isTeams ? m.teamAId : m.carAId;
    const bId = isTeams ? m.teamBId : m.carBId;
    if (!aId || !bId) return;
    const winner = wl.get(m.winnerId);
    if (winner) winner.w++;
    const loserId = aId === m.winnerId ? bId : aId;
    const loser = wl.get(loserId);
    if (loser) loser.l++;
  });
  return [...ids].sort((a, b) => {
    const A = wl.get(a)!;
    const B = wl.get(b)!;
    return B.w - A.w || A.l - B.l;
  });
}

/** Build qualifying matches for the championship's qualifying stage. */
export function buildQualifyingMatches(
  qualifyingType: "time-trial" | "round-robin",
  participantIds: string[],
  participationType: "cars" | "teams",
  seriesLength: number = 0,
): Match[] {
  if (qualifyingType === "time-trial") return [];
  return buildMatches("round-robin", participantIds, participationType, { seriesLength });
}

/** Heat rounds: each round defines lanes per heat and how many advance per heat. */
export interface HeatRoundCfg {
  lanes: number;
  advance: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Build heat matches from a round configuration. */
export function buildHeats(
  rounds: HeatRoundCfg[],
  participantIds: string[],
  opts: { preordered?: boolean } = {},
): Match[] {
  if (rounds.length === 0 || participantIds.length < 2) return [];
  const shuffled = opts.preordered ? [...participantIds] : shuffle(participantIds);

  const matches: Match[] = [];

  // Round 1
  const r1 = rounds[0];
  const groups = chunk(shuffled, r1.lanes);
  groups.forEach((g, heatIndex) => {
    const slots: (string | null)[] = [...g];
    while (slots.length < r1.lanes) slots.push(null);
    matches.push({
      id: uid(),
      round: 1,
      slot: heatIndex,
      heatRound: 1,
      heatIndex,
      participantIds: slots,
      finishOrder: Array(r1.lanes).fill(null),
      winnerId: null,
    });
  });

  // Subsequent rounds: empty heats sized so prev_heats * advance fills them
  let prevHeats = groups.length;
  let prevAdvance = r1.advance;
  for (let r = 2; r <= rounds.length; r++) {
    const cfg = rounds[r - 1];
    const intake = prevHeats * prevAdvance;
    const heatCount = Math.max(1, Math.ceil(intake / cfg.lanes));
    for (let i = 0; i < heatCount; i++) {
      matches.push({
        id: uid(),
        round: r,
        slot: i,
        heatRound: r,
        heatIndex: i,
        participantIds: Array(cfg.lanes).fill(null),
        finishOrder: Array(cfg.lanes).fill(null),
        winnerId: null,
      });
    }
    prevHeats = heatCount;
    prevAdvance = cfg.advance;
  }

  return matches;
}

/** Apply heat finish order; propagates advancers to the next round and seeds consolation when complete. */
export function applyHeatFinish(
  t: Tournament,
  matchId: string,
  finishOrder: (string | null)[],
): Tournament {
  const rounds = t.heatRounds ?? [];
  if (rounds.length === 0) return t;
  const matches = t.matches.map((m) => ({ ...m }));
  const idx = matches.findIndex((m) => m.id === matchId);
  if (idx === -1) return t;
  const m = matches[idx];
  m.finishOrder = [...finishOrder];
  m.winnerId = finishOrder[0] ?? null;

  const r = m.heatRound ?? m.round;
  const cfg = rounds[r - 1];

  // Recompute round r+1 intakes (so re-recording also re-distributes).
  if (r < rounds.length) {
    const sameRound = matches
      .filter((x) => x.heatRound === r && !x.isConsolation)
      .sort((a, b) => (a.heatIndex ?? 0) - (b.heatIndex ?? 0));
    const advancers: (string | null)[] = [];
    for (const heat of sameRound) {
      const fo = heat.finishOrder ?? [];
      for (let i = 0; i < cfg.advance; i++) {
        advancers.push(fo[i] ?? null);
      }
    }
    const nextCfg = rounds[r];
    const nextHeats = matches
      .filter((x) => x.heatRound === r + 1 && !x.isConsolation)
      .sort((a, b) => (a.heatIndex ?? 0) - (b.heatIndex ?? 0));
    nextHeats.forEach((heat, hi) => {
      const slots: (string | null)[] = [];
      for (let lane = 0; lane < nextCfg.lanes; lane++) {
        slots.push(advancers[hi * nextCfg.lanes + lane] ?? null);
      }
      // Reset finish order if intake changed
      const prevSlots = heat.participantIds ?? [];
      const changed =
        slots.length !== prevSlots.length ||
        slots.some((id, i) => id !== prevSlots[i]);
      heat.participantIds = slots;
      if (changed) {
        heat.finishOrder = Array(nextCfg.lanes).fill(null);
        heat.winnerId = null;
      }
    });
  }

  // Build / update consolation heat if enabled and main rounds all complete.
  const mainDone = matches
    .filter((x) => !x.isConsolation)
    .every((x) => (x.finishOrder ?? []).every((s) => s !== null) || (x.participantIds ?? []).every((s) => s === null));

  // Determine champion (winner of last round's only heat).
  const lastRound = rounds.length;
  const finalHeat = matches.find((x) => x.heatRound === lastRound && !x.isConsolation);
  let champion: string | null = null;
  if (finalHeat && finalHeat.winnerId) champion = finalHeat.winnerId;

  if (t.consolation) {
    // Eliminated = all round-1 participants minus those who reached the final round.
    const r1Heats = matches.filter((x) => x.heatRound === 1 && !x.isConsolation);
    const allParticipants: string[] = [];
    r1Heats.forEach((h) =>
      (h.participantIds ?? []).forEach((id) => {
        if (id) allParticipants.push(id);
      }),
    );
    const finalists: string[] = [];
    matches
      .filter((x) => x.heatRound === lastRound && !x.isConsolation)
      .forEach((h) =>
        (h.participantIds ?? []).forEach((id) => {
          if (id) finalists.push(id);
        }),
      );
    const eliminated = allParticipants.filter((id) => !finalists.includes(id));

    const existing = matches.find((x) => x.isConsolation);
    if (mainDone && eliminated.length >= 2) {
      if (existing) {
        const prevSlots = existing.participantIds ?? [];
        const changed =
          eliminated.length !== prevSlots.length ||
          eliminated.some((id, i) => id !== prevSlots[i]);
        if (changed) {
          existing.participantIds = eliminated;
          existing.finishOrder = Array(eliminated.length).fill(null);
          existing.winnerId = null;
        }
      } else {
        matches.push({
          id: uid(),
          round: lastRound + 1,
          slot: 0,
          heatRound: lastRound + 1,
          heatIndex: 0,
          isConsolation: true,
          participantIds: eliminated,
          finishOrder: Array(eliminated.length).fill(null),
          winnerId: null,
        });
      }
    } else if (existing && !mainDone) {
      // Remove stale consolation heat if main bracket re-opened.
      const ci = matches.indexOf(existing);
      matches.splice(ci, 1);
    }
  }

  return {
    ...t,
    matches,
    champion,
    championType: champion ? (t.participationType === "teams" ? "team" : "car") : null,
  };
}
