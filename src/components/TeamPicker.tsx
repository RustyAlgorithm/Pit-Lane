import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateTeamName } from "@/lib/driver-names";
import { getRandomSponsorName } from "@/lib/driver-names";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalStorage, uid } from "@/lib/storage";
import type { Team } from "@/lib/types";
import { Check, Plus, Users, Upload } from "lucide-react";

const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

/*const TEAM_NAMES = ["Velocity", "Thunder", "Phoenix", "Vortex", "Apex", "Inferno", "Nexus", "Catalyst", "Prism", "Blaze", "Storm", "Quantum", "Sonic", "Turbo", "Nitro", "Fusion", "Titan", "Crown", "Elite", "Razor"];
const SPONSOR_NAMES = ["Red Bull", "Monster", "Motul", "Shell", "Pirelli", "Michelin", "Bridgestone", "Continental", "Dunlop", "Goodyear", "Castrol", "Mobil", "Esso", "Total", "BP", "Pertamina", "Pennzoil", "Valvoline"];

function getRandomTeamName(): string {
  return TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
}

function getRandomSponsorName(): string {
  return SPONSOR_NAMES[Math.floor(Math.random() * SPONSOR_NAMES.length)];
}*/

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

export function TeamPicker({ carId }: { carId: string }) {
  const [teams, setTeams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSponsor, setNewSponsor] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const memberOf = teams.filter((t) => t.carIds.includes(carId));

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoadingImage(true);
    try {
      const color = await extractDominantColor(file);
      setNewColor(color);
    } catch (err) {
      console.error("Failed to extract color from image:", err);
    } finally {
      setIsLoadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

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
    const team: Team = { id: uid(), name, color: newColor, sponsor: newSponsor.trim() || undefined, carIds: [carId], createdAt: Date.now() };
    setTeams((prev) => [team, ...prev]);
    setNewName("");
    setNewSponsor("");
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
          <div className="mb-3">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Quick colors:</label>
            <div className="flex items-center gap-1 mb-3">
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
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border"
                    aria-label="Pick a custom color"
                  />
                  <span className="text-xs text-muted-foreground font-mono">{newColor}</span>
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
                  className="flex-1 h-8"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isLoadingImage ? "Loading..." : "From image"}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team name" maxLength={40} className="h-8" />
              <Button type="button" size="sm" variant="outline" onClick={() => setNewName(generateTeamName())} className="h-8">
                Random
              </Button>
            </div>
            <div className="flex gap-2">
              <Input value={newSponsor} onChange={(e) => setNewSponsor(e.target.value)} placeholder="Sponsor (optional)" maxLength={40} className="h-8" />
              <Button type="button" size="sm" variant="outline" onClick={() => setNewSponsor(getRandomSponsorName())} className="h-8">
                Random
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={createTeam} disabled={!newName.trim()} className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
