import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Flag className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">PIT LANE</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Diecast League</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/garage">Garage</NavLink>
          <NavLink to="/tournaments">Tournaments</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/backup">Backup</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-1.5 font-semibold text-foreground bg-secondary" }}
    >
      {children}
    </Link>
  );
}