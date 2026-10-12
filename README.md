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
- *File name* (in Print and Project) names both the PDF and the project
  file. Left empty, files are named by date.
- The title card plays while your last session loads. Tap or press any key
  to skip it; after the first time it plays quickly for the rest of the
  session, and it stays still if the system asks for reduced motion.
- For true 1:1 on screen, press *Cal* once per device and match a bank
  card.
- *Undo · Redo · Copy · Paste* sit at the top of the right-hand panel. On
  a keyboard they are ⌘Z, ⌘⇧Z, ⌘C, ⌘V on Mac and iPad (Ctrl on Windows).
  A pasted layer keeps its size, type and formatting; pasted onto another
  cover it lands in the same spot.
- *Secret* (S) draws a TOP SECRET stripe: a #0d0d0c bar whose words are
  set in Courier Prime (Regular, Medium or Bold), sized so the capitals
  fill the bar less a 2 pt gap. Words show as typed (*All caps* is a
  switch). Draw it thicker and the type grows; words
  past the ends are cut off, and *Fit length* sizes the bar to them.
- *Effects* (any layer): opacity, *Ben-Day dots* and *Distressed*.
  - Ben-Day turns flat colour into Lichtenstein dots of that colour
    (outlines stay solid) and pictures into a four-colour comic print.
    *Strength* and *Dot size* set the look.
  - Distressed batters the layer like an old cabinet: chips knocked out
    of edges and corners, slivers shaved off straight runs, dings, flakes,
    scuffs, hairline scratches, dragged scrapes and gouges, worn through
    to what's beneath. Small things (type) also get a stamped speckle.
    *Wear* sets how much; *Shuffle* picks another pattern.
  - Both can be on at once. Layers with effects print as pictures at the
    PDF's resolution; everything else stays vector.

## Printing

- Every PDF page is exactly A4 portrait (210 × 297 mm). Covers that only fit
  sideways are rotated on the page instead.
- Print **with borders at 100 % / Actual size**. Canon Pixma's borderless
  mode enlarges the page, which throws off the measurements.
- The only marks printed are dashed cut lines along each picture's outer
  edge (the edge of its 2 mm bleed). They sit on the white paper only:
  beside a picture they touch its edge without landing on it, and where two
  pictures meet they show in the side margins. Cut there and each sticker
  keeps its 2 mm bleed; trim that off after mounting it on card.
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
- [x] **Requests, round 1:**
  - Picture scale and drag-to-recompose
  - Bold and italic words in a text layer
  - Sheet composer: any cover in any slot, so two different Notebooks can
    share a page
  - Dashed cut lines on the white paper only, along each picture's outer
    edge; no other marks
- [x] **Requests, round 2:**
  - One file-name field for the PDF and the project file
  - Milano '95 title card that opens down the fold
- [x] **7 · Cross-device polish:** real-iPad fixes (Image key acts at once,
  Stampa toggles the print view)

**v1.0**, October 2026.

- [x] **Requests, round 3:**
  - [x] Undo that can't get stuck, Undo/Redo keys, ⌘ shortcuts on Apple
  - [x] Copy and paste layers
  - [x] Opacity slider (Effects panel); text box in LCD teal on black
  - [x] TOP SECRET censor stripe
  - [x] Effects: Ben-Day dots and Distressed

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

The cover library holds 57 families (46 of them sans-serif), Latin subsets
of the upright and (where they exist) italic styles, taken from the [Fontsource](https://fontsource.org)
packages of Google Fonts. All are free to use in print; see
`public/fonts/LICENSES.txt`. To change the list, edit
`src/fonts/families.json` and run `npm run fonts`.

The interface itself is set in Archivo and IBM Plex Mono (SIL Open Font
License).
