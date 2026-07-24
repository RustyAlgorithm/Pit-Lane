import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalStorage } from "@/lib/storage";
import type { Car } from "@/lib/types";
import { CarForm } from "@/components/CarForm";
import { CarCard } from "@/components/CarCard";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "Garage — Pit Lane" },
      { name: "description", content: "Catalog every diecast car in your collection." },
    ],
  }),
  component: GaragePage,
});

function GaragePage() {
  const [cars, setCars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Car | undefined>();

  function save(car: Car) {
    setCars((prev) => {
      const idx = prev.findIndex((c) => c.id === car.id);
      if (idx === -1) return [car, ...prev];
      const next = [...prev];
      next[idx] = car;
      return next;
    });
    setOpen(false);
    setEditing(undefined);
    toast.success(editing ? "Car updated" : "Car added to garage");
  }

  function remove(id: string) {
    setCars((prev) => prev.filter((c) => c.id !== id));
    toast.success("Removed");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Garage</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cars.length} car{cars.length === 1 ? "" : "s"} in your collection</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(undefined)} className="w-full shadow-[var(--shadow-elegant)] sm:w-auto">
              <Plus className="mr-1 h-4 w-4" /> Add car
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit car" : "Add a new car"}</DialogTitle>
            </DialogHeader>
            <CarForm initial={editing} onSave={save} onCancel={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      {cars.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Your garage is empty. Add your first diecast car to get started.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c) => (
            <div key={c.id} className="relative">
              <CarCard car={c} />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button size="icon" variant="secondary" className="h-8 w-8 shadow-md" onClick={() => { setEditing(c); setOpen(true); }} aria-label="Edit car">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="destructive" className="h-8 w-8 shadow-md" onClick={() => remove(c.id)} aria-label="Delete car">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}