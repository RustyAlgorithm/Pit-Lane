import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Team } from "@/lib/types";
import { Check, Plus, Users } from "lucide-react";

const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

export function TeamPicker({ carId }: { carId: string }) {
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const memberOf = teams.filter((t) => t.carIds.includes(carId));

  function toggle(teamId: string) {
    setTeams((prev) =>
      prev.map((t) =>
        t.id !== teamId
          ? t
          : { ...t, carIds: t.carIds.includes(carId) ? t.carIds.filter((x) => x !== carId) : [...t.carIds, carId] },
      ),
    );
  }

  function createTeam() {
    const name = newName.trim().slice(0, 40);
    if (!name) return;
    const team: Team = { id: uid(), name, color: newColor, carIds: [carId], createdAt: Date.now() };
    setTeams((prev) => [team, ...prev]);
    setNewName("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 w-full justify-start gap-1 py-1.5 flex-wrap">
          <Users className="h-4 w-4 shrink-0" />
          {memberOf.length === 0 ? (
            <span className="text-muted-foreground">Add to teams…</span>
          ) : (
            memberOf.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${t.color}22`, color: t.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                {t.name}
              </span>
            ))
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="max-h-56 overflow-y-auto">
          {teams.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">No teams yet</div>
          ) : (
            teams.map((t) => {
              const active = t.carIds.includes(carId);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>
        <div className="mt-2 border-t pt-2">
          <div className="mb-2 flex items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded-full ring-offset-1 ring-offset-background ${newColor === c ? "ring-2 ring-foreground" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team name" maxLength={40} className="h-8" />
            <Button type="button" size="sm" onClick={createTeam} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
