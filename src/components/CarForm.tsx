import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateDriverName } from "@/lib/driver-names";
import type { Car, NarrativeRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/narrative";
import { uid } from "@/lib/storage";
import { Sparkles, Upload, X, Crop } from "lucide-react";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { fileToDataUrl } from "@/lib/image";
import { TeamPicker } from "@/components/TeamPicker";

interface Props {
  initial?: Car;
  onSave: (car: Car) => void;
  onCancel: () => void;
}

const BRANDS = [
  "Hot Wheels",
  "Matchbox",
  "Greenlight",
  "Maisto",
  "Auto World",
  "Johnny Lightning",
  "Tarmac Works",
  "Other",
];

export function CarForm({ initial, onSave, onCancel }: Props) {
  const [carId] = useState(() => initial?.id ?? uid());
  const [name, setName] = useState(initial?.name ?? "");
  const [driver, setDriver] = useState(initial?.driver ?? "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [weightG, setWeightG] = useState<number | "">(initial?.weightG ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? BRANDS[0]);
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [role, setRole] = useState<NarrativeRole>(initial?.role ?? "neutral");
  const [story, setStory] = useState(initial?.story ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be under 20MB");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setCropSrc(url);
      setCropOpen(true);
    } catch {
      toast.error("Could not read image");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim() || `${make.trim()} ${model.trim()}`.trim();

    if (!trimmedName) {
      return toast.error("Car name required");
    }
    onSave({
      id: carId,
      name: trimmedName.slice(0, 60),
      driver: driver.trim().slice(0, 60) || generateDriverName(),
      make: make.trim().slice(0, 40),
      model: model.trim().slice(0, 40),
      weightG: typeof weightG === "number" ? weightG : Number(weightG) || 0,
      brand,
      photo,
      notes: notes.trim().slice(0, 300) || undefined,
      role,
      story: story.trim().slice(0, 200) || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <div>
          <Label className="mb-2 block">Photo</Label>
          <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40">
            {photo ? (
              <>
                <img src={photo} alt="" className="h-full w-full object-cover" />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCropSrc(photo);
                      setCropOpen(true);
                    }}
                    className="grid h-6 w-6 place-items-center rounded-full bg-background/90 shadow"
                    title="Re-crop"
                  >
                    <Crop className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="grid h-6 w-6 place-items-center rounded-full bg-background/90 shadow"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Upload className="h-5 w-5" />
                Upload
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {photo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => fileRef.current?.click()}
            >
              Replace
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="name">Car name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Crimson Reaper"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="driver">Driver</Label>
            <div className="flex gap-2">
              <Input
                id="driver"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                placeholder="Driver name"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setDriver(generateDriverName())}
                title="Generate name"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="make">Make</Label>
          <Input
            id="make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Ford"
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Mustang"
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="weight">Weight (g)</Label>
          <Input
            id="weight"
            type="number"
            min={0}
            max={500}
            value={weightG}
            onChange={(e) => setWeightG(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g. 35"
          />
        </div>
        <div>
          <Label htmlFor="brand">Brand</Label>
          <select
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Custom paint, mods, history..."
        />
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
          <Label htmlFor="story">Backstory</Label>
          <Input
            id="story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            maxLength={200}
            placeholder="Rescued from a car boot sale..."
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Teams</Label>
        <TeamPicker carId={carId} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{initial ? "Save" : "Add car"}</Button>
      </div>
      <ImageCropDialog
        src={cropSrc}
        open={cropOpen}
        onOpenChange={(o) => {
          setCropOpen(o);
          if (!o) {
            setCropSrc(null);
            if (fileRef.current) fileRef.current.value = "";
          }
        }}
        onCropped={(url) => setPhoto(url)}
        aspect={1}
      />
    </form>
  );
}
