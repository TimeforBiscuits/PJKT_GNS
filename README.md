# PJKT_GNS — Project Gans

A print-accurate cover studio for fold-in-half notebook covers. You design
in real millimetres, and it exports A4 PDFs that print at exactly the right
size at 100 %.

It runs in the browser on Windows 11 (Chrome/Edge), macOS (Safari/Chrome)
and iPad (Safari, installable to the Home Screen). Images never leave the
device.

**Live:** https://timeforbiscuits.github.io/PJKT_GNS/

## Formats

| Format   | Flat trim  | With 2 mm bleed | Panels (back · front) | Per A4 |
| -------- | ---------- | --------------- | --------------------- | ------ |
| Notebook | 180 × 140  | 184 × 144       | 90 × 140 · fold at 90 | 2      |
| Square   | 280 × 140  | 284 × 144       | 140 × 140 · fold at 140 | 1    |

The left panel is the back cover and the right panel is the front cover.
Artwork runs 2 mm past the trim (bleed) so hand-cutting never leaves a
white edge.

## Using it on each device

- **Windows 11 and Mac:** open the link in Chrome or Edge, or Safari on the
  Mac. In Chrome or Edge, *Export PDF* asks where to save.
- **iPad:** open the link in Safari, then *Share → Add to Home Screen*. It
  then runs full-screen, works offline, and keeps its saved work. *Export PDF*
  opens the share sheet; choose *Save to Files* to pick a folder.
- Work saves itself in the browser. Use *Save file* (a `.gns` project) to
  move work between devices or keep a backup.
- For true 1:1 on screen, press *Cal* once per device and match a bank
  card.

## Printing

- Every PDF page is exactly A4 portrait (210 × 297 mm). Covers that only fit
  sideways are rotated on the page instead.
- Print **with borders at 100 % / Actual size**. Canon Pixma's borderless
  mode enlarges the page, which throws off the measurements.
- Crop marks go in the side margins. Where the printer can't reach the edge
  of the sheet, short cut ticks sit inside the bleed that gets trimmed away.
- Print the *Printer test page* once: the square must measure 100.0 mm, and
  the edge gauges show where your printer stops printing.

## Roadmap

- [x] **0 · Shell & style:** Studio Grigio UI, chunky keys, LCD readouts
- [x] **1 · Template:**
  - Notebook and Square formats
  - Bleed, trim, safe-zone and fold guides
  - mm rulers and dimension lines
  - Zoom and pan (trackpad, mouse, touch)
  - A4 sheet preview with crop marks
  - Real-size screen calibration
- [x] **2 · Images:**
  - Import and full-bleed placement
  - Drag inside the frame, crop, rotate and flip
  - Live effective-PPI meter
- [x] **3 · Shapes:**
  - Rectangle, ellipse, polygon and line
  - Fill, or hollow with stroke weight and alignment
  - Layers, snapping, undo
- [x] **4 · Type:**
  - Built-in library of bold sans faces
  - Size, leading and tracking
  - Text converted to outlines for exact output
- [x] **5 · Print:**
  - Sheet composer
  - 300/600 dpi vector PDF export
  - Calibration test page
- [x] **6 · Storage:** autosave, `.gns` project files, offline install
- [ ] **7 · Cross-device polish**

## Development

```sh
npm install
npm run dev      # local dev server
npm run check    # typecheck + lint + unit tests
npm run build    # production build in dist/
```

Pushing to `main` runs the checks and publishes `dist/` to the `gh-pages`
branch.

### Layout

```
src/
  model/    geometry in millimetres: units, formats, A4 imposition (+ tests)
  store/    editor state (zustand)
  editor/   the light table: viewport, rulers, cover and sheet scenes
  app/      top bar, tool rail, inspector, status bar, dialogs
  ui/       chunky keys, LCD fields, icons
  styles/   the Studio Grigio design system
```

### Fonts

The cover library holds 56 families (46 of them sans-serif), Latin subsets
of the regular styles, taken from the [Fontsource](https://fontsource.org)
packages of Google Fonts. All are free to use in print; see
`public/fonts/LICENSES.txt`. To change the list, edit
`src/fonts/families.json` and run `npm run fonts`.

The interface itself is set in Archivo and IBM Plex Mono (SIL Open Font
License).
