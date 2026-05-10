import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { processImage, type CropArea } from "@/lib/image";
import { toast } from "sonner";

interface Props {
  src: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCropped: (dataUrl: string) => void;
  aspect?: number;
}

export function ImageCropDialog({ src, open, onOpenChange, onCropped, aspect = 1 }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: unknown, pixels: CropArea) => setArea(pixels), []);

  async function confirm() {
    if (!src || !area) return;
    setBusy(true);
    try {
      const out = await processImage(src, area);
      onCropped(out);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Could not process image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop photo</DialogTitle>
        </DialogHeader>
        <div className="relative h-[320px] w-full overflow-hidden rounded-lg bg-secondary">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              restrictPosition
            />
          ) : null}
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">Zoom</label>
          <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={busy || !area}>{busy ? "Processing…" : "Use photo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}