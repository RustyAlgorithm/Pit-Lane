/**
 * @file NarrativeEventDialog.tsx
 * @description The interactive "story twist" card shown before a race in
 * narrative mode. Nothing is applied unless the organiser accepts it.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENT_LABEL } from "@/lib/narrative";
import type { NarrativeEvent } from "@/lib/types";
import { Sparkles } from "lucide-react";

export function NarrativeEventDialog({
  event,
  open,
  onOpenChange,
  onAccept,
  onDismiss,
}: {
  event: NarrativeEvent | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {event?.title ?? "Story twist"}
          </DialogTitle>
          <DialogDescription>
            {event ? EVENT_LABEL[event.type] : ""} — you decide whether this becomes canon.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-relaxed">{event?.text}</p>
        {event?.type === "rematch" && (
          <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
            If you accept, this match runs as two legs. Pick the winner of leg 1, then leg 2 — the
            racer who wins both takes it. Split legs go to a decider.
          </p>
        )}
        {event?.type === "driver-swap" && (
          <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
            Flavour only — swap in whichever driver or car you like at the track, then pick the
            winner as normal.
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onDismiss}>
            Ignore twist
          </Button>
          <Button onClick={onAccept}>Make it canon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
