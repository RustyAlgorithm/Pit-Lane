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

interface CarChampionshipRow {
  participantType: "car";
  car: Car;
  titles: number;
  latestWonAt: number;
}

interface TeamChampionshipRow {
  participantType: "team";
  team: Team;
  titles: number;
  latestWonAt: number;
}

interface ChampionshipHistoryWinner {
  seasonLabel: string;
  participantId: string;
  participantName: string;
  participantType: "car" | "team";
  participantPhoto?: string;
  participantColor?: string;
  dateEnded?: number;
  isCurrent: boolean;
}

interface ChampionshipHistoryGroup {
  tournamentId: string;
  tournamentName: string;
  participationType: "cars" | "teams";
  latestAt: number;
  winners: ChampionshipHistoryWinner[];
}

function formatWinnerDate(timestamp?: number) {
  if (!timestamp) return "Current";
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildChampionshipHistory(
  cars: Car[],
  teams: Team[],
  tournaments: Tournament[],
) {
  const carById = new Map(cars.map((car) => [car.id, car]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const carStats = new Map<string, { titles: number; latestWonAt: number }>();
  const teamStats = new Map<string, { titles: number; latestWonAt: number }>();
  const carHistoryGroups: ChampionshipHistoryGroup[] = [];
  const teamHistoryGroups: ChampionshipHistoryGroup[] = [];
  const now = Date.now();

  const bumpLatest = (
    stats: Map<string, { titles: number; latestWonAt: number }>,
    participantId: string,
    latestWonAt: number,
    countTitle: boolean,
  ) => {
    const current = stats.get(participantId) ?? { titles: 0, latestWonAt: 0 };
    stats.set(participantId, {
      titles: current.titles + (countTitle ? 1 : 0),
      latestWonAt: Math.max(current.latestWonAt, latestWonAt),
    });
  };

  tournaments
    .filter((tournament) => tournament.persistent)
    .forEach((tournament) => {
      const winners: ChampionshipHistoryWinner[] = [];

      if (tournament.champion && tournament.championType) {
        if (tournament.championType === "team") {
          const team = teamById.get(tournament.champion);
          if (team) {
            winners.push({
              seasonLabel: `Season ${(tournament.previousSeasons?.length ?? 0) + 1}`,
              participantId: team.id,
              participantName: team.name,
              participantType: "team",
              participantColor: team.color,
              isCurrent: true,
            });
            bumpLatest(teamStats, team.id, now, false);
          }
        } else {
          const car = carById.get(tournament.champion);
          if (car) {
            winners.push({
              seasonLabel: `Season ${(tournament.previousSeasons?.length ?? 0) + 1}`,
              participantId: car.id,
              participantName: car.name,
              participantType: "car",
              participantPhoto: car.photo,
              participantColor: teams.find((team) => team.carIds.includes(car.id))?.color,
              isCurrent: true,
            });
            bumpLatest(carStats, car.id, now, false);
          }
        }
      }

      [...(tournament.previousSeasons ?? [])]
        .sort((a, b) => b.season - a.season || b.dateEnded - a.dateEnded)
        .forEach((season) => {
          if (season.championType === "team") {
            const team = teamById.get(season.champion);
            if (!team) return;
            winners.push({
              seasonLabel: `Season ${season.season}`,
              participantId: team.id,
              participantName: team.name,
              participantType: "team",
              participantColor: team.color,
              dateEnded: season.dateEnded,
              isCurrent: false,
            });
            bumpLatest(teamStats, team.id, season.dateEnded, true);
          } else {
            const car = carById.get(season.champion);
            if (!car) return;
            winners.push({
              seasonLabel: `Season ${season.season}`,
              participantId: car.id,
              participantName: car.name,
              participantType: "car",
              participantPhoto: car.photo,
              participantColor: teams.find((team) => team.carIds.includes(car.id))?.color,
              dateEnded: season.dateEnded,
              isCurrent: false,
            });
            bumpLatest(carStats, car.id, season.dateEnded, true);
          }
        });

      if (winners.length === 0) return;

      const latestAt =
        winners.find((winner) => winner.isCurrent)?.dateEnded ??
        (winners.some((winner) => winner.isCurrent)
          ? now
          : Math.max(...winners.map((winner) => winner.dateEnded ?? 0)));

      const group: ChampionshipHistoryGroup = {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        participationType: tournament.participationType,
        latestAt,
        winners,
      };

      if (tournament.participationType === "teams") teamHistoryGroups.push(group);
      else carHistoryGroups.push(group);
    });

  const carChampionships: CarChampionshipRow[] = cars
    .map((car) => {
      const stats = carStats.get(car.id);
      return {
        participantType: "car" as const,
        car,
        titles: Math.max(car.championshipWins ?? 0, stats?.titles ?? 0),
        latestWonAt: stats?.latestWonAt ?? 0,
      };
    })
    .filter((row) => row.titles > 0)
    .sort((a, b) => {
      if (a.titles !== b.titles) return b.titles - a.titles;
      if (a.latestWonAt !== b.latestWonAt) return b.latestWonAt - a.latestWonAt;
      return a.car.name.localeCompare(b.car.name);
    });

  const teamChampionships: TeamChampionshipRow[] = teams
    .map((team) => {
      const stats = teamStats.get(team.id);
      return {
        participantType: "team" as const,
        team,
        titles: Math.max(team.championshipWins ?? 0, stats?.titles ?? 0),
        latestWonAt: stats?.latestWonAt ?? 0,
      };
    })
    .filter((row) => row.titles > 0)
    .sort((a, b) => {
      if (a.titles !== b.titles) return b.titles - a.titles;
      if (a.latestWonAt !== b.latestWonAt) return b.latestWonAt - a.latestWonAt;
      return a.team.name.localeCompare(b.team.name);
    });

  carHistoryGroups.sort((a, b) => b.latestAt - a.latestAt || a.tournamentName.localeCompare(b.tournamentName));
  teamHistoryGroups.sort((a, b) => b.latestAt - a.latestAt || a.tournamentName.localeCompare(b.tournamentName));

  return { carChampionships, teamChampionships, carHistoryGroups, teamHistoryGroups };
}

function LeaderboardPage() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [tournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [activeTab, setActiveTab] = useState<"times" | "cars" | "teams" | "carChamps" | "teamChamps">("times");
  const [activeTimeGroup, setActiveTimeGroup] = useState<string | null>(null);
  const [activeCarHistory, setActiveCarHistory] = useState<string | null>(null);
  const [activeTeamHistory, setActiveTeamHistory] = useState<string | null>(null);

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
        const existing = g.rows.get(e.carId);
        if (!existing || e.seconds < existing.seconds) {
          g.rows.set(e.carId, {
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

  const carStats = useMemo(() => {
    return cars
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
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      });
  }, [cars]);

  const teamStats = useMemo(() => {
    return teams
      .filter((t) => (t.wins ?? 0) + (t.losses ?? 0) > 0)
      .map((t) => ({
        team: t,
        wins: t.wins ?? 0,
        losses: t.losses ?? 0,
      }))
      .sort((a, b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.losses - a.losses;
      });
  }, [teams]);

  const { carChampionships, teamChampionships, carHistoryGroups, teamHistoryGroups } = useMemo(
    () => buildChampionshipHistory(cars, teams, tournaments),
    [cars, teams, tournaments],
  );

  const activeTimeKey = activeTimeGroup ?? (groups[0] ? `${groups[0].length}-${groups[0].unit}` : null);
  const activeGroup = groups.find((g) => `${g.length}-${g.unit}` === activeTimeKey);
  const activeCarHistoryKey = activeCarHistory ?? carHistoryGroups[0]?.tournamentId ?? null;
  const activeTeamHistoryKey = activeTeamHistory ?? teamHistoryGroups[0]?.tournamentId ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        View fastest times, car performance, and team standings.
      </p>

      <div className="mt-6 flex gap-2 border-b border-border">
        <TabButton active={activeTab === "times"} onClick={() => setActiveTab("times")} icon={<Timer className="h-4 w-4" />}>
          Time Trial
        </TabButton>
        <TabButton active={activeTab === "cars"} onClick={() => setActiveTab("cars")} icon={<Trophy className="h-4 w-4" />}>
          Car Wins
        </TabButton>
        <TabButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")} icon={<Target className="h-4 w-4" />}>
          Team Wins
        </TabButton>
        <TabButton active={activeTab === "carChamps"} onClick={() => setActiveTab("carChamps")} icon={<Crown className="h-4 w-4" />}>
          Car Championships
        </TabButton>
        <TabButton active={activeTab === "teamChamps"} onClick={() => setActiveTab("teamChamps")} icon={<Crown className="h-4 w-4" />}>
          Team Championships
        </TabButton>
      </div>

      {activeTab === "times" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Fastest recorded times per car, grouped by track length.
          </p>
          {groups.length === 0 ? (
            <EmptyState
              icon={<Timer className="mx-auto h-10 w-10 text-muted-foreground" />}
              message={
                <>
                  No time-trial results yet. Create a{" "}
                  <Link to="/tournaments" className="font-medium text-primary hover:underline">
                    Time Trial
                  </Link>{" "}
                  to start recording.
                </>
              }
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {groups.map((g) => {
                  const key = `${g.length}-${g.unit}`;
                  const isActive = key === activeTimeKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTimeGroup(key)}
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
                  {activeGroup.rows.map((row, index) => (
                    <div
                      key={row.car.id}
                      className={`grid grid-cols-[40px_1fr_120px_auto] items-center gap-2 px-4 py-2 text-sm ${
                        index === 0 ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        {index === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                        {index + 1}
                      </span>
                      <span className="flex items-center gap-2 truncate">
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                          {row.car.photo ? (
                            <img src={row.car.photo} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="truncate font-medium">{row.car.name}</span>
                      </span>
                      <Link
                        to="/tournaments/$id"
                        params={{ id: row.tournamentId }}
                        className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.tournamentName}
                      </Link>
                      <span className="text-right font-semibold tabular-nums">{row.seconds.toFixed(3)}s</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "cars" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Car performance ranked by wins, losses, and win rate.
          </p>
          {carStats.length === 0 ? (
            <EmptyState
              icon={<Trophy className="mx-auto h-10 w-10 text-muted-foreground" />}
              message={
                <>
                  No match results yet. Create a{" "}
                  <Link to="/tournaments" className="font-medium text-primary hover:underline">
                    Tournament
                  </Link>{" "}
                  to start competing.
                </>
              }
            />
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
              {carStats.map((row, index) => (
                <div
                  key={row.car.id}
                  className={`grid grid-cols-[40px_1fr_auto_auto_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
                    index === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {index === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                    {index + 1}
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

      {activeTab === "teams" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Team performance ranked by wins and losses.
          </p>
          {teamStats.length === 0 ? (
            <EmptyState
              icon={<Target className="mx-auto h-10 w-10 text-muted-foreground" />}
              message={
                <>
                  No team tournament results yet. Create a{" "}
                  <Link to="/tournaments" className="font-medium text-primary hover:underline">
                    Team Tournament
                  </Link>{" "}
                  to start competing.
                </>
              }
            />
          ) : (
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>#</span>
                <span>Team</span>
                <span className="text-right">Wins</span>
                <span className="text-right">Losses</span>
                <span className="text-right">Record</span>
              </div>
              {teamStats.map((row, index) => (
                <div
                  key={row.team.id}
                  className={`grid grid-cols-[40px_1fr_auto_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
                    index === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {index === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                    {index + 1}
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

      {activeTab === "carChamps" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Cars ranked by championship titles. Ties are broken by the most recent championship win.
          </p>
          {carChampionships.length === 0 ? (
            <EmptyState
              icon={<Crown className="mx-auto h-10 w-10 text-muted-foreground" />}
              message={
                <>
                  No championship titles yet. Create a{" "}
                  <Link to="/tournaments" className="font-medium text-primary hover:underline">
                    persistent tournament
                  </Link>{" "}
                  and crown a champion.
                </>
              }
            />
          ) : (
            <ChampionshipStandingsTable rows={carChampionships} />
          )}
          <ChampionshipHistorySection
            title="History By Championship"
            description="Pick a persistent championship to review its current and previous winners."
            groups={carHistoryGroups}
            activeKey={activeCarHistoryKey}
            onSelect={setActiveCarHistory}
          />
        </div>
      )}

      {activeTab === "teamChamps" && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Teams ranked by championship titles. Ties are broken by the most recent championship win.
          </p>
          {teamChampionships.length === 0 ? (
            <EmptyState
              icon={<Crown className="mx-auto h-10 w-10 text-muted-foreground" />}
              message={
                <>
                  No championship titles yet. Create a{" "}
                  <Link to="/tournaments" className="font-medium text-primary hover:underline">
                    persistent team tournament
                  </Link>{" "}
                  and crown a champion.
                </>
              }
            />
          ) : (
            <ChampionshipStandingsTable rows={teamChampionships} />
          )}
          <ChampionshipHistorySection
            title="History By Championship"
            description="Pick a persistent championship to review its current and previous winners."
            groups={teamHistoryGroups}
            activeKey={activeTeamHistoryKey}
            onSelect={setActiveTeamHistory}
          />
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        {children}
      </div>
    </button>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
      {icon}
      <p className="mt-3 text-muted-foreground">{message}</p>
    </div>
  );
}

function ChampionshipStandingsTable({
  rows,
}: {
  rows: Array<CarChampionshipRow | TeamChampionshipRow>;
}) {
  const isTeams = rows[0]?.participantType === "team";

  return (
    <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[40px_1fr_auto_auto] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>{isTeams ? "Team" : "Car"}</span>
        <span className="text-right">Titles</span>
        <span className="text-right">Latest win</span>
      </div>
      {rows.map((row, index) => (
        <div
          key={row.participantType === "team" ? row.team.id : row.car.id}
          className={`grid grid-cols-[40px_1fr_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
            index === 0 ? "bg-primary/5" : ""
          }`}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            {index === 0 && <Crown className="h-3.5 w-3.5 text-primary" />}
            {index + 1}
          </span>
          {row.participantType === "team" ? (
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-7 w-7 shrink-0 rounded"
                style={{ backgroundColor: row.team.color }}
                title={row.team.name}
              />
              <span className="truncate font-medium">{row.team.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 truncate">
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                {row.car.photo ? (
                  <img src={row.car.photo} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="truncate font-medium">{row.car.name}</span>
            </span>
          )}
          <span className="text-right font-semibold tabular-nums">{row.titles}</span>
          <span className="text-right text-xs text-muted-foreground tabular-nums">
            {row.latestWonAt ? formatWinnerDate(row.latestWonAt) : "—"}
          </span>
        </div>
      ))}
    </Card>
  );
}

function ChampionshipHistorySection({
  title,
  description,
  groups,
  activeKey,
  onSelect,
}: {
  title: string;
  description: string;
  groups: ChampionshipHistoryGroup[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (groups.length === 0) return null;

  const activeGroup = groups.find((group) => group.tournamentId === activeKey) ?? groups[0];

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {groups.map((group) => {
          const isActive = group.tournamentId === activeGroup.tournamentId;
          return (
            <button
              key={group.tournamentId}
              type="button"
              onClick={() => onSelect(group.tournamentId)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {group.tournamentName} <span className="ml-1 text-xs opacity-70">({group.winners.length})</span>
            </button>
          );
        })}
      </div>

      <Card className="mt-4 overflow-hidden p-0 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[120px_1fr_110px] gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Season</span>
          <span>Winner</span>
          <span className="text-right">Finished</span>
        </div>
        {activeGroup.winners.map((winner) => (
          <div
            key={`${activeGroup.tournamentId}-${winner.participantId}-${winner.seasonLabel}-${winner.isCurrent ? "current" : winner.dateEnded ?? "historic"}`}
            className={`grid grid-cols-[120px_1fr_110px] items-center gap-2 px-4 py-2 text-sm ${
              winner.isCurrent ? "bg-primary/5" : ""
            }`}
          >
            <div className="flex flex-col">
              <span className="font-medium">{winner.seasonLabel}</span>
              <span className="text-xs text-muted-foreground">
                {winner.isCurrent ? "Current champion" : "Archived winner"}
              </span>
            </div>
            <span className="flex items-center gap-2 truncate">
              {winner.participantType === "team" ? (
                <span
                  className="h-7 w-7 shrink-0 rounded"
                  style={{ backgroundColor: winner.participantColor }}
                  title={winner.participantName}
                />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
                  {winner.participantPhoto ? (
                    <img src={winner.participantPhoto} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
              )}
              <span className="truncate font-medium">{winner.participantName}</span>
            </span>
            <span className="text-right text-xs text-muted-foreground">
              {formatWinnerDate(winner.dateEnded)}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}
