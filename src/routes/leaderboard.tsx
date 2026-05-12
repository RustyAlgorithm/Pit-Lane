import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Tournament, TrackUnit, Team } from "@/lib/types";
import { Trophy, Timer, Target, Crown } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Pit Lane" },
      { name: "description", content: "Leaderboards: fastest times, car wins, and team performance." },
    ],
  }),
  component: LeaderboardPage,
});

interface BoardRow {
  car: Car;
  seconds: number;
  tournamentId: string;
  tournamentName: string;
  recordedAt: number;
}

interface CarStatsRow {
  car: Car;
  wins: number;
  losses: number;
  winRate: number;
}

interface TeamStatsRow {
  team: Team;
  wins: number;
  losses: number;
}

function LeaderboardPage() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [tournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [activeTab, setActiveTab] = useState<"times" | "cars" | "teams" | "carChamps" | "teamChamps">("times");

  // Group fastest-per-car by track length+unit across all time-trial tournaments
  const groups = useMemo(() => {
    const map = new Map<string, { length: number; unit: TrackUnit; rows: Map<string, BoardRow> }>();
    tournaments.forEach((t) => {
      const isTimeTrial =
        t.format === "time-trial" ||
        (t.format === "championship" && t.qualifyingType === "time-trial");
      if (!isTimeTrial || !t.trackLength || !t.trackUnit) return;
      const key = `${t.trackLength}-${t.trackUnit}`;
      let g = map.get(key);
      if (!g) {
        g = { length: t.trackLength, unit: t.trackUnit, rows: new Map() };
        map.set(key, g);
      }
      (t.times ?? []).forEach((e) => {
        const car = cars.find((c) => c.id === e.carId);
        if (!car) return;
        const existing = g!.rows.get(e.carId);
        if (!existing || e.seconds < existing.seconds) {
          g!.rows.set(e.carId, {
            car,
            seconds: e.seconds,
            tournamentId: t.id,
            tournamentName: t.name,
            recordedAt: e.recordedAt,
          });
        }
      });
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        rows: [...g.rows.values()].sort((a, b) => a.seconds - b.seconds),
      }))
      .sort((a, b) => a.length - b.length);
  }, [tournaments, cars]);

  // Car wins/losses/win-rate leaderboard
  const carStats = useMemo(() => {
    const stats = cars
      .filter((c) => (c.wins ?? 0) + (c.losses ?? 0) > 0)
      .map((c) => {
        const wins = c.wins ?? 0;
        const losses = c.losses ?? 0;
        const total = wins + losses;
        return {
          car: c,
          wins,
          losses,
          winRate: total > 0 ? (wins / total) * 100 : 0,
        };
      })
      .sort((a, b) => {
        // Sort by wins first, then by win rate
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      });
    return stats;
  }, [cars]);

  // Team wins/losses leaderboard
  const teamStats = useMemo(() => {
    const stats = teams
      .filter((t) => (t.wins ?? 0) + (t.losses ?? 0) > 0)
      .map((t) => ({
        team: t,
        wins: t.wins ?? 0,
        losses: t.losses ?? 0,
      }))
      .sort((a, b) => {
        // Sort by wins first
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.losses - a.losses;
      });
    return stats;
  }, [teams]);

  // Championship wins leaderboard
  const carChampionships = useMemo(() => {
    return cars
      .filter((c) => (c.championshipWins ?? 0) > 0)
      .map((c) => ({ car: c, titles: c.championshipWins ?? 0 }))
      .sort((a, b) => b.titles - a.titles);
  }, [cars]);

  const teamChampionships = useMemo(() => {
    return teams
      .filter((t) => (t.championshipWins ?? 0) > 0)
      .map((t) => ({ team: t, titles: t.championshipWins ?? 0 }))
      .sort((a, b) => b.titles - a.titles);
  }, [teams]);

  const [active, setActive] = useState<string | null>(null);
  const activeKey = active ?? (groups[0] ? `${groups[0].length}-${groups[0].unit}` : null);
  const activeGroup = groups.find((g) => `${g.length}-${g.unit}` === activeKey);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        View fastest times, car performance, and team standings.
      </p>

      {/* Tab buttons */}
      <div className="mt-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("times")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "times"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Time Trial
          </div>
        </button>
        <button
          onClick={() => setActiveTab("cars")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "cars"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Car Wins
          </div>
        </button>
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "teams"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Team Wins
          </div>
        </button>
        <button
          onClick={() => setActiveTab("carChamps")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "carChamps"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Car Championships
          </div>
        </button>
        <button
          onClick={() => setActiveTab("teamChamps")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "teamChamps"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Team Championships
          </div>
        </button>
      </div>

      {/* Time Trial Tab */}
      {activeTab === "times" && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Fastest recorded times per car, grouped by track length.
          </p>
          {groups.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Timer className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No time-trial results yet. Create a{" "}
                <Link to="/tournaments" className="font-medium text-primary hover:underline">
                  Time Trial
                </Link>{" "}
                to start recording.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {groups.map((g) => {
                  const k = `${g.length}-${g.unit}`;
                  const isActive = k === activeKey;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActive(k)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g.length} {g.unit} <span className="ml-1 text-xs opacity-70">({g.rows.length})</span>
                    </button>
                  );
                })}
              </div>

              {activeGroup && (
                <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
                  <div className="grid grid-cols-[40px_1fr_120px_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>#</span>
                    <span>Car</span>
                    <span>Tournament</span>
                    <span className="text-right">Best time</span>
                  </div>
                  {activeGroup.rows.map((r, i) => (
                    <div
                      key={r.car.id}
                      className={`grid grid-cols-[40px_1fr_120px_auto] items-center gap-2 px-4 py-2 text-sm ${
                        i === 0 ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        {i === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                        {i + 1}
                      </span>
                      <span className="flex items-center gap-2 truncate">
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                          {r.car.photo ? (
                            <img src={r.car.photo} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="truncate font-medium">{r.car.name}</span>
                      </span>
                      <Link
                        to="/tournaments/$id"
                        params={{ id: r.tournamentId }}
                        className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {r.tournamentName}
                      </Link>
                      <span className="text-right font-semibold tabular-nums">{r.seconds.toFixed(3)}s</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Car Wins Tab */}
      {activeTab === "cars" && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Car performance ranked by wins, losses, and win rate.
          </p>
          {carStats.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No match results yet. Create a{" "}
                <Link to="/tournaments" className="font-medium text-primary hover:underline">
                  Tournament
                </Link>{" "}
                to start competing.
              </p>
            </div>
          ) : (
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-[40px_1fr_auto_auto_auto_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Car</span>
                <span className="text-right">Wins</span>
                <span className="text-right">Losses</span>
                <span className="text-right">Record</span>
                <span className="text-right">Win Rate</span>
              </div>
              {carStats.map((row, i) => (
                <div
                  key={row.car.id}
                  className={`grid grid-cols-[40px_1fr_auto_auto_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
                    i === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {i === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                      {row.car.photo ? (
                        <img src={row.car.photo} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="truncate font-medium">{row.car.name}</span>
                  </span>
                  <span className="text-right font-semibold text-green-600 tabular-nums">{row.wins}</span>
                  <span className="text-right font-semibold text-red-600 tabular-nums">{row.losses}</span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {row.wins}-{row.losses}
                  </span>
                  <span className="text-right font-semibold tabular-nums">{row.winRate.toFixed(1)}%</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Team Wins Tab */}
      {activeTab === "teams" && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Team performance ranked by wins and losses.
          </p>
          {teamStats.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Target className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No team tournament results yet. Create a{" "}
                <Link to="/tournaments" className="font-medium text-primary hover:underline">
                  Team Tournament
                </Link>{" "}
                to start competing.
              </p>
            </div>
          ) : (
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Team</span>
                <span className="text-right">Wins</span>
                <span className="text-right">Losses</span>
                <span className="text-right">Record</span>
              </div>
              {teamStats.map((row, i) => (
                <div
                  key={row.team.id}
                  className={`grid grid-cols-[40px_1fr_auto_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
                    i === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {i === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-7 w-7 shrink-0 rounded"
                      style={{ backgroundColor: row.team.color }}
                      title={row.team.name}
                    />
                    <span className="truncate font-medium">{row.team.name}</span>
                  </span>
                  <span className="text-right font-semibold text-green-600 tabular-nums">{row.wins}</span>
                  <span className="text-right font-semibold text-red-600 tabular-nums">{row.losses}</span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {row.wins}-{row.losses}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Car Championships Tab */}
      {activeTab === "carChamps" && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Cars ranked by championship titles.
          </p>
          {carChampionships.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No championship titles yet. Create a{" "}
                <Link to="/tournaments" className="font-medium text-primary hover:underline">
                  persistent tournament
                </Link>{" "}
                and crown a champion.
              </p>
            </div>
          ) : (
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-[40px_1fr_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Car</span>
                <span className="text-right">Titles</span>
              </div>
              {carChampionships.map((row, i) => (
                <div
                  key={row.car.id}
                  className={`grid grid-cols-[40px_1fr_auto] items-center gap-2 px-4 py-2 text-sm ${
                    i === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {i === 0 && <Crown className="h-3.5 w-3.5 text-primary" />}
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                      {row.car.photo ? (
                        <img src={row.car.photo} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="truncate font-medium">{row.car.name}</span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">{row.titles}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Team Championships Tab */}
      {activeTab === "teamChamps" && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Teams ranked by championship titles.
          </p>
          {teamChampionships.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                No championship titles yet. Create a{" "}
                <Link to="/tournaments" className="font-medium text-primary hover:underline">
                  persistent team tournament
                </Link>{" "}
                and crown a champion.
              </p>
            </div>
          ) : (
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-[40px_1fr_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Team</span>
                <span className="text-right">Titles</span>
              </div>
              {teamChampionships.map((row, i) => (
                <div
                  key={row.team.id}
                  className={`grid grid-cols-[40px_1fr_auto] items-center gap-2 px-4 py-2 text-sm ${
                    i === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {i === 0 && <Crown className="h-3.5 w-3.5 text-primary" />}
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-7 w-7 shrink-0 rounded"
                      style={{ backgroundColor: row.team.color }}
                      title={row.team.name}
                    />
                    <span className="truncate font-medium">{row.team.name}</span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">{row.titles}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </main>
  );
}