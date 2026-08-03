# Bulk car import (CSV + photos)

Add an "Import cars" button next to "Add car" in the Garage that lets you load many cars at once from a CSV file, optionally with a folder/ZIP of photos.

## The flow

1. Click **Import cars** in the Garage header — a dialog opens.
2. **Download template** link gives a ready-made CSV with the right headers.
3. Pick a CSV file (or drag it in). Optionally pick a ZIP or a set of image files for photos.
4. A **preview table** shows every row parsed, with per-row status: new, duplicate, or error (with the reason).
5. Choose how to handle duplicates: **Skip**, **Update existing**, or **Add as new**.
6. Confirm — valid rows are added to the garage, and a summary toast reports added / updated / skipped / failed counts.

Nothing is written until you confirm, and rows with errors never block the good rows.

## CSV format

Headers (case-insensitive, order-independent; only `name` is required):

```text
name,driver,make,model,weight_g,brand,notes,photo
Crimson Reaper,Dale Vortex,Ford,Mustang,35,Hot Wheels,Custom paint,reaper.jpg
```

- `driver` blank → auto-generated driver name (same generator as the form).
- `brand` unrecognised → kept as typed.
- `weight_g` non-numeric → 0 with a row warning.
- `photo` → filename to match inside the photos ZIP/selection.

## Photos

- Accepts a ZIP or a multi-file image selection.
- Matching order: exact `photo` filename → filename matching the car name (slug, ignoring case/spaces).
- Each matched image runs through the existing resize/compress pipeline (same 1600px cap as single upload), stored as a data URL.
- Unmatched images are listed in the preview as "not used"; cars without a photo import fine.

## Duplicate detection

A row counts as a duplicate when name + make + model match an existing car (case-insensitive). The chosen mode applies to all duplicate rows:

- **Skip** — existing car untouched.
- **Update existing** — overwrite provided fields, keep the existing id, wins/losses, and team memberships. Blank CSV cells leave the existing value alone.
- **Add as new** — new unique id, existing car kept.

## Technical notes

- New `src/lib/car-import.ts`: dependency-free CSV parser (handles quotes, commas in fields, CRLF), header mapping, per-row validation via the existing zod-ish rules, and duplicate matching. Pure functions so the logic stays testable.
- New `src/components/BulkImportDialog.tsx`: file inputs, preview table, duplicate-mode radio group, confirm/cancel. Scroll-capped (`max-h-[90vh] overflow-y-auto`) and stacked on mobile like the other dialogs.
- Photos use `JSZip` (already installed) for ZIP reading and `fileToDataUrl` + the resize helper from `src/lib/image.ts`.
- Garage writes go through the existing `useLocalStorage("pitlane.cars", ...)` setter in one batched update, so server sync picks it up as a single push.
- Template CSV is generated client-side and downloaded via the existing `downloadBlob` helper in `src/lib/backup.ts`.
