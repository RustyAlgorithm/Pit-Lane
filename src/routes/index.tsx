import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocalStorage } from "@/lib/storage";
import type { Car, Tournament } from "@/lib/types";
import { Car as CarIcon, Trophy, Users, ArrowRight } from "lucide-react";
import Banner from "@/components/Banner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pit Lane — Diecast Racing League" },
      { name: "description", content: "Build diecast racing teams and run tournament brackets for your collection." },
    ],
  }),
  component: Index,
});

function Index() {
  const [cars] = useLocalStorage<Car[]>("pitlane.cars", []);
  const [tournaments] = useLocalStorage<Tournament[]>("pitlane.tournaments", []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <section className="relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-16" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(135deg, white 0 2px, transparent 2px 14px)" }} />
        <div className="relative max-w-2xl text-white">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
            Local • Offline-first
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Build your diecast team.
            <br /> Race the bracket.
          </h1>
          <p className="mt-4 text-base text-white/70 sm:text-lg">
            Catalog your cars, generate driver names, and run single elimination, double elimination, or round-robin tournaments — all on this device.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-[var(--shadow-elegant)]">
              <Link to="/garage">
                Open garage <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/tournaments">New tournament</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<CarIcon className="h-5 w-5" />} label="Cars in garage" value={cars.length} />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Tournaments" value={tournaments.length} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Champions crowned" value={tournaments.filter((t) => t.champion).length} />
      </section>
      <section className="mt-12 rounded-xl bg-secondary/50 p-6 text-center">
        <h1 className="text-lg font-semibold ">BACKUP YOUR DATA!</h1>
        <h3 className="text-md font-medium text-muted-foreground">
          Pit Lane is designed to be a private experience, meaning we don’t use cloud accounts or store your data on our servers.
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Instead, everything you create—your cars, tournaments, and teams—is stored locally within your browser. Because this data lives on your device, we have provided a way to export and import a backup to ensure your progress is never lost. Use the Backup button in the navigation bar to export a ZIP file containing your data. It’s a good habit to save a fresh copy before closing your session or clearing your browser cache.
        </p>
      </section>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <FeatureCard
          title="Garage"
          desc="Add every car: name, make, model, weight, brand, photo, and a generated driver name."
          to="/garage"
        />
        <FeatureCard
          title="Tournaments"
          desc="Pick your roster, choose a format, and tap winners to advance the bracket."
          to="/tournaments"
        />
      </section>
      
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-4 p-5 shadow-[var(--shadow-card)]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">{icon}</div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function FeatureCard({ title, desc, to }: { title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="group">
      <Card className="h-full p-6 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-elegant)]">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      </Card>
    </Link>
  );
}
