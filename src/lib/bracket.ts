import type { Car, Match, Tournament, BracketFormat } from "./types";
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

export function buildMatches(format: BracketFormat, participantIds: string[], participationType: "cars" | "teams" = "cars"): Match[] {
  if (format === "time-trial") return [];
  if (format === "championship") return [];
  if (participantIds.length < 2) return [];
  const ids = shuffle(participantIds);
  const isTeams = participationType === "teams";

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

  if (t.format === "round-robin") {
    return { ...t, matches };
  }

  if (t.format === "single") {
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

export function standingsFor(t: Tournament, cars: Car[]) {
  const map = new Map<string, { name: string; w: number; l: number }>();
  const isTeams = t.participationType === "teams";
  
  if (isTeams) {
    (t.teamIds ?? []).forEach((id) => {
      map.set(id, { name: "", w: 0, l: 0 });
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
): Match[] {
  const size = nextPow2Down(rankedIds.length);
  if (size < 2) return [];
  const top = rankedIds.slice(0, size);
  const order = bracketOrder(size); // 1-indexed seed numbers in round-1 slot order
  const seeded: string[] = order.map((s) => top[s - 1]);

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
      });
    }
    matches.push({
      id: uid(),
      round: winnersRounds + 1,
      slot: 0,
      bracket: "final",
      winnerId: null,
      ...(isTeams ? { teamAId: null, teamBId: null } : { carAId: null, carBId: null }),
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
): Match[] {
  if (qualifyingType === "time-trial") return [];
  return buildMatches("round-robin", participantIds, participationType);
}