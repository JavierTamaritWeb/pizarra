# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SketchWire ("pizarra") is a canvas-based wireframing/sketching web app with a hand-drawn aesthetic. Pure vanilla HTML/CSS/JS — no build system, no package manager, no dependencies, no tests. UI text is in Spanish.

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

`PLAN.md` holds the prioritized improvement roadmap (fases 1-3 completed, except §3.2 element-type registry, deliberately skipped as optional).

## Architecture

Scripts are plain `<script>` tags loaded in dependency order in `index.html` (config → sketchy → renderer → exporter → templates → app). There are no modules/imports — each file exposes a global (`TOOLS`, `Sketchy`, `Renderer`, `Exporter`, `Templates`) via IIFE, and later scripts rely on earlier globals. If you add a file, add its `<script>` tag in the right position.

The app is state-driven immediate-mode rendering: a single `state.elements` array of plain objects is the source of truth, and any change triggers a full canvas redraw (`redraw()` in app.js). Elements are serializable plain objects (this is what JSON export/import round-trips), so never store functions or DOM refs on them. They are also treated as immutable: operations replace the element object (`moveElement` returns a copy) rather than mutating it, which lets undo snapshots be shallow copies (`state.elements.slice()`) — preserve that discipline when adding features.

- `js/config.js` — global constants: `TOOLS` ids, `TOOL_GROUPS` (drives sidebar build), `COLORS`, `CANVAS_W/H` (1200×800), `UI_DEFAULTS` (fallback sizes for UI components placed with a tiny drag).
- `js/sketchy.js` — low-level "wobbly" hand-drawn primitives (line, rect, roundedRect, ellipse, arrow) using `Math.random()` jitter.
- `js/renderer.js` — `Renderer.renderElement(ctx, el)` switches on `el.type` and draws each element type (shapes via Sketchy, plus composite UI components: button, input, imagePlaceholder, nav, card). Also grid and selection highlight.
- `js/exporter.js` — export to PNG/JPG (offscreen canvas), SVG and HTML (hand-built markup strings per element type), and JSON (project format); JSON import via file picker.
- `js/templates.js` — predefined element arrays (landing, dashboard, form).
- `js/app.js` — main controller IIFE: holds `state`, wires all DOM events, mouse handlers (two-canvas setup: `main-canvas` for committed elements, `overlay-canvas` for in-progress previews), hit-testing/drag for the select tool, undo/redo (deep-cloned snapshots of `state.elements`), text input overlay, modals.

### Adding a new element type

Requires touching several files in sync: add the tool id to `TOOLS` and a sidebar entry in `TOOL_GROUPS` (config.js), a render case in `Renderer.renderElement`, creation logic in app.js `onMouseUp` (and `UI_DEFAULTS` if it's a UI component), bounds handling in `getElementBounds` (app.js) if it isn't x/y/w/h-shaped, and export cases in exporter.js for SVG and HTML (PNG/JPG reuse the Renderer automatically).

### Coordinate handling

Zoom is applied as a CSS `transform: scale()` on the canvas wrapper; `getPos()` in app.js divides mouse coordinates by `state.zoom` so element coordinates are always in unscaled canvas space.
