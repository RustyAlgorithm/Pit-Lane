import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Car, Tournament, BracketFormat } from "@/lib/types";
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
};

function TournamentsPage() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [tournaments, setTournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<BracketFormat>("single");
  const [picked, setPicked] = useState<string[]>([]);
  const navigate = useNavigate();

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function create() {
    if (!name.trim()) return toast.error("Tournament name required");
    if (picked.length < 2) return toast.error("Pick at least 2 cars");
    const t: Tournament = {
      id: uid(),
      name: name.trim().slice(0, 60),
      format,
      carIds: picked,
      matches: buildMatches(format, picked),
      createdAt: Date.now(),
      champion: null,
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
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <Label>Roster ({picked.length} selected)</Label>
                  {cars.length > 0 && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked(picked.length === cars.length ? [] : cars.map((c) => c.id))}>
                      {picked.length === cars.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
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
            const champ = t.champion ? cars.find((c) => c.id === t.champion) : null;
            return (
              <Card key={t.id} className="group flex flex-col p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
                <Link to="/tournaments/$id" params={{ id: t.id }} className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{t.name}</h3>
                    {champ && <Trophy className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{FORMAT_LABEL[t.format]}</div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.carIds.length} cars</span>
                    {champ ? (
                      <span className="font-semibold text-primary">{champ.name}</span>
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