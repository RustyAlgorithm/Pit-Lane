import type { Car } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Car as CarIcon } from "lucide-react";
import { useLocalStorage } from "@/lib/storage";
import type { Team } from "@/lib/types";

export function CarCard({ car, onClick, selected }: { car: Car; onClick?: () => void; selected?: boolean }) {
  const [teams] = useLocalStorage<Team[]>("pitlane.teams", []);
  const memberOf = teams.filter((t) => t.carIds.includes(car.id));
  return (
    <Card
      onClick={onClick}
      className={`group overflow-hidden p-0 shadow-[var(--shadow-card)] transition-all ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]" : ""} ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="relative aspect-[4/3] bg-secondary">
        {car.photo ? (
          <img src={car.photo} alt={car.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <CarIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          {car.brand}
        </div>
      </div>
      <div className="p-3">
        <div className="font-semibold leading-tight">{car.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {[car.make, car.model].filter(Boolean).join(" ") || "—"}
        </div>
        {memberOf.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {memberOf.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${t.color}22`, color: t.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Driver</span>
          <span className="font-medium">{car.driver || "—"}</span>
        </div>
        {car.weightG ? (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Weight</span>
            <span className="font-medium tabular-nums">{car.weightG} g</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}