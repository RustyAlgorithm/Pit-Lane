import type { Car, Match, Team, Tournament } from "./types";

export interface TournamentPlacement {
  place: 1 | 2 | 3;
  placeLabel: "1st Place" | "2nd Place" | "3rd Place";
  participantId: string;
  participantType: "car" | "team";
  participantName: string;
  accentColor?: string;
  recipientImage?: string;
  note?: string;
}

function placementLabel(place: 1 | 2 | 3): TournamentPlacement["placeLabel"] {
  if (place === 1) return "1st Place";
  if (place === 2) return "2nd Place";
  return "3rd Place";
}

function getParticipantIds(match: Match, isTeams: boolean) {
  return isTeams ? [match.teamAId ?? null, match.teamBId ?? null] : [match.carAId ?? null, match.carBId ?? null];
}

function loserFromMatch(match: Match, isTeams: boolean) {
  if (!match.winnerId) return null;
  const [aId, bId] = getParticipantIds(match, isTeams);
  if (!aId || !bId) return null;
  return aId === match.winnerId ? bId : aId;
}

function participantMeta(
  id: string,
  type: "car" | "team",
  cars: Car[],
  teams: Team[],
): Omit<TournamentPlacement, "place" | "placeLabel" | "note"> | null {
  if (type === "team") {
    const team = teams.find((entry) => entry.id === id);
    if (!team) return null;
    return {
      participantId: team.id,
      participantType: "team",
      participantName: team.name,
      accentColor: team.color,
      recipientImage: undefined,
    };
  }

  const car = cars.find((entry) => entry.id === id);
  if (!car) return null;
  const accentColor = teams.find((team) => team.carIds.includes(car.id))?.color;
  return {
    participantId: car.id,
    participantType: "car",
    participantName: car.name,
    accentColor,
    recipientImage: car.photo?.startsWith("data:") ? car.photo : undefined,
  };
}

function withPlace(
  place: 1 | 2 | 3,
  id: string | null | undefined,
  type: "car" | "team",
  cars: Car[],
  teams: Team[],
  note?: string,
) {
  if (!id) return null;
  const meta = participantMeta(id, type, cars, teams);
  if (!meta) return null;
  return {
    place,
    placeLabel: placementLabel(place),
    ...meta,
    ...(note ? { note } : {}),
  } satisfies TournamentPlacement;
}

function uniquePlacements(placements: Array<TournamentPlacement | null>) {
  const seen = new Set<string>();
  return placements.filter((placement): placement is TournamentPlacement => {
    if (!placement) return false;
    if (seen.has(placement.participantId)) return false;
    seen.add(placement.participantId);
    return true;
  });
}

function totalWinsByParticipant(tournament: Tournament) {
  const wins = new Map<string, number>();
  tournament.matches.forEach((match) => {
    if (!match.winnerId) return;
    wins.set(match.winnerId, (wins.get(match.winnerId) ?? 0) + 1);
  });
  return wins;
}

function rankRoundRobinParticipants(tournament: Tournament) {
  const isTeams = tournament.participationType === "teams";
  const rosterIds = (isTeams ? tournament.teamIds : tournament.carIds) ?? [];
  const wl = new Map<string, { wins: number; losses: number }>();
  rosterIds.forEach((id) => wl.set(id, { wins: 0, losses: 0 }));

  tournament.matches.forEach((match) => {
    if (!match.winnerId) return;
    const [aId, bId] = getParticipantIds(match, isTeams);
    if (!aId || !bId) return;
    const winner = wl.get(match.winnerId);
    if (winner) winner.wins += 1;
    const loserId = aId === match.winnerId ? bId : aId;
    const loser = wl.get(loserId);
    if (loser) loser.losses += 1;
  });

  return [...rosterIds].sort((a, b) => {
    const left = wl.get(a) ?? { wins: 0, losses: 0 };
    const right = wl.get(b) ?? { wins: 0, losses: 0 };
    return right.wins - left.wins || left.losses - right.losses || a.localeCompare(b);
  });
}

function rankTimeTrialParticipants(tournament: Tournament, teams: Team[]) {
  const isTeams = tournament.participationType === "teams";
  const rosterIds = (isTeams ? tournament.teamIds : tournament.carIds) ?? [];

  if (isTeams) {
    const bestByTeam = new Map<string, number>();
    const rosterTeams = teams.filter((team) => rosterIds.includes(team.id));
    (tournament.times ?? []).forEach((entry) => {
      const owner = rosterTeams.find((team) => team.carIds.includes(entry.carId));
      if (!owner) return;
      const current = bestByTeam.get(owner.id);
      if (current === undefined || entry.seconds < current) bestByTeam.set(owner.id, entry.seconds);
    });
    return [...rosterIds]
      .filter((id) => bestByTeam.has(id))
      .sort((a, b) => {
        const left = bestByTeam.get(a)!;
        const right = bestByTeam.get(b)!;
        return left - right;
      });
  }

  const bestByCar = new Map<string, number>();
  (tournament.times ?? []).forEach((entry) => {
    const current = bestByCar.get(entry.carId);
    if (current === undefined || entry.seconds < current) bestByCar.set(entry.carId, entry.seconds);
  });

  return [...rosterIds]
    .filter((id) => bestByCar.has(id))
    .sort((a, b) => {
      const left = bestByCar.get(a)!;
      const right = bestByCar.get(b)!;
      return left - right;
    });
}

function placementsFromOrderedIds(
  ids: string[],
  type: "car" | "team",
  cars: Car[],
  teams: Team[],
) {
  return uniquePlacements([
    withPlace(1, ids[0], type, cars, teams),
    withPlace(2, ids[1], type, cars, teams),
    withPlace(3, ids[2], type, cars, teams),
  ]);
}

function singleEliminationPlacements(tournament: Tournament, cars: Car[], teams: Team[]) {
  if (!tournament.champion || !tournament.championType) return [];
  const type = tournament.championType;
  const matches = tournament.matches;
  if (matches.length === 0) return placementsFromOrderedIds([tournament.champion], type, cars, teams);

  const maxRound = Math.max(...matches.map((match) => match.round));
  const finalMatch = matches
    .filter((match) => match.round === maxRound)
    .sort((a, b) => a.slot - b.slot)[0];
  const runnerUpId = finalMatch ? loserFromMatch(finalMatch, type === "team") : null;

  const semifinalLosers = matches
    .filter((match) => match.round === maxRound - 1)
    .map((match) => loserFromMatch(match, type === "team"))
    .filter((entry): entry is string => !!entry);

  let thirdId: string | null = null;
  let thirdNote: string | undefined;
  if (semifinalLosers.length === 1) {
    thirdId = semifinalLosers[0];
  } else if (semifinalLosers.length > 1) {
    const wins = totalWinsByParticipant(tournament);
    thirdId = [...semifinalLosers].sort((a, b) => {
      const winDelta = (wins.get(b) ?? 0) - (wins.get(a) ?? 0);
      if (winDelta !== 0) return winDelta;
      const seedA = tournament.seeds?.find((seed) => seed.participantId === a)?.seed ?? Number.MAX_SAFE_INTEGER;
      const seedB = tournament.seeds?.find((seed) => seed.participantId === b)?.seed ?? Number.MAX_SAFE_INTEGER;
      return seedA - seedB || a.localeCompare(b);
    })[0];
    thirdNote =
      "Single-elimination brackets do not store an exact third-place finisher, so this was prefilled from the semifinal results. Edit the recipient if you want the other semifinalist instead.";
  }

  return uniquePlacements([
    withPlace(1, tournament.champion, type, cars, teams),
    withPlace(2, runnerUpId, type, cars, teams),
    withPlace(3, thirdId, type, cars, teams, thirdNote),
  ]);
}

function doubleEliminationPlacements(tournament: Tournament, cars: Car[], teams: Team[]) {
  if (!tournament.champion || !tournament.championType) return [];
  const type = tournament.championType;
  const finalMatch = tournament.matches.find((match) => match.bracket === "final");
  const runnerUpId = finalMatch ? loserFromMatch(finalMatch, type === "team") : null;

  const losersMatches = tournament.matches.filter((match) => match.bracket === "losers");
  const lastLosersRound = losersMatches.length > 0 ? Math.max(...losersMatches.map((match) => match.round)) : null;
  const thirdMatch =
    lastLosersRound === null
      ? null
      : losersMatches
          .filter((match) => match.round === lastLosersRound)
          .sort((a, b) => a.slot - b.slot)[0];
  const thirdId = thirdMatch ? loserFromMatch(thirdMatch, type === "team") : null;

  return uniquePlacements([
    withPlace(1, tournament.champion, type, cars, teams),
    withPlace(2, runnerUpId, type, cars, teams),
    withPlace(3, thirdId, type, cars, teams),
  ]);
}

export function getTournamentPlacements(
  tournament: Tournament,
  cars: Car[],
  teams: Team[],
): TournamentPlacement[] {
  const type = tournament.participationType === "teams" ? "team" : "car";

  if (tournament.format === "round-robin") {
    if (!tournament.matches.every((match) => !!match.winnerId)) return [];
    return placementsFromOrderedIds(rankRoundRobinParticipants(tournament), type, cars, teams);
  }

  if (tournament.format === "time-trial") {
    if ((tournament.times ?? []).length === 0) return [];
    return placementsFromOrderedIds(rankTimeTrialParticipants(tournament, teams), type, cars, teams);
  }

  const effectiveFormat = tournament.format === "championship" ? (tournament.qualifyingFormat ?? "single") : tournament.format;
  if (effectiveFormat === "double") return doubleEliminationPlacements(tournament, cars, teams);
  return singleEliminationPlacements(tournament, cars, teams);
}
