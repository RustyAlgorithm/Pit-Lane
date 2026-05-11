import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Tournament, TrackUnit } from "@/lib/types";
import { Trophy, Timer } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Pit Lane" },
      { name: "description", content: "Fastest times across every track length." },
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

function LeaderboardPage() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [tournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);

  // Group fastest-per-car by track length+unit across all time-trial tournaments
  const groups = useMemo(() => {
    const map = new Map<string, { length: number; unit: TrackUnit; rows: Map<string, BoardRow> }>();
    tournaments.forEach((t) => {
      if (t.format !== "time-trial" || !t.trackLength || !t.trackUnit) return;
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

  const [active, setActive] = useState<string | null>(null);
  const activeKey = active ?? (groups[0] ? `${groups[0].length}-${groups[0].unit}` : null);
  const activeGroup = groups.find((g) => `${g.length}-${g.unit}` === activeKey);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fastest recorded times per car, grouped by track length.
      </p>

      {groups.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-border p-12 text-center">
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
          <div className="mt-6 flex flex-wrap gap-2">
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
            <Card className="mt-6 overflow-hidden p-0 shadow-[var(--shadow-card)]">
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
    </main>
  );
}