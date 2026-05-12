import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCertificateDefaults,
  certificateFilename,
  createCertificatePdf,
  createCertificatePreviewUrl,
  downloadBlob,
  type CertificateData,
} from "@/lib/certificate";
import type { TournamentPlacement } from "@/lib/tournamentPlacements";
import type { Tournament } from "@/lib/types";

interface TournamentCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  placements: TournamentPlacement[];
}

export function TournamentCertificateDialog({
  open,
  onOpenChange,
  tournament,
  placements,
}: TournamentCertificateDialogProps) {
  const defaultForms = useMemo(() => {
    return Object.fromEntries(
      placements.map((placement) => [
        placement.place,
        buildCertificateDefaults({
          place: placement.place,
          recipientName: placement.participantName,
          tournamentName: tournament.name,
          persistent: tournament.persistent,
          priorSeasonCount: tournament.previousSeasons?.length ?? 0,
          accentColor: placement.accentColor,
          recipientImage: placement.recipientImage,
        }),
      ]),
    ) as Record<number, CertificateData>;
  }, [placements, tournament]);

  const initialPlace = placements[0]?.place ?? 1;
  const [selectedPlace, setSelectedPlace] = useState<1 | 2 | 3>(initialPlace);
  const [form, setForm] = useState<CertificateData>(defaultForms[initialPlace]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open || placements.length === 0) return;
    const place = placements[0].place;
    setSelectedPlace(place);
    setForm(defaultForms[place]);
  }, [defaultForms, open, placements]);

  const selectedPlacement =
    placements.find((placement) => placement.place === selectedPlace) ?? placements[0];
  const previewUrl = useMemo(() => createCertificatePreviewUrl(form), [form]);

  function update<K extends keyof CertificateData>(key: K, value: CertificateData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function changePlacement(place: 1 | 2 | 3) {
    setSelectedPlace(place);
    setForm(defaultForms[place]);
  }

  function resetForm() {
    if (!selectedPlacement) return;
    setForm(defaultForms[selectedPlacement.place]);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipientName.trim() || !form.tournamentName.trim() || !form.awardTitle.trim()) {
      toast.error("Recipient, award title, and tournament name are required.");
      return;
    }

    const normalizedForm: CertificateData = {
      ...form,
      documentTitle: form.documentTitle.trim(),
      recipientName: form.recipientName.trim(),
      tournamentName: form.tournamentName.trim(),
      awardTitle: form.awardTitle.trim(),
      citation: form.citation.trim(),
      signedBy: form.signedBy.trim(),
      seasonLabel: form.seasonLabel.trim(),
    };

    try {
      setIsGenerating(true);
      const blob = await createCertificatePdf(normalizedForm);
      downloadBlob(blob, certificateFilename(normalizedForm));
      toast.success("Certificate PDF downloaded.");
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || "Could not generate certificate PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (placements.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-0">
        <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
          <div className="border-b border-border bg-secondary/20 p-6 lg:border-b-0 lg:border-r">
            <DialogHeader>
              <DialogTitle>Generate Certificate</DialogTitle>
              <DialogDescription>
                This stays optional. Pick 1st, 2nd, or 3rd place, review the detected details,
                change anything you want, then download the PDF.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 grid gap-4" onSubmit={handleGenerate}>
              <div className="grid gap-2">
                <Label htmlFor="cert-placement">Placement</Label>
                <select
                  id="cert-placement"
                  value={selectedPlace}
                  onChange={(e) => changePlacement(Number(e.target.value) as 1 | 2 | 3)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {placements.map((placement) => (
                    <option key={placement.place} value={placement.place}>
                      {placement.placeLabel} - {placement.participantName}
                    </option>
                  ))}
                </select>
                {selectedPlacement?.note && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {selectedPlacement.note}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cert-title">Certificate heading</Label>
                <Input
                  id="cert-title"
                  value={form.documentTitle}
                  onChange={(e) => update("documentTitle", e.target.value)}
                  maxLength={48}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cert-award-title">Award title</Label>
                <Input
                  id="cert-award-title"
                  value={form.awardTitle}
                  onChange={(e) => update("awardTitle", e.target.value)}
                  maxLength={40}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cert-recipient">Recipient</Label>
                <Input
                  id="cert-recipient"
                  value={form.recipientName}
                  onChange={(e) => update("recipientName", e.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cert-tournament">Tournament</Label>
                <Input
                  id="cert-tournament"
                  value={form.tournamentName}
                  onChange={(e) => update("tournamentName", e.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
                <div className="grid gap-2">
                  <Label htmlFor="cert-season">Season label</Label>
                  <Input
                    id="cert-season"
                    value={form.seasonLabel}
                    onChange={(e) => update("seasonLabel", e.target.value)}
                    placeholder="Optional"
                    maxLength={24}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cert-date">Award date</Label>
                  <Input
                    id="cert-date"
                    type="date"
                    value={form.awardedOn}
                    onChange={(e) => update("awardedOn", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cert-citation">Citation</Label>
                <Textarea
                  id="cert-citation"
                  value={form.citation}
                  onChange={(e) => update("citation", e.target.value)}
                  rows={4}
                  maxLength={220}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_112px]">
                <div className="grid gap-2">
                  <Label htmlFor="cert-signed-by">Verified by</Label>
                  <Input
                    id="cert-signed-by"
                    value={form.signedBy}
                    onChange={(e) => update("signedBy", e.target.value)}
                    placeholder="Optional"
                    maxLength={60}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cert-accent">Accent</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2">
                    <input
                      id="cert-accent"
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => update("accentColor", e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="text-xs text-muted-foreground">{form.accentColor}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Reset detected values
                </Button>
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? "Generating PDF..." : "Download PDF"}
                </Button>
              </DialogFooter>
            </form>
          </div>

          <div className="p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </h3>
                <p className="text-sm text-muted-foreground">
                  Nothing is saved. This preview reflects the PDF file you download.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-[#f7f1e6] shadow-[var(--shadow-card)]">
              <img src={previewUrl} alt="Certificate preview" className="block h-auto w-full" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
