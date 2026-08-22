/**
 * @file NarrativeBadges.tsx
 * @description Small presentational bits for narrative mode: role badges and
 * the rivalry (grudge match) callout shown on bracket cells.
 */

import { Shield, Skull, Swords } from "lucide-react";
import type { NarrativeRole } from "@/lib/types";

export function RoleBadge({ role, className = "" }: { role: NarrativeRole; className?: string }) {
  if (role === "neutral") return null;
  const hero = role === "hero";
  const Icon = hero ? Shield : Skull;
  return (
    <span
      title={hero ? "Hero" : "Villain"}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        hero
          ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      } ${className}`}
    >
      <Icon className="h-3 w-3" />
      {hero ? "Hero" : "Villain"}
    </span>
  );
}

export function RivalryCallout({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
      <Swords className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        <span className="font-semibold uppercase tracking-wider">Grudge match — </span>
        {reason}
      </span>
    </div>
  );
}
