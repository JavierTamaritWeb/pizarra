/* ============================================================
   app.js — Main application controller
   ============================================================ */

;(function () {
  'use strict';

  /* ── State ── */

  const DEFAULT_CANVAS_BG = '#ffffff';
  const DEFAULT_GRID_COLOR = '#cdd3de';
  const ERASER_SIZE_MIN = 4;
  const ERASER_SIZE_MAX = 100;
  const DEFAULT_ERASER_SIZE = 16;
  // Ancho inicial de los caminos del jardín; los topes los pone src/js/garden.js
  // (Garden.PATH_W_MIN/MAX), que es también de donde sale el rango del slider.
  const DEFAULT_PATH_WIDTH = 34;

  // Defaults de creación de Edificios y Jardín (variantes de modal incluidas).
  // Una sola fuente para el estado inicial Y para «Limpiar todo»: el botón
  // promete la app recién abierta, y sin este reset el siguiente savePrefs()
  // re-persistía la media configuración que quedara viva en state.
  const CREATION_DEFAULTS = {
    plantaShape: 'rect', // forma de huella elegida en el modal de Planta (Edificios)
    doorType: 'door',    // tipo elegido en el modal de Puerta: door|arch|frame|archFrame
    windowType: 'window', // tipo elegido en el modal de Ventana: window|arch|frame|archFrame
    roofShape: 'gable',   // tipo elegido en el modal de Tejado: gable|mono|flat|hip|mansard
    facadeShape: 'flat',  // tipo elegido en el modal de Fachada: flat|gable|profile
    balconyType: 'balcony', // tipo elegido en el modal de Balcón (ver BALCONY_TYPES)
    buildFloors: 'auto', // nº de plantas de Fachada/Alzado/Perfil ('auto' = según la altura)
    buildBays: 'auto',   // ventanas por planta ('auto' = según el ancho)
    roofPitch: 0.36,     // fracción de altura del tejado en Alzado/Perfil (0.20–0.50)
    roofType: 'gable',   // cubierta del Alzado: gable (2 aguas) | hip (4 aguas) | mansard
    // Jardín: variante elegida en cada modal (defaults de creación, ver src/js/garden.js)
    plotShape: 'rect',   // parcela: rect|round|l|organic
    treeType: 'broadleaf',
    shrubType: 'bush',
    flowerType: 'daisy',
    decorType: 'pot',
    pathType: 'path',
    herbType: 'lavender',
    gardenLabels: true,  // rotular cada pieza con el nombre de su variante
    pathWidth: DEFAULT_PATH_WIDTH, // ancho de los caminos (el arrastre solo da el recorrido)
    pathAnyAngle: false, // caminos en cualquier inclinación: ajuste pegajoso, no tecla mantenida
  };

  const state = {
    tool:        TOOLS.PENCIL,
    color:       '#1a1a2e',
    lineWidth:   2,
    eraserSize:  DEFAULT_ERASER_SIZE,
    fontSize:    18,
    zoom:        1,
    fillShapes:  false,
    fillColor:   null,  // color de relleno; null = tinte translúcido del trazo
    fillTransparent: false, // usa fillOpacity en vez de relleno sólido
    fillOpacity: 0.4,   // opacidad del relleno translúcido (0..1)
    overlapMode: 'normal', // normal | hidden-dashed
    pendingEmoji: EMOJI_GROUPS[0].emojis[0], // el que se estampa con la herramienta Emoji
    ...CREATION_DEFAULTS, // Edificios/Jardín (los resetea también «Limpiar todo»)
    toolBeforeModal: null, // herramienta activa antes de abrir un modal de Edificios (restaurar al cancelar)
    variantChosen: false, // true si se eligió variante en el modal (no fue cancelación)
    doubleHead:  false, // nuevas flechas con punta en ambos extremos
    dashed:      false, // nuevas líneas/flechas con trazo discontinuo
    curveFlip:   false, // Shift durante el trazado: curva hacia el otro lado
    pathFreeAngle: false, // Shift durante el arrastre del camino: cualquier inclinación
    curveChain:  null,  // borrador por clics: { start, segments, style... }
    showGrid:    true,
    snapGrid:    false,
    multiSelect: false,      // «Los clics acumulan selección» (una mano; Shift = atajo)
    pendingUnselect: null,   // clic sin arrastre sobre algo seleccionado: se quita en mouseup
    canvasBg:    DEFAULT_CANVAS_BG,
    gridColor:   DEFAULT_GRID_COLOR,
    elements:    [],
    undoStack:   [],
    redoStack:   [],
    isDrawing:   false,
    startPos:    null,
    currentPath: [],
    selection:   [],    // índices seleccionados, ordenados
    editingIdx:  null,
    dragLast:    null,  // última posición durante un arrastre de selección
    dragSnapshot: null,
    didDrag:     false,
    marquee:     null,  // rectángulo de selección en curso {x1,y1,x2,y2}
    resizing:    null,  // resize en curso {corner, from, original, snapshot, did}
  };

  function setSelection(arr) {
    state.selection = [...new Set(arr)].sort((a, b) => a - b);
  }

  /* ── DOM refs ── */

  const $ = id => document.getElementById(id);

  const mainCanvas   = $('main-canvas');
  const overlayCanvas= $('overlay-canvas');
  const ctx          = mainCanvas.getContext('2d');
  const octx         = overlayCanvas.getContext('2d');
  const wrapper      = $('canvas-wrapper');
  const canvasSizer  = $('canvas-sizer');
  const canvasArea   = document.querySelector('.canvas-area');
  const textInput    = $('text-input');

  /* ── Utility ── */

  function getPos(e) {
    const rect = mainCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / state.zoom,
      y: (e.clientY - rect.top)  / state.zoom,
    };
  }

  const UNDO_LIMIT = 50;
  // "sketchwire" es el nombre antiguo de la app (hoy Pizarra): NO renombrar
  // estas claves, dejarían huérfanos el lienzo y las preferencias ya guardados
  const AUTOSAVE_KEY = 'sketchwire.autosave';
  const PREFS_KEY = 'sketchwire.prefs';
  const GRID_STEP = 20;

  function snapVal(v) {
    return Math.round(v / GRID_STEP) * GRID_STEP;
  }

  // Seed de jitter por elemento: serializable, sobrevive al export/import
  const newSeed = () => (Math.random() * 2 ** 31) | 0;

  function withSeeds(els) {
    // No solo `undefined`: un seed corrupto de un JSON manipulado (string,
    // null, NaN) haría a Sketchy caer a Math.random y el elemento temblaría
    // en cada redraw — justo el defecto que el seed existe para eliminar.
    return els.map(el => Number.isFinite(el.seed) ? el : { ...el, seed: newSeed() });
  }

  // Los elementos se tratan como inmutables (p. ej. moveElement devuelve una
  // copia), así que los snapshots pueden ser copias superficiales del array
  function snapshot() {
    return state.elements.slice();
  }

  function pushUndo(snap) {
    state.undoStack.push(snap);
    if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
    state.redoStack.length = 0;
  }

  function saveUndo() {
    pushUndo(snapshot());
  }

  function getElementBounds(el) {
    if (el.type === 'pencil' || el.type === 'eraser') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (el.type === 'line' || el.type === 'arrow' || el.type === 'curveArrow') {
      if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
        return CurvePath.bounds(el);
      }
      // La curva cuadrática queda dentro del casco convexo de sus 3 puntos,
      // así que incluir el control da un bbox seguro
      const xs = [el.x1, el.x2], ys = [el.y1, el.y2];
      if (el.type === 'curveArrow') {
        xs.push(el.cx); ys.push(el.cy);
        if (el.cx2 !== undefined) { xs.push(el.cx2); ys.push(el.cy2); }
      }
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (el.type === 'text') {
      const lines = el.value.split('\n');
      ctx.save();
      ctx.font = `${el.fontSize}px ${SKETCHY_FONT}`;
      const w = Math.max(...lines.map(ln => ctx.measureText(ln).width));
      ctx.restore();
      return { x: el.x, y: el.y, w, h: lines.length * (el.fontSize + 4) };
    }
    return { x: el.x, y: el.y, w: el.w, h: el.h };
  }

  /**
   * ¿Cae el punto dentro del bbox combinado de la selección (± el mismo
   * margen de 6px que usa el hit-test)? Base del arrastre en grupo.
   */
  function posInSelectionBounds(pos) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.selection.forEach(i => {
      const b = getElementBounds(state.elements[i]);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });
    return pos.x >= minX - 6 && pos.x <= maxX + 6 &&
           pos.y >= minY - 6 && pos.y <= maxY + 6;
  }

  // La geometría real vive en Eraser.distToSegment (js/eraser.js) — aquí solo
  // se adapta la firma a escalares, más cómoda para hitTest. Mantener una
  // copia propia era tener la misma fórmula dos veces esperando a divergir.
  const distToSegment = (p, x1, y1, x2, y2) =>
    Eraser.distToSegment(p, { x: x1, y: y1 }, { x: x2, y: y2 });

  function hitTest(pos) {
    for (let i = state.elements.length - 1; i >= 0; i--) {
      const el = state.elements[i];
      // Los trazos de borrador no son seleccionables
      if (el.type === 'eraser') continue;
      // Líneas y flechas: distancia al segmento, no bounding box
      if (el.type === 'line' || el.type === 'arrow') {
        if (distToSegment(pos, el.x1, el.y1, el.x2, el.y2) <= el.lineWidth / 2 + 6) return i;
        continue;
      }
      if (RegularPolygon.isType(el.type)) {
        const vertices = RegularPolygon.vertices(el);
        let hit = RegularPolygon.contains(pos, el);
        for (let v = 0; v < vertices.length && !hit; v++) {
          const a = vertices[v];
          const b = vertices[(v + 1) % vertices.length];
          hit = distToSegment(pos, a.x, a.y, b.x, b.y) <= el.lineWidth / 2 + 6;
        }
        if (hit) return i;
        continue;
      }
      if (el.type === TOOLS.TRAPEZOID) {
        const vertices = Trapezoid.vertices(el);
        let hit = Trapezoid.contains(pos, el);
        for (let v = 0; v < vertices.length && !hit; v++) {
          const a = vertices[v];
          const b = vertices[(v + 1) % vertices.length];
          hit = distToSegment(pos, a.x, a.y, b.x, b.y) <= el.lineWidth / 2 + 6;
        }
        if (hit) return i;
        continue;
      }
      // Flecha curva: distancia a la polilínea que muestrea la curva
      // (cuadrática o cúbica según tenga segundo control)
      if (el.type === 'curveArrow') {
        const sampled = CurvePath.sample(el, 20);
        let hit = false;
        for (let s = 1; s < sampled.length && !hit; s++) {
          hit = distToSegment(
            pos,
            sampled[s - 1].x, sampled[s - 1].y,
            sampled[s].x, sampled[s].y
          ) <= el.lineWidth / 2 + 6;
        }
        if (hit) return i;
        continue;
      }
      const b = getElementBounds(el);
      if (pos.x >= b.x - 6 && pos.x <= b.x + b.w + 6 &&
          pos.y >= b.y - 6 && pos.y <= b.y + b.h + 6) {
        return i;
      }
    }
    return -1;
  }

  // Índices de todas las piezas del mismo edificio que la del índice dado (o solo
  // [idx] si esa pieza no pertenece a ningún grupo). Permite seleccionar/mover/
  // duplicar/borrar un edificio como una unidad; Alt+click trata la pieza sola.
  function groupIndicesOf(idx) {
    const gid = state.elements[idx] && state.elements[idx].buildingGroupId;
    if (!gid) return [idx];
    const out = [];
    state.elements.forEach((el, i) => { if (el.buildingGroupId === gid) out.push(i); });
    return out;
  }

  // Si la selección es exactamente un edificio (≥2 piezas, todas del mismo grupo),
  // devuelve el bbox combinado para dibujar UNA sola caja de selección; si no, null.
  function selectionGroupBounds() {
    if (state.selection.length < 2) return null;
    const gid = state.elements[state.selection[0]].buildingGroupId;
    if (!gid || !state.selection.every(i => state.elements[i].buildingGroupId === gid)) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    state.selection.forEach(i => {
      const b = getElementBounds(state.elements[i]);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function moveElement(el, dx, dy) {
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      return CurvePath.move(el, dx, dy);
    }
    const m = { ...el };
    if (m.points) {
      m.points = m.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (m.x1 !== undefined) {
      m.x1 += dx; m.y1 += dy; m.x2 += dx; m.y2 += dy;
      if (m.cx !== undefined) { m.cx += dx; m.cy += dy; }
      if (m.cx2 !== undefined) { m.cx2 += dx; m.cy2 += dy; }
    } else {
      m.x = (m.x || 0) + dx;
      m.y = (m.y || 0) + dy;
    }
    return m;
  }

  /* ── Geometría de la flecha curva ── */

  /**
   * Control por defecto de una curveArrow: perpendicular a la cuerda al 25%
   * de su longitud. Con flip, hacia el otro lado.
   */
  function defaultCtrl(p1, p2, flip) {
    return CurvePath.defaultCtrl(p1, p2, flip);
  }

  /** Refleja el punto (px,py) respecto a la recta (x1,y1)–(x2,y2). */
  function reflectOverChord(px, py, x1, y1, dx, dy, len2) {
    const t = ((px - x1) * dx + (py - y1) * dy) / len2;
    const fx = x1 + dx * t, fy = y1 + dy * t;
    return { x: 2 * fx - px, y: 2 * fy - py };
  }

  /**
   * Copia de la curveArrow con el/los controles reflejados respecto a la
   * recta (x1,y1)–(x2,y2): invierte el lado del giro sin cambiar extremos.
   */
  function flipCurve(el) {
    if (CurvePath.isChain(el)) return CurvePath.flip(el);
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) return el; // extremos coincidentes: nada que reflejar
    const c1 = reflectOverChord(el.cx, el.cy, el.x1, el.y1, dx, dy, len2);
    const m = { ...el, cx: c1.x, cy: c1.y };
    if (el.cx2 !== undefined) {
      const c2 = reflectOverChord(el.cx2, el.cy2, el.x1, el.y1, dx, dy, len2);
      m.cx2 = c2.x; m.cy2 = c2.y;
    }
    return m;
  }

  /**
   * Copia de la curveArrow con los controles llevados por la transformación
   * de semejanza (traslación+rotación+escala) que mapea la cuerda vieja
   * `old{x1,y1,x2,y2}` a la actual de `el`: conserva el lado de la comba, la
   * forma en S y la intensidad relativa. Cuerda nueva degenerada → controles
   * intactos; cuerda vieja degenerada → controles reseteados al default.
   */
  function transformControlsToChord(el, old) {
    const odx = old.x2 - old.x1, ody = old.y2 - old.y1;
    const ndx = el.x2 - el.x1, ndy = el.y2 - el.y1;
    if (odx === ndx && ody === ndy && old.x1 === el.x1 && old.y1 === el.y1) return el;
    const oldLen2 = odx * odx + ody * ody;
    if (ndx * ndx + ndy * ndy < 1e-6) return el;
    if (oldLen2 < 1e-6) {
      if (el.arc === true) {
        const ctrls = ArcMath.arcCtrls(el.x1, el.y1, el.x2, el.y2, 0.5 * Math.hypot(ndx, ndy));
        if (ctrls) return { ...el, ...ctrls };
      }
      if (el.cx2 !== undefined) {
        return { ...el, ...defaultCubicCtrls(el, 0.25 * Math.hypot(ndx, ndy)) };
      }
      const c = defaultCtrl({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, false);
      return { ...el, cx: c.cx, cy: c.cy };
    }
    // r = (ndx + i·ndy) / (odx + i·ody), aplicado como z' = p1' + r·(z − p1)
    const a = (ndx * odx + ndy * ody) / oldLen2;
    const b = (ndy * odx - ndx * ody) / oldLen2;
    const map = (px, py) => ({
      x: el.x1 + a * (px - old.x1) - b * (py - old.y1),
      y: el.y1 + b * (px - old.x1) + a * (py - old.y1),
    });
    const c1 = map(el.cx, el.cy);
    const m = { ...el, cx: c1.x, cy: c1.y };
    if (el.cx2 !== undefined) {
      const c2 = map(el.cx2, el.cy2);
      m.cx2 = c2.x; m.cy2 = c2.y;
    }
    return m;
  }

  /**
   * Copia de la flecha con la dirección invertida: la punta pasa al otro
   * extremo. En cuadrática la curva es idéntica (solo cambia la
   * parametrización); en cúbica se intercambian también los controles.
   */
  function reverseArrow(el) {
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      let m = CurvePath.reverse(el);
      if (el.labelT !== undefined) m = { ...m, labelT: 1 - el.labelT };
      if (el.startAnchor !== undefined || el.endAnchor !== undefined) {
        m = { ...m, startAnchor: el.endAnchor, endAnchor: el.startAnchor };
        if (m.startAnchor === undefined) delete m.startAnchor;
        if (m.endAnchor === undefined) delete m.endAnchor;
      }
      return m;
    }
    const m = { ...el, x1: el.x2, y1: el.y2, x2: el.x1, y2: el.y1 };
    if (el.cx2 !== undefined) {
      m.cx = el.cx2; m.cy = el.cy2;
      m.cx2 = el.cx; m.cy2 = el.cy;
    }
    // La etiqueta se queda en el mismo punto físico del trazo
    if (el.labelT !== undefined) m.labelT = 1 - el.labelT;
    if (el.startAnchor !== undefined || el.endAnchor !== undefined) {
      m.startAnchor = el.endAnchor;
      m.endAnchor = el.startAnchor;
      if (m.startAnchor === undefined) delete m.startAnchor;
      if (m.endAnchor === undefined) delete m.endAnchor;
    }
    return m;
  }

  /**
   * Controles de la "S canónica" de una curveArrow cúbica: c1 al 25% de la
   * cuerda con offset lateral +s, c2 al 75% con −s (lados opuestos).
   */
  function defaultCubicCtrls(el, sVal) {
    const fr = chordFrame(el); // hoisted; null si la cuerda es degenerada
    const ux = fr ? fr.ux : 0, uy = fr ? fr.uy : 0;
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    return {
      cx:  el.x1 + dx * 0.25 + sVal * ux,
      cy:  el.y1 + dy * 0.25 + sVal * uy,
      cx2: el.x1 + dx * 0.75 - sVal * ux,
      cy2: el.y1 + dy * 0.75 - sVal * uy,
    };
  }

  /**
   * Copia de la curveArrow convertida en semicírculo de 180°: marca `arc` y
   * recomputa los controles cúbicos (ArcMath) con comba = cuerda/2,
   * conservando el lado actual de la curva. Cuerda degenerada → intacta.
   */
  function toArc(el) {
    const L = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
    const side = Math.sign(ArcMath.arcSagitta(el)) || 1;
    const ctrls = ArcMath.arcCtrls(el.x1, el.y1, el.x2, el.y2, side * L / 2);
    if (!ctrls) return el;
    return { ...el, ...ctrls, arc: true };
  }

  /**
   * Copia de un semicírculo con radio nuevo R: los extremos se reubican
   * sobre la dirección de la cuerda actual a ±R del punto medio (el
   * diámetro cambia, el centro no) y los controles se recomputan con
   * comba = ±R para conservar los 180°. `side` fuerza el lado (±1);
   * sin él se conserva el actual. Cuerda degenerada → intacta.
   */
  function resizeArc(el, R, side) {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return el;
    R = Math.max(ArcMath.MIN_SAGITTA, R);
    const dirX = dx / len, dirY = dy / len;
    const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
    const s = (side || Math.sign(ArcMath.arcSagitta(el)) || 1) * R;
    const x1 = mx - R * dirX, y1 = my - R * dirY;
    const x2 = mx + R * dirX, y2 = my + R * dirY;
    const ctrls = ArcMath.arcCtrls(x1, y1, x2, y2, s);
    if (!ctrls) return el;
    return { ...el, x1, y1, x2, y2, ...ctrls };
  }

  /**
   * Handles editables de una flecha seleccionada (nombre + posición + kind).
   * Los de curvatura ('ctrl') van primero para tener prioridad de click
   * sobre los de extremo ('end') cuando se solapan.
   */
  function arrowHandles(el) {
    const handles = [];
    // Handle de etiqueta primero: máxima prioridad de click (si ganara
    // 'ctrl', en curvas planas eclipsaría la etiqueta centrada; la curvatura
    // sigue ajustable con +/−, F y Shift)
    if ((el.type === 'arrow' || el.type === 'curveArrow') && el.label) {
      const lp = arrowLabelPoint(el);
      handles.push({ name: 'labelPos', x: lp.x, y: lp.y, kind: 'label' });
    }
    if (el.type === 'curveArrow') {
      if (CurvePath.isChain(el)) {
        CurvePath.segments(el).forEach((seg, index) => {
          handles.push({ name: `segCtrl:${index}`, x: seg.cx, y: seg.cy, kind: 'ctrl', segment: index });
          if (seg.cx2 !== undefined) {
            handles.push({ name: `segCtrl2:${index}`, x: seg.cx2, y: seg.cy2, kind: 'ctrl', segment: index });
          }
          if (index < el.segments.length - 1) {
            handles.push({ name: `segJoin:${index}`, x: seg.x2, y: seg.y2, kind: 'join', segment: index });
          }
        });
      } else {
        handles.push({ name: 'ctrl', x: el.cx, y: el.cy, kind: 'ctrl' });
        if (el.cx2 !== undefined) handles.push({ name: 'ctrl2', x: el.cx2, y: el.cy2, kind: 'ctrl' });
      }
    }
    if (el.type === 'arrow' || el.type === 'curveArrow') {
      handles.push({ name: 'p1', x: el.x1, y: el.y1, kind: 'end' });
      handles.push({ name: 'p2', x: el.x2, y: el.y2, kind: 'end' });
    }
    return handles;
  }

  /* ── Conectores anclados ── */

  const ANCHORABLE_TYPES = [
    TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE,
    TOOLS.SQUARE, TOOLS.TRAPEZOID, TOOLS.TRIANGLE, TOOLS.PENTAGON, TOOLS.HEXAGON,
    TOOLS.BUTTON, TOOLS.INPUT,
    TOOLS.IMAGE_PLACEHOLDER, TOOLS.IMAGE, TOOLS.NAV, TOOLS.CARD,
  ];
  const ANCHOR_THRESHOLD = 12;

  // Formas geométricas: las únicas que admiten relleno (los componentes UI
  // traen el suyo propio como parte de su diseño)
  const REGULAR_POLYGON_TYPES = [
    TOOLS.SQUARE, TOOLS.TRIANGLE, TOOLS.PENTAGON, TOOLS.HEXAGON,
  ];
  const FILLABLE_TYPES = [
    TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE, TOOLS.TRAPEZOID,
    ...REGULAR_POLYGON_TYPES,
  ];

  /** <input type="color"> solo acepta #rrggbb: recorta un eventual canal alfa
      (un color importado puede venir como #rrggbbaa y lo dejaría en negro). */
  const hex6 = c => String(c).slice(0, 7);

  function newId() {
    let id;
    do {
      id = Math.random().toString(36).slice(2, 8);
    } while (state.elements.some(el => el.id === id));
    return id;
  }

  /** Índice del elemento anclable bajo el punto (bbox ± umbral), o -1. */
  function findAnchorTarget(p, excludeIdx) {
    for (let i = state.elements.length - 1; i >= 0; i--) {
      if (i === excludeIdx) continue;
      const el = state.elements[i];
      if (!ANCHORABLE_TYPES.includes(el.type)) continue;
      if (p.x >= el.x - ANCHOR_THRESHOLD && p.x <= el.x + el.w + ANCHOR_THRESHOLD &&
          p.y >= el.y - ANCHOR_THRESHOLD && p.y <= el.y + el.h + ANCHOR_THRESHOLD) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Punto del perímetro del bbox en la dirección centro → from (también
   * cuando `from` cae dentro: se prolonga el rayo hasta el borde).
   */
  function rectEdgePoint(b, from) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dx = from.x - cx, dy = from.y - cy;
    if (!dx && !dy) return { x: cx, y: b.y };
    const t = Math.min(
      dx ? (b.w / 2) / Math.abs(dx) : Infinity,
      dy ? (b.h / 2) / Math.abs(dy) : Infinity
    );
    return { x: cx + dx * t, y: cy + dy * t };
  }

  /**
   * Materializa las coordenadas de los extremos anclados (estado derivado,
   * SIN saveUndo: los snapshots capturan lo materializado y el redraw
   * posterior a un undo re-resuelve). Si el ancla ya no existe, se quita el
   * anchor conservando las últimas coordenadas ("desanclar congelado").
   * En curveArrow, cuando la cuerda cambia los controles se re-proyectan con
   * transformControlsToChord para que la curva conserve su forma.
   * Reemplaza siempre por copias, nunca muta elementos.
   */
  function resolveAnchors() {
    let byId = null;
    for (let i = 0; i < state.elements.length; i++) {
      const el = state.elements[i];
      if ((el.type !== 'arrow' && el.type !== 'curveArrow') ||
          (!el.startAnchor && !el.endAnchor)) continue;
      // Defensa ante un JSON importado con ambos extremos al mismo elemento:
      // resolver los dos los colapsaría; se deja tal cual (la UI ya no lo crea).
      if (el.startAnchor && el.endAnchor && el.startAnchor.id === el.endAnchor.id) continue;
      if (!byId) {
        byId = new Map();
        state.elements.forEach(t => {
          if (t.id && ANCHORABLE_TYPES.includes(t.type) && !byId.has(t.id)) {
            byId.set(t.id, { x: t.x, y: t.y, w: t.w, h: t.h });
          }
        });
      }
      let m = state.elements[i];
      const old = { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2 };
      const apply = (key, xKey, yKey, oxKey, oyKey) => {
        const a = m[key];
        if (!a) return;
        const b = byId.get(a.id);
        if (!b) {
          m = { ...m };
          delete m[key];
          return;
        }
        const pt = rectEdgePoint(b, { x: m[oxKey], y: m[oyKey] });
        if (Math.abs(pt.x - m[xKey]) > 0.5 || Math.abs(pt.y - m[yKey]) > 0.5) {
          m = { ...m, [xKey]: pt.x, [yKey]: pt.y };
        }
      };
      apply('startAnchor', 'x1', 'y1', 'x2', 'y2');
      apply('endAnchor', 'x2', 'y2', 'x1', 'y1');
      if (m !== state.elements[i]) {
        // La cuerda cambió: re-proyectar los controles para conservar la forma
        if (m.type === 'curveArrow' && CurvePath.isChain(m)) {
          let chained = state.elements[i];
          if (m.x1 !== old.x1 || m.y1 !== old.y1) {
            chained = CurvePath.withEndpoint(chained, 'start', { x: m.x1, y: m.y1 });
          }
          if (m.x2 !== old.x2 || m.y2 !== old.y2) {
            chained = CurvePath.withEndpoint(chained, 'end', { x: m.x2, y: m.y2 });
          }
          m = { ...chained, startAnchor: m.startAnchor, endAnchor: m.endAnchor };
          if (m.startAnchor === undefined) delete m.startAnchor;
          if (m.endAnchor === undefined) delete m.endAnchor;
        } else if (m.type === 'curveArrow') {
          m = transformControlsToChord(m, old);
        }
        state.elements[i] = m;
      }
    }
  }

  /** Ancla el extremo dado de una flecha recién creada si cae sobre un anclable. */
  function attachAnchorOnCreate(el, key, p) {
    const idx = findAnchorTarget(p);
    if (idx < 0) return;
    let target = state.elements[idx];
    // No anclar los dos extremos al mismo elemento (colapsaría la flecha)
    const otherKey = key === 'startAnchor' ? 'endAnchor' : 'startAnchor';
    const other = el[otherKey];
    if (other && target.id && other.id === target.id) return;
    if (!target.id) {
      target = { ...target, id: newId() };
      state.elements[idx] = target;
    }
    el[key] = { id: target.id };
  }

  /**
   * Perpendicular unitaria y punto medio de la cuerda de una curveArrow
   * (o null si la cuerda es degenerada). Base de F2: proyección del control
   * sobre la mediatriz y ajuste con +/−.
   */
  function chordFrame(el) {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
    const len = Math.hypot(dx, dy);
    if (!len) return null;
    return {
      ux: -dy / len, uy: dx / len,
      mx: (el.x1 + el.x2) / 2, my: (el.y1 + el.y2) / 2,
    };
  }

  /**
   * Punto del trazo de una flecha en el parámetro t ∈ [0,1]: Bézier cúbica o
   * cuadrática para curveArrow, interpolación lineal para arrow/line.
   */
  function arrowPointAt(el, t) {
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      return CurvePath.pointAt(el, t);
    }
    const mt = 1 - t;
    if (el.type === 'curveArrow') {
      if (el.cx2 !== undefined) {
        // Cúbica: B(t) = mt³·p1 + 3·mt²·t·c1 + 3·mt·t²·c2 + t³·p2
        return {
          x: mt * mt * mt * el.x1 + 3 * mt * mt * t * el.cx + 3 * mt * t * t * el.cx2 + t * t * t * el.x2,
          y: mt * mt * mt * el.y1 + 3 * mt * mt * t * el.cy + 3 * mt * t * t * el.cy2 + t * t * t * el.y2,
        };
      }
      // Cuadrática: Q(t) = mt²·p1 + 2·mt·t·c + t²·p2
      return {
        x: mt * mt * el.x1 + 2 * mt * t * el.cx + t * t * el.x2,
        y: mt * mt * el.y1 + 2 * mt * t * el.cy + t * t * el.y2,
      };
    }
    return { x: mt * el.x1 + t * el.x2, y: mt * el.y1 + t * el.y2 };
  }

  /** Punto donde se centra la etiqueta de la flecha (labelT, por defecto 0.5). */
  function arrowLabelPoint(el) {
    return arrowPointAt(el, el.labelT !== undefined ? el.labelT : 0.5);
  }

  /**
   * Parámetro t del punto del trazo más cercano a `p`: muestrea N tramos y
   * proyecta sobre cada segmento (t fraccional → arrastre continuo).
   */
  function nearestTOnArrow(el, p, N = 40) {
    let bestT = 0.5, bestD = Infinity;
    let prev = el.type === 'curveArrow' ? CurvePath.start(el) : { x: el.x1, y: el.y1 };
    for (let s = 1; s <= N; s++) {
      const q = arrowPointAt(el, s / N);
      const dx = q.x - prev.x, dy = q.y - prev.y;
      const len2 = dx * dx + dy * dy;
      let u = len2 ? ((p.x - prev.x) * dx + (p.y - prev.y) * dy) / len2 : 0;
      u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(p.x - (prev.x + dx * u), p.y - (prev.y + dy * u));
      if (d < bestD) { bestD = d; bestT = (s - 1 + u) / N; }
      prev = q;
    }
    return bestT;
  }

  /* ── Autosave ── */

  let autosaveTimer = null;

  function saveAutosaveNow() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        elements: state.elements,
        settings: { overlapMode: state.overlapMode },
      }));
    } catch (_) { /* almacenamiento lleno o bloqueado: se ignora */ }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      saveAutosaveNow();
      pruneImageCache();
    }, 500);
  }

  // Un cambio hecho <0,5s antes de cerrar la pestaña se perdía: el debounce
  // seguía pendiente. pagehide (y no beforeunload, que no corre al entrar en
  // bfcache) dispara el guardado pendiente en el acto; guardar de más es
  // idempotente, así que no hace falta mirar si el timer estaba vivo.
  window.addEventListener('pagehide', saveAutosaveNow);

  /** Poda la caché de imágenes del Renderer: sobreviven los `src` de la
      escena y del historial (deshacer debe repintar sin recargar). Va a
      remolque del autosave — ya debounced, y justo cuando la escena cambió. */
  function pruneImageCache() {
    const live = new Set();
    const collect = els => els.forEach(el => {
      if (el.type === 'image' && el.src) live.add(el.src);
    });
    collect(state.elements);
    state.undoStack.forEach(collect);
    state.redoStack.forEach(collect);
    Renderer.pruneImageCache(live);
  }

  function restoreAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        // Formato histórico: solo el array de elementos.
        state.elements = saved.filter(Exporter.isValidElement);
      } else if (saved && Array.isArray(saved.elements)) {
        state.elements = saved.elements.filter(Exporter.isValidElement);
        if (saved.settings && ['normal', 'hidden-dashed'].includes(saved.settings.overlapMode)) {
          state.overlapMode = saved.settings.overlapMode;
        }
      }
    } catch (_) { /* autosave corrupto: se ignora */ }
  }

  // Solo longitudes hex válidas en CSS (3/4/6/8): {3,8} aceptaba #abcde,
  // que el canvas ignora en silencio y desincroniza los pickers de prefs.
  const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        canvasBg: state.canvasBg,
        gridColor: state.gridColor,
        overlapMode: state.overlapMode,
        eraserSize: state.eraserSize,
        buildFloors: state.buildFloors,
        buildBays: state.buildBays,
        roofPitch: state.roofPitch,
        roofType: state.roofType,
        // Variantes elegidas en los modales de Edificios: son defaults de
        // creación igual que los de arriba, así que persisten igual (si no,
        // media configuración de Edificios sobrevive a la recarga y media no).
        plantaShape: state.plantaShape,
        facadeShape: state.facadeShape,
        roofShape: state.roofShape,
        doorType: state.doorType,
        windowType: state.windowType,
        balconyType: state.balconyType,
        // Variantes de Jardín, por el mismo motivo.
        plotShape: state.plotShape,
        treeType: state.treeType,
        shrubType: state.shrubType,
        flowerType: state.flowerType,
        decorType: state.decorType,
        pathType: state.pathType,
        herbType: state.herbType,
        gardenLabels: state.gardenLabels,
        pathWidth: state.pathWidth,
        pathAnyAngle: state.pathAnyAngle,
      }));
    } catch (_) { /* almacenamiento lleno o bloqueado: se ignora */ }
  }

  function restorePrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (!prefs || typeof prefs !== 'object') return;
      if (HEX_RE.test(prefs.canvasBg)) state.canvasBg = prefs.canvasBg;
      if (HEX_RE.test(prefs.gridColor)) state.gridColor = prefs.gridColor;
      if (['normal', 'hidden-dashed'].includes(prefs.overlapMode)) {
        state.overlapMode = prefs.overlapMode;
      }
      if (Number.isFinite(prefs.eraserSize)) {
        state.eraserSize = Math.min(
          ERASER_SIZE_MAX,
          Math.max(ERASER_SIZE_MIN, prefs.eraserSize),
        );
      }
      if (prefs.buildFloors === 'auto' || (Number.isFinite(prefs.buildFloors) && prefs.buildFloors >= 1)) {
        state.buildFloors = prefs.buildFloors;
      }
      if (prefs.buildBays === 'auto' || (Number.isFinite(prefs.buildBays) && prefs.buildBays >= 1)) {
        state.buildBays = prefs.buildBays;
      }
      if (Number.isFinite(prefs.roofPitch) && prefs.roofPitch >= 0.1 && prefs.roofPitch <= 0.6) {
        state.roofPitch = prefs.roofPitch;
      }
      if (['gable', 'hip', 'mansard'].includes(prefs.roofType)) {
        state.roofType = prefs.roofType;
      }
      // Variantes de los modales: se validan contra su propio catálogo, así
      // que un id desconocido (prefs de otra versión) se ignora sin romper.
      const restoreVariant = (value, catalog, key) => {
        if (catalog.some(item => item.id === value)) state[key] = value;
      };
      restoreVariant(prefs.plantaShape, PLANTA_SHAPES, 'plantaShape');
      restoreVariant(prefs.facadeShape, FACADE_TYPES, 'facadeShape');
      restoreVariant(prefs.roofShape,   ROOF_TYPES,    'roofShape');
      restoreVariant(prefs.doorType,    DOOR_TYPES,    'doorType');
      restoreVariant(prefs.windowType,  WINDOW_TYPES,  'windowType');
      restoreVariant(prefs.balconyType, BALCONY_TYPES, 'balconyType');
      restoreVariant(prefs.plotShape,   PLOT_SHAPES,   'plotShape');
      restoreVariant(prefs.treeType,    TREE_TYPES,    'treeType');
      restoreVariant(prefs.shrubType,   SHRUB_TYPES,   'shrubType');
      restoreVariant(prefs.flowerType,  FLOWER_TYPES,  'flowerType');
      restoreVariant(prefs.decorType,   DECOR_TYPES,   'decorType');
      restoreVariant(prefs.pathType,    PATH_TYPES,    'pathType');
      restoreVariant(prefs.herbType,    HERB_TYPES,    'herbType');
      if (typeof prefs.gardenLabels === 'boolean') state.gardenLabels = prefs.gardenLabels;
      if (Number.isFinite(prefs.pathWidth)) {
        state.pathWidth = Math.min(Garden.PATH_W_MAX, Math.max(Garden.PATH_W_MIN, prefs.pathWidth));
      }
      if (typeof prefs.pathAnyAngle === 'boolean') state.pathAnyAngle = prefs.pathAnyAngle;
    } catch (_) { /* prefs corruptas: se ignoran */ }
  }

  /* ── Zoom ── */

  // Límites del zoom: deben coincidir con min/max del #zoom-slider
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;

  // true en cuanto el usuario toca el slider: a partir de ahí el ajuste
  // automático al redimensionar la ventana deja de tocar el zoom.
  let zoomManual = false;

  function applyZoom(z) {
    // Se acota antes de repartirlo: slider, etiqueta y transform deben
    // mostrar siempre el mismo valor que acaba en state.zoom
    state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    const pct = Math.round(state.zoom * 100);
    $('zoom-slider').value = pct;
    $('zoom-val').textContent = pct;
    wrapper.style.transform = `scale(${state.zoom})`;
    // El transform no cambia la caja de layout: el sizer la iguala al tamaño
    // pintado para que todo el lienzo siga siendo alcanzable con scroll
    if (canvasSizer) {
      canvasSizer.style.width  = `${CANVAS_W * state.zoom}px`;
      canvasSizer.style.height = `${CANVAS_H * state.zoom}px`;
    }
  }

  // Calcula el mayor zoom (múltiplo de 10%, entre los límites del slider)
  // que sigue cabiendo en el área visible del lienzo, para aprovechar
  // pantallas anchas sin que el usuario tenga que subir el zoom a mano.
  function fitZoomToViewport() {
    if (!canvasArea) return;
    const rect = canvasArea.getBoundingClientRect();
    const PAD = 24; // margen alrededor del lienzo dentro del área
    const availW = rect.width - PAD;
    const availH = rect.height - PAD;
    if (availW <= 0 || availH <= 0) return;
    let z = Math.min(availW / CANVAS_W, availH / CANVAS_H);
    // Nunca reduce por debajo del 100% (pantallas estrechas siguen como
    // antes, con scroll); solo agranda cuando sobra espacio.
    z = Math.min(ZOOM_MAX, Math.max(1, z));
    z = Math.floor(z * 10) / 10; // pasos del 10%, igual que el slider (a la baja: no desbordar)
    applyZoom(z);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (zoomManual) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitZoomToViewport, 150);
  });

  /* ── Full redraw (coalescido vía requestAnimationFrame) ── */

  let redrawPending = false;

  function redraw() {
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      redrawPending = false;
      redrawNow();
    });
  }

  /** Lo que Eraser necesita de fuera: bounds reales y siluetas de las formas
      con vértices, para que borrar coincida con lo que un clic seleccionaría. */
  const eraserDeps = () => ({
    boundsOf: getElementBounds,
    sampleCurve: (el, n) => CurvePath.sample(el, n),
    polygonVertices: el => (RegularPolygon.isType(el.type) ? RegularPolygon.vertices(el) : null),
    trapezoidVertices: el => (el.type === TOOLS.TRAPEZOID ? Trapezoid.vertices(el) : null),
  });

  function redrawNow() {
    resolveAnchors();
    // Previsualización del borrador: lo que la pasada va a eliminar o recortar
    // ya cambia mientras se arrastra, así que lo que se ve durante el gesto es
    // exactamente el resultado. El estado no se toca hasta soltar (undo sigue
    // siendo un único paso por pasada).
    const sceneElements = state.isDrawing &&
      state.tool === TOOLS.ERASER &&
      state.currentPath.length
      ? Eraser.erase(state.elements, state.currentPath, state.eraserSize / 2, eraserDeps())
      : state.elements;
    try {
      Renderer.renderScene(ctx, sceneElements, {
        background: state.canvasBg,
        showGrid: state.showGrid,
        gridColor: state.gridColor,
        overlapMode: state.overlapMode,
      });
    } catch (err) {
      console.warn('No se pudo renderizar la escena:', err);
    }
    // Sanea índices que hayan quedado fuera de rango y dibuja la selección
    // (handles de resize solo con un único elemento seleccionado)
    state.selection = state.selection.filter(i => state.elements[i]);
    const single = state.selection.length === 1;
    const groupBox = selectionGroupBounds();
    if (groupBox) {
      // Edificio seleccionado como unidad: una sola caja combinada (sin handles).
      Renderer.drawSelection(ctx, groupBox, false);
    } else {
      state.selection.forEach(i => {
        const el = state.elements[i];
        // Las flechas usan handles de extremo/curvatura, no esquinas de escala
        const isArrow = el.type === 'arrow' || el.type === 'curveArrow';
        Renderer.drawSelection(ctx, getElementBounds(el), single && !isArrow);
      });
    }
    // Handles de flecha: curvatura (turquesa, con polilínea de control como
    // guía) y extremos (naranja, arrastrables para mover/anclar)
    if (single) {
      const sel = state.elements[state.selection[0]];
      const handles = arrowHandles(sel);
      if (handles.length) {
        const ctrls = handles.filter(h => h.kind === 'ctrl');
        ctx.save();
        if (ctrls.length) {
          ctx.strokeStyle = '#4ecdc4';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          if (sel.type === 'curveArrow' && CurvePath.isChain(sel)) {
            CurvePath.segments(sel).forEach(seg => {
              ctx.beginPath();
              ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.cx, seg.cy);
              if (seg.cx2 !== undefined) ctx.lineTo(seg.cx2, seg.cy2);
              ctx.lineTo(seg.x2, seg.y2);
              ctx.stroke();
            });
          } else {
            ctx.beginPath();
            ctx.moveTo(sel.x1, sel.y1);
            ctrls.forEach(h => ctx.lineTo(h.x, h.y));
            ctx.lineTo(sel.x2, sel.y2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        handles.forEach(h => {
          if (h.kind === 'label') {
            // Etiqueta: cuadrado violeta, distinguible de los círculos
            ctx.fillStyle = '#9b59b6';
            ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
            return;
          }
          ctx.fillStyle = h.kind === 'ctrl' ? '#4ecdc4' :
                          h.kind === 'join' ? '#9b59b6' : '#f39c12';
          ctx.beginPath();
          ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }
    // Feedback de anclaje: resaltar el candidato bajo el extremo arrastrado
    if (state.resizing && state.resizing.anchorCandidate >= 0) {
      const t = state.elements[state.resizing.anchorCandidate];
      if (t) {
        ctx.save();
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.strokeRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
        ctx.restore();
      }
    }
    $('el-count').textContent = state.elements.length;
    // Único punto que sincroniza la UI dependiente de la selección
    const hasSel = state.selection.length > 0;
    $('btn-delete-sel').hidden = !hasSel;
    $('btn-duplicate-sel').hidden = !hasSel;
    const rotatable = state.selection.filter(i => ShapeRotation.isType(state.elements[i].type));
    const rotateBtn = $('btn-rotate-sel');
    rotateBtn.hidden = rotatable.length === 0;
    rotateBtn.textContent = rotatable.length === 1 && state.selection.length === 1
      ? `↻ Rotar ${ShapeRotation.step(state.elements[rotatable[0]].type)}°`
      : '↻ Rotar selección';
    // Semántica dual de los controles del panel: con selección única muestran
    // los valores del elemento; sin selección, los defaults de creación.
    // (Con multi-selección no se tocan: conservan lo último mostrado.)
    if (single) {
      const sel = state.elements[state.selection[0]];
      $('stroke-label').textContent = 'Trazo';
      $('stroke-slider').min = '1';
      $('stroke-slider').max = '8';
      $('stroke-slider').setAttribute('aria-label', 'Grosor del trazo');
      $('stroke-slider').value = sel.lineWidth;
      $('stroke-val').textContent = String(sel.lineWidth);
      if (sel.type === 'arrow' || sel.type === 'curveArrow') {
        $('check-double-head').checked = sel.heads === 'both';
      }
      if (sel.type === 'line' || sel.type === 'arrow' || sel.type === 'curveArrow') {
        $('check-dash').checked = sel.dash === true;
      }
      if (FILLABLE_TYPES.includes(sel.type)) {
        $('check-fill').checked = sel.fill === true;
        $('check-fill-transparent').checked = sel.fillTransparent === true;
        const opacity = sel.fillOpacity !== undefined ? sel.fillOpacity : 0.4;
        $('fill-opacity-slider').value = Math.round(opacity * 100);
        $('fill-opacity-val').textContent = String(Math.round(opacity * 100));
        $('fill-opacity-slider').disabled = sel.fillTransparent !== true;
        // Sin fillColor propio el relleno es el tinte del trazo: se muestra
        // ese color como punto de partida del picker
        $('fill-color-picker').value = hex6(sel.fillColor || sel.color);
      }
    } else if (!hasSel) {
      const erasing = state.tool === TOOLS.ERASER;
      $('stroke-label').textContent = erasing ? 'Tamaño del borrador' : 'Trazo';
      $('btn-eraser-size').hidden = !erasing;
      $('stroke-slider').min = erasing ? String(ERASER_SIZE_MIN) : '1';
      $('stroke-slider').max = erasing ? String(ERASER_SIZE_MAX) : '8';
      $('stroke-slider').setAttribute(
        'aria-label',
        erasing ? 'Tamaño del borrador' : 'Grosor del trazo',
      );
      $('stroke-slider').value = erasing ? state.eraserSize : state.lineWidth;
      $('stroke-val').textContent = String(erasing ? state.eraserSize : state.lineWidth);
      $('check-double-head').checked = state.doubleHead;
      $('check-dash').checked = state.dashed;
      $('check-fill').checked = state.fillShapes;
      $('check-fill-transparent').checked = state.fillTransparent;
      $('fill-opacity-slider').value = Math.round(state.fillOpacity * 100);
      $('fill-opacity-val').textContent = String(Math.round(state.fillOpacity * 100));
      $('fill-opacity-slider').disabled = !state.fillTransparent;
      $('fill-color-picker').value = hex6(state.fillColor || state.color);
    }
    scheduleAutosave();
  }

  /* ── Canvas events ── */

  const MIN_CURVE_SEGMENT = 4;

  function snappedPoint(pos, e) {
    return state.snapGrid && !e.altKey
      ? { x: snapVal(pos.x), y: snapVal(pos.y) }
      : pos;
  }

  function curveChainLastPoint() {
    const draft = state.curveChain;
    if (!draft || !draft.segments.length) return draft ? draft.start : null;
    const last = draft.segments[draft.segments.length - 1];
    return { x: last.x2, y: last.y2 };
  }

  function newCurveChainSegment(from, to, flip) {
    const c = defaultCtrl(from, to, flip);
    return { x1: from.x, y1: from.y, cx: c.cx, cy: c.cy, x2: to.x, y2: to.y };
  }

  function cancelCurveChain() {
    state.curveChain = null;
    state.isDrawing = false;
    state.startPos = null;
    lastPos = null;
    octx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function finishCurveChain() {
    const draft = state.curveChain;
    if (!draft || !draft.segments.length) return false;
    const first = draft.segments[0];
    const last = draft.segments[draft.segments.length - 1];
    const el = {
      type: TOOLS.CURVE_ARROW,
      x1: first.x1, y1: first.y1,
      x2: last.x2, y2: last.y2,
      segments: draft.segments.map(seg => ({ ...seg })),
      color: draft.color,
      lineWidth: draft.lineWidth,
      seed: draft.seed,
    };
    if (draft.heads) el.heads = draft.heads;
    if (draft.dash) el.dash = true;
    saveUndo();
    state.elements.push(el);
    attachAnchorOnCreate(el, 'startAnchor', { x: first.x1, y: first.y1 });
    attachAnchorOnCreate(el, 'endAnchor', { x: last.x2, y: last.y2 });
    cancelCurveChain();
    redraw();
    return true;
  }

  /* ── Resize con handles (selección única) ── */

  const HANDLE_HIT = 8;

  // Los handles se dibujan en las esquinas del marco de selección (bounds ± 4)
  function handleCorners(b) {
    return {
      nw: { x: b.x - 4,       y: b.y - 4 },
      ne: { x: b.x + b.w + 4, y: b.y - 4 },
      sw: { x: b.x - 4,       y: b.y + b.h + 4 },
      se: { x: b.x + b.w + 4, y: b.y + b.h + 4 },
    };
  }

  function hitHandle(pos, b) {
    const cs = handleCorners(b);
    for (const key of Object.keys(cs)) {
      if (Math.abs(pos.x - cs[key].x) <= HANDLE_HIT && Math.abs(pos.y - cs[key].y) <= HANDLE_HIT) return key;
    }
    return null;
  }

  /**
   * Reubica un elemento del rectángulo `from` al rectángulo `to`.
   * pencil/eraser escalan sus points; line/arrow mueven sus extremos;
   * text escala fontSize con la altura; el resto mapea x/y/w/h.
   */
  function scaleElement(el, from, to) {
    const sx = from.w ? to.w / from.w : 1;
    const sy = from.h ? to.h / from.h : 1;
    const mapX = v => to.x + (v - from.x) * sx;
    const mapY = v => to.y + (v - from.y) * sy;
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      return CurvePath.scale(el, mapX, mapY);
    }
    const m = { ...el };
    if (m.points) {
      m.points = m.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
    } else if (m.x1 !== undefined) {
      m.x1 = mapX(m.x1); m.y1 = mapY(m.y1);
      m.x2 = mapX(m.x2); m.y2 = mapY(m.y2);
      if (m.cx !== undefined) { m.cx = mapX(m.cx); m.cy = mapY(m.cy); }
      if (m.cx2 !== undefined) { m.cx2 = mapX(m.cx2); m.cy2 = mapY(m.cy2); }
    } else if (m.type === 'text') {
      m.x = to.x; m.y = to.y;
      m.fontSize = Math.max(8, Math.round(m.fontSize * sy));
    } else {
      m.x = to.x; m.y = to.y; m.w = to.w; m.h = to.h;
    }
    return m;
  }

  function resizeTo(pos, e) {
    const r = state.resizing;
    const p = (state.snapGrid && !e.altKey) ? { x: snapVal(pos.x), y: snapVal(pos.y) } : pos;
    // Handles de extremo (p1/p2): mueven ese extremo; durante el arrastre se
    // suelta el anclaje de ese lado (para que siga al puntero) y se registra
    // el candidato bajo el cursor para re-anclar al soltar
    if (r.corner === 'p1' || r.corner === 'p2') {
      let copy = { ...r.original };
      if (copy.type === 'curveArrow' && CurvePath.isChain(copy)) {
        const which = r.corner === 'p1' ? 'start' : 'end';
        copy = CurvePath.withEndpoint(copy, which, p);
        delete copy[which === 'start' ? 'startAnchor' : 'endAnchor'];
        state.elements[state.selection[0]] = copy;
        r.anchorCandidate = findAnchorTarget(p, state.selection[0]);
        r.did = true;
        return;
      }
      if (r.corner === 'p1') {
        delete copy.startAnchor;
        copy.x1 = p.x;
        copy.y1 = p.y;
      } else {
        delete copy.endAnchor;
        copy.x2 = p.x;
        copy.y2 = p.y;
      }
      if (copy.type === 'curveArrow') copy = transformControlsToChord(copy, r.original);
      state.elements[state.selection[0]] = copy;
      r.anchorCandidate = findAnchorTarget(p, state.selection[0]);
      r.did = true;
      return;
    }

    if (r.corner.startsWith('segCtrl:') || r.corner.startsWith('segCtrl2:')) {
      const second = r.corner.startsWith('segCtrl2:');
      const index = Number(r.corner.split(':')[1]);
      state.elements[state.selection[0]] =
        CurvePath.withControl(r.original, index, p, second);
      r.did = true;
      return;
    }

    if (r.corner.startsWith('segJoin:')) {
      const index = Number(r.corner.split(':')[1]);
      state.elements[state.selection[0]] = CurvePath.withJoin(r.original, index, p);
      r.did = true;
      return;
    }

    // Handles de curvatura: mueven solo su punto de control
    if (r.corner === 'ctrl' || r.corner === 'ctrl2') {
      // Semicírculo (siempre 180°): el arrastre de cualquiera de los dos
      // controles cambia el RADIO — distancia del puntero al centro del
      // diámetro — y el lado; los extremos se reubican sobre la dirección
      // de la cuerda, así que se sueltan los anclajes como al arrastrar
      // un extremo
      if (r.original.arc === true) {
        const fr = chordFrame(r.original);
        if (fr) {
          const R = Math.hypot(p.x - fr.mx, p.y - fr.my);
          const side = Math.sign((p.x - fr.mx) * fr.ux + (p.y - fr.my) * fr.uy) || 1;
          const copy = resizeArc(r.original, R, side);
          if (copy !== r.original) {
            delete copy.startAnchor;
            delete copy.endAnchor;
            state.elements[state.selection[0]] = copy;
            r.did = true;
          }
        }
        return;
      }
      let cp = p;
      // Shift: restringe el control a la mediatriz de la cuerda → arcos
      // simétricos, solo cambia la intensidad (puede cruzar al otro lado).
      // Solo tiene sentido en cuadrática (en cúbica no hace nada).
      if (e.shiftKey && r.corner === 'ctrl' && r.original.cx2 === undefined) {
        const fr = chordFrame(r.original);
        if (fr) {
          const sVal = (p.x - fr.mx) * fr.ux + (p.y - fr.my) * fr.uy;
          cp = { x: fr.mx + sVal * fr.ux, y: fr.my + sVal * fr.uy };
        }
      }
      state.elements[state.selection[0]] = r.corner === 'ctrl'
        ? { ...r.original, cx: cp.x, cy: cp.y }
        : { ...r.original, cx2: cp.x, cy2: cp.y };
      r.did = true;
      return;
    }

    // Handle de etiqueta: desliza labelT por el trazo (pos crudo, el snap a
    // rejilla no tiene sentido sobre un parámetro t)
    if (r.corner === 'labelPos') {
      let t = nearestTOnArrow(r.original, pos);
      t = Math.max(0.05, Math.min(0.95, t));
      const copy = { ...r.original };
      if (Math.abs(t - 0.5) < 0.03) delete copy.labelT; // imán al centro → JSON canónico
      else copy.labelT = t;
      state.elements[state.selection[0]] = copy;
      r.did = true;
      return;
    }
    const f = r.from;
    let x1 = f.x, y1 = f.y, x2 = f.x + f.w, y2 = f.y + f.h;
    if (r.corner.includes('w')) x1 = p.x;
    if (r.corner.includes('e')) x2 = p.x;
    if (r.corner.includes('n')) y1 = p.y;
    if (r.corner.includes('s')) y2 = p.y;
    let to = {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    };
    if (REGULAR_POLYGON_TYPES.includes(r.original.type)) {
      const fixed = {
        nw: { x: f.x + f.w, y: f.y + f.h },
        ne: { x: f.x,       y: f.y + f.h },
        sw: { x: f.x + f.w, y: f.y },
        se: { x: f.x,       y: f.y },
      }[r.corner];
      const dx = p.x - fixed.x, dy = p.y - fixed.y;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      const defaultSignX = r.corner.includes('w') ? -1 : 1;
      const defaultSignY = r.corner.includes('n') ? -1 : 1;
      const moving = {
        x: fixed.x + (Math.sign(dx) || defaultSignX) * size,
        y: fixed.y + (Math.sign(dy) || defaultSignY) * size,
      };
      to = {
        x: Math.min(fixed.x, moving.x),
        y: Math.min(fixed.y, moving.y),
        w: size,
        h: size,
      };
    }
    // Tamaño mínimo, salvo en dimensiones que ya eran 0 (líneas rectas)
    if ((f.w > 0 && to.w < 10) || (f.h > 0 && to.h < 10)) return;
    state.elements[state.selection[0]] = scaleElement(r.original, f, to);
    r.did = true;
  }

  function onMouseDown(e) {
    const pos = getPos(e);

    // Una cadena ya iniciada consume cada nuevo clic como otro tramo.
    if (state.tool === TOOLS.CURVE_ARROW && state.curveChain) {
      state.isDrawing = true;
      state.startPos = pos;
      state.curveFlip = e.shiftKey;
      return;
    }

    // SELECT tool
    if (state.tool === TOOLS.SELECT) {
      // 1. Handles de resize (antes que el hit-test de elementos)
      if (state.selection.length === 1) {
        const selEl = state.elements[state.selection[0]];
        // Handles de flecha (curvatura; el commit de conectores añade extremos)
        for (const h of arrowHandles(selEl)) {
          if (Math.hypot(pos.x - h.x, pos.y - h.y) <= HANDLE_HIT) {
            state.resizing = { corner: h.name, from: null, original: selEl, snapshot: snapshot(), did: false };
            return;
          }
        }
        // Las flechas no dibujan handles de esquina (drawSelection los omite:
        // usan extremos/curvatura); sin este guard, hitHandle los activaba
        // igualmente y clicar cerca de una esquina del bbox — espacio vacío
        // a la vista — arrancaba un resize invisible en vez de deseleccionar.
        const cornersActive = selEl.type !== 'arrow' && selEl.type !== 'curveArrow';
        const b = getElementBounds(selEl);
        const corner = cornersActive ? hitHandle(pos, b) : null;
        if (corner) {
          state.resizing = {
            corner,
            from: b,
            original: selEl,
            snapshot: snapshot(),
            did: false,
          };
          return;
        }
      }

      const idx = hitTest(pos);

      // 2. Multi-selección: arrastrar desde cualquier punto del marco
      // combinado mueve todo el grupo, sin necesidad de acertar sobre un
      // trazo (Shift+click conserva su semántica de toggle, más abajo).
      // EXCEPCIÓN: si el punto cae sobre un elemento que NO está en la
      // selección, gana ese elemento. El marco de un edificio cubre todo su
      // interior, así que sin esta condición cualquier cosa dibujada encima
      // quedaba inalcanzable: el clic no la seleccionaba, el arrastre movía
      // el edificio entero y Supr lo borraba a él en vez de a lo pulsado.
      if (!e.shiftKey && state.selection.length > 1 && posInSelectionBounds(pos) &&
          (idx < 0 || state.selection.includes(idx))) {
        // Modo «Los clics acumulan»: si el clic cae sobre un elemento
        // seleccionado (no en un hueco del marco) y el gesto acaba sin
        // arrastre, mouseup lo quitará de la selección; arrastrar gana.
        if (state.multiSelect && idx >= 0) state.pendingUnselect = idx;
        state.dragLast = pos;
        // Snapshot ANTES de que el drag mute state.elements
        state.dragSnapshot = snapshot();
        state.didDrag = false;
        return;
      }

      // 3. Shift+click: toggle en la selección — el edificio completo (grupo),
      //    o solo la pieza con Alt+Shift+click
      if (e.shiftKey) {
        if (idx >= 0) {
          const grp = e.altKey ? [idx] : groupIndicesOf(idx);
          setSelection(state.selection.includes(idx)
            ? state.selection.filter(i => !grp.includes(i))
            : [...state.selection, ...grp]);
          redraw();
        }
        return;
      }

      // 4. Click sobre un elemento: seleccionar (si no lo estaba) e iniciar drag.
      //    Un clic normal selecciona el edificio completo; Alt+click aísla la
      //    pieza. Con «Los clics acumulan selección» (la vía de una mano para
      //    la multi-selección disjunta; Shift es el atajo), el clic añade en
      //    vez de sustituir, y sobre algo ya seleccionado se apunta la
      //    retirada — que solo se consuma en mouseup si no hubo arrastre,
      //    para que arrastrar la selección siga funcionando.
      if (idx >= 0) {
        if (e.altKey) setSelection([idx]);
        else if (!state.selection.includes(idx)) {
          const grp = groupIndicesOf(idx);
          setSelection(state.multiSelect ? [...state.selection, ...grp] : grp);
        } else if (state.multiSelect) {
          state.pendingUnselect = idx;
        }
        state.dragLast = pos;
        // Snapshot ANTES de que el drag mute state.elements
        state.dragSnapshot = snapshot();
        state.didDrag = false;
      }
      // 5. Click en vacío: iniciar marquee
      else {
        setSelection([]);
        state.marquee = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      }
      redraw();
      return;
    }

    // TEXT tool
    if (state.tool === TOOLS.TEXT) {
      // Si ya hay un editor abierto, su blur (que se dispara DESPUÉS de este
      // handler) debe confirmar primero el texto anterior con su valor intacto;
      // abrir el nuevo aquí lo reiniciaría a '' y el blur lo perdería. Se
      // aplaza la apertura al siguiente tick, ya con el anterior confirmado.
      if (!textInput.hidden) {
        const p = pos;
        setTimeout(() => showTextInput(p), 0);
      } else {
        showTextInput(pos);
      }
      return;
    }

    // EMOJI tool: estampa el emoji elegido como elemento `text`
    if (state.tool === TOOLS.EMOJI) {
      placeEmoji(pos);
      return;
    }

    state.isDrawing = true;
    state.startPos  = pos;
    state.curveFlip = (state.tool === TOOLS.CURVE_ARROW || state.tool === TOOLS.ARC)
      ? e.shiftKey
      : false;
    state.pathFreeAngle = (state.tool === TOOLS.GARDEN_PATH) ? e.shiftKey : false;

    if (state.tool === TOOLS.PENCIL || state.tool === TOOLS.ERASER) {
      state.currentPath = [pos];
    }
  }

  /* ── Overlay preview (coalescido vía requestAnimationFrame) ── */

  let overlayPending = false;
  let lastPos = null;

  // Opts de creación de la sección Edificios. Fuente ÚNICA para los tres sitios
  // que llaman a Building.elements —previsualización del arrastre, commit al
  // soltar y miniatura del modal de Fachada—: si cada uno armara su propio
  // objeto, un campo nuevo se olvidaría en alguno y la preview dejaría de
  // coincidir con lo que se dibuja.
  function buildOpts() {
    return {
      color: state.color, lineWidth: state.lineWidth,
      plantaShape: state.plantaShape, doorType: state.doorType,
      windowType: state.windowType, balconyType: state.balconyType,
      floors: state.buildFloors, bays: state.buildBays, roofPitch: state.roofPitch,
      roofType: state.roofType, roofShape: state.roofShape, facadeShape: state.facadeShape,
    };
  }

  // Opts de creación de la sección Jardín. Mismo papel que buildOpts: fuente
  // ÚNICA para la previsualización del arrastre, el commit al soltar y los
  // iconos del catálogo.
  //
  // `measureText` es la única dependencia con DOM del módulo (js/garden.js es
  // puro, como js/eraser.js): sirve para centrar la etiqueta y NO puede cambiar
  // nada más. Se mide con la misma fuente con la que se dibujará el texto, que
  // es lo que hace getElementBounds — si no, la etiqueta quedaría descentrada
  // dentro de su propio recuadro de selección.
  function gardenOpts() {
    return {
      color: state.color, lineWidth: state.lineWidth,
      plotShape: state.plotShape, treeType: state.treeType,
      shrubType: state.shrubType, flowerType: state.flowerType,
      decorType: state.decorType, pathType: state.pathType,
      herbType: state.herbType,
      labels: state.gardenLabels,
      pathWidth: state.pathWidth,
      // Dos vías a lo mismo, y la casilla manda: `pathAnyAngle` es un ajuste
      // pegajoso que se marca de un clic, y `pathFreeAngle` el Shift mantenido
      // del arrastre en curso. Mantener una tecla mientras se arrastra exige
      // DOS manos, así que no puede ser la única forma de llegar aquí.
      freeAngle: state.pathAnyAngle || state.pathFreeAngle,
      measureText: (value, fontSize) => {
        ctx.save();
        ctx.font = `${fontSize}px ${SKETCHY_FONT}`;
        const w = ctx.measureText(value).width;
        ctx.restore();
        return w;
      },
    };
  }

  // Dibuja la previsualización de una pieza compuesta (los elementos que producen
  // Building.elements y Garden.elements) respetando el trazo de cada una —el detalle
  // usa lineWidth fino— en vez del grosor global del overlay. Mantiene el guion del
  // trazo discontinuo ya fijado por paintOverlay.
  //
  // Todo tipo que una herramienta de creación pueda emitir TIENE que estar aquí: lo
  // que falte no da error, simplemente no se dibuja, y la previsualización deja de
  // coincidir con lo que aparece al soltar. Pasó con las curvas encadenadas, que no
  // tienen `cx`/`cy` de nivel superior: `quadraticCurveTo(undefined, …)` es un no-op
  // silencioso según la especificación de Canvas.
  function drawPiecesPreview(octx, els) {
    octx.save();
    els.forEach(el => {
      octx.strokeStyle = el.color;
      octx.lineWidth = el.lineWidth;
      if (el.type === 'line') {
        octx.beginPath(); octx.moveTo(el.x1, el.y1); octx.lineTo(el.x2, el.y2); octx.stroke();
      } else if (el.type === 'rect') {
        octx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        octx.beginPath();
        octx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
        octx.stroke();
      } else if (el.type === 'curveArrow') {
        // CurvePath.segments normaliza la curva suelta y la encadenada, así que
        // la distinción vive en un único módulo.
        const segs = CurvePath.segments(el);
        octx.beginPath();
        octx.moveTo(segs[0].x1, segs[0].y1);
        segs.forEach(s => {
          if (s.cx2 !== undefined) octx.bezierCurveTo(s.cx, s.cy, s.cx2, s.cy2, s.x2, s.y2);
          else octx.quadraticCurveTo(s.cx, s.cy, s.x2, s.y2);
        });
        octx.stroke();
      } else if (el.type === 'text') {
        // Se delega en el renderer de verdad: reimplementar aquí la fuente, el
        // anclaje y el interlineado sería una segunda copia destinada a divergir.
        Renderer.renderElement(octx, el);
      }
    });
    octx.restore();
  }

  function paintOverlay() {
    octx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Marquee de selección
    if (state.marquee) {
      const m = state.marquee;
      const x = Math.min(m.x1, m.x2), y = Math.min(m.y1, m.y2);
      const w = Math.abs(m.x2 - m.x1), h = Math.abs(m.y2 - m.y1);
      octx.fillStyle = 'rgba(78, 205, 196, 0.08)';
      octx.fillRect(x, y, w, h);
      octx.strokeStyle = '#4ecdc4';
      octx.lineWidth = 1;
      octx.setLineDash([5, 5]);
      octx.strokeRect(x, y, w, h);
      octx.setLineDash([]);
      return;
    }

    // Curva encadenada: tramos fijados + siguiente tramo bajo el puntero.
    if (state.curveChain) {
      const draft = state.curveChain;
      octx.strokeStyle = draft.color;
      octx.lineWidth = draft.lineWidth;
      octx.setLineDash([4, 4]);
      draft.segments.forEach(seg => {
        octx.beginPath();
        octx.moveTo(seg.x1, seg.y1);
        octx.quadraticCurveTo(seg.cx, seg.cy, seg.x2, seg.y2);
        octx.stroke();
      });
      const from = curveChainLastPoint();
      if (lastPos && Math.hypot(lastPos.x - from.x, lastPos.y - from.y) >= MIN_CURVE_SEGMENT) {
        const c = defaultCtrl(from, lastPos, state.curveFlip);
        octx.beginPath();
        octx.moveTo(from.x, from.y);
        octx.quadraticCurveTo(c.cx, c.cy, lastPos.x, lastPos.y);
        octx.stroke();
      }
      octx.setLineDash([]);
      return;
    }

    // Indicador exacto del área del borrador. Se dibuja incluso en reposo y
    // también durante el gesto, por encima de la previsualización ya borrada.
    if (state.tool === TOOLS.ERASER && lastPos) {
      octx.save();
      octx.beginPath();
      octx.arc(lastPos.x, lastPos.y, state.eraserSize / 2, 0, Math.PI * 2);
      octx.strokeStyle = 'rgba(255,255,255,0.95)';
      octx.lineWidth = 3;
      octx.stroke();
      octx.strokeStyle = 'rgba(26,26,46,0.95)';
      octx.lineWidth = 1;
      octx.stroke();
      octx.restore();
      return;
    }

    if (!state.isDrawing || !lastPos) return;
    const pos = lastPos;

    // Freehand preview. El borrador se pinta directamente en redrawNow para
    // mostrar el borrado real en vivo; el overlay queda solo para el lápiz.
    if (state.tool === TOOLS.PENCIL) {
      if (!state.currentPath.length) return;
      octx.strokeStyle = state.color;
      octx.lineWidth   = state.lineWidth;
      octx.lineCap     = 'round';
      octx.lineJoin    = 'round';
      octx.beginPath();
      octx.moveTo(state.currentPath[0].x, state.currentPath[0].y);
      state.currentPath.forEach(p => octx.lineTo(p.x, p.y));
      octx.stroke();
      return;
    }

    // Shape preview
    if (!state.startPos) return;
    octx.strokeStyle = state.color;
    octx.lineWidth   = state.lineWidth;
    octx.setLineDash([4, 4]);

    const x = Math.min(state.startPos.x, pos.x);
    const y = Math.min(state.startPos.y, pos.y);
    const w = Math.abs(pos.x - state.startPos.x);
    const h = Math.abs(pos.y - state.startPos.y);

    switch (state.tool) {
      case TOOLS.RECT:
        octx.strokeRect(x, y, w, h);
        break;
      case TOOLS.ROUNDED_RECT:
        octx.beginPath(); octx.roundRect(x, y, w, h, 12); octx.stroke();
        break;
      case TOOLS.CIRCLE:
        octx.beginPath(); octx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); octx.stroke();
        break;
      case TOOLS.TRAPEZOID: {
        const vertices = Trapezoid.vertices({ x, y, w, h });
        if (!vertices.length) break;
        octx.beginPath();
        octx.moveTo(vertices[0].x, vertices[0].y);
        vertices.slice(1).forEach(vertex => octx.lineTo(vertex.x, vertex.y));
        octx.closePath();
        octx.stroke();
        break;
      }
      case TOOLS.SQUARE:
      case TOOLS.TRIANGLE:
      case TOOLS.PENTAGON:
      case TOOLS.HEXAGON: {
        const box = RegularPolygon.fromCenter(state.startPos, pos);
        const vertices = RegularPolygon.vertices({ type: state.tool, ...box });
        if (!vertices.length) break;
        octx.beginPath();
        octx.moveTo(vertices[0].x, vertices[0].y);
        vertices.slice(1).forEach(vertex => octx.lineTo(vertex.x, vertex.y));
        octx.closePath();
        octx.stroke();
        break;
      }
      case TOOLS.LINE:
      case TOOLS.ARROW:
        octx.beginPath(); octx.moveTo(state.startPos.x, state.startPos.y); octx.lineTo(pos.x, pos.y); octx.stroke();
        break;
      case TOOLS.CURVE_ARROW: {
        // Mismo control por defecto que tendrá el elemento al soltarse
        // (Shift durante el trazado comba hacia el otro lado)
        const c = defaultCtrl(state.startPos, pos, state.curveFlip);
        octx.beginPath();
        octx.moveTo(state.startPos.x, state.startPos.y);
        octx.quadraticCurveTo(c.cx, c.cy, pos.x, pos.y);
        octx.stroke();
        break;
      }
      case TOOLS.ARC: {
        // Mismo semicírculo de 180° que tendrá el elemento al soltarse
        // (Shift durante el trazado comba hacia el otro lado)
        const L = Math.hypot(pos.x - state.startPos.x, pos.y - state.startPos.y);
        const arc = ArcMath.arcCtrls(state.startPos.x, state.startPos.y, pos.x, pos.y,
          (state.curveFlip ? -1 : 1) * L / 2);
        octx.beginPath();
        octx.moveTo(state.startPos.x, state.startPos.y);
        if (arc) octx.bezierCurveTo(arc.cx, arc.cy, arc.cx2, arc.cy2, pos.x, pos.y);
        else octx.lineTo(pos.x, pos.y);
        octx.stroke();
        break;
      }
      default:
        // Preview de "Edificios" y "Jardín": misma geometría que se creará al soltar
        if (BUILDING_TOOLS.includes(state.tool)) {
          drawPiecesPreview(octx, Building.elements(state.tool, state.startPos, pos, buildOpts()));
        } else if (GARDEN_TOOLS.includes(state.tool)) {
          drawPiecesPreview(octx, Garden.elements(state.tool, state.startPos, pos, gardenOpts()));
          drawPathAngle(octx, state.startPos, pos);
        } else {
          octx.strokeRect(x, y, w, h);
        }
    }
    octx.setLineDash([]);
  }

  /* Rótulo con el ángulo del camino mientras se arrastra.
     Con la inclinación libre el ángulo es lo ÚNICO que decide el gesto y nada
     más lo dice: sin verlo, clavar una diagonal concreta es a ojo, y a ojo con
     una sola mano es peor todavía. Solo aparece en ese modo — en modo caja el
     camino siempre sale a 0° o 90° y el número sería ruido —, así que de paso
     confirma que el modo está activo.

     Vive en el OVERLAY, que se limpia entero en cada frame: no es un elemento,
     no entra en el undo, no se guarda ni se exporta. */
  const ANGLE_BADGE = { pad: 5, dy: -18, font: 13 };

  function drawPathAngle(octx, from, to) {
    if (state.tool !== TOOLS.GARDEN_PATH) return;
    if (!(state.pathAnyAngle || state.pathFreeAngle)) return;
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.hypot(dx, dy) < Garden.MIN_SPAN) return;   // sin recorrido no hay ángulo
    // Convención de transportador: 0° a la derecha y positivo hacia arriba. El
    // eje y del lienzo crece hacia abajo, de ahí el signo cambiado.
    const label = `${Math.round(-Math.atan2(dy, dx) * 180 / Math.PI)}°`;

    octx.save();
    octx.setLineDash([]);
    octx.font = `bold ${ANGLE_BADGE.font}px ${SKETCHY_FONT}`;
    octx.textAlign = 'left';
    octx.textBaseline = 'middle';
    const tw = octx.measureText(label).width;
    const bw = tw + ANGLE_BADGE.pad * 2, bh = ANGLE_BADGE.font + ANGLE_BADGE.pad * 2;
    // Junto al puntero, arriba a la derecha: ahí no lo tapa ni la mano ni el
    // propio trazo, que queda por detrás.
    let bx = to.x + 12, by = to.y + ANGLE_BADGE.dy - bh / 2;
    bx = Math.max(2, Math.min(CANVAS_W - bw - 2, bx));   // sin salirse del lienzo
    by = Math.max(2, Math.min(CANVAS_H - bh - 2, by));
    octx.fillStyle = '#4ecdc4';
    octx.fillRect(bx, by, bw, bh);
    octx.fillStyle = '#12121c';
    octx.fillText(label, bx + ANGLE_BADGE.pad, by + bh / 2);
    octx.restore();
  }

  function scheduleOverlay() {
    if (overlayPending) return;
    overlayPending = true;
    requestAnimationFrame(() => {
      overlayPending = false;
      paintOverlay();
    });
  }

  function onMouseMove(e) {
    const pos = getPos(e);

    if (state.tool === TOOLS.ERASER) {
      lastPos = pos;
      if (!state.isDrawing) {
        scheduleOverlay();
        return;
      }
    }

    if (state.tool === TOOLS.CURVE_ARROW && state.curveChain && !state.resizing) {
      lastPos = snappedPoint(pos, e);
      state.curveFlip = e.shiftKey;
      scheduleOverlay();
      if (!state.isDrawing) return;
    }

    // Resize en curso
    if (state.resizing && e.buttons === 1) {
      resizeTo(pos, e);
      redraw();
      return;
    }

    // Marquee en curso
    if (state.marquee && e.buttons === 1) {
      state.marquee.x2 = pos.x;
      state.marquee.y2 = pos.y;
      scheduleOverlay();
      return;
    }

    // Arrastre de la selección (movimiento incremental, vale para N elementos)
    if (state.tool === TOOLS.SELECT && state.selection.length && state.dragLast && e.buttons === 1) {
      const dx = pos.x - state.dragLast.x;
      const dy = pos.y - state.dragLast.y;
      if (dx || dy) {
        state.selection.forEach(i => {
          state.elements[i] = moveElement(state.elements[i], dx, dy);
        });
        state.dragLast = pos;
        state.didDrag = true;
        redraw();
      }
      return;
    }

    if (!state.isDrawing) return;
    // En modo cadena lastPos ya se fijó SNAPEADO arriba: pisarlo con la
    // posición cruda hacía que la preview del tramo ignorase la cuadrícula
    // mientras el commit del mouseup sí snapea (preview ≠ resultado).
    if (!(state.tool === TOOLS.CURVE_ARROW && state.curveChain)) lastPos = pos;
    // Shift mientras se traza la flecha curva: curva hacia el otro lado
    if (state.tool === TOOLS.CURVE_ARROW || state.tool === TOOLS.ARC) state.curveFlip = e.shiftKey;
    // Shift mientras se traza el camino: recorrido en cualquier inclinación
    if (state.tool === TOOLS.GARDEN_PATH) state.pathFreeAngle = e.shiftKey;
    // Los puntos se acumulan en cada evento (no se pierde trazo) descartando
    // los que están a <2px del anterior (decimación: reduce el path 3-5x);
    // el pintado se coalesce a un frame por refresco
    if (state.tool === TOOLS.PENCIL || state.tool === TOOLS.ERASER) {
      const last = state.currentPath[state.currentPath.length - 1];
      if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= 2) {
        state.currentPath.push(pos);
      }
    }
    if (state.tool === TOOLS.ERASER) {
      redraw();
      scheduleOverlay();
    }
    else scheduleOverlay();
  }

  function onMouseUp(e) {
    if (e.type === 'pointercancel' && state.curveChain) {
      cancelCurveChain();
      return;
    }
    // Fin de resize: el snapshot se capturó al agarrar el handle
    if (state.resizing) {
      const r = state.resizing;
      if (r.did) {
        pushUndo(r.snapshot);
        // Soltar un extremo sobre un anclable lo ancla (asignando id si falta)
        if ((r.corner === 'p1' || r.corner === 'p2') && r.anchorCandidate >= 0) {
          const key = r.corner === 'p1' ? 'startAnchor' : 'endAnchor';
          const otherKey = key === 'startAnchor' ? 'endAnchor' : 'startAnchor';
          const selIdx = state.selection[0];
          const other = state.elements[selIdx][otherKey];
          let target = state.elements[r.anchorCandidate];
          // No anclar los DOS extremos al mismo elemento: resolveAnchors los
          // proyectaría uno hacia el otro sobre el mismo borde y la flecha
          // colapsaría a longitud ~0. Si colisiona, este extremo queda libre.
          if (!(other && target.id && other.id === target.id)) {
            if (!target.id) {
              target = { ...target, id: newId() };
              state.elements[r.anchorCandidate] = target;
            }
            state.elements[selIdx] = { ...state.elements[selIdx], [key]: { id: target.id } };
          }
        }
      }
      state.resizing = null;
      redraw();
      return;
    }

    // Fin de marquee: seleccionar los elementos que intersecan el rectángulo
    if (state.marquee) {
      const m = state.marquee;
      state.marquee = null;
      octx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const rx = Math.min(m.x1, m.x2), ry = Math.min(m.y1, m.y2);
      const rw = Math.abs(m.x2 - m.x1), rh = Math.abs(m.y2 - m.y1);
      if (rw > 3 || rh > 3) {
        const sel = [];
        state.elements.forEach((el, i) => {
          if (el.type === 'eraser') return;
          const b = getElementBounds(el);
          if (b.x < rx + rw && b.x + b.w > rx && b.y < ry + rh && b.y + b.h > ry) sel.push(i);
        });
        setSelection(sel);
      }
      redraw();
      return;
    }

    // Fin de arrastre de selección: el snapshot se capturó en onMouseDown,
    // antes de que onMouseMove mutara state.elements
    if (state.tool === TOOLS.SELECT && state.selection.length && state.dragLast) {
      if (state.didDrag && state.dragSnapshot) {
        pushUndo(state.dragSnapshot);
        // Snap al soltar: se alinea el primer elemento y el resto conserva
        // sus distancias relativas
        if (state.snapGrid && !e.altKey) {
          const b = getElementBounds(state.elements[state.selection[0]]);
          const dx = snapVal(b.x) - b.x;
          const dy = snapVal(b.y) - b.y;
          if (dx || dy) {
            state.selection.forEach(i => {
              state.elements[i] = moveElement(state.elements[i], dx, dy);
            });
          }
        }
      } else if (state.pendingUnselect !== null) {
        // Modo «Los clics acumulan»: el clic que acabó sin arrastre sobre
        // algo ya seleccionado lo quita (el grupo entero; con Alt, la pieza).
        const grp = e.altKey ? [state.pendingUnselect]
                             : groupIndicesOf(state.pendingUnselect);
        setSelection(state.selection.filter(i => !grp.includes(i)));
      }
      state.pendingUnselect = null;
      state.dragLast = null;
      state.dragSnapshot = null;
      state.didDrag = false;
      redraw();
      return;
    }

    if (!state.isDrawing) return;
    const pos = getPos(e);

    // Clics posteriores de una curva encadenada. Ctrl/Cmd+clic confirma el
    // último tramo (si no es degenerado) y añade una única punta al final.
    if (state.tool === TOOLS.CURVE_ARROW && state.curveChain) {
      const p = snappedPoint(pos, e);
      const from = curveChainLastPoint();
      if (Math.hypot(p.x - from.x, p.y - from.y) >= MIN_CURVE_SEGMENT &&
          state.curveChain.segments.length < CurvePath.MAX_SEGMENTS) {
        state.curveChain.segments.push(newCurveChainSegment(from, p, state.curveFlip));
      }
      state.isDrawing = false;
      state.startPos = null;
      lastPos = p;
      if (e.ctrlKey || e.metaKey || state.curveChain.segments.length >= CurvePath.MAX_SEGMENTS) {
        finishCurveChain();
      } else {
        scheduleOverlay();
      }
      return;
    }

    octx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    state.isDrawing = false;
    lastPos = null;

    // Freehand commit
    // Borrador (un solo undo por pasada): recta/flecha/trazo sobreviven
    // recortados a lo que queda fuera del círculo; el resto de tipos se
    // elimina entero. No deja máscaras — la antigua era posicional y lo
    // "borrado" reaparecía al mover el dibujo.
    if (state.tool === TOOLS.ERASER) {
      state.currentPath.push(pos);
      const result = Eraser.erase(
        state.elements, state.currentPath, state.eraserSize / 2, eraserDeps(),
      );
      if (result !== state.elements) {
        saveUndo();
        state.elements = result;
        setSelection([]);   // los índices anteriores ya no son válidos
      }
      state.currentPath = [];
      lastPos = pos;
      redraw();
      scheduleOverlay();
      return;
    }

    if (state.tool === TOOLS.PENCIL) {
      state.currentPath.push(pos);
      saveUndo();
      state.elements.push({
        type: state.tool,
        points: state.currentPath,
        color: state.color,
        lineWidth: state.lineWidth,
        seed: newSeed(),
      });
      state.currentPath = [];
      redraw();
      return;
    }

    if (!state.startPos) return;
    // Snap a la cuadrícula al crear (Alt lo desactiva; no aplica a lápiz/borrador)
    const doSnap = state.snapGrid && !e.altKey;
    const p1 = doSnap ? { x: snapVal(state.startPos.x), y: snapVal(state.startPos.y) } : state.startPos;
    const p2 = doSnap ? { x: snapVal(pos.x), y: snapVal(pos.y) } : pos;
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);

    // Line / Arrow / Curve / Arc (descarta clicks sin arrastre: longitud ~0)
    if ([TOOLS.LINE, TOOLS.ARROW, TOOLS.CURVE_ARROW, TOOLS.ARC].includes(state.tool)) {
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 4) {
        saveUndo();
        const el = {
          // La herramienta arco no es un tipo de elemento: crea curveArrow
          type: state.tool === TOOLS.ARC ? TOOLS.CURVE_ARROW : state.tool,
          x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y,
          color: state.color, lineWidth: state.lineWidth,
          seed: newSeed(),
        };
        if (state.tool === TOOLS.CURVE_ARROW) {
          // Curvatura por defecto: control perpendicular al 25% de la longitud
          // (Shift al trazar: al otro lado); se ajusta después con su handle
          const c = defaultCtrl(p1, p2, state.curveFlip);
          el.cx = c.cx;
          el.cy = c.cy;
        }
        if (state.tool === TOOLS.ARC) {
          // Semicírculo de 180°: el arrastre es el diámetro (radio = mitad
          // de la longitud arrastrada; Shift: comba hacia el otro lado).
          // Sin puntas de flecha: es un trazo, no un conector.
          const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const arc = ArcMath.arcCtrls(p1.x, p1.y, p2.x, p2.y,
            (state.curveFlip ? -1 : 1) * L / 2);
          Object.assign(el, arc);
          el.arc = true;
          el.heads = 'none';
        }
        if ((state.tool === TOOLS.ARROW || state.tool === TOOLS.CURVE_ARROW) && state.doubleHead) {
          el.heads = 'both';
        }
        if (state.dashed) el.dash = true;
        state.elements.push(el);
        // Extremos sobre un elemento anclable: la flecha nace conectada
        if (state.tool !== TOOLS.LINE) {
          attachAnchorOnCreate(el, 'startAnchor', p1);
          attachAnchorOnCreate(el, 'endAnchor', p2);
        }
      } else if (state.tool === TOOLS.CURVE_ARROW) {
        // Un clic sin arrastre inicia el modo encadenado; el elemento no entra
        // en state.elements hasta Ctrl/Cmd+clic, así que undo/autosave reciben
        // una sola operación completa.
        state.curveChain = {
          start: { ...p1 },
          segments: [],
          color: state.color,
          lineWidth: state.lineWidth,
          seed: newSeed(),
          heads: state.doubleHead ? 'both' : undefined,
          dash: state.dashed,
        };
        lastPos = { ...p1 };
        scheduleOverlay();
      }
    }
    // Geometric shapes
    else if ([
      TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE, TOOLS.TRAPEZOID,
      ...REGULAR_POLYGON_TYPES,
    ].includes(state.tool)) {
      const polygonBox = REGULAR_POLYGON_TYPES.includes(state.tool)
        ? RegularPolygon.fromCenter(p1, p2)
        : null;
      const shapeX = polygonBox ? polygonBox.x : x;
      const shapeY = polygonBox ? polygonBox.y : y;
      const shapeW = polygonBox ? polygonBox.w : w;
      const shapeH = polygonBox ? polygonBox.h : h;
      if (shapeW > 3 && shapeH > 3) {
        saveUndo();
        const shape = {
          type: state.tool,
          x: shapeX, y: shapeY, w: shapeW, h: shapeH,
          color: state.color, lineWidth: state.lineWidth,
          fill: state.fillShapes,
          seed: newSeed(),
        };
        // Sin fillColor, el relleno cae en el tinte del trazo (aspecto clásico)
        if (state.fillShapes && state.fillColor) shape.fillColor = state.fillColor;
        if (state.fillShapes && state.fillTransparent) shape.fillTransparent = true;
        shape.fillOpacity = state.fillOpacity;
        state.elements.push(shape);
      }
    }
    // UI components
    else if (UI_DEFAULTS[state.tool]) {
      const defs = UI_DEFAULTS[state.tool];
      saveUndo();
      state.elements.push({
        type: state.tool,
        x, y,
        w: w > 20 ? w : defs.w,
        h: h > 20 ? h : defs.h,
        color: state.color, lineWidth: state.lineWidth,
        seed: newSeed(),
      });
    }
    // Edificios — herramientas de creación: 1..N elementos de tipos ya
    // existentes (rect/line, ver js/building.js). Un solo undo por gesto.
    else if (BUILDING_TOOLS.includes(state.tool) || GARDEN_TOOLS.includes(state.tool)) {
      const created = withSeeds(GARDEN_TOOLS.includes(state.tool)
        ? Garden.elements(state.tool, p1, p2, gardenOpts())
        : Building.elements(state.tool, p1, p2, buildOpts()));
      if (created.length) {
        saveUndo();
        // Agrupa las piezas bajo un id compartido → se seleccionan, mueven,
        // duplican y borran como una unidad (Alt+click aísla una pieza). El campo
        // se llama buildingGroupId por historia; vale para cualquier herramienta
        // compuesta y renombrarlo rompería los proyectos ya guardados.
        if (created.length > 1) {
          const gid = newId();
          for (const el of created) el.buildingGroupId = gid;
        }
        for (const el of created) state.elements.push(el);
      }
    }

    state.startPos = null;
    // A diferencia de curveFlip, pathFreeAngle viaja dentro de gardenOpts() y
    // lo leen también los iconos del catálogo (variantIcon): sin este reinicio
    // explícito, reabrir el modal de Camino tras un arrastre en diagonal con
    // Shift pintaría los iconos en diagonal, porque no medió ningún mousedown
    // que lo pusiera a false por su cuenta.
    state.pathFreeAngle = false;
    redraw();
  }

  /* ── Text input ── */

  function showTextInput(pos, initial = '', fontSize = state.fontSize) {
    // El textarea vive dentro del wrapper ya escalado por CSS transform:
    // se posiciona en coordenadas sin escalar
    textInput.hidden  = false;
    textInput.style.left     = pos.x + 'px';
    textInput.style.top      = pos.y + 'px';
    textInput.style.fontSize = fontSize + 'px';
    textInput.value  = initial;
    // El foco se aplaza un tick: cuando esto se llama desde el pointerdown del
    // lienzo, la acción por defecto del evento mueve el foco al body JUSTO
    // después de este handler; enfocar aquí provocaría un blur inmediato ->
    // commitText -> textarea cerrado antes de poder escribir nada.
    setTimeout(() => {
      if (textInput.hidden) return;
      textInput.focus();
      textInput.select();
    }, 0);
  }

  function commitText() {
    if (textInput.hidden) return;
    const val = textInput.value.trim();
    textInput.hidden = true;

    // Edición de un elemento existente (texto o etiqueta de componente)
    const editing = state.editingIdx;
    state.editingIdx = null;
    if (editing !== null) {
      const el = state.elements[editing];
      if (!el) return;
      // Solo apila undo si el valor cambió de verdad: confirmar una edición sin
      // tocar nada no debe consumir un paso de historial ni vaciar el redoStack.
      if (el.type === 'text') {
        if (!val) {
          if (el.value === '') return; // ya vacío: nada que borrar
          saveUndo();
          state.elements.splice(editing, 1); // texto vaciado = borrado
          setSelection([]);
        } else if (val !== el.value) {
          saveUndo();
          state.elements[editing] = { ...el, value: val };
        } else {
          return; // sin cambios
        }
      } else {
        const newLabel = val || undefined; // vacío: vuelve a la etiqueta por defecto
        if (newLabel === el.label) return; // sin cambios
        saveUndo();
        const copy = { ...el };
        if (val) copy.label = val;
        else delete copy.label;
        state.elements[editing] = copy;
      }
      redraw();
      return;
    }

    if (!val) return;
    saveUndo();

    const posX = parseFloat(textInput.style.left);
    const posY = parseFloat(textInput.style.top);

    state.elements.push({
      type: 'text',
      x: posX, y: posY,
      value: val,
      color: state.color,
      fontSize: state.fontSize,
      lineWidth: state.lineWidth,
    });
    redraw();
  }

  /**
   * Estampa el emoji elegido en `pos` como un elemento `text` normal: su
   * `value` es el carácter, así que render, exportación (los cinco formatos),
   * selección, undo y round-trip JSON funcionan sin código específico.
   */
  function placeEmoji(pos) {
    const emoji = state.pendingEmoji;
    if (!emoji) return;
    const fontSize = Math.max(state.fontSize, EMOJI_MIN_SIZE);
    // El render de `text` ancla en la esquina superior izquierda; se descuenta
    // media caja para que el emoji quede centrado en el punto pulsado
    ctx.save();
    ctx.font = `${fontSize}px ${SKETCHY_FONT}`;
    const w = ctx.measureText(emoji).width;
    ctx.restore();
    saveUndo();
    state.elements.push({
      type: 'text',
      x: pos.x - w / 2,
      y: pos.y - fontSize / 2,
      value: emoji,
      color: state.color,
      fontSize,
      lineWidth: state.lineWidth,
    });
    redraw();
  }

  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') { textInput.hidden = true; state.editingIdx = null; }
  });
  textInput.addEventListener('blur', commitText);

  /* ── Edición con doble click (herramienta Mover) ── */

  const LABELED_TYPES = [TOOLS.BUTTON, TOOLS.INPUT, TOOLS.NAV, TOOLS.CARD];

  mainCanvas.addEventListener('dblclick', e => {
    if (state.tool !== TOOLS.SELECT) return;
    const pos = getPos(e);
    // Doble click sobre un handle de curvatura: resetear la curvatura
    // (cuadrática → control por defecto; cúbica → S canónica)
    if (state.selection.length === 1) {
      const sel = state.elements[state.selection[0]];
      // Doble click sobre el handle de etiqueta desplazada: re-centrarla.
      // Con labelT ausente no se intercepta (el flujo cae al editor de texto)
      if (sel && sel.labelT !== undefined &&
          (sel.type === 'arrow' || sel.type === 'curveArrow')) {
        const lp = arrowLabelPoint(sel);
        if (Math.hypot(pos.x - lp.x, pos.y - lp.y) <= HANDLE_HIT) {
          saveUndo();
          const copy = { ...sel };
          delete copy.labelT;
          state.elements[state.selection[0]] = copy;
          redraw();
          return;
        }
      }
      const hitCtrl = sel && arrowHandles(sel).find(
        h => h.kind === 'ctrl' && Math.hypot(pos.x - h.x, pos.y - h.y) <= HANDLE_HIT
      );
      if (hitCtrl) {
        saveUndo();
        if (CurvePath.isChain(sel)) {
          const index = Number(hitCtrl.name.split(':')[1]);
          const seg = sel.segments[index];
          const p1 = { x: seg.x1, y: seg.y1 }, p2 = { x: seg.x2, y: seg.y2 };
          if (seg.cx2 !== undefined) {
            // Tramo cúbico: S canónica en los DOS controles, como el reset
            // de la curva suelta. Resetear solo uno dejaba el tramo medio
            // reseteado — y antes, además, el índice extraído de
            // 'segCtrl2:N' movía siempre el PRIMER control (cx/cy) aunque
            // el doble clic fuera sobre el segundo handle.
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const c = defaultCubicCtrls(
              { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, 0.25 * len);
            state.elements[state.selection[0]] = CurvePath.withControl(
              CurvePath.withControl(sel, index, { x: c.cx, y: c.cy }, false),
              index, { x: c.cx2, y: c.cy2 }, true);
          } else {
            const c = defaultCtrl(p1, p2, false);
            state.elements[state.selection[0]] =
              CurvePath.withControl(sel, index, { x: c.cx, y: c.cy }, false);
          }
        } else if (sel.arc === true) {
          // Semicírculo: re-normalizar a 180° exactos, lado actual
          state.elements[state.selection[0]] = toArc(sel);
        } else if (sel.cx2 !== undefined) {
          const len = Math.hypot(sel.x2 - sel.x1, sel.y2 - sel.y1);
          state.elements[state.selection[0]] = { ...sel, ...defaultCubicCtrls(sel, 0.25 * len) };
        } else {
          const c = defaultCtrl({ x: sel.x1, y: sel.y1 }, { x: sel.x2, y: sel.y2 }, false);
          state.elements[state.selection[0]] = { ...sel, cx: c.cx, cy: c.cy };
        }
        redraw();
        return;
      }
    }
    const idx = hitTest(pos);
    if (idx < 0) return;
    // Doble clic sobre una pieza de una selección múltiple (p. ej. un
    // edificio recién clicado): desciende a esa pieza. Es la vía de una
    // sola mano para aislar una pieza de un grupo — Alt+clic queda como
    // acelerador, nunca como única forma (regla permanente del proyecto).
    // Sobre una etiqueta de texto del grupo, un segundo doble clic (ya
    // aislada) cae al editor, como cualquier texto suelto.
    if (state.selection.length > 1 && state.selection.includes(idx)) {
      setSelection([idx]);
      redraw();
      return;
    }
    const el = state.elements[idx];
    if (el.type === 'text') {
      state.editingIdx = idx;
      showTextInput({ x: el.x, y: el.y }, el.value, el.fontSize);
    } else if (el.type === 'arrow' || el.type === 'curveArrow') {
      // Etiqueta de la flecha: el editor se abre en su posición actual
      const mid = arrowLabelPoint(el);
      state.editingIdx = idx;
      showTextInput({ x: mid.x - 40, y: mid.y - 10 }, el.label || '', 13);
    } else if (LABELED_TYPES.includes(el.type)) {
      state.editingIdx = idx;
      showTextInput({ x: el.x, y: el.y }, el.label || '', 14);
    }
  });

  /* ── Insertar imágenes: pegar (Ctrl/Cmd+V) o arrastrar desde el disco ── */

  const IMAGE_MIME = /^image\/(png|jpeg)$/;

  /**
   * Inserta una imagen desde un data-URL. Sin `at` se centra en el canvas;
   * con `at` (coords de canvas) se centra en ese punto, sin salirse.
   */
  function addImage(src, at) {
    const img = new Image();
    img.onload = () => {
      // Escalar para que quepa holgada en el canvas, conservando proporción
      const scale = Math.min(1, (CANVAS_W * 0.8) / img.naturalWidth, (CANVAS_H * 0.8) / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const cx = at ? at.x : CANVAS_W / 2;
      const cy = at ? at.y : CANVAS_H / 2;
      const x = Math.round(Math.max(0, Math.min(CANVAS_W - w, cx - w / 2)));
      const y = Math.round(Math.max(0, Math.min(CANVAS_H - h, cy - h / 2)));
      saveUndo();
      state.elements.push({
        type: TOOLS.IMAGE,
        x, y, w, h, src,
        color: state.color, lineWidth: state.lineWidth,
        seed: newSeed(),
      });
      // Queda seleccionada con Mover para arrastrarla/redimensionarla al momento
      selectTool(TOOLS.SELECT);
      setSelection([state.elements.length - 1]);
      redraw();
    };
    img.onerror = () => alert('No se pudo cargar la imagen');
    img.src = src;
  }

  function addImageFile(file, at) {
    if (!file || !IMAGE_MIME.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result, at);
    // Sin esto, un fichero ilegible no daba ningún feedback (el onerror de
    // addImage sí avisa cuando lo que falla es decodificar la imagen).
    reader.onerror = () => alert('No se pudo leer el archivo de imagen');
    reader.readAsDataURL(file);
  }

  /* ── Copiar / pegar la selección (Ctrl/Cmd+C · Ctrl/Cmd+V) ── */

  // Marcador del payload propio en el portapapeles del sistema: permite
  // pegar entre pestañas/recargas y convivir con el pegado de imágenes.
  // Conserva el nombre antiguo de la app a propósito (ver AUTOSAVE_KEY):
  // renombrarlo rompería el pegado desde una pestaña ya abierta.
  const ELEMENTS_CLIPBOARD = 'sketchwire/elements';

  document.addEventListener('copy', e => {
    // No interceptar la copia dentro de campos de texto
    const tag = e.target.tagName;
    if (e.target === textInput || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!state.selection.length || !e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', JSON.stringify({
      app: ELEMENTS_CLIPBOARD,
      elements: state.selection.map(i => state.elements[i]),
    }));
  });

  document.addEventListener('paste', e => {
    // No interceptar el pegado dentro de campos de texto
    const tag = e.target.tagName;
    if (e.target === textInput || tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Con un modal abierto ningún atajo debe tocar el lienzo (mismo invariante
    // que el keydown): sin este guard, Ctrl+V pegaba clones DETRÁS del modal
    // y encima cambiaba la herramienta activa a Mover.
    if (document.querySelector('dialog[open]')) return;
    if (!e.clipboardData) return;
    // 1º: elementos copiados con Ctrl/Cmd+C (payload JSON propio); pasan por
    // el mismo validador que el import para descartar contenido manipulado
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      let data = null;
      try { data = JSON.parse(text); } catch (_) { /* no es nuestro payload */ }
      if (data && data.app === ELEMENTS_CLIPBOARD && Array.isArray(data.elements)) {
        e.preventDefault();
        const els = data.elements.filter(Exporter.isValidElement);
        if (!els.length) return;
        // Pegar activa la herramienta Mover: los clones quedan seleccionados
        if (state.tool !== TOOLS.SELECT) selectTool(TOOLS.SELECT);
        saveUndo();
        insertClones(els, 20, 20);
        redraw();
        return;
      }
    }
    // 2º: imágenes del portapapeles
    const items = e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (IMAGE_MIME.test(item.type)) {
        e.preventDefault();
        addImageFile(item.getAsFile());
        return;
      }
    }
  });

  // Drag & drop de archivos desde el escritorio al lienzo
  let dragDepth = 0;

  function setDropHighlight(on) {
    wrapper.classList.toggle('canvas-area__wrapper--dropping', on);
  }

  mainCanvas.addEventListener('dragover', e => {
    // preventDefault es lo que habilita el drop
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  mainCanvas.addEventListener('dragenter', e => {
    e.preventDefault();
    dragDepth++;
    setDropHighlight(true);
  });
  mainCanvas.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) { dragDepth = 0; setDropHighlight(false); }
  });
  mainCanvas.addEventListener('drop', e => {
    e.preventDefault();
    dragDepth = 0;
    setDropHighlight(false);
    const pos = getPos(e);
    const files = [...(e.dataTransfer.files || [])].filter(f => IMAGE_MIME.test(f.type));
    if (!files.length) return;
    // Varias imágenes: en cascada desde el punto de suelta
    files.forEach((f, i) => addImageFile(f, { x: pos.x + i * 24, y: pos.y + i * 24 }));
  });

  // Soltar un archivo FUERA del lienzo (panel, barra, huecos) haría que el
  // navegador lo abriera y saliera de la app, perdiendo el trabajo en curso.
  // Se cancela el comportamiento por defecto en toda la ventana; el drop sobre
  // el lienzo sigue procesándose por su propio handler de arriba.
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  /* ── Canvas cursor ── */

  function updateCursor() {
    mainCanvas.classList.toggle('canvas-area__canvas--move', state.tool === TOOLS.SELECT);
    mainCanvas.classList.toggle('canvas-area__canvas--eraser', state.tool === TOOLS.ERASER);
  }

  /* ── Acciones sobre la selección ── */

  // Herramientas de Edificios con catálogo dibujado a mano (icono SVG propio).
  const MODAL_BUILD_TOOLS = [TOOLS.BUILD_PLANTA, TOOLS.BUILD_FACADE, TOOLS.BUILD_DOOR, TOOLS.BUILD_WINDOW, TOOLS.BUILD_ROOF];

  /* Modales de variante con catálogo GENÉRICO: una tabla en vez de una pareja
     build*Catalog/update*Active por herramienta, y los iconos no se dibujan a
     mano —los pinta la geometría real del módulo, así que no pueden mentir
     sobre lo que hace la herramienta (ver variantIcon)—.
     `gen` es el módulo que genera las piezas y `opts` su constructor de opts;
     `box` es el arrastre con el que se pinta el icono, en la proporción propia
     de la sección (el jardín se ve desde arriba y el balcón, de frente).

     Los cinco de Edificios de arriba NO se plegaron aquí: no son uniformes
     (Fachada pasa un segundo argumento al icono y fija autofocus, Planta
     consulta el `.modal__shape` sin acotar) y su comportamiento no está fijado
     por tests, así que unificarlos sería arriesgar una regresión muda a cambio
     de nada visible. El Balcón nace ya en la tabla. */
  const VARIANT_MODALS = [
    // Balcón: la caja del icono es un arrastre nulo A PROPÓSITO, para que la
    // ponga el `byVariant` de cada tipo. Así el icono enseña también su
    // proporción —el corrido nace largo y el mirador alto—, que es justo lo
    // que distingue a la mitad del catálogo.
    { tool: TOOLS.BUILD_BALCONY, modal: 'modal-balcony', root: 'balcony-catalog', cls: 'modal__balcony', data: 'balcony', catalog: BALCONY_TYPES, key: 'balconyType', gen: () => Building, opts: () => buildOpts(),  box: { x: 0, y: 0 } },
    { tool: TOOLS.GARDEN_PLOT,   modal: 'modal-plot',   root: 'plot-catalog',   cls: 'modal__plot',   data: 'plot',   catalog: PLOT_SHAPES,   key: 'plotShape'  },
    { tool: TOOLS.GARDEN_TREE,   modal: 'modal-tree',   root: 'tree-catalog',   cls: 'modal__tree',   data: 'tree',   catalog: TREE_TYPES,    key: 'treeType'   },
    { tool: TOOLS.GARDEN_SHRUB,  modal: 'modal-shrub',  root: 'shrub-catalog',  cls: 'modal__shrub',  data: 'shrub',  catalog: SHRUB_TYPES,   key: 'shrubType'  },
    { tool: TOOLS.GARDEN_FLOWER, modal: 'modal-flower', root: 'flower-catalog', cls: 'modal__flower', data: 'flower', catalog: FLOWER_TYPES,  key: 'flowerType' },
    { tool: TOOLS.GARDEN_DECOR,  modal: 'modal-decor',  root: 'decor-catalog',  cls: 'modal__decor',  data: 'decor',  catalog: DECOR_TYPES,   key: 'decorType'  },
    // Caminos: caja propia, vertical y corta. Vertical porque así nace un
    // camino, y corta para que los cantos aún se distingan a 56 px. Al llevar
    // lado corto propio, el icono no depende del ancho del panel: un ancho de
    // 120 dejaría el icono hecho una mancha en vez de un camino — y por eso
    // mismo el icono se pinta SIEMPRE en modo caja (`freeAngle: false`) aunque
    // la casilla esté marcada: aquí el icono distingue el TRAZADO (serpenteante
    // o recto, liso o empedrado), no la inclinación. Quien enseña el ancho y la
    // inclinación activos es la miniatura de al lado (`renderPathPreview`).
    { tool: TOOLS.GARDEN_PATH,   modal: 'modal-path',   root: 'path-catalog',   cls: 'modal__path',   data: 'path',   catalog: PATH_TYPES,    key: 'pathType', opts: () => ({ ...gardenOpts(), freeAngle: false }), box: { x: 44, y: 84 } },
    { tool: TOOLS.GARDEN_HERB,   modal: 'modal-herb',   root: 'herb-catalog',   cls: 'modal__herb',   data: 'herb',   catalog: HERB_TYPES,    key: 'herbType'   },
  ].map(cfg => ({ gen: () => Garden, opts: () => gardenOpts(), box: { x: 100, y: 84 }, ...cfg }));
  const variantModalOf = tool => VARIANT_MODALS.find(m => m.tool === tool);
  /** true si elegir esta herramienta abre un catálogo de variante. */
  const opensVariantModal = tool =>
    MODAL_BUILD_TOOLS.includes(tool) || VARIANT_MODALS.some(m => m.tool === tool);

  function selectTool(id) {
    if (id !== state.tool && state.curveChain) cancelCurveChain();
    // Al abrir un modal de Edificios, recuerda a dónde volver si se cancela: la
    // herramienta previa (si venimos de otra) o esta misma (reentrada para cambiar
    // variante). El flag variantChosen distingue elegir-variante de cancelar.
    if (opensVariantModal(id)) {
      state.toolBeforeModal = id === state.tool ? id : state.tool;
      state.variantChosen = false;
    }
    state.tool = id;
    setSelection([]);
    updateToolbarActive();
    updateCursor();
    redraw();
    // Repintar el overlay: al cambiar de herramienta por teclado sin mover el
    // ratón, el círculo indicador del borrador quedaba fantasma (pointerleave
    // solo limpia si la herramienta sigue siendo el borrador).
    scheduleOverlay();
    // Elegir la herramienta Emoji abre el catálogo; tras escoger uno, cada
    // click en el lienzo lo estampa (volver a pulsarla permite cambiarlo)
    if (id === TOOLS.EMOJI) $('modal-emoji').showModal();
    // Borrador abre su modal de tamaño, igual que Emoji o Planta abren el
    // suyo: si no, el único acceso es el botón ⚙ del panel, lejos del
    // sidebar y fácil de no ver. A diferencia de esos, cerrarlo NO debe
    // devolver a la herramienta anterior (el borrador es usable sin elegir
    // nada en el modal), así que no pasa por opensVariantModal.
    if (id === TOOLS.ERASER) openEraserSizeModal();
    // Planta abre su catálogo de huellas; reaplica el resaltado activo antes de
    // abrir (updateEmojiActive no está acotado y comparte la clase .modal__emoji)
    if (id === TOOLS.BUILD_PLANTA) { updatePlantaActive(); $('modal-planta').showModal(); }
    if (id === TOOLS.BUILD_DOOR) { updateDoorActive(); $('modal-door').showModal(); }
    if (id === TOOLS.BUILD_WINDOW) { updateWindowActive(); $('modal-window').showModal(); }
    if (id === TOOLS.BUILD_ROOF) { updateRoofActive(); $('modal-roof').showModal(); }
    // Fachada se reconstruye entera (no solo el resaltado): el icono del alzado
    // y la miniatura dependen de ajustes que pueden haber cambiado fuera.
    if (id === TOOLS.BUILD_FACADE) {
      buildFacadeCatalog();
      syncBuildControls();
      $('modal-facade').showModal();
    }
    // Catálogos genéricos (Balcón y los siete del Jardín): se reconstruyen al
    // abrir porque sus iconos se pintan con la geometría real, y esa depende
    // del color y el trazo activos.
    const variant = variantModalOf(id);
    if (variant) {
      buildVariantCatalog(variant);
      // Camino lleva ajustes propios además del catálogo: hay que repartirlos a
      // los dos juegos de controles y repintar la miniatura antes de enseñarlo,
      // igual que hace Fachada con syncBuildControls().
      if (id === TOOLS.GARDEN_PATH) syncPathControls();
      $(variant.modal).showModal();
    }
  }

  function deleteSelection() {
    if (!state.selection.length) return;
    saveUndo();
    // De mayor a menor índice para que los splice no se desplacen entre sí
    [...state.selection].sort((a, b) => b - a).forEach(i => state.elements.splice(i, 1));
    setSelection([]);
    redraw();
  }

  /**
   * Inserta copias de `sources` desplazadas (dx,dy): re-siembra el jitter,
   * regenera el id de los anclables re-vinculando los anchors cuyo destino
   * también se clona (los externos conservan su anchor original), y deja
   * los clones seleccionados. El saveUndo es del llamador.
   */
  function insertClones(sources, dx, dy) {
    const start = state.elements.length;
    const idMap = new Map();
    const groupMap = new Map();   // buildingGroupId viejo → nuevo (cada edificio clonado es independiente)
    sources.forEach(src => {
      const copy = moveElement(src, dx, dy);
      copy.seed = newSeed();
      if (src.id) {
        copy.id = newId();
        idMap.set(src.id, copy.id);
      }
      if (src.buildingGroupId) {
        if (!groupMap.has(src.buildingGroupId)) groupMap.set(src.buildingGroupId, newId());
        copy.buildingGroupId = groupMap.get(src.buildingGroupId);
      }
      state.elements.push(copy);
    });
    // Flechas clonadas: si su ancla también se clonó, apuntan al clon;
    // si no, conservan el anchor al original
    for (let i = start; i < state.elements.length; i++) {
      const el = state.elements[i];
      if (el.startAnchor || el.endAnchor) {
        const copy = { ...el };
        if (copy.startAnchor && idMap.has(copy.startAnchor.id)) copy.startAnchor = { id: idMap.get(copy.startAnchor.id) };
        if (copy.endAnchor && idMap.has(copy.endAnchor.id)) copy.endAnchor = { id: idMap.get(copy.endAnchor.id) };
        state.elements[i] = copy;
      }
    }
    setSelection(Array.from({ length: state.elements.length - start }, (_, k) => start + k));
  }

  function duplicateSelection() {
    if (!state.selection.length) return;
    saveUndo();
    insertClones(state.selection.map(i => state.elements[i]), 15, 15);
    redraw();
  }

  function rotateSelection() {
    const targets = state.selection.filter(i => ShapeRotation.isType(state.elements[i].type));
    if (!targets.length) return;
    saveUndo();
    targets.forEach(i => {
      state.elements[i] = ShapeRotation.rotateElement(state.elements[i]);
    });
    redraw();
  }

  /* ── Build sidebar ── */

  function buildSidebar() {
    const sidebar = $('sidebar');
    sidebar.innerHTML = '';
    TOOL_GROUPS.forEach(group => {
      const div = document.createElement('div');
      div.className = 'sidebar__group';

      const label = document.createElement('span');
      label.className = 'sidebar__group-label';
      label.textContent = group.label;
      div.appendChild(label);

      group.tools.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'sidebar__tool';
        btn.dataset.tool = t.id;
        btn.title = t.key ? `${t.name} (${t.key.toUpperCase()})` : t.name;
        // createElement/textContent, como todos los catálogos: era el único
        // innerHTML interpolado del proyecto (estático, pero la disciplina
        // «nunca innerHTML» es una sola). El emoji va aria-hidden: el nombre
        // ya lo da el span de texto y un lector no debe verbalizarlo dos veces.
        const icon = document.createElement('span');
        icon.textContent = t.icon;
        icon.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'sidebar__tool-name';
        name.textContent = t.name;
        btn.appendChild(icon);
        btn.appendChild(name);
        btn.addEventListener('click', () => selectTool(t.id));
        div.appendChild(btn);
      });
      sidebar.appendChild(div);
    });

    // role="toolbar" promete navegación con flechas: roving tabindex — la
    // barra entera es UNA parada de Tab (antes eran ~45: cruzar del topbar
    // al lienzo por teclado costaba una tabulación por herramienta) y el
    // foco se mueve por dentro con flechas, Home y End.
    const tools = [...sidebar.querySelectorAll('.sidebar__tool')];
    tools.forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
    sidebar.addEventListener('keydown', e => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in step) && e.key !== 'Home' && e.key !== 'End') return;
      const current = tools.indexOf(document.activeElement);
      if (current < 0) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0
        : e.key === 'End' ? tools.length - 1
        : (current + step[e.key] + tools.length) % tools.length;
      tools[current].tabIndex = -1;
      tools[next].tabIndex = 0;
      tools[next].focus();
    });
    updateToolbarActive();
  }

  function updateToolbarActive() {
    document.querySelectorAll('.sidebar__tool').forEach(btn => {
      const active = btn.dataset.tool === state.tool;
      btn.classList.toggle('sidebar__tool--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* ── Build color grid ── */

  function buildColors() {
    const grid = $('color-grid');
    grid.innerHTML = '';
    COLORS.forEach(c => {
      // <button> real: accesible por teclado y anunciable con aria-pressed
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'panel__color-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.setAttribute('aria-label', `Color ${c}`);
      swatch.addEventListener('click', () => setColor(c));
      grid.appendChild(swatch);
    });
    updateColorActive();
  }

  function setColor(c) {
    state.color = c;
    $('color-picker').value = c;
    $('color-hex').textContent = c;
    updateColorActive();
  }

  function updateColorActive() {
    document.querySelectorAll('.panel__color-swatch').forEach(s => {
      const active = s.dataset.color === state.color;
      s.classList.toggle('panel__color-swatch--active', active);
      s.setAttribute('aria-pressed', String(active));
    });
  }

  const ERASER_PREVIEW_W = 176, ERASER_PREVIEW_H = 168;

  /** Círculo al tamaño real del borrador, con el mismo trazo doble que el
      indicador que sigue al ratón sobre el lienzo (ver paintOverlay). */
  function renderEraserSizePreview() {
    const cv = $('eraser-size-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(ERASER_PREVIEW_W * dpr)) {
      cv.width = Math.round(ERASER_PREVIEW_W * dpr);
      cv.height = Math.round(ERASER_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Papel del color real del lienzo: sobre el modal oscuro, el aro blanco
    // del indicador no se distinguiría.
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, ERASER_PREVIEW_W, ERASER_PREVIEW_H);
    const pad = 14;
    const maxR = Math.min(ERASER_PREVIEW_W, ERASER_PREVIEW_H) / 2 - pad;
    const r = Math.min(state.eraserSize / 2, maxR);
    pctx.save();
    pctx.translate(ERASER_PREVIEW_W / 2, ERASER_PREVIEW_H / 2);
    pctx.beginPath();
    pctx.arc(0, 0, r, 0, Math.PI * 2);
    pctx.strokeStyle = 'rgba(255,255,255,0.95)';
    pctx.lineWidth = 3;
    pctx.stroke();
    pctx.strokeStyle = 'rgba(26,26,46,0.95)';
    pctx.lineWidth = 1;
    pctx.stroke();
    pctx.restore();
  }

  /** Un solo tamaño, dos mandos: el slider del panel (reutiliza "Trazo") y el
      del modal se mantienen sincronizados, como los gemelos de Edificios. */
  function applyEraserSize(v) {
    state.eraserSize = v;
    $('stroke-slider').value = String(v);
    $('stroke-val').textContent = String(v);
    $('eraser-size-modal-slider').value = String(v);
    $('eraser-size-modal-val').textContent = String(v);
    renderEraserSizePreview();
    scheduleOverlay();
  }

  /** Abre el modal de tamaño del borrador con el valor y la previsualización
      al día. Se llama al elegir la herramienta (como Planta o Balcón abren su
      catálogo) y también desde el botón ⚙ del panel, para poder reabrirlo sin
      soltar la herramienta. */
  function openEraserSizeModal() {
    $('eraser-size-modal-slider').value = String(state.eraserSize);
    $('eraser-size-modal-val').textContent = String(state.eraserSize);
    renderEraserSizePreview();
    $('modal-eraser').showModal();
  }

  /* ── Panel controls wiring ── */

  function wireControls() {
    // Los controles del panel (slider/checkbox/color/select) retienen el foco
    // tras usarlos, y el handler global de teclado ignora los eventos cuyo
    // target es un control: eso dejaba muertos TODOS los atajos (Ctrl+Z/C/V,
    // teclas de herramienta) hasta hacer click en el lienzo. Al terminar de
    // ajustar un control (change = release del slider / toggle / cierre del
    // picker / elección en el select) se suelta el foco y los atajos vuelven a
    // funcionar. Los <select> también: solo cubrir input dejaba «Solapamiento»
    // o «Plantas» enfocados y reproducía el bug que este handler arregla.
    // Se registra en la fase de burbujeo (el handler propio ya corrió antes).
    document.querySelector('.panel').addEventListener('change', e => {
      if (e.target.matches('input, select')) e.target.blur();
    });

    // Color picker
    $('color-picker').addEventListener('input', e => setColor(e.target.value));

    // Stroke slider — semántica dual: con selección edita el grosor de los
    // elementos seleccionados en vivo; sin selección fija el default de
    // creación. Todo el deslizamiento cuenta como UN paso de undo: el
    // snapshot se captura al primer 'input' del gesto y se apila en 'change'.
    let strokeGestureSnap = null;
    $('stroke-slider').addEventListener('input', e => {
      const v = +e.target.value;
      $('stroke-val').textContent = e.target.value;
      if (state.tool === TOOLS.ERASER && !state.selection.length) {
        applyEraserSize(v);
      } else if (state.selection.length) {
        if (!strokeGestureSnap) strokeGestureSnap = snapshot();
        state.selection.forEach(i => {
          state.elements[i] = { ...state.elements[i], lineWidth: v };
        });
        redraw();
      } else {
        state.lineWidth = v;
      }
    });
    // El cierre del gesto no puede depender solo de 'change': un <input
    // type=range> NO dispara 'change' si el valor comprometido coincide con
    // el previo al gesto (p. ej. arrastrar 2→5→2), lo que dejaría un
    // snapshot huérfano que corrompería el siguiente gesto. Por eso se
    // cierra también en pointerup/pointercancel, y si el gesto terminó
    // donde empezó se restauran las referencias originales sin apilar undo.
    function commitStrokeGesture() {
      if (!strokeGestureSnap) return;
      const snap = strokeGestureSnap;
      strokeGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          el.lineWidth === state.elements[i].lineWidth);
      if (unchanged) {
        // Gesto no-op: recupera los objetos originales (solo cambió la
        // identidad de los seleccionados, no sus valores).
        state.elements = snap;
      } else {
        pushUndo(snap);
      }
    }
    $('stroke-slider').addEventListener('change', commitStrokeGesture);
    $('stroke-slider').addEventListener('change', () => {
      if (state.tool === TOOLS.ERASER) savePrefs();
    });
    $('stroke-slider').addEventListener('pointerup', commitStrokeGesture);
    $('stroke-slider').addEventListener('pointercancel', commitStrokeGesture);

    // Modal del tamaño del borrador: mismo dato que el slider "Trazo" de
    // arriba (ver applyEraserSize), solo que con una previsualización más
    // grande. El botón que lo abre solo es visible con el borrador activo.
    $('btn-eraser-size').addEventListener('click', openEraserSizeModal);
    $('eraser-size-modal-slider').addEventListener('input', e => {
      applyEraserSize(+e.target.value);
    });
    $('eraser-size-modal-slider').addEventListener('change', savePrefs);

    // Font slider
    $('font-slider').addEventListener('input', e => {
      state.fontSize = +e.target.value;
      $('font-val').textContent = e.target.value;
    });

    // Zoom slider
    $('zoom-slider').addEventListener('input', e => {
      zoomManual = true;
      applyZoom(+e.target.value / 100);
    });

    // Fondo del lienzo
    $('canvas-bg-picker').value = state.canvasBg;
    $('canvas-bg-picker').addEventListener('input', e => {
      state.canvasBg = e.target.value;
      savePrefs();
      redraw();
    });

    // Color de la cuadrícula
    $('grid-color-picker').value = state.gridColor;
    $('grid-color-picker').addEventListener('input', e => {
      state.gridColor = e.target.value;
      savePrefs();
      redraw();
    });

    // Checkboxes
    // Rellenar formas — semántica dual: con selección rellena/vacía las formas
    // seleccionadas (los demás tipos se ignoran); sin selección fija el default
    // de creación.
    $('check-fill').addEventListener('change', e => {
      const on = e.target.checked;
      if (state.selection.length) {
        const shapes = state.selection.filter(i => FILLABLE_TYPES.includes(state.elements[i].type));
        if (!shapes.length) return;
        saveUndo();
        // Solo alterna `fill`: el `fillColor` que ya tuviera se conserva
        // (queda inerte mientras esté vacía), así apagar y volver a encender
        // recupera el mismo color en vez de perderlo
        shapes.forEach(i => {
          state.elements[i] = { ...state.elements[i], fill: on };
        });
        redraw();
      } else {
        state.fillShapes = on;
      }
    });

    // Relleno translúcido — semántica dual: sólido (off) o con la opacidad
    // elegida en el slider (on).
    $('check-fill-transparent').addEventListener('change', e => {
      const on = e.target.checked;
      $('fill-opacity-slider').disabled = !on;
      if (state.selection.length) {
        const shapes = state.selection.filter(i => FILLABLE_TYPES.includes(state.elements[i].type));
        if (!shapes.length) return;
        saveUndo();
        shapes.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.fillTransparent = true;
          else delete copy.fillTransparent; // sólido = ausencia del flag (retrocompat)
          state.elements[i] = copy;
        });
        redraw();
      } else {
        state.fillTransparent = on;
      }
    });

    // Opacidad del relleno translúcido — 0..100% en UI, 0..1 en el modelo.
    // Como el grosor, todo el arrastre sobre una selección es un único undo.
    let fillOpacityGestureSnap = null;
    $('fill-opacity-slider').addEventListener('input', e => {
      const opacity = +e.target.value / 100;
      $('fill-opacity-val').textContent = e.target.value;
      if (state.selection.length) {
        const shapes = state.selection.filter(i => FILLABLE_TYPES.includes(state.elements[i].type));
        if (!shapes.length) return;
        if (!fillOpacityGestureSnap) fillOpacityGestureSnap = snapshot();
        shapes.forEach(i => {
          state.elements[i] = { ...state.elements[i], fillOpacity: opacity };
        });
        redraw();
      } else {
        state.fillOpacity = opacity;
      }
    });

    function commitFillOpacityGesture() {
      if (!fillOpacityGestureSnap) return;
      const snap = fillOpacityGestureSnap;
      fillOpacityGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          (el.fillOpacity !== undefined ? el.fillOpacity : 0.4) ===
          (state.elements[i].fillOpacity !== undefined ? state.elements[i].fillOpacity : 0.4));
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }
    $('fill-opacity-slider').addEventListener('change', commitFillOpacityGesture);
    $('fill-opacity-slider').addEventListener('pointerup', commitFillOpacityGesture);
    $('fill-opacity-slider').addEventListener('pointercancel', commitFillOpacityGesture);

    // Color de relleno — misma semántica dual. Elegir un color implica querer
    // relleno, así que además lo activa (el checkbox sigue siendo el "off").
    // Como el grosor y la opacidad, todo el gesto es UN paso de undo: el
    // diálogo nativo dispara 'input' por cada tono que se pisa al arrastrar,
    // y un saveUndo() por evento expulsaba el historial entero (límite 50).
    let fillColorGestureSnap = null;
    $('fill-color-picker').addEventListener('input', e => {
      const col = e.target.value;
      if (state.selection.length) {
        const shapes = state.selection.filter(i => FILLABLE_TYPES.includes(state.elements[i].type));
        if (!shapes.length) return;
        if (!fillColorGestureSnap) fillColorGestureSnap = snapshot();
        shapes.forEach(i => {
          state.elements[i] = { ...state.elements[i], fill: true, fillColor: col };
        });
        $('check-fill').checked = true;
        redraw();
      } else {
        state.fillColor = col;
        state.fillShapes = true;
        $('check-fill').checked = true;
      }
    });
    function commitFillColorGesture() {
      if (!fillColorGestureSnap) return;
      const snap = fillColorGestureSnap;
      fillColorGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          (el.fill === state.elements[i].fill &&
           el.fillColor === state.elements[i].fillColor));
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }
    $('fill-color-picker').addEventListener('change', commitFillColorGesture);
    $('overlap-mode').value = state.overlapMode;
    $('overlap-mode').addEventListener('change', e => {
      state.overlapMode = e.target.value === 'hidden-dashed' ? 'hidden-dashed' : 'normal';
      savePrefs();
      redraw();
    });

    // Edificios — SOLO fijan defaults de creación (las herramientas de
    // Edificios son de creación: no hay elemento "edificio" que editar, así que
    // no siguen la semántica dual del panel; no tocan la selección ni el undo).
    // Cada ajuste existe DOS veces: en el panel y en el modal de Fachada. Se
    // cablean por pares contra el mismo `state`, y `syncBuildControls` reparte
    // el valor a los dos juegos de controles después de cada cambio.
    const wireBuildPair = (panelId, modalId, apply) => {
      [panelId, modalId].forEach(id => $(id).addEventListener('change', e => {
        apply(e.target.value);
        syncBuildControls();
        savePrefs();
      }));
    };
    wireBuildPair('build-floors', 'facade-floors', v => {
      state.buildFloors = v === 'auto' ? 'auto' : Number(v);
    });
    wireBuildPair('build-bays', 'facade-bays', v => {
      state.buildBays = v === 'auto' ? 'auto' : Number(v);
    });
    wireBuildPair('build-roof-type', 'facade-roof-type', v => { state.roofType = v; });
    // La pendiente actualiza en vivo al arrastrar (input) y solo persiste al
    // soltar (change), para no escribir prefs en cada paso del slider.
    ['build-roof-pitch', 'facade-roof-pitch'].forEach(id => {
      $(id).addEventListener('input', e => {
        state.roofPitch = Number(e.target.value) / 100;
        syncBuildControls();
      });
      $(id).addEventListener('change', savePrefs);
    });
    // Tipos de hueco de la fachada. Escriben el MISMO state que los modales de
    // las herramientas Puerta y Ventana, así que elegir aquí equivale a haber
    // pasado por ellas — pero sin abandonar el flujo de Fachada.
    fillVariantSelect('facade-door-type', DOOR_TYPES);
    fillVariantSelect('facade-window-type', WINDOW_TYPES);
    $('facade-door-type').addEventListener('change', e => {
      state.doorType = e.target.value;
      updateDoorActive();
      syncBuildControls();
      savePrefs();
    });
    $('facade-window-type').addEventListener('change', e => {
      state.windowType = e.target.value;
      updateWindowActive();
      syncBuildControls();
      savePrefs();
    });
    syncBuildControls();   // valores iniciales (tras restorePrefs) en ambos sitios

    // Etiquetas del jardín: default de creación, NO semántica dual. Las
    // herramientas de Jardín son solo de creación —no hay ningún elemento
    // "jardín" que editar—, así que esto se comporta como los ajustes de
    // Edificios y no como los checkboxes de relleno o doble punta.
    $('check-garden-labels').checked = state.gardenLabels;
    $('check-garden-labels').addEventListener('change', e => {
      state.gardenLabels = e.target.checked;
      savePrefs();
    });
    // Camino: sus dos ajustes existen DOS veces —panel y modal de Camino— y se
    // cablean por pares contra el mismo `state`, igual que los de Edificios.
    // El del modal es el que de verdad importa: es donde está el usuario al
    // elegir el trazado, y llegar al panel puede ser un viaje (por debajo de
    // 1100px ni siquiera está a la vista, es un cajón).
    //
    // «Cualquier inclinación» es un ajuste PEGAJOSO, de un clic, y no una tecla
    // mantenida: Shift+arrastrar exige dos manos y deja fuera a quien solo
    // puede usar una. Shift sigue valiendo, pero solo como atajo opcional.
    ['check-path-any-angle', 'path-any-angle'].forEach(id => {
      $(id).addEventListener('change', e => {
        state.pathAnyAngle = e.target.checked;
        syncPathControls();
        scheduleOverlay();   // si se está arrastrando un camino, que se vea ya
        savePrefs();
      });
    });
    // Ancho: con la inclinación libre el arrastre ya no deja lado corto que
    // leer, así que este deslizador pasa a ser la ÚNICA fuente del grosor.
    // `input` para que el número y la miniatura sigan al dedo; `change` guarda
    // una vez al soltar, no en cada píxel.
    ['garden-path-width', 'path-width-modal'].forEach(id => {
      $(id).addEventListener('input', e => {
        const v = Number(e.target.value);
        if (!Number.isFinite(v)) return;
        state.pathWidth = Math.min(Garden.PATH_W_MAX, Math.max(Garden.PATH_W_MIN, v));
        syncPathControls();
        scheduleOverlay();
      });
      $(id).addEventListener('change', savePrefs);
    });
    syncPathControls();   // valores iniciales (tras restorePrefs) en ambos sitios
    // Doble punta — semántica dual: con selección aplica/quita heads:'both'
    // a las flechas seleccionadas (los no-flecha se ignoran); sin selección
    // fija el default para las nuevas flechas.
    $('check-double-head').addEventListener('change', e => {
      const on = e.target.checked;
      if (state.selection.length) {
        const arrows = state.selection.filter(i => {
          const el = state.elements[i];
          // Los semicírculos (heads:'none') nunca llevan punta
          return (el.type === 'arrow' || el.type === 'curveArrow') && el.heads !== 'none';
        });
        if (!arrows.length) return;
        saveUndo();
        arrows.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.heads = 'both';
          else delete copy.heads;
          state.elements[i] = copy;
        });
        redraw();
      } else {
        state.doubleHead = on;
      }
    });
    // Trazo discontinuo: misma semántica dual que la doble punta, sobre
    // line/arrow/curveArrow
    $('check-dash').addEventListener('change', e => {
      const on = e.target.checked;
      if (state.selection.length) {
        const strokes = state.selection.filter(i => {
          const t = state.elements[i].type;
          return t === 'line' || t === 'arrow' || t === 'curveArrow';
        });
        if (!strokes.length) return;
        saveUndo();
        strokes.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.dash = true;
          else delete copy.dash;
          state.elements[i] = copy;
        });
        redraw();
      } else {
        state.dashed = on;
      }
    });
    $('check-grid').addEventListener('change', e => { state.showGrid = e.target.checked; redraw(); });
    $('check-snap').addEventListener('change', e => { state.snapGrid = e.target.checked; });
    $('check-multi-select').addEventListener('change', e => { state.multiSelect = e.target.checked; });

    // Undo / Redo
    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);

    // Clear
    $('btn-clear').addEventListener('click', () => {
      cancelCurveChain();
      saveUndo();
      state.elements = [];
      setSelection([]);
      // El fondo y la cuadrícula también vuelven a su color original
      state.canvasBg = DEFAULT_CANVAS_BG;
      state.gridColor = DEFAULT_GRID_COLOR;
      state.overlapMode = 'normal';
      state.eraserSize = DEFAULT_ERASER_SIZE;
      $('canvas-bg-picker').value = DEFAULT_CANVAS_BG;
      $('grid-color-picker').value = DEFAULT_GRID_COLOR;
      $('overlap-mode').value = 'normal';
      // Los defaults de creación de Edificios/Jardín también vuelven: sin
      // esto, el siguiente savePrefs() (p. ej. cambiar el fondo) reescribía
      // la configuración que el removeItem de abajo acababa de borrar.
      Object.assign(state, CREATION_DEFAULTS);
      syncBuildControls();
      syncPathControls();
      $('check-garden-labels').checked = state.gardenLabels;
      // El zoom vuelve al ajuste automático, no a un 100% fijo: «Limpiar todo»
      // debe dejar la app igual que recién abierta, y ahí el lienzo aprovecha
      // todo el ancho disponible. Olvidar `zoomManual` es parte del reset: si
      // no, el auto-ajuste seguiría desactivado para el resto de la sesión.
      zoomManual = false;
      fitZoomToViewport();
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
        localStorage.removeItem(PREFS_KEY);
      } catch (_) {}
      redraw();
    });

    // Selection actions
    $('btn-delete-sel').addEventListener('click', deleteSelection);
    $('btn-duplicate-sel').addEventListener('click', duplicateSelection);
    $('btn-rotate-sel').addEventListener('click', rotateSelection);

    // Import
    $('btn-import').addEventListener('click', async () => {
      const els = await Exporter.importJSON();
      if (els) {
        saveUndo();
        state.elements = withSeeds(els);
        state.overlapMode = els.overlapMode === 'hidden-dashed' ? 'hidden-dashed' : 'normal';
        $('overlap-mode').value = state.overlapMode;
        savePrefs();
        // Los índices de selección previos apuntarían a elementos importados
        // arbitrarios; se limpia como al cargar una plantilla.
        setSelection([]);
        redraw();
      }
    });
  }

  /* ── Undo / Redo ── */

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(snapshot());
    state.elements = state.undoStack.pop();
    setSelection([]);
    redraw();
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(snapshot());
    state.elements = state.redoStack.pop();
    setSelection([]);
    redraw();
  }

  /* ── Keyboard shortcuts ── */

  const TOOL_KEYS = {};
  TOOL_GROUPS.forEach(g => g.tools.forEach(t => { if (t.key) TOOL_KEYS[t.key] = t.id; }));

  const NUDGE = {
    ArrowLeft:  [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp:    [0, -1],
    ArrowDown:  [0, 1],
  };

  document.addEventListener('keydown', e => {
    // No capturar mientras se escribe en cualquier control
    const tag = e.target.tagName;
    if (e.target === textInput || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (state.curveChain) {
      const chainKey = e.key.toLowerCase();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelCurveChain();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (state.curveChain.segments.length) state.curveChain.segments.pop();
        else cancelCurveChain();
        if (state.curveChain) {
          lastPos = curveChainLastPoint();
          scheduleOverlay();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        finishCurveChain();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && chainKey === 'z') {
        e.preventDefault();
        cancelCurveChain();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey &&
          TOOL_KEYS[chainKey] && TOOL_KEYS[chainKey] !== state.tool) {
        e.preventDefault();
        selectTool(TOOL_KEYS[chainKey]);
        return;
      }
    }

    // Ignorar atajos mientras hay un gesto de puntero en curso (dibujo, resize,
    // arrastre o marquee): borrar/deshacer/cambiar de herramienta a media
    // interacción dejaría índices y flags a medias (p.ej. escribir en
    // state.elements[undefined] al redimensionar tras un Supr).
    if (state.isDrawing || state.curveChain || state.resizing ||
        state.dragLast || state.marquee) return;

    const k = e.key.toLowerCase();

    // Ayuda: '?' abre el modal de atajos (y vuelve a cerrarlo). Solo lo ABRE
    // si no hay otro modal delante: corre antes del guard de dialog[open]
    // para poder cerrarse a sí mismo, pero no debe apilarse sobre Exportar.
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const help = $('modal-help');
      if (help.open) help.close();
      else if (!document.querySelector('dialog[open]')) help.showModal();
      return;
    }

    // Con un modal <dialog> abierto (export, plantillas, emoji, ayuda) ningún
    // otro atajo debe tocar el lienzo de detrás: el keydown burbujea hasta
    // document aunque el foco esté atrapado en el diálogo. Escape lo cierra de
    // forma nativa. (El '?' de arriba sí sigue funcionando para cerrar la ayuda.)
    if (document.querySelector('dialog[open]')) return;

    // Undo / Redo (Cmd+Shift+Z es el redo estándar en macOS)
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateSelection(); return; }

    // Shift+R: girar cada forma compatible por su paso discreto. Se consume
    // SIEMPRE (haya o no formas rotables): si cayera al selector de
    // herramientas, rotar una selección sin rotables activaba Rectángulo
    // (k === 'r') y perdía la selección.
    if (k === 'r' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (state.selection.some(i => ShapeRotation.isType(state.elements[i].type))) {
        rotateSelection();
      }
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection.length) {
      e.preventDefault();
      deleteSelection();
      return;
    }

    if (e.key === 'Escape' && state.selection.length) {
      setSelection([]);
      redraw();
      return;
    }

    // Ctrl/Cmd+A: seleccionar todo (con la herramienta Mover)
    if ((e.ctrlKey || e.metaKey) && k === 'a') {
      e.preventDefault();
      selectTool(TOOLS.SELECT);
      setSelection(state.elements.map((el, i) => el.type === 'eraser' ? -1 : i).filter(i => i >= 0));
      redraw();
      return;
    }

    // Nudge de la selección con flechas (Shift: paso de cuadrícula)
    if (NUDGE[e.key] && state.selection.length) {
      e.preventDefault();
      const f = e.shiftKey ? GRID_STEP : 1;
      // Solo la primera pulsación apila undo: mantener la tecla (auto-repeat)
      // extiende el mismo paso, en vez de apilar uno por repetición y expulsar
      // todo el historial anterior (el stack está limitado a 50).
      if (!e.repeat) saveUndo();
      state.selection.forEach(i => {
        state.elements[i] = moveElement(state.elements[i], NUDGE[e.key][0] * f, NUDGE[e.key][1] * f);
      });
      redraw();
      return;
    }

    // F: invertir el lado del giro de las flechas curvas seleccionadas.
    // Sin filtrar el auto-repeat, mantener la tecla apilaba ~30 undos/s y
    // expulsaba el historial entero (límite 50) — mismo motivo que en NUDGE.
    // En los toggles (F/Q/D/S) la repetición se ignora del todo: alternar en
    // ráfaga no tiene sentido y solo mete ruido.
    if (k === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        state.selection.some(i => state.elements[i].type === 'curveArrow')) {
      if (e.repeat) return;
      saveUndo();
      state.selection.forEach(i => {
        if (state.elements[i].type === 'curveArrow') {
          state.elements[i] = flipCurve(state.elements[i]);
        }
      });
      redraw();
      return;
    }

    // Q: alternar semicírculo en las flechas curvas seleccionadas
    // (activar = snap a 180° conservando el lado, sin puntas; desactivar
    // deja la cúbica tal cual, quitando la marca y recuperando la punta)
    if (k === 'q' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        state.selection.some(i => state.elements[i].type === 'curveArrow' &&
                                  !CurvePath.isChain(state.elements[i]))) {
      if (e.repeat) return;
      saveUndo();
      state.selection.forEach(i => {
        const el = state.elements[i];
        if (el.type !== 'curveArrow' || CurvePath.isChain(el)) return;
        if (el.arc === true) {
          const copy = { ...el };
          delete copy.arc;
          if (copy.heads === 'none') delete copy.heads;
          state.elements[i] = copy;
        } else {
          state.elements[i] = { ...toArc(el), heads: 'none' };
        }
      });
      redraw();
      return;
    }

    // D: invertir la dirección de las flechas seleccionadas (la punta pasa
    // al otro extremo; en curvas la forma no cambia)
    if (k === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        state.selection.some(i => ['arrow', 'curveArrow'].includes(state.elements[i].type))) {
      if (e.repeat) return;
      saveUndo();
      state.selection.forEach(i => {
        if (['arrow', 'curveArrow'].includes(state.elements[i].type)) {
          state.elements[i] = reverseArrow(state.elements[i]);
        }
      });
      redraw();
      return;
    }

    // S: alternar la flecha curva seleccionada entre curva simple (cuadrática)
    // y curva en S (cúbica con dos controles)
    if (k === 's' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        state.selection.length === 1 &&
        state.elements[state.selection[0]].type === 'curveArrow' &&
        !CurvePath.isChain(state.elements[state.selection[0]])) {
      if (e.repeat) return;
      const el = state.elements[state.selection[0]];
      saveUndo();
      if (el.cx2 !== undefined) {
        // Cúbica → cuadrática: quitar el segundo control y resetear el primero
        // (la marca de arco no puede sobrevivir en una cuadrática)
        const copy = { ...el };
        delete copy.cx2;
        delete copy.cy2;
        delete copy.arc;
        const c = defaultCtrl({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, false);
        copy.cx = c.cx;
        copy.cy = c.cy;
        state.elements[state.selection[0]] = copy;
      } else {
        // Cuadrática → S canónica conservando la intensidad lateral actual
        const fr = chordFrame(el);
        const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
        let sVal = 0.25 * len;
        if (fr) {
          const cur = (el.cx - fr.mx) * fr.ux + (el.cy - fr.my) * fr.uy;
          if (Math.abs(cur) > 1) sVal = cur;
        }
        state.elements[state.selection[0]] = { ...el, ...defaultCubicCtrls(el, sVal) };
      }
      redraw();
      return;
    }

    // +/−: ajustar la intensidad de curvatura de la flecha curva seleccionada
    // ('+' aleja cada control del eje en su lado actual, '−' lo acerca y puede
    // cruzar; Shift: paso fino de 1px). Conserva la componente lateral y,
    // en cúbica, la forma en S (cada control según su propio signo).
    if ((e.key === '+' || e.key === '=' || e.key === '-') &&
        !e.ctrlKey && !e.metaKey && !e.altKey && state.selection.length === 1) {
      const el = state.elements[state.selection[0]];
      if (el.type === 'curveArrow' && !CurvePath.isChain(el)) {
        // Semicírculo (siempre 180°): +/− ajustan el RADIO con pasos de
        // 5px/1px; el centro del diámetro no se mueve. En arcos anclados
        // el redraw re-materializa los extremos (el ajuste no persiste).
        if (el.arc === true) {
          const mag = (e.shiftKey ? 1 : 5) * (e.key === '-' ? -1 : 1);
          const R = Math.hypot(el.x2 - el.x1, el.y2 - el.y1) / 2 + mag;
          const copy = resizeArc(el, R);
          if (copy !== el) {
            e.preventDefault();
            // Como en NUDGE: solo la primera pulsación apila undo; mantener
            // la tecla extiende el mismo paso en vez de inundar el historial.
            if (!e.repeat) saveUndo();
            state.elements[state.selection[0]] = copy;
            redraw();
          }
          return;
        }
        const fr = chordFrame(el);
        if (fr) {
          e.preventDefault();
          const mag = (e.shiftKey ? 1 : 5) * (e.key === '-' ? -1 : 1);
          const shifted = (cx, cy) => {
            const sVal = (cx - fr.mx) * fr.ux + (cy - fr.my) * fr.uy;
            const d = mag * (Math.sign(sVal) || 1);
            return { x: cx + d * fr.ux, y: cy + d * fr.uy };
          };
          if (!e.repeat) saveUndo();
          const c1 = shifted(el.cx, el.cy);
          const copy = { ...el, cx: c1.x, cy: c1.y };
          if (el.cx2 !== undefined) {
            const c2 = shifted(el.cx2, el.cy2);
            copy.cx2 = c2.x;
            copy.cy2 = c2.y;
          }
          state.elements[state.selection[0]] = copy;
          redraw();
        }
        return;
      }
    }

    // Selección de herramienta por tecla. El preventDefault NO es cosmético:
    // sin él la tecla sigue viva y, si la herramienta abre un modal, la recibe
    // el primer control enfocado — pulsar "1" (Fachada) acababa fijando
    // Plantas=1 por el type-ahead del <select>.
    if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[k]) {
      e.preventDefault();
      selectTool(TOOL_KEYS[k]);
    }
  });

  /* ── Modals ── */

  // Si un modal de Edificios se cierra SIN elegir variante (botón Cerrar, Escape o
  // clic en el backdrop —todos terminan en modal.close(), que emite 'close'—),
  // restaura la herramienta previa para no quedar en una herramienta de creación
  // "a medias". Elegir variante pone variantChosen=true y se conserva la herramienta.
  function wireBuildModalCancel(modal) {
    modal.addEventListener('close', () => {
      if (state.variantChosen) { state.variantChosen = false; return; }
      const prev = state.toolBeforeModal;
      state.toolBeforeModal = null;
      if (!prev || prev === state.tool) return; // reentrada: mantener la herramienta actual
      // Evita reabrir otro modal en cascada: si la previa también abre modal, ir a Seleccionar.
      selectTool(opensVariantModal(prev) ? TOOLS.SELECT : prev);
    });
  }

  function setupModals() {
    // Panel-cajón en pantallas estrechas (≤1100px): el botón "⚙ Panel" lo
    // muestra/oculta y el fondo o Escape lo cierran. En pantallas anchas el
    // botón está oculto por CSS y el panel es fijo, así que no tiene efecto.
    // aria-expanded viaja con la clase para que un lector de pantalla sepa
    // si el cajón está abierto sin verlo.
    const appEl = document.querySelector('.app');
    const panelToggle = $('btn-panel-toggle');
    const setPanelOpen = open => {
      appEl.classList.toggle('app--panel-open', open);
      panelToggle.setAttribute('aria-expanded', String(open));
    };
    panelToggle.addEventListener('click',
      () => setPanelOpen(!appEl.classList.contains('app--panel-open')));
    $('panel-backdrop').addEventListener('click', () => setPanelOpen(false));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !appEl.classList.contains('app--panel-open')) return;
      // Con un modal abierto, Escape pertenece al <dialog> (que se cierra solo).
      for (const d of document.querySelectorAll('dialog')) if (d.open) return;
      setPanelOpen(false);
    });

    // Un <dialog> trata como "click en el backdrop" cualquier click cuyo
    // target sea el propio dialog — incluido su padding interno, que cerraría
    // el modal por error. Solo se cierra si el click cae FUERA del rectángulo
    // del cuadro (el backdrop de verdad).
    const closeOnBackdrop = modal => modal.addEventListener('click', e => {
      if (e.target !== modal) return; // click en un hijo: nunca cierra
      const r = modal.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) modal.close();
    });

    // <dialog> nativo: showModal() da foco, trampa de Tab y Escape gratis
    const exportModal = $('modal-export');
    $('btn-export').addEventListener('click', () => exportModal.showModal());
    exportModal.querySelector('.modal__cancel').addEventListener('click', () => exportModal.close());
    closeOnBackdrop(exportModal);
    exportModal.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        Exporter[btn.dataset.export](state.elements, { overlapMode: state.overlapMode });
        exportModal.close();
      });
    });

    const tplModal = $('modal-templates');
    $('btn-templates').addEventListener('click', () => tplModal.showModal());
    tplModal.querySelector('.modal__cancel').addEventListener('click', () => tplModal.close());
    closeOnBackdrop(tplModal);
    tplModal.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveUndo();
        state.elements = withSeeds(Templates.get(btn.dataset.template));
        setSelection([]);
        tplModal.close();
        redraw();
      });
    });

    const helpModal = $('modal-help');
    $('btn-help').addEventListener('click', () => helpModal.showModal());
    helpModal.querySelector('.modal__cancel').addEventListener('click', () => helpModal.close());
    closeOnBackdrop(helpModal);

    const eraserModal = $('modal-eraser');
    eraserModal.querySelector('.modal__cancel').addEventListener('click', () => eraserModal.close());
    closeOnBackdrop(eraserModal);

    const emojiModal = $('modal-emoji');
    buildEmojiCatalog();
    emojiModal.querySelector('.modal__cancel').addEventListener('click', () => emojiModal.close());
    closeOnBackdrop(emojiModal);
    emojiModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__emoji');
      if (!btn) return;
      state.pendingEmoji = btn.textContent;
      updateEmojiActive();
      emojiModal.close();
    });

    const plantaModal = $('modal-planta');
    buildPlantaCatalog();
    plantaModal.querySelector('.modal__cancel').addEventListener('click', () => plantaModal.close());
    closeOnBackdrop(plantaModal);
    wireBuildModalCancel(plantaModal);
    plantaModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__shape');
      if (!btn) return;
      state.plantaShape = btn.dataset.shape;
      state.variantChosen = true;
      updatePlantaActive();
      savePrefs();
      plantaModal.close();
    });

    const doorModal = $('modal-door');
    buildDoorCatalog();
    doorModal.querySelector('.modal__cancel').addEventListener('click', () => doorModal.close());
    closeOnBackdrop(doorModal);
    wireBuildModalCancel(doorModal);
    doorModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__door');
      if (!btn) return;
      state.doorType = btn.dataset.door;
      state.variantChosen = true;
      updateDoorActive();
      savePrefs();
      doorModal.close();
    });

    const windowModal = $('modal-window');
    buildWindowCatalog();
    windowModal.querySelector('.modal__cancel').addEventListener('click', () => windowModal.close());
    closeOnBackdrop(windowModal);
    wireBuildModalCancel(windowModal);
    windowModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__window');
      if (!btn) return;
      state.windowType = btn.dataset.window;
      state.variantChosen = true;
      updateWindowActive();
      savePrefs();
      windowModal.close();
    });

    const roofModal = $('modal-roof');
    buildRoofCatalog();
    roofModal.querySelector('.modal__cancel').addEventListener('click', () => roofModal.close());
    closeOnBackdrop(roofModal);
    wireBuildModalCancel(roofModal);
    roofModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__roof');
      if (!btn) return;
      state.roofShape = btn.dataset.roof;
      state.variantChosen = true;
      updateRoofActive();
      savePrefs();
      roofModal.close();
    });

    const facadeModal = $('modal-facade');
    buildFacadeCatalog();
    facadeModal.querySelector('.modal__cancel').addEventListener('click', () => facadeModal.close());
    closeOnBackdrop(facadeModal);
    wireBuildModalCancel(facadeModal);
    facadeModal.addEventListener('click', e => {
      const btn = e.target.closest('.modal__facade');
      if (!btn) return;
      state.facadeShape = btn.dataset.facade;
      state.variantChosen = true;
      updateFacadeActive();
      syncBuildControls();   // la vista decide qué ajustes aplican
      savePrefs();
      facadeModal.close();
    });
    // Pasar el puntero (o el foco) por una vista la muestra en la miniatura sin
    // elegirla; al salir vuelve la elegida. Un solo listener por evento: los
    // hijos del botón resuelven al mismo `closest`, y fuera de los botones da
    // null, así que no parpadea al moverse entre el icono y su etiqueta.
    let hoverShape = null;
    const previewOnHover = e => {
      const btn = e.target.closest && e.target.closest('.modal__facade');
      const shape = btn ? btn.dataset.facade : null;
      if (shape === hoverShape) return;
      hoverShape = shape;
      renderFacadePreview(shape || undefined);
    };
    facadeModal.addEventListener('pointerover', previewOnHover);
    facadeModal.addEventListener('focusin', previewOnHover);
    facadeModal.addEventListener('close', () => { hoverShape = null; });

    // Balcón y Jardín: todos se cablean con la misma receta desde VARIANT_MODALS.
    VARIANT_MODALS.forEach(cfg => {
      const modal = $(cfg.modal);
      buildVariantCatalog(cfg);
      modal.querySelector('.modal__cancel').addEventListener('click', () => modal.close());
      closeOnBackdrop(modal);
      wireBuildModalCancel(modal);
      modal.addEventListener('click', e => {
        const btn = e.target.closest('.' + cfg.cls);
        if (!btn) return;
        state[cfg.key] = btn.dataset[cfg.data];
        state.variantChosen = true;
        updateVariantActive(cfg);
        savePrefs();
        modal.close();
      });
    });
  }

  /* ── Catálogos genéricos (Balcón y Jardín) ── */

  const GARDEN_ICON_W = 56, GARDEN_ICON_H = 48;   // deben coincidir con .modal__shape canvas

  /**
   * Icono de una variante: NO es un dibujo aparte, es la propia geometría que
   * saldrá al arrastrar, pintada por el mismo par (`cfg.gen().elements` +
   * drawPiecesPreview) que usa la previsualización. Así el icono no puede
   * desincronizarse de lo que hace la herramienta —que es justo el riesgo de
   * los iconos SVG a mano de Edificios— y evita dibujar decenas de siluetas.
   *
   * Se pinta sin etiqueta: a este tamaño el texto no se leería, y el botón ya
   * muestra el nombre debajo (`labels` solo lo entiende el jardín; Building lo
   * ignora sin más).
   */
  function variantIcon(cfg, variantId) {
    const canvas = document.createElement('canvas');
    canvas.className = 'modal__shape-icon';
    canvas.setAttribute('aria-hidden', 'true');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GARDEN_ICON_W * dpr;
    canvas.height = GARDEN_ICON_H * dpr;
    canvas.style.width = GARDEN_ICON_W + 'px';
    canvas.style.height = GARDEN_ICON_H + 'px';
    const ictx = canvas.getContext('2d');
    if (!ictx) return canvas;
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // El modal es oscuro y la tinta del dibujo no: se pinta el papel primero.
    ictx.fillStyle = state.canvasBg;
    ictx.fillRect(0, 0, GARDEN_ICON_W, GARDEN_ICON_H);

    const opts = { ...cfg.opts(), [cfg.key]: variantId, labels: false };
    const els = cfg.gen().elements(cfg.tool, { x: 0, y: 0 }, cfg.box, opts);
    if (!els.length) return canvas;
    // Ajuste por los bounds REALES: las frondas y las ondas se salen de la caja
    // del arrastre, y recortadas el icono engañaría.
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    });
    const pad = 5;
    const s = Math.min((GARDEN_ICON_W - pad * 2) / Math.max(1, x2 - x1),
                       (GARDEN_ICON_H - pad * 2) / Math.max(1, y2 - y1));
    ictx.translate(GARDEN_ICON_W / 2, GARDEN_ICON_H / 2);
    ictx.scale(s, s);
    ictx.translate(-(x1 + x2) / 2, -(y1 + y2) / 2);
    // A esta escala el trazo fino del detalle desaparecería: se le pone suelo.
    drawPiecesPreview(ictx, els.map(el => ({ ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s) })));
    return canvas;
  }

  /** Rellena un catálogo de variantes. Sin innerHTML: createElement y textContent. */
  function buildVariantCatalog(cfg) {
    const root = $(cfg.root);
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid';
    cfg.catalog.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape ' + cfg.cls;
      btn.type = 'button';
      btn.dataset[cfg.data] = item.id;
      btn.title = item.name;
      btn.appendChild(variantIcon(cfg, item.id));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = item.name;
      btn.appendChild(name);
      // El <dialog> enfoca solo su primer control; se le señala el activo para
      // que la tecla que abrió el modal no acabe escribiendo en otro sitio.
      if (item.id === state[cfg.key]) btn.autofocus = true;
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateVariantActive(cfg);
  }

  /** Resalta la variante activa. La consulta va acotada a su propio catálogo. */
  function updateVariantActive(cfg) {
    $(cfg.root).querySelectorAll('.' + cfg.cls).forEach(btn => {
      const active = btn.dataset[cfg.data] === state[cfg.key];
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** Rellena el modal con el catálogo de config.js (textContent, nunca HTML) */
  function buildEmojiCatalog() {
    const root = $('emoji-catalog');
    root.innerHTML = '';
    EMOJI_GROUPS.forEach(group => {
      const wrap = document.createElement('div');
      wrap.className = 'modal__emoji-group';
      const label = document.createElement('span');
      label.className = 'modal__emoji-label';
      label.textContent = group.label;
      wrap.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'modal__emoji-grid';
      group.emojis.forEach(em => {
        const btn = document.createElement('button');
        btn.className = 'modal__emoji';
        btn.type = 'button';
        btn.textContent = em;
        btn.title = `Insertar ${em}`;
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
    updateEmojiActive();
  }

  /** Dibuja el icono SVG de una huella (mismo silueta que crea Building). */
  function plantaIcon(shape) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 44 32');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
    };
    if (shape === 'l') {
      add('polygon', { points: '8,8 17,8 17,17 37,17 37,24 8,24' });
    } else if (shape === 'u') {
      add('polygon', { points: '8,8 15,8 15,20 29,20 29,8 36,8 36,24 8,24' });
    } else if (shape === 'claustro') {
      add('rect', { x: 8, y: 8, width: 28, height: 16 });
      add('rect', { x: 15, y: 13, width: 14, height: 6 });
    } else { // rect
      add('rect', { x: 7, y: 8, width: 30, height: 16 });
    }
    return svg;
  }

  /** Rellena el modal de plantas desde config.js (DOM directo, nunca innerHTML) */
  function buildPlantaCatalog() {
    const root = $('planta-catalog');
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid';
    PLANTA_SHAPES.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape';
      btn.type = 'button';
      btn.dataset.shape = s.id;
      btn.title = `Planta ${s.name}`;
      btn.appendChild(plantaIcon(s.id));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = s.name;
      btn.appendChild(name);
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updatePlantaActive();
  }

  function updatePlantaActive() {
    $('planta-catalog').querySelectorAll('.modal__shape').forEach(btn => {
      const active = btn.dataset.shape === state.plantaShape;
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** Dibuja el icono SVG de un tipo de puerta (arco vía path A de SVG). */
  function doorIcon(id) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 36 46');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
    };
    const L = 8, R = 28, TOP = 8, BOT = 40, cx = 18, r = 10, spring = TOP + r;
    const ARC = `M${L},${spring} A${r},${r} 0 0 1 ${R},${spring}`; // sweep 1 = comba hacia arriba (eje-y abajo)
    if (id === 'frame') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
    } else if (id === 'door') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: L, y1: TOP + 7, x2: R, y2: TOP + 7 });   // dintel
      add('line', { x1: cx, y1: TOP + 7, x2: cx, y2: BOT });      // junta
    } else if (id === 'arch') {
      add('path', { d: ARC });
      add('rect', { x: L, y: spring, width: R - L, height: BOT - spring });
      add('line', { x1: cx, y1: spring, x2: cx, y2: BOT });       // junta
    } else if (id === 'double') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: cx, y1: TOP, x2: cx, y2: BOT });          // montante central
      add('line', { x1: cx - 5, y1: 26, x2: cx - 5, y2: 30 });    // tirador izq
      add('line', { x1: cx + 5, y1: 26, x2: cx + 5, y2: 30 });    // tirador der
    } else if (id === 'doubleFrame') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: cx, y1: TOP, x2: cx, y2: BOT });          // montante central
    } else if (id === 'panel') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('rect', { x: L + 4, y: TOP + 4, width: R - L - 8, height: 12 });   // panel sup
      add('rect', { x: L + 4, y: TOP + 20, width: R - L - 8, height: 12 });  // panel inf
    } else if (id === 'garage') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: L, y1: TOP + 8, x2: R, y2: TOP + 8 });    // lamas
      add('line', { x1: L, y1: TOP + 16, x2: R, y2: TOP + 16 });
      add('line', { x1: L, y1: TOP + 24, x2: R, y2: TOP + 24 });
    } else { // archFrame
      add('path', { d: ARC });
      add('line', { x1: L, y1: spring, x2: L, y2: BOT });         // jamba izq
      add('line', { x1: R, y1: spring, x2: R, y2: BOT });         // jamba der
      add('line', { x1: L, y1: BOT, x2: R, y2: BOT });            // umbral
    }
    return svg;
  }

  /** Rellena el modal de puertas desde config.js (DOM directo, nunca innerHTML) */
  function buildDoorCatalog() {
    const root = $('door-catalog');
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid';
    DOOR_TYPES.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape modal__door';
      btn.type = 'button';
      btn.dataset.door = d.id;
      btn.title = d.name;
      btn.appendChild(doorIcon(d.id));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = d.name;
      btn.appendChild(name);
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateDoorActive();
  }

  function updateDoorActive() {
    $('door-catalog').querySelectorAll('.modal__door').forEach(btn => {
      const active = btn.dataset.door === state.doorType;
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** Dibuja el icono SVG de un tipo de ventana (arco vía path A de SVG). */
  function windowIcon(id) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 42');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
    };
    const L = 8, R = 32, TOP = 6, BOT = 34, cx = 20, r = 12, spring = TOP + r; // spring=18
    const ARC = `M${L},${spring} A${r},${r} 0 0 1 ${R},${spring}`; // sweep 1 = comba arriba
    const mid = (a, b) => (a + b) / 2;
    const t3 = TOP + (BOT - TOP) / 3, t3b = TOP + 2 * (BOT - TOP) / 3;
    const ccy = mid(TOP, BOT), rr = (R - L) / 2;
    if (id === 'frame') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
    } else if (id === 'window') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: cx, y1: TOP, x2: cx, y2: BOT });                    // montante
      add('line', { x1: L, y1: mid(TOP, BOT), x2: R, y2: mid(TOP, BOT) });  // travesaño
      add('line', { x1: L - 2, y1: BOT + 3, x2: R + 2, y2: BOT + 3 });      // alféizar
    } else if (id === 'arch') {
      add('path', { d: ARC });
      add('rect', { x: L, y: spring, width: R - L, height: BOT - spring });
      add('line', { x1: cx, y1: spring, x2: cx, y2: BOT });
      add('line', { x1: L, y1: mid(spring, BOT), x2: R, y2: mid(spring, BOT) });
      add('line', { x1: L - 2, y1: BOT + 3, x2: R + 2, y2: BOT + 3 });      // alféizar
    } else if (id === 'double') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: cx, y1: TOP, x2: cx, y2: BOT });                    // montante central
      add('line', { x1: L, y1: mid(TOP, BOT), x2: R, y2: mid(TOP, BOT) });  // travesaño
      add('line', { x1: L - 2, y1: BOT + 3, x2: R + 2, y2: BOT + 3 });      // alféizar
    } else if (id === 'grid') {
      add('rect', { x: L, y: TOP, width: R - L, height: BOT - TOP });
      add('line', { x1: cx, y1: TOP, x2: cx, y2: BOT });                    // montante
      add('line', { x1: L, y1: t3, x2: R, y2: t3 });                        // travesaños
      add('line', { x1: L, y1: t3b, x2: R, y2: t3b });
      add('line', { x1: L - 2, y1: BOT + 3, x2: R + 2, y2: BOT + 3 });      // alféizar
    } else if (id === 'round') {
      add('circle', { cx, cy: ccy, r: rr });
      add('line', { x1: cx, y1: ccy - rr, x2: cx, y2: ccy + rr });          // cruz vertical
      add('line', { x1: cx - rr, y1: ccy, x2: cx + rr, y2: ccy });          // cruz horizontal
    } else if (id === 'roundFrame') {
      add('circle', { cx, cy: ccy, r: rr });
    } else { // archFrame
      add('path', { d: ARC });
      add('line', { x1: L, y1: spring, x2: L, y2: BOT });
      add('line', { x1: R, y1: spring, x2: R, y2: BOT });
      add('line', { x1: L, y1: BOT, x2: R, y2: BOT });
    }
    return svg;
  }

  /** Rellena el modal de ventanas desde config.js (DOM directo, nunca innerHTML) */
  function buildWindowCatalog() {
    const root = $('window-catalog');
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid';
    WINDOW_TYPES.forEach(wt => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape modal__window';
      btn.type = 'button';
      btn.dataset.window = wt.id;
      btn.title = wt.name;
      btn.appendChild(windowIcon(wt.id));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = wt.name;
      btn.appendChild(name);
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateWindowActive();
  }

  function updateWindowActive() {
    $('window-catalog').querySelectorAll('.modal__window').forEach(btn => {
      const active = btn.dataset.window === state.windowType;
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** Dibuja el icono SVG de un tipo de tejado (misma silueta que crea Building). */
  function roofIcon(id) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 44 32');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); svg.appendChild(el); };
    if (id === 'mono') {
      add('polygon', { points: '8,24 36,10 36,24' });          // un agua
    } else if (id === 'flat') {
      add('rect', { x: 8, y: 15, width: 28, height: 6 });       // plano
    } else if (id === 'hip') {
      add('polygon', { points: '8,24 16,11 28,11 36,24' });     // cuatro aguas (trapecio)
    } else if (id === 'mansard') {
      add('polygon', { points: '8,24 13,16 19,10 25,10 31,16 36,24' }); // mansarda (quiebre)
    } else { // gable
      add('polygon', { points: '8,24 22,9 36,24' });            // dos aguas
    }
    return svg;
  }

  function buildRoofCatalog() {
    const root = $('roof-catalog');
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid';
    ROOF_TYPES.forEach(rt => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape modal__roof';
      btn.type = 'button';
      btn.dataset.roof = rt.id;
      btn.title = `Tejado ${rt.name}`;
      btn.appendChild(roofIcon(rt.id));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = rt.name;
      btn.appendChild(name);
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateRoofActive();
  }

  function updateRoofActive() {
    $('roof-catalog').querySelectorAll('.modal__roof').forEach(btn => {
      const active = btn.dataset.roof === state.roofShape;
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** Faldón del icono de Alzado según la cubierta ACTIVA (`state.roofType`):
      el botón no puede prometer «2 aguas» si el panel Edificios tiene puesta
      otra cubierta. Caja del tejado: x 13..31, cumbre y=6, alero y=14. */
  const FACADE_ROOF_PTS = {
    gable:   '13,14 22,6 31,14',                    // dos aguas (ápice)
    hip:     '13,14 18,6 26,6 31,14',               // cuatro aguas (cumbrera corta)
    mansard: '13,14 15,10 19,6 25,6 29,10 31,14',   // mansarda (quiebre)
  };

  /** Nombre legible de la cubierta activa (título del botón de alzado). */
  const activeRoofName = () =>
    (ROOF_TYPES.find(rt => rt.id === state.roofType) || ROOF_TYPES[0]).name;

  /**
   * Único punto de sincronización de los defaults de Edificios: empuja el
   * `state` a los DOS juegos de controles (panel y modal de Fachada) y repinta
   * la miniatura. Asignar `.value` por código no dispara eventos, así que los
   * dos juegos no pueden realimentarse. Llamar tras cualquier cambio.
   */
  function syncBuildControls() {
    const pitch = String(Math.round(state.roofPitch * 100));
    // Cada valor va a su control del panel y a su gemelo del modal.
    const setBoth = (panelId, modalId, value) => {
      $(panelId).value = value;
      $(modalId).value = value;
    };
    setBoth('build-floors',    'facade-floors',    String(state.buildFloors));
    setBoth('build-bays',      'facade-bays',      String(state.buildBays));
    setBoth('build-roof-pitch','facade-roof-pitch', pitch);
    setBoth('build-roof-type', 'facade-roof-type',  state.roofType);
    $('build-pitch-val').textContent = pitch;
    $('facade-pitch-val').textContent = pitch;
    // Tipos de hueco: solo existen en el modal (su gemelo son los catálogos de
    // las herramientas Puerta y Ventana, que escriben el mismo state).
    $('facade-door-type').value = state.doorType;
    $('facade-window-type').value = state.windowType;
    updateFacadeFieldsEnabled();
    renderFacadePreview();
  }

  /**
   * Gemelo de `syncBuildControls` para el Camino: reparte `state.pathWidth` y
   * `state.pathAnyAngle` a los dos juegos de controles (panel y modal) y
   * repinta la miniatura. Asignar `.value`/`.checked` no dispara eventos, así
   * que los gemelos no se realimentan.
   */
  function syncPathControls() {
    const w = String(state.pathWidth);
    $('garden-path-width').value = w;
    $('path-width-modal').value = w;
    $('path-width-val').textContent = w;
    $('path-width-modal-val').textContent = w;
    $('check-path-any-angle').checked = state.pathAnyAngle;
    $('path-any-angle').checked = state.pathAnyAngle;
    renderPathPreview();
  }

  /* Miniatura del camino: mismo papel que la de Fachada, y por eso reutiliza
     su clase CSS (y su tamaño). Enseña el ANCHO y la INCLINACIÓN activos, que
     es justo lo que el arrastre deja de decir en cuanto el camino va
     inclinado; sin ella, mover el deslizador no tiene ningún efecto visible
     hasta después de dibujar.

     El trazo de muestra va deliberadamente sin lado corto —recto, o en
     diagonal limpia si la casilla está marcada—: ese es exactamente el caso en
     el que el ancho sale del ajuste, en los dos modos, así que la miniatura no
     puede prometer un grosor que luego el arrastre pise. */
  const PATH_PREVIEW_W = 176, PATH_PREVIEW_H = 168;   // los de .modal__preview
  const PATH_SAMPLE_LEN = 200;
  const PATH_SAMPLE_ANGLE = -Math.PI / 7;   // inclinación de muestra, ~-26°

  function renderPathPreview() {
    const cv = $('path-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    if (!pctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(PATH_PREVIEW_W * dpr)) {
      cv.width = Math.round(PATH_PREVIEW_W * dpr);
      cv.height = Math.round(PATH_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Papel del color real del lienzo: sobre el modal oscuro, el trazo que se
    // va a dibujar (oscuro) no se vería.
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, PATH_PREVIEW_W, PATH_PREVIEW_H);

    const a = state.pathAnyAngle ? PATH_SAMPLE_ANGLE : 0;
    const els = Garden.elements(
      TOOLS.GARDEN_PATH, { x: 0, y: 0 },
      { x: Math.cos(a) * PATH_SAMPLE_LEN, y: Math.sin(a) * PATH_SAMPLE_LEN },
      { ...gardenOpts(), labels: false },
    );
    if (!els.length) return;
    // Encajar por los bounds REALES: el vaivén del serpenteante se sale del
    // recorrido, y recortado la miniatura engañaría.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 12;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((PATH_PREVIEW_W - 2 * pad) / bw, (PATH_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate(
      (PATH_PREVIEW_W - bw * s) / 2 - minX * s,
      (PATH_PREVIEW_H - bh * s) / 2 - minY * s,
    );
    pctx.scale(s, s);
    // Suelo de grosor: a esta escala el trazo fino del empedrado se desvanecería.
    drawPiecesPreview(pctx, els.map(el => ({
      ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s),
    })));
    pctx.restore();
  }

  /** Rellena un <select> con un catálogo de config.js (textContent, nunca HTML). */
  function fillVariantSelect(id, catalog) {
    const sel = $(id);
    sel.innerHTML = '';
    catalog.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      sel.appendChild(opt);
    });
  }

  /* ── Miniatura en vivo del modal de Fachada ──
     Edificio de muestra: proporciones de un bloque entero para que se lean las
     plantas. El tamaño se ajusta después a la miniatura, así que estos números
     solo fijan la relación de aspecto. */
  const FACADE_SAMPLE = { w: 150, h: 250 };
  // Deben coincidir con .modal__preview en styles.css (el <canvas> está oculto
  // mientras el modal está cerrado, así que clientWidth no sirve).
  const FACADE_PREVIEW_W = 176, FACADE_PREVIEW_H = 168;

  /**
   * Repinta la miniatura con los ajustes actuales. Usa `Building.elements` +
   * `drawPiecesPreview` —los mismos que la previsualización del arrastre—,
   * así que la miniatura no puede divergir de lo que se acabará dibujando.
   * `shape` permite ver una vista sin seleccionarla (hover/foco en su botón);
   * sin argumento muestra la vista elegida.
   */
  function renderFacadePreview(shape) {
    const cv = $('facade-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(FACADE_PREVIEW_W * dpr)) {
      cv.width = Math.round(FACADE_PREVIEW_W * dpr);
      cv.height = Math.round(FACADE_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Papel del color real del lienzo: sobre el modal oscuro, un trazo oscuro
    // (el que se va a dibujar) no se vería.
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, FACADE_PREVIEW_W, FACADE_PREVIEW_H);

    const els = Building.elements(
      TOOLS.BUILD_FACADE, { x: 0, y: 0 }, { x: FACADE_SAMPLE.w, y: FACADE_SAMPLE.h },
      { ...buildOpts(), facadeShape: shape || state.facadeShape },
    );
    if (!els.length) return;
    // Encajar el conjunto: cornisa, alero y rasante se salen de la caja de arrastre.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 10;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((FACADE_PREVIEW_W - 2 * pad) / bw, (FACADE_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate(
      (FACADE_PREVIEW_W - bw * s) / 2 - minX * s,
      (FACADE_PREVIEW_H - bh * s) / 2 - minY * s,
    );
    pctx.scale(s, s);
    // Suelo de grosor: a esta escala el trazo fino del detalle se desvanecería.
    drawPiecesPreview(pctx, els.map(el => ({
      ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s),
    })));
    pctx.restore();
  }

  /**
   * Atenúa y desactiva en el modal los ajustes que la vista elegida ignora:
   * la fachada plana no lleva cubierta ni pendiente, y el perfil lleva siempre
   * la suya trapezoidal (`_profile` no mira `roofType`). Antes se ofrecían los
   * cuatro siempre, sugiriendo un efecto que no existía.
   */
  function updateFacadeFieldsEnabled() {
    const shape = state.facadeShape;
    const setOn = (id, on) => {
      const el = $(id);
      if (!el) return;
      el.disabled = !on;
      const field = el.closest('.panel__field');
      if (field) field.classList.toggle('modal__field--off', !on);
    };
    setOn('facade-roof-type', shape === 'gable');
    setOn('facade-roof-pitch', shape === 'gable' || shape === 'profile');
    // El perfil es un canto: no lleva puerta (ver _profile en building.js).
    setOn('facade-door-type', shape !== 'profile');
  }

  /** Dibuja el icono SVG de un tipo de fachada (plana / alzado / perfil).
      `roofType` solo afecta al alzado, que hereda la cubierta del panel. */
  function facadeIcon(id, roofType) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 44 32');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); svg.appendChild(el); };
    const fine = attrs => add('rect', { ...attrs, 'stroke-width': '1.2' }); // detalle
    if (id === 'gable') {
      add('polygon', { points: FACADE_ROOF_PTS[roofType] || FACADE_ROOF_PTS.gable });
      add('rect', { x: 15, y: 14, width: 14, height: 13 });  // cuerpo
      fine({ x: 19.5, y: 21, width: 5, height: 6 });          // puerta centrada
    } else if (id === 'profile') {
      add('polygon', { points: '11,14 17,7 27,7 33,14' });    // cubierta trapezoidal
      add('rect', { x: 13, y: 14, width: 18, height: 13 });   // canto: cuerpo más ancho
      fine({ x: 16, y: 18, width: 4, height: 5 });            // el perfil NO lleva puerta:
      fine({ x: 24, y: 18, width: 4, height: 5 });            // solo ventanas acompasadas
    } else { // flat
      add('rect', { x: 15, y: 6, width: 14, height: 21 });    // muro sin cubierta
      fine({ x: 19.5, y: 21, width: 5, height: 6 });          // puerta centrada
    }
    return svg;
  }

  /** Reconstruye el catálogo de Fachada. Se llama en cada apertura del modal
      porque el icono del alzado depende de `state.roofType`, que el usuario
      puede haber cambiado entretanto en el panel Edificios.
      Cada botón lleva el nombre llano y, debajo, el término de arquitecto. */
  function buildFacadeCatalog() {
    const root = $('facade-catalog');
    root.innerHTML = '';
    const roofName = activeRoofName();
    const grid = document.createElement('div');
    grid.className = 'modal__shape-grid modal__shape-grid--three';
    FACADE_TYPES.forEach(ft => {
      const btn = document.createElement('button');
      btn.className = 'modal__shape modal__facade';
      btn.type = 'button';
      btn.dataset.facade = ft.id;
      btn.title = ft.id === 'gable' ? `${ft.name} (${ft.hint}) — cubierta: ${roofName}`
                                    : `${ft.name} (${ft.hint})`;
      btn.appendChild(facadeIcon(ft.id, state.roofType));
      const name = document.createElement('span');
      name.className = 'modal__shape-name';
      name.textContent = ft.name;
      btn.appendChild(name);
      const hint = document.createElement('span');   // término técnico, secundario
      hint.className = 'modal__shape-note';
      hint.textContent = ft.hint;
      btn.appendChild(hint);
      // Sin esto el autofoco de <dialog> cae en el primer control del formulario
      // (Plantas) y cualquier pulsación suelta lo cambia por type-ahead. La vista
      // activa es además la acción principal: Enter la confirma.
      if (ft.id === state.facadeShape) btn.autofocus = true;
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateFacadeActive();
  }

  function updateFacadeActive() {
    $('facade-catalog').querySelectorAll('.modal__facade').forEach(btn => {
      const active = btn.dataset.facade === state.facadeShape;
      btn.classList.toggle('modal__shape--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function updateEmojiActive() {
    document.querySelectorAll('.modal__emoji').forEach(btn => {
      const active = btn.textContent === state.pendingEmoji;
      btn.classList.toggle('modal__emoji--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* ── Canvas event binding ── */

  // Pointer events con captura: funciona con ratón, táctil y stylus, y el
  // trazo/drag sigue recibiendo eventos aunque el puntero salga del canvas.
  // Solo se atiende UN puntero a la vez: un segundo dedo en pantalla táctil
  // reiniciaría onMouseDown a media interacción y corrompería el trazo/arrastre.
  let activePointerId = null;

  // ¿Hay un gesto de puntero a medio hacer? (para limpiarlo en pointercancel)
  const gestureActive = () =>
    state.isDrawing || state.curveChain || state.didDrag ||
    state.resizing || state.dragLast || state.marquee;

  mainCanvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activePointerId !== null) return; // ya hay un gesto en curso: ignora el 2º puntero
    activePointerId = e.pointerId;
    mainCanvas.setPointerCapture(e.pointerId);
    onMouseDown(e);
  });
  mainCanvas.addEventListener('pointermove', e => {
    // En reposo (activePointerId null) se dejan pasar los moves (hover); en un
    // gesto, solo los del puntero que lo inició
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    onMouseMove(e);
  });
  mainCanvas.addEventListener('pointerup', e => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (mainCanvas.hasPointerCapture(e.pointerId)) mainCanvas.releasePointerCapture(e.pointerId);
    onMouseUp(e);
    activePointerId = null;
  });
  mainCanvas.addEventListener('pointercancel', e => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    // Cerrar CUALQUIER gesto a medias (dibujo, arrastre, resize o marquee): si
    // no, state.resizing/marquee quedaban colgados y secuestraban el siguiente.
    if (gestureActive()) onMouseUp(e);
    activePointerId = null;
  });
  mainCanvas.addEventListener('pointerleave', () => {
    if (activePointerId !== null || state.tool !== TOOLS.ERASER) return;
    lastPos = null;
    scheduleOverlay();
  });
  // En macOS Ctrl+clic abre el menú contextual; durante una cadena debe
  // reservarse para terminarla igual que Cmd+clic.
  mainCanvas.addEventListener('contextmenu', e => {
    if (state.tool === TOOLS.CURVE_ARROW && state.curveChain) e.preventDefault();
  });

  /* ── Init ── */

  function init() {
    // Repintar cuando cargue una imagen (autosave/import restauran data-URLs)
    Renderer.setImageLoadCallback(redraw);
    restoreAutosave();
    restorePrefs();
    buildSidebar();
    buildColors();
    wireControls();
    setupModals();
    updateCursor();
    fitZoomToViewport();
    redraw();
  }

  init();

})();
