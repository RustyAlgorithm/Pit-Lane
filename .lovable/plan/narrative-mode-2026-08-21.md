# Narrative Mode

Turn tournaments into a story: mark cars and teams as heroes or villains, give rivalries a reason, and let the app inject dramatic twists before races — while you always stay in control of the final result.

## Roles: heroes and villains

- **Global role** on each car and team (Garage and Teams pages): Hero, Villain, or Neutral, with an optional one-line "story" blurb.
- **Per-tournament override**: when creating or editing a tournament, a Narrative panel lists the roster and lets you flip any entrant's role just for that event.
- Roles show as a small badge (hero / villain colour accent) on car cards, team cards, and everywhere a racer appears in a bracket.

## Rivalries

- Create rivalries between any two cars or teams, each with your own custom reason text ("stole the trophy in 2025").
- Hero-vs-villain pairs get an automatic rivalry unless you delete it.
- When a rivalry pair meets in a match, the bracket cell shows a **grudge match callout** with the reason.

## Bracket influence

Narrative mode biases the *bracket build*, not the results:

- **Collision seeding**: when narrative mode is on, seeding tries to place rivals so they meet — either early (Round 1 grudge) or late (Final showdown), your choice per tournament.
- Round-robin and heats: rivals are grouped into the same group / same heat where possible.
- Falls back silently to normal seeding when the roster makes a pairing impossible.

## Semi-scripted events

Before a match starts, narrative mode may fire an **event card** — an interactive dialog you accept or dismiss. Nothing is applied unless you confirm.

Event types:
- **Rematch** — "Sabotage in the pits!" The match is run twice; the pair must race a second time and the aggregate decides it.
- **Driver swap** — "The driver is sick." A different car from the same team (full-team mode) or a substitute is proposed for this match.
- **Handicap / advantage** — flavour only: the card names an underdog boost, shown on the match, result still yours.
- **Story beat** — pure commentary shown before or after the match ("The crowd is on its feet…").

Event frequency and which types are enabled are set in the tournament's Narrative settings (Off / Rare / Occasional / Frequent).

## Hero bias

A slider in Narrative settings: **Heroes always lose ← neutral → Heroes always win**.

- It does not auto-pick winners. It controls which side event cards favour, and it highlights a *suggested* winner on rivalry matches (a soft glow + "story pick"), which you can ignore with one tap.

## Arcs and commentary

- Each participant accumulates a **story arc** across rounds and seasons: Underdog, Comeback, Dominant, Fallen, Nemesis — derived from their results, rivalry outcomes, and role.
- A **Story** tab on the tournament page shows a chronological narrative log: rivalry callouts, event cards that fired, round-by-round beats, and the final champion write-up.
- Arc summaries appear on the Leaderboard for persistent tournaments, and the story log is included in the certificate/podium output and in ZIP backups.

## Technical notes

- Types (`src/lib/types.ts`): add `role?: "hero" | "villain"` and `story?: string` to `Car` and `Team`; add to `Tournament` a `narrative?: { enabled: boolean; roleOverrides: Record<string, Role>; rivalries: Rivalry[]; heroBias: number; eventFrequency: ...; collision: "early" | "late"; enabledEvents: string[]; log: StoryEntry[] }`; add `Match.narrative?: { rivalryId?, events: AppliedEvent[], rematchOf?, suggestedWinnerId? }`.
- New `src/lib/narrative.ts`: role resolution (per-tournament override over global), rivalry detection, collision-aware seed ordering that wraps the existing seed-order helper in `src/lib/bracket.ts`, deterministic (seeded-random) event rolling per match id so re-renders don't reroll, arc computation, and commentary templates.
- `src/lib/bracket.ts`: accept an optional ordering hook so narrative seeding plugs into single/double/round-robin/heats builders without duplicating bracket logic. Rematch is modelled as an extra match linked by `rematchOf`, reusing existing match rendering.
- UI: new `NarrativePanel` (tournament create/edit), `NarrativeEventDialog` (event card), `RivalryBadge`, and a Story tab in `src/routes/tournaments.$id.tsx`. Role controls added to the car form and team form.
- Everything is additive and optional: existing tournaments keep behaving exactly as they do today, and all new fields are optional so current backups still import.
