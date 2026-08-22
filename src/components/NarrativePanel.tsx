/**
 * @file NarrativePanel.tsx
 * @description Narrative mode settings editor. Used in the tournament create
 * dialog and on the tournament page: roles, rivalries, hero bias, event mix.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RoleBadge } from "@/components/NarrativeBadges";
import {
  EVENT_LABEL,
  autoRivalries,
  makeRoleResolver,
  nameOf,
} from "@/lib/narrative";
import { uid } from "@/lib/storage";
import type {
  Car,
  NarrativeEventType,
  NarrativeRole,
  Team,
  TournamentNarrative,
} from "@/lib/types";
import { Plus, Swords, Trash2 } from "lucide-react";

const EVENT_TYPES: NarrativeEventType[] = ["rematch", "driver-swap", "handicap", "story-beat"];
const ROLES: NarrativeRole[] = ["hero", "neutral", "villain"];

export function NarrativePanel({
  narrative,
  participantIds,
  cars,
  teams,
  onChange,
}: {
  narrative: TournamentNarrative;
  participantIds: string[];
  cars: Car[];
  teams: Team[];
  onChange: (patch: Partial<TournamentNarrative>) => void;
}) {
  const roleOf = makeRoleResolver(narrative, cars, teams);
  const auto = autoRivalries(participantIds, roleOf, narrative.rivalries, cars, teams);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [reason, setReason] = useState("");

  function addRivalry() {
    if (!aId || !bId || aId === bId) return;
    onChange({
      rivalries: [
        ...narrative.rivalries,
        {
          id: uid(),
          aId,
          bId,
          reason: reason.trim() || `${nameOf(aId, cars, teams)} vs ${nameOf(bId, cars, teams)} — bad blood.`,
        },
      ],
    });
    setAId("");
    setBId("");
    setReason("");
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <Label className="cursor-pointer text-sm font-semibold" htmlFor="narrative-enabled">
          Narrative mode
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Heroes, villains, grudge matches and story twists.
          </p>
        </Label>
        <Switch
          id="narrative-enabled"
          checked={narrative.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>

      {narrative.enabled && (
        <div className="mt-4 space-y-5">
          {/* Roles */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cast ({participantIds.length})
            </Label>
            {participantIds.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Pick your roster first.</p>
            ) : (
              <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {participantIds.map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">{nameOf(id, cars, teams)}</span>
                    <RoleBadge role={roleOf(id)} />
                    <select
                      aria-label={`Role for ${nameOf(id, cars, teams)}`}
                      value={roleOf(id)}
                      onChange={(e) =>
                        onChange({
                          roleOverrides: {
                            ...narrative.roleOverrides,
                            [id]: e.target.value as NarrativeRole,
                          },
                        })
                      }
                      className={`${selectClass} w-28 shrink-0`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r === "hero" ? "Hero" : r === "villain" ? "Villain" : "Neutral"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rivalries */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rivalries
            </Label>
            <div className="mt-2 space-y-1.5">
              {narrative.rivalries.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5"
                >
                  <Swords className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">
                      {nameOf(r.aId, cars, teams)} vs {nameOf(r.bId, cars, teams)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.reason}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onChange({ rivalries: narrative.rivalries.filter((x) => x.id !== r.id) })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {auto.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 rounded-md border border-dashed border-border px-2 py-1.5"
                >
                  <Swords className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/70" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">
                      {nameOf(r.aId, cars, teams)} vs {nameOf(r.bId, cars, teams)}{" "}
                      <span className="font-normal text-muted-foreground">(auto)</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.reason}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Give this rivalry your own reason"
                    onClick={() => {
                      setAId(r.aId);
                      setBId(r.bId);
                      setReason(r.reason);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Rivalry side A"
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className={selectClass}
              >
                <option value="">Choose…</option>
                {participantIds.map((id) => (
                  <option key={id} value={id}>
                    {nameOf(id, cars, teams)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Rivalry side B"
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className={selectClass}
              >
                <option value="">Choose…</option>
                {participantIds.map((id) => (
                  <option key={id} value={id}>
                    {nameOf(id, cars, teams)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason — stole the trophy in 2025"
                maxLength={140}
              />
              <Button type="button" variant="outline" onClick={addRivalry} disabled={!aId || !bId || aId === bId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bias */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hero bias
            </Label>
            <Slider
              className="mt-3"
              value={[narrative.heroBias]}
              min={-100}
              max={100}
              step={10}
              onValueChange={(v) => onChange({ heroBias: v[0] ?? 0 })}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Heroes always lose</span>
              <span className="font-medium text-foreground">
                {narrative.heroBias === 0
                  ? "Neutral"
                  : narrative.heroBias > 0
                    ? `Heroes favoured +${narrative.heroBias}`
                    : `Villains favoured +${-narrative.heroBias}`}
              </span>
              <span>Heroes always win</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Suggestions only — you always pick the winner.
            </p>
          </div>

          {/* Events */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Twist frequency</Label>
              <select
                value={narrative.eventFrequency}
                onChange={(e) =>
                  onChange({
                    eventFrequency: e.target.value as TournamentNarrative["eventFrequency"],
                  })
                }
                className={selectClass}
              >
                <option value="off">Off</option>
                <option value="rare">Rare</option>
                <option value="occasional">Occasional</option>
                <option value="frequent">Frequent</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Rivals meet</Label>
              <select
                value={narrative.collision}
                onChange={(e) =>
                  onChange({ collision: e.target.value as "early" | "late" })
                }
                className={selectClass}
              >
                <option value="early">Early — round 1 grudge</option>
                <option value="late">Late — final showdown</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Twist types
            </Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EVENT_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${t}`}
                    checked={narrative.enabledEvents.includes(t)}
                    onCheckedChange={(c) =>
                      onChange({
                        enabledEvents:
                          c === true
                            ? [...narrative.enabledEvents, t]
                            : narrative.enabledEvents.filter((x) => x !== t),
                      })
                    }
                  />
                  <Label htmlFor={`ev-${t}`} className="cursor-pointer text-xs font-medium">
                    {EVENT_LABEL[t]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
