/**
 * @file SiteHeader.tsx
 * @description Navigation header component displayed at the top of every page.
 * Shows app branding, main navigation links, and theme toggle.
 */

import { Link } from "@tanstack/react-router";
import { Flag, Menu } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ServerStatusPill } from "@/components/ServerStatusPill";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * Site header component with navigation.
 * 
 * @returns Navigation bar with:
 * - Pit Lane logo/branding
 * - Links to main sections (Garage, Teams, Tournaments, Leaderboard, Backup)
 * - Feedback form link
 * - Theme toggle button
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        {/* Logo and branding */}
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Flag className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold tracking-tight">
              PIT LANE<span className="hidden sm:inline"> - Beta</span>
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">Diecast Racing League</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 lg:flex">
          <nav className="flex items-center gap-1 text-sm">
            <NavLink to="https://forms.office.com/r/kyDtrZ6USH">Feedback</NavLink>
            <NavLink to="/garage">Garage</NavLink>
            <NavLink to="/teams">Teams</NavLink>
            <NavLink to="/tournaments">Tournaments</NavLink>
            <NavLink to="/leaderboard">Leaderboard</NavLink>
            <NavLink to="/backup">Backup</NavLink>
          </nav>
          <ServerStatusPill />
          <ThemeToggle />
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <ServerStatusPill />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 text-base">
                <MobileNavLink to="/garage" onClick={() => setOpen(false)}>Garage</MobileNavLink>
                <MobileNavLink to="/teams" onClick={() => setOpen(false)}>Teams</MobileNavLink>
                <MobileNavLink to="/tournaments" onClick={() => setOpen(false)}>Tournaments</MobileNavLink>
                <MobileNavLink to="/leaderboard" onClick={() => setOpen(false)}>Leaderboard</MobileNavLink>
                <MobileNavLink to="/backup" onClick={() => setOpen(false)}>Backup</MobileNavLink>
                <a
                  href="https://forms.office.com/r/kyDtrZ6USH"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Feedback
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/**
 * Navigation link component.
 * Shows active state when on current page.
 * 
 * @param to Link destination URL
 * @param children Link text
 */
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

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-2 font-semibold text-foreground bg-secondary" }}
    >
      {children}
    </Link>
  );
}
