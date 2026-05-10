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

export function buildMatches(format: BracketFormat, carIds: string[]): Match[] {
  if (carIds.length < 2) return [];
  const ids = shuffle(carIds);

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
          carAId: ids[i],
          carBId: ids[j],
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
    matches.push({
      id: uid(),
      round: 1,
      slot: i,
      bracket: format === "double" ? "winners" : undefined,
      carAId: a,
      carBId: b,
      winnerId: a && !b ? a : b && !a ? b : null,
    });
  }
  // subsequent winners-rounds (empty placeholders)
  let prev = size / 2;
  let round = 2;
  while (prev > 1) {
    for (let i = 0; i < prev / 2; i++) {
      matches.push({
        id: uid(),
        round,
        slot: i,
        bracket: format === "double" ? "winners" : undefined,
        carAId: null,
        carBId: null,
        winnerId: null,
      });
    }
    prev = prev / 2;
    round++;
  }

  if (format === "double") {
    // simple losers bracket: one match per winners round (linear, not bracket-perfect but playable)
    const winnersRounds = Math.log2(size);
    for (let r = 1; r <= winnersRounds; r++) {
      matches.push({
        id: uid(),
        round: r,
        slot: 0,
        bracket: "losers",
        carAId: null,
        carBId: null,
        winnerId: null,
      });
    }
    // grand final
    matches.push({
      id: uid(),
      round: winnersRounds + 1,
      slot: 0,
      bracket: "final",
      carAId: null,
      carBId: null,
      winnerId: null,
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
  const loserId = m.carAId === winnerId ? m.carBId : m.carAId;

  if (t.format === "round-robin") {
    return { ...t, matches };
  }

  if (t.format === "single") {
    // find next round same bracket: slot = floor(slot/2), side = slot%2
    const next = matches.find(
      (n) => n.round === m.round + 1 && n.slot === Math.floor(m.slot / 2),
    );
    if (next) {
      if (m.slot % 2 === 0) next.carAId = winnerId;
      else next.carBId = winnerId;
    } else {
      // this was the final
      return { ...t, matches, champion: winnerId };
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
        if (m.slot % 2 === 0) next.carAId = winnerId;
        else next.carBId = winnerId;
      }
    } else {
      // winners final -> grand final A
      const gf = matches.find((n) => n.bracket === "final");
      if (gf) gf.carAId = winnerId;
    }
    // send loser to losers bracket linear chain
    if (loserId) {
      const lb = matches.find((n) => n.bracket === "losers" && n.round === m.round && !n.carAId);
      if (lb) lb.carAId = loserId;
      else {
        const lb2 = matches.find((n) => n.bracket === "losers" && n.round === m.round && !n.carBId);
        if (lb2) lb2.carBId = loserId;
      }
    }
  } else if (m.bracket === "losers") {
    const losersRounds = Math.max(...matches.filter((x) => x.bracket === "losers").map((x) => x.round));
    if (m.round < losersRounds) {
      const next = matches.find((n) => n.bracket === "losers" && n.round === m.round + 1);
      if (next) {
        if (!next.carAId) next.carAId = winnerId;
        else if (!next.carBId) next.carBId = winnerId;
      }
    } else {
      const gf = matches.find((n) => n.bracket === "final");
      if (gf) gf.carBId = winnerId;
    }
  } else if (m.bracket === "final") {
    return { ...t, matches, champion: winnerId };
  }

  return { ...t, matches };
}

export function standingsFor(t: Tournament, cars: Car[]) {
  const map = new Map<string, { car: Car; w: number; l: number }>();
  t.carIds.forEach((id) => {
    const c = cars.find((x) => x.id === id);
    if (c) map.set(id, { car: c, w: 0, l: 0 });
  });
  t.matches.forEach((m) => {
    if (!m.winnerId || !m.carAId || !m.carBId) return;
    const winner = map.get(m.winnerId);
    if (winner) winner.w++;
    const loserId = m.carAId === m.winnerId ? m.carBId : m.carAId;
    const loser = map.get(loserId);
    if (loser) loser.l++;
  });
  return [...map.values()].sort((a, b) => b.w - a.w || a.l - b.l);
}