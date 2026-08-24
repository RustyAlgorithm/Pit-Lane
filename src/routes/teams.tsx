import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Team, Car, NarrativeRole } from "@/lib/types";
import { CarCard } from "@/components/CarCard";
import { Plus, Trash2, Pencil, Users, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/narrative";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Pit Lane" },
      { name: "description", content: "Group cars into teams." },
    ],
  }),
  component: TeamsPage,
});

const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

const TEAM_NAMES = ["Velocity", "Thunder", "Phoenix", "Vortex", "Apex", "Inferno", "Nexus", "Catalyst", "Prism", "Blaze", "Storm", "Quantum", "Sonic", "Turbo", "Nitro", "Fusion", "Titan", "Crown", "Elite", "Razor"];
const SPONSOR_NAMES = ["Red Bull", "Monster", "Motul", "Shell", "Pirelli", "Michelin", "Bridgestone", "Continental", "Dunlop", "Goodyear", "Castrol", "Mobil", "Esso", "Total", "BP", "Pertamina", "Pennzoil", "Valvoline"];

function getRandomTeamName(): string {
  return TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
}

function getRandomSponsorName(): string {
  return SPONSOR_NAMES[Math.floor(Math.random() * SPONSOR_NAMES.length)];
}

// Extract dominant color from an image
async function extractDominantColor(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Could not get canvas context");
        ctx.drawImage(img, 0, 0, 1, 1);
        const imageData = ctx.getImageData(0, 0, 1, 1);
        const [r, g, b] = imageData.data;
        const hex = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
        resolve(hex);
      };
      img.onerror = () => reject("Could not load image");
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject("Could not read file");
    reader.readAsDataURL(file);
  });
}

function TeamsPage() {
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | undefined>();
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [role, setRole] = useState<NarrativeRole>("neutral");
  const [story, setStory] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [picked, setPicked] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  function openNew() {
    setEditing(undefined);
    setName("");
    setSponsor("");
    setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setPicked([]);
    setOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoadingImage(true);
    try {
      const dominantColor = await extractDominantColor(file);
      setColor(dominantColor);
    } catch (err) {
      console.error("Failed to extract color from image:", err);
    } finally {
      setIsLoadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  function openEdit(t: Team) {
    setEditing(t);
    setName(t.name);
    setSponsor(t.sponsor || "");
    setRole(t.role ?? "neutral");
    setStory(t.story ?? "");
    setColor(t.color);
    setPicked(t.carIds);
    setOpen(true);
  }
  function save() {
    if (!name.trim()) return toast.error("Team name required");
    if (editing) {
      setTeams((prev) => prev.map((t) => (t.id === editing.id ? { ...t, name: name.trim().slice(0, 40), color, sponsor: sponsor.trim() || undefined, role, story: story.trim().slice(0, 200) || undefined, carIds: picked } : t)));
      toast.success("Team updated");
    } else {
      const t: Team = { id: uid(), name: name.trim().slice(0, 40), color, sponsor: sponsor.trim() || undefined, role, story: story.trim().slice(0, 200) || undefined, carIds: picked, createdAt: Date.now() };
      setTeams((prev) => [t, ...prev]);
      toast.success("Team created");
    }
    setOpen(false);
  }
  function remove(id: string) {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }
  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">{teams.length} team{teams.length === 1 ? "" : "s"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="w-full shadow-[var(--shadow-elegant)] sm:w-auto">
              <Plus className="mr-1 h-4 w-4" /> New team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit team" : "Create team"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5">
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="tname">Team name</Label>
                  <div className="flex gap-2">
                    <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Red Riders" maxLength={40} />
                    <Button type="button" variant="outline" onClick={() => setName(getRandomTeamName())}>
                      Randomize
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sponsor">Sponsor (optional)</Label>
                  <div className="flex gap-2">
                    <Input id="sponsor" value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Monster Energy" maxLength={40} />
                    <Button type="button" variant="outline" onClick={() => setSponsor(getRandomSponsorName())}>
                      Randomize
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Story role</Label>
                  <div className="flex gap-2">
                    {(["hero", "neutral", "villain"] as NarrativeRole[]).map((r) => (
                      <Button
                        key={r}
                        type="button"
                        size="sm"
                        variant={role === r ? "default" : "outline"}
                        onClick={() => setRole(r)}
                      >
                        {ROLE_LABEL[r]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="team-story">Backstory (optional)</Label>
                  <Input id="team-story" value={story} onChange={(e) => setStory(e.target.value)} maxLength={200} placeholder="Built in a garage out of spare parts..." />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div></div>
                <div>
                  <Label className="mb-2 block">Color</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 mb-2">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background ${color === c ? "ring-2 ring-foreground" : ""}`}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-8 w-12 rounded cursor-pointer border"
                          aria-label="Pick a custom color"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{color}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isLoadingImage}
                        aria-label="Upload image to extract color"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isLoadingImage}
                        className="w-full h-8"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {isLoadingImage ? "Loading..." : "From image"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <Label>Members ({picked.length})</Label>
                  {cars.length > 0 && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked(picked.length === cars.length ? [] : cars.map((c) => c.id))}>
                      {picked.length === cars.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                {cars.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No cars in your garage yet.
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
                <Button onClick={save}>{editing ? "Save" : "Create team"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No teams yet. Group your cars into rival squads.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const members = cars.filter((c) => t.carIds.includes(c.id));
            return (
              <Card key={t.id} className="group flex flex-col p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    <h3 className="text-lg font-semibold leading-tight">{t.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</div>
                {members.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {members.slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5" style={{ color: t.color }} />
                        <span className="truncate">{c.name}</span>
                      </li>
                    ))}
                    {members.length > 6 && (
                      <li className="text-xs text-muted-foreground">+{members.length - 6} more</li>
                    )}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
