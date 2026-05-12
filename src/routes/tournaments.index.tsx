import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Car, Team, Tournament, BracketFormat } from "@/lib/types";
import { buildMatches } from "@/lib/bracket";
import { Plus, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CarCard } from "@/components/CarCard";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Tournaments — Pit Lane" },
      { name: "description", content: "Create brackets and crown a champion." },
    ],
  }),
  component: TournamentsPage,
});

const FORMAT_LABEL: Record<BracketFormat, string> = {
  single: "Single elimination",
  double: "Double elimination",
  "round-robin": "Round-robin",
  "time-trial": "Time trial",
};

function TournamentsPage() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [teams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [tournaments, setTournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [open, setOpen] = useState(false);
  const [participationType, setParticipationType] = useState<"cars" | "teams">("cars");
  const [name, setName] = useState("");
  const [format, setFormat] = useState<BracketFormat>("single");
  const [picked, setPicked] = useState<string[]>([]);
  const [trackLength, setTrackLength] = useState<string>("200");
  const [trackUnit, setTrackUnit] = useState<"cm" | "m" | "ft">("cm");
  const navigate = useNavigate();

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function create() {
    if (!name.trim()) return toast.error("Tournament name required");
    let minParticipants = 2;
    if (format === "time-trial") minParticipants = 1;
    if (format === "double") minParticipants = 3;
    if (format === "round-robin") minParticipants = 3;
    if (picked.length < minParticipants) {
      if (format === "time-trial") {
        return toast.error(`Pick at least 1 ${participationType === "cars" ? "car" : "team"}`);
      } else if (format === "double") {
        return toast.error(`Pick at least 3 ${participationType === "cars" ? "cars" : "teams"} for double elimination`);
      } else if (format === "round-robin") {
        return toast.error(`Pick at least 3 ${participationType === "cars" ? "cars" : "teams"} for round-robin`);
      } else {
        return toast.error(`Pick at least 2 ${participationType === "cars" ? "cars" : "teams"}`);
      }
    }
    let trackLengthNum: number | undefined;
    if (format === "time-trial") {
      trackLengthNum = Number(trackLength);
      if (!Number.isFinite(trackLengthNum) || trackLengthNum <= 0)
        return toast.error("Enter a valid track length");
    }
    const t: Tournament = {
      id: uid(),
      name: name.trim().slice(0, 60),
      format,
      participationType,
      ...(participationType === "cars" ? { carIds: picked } : { teamIds: picked }),
      matches: buildMatches(format, picked, participationType),
      createdAt: Date.now(),
      champion: null,
      ...(format === "time-trial"
        ? { trackLength: trackLengthNum, trackUnit, times: [] }
        : {}),
    };
    setTournaments((prev) => [t, ...prev]);
    setOpen(false);
    setName("");
    setPicked([]);
    setFormat("single");
    toast.success("Tournament created");
    navigate({ to: "/tournaments/$id", params: { id: t.id } });
  }

  function remove(id: string) {
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bracket history & in-progress events</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-[var(--shadow-elegant)]">
              <Plus className="mr-1 h-4 w-4" /> New tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create tournament</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tname">Name</Label>
                  <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Showdown" maxLength={60} />
                </div>
                <div>
                  <Label htmlFor="format">Format</Label>
                  <select
                    id="format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as BracketFormat)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="single">Single elimination</option>
                    <option value="double">Double elimination</option>
                    <option value="round-robin">Round-robin</option>
                    <option value="time-trial">Time trial</option>
                  </select>
                </div>
              </div>

              {format === "time-trial" && (
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <Label htmlFor="tlen">Track length</Label>
                    <Input
                      id="tlen"
                      type="number"
                      min={1}
                      step="any"
                      value={trackLength}
                      onChange={(e) => setTrackLength(e.target.value)}
                      placeholder="200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tunit">Unit</Label>
                    <select
                      id="tunit"
                      value={trackUnit}
                      onChange={(e) => setTrackUnit(e.target.value as "cm" | "m" | "ft")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="ft">ft</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="ptype">Participants</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={participationType === "cars" ? "default" : "outline"}
                    onClick={() => {
                      setParticipationType("cars");
                      setPicked([]);
                    }}
                    className="flex-1"
                  >
                    Cars
                  </Button>
                  <Button
                    type="button"
                    variant={participationType === "teams" ? "default" : "outline"}
                    onClick={() => {
                      setParticipationType("teams");
                      setPicked([]);
                    }}
                    className="flex-1"
                  >
                    Teams
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <Label>Roster ({picked.length} selected)</Label>
                  {((participationType === "cars" && cars.length > 0) || (participationType === "teams" && teams.length > 0)) && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => {
                      const totalItems = participationType === "cars" ? cars.length : teams.length;
                      const itemIds = participationType === "cars" ? cars.map((c) => c.id) : teams.map((t) => t.id);
                      setPicked(picked.length === totalItems ? [] : itemIds);
                    }}>
                      {picked.length === (participationType === "cars" ? cars.length : teams.length) ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                {participationType === "cars" ? (
                  <>
                    {cars.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        Add cars in the <Link to="/garage" className="font-medium text-primary hover:underline">Garage</Link> first.
                      </div>
                    ) : (
                      <div className="grid max-h-[40vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                        {cars.map((c) => (
                          <CarCard key={c.id} car={c} onClick={() => toggle(c.id)} selected={picked.includes(c.id)} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {teams.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        Create teams in <Link to="/teams" className="font-medium text-primary hover:underline">Teams</Link> first.
                      </div>
                    ) : (
                      <div className="grid max-h-[40vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                        {teams.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggle(t.id)}
                            className={`rounded-lg border-2 p-4 text-left transition-all ${
                              picked.includes(t.id)
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                              <div className="font-semibold text-sm">{t.name}</div>
                            </div>
                            {t.sponsor && <div className="text-xs text-muted-foreground">{t.sponsor}</div>}
                            <div className="text-xs text-muted-foreground mt-2">{t.carIds.length} cars</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create}>Create & seed bracket</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tournaments.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No tournaments yet. Create one to seed your first bracket.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => {
            const participantCount = t.participationType === "cars" ? (t.carIds?.length || 0) : (t.teamIds?.length || 0);
            const champName = t.champion 
              ? (t.championType === "team" 
                ? teams.find((tm) => tm.id === t.champion)?.name 
                : cars.find((c) => c.id === t.champion)?.name)
              : null;
            return (
              <Card key={t.id} className="group flex flex-col p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
                <Link to="/tournaments/$id" params={{ id: t.id }} className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{t.name}</h3>
                    {champName && <Trophy className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{FORMAT_LABEL[t.format]}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{t.participationType === "teams" ? "Teams" : "Cars"}</div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{participantCount} {t.participationType === "teams" ? "teams" : "cars"}</span>
                    {champName ? (
                      <span className="font-semibold text-primary">{champName}</span>
                    ) : (
                      <span className="text-muted-foreground">In progress</span>
                    )}
                  </div>
                </Link>
                <div className="mt-3 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}