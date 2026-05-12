import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Car, Tournament, TimeEntry, Team } from "@/lib/types";
import {
  applyWinner,
  standingsFor,
  buildSeededBracket,
  rankQualifiers,
} from "@/lib/bracket";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Car as CarIcon, Timer, Trash2 } from "lucide-react";

export const Route = createFileRoute("/tournaments/$id")({
  component: TournamentDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Tournament not found</h1>
      <Button asChild className="mt-4"><Link to="/tournaments">Back</Link></Button>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
      </div>
    );
  },
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const [tournaments, setTournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [cars, setCars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
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

  const carById = (cid?: string | null) => (cid ? cars.find((c) => c.id === cid) : undefined);
  const teamById = (tid?: string | null) => (tid ? teams.find((tm) => tm.id === tid) : undefined);
  const champ = t.champion ? (t.championType === "team" ? teamById(t.champion) : carById(t.champion)) : null;

  function pickWinner(matchId: string, winnerId: string) {
    setTournaments((prev) => prev.map((x) => (x.id === t!.id ? applyWinner(x, matchId, winnerId) : x)));
    
    // Increment wins for the winner
    if (t!.participationType === "teams") {
      setTeams((prev) => prev.map((tm) => (tm.id === winnerId ? { ...tm, wins: (tm.wins ?? 0) + 1 } : tm)));
    } else {
      setCars((prev) => prev.map((c) => (c.id === winnerId ? { ...c, wins: (c.wins ?? 0) + 1 } : c)));
    }
  }

  function reset() {
    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== t!.id) return x;
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
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <Link to="/tournaments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tournaments
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.name}</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t.format === "single"
              ? "Single elimination"
              : t.format === "double"
                ? "Double elimination"
                : t.format === "round-robin"
                  ? "Round-robin"
                  : t.format === "time-trial"
                    ? "Time trial"
                    : `Championship • ${t.qualifyingType === "round-robin" ? "Round-robin" : "Time trial"} → ${t.qualifyingFormat === "double" ? "Double" : "Single"} elim`}
            {" • "}
            {t.participationType === "teams" ? (t.teamIds?.length || 0) : (t.carIds?.length || 0)} {t.participationType === "teams" ? "teams" : "cars"}
          </p>
        </div>
        {champ ? (
          <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]" style={{ background: "var(--gradient-primary)" }}>
            <Trophy className="h-4 w-4" /> Champion: {champ.name}
          </div>
        ) : null}
      </div>

      {t.format === "round-robin" ? (
        <RoundRobin t={t} cars={cars} teams={teams} onPick={pickWinner} />
      ) : t.format === "time-trial" ? (
        <TimeTrialView
          t={t}
          cars={cars}
          teams={teams}
          onChange={(updater) =>
            setTournaments((prev) => prev.map((x) => (x.id === t!.id ? updater(x) : x)))
          }
        />
      ) : t.format === "championship" ? (
        <ChampionshipView
          t={t}
          cars={cars}
          teams={teams}
          carById={carById}
          teamById={teamById}
          onPick={pickWinner}
          onChange={(updater) =>
            setTournaments((prev) => prev.map((x) => (x.id === t!.id ? updater(x) : x)))
          }
        />
      ) : (
        <Bracket t={t} carById={carById} teamById={teamById} onPick={pickWinner} />
      )}

      <div className="mt-10 flex justify-end">
        {t.format !== "time-trial" && t.format !== "championship" && (
          <Button variant="outline" size="sm" onClick={reset}>Reset results</Button>
        )}
      </div>
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
  t, carById, teamById, onPick,
}: {
  t: Tournament;
  carById: (id?: string | null) => Car | undefined;
  teamById?: (id?: string | null) => Team | undefined;
  onPick: (matchId: string, winnerId: string) => void;
}) {
  const isDouble = t.format === "double";
  const isTeams = t.participationType === "teams";

  if (!isDouble) {
    const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
    return (
      <div className="mt-8 overflow-x-auto">
        <div className="flex gap-6 pb-2">
          {rounds.map((r) => {
            const ms = t.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
            return (
              <div key={r} className="flex min-w-[220px] flex-col justify-around gap-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {r === rounds.length ? "Final" : r === rounds.length - 1 ? "Semifinal" : `Round ${r}`}
                </div>
                {ms.map((m) => (
                  <MatchCell
                    key={m.id}
                    carA={isTeams ? undefined : carById(m.carAId)}
                    carB={isTeams ? undefined : carById(m.carBId)}
                    teamA={isTeams ? teamById?.(m.teamAId) : undefined}
                    teamB={isTeams ? teamById?.(m.teamBId) : undefined}
                    winnerId={m.winnerId}
                    onPick={(id) => onPick(m.id, id)}
                  />
                ))}
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
    <div className="flex min-w-[220px] flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {matches.map((m) => (
        <MatchCell 
          key={m.id} 
          carA={isTeams ? undefined : carById(m.carAId)} 
          carB={isTeams ? undefined : carById(m.carBId)}
          teamA={isTeams ? teamById?.(m.teamAId) : undefined}
          teamB={isTeams ? teamById?.(m.teamBId) : undefined}
          winnerId={m.winnerId} 
          onPick={(id) => onPick(m.id, id)} 
        />
      ))}
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

function RoundRobin({ t, cars, teams, onPick }: { t: Tournament; cars: Car[]; teams: Team[]; onPick: (matchId: string, winnerId: string) => void }) {
  const standings = standingsFor(t, cars);
  const isTeams = t.participationType === "teams";
  const carById = (id?: string | null) => (id ? cars.find((c) => c.id === id) : undefined);
  const teamById = (id?: string | null) => (id ? teams.find((tm) => tm.id === id) : undefined);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Match-ups</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {t.matches.map((m, i) => (
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
          ))}
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