# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Pizarra is a canvas-based wireframing/sketching web app with a hand-drawn aesthetic. Pure vanilla HTML/CSS/JS — no build system, no package manager, no dependencies. UI text is in Spanish.

The app was formerly called SketchWire, so that name survives in identifiers that must not change: the `localStorage` keys `sketchwire.autosave`/`sketchwire.prefs` and the clipboard marker `sketchwire/elements` in app.js. **Renaming those would orphan every user's saved canvas and preferences** — leave them alone.

## Running

Open `index.html` directly in a browser, or serve statically:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There is no lint or build command. Tests use Node's built-in runner (no dependencies):

```bash
node --test tests/           # full suite
node --test tests/exporter.test.js   # single file
```

Tests load the global-scope scripts via `node:vm` with canvas/DOM stubs (see `tests/helpers/`). Two vm-realm gotchas: arrays/errors created inside the vm don't share host prototypes, so compare structurally (`[...arr]`, `err.name`) instead of `deepStrictEqual` against host literals or `instanceof`.

`PLAN.md` holds the prioritized improvement roadmap (fases 1-3 completed, except §3.2 element-type registry, deliberately skipped as optional). `BUGS.md` is the regression registry: every bug fix gets a symptom/cause/fix entry there plus a **regression guard** — a test in `tests/` for code in one of the `node:vm`-loadable modules (config/sketchy/arc/renderer/exporter/templates), or documented manual repro steps if the fix lives in `app.js` (DOM-only, outside the test harness — see below). Add the entry as part of the fix, not as a follow-up.

## Architecture

Scripts are plain `<script>` tags loaded in dependency order in `index.html` (config → sketchy → arc → curve-path → shape-rotation → regular-polygon → renderer → exporter → templates → app). There are no modules/imports — each file exposes a global (`TOOLS`, `Sketchy`, `ArcMath`, `CurvePath`, `ShapeRotation`, `RegularPolygon`, `Renderer`, `Exporter`, `Templates`) via IIFE, and later scripts rely on earlier globals. If you add a file, add its `<script>` tag in the right position.

The app is state-driven immediate-mode rendering: a single `state.elements` array of plain objects is the source of truth, and any change triggers a full canvas redraw (`redraw()` in app.js). Elements are serializable plain objects (this is what JSON export/import round-trips), so never store functions or DOM refs on them. They are also treated as immutable: operations replace the element object (`moveElement` returns a copy) rather than mutating it, which lets undo snapshots be shallow copies (`state.elements.slice()`) — preserve that discipline when adding features.

- `js/config.js` — global constants: `TOOLS` ids, `TOOL_GROUPS` (drives sidebar build), `COLORS`, `CANVAS_W/H` (1200×800), `UI_DEFAULTS` (fallback sizes for UI components placed with a tiny drag).
- `js/sketchy.js` — low-level "wobbly" hand-drawn primitives (line, rect, roundedRect, ellipse, arrow) using `Math.random()` jitter.
- `js/arc.js` — pure circular-arc math (`ArcMath`): fits a single cubic Bézier to an arc of a given sagitta over a chord (≤ 180°). A `curveArrow` with `arc: true` is a normal cubic whose controls were computed this way, so renderer/exporters/hit-test need no arc-specific code. The `TOOLS.ARC` sidebar tool ("Semicírculo") is creation-mode only — it is **not** an element type; it creates `curveArrow` elements that are always exact 180° semicircles (drag = diameter). Editing keeps the 180° invariant: `+/−` and the ctrl-handle drag change the radius via `resizeArc` (app.js), and endpoint drags preserve the shape through `transformControlsToChord`.
- `js/curve-path.js` — pure shared geometry for `curveArrow`, including chained curves. Historical single curves keep `x1/y1/cx/cy[/cx2/cy2]/x2/y2`; a chain also carries `segments`, an ordered, continuous array of quadratic/cubic Bézier objects, while top-level `x1/y1/x2/y2` mirror only the overall endpoints for connector anchoring. Use `CurvePath` for rendering, bounds, sampling, moving, scaling, reversing and endpoint/join editing so those mirrors never drift.
- `js/shape-rotation.js` — pure discrete rotation rules. `ShapeRotation.rotateElement` swaps a rectangle's `w/h` around its unchanged center for each 90° turn, and normalizes the `rotation` field of triangles/pentagons/hexagons after 90°/36°/30° turns. Unsupported types are returned unchanged.
- `js/regular-polygon.js` — pure geometry for `triangle`, `pentagon` and `hexagon`: side counts, vertices, center-radius creation and real-silhouette containment. These elements use the standard `x/y/w/h` shape schema but must keep `w === h`; app resize enforces the square and import validation rejects deformed polygons.
- `js/renderer.js` — `Renderer.renderElement(ctx, el)` switches on `el.type` and draws each element type (shapes via Sketchy, plus composite UI components: button, input, imagePlaceholder, nav, card). Also grid and selection highlight.
- `js/exporter.js` — export to PNG/JPG (offscreen canvas), SVG and HTML (hand-built markup strings per element type), and JSON (project format); JSON import via file picker.
- `js/templates.js` — predefined element arrays (landing, dashboard, form).
- `js/app.js` — main controller IIFE: holds `state`, wires all DOM events, mouse handlers (two-canvas setup: `main-canvas` for committed elements, `overlay-canvas` for in-progress previews), hit-testing/drag for the select tool, undo/redo (deep-cloned snapshots of `state.elements`), text input overlay, modals.

One element type has no sidebar button: `image` (pasted via Ctrl/Cmd+V), whose `src` must be a base64 `data:image/png|jpeg` URL — enforced by `isValidElement` to keep injection out of SVG/HTML exports. Renderer keeps an image cache; `Renderer.setImageLoadCallback` is how app.js gets repaints when async loads finish.

The sidebar is responsive through CSS only: its default `--sidebar-w: 72px`
and flex groups form one column up to 1200px. The
`@media (min-width: 1201px)` rule widens it to 132px and turns every
`.sidebar__group` into a two-column grid, with labels spanning both columns.
Keep that exact breakpoint aligned with the documented desktop behaviour.

One controlled exception to immutability discipline: `resolveAnchors()` in app.js runs at the start of `redrawNow` and materializes anchored arrow endpoints (`startAnchor`/`endAnchor` referencing an element `id`) back into the elements — always by replacing with copies, never with `saveUndo` (it's derived state: snapshots capture materialized coords and the post-undo redraw re-resolves). When the chord of a `curveArrow` changes, its control points are re-projected through the old-chord→new-chord similarity transform (`transformControlsToChord`) so the curve keeps its shape — the same helper runs while dragging an endpoint handle in `resizeTo`. Element `id`s are assigned lazily only when something anchors to them.

### Adding a new element type

Requires touching several files in sync: add the tool id to `TOOLS` and a sidebar entry in `TOOL_GROUPS` (config.js), a render case in `Renderer.renderElement`, creation logic in app.js `onMouseUp` (and `UI_DEFAULTS` if it's a UI component), bounds handling in `getElementBounds` (app.js) if it isn't x/y/w/h-shaped, and export cases in exporter.js for SVG and HTML (PNG/JPG reuse the Renderer automatically).

### Panel controls: dual semantics

Panel controls follow an Excalidraw-style dual semantic: **with a selection they edit the selected elements** (immutable copies + one undo step per gesture); **without a selection they set the creation default** (`state.lineWidth`, `state.doubleHead`, `state.fillShapes`, …). `redrawNow` is the single sync point that pushes the right value back into each control (single selection → element's value; no selection → default; multi-selection → left untouched). Any future panel control inherits this question — follow the same pattern (see the stroke slider, the "Doble punta"/"Rellenar formas" checkboxes and the fill color picker in `wireControls`). The stroke *color* picker is the one control that still only sets the creation default.

### Emoji

`TOOLS.EMOJI` is creation-mode only, like `TOOLS.ARC` — **not an element type**. Picking the tool opens the `#modal-emoji` catalogue (built from `EMOJI_GROUPS` in config.js), and `placeEmoji()` stamps the chosen character as an ordinary `text` element centred on the click, at `max(state.fontSize, EMOJI_MIN_SIZE)`. Because it is just a `text` element, rendering, hit-testing, resize, undo, autosave and all five export formats work with no emoji-specific code — keep it that way rather than introducing an `emoji` type. The catalogue is injected with `textContent`, never `innerHTML`.

### Shape fill

Only `FILLABLE_TYPES` (rect, roundedRect, circle, triangle, pentagon, hexagon) take a fill; UI components carry their own as part of their design. Four fields control it: `fill` (boolean, on/off), the optional `fillColor` (hex), the optional `fillTransparent` (boolean), and the optional `fillOpacity` (number from 0 to 1, defaulting to 0.4 when absent). They are deliberately independent — the "Rellenar formas" checkbox toggles `fill` only and never touches the others, so emptying and refilling a shape recovers the same color, mode and opacity. "Relleno translúcido" and the opacity slider have the standard dual panel semantics: with a selection they update selected fillable shapes, using one undo step per slider gesture; without a selection they set creation defaults. Solid mode is represented by the absence of `fillTransparent`, preserving backward compatibility.

`Renderer.fillStyle(el)` is the single place that resolves these fields. Transparent mode converts `fillOpacity` to an 8-bit hex alpha and applies it to `fillColor || color`; otherwise it uses `fillColor || color + '20'`. A translucent shape without `fillOpacity` must remain at the legacy 40% (`0x66`). Therefore **a shape without `fillColor` keeps the classic translucent stroke tint**, and older projects render identically — preserve both fallbacks. SVG and HTML exports mirror this resolution. `isValidElement` validates `fillTransparent` as a boolean, `fillOpacity` as a finite number in `[0, 1]`, and `fillColor` as hex because they affect serialized/exported output.

### Shape overlap mode

`state.overlapMode` is a global scene setting with two valid values: `normal` (default and backward-compatible) and `hidden-dashed`. `Renderer.renderElements(ctx, elements, mode)` must be used for whole-scene rendering so it can compare geometric shapes by z-order. In hidden mode it samples the real outlines of rect, roundedRect, circle/ellipse, triangle, pentagon and hexagon shapes, assigns every covered segment to the highest later shape containing it, draws visible segments solid, and defers hidden segments until after that covering shape's fill. Only hidden segments use `[4 * lineWidth, 4 * lineWidth]`; the upper outline stays solid.

The setting is persisted in prefs, autosave and exported JSON (`settings.overlapMode`). `Exporter.importJSON()` keeps its array return API and exposes the imported mode as the non-enumerable `elements.overlapMode` property. PNG/JPG call the coordinated renderer; SVG and hidden-mode HTML use the same overlap plan. Old autosaves (bare element arrays) and JSON without settings resolve to `normal`.

### Coordinate handling

Zoom is applied as a CSS `transform: scale()` on the canvas wrapper; `getPos()` in app.js divides mouse coordinates by `state.zoom` so element coordinates are always in unscaled canvas space. A `transform` does **not** grow the layout box, so `.canvas-area__sizer` wraps the canvas and `applyZoom` sets its width/height to `CANVAS_W/H * zoom`; the wrapper uses `transform-origin: top left` plus `width: fit-content` (without it the wrapper stretches to the already-scaled sizer and the transform scales it a second time). Keep all three in sync or the zoomed-in canvas becomes partly unreachable by scroll (see `BUGS.md`). `fitZoomToViewport()` auto-picks the largest zoom (floored to a 10% step, never below 100%) that fits `.canvas-area`'s available size, run on init and on window resize; it backs off permanently once the user touches the zoom slider (`zoomManual` flag), so manual choices are never overridden. `ZOOM_MIN`/`ZOOM_MAX` (0.3–3) bound both `applyZoom` and the auto-fit, and **must be kept in sync with the `#zoom-slider` min/max in index.html**.

### Canvas background / grid color

`state.canvasBg` and `state.gridColor` (defaults `DEFAULT_CANVAS_BG`/`DEFAULT_GRID_COLOR` in app.js) are cosmetic prefs, not part of `state.elements` — they persist to their own `localStorage` key (`sketchwire.prefs`, via `savePrefs`/`restorePrefs`) separately from the autosave, and are not undo-tracked (same treatment as `state.zoom`/`showGrid`). `Renderer.drawGrid(ctx, w, h, color)` takes a single base color and varies only `globalAlpha` for the minor vs. major grid lines, rather than two hardcoded colors. "Limpiar todo" resets both to their defaults, clears the prefs key and returns the zoom to 100% (setting `zoomManual` so the auto-fit does not immediately grow it again), in addition to clearing elements.
