import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Tournament } from "@/lib/types";
import { applyWinner, standingsFor } from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Car as CarIcon } from "lucide-react";

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
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const t = tournaments.find((x) => x.id === id);

  if (!t) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Tournament not found</h1>
        <Button asChild className="mt-4"><Link to="/tournaments">Back to tournaments</Link></Button>
      </main>
    );
  }

  const carById = (cid?: string | null) => (cid ? cars.find((c) => c.id === cid) : undefined);
  const champ = t.champion ? carById(t.champion) : null;

  function pickWinner(matchId: string, winnerId: string) {
    setTournaments((prev) => prev.map((x) => (x.id === t!.id ? applyWinner(x, matchId, winnerId) : x)));
  }

  function reset() {
    setTournaments((prev) =>
      prev.map((x) => {
        if (x.id !== t!.id) return x;
        const matches = x.matches.map((m) => {
          if (x.format === "round-robin") return { ...m, winnerId: null };
          // elimination: keep only round-1 winners-bracket pairings
          const isRound1Winners = m.round === 1 && (m.bracket === undefined || m.bracket === "winners");
          return {
            ...m,
            winnerId: null,
            carAId: isRound1Winners ? m.carAId : null,
            carBId: isRound1Winners ? m.carBId : null,
          };
        });
        return { ...x, champion: null, matches };
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
            {t.format === "single" ? "Single elimination" : t.format === "double" ? "Double elimination" : "Round-robin"} • {t.carIds.length} cars
          </p>
        </div>
        {champ ? (
          <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]" style={{ background: "var(--gradient-primary)" }}>
            <Trophy className="h-4 w-4" /> Champion: {champ.name}
          </div>
        ) : null}
      </div>

      {t.format === "round-robin" ? (
        <RoundRobin t={t} cars={cars} onPick={pickWinner} />
      ) : (
        <Bracket t={t} carById={carById} onPick={pickWinner} />
      )}

      <div className="mt-10 flex justify-end">
        <Button variant="outline" size="sm" onClick={reset}>Reset results</Button>
      </div>
    </main>
  );
}

function MatchCell({
  carA, carB, winnerId, onPick, label,
}: {
  carA?: Car; carB?: Car;
  winnerId?: string | null;
  onPick: (id: string) => void;
  label?: string;
}) {
  const Slot = ({ car, isWinner }: { car?: Car; isWinner: boolean }) => (
    <button
      type="button"
      disabled={!car || !carA || !carB || !!winnerId}
      onClick={() => car && onPick(car.id)}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        isWinner ? "bg-primary/10 font-semibold text-primary" : "hover:bg-secondary"
      } ${!car ? "text-muted-foreground" : ""} disabled:cursor-default`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-secondary">
        {car?.photo ? <img src={car.photo} alt="" className="h-full w-full object-cover" /> : <CarIcon className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
      <span className="flex-1 truncate">{car?.name ?? "TBD"}</span>
      {isWinner && <Trophy className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
      {label && <div className="border-b border-border bg-secondary/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>}
      <Slot car={carA} isWinner={winnerId === carA?.id} />
      <div className="border-t border-border" />
      <Slot car={carB} isWinner={winnerId === carB?.id} />
    </Card>
  );
}

function Bracket({
  t, carById, onPick,
}: {
  t: Tournament;
  carById: (id?: string | null) => Car | undefined;
  onPick: (matchId: string, winnerId: string) => void;
}) {
  const isDouble = t.format === "double";

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
                    carA={carById(m.carAId)}
                    carB={carById(m.carBId)}
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
        <MatchCell key={m.id} carA={carById(m.carAId)} carB={carById(m.carBId)} winnerId={m.winnerId} onPick={(id) => onPick(m.id, id)} />
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

function RoundRobin({ t, cars, onPick }: { t: Tournament; cars: Car[]; onPick: (matchId: string, winnerId: string) => void }) {
  const standings = standingsFor(t, cars);
  const carById = (id?: string | null) => (id ? cars.find((c) => c.id === id) : undefined);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Match-ups</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {t.matches.map((m, i) => (
            <MatchCell
              key={m.id}
              label={`Match ${i + 1}`}
              carA={carById(m.carAId)}
              carB={carById(m.carBId)}
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
            <span>Car</span><span className="text-right">W</span><span className="text-right">L</span>
          </div>
          {standings.map((s, i) => (
            <div key={s.car.id} className={`grid grid-cols-[1fr_40px_40px] items-center gap-2 px-3 py-2 text-sm ${i === 0 && s.w > 0 ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2 truncate">
                <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate font-medium">{s.car.name}</span>
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