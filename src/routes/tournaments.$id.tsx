import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Car, Tournament, TimeEntry, Team } from "@/lib/types";
import { applyWinner, standingsFor, buildSeededBracket, rankQualifiers } from "@/lib/bracket";
import { getTournamentPlacements } from "@/lib/tournamentPlacements";
import { toast } from "sonner";
import { TournamentCertificateDialog } from "@/components/TournamentCertificateDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Car as CarIcon, Timer, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/tournaments/$id")({
  component: TournamentDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Tournament not found</h1>
      <Button asChild className="mt-4">
        <Link to="/tournaments">Back</Link>
      </Button>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button 
          className="mt-4"
          onClick={() => { 
            router.invalidate(); reset(); }}>
          Retry
        </Button>
      </div>
    );
  },
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const [tournaments, setTournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [cars, setCars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const t = tournaments.find((x) => x.id === id);

  if (!t) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Tournament not found</h1>
        <Button asChild className="mt-4">
          <Link to="/tournaments">Back to tournaments</Link>
        </Button>
      </main>
    );
  }

  const tournament = t;
  const carById = (cid?: string | null) => (cid ? cars.find((c) => c.id === cid) : undefined);
  const teamById = (tid?: string | null) => (tid ? teams.find((tm) => tm.id === tid) : undefined);
  const championCar =
    tournament.champion && tournament.championType === "car"
      ? carById(tournament.champion)
      : undefined;
  const championTeam =
    tournament.champion && tournament.championType === "team"
      ? teamById(tournament.champion)
      : undefined;
  const champ = championTeam ?? championCar ?? null;
  const certificatePlacements = getTournamentPlacements(tournament, cars, teams);

  // Check if all round-robin matches are complete
  const allRoundRobinComplete =
    tournament.format === "round-robin" && tournament.matches.every((m) => m.winnerId !== null);

  function endRoundRobin() {
    const championId =
      getTournamentPlacements(tournament, cars, teams).find((placement) => placement.place === 1)
        ?.participantId ?? null;

    if (championId) {
      setTournaments((prev) =>
        prev.map((x) =>
          x.id === tournament.id
            ? {
                ...x,
                champion: championId,
                championType: tournament.participationType === "teams" ? "team" : "car",
              }
            : x,
        ),
      );
      toast.success("Tournament ended! Champion crowned.");
    }
  }

  function resetForNextSeason() {
    if (!tournament.champion || !tournament.championType) return;
    
    // Archive the current champion
    const season = (tournament.previousSeasons?.length ?? 0) + 1;
    const newPreviousSeasons = [
      ...(tournament.previousSeasons ?? []),
      {
        season,
        champion: tournament.champion,
        championType: tournament.championType,
        dateEnded: Date.now(),
      },
    ];

    // Increment championship wins for the champion
    if (tournament.participationType === "teams") {
      setTeams((prev) =>
        prev.map((tm) =>
          tm.id === tournament.champion
            ? { ...tm, championshipWins: (tm.championshipWins ?? 0) + 1 }
            : tm,
        ),
      );
    } else {
      setCars((prev) =>
        prev.map((c) =>
          c.id === tournament.champion
            ? { ...c, championshipWins: (c.championshipWins ?? 0) + 1 }
            : c,
        ),
      );
    }

    // Calculate losses to decrement for win/loss reset
    const toDecrement = new Map<string, { wins: number; losses: number }>();
    tournament.matches.forEach((m) => {
      if (m.winnerId) {
        const dec = toDecrement.get(m.winnerId) || { wins: 0, losses: 0 };
        dec.wins += 1;
        toDecrement.set(m.winnerId, dec);
        
        let loserId: string | null = null;
        if (tournament.participationType === "teams") {
          loserId = m.teamAId === m.winnerId ? m.teamBId ?? null : m.teamAId ?? null;
        } else {
          loserId = m.carAId === m.winnerId ? m.carBId ?? null : m.carAId ?? null;
        }
        
        if (loserId) {
          const loserDec = toDecrement.get(loserId) || { wins: 0, losses: 0 };
          loserDec.losses += 1;
          toDecrement.set(loserId, loserDec);
        }
      }
    });

    // Reset the tournament matches and clear champion
    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== tournament.id) return x;
        const isTeams = x.participationType === "teams";
        const matches = x.matches.map((m) => ({
          ...m,
          winnerId: null,
          ...(isTeams ? { teamAId: m.teamAId, teamBId: m.teamBId } : { carAId: m.carAId, carBId: m.carBId }),
        }));
        return { ...x, champion: null, championType: null, matches, previousSeasons: newPreviousSeasons };
      }),
    );

    // Decrement wins and losses for all participants
    if (tournament.participationType === "teams") {
      setTeams((prev) =>
        prev.map((tm) => {
          const dec = toDecrement.get(tm.id);
          if (!dec) return tm;
          return {
            ...tm,
            wins: Math.max(0, (tm.wins ?? 0) - dec.wins),
            losses: Math.max(0, (tm.losses ?? 0) - dec.losses),
          };
        }),
      );
    } else {
      setCars((prev) =>
        prev.map((c) => {
          const dec = toDecrement.get(c.id);
          if (!dec) return c;
          return {
            ...c,
            wins: Math.max(0, (c.wins ?? 0) - dec.wins),
            losses: Math.max(0, (c.losses ?? 0) - dec.losses),
          };
        }),
      );
    }

    toast.success("Tournament reset for next season!");
  }

  function pickWinner(matchId: string, winnerId: string) {
    // Find the match to get the loser ID
    const match = tournament.matches.find((m) => m.id === matchId);
    let loserId: string | null = null;
    
    if (match) {
      if (tournament.participationType === "teams") {
        loserId = match.teamAId === winnerId ? match.teamBId ?? null : match.teamAId ?? null;
      } else {
        loserId = match.carAId === winnerId ? match.carBId ?? null : match.carAId ?? null;
      }
    }

    setTournaments((prev) =>
      prev.map((x) => (x.id === tournament.id ? applyWinner(x, matchId, winnerId) : x)),
    );
    
    // Increment wins for the winner and losses for the loser
    if (tournament.participationType === "teams") {
      setTeams((prev) => prev.map((tm) => {
        if (tm.id === winnerId) return { ...tm, wins: (tm.wins ?? 0) + 1 };
        if (tm.id === loserId) return { ...tm, losses: (tm.losses ?? 0) + 1 };
        return tm;
      }));
    } else {
      setCars((prev) => prev.map((c) => {
        if (c.id === winnerId) return { ...c, wins: (c.wins ?? 0) + 1 };
        if (c.id === loserId) return { ...c, losses: (c.losses ?? 0) + 1 };
        return c;
      }));
    }
  }

  function selectSeriesCar(
    matchKey: "matches" | "qualifyingMatches",
    matchId: string,
    gameId: string,
    side: "A" | "B",
    carId: string | null,
  ) {
    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== tournament.id) return x;
        const list = (matchKey === "matches" ? x.matches : x.qualifyingMatches) ?? [];
        const newList = list.map((m) =>
          m.id === matchId && m.series
            ? {
                ...m,
                series: m.series.map((g) =>
                  g.id === gameId
                    ? { ...g, [side === "A" ? "carAId" : "carBId"]: carId }
                    : g,
                ),
              }
            : m,
        );
        return matchKey === "matches"
          ? { ...x, matches: newList }
          : { ...x, qualifyingMatches: newList };
      }),
    );
  }

  function pickSeriesGameWinner(
    matchKey: "matches" | "qualifyingMatches",
    matchId: string,
    gameId: string,
    winnerCarId: string,
  ) {
    const arr =
      matchKey === "matches" ? tournament.matches : tournament.qualifyingMatches ?? [];
    const match = arr.find((m) => m.id === matchId);
    if (!match || !match.series) return;
    const game = match.series.find((g) => g.id === gameId);
    if (!game) return;
    const loserCarId =
      winnerCarId === game.carAId ? game.carBId : game.carAId;

    const aRoster = teams.find((tm) => tm.id === match.teamAId)?.carIds ?? [];
    const bRoster = teams.find((tm) => tm.id === match.teamBId)?.carIds ?? [];
    let aw = 0;
    let bw = 0;
    match.series.forEach((g) => {
      const w = g.id === gameId ? winnerCarId : g.winnerCarId;
      if (!w) return;
      if (aRoster.includes(w)) aw++;
      else if (bRoster.includes(w)) bw++;
    });
    const needed = Math.floor((match.seriesLength ?? match.series.length) / 2) + 1;
    let teamWinnerId: string | null = null;
    if (!match.winnerId) {
      if (aw >= needed) teamWinnerId = match.teamAId ?? null;
      else if (bw >= needed) teamWinnerId = match.teamBId ?? null;
    }
    const teamLoserId = teamWinnerId
      ? (teamWinnerId === match.teamAId ? match.teamBId : match.teamAId) ?? null
      : null;

    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== tournament.id) return x;
        const list = (matchKey === "matches" ? x.matches : x.qualifyingMatches) ?? [];
        const newList = list.map((m) =>
          m.id === matchId && m.series
            ? {
                ...m,
                series: m.series.map((g) =>
                  g.id === gameId ? { ...g, winnerCarId } : g,
                ),
              }
            : m,
        );
        let updated: Tournament =
          matchKey === "matches"
            ? { ...x, matches: newList }
            : { ...x, qualifyingMatches: newList };
        if (teamWinnerId) {
          if (matchKey === "matches") {
            updated = applyWinner(updated, matchId, teamWinnerId);
          } else {
            updated = {
              ...updated,
              qualifyingMatches: (updated.qualifyingMatches ?? []).map((m) =>
                m.id === matchId ? { ...m, winnerId: teamWinnerId } : m,
              ),
            };
          }
        }
        return updated;
      }),
    );

    setCars((prev) =>
      prev.map((c) => {
        if (c.id === winnerCarId) return { ...c, wins: (c.wins ?? 0) + 1 };
        if (loserCarId && c.id === loserCarId)
          return { ...c, losses: (c.losses ?? 0) + 1 };
        return c;
      }),
    );
    if (teamWinnerId) {
      setTeams((prev) =>
        prev.map((tm) => {
          if (tm.id === teamWinnerId) return { ...tm, wins: (tm.wins ?? 0) + 1 };
          if (teamLoserId && tm.id === teamLoserId)
            return { ...tm, losses: (tm.losses ?? 0) + 1 };
          return tm;
        }),
      );
    }
  }

  function reset() {
    // Calculate losses and wins to decrement based on current matches
    const toDecrement = new Map<string, { wins: number; losses: number }>();
    tournament.matches.forEach((m) => {
      if (m.winnerId) {
        const dec = toDecrement.get(m.winnerId) || { wins: 0, losses: 0 };
        dec.wins += 1;
        toDecrement.set(m.winnerId, dec);
        
        let loserId: string | null = null;
        if (tournament.participationType === "teams") {
          loserId = m.teamAId === m.winnerId ? m.teamBId ?? null : m.teamAId ?? null;
        } else {
          loserId = m.carAId === m.winnerId ? m.carBId ?? null : m.carAId ?? null;
        }
        
        if (loserId) {
          const loserDec = toDecrement.get(loserId) || { wins: 0, losses: 0 };
          loserDec.losses += 1;
          toDecrement.set(loserId, loserDec);
        }
      }
    });

    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== tournament.id) return x;
        const isTeams = x.participationType === "teams";
        const matches = x.matches.map((m) => {
          if (x.format === "round-robin") return { ...m, winnerId: null };
          // elimination: keep only round-1 winners-bracket pairings
          const isRound1Winners = m.round === 1 && (m.bracket === undefined || m.bracket === "winners");
          if (isTeams) {
            return {
              ...m,
              winnerId: null,
              teamAId: isRound1Winners ? m.teamAId : null,
              teamBId: isRound1Winners ? m.teamBId : null,
            };
          } else {
            return {
              ...m,
              winnerId: null,
              carAId: isRound1Winners ? m.carAId : null,
              carBId: isRound1Winners ? m.carBId : null,
            };
          }
        });
        return { ...x, champion: null, championType: null, matches };
      }),
    );

    // Decrement wins and losses for affected participants
    if (tournament.participationType === "teams") {
      setTeams((prev) =>
        prev.map((tm) => {
          const dec = toDecrement.get(tm.id);
          if (!dec) return tm;
          return {
            ...tm,
            wins: Math.max(0, (tm.wins ?? 0) - dec.wins),
            losses: Math.max(0, (tm.losses ?? 0) - dec.losses),
          };
        }),
      );
    } else {
      setCars((prev) =>
        prev.map((c) => {
          const dec = toDecrement.get(c.id);
          if (!dec) return c;
          return {
            ...c,
            wins: Math.max(0, (c.wins ?? 0) - dec.wins),
            losses: Math.max(0, (c.losses ?? 0) - dec.losses),
          };
        }),
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <Link to="/tournaments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tournaments
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tournament.name}</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {tournament.format === "single"
              ? "Single elimination"
              : tournament.format === "double"
                ? "Double elimination"
                : tournament.format === "round-robin"
                  ? "Round-robin"
                  : tournament.format === "time-trial"
                    ? "Time trial"
                    : `Championship • ${tournament.qualifyingType === "round-robin" ? "Round-robin" : "Time trial"} → ${tournament.qualifyingFormat === "double" ? "Double" : "Single"} elim`}
            {" • "}
            {tournament.participationType === "teams" ? (tournament.teamIds?.length || 0) : (tournament.carIds?.length || 0)} {tournament.participationType === "teams" ? "teams" : "cars"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {certificatePlacements.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setCertificateOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Certificates
            </Button>
          )}
          {champ ? (
            <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]" style={{ background: "var(--gradient-primary)" }}>
              <Trophy className="h-4 w-4" /> Champion: {champ.name}
            </div>
          ) : null}
        </div>
      </div>

      {tournament.format === "round-robin" ? (
        <RoundRobin
          t={tournament}
          cars={cars}
          teams={teams}
          onPick={pickWinner}
          onSelectSeriesCar={(mId, gId, side, cId) =>
            selectSeriesCar("matches", mId, gId, side, cId)
          }
          onPickSeriesGame={(mId, gId, cId) =>
            pickSeriesGameWinner("matches", mId, gId, cId)
          }
        />
      ) : tournament.format === "time-trial" ? (
        <TimeTrialView
          t={tournament}
          cars={cars}
          teams={teams}
          onChange={(updater) =>
            setTournaments((prev) => prev.map((x) => (x.id === tournament.id ? updater(x) : x)))
          }
        />
      ) : tournament.format === "championship" ? (
        <ChampionshipView
          t={tournament}
          cars={cars}
          teams={teams}
          carById={carById}
          teamById={teamById}
          onPick={pickWinner}
          onChange={(updater) =>
            setTournaments((prev) => prev.map((x) => (x.id === tournament.id ? updater(x) : x)))
          }
        />
      ) : (
        <Bracket
          t={tournament}
          cars={cars}
          carById={carById}
          teamById={teamById}
          onPick={pickWinner}
          onSelectSeriesCar={(mId, gId, side, cId) =>
            selectSeriesCar("matches", mId, gId, side, cId)
          }
          onPickSeriesGame={(mId, gId, cId) =>
            pickSeriesGameWinner("matches", mId, gId, cId)
          }
        />
      )}

      <div className="mt-10 flex justify-end gap-2">
        {tournament.format !== "time-trial" && tournament.format !== "championship" && (
          <Button variant="outline" size="sm" onClick={reset}>Reset results</Button>
        )}
        {allRoundRobinComplete && !champ && (
          <Button size="sm" onClick={endRoundRobin}>
            <Trophy className="h-4 w-4 mr-2" />
            End Tournament
          </Button>
        )}
        {tournament.persistent && champ && (
          <Button size="sm" onClick={resetForNextSeason} className="bg-amber-600 hover:bg-amber-700">
            <Trophy className="h-4 w-4 mr-2" />
            Reset for Next Season
          </Button>
        )}
      </div>

      {certificatePlacements.length > 0 && (
        <TournamentCertificateDialog
          open={certificateOpen}
          onOpenChange={setCertificateOpen}
          tournament={tournament}
          placements={certificatePlacements}
        />
      )}
    </main>
  );
}

function recomputeTTChampion(t: Tournament): Tournament {
  const best = new Map<string, number>();
  (t.times ?? []).forEach((e) => {
    const cur = best.get(e.carId);
    if (cur === undefined || e.seconds < cur) best.set(e.carId, e.seconds);
  });
  let champion: string | null = null;
  let bestSec = Infinity;
  best.forEach((sec, carId) => {
    if (sec < bestSec) {
      bestSec = sec;
      champion = carId;
    }
  });
  return { ...t, champion };
}

function TimeTrialView({
  t,
  cars,
  teams,
  onChange,
}: {
  t: Tournament;
  cars: Car[];
  teams: Team[];
  onChange: (updater: (prev: Tournament) => Tournament) => void;
}) {
  const isTeams = t.participationType === "teams";
  
  // Get roster: for car tournaments use carIds directly, for team tournaments get cars from team members
  const allRosterCars = isTeams
    ? (t.teamIds ?? []).flatMap((teamId) => {
        const team = teams.find((tm) => tm.id === teamId);
        return team ? team.carIds : [];
      }).map((carId) => cars.find((c) => c.id === carId)).filter((c): c is Car => !!c)
    : (t.carIds ?? []).map((id) => cars.find((c) => c.id === id)).filter((c): c is Car => !!c);
  
  const [selectedCarId, setSelectedCarId] = useState<string>(allRosterCars[0]?.id ?? "");
  const [secondsInput, setSecondsInput] = useState("");

  const roster = allRosterCars;
  const times = t.times ?? [];
  const unit = t.trackUnit ?? "cm";

  function addTime() {
    const sec = Number(secondsInput);
    if (!selectedCarId) return;
    if (!Number.isFinite(sec) || sec <= 0) return;
    const entry: TimeEntry = {
      id: uid(),
      carId: selectedCarId,
      seconds: sec,
      recordedAt: Date.now(),
    };
    onChange((prev) =>
      recomputeTTChampion({ ...prev, times: [...(prev.times ?? []), entry] }),
    );
    setSecondsInput("");
  }

  function removeTime(id: string) {
    onChange((prev) =>
      recomputeTTChampion({
        ...prev,
        times: (prev.times ?? []).filter((e) => e.id !== id),
      }),
    );
  }

  // Best time per car for leaderboard
  const best = new Map<string, TimeEntry>();
  times.forEach((e) => {
    const cur = best.get(e.carId);
    if (!cur || e.seconds < cur.seconds) best.set(e.carId, e);
  });
  const board = roster
    .map((c) => ({ car: c, best: best.get(c.id) }))
    .sort((a, b) => {
      if (!a.best && !b.best) return 0;
      if (!a.best) return 1;
      if (!b.best) return -1;
      return a.best.seconds - b.best.seconds;
    });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Timer className="h-4 w-4" /> Record a run
        </h2>
        <Card className="p-4 shadow-[var(--shadow-card)]">
          <div className="text-xs text-muted-foreground">
            Track length: <span className="font-semibold text-foreground tabular-nums">{t.trackLength} {unit}</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {roster.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input
              type="number"
              step="0.001"
              min={0}
              placeholder="Seconds"
              value={secondsInput}
              onChange={(e) => setSecondsInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTime()}
            />
            <Button onClick={addTime}>Add</Button>
          </div>
        </Card>

        <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider">All runs</h2>
        {times.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No times recorded yet.
          </div>
        ) : (
          <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
            {[...times]
              .sort((a, b) => b.recordedAt - a.recordedAt)
              .map((e) => {
                const c = cars.find((x) => x.id === e.carId);
                return (
                  <div
                    key={e.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate font-medium">{c?.name ?? "Unknown"}</span>
                    <span className="font-semibold tabular-nums">{e.seconds.toFixed(3)}s</span>
                    <button
                      type="button"
                      onClick={() => removeTime(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove time"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Leaderboard</h2>
        <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[28px_1fr_auto] gap-2 border-b border-border bg-secondary/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>#</span><span>Car</span><span className="text-right">Best</span>
          </div>
          {board.map((row, i) => (
            <div
              key={row.car.id}
              className={`grid grid-cols-[28px_1fr_auto] items-center gap-2 px-3 py-2 text-sm ${i === 0 && row.best ? "bg-primary/5" : ""}`}
            >
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="flex items-center gap-1.5 truncate font-medium">
                {i === 0 && row.best && <Trophy className="h-3.5 w-3.5 text-primary" />}
                <span className="truncate">{row.car.name}</span>
              </span>
              <span className="text-right font-semibold tabular-nums">
                {row.best ? `${row.best.seconds.toFixed(3)}s` : "—"}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function ChampionshipView({
  t,
  cars,
  teams,
  carById,
  teamById,
  onPick,
  onChange,
}: {
  t: Tournament;
  cars: Car[];
  teams: Team[];
  carById: (id?: string | null) => Car | undefined;
  teamById: (id?: string | null) => Team | undefined;
  onPick: (matchId: string, winnerId: string) => void;
  onChange: (updater: (prev: Tournament) => Tournament) => void;
}) {
  const isTeams = t.participationType === "teams";
  const locked = !!t.qualifyingLocked;
  const advance = t.advanceCount ?? 0;

  function lockAndSeed() {
    const ranked = rankQualifiers(t, cars);
    if (ranked.length < 2) {
      toast.error("Not enough qualifiers to seed a bracket.");
      return;
    }
    const bracketFormat = t.qualifyingFormat ?? "single";
    const top = ranked.slice(0, advance);
    const matches = buildSeededBracket(bracketFormat, top, isTeams);
    if (matches.length === 0) {
      toast.error("Could not build a bracket from these qualifiers.");
      return;
    }
    const seeds = top.map((id, i) => ({ participantId: id, seed: i + 1 }));
    onChange((prev) => ({
      ...prev,
      qualifyingLocked: true,
      seeds,
      matches,
      champion: null,
      championType: null,
    }));
    toast.success("Bracket seeded");
  }

  function unlock() {
    if (!confirm("Unlock qualifying and clear the bracket?")) return;
    onChange((prev) => ({
      ...prev,
      qualifyingLocked: false,
      seeds: undefined,
      matches: [],
      champion: null,
      championType: null,
    }));
  }

  // Qualifying section ------------------------------------------------------
  function QualifyingTimeTrial() {
    return (
      <TimeTrialView
        t={t}
        cars={cars}
        teams={teams}
        onChange={(u) => onChange(u)}
      />
    );
  }

  function QualifyingRoundRobin() {
    const carByIdLocal = (id?: string | null) => (id ? cars.find((c) => c.id === id) : undefined);
    const teamByIdLocal = (id?: string | null) => (id ? teams.find((tm) => tm.id === id) : undefined);
    function pickQualifying(matchId: string, winnerId: string) {
      onChange((prev) => ({
        ...prev,
        qualifyingMatches: (prev.qualifyingMatches ?? []).map((m) =>
          m.id === matchId ? { ...m, winnerId } : m,
        ),
      }));
    }
    const qms = t.qualifyingMatches ?? [];
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {qms.map((m, i) => (
          <MatchCell
            key={m.id}
            label={`Qualifier ${i + 1}`}
            carA={isTeams ? undefined : carByIdLocal(m.carAId)}
            carB={isTeams ? undefined : carByIdLocal(m.carBId)}
            teamA={isTeams ? teamByIdLocal(m.teamAId) : undefined}
            teamB={isTeams ? teamByIdLocal(m.teamBId) : undefined}
            winnerId={m.winnerId}
            onPick={(id) => pickQualifying(m.id, id)}
          />
        ))}
      </div>
    );
  }

  // Live preview of seeding --------------------------------------------------
  const ranked = rankQualifiers(t, cars);
  const previewTop = ranked.slice(0, advance);
  const nameOf = (id: string) => (isTeams ? teamById(id)?.name : carById(id)?.name) ?? "—";

  return (
    <div className="mt-8 space-y-10">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Qualifying — {t.qualifyingType === "round-robin" ? "Round-robin" : "Time trial"}
            {locked ? " (locked)" : ""}
          </h2>
          {!locked ? (
            <Button size="sm" onClick={lockAndSeed}>
              Lock qualifying & seed bracket
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={unlock}>
              Unlock qualifying
            </Button>
          )}
        </div>
        <div className={locked ? "pointer-events-none opacity-70" : ""}>
          {t.qualifyingType === "round-robin" ? <QualifyingRoundRobin /> : <QualifyingTimeTrial />}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">
          Championship bracket {locked ? `(top ${advance})` : "— preview"}
        </h2>
        {!locked ? (
          <Card className="p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 text-xs text-muted-foreground">
              Lock qualifying to build the bracket. Top {advance} will be seeded 1 v {advance}, 2 v{" "}
              {advance - 1}, …
            </p>
            <div className="grid gap-1 text-sm">
              {previewTop.length === 0 ? (
                <span className="text-muted-foreground">No qualifying results yet.</span>
              ) : (
                previewTop.map((id, i) => (
                  <div key={id} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-semibold tabular-nums text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span className="truncate font-medium">{nameOf(id)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        ) : (
          <Bracket
            t={{ ...t, format: t.qualifyingFormat ?? "single" }}
            carById={carById}
            teamById={teamById}
            onPick={onPick}
          />
        )}
      </section>
    </div>
  );
}

function MatchCell({
  carA, carB, teamA, teamB, winnerId, onPick, label,
}: {
  carA?: Car; carB?: Car;
  teamA?: Team; teamB?: Team;
  winnerId?: string | null;
  onPick: (id: string) => void;
  label?: string;
}) {
  const isTeams = !!teamA || !!teamB;
  const aId = isTeams ? teamA?.id : carA?.id;
  const bId = isTeams ? teamB?.id : carB?.id;
  const aName = isTeams ? teamA?.name : carA?.name;
  const bName = isTeams ? teamB?.name : carB?.name;
  
  const Slot = ({ id, name, isWinner }: { id?: string; name?: string; isWinner: boolean }) => (
    <button
      type="button"
      disabled={!id || !aId || !bId || !!winnerId}
      onClick={() => id && onPick(id)}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        isWinner ? "bg-primary/10 font-semibold text-primary" : "hover:bg-secondary"
      } ${!id ? "text-muted-foreground" : ""} disabled:cursor-default`}
    >
      {!isTeams && (
        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
          {carA?.photo || carB?.photo ? (
            <img src={carA?.photo || carB?.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <CarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      )}
      <span className="flex-1 truncate">{name ?? "TBD"}</span>
      {isWinner && <Trophy className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
      {label && <div className="border-b border-border bg-secondary/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>}
      <Slot id={aId} name={aName} isWinner={winnerId === aId} />
      <div className="border-t border-border" />
      <Slot id={bId} name={bName} isWinner={winnerId === bId} />
    </Card>
  );
}

function Bracket({
  t, cars, carById, teamById, onPick, onSelectSeriesCar, onPickSeriesGame,
}: {
  t: Tournament;
  cars?: Car[];
  carById: (id?: string | null) => Car | undefined;
  teamById?: (id?: string | null) => Team | undefined;
  onPick: (matchId: string, winnerId: string) => void;
  onSelectSeriesCar?: (matchId: string, gameId: string, side: "A" | "B", carId: string | null) => void;
  onPickSeriesGame?: (matchId: string, gameId: string, winnerCarId: string) => void;
}) {
  const isDouble = t.format === "double";
  const isTeams = t.participationType === "teams";
  const useSeries = !!t.fullTeamMode && isTeams && !!onSelectSeriesCar && !!onPickSeriesGame;
  const renderMatch = (m: typeof t.matches[number]) =>
    useSeries && m.series ? (
      <SeriesMatchCell
        key={m.id}
        match={m}
        teamA={teamById?.(m.teamAId)}
        teamB={teamById?.(m.teamBId)}
        cars={cars ?? []}
        onSelectCar={(gid, side, cid) => onSelectSeriesCar!(m.id, gid, side, cid)}
        onPickWinner={(gid, cid) => onPickSeriesGame!(m.id, gid, cid)}
      />
    ) : (
      <MatchCell
        key={m.id}
        carA={isTeams ? undefined : carById(m.carAId)}
        carB={isTeams ? undefined : carById(m.carBId)}
        teamA={isTeams ? teamById?.(m.teamAId) : undefined}
        teamB={isTeams ? teamById?.(m.teamBId) : undefined}
        winnerId={m.winnerId}
        onPick={(id) => onPick(m.id, id)}
      />
    );

  if (!isDouble) {
    const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
    return (
      <div className="mt-8 overflow-x-auto">
        <div className={`flex gap-6 pb-2 ${useSeries ? "min-w-full" : ""}`}>
          {rounds.map((r) => {
            const ms = t.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
            return (
              <div key={r} className={`flex flex-col justify-around gap-4 ${useSeries ? "min-w-[300px]" : "min-w-[220px]"}`}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {r === rounds.length ? "Final" : r === rounds.length - 1 ? "Semifinal" : `Round ${r}`}
                </div>
                {ms.map((m) => renderMatch(m))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // double elim — winners + losers + final
  const winners = t.matches.filter((m) => m.bracket === "winners");
  const losers = t.matches.filter((m) => m.bracket === "losers");
  const finals = t.matches.filter((m) => m.bracket === "final");
  const wRounds = [...new Set(winners.map((m) => m.round))].sort((a, b) => a - b);
  const lRounds = [...new Set(losers.map((m) => m.round))].sort((a, b) => a - b);

  const Column = ({ title, matches }: { title: string; matches: typeof t.matches }) => (
    <div className={`flex flex-col gap-3 ${useSeries ? "min-w-[300px]" : "min-w-[220px]"}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {matches.map((m) => renderMatch(m))}
    </div>
  );

  return (
    <div className="mt-8 space-y-10">
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Winners bracket</h2>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {wRounds.map((r) => (
            <Column key={r} title={`Round ${r}`} matches={winners.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)} />
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Losers bracket</h2>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {lRounds.map((r) => (
            <Column key={r} title={`Round ${r}`} matches={losers.filter((m) => m.round === r)} />
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Grand final</h2>
        <div className="flex gap-6 overflow-x-auto pb-2">
          <Column title="Final" matches={finals} />
        </div>
      </div>
    </div>
  );
}

function RoundRobin({
  t, cars, teams, onPick, onSelectSeriesCar, onPickSeriesGame,
}: {
  t: Tournament;
  cars: Car[];
  teams: Team[];
  onPick: (matchId: string, winnerId: string) => void;
  onSelectSeriesCar?: (matchId: string, gameId: string, side: "A" | "B", carId: string | null) => void;
  onPickSeriesGame?: (matchId: string, gameId: string, winnerCarId: string) => void;
}) {
  const standings = standingsFor(t, cars, teams);
  const isTeams = t.participationType === "teams";
  const carById = (id?: string | null) => (id ? cars.find((c) => c.id === id) : undefined);
  const teamById = (id?: string | null) => (id ? teams.find((tm) => tm.id === id) : undefined);
  const useSeries = !!t.fullTeamMode && isTeams && !!onSelectSeriesCar && !!onPickSeriesGame;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Match-ups</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {t.matches.map((m, i) =>
            useSeries && m.series ? (
              <SeriesMatchCell
                key={m.id}
                label={`Match ${i + 1}`}
                match={m}
                teamA={teamById(m.teamAId)}
                teamB={teamById(m.teamBId)}
                cars={cars}
                onSelectCar={(gid, side, cid) => onSelectSeriesCar!(m.id, gid, side, cid)}
                onPickWinner={(gid, cid) => onPickSeriesGame!(m.id, gid, cid)}
              />
            ) : (
              <MatchCell
                key={m.id}
                label={`Match ${i + 1}`}
                carA={isTeams ? undefined : carById(m.carAId)}
                carB={isTeams ? undefined : carById(m.carBId)}
                teamA={isTeams ? teamById(m.teamAId) : undefined}
                teamB={isTeams ? teamById(m.teamBId) : undefined}
                winnerId={m.winnerId}
                onPick={(id) => onPick(m.id, id)}
              />
            ),
          )}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Standings</h2>
        <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[1fr_40px_40px] gap-2 border-b border-border bg-secondary/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{isTeams ? "Team" : "Car"}</span><span className="text-right">W</span><span className="text-right">L</span>
          </div>
          {standings.map((s, i) => (
            <div key={s.name} className={`grid grid-cols-[1fr_40px_40px] items-center gap-2 px-3 py-2 text-sm ${i === 0 && s.w > 0 ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2 truncate">
                <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate font-medium">{s.name}</span>
              </div>
              <span className="text-right font-semibold tabular-nums">{s.w}</span>
              <span className="text-right text-muted-foreground tabular-nums">{s.l}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
