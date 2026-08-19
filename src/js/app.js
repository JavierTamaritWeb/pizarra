/* ============================================================
   app.js — Main application controller
   ============================================================ */

;(function () {
  'use strict';

  /* ── State ── */

  // Papel de trabajo: pizarra azulada con la cuadrícula casi blanca encima, el
  // aire de un plano de obra. Son ajustes cosméticos de PANTALLA — ni el color
  // ni la cuadrícula viajan a ninguna exportación (`_renderClean` en
  // exporter.js compone su propio blanco y no dibuja rejilla), así que lo que
  // se imprime sigue saliendo sobre papel limpio.
  //
  // Ojo: `Renderer.drawGrid` tiene su propio color por defecto (`#cdd3de`) y
  // NO acompaña a este. El del renderer es el que vale cuando nadie pasa
  // ninguno, y ahí el fondo que hay que suponer es blanco: un `#fcfcfc` sobre
  // blanco no se vería. La app siempre pasa `state.gridColor`.
  const DEFAULT_CANVAS_BG = '#686f92';
  const DEFAULT_GRID_COLOR = '#fcfcfc';
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
    // Muro: vista elegida en el catálogo (ver WALL_VIEWS) + sus 4 ajustes
    // propios del modal (sin gemelo en el panel, como balconyType).
    wallView: 'elevation',
    wallMaterial: 'stone',
    wallHeight: 1,
    wallRailing: false,
    wallRailingHeight: 0.7,
    wallRailingType: 'spear',
    wallGateType: 'concave',
    wallGateHeight: 2,   // alto de la cancela en metros (Building.WALL_GATE_H_MIN/MAX)
    // Verja independiente: vista, diseño de forja y altura acotada en cm.
    fenceView: 'elevation',
    fenceType: 'spear',
    fenceHeightCm: 180,
    // Cancela autónoma: vista, modelo y altura en centímetros.
    gateView: 'elevation',
    gateType: 'concave',
    gateHeightCm: 200,
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
    climberType: 'bougainvillea',
    gardenLabels: true,  // rotular cada pieza con el nombre de su variante
    gardenLabelMode: 'dimensions', // nombre | nombre botánico | nombre + cotas
    plantView: 'plan',   // vegetación: planta cenital o alzado paisajístico
    plantStage: 'adult', // joven | en desarrollo | adulto
    plantScalePct: 100,  // porcentaje sobre las dimensiones de la ficha botánica
    plantPxPerM: 20,     // escala explícita para los tamaños por clic
    plantColorMode: 'natural', // natural | ink (tinta global de la app)
    pathWidth: DEFAULT_PATH_WIDTH, // ancho de los caminos (el arrastre solo da el recorrido)
    pathAnyAngle: false, // caminos en cualquier inclinación: ajuste pegajoso, no tecla mantenida
    // Aerógrafo: ajustes del modal. Están aquí, y no sueltos en `state`, para
    // que «Limpiar todo» los devuelva a su sitio junto con el área marcada —
    // un rectángulo invisible que sobreviviera al borrado seguiría recortando
    // todo lo que se pintara después.
    // Los tres primeros salen de compararlos en el navegador: con grano 3 y
    // densidad 45 la mancha salía SALPICADA, no pulverizada — se veían las
    // gotas sueltas y no había núcleo. A partir de grano 5 aparece el núcleo
    // denso con el borde difuminado, que es lo que uno espera de un aerógrafo.
    airbrushRadius: 24,      // boquilla (Airbrush.R_MIN/R_MAX); el mando enseña el diámetro
    airbrushDensity: 70,     // gotas por 1000 px² de banda
    airbrushGrain: 5,        // diámetro de la gota; acaba en el lineWidth del elemento
    airbrushOpacity: 1,      // 1 = sólido, y entonces el elemento NO guarda el campo
    airbrushAreaMode: 'all', // all | area
    airbrushArea: null,      // rectángulo al que se recorta la pintura
    // 3D: la sección la comparten las tres herramientas de extrusión (elegir
    // pentágono en Prisma lo deja elegido en Pirámide) y los cuatro ajustes
    // gobiernan la proyección caballera. La profundidad va en PORCENTAJE de la
    // cara, no en píxeles, para que una figura pequeña y otra grande salgan
    // con la misma proporción sin tocar nada.
    solidSection: 'rect',
    solidDepth: 75,       // % del lado menor de la cara (Solid.DEPTH_MIN/MAX)
    solidAngle: 30,       // grados de fuga (Solid.ANGLE_MIN/MAX)
    solidForeshorten: 80, // % de escorzo (Solid.FORESHORTEN_MIN/MAX)
    solidTaper: 55,       // % de la tapa del tronco (Solid.TAPER_MIN/MAX)
    // Dónde cae el vértice de la Pirámide: 'depth' lo manda al fondo (la base
    // es la cara que arrastras, como el resto de remates) y 'upright' lo deja
    // en el plano del papel y tumba la base — la pirámide de pie de siempre.
    solidApex: 'depth',
    // Giro de la sección, en el paso válido de su tipo. Sólo lo guardan las
    // secciones que orientan por ángulo: en el rectángulo, el redondeado y el
    // círculo girar es intercambiar ancho y alto, que ya lo da el arrastre.
    solidRotation: 0,
  };

  /**
   * TODOS los ajustes de la app en su valor de fábrica: fuente ÚNICA para el
   * estado inicial y para «Limpiar todo». Un ajuste nuevo se resetea solo por
   * estar aquí, sin tener que acordarse del botón — que es exactamente lo que
   * fallaba: el handler mantenía a mano una lista corta y se había quedado
   * atrás en dieciséis ajustes (color, grosor, tamaño de letra, relleno
   * entero, discontinuo, doble punta, cuadrícula, ajuste a la rejilla, clics
   * acumulativos, letra del lienzo y los tres del estilo de texto). Peor aún:
   * los que se persisten seguían vivos en `state`, así que el siguiente
   * savePrefs() reescribía lo que el removeItem acababa de borrar.
   *
   * Es una FUNCIÓN y no un objeto porque `uiLabels` se muta en sitio
   * (`state.uiLabels[tool] = …`): compartir la referencia haría que el botón
   * devolviera lo último escrito en vez del valor de fábrica. Cualquier campo
   * anidado que se añada hereda esa protección sin pensarlo.
   */
  function appDefaults() {
    return {
      color:       '#1a1a2e',
      lineWidth:   2,
      eraserSize:  DEFAULT_ERASER_SIZE,
      fontSize:    18,
      fillShapes:  false,
      // El relleno de fábrica es la tinta en translúcido: `fillColor: null`
      // hace que siga al color del trazo (negro por defecto) en vez de fijar
      // uno propio, y `fillTransparent` deja la opacidad en manos del mando.
      // No cambia lo que se dibuja hasta marcar «Rellenar formas» —hasta
      // entonces las formas salen vacías—, pero sí lo que enseña el panel.
      fillColor:   null,  // color de relleno; null = sigue al color del trazo
      fillTransparent: true, // usa fillOpacity en vez del tinte fijo del trazo
      fillOpacity: 0.4,   // opacidad del relleno translúcido (0..1)
      shapeRotation: 0,   // giro con el que nacen las formas que lo admiten
      overlapMode: 'normal', // normal | hidden-dashed
      pendingEmoji: EMOJI_GROUPS[0].emojis[0], // el que se estampa con la herramienta Emoji
      emojiSize:   EMOJI_MIN_SIZE, // tamaño de los próximos emojis, independiente del de letra
      // Rótulo con el que nacen los componentes UI ('' = default del renderer).
      // Imagen no está: el renderer de imagePlaceholder no recibe rótulo.
      uiLabels:    { button: '', input: '', nav: '', card: '' },
      doubleHead:  false, // nuevas flechas con punta en ambos extremos
      dashed:      false, // nuevas líneas/flechas con trazo discontinuo
      strokeTaper: false, // nuevos trazos de lápiz con presión simulada (v2.37.0)
      // Comba con la que nacen las flechas curvas, como fracción de la cuerda
      // (v3.2.0). Es un ajuste de HERRAMIENTA: la curvatura ya viaja dentro de
      // cx/cy, así que el elemento no estrena ningún campo.
      curveBulge:  CurvePath.DEFAULT_BULGE,
      showGrid:    true,
      snapGrid:    false,
      // Tinta: cuánto se cierran los huecos entre trazos antes de buscar la
      // zona, y a qué apunta el clic. El color NO está aquí: es el de relleno.
      inkGap:      4,
      inkTarget:   'shape',
      multiSelect: false,      // «Los clics acumulan selección» (una mano; Shift = atajo)
      alignGuides: true,       // imán y guías de alineación al arrastrar (v2.38.0)
      canvasBg:    DEFAULT_CANVAS_BG,
      gridColor:   DEFAULT_GRID_COLOR,
      // Letra manuscrita del boceto (id de SKETCH_FONTS). Ajuste cosmético
      // global: no viaja en los elementos ni en el undo, y persiste en prefs.
      sketchFontId: SKETCH_FONTS[0].id,
      // Estilo del texto. A diferencia de la letra, estos SÍ viajan en cada
      // elemento (un título en negrita junto a una nota normal), así que aquí
      // solo son el default con el que nace el siguiente.
      textBold: false,
      textShadow: 'none',
      textShadowColor: DEFAULT_SHADOW_COLOR,
      ...CREATION_DEFAULTS, // Edificios/Jardín/Aerógrafo
    };
  }

  const state = {
    tool:        TOOLS.PENCIL,
    zoom:        1,
    ...appDefaults(),
    // Cuentagotas armado: transitorio de un solo clic, como airbrushAreaPending
    // — no es un ajuste, así que ni se persiste ni sale de appDefaults().
    inkPicking: false,
    toolBeforeModal: null, // herramienta activa antes de abrir un modal de Edificios (restaurar al cancelar)
    variantChosen: false, // true si se eligió variante en el modal (no fue cancelación)
    editGardenGroupId: null, // grupo vegetal que se regenerará al elegir otra especie
    // Transitorios del gesto en curso: no son ajustes, así que ni se guardan en
    // prefs ni salen de appDefaults() — nacen y mueren dentro de un arrastre.
    curveFlip:   false, // Shift durante el trazado: curva hacia el otro lado
    pathFreeAngle: false, // Shift durante el arrastre del camino: cualquier inclinación
    airbrushAreaPending: false, // el próximo arrastre marca el área, no pinta
    airbrushDrag: null,  // 'spray' | 'area': qué se está haciendo con el ratón
    airbrushSeed: null,  // seed fijado en el mousedown: sin él la previsualización
                         // se re-sortearía en cada fotograma del arrastre
    curveChain:  null,  // borrador por clics: { start, segments, style... }
    pendingUnselect: null,   // clic sin arrastre sobre algo seleccionado: se quita en mouseup
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
    pickDown:    null,  // gesto de «Select» pendiente de resolver {idx, alt}
    resizing:    null,  // resize en curso {corner, from, original, snapshot, did}
    alignSession: null, // imán de alineación durante el arrastre (v2.38.0)
    alignGuideLines: null, // guías activas a dibujar en el overlay
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
  const WALL_DESIGN_VERSION = 1;
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
    // El aerógrafo no mide su eje sino su BANDA: las gotas llegan hasta
    // `radius` a cada lado. Con la caja del eje, el marco de selección
    // cortaría la mancha por la mitad y el hit-test por caja mentiría.
    if (el.type === 'airbrush') return Airbrush.visibleBox(el);
    if (el.type === 'pencil' || el.type === 'eraser' || el.type === 'polygon') {
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
      ctx.font = `${el.fontSize}px ${sketchFont()}`;
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
      // Aerógrafo: distancia a la banda, por lo mismo que líneas y flechas.
      // Una mancha en diagonal robaría todos los clics de su rectángulo.
      if (el.type === 'airbrush') {
        const pts = el.points || [];
        const alcance = (el.radius || 0) + el.lineWidth / 2 + 6;
        if (el.clip && !(pos.x >= el.clip.x && pos.x <= el.clip.x + el.clip.w &&
                         pos.y >= el.clip.y && pos.y <= el.clip.y + el.clip.h)) continue;
        let hit = pts.length === 1 &&
          Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) <= alcance;
        for (let s = 1; s < pts.length && !hit; s++) {
          hit = distToSegment(pos, pts[s - 1].x, pts[s - 1].y, pts[s].x, pts[s].y) <= alcance;
        }
        if (hit) return i;
        continue;
      }
      if (el.type === TOOLS.POLYGON) {
        const vertices = Array.isArray(el.points) ? el.points : [];
        if (vertices.length < 3) continue;
        // Misma estructura que los polígonos regulares: dentro de la silueta, o
        // a menos de medio trazo de una arista. El punto-en-polígono sale de
        // Eraser, como distToSegment, para no tener dos fórmulas que discrepen.
        let hit = Eraser.pointInPolygon(pos, vertices);
        for (let v = 0; v < vertices.length && !hit; v++) {
          const a = vertices[v];
          const b = vertices[(v + 1) % vertices.length];
          hit = distToSegment(pos, a.x, a.y, b.x, b.y) <= el.lineWidth / 2 + 6;
        }
        if (hit) return i;
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
    return selectionBounds();
  }

  /** Caja combinada de la selección, tenga grupo o no: la del elemento si es
      único, la unión de todas las cajas si hay varios. selectionGroupBounds
      (arriba) sigue siendo solo-de-grupo a propósito — decide la caja ÚNICA
      con tiradores —, pero escribir medidas en «Posición y tamaño» no
      necesita que la multi-selección sea un edificio: con dos rects sueltos
      los campos enseñaban valores rancios y teclear no hacía nada, cuando el
      panel promete la caja combinada (auditoría v2.10.1). */
  /**
   * Un `<canvas>` NO dispara la descarga de una webfont: `ctx.font` con una
   * familia que todavía no está cargada dibuja con el resguardo de la pila y
   * no lo reintenta. Y la única parte del DOM que usa la manuscrita es el
   * editor de texto flotante, oculto casi siempre, así que nada la pedía por
   * su cuenta: el boceto habría salido con la cursiva del sistema hasta un
   * repintado afortunado. Se pide explícitamente y se repinta al llegar.
   */
  function ensureSketchFontLoaded(font) {
    try {
      if (!document.fonts || typeof document.fonts.load !== 'function') return;
      const family = font.stack.split(',')[0].trim();
      document.fonts.load(`16px ${family}`).then(repaintWithFont, () => {});
    } catch (e) { /* sin FontFaceSet: el navegador la cargará por su cuenta */ }
  }

  /** Repinta lo que escribe con la manuscrita: el lienzo y, si está abierta,
      la muestra del modal de texto —que es justo donde se está mirando—. */
  function repaintWithFont() {
    redraw();
    if ($('modal-text').open) renderTextPreview();
  }

  /**
   * Estilo con el que nace el próximo texto. Devuelve SOLO los campos que
   * dicen algo: sin negrita y sin sombra el elemento sale exactamente como
   * los de siempre, que es lo que mantiene idénticos los proyectos anteriores
   * —y lo que hace que `isValidElement` no vea campos nuevos donde no toca—.
   * El color de sombra únicamente acompaña a una sombra real.
   */
  function textStyleDefaults() {
    const out = {};
    if (state.textBold) out.bold = true;
    if (state.textShadow !== 'none') {
      out.shadow = state.textShadow;
      out.shadowColor = state.textShadowColor;
    }
    return out;
  }

  /** El selector de letra manuscrita existe dos veces: en el panel («Lienzo»)
      y en #modal-text, que es donde se mira al escribir. Mismo contrato que
      los gemelos de Edificios: un solo cuerpo reparte a los dos. */
  const SKETCH_FONT_SELECTS = ['sketch-font', 'text-modal-font'];

  /**
   * Punto ÚNICO de cambio de la letra manuscrita: la pila que usa el lienzo
   * (sketchFont), `--font-sketch` para el editor flotante, los DOS selectores
   * —cada uno previsualizado con la familia elegida— y el repintado.
   */
  function applySketchFont(id) {
    const font = setSketchFont(id);
    state.sketchFontId = font.id;
    SKETCH_FONT_SELECTS.forEach(sid => {
      const sel = $(sid);
      if (!sel) return;
      sel.value = font.id;
      sel.style.fontFamily = font.stack;
    });
    ensureSketchFontLoaded(font);
    repaintWithFont();
  }

  /** Píxeles de un objeto que deben seguir dentro del lienzo al moverlo. */
  const KEEP_VISIBLE = 24;

  /**
   * Recorta un desplazamiento (dx,dy) para que la caja `b` no pueda salir
   * ENTERA del lienzo: siempre quedan `KEEP_VISIBLE` px dentro (o el objeto
   * completo, si es más pequeño que eso). Sacar algo del todo no era un gesto
   * útil sino la forma de perderlo: seguía en la escena y en el archivo
   * exportado, pero invisible e inalcanzable — ni el clic ni una marquesina
   * que cubra todo el lienzo llegan ahí, así que solo Ctrl+Z lo recuperaba, y
   * únicamente si te dabas cuenta en el momento.
   *
   * Sujeta solo el movimiento que EMPEORA: algo que ya estuviera fuera (un
   * proyecto importado, un JSON de antes de esta versión) puede seguir
   * viniendo hacia dentro, y mover una selección que lo contenga no le da un
   * tirón hacia el borde —lo que rompería su posición relativa con el resto—.
   * Se aplica sobre la caja COMBINADA de la selección, nunca pieza a pieza:
   * así el conjunto se frena como una unidad y conserva su composición.
   */
  function clampDelta(b, dx, dy) {
    const keepX = Math.min(KEEP_VISIBLE, b.w);
    const keepY = Math.min(KEEP_VISIBLE, b.h);
    const x = Math.min(Math.max(b.x + dx, Math.min(b.x, keepX - b.w)),
                       Math.max(b.x, CANVAS_W - keepX));
    const y = Math.min(Math.max(b.y + dy, Math.min(b.y, keepY - b.h)),
                       Math.max(b.y, CANVAS_H - keepY));
    return { dx: x - b.x, dy: y - b.y };
  }

  /* Imán de alineación (v2.38.0, la idea de Excalidraw/tldraw): al arrastrar,
     los bordes y centros de la caja de la selección se pegan a los de los
     demás elementos cuando pasan a menos de ALIGN_TOL px, y una guía en el
     overlay enseña con quién. Tres decisiones deliberadas:
     - Los candidatos se calculan UNA vez por gesto (primer fotograma), no por
       fotograma: la escena no cambia mientras se arrastra.
     - `free` acumula el delta CRUDO del puntero, como hace dragLast con su
       posición: el imán corrige respecto a esa posición libre, así que al
       salir de la tolerancia el objeto vuelve con el puntero sin zona muerta.
     - Alt lo suspende en caliente como ACELERADOR, nunca única vía (regla de
       una mano): el mando de verdad es «Guías de alineación» en
       #modal-select, persistido en prefs. */
  const ALIGN_TOL = 5;

  function alignAdjust(dx, dy, altKey) {
    state.alignGuideLines = null;
    if (!state.alignGuides) return { dx, dy };
    const box = selectionBounds();
    if (!box) return { dx, dy };
    let s = state.alignSession;
    if (!s) {
      const selSet = new Set(state.selection);
      // Una flecha anclada a lo seleccionado viaja CON la selección
      // (resolveAnchors la recoloca en cada repintado), así que sus bordes
      // del primer fotograma serían candidatos fantasma: el imán clavaría
      // la selección sobre una coordenada donde ya no queda nada.
      const selIds = new Set();
      state.selection.forEach(i => {
        const id = state.elements[i] && state.elements[i].id;
        if (id) selIds.add(id);
      });
      const anchored = el =>
        (el.startAnchor && selIds.has(el.startAnchor.id)) ||
        (el.endAnchor && selIds.has(el.endAnchor.id));
      const xs = [], ys = [];
      state.elements.forEach((el, i) => {
        if (selSet.has(i) || anchored(el)) return;
        const b = getElementBounds(el);
        if (!Number.isFinite(b.x) || !Number.isFinite(b.w)) return;
        xs.push(b.x, b.x + b.w / 2, b.x + b.w);
        ys.push(b.y, b.y + b.h / 2, b.y + b.h);
      });
      s = state.alignSession = { free: { x: box.x, y: box.y }, xs, ys,
        snappedX: false, snappedY: false };
    }
    // `free` acumula SIEMPRE, también con Alt: si los fotogramas suspendidos
    // no avanzaran la posición libre, al soltar Alt la corrección se mediría
    // contra un `free` desfasado y la selección saltaría hacia atrás justo
    // lo recorrido con Alt pulsado.
    s.free.x += dx; s.free.y += dy;
    if (altKey) {
      s.snappedX = s.snappedY = false;
      return { dx: s.free.x - box.x, dy: s.free.y - box.y };
    }
    const best = (edges, targets) => {
      let corr = null, hit = null;
      for (const edge of edges) {
        for (const t of targets) {
          const c = t - edge;
          if (Math.abs(c) <= ALIGN_TOL && (corr === null || Math.abs(c) < Math.abs(corr))) {
            corr = c; hit = t;
          }
        }
      }
      return { corr: corr === null ? 0 : corr, hit };
    };
    const bx = best([s.free.x, s.free.x + box.w / 2, s.free.x + box.w], s.xs);
    const by = best([s.free.y, s.free.y + box.h / 2, s.free.y + box.h], s.ys);
    // Por eje, no un booleano único: si el imán pegó solo la X, la Y sigue
    // siendo un valor libre y la cuadrícula del mouseup aún tiene que
    // atenderla — con un solo flag ese eje se quedaba sin imán Y sin rejilla.
    s.snappedX = bx.hit !== null;
    s.snappedY = by.hit !== null;
    const lines = [];
    if (bx.hit !== null) lines.push({ axis: 'x', pos: bx.hit });
    if (by.hit !== null) lines.push({ axis: 'y', pos: by.hit });
    if (lines.length) state.alignGuideLines = lines;
    // El delta se expresa contra la caja ACTUAL: el imán decide la posición
    // final y clampDelta (dentro de moveSelectionBy) sigue teniendo la última
    // palabra en el borde del lienzo.
    return { dx: s.free.x + bx.corr - box.x, dy: s.free.y + by.corr - box.y };
  }

  /** Mueve la selección entera (dx,dy), frenada por clampDelta. Devuelve el
      desplazamiento realmente aplicado, que puede ser (0,0) en el borde. */
  function moveSelectionBy(dx, dy) {
    const box = selectionBounds();
    if (!box) return { dx: 0, dy: 0 };
    const d = clampDelta(box, dx, dy);
    if (!d.dx && !d.dy) return d;
    state.selection.forEach(i => {
      state.elements[i] = moveElement(state.elements[i], d.dx, d.dy);
    });
    return d;
  }

  /** Valor que comparten TODOS los elementos de `els` según `get`, o
      `undefined` si discrepan (o si la lista está vacía). Es lo que permite a
      un control del panel decir la verdad con varios seleccionados: enseña el
      valor común cuando lo hay y se queda como está cuando no, en vez de
      enseñar el del primero como si fuera el de todos. */
  function commonOf(els, get) {
    if (!els.length) return undefined;
    const first = get(els[0]);
    return els.every(el => get(el) === first) ? first : undefined;
  }

  function selectionBounds() {
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    if (!sel.length) return null;
    if (sel.length === 1) return getElementBounds(sel[0]);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    sel.forEach(el => {
      const b = getElementBounds(el);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  // Una planta editable es la selección completa de un único grupo cuyos
  // elementos comparten la ficha semántica gardenMeta. Una pieza aislada con
  // Alt+click no debe poder regenerar accidentalmente el resto del ejemplar.
  function selectedGardenGroup() {
    if (state.selection.length < 2) return null;
    const first = state.elements[state.selection[0]];
    const gid = first && first.buildingGroupId;
    if (!gid || !first.gardenMeta) return null;
    const indices = groupIndicesOf(state.selection[0]);
    if (indices.length !== state.selection.length ||
        !indices.every((idx, pos) => idx === state.selection[pos])) return null;
    if (!indices.every(i => state.elements[i].gardenMeta &&
                            state.elements[i].buildingGroupId === gid)) return null;
    return { gid, indices, meta: first.gardenMeta };
  }

  function moveElement(el, dx, dy) {
    let m;
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      m = CurvePath.move(el, dx, dy);
    } else {
      m = { ...el };
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
    }
    if (m.gardenMeta) {
      m.gardenMeta = {
        ...m.gardenMeta,
        p1: { x: m.gardenMeta.p1.x + dx, y: m.gardenMeta.p1.y + dy },
        p2: { x: m.gardenMeta.p2.x + dx, y: m.gardenMeta.p2.y + dy },
      };
    }
    // El gesto de una pirámide de pie, por lo mismo: es de lo único que se
    // puede regenerar (no tiene cara frontal), así que si se queda quieto,
    // rellenarla después la devolvería a donde se dibujó.
    if (m.solidMeta && m.solidMeta.gesture) {
      const g = m.solidMeta.gesture;
      m.solidMeta = {
        ...m.solidMeta,
        gesture: { x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy },
      };
    }
    // El área del aerógrafo viaja con su mancha: es lo que la recorta, y
    // dejarla quieta haría que mover el dibujo cambiara lo que se ve de él.
    if (m.clip) m.clip = { ...m.clip, x: m.clip.x + dx, y: m.clip.y + dy };
    return m;
  }

  /* ── Geometría de la flecha curva ── */

  /**
   * Control por defecto de una curveArrow: perpendicular a la cuerda, a la
   * comba ACTUAL de la herramienta (`state.curveBulge`, 0.25 de fábrica).
   * Con flip, hacia el otro lado.
   *
   * Todo lo que CREA una curva pasa por aquí —commit, previsualización del
   * arrastre, cada tramo del modo encadenado, el reset por doble clic y la S—,
   * que es lo que impide que la muestra prometa una comba y el lienzo dibuje
   * otra. La excepción es `transformControlsToChord`: allí se REPARA un
   * elemento existente cuya cuerda era degenerada, y usar el ajuste del
   * momento haría que arrastrar un extremo cambiara la forma de una curva
   * ajena; por eso llama a CurvePath.defaultCtrl sin comba.
   */
  function defaultCtrl(p1, p2, flip) {
    return CurvePath.defaultCtrl(p1, p2, flip, state.curveBulge);
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
      // Comba FIJA (CurvePath.defaultCtrl sin ajuste): esto repara una curva
      // que ya existía, no crea una nueva, y con la comba del momento
      // arrastrar un extremo le cambiaría la forma a un elemento ajeno.
      const c = CurvePath.defaultCtrl({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, false);
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
  // Las estrellas entran aquí porque RegularPolygon las trata como un polígono
  // más: nacen desde el centro, exigen w === h y guardan su giro en grados.
  const REGULAR_POLYGON_TYPES = [
    TOOLS.SQUARE, TOOLS.TRIANGLE, TOOLS.PENTAGON, TOOLS.HEXAGON,
    TOOLS.STAR5, TOOLS.STAR6,
  ];
  const FILLABLE_TYPES = [
    TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE, TOOLS.TRAPEZOID,
    ...REGULAR_POLYGON_TYPES,
    // El polígono libre no tiene herramienta, pero sí relleno: aislar una cara
    // de un sólido con Alt+clic y recolorearla tiene que funcionar.
    TOOLS.POLYGON,
  ];

  /** <input type="color"> solo acepta #rrggbb: recorta un eventual canal alfa
      (un color importado puede venir como #rrggbbaa y lo dejaría en negro). */
  // En minúsculas SIEMPRE: la validación de import acepta hex en mayúsculas
  // (HEX_COLOR es case-insensitive), y sin normalizar, «Sustituir un color»
  // listaba #FF0000 y #ff0000 como dos colores y sustituía solo la mitad.
  const hex6 = c => String(c).slice(0, 7).toLowerCase();

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
    // El aviso refleja el estado REAL del último intento: se enciende cuando
    // localStorage rechaza el guardado (cuota llena — dos fotos mordidas
    // bastaban antes del WebP) y se apaga solo si un guardado posterior
    // vuelve a caber. Antes esto era un catch mudo: la app decía que todo iba
    // bien mientras cada autoguardado fallaba para siempre, y lo dibujado
    // después de llenarse la cuota se perdía al recargar sin ninguna señal.
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        elements: state.elements,
        settings: { overlapMode: state.overlapMode },
      }));
      $('autosave-warn').hidden = true;
    } catch (_) {
      $('autosave-warn').hidden = false;
    }
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
        showGrid: state.showGrid,
        sketchFontId: state.sketchFontId,
        textBold: state.textBold,
        textShadow: state.textShadow,
        textShadowColor: state.textShadowColor,
        overlapMode: state.overlapMode,
        eraserSize: state.eraserSize,
        strokeTaper: state.strokeTaper,
        curveBulge: state.curveBulge,
        alignGuides: state.alignGuides,
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
        // Muro: vista del catálogo + sus 4 ajustes propios, mismo motivo.
        wallDesignVersion: WALL_DESIGN_VERSION,
        wallView: state.wallView,
        wallMaterial: state.wallMaterial,
        wallHeight: state.wallHeight,
        wallRailing: state.wallRailing,
        wallRailingHeight: state.wallRailingHeight,
        wallRailingType: state.wallRailingType,
        wallGateType: state.wallGateType,
        wallGateHeight: state.wallGateHeight,
        // Verja independiente: los tres controles de su modal también son
        // defaults de creación y deben sobrevivir a la recarga.
        fenceView: state.fenceView,
        fenceType: state.fenceType,
        fenceHeightCm: state.fenceHeightCm,
        gateView: state.gateView,
        gateType: state.gateType,
        gateHeightCm: state.gateHeightCm,
        // Variantes de Jardín, por el mismo motivo.
        plotShape: state.plotShape,
        treeType: state.treeType,
        shrubType: state.shrubType,
        flowerType: state.flowerType,
        decorType: state.decorType,
        pathType: state.pathType,
        herbType: state.herbType,
        climberType: state.climberType,
        gardenLabels: state.gardenLabels,
        gardenLabelMode: state.gardenLabelMode,
        plantView: state.plantView,
        plantStage: state.plantStage,
        plantScalePct: state.plantScalePct,
        plantPxPerM: state.plantPxPerM,
        plantColorMode: state.plantColorMode,
        pathWidth: state.pathWidth,
        pathAnyAngle: state.pathAnyAngle,
        // Aerógrafo (v2.22.0): sus cinco ajustes, área incluida. El área
        // persiste como cualquier otro: si sobreviviera solo hasta la recarga,
        // un proyecto retomado al día siguiente empezaría a pintar por todas
        // partes sin avisar de que el recorte se había perdido.
        airbrushRadius: state.airbrushRadius,
        airbrushDensity: state.airbrushDensity,
        airbrushGrain: state.airbrushGrain,
        airbrushOpacity: state.airbrushOpacity,
        airbrushAreaMode: state.airbrushAreaMode,
        inkGap: state.inkGap,
        inkTarget: state.inkTarget,
        airbrushArea: state.airbrushArea,
        // 3D
        solidSection: state.solidSection,
        solidDepth: state.solidDepth,
        solidAngle: state.solidAngle,
        solidForeshorten: state.solidForeshorten,
        solidTaper: state.solidTaper,
        solidRotation: state.solidRotation,
        solidApex: state.solidApex,
        // Ajustes de UI y Emoji (v2.10.0): defaults de creación, como todo.
        emojiSize: state.emojiSize,
        uiLabels: state.uiLabels,
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
      // El tercer campo del aspecto. Un prefs anterior a la v2.31.0 no lo
      // trae, y entonces se queda en el de fábrica (encendida).
      if (typeof prefs.showGrid === 'boolean') state.showGrid = prefs.showGrid;
      // Validada contra el catálogo: un id inventado (o de una versión con
      // otras familias) dejaría el lienzo pidiendo una fuente inexistente.
      if (SKETCH_FONTS.some(f => f.id === prefs.sketchFontId)) {
        state.sketchFontId = prefs.sketchFontId;
      }
      if (typeof prefs.textBold === 'boolean') state.textBold = prefs.textBold;
      if (typeof prefs.strokeTaper === 'boolean') state.strokeTaper = prefs.strokeTaper;
      // La comba se acota al rango del mando: fuera de él no hay forma de
      // devolverla a un valor razonable desde la interfaz.
      if (Number.isFinite(prefs.curveBulge)) {
        state.curveBulge = Math.min(CURVE_BULGE_MAX / 100,
          Math.max(CURVE_BULGE_MIN / 100, prefs.curveBulge));
      }
      if (typeof prefs.alignGuides === 'boolean') state.alignGuides = prefs.alignGuides;
      // Contra el catálogo, como la letra: un id de otra versión dejaría el
      // default apuntando a una sombra que ya no existe.
      if (TEXT_SHADOWS.some(sh => sh.id === prefs.textShadow)) {
        state.textShadow = prefs.textShadow;
      }
      if (HEX_RE.test(prefs.textShadowColor)) {
        state.textShadowColor = prefs.textShadowColor;
      }
      if (['normal', 'hidden-dashed'].includes(prefs.overlapMode)) {
        state.overlapMode = prefs.overlapMode;
      }
      if (Number.isFinite(prefs.eraserSize)) {
        state.eraserSize = Math.min(
          ERASER_SIZE_MAX,
          Math.max(ERASER_SIZE_MIN, prefs.eraserSize),
        );
      }
      if (Number.isFinite(prefs.emojiSize)) {
        state.emojiSize = Math.min(
          EMOJI_MAX_SIZE,
          Math.max(EMOJI_MIN_SIZE, prefs.emojiSize),
        );
      }
      // Rótulos de creación de los componentes UI: solo las claves conocidas,
      // solo strings, y recortados — van a parar a `label`, que viaja en el
      // JSON exportado.
      if (prefs.uiLabels && typeof prefs.uiLabels === 'object') {
        Object.keys(state.uiLabels).forEach(k => {
          if (typeof prefs.uiLabels[k] === 'string') {
            state.uiLabels[k] = prefs.uiLabels[k].slice(0, 120);
          }
        });
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
      // Las preferencias anteriores a la cancela cóncava guardaban siempre
      // planta + «sin puerta», aunque la persona nunca hubiera tocado Muro.
      // No dejamos que ese default histórico oculte silenciosamente el nuevo
      // diseño. Tras la primera elección/guardado, se respeta con normalidad.
      if (prefs.wallDesignVersion === WALL_DESIGN_VERSION) {
        restoreVariant(prefs.wallView, WALL_VIEWS, 'wallView');
      }
      // Los 3 ajustes de Muro sin catálogo propio se validan contra su lista
      // fija (mismas opciones que el <select>/checkbox de #modal-wall).
      if (['stone', 'concrete', 'brick'].includes(prefs.wallMaterial)) state.wallMaterial = prefs.wallMaterial;
      if (prefs.wallHeight === 1 || prefs.wallHeight === 2) state.wallHeight = prefs.wallHeight;
      if (typeof prefs.wallRailing === 'boolean') state.wallRailing = prefs.wallRailing;
      if (FORGE_TYPES.some(item => item.id === prefs.wallRailingType)) {
        state.wallRailingType = prefs.wallRailingType;
      }
      if (Number.isFinite(prefs.wallRailingHeight)) {
        state.wallRailingHeight = Math.min(Building.WALL_RAIL_H_MAX,
          Math.max(Building.WALL_RAIL_H_MIN, prefs.wallRailingHeight));
      }
      if (prefs.wallDesignVersion === WALL_DESIGN_VERSION &&
          (prefs.wallGateType === 'none' ||
            GATE_TYPES.some(item => item.id === prefs.wallGateType))) {
        state.wallGateType = prefs.wallGateType;
      }
      if (Number.isFinite(prefs.wallGateHeight)) {
        state.wallGateHeight = Math.min(Building.WALL_GATE_H_MAX,
          Math.max(Building.WALL_GATE_H_MIN, prefs.wallGateHeight));
      }
      restoreVariant(prefs.fenceView, FENCE_VIEWS, 'fenceView');
      restoreVariant(prefs.fenceType, FORGE_TYPES, 'fenceType');
      if (Number.isFinite(prefs.fenceHeightCm)) {
        state.fenceHeightCm = Math.min(Building.FENCE_H_MAX_CM,
          Math.max(Building.FENCE_H_MIN_CM, prefs.fenceHeightCm));
      }
      restoreVariant(prefs.gateView, GATE_VIEWS, 'gateView');
      restoreVariant(prefs.gateType, GATE_TYPES, 'gateType');
      if (Number.isFinite(prefs.gateHeightCm)) {
        state.gateHeightCm = Math.min(Building.GATE_H_MAX_CM,
          Math.max(Building.GATE_H_MIN_CM, prefs.gateHeightCm));
      }
      restoreVariant(prefs.plotShape,   PLOT_SHAPES,   'plotShape');
      restoreVariant(prefs.treeType,    TREE_TYPES,    'treeType');
      restoreVariant(prefs.shrubType,   SHRUB_TYPES,   'shrubType');
      restoreVariant(prefs.flowerType,  FLOWER_TYPES,  'flowerType');
      restoreVariant(prefs.decorType,   DECOR_TYPES,   'decorType');
      restoreVariant(prefs.pathType,    PATH_TYPES,    'pathType');
      restoreVariant(prefs.herbType,    HERB_TYPES,    'herbType');
      restoreVariant(prefs.climberType, CLIMBER_TYPES, 'climberType');
      if (typeof prefs.gardenLabels === 'boolean') state.gardenLabels = prefs.gardenLabels;
      restoreVariant(prefs.gardenLabelMode, GARDEN_LABEL_MODES, 'gardenLabelMode');
      restoreVariant(prefs.plantView, GARDEN_PLANT_VIEWS, 'plantView');
      restoreVariant(prefs.plantStage, GARDEN_STAGES, 'plantStage');
      if (Number.isFinite(prefs.plantScalePct)) {
        state.plantScalePct = Math.min(Garden.PLANT_SCALE_MAX,
          Math.max(Garden.PLANT_SCALE_MIN, prefs.plantScalePct));
      }
      if (Number.isFinite(prefs.plantPxPerM)) {
        state.plantPxPerM = Math.min(Garden.PLANT_PX_PER_M_MAX,
          Math.max(Garden.PLANT_PX_PER_M_MIN, prefs.plantPxPerM));
      }
      if (['ink', 'natural'].includes(prefs.plantColorMode)) state.plantColorMode = prefs.plantColorMode;
      if (Number.isFinite(prefs.pathWidth)) {
        state.pathWidth = Math.min(Garden.PATH_W_MAX, Math.max(Garden.PATH_W_MIN, prefs.pathWidth));
      }
      if (typeof prefs.pathAnyAngle === 'boolean') state.pathAnyAngle = prefs.pathAnyAngle;
      // Aerógrafo: los cuatro numéricos se acotan a los topes del módulo, que
      // son los mismos que declaran los deslizadores.
      if (Number.isFinite(prefs.airbrushRadius)) {
        state.airbrushRadius = Math.min(Airbrush.R_MAX,
          Math.max(Airbrush.R_MIN, prefs.airbrushRadius));
      }
      if (Number.isFinite(prefs.airbrushDensity)) {
        state.airbrushDensity = Math.min(Airbrush.DENSITY_MAX,
          Math.max(Airbrush.DENSITY_MIN, prefs.airbrushDensity));
      }
      if (Number.isFinite(prefs.airbrushGrain)) {
        state.airbrushGrain = Math.min(Airbrush.GRAIN_MAX,
          Math.max(Airbrush.GRAIN_MIN, prefs.airbrushGrain));
      }
      if (Number.isFinite(prefs.airbrushOpacity)) {
        state.airbrushOpacity = Math.min(1, Math.max(0.05, prefs.airbrushOpacity));
      }
      if (Number.isFinite(prefs.inkGap)) {
        state.inkGap = Math.min(12, Math.max(0, Math.round(prefs.inkGap)));
      }
      if (['shape', 'zone'].includes(prefs.inkTarget)) state.inkTarget = prefs.inkTarget;
      if (['all', 'area'].includes(prefs.airbrushAreaMode)) {
        state.airbrushAreaMode = prefs.airbrushAreaMode;
      }
      // 3D: la sección contra el catálogo (los tres comparten ids) y los
      // cuatro numéricos contra los topes que exporta el módulo, que son los
      // mismos que declaran los deslizadores del HTML.
      if (SOLID_SECTIONS.includes(prefs.solidSection)) state.solidSection = prefs.solidSection;
      [['solidDepth', Solid.DEPTH_MIN, Solid.DEPTH_MAX],
        ['solidAngle', Solid.ANGLE_MIN, Solid.ANGLE_MAX],
        ['solidForeshorten', Solid.FORESHORTEN_MIN, Solid.FORESHORTEN_MAX],
        ['solidTaper', Solid.TAPER_MIN, Solid.TAPER_MAX],
        ['solidRotation', 0, 359]].forEach(([key, lo, hi]) => {
        if (Number.isFinite(prefs[key])) state[key] = Math.min(hi, Math.max(lo, prefs[key]));
      });
      if (Solid.APEX_MODES.includes(prefs.solidApex)) state.solidApex = prefs.solidApex;
      // El área guardada se valida entera y se recorta al lienzo: un rectángulo
      // manipulado recortaría a un sitio inalcanzable y la herramienta parecería
      // rota sin dejar rastro de por qué.
      const a = prefs.airbrushArea;
      if (a && typeof a === 'object' && !Array.isArray(a) &&
          [a.x, a.y, a.w, a.h].every(Number.isFinite) &&
          a.w >= Airbrush.MIN_AREA && a.h >= Airbrush.MIN_AREA) {
        const rec = clampAreaToCanvas(a);
        if (rec.w >= Airbrush.MIN_AREA && rec.h >= Airbrush.MIN_AREA) state.airbrushArea = rec;
      }
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
    updateBackContent();
    if (zoomManual) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitZoomToViewport, 150);
  });

  /* ── Cámara: zoom al cursor, encuadres y pan (v3.5.0) ── */

  // Pan del lienzo: espacio mantenido (spacePan) o botón central. panDrag es
  // la sesión del gesto (scroll y puntero iniciales); vive fuera de `state`
  // porque es cámara, no dibujo — jamás toca elementos, undo ni autosave.
  let spacePan = false;
  let panDrag = null;

  // El sizer y el wrapper transicionan 0.2s ($ease-slow) para que el zoom del
  // SLIDER se anime. Con la rueda o un encuadre esa animación es veneno: el
  // ajuste de scroll que mantiene el punto bajo el cursor se calcula con
  // getBoundingClientRect, y a mitad de transición mide una caja intermedia.
  // La clase --instant las apaga durante el gesto y un debounce la retira.
  // e2e/helpers.js (setZoom) usa el slider y sigue viendo la transición.
  let instantTimer = null;
  function sizerInstant() {
    if (!canvasArea) return;
    canvasArea.classList.add('canvas-area--instant');
    clearTimeout(instantTimer);
    instantTimer = setTimeout(() => canvasArea.classList.remove('canvas-area--instant'), 250);
  }

  // Zoom manteniendo fijo el punto de PANTALLA (clientX/Y): se mide qué punto
  // del lienzo cae ahí, se aplica el zoom y se repone el scroll para que ese
  // punto vuelva a caer bajo el mismo píxel. Es el patrón de Excalidraw/tldraw
  // y la única forma de que la rueda no "huya" del sitio que se está mirando.
  function zoomAtClient(z, clientX, clientY) {
    if (!canvasArea) return;
    const rect = mainCanvas.getBoundingClientRect();
    const p = {
      x: (clientX - rect.left) / state.zoom,
      y: (clientY - rect.top) / state.zoom,
    };
    sizerInstant();
    applyZoom(z);
    zoomManual = true; // misma semántica que tocar el slider: el auto-fit calla
    const r2 = mainCanvas.getBoundingClientRect();
    const dx = (r2.left + p.x * state.zoom) - clientX;
    const dy = (r2.top + p.y * state.zoom) - clientY;
    canvasArea.scrollLeft += dx;
    canvasArea.scrollTop += dy;
    updateBackContent();
  }

  // Caja combinada de todo el dibujo (los `eraser` heredados se saltan, como
  // en Ctrl+A: son máscaras, no contenido). null con el lienzo vacío.
  function contentBounds() {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    state.elements.forEach(el => {
      if (el.type === 'eraser') return;
      const b = getElementBounds(el);
      if (!Number.isFinite(b.x) || !Number.isFinite(b.w)) return;
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    });
    if (x1 === Infinity) return null;
    return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
  }

  // Encuadra una caja del lienzo: el mayor zoom (paso del 10%, entre los
  // límites del slider) con el que cabe entera, centrada. A diferencia del
  // auto-fit del arranque SÍ puede bajar del 100%: aquí lo pide el usuario
  // (Mayús+1/2 o el botón), no un reajuste automático.
  function zoomToBounds(b) {
    if (!b || !canvasArea) return;
    const rect = canvasArea.getBoundingClientRect();
    const PAD = 24;
    const availW = rect.width - PAD * 2;
    const availH = rect.height - PAD * 2;
    if (availW <= 0 || availH <= 0) return;
    let z = Math.min(availW / b.w, availH / b.h);
    z = Math.floor(z * 10) / 10;
    z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    sizerInstant();
    applyZoom(z);
    zoomManual = true;
    const r2 = mainCanvas.getBoundingClientRect();
    const cx = r2.left + (b.x + b.w / 2) * state.zoom;
    const cy = r2.top + (b.y + b.h / 2) * state.zoom;
    canvasArea.scrollLeft += cx - (rect.left + rect.width / 2);
    canvasArea.scrollTop += cy - (rect.top + rect.height / 2);
    updateBackContent();
  }

  function zoomToFitContent() { zoomToBounds(contentBounds()); }
  function zoomToSelection() { zoomToBounds(selectionBounds()); }

  // «Volver al dibujo»: el botón flotante aparece solo cuando el viewport del
  // área no toca la caja de ningún elemento — el "me he perdido en el
  // infinito" que Excalidraw y tldraw resuelven exactamente así. Se recalcula
  // en cada repintado y en el scroll del área (coalescido vía rAF).
  function updateBackContent() {
    const btn = $('btn-back-content');
    if (!btn || !canvasArea) return;
    const b = contentBounds();
    let lost = false;
    if (b) {
      const rect = canvasArea.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const r2 = mainCanvas.getBoundingClientRect();
        const x1 = r2.left + b.x * state.zoom;
        const y1 = r2.top + b.y * state.zoom;
        lost = x1 + b.w * state.zoom < rect.left || x1 > rect.right ||
               y1 + b.h * state.zoom < rect.top || y1 > rect.bottom;
      }
    }
    btn.hidden = !lost;
  }

  if (canvasArea) {
    // Ctrl/Cmd+rueda = zoom al cursor; la rueda a secas sigue siendo scroll
    // (la convención de Figma/Excalidraw/tldraw). El pinch de trackpad llega
    // como wheel con ctrlKey sintético, así que cae aquí gratis. passive:false
    // porque hay preventDefault: sin él el navegador hace SU zoom de página.
    canvasArea.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.002);
      zoomAtClient(state.zoom * factor, e.clientX, e.clientY);
    }, { passive: false });

    let backContentPending = false;
    canvasArea.addEventListener('scroll', () => {
      if (backContentPending) return;
      backContentPending = true;
      requestAnimationFrame(() => {
        backContentPending = false;
        updateBackContent();
      });
    });
  }

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

  /* ── Borrado por trama: texto, emoji, imágenes y componentes de UI ──
     (v2.34.0)

     Lo demás se recorta por geometría: una recta partida sigue siendo rectas,
     un contorno mordido sigue siendo trazo. Aquí no hay geometría que partir
     —una palabra son glifos, un botón es contorno + rótulo + relleno, una
     imagen es una trama— y NINGÚN tipo de elemento representa «un botón al que
     le falta una esquina». Así que se rasteriza el elemento tal y como lo
     dibuja el renderer, se le abre el hueco con `destination-out` y lo que
     queda pasa a ser un `image`: el aspecto es idéntico por construcción
     (es el mismo dibujo), a cambio de dejar de ser editable como texto o como
     componente. Es la misma degradación que flecha→línea o curva→lápiz, un
     escalón más abajo.

     Vive en app.js y no en eraser.js porque necesita un canvas, y eraser.js es
     geometría pura; entra por `deps.rasterErase`, y sin esa dependencia
     (arnés vm, exportaciones) el borrador se comporta como siempre: borrado
     íntegro. */
  const RASTER_ERASE_TYPES = ['text', 'image', 'imagePlaceholder',
    'button', 'input', 'nav', 'card'];
  const RASTER_MAX_SIDE = 4096;   // salvaguarda: nunca rasterizar un lienzo absurdo

  /** Margen alrededor de la caja: el dibujo se sale de ella por el temblor de
      Sketchy, por el punteado del marco y, sobre todo, por la sombra del texto
      —que escala con el cuerpo—. Sobrar es gratis: al final se recorta a la
      tinta que queda de verdad. */
  const rasterPad = el => 16 + (el.lineWidth || 1) * 2 + (el.fontSize || 0) * 0.8;

  function _rasterCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  /** Recuento de píxeles con tinta y su caja, leyendo solo el canal alfa. */
  function _inkStats(data, w, h) {
    let n = 0, minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] < 8) continue;
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { n, minX, minY, maxX, maxY };
  }

  /** Prepara el lienzo con el elemento dibujado y su marco. Compartido por el
      commit y por la previsualización; devuelve null si no se puede (caja
      degenerada, tamaño absurdo, o el render lanza). */
  function _rasterBase(el) {
    const box = getElementBounds(el);
    if (!(box.w > 0 && box.h > 0)) return null;
    const pad = rasterPad(el);
    const x0 = Math.floor(box.x - pad), y0 = Math.floor(box.y - pad);
    const w = Math.ceil(box.w + pad * 2), h = Math.ceil(box.h + pad * 2);
    if (w < 1 || h < 1 || w > RASTER_MAX_SIDE || h > RASTER_MAX_SIDE) return null;
    const cv = _rasterCanvas(w, h);
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.translate(-x0, -y0);
    try {
      Renderer.renderElement(c, el);
    } catch (err) {
      console.warn('No se pudo rasterizar para borrar:', err);
      return null;
    }
    return { cv, c, x0, y0, w, h };
  }

  /** Abre el hueco del borrador: el círculo barrido a lo largo de los puntos
      `pts[from..]` — cada tramo con extremos redondos, cuya unión es idéntica
      a la polilínea entera con uniones redondas, y es lo que permite a la
      previsualización perforar solo los tramos NUEVOS de cada fotograma. */
  function _rasterPunch(c, pts, r, from = 0) {
    c.globalCompositeOperation = 'destination-out';
    c.strokeStyle = '#000';
    c.fillStyle = '#000';
    c.lineWidth = r * 2;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      for (let i = Math.max(1, from); i < pts.length; i++) {
        c.moveTo(pts[i - 1].x, pts[i - 1].y);
        c.lineTo(pts[i].x, pts[i].y);
      }
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  /**
   * Aplica el trazo del borrador a un elemento rasterizable (commit).
   * Devuelve `[]` si no queda nada, `[el]` (la misma referencia) si el trazo
   * no le ha quitado un solo píxel —lo que da alcance exacto de regalo:
   * cruzar el hueco vacío de una tarjeta ya no se la lleva— o `[imagen]` con
   * el mordisco. Corre UNA vez por pasada, al soltar; los recuentos «antes» y
   * «después» se calculan aquí mismo, frescos — la caché entre pasadas que
   * hubo aquí (auditoría v2.35.0) devolvía un «antes» rancio tras un cambio
   * de letra del lienzo y convertía el elemento sin haberle borrado nada.
   */
  function rasterErase(el, pts, r) {
    // Una imagen a medio decodificar se dibuja como marco punteado: rasterizar
    // eso sustituiría la foto por su placeholder. Mejor no tocarla todavía.
    if (el.type === 'image' && !Renderer.imageReady(el.src)) return [el];
    const base = _rasterBase(el);
    if (!base) return null;
    const { cv, c, x0, y0, w, h } = base;

    const antes = _inkStats(c.getImageData(0, 0, w, h).data, w, h);
    if (!antes.n) return [el];        // no dibuja nada: no hay nada que morder

    _rasterPunch(c, pts, r);

    const queda = _inkStats(c.getImageData(0, 0, w, h).data, w, h);
    if (!queda.n) return [];                     // se lo ha llevado entero
    if (queda.n === antes.n) return [el];        // ni un píxel: intacto por referencia

    // Se recorta a la tinta que queda: sin esto la imagen arrastraría todo el
    // margen vacío y su marco de selección mentiría.
    const bw = queda.maxX - queda.minX + 1, bh = queda.maxY - queda.minY + 1;
    const crop = _rasterCanvas(bw, bh);
    crop.getContext('2d').drawImage(cv, queda.minX, queda.minY, bw, bh, 0, 0, bw, bh);

    const pieza = {
      type: 'image',
      x: x0 + queda.minX, y: y0 + queda.minY, w: bw, h: bh,
      color: el.color, lineWidth: el.lineWidth,
      seed: el.seed !== undefined ? el.seed : 1,
    };
    if (el.buildingGroupId !== undefined) pieza.buildingGroupId = el.buildingGroupId;
    // Una FOTO mordida no puede re-serializarse como PNG: sin pérdida sobre
    // contenido fotográfico multiplica el peso ×5-7 y dos mordiscos bastan
    // para pasarse de la cuota de localStorage (auditoría v2.35.0). WebP
    // conserva el alfa del hueco con compresión con pérdida; se comprueba el
    // prefijo del resultado porque un navegador sin WebP devuelve PNG
    // silenciosamente. El dibujo de línea (texto, componentes) sigue en PNG,
    // donde es más pequeño y no pierde nitidez.
    const lossy = el.type === 'image' && /^data:image\/(jpeg|webp)/.test(el.src);
    let src = null;
    if (lossy) {
      const webp = crop.toDataURL('image/webp', 0.8);
      if (webp.startsWith('data:image/webp')) src = webp;
    }
    pieza.src = src || crop.toDataURL('image/png');
    return [pieza];
  }

  /**
   * Previsualización del mordisco por trama, incremental. El canvas con el
   * elemento dibujado se crea UNA vez por pasada y cada fotograma solo perfora
   * los tramos nuevos del trazo (`destination-out` acumula); no hay recuentos
   * ni `toDataURL` —un getImageData de una foto grande costaba ~30 ms por
   * fotograma, y la decodificación del data-URL es asíncrona y haría
   * parpadear el elemento—. La pieza lleva el canvas vivo en `bitmap` y cubre
   * la caja acolchada entera (el margen transparente no pinta nada); nunca
   * entra en `state.elements`. Si el trazo no ha quitado nada, el bitmap es
   * idéntico al dibujo del elemento: visualmente da igual.
   */
  function rasterErasePreview(el, pts, r, session) {
    if (el.type === 'image' && !Renderer.imageReady(el.src)) return [el];
    let s = session.get(el);
    // Un trazo más corto que el ya perforado es una pasada nueva: se reinicia.
    if (s && s.punched > pts.length) s = null;
    if (!s) {
      const base = _rasterBase(el);
      if (!base) return null;
      s = { ...base, punched: 0 };
      session.set(el, s);
    }
    _rasterPunch(s.c, pts, r, s.punched);
    s.punched = pts.length;
    return [{
      type: 'image',
      x: s.x0, y: s.y0, w: s.w, h: s.h,
      color: el.color, lineWidth: el.lineWidth,
      seed: el.seed !== undefined ? el.seed : 1,
      bitmap: s.cv,
    }];
  }

  /** Estado por pasada de la previsualización del borrador: canvases del
      recorte por trama y memos del recorte geométrico (eraser.js), ambos
      claveados por elemento. Nace en el primer fotograma del arrastre y se
      tira al soltar — nada sobrevive entre pasadas (auditoría v2.35.0: una
      caché que sobrevivía devolvía recuentos rancios tras cambiar la letra). */
  let eraserSession = null;

  /** Lo que Eraser necesita de fuera: bounds reales y siluetas de las formas
      con vértices, para que borrar coincida con lo que un clic seleccionaría,
      más el recorte por trama de lo que no tiene geometría que partir. */
  const eraserDeps = (opts = {}) => ({
    boundsOf: getElementBounds,
    sampleCurve: (el, n) => CurvePath.sample(el, n),
    polygonVertices: el => (RegularPolygon.isType(el.type) ? RegularPolygon.vertices(el)
      : el.type === TOOLS.POLYGON ? el.points : null),
    trapezoidVertices: el => (el.type === TOOLS.TRAPEZOID ? Trapezoid.vertices(el) : null),
    isEmpty: el => (el.type === 'airbrush' ? Airbrush.isEmpty(el) : false),
    session: opts.preview ? eraserSession.geo : null,
    rasterErase: (el, pts, r) => {
      if (!RASTER_ERASE_TYPES.includes(el.type)) return null;
      return opts.preview
        ? rasterErasePreview(el, pts, r, eraserSession.raster)
        : rasterErase(el, pts, r);
    },
  });

  function redrawNow() {
    resolveAnchors();
    // Previsualización del borrador: lo que la pasada va a eliminar o recortar
    // ya cambia mientras se arrastra, así que lo que se ve durante el gesto es
    // exactamente el resultado. El estado no se toca hasta soltar (undo sigue
    // siendo un único paso por pasada).
    const erasing = state.isDrawing &&
      state.tool === TOOLS.ERASER &&
      state.currentPath.length;
    if (erasing && !eraserSession) {
      eraserSession = { raster: new Map(), geo: new Map() };
    }
    const sceneElements = erasing
      ? Eraser.erase(state.elements, state.currentPath, state.eraserSize / 2,
        eraserDeps({ preview: true }))
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
    // Tiradores SOLO con Mover: con una herramienta de creación activa la
    // selección conservada (v2.10.0) se edita en su modal y en el panel, pero
    // el lienzo CREA — el hit-test de tiradores vive en la rama de Mover de
    // onMouseDown, así que dibujarlos aquí era mentir: agarrar la esquina
    // pintaba un elemento nuevo encima en vez de escalar (auditoría v2.10.1).
    // La caja discontinua sí se dibuja siempre: comunica qué se está editando.
    const handlesOn = state.tool === TOOLS.SELECT;
    const groupBox = selectionGroupBounds();
    if (groupBox) {
      // Edificio seleccionado como unidad: una sola caja combinada, CON
      // handles — escalan el grupo entero de forma uniforme (resizeGroupTo).
      // Aquí NO se dibuja además la caja de cada pieza: son decenas, y el
      // grupo se manipula como una sola cosa.
      Renderer.drawSelection(ctx, groupBox, handlesOn);
    } else {
      state.selection.forEach(i => {
        const el = state.elements[i];
        // Las flechas usan handles de extremo/curvatura, no esquinas de escala
        const isArrow = el.type === 'arrow' || el.type === 'curveArrow';
        Renderer.drawSelection(ctx, getElementBounds(el), handlesOn && single && !isArrow);
      });
      // Multi-selección suelta (varios elementos que no son un edificio):
      // además de resaltar cada uno —que es lo que dice CUÁLES están
      // seleccionados, cosa que la caja combinada no puede: cubre huecos y
      // vecinos— se dibuja la caja combinada CON tiradores, para poder
      // redimensionar el conjunto igual que un grupo (v2.12.0). Antes solo
      // los edificios los tenían, así que seleccionar tres formas a mano
      // dejaba el ratón sin forma de escalarlas.
      if (state.selection.length > 1) {
        Renderer.drawSelection(ctx, selectionBounds(), handlesOn);
      }
    }
    // Handles de flecha: curvatura (turquesa, con polilínea de control como
    // guía) y extremos (naranja, arrastrables para mover/anclar)
    if (single && handlesOn) {
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
    updateBackContent();
    // Único punto que sincroniza la UI dependiente de la selección
    const hasSel = state.selection.length > 0;
    $('btn-delete-sel').hidden = !hasSel;
    $('btn-duplicate-sel').hidden = !hasSel;
    $('zorder-row').hidden = !hasSel;
    $('btn-edit-garden').hidden = !selectedGardenGroup();
    const rotatable = state.selection.filter(i => ShapeRotation.isType(state.elements[i].type));
    const rotateBtn = $('btn-rotate-sel');
    rotateBtn.hidden = rotatable.length === 0;
    rotateBtn.textContent = rotatable.length === 1 && state.selection.length === 1
      ? `↻ Rotar ${ShapeRotation.step(state.elements[rotatable[0]].type)}°`
      : '↻ Rotar selección';
    /* Semántica dual de los controles del panel: con selección muestran los
       valores de lo seleccionado; sin selección, los defaults de creación.

       Con VARIOS seleccionados se enseña el valor que TODOS comparten, y si
       discrepan el control se deja como está: no existe un valor único que
       enseñar, e inventar el del primero haría creer que los demás también
       son así. Hasta la 2.12.0 la multi-selección no tocaba NINGÚN control,
       así que el panel seguía enseñando lo último visto —el negro y el 2px de
       los defaults— aunque los tres elementos seleccionados fueran rojos y
       gruesos; tocar un control sí los cambiaba los tres, pero nada en
       pantalla lo decía, y eso es lo que hacía parecer que el panel no
       aplicaba a la selección. Cada control se calcula sobre los elementos a
       los que AFECTA (las flechas para la doble punta, los rellenables para
       el relleno…), no sobre la selección entera: un rect junto a una flecha
       no debe dejar la casilla de doble punta en blanco. */
    if (hasSel) {
      const sel = state.selection.map(i => state.elements[i]);
      const arrows = sel.filter(el => el.type === 'arrow' || el.type === 'curveArrow');
      const dashables = sel.filter(el => DASHABLE_TYPES.includes(el.type));
      const texts = sel.filter(el => el.type === 'text');
      const fillables = sel.filter(el => FILLABLE_TYPES.includes(el.type));
      const color = commonOf(sel, el => el.color);
      if (color !== undefined) showColor(color);
      // El grosor ya no se sincroniza aquí: dejó el panel en la v2.21.0 y sus
      // cinco gemelos viven en los modales, que se sincronizan solos
      // (syncStrokeControls y compañía, llamadas al final de syncPanelSections
      // mientras el modal esté abierto).
      const doubleHead = commonOf(arrows, el => el.heads === 'both');
      if (doubleHead !== undefined) $('check-double-head').checked = doubleHead;
      const dash = commonOf(dashables, el => el.dash === true);
      if (dash !== undefined) $('check-dash').checked = dash;
      if (texts.length) {
        $('font-label').textContent = 'Texto';
        $('font-slider').min = '10';
        const fontSize = commonOf(texts, el => el.fontSize);
        if (fontSize !== undefined) {
          $('font-slider').value = String(fontSize);
          $('font-val').textContent = String(fontSize);
        }
      }
      if (fillables.length) {
        const fill = commonOf(fillables, el => el.fill === true);
        if (fill !== undefined) $('check-fill').checked = fill;
        const transparent = commonOf(fillables, el => el.fillTransparent === true);
        if (transparent !== undefined) {
          $('check-fill-transparent').checked = transparent;
          $('fill-opacity-slider').disabled = !transparent;
        }
        const opacity = commonOf(fillables,
          el => (el.fillOpacity !== undefined ? el.fillOpacity : 0.4));
        if (opacity !== undefined) {
          $('fill-opacity-slider').value = Math.round(opacity * 100);
          $('fill-opacity-val').textContent = String(Math.round(opacity * 100));
        }
        // Sin fillColor propio el relleno es el tinte del trazo: se muestra
        // ese color como punto de partida del picker
        const fillColor = commonOf(fillables, el => hex6(el.fillColor || el.color));
        if (fillColor !== undefined) $('fill-color-picker').value = fillColor;
      }
    } else if (!hasSel) {
      $('check-double-head').checked = state.doubleHead;
      $('check-dash').checked = state.dashed;
      $('check-fill').checked = state.fillShapes;
      $('check-fill-transparent').checked = state.fillTransparent;
      $('fill-opacity-slider').value = Math.round(state.fillOpacity * 100);
      $('fill-opacity-val').textContent = String(Math.round(state.fillOpacity * 100));
      $('fill-opacity-slider').disabled = !state.fillTransparent;
      $('fill-color-picker').value = hex6(state.fillColor || state.color);
      // Con Emoji activo el deslizador de la sección «Texto» se retitula y
      // pasa a gobernar el tamaño del EMOJI (state.emojiSize, min 32 para que
      // siga leyéndose como icono) — el mismo retargeteo que hace el de grosor
      // con el borrador. placeEmoji ya no lee fontSize, así que sin esto la
      // sección era un control muerto para el Emoji (auditoría v2.10.1).
      const emojiing = state.tool === TOOLS.EMOJI;
      $('font-label').textContent = emojiing ? 'Emoji' : 'Texto';
      $('font-slider').min = emojiing ? String(EMOJI_MIN_SIZE) : '10';
      $('font-slider').value = String(emojiing ? state.emojiSize : state.fontSize);
      $('font-val').textContent = String(emojiing ? state.emojiSize : state.fontSize);
      showColor(state.color);
    }
    syncGeometryControls();
    syncPanelSections();
    scheduleAutosave();
  }

  /** Tipos con texto propio editable desde el panel. El de `text` es su
      contenido (`value`); el de los componentes UI, su rótulo (`label`). */
  const LABEL_FIELD = el => (el.type === 'text' ? 'value'
    : ['button', 'input', 'nav', 'card'].includes(el.type) ? 'label' : null);

  /** Vuelca en «Posición y tamaño» la caja real de lo seleccionado. Con varios,
      la caja combinada: escribir en ella mueve o escala el conjunto, igual que
      arrastrar su marco. Mientras el usuario teclea en un campo no se le
      sobrescribe. */
  /** Juegos de campos X/Y/Ancho/Alto: el del panel («el») y sus gemelos dentro
      de los modales de ajustes (v2.10.0; el aerógrafo en la 2.22.0) — un solo
      cuerpo de lectura y otro de escritura para todos, porque la caja escrita a
      mano no puede tener dos vías que discrepen. */
  const GEO_PREFIXES = ['el', 'stroke-modal', 'shape-modal', 'text-modal', 'ui-modal',
    'airbrush-modal'];

  // Para qué selección se escribieron los campos. En navegador, clicar otro
  // elemento dispara PRIMERO el mousedown (que cambia la selección) y DESPUÉS
  // el blur del campo → change: sin esta marca, el ancho tecleado para A se
  // aplicaba al B recién seleccionado (auditoría v2.10.1). El redraw que
  // resincroniza va por rAF, siempre posterior al change, así que la marca
  // desfasada delata el gesto.
  let geoFieldsFor = '';

  function syncGeometryControls() {
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    // Los bloques de los modales solo aparecen con selección (sin ella no hay
    // nada que colocar); el del panel lo oculta syncPanelSections con toda su
    // sección «Posición y tamaño».
    GEO_PREFIXES.forEach(p => {
      if (p !== 'el') $(p + '-geo').hidden = !sel.length;
    });
    geoFieldsFor = state.selection.join(',');
    if (!sel.length) return;
    // La caja combinada de CUALQUIER selección, no solo la de un grupo: con
    // dos elementos sueltos también hay una caja que enseñar y editar.
    const b = selectionBounds();
    if (!b) return;
    const put = (id, v) => {
      const input = $(id);
      if (document.activeElement !== input) input.value = String(Math.round(v));
    };
    GEO_PREFIXES.forEach(p => {
      put(p + '-x', b.x); put(p + '-y', b.y);
      put(p + '-w', b.w); put(p + '-h', b.h);
    });
    const field = sel.length === 1 ? LABEL_FIELD(sel[0]) : null;
    $('el-label-row').hidden = !field;
    if (field && document.activeElement !== $('el-label')) {
      $('el-label').value = sel[0][field] || '';
    }
  }

  /** Aplica la caja escrita a mano: mueve y escala con las mismas funciones que
      el arrastre y los tiradores, para no abrir una segunda vía que pueda
      discrepar. Un cambio, un paso de deshacer. `prefix` dice qué juego de
      campos se acaba de editar (el del panel o el de un modal). */
  function applyGeometry(prefix) {
    const p = GEO_PREFIXES.includes(prefix) ? prefix : 'el';
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    if (!sel.length) return;
    // Los campos hablan de OTRA selección (el clic que la cambió corrió antes
    // que este change): no se aplica nada y se resincronizan a la nueva.
    if (state.selection.join(',') !== geoFieldsFor) {
      syncGeometryControls();
      return;
    }
    // La misma caja combinada que enseñan los campos (cualquier selección,
    // tenga grupo o no) — leer aquí otra caja es garantía de discrepancia.
    const from = selectionBounds();
    if (!from) return;
    // Lee un campo decidiendo si el usuario lo CAMBIÓ. Dos trampas ya
    // mordidas (auditoría v2.10.1):
    //   · un <input type=number> vaciado (o con basura tecleada) da value ''
    //     y Number('') es 0, no NaN: sin el chequeo de la cadena, vaciar
    //     «Ancho» colapsaba el elemento a 1px y vaciar «X» lo mandaba a 0;
    //   · los campos ENSEÑAN valores redondeados (put hace Math.round), así
    //     que comparar lo tecleado contra la caja EXACTA hacía «cambiado» a
    //     todo campo de valor fraccionario — y como el ancho se evalúa
    //     primero, el alto que acababas de teclear PERDÍA contra un ancho
    //     que nadie había tocado (con el auto-zoom del 120% casi toda caja
    //     es fraccionaria). Cambiado es «distinto de lo que el campo
    //     mostraba»; sin cambio, manda el valor exacto, no el redondeado.
    const field = (id, exact) => {
      const s = String($(p + id).value).trim();
      const v = Number(s);
      if (s === '' || !Number.isFinite(v)) return { v: exact, changed: false };
      if (v === Math.round(exact)) return { v: exact, changed: false };
      return { v, changed: true };
    };
    const X = field('-x', from.x), Y = field('-y', from.y);
    const W = field('-w', from.w), H = field('-h', from.h);
    const to = {
      x: X.v, y: Y.v,
      w: Math.max(1, W.v), h: Math.max(1, H.v),
    };
    // Las mismas invariantes que imponen los tiradores, porque escribir una
    // medida no puede permitir lo que arrastrar prohíbe:
    //   · un polígono regular exige w === h, e isValidElement RECHAZA los
    //     deformados — un ancho y un alto distintos darían un proyecto que ya
    //     no se puede reimportar;
    //   · un grupo (o cualquier multi-selección) escala en proporción, porque
    //     dentro viaja de todo y un estirón libre rompería la invariante
    //     anterior en sus piezas;
    //   · una mancha de aerógrafo, por lo mismo que al arrastrar su tirador:
    //     la boquilla es un solo escalar y no existe la boquilla elíptica.
    // En todos los casos manda el lado que se acaba de escribir y el otro le
    // sigue; syncGeometryControls lo refleja en el acto, así que se ve por qué.
    const single = sel.length === 1 ? sel[0] : null;
    if (single && REGULAR_POLYGON_TYPES.includes(single.type)) {
      const side = W.changed ? to.w : H.changed ? to.h : from.w;
      to.w = side; to.h = side;
    } else if (sel.length > 1 || (single && single.type === 'airbrush')) {
      const s = W.changed ? (from.w ? to.w / from.w : 1)
        : H.changed ? (from.h ? to.h / from.h : 1) : 1;
      to.w = from.w * s; to.h = from.h * s;
    }
    // No-op efectivo: nada tecleado distinto, o una medida que la geometría no
    // puede absorber (teclear un alto a una línea horizontal: scaleElement
    // fuerza sy=1 cuando from.h es 0). Sin este cálculo se apilaba un paso de
    // deshacer fantasma — el primer Ctrl+Z parecía muerto — y el campo se
    // quedaba prometiendo un alto que el elemento no tiene: se resincroniza
    // para que vuelva a decir la verdad.
    // Una X o una Y tecleadas fuera del lienzo pierden el elemento igual que
    // lanzarlo con el ratón, así que pasan por el mismo freno; el campo se
    // resincroniza abajo y enseña dónde ha quedado de verdad.
    const moved = clampDelta({ ...from, w: to.w, h: to.h },
      to.x - from.x, to.y - from.y);
    const dx = moved.dx, dy = moved.dy;
    const sx = from.w ? to.w / from.w : 1;
    const sy = from.h ? to.h / from.h : 1;
    if (!dx && !dy && sx === 1 && sy === 1) {
      syncGeometryControls();
      return;
    }
    saveUndo();
    state.selection.forEach(i => {
      // Primero la escala (referida a la caja de origen) y luego el
      // desplazamiento: al revés, el factor se aplicaría sobre una caja movida.
      const scaled = scaleElement(state.elements[i], from, { ...from, w: to.w, h: to.h });
      state.elements[i] = moveElement(scaled, dx, dy);
    });
    redraw();
  }

  /**
   * Muestra en el panel SOLO las secciones que la herramienta activa o la
   * selección usan. El panel era una lista plana de 45 controles: dibujando con
   * el lápiz seguían delante «Plantas», «Cubierta del alzado» o «Ancho del
   * camino», que solo sirven para Fachada y para Camino. Y por debajo de 1100px
   * el panel es un cajón, donde cada control de más se paga en scroll.
   *
   * Se decide por herramienta Y por selección, no solo por herramienta: los
   * controles de relleno, trazo y texto tienen semántica dual, así que con un
   * rectángulo seleccionado «Relleno» tiene que estar aunque la herramienta
   * activa sea el lápiz. Ese es el punto delicado de todo esto.
   *
   * Se llama desde redrawNow(), que es el único punto de sincronía de la UI
   * dependiente de la selección y ya calculó todo lo que hace falta.
   */
  function syncPanelSections() {
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    const selHas = pred => sel.some(pred);
    const tool = state.tool;

    const fill = FILLABLE_TYPES.includes(tool) ||
      selHas(el => FILLABLE_TYPES.includes(el.type));
    const text = tool === TOOLS.TEXT || tool === TOOLS.EMOJI ||
      selHas(el => el.type === 'text');
    const dashable = DASHABLE_TYPES.includes(tool) || tool === TOOLS.ARC ||
      selHas(el => DASHABLE_TYPES.includes(el.type));
    const headed = tool === TOOLS.ARROW || tool === TOOLS.CURVE_ARROW ||
      selHas(el => (el.type === 'arrow' || el.type === 'curveArrow') && el.heads !== 'none');

    $('panel-sec-element').hidden = !state.selection.length;
    $('panel-sec-fill').hidden = !fill;
    $('panel-sec-text').hidden = !text;
    $('panel-sec-build').hidden = !BUILDING_TOOLS.includes(tool);
    $('panel-sec-garden').hidden = !GARDEN_TOOLS.includes(tool);
    $('row-dash').hidden = !dashable;
    $('row-double-head').hidden = !headed;
    // Con el Emoji activo y sin selección, la sección «Texto» se retitula para
    // gobernar el tamaño DEL EMOJI: negrita y sombra no significan nada ahí, y
    // dejarlas visibles sería repetir el error del deslizador muerto que la
    // 2.10.1 tuvo que arreglar.
    const styling = !(tool === TOOLS.EMOJI && !state.selection.length);
    $('row-text-bold').hidden = !styling;
    $('row-text-shadow').hidden = !styling;
    $('row-text-shadow-color').hidden = !styling;
    // Un ⚙ FIJO por sección (v2.21.0): cada uno abre SIEMPRE los ajustes de la
    // suya. Antes había uno solo, en la cabecera «Trazo», que se re-apuntaba a
    // cinco modales según state.tool y aparecía y desaparecía con una condición
    // de seis ramas: el mismo botón, en el mismo sitio, abría cinco diálogos
    // distintos y no había forma de saber cuál sin pulsarlo. Solo quedan aquí
    // dos cosas dependientes del contexto, y ninguna cambia el destino:
    //   · la VISIBILIDAD del de «Posición y tamaño», que depende del TIPO
    //     seleccionado (una imagen pegada no tiene ajustes que abrir);
    //   · el RÓTULO del de «Texto», porque el deslizador que tiene al lado se
    //     retitula solo con el Emoji (#font-label) y el ⚙ debe decir lo mismo.
    // Los demás heredan la visibilidad de su sección, que ya se oculta sola.
    // «Trazo» se quedó SIN ⚙: era el sitio del botón camaleón, y el único cuyo
    // engranaje no abría los ajustes de su sección sino los de la herramienta
    // activa. Se llega a ellos pulsando la herramienta —la vía primaria— y, con
    // algo seleccionado, por el ⚙ de «Posición y tamaño».
    $('btn-element-settings').hidden = !settingsModalForSelection();
    $('btn-text-settings').title = tool === TOOLS.EMOJI && !state.selection.length
      ? 'Elegir emoji y tamaño'
      : 'Ajustar el texto';
    // Con un modal de ajustes abierto, la selección puede cambiar por debajo
    // (Ctrl+A, borrar…): se refresca para que siga enseñando lo que edita. Solo
    // si está abierto — repintar su miniatura en cada frame del arrastre sería
    // trabajo tirado.
    if ($('modal-stroke').open) syncStrokeControls();
    if ($('modal-shape').open) syncShapeControls();
    if ($('modal-text').open) syncTextControls();
    if ($('modal-ui').open) syncUiControls();
    if ($('modal-airbrush').open) syncAirbrushControls();
    if ($('modal-ink').open) syncInkControls();
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
    // Las cadenas salen por CurvePath, pero NO con un return temprano: las
    // fichas de regeneración (solidMeta/gardenMeta) de abajo también viajan
    // en piezas encadenadas — un árbol es sobre todo curvas —, y saltárselas
    // dejaba la meta de esas piezas sin escalar (auditoría v2.39.1).
    let m;
    if (el.type === 'curveArrow' && CurvePath.isChain(el)) {
      m = CurvePath.scale(el, mapX, mapY);
    } else {
      m = { ...el };
      if (m.points) {
        m.points = m.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
      } else if (m.x1 !== undefined) {
        m.x1 = mapX(m.x1); m.y1 = mapY(m.y1);
        m.x2 = mapX(m.x2); m.y2 = mapY(m.y2);
        if (m.cx !== undefined) { m.cx = mapX(m.cx); m.cy = mapY(m.cy); }
        if (m.cx2 !== undefined) { m.cx2 = mapX(m.cx2); m.cy2 = mapY(m.cy2); }
      } else if (m.type === 'text') {
        m.x = mapX(el.x); m.y = mapY(el.y);
        m.fontSize = Math.max(8, Math.round(m.fontSize * sy));
      } else {
        m.x = mapX(el.x); m.y = mapY(el.y);
        m.w = el.w * sx; m.h = el.h * sy;
      }
    }
    if (m.solidMeta && m.solidMeta.gesture) {
      const g = m.solidMeta.gesture;
      m.solidMeta = {
        ...m.solidMeta,
        gesture: { x1: mapX(g.x1), y1: mapY(g.y1), x2: mapX(g.x2), y2: mapY(g.y2) },
      };
    }
    // Los puntos de inserción botánicos escalan con la pieza, igual que se
    // desplazan en moveElement: sin esto, «Editar planta» sobre un grupo ya
    // escalado regeneraba con el gesto original y la planta ENCOGÍA en
    // silencio a su tamaño de dibujo (auditoría v2.39.1).
    if (m.gardenMeta) {
      m.gardenMeta = {
        ...m.gardenMeta,
        p1: { x: mapX(m.gardenMeta.p1.x), y: mapY(m.gardenMeta.p1.y) },
        p2: { x: mapX(m.gardenMeta.p2.x), y: mapY(m.gardenMeta.p2.y) },
      };
    }
    if (m.type === 'airbrush') {
      // La boquilla escala con el dibujo; el escalado del aerógrafo es
      // uniforme por contrato (resizeTo/applyGeometry), así que sx≈sy y la
      // media es el factor. El GRANO (lineWidth) no escala, igual que en el
      // lápiz: lo gobierna un deslizador de rango fijo 1–8 y un resize que lo
      // sacara de rango dejaría ese mando mintiendo sobre lo que hay.
      // Y acotada a su rango: isValidElement exige radius en [R_MIN, R_MAX],
      // y restoreAutosave/importJSON filtran con él — sin el clamp, agrandar
      // la mancha ×2,5 la volvía inválida y DESAPARECÍA en la siguiente
      // recarga, sin aviso (auditoría v2.30.0).
      m.radius = Math.min(Airbrush.R_MAX, Math.max(Airbrush.R_MIN,
        el.radius * (Math.abs(sx) + Math.abs(sy)) / 2));
      if (m.clip) {
        m.clip = { x: mapX(m.clip.x), y: mapY(m.clip.y), w: m.clip.w * sx, h: m.clip.h * sy };
      }
    }
    return m;
  }

  /**
   * Escala un grupo entero (un edificio, una planta) desde la esquina opuesta
   * a la agarrada.
   *
   * El factor es UNIFORME a propósito, y no el estirón libre de los dos ejes
   * que sí permite el resize de un elemento suelto: aquí dentro viaja de todo,
   * y hay piezas con invariantes que un estirón libre rompería. Los polígonos
   * regulares exigen `w === h` e `isValidElement` RECHAZA al importar los que
   * no lo cumplen, así que un escalado libre podría dejar un proyecto que ya
   * no se puede volver a abrir. Aparte, una fachada estirada de un solo eje
   * deja de leerse como la misma fachada.
   */
  function resizeGroupTo(p, r) {
    const f = r.from;
    const fixed = {
      nw: { x: f.x + f.w, y: f.y + f.h },
      ne: { x: f.x,       y: f.y + f.h },
      sw: { x: f.x + f.w, y: f.y },
      se: { x: f.x,       y: f.y },
    }[r.corner];
    if (!fixed) return;
    // Manda el eje que más ha crecido; en valor absoluto, para que arrastrar
    // más allá de la esquina fija agrande en vez de dar el grupo del revés.
    const sx = f.w ? Math.abs(p.x - fixed.x) / f.w : 0;
    const sy = f.h ? Math.abs(p.y - fixed.y) / f.h : 0;
    const s = Math.max(sx, sy);
    const w = f.w * s, h = f.h * s;
    if ((f.w > 0 && w < 10) || (f.h > 0 && h < 10)) return;   // mismo suelo que el resize simple
    const to = {
      x: r.corner.includes('w') ? fixed.x - w : fixed.x,
      y: r.corner.includes('n') ? fixed.y - h : fixed.y,
      w, h,
    };
    r.group.forEach((idx, k) => {
      state.elements[idx] = scaleElement(r.originals[k], f, to);
    });
    r.did = true;
  }

  function resizeTo(pos, e) {
    const r = state.resizing;
    const p = (state.snapGrid && !e.altKey) ? { x: snapVal(pos.x), y: snapVal(pos.y) } : pos;
    // Grupo seleccionado como unidad: escala todas sus piezas a la vez.
    if (r.group) { resizeGroupTo(p, r); return; }
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
    // El aerógrafo escala en PROPORCIÓN, como un grupo: su boquilla es un solo
    // escalar, y una caja estirada en un eje pediría una boquilla elíptica que
    // el modelo no tiene. Misma cuenta que resizeGroupTo.
    if (r.original.type === 'airbrush') {
      const fixed = {
        nw: { x: f.x + f.w, y: f.y + f.h },
        ne: { x: f.x,       y: f.y + f.h },
        sw: { x: f.x + f.w, y: f.y },
        se: { x: f.x,       y: f.y },
      }[r.corner];
      if (fixed) {
        const s = Math.max(f.w ? Math.abs(p.x - fixed.x) / f.w : 0,
                           f.h ? Math.abs(p.y - fixed.y) / f.h : 0);
        const w = f.w * s, h = f.h * s;
        to = {
          x: r.corner.includes('w') ? fixed.x - w : fixed.x,
          y: r.corner.includes('n') ? fixed.y - h : fixed.y,
          w, h,
        };
      }
    }
    // Tamaño mínimo, salvo en dimensiones que ya eran 0 (líneas rectas)
    if ((f.w > 0 && to.w < 10) || (f.h > 0 && to.h < 10)) return;
    state.elements[state.selection[0]] = scaleElement(r.original, f, to);
    r.did = true;
  }

  // Shift+click con Mover o con «Select»: toggle en la selección — el grupo
  // completo (edificio/planta), o solo la pieza con Alt+Shift+click.
  function shiftToggleAt(idx, alt) {
    if (idx < 0) return;
    const grp = alt ? [idx] : groupIndicesOf(idx);
    setSelection(state.selection.includes(idx)
      ? state.selection.filter(i => !grp.includes(i))
      : [...state.selection, ...grp]);
    redraw();
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

      // 1-bis. Handles de resize de CUALQUIER multi-selección: un edificio o
      // una planta seleccionados como unidad, y también varios elementos
      // sueltos elegidos a mano (v2.12.0) — escalar «lo que hay seleccionado»
      // no tiene por qué exigir que sea un grupo. Van ANTES del arrastre por
      // marco combinado de abajo: los handles caen justo sobre las esquinas de
      // ese marco, así que sin esta precedencia agarrar una esquina movería la
      // selección en vez de escalarla, y no habría forma de redimensionarla.
      const groupResizeBox = state.selection.length > 1 ? selectionBounds() : null;
      if (groupResizeBox) {
        const groupCorner = hitHandle(pos, groupResizeBox);
        if (groupCorner) {
          state.resizing = {
            corner: groupCorner,
            from: groupResizeBox,
            group: [...state.selection],
            originals: state.selection.map(i => state.elements[i]),
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
        shiftToggleAt(idx, e.altKey);
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

    // Herramienta «Select» (solo selección): el clic selecciona —con la misma
    // semántica de grupos, Alt y «Los clics acumulan» que Mover— y el arrastre
    // dibuja SIEMPRE marquesina, incluso empezando encima de un elemento, que
    // es justo el gesto que Mover no puede ofrecer sin mover. Nada se desplaza
    // jamás con esta herramienta. El gesto entero se resuelve en el bloque de
    // marquee de onMouseUp (vía state.pickDown): hasta soltar no se sabe si
    // fue clic o marco, así que aquí no se toca la selección — un marco que
    // sustituye ya lo hará setSelection, y un clic necesita la selección
    // vieja intacta para poder acumular o retirar.
    if (state.tool === TOOLS.PICK) {
      if (e.shiftKey) {
        shiftToggleAt(hitTest(pos), e.altKey);
        return;
      }
      state.pickDown = { idx: hitTest(pos), alt: e.altKey };
      state.marquee = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      redraw();
      return;
    }

    // Con una herramienta de creación (o el borrador) activa, empezar un gesto
    // en el lienzo suelta la selección que selectTool conservó para editarla en
    // su modal: si se está creando algo nuevo, el panel y los modales ya no
    // deben seguir editando lo anterior.
    if (state.selection.length) setSelection([]);

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

    // Tinta: un bote de pintura no tiene arrastre, se resuelve en el clic.
    if (state.tool === TOOLS.INK) {
      applyInk(pos);
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

    if (state.tool === TOOLS.AIRBRUSH) {
      // Con el modo «área» armado, el arrastre marca el rectángulo en vez de
      // pintar: es el gesto que el modal acaba de pedir, y por eso el modal se
      // cierra al armarlo (un <dialog showModal> dejaría el lienzo inerte).
      state.airbrushDrag = state.airbrushAreaPending ? 'area' : 'spray';
      if (state.airbrushDrag === 'spray') {
        state.currentPath = [pos];
        // El seed se fija AQUÍ, no al soltar: la previsualización dibuja la
        // nube de verdad y con un seed nuevo por fotograma la mancha herviría.
        state.airbrushSeed = newSeed();
      }
    }
  }

  /* ── Overlay preview (coalescido vía requestAnimationFrame) ── */

  let overlayPending = false;
  let lastPos = null;

  /**
   * Elemento de aerógrafo con los ajustes actuales. Fuente ÚNICA para los tres
   * sitios que lo construyen —previsualización del arrastre, commit al soltar
   * y miniatura del modal—, por lo mismo que buildOpts() para Edificios.
   *
   * Dos campos son OPCIONALES y su ausencia es el aspecto por defecto, igual
   * que con la negrita y la sombra del texto: sin `opacity` la pintura es
   * sólida, y sin `clip` cubre todo el lienzo. Así una mancha corriente
   * serializa exactamente los mismos campos que serializaría sin esta función.
   */
  function airbrushElement(points, seed) {
    const el = {
      type: 'airbrush',
      points,
      color: state.color,
      lineWidth: state.airbrushGrain,
      radius: state.airbrushRadius,
      density: state.airbrushDensity,
      seed,
    };
    if (state.airbrushOpacity < 1) el.opacity = state.airbrushOpacity;
    // Copia, nunca la referencia de state: los elementos son objetos planos y
    // serializables, y compartirla haría que mover una mancha moviera el área
    // de la herramienta.
    if (state.airbrushAreaMode === 'area' && state.airbrushArea) {
      el.clip = { ...state.airbrushArea };
    }
    return el;
  }

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
      wallView: state.wallView, wallMaterial: state.wallMaterial,
      wallHeight: state.wallHeight, wallRailing: state.wallRailing,
      wallRailingHeight: state.wallRailingHeight,
      wallRailingType: state.wallRailingType,
      wallGateType: state.wallGateType, wallGateHeight: state.wallGateHeight,
      fenceView: state.fenceView, fenceType: state.fenceType,
      fenceHeightCm: state.fenceHeightCm,
      gateView: state.gateView, gateType: state.gateType,
      gateHeightCm: state.gateHeightCm,
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
      climberType: state.climberType,
      labels: state.gardenLabels,
      gardenLabelMode: state.gardenLabelMode,
      plantView: state.plantView,
      plantStage: state.plantStage,
      plantScalePct: state.plantScalePct,
      plantPxPerM: state.plantPxPerM,
      plantColorMode: state.plantColorMode,
      pathWidth: state.pathWidth,
      // Dos vías a lo mismo, y la casilla manda: `pathAnyAngle` es un ajuste
      // pegajoso que se marca de un clic, y `pathFreeAngle` el Shift mantenido
      // del arrastre en curso. Mantener una tecla mientras se arrastra exige
      // DOS manos, así que no puede ser la única forma de llegar aquí.
      freeAngle: state.pathAnyAngle || state.pathFreeAngle,
      measureText: (value, fontSize) => {
        ctx.save();
        ctx.font = `${fontSize}px ${sketchFont()}`;
        const w = ctx.measureText(value).width;
        ctx.restore();
        return w;
      },
    };
  }

  // Opts de creación de la sección 3D. Mismo papel que buildOpts/gardenOpts:
  // fuente ÚNICA para la previsualización del arrastre, el commit al soltar,
  // los iconos del catálogo y la miniatura de cada modal.
  //
  // El relleno viaja porque la CARA FRONTAL es un elemento de forma de verdad
  // y lo admite: emitida la última, su relleno tapa las aristas que pasan por
  // detrás, así que activarlo no puede estropear el dibujo.
  function solidOpts() {
    return {
      color: state.color, lineWidth: state.lineWidth,
      solidSection: state.solidSection,
      solidRotation: state.solidRotation,
      solidDepth: state.solidDepth,
      solidAngle: state.solidAngle,
      solidForeshorten: state.solidForeshorten,
      solidTaper: state.solidTaper,
      solidApex: state.solidApex,
      fill: state.fillShapes,
      fillColor: state.fillColor,
      fillTransparent: state.fillTransparent,
      fillOpacity: state.fillOpacity,
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
      // El guion se fija POR PIEZA, con la misma fórmula del renderer. Antes
      // se heredaba el que hubiera puesto paintOverlay, y eso convertía en
      // mentira la previsualización de cualquier herramienta cuyas piezas
      // lleven `dash` propio (los sólidos 3D, mitad de cuyas aristas son
      // ocultas): salían TODAS discontinuas y al soltar sólo la mitad. Las dos
      // ramas son obligatorias — con sólo la de `true`, el guion se filtraría
      // a la pieza siguiente.
      octx.setLineDash(el.dash ? [4 * el.lineWidth, 4 * el.lineWidth] : []);
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
      } else {
        // Todo lo demás —texto y las formas 2D, que son la cara frontal de un
        // sólido— se delega en el renderer de verdad: reimplementar aquí la
        // fuente y el interlineado, o los vértices de una estrella y su
        // relleno, sería una segunda copia destinada a divergir.
        //
        // Con un seed fijo si la pieza no lo trae: los generadores no lo ponen
        // (lo añade withSeeds al soltar), y sin él Sketchy cae en Math.random
        // y el temblor HIERVE, re-sorteándose en cada fotograma del arrastre.
        Renderer.renderElement(octx, Number.isFinite(el.seed) ? el : { ...el, seed: 0 });
      }
    });
    octx.restore();
  }

  function paintOverlay() {
    octx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Guías de alineación (v2.38.0): overlay puro, como el marco del
    // aerógrafo o la cota de ángulo de los caminos — se limpian cada
    // fotograma, no son elementos y no entran en undo, autosave ni export.
    // Cruzan el lienzo entero: la guía dice «alineado con ESTA ordenada»,
    // no con qué trozo de qué elemento.
    if (state.alignGuideLines) {
      octx.save();
      octx.strokeStyle = 'rgba(255, 107, 107, 0.9)';
      octx.lineWidth = 1;
      octx.setLineDash([6, 4]);
      state.alignGuideLines.forEach(g => {
        octx.beginPath();
        if (g.axis === 'x') {
          octx.moveTo(g.pos + 0.5, 0); octx.lineTo(g.pos + 0.5, CANVAS_H);
        } else {
          octx.moveTo(0, g.pos + 0.5); octx.lineTo(CANVAS_W, g.pos + 0.5);
        }
        octx.stroke();
      });
      octx.restore();
    }

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

    // Aerógrafo. El marco del área se dibuja aunque no se esté pintando: es lo
    // que enseña dónde va a caer la pintura, y sin él el recorte parecería una
    // avería. Vive SOLO en el overlay —que se limpia entero cada fotograma—,
    // así que no es un elemento: no cuenta en «Elementos», no entra en el undo,
    // ni en el autoguardado, ni en ninguna de las cinco exportaciones. Mismo
    // criterio que la cota de ángulo de los caminos (drawPathAngle).
    if (state.tool === TOOLS.AIRBRUSH) {
      const marco = state.airbrushDrag === 'area' && state.isDrawing && lastPos && state.startPos
        ? { x: Math.min(state.startPos.x, lastPos.x), y: Math.min(state.startPos.y, lastPos.y),
            w: Math.abs(lastPos.x - state.startPos.x), h: Math.abs(lastPos.y - state.startPos.y) }
        : (state.airbrushAreaMode === 'area' ? state.airbrushArea : null);
      if (marco) {
        octx.save();
        octx.setLineDash([6, 4]);
        octx.lineWidth = 1.5;
        octx.strokeStyle = '#4ecdc4';
        octx.strokeRect(marco.x, marco.y, marco.w, marco.h);
        octx.restore();
      }
      // Nube en vivo: la de verdad, con el mismo Renderer que la dibujará al
      // soltar, para que la previsualización no pueda prometer otra cosa.
      if (state.airbrushDrag === 'spray' && state.isDrawing && state.currentPath.length) {
        Renderer.renderElement(octx, airbrushElement(state.currentPath, state.airbrushSeed));
      }
      // Boquilla: el círculo va SIEMPRE, en reposo y durante el gesto, y por
      // encima de la nube. Sustituye al cursor del sistema (el lienzo lleva
      // `cursor: none` con esta herramienta) y su radio es el de la mancha, así
      // que lo que rodea es exactamente la superficie que se va a pintar: los
      // centros de las gotas se acotan a `radius - grano` para que la tinta
      // acabe justo en esta línea (ver airbrush.js). Mientras se marca el área
      // no se dibuja: ahí el gesto es el rectángulo, no un soplo.
      if (lastPos && state.airbrushDrag !== 'area') {
        octx.save();
        octx.beginPath();
        octx.arc(lastPos.x, lastPos.y, state.airbrushRadius, 0, Math.PI * 2);
        octx.strokeStyle = 'rgba(255,255,255,0.95)';
        octx.lineWidth = 3;
        octx.stroke();
        octx.strokeStyle = 'rgba(26,26,46,0.95)';
        octx.lineWidth = 1;
        octx.stroke();
        octx.restore();
      }
      return;
    }

    if (!state.isDrawing || !lastPos) return;
    const pos = lastPos;

    // Freehand preview. El borrador se pinta directamente en redrawNow para
    // mostrar el borrado real en vivo; el overlay queda solo para el lápiz.
    if (state.tool === TOOLS.PENCIL) {
      if (!state.currentPath.length) return;
      // Con presión simulada, la previsualización rellena el MISMO contorno
      // que quedará al soltar: una polilínea aquí prometería otro trazo.
      if (state.strokeTaper) {
        const poly = Freehand.outline(state.currentPath, state.lineWidth);
        if (poly.length > 2) {
          octx.fillStyle = state.color;
          octx.beginPath();
          octx.moveTo(poly[0].x, poly[0].y);
          for (let i = 1; i < poly.length; i++) octx.lineTo(poly[i].x, poly[i].y);
          octx.closePath();
          octx.fill();
        }
        return;
      }
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
        // El giro elegido entra también en la previsualización: si no, el
        // arrastre enseñaría una forma y al soltar saldría otra.
        const vertices = Trapezoid.vertices({ x, y, w, h, rotation: creationRotation() });
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
      case TOOLS.HEXAGON:
      case TOOLS.STAR5:
      case TOOLS.STAR6: {
        const box = RegularPolygon.fromCenter(state.startPos, pos);
        const vertices = RegularPolygon.vertices(
          { type: state.tool, ...box, rotation: creationRotation() });
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
        } else if (SOLID_TOOLS.includes(state.tool)) {
          drawPiecesPreview(octx, Solid.elements(state.tool, state.startPos, pos, solidOpts()));
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
    octx.font = `bold ${ANGLE_BADGE.font}px ${sketchFont()}`;
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

    // Borrador y aerógrafo llevan su propio indicador dibujado en el overlay en
    // vez de un cursor del sistema, así que necesitan seguir al puntero también
    // en reposo: sin esto el círculo se quedaría clavado donde acabó el último
    // trazo.
    if (state.tool === TOOLS.ERASER || state.tool === TOOLS.AIRBRUSH) {
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
        // Frenado en el borde: lanzar algo fuera del lienzo lo perdía. El
        // puntero sigue libre (dragLast guarda su posición REAL, no la
        // recortada), así que en cuanto vuelve hacia dentro el objeto lo
        // acompaña, sin zona muerta que recorrer.
        const d = alignAdjust(dx, dy, e.altKey);
        moveSelectionBy(d.dx, d.dy);
        state.dragLast = pos;
        state.didDrag = true;
        redraw();
        // Las guías viven en el overlay y se limpian con él cada fotograma.
        scheduleOverlay();
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
    if (state.tool === TOOLS.PENCIL || state.tool === TOOLS.ERASER ||
        (state.tool === TOOLS.AIRBRUSH && state.airbrushDrag === 'spray')) {
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
      const down = state.pickDown;
      state.marquee = null;
      state.pickDown = null;
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
      } else if (down) {
        // Clic sin arrastre con «Select»: la misma semántica de clic que
        // Mover — el grupo completo, Alt aísla la pieza, y con «Los clics
        // acumulan selección» el clic añade, o retira si ya estaba — pero
        // sin arrancar nunca un arrastre de movimiento. Con Mover este caso
        // no llega aquí: su clic se resuelve en onMouseDown y su marquee
        // solo nace en el vacío, con la selección ya vaciada.
        if (down.idx >= 0) {
          const grp = down.alt ? [down.idx] : groupIndicesOf(down.idx);
          if (down.alt) setSelection([down.idx]);
          else if (!state.selection.includes(down.idx)) {
            setSelection(state.multiSelect ? [...state.selection, ...grp] : grp);
          } else if (state.multiSelect) {
            setSelection(state.selection.filter(i => !grp.includes(i)));
          }
        } else {
          setSelection([]);
        }
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
        // sus distancias relativas. Si el imán de alineación acaba de pegar
        // la selección a otro elemento, GANA la guía (es más específica que
        // la cuadrícula) — pero solo EN SU EJE: el otro sigue libre y la
        // rejilla aún tiene que atenderlo, o quedaría sin imán y sin snap.
        if (state.snapGrid && !e.altKey) {
          const al = state.alignSession;
          const b = getElementBounds(state.elements[state.selection[0]]);
          const dx = (al && al.snappedX) ? 0 : snapVal(b.x) - b.x;
          const dy = (al && al.snappedY) ? 0 : snapVal(b.y) - b.y;
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
      // El imán muere con el gesto: sesión y guías fuera, y un repintado del
      // overlay para que la guía no quede colgada tras soltar.
      state.alignSession = null;
      state.alignGuideLines = null;
      scheduleOverlay();
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
      eraserSession = null;   // la sesión de la previsualización muere con la pasada
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
      const pencil = {
        type: state.tool,
        points: state.currentPath,
        color: state.color,
        lineWidth: state.lineWidth,
        seed: newSeed(),
      };
      // Presión simulada: solo se estampa en `true` — la ausencia es el
      // lápiz clásico y lo que serializa un proyecto de siempre.
      if (state.strokeTaper) pencil.taper = true;
      state.elements.push(pencil);
      state.currentPath = [];
      redraw();
      return;
    }

    if (state.tool === TOOLS.AIRBRUSH) {
      const modo = state.airbrushDrag;
      state.airbrushDrag = null;
      if (modo === 'area') {
        const rect = {
          x: Math.min(state.startPos.x, pos.x), y: Math.min(state.startPos.y, pos.y),
          w: Math.abs(pos.x - state.startPos.x), h: Math.abs(pos.y - state.startPos.y),
        };
        // Un clic torpe no puede perder el modo ni, peor, pintar una mancha que
        // nadie pidió: por debajo del mínimo sigue armado, esperando el gesto.
        if (rect.w >= Airbrush.MIN_AREA && rect.h >= Airbrush.MIN_AREA) {
          state.airbrushArea = clampAreaToCanvas(rect);
          state.airbrushAreaPending = false;
          savePrefs();   // el área es un ajuste de herramienta, como eraserSize:
          syncAirbrushControls();  // no entra en el undo ni en el documento
        }
        state.startPos = null;
        redraw();
        scheduleOverlay();
        return;
      }
      state.currentPath.push(pos);
      const el = airbrushElement(state.currentPath, state.airbrushSeed);
      state.currentPath = [];
      state.startPos = null;
      // Una mancha cuyas gotas caen todas fuera del área sería un elemento
      // invisible que cuenta en «Elementos» y viaja en el JSON: no se crea.
      if (!Airbrush.isEmpty(el)) {
        saveUndo();
        state.elements.push(el);
      }
      redraw();
      scheduleOverlay();
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
        // El giro solo se escribe si lo hay: su ausencia es el formato
        // histórico, y en rect/redondeado isValidElement lo rechaza.
        const rotation = creationRotation();
        if (rotation) shape.rotation = rotation;
        state.elements.push(shape);
      }
    }
    // UI components
    else if (UI_DEFAULTS[state.tool]) {
      const defs = UI_DEFAULTS[state.tool];
      saveUndo();
      const el = {
        type: state.tool,
        x, y,
        w: w > 20 ? w : defs.w,
        h: h > 20 ? h : defs.h,
        color: state.color, lineWidth: state.lineWidth,
        seed: newSeed(),
      };
      // Rótulo de creación elegido en #modal-ui; vacío = default del renderer
      // (Imagen no está en uiLabels: su renderer no recibe rótulo).
      const label = (state.uiLabels[state.tool] || '').trim();
      if (label) el.label = label;
      state.elements.push(el);
    }
    // Edificios — herramientas de creación: 1..N elementos de tipos ya
    // existentes (rect/line, ver js/building.js). Un solo undo por gesto.
    else if (BUILDING_TOOLS.includes(state.tool) || GARDEN_TOOLS.includes(state.tool) ||
             SOLID_TOOLS.includes(state.tool)) {
      const created = withSeeds(GARDEN_TOOLS.includes(state.tool)
        ? Garden.elements(state.tool, p1, p2, gardenOpts())
        : SOLID_TOOLS.includes(state.tool)
          ? Solid.elements(state.tool, p1, p2, solidOpts())
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
          if (GARDEN_TOOLS.includes(state.tool)) applyGardenMeta(created, state.tool, p1, p2, gid);
          if (SOLID_TOOLS.includes(state.tool)) applySolidMeta(created, state.tool, p1, p2);
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
      ...textStyleDefaults(),
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
    // Tamaño propio del emoji (deslizador de su catálogo), no el de letra:
    // hasta la 2.10.0 heredaba max(fontSize, 32) y no había forma de agrandar
    // un emoji sin cambiar también el tamaño del próximo texto.
    const fontSize = Math.max(state.emojiSize, EMOJI_MIN_SIZE);
    // El render de `text` ancla en la esquina superior izquierda; se descuenta
    // media caja para que el emoji quede centrado en el punto pulsado
    ctx.save();
    ctx.font = `${fontSize}px ${sketchFont()}`;
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
    // «Select» comparte el descenso a pieza (más abajo), pero no los editores
    // ni el reset de curvatura: es una herramienta de solo selección y un
    // doble clic no debe modificar nada.
    const picking = state.tool === TOOLS.PICK;
    if (state.tool !== TOOLS.SELECT && !picking) return;
    const pos = getPos(e);
    // Doble click sobre un handle de curvatura: resetear la curvatura
    // (cuadrática → control por defecto; cúbica → S canónica)
    if (!picking && state.selection.length === 1) {
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
              { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, state.curveBulge * len);
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
          state.elements[state.selection[0]] = { ...sel, ...defaultCubicCtrls(sel, state.curveBulge * len) };
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
    // Con «Select», aquí se acaba: nada de abrir editores de texto.
    if (picking) return;
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
      // Queda seleccionada con Mover para arrastrarla/redimensionarla al momento.
      // En silencio: pegar una imagen no es pedir los ajustes de selección.
      selectTool(TOOLS.SELECT, { silent: true });
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
        if (state.tool !== TOOLS.SELECT) selectTool(TOOLS.SELECT, { silent: true });
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
    // «Select»: flecha normal — ni la cruz de dibujar ni el `move` de Mover,
    // porque esta herramienta ni crea ni desplaza.
    mainCanvas.classList.toggle('canvas-area__canvas--pick', state.tool === TOOLS.PICK);
    // Aerógrafo: sin cursor del sistema, porque su indicador es el círculo de la
    // boquilla que dibuja paintOverlay — igual que el borrador.
    mainCanvas.classList.toggle('canvas-area__canvas--airbrush', state.tool === TOOLS.AIRBRUSH);
    // Tinta: el cursor del bote, y el del cuentagotas mientras está armado.
    mainCanvas.classList.toggle('canvas-area__canvas--ink',
      state.tool === TOOLS.INK && !state.inkPicking);
    mainCanvas.classList.toggle('canvas-area__canvas--ink-pick', !!state.inkPicking);
    // Pan (v3.5.0): la mano abierta con el espacio pulsado, cerrada durante el
    // arrastre. Van las últimas del parcial para ganar a cualquier cursor de
    // herramienta con la misma especificidad.
    mainCanvas.classList.toggle('canvas-area__canvas--grab', spacePan && !panDrag);
    mainCanvas.classList.toggle('canvas-area__canvas--grabbing', !!panDrag);
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
    // Muro: mismo arrastre nulo que Balcón —la caja la pone byVariant (aquí,
    // por wallSizeKey)—. Material/altura/verja/puerta son ejes ortogonales a
    // la vista (no caben en este catálogo de 2 entradas): viven como ajustes
    // propios de #modal-wall, sincronizados por syncWallControls() al abrir.
    { tool: TOOLS.BUILD_WALL, modal: 'modal-wall', root: 'wall-catalog', cls: 'modal__wall', data: 'wall', catalog: WALL_VIEWS, key: 'wallView', gen: () => Building, opts: () => buildOpts(), box: { x: 0, y: 0 } },
    // Verjas: el catálogo elige planta/alzado; tipo y altura viven en los
    // controles del modal y se reflejan en la miniatura en vivo.
    { tool: TOOLS.BUILD_FENCE, modal: 'modal-fence', root: 'fence-catalog', cls: 'modal__fence', data: 'fence', catalog: FENCE_VIEWS, key: 'fenceView', gen: () => Building, opts: () => buildOpts(), box: { x: 0, y: 0 } },
    // Cancela: planta/alzado en el catálogo; modelo y cota 0–350 cm en sus
    // controles, con la misma geometría que las entradas del Muro.
    { tool: TOOLS.BUILD_GATE, modal: 'modal-gate', root: 'gate-catalog', cls: 'modal__gate', data: 'gate', catalog: GATE_VIEWS, key: 'gateView', gen: () => Building, opts: () => buildOpts(), box: { x: 0, y: 0 } },
    { tool: TOOLS.GARDEN_PLOT,   modal: 'modal-plot',   root: 'plot-catalog',   cls: 'modal__plot',   data: 'plot',   catalog: PLOT_SHAPES,   key: 'plotShape'  },
    { tool: TOOLS.GARDEN_TREE,   modal: 'modal-tree',   root: 'tree-catalog',   cls: 'modal__tree',   data: 'tree',   catalog: TREE_TYPES,    key: 'treeType', plant: true },
    { tool: TOOLS.GARDEN_SHRUB,  modal: 'modal-shrub',  root: 'shrub-catalog',  cls: 'modal__shrub',  data: 'shrub',  catalog: SHRUB_TYPES,   key: 'shrubType', plant: true },
    { tool: TOOLS.GARDEN_FLOWER, modal: 'modal-flower', root: 'flower-catalog', cls: 'modal__flower', data: 'flower', catalog: FLOWER_TYPES,  key: 'flowerType', plant: true },
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
    { tool: TOOLS.GARDEN_HERB,   modal: 'modal-herb',   root: 'herb-catalog',   cls: 'modal__herb',   data: 'herb',   catalog: HERB_TYPES,    key: 'herbType', plant: true },
    { tool: TOOLS.GARDEN_CLIMBER,modal: 'modal-climber',root: 'climber-catalog',cls: 'modal__climber',data: 'climber',catalog: CLIMBER_TYPES, key: 'climberType', plant: true },
    // 3D. Las tres comparten `solidSection`: elegir pentágono en Prisma lo deja
    // elegido en Pirámide, que es lo que uno espera de un mismo eje. Cambian
    // sólo de catálogo, porque el NOMBRE de cada sección depende del remate
    // («Cubo» / «Pirámide cuadrangular» / «Tronco cuadrangular»).
    // La caja del icono tiene que ser GRANDE aunque el icono mida 56 px: los
    // polígonos regulares la leen como arrastre desde el centro, y sobre todo
    // el redondeado lleva un radio de esquina fijo de 12 px, así que con una
    // cara de 30 px salía redondo entero y su icono era indistinguible del
    // cilindro. Encajar por bounds reales devuelve el tamaño después.
    // La Esfera no está: no tiene sección que elegir, así que su modal es sólo
    // de ajustes (como el del Borrador).
    { tool: TOOLS.SOLID_PRISM,   modal: 'modal-prism',   root: 'prism-catalog',   cls: 'modal__prism',   data: 'prism',   catalog: PRISM_SECTIONS,   key: 'solidSection', gen: () => Solid, opts: () => solidOpts(), box: { x: 96, y: 76 } },
    { tool: TOOLS.SOLID_PYRAMID, modal: 'modal-pyramid', root: 'pyramid-catalog', cls: 'modal__pyramid', data: 'pyramid', catalog: PYRAMID_SECTIONS, key: 'solidSection', gen: () => Solid, opts: () => solidOpts(), box: { x: 96, y: 76 } },
    { tool: TOOLS.SOLID_FRUSTUM, modal: 'modal-frustum', root: 'frustum-catalog', cls: 'modal__frustum', data: 'frustum', catalog: FRUSTUM_SECTIONS, key: 'solidSection', gen: () => Solid, opts: () => solidOpts(), box: { x: 96, y: 76 } },
  ].map(cfg => ({ gen: () => Garden, opts: () => gardenOpts(), box: { x: 100, y: 84 }, ...cfg }));
  const variantModalOf = tool => VARIANT_MODALS.find(m => m.tool === tool);

  /** Entradas de jardín de la tabla, para derivar de ella las casillas
      «Etiquetas» de cada modal y que la lista no se quede corta al añadir una
      herramienta nueva. */
  const GARDEN_MODALS = VARIANT_MODALS.filter(m => GARDEN_TOOLS.includes(m.tool));
  /** Casillas de «Etiquetas» escritas en index.html: la del panel y las de los
      tres modales del jardín sin ficha botánica (parcela, decoración y camino).
      Las cinco botánicas las crea installPlantControls y NO se buscan por id,
      sino por referencia en `cfg.plantControls` —igual que el resto de sus
      controles—: un id asignado en runtime no entra en el índice del arnés de
      tests, así que la búsqueda devolvería un nodo distinto del real. */
  const GARDEN_LABEL_CHECKS = ['check-garden-labels',
    ...GARDEN_MODALS.filter(m => !m.plant).map(m => `${m.data}-garden-labels`)];

  /** Punto ÚNICO de sincronía de «Etiquetas»: un solo ajuste, nueve mandos.
      Mismo contrato que syncPathControls(). Con las etiquetas apagadas el
      selector de modo no rotula nada, así que se deshabilita. */
  function syncGardenLabelControls() {
    GARDEN_LABEL_CHECKS.forEach(id => {
      const box = $(id);
      if (box) box.checked = state.gardenLabels;
    });
    GARDEN_MODALS.forEach(m => {
      const c = m.plantControls;
      if (!c) return;
      c.labels.checked = state.gardenLabels;
      c.labelMode.disabled = !state.gardenLabels;
    });
  }

  /** Ficha compacta y serializable con la intención de diseño del ejemplar.
      Se repite en cada pieza para que sobreviva a copiar, mover y exportar. */
  function gardenGroupMeta(tool, p1, p2, style = {}) {
    const cfg = variantModalOf(tool);
    if (!cfg || !cfg.plant) return null;
    return {
      version: 1,
      tool,
      variant: state[cfg.key],
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
      color: style.color || state.color,
      lineWidth: style.lineWidth || state.lineWidth,
      plantView: state.plantView,
      plantStage: state.plantStage,
      plantScalePct: state.plantScalePct,
      plantPxPerM: state.plantPxPerM,
      plantColorMode: state.plantColorMode,
      gardenLabelMode: state.gardenLabelMode,
      labels: state.gardenLabels,
    };
  }

  function applyGardenMeta(created, tool, p1, p2, gid, style) {
    const meta = gardenGroupMeta(tool, p1, p2, style);
    if (!meta) return;
    for (const el of created) {
      el.buildingGroupId = gid;
      el.gardenMeta = { ...meta, p1: { ...meta.p1 }, p2: { ...meta.p2 } };
    }
  }

  /** Sustituye el grupo vegetal conservando su posición y orden de apilado. */
  function regenerateGardenGroup(cfg) {
    const gid = state.editGardenGroupId;
    if (!gid || !cfg.plant) return false;
    const indices = [];
    state.elements.forEach((el, i) => { if (el.buildingGroupId === gid) indices.push(i); });
    const old = indices.length && state.elements[indices[0]];
    if (!old || !old.gardenMeta) { state.editGardenGroupId = null; return false; }
    const { p1, p2, color, lineWidth } = old.gardenMeta;
    const style = { color, lineWidth };
    const created = withSeeds(Garden.elements(cfg.tool, p1, p2, { ...gardenOpts(), ...style }));
    if (!created.length) { state.editGardenGroupId = null; return false; }
    saveUndo();
    applyGardenMeta(created, cfg.tool, p1, p2, gid, style);
    const first = indices[0];
    state.elements = state.elements.filter(el => el.buildingGroupId !== gid);
    state.elements.splice(first, 0, ...created);
    setSelection(Array.from({ length: created.length }, (_, i) => first + i));
    state.editGardenGroupId = null;
    redraw();
    return true;
  }

  function editSelectedGarden() {
    const selected = selectedGardenGroup();
    if (!selected) return;
    const { meta } = selected;
    const cfg = variantModalOf(meta.tool);
    if (!cfg || !cfg.plant || !cfg.catalog.some(item => item.id === meta.variant)) return;
    state[cfg.key] = meta.variant;
    state.plantView = meta.plantView;
    state.plantStage = meta.plantStage;
    state.plantScalePct = meta.plantScalePct;
    state.plantPxPerM = meta.plantPxPerM;
    state.plantColorMode = meta.plantColorMode;
    state.gardenLabelMode = meta.gardenLabelMode;
    state.gardenLabels = meta.labels;
    state.editGardenGroupId = selected.gid;
    selectTool(meta.tool);
  }
  /** true si elegir esta herramienta abre un catálogo de variante — es decir,
      si hay que ELEGIR algo antes de poder dibujar, y por tanto cancelar debe
      devolver a la herramienta anterior (ver wireBuildModalCancel). */
  const opensVariantModal = tool =>
    MODAL_BUILD_TOOLS.includes(tool) || VARIANT_MODALS.some(m => m.tool === tool);


  /**
   * @param {string} id
   * @param {{silent?: boolean}} [opts] `silent` elige la herramienta sin abrir
   *   sus ajustes. Lo usa el retorno tras cancelar un catálogo: volver a la
   *   herramienta anterior no debe encadenar un segundo modal encima del que
   *   se acaba de cerrar, pero tampoco es motivo para tirar al usuario a Mover.
   */
  function selectTool(id, opts) {
    const silent = !!(opts && opts.silent);
    if (id !== state.tool && state.curveChain) cancelCurveChain();
    // Al abrir un modal de Edificios, recuerda a dónde volver si se cancela: la
    // herramienta previa (si venimos de otra) o esta misma (reentrada para cambiar
    // variante). El flag variantChosen distingue elegir-variante de cancelar.
    if (opensVariantModal(id)) {
      state.toolBeforeModal = id === state.tool ? id : state.tool;
      state.variantChosen = false;
    }
    // Pulsar la herramienta de un elemento seleccionado lo EDITA en vez de
    // deseleccionarlo: si la selección contiene al menos un elemento del tipo
    // que el modal de ajustes de esta herramienta sabe editar (MODAL_EDIT_TYPE,
    // por tipo exacto), se conserva, y el modal abre mostrando sus valores —
    // la semántica dual de los controles hace el resto, posición incluida.
    // Empezar a crear en el lienzo la suelta (onMouseDown). Los catálogos, el
    // Borrador y Emoji siguen vaciando como siempre: no editan elementos.
    // Mover y «Select» tampoco vacían nunca (SELECTION_TOOLS): son las dos
    // herramientas que trabajan SOBRE la selección, así que pasar de una a
    // otra —enmarcar con «Select» y mover con Mover— la conserva entera.
    // Las de 3D no tienen un tipo exacto que editar —un sólido son líneas, caras
    // y una forma—, así que su condición es otra: que la selección SEA una
    // figura 3D completa. Sin esto, pulsar Prisma con un sólido puesto lo
    // deseleccionaba y su modal pasaba a configurar el siguiente, de modo que
    // el color y el grosor de las aristas no llegaban nunca a la figura que se
    // tenía delante.
    const editType = MODAL_EDIT_TYPE[id];
    // La Tinta conserva la selección si hay algo rellenable en ella: su botón
    // «Pintar lo seleccionado» no tendría sentido si elegir la herramienta
    // vaciara justo lo que va a pintar. Es la misma idea que MODAL_EDIT_TYPE
    // («pulsar la herramienta de lo seleccionado lo edita»), pero la Tinta no
    // edita UN tipo exacto sino cualquiera que admita relleno.
    const keepSelection = (id === TOOLS.INK &&
      state.selection.some(i => FILLABLE_TYPES.includes((state.elements[i] || {}).type))) ||
      SELECTION_TOOLS.includes(id) ||
      (SOLID_TOOLS.includes(id) && !!selectedSolid()) ||
      (!!editType &&
      state.selection.some(i => (state.elements[i] || {}).type === editType));
    // El armado del área pertenece al gesto del aerógrafo: irse a otra
    // herramienta lo cancela, o el siguiente arrastre con el lápiz encontraría
    // un lienzo que se comporta raro sin nada que lo explique.
    if (id !== TOOLS.AIRBRUSH) state.airbrushAreaPending = false;
    state.tool = id;
    if (!keepSelection) setSelection([]);
    updateToolbarActive();
    updateCursor();
    redraw();
    // Repintar el overlay: al cambiar de herramienta por teclado sin mover el
    // ratón, el círculo indicador del borrador quedaba fantasma (pointerleave
    // solo limpia si la herramienta sigue siendo el borrador).
    scheduleOverlay();
    // Elegir la herramienta Emoji abre el catálogo; tras escoger uno, cada
    // click en el lienzo lo estampa (volver a pulsarla permite cambiarlo).
    // También honra `silent`: el retorno tras cancelar un catálogo de
    // Edificios/Jardín volvía a Emoji REABRIENDO este modal encima del que se
    // acababa de cerrar — justo la cadena que silent existe para evitar
    // (auditoría v2.10.1).
    if (id === TOOLS.EMOJI && !silent) openEmojiModal();
    // Borrador abre su modal de tamaño, igual que Emoji o Planta abren el
    // suyo: si no, el único acceso es el botón ⚙ del panel, lejos del
    // sidebar y fácil de no ver. A diferencia de esos, cerrarlo NO debe
    // devolver a la herramienta anterior (el borrador es usable sin elegir
    // nada en el modal), así que no pasa por opensVariantModal.
    if (id === TOOLS.ERASER && !silent) openEraserSizeModal();
    // Las dos herramientas de Edición abren los ajustes de selección: la
    // casilla gobierna el clic de ambas, así que ambas la enseñan al elegirlas
    // (v2.18.0; la 2.17.0 la reservó a «Select» y dejaba a Mover dependiendo
    // del ⚙). Es la razón por la que las cuatro activaciones AUTOMÁTICAS de
    // Mover —pegar una imagen, pegar elementos, Ctrl+A y volver de un catálogo
    // cancelado— pasan `silent`: ahí nadie ha pulsado la herramienta, y un
    // <dialog showModal> dejaría inerte el lienzo justo después de pegar o de
    // seleccionarlo todo. El del catálogo, además, encadenaría un modal encima
    // del que se acaba de cerrar.
    if (SELECTION_TOOLS.includes(id) && !silent) openSelectModal();
    // Las herramientas de dibujo abren sus ajustes de trazo al elegirlas, igual
    // que el Borrador abre el suyo y Planta o Balcón su catálogo: es la misma
    // promesa para todas las herramientas que tienen algo que ajustar. Volver a
    // pulsar la herramienta ya activa lo reabre (esta misma línea), y el ⚙ de
    // la cabecera «Trazo» lo hace sin cambiar de herramienta. Como el Borrador,
    // cerrarlo NO devuelve a la herramienta anterior: no hay nada que elegir,
    // el trazo ya es usable, así que tampoco pasa por opensVariantModal.
    if (STROKE_TOOLS.includes(id) && !silent) openStrokeModal();
    // Las diez de Formas, lo mismo, con trazo y relleno en el mismo sitio.
    if (SHAPE_TOOLS.includes(id) && !silent) openShapeModal();
    // El aerógrafo, igual: es la herramienta con más ajustes del grupo Dibujo y
    // ninguno de ellos vive en el panel, así que el modal es la única forma de
    // verlos. Si el modo es «área» y todavía no hay ninguna, se arma aquí: la
    // herramienta no puede pintar hasta que exista.
    if (id === TOOLS.AIRBRUSH) {
      if (state.airbrushAreaMode === 'area' && !state.airbrushArea) {
        state.airbrushAreaPending = true;
      }
      if (!silent) openAirbrushModal();
    }
    // Texto y los cinco componentes de UI, lo mismo: sus ajustes se abren al
    // elegirlos y el ⚙ los reabre. Tampoco pasan por opensVariantModal.
    if (id === TOOLS.INK && !silent) openInkModal();
    if (id !== TOOLS.INK) state.inkPicking = false;
    if (id === TOOLS.TEXT && !silent) openTextModal();
    if (UI_MODAL_TOOLS.includes(id) && !silent) openUiModal();
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
    // Catálogos genéricos (Balcón y los ocho del Jardín): se reconstruyen al
    // abrir porque sus iconos se pintan con la geometría real, y esa depende
    // del color y el trazo activos.
    const variant = variantModalOf(id);
    if (variant) {
      buildVariantCatalog(variant);
      if (variant.plant) syncPlantControls(variant);
      // Camino lleva ajustes propios además del catálogo: hay que repartirlos a
      // los dos juegos de controles y repintar la miniatura antes de enseñarlo,
      // igual que hace Fachada con syncBuildControls().
      if (id === TOOLS.GARDEN_PATH) syncPathControls();
      // «Etiquetas» está en los ocho modales del jardín: hay que repartirla
      // antes de enseñar cualquiera de ellos, incluidos los no botánicos
      // (parcela, decoración y camino), que no pasan por syncPlantControls.
      if (GARDEN_TOOLS.includes(id)) syncGardenLabelControls();
      // Muro también lleva ajustes propios (material/altura/verja/puerta)
      // fuera del catálogo genérico, mismo motivo que Camino.
      if (id === TOOLS.BUILD_WALL) syncWallControls();
      if (id === TOOLS.BUILD_FENCE) syncFenceControls();
      if (id === TOOLS.BUILD_GATE) syncGateControls();
      // Prisma, Pirámide y Tronco llevan sus deslizadores de proyección además
      // del catálogo, mismo motivo que Camino y Muro.
      if (SOLID_TOOLS.includes(id)) syncSolidControls();
      $(variant.modal).showModal();
    }
    // La Esfera no tiene sección que elegir, así que su modal es sólo de
    // ajustes: se abre como el del Borrador —al pulsar la herramienta— y no
    // está en opensVariantModal, porque cerrarlo no cancela nada; la esfera
    // ya se puede dibujar con los ajustes que tenga.
    if (id === TOOLS.SOLID_SPHERE) { syncSolidControls(); $('modal-sphere').showModal(); }
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

  /**
   * Orden Z (v2.39.0, la idea de Excalidraw): recoloca la selección dentro
   * de state.elements — el orden del array ES el apilado, así que renderer,
   * exportadores, «Bordes ocultos» y la Tinta no necesitan ni una línea.
   * Cuatro direcciones: 'front'/'back' (a los extremos) y 'up'/'down' (un
   * paso). Tres reglas:
   *
   *  · La selección conserva SIEMPRE su orden relativo: un edificio es un
   *    bloque y debe seguir siéndolo — extraer y reinsertar, nunca ordenar.
   *  · 'up'/'down' mueven el bloque UN vecino no seleccionado, con barridos
   *    de intercambio: el bloque entero salta ese vecino de una vez.
   *  · Si nada cambia (ya está en el extremo), no se apila undo fantasma —
   *    la misma regla que el no-op de applyGeometry.
   */
  function reorderSelection(dir) {
    if (!state.selection.length ||
        state.selection.length >= state.elements.length) return;
    const sel = new Set(state.selection);
    const marked = state.elements.map((el, i) => ({ el, s: sel.has(i) }));
    if (dir === 'front' || dir === 'back') {
      const picked = marked.filter(m => m.s), rest = marked.filter(m => !m.s);
      marked.length = 0;
      marked.push(...(dir === 'front' ? rest.concat(picked) : picked.concat(rest)));
    } else if (dir === 'up') {
      for (let i = marked.length - 2; i >= 0; i--) {
        if (marked[i].s && !marked[i + 1].s) {
          const t = marked[i]; marked[i] = marked[i + 1]; marked[i + 1] = t;
        }
      }
    } else {
      for (let i = 1; i < marked.length; i++) {
        if (marked[i].s && !marked[i - 1].s) {
          const t = marked[i]; marked[i] = marked[i - 1]; marked[i - 1] = t;
        }
      }
    }
    const next = marked.map(m => m.el);
    if (next.every((el, i) => el === state.elements[i])) return;
    saveUndo();
    state.elements = next;
    // Los índices han cambiado pero los OBJETOS no (elementos inmutables):
    // la selección se recompone buscándolos por referencia.
    const sel2 = [];
    marked.forEach((m, i) => { if (m.s) sel2.push(i); });
    setSelection(sel2);
    redraw();
  }

  /**
   * Gira la selección. Dos regímenes, y la diferencia importa:
   *
   *  · si TODO lo seleccionado sabe girar sobre sí mismo (`ShapeRotation`),
   *    cada elemento gira su paso alrededor de su propio centro — es el
   *    comportamiento de siempre, el de girar un pentágono suelto;
   *  · si hay algo que no (líneas, curvas, texto, caras rellenas… es decir,
   *    cualquier figura compuesta: un sólido 3D, un edificio, un árbol), se
   *    gira el CONJUNTO un cuarto de vuelta alrededor de su centro común.
   *    Antes ahí no pasaba nada útil: las formas giraban cada una por su lado
   *    y las líneas se quedaban quietas, deshaciendo el dibujo.
   *
   * El cuarto de vuelta no es una elección estética: es el único ángulo que
   * TODOS los tipos saben representar. Una caja no guarda ángulo —girarla es
   * intercambiar ancho y alto— y un ángulo libre no cabría en su esquema.
   */
  function rotateSelection(dir = 1) {
    if (!state.selection.length) return;
    const todoGirable = state.selection
      .every(i => ShapeRotation.isType(state.elements[i].type));
    if (todoGirable) {
      saveUndo();
      state.selection.forEach(i => {
        state.elements[i] = ShapeRotation.rotateElement(state.elements[i], dir);
      });
      redraw();
      return;
    }
    const box = selectionBounds();
    if (!box) return;
    saveUndo();
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    state.selection.forEach(i => {
      state.elements[i] = rotateAround(state.elements[i], c, dir);
    });
    redraw();
  }

  /**
   * Un elemento girado un cuarto de vuelta alrededor de `c`. Devuelve una
   * copia (los elementos son inmutables) y respeta el esquema de cada tipo:
   * lo que se define por puntos gira punto a punto, y lo que se define por
   * caja gira su centro e intercambia ancho y alto, sumando el cuarto de
   * vuelta al campo `rotation` sólo en los tipos que lo admiten —ponerlo en un
   * rect o un círculo lo rechazaría `isValidElement` al reimportar.
   *
   * El texto se traslada pero no se inclina: un `text` no guarda ángulo.
   */
  function rotateAround(el, c, dir) {
    const sign = dir < 0 ? -1 : 1;
    const rot = p => ({
      x: c.x - sign * (p.y - c.y),
      y: c.y + sign * (p.x - c.x),
    });
    const m = { ...el };
    if (Array.isArray(m.points)) {
      m.points = m.points.map(rot);
    }
    if (Array.isArray(m.segments)) {
      m.segments = m.segments.map(seg => {
        const a = rot({ x: seg.x1, y: seg.y1 });
        const b = rot({ x: seg.x2, y: seg.y2 });
        const c1 = rot({ x: seg.cx, y: seg.cy });
        const out = { x1: a.x, y1: a.y, cx: c1.x, cy: c1.y, x2: b.x, y2: b.y };
        if (seg.cx2 !== undefined) {
          const c2 = rot({ x: seg.cx2, y: seg.cy2 });
          out.cx2 = c2.x; out.cy2 = c2.y;
        }
        return out;
      });
      // Los extremos de nivel superior son un espejo de la cadena: se copian de
      // ella, nunca se recalculan, o CurvePath.isValidSegments los vería
      // discrepar por un ULP y el proyecto no reimportaría.
      const first = m.segments[0], last = m.segments[m.segments.length - 1];
      m.x1 = first.x1; m.y1 = first.y1; m.x2 = last.x2; m.y2 = last.y2;
    } else if (m.x1 !== undefined) {
      const a = rot({ x: m.x1, y: m.y1 }), b = rot({ x: m.x2, y: m.y2 });
      m.x1 = a.x; m.y1 = a.y; m.x2 = b.x; m.y2 = b.y;
      if (m.cx !== undefined) { const q = rot({ x: m.cx, y: m.cy }); m.cx = q.x; m.cy = q.y; }
      if (m.cx2 !== undefined) { const q = rot({ x: m.cx2, y: m.cy2 }); m.cx2 = q.x; m.cy2 = q.y; }
    } else if (m.x !== undefined && m.w !== undefined) {
      const mid = rot({ x: m.x + m.w / 2, y: m.y + m.h / 2 });
      const w = m.h, h = m.w;                    // el cuarto de vuelta los cambia
      m.x = mid.x - w / 2; m.y = mid.y - h / 2;
      m.w = w; m.h = h;
      if (RegularPolygon.isType(m.type) || m.type === TOOLS.TRAPEZOID) {
        const next = ShapeRotation.normalize((m.rotation || 0) + sign * 90);
        if (next) m.rotation = next; else delete m.rotation;
      }
    } else if (m.x !== undefined) {
      const q = rot({ x: m.x, y: m.y });          // texto: se mueve, no se inclina
      m.x = q.x; m.y = q.y;
    }
    // El ángulo de fuga gira con la figura: sin esto, regenerarla después —al
    // rellenarla, por ejemplo— la devolvería a su orientación original.
    if (m.solidMeta) {
      if (m.solidMeta.apex === 'upright') {
        // Una figura DE PIE girada un cuarto de vuelta queda tumbada, y
        // `_upright` sólo sabe construir figuras erguidas: no existe ningún par
        // (gesto girado, fuga ajustada) que la reproduzca. Girar el gesto aquí
        // —el intento original— hacía que regenerarla la sustituyera por OTRA
        // figura, erguida y de otro tamaño (auditoría v2.30.0). El gesto y la
        // fuga se dejan quietos y se ACUMULA el giro pendiente en `turns`:
        // `regenerateSolid` reconstruye la figura erguida y le aplica esos
        // cuartos de vuelta alrededor de su centro, que un giro de 90° conserva.
        const t = ((m.solidMeta.turns || 0) + (sign > 0 ? 1 : 3)) % 4;
        m.solidMeta = { ...m.solidMeta, gesture: { ...m.solidMeta.gesture } };
        if (t) m.solidMeta.turns = t; else delete m.solidMeta.turns;
      } else {
        m.solidMeta = {
          ...m.solidMeta,
          angle: ((m.solidMeta.angle - sign * 90) % 360 + 360) % 360,
        };
      }
    }
    if (m.clip) {
      const mid = rot({ x: m.clip.x + m.clip.w / 2, y: m.clip.y + m.clip.h / 2 });
      m.clip = { x: mid.x - m.clip.h / 2, y: mid.y - m.clip.w / 2, w: m.clip.h, h: m.clip.w };
    }
    return m;
  }

  /**
   * Lo que NO se puede deducir mirando las piezas de un sólido ya dibujado: su
   * remate y su proyección. La sección, la caja y el giro salen de la CARA
   * FRONTAL, que es un elemento de verdad y viaja con la figura — por eso
   * mover, escalar o girar el sólido no invalidan estos datos y no hay que
   * actualizarlos, al contrario que los puntos de inserción de `gardenMeta`.
   *
   * La excepción es el ángulo de fuga, que sí gira con la figura: lo ajusta
   * `rotateAround`.
   */
  const SOLID_META_VERSION = 2;

  function applySolidMeta(created, tool, p1, p2) {
    const meta = {
      version: SOLID_META_VERSION, tool,
      depth: state.solidDepth, angle: state.solidAngle,
      foreshorten: state.solidForeshorten, taper: state.solidTaper,
    };
    // La pirámide de pie no tiene cara frontal —todo son aristas y caras—, así
    // que el gesto es lo ÚNICO desde lo que se puede reconstruir. Va guardado,
    // y por eso hay que llevarlo con la figura al moverla, escalarla o girarla,
    // igual que los puntos de inserción de `gardenMeta`. El resto de remates no
    // lo guardan: ahí la cara frontal ya lo dice todo y un dato repetido sólo
    // podría desincronizarse.
    if (Solid.supportsApex(tool) && state.solidApex === 'upright') {
      meta.apex = 'upright';
      meta.section = state.solidSection;
      meta.rotation = state.solidRotation;
      meta.gesture = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      // El color de relleno también viaja aquí: de pie no hay cara frontal que
      // lo conserve cuando el relleno está apagado (ver relleroDe), así que sin
      // este campo, vaciar y volver a rellenar caía al color del trazo.
      if (state.fillColor) meta.fillColor = state.fillColor;
    }
    // Una copia por pieza: los elementos son planos y compartir la referencia
    // haría que tocar una tocara todas. El gesto se clona aparte, porque el
    // spread es superficial y moverlo en una pieza lo movería en las demás.
    for (const el of created) {
      el.solidMeta = meta.gesture
        ? { ...meta, gesture: { ...meta.gesture } } : { ...meta };
    }
  }

  /** La selección, si es UNA figura 3D completa. Exige que estén TODAS sus
      piezas: regenerar con media figura seleccionada dejaría la otra media
      huérfana en el lienzo. */
  function selectedSolid() {
    const sel = state.selection;
    if (sel.length < 2) return null;
    const first = state.elements[sel[0]];
    if (!first || !first.solidMeta || !first.buildingGroupId) return null;
    const gid = first.buildingGroupId;
    if (!sel.every(i => {
      const el = state.elements[i];
      return el && el.buildingGroupId === gid && el.solidMeta;
    })) return null;
    if (state.elements.filter(el => el.buildingGroupId === gid).length !== sel.length) return null;
    const front = sel.map(i => state.elements[i]).find(el =>
      el.type !== 'line' && el.type !== 'curveArrow' && el.type !== TOOLS.POLYGON);
    // La pirámide de pie no tiene cara frontal (ver Solid._upright): ahí la
    // referencia es el gesto guardado, que es justo para lo que se guarda.
    if (!front) {
      return first.solidMeta.gesture
        ? { indices: [...sel], meta: first.solidMeta, front: null, gid } : null;
    }
    return { indices: [...sel], meta: first.solidMeta, front, gid };
  }

  /**
   * Vuelve a crear el sólido seleccionado con un ajuste cambiado, en su sitio y
   * a su tamaño. Devuelve false si la selección no es un sólido.
   *
   * Hace falta porque las CARAS laterales son elementos, y sólo se emiten si el
   * relleno está activo: un sólido dibujado en hueco no las tiene, así que
   * «cambiar el color de los lados» era imposible — no había lados que
   * colorear. Es el mismo recurso que `regenerateGardenGroup` usa para cambiar
   * de especie sin recolocar la planta.
   *
   * El arrastre equivalente se reconstruye desde la CARA FRONTAL, no desde
   * datos guardados, así que la figura conserva dónde está y cuánto mide
   * aunque la hayan movido, escalado o girado.
   */
  /** El relleno de un sólido, leído de donde de verdad está: la cara frontal
      si la hay y, si no, cualquier cara lateral (`polygon`). Una arista no
      guarda relleno, así que preguntárselo a ella diría siempre que no. */
  function relleroDe(front, info) {
    const cara = front || info.indices.map(i => state.elements[i])
      .find(el => el && el.type === TOOLS.POLYGON);
    // De pie y en hueco no queda NINGUNA pieza que guarde el color de relleno
    // (no hay cara frontal, y las laterales sólo se emiten rellenas): el color
    // elegido viaja entonces en el meta, o vaciar y volver a rellenar lo
    // perdía y caía al color del trazo (auditoría v2.30.0).
    if (!cara) {
      return info.meta.fillColor
        ? { fill: false, fillColor: info.meta.fillColor } : { fill: false };
    }
    return {
      fill: cara.fill === true,
      fillColor: cara.fillColor,
      fillTransparent: cara.fillTransparent === true,
      fillOpacity: cara.fillOpacity,
    };
  }

  function regenerateSolid(cambios) {
    const info = selectedSolid();
    if (!info) return false;
    const { front, meta } = info;
    // Sin cara frontal (pirámide de pie) el gesto y la sección salen de `meta`,
    // y el trazo y el relleno de la primera pieza: todas lo comparten.
    const muestra = front || state.elements[info.indices[0]];
    const section = front ? front.type : meta.section;
    let p1, p2;
    if (front) {
      // Los polígonos regulares nacen del CENTRO: hay que reconstruir ese gesto,
      // no la caja, o saldrían del doble de tamaño.
      const cx = front.x + front.w / 2, cy = front.y + front.h / 2;
      const desdeCentro = RegularPolygon.isType(section);
      p1 = desdeCentro ? { x: cx, y: cy } : { x: front.x, y: front.y };
      p2 = desdeCentro
        ? { x: cx + front.w / 2, y: cy }
        : { x: front.x + front.w, y: front.y + front.h };
    } else {
      p1 = { x: meta.gesture.x1, y: meta.gesture.y1 };
      p2 = { x: meta.gesture.x2, y: meta.gesture.y2 };
    }
    const o = {
      color: muestra.color, lineWidth: muestra.lineWidth,
      solidSection: section,
      solidRotation: front ? (front.rotation || 0) : (meta.rotation || 0),
      solidDepth: meta.depth, solidAngle: meta.angle,
      solidForeshorten: meta.foreshorten, solidTaper: meta.taper,
      solidApex: meta.apex || 'depth',
      // El relleno lo dice una CARA, no una arista: sin cara frontal, las
      // aristas no llevan ninguno de estos campos y rellenar leería `false`
      // de una línea y no volvería a crear las caras nunca.
      ...relleroDe(front, info),
      ...cambios,
    };
    // Regenerar conserva el giro EXACTO de la figura, sin re-cuantizar: tras un
    // cuarto de vuelta del conjunto, un pentágono está legítimamente a 90°, que
    // no es múltiplo de su paso de 36° — re-pasarlo por _rotationFor lo saltaba
    // a 108° y la figura entera se recolocaba sola (auditoría v2.30.0). Sólo si
    // el cambio pedido ES la rotación (el mando del modal) se re-cuantiza.
    if (!('solidRotation' in cambios)) o.solidRotationExact = o.solidRotation;
    let nuevos = withSeeds(Solid.elements(meta.tool, p1, p2, o));
    if (!nuevos.length) return false;
    // Los cuartos de vuelta acumulados de una figura DE PIE (ver rotateAround):
    // se reconstruye erguida desde el gesto y se le aplican aquí, alrededor de
    // su centro; después se recoloca sobre el centro de la figura en pantalla,
    // que absorbe el caso de haber girado junto a otros elementos (ahí el pivote
    // no fue el suyo).
    if (meta.turns) {
      const centroDe = els => {
        const bs = els.map(getElementBounds);
        const x1 = Math.min(...bs.map(b => b.x)), y1 = Math.min(...bs.map(b => b.y));
        const x2 = Math.max(...bs.map(b => b.x + b.w)), y2 = Math.max(...bs.map(b => b.y + b.h));
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
      };
      const actual = centroDe(info.indices.map(i => state.elements[i]));
      const c = centroDe(nuevos);
      for (let t = 0; t < meta.turns; t++) nuevos = nuevos.map(el => rotateAround(el, c, 1));
      const ahora = centroDe(nuevos);
      const dx = actual.x - ahora.x, dy = actual.y - ahora.y;
      if (dx || dy) nuevos = nuevos.map(el => moveElement(el, dx, dy));
    }
    saveUndo();
    const nuevaMeta = {
      version: SOLID_META_VERSION, tool: meta.tool,
      depth: o.solidDepth, angle: o.solidAngle,
      foreshorten: o.solidForeshorten, taper: o.solidTaper,
    };
    // El meta lo decide el modo RESULTANTE, no el de partida: cambiar a «de
    // pie» estrena gesto (la figura nueva ya no tiene cara frontal de la que
    // sacarlo) y volver al de siempre lo suelta, o quedaría un dato muerto que
    // nadie actualiza.
    if (o.solidApex === 'upright' && Solid.supportsApex(meta.tool)) {
      nuevaMeta.apex = 'upright';
      nuevaMeta.section = section;
      nuevaMeta.rotation = o.solidRotation;
      nuevaMeta.gesture = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      // Los cuartos de vuelta pendientes siguen pendientes: la figura recién
      // girada aquí tendrá que volver a girarse en la próxima regeneración.
      if (meta.turns) nuevaMeta.turns = meta.turns;
      // Y el color de relleno viaja en el meta aunque el relleno esté apagado:
      // de pie no queda ninguna cara que lo guarde (ver relleroDe).
      if (o.fillColor) nuevaMeta.fillColor = o.fillColor;
    }
    nuevos.forEach(el => {
      el.buildingGroupId = info.gid;
      el.solidMeta = nuevaMeta.gesture
        ? { ...nuevaMeta, gesture: { ...nuevaMeta.gesture } } : { ...nuevaMeta };
    });
    // Se sustituye EN SU SITIO: el sólido conserva su z-order respecto a lo
    // demás. `orden[0]` es el primer índice seleccionado, así que los elementos
    // que quedan antes de él son exactamente los que ya estaban delante.
    const orden = [...info.indices].sort((a, b) => a - b);
    const at = orden[0];
    const resto = state.elements.filter((_, i) => !info.indices.includes(i));
    state.elements = [...resto.slice(0, at), ...nuevos, ...resto.slice(at)];
    setSelection(nuevos.map((_, k) => at + k));
    redraw();
    return true;
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

  /** Las rejillas de color: la del panel y la de los ajustes del aerógrafo, que
      es la herramienta cuyo color se cambia más veces seguidas. Se pintan con
      las MISMAS muestras (`.panel__color-swatch` + `data-color`), y por eso
      `updateColorActive` —que consulta por clase, no por id— resalta el color
      activo en las dos sin saber que hay dos. */
  const COLOR_GRIDS = ['color-grid', 'airbrush-color-grid',
    'prism-color-grid', 'pyramid-color-grid', 'frustum-color-grid', 'sphere-color-grid',
    'stroke-modal-color-grid', 'shape-modal-color-grid', 'text-modal-color-grid',
    'ui-modal-color-grid'];

  /** Las paletas del RELLENO. Van aparte porque el color activo que enseñan no
      es el del trazo: sus muestras llevan `.panel__fill-swatch` y las resalta
      `updateFillColorActive`, no `updateColorActive`. */
  const FILL_COLOR_GRIDS = ['shape-modal-fill-grid', 'ink-modal-fill-grid',
    'prism-fill-grid', 'pyramid-fill-grid', 'frustum-fill-grid', 'sphere-fill-grid'];

  function buildColors() {
    COLOR_GRIDS.forEach(buildColorGrid);
    FILL_COLOR_GRIDS.forEach(buildFillColorGrid);
    updateColorActive();
    updateFillColorActive();
    buildCanvasPresets();
  }

  function buildColorGrid(gridId) {
    const grid = $(gridId);
    grid.innerHTML = '';
    COLORS.forEach(c => {
      // <button> real: accesible por teclado y anunciable con aria-pressed
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'panel__color-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.setAttribute('aria-label', `Color ${c}`);
      // Las muestras son discretas: un clic, un paso de undo (no hay gesto que
      // agrupar como en el picker nativo). Comparten la semántica dual.
      swatch.addEventListener('click', () => {
        if (state.selection.length) {
          saveUndo();
          state.selection.forEach(i => {
            state.elements[i] = { ...state.elements[i], color: c };
          });
          showColor(c);
          redraw();
        } else {
          setColor(c);
        }
      });
      grid.appendChild(swatch);
    });
  }

  /** Lo que hace un clic en una muestra de relleno. Se asigna en `wireControls`,
      que es donde viven `applyFillColor` y el commit de su gesto; el handler la
      resuelve al pulsar, así que no depende del orden de arranque. */
  let fillSwatchApply = () => {};

  function buildFillColorGrid(gridId) {
    const grid = $(gridId);
    grid.innerHTML = '';
    COLORS.forEach(c => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'panel__fill-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.setAttribute('aria-label', `Color de relleno ${c}`);
      // Un clic, un paso de undo: se delega en el mismo applyFillColor del
      // selector nativo (semántica dual incluida) y se cierra su gesto ahí
      // mismo, porque una muestra no arrastra por tonos intermedios.
      swatch.addEventListener('click', () => fillSwatchApply(c));
      grid.appendChild(swatch);
    });
  }

  /** El color de relleno que enseñan las paletas. Sin argumento cae en el
      default de creación —`state.fillColor || state.color`, que es justo lo que
      dibujaría ahora— igual que hace el selector nativo de al lado. */
  function updateFillColorActive(current) {
    const shown = hex6(current !== undefined
      ? current : (state.fillColor || state.color));
    document.querySelectorAll('.panel__fill-swatch').forEach(s => {
      const active = hex6(s.dataset.color) === shown;
      s.classList.toggle('panel__fill-swatch--active', active);
      s.setAttribute('aria-pressed', String(active));
    });
  }

  /** Refresca los mandos del color SIN tocar el default de creación. Lo usa
      redrawNow para enseñar el color del elemento seleccionado: antes el picker
      se quedaba en el último color elegido y mentía sobre lo seleccionado. */
  function showColor(c) {
    $('color-picker').value = hex6(c);
    updateColorActive(c);
  }

  function setColor(c) {
    state.color = c;
    showColor(c);
  }

  function updateColorActive(current) {
    const shown = current !== undefined ? current : state.color;
    document.querySelectorAll('.panel__color-swatch').forEach(s => {
      const active = s.dataset.color === shown;
      s.classList.toggle('panel__color-swatch--active', active);
      s.setAttribute('aria-pressed', String(active));
    });
  }

  /* ── Aspectos de lienzo ── */

  /**
   * La fila de aspectos de «Lienzo»: cada muestra fija papel, color de rejilla
   * y rejilla sí/no de una vez (ver CANVAS_PRESETS en config.js).
   *
   * La muestra DIBUJA la rejilla, no sólo el papel: «Blanco» y «Milimetrado»
   * comparten los dos colores y se diferencian únicamente por `showGrid`, así
   * que sin las líneas serían dos cuadrados blancos idénticos y la fila no se
   * podría usar. El papel y el color van en línea como custom properties; el
   * gradiente lo pone el CSS y se apaga con `--preset-grid: transparent`.
   */
  function buildCanvasPresets() {
    const grid = $('canvas-preset-grid');
    if (!grid) return;
    grid.innerHTML = '';
    CANVAS_PRESETS.forEach(p => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'panel__canvas-preset';
      swatch.dataset.preset = p.id;
      swatch.style.setProperty('--preset-bg', p.bg);
      swatch.style.setProperty('--preset-grid', p.showGrid ? p.grid : 'transparent');
      swatch.title = p.name;
      swatch.setAttribute('aria-label', `Aspecto: ${p.name}`);
      swatch.addEventListener('click', () => applyCanvasPreset(p.id));
      grid.appendChild(swatch);
    });
    updateCanvasPresetActive();
  }

  /**
   * Pone el aspecto entero. SIN saveUndo: es cosmético de pantalla, igual que
   * los dos selectores de color de al lado, que tampoco entran en el historial
   * (los aspectos no viajan en los elementos ni en ninguna exportación).
   * Tampoco toca `state.color`: un aspecto describe el papel, no la tinta.
   */
  function applyCanvasPreset(id) {
    const p = CANVAS_PRESETS.find(x => x.id === id);
    if (!p) return;
    state.canvasBg = p.bg;
    state.gridColor = p.grid;
    state.showGrid = p.showGrid;
    $('canvas-bg-picker').value = p.bg;
    $('grid-color-picker').value = p.grid;
    $('check-grid').checked = p.showGrid;
    updateCanvasPresetActive();
    savePrefs();
    redraw();
  }

  /**
   * Resalta el aspecto que coincide con los TRES campos del estado. Si el
   * usuario ha compuesto uno a mano con los pickers no coincide ninguno y no
   * se marca ninguno: la fila no debe afirmar un aspecto que no es el que se
   * está viendo. Consulta por clase, como updateColorActive.
   */
  function updateCanvasPresetActive() {
    const match = CANVAS_PRESETS.find(p =>
      hex6(p.bg) === hex6(state.canvasBg)
      && p.showGrid === state.showGrid
      // Con la rejilla apagada su color no se ve, así que no puede decidir
      // qué aspecto está puesto: «Blanco» seguiría marcado tras retocar un
      // color que no dibuja nada.
      && (!p.showGrid || hex6(p.grid) === hex6(state.gridColor)));
    document.querySelectorAll('.panel__canvas-preset').forEach(s => {
      const active = !!match && s.dataset.preset === match.id;
      s.classList.toggle('panel__canvas-preset--active', active);
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

  /** Punto único del tamaño del borrador. Tuvo dos mandos hasta la v2.21.0: el
      del modal y el del panel, que era el deslizador de «Trazo» retitulado —un
      control que cambiaba de significado según la herramienta activa, que es
      justo lo que se retiró—. Ahora solo vive en #modal-eraser. */
  function applyEraserSize(v) {
    state.eraserSize = v;
    syncEraserControls();
    scheduleOverlay();
  }

  /** Punto único de sincronía del tamaño del borrador con su modal. Estas tres
      líneas estaban copiadas en applyEraserSize y openEraserSizeModal, y por
      eso «Limpiar todo» reseteaba `state.eraserSize` pero dejaba el mando
      enseñando el tamaño anterior. Mismo refactor que syncEmojiControls. */
  function syncEraserControls() {
    $('eraser-size-modal-slider').value = String(state.eraserSize);
    $('eraser-size-modal-val').textContent = String(state.eraserSize);
    renderEraserSizePreview();
  }

  /** Abre el modal de tamaño del borrador con el valor y la previsualización
      al día. Se llama al elegir la herramienta (como Planta o Balcón abren su
      catálogo) y también desde el botón ⚙ del panel, para poder reabrirlo sin
      soltar la herramienta. */
  function openEraserSizeModal() {
    syncEraserControls();
    $('modal-eraser').showModal();
  }

  /* ── Aerógrafo ── */

  /** Recorta el área marcada al lienzo: fuera de él no se puede pintar, así
      que un área que se saliera prometería sitio que no existe. */
  function clampAreaToCanvas(r) {
    const x1 = Math.max(0, Math.min(CANVAS_W, r.x));
    const y1 = Math.max(0, Math.min(CANVAS_H, r.y));
    const x2 = Math.max(0, Math.min(CANVAS_W, r.x + r.w));
    const y2 = Math.max(0, Math.min(CANVAS_H, r.y + r.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /** Los aerógrafos de la selección: son los que editan los mandos del modal
      (semántica dual — con selección editan, sin ella fijan el default). */
  const selectedAirbrushes = () => state.selection
    .map(i => state.elements[i]).filter(el => el && el.type === 'airbrush');

  /** Muestra a tamaño real, con el trazo cruzándose a sí mismo: en translúcido
      el cruce sale más oscuro, que es justo lo que hay que poder ver antes de
      elegir la opacidad. La pinta el Renderer de verdad, así que no puede
      prometer una mancha distinta de la que saldrá. */
  function renderAirbrushPreview() {
    const cv = $('airbrush-preview');
    const pctx = cv && cv.getContext && cv.getContext('2d');
    if (!pctx) return;
    const w = cv.width, h = cv.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    // Papel del color real del lienzo: el modal es oscuro y la tinta no.
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const single = selectedAirbrushes()[0] || null;
    // La muestra usa la boquilla elegida, pero acotada a lo que cabe en la
    // miniatura: con 60 px de radio en un lienzo de 176 la mancha se saldría
    // entera y no se vería ni el grano ni la acumulación. El tope es bajo (18)
    // porque el trazo de muestra recorre cuatro tramos en muy poco sitio: con
    // bandas más anchas las ramas se solapan y el conjunto deja de leerse como
    // un trazo para parecer una nube suelta.
    const R = Math.min(single ? single.radius : state.airbrushRadius, 18);
    const pad = R + 6;
    const el = {
      type: 'airbrush',
      points: [
        { x: pad, y: h - pad }, { x: w - pad, y: pad },
        { x: w - pad, y: h - pad }, { x: pad, y: pad },
      ],
      color: single ? single.color : state.color,
      lineWidth: single ? single.lineWidth : state.airbrushGrain,
      radius: R,
      density: single ? single.density : state.airbrushDensity,
      seed: 4242,
    };
    const op = single ? single.opacity : (state.airbrushOpacity < 1 ? state.airbrushOpacity : undefined);
    if (op !== undefined) el.opacity = op;
    Renderer.renderElement(pctx, el);
  }

  /** Punto ÚNICO de sincronía del modal del aerógrafo: vuelca los ajustes en
      los mandos y repinta la muestra. Con una mancha seleccionada enseña LA
      SUYA; con varias, el valor que comparten, y si discrepan deja el mando
      como está (commonOf: no inventar un valor común). Solo escribe en sus
      propios ids — el fallo de syncStrokeControls en la v2.16.3 fue pisar los
      del panel en cada fotograma. */
  function syncAirbrushControls() {
    const sel = selectedAirbrushes();
    const put = (id, v, texto) => {
      if (v === undefined) return;
      $(id).value = String(v);
      $(id + '-val').textContent = String(texto === undefined ? v : texto);
    };
    const radio = sel.length ? commonOf(sel, el => el.radius) : state.airbrushRadius;
    // El mando enseña el DIÁMETRO (que es la anchura que se ve); el elemento
    // guarda el radio.
    if (radio !== undefined) put('airbrush-modal-radius', Math.round(radio * 2));
    const grano = sel.length ? commonOf(sel, el => el.lineWidth) : state.airbrushGrain;
    put('airbrush-modal-grain', grano);
    const densidad = sel.length ? commonOf(sel, el => el.density) : state.airbrushDensity;
    put('airbrush-modal-density', densidad);
    // Sin campo `opacity` la pintura es sólida: el mando dice 100.
    const opacidad = sel.length
      ? commonOf(sel, el => (el.opacity === undefined ? 1 : el.opacity))
      : state.airbrushOpacity;
    if (opacidad !== undefined) put('airbrush-modal-opacity', Math.round(opacidad * 100));
    const color = sel.length ? commonOf(sel, el => hex6(el.color)) : hex6(state.color);
    if (color !== undefined) $('airbrush-modal-color').value = color;

    $('airbrush-area-mode').value = state.airbrushAreaMode;
    $('airbrush-area-actions').hidden = state.airbrushAreaMode !== 'area';
    const a = state.airbrushArea;
    $('airbrush-area-status').textContent = state.airbrushAreaPending
      ? 'Arrastra en el lienzo para marcar el área'
      : a ? `Área marcada: ${Math.round(a.w)} × ${Math.round(a.h)} px`
          : 'Sin área marcada';
    $('btn-airbrush-mark').textContent = a ? 'Volver a marcar el área' : 'Marcar el área';
    $('btn-airbrush-clear-area').hidden = !a;
    renderAirbrushPreview();
  }

  /** Abre los ajustes del aerógrafo. Mismo contrato que el borrador: cerrarlo
      NO devuelve a la herramienta anterior (no hay nada que elegir, la mancha
      ya es pintable), así que no pasa por opensVariantModal. */
  function openAirbrushModal() {
    syncAirbrushControls();
    $('modal-airbrush').showModal();
  }

  /* ── Tinta: el bote de pintura ── */

  /* Canvas fuera de pantalla donde se rasteriza la escena para averiguar qué
     zona hay bajo el clic. Cacheado: crear uno por clic es caro, y
     `willReadFrequently` no es un adorno — sin él, con el canvas acelerado por
     GPU, cada getImageData puede costar 30 ms en vez de 4. */
  let inkCanvas = null;
  let inkMaskCache = null;   // { gap, els, mask }

  /** ¿Sigue siendo la misma escena? Se compara por REFERENCIA elemento a
      elemento, que basta porque los elementos son inmutables: cualquier cambio
      sustituye el objeto por una copia. Comparar así es instantáneo y no puede
      dar un falso «no ha cambiado», que serviría una máscara desfasada y
      pintaría una zona que ya no existe. */
  function inkSameScene(els) {
    if (!els || els.length !== state.elements.length) return false;
    for (let i = 0; i < els.length; i++) {
      if (els[i] !== state.elements[i]) return false;
    }
    return true;
  }

  function inkCtx() {
    if (!inkCanvas) {
      inkCanvas = document.createElement('canvas');
      inkCanvas.width = CANVAS_W;
      inkCanvas.height = CANVAS_H;
    }
    return inkCanvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * La máscara de barreras: qué píxeles del lienzo frenan la pintura. Tres
   * reglas al elegir qué se rasteriza, y cada una tapa una fuga real:
   *
   *  · Las manchas de tinta previas NO son barrera. Si lo fueran, repintar una
   *    zona daría siempre «el clic cayó sobre un trazo» y cambiarle el color
   *    sería imposible. Se reconocen por `ink: true`, no por su forma: una
   *    cara de sólido es también un `polygon` sin contorno y sí debe frenar.
   *  · El trazo discontinuo se rasteriza CONTINUO. Si no, la pintura se
   *    escaparía siempre por los huecos de la propia línea.
   *  · Se pinta con `renderElements` en modo `normal`, nunca con `renderScene`
   *    —que estampa el fondo opaco y dejaría la máscara entera en barrera— ni
   *    en `hidden-dashed`, que trocea los contornos tapados y abre fugas.
   */
  function inkBarrierMask(gap) {
    if (inkMaskCache && inkMaskCache.gap === gap && inkSameScene(inkMaskCache.els)) {
      return inkMaskCache.mask;
    }
    const c = inkCtx();
    if (!c || !c.getImageData) return null;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const barreras = state.elements
      .filter(el => el.ink !== true)
      .map(el => (el.dash ? { ...el, dash: undefined } : el));
    Renderer.renderElements(c, barreras, 'normal');
    const img = c.getImageData(0, 0, CANVAS_W, CANVAS_H);
    if (!img || !img.data) return null;
    const cruda = Flood.maskFromAlpha(img.data, CANVAS_W, CANVAS_H);
    const mask = Flood.dilate(cruda, CANVAS_W, CANVAS_H, Math.round(gap / 2));
    inkMaskCache = { gap, els: state.elements.slice(), mask };
    return mask;
  }

  /** Grosor de trazo de lo que rodea a la zona: alimenta el radio anti-fisura
      y el epsilon. El máximo LOCAL, no el de la escena, o una línea gruesa al
      otro lado del lienzo engordaría una mancha rodeada de trazos finos. */
  function inkBoundaryLineWidth(bounds) {
    const caja = {
      x: bounds.x0, y: bounds.y0,
      w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0,
    };
    let lw = 0;
    state.elements.forEach(el => {
      if (el.ink === true) return;
      const b = getElementBounds(el);
      if (!b || b.x === undefined) return;
      const m = (el.lineWidth || 2) + 4;
      if (b.x - m > caja.x + caja.w || b.x + b.w + m < caja.x) return;
      if (b.y - m > caja.y + caja.h || b.y + b.h + m < caja.y) return;
      if ((el.lineWidth || 2) > lw) lw = el.lineWidth || 2;
    });
    return lw || state.lineWidth;
  }

  /** Dónde se inserta la mancha: justo debajo del elemento más bajo al que
      toca, para que los trazos que la delimitan queden ENCIMA. Con un push al
      final los taparía, y además robaría todos los clics de su interior (el
      hit-test recorre de arriba abajo y un polígono relleno acierta dentro). */
  function inkInsertIndex(bounds) {
    for (let i = 0; i < state.elements.length; i++) {
      const el = state.elements[i];
      // Las manchas no delimitan nada —no son barrera— así que tampoco pueden
      // decidir la profundidad. Sin esta línea, un fondo ya pintado (que cubre
      // el lienzo entero) gana siempre el índice más bajo y toda mancha nueva
      // nace DEBAJO de él: en translúcido se nota a medias, y en sólido la
      // zona recién pintada desaparece del todo.
      if (el.ink === true) continue;
      const b = getElementBounds(el);
      if (!b || b.x === undefined) continue;
      const m = (el.lineWidth || 2) + 4;
      if (b.x - m > bounds.x1 || b.x + b.w + m < bounds.x0) continue;
      if (b.y - m > bounds.y1 || b.y + b.h + m < bounds.y0) continue;
      return i;
    }
    return state.elements.length;
  }

  /** El elemento que nace de un clic. `fillColor` SIEMPRE explícito: sin él,
      Renderer.fillStyle cae en el tinte del trazo al 12 %, que es
      retrocompatibilidad de las formas planas y aquí sólo haría que el modo
      sólido pintara menos que el translúcido (el fallo de la v2.25.4). */
  function inkElement(points) {
    const col = state.fillColor || state.color;
    const el = {
      type: TOOLS.POLYGON, points,
      color: col, lineWidth: state.lineWidth,
      fill: true, fillColor: col, stroke: false, ink: true,
      seed: newSeed(),
    };
    if (state.fillTransparent) {
      el.fillTransparent = true;
      if (Number.isFinite(state.fillOpacity)) el.fillOpacity = state.fillOpacity;
    }
    return el;
  }

  /** Una mancha equivalente a la recién calculada, si existe: misma caja
      (±4 px). Repintar sustituye en su sitio en vez de apilar, o tres clics
      dejarían tres polígonos superpuestos imposibles de separar.
      Se comparan las cajas de los DOS ELEMENTOS, nunca la de la región: la del
      elemento incluye la dilatación anti-fisura y la de la región no, así que
      mezclarlas las hace diferir siempre en varios píxeles y no reconoce
      ninguna gemela. */
  function inkTwinIndex(nuevo) {
    const n = getElementBounds(nuevo);
    if (!n) return -1;
    return state.elements.findIndex(el => {
      if (el.ink !== true) return false;
      const b = getElementBounds(el);
      return b && Math.abs(b.x - n.x) <= 4 && Math.abs(b.y - n.y) <= 4 &&
        Math.abs(b.w - n.w) <= 4 && Math.abs(b.h - n.h) <= 4;
    });
  }

  const INK_REASONS = {
    escaped: 'La zona no está cerrada: sube «Cerrar huecos» o cierra el trazo',
    'seed-blocked': 'Ahí no hay sitio donde pintar: prueba un poco más adentro',
    'too-small': 'La zona es demasiado pequeña',
    'too-large': 'La zona es demasiado grande',
  };

  function setInkStatus(txt) {
    const el = $('ink-status');
    if (el) el.textContent = txt;
  }

  /**
   * Un clic con la Tinta. El orden de decisión ES el contrato con quien la usa:
   * dentro de una forma se pinta la forma (y quitarlo luego es otro clic);
   * fuera, se busca la zona cerrada y nace una mancha independiente.
   */
  function applyInk(pos) {
    if (state.inkPicking) { inkPickColor(pos); return; }

    if (state.inkTarget !== 'zone') {
      const idx = hitTest(pos);
      if (idx >= 0 && FILLABLE_TYPES.includes(state.elements[idx].type) &&
          state.elements[idx].ink !== true) {
        const col = state.fillColor || state.color;
        const patch = { ...state.elements[idx], fill: true, fillColor: col };
        if (state.fillTransparent) {
          patch.fillTransparent = true;
          if (Number.isFinite(state.fillOpacity)) patch.fillOpacity = state.fillOpacity;
        } else {
          delete patch.fillTransparent;
          delete patch.fillOpacity;
        }
        saveUndo();
        state.elements[idx] = patch;
        setInkStatus('Forma rellenada');
        redraw();
        return;
      }
    }

    const gap = state.inkGap;
    const mask = inkBarrierMask(gap);
    if (!mask) { setInkStatus('Aquí no se puede leer el lienzo'); return; }
    const rGap = Math.round(gap / 2);
    // Primero se tantea la zona para saber qué grosor la rodea, y con él se
    // calcula el radio anti-fisura del cálculo definitivo.
    // `allowEdge`: el borde del lienzo es una frontera válida, no un fallo. Sin
    // esto, pinchar en el lienzo vacío —que es una zona abierta por
    // definición— no pintaba nada, y en un bote de pintura eso es una anomalía.
    const tanteo = Flood.trace(mask, CANVAS_W, CANVAS_H, pos.x, pos.y,
      { snapRadius: rGap + 3, inkRadius: 0, epsilon: Flood.EPS_MIN, allowEdge: true });
    if (!tanteo.ok) { setInkStatus(INK_REASONS[tanteo.reason] || 'No se pudo pintar'); return; }

    const lw = inkBoundaryLineWidth(tanteo.bounds);
    const res = Flood.trace(mask, CANVAS_W, CANVAS_H, tanteo.seed.x, tanteo.seed.y, {
      inkRadius: Math.round(lw / 2 + rGap + 1),
      epsilon: Math.min(Flood.EPS_MAX, Math.max(Flood.EPS_MIN, 1.5 + 0.15 * lw + 0.1 * gap)),
      allowEdge: true,
    });
    if (!res.ok) { setInkStatus(INK_REASONS[res.reason] || 'No se pudo pintar'); return; }

    const el = inkElement(res.points);
    saveUndo();
    const gemela = inkTwinIndex(el);
    if (gemela >= 0) {
      state.elements[gemela] = el;
    } else {
      // El fondo va al fondo del todo; una zona interior, justo debajo de lo
      // que la delimita. Con el fondo no hay «lo que la delimita»: toca media
      // escena, y colarlo entre dos elementos taparía al de abajo.
      const at = res.edge ? 0 : inkInsertIndex(res.bounds);
      state.elements.splice(at, 0, el);
      // Los índices de la selección se desplazan con la inserción.
      state.selection = state.selection.map(i => (i >= at ? i + 1 : i));
    }
    setInkStatus(res.edge
      ? 'Fondo pintado'
      : res.holes
        ? `Zona pintada (contiene ${res.holes} isla${res.holes > 1 ? 's' : ''}, quedan pintadas)`
        : `Zona pintada con ${res.points.length} vértices`);
    redraw();
  }

  /** Cuentagotas: carga como tinta el color que hay bajo el puntero. */
  function inkPickColor(pos) {
    state.inkPicking = false;
    updateCursor();
    const c = mainCanvas.getContext('2d');
    let hex = null;
    if (c && c.getImageData) {
      const d = c.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
      if (d && d[3] > 8) {
        hex = '#' + [d[0], d[1], d[2]]
          .map(v => v.toString(16).padStart(2, '0')).join('');
      }
    }
    if (!hex) { setInkStatus('Ahí no hay color que tomar'); openInkModal(); return; }
    state.fillColor = hex;
    state.fillShapes = true;
    setInkStatus(`Color tomado: ${hex}`);
    openInkModal();
  }

  /** Los colores que hay en la escena, para el desplegable de sustitución. */
  function inkSceneColors() {
    const vistos = new Map();
    state.elements.forEach(el => {
      [el.color, el.fillColor].forEach(c => {
        if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) {
          vistos.set(hex6(c), (vistos.get(hex6(c)) || 0) + 1);
        }
      });
    });
    return [...vistos.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  }

  function syncInkControls() {
    const put = (id, v, texto) => {
      $(id).value = String(v);
      const val = $(id + '-val');
      if (val) val.textContent = String(texto === undefined ? v : texto);
    };
    put('ink-gap', state.inkGap);
    $('ink-target').value = state.inkTarget;
    $('ink-modal-fill-transparent').checked = !!state.fillTransparent;
    $('ink-modal-opacity').disabled = !state.fillTransparent;
    put('ink-modal-opacity', Math.round((state.fillOpacity !== undefined
      ? state.fillOpacity : 0.4) * 100));
    $('ink-modal-fill-color').value = hex6(state.fillColor || state.color);
    $('btn-ink-selection').disabled = !state.selection.length;

    const sel = $('ink-replace');
    const previo = sel.value;
    sel.innerHTML = '';
    const colores = inkSceneColors();
    if (!colores.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No hay colores en el lienzo';
      sel.appendChild(opt);
    } else {
      colores.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
      if (colores.includes(previo)) sel.value = previo;
    }
    $('btn-ink-replace').disabled = !colores.length;
    updateFillColorActive();
    renderInkPreview();
  }

  /** La miniatura la dibuja el Renderer de verdad, con un `polygon` como el
      que crearía un clic: así no puede prometer un color que luego no salga. */
  function renderInkPreview() {
    const cv = $('ink-preview');
    const pctx = cv && cv.getContext && cv.getContext('2d');
    if (!pctx) return;
    const w = cv.width, h = cv.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 14;
    const mancha = inkElement([
      { x: cx, y: cy - r }, { x: cx + r, y: cy },
      { x: cx, y: cy + r }, { x: cx - r, y: cy },
    ]);
    mancha.seed = 4242;
    Renderer.renderElement(pctx, mancha);
    // Y las dos líneas que forman el rombo, encima, como en el lienzo.
    Renderer.renderElement(pctx, { type: TOOLS.LINE, x1: cx - r - 8, y1: cy + 8,
      x2: cx + r + 8, y2: cy - 8, color: state.color, lineWidth: state.lineWidth, seed: 7 });
    Renderer.renderElement(pctx, { type: TOOLS.LINE, x1: cx - r - 8, y1: cy - 8,
      x2: cx + r + 8, y2: cy + 8, color: state.color, lineWidth: state.lineWidth, seed: 9 });
  }

  function openInkModal() {
    syncInkControls();
    $('modal-ink').showModal();
  }

  /** Punto único de sincronía del tamaño del emoji con su catálogo. Estas dos
      líneas estaban copiadas en cuatro sitios (selectTool, applyEmojiSize,
      «Limpiar todo» e init). */
  function syncEmojiControls() {
    $('emoji-modal-size').value = String(state.emojiSize);
    $('emoji-modal-size-val').textContent = String(state.emojiSize);
  }

  /** Abre el catálogo de Emoji con su tamaño al día. Lo llaman selectTool (al
      elegir la herramienta) y el ⚙ de «Texto»: con el Emoji activo y sin
      selección, el deslizador de esa sección gobierna el tamaño DEL EMOJI
      (#font-label dice «Emoji»), y su gemelo vive aquí dentro. Mismo contrato
      que openEraserSizeModal: no pasa por opensVariantModal. */
  function openEmojiModal() {
    syncEmojiControls();
    $('modal-emoji').showModal();
  }

  /** Abre los ajustes de «Select». Mismo contrato que el modal del borrador:
      se abre al elegir la herramienta y el ⚙ del panel lo reabre sin soltarla,
      y cerrarlo NO devuelve a la herramienta anterior —«Select» ya es usable
      sin elegir nada—, así que no pasa por opensVariantModal.

      Lo abren las DOS herramientas de Edición (SELECTION_TOOLS): su casilla
      gobierna el clic de ambas, así que ambas la enseñan al elegirlas. El ⚙
      del panel, visible con las dos, lo reabre sin soltar la herramienta. */
  function openSelectModal() {
    syncSelectControls();
    $('modal-select').showModal();
  }

  function syncSelectControls() {
    $('select-modal-multi').checked = state.multiSelect;
    $('select-modal-align').checked = state.alignGuides;
  }

  /* ── Trazo: ajustes compartidos entre el panel y #modal-stroke ── */

  /** Herramientas de dibujo a mano alzada: son las que tienen ajustes de trazo
      propios y, por tanto, las que abren #modal-stroke. */
  const STROKE_TOOLS = [
    TOOLS.PENCIL, TOOLS.LINE, TOOLS.ARROW, TOOLS.CURVE_ARROW, TOOLS.ARC,
  ];
  /** Las diez de Formas: abren #modal-shape, con trazo, relleno y giro. Cada
      herramienta produce un elemento de su mismo id (el Cuadrado incluido: es
      un polígono regular de cuatro lados, no un `rect`). */
  const SHAPE_TOOLS = [
    TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE, TOOLS.TRAPEZOID,
    ...REGULAR_POLYGON_TYPES,
  ];
  /** Los cinco componentes de UI que comparten #modal-ui (Texto tiene el suyo
      propio, #modal-text, porque sus ajustes son otros: tamaño de letra). */
  const UI_MODAL_TOOLS = [
    TOOLS.BUTTON, TOOLS.INPUT, TOOLS.IMAGE_PLACEHOLDER, TOOLS.NAV, TOOLS.CARD,
  ];
  /** Tipo de elemento que el modal de ajustes de cada herramienta sabe editar.
      Es la tabla de «pulsar la herramienta del elemento seleccionado lo edita»
      (selectTool conserva la selección si contiene alguno de este tipo). Por
      tipo EXACTO a propósito: la regla cabe en una frase y no da sorpresas —
      con un círculo seleccionado, pulsar Rectángulo deselecciona como siempre.
      El Semicírculo edita `curveArrow` porque eso es lo que crea (no es un
      tipo de elemento). Quedan fuera Emoji, Borrador y los catálogos: sus
      modales no editan elementos. */
  const MODAL_EDIT_TYPE = {
    [TOOLS.PENCIL]: 'pencil', [TOOLS.LINE]: 'line', [TOOLS.ARROW]: 'arrow',
    [TOOLS.CURVE_ARROW]: 'curveArrow', [TOOLS.ARC]: 'curveArrow',
    [TOOLS.TEXT]: 'text', [TOOLS.AIRBRUSH]: 'airbrush',
  };
  /** Las dos herramientas de Edición que TRABAJAN sobre la selección: nunca la
      vacían al elegirlas. Mover la desplaza, redimensiona y duplica; «Select»
      la construye. Vaciarla al pulsarlas —lo que hacía selectTool hasta la
      2.12.0, herencia del «vaciar siempre» de antes de la 2.10.0— rompía el
      reparto natural entre ambas: enmarcabas varios objetos con «Select»,
      pulsabas Mover para moverlos y el arrastre solo movía aquel sobre el que
      caía el puntero, porque la selección ya no existía. */
  const SELECTION_TOOLS = [TOOLS.SELECT, TOOLS.PICK];
  SHAPE_TOOLS.forEach(t => { MODAL_EDIT_TYPE[t] = t; });
  UI_MODAL_TOOLS.forEach(t => { MODAL_EDIT_TYPE[t] = t; });

  /** Ajustes que gobiernan cada TIPO de elemento: la inversa de MODAL_EDIT_TYPE.
      La necesita el ⚙ de «Posición y tamaño», la única sección donde no manda
      la herramienta activa sino lo que está seleccionado. Los tipos ausentes
      (`image` pegada, el `eraser` histórico) no tienen ajustes propios. */
  const TYPE_SETTINGS_MODAL = {
    pencil: openStrokeModal, line: openStrokeModal, arrow: openStrokeModal,
    curveArrow: openStrokeModal, text: openTextModal,
    airbrush: openAirbrushModal,
  };
  SHAPE_TOOLS.forEach(t => { TYPE_SETTINGS_MODAL[t] = openShapeModal; });
  UI_MODAL_TOOLS.forEach(t => { TYPE_SETTINGS_MODAL[t] = openUiModal; });

  /** Los ajustes que gobiernan la selección ENTERA, o null si no hay unos
      solos. Con tipos distintos devuelve null a propósito: no existe UN modal
      que los edite y abrir el del primero prometería que los demás son iguales
      —la misma regla que sigue `commonOf` con los valores del panel—. Un grupo
      de edificio (rects + líneas) cae ahí, y es lo correcto: sus piezas se
      editan desde «Trazo» y «Relleno», que tienen su propio ⚙. */
  function settingsModalForSelection() {
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    if (!sel.length) return null;
    const open = TYPE_SETTINGS_MODAL[sel[0].type] || null;
    return sel.every(el => TYPE_SETTINGS_MODAL[el.type] === open) ? open : null;
  }
  /** Formas cuyo giro se guarda como ángulo y, por tanto, se puede fijar antes
      de dibujar. Rectángulo y redondeado quedan fuera a propósito: su giro se
      serializa intercambiando ancho y alto, así que un cuarto de vuelta sobre
      una caja que aún estás arrastrando no significa nada — e `isValidElement`
      rechaza un `rotation` en ellos. El círculo, por razones obvias. */
  const ROTATABLE_TOOLS = [...REGULAR_POLYGON_TYPES, TOOLS.TRAPEZOID];

  /** Giro con el que nace la próxima forma, ya ajustado al paso de la
      herramienta activa. Fuente ÚNICA para la previsualización del arrastre y
      para el elemento que se crea al soltar, para que no puedan discrepar. */
  function creationRotation() {
    if (!ROTATABLE_TOOLS.includes(state.tool) || !state.shapeRotation) return 0;
    const stepDeg = ShapeRotation.step(state.tool);
    return ShapeRotation.normalize(
      Math.round(state.shapeRotation / stepDeg) * stepDeg);
  }

  /** Lleva una forma al ángulo `target` aplicando pasos completos de su propio
      tipo. Se apoya en ShapeRotation.rotateElement en vez de escribir el
      ángulo a pelo porque el trapecio, además de girar, intercambia ancho y
      alto: fijar solo `rotation` dejaría su caja —y con ella el impacto del
      clic— desalineada de la silueta. */
  function rotateTo(el, target) {
    const stepDeg = ShapeRotation.step(el.type);
    if (!stepDeg) return el;
    const current = Number.isFinite(el.rotation) ? el.rotation : 0;
    let steps = Math.round(ShapeRotation.normalize(target - current) / stepDeg);
    let out = el;
    while (steps-- > 0) out = ShapeRotation.rotateElement(out);
    return out;
  }
  /** Tipos de elemento a los que se les puede poner o quitar el discontinuo. */
  const DASHABLE_TYPES = ['line', 'arrow', 'curveArrow'];

  /** Doble punta: con selección se la pone a las flechas seleccionadas (los
      no-flecha se ignoran); sin selección fija el default de las nuevas.
      Vive aquí y no dentro del listener porque la casilla existe dos veces. */
  function applyDoubleHead(on) {
    if (state.selection.length) {
      const arrows = state.selection.filter(i => {
        const el = state.elements[i];
        // Los semicírculos (heads:'none') nunca llevan punta
        return (el.type === 'arrow' || el.type === 'curveArrow') && el.heads !== 'none';
      });
      // Sin flechas en la selección no hay nada que editar, pero se cae al
      // resync del final igualmente: un `return` aquí dejaba la casilla
      // marcada aunque no hubiera cambiado nada (auditoría v2.10.1).
      if (arrows.length) {
        saveUndo();
        arrows.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.heads = 'both';
          else delete copy.heads;
          state.elements[i] = copy;
        });
        redraw();
      }
    } else {
      state.doubleHead = on;
    }
    syncStrokeControls();
  }

  /** Trazo discontinuo: misma semántica dual, sobre line/arrow/curveArrow. */
  function applyDash(on) {
    if (state.selection.length) {
      const strokes = state.selection.filter(
        i => DASHABLE_TYPES.includes(state.elements[i].type));
      // Mismo motivo que en applyDoubleHead: siempre se resincroniza.
      if (strokes.length) {
        saveUndo();
        strokes.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.dash = true;
          else delete copy.dash;
          state.elements[i] = copy;
        });
        redraw();
      }
    } else {
      state.dashed = on;
    }
    syncStrokeControls();
  }

  /** Presión simulada del lápiz: mismo contrato que applyDash — con lápices
      seleccionados los edita (copias inmutables + un paso de undo); sin
      selección fija el default de creación (state.strokeTaper). */
  function applyTaper(on) {
    if (state.selection.length) {
      const pencils = state.selection.filter(
        i => state.elements[i].type === 'pencil');
      if (pencils.length) {
        saveUndo();
        pencils.forEach(i => {
          const copy = { ...state.elements[i] };
          if (on) copy.taper = true;
          else delete copy.taper;
          state.elements[i] = copy;
        });
        redraw();
      }
    } else {
      state.strokeTaper = on;
      savePrefs();
    }
    syncStrokeControls();
  }

  /** Punto ÚNICO de sincronía de los ajustes de trazo: reparte grosor, color,
      discontinuo y doble punta a los dos juegos de controles (panel y modal) y
      repinta la muestra. Asignar `.value`/`.checked` no dispara eventos, así
      que los gemelos no pueden realimentarse. Mismo contrato que
      syncBuildControls() y syncPathControls(). */
  function syncStrokeControls() {
    /* Con VARIOS seleccionados se enseña el valor que TODOS comparten, y si
       discrepan el control se deja como está: la misma regla del panel
       (v2.12.0), calculada sobre los elementos a los que cada control AFECTA.
       Esta era la única de las tres hermanas que no la tenía —syncShape y
       syncText sí— y caía a los defaults de creación, que además escribe en
       #check-dash y #check-double-head, que son del PANEL: con el modal de
       trazo abierto pisaba en cada frame lo que redrawNow acababa de calcular
       bien, así que tres flechas discontinuas se anunciaban continuas y
       marcar la casilla apilaba un undo que no deshacía nada visible
       (auditoría v2.16.3). */
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    const arrows = sel.filter(el => el.type === 'arrow' || el.type === 'curveArrow');
    const dashables = sel.filter(el => DASHABLE_TYPES.includes(el.type));
    const width = sel.length ? commonOf(sel, el => el.lineWidth)
      : state.tool === TOOLS.ERASER ? state.eraserSize : state.lineWidth;
    if (width !== undefined) {
      $('stroke-modal-slider').value = String(width);
      $('stroke-modal-val').textContent = String(width);
    }
    const color = sel.length
      ? commonOf(sel, el => hex6(el.color)) : hex6(state.color);
    if (color !== undefined) $('stroke-modal-color').value = color;
    const dash = sel.length
      ? commonOf(dashables, el => el.dash === true) : state.dashed;
    const double = sel.length
      ? commonOf(arrows, el => el.heads === 'both') : state.doubleHead;
    // A los DOS lados: este es el punto de sincronía, no solo el del modal.
    if (dash !== undefined) {
      $('stroke-modal-dash').checked = dash;
      $('check-dash').checked = dash;
    }
    if (double !== undefined) {
      $('stroke-modal-double').checked = double;
      $('check-double-head').checked = double;
    }
    // El lápiz y la línea no llevan punta: el campo se atenúa en vez de
    // desaparecer, como hace updateFacadeFieldsEnabled con la cubierta. Un
    // semicírculo (heads:'none') tampoco la lleva NUNCA — mismo criterio que
    // syncPanelSections; sin la exclusión, la casilla quedaba habilitada e
    // inerte con uno seleccionado (auditoría v2.10.1).
    const heads = state.tool === TOOLS.ARROW || state.tool === TOOLS.CURVE_ARROW ||
      arrows.some(el => el.heads !== 'none');
    $('stroke-modal-double-row').classList.toggle('modal__field--off', !heads);
    $('stroke-modal-double').disabled = !heads;
    // Y el discontinuo se atenúa para el lápiz, con el criterio del panel
    // (syncPanelSections oculta #row-dash por lo mismo): el case 'pencil' del
    // renderer no tiene dash, así que la casilla dibujaba la muestra
    // discontinua, el trazo salía continuo y encima cambiaba en silencio
    // state.dashed — la siguiente LÍNEA nacía discontinua sin pedirlo.
    const dashable = DASHABLE_TYPES.includes(state.tool) || state.tool === TOOLS.ARC ||
      dashables.length > 0;
    $('stroke-modal-dash-row').classList.toggle('modal__field--off', !dashable);
    $('stroke-modal-dash').disabled = !dashable;
    // Presión simulada: solo del lápiz. Mismo trato que el discontinuo —
    // atenuada, no oculta, cuando ni la herramienta ni la selección la tocan.
    const pencils = sel.filter(el => el.type === 'pencil');
    const taper = sel.length
      ? commonOf(pencils, el => el.taper === true) : state.strokeTaper;
    if (taper !== undefined) $('stroke-modal-taper').checked = taper;
    const taperable = state.tool === TOOLS.PENCIL || pencils.length > 0;
    $('stroke-modal-taper-row').classList.toggle('modal__field--off', !taperable);
    $('stroke-modal-taper').disabled = !taperable;
    // Curvatura: se lee sobre las curvas SIMPLES —las únicas que el mando sabe
    // editar—, no sobre toda la selección, y se mide como la magnitud lateral
    // del control entre la longitud de la cuerda, que es justo lo que escribe
    // applyCurveBulge. Con varias que discrepan, commonOf devuelve undefined y
    // el control se deja como está (regla v2.12.0).
    const curves = sel.filter(el => el.type === 'curveArrow' &&
      !CurvePath.isChain(el) && el.arc !== true);
    const bulgeOf = el => {
      const fr = chordFrame(el);
      const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
      if (!fr || len < 1e-6) return undefined;
      const s = (el.cx - fr.mx) * fr.ux + (el.cy - fr.my) * fr.uy;
      return Math.round(Math.abs(s) / len * 100 / CURVE_BULGE_STEP) * CURVE_BULGE_STEP;
    };
    const bulge = sel.length
      ? commonOf(curves, bulgeOf)
      : Math.round(state.curveBulge * 100);
    if (bulge !== undefined) {
      $('stroke-modal-curve').value = String(bulge);
      $('stroke-modal-curve-val').textContent = String(bulge);
    }
    const curvable = state.tool === TOOLS.CURVE_ARROW || curves.length > 0;
    $('stroke-modal-curve-row').classList.toggle('modal__field--off', !curvable);
    $('stroke-modal-curve').disabled = !curvable;
    renderStrokePreview();
  }

  /* ── Ayuda: índice y buscador (v3.3.0) ──
     Son ya veinte secciones, y encontrar algo concreto era desplazarse
     leyendo. Dos añadidos, los dos construidos desde el propio HTML de la
     ayuda para que una sección nueva no haya que apuntarla en ningún sitio. */

  /** Pastillas que saltan a cada sección, sacadas de sus <h4>. */
  function buildHelpIndex() {
    const nav = $('help-index');
    const grupos = $('modal-help').querySelectorAll('.modal__help-group');
    nav.innerHTML = '';
    grupos.forEach((g, i) => {
      const h = g.querySelector('.modal__help-title');
      if (!h) return;
      if (!g.id) g.id = 'help-sec-' + i;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'modal__help-chip';
      // textContent, nunca innerHTML: el título puede llevar emoji y, sobre
      // todo, es la regla de la casa para todo lo que se inyecta.
      chip.textContent = h.textContent;
      chip.addEventListener('click', () => {
        g.scrollIntoView({ block: 'start' });
      });
      nav.appendChild(chip);
    });
  }

  /**
   * Filtra la ayuda por texto: deja las líneas que coinciden y esconde las
   * secciones que se quedan sin ninguna. Con la búsqueda vacía lo devuelve
   * todo, que es el estado de siempre.
   *
   * Se compara sobre `textContent` en minúsculas y sin acentos: la interfaz
   * va en mayúsculas por CSS, pero el DOM conserva el texto original, así que
   * buscar «boton» tiene que encontrar «Botón».
   */
  function filterHelp(texto) {
    const q = normalizaBusqueda(texto);
    const grupos = $('modal-help').querySelectorAll('.modal__help-group');
    let vistos = 0;
    grupos.forEach(g => {
      const titulo = normalizaBusqueda(g.querySelector('.modal__help-title').textContent);
      // Si lo buscado está en el título, la sección entera cuenta: quien
      // escribe «jardín» quiere esa sección, no las tres líneas que además
      // repiten la palabra.
      const porTitulo = !!q && titulo.includes(q);
      let hay = 0;
      // `querySelectorAll('li')` a secas, y no `.modal__help-list li`: el
      // arnés node:vm resuelve selectores simples, no descendientes, y con
      // el compuesto el filtro no encontraba una sola línea ahí dentro —
      // funcionaba en el navegador y la guarda no podía verlo.
      g.querySelectorAll('li').forEach(li => {
        const casa = !q || porTitulo || normalizaBusqueda(li.textContent).includes(q);
        li.hidden = !casa;
        if (casa) hay++;
      });
      g.hidden = !!q && hay === 0;
      vistos += hay;
    });
    const count = $('help-count');
    count.textContent = vistos === 1 ? '1 resultado' : vistos + ' resultados';
    count.hidden = !q;
    $('help-empty').hidden = !q || vistos > 0;
    // El índice sobra mientras se filtra: apunta a secciones que pueden no
    // estar en pantalla, y saltar a una sección oculta no lleva a ningún sitio.
    $('help-index').hidden = !!q;
  }

  /** Minúsculas y sin acentos, para que «boton» encuentre «Botón». */
  function normalizaBusqueda(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** Abre los ajustes de trazo. Igual que el borrador, cerrarlo NO devuelve a
      la herramienta anterior (no hay nada que elegir: el trazo ya es usable),
      así que no pasa por opensVariantModal. */
  function openStrokeModal() {
    syncStrokeControls();
    $('modal-stroke').showModal();
  }

  /** Muestra del trazo con los ajustes actuales, dibujada con las mismas
      primitivas que el lienzo: la miniatura no puede prometer otra cosa. */
  function renderStrokePreview() {
    const canvas = $('stroke-preview');
    const pctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!pctx) return;
    const w = canvas.width, h = canvas.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const single = state.selection.length === 1
      ? state.elements[state.selection[0]] : null;
    const el = {
      // El tipo sale de lo SELECCIONADO cuando lo hay, y solo si no, de la
      // herramienta: desde la v2.21.0 el ⚙ de «Posición y tamaño» abre este
      // modal con cualquier herramienta activa, así que leyendo únicamente
      // state.tool una flecha seleccionada se dibujaba como línea sin punta.
      type: (single
        ? (single.type === 'arrow' || single.type === 'curveArrow') && single.heads !== 'none'
        : state.tool === TOOLS.ARROW || state.tool === TOOLS.CURVE_ARROW)
        ? 'arrow' : 'line',
      x1: w * 0.12, y1: h * 0.62, x2: w * 0.88, y2: h * 0.38,
      color: single ? single.color : state.color,
      lineWidth: single ? single.lineWidth : state.lineWidth,
      seed: 7,
    };
    // La casilla puede estar marcada (state.dashed) pero atenuada porque la
    // herramienta no admite discontinuo (lápiz): la muestra dibuja lo que va a
    // salir, no lo que dice un control deshabilitado.
    if ($('stroke-modal-dash').checked && !$('stroke-modal-dash').disabled) el.dash = true;
    if ($('stroke-modal-double').checked && el.type === 'arrow') el.heads = 'both';
    // Con la presión simulada activa (y aplicable), la muestra es un trazo de
    // lápiz de verdad: una S con separación creciente entre puntos, para que
    // se vea el rasgo que define al modo — fino donde corre, grueso donde no.
    if ($('stroke-modal-taper').checked && !$('stroke-modal-taper').disabled) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        // El cubo estira la separación hacia el final: arranque lento
        // (grueso) y salida rápida (afilada).
        const u = t * t * (3 - 2 * t);
        pts.push({ x: w * (0.12 + 0.76 * (t * 0.4 + 0.6 * t * t * t)),
                   y: h * (0.62 - 0.24 * u) + Math.sin(t * Math.PI * 2) * h * 0.08 });
      }
      Renderer.renderElement(pctx, {
        type: 'pencil', points: pts, taper: true,
        color: el.color, lineWidth: el.lineWidth, seed: 7,
      });
      return;
    }
    // Con la curvatura aplicable, la muestra es una CURVA de verdad y con la
    // comba elegida: hasta la v3.2.0 dibujaba una recta incluso con la Flecha
    // curva puesta, y con un deslizador de curvatura delante eso sería una
    // muestra que miente. Se dibuja el elemento del modal (una curva simple),
    // no el seleccionado, por lo mismo que el resto de la muestra: enseña lo
    // que van a hacer estos ajustes.
    if (!$('stroke-modal-curve').disabled) {
      const bulge = (+$('stroke-modal-curve').value || 0) / 100;
      const c = CurvePath.defaultCtrl(
        { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, false, bulge);
      // `type: 'line'` aquí significa «sin punta» (lo decide el bloque de
      // arriba), y en un curveArrow eso se dice con heads:'none': sin esto,
      // una curva sin puntas se previsualizaría con una.
      const heads = el.type === 'line' ? { heads: 'none' } : {};
      Renderer.renderElement(pctx, { ...el, type: 'curveArrow', cx: c.cx, cy: c.cy, ...heads });
      return;
    }
    Renderer.renderElement(pctx, el);
  }

  /* ── Formas: ajustes compartidos entre el panel y #modal-shape ── */

  /** Punto ÚNICO de sincronía de los ajustes de forma: trazo y relleno a los
      dos juegos de controles, y la muestra al día. Mismo contrato que
      syncStrokeControls(). */
  function syncShapeControls() {
    // Misma regla que redrawNow: con multiselección los controles no se tocan
    // —no hay un valor que enseñar— y conservan lo último mostrado, que además
    // es lo que el usuario está arrastrando ahora mismo.
    if (state.selection.length > 1) { renderShapePreview(); return; }
    const single = state.selection.length === 1
      ? state.elements[state.selection[0]] : null;
    const fillable = single && FILLABLE_TYPES.includes(single.type) ? single : null;
    const width = single ? single.lineWidth : state.lineWidth;
    $('shape-modal-slider').value = String(width);
    $('shape-modal-val').textContent = String(width);
    $('shape-modal-color').value = hex6(single ? single.color : state.color);

    const on = fillable ? fillable.fill === true : state.fillShapes;
    const transparent = fillable
      ? fillable.fillTransparent === true : state.fillTransparent;
    const pct = Math.round((fillable
      ? (fillable.fillOpacity !== undefined ? fillable.fillOpacity : 0.4)
      : state.fillOpacity) * 100);
    const fillColor = hex6(fillable
      ? (fillable.fillColor || fillable.color) : (state.fillColor || state.color));
    // A los DOS lados: este es el punto de sincronía del relleno, no solo el
    // del modal. La opacidad solo pinta en modo translúcido, en ambos.
    $('shape-modal-fill').checked = on;
    $('check-fill').checked = on;
    $('shape-modal-fill-transparent').checked = transparent;
    $('check-fill-transparent').checked = transparent;
    $('shape-modal-opacity').value = String(pct);
    $('fill-opacity-slider').value = String(pct);
    $('shape-modal-opacity-val').textContent = String(pct);
    $('fill-opacity-val').textContent = String(pct);
    $('shape-modal-opacity').disabled = !transparent;
    $('fill-opacity-slider').disabled = !transparent;
    $('shape-modal-fill-color').value = fillColor;
    $('fill-color-picker').value = fillColor;
    // Las paletas del relleno enseñan lo mismo que su selector de al lado.
    updateFillColorActive(fillColor);

    // Giro. El paso lo manda el tipo, así que el deslizador se reconfigura al
    // cambiar de herramienta y el valor se ajusta al múltiplo más cercano: 36°
    // de un pentágono no es una orientación válida para un hexágono, y un
    // trapecio con un giro que no sea cuarto de vuelta lo rechaza la validación
    // al reimportar el JSON.
    const rotType = single && ShapeRotation.isType(single.type) &&
      ROTATABLE_TOOLS.includes(single.type) ? single.type
      : ROTATABLE_TOOLS.includes(state.tool) ? state.tool : null;
    const row = $('shape-modal-rotation-row');
    row.hidden = !rotType;
    if (rotType) {
      const stepDeg = ShapeRotation.step(rotType);
      const raw = single ? (Number.isFinite(single.rotation) ? single.rotation : 0)
        : state.shapeRotation;
      const snapped = ShapeRotation.normalize(Math.round(raw / stepDeg) * stepDeg);
      if (!single) state.shapeRotation = snapped;
      const slider = $('shape-modal-rotation');
      slider.step = String(stepDeg);
      slider.max = String(360 - stepDeg);
      slider.value = String(snapped);
      $('shape-modal-rotation-val').textContent = String(snapped);
    }
    renderShapePreview();
    // Los mandos de trazo y relleno están también en los cuatro modales de 3D,
    // y su valor depende de la selección: hay que repartirlos aquí, en el punto
    // de sincronía que corre en cada repintado. Sólo si hay uno abierto —si no,
    // repintar cuatro miniaturas por fotograma sería puro derroche.
    if (solidModalOpen()) syncSolidControls();
  }

  /** Abre los ajustes de la forma. Como el borrador y el trazo, cerrarlo no
      devuelve a la herramienta anterior: no hay nada que elegir. */
  function openShapeModal() {
    syncShapeControls();
    $('modal-shape').showModal();
  }

  /** Muestra de LA FORMA de la herramienta activa con el trazo y el relleno
      actuales — no un rectángulo genérico: la gracia es ver el resultado antes
      de arrastrar, y un pentágono no se parece a un círculo. */
  function renderShapePreview() {
    const canvas = $('shape-preview');
    const pctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!pctx) return;
    const w = canvas.width, h = canvas.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const single = state.selection.length === 1
      ? state.elements[state.selection[0]] : null;
    // El tipo sale de lo SELECCIONADO cuando lo hay, igual que `rotType` en
    // syncShapeControls: desde la v2.21.0 los ⚙ de «Relleno» y de «Posición y
    // tamaño» abren este modal con cualquier herramienta activa, y leyendo solo
    // state.tool un pentágono seleccionado se previsualizaba como rectángulo.
    const type = single && SHAPE_TOOLS.includes(single.type) ? single.type
      : SHAPE_TOOLS.includes(state.tool) ? state.tool : TOOLS.RECT;
    // Los polígonos regulares exigen w === h (RegularPolygon): caja cuadrada.
    const sq = REGULAR_POLYGON_TYPES.includes(type) || type === TOOLS.CIRCLE;
    const bw = sq ? h * 0.62 : w * 0.66, bh = h * 0.62;
    const el = {
      type, x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh,
      color: single ? single.color : state.color,
      lineWidth: single ? single.lineWidth : state.lineWidth,
      seed: 11,
    };
    const rot = +$('shape-modal-rotation').value;
    if (rot && ROTATABLE_TOOLS.includes(type)) el.rotation = rot;
    if ($('shape-modal-fill').checked) {
      el.fill = true;
      // El picker enseña SIEMPRE un color (hex6(fillColor || color)), pero la
      // creación solo escribe fillColor si existe de verdad; sin él, el
      // relleno es el tinte clásico del trazo (color + '20'). Copiar aquí el
      // valor del picker pintaba la muestra con un sólido opaco donde el
      // elemento real sale con un tinte tenue (auditoría v2.10.1). Se lee la
      // misma fuente que usa la creación / el elemento seleccionado.
      const fc = single ? single.fillColor : state.fillColor;
      if (fc) el.fillColor = fc;
      if ($('shape-modal-fill-transparent').checked) {
        el.fillTransparent = true;
        el.fillOpacity = +$('shape-modal-opacity').value / 100;
      }
    }
    Renderer.renderElement(pctx, el);
  }

  /* ── Texto: ajustes compartidos entre el panel y #modal-text ── */

  /** Punto único de sincronía de los ajustes de texto, mismo contrato que
      syncStrokeControls(): con un `text` seleccionado enseña sus valores; sin
      selección, los defaults de creación. */
  function syncTextControls() {
    const single = state.selection.length === 1
      ? state.elements[state.selection[0]] : null;
    const size = single && single.type === 'text' ? single.fontSize : state.fontSize;
    $('text-modal-size').value = String(size);
    $('text-modal-size-val').textContent = String(size);
    // Grosor: quinto gemelo, llegado con la retirada del deslizador del panel
    // (v2.21.0). Mismo patrón que syncShapeControls y syncUiControls.
    const width = single ? single.lineWidth : state.lineWidth;
    $('text-modal-stroke').value = String(width);
    $('text-modal-stroke-val').textContent = String(width);
    $('text-modal-color').value = hex6(single ? single.color : state.color);
    // Negrita y sombra: con textos seleccionados mandan ellos —el valor que
    // TODOS comparten, y si discrepan se deja el control como está, misma
    // regla que el resto del panel—; sin selección, los defaults de creación.
    const texts = state.selection
      .map(i => state.elements[i])
      .filter(el => el && el.type === 'text');
    const bold = texts.length
      ? commonOf(texts, el => el.bold === true)
      : state.textBold;
    const shadow = texts.length
      ? commonOf(texts, el => textShadowById(el.shadow).id)
      : state.textShadow;
    const shadowColor = texts.length
      ? commonOf(texts, el => hex6(el.shadowColor || DEFAULT_SHADOW_COLOR))
      : state.textShadowColor;
    if (bold !== undefined) {
      $('check-bold').checked = bold;
      $('text-modal-bold').checked = bold;
    }
    if (shadow !== undefined) {
      $('text-shadow').value = shadow;
      $('text-modal-shadow').value = shadow;
    }
    if (shadowColor !== undefined) {
      $('text-shadow-color').value = hex6(shadowColor);
      $('text-modal-shadow-color').value = hex6(shadowColor);
    }
    // El editor flotante escribe con lo que se va a obtener: si no, se teclea
    // en redonda y el texto aparece en negrita al confirmar.
    textInput.style.fontWeight = (bold === true) ? 'bold' : 'normal';
    renderTextPreview();
  }

  /** Abre los ajustes del texto. Como el trazo: cerrarlo no devuelve a la
      herramienta anterior (no hay nada que elegir). */
  function openTextModal() {
    syncTextControls();
    $('modal-text').showModal();
  }

  /** Muestra del texto con el tamaño y el color actuales — el texto REAL si
      hay uno seleccionado (su primera línea), la palabra «Texto» si no. */
  function renderTextPreview() {
    const canvas = $('text-preview');
    const pctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!pctx) return;
    const w = canvas.width, h = canvas.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const single = state.selection.length === 1 &&
      state.elements[state.selection[0]].type === 'text'
      ? state.elements[state.selection[0]] : null;
    const size = Number($('text-modal-size').value) || state.fontSize;
    const style = single
      ? { bold: single.bold, shadow: single.shadow, shadowColor: single.shadowColor }
      : textStyleDefaults();
    Renderer.renderElement(pctx, {
      type: 'text',
      x: 14, y: (h - size) / 2,
      value: single && single.value ? single.value.split('\n')[0] : 'Texto',
      color: single ? single.color : state.color,
      fontSize: size,
      lineWidth: single ? single.lineWidth : state.lineWidth,
      ...style,
    });
  }

  /* ── Componentes UI: #modal-ui sirve a Botón, Input, Imagen, Navbar y Tarjeta ── */

  /** Nombre visible de cada componente, para retitular el modal compartido. */
  const UI_TOOL_NAMES = {
    [TOOLS.BUTTON]: 'Botón', [TOOLS.INPUT]: 'Input',
    [TOOLS.IMAGE_PLACEHOLDER]: 'Imagen', [TOOLS.NAV]: 'Navbar',
    [TOOLS.CARD]: 'Tarjeta',
  };

  /** Punto único de sincronía de los ajustes de componente. El tipo mostrado
      es el del componente seleccionado si lo hay (⚙ con selección) y el de la
      herramienta activa si no. */
  function syncUiControls() {
    const single = state.selection.length === 1
      ? state.elements[state.selection[0]] : null;
    const uiType = single && UI_TOOL_NAMES[single.type] ? single.type
      : UI_TOOL_NAMES[state.tool] ? state.tool : TOOLS.BUTTON;
    $('modal-ui-title').textContent = 'Ajustes de ' + UI_TOOL_NAMES[uiType];
    // Imagen no tiene rótulo (el renderer de imagePlaceholder no lo recibe):
    // la fila entera se oculta, igual que hace el panel con #el-label-row. Y
    // con multi-selección tampoco se ofrece — la regla del panel es que con
    // varias piezas los controles de texto no se tocan (#el-label-row hace lo
    // mismo), y un campo visible que no edita nada es un callejón sin salida.
    const labeled = state.selection.length <= 1 && uiType !== TOOLS.IMAGE_PLACEHOLDER;
    $('ui-modal-label-row').hidden = !labeled;
    if (labeled && document.activeElement !== $('ui-modal-label')) {
      $('ui-modal-label').value = single ? (single.label || '')
        : (state.uiLabels[uiType] || '');
    }
    const width = single ? single.lineWidth : state.lineWidth;
    $('ui-modal-slider').value = String(width);
    $('ui-modal-val').textContent = String(width);
    $('ui-modal-color').value = hex6(single ? single.color : state.color);
    renderUiPreview(uiType, single);
  }

  /** Abre los ajustes del componente UI activo. Mismo contrato que el trazo. */
  function openUiModal() {
    syncUiControls();
    $('modal-ui').showModal();
  }

  /** Muestra del componente dibujada con el renderer REAL, encajada en la
      miniatura: el nav mide 600×50 y la tarjeta 220×280, así que se escala por
      el lado que mande en vez de recortar. */
  function renderUiPreview(uiType, single) {
    const canvas = $('ui-preview');
    const pctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!pctx) return;
    const w = canvas.width, h = canvas.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, w, h);
    const defs = UI_DEFAULTS[uiType] || UI_DEFAULTS[TOOLS.BUTTON];
    const s = Math.min((w - 20) / defs.w, (h - 20) / defs.h, 1);
    const el = {
      type: uiType,
      x: (w / s - defs.w) / 2, y: (h / s - defs.h) / 2,
      w: defs.w, h: defs.h,
      color: single ? single.color : state.color,
      lineWidth: single ? single.lineWidth : state.lineWidth,
      seed: 5,
    };
    const label = single ? single.label : (state.uiLabels[uiType] || '').trim();
    if (label) el.label = label;
    pctx.scale(s, s);
    Renderer.renderElement(pctx, el);
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

    // Color del trazo — semántica dual, como el resto de controles de aspecto.
    // Hasta la v2.9.0 era el ÚNICO que no la tenía: con algo seleccionado,
    // elegir un color no lo recoloreaba, así que un botón, una tarjeta o
    // cualquier elemento ya dibujado se quedaba para siempre del color con el
    // que nació. El diálogo nativo dispara un 'input' por cada tono que se pisa
    // al arrastrar, así que todo el gesto es UN paso de undo (mismo patrón que
    // el color de relleno).
    let colorGestureSnap = null;
    const applyColor = c => {
      if (state.selection.length) {
        if (!colorGestureSnap) colorGestureSnap = snapshot();
        state.selection.forEach(i => {
          state.elements[i] = { ...state.elements[i], color: c };
        });
        showColor(c);
        redraw();
      } else {
        setColor(c);
      }
      syncStrokeControls();
      syncShapeControls();
      syncTextControls();
      syncUiControls();
      syncAirbrushControls();
    };
    function commitColorGesture() {
      if (!colorGestureSnap) return;
      const snap = colorGestureSnap;
      colorGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] || el.color === state.elements[i].color);
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }
    ['color-picker', 'stroke-modal-color', 'shape-modal-color',
      'text-modal-color', 'ui-modal-color', 'airbrush-modal-color',
      'prism-color', 'pyramid-color', 'frustum-color', 'sphere-color'].forEach(id => {
      $(id).addEventListener('input', e => applyColor(e.target.value));
      $(id).addEventListener('change', commitColorGesture);
    });

    // Grosor — semántica dual: con selección edita el de los elementos
    // seleccionados en vivo; sin selección fija el default de creación. Todo el
    // deslizamiento cuenta como UN paso de undo: el snapshot se captura al
    // primer 'input' del gesto y se apila en 'change'. Desde la v2.21.0 no hay
    // mando en el panel: los cinco gemelos viven en los modales de ajustes.
    let strokeGestureSnap = null;
    const applyStrokeWidth = v => {
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
      syncStrokeControls();
      syncShapeControls();
      syncUiControls();
      syncTextControls();
    };
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
    // Los cuatro mandos del grosor, todos dentro de su modal de ajustes: mismo
    // dato, mismo gesto de undo. No van por wireBuildPair porque necesitan
    // 'input' en vivo. #modal-text entró en la v2.21.0, al retirar el
    // deslizador del panel: sin él, un texto seleccionado se quedaba sin sitio
    // desde el que cambiar su trazo.
    ['stroke-modal-slider', 'shape-modal-slider', 'ui-modal-slider',
      'text-modal-stroke',
      // Y los cuatro de 3D: el grosor de las aristas de un sólido es el mismo
      // ajuste, así que pasa por el mismo cuerpo y el mismo paso de undo.
      'prism-stroke', 'pyramid-stroke', 'frustum-stroke', 'sphere-stroke'].forEach(id => {
      $(id).addEventListener('input', e => applyStrokeWidth(+e.target.value));
      $(id).addEventListener('change', commitStrokeGesture);
      $(id).addEventListener('pointerup', commitStrokeGesture);
      $(id).addEventListener('pointercancel', commitStrokeGesture);
    });

    // Curvatura (v3.2.0) — semántica dual y un paso de undo por gesto, igual
    // que el grosor. Con selección edita las curvas SIMPLES seleccionadas
    // (fijando la magnitud lateral de cada control a comba·|cuerda| y
    // CONSERVANDO su signo, que es lo que preserva el lado del giro y la forma
    // en S); sin selección fija el default de creación.
    //
    // Cadenas y semicírculos se quedan fuera a propósito: en una cadena la
    // comba es de cada tramo y en un arco es el radio, con su invariante de
    // 180°. Por eso el mando se atenúa cuando no hay ninguna curva simple a la
    // que aplicarse — no dibujar promesas que el gesto no cumple.
    let curveGestureSnap = null;
    const simpleCurves = () => state.selection.filter(i => {
      const el = state.elements[i];
      return el && el.type === 'curveArrow' && !CurvePath.isChain(el) && el.arc !== true;
    });
    const applyCurveBulge = pct => {
      const bulge = pct / 100;
      const curves = simpleCurves();
      if (state.selection.length && curves.length) {
        if (!curveGestureSnap) curveGestureSnap = snapshot();
        curves.forEach(i => {
          const el = state.elements[i];
          const fr = chordFrame(el);
          if (!fr) return;
          const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
          const put = (cx, cy) => {
            // Signo actual del control: si está justo sobre el eje (comba 0)
            // se toma el lado positivo, para que subir el mando saque la curva
            // en lugar de dejarla plana para siempre.
            const cur = (cx - fr.mx) * fr.ux + (cy - fr.my) * fr.uy;
            const sign = Math.sign(cur) || 1;
            const s = sign * bulge * len;
            return { x: fr.mx + s * fr.ux, y: fr.my + s * fr.uy };
          };
          const c1 = put(el.cx, el.cy);
          const copy = { ...el, cx: c1.x, cy: c1.y };
          if (el.cx2 !== undefined) {
            const c2 = put(el.cx2, el.cy2);
            copy.cx2 = c2.x;
            copy.cy2 = c2.y;
          }
          state.elements[i] = copy;
        });
        redraw();
      } else if (!state.selection.length) {
        state.curveBulge = bulge;
      }
      syncStrokeControls();
    };
    function commitCurveGesture() {
      if (!curveGestureSnap) return;
      const snap = curveGestureSnap;
      curveGestureSnap = null;
      const igual = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          (el.cx === state.elements[i].cx && el.cy === state.elements[i].cy));
      if (igual) state.elements = snap; else pushUndo(snap);
      if (!state.selection.length) savePrefs();
    }
    $('stroke-modal-curve').addEventListener('input', e => applyCurveBulge(+e.target.value));
    ['change', 'pointerup', 'pointercancel'].forEach(ev => {
      $('stroke-modal-curve').addEventListener(ev, () => {
        commitCurveGesture();
        // Sin selección no hay gesto que cerrar, pero el default sí hay que
        // dejarlo guardado: si no, la comba elegida moriría con la pestaña.
        if (!state.selection.length) savePrefs();
      });
    });

    // Un ⚙ por sección, cada uno a los ajustes de la SUYA (v2.21.0). Todos
    // llaman directo a open*Modal(): abrir unos ajustes desde el panel no puede
    // cambiar de herramienta ni vaciar la selección — es justamente la vía para
    // retocar sin soltar lo que estás haciendo. Van con arrow y no pelados: un
    // listener le pasaría el evento como primer argumento (la misma trampa que
    // documenta applyGeometry).
    $('btn-element-settings').addEventListener('click', () => {
      const open = settingsModalForSelection();
      if (open) open();
    });
    // #modal-shape es el único que lleva el bloque Relleno: no hay otro sitio
    // al que esta sección pueda apuntar.
    $('btn-fill-settings').addEventListener('click', () => openShapeModal());
    $('btn-text-settings').addEventListener('click', () => {
      if (state.tool === TOOLS.EMOJI && !state.selection.length) openEmojiModal();
      else openTextModal();
    });
    // «Los clics acumulan selección» gobierna el clic de Mover y de «Select»:
    // su sitio es la cabecera que cuenta lo seleccionado, desde donde se alcanza
    // con CUALQUIER herramienta y no solo con las dos de Edición.
    $('btn-selection-settings').addEventListener('click', () => openSelectModal());
    // Los ⚙ de «Edificios» y «Jardín» son la excepción y pasan por selectTool a
    // propósito (sí cambian de herramienta): un catálogo se RECONSTRUYE al
    // abrirse —sus iconos se pintan con la geometría, el color y el trazo
    // actuales— y esa reconstrucción vive dentro de selectTool.
    $('btn-build-settings').addEventListener('click', () => selectTool(TOOLS.BUILD_FACADE));
    $('btn-garden-settings').addEventListener('click', () => selectTool(state.tool));
    $('eraser-size-modal-slider').addEventListener('input', e => {
      applyEraserSize(+e.target.value);
    });
    $('eraser-size-modal-slider').addEventListener('change', savePrefs);

    /* ── Aerógrafo: los cuatro deslizadores ──
       Mismo contrato que el grosor y el tamaño de letra: con selección editan
       las manchas seleccionadas y todo el arrastre es UN paso de deshacer; sin
       selección fijan el default de creación. No pueden ir por applyStrokeWidth
       aunque el grano ACABE en `lineWidth`: sin selección esa función escribe
       state.lineWidth, que es el grosor de los trazos, no el grano del espray.
       El commit se remata en pointerup/pointercancel por lo mismo que allí (un
       <input range> no dispara 'change' si acaba donde empezó), y savePrefs va
       en el commit y no por evento: si no, un arrastre martillea localStorage. */
    let airbrushGestureSnap = null;
    /**
     * @param {string} campo  campo del elemento que edita ('radius', 'lineWidth'…)
     * @param {string} clave  ajuste de `state` que fija cuando no hay selección
     * @param {(v:number)=>number} [conv]  mando → valor guardado
     */
    const applyAirbrush = (campo, clave, conv) => v => {
      const valor = conv ? conv(v) : v;
      const sel = selectedAirbrushes();
      if (sel.length) {
        if (!airbrushGestureSnap) airbrushGestureSnap = snapshot();
        state.selection.forEach(i => {
          const el = state.elements[i];
          if (!el || el.type !== 'airbrush') return;
          const copia = { ...el, [campo]: valor };
          // La ausencia del campo ES el aspecto por defecto: al 100 % la
          // opacidad se BORRA en vez de guardarse como 1, igual que quitar la
          // sombra de un texto borra el campo en vez de escribir 'none'.
          if (campo === 'opacity' && valor >= 1) delete copia.opacity;
          state.elements[i] = copia;
        });
        redraw();
      } else {
        state[clave] = valor;
      }
      syncAirbrushControls();
    };
    function commitAirbrushGesture() {
      if (!airbrushGestureSnap) return;
      const snap = airbrushGestureSnap;
      airbrushGestureSnap = null;
      const igual = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i]);
      if (igual) state.elements = snap; else pushUndo(snap);
      savePrefs();
    }
    [['airbrush-modal-radius', applyAirbrush('radius', 'airbrushRadius', v => v / 2)],
      ['airbrush-modal-grain', applyAirbrush('lineWidth', 'airbrushGrain')],
      ['airbrush-modal-density', applyAirbrush('density', 'airbrushDensity')],
      ['airbrush-modal-opacity', applyAirbrush('opacity', 'airbrushOpacity', v => v / 100)],
    ].forEach(([id, apply]) => {
      $(id).addEventListener('input', e => apply(+e.target.value));
      $(id).addEventListener('change', commitAirbrushGesture);
      $(id).addEventListener('pointerup', commitAirbrushGesture);
      $(id).addEventListener('pointercancel', commitAirbrushGesture);
    });

    /* ── Aerógrafo: el área ──
       Armar el área CIERRA el modal, y no es un detalle de comodidad: un
       <dialog showModal> deja inerte todo lo de detrás, así que pedir un
       arrastre en el lienzo sin cerrarlo deja al usuario mirando una app que
       no responde (el síntoma exacto de la v2.16.2). */
    const armarArea = () => {
      state.airbrushAreaPending = true;
      syncAirbrushControls();
      $('modal-airbrush').close();
      scheduleOverlay();
    };
    $('airbrush-area-mode').addEventListener('change', e => {
      const modo = e.target.value === 'area' ? 'area' : 'all';
      state.airbrushAreaMode = modo;
      // Con manchas seleccionadas, el modo edita SU recorte: es la misma
      // semántica dual que el resto de mandos. Un solo paso de deshacer.
      const sel = selectedAirbrushes();
      if (sel.length) {
        const snap = snapshot();
        state.selection.forEach(i => {
          const el = state.elements[i];
          if (!el || el.type !== 'airbrush') return;
          const copia = { ...el };
          if (modo === 'area' && state.airbrushArea) copia.clip = { ...state.airbrushArea };
          else delete copia.clip;
          state.elements[i] = copia;
        });
        pushUndo(snap);
        redraw();
      }
      savePrefs();
      // El rectángulo NO se borra al volver a «todo el lienzo»: volver a
      // «solo dentro de un área» lo recupera sin tener que dibujarlo otra vez.
      if (modo === 'area' && !state.airbrushArea) { armarArea(); return; }
      state.airbrushAreaPending = false;
      syncAirbrushControls();
      scheduleOverlay();
    });
    $('btn-airbrush-mark').addEventListener('click', armarArea);

    /* ── Tinta ── */

    // El cierre de huecos y el objetivo del clic son ajustes de herramienta,
    // como el tamaño del borrador: no editan nada dibujado, así que no entran
    // en el undo y se guardan en el acto.
    $('ink-gap').addEventListener('input', e => {
      state.inkGap = Math.min(12, Math.max(0, +e.target.value));
      $('ink-gap-val').textContent = String(state.inkGap);
    });
    $('ink-gap').addEventListener('change', savePrefs);
    $('ink-target').addEventListener('change', e => {
      state.inkTarget = e.target.value === 'zone' ? 'zone' : 'shape';
      savePrefs();
    });

    // Cuentagotas. Armarlo CIERRA el modal, y no es comodidad: un
    // <dialog showModal> deja inerte todo lo de detrás, así que pedir un clic
    // en el lienzo sin cerrarlo deja al usuario delante de una app que no
    // responde (el fallo de la v2.16.2).
    $('btn-ink-pick').addEventListener('click', () => {
      state.inkPicking = true;
      setInkStatus('Pulsa en el lienzo para tomar su color');
      updateCursor();
      $('modal-ink').close();
    });

    // Pintar de golpe todo lo seleccionado: un paso de undo para el lote.
    $('btn-ink-selection').addEventListener('click', () => {
      const shapes = selShapes();
      if (!shapes.length) { setInkStatus('No hay formas rellenables seleccionadas'); return; }
      const col = state.fillColor || state.color;
      saveUndo();
      shapes.forEach(i => {
        const copia = { ...state.elements[i], fill: true, fillColor: col };
        if (state.fillTransparent) {
          copia.fillTransparent = true;
          if (Number.isFinite(state.fillOpacity)) copia.fillOpacity = state.fillOpacity;
        } else {
          delete copia.fillTransparent;
          delete copia.fillOpacity;
        }
        state.elements[i] = copia;
      });
      setInkStatus(`Pintadas ${shapes.length} formas`);
      redraw();
      syncInkControls();
    });

    // Sustituir un color en toda la escena, trazo y relleno. También un solo
    // paso de undo: es una acción, no un gesto continuo.
    $('btn-ink-replace').addEventListener('click', () => {
      const viejo = $('ink-replace').value;
      const nuevo = hex6(state.fillColor || state.color);
      if (!viejo) return;
      if (viejo === nuevo) { setInkStatus('Ese color ya es el de la tinta'); return; }
      let tocados = 0;
      const snap = snapshot();
      state.elements = state.elements.map(el => {
        const cambia = hex6(el.color) === viejo ||
          (el.fillColor && hex6(el.fillColor) === viejo);
        if (!cambia) return el;
        tocados++;
        const copia = { ...el };
        if (hex6(el.color) === viejo) copia.color = nuevo;
        if (el.fillColor && hex6(el.fillColor) === viejo) copia.fillColor = nuevo;
        return copia;
      });
      if (!tocados) { state.elements = snap; setInkStatus('Ese color ya no está en el lienzo'); return; }
      pushUndo(snap);
      setInkStatus(`Sustituido en ${tocados} elemento${tocados > 1 ? 's' : ''}`);
      redraw();
      syncInkControls();
    });
    $('btn-airbrush-clear-area').addEventListener('click', () => {
      state.airbrushArea = null;
      state.airbrushAreaMode = 'all';
      state.airbrushAreaPending = false;
      savePrefs();
      syncAirbrushControls();
      scheduleOverlay();
    });

    // Tamaño de letra — semántica dual, como el grosor: con selección cambia
    // en vivo el fontSize de los `text` seleccionados (los demás tipos se
    // ignoran, no lo tienen); sin selección fija el default de creación. Era
    // el último control de aspecto sin la dualidad: un texto ya escrito solo
    // cambiaba de tamaño estirándolo con los tiradores. Mismo cierre de gesto
    // que el grosor: todo el deslizamiento cuenta como UN paso de undo, y se
    // remata también en pointerup por los gestos que acaban donde empezaron.
    // Con la herramienta Emoji activa, el mismo deslizador gobierna el tamaño
    // del EMOJI, no el de letra — el patrón del borrador con el de grosor
    // (applyEraserSize): desde que placeEmoji usa state.emojiSize, dejar aquí
    // fontSize convertía la sección «Texto» en un control muerto para el
    // Emoji, y antes de la 2.10.0 este deslizador SÍ mandaba sobre él
    // (auditoría v2.10.1). Punto único: los dos deslizadores (panel y
    // catálogo), el rótulo y el estado.
    function applyEmojiSize(v) {
      state.emojiSize = Math.min(EMOJI_MAX_SIZE, Math.max(EMOJI_MIN_SIZE, v));
      syncEmojiControls();
      $('font-slider').value = String(state.emojiSize);
      $('font-val').textContent = String(state.emojiSize);
    }
    let fontGestureSnap = null;
    const applyFontSize = v => {
      if (state.tool === TOOLS.EMOJI && !state.selection.length) {
        applyEmojiSize(v);
        return;
      }
      $('font-val').textContent = String(v);
      $('font-slider').value = String(v);
      $('text-modal-size').value = String(v);
      $('text-modal-size-val').textContent = String(v);
      const texts = state.selection.filter(i =>
        state.elements[i] && state.elements[i].type === 'text');
      if (texts.length) {
        if (!fontGestureSnap) fontGestureSnap = snapshot();
        texts.forEach(i => {
          state.elements[i] = { ...state.elements[i], fontSize: v };
        });
        redraw();
      } else if (!state.selection.length) {
        state.fontSize = v;
      }
      renderTextPreview();
    };
    function commitFontGesture() {
      if (!fontGestureSnap) return;
      const snap = fontGestureSnap;
      fontGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          el.fontSize === state.elements[i].fontSize);
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }
    ['font-slider', 'text-modal-size'].forEach(id => {
      $(id).addEventListener('input', e => applyFontSize(+e.target.value));
      $(id).addEventListener('change', commitFontGesture);
      $(id).addEventListener('pointerup', commitFontGesture);
      $(id).addEventListener('pointercancel', commitFontGesture);
    });
    // Con Emoji activo, el deslizador del panel escribe emojiSize: se persiste
    // al soltar, igual que hace el de grosor con el tamaño del borrador.
    $('font-slider').addEventListener('change', () => {
      if (state.tool === TOOLS.EMOJI && !state.selection.length) savePrefs();
    });

    /* ── Estilo del texto: negrita y sombra (v2.16.0) ────────────────────
       Los tres controles existen dos veces (panel y #modal-text) y siguen la
       semántica dual de siempre: con textos seleccionados los editan —un paso
       de undo por gesto—, y sin selección fijan el default de creación, que
       persiste en prefs. Un cuerpo por control, como los gemelos de
       Edificios; `selTexts()` es el filtro común, para que una selección sin
       textos no escriba NADA, ni elemento ni default. */
    const selTexts = () => state.selection.filter(i =>
      state.elements[i] && state.elements[i].type === 'text');

    /** Aplica `patch` a los textos seleccionados (un undo), o al default. */
    function applyTextStyle(patch, setDefault) {
      const texts = selTexts();
      if (texts.length) {
        saveUndo();
        texts.forEach(i => {
          const copy = { ...state.elements[i], ...patch };
          // Los campos que no dicen nada se BORRAN en vez de guardarse en
          // falso: así un texto sin negrita ni sombra vuelve a serializarse
          // exactamente como los de siempre y el JSON no engorda con
          // `bold:false` en cada elemento.
          if (copy.bold === false) delete copy.bold;
          if (copy.shadow === 'none') { delete copy.shadow; delete copy.shadowColor; }
          state.elements[i] = copy;
        });
      } else if (!state.selection.length) {
        setDefault();
      }
      syncTextControls();
      redraw();
    }

    const applyBold = on => applyTextStyle({ bold: on }, () => {
      state.textBold = on;
      savePrefs();
    });

    const applyTextShadowType = id => {
      const shadow = textShadowById(id).id;
      // Cambia el TIPO y nada más. Hasta la v2.16.3 estampaba también
      // `state.textShadowColor`, y eso pisaba el color propio del elemento:
      // con selección el picker de al lado escribe en el ELEMENTO y no en el
      // default (semántica dual), así que el state seguía en gris y pasar de
      // «suave» a «halo» revertía el rojo recién elegido. Sin color propio,
      // renderer y exportadores ya caen en DEFAULT_SHADOW_COLOR —que es
      // justo lo que el picker enseña para ese texto—, así que no estampar
      // nada es lo que mantiene de acuerdo al control con el dibujo. Al
      // CREAR sí se estampa, en textStyleDefaults(): ahí el default manda.
      applyTextStyle({ shadow }, () => {
        state.textShadow = shadow;
        savePrefs();
      });
    };

    // Todo el arrastre por el degradado es UN paso de undo, igual que el
    // color de trazo y el de relleno: el diálogo nativo dispara un 'input'
    // por cada tono que se pisa, y el saveUndo() por evento con el que nació
    // este control (v2.16.0) llenaba el historial de tonos intermedios y
    // expulsaba el trabajo anterior, que con el límite de 50 desaparecía sin
    // aviso. El default se persiste al cerrar el gesto, no en cada tono.
    let shadowColorGestureSnap = null;
    const applyTextShadowColor = hex => {
      // Solo tiñe los textos que YA tienen sombra: dársela a los que no la
      // llevan sería un efecto sorpresa desde un control de color.
      const texts = selTexts().filter(i => state.elements[i].shadow &&
        state.elements[i].shadow !== 'none');
      if (texts.length) {
        if (!shadowColorGestureSnap) shadowColorGestureSnap = snapshot();
        texts.forEach(i => {
          state.elements[i] = { ...state.elements[i], shadowColor: hex };
        });
      } else if (!state.selection.length) {
        state.textShadowColor = hex;
      }
      syncTextControls();
      redraw();
    };
    function commitTextShadowColorGesture() {
      if (!shadowColorGestureSnap) {
        if (!state.selection.length) savePrefs();
        return;
      }
      const snap = shadowColorGestureSnap;
      shadowColorGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          el.shadowColor === state.elements[i].shadowColor);
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }

    // Los dos selectores de sombra se rellenan desde TEXT_SHADOWS, nunca
    // duplicando el catálogo en el HTML.
    ['text-shadow', 'text-modal-shadow'].forEach(id => {
      const sel = $(id);
      TEXT_SHADOWS.forEach(sh => {
        const opt = document.createElement('option');
        opt.value = sh.id;
        opt.textContent = sh.name;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => applyTextShadowType(e.target.value));
    });
    ['check-bold', 'text-modal-bold'].forEach(id => {
      $(id).addEventListener('change', e => applyBold(e.target.checked));
    });
    ['text-shadow-color', 'text-modal-shadow-color'].forEach(id => {
      $(id).addEventListener('input', e => applyTextShadowColor(e.target.value));
      $(id).addEventListener('change', commitTextShadowColorGesture);
    });

    // Tamaño del emoji: propio (state.emojiSize), no el de letra — agrandar
    // un emoji no debe encoger el próximo texto. El min lo pone el HTML en
    // EMOJI_MIN_SIZE para que siga leyéndose como icono. Mismo punto único
    // (applyEmojiSize) que usa el deslizador del panel con Emoji activo.
    $('emoji-modal-size').addEventListener('input', e => applyEmojiSize(+e.target.value));
    $('emoji-modal-size').addEventListener('change', savePrefs);

    // Zoom slider
    $('zoom-slider').addEventListener('input', e => {
      zoomManual = true;
      applyZoom(+e.target.value / 100);
      updateBackContent();
    });

    // Encuadres (v3.5.0): el botón del panel es la vía de ratón de Mayús+1, y
    // el % clicable la de Ctrl+0 — micro-detalle de Excalidraw: el porcentaje
    // no es un rótulo, es el botón de volver al 100%.
    $('btn-zoom-fit').addEventListener('click', zoomToFitContent);
    $('zoom-val').addEventListener('click', () => {
      if (!canvasArea) return;
      const r = canvasArea.getBoundingClientRect();
      zoomAtClient(1, r.left + r.width / 2, r.top + r.height / 2);
    });
    $('btn-back-content').addEventListener('click', zoomToFitContent);

    // Fondo del lienzo
    $('canvas-bg-picker').value = state.canvasBg;
    $('canvas-bg-picker').addEventListener('input', e => {
      state.canvasBg = e.target.value;
      // Retocar un color a mano puede dejar de coincidir con el aspecto
      // marcado: la fila se recalcula para no seguir afirmando el anterior.
      updateCanvasPresetActive();
      savePrefs();
      redraw();
    });

    // Color de la cuadrícula
    $('grid-color-picker').value = state.gridColor;
    $('grid-color-picker').addEventListener('input', e => {
      state.gridColor = e.target.value;
      updateCanvasPresetActive();
      savePrefs();
      redraw();
    });

    // Letra manuscrita del lienzo, en sus dos sitios (panel y #modal-text).
    // Las opciones se construyen desde SKETCH_FONTS —no duplicadas en el
    // HTML, que es donde se desincronizan los catálogos— y cada una se
    // rotula CON SU PROPIA letra: en una lista de nombres es lo único que
    // distingue una manuscrita de otra antes de elegirla.
    SKETCH_FONT_SELECTS.forEach(id => {
      const sel = $(id);
      SKETCH_FONTS.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        opt.style.fontFamily = f.stack;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => {
        applySketchFont(e.target.value);
        savePrefs();
      });
    });

    // Checkboxes
    // Rellenar formas — semántica dual: con selección rellena/vacía las formas
    // seleccionadas (los demás tipos se ignoran); sin selección fija el default
    // de creación.
    // Las cuatro existen dos veces —panel y #modal-shape—, así que el cuerpo va
    // en una función y los dos juegos se enganchan a ella, como el discontinuo
    // y la doble punta. `selShapes()` es el filtro común: con una selección sin
    // formas rellenables el control no escribe NADA, ni elemento ni default.
    const selShapes = () =>
      state.selection.filter(i => FILLABLE_TYPES.includes(state.elements[i].type));

    const applyFill = on => {
      if (state.selection.length) {
        const shapes = selShapes();
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
      syncShapeControls();
    };
    ['check-fill', 'shape-modal-fill', 'prism-fill', 'pyramid-fill', 'frustum-fill', 'sphere-fill'].forEach(id => {
      $(id).addEventListener('change', e => {
        // Sobre un sólido no basta con marcar `fill`: sus CARAS son elementos y
        // sólo se emiten al crearlo, así que hay que volver a crearlo. Sin
        // esto, rellenar una figura dibujada en hueco sólo pintaba su cara
        // frontal y los lados quedaban fuera de alcance.
        if (regenerateSolid({ fill: e.target.checked })) {
          syncShapeControls();
          syncSolidControls();
          savePrefs();
          return;
        }
        applyFill(e.target.checked);
      });
    });

    // Relleno translúcido — semántica dual: sólido (off) o con la opacidad
    // elegida en el slider (on).
    const applyFillTransparent = on => {
      $('fill-opacity-slider').disabled = !on;
      if (state.selection.length) {
        const shapes = selShapes();
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
      syncShapeControls();
      if ($('modal-ink').open) syncInkControls();
    };
    ['check-fill-transparent', 'shape-modal-fill-transparent', 'ink-modal-fill-transparent',
      'prism-fill-transparent', 'pyramid-fill-transparent', 'frustum-fill-transparent', 'sphere-fill-transparent'].forEach(id => {
      $(id).addEventListener('change', e => applyFillTransparent(e.target.checked));
    });

    // Opacidad del relleno translúcido — 0..100% en UI, 0..1 en el modelo.
    // Como el grosor, todo el arrastre sobre una selección es un único undo.
    let fillOpacityGestureSnap = null;
    const applyFillOpacity = pct => {
      const opacity = pct / 100;
      $('fill-opacity-val').textContent = String(pct);
      $('fill-opacity-slider').value = String(pct);
      if (state.selection.length) {
        const shapes = selShapes();
        if (!shapes.length) return;
        if (!fillOpacityGestureSnap) fillOpacityGestureSnap = snapshot();
        shapes.forEach(i => {
          state.elements[i] = { ...state.elements[i], fillOpacity: opacity };
        });
        redraw();
      } else {
        state.fillOpacity = opacity;
      }
      syncShapeControls();
      if ($('modal-ink').open) syncInkControls();
    };
    $('fill-opacity-slider').addEventListener('input', e => applyFillOpacity(+e.target.value));

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
    ['fill-opacity-slider', 'shape-modal-opacity', 'ink-modal-opacity', 'prism-opacity', 'pyramid-opacity', 'frustum-opacity', 'sphere-opacity'].forEach(id => {
      $(id).addEventListener('change', commitFillOpacityGesture);
      $(id).addEventListener('pointerup', commitFillOpacityGesture);
      $(id).addEventListener('pointercancel', commitFillOpacityGesture);
    });
    ['shape-modal-opacity', 'prism-opacity', 'pyramid-opacity', 'frustum-opacity',
      'sphere-opacity'].forEach(id => {
      $(id).addEventListener('input', e => applyFillOpacity(+e.target.value));
    });

    // Color de relleno — misma semántica dual. Elegir un color implica querer
    // relleno, así que además lo activa (el checkbox sigue siendo el "off").
    // Como el grosor y la opacidad, todo el gesto es UN paso de undo: el
    // diálogo nativo dispara 'input' por cada tono que se pisa al arrastrar,
    // y un saveUndo() por evento expulsaba el historial entero (límite 50).
    let fillColorGestureSnap = null;
    const applyFillColor = col => {
      if (state.selection.length) {
        const shapes = selShapes();
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
      syncShapeControls();
      if ($('modal-ink').open) syncInkControls();
    };
    ['fill-color-picker', 'shape-modal-fill-color', 'ink-modal-fill-color',
      'prism-fill-color', 'pyramid-fill-color', 'frustum-fill-color', 'sphere-fill-color'].forEach(id => {
      $(id).addEventListener('input', e => applyFillColor(e.target.value));
      $(id).addEventListener('change', () => commitFillColorGesture());
    });
    // Las muestras de las paletas de relleno pasan por el mismo cuerpo y
    // cierran el gesto en el acto (ver buildFillColorGrid).
    fillSwatchApply = col => { applyFillColor(col); commitFillColorGesture(); };

    // Giro de la forma — semántica dual: con selección gira las formas
    // seleccionadas hasta ese ángulo; sin selección fija el de la próxima. Todo
    // el arrastre es UN paso de undo, como el grosor y la opacidad; antes el
    // único giro era el botón «Rotar selección», de un paso por clic, y llegar
    // a 288° en un pentágono costaba ocho pulsaciones sobre algo ya dibujado.
    let rotationGestureSnap = null;
    const applyShapeRotation = deg => {
      $('shape-modal-rotation-val').textContent = String(deg);
      if (state.selection.length) {
        const targets = state.selection.filter(
          i => ShapeRotation.isType(state.elements[i].type));
        if (!targets.length) return;
        if (!rotationGestureSnap) rotationGestureSnap = snapshot();
        targets.forEach(i => { state.elements[i] = rotateTo(state.elements[i], deg); });
        redraw();
      } else {
        state.shapeRotation = deg;
      }
      syncShapeControls();
    };
    function commitRotationGesture() {
      if (!rotationGestureSnap) return;
      const snap = rotationGestureSnap;
      rotationGestureSnap = null;
      const unchanged = snap.length === state.elements.length &&
        snap.every((el, i) => el === state.elements[i] ||
          (el.rotation || 0) === (state.elements[i].rotation || 0));
      if (unchanged) state.elements = snap;
      else pushUndo(snap);
    }
    $('shape-modal-rotation').addEventListener('input', e => applyShapeRotation(+e.target.value));
    $('shape-modal-rotation').addEventListener('change', commitRotationGesture);
    $('shape-modal-rotation').addEventListener('pointerup', commitRotationGesture);
    $('shape-modal-rotation').addEventListener('pointercancel', commitRotationGesture);
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
    // La casilla existe una vez en el panel y otra dentro de cada modal del
    // jardín: la decisión de rotular se toma al elegir qué se dibuja, que es
    // donde está el usuario, y el panel queda para retocarla sin soltar la
    // herramienta. syncGardenLabelControls() reparte el valor a todas.
    GARDEN_LABEL_CHECKS.forEach(id => {
      $(id).addEventListener('change', e => {
        state.gardenLabels = e.target.checked;
        syncGardenLabelControls();
        savePrefs();
      });
    });
    syncGardenLabelControls();
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
    // Muro: 4 ajustes propios del modal, sin gemelo en el panel —igual que
    // balconyType, exclusivos de esta herramienta—, así que basta un listener
    // por campo en vez del cableado por pares de Fachada/Camino.
    $('wall-material').addEventListener('change', e => {
      state.wallMaterial = e.target.value;
      syncWallControls();
      savePrefs();
    });
    $('wall-height').addEventListener('change', e => {
      state.wallHeight = Number(e.target.value);
      syncWallControls();
      savePrefs();
    });
    $('wall-railing').addEventListener('change', e => {
      state.wallRailing = e.target.checked;
      syncWallControls();
      savePrefs();
    });
    $('wall-railing-type').addEventListener('change', e => {
      state.wallRailingType = e.target.value;
      syncWallControls();
      savePrefs();
    });
    $('wall-railing-height').addEventListener('input', e => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      state.wallRailingHeight = Math.min(Building.WALL_RAIL_H_MAX,
        Math.max(Building.WALL_RAIL_H_MIN, v));
      syncWallControls();
      scheduleOverlay();
    });
    $('wall-railing-height').addEventListener('change', savePrefs);
    $('wall-gate-type').addEventListener('change', e => {
      state.wallGateType = e.target.value;
      syncWallControls();
      savePrefs();
    });
    // El alto de la cancela va al dedo (`input`) y se guarda al soltar
    // (`change`), como el ancho del camino.
    $('wall-gate-height').addEventListener('input', e => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      state.wallGateHeight = Math.min(Building.WALL_GATE_H_MAX,
        Math.max(Building.WALL_GATE_H_MIN, v));
      syncWallControls();
      scheduleOverlay();
    });
    $('wall-gate-height').addEventListener('change', savePrefs);
    syncWallControls();   // valores iniciales (tras restorePrefs)
    // Verjas: tipo y altura son ajustes propios; la vista se elige pulsando
    // uno de los dos botones del catálogo genérico.
    fillVariantSelect('fence-type', FORGE_TYPES);
    $('fence-type').addEventListener('change', e => {
      state.fenceType = FORGE_TYPES.some(item => item.id === e.target.value)
        ? e.target.value : 'spear';
      syncFenceControls();
      savePrefs();
    });
    $('fence-height').addEventListener('input', e => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      state.fenceHeightCm = Math.min(Building.FENCE_H_MAX_CM,
        Math.max(Building.FENCE_H_MIN_CM, v));
      syncFenceControls();
      scheduleOverlay();
    });
    $('fence-height').addEventListener('change', savePrefs);
    syncFenceControls();
    // 3D: los mismos cuatro deslizadores repetidos en cuatro modales, contra
    // un único estado. `input` mueve al dedo y `change` guarda, como el resto.
    SOLID_MODALS.forEach(cfg => {
      SOLID_FIELDS.forEach(f => {
        const input = $(`${cfg.prefix}-${f.id}`);
        if (!input || typeof input.addEventListener !== 'function') return;
        input.addEventListener('input', e => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          state[f.key] = Math.min(f.hi(), Math.max(f.lo(), v));
          syncSolidControls();
          scheduleOverlay();
        });
        // Con un sólido seleccionado, soltar el deslizador lo vuelve a crear
        // con el ajuste nuevo. Se hace en `change` y no en `input` a propósito:
        // regenerar por cada tic del arrastre apilaría decenas de pasos de
        // deshacer y expulsaría el historial (límite 50).
        input.addEventListener('change', () => {
          if (regenerateSolid({ [f.key]: state[f.key] })) syncSolidControls();
          savePrefs();
        });
      });
    });
    // El eje: un <select>, así que no cabe en SOLID_FIELDS (input/change
    // numérico). Lo comparten los dos remates que lo admiten, contra el mismo
    // estado —igual que la sección—, y regenera en el acto: no hay arrastre
    // que acumule pasos de deshacer.
    Solid.UPRIGHT_TOOLS.forEach(tool => {
      const cfg = SOLID_MODALS.find(c => c.tool === tool);
      const sel = cfg && $(`${cfg.prefix}-apex`);
      if (!sel || typeof sel.addEventListener !== 'function') return;
      sel.addEventListener('change', e => {
        state.solidApex = Solid.APEX_MODES.includes(e.target.value)
          ? e.target.value : 'depth';
        // Cambiar de proyección con una figura puesta la vuelve a crear
        // entera: no es un ajuste de trazo, es otra geometría.
        regenerateSolid({ solidApex: state.solidApex });
        syncSolidControls();
        scheduleOverlay();
        savePrefs();
      });
    });
    syncSolidControls();
    // Cancela independiente: todos los modelos comparten el mismo rango de
    // altura y las dos vistas arquitectónicas del catálogo.
    fillVariantSelect('gate-type', GATE_TYPES);
    $('gate-type').addEventListener('change', e => {
      state.gateType = GATE_TYPES.some(item => item.id === e.target.value)
        ? e.target.value : 'concave';
      syncGateControls();
      savePrefs();
    });
    $('gate-height').addEventListener('input', e => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      state.gateHeightCm = Math.min(Building.GATE_H_MAX_CM,
        Math.max(Building.GATE_H_MIN_CM, v));
      syncGateControls();
      scheduleOverlay();
    });
    $('gate-height').addEventListener('change', savePrefs);
    syncGateControls();
    // Doble punta — semántica dual: con selección aplica/quita heads:'both'
    // a las flechas seleccionadas (los no-flecha se ignoran); sin selección
    // fija el default para las nuevas flechas.
    // Ambas casillas existen dos veces —panel y #modal-stroke—, así que el
    // cuerpo vive en applyDoubleHead/applyDash (arriba) y los dos juegos de
    // controles se enganchan a la misma función, como hace wireBuildPair con
    // los gemelos de Edificios.
    ['check-double-head', 'stroke-modal-double'].forEach(id => {
      $(id).addEventListener('change', e => applyDoubleHead(e.target.checked));
    });
    ['check-dash', 'stroke-modal-dash'].forEach(id => {
      $(id).addEventListener('change', e => applyDash(e.target.checked));
    });
    // Presión simulada del lápiz: solo vive en #modal-stroke (que se abre al
    // elegir la herramienta, la vía primaria de la casa) — no hay gemela en
    // el panel porque el lápiz clásico no tenía allí ningún mando propio.
    $('stroke-modal-taper').addEventListener('change', e => applyTaper(e.target.checked));
    // Posición y tamaño exactos, en el panel y en los cuatro modales de
    // ajustes: cinco juegos de campos, un solo cuerpo (applyGeometry). En
    // 'change' y no en 'input': con 'input' cada tecla sería un paso de
    // deshacer y un salto de la figura mientras escribes. El prefijo viaja por
    // clausura — pasar applyGeometry a secas le colaría el evento como prefijo.
    GEO_PREFIXES.forEach(p => {
      ['-x', '-y', '-w', '-h'].forEach(sfx => {
        $(p + sfx).addEventListener('change', () => applyGeometry(p));
      });
    });
    // Texto del elemento (contenido de un `text`, rótulo de un componente UI).
    // Cuerpo compartido entre el campo del panel y su gemelo de #modal-ui: con
    // selección única edita el elemento; sin selección, fija el rótulo con el
    // que nacerán los próximos componentes (state.uiLabels, persistido).
    const applyLabel = v => {
      if (state.selection.length === 1) {
        const el = state.elements[state.selection[0]];
        const field = LABEL_FIELD(el);
        if (!field || (el[field] || '') === v) return;
        // Vaciar el contenido de un `text` lo BORRA, igual que hace el editor
        // de doble clic (commitText): dejarlo con value:'' fabricaba un
        // elemento invisible de caja cero, casi inencontrable (auditoría
        // v2.10.1). El rótulo vacío de un componente sí vale: vuelve al
        // default del renderer.
        if (field === 'value' && !v.trim()) {
          saveUndo();
          state.elements.splice(state.selection[0], 1);
          setSelection([]);
          redraw();
          return;
        }
        saveUndo();
        state.elements[state.selection[0]] = { ...el, [field]: v };
        redraw();
      } else if (!state.selection.length && state.uiLabels[state.tool] !== undefined) {
        // SOLO sin selección: con una multi-selección delante, escribir aquí
        // el default de creación era la única fuga de la semántica dual que
        // quedaba — el usuario creía renombrar los botones seleccionados y en
        // realidad cambiaba en silencio cómo nacerían los siguientes
        // (auditoría v2.10.1; syncUiControls además oculta la fila con
        // multi-selección). El recorte a 120 es el que ya aplica restorePrefs:
        // sin él, un rótulo más largo encogía en silencio al recargar.
        state.uiLabels[state.tool] = v.slice(0, 120);
        savePrefs();
        syncUiControls();
      }
    };
    $('el-label').addEventListener('change', e => applyLabel(e.target.value));
    $('ui-modal-label').addEventListener('change', e => applyLabel(e.target.value));

    // La cuadrícula se persiste desde la v2.31.0: es uno de los tres campos de
    // un aspecto, y sin guardarla el lienzo blanco liso reaparecía con rejilla
    // en la recarga siguiente (con los colores de blanco, o sea invisible pero
    // encendida y desmarcando el aspecto).
    $('check-grid').addEventListener('change', e => {
      state.showGrid = e.target.checked;
      updateCanvasPresetActive();
      savePrefs();
      redraw();
    });
    $('check-snap').addEventListener('change', e => { state.snapGrid = e.target.checked; });
    // «Los clics acumulan selección» es el ajuste de «Select» y vive en su
    // modal (v2.17.0), no en el panel: allí quedaba lejos del sidebar donde se
    // pulsa la herramienta y, por debajo de 1100px, dentro de un cajón oculto.
    $('select-modal-multi').addEventListener('change', e => {
      state.multiSelect = e.target.checked;
    });
    // Guías de alineación: al contrario que «Los clics acumulan», SÍ persiste
    // — es un modo de trabajo, no un estado transitorio de la sesión.
    $('select-modal-align').addEventListener('change', e => {
      state.alignGuides = e.target.checked;
      savePrefs();
    });

    // Undo / Redo
    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);

    // Clear
    $('btn-clear').addEventListener('click', () => {
      cancelCurveChain();
      saveUndo();
      state.elements = [];
      setSelection([]);
      // TODOS los ajustes vuelven de una vez, desde su única fuente. Antes esto
      // era una lista escrita a mano que se quedaba atrás con cada ajuste nuevo
      // —dieciséis sobrevivían al borrado— y, en los que se persisten, el
      // siguiente savePrefs() reescribía lo que el removeItem de abajo acababa
      // de borrar.
      // ...MENOS el ASPECTO del lienzo (papel, color de rejilla y si se ve).
      // Eso no es algo que se haya dibujado: es cómo tienes puesta la mesa de
      // trabajo, y quien eligió «Pizarra» o «Blanco» no quiere volver al azul
      // de fábrica cada vez que vacía el lienzo — el camino de vuelta son dos
      // colores que no están escritos en ninguna parte de la interfaz.
      const aspecto = {
        canvasBg:  state.canvasBg,
        gridColor: state.gridColor,
        showGrid:  state.showGrid,
      };
      Object.assign(state, appDefaults(), aspecto);
      state.airbrushAreaPending = false;   // transitorio: no está en los defaults
      // Y la herramienta vuelve al Lápiz, que es con la que arranca la app.
      // Con `silent`, como las activaciones automáticas de Mover: aquí nadie ha
      // pulsado la herramienta, así que abrirle sus ajustes encima del lienzo
      // recién vaciado sería un modal que nadie pidió.
      selectTool(TOOLS.PENCIL, { silent: true });
      syncAllControls();
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
      // El aspecto conservado se vuelve a dejar escrito EN EL ACTO, sin
      // confiar en que algún otro mando guarde después: acaba de borrarse
      // PREFS_KEY, y un aspecto que sólo viviera en `state` volvería al de
      // fábrica en la siguiente recarga.
      savePrefs();
      redraw();
    });

    // Selection actions
    $('btn-delete-sel').addEventListener('click', deleteSelection);
    $('btn-duplicate-sel').addEventListener('click', duplicateSelection);
    $('btn-z-front').addEventListener('click', () => reorderSelection('front'));
    $('btn-z-up').addEventListener('click', () => reorderSelection('up'));
    $('btn-z-down').addEventListener('click', () => reorderSelection('down'));
    $('btn-z-back').addEventListener('click', () => reorderSelection('back'));
    $('btn-edit-garden').addEventListener('click', editSelectedGarden);
    $('btn-rotate-sel').addEventListener('click', rotateSelection);

    // Import
    // «Abrir proyecto»: lee un .json de los que produce Exportar → JSON y
    // SUSTITUYE el lienzo con él — no fusiona. Se llamaba «Importar» a secas
    // y no decía ni qué formato abre ni que se lleva por delante lo que haya
    // (el usuario preguntó qué hacía el botón, v2.42.0).
    $('btn-import').addEventListener('click', async () => {
      const els = await Exporter.importJSON();
      if (els) {
        // Con el lienzo ocupado se pregunta: sí, `saveUndo` lo deja
        // recuperable con Ctrl+Z, pero enterarse DESPUÉS de que el dibujo ha
        // desaparecido no consuela a nadie. Vacío no hay nada que perder y no
        // se molesta. Diálogo nativo como los avisos del propio importJSON.
        const n = state.elements.length;
        if (n && !confirm(
          `Se sustituirá el dibujo actual (${n} elemento${n === 1 ? '' : 's'}) ` +
          'por el proyecto que vas a abrir. ¿Continuar?')) return;
        saveUndo();
        state.elements = withSeeds(els);
        state.overlapMode = els.overlapMode === 'hidden-dashed' ? 'hidden-dashed' : 'normal';
        $('overlap-mode').value = state.overlapMode;
        // Y el ASPECTO con el que se dibujó, si el archivo lo trae (v3.1.0).
        // Un dibujo hecho sobre «Pizarra» con tinta clara se abría sobre el
        // papel de quien lo abre —blanco, muchas veces— y el trazo se volvía
        // invisible. La AUSENCIA de estos campos (un JSON anterior, o de otra
        // herramienta) deja el aspecto como esté: no se inventa uno.
        if (els.canvasBg)  { state.canvasBg  = els.canvasBg;  $('canvas-bg-picker').value = els.canvasBg; }
        if (els.gridColor) { state.gridColor = els.gridColor; $('grid-color-picker').value = els.gridColor; }
        if (typeof els.showGrid === 'boolean') { state.showGrid = els.showGrid; $('check-grid').checked = els.showGrid; }
        updateCanvasPresetActive();
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

    // Espacio mantenido = pan (v3.5.0): mientras dure, el arrastre desplaza el
    // scroll en vez de dibujar. Acelerador, no única vía (regla de una mano):
    // el scroll nativo y el botón central hacen lo mismo sin teclado. El
    // preventDefault evita que el propio espacio haga scroll de página, y se
    // aplica también en las repeticiones (mantenerlo pulsado sigue generando
    // keydown con e.repeat).
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!spacePan) {
        spacePan = true;
        updateCursor();
      }
      return;
    }

    // Encuadres (v3.5.0): Mayús+1 ajusta el zoom a todo el dibujo, Mayús+2 a
    // la selección, Ctrl/Cmd+0 vuelve al 100%. Por e.code y no e.key: en el
    // teclado español Mayús+1 escribe «!», y el atajo es la tecla física,
    // como en Excalidraw. Sin conflicto con las herramientas 1/2/0, que van
    // sin modificador. Todos tienen vía de ratón: el botón «Encuadrar» del
    // panel, el slider y el % clicable.
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
        (e.code === 'Digit1' || e.code === 'Digit2')) {
      e.preventDefault();
      if (e.code === 'Digit1') zoomToFitContent();
      else if (state.selection.length) zoomToSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'Digit0') {
      // preventDefault obligatorio: Ctrl/Cmd+0 es el reset de zoom del propio
      // navegador, y aquí debe resetear el del lienzo, no el de la página.
      e.preventDefault();
      if (canvasArea) {
        const r = canvasArea.getBoundingClientRect();
        zoomAtClient(1, r.left + r.width / 2, r.top + r.height / 2);
      }
      return;
    }

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
      // Silencioso: un atajo de teclado no debe sacar un diálogo que, encima,
      // deja inerte el lienzo que se acaba de seleccionar entero.
      selectTool(TOOLS.SELECT, { silent: true });
      setSelection(state.elements.map((el, i) => el.type === 'eraser' ? -1 : i).filter(i => i >= 0));
      redraw();
      return;
    }

    // Orden Z con Ctrl/Cmd+↑/↓ (v2.39.0): un paso, y con Shift a los
    // extremos. Flechas y no corchetes a propósito: en el teclado español
    // `[`/`]` exigen AltGr (Option en Mac), tres dedos para lo que Excalidraw
    // resuelve con dos — y la regla de una mano manda. Corre ANTES del nudge
    // (que solo atiende flechas sin modificador, pero mejor no depender del
    // orden) y filtra el auto-repeat como él: mantener la tecla apilaría
    // decenas de pasos de undo.
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        (e.ctrlKey || e.metaKey) && state.selection.length) {
      e.preventDefault();
      if (e.repeat) return;
      const up = e.key === 'ArrowUp';
      reorderSelection(e.shiftKey ? (up ? 'front' : 'back') : (up ? 'up' : 'down'));
      return;
    }

    // ←/→ giran la selección cuando TODA ella guarda su orientación como
    // ángulo (polígonos regulares, estrellas y trapecio): una pulsación, una
    // orientación válida, en el sentido de la flecha. Es lo que se quiere hacer
    // con una de estas formas nada más dibujarla, y Shift+R —el único camino
    // hasta ahora— gira en un solo sentido y hay que acordarse de él.
    //
    // Se cobra el nudge horizontal SOLO de esas formas (queda el ratón, ↑/↓ y
    // los campos X/Y del panel), y por eso exige que TODA la selección sea
    // rotable: con un rectángulo o un texto dentro, las cuatro flechas siguen
    // moviendo, o mover un grupo mixto dependería de qué contiene.
    // Rect/roundedRect quedan fuera a propósito pese a estar en ShapeRotation:
    // ahí «girar» es intercambiar ancho y alto, y perder su nudge a cambio de
    // eso no compensa.
    //
    // Y desde la v2.25.0 también giran una FIGURA COMPUESTA —un sólido 3D, un
    // edificio, un árbol—: sus piezas comparten `buildingGroupId`, así que la
    // selección es la figura entera y girarla es lo que uno espera de ella.
    // Paga el mismo precio, su nudge horizontal, con el mismo consuelo: ↑/↓,
    // el ratón y los campos X/Y del panel la siguen moviendo.
    const grupoCompuesto = state.selection.length > 1 &&
      state.elements[state.selection[0]].buildingGroupId &&
      state.selection.every(i => state.elements[i].buildingGroupId ===
        state.elements[state.selection[0]].buildingGroupId);
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.selection.length &&
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        (grupoCompuesto ||
          state.selection.every(i => ROTATABLE_TOOLS.includes(state.elements[i].type)))) {
      e.preventDefault();
      // Mismo freno que el nudge y los toggles: sin filtrar el auto-repeat,
      // mantener la flecha apila ~30 pasos de undo por segundo y expulsa el
      // historial entero (límite 50). Aquí además la forma daría vueltas.
      if (e.repeat) return;
      rotateSelection(e.key === 'ArrowRight' ? 1 : -1);
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
      // Mismo freno que el arrastre: mantener una flecha pulsada sacaba la
      // selección del lienzo igual de irrecuperablemente, solo que despacio.
      moveSelectionBy(NUDGE[e.key][0] * f, NUDGE[e.key][1] * f);
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
        let sVal = state.curveBulge * len;
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
      // Si la anterior era OTRO catálogo, ir a Seleccionar: reabrirlo dejaría
      // al usuario eligiendo variante otra vez, que no es lo que pidió al
      // cancelar. Si solo abre sus ajustes (Borrador, dibujo, Formas), se vuelve
      // a ella en modo `silent`: recupera su herramienta sin encadenar un
      // segundo modal encima del que se acaba de cerrar. Antes de las
      // v2.9.0 esa distinción no hacía falta porque casi ninguna herramienta
      // abría nada; mandar a Seleccionar a todas sería el camino fácil y peor.
      if (opensVariantModal(prev)) selectTool(TOOLS.SELECT, { silent: true });
      else selectTool(prev, { silent: true });
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
        // El aspecto se manda SIEMPRE y es el exportador quien decide: solo el
        // JSON —el formato que se vuelve a abrir— lo escribe; los cuatro
        // dibujos lo ignoran y salen sobre blanco limpio (guardado por
        // «ninguna exportación lleva el color del lienzo ni la cuadrícula»).
        Exporter[btn.dataset.export](state.elements, {
          overlapMode: state.overlapMode,
          canvasBg:    state.canvasBg,
          gridColor:   state.gridColor,
          showGrid:    state.showGrid,
        });
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
    buildHelpIndex();
    $('btn-help').addEventListener('click', () => helpModal.showModal());
    helpModal.querySelector('.modal__cancel').addEventListener('click', () => helpModal.close());
    closeOnBackdrop(helpModal);
    $('help-search').addEventListener('input', e => filterHelp(e.target.value));
    // Un <dialog showModal> enfoca su primer control, que ahora es este campo
    // —bien: la ayuda se abre lista para escribir—, pero el atajo global «?»
    // se rinde en cuanto el foco está en un input (la primera guarda del
    // keydown), así que dejó de poder CERRAR la ayuda que él mismo abre.
    // Se resuelve aquí, en local: buscar «?» en la ayuda no significa nada,
    // y el atajo documentado tiene que seguir funcionando.
    $('help-search').addEventListener('keydown', e => {
      if (e.key === '?') {
        e.preventDefault();
        helpModal.close();
      }
    });
    // Al cerrar se limpia el filtro: reabrir la ayuda y encontrarse media
    // página oculta por una búsqueda de hace media hora se lee como que la
    // ayuda ha encogido. `close` cubre las tres salidas (botón, Escape y
    // clic en el fondo), así que no hay que acordarse en cada una.
    helpModal.addEventListener('close', () => {
      $('help-search').value = '';
      filterHelp('');
    });

    const eraserModal = $('modal-eraser');
    eraserModal.querySelector('.modal__cancel').addEventListener('click', () => eraserModal.close());
    closeOnBackdrop(eraserModal);

    // Aerógrafo: el mismo par de líneas obligatorio. Un diálogo sin ellas no se
    // puede cerrar, y un <dialog showModal> abierto deja inerte el lienzo
    // entero — la app bloqueada. Tampoco pasa por wireBuildModalCancel: no hay
    // variante que elegir, así que cerrar deja la herramienta puesta.
    const airbrushModal = $('modal-airbrush');
    airbrushModal.querySelector('.modal__cancel').addEventListener('click', () => airbrushModal.close());
    closeOnBackdrop(airbrushModal);

    // Tinta: misma pareja obligatoria. Tampoco está en opensVariantModal —
    // cerrar deja el bote puesto, no hay variante que cancelar.
    const inkModal = $('modal-ink');
    inkModal.querySelector('.modal__cancel').addEventListener('click', () => inkModal.close());
    closeOnBackdrop(inkModal);

    // Esfera: los otros tres modales de 3D reciben «Cerrar» y el clic fuera en
    // el bucle de VARIANT_MODALS, pero la Esfera no está ahí (no tiene sección
    // que elegir), así que necesita la misma pareja de líneas obligatoria.
    const sphereModal = $('modal-sphere');
    sphereModal.querySelector('.modal__cancel').addEventListener('click', () => sphereModal.close());
    closeOnBackdrop(sphereModal);

    // Ajustes de «Select»: mismo contrato de cierre que el del borrador. Cada
    // modal cablea el suyo, así que un diálogo nuevo sin esta pareja de líneas
    // no se puede cerrar — y un <dialog showModal> abierto deja inerte el
    // lienzo entero, que es la app entera bloqueada (ver v2.16.2 en BUGS.md).
    const selectModal = $('modal-select');
    selectModal.querySelector('.modal__cancel').addEventListener('click', () => selectModal.close());
    closeOnBackdrop(selectModal);

    // Ajustes de trazo: como el del borrador, se cierra sin devolver a la
    // herramienta anterior, así que tampoco pasa por wireBuildModalCancel.
    const strokeModal = $('modal-stroke');
    strokeModal.querySelector('.modal__cancel').addEventListener('click', () => strokeModal.close());
    closeOnBackdrop(strokeModal);

    const shapeModal = $('modal-shape');
    shapeModal.querySelector('.modal__cancel').addEventListener('click', () => shapeModal.close());
    closeOnBackdrop(shapeModal);

    // Texto y componente UI: mismo contrato de cierre que trazo y forma.
    const textModal = $('modal-text');
    textModal.querySelector('.modal__cancel').addEventListener('click', () => textModal.close());
    closeOnBackdrop(textModal);

    const uiModal = $('modal-ui');
    uiModal.querySelector('.modal__cancel').addEventListener('click', () => uiModal.close());
    closeOnBackdrop(uiModal);

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
      if (cfg.plant) installPlantControls(cfg);
      buildVariantCatalog(cfg);
      if (cfg.plant) syncPlantControls(cfg);
      modal.querySelector('.modal__cancel').addEventListener('click', () => modal.close());
      closeOnBackdrop(modal);
      wireBuildModalCancel(modal);
      if (cfg.plant) modal.addEventListener('close', () => {
        // Elegir una variante ya ha consumido el id en regenerateGardenGroup;
        // cualquier id restante corresponde a Cerrar/Escape/backdrop.
        state.editGardenGroupId = null;
      });
      modal.addEventListener('click', e => {
        const btn = e.target.closest('.' + cfg.cls);
        if (!btn) return;
        state[cfg.key] = btn.dataset[cfg.data];
        state.variantChosen = true;
        if (cfg.plant) regenerateGardenGroup(cfg);
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
  /* Caja del icono de una especie: su proporción botánica, pero nunca por
     debajo de ICON_MIN_SPAN px de lado mayor.

     El clic sin arrastre daba la caja en píxeles reales (diámetro × escala), y
     a 20 px/m una campanilla de 0,25 m salía en 5 px. A ese tamaño mandan los
     `Math.max(1.2, …)` con que la geometría evita pétalos invisibles: todos los
     detalles se igualan al suelo, se solapan, y el ajuste a bounds amplía esa
     mancha hasta llenar el icono. Dos especies distintas acababan siendo el
     mismo borrón —y no es un problema de las nuevas: la caléndula, el tomillo o
     la boca de dragón llevaban el mismo borrón desde la 2.7.0—.

     Se amplía manteniendo la relación alto/ancho, que es lo que el icono
     promete: el ciprés sigue saliendo fastigiado y el tomillo tapizante. */
  const ICON_MIN_SPAN = 64;

  function plantIconBox(cfg, variantId, opts) {
    const size = Garden.plantSize(cfg.tool, variantId, opts);
    if (!size) return { x: 0, y: 0 };
    const w = size.spreadM;
    const h = opts.plantView === 'elevation' ? size.heightM : size.depthM;
    if (!(w > 0) || !(h > 0)) return { x: 0, y: 0 };
    const k = ICON_MIN_SPAN / Math.max(w, h);
    return { x: w * k, y: h * k };
  }

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
    /* Las plantas no pueden compartir la caja fija del resto de catálogos:
       esa caja convertía un ciprés de 18 × 4 m en un óvalo casi redondo y
       hacía que un tomillo pareciera tan alto como una lavanda. Un clic sin
       arrastre delega en Garden._plantDefault(), que conserva altura,
       diámetro, etapa y escala botánicos. El ajuste a los bounds de abajo ya
       se encarga de meter después cada proporción en los 56 × 48 px. */
    const origin = { x: 0, y: 0 };
    const end = cfg.plant ? plantIconBox(cfg, variantId, opts) : cfg.box;
    const els = cfg.gen().elements(cfg.tool, origin, end, opts);
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
      if (item.botanical) {
        const note = document.createElement('small');
        note.className = 'modal__shape-note modal__shape-note--botanical';
        const stage = Garden.plantSize(cfg.tool, item.id, cfg.opts());
        note.textContent = stage
          ? `${item.botanical} · H ${formatMetres(stage.heightM)} m · Ø ${formatMetres(stage.spreadM)} m`
          : item.botanical;
        btn.appendChild(note);
      }
      // El <dialog> enfoca solo su primer control; se le señala el activo para
      // que la tecla que abrió el modal no acabe escribiendo en otro sitio.
      if (item.id === state[cfg.key]) btn.autofocus = true;
      grid.appendChild(btn);
    });
    root.appendChild(grid);
    updateVariantActive(cfg);
  }

  const formatMetres = n => Number(n.toFixed(n < 1 ? 2 : 1)).toLocaleString('es-ES');

  /** Controles compartidos por Árbol, Arbusto, Flor, Aromáticas y Trepadoras.
      Se crean desde la tabla para que los cinco modales no puedan divergir. */
  function installPlantControls(cfg) {
    const modal = $(cfg.modal), root = $(cfg.root);
    const controlId = name => `${cfg.data}-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`;
    const wrap = document.createElement('div');
    wrap.className = 'modal__build modal__plant-build';
    wrap.dataset.plantControls = '';

    const preview = document.createElement('canvas');
    preview.className = 'modal__preview modal__plant-preview';
    preview.width = 176; preview.height = 168;
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', 'Vista previa botánica con los ajustes actuales');
    wrap.appendChild(preview);

    const fields = document.createElement('div');
    fields.className = 'modal__build-fields modal__plant-fields';
    const selectField = (caption, values, dataName) => {
      const label = document.createElement('label');
      label.className = 'panel__field modal__plant-field modal__plant-field--' +
        dataName.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      const span = document.createElement('span');
      span.className = 'modal__field-label'; span.textContent = caption;
      const select = document.createElement('select');
      select.className = 'panel__select'; select.dataset[dataName] = '';
      select.id = controlId(dataName);
      values.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id; opt.textContent = item.name; select.appendChild(opt);
      });
      label.appendChild(span); label.appendChild(select); fields.appendChild(label);
      return select;
    };
    const view = selectField('Representación', GARDEN_PLANT_VIEWS, 'plantView');
    const stage = selectField('Etapa', GARDEN_STAGES, 'plantStage');
    const labelMode = selectField('Etiqueta', GARDEN_LABEL_MODES, 'plantLabelMode');

    const rangeField = (caption, min, max, step, dataName) => {
      const label = document.createElement('label');
      label.className = 'panel__field';
      const span = document.createElement('span');
      span.className = 'modal__field-label';
      const value = document.createElement('strong'); value.dataset[`${dataName}Value`] = '';
      span.textContent = caption + ': '; span.appendChild(value);
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'panel__slider'; input.min = min;
      input.max = max; input.step = step; input.dataset[dataName] = '';
      input.id = controlId(dataName);
      label.appendChild(span); label.appendChild(input); fields.appendChild(label);
      return { input, value };
    };
    const scale = rangeField('Tamaño', Garden.PLANT_SCALE_MIN, Garden.PLANT_SCALE_MAX, 5, 'plantScale');
    const px = rangeField('Escala', Garden.PLANT_PX_PER_M_MIN, Garden.PLANT_PX_PER_M_MAX, 1, 'plantPx');

    const colorLabel = document.createElement('label');
    colorLabel.className = 'panel__check modal__plant-color';
    const color = document.createElement('input');
    color.type = 'checkbox'; color.dataset.plantNatural = '';
    color.id = controlId('plantNatural');
    colorLabel.appendChild(color);
    const colorText = document.createElement('span');
    colorText.textContent = 'Color natural y volumen suave';
    colorLabel.appendChild(colorText);
    fields.appendChild(colorLabel);

    // «Etiquetas»: gemela de la del panel «Jardín». Va junto al selector de
    // modo porque son el mismo asunto —si no se rotula, elegir entre nombre
    // común, botánico o cotas no significa nada— y aquí es donde el usuario
    // está al elegir la especie. El id sigue la convención de las escritas a
    // mano en index.html: `<data>-garden-labels`.
    const labelsRow = document.createElement('label');
    labelsRow.className = 'panel__check modal__plant-color';
    const labels = document.createElement('input');
    labels.type = 'checkbox';
    labels.checked = state.gardenLabels;
    labels.id = `${cfg.data}-garden-labels`;
    labelsRow.appendChild(labels);
    const labelsText = document.createElement('span');
    labelsText.textContent = 'Etiquetas';
    labelsRow.appendChild(labelsText);
    fields.appendChild(labelsRow);

    const dimensions = document.createElement('p');
    dimensions.className = 'modal__plant-dimensions'; dimensions.setAttribute('aria-live', 'polite');
    dimensions.id = controlId('plantDimensions');
    fields.appendChild(dimensions);
    wrap.appendChild(fields);
    $(cfg.root + '-controls').appendChild(wrap);

    cfg.plantControls = { preview, view, stage, labelMode, scale, px, color, labels, dimensions };
    const changed = () => {
      state.plantView = view.value;
      state.plantStage = stage.value;
      state.gardenLabelMode = labelMode.value;
      state.plantScalePct = Number(scale.input.value);
      state.plantPxPerM = Number(px.input.value);
      state.plantColorMode = color.checked ? 'natural' : 'ink';
      state.gardenLabels = labels.checked;
      syncGardenLabelControls();   // la gemela del panel y las de los otros modales
      buildVariantCatalog(cfg);
      syncPlantControls(cfg);
      savePrefs();
    };
    [view, stage, labelMode, scale.input, px.input, color, labels].forEach(control => {
      control.addEventListener(control.type === 'range' ? 'input' : 'change', changed);
    });

    let hoverId = null;
    const hover = e => {
      const btn = e.target.closest && e.target.closest('.' + cfg.cls);
      const id = btn ? btn.dataset[cfg.data] : null;
      if (id === hoverId) return;
      hoverId = id;
      renderPlantPreview(cfg, id || state[cfg.key]);
    };
    modal.addEventListener('pointerover', hover);
    modal.addEventListener('focusin', hover);
    modal.addEventListener('pointerleave', () => {
      hoverId = null; renderPlantPreview(cfg, state[cfg.key]);
    });
    modal.addEventListener('close', () => { hoverId = null; });
  }

  function renderPlantPreview(cfg, variantId) {
    if (!cfg.plantControls) return;
    const { preview, dimensions } = cfg.plantControls;
    const pctx = preview.getContext('2d');
    if (!pctx) return;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, preview.width, preview.height);
    const opts = { ...cfg.opts(), [cfg.key]: variantId, labels: false };
    const els = Garden.elements(cfg.tool, { x: 0, y: 0 }, { x: 0, y: 0 }, opts);
    if (els.length) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      els.forEach(el => {
        const b = getElementBounds(el);
        x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
        x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
      });
      const pad = 14;
      const s = Math.min((preview.width - pad * 2) / Math.max(1, x2 - x1),
        (preview.height - pad * 2) / Math.max(1, y2 - y1));
      pctx.save();
      pctx.translate(preview.width / 2, preview.height / 2);
      pctx.scale(s, s);
      pctx.translate(-(x1 + x2) / 2, -(y1 + y2) / 2);
      drawPiecesPreview(pctx, els.map(el => ({ ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s) })));
      pctx.restore();
    }
    const size = Garden.plantSize(cfg.tool, variantId, opts);
    const item = cfg.catalog.find(v => v.id === variantId);
    dimensions.textContent = size && item
      ? `${item.name} · ${item.botanical} · ${formatMetres(size.heightM)} m de alto · ${formatMetres(size.spreadM)} m de diámetro`
      : '';
  }

  function syncPlantControls(cfg) {
    if (!cfg.plantControls) return;
    const c = cfg.plantControls;
    c.view.value = state.plantView;
    c.stage.value = state.plantStage;
    c.labelMode.value = state.gardenLabelMode;
    c.scale.input.value = state.plantScalePct;
    c.scale.value.textContent = `${state.plantScalePct}%`;
    c.px.input.value = state.plantPxPerM;
    c.px.value.textContent = `${state.plantPxPerM} px/m`;
    c.color.checked = state.plantColorMode === 'natural';
    syncGardenLabelControls();
    renderPlantPreview(cfg, state[cfg.key]);
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

  /**
   * Sincroniza los 4 ajustes propios de Muro (material/altura/verja/puerta,
   * sin gemelo en el panel) y repinta la miniatura. Se llama al abrir el
   * modal y tras cada cambio de campo — mismo papel que syncPathControls.
   */
  function syncWallControls() {
    $('wall-material').value = state.wallMaterial;
    $('wall-height').value = String(state.wallHeight);
    $('wall-railing').checked = state.wallRailing;
    $('wall-railing-type').value = state.wallRailingType;
    $('wall-railing-height').value = String(state.wallRailingHeight);
    $('wall-railing-height-val').textContent = state.wallRailingHeight.toFixed(1).replace('.', ',');
    $('wall-gate-type').value = state.wallGateType;
    $('wall-gate-height').value = String(state.wallGateHeight);
    $('wall-gate-height-val').textContent = state.wallGateHeight.toFixed(1).replace('.', ',');
    renderWallPreview();
  }

  const WALL_PREVIEW_W = 176, WALL_PREVIEW_H = 168;  // los de .modal__preview
  const WALL_SAMPLE_LEN = 160;

  /** Miniatura del muro: mismo patrón que renderFacadePreview/renderPathPreview
      —geometría real vía Building.elements + drawPiecesPreview, encajada por
      bounds reales, papel del color real del lienzo—. */
  function renderWallPreview() {
    const cv = $('wall-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    if (!pctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(WALL_PREVIEW_W * dpr)) {
      cv.width = Math.round(WALL_PREVIEW_W * dpr);
      cv.height = Math.round(WALL_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, WALL_PREVIEW_W, WALL_PREVIEW_H);

    const els = Building.elements(
      TOOLS.BUILD_WALL, { x: 0, y: 0 }, { x: WALL_SAMPLE_LEN, y: 0 }, buildOpts(),
    );
    if (!els.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 12;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((WALL_PREVIEW_W - 2 * pad) / bw, (WALL_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate(
      (WALL_PREVIEW_W - bw * s) / 2 - minX * s,
      (WALL_PREVIEW_H - bh * s) / 2 - minY * s,
    );
    pctx.scale(s, s);
    drawPiecesPreview(pctx, els.map(el => ({ ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s) })));
    pctx.restore();
  }

  /** Sincroniza y previsualiza la herramienta Verjas. La altura se conserva
      en centímetros de proyecto (0–350), sin conversiones visibles a metros. */
  function syncFenceControls() {
    $('fence-type').value = state.fenceType;
    $('fence-height').value = String(state.fenceHeightCm);
    $('fence-height-val').textContent = String(Math.round(state.fenceHeightCm));
    renderFencePreview();
  }

  /* Los cuatro modales de 3D llevan los mismos mandos, así que se sirven con
     UN solo cuerpo sobre una tabla de prefijos —el patrón de GEO_PREFIXES, que
     ya sirve cinco juegos de campos de posición— en vez de cuatro parejas
     sync/render condenadas a divergir. No todos tienen todos: la esfera no
     tiene fondo que graduar (su ecuador sale del ángulo y el escorzo) y sólo
     el tronco tiene tapa; los que faltan simplemente no están en el HTML. */
  const SOLID_MODALS = [
    { tool: TOOLS.SOLID_PRISM,   prefix: 'prism',   modal: 'modal-prism' },
    { tool: TOOLS.SOLID_PYRAMID, prefix: 'pyramid', modal: 'modal-pyramid' },
    { tool: TOOLS.SOLID_FRUSTUM, prefix: 'frustum', modal: 'modal-frustum' },
    // El único que no está en VARIANT_MODALS: no tiene sección que elegir
    { tool: TOOLS.SOLID_SPHERE,  prefix: 'sphere',  modal: 'modal-sphere', ownModal: true },
  ];

  /** ¿Hay algún modal de 3D abierto? Con un `<dialog showModal>` delante el
      lienzo está inerte, así que repintar sus miniaturas mientras está abierto
      no compite con nada; cerrado, no se toca. */
  const solidModalOpen = () => SOLID_MODALS.some(cfg => {
    const m = $(cfg.modal);
    return m && m.open;
  });

  /** Los topes salen del módulo, no se reescriben aquí: tests/smoke.test.js
      comprueba que coinciden con los min/max de los deslizadores del HTML. */
  const SOLID_FIELDS = [
    { id: 'depth',       key: 'solidDepth',       lo: () => Solid.DEPTH_MIN,       hi: () => Solid.DEPTH_MAX },
    { id: 'angle',       key: 'solidAngle',       lo: () => Solid.ANGLE_MIN,       hi: () => Solid.ANGLE_MAX },
    { id: 'foreshorten', key: 'solidForeshorten', lo: () => Solid.FORESHORTEN_MIN, hi: () => Solid.FORESHORTEN_MAX },
    { id: 'taper',       key: 'solidTaper',       lo: () => Solid.TAPER_MIN,       hi: () => Solid.TAPER_MAX },
    // El giro no se vuelca aquí (lo hace syncSolidRotation, que además ajusta
    // el paso), pero sí se cablea: comparte el mismo contrato de input/change.
    { id: 'rotation',    key: 'solidRotation',    lo: () => 0,                     hi: () => 359, skipSync: true },
  ];

  const SOLID_PREVIEW_W = 176, SOLID_PREVIEW_H = 168;

  /** Punto único que vuelca `state` en los mandos de los cuatro modales y
      repinta sus miniaturas. Mismo contrato que syncWallControls(). */
  function syncSolidControls() {
    // Trazo y relleno tienen la semántica dual de siempre: con una selección
    // enseñan lo suyo, sin ella los valores con los que nacerá el próximo
    // sólido.
    //
    // Se lee con `commonOf` y NO del único elemento seleccionado, porque un
    // sólido son SIEMPRE varias piezas: con la lectura de uno solo esto caía a
    // los defaults, y como corre en cada repintado volvía a desmarcar la
    // casilla de relleno justo después de marcarla. Es el mismo fallo que tuvo
    // syncStrokeControls en la v2.16.3.
    const sel = state.selection.map(i => state.elements[i]).filter(Boolean);
    const rellenables = sel.filter(el => FILLABLE_TYPES.includes(el.type));
    const comun = (lista, get, porDefecto) => {
      if (!lista.length) return porDefecto;
      const v = commonOf(lista, get);
      return v === undefined ? porDefecto : v;
    };
    const width = comun(sel, el => el.lineWidth, state.lineWidth);
    const color = hex6(comun(sel, el => hex6(el.color), hex6(state.color)));
    const on = comun(rellenables, el => el.fill === true, state.fillShapes);
    const transparent = comun(rellenables,
      el => el.fillTransparent === true, state.fillTransparent);
    const pct = Math.round(comun(rellenables,
      el => (el.fillOpacity !== undefined ? el.fillOpacity : 0.4), state.fillOpacity) * 100);
    const fillColor = hex6(comun(rellenables,
      el => hex6(el.fillColor || el.color), hex6(state.fillColor || state.color)));

    SOLID_MODALS.forEach(cfg => {
      const p = cfg.prefix;
      SOLID_FIELDS.forEach(f => {
        if (f.skipSync) return;
        const input = $(`${p}-${f.id}`);
        if (input) input.value = String(state[f.key]);
        const out = $(`${p}-${f.id}-val`);
        if (out) out.textContent = String(Math.round(state[f.key]));
      });
      _set(`${p}-stroke`, 'value', String(width));
      _text(`${p}-stroke-val`, String(width));
      _set(`${p}-color`, 'value', color);
      _set(`${p}-fill`, 'checked', on);
      _set(`${p}-fill-transparent`, 'checked', transparent);
      _set(`${p}-opacity`, 'value', String(pct));
      _text(`${p}-opacity-val`, String(pct));
      _set(`${p}-opacity`, 'disabled', !transparent);
      _set(`${p}-fill-color`, 'value', fillColor);
      syncSolidRotation(cfg);
      _set(`${p}-apex`, 'value', state.solidApex);
      renderSolidPreview(cfg);
    });
    // Las paletas del relleno enseñan lo mismo que su selector de al lado, y
    // van por clase: una sola llamada cubre las cinco.
    updateFillColorActive(fillColor);
  }

  const _set = (id, prop, value) => { const n = $(id); if (n) n[prop] = value; };
  const _text = (id, value) => { const n = $(id); if (n) n.textContent = value; };

  /** El paso del giro lo manda la SECCIÓN, así que el deslizador se
      reconfigura al cambiarla: 36° no es una orientación válida de un
      hexágono, y un trapecio fuera del cuarto de vuelta lo rechaza la
      validación al reimportar. El rectángulo, el redondeado y el círculo no
      guardan ángulo —ahí girar es intercambiar ancho y alto—, así que su fila
      desaparece en vez de prometer algo que no haría nada. */
  function syncSolidRotation(cfg) {
    const row = $(`${cfg.prefix}-rotation-row`);
    if (!row) return;                       // la esfera no tiene sección
    const rotable = Solid.isRotatableSection(state.solidSection);
    row.hidden = !rotable;
    if (!rotable) return;
    const step = ShapeRotation.step(state.solidSection) || 90;
    const snapped = ShapeRotation.normalize(
      Math.round(state.solidRotation / step) * step);
    state.solidRotation = snapped;
    const slider = $(`${cfg.prefix}-rotation`);
    if (slider) {
      slider.step = String(step);
      slider.max = String(360 - step);
      slider.value = String(snapped);
    }
    _text(`${cfg.prefix}-rotation-val`, String(snapped));
  }

  /** Miniatura de un sólido: geometría real vía Solid.elements +
      drawPiecesPreview, encajada por bounds reales, papel del color real del
      lienzo. Mismo patrón que renderWallPreview/renderPathPreview. */
  function renderSolidPreview(cfg) {
    const cv = $(`${cfg.prefix}-preview`);
    if (!cv || typeof cv.getContext !== 'function') return;
    const pctx = cv.getContext('2d');
    if (!pctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(SOLID_PREVIEW_W * dpr)) {
      cv.width = Math.round(SOLID_PREVIEW_W * dpr);
      cv.height = Math.round(SOLID_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, SOLID_PREVIEW_W, SOLID_PREVIEW_H);

    const els = Solid.elements(cfg.tool, { x: 0, y: 60 }, { x: 60, y: 0 }, solidOpts());
    if (!els.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 12;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((SOLID_PREVIEW_W - 2 * pad) / bw, (SOLID_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate(
      (SOLID_PREVIEW_W - bw * s) / 2 - minX * s,
      (SOLID_PREVIEW_H - bh * s) / 2 - minY * s,
    );
    pctx.scale(s, s);
    drawPiecesPreview(pctx, els.map(el => ({ ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s) })));
    pctx.restore();
  }

  const FENCE_PREVIEW_W = 176, FENCE_PREVIEW_H = 168;
  const FENCE_SAMPLE_LEN = 160;

  function renderFencePreview() {
    const cv = $('fence-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    if (!pctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(FENCE_PREVIEW_W * dpr)) {
      cv.width = Math.round(FENCE_PREVIEW_W * dpr);
      cv.height = Math.round(FENCE_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, FENCE_PREVIEW_W, FENCE_PREVIEW_H);

    const els = Building.elements(
      TOOLS.BUILD_FENCE, { x: 0, y: 0 }, { x: FENCE_SAMPLE_LEN, y: 0 }, buildOpts(),
    );
    if (!els.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 12;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((FENCE_PREVIEW_W - 2 * pad) / bw,
      (FENCE_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate((FENCE_PREVIEW_W - bw * s) / 2 - minX * s,
      (FENCE_PREVIEW_H - bh * s) / 2 - minY * s);
    pctx.scale(s, s);
    drawPiecesPreview(pctx, els.map(el => ({
      ...el, lineWidth: Math.max(el.lineWidth, 0.9 / s),
    })));
    pctx.restore();
  }

  /** Sincroniza el catálogo autónomo de cancelas y su miniatura. */
  function syncGateControls() {
    $('gate-type').value = state.gateType;
    $('gate-height').value = String(state.gateHeightCm);
    $('gate-height-val').textContent = String(Math.round(state.gateHeightCm));
    renderGatePreview();
  }

  const GATE_PREVIEW_W = 176, GATE_PREVIEW_H = 168;
  const GATE_SAMPLE_LEN = 160;

  function renderGatePreview() {
    const cv = $('gate-preview');
    if (!cv) return;
    const pctx = cv.getContext('2d');
    if (!pctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(GATE_PREVIEW_W * dpr)) {
      cv.width = Math.round(GATE_PREVIEW_W * dpr);
      cv.height = Math.round(GATE_PREVIEW_H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.fillStyle = state.canvasBg;
    pctx.fillRect(0, 0, GATE_PREVIEW_W, GATE_PREVIEW_H);

    const els = Building.elements(
      TOOLS.BUILD_GATE, { x: 0, y: 0 }, { x: GATE_SAMPLE_LEN, y: 0 }, buildOpts(),
    );
    if (!els.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const b = getElementBounds(el);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const pad = 12;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = Math.min((GATE_PREVIEW_W - 2 * pad) / bw,
      (GATE_PREVIEW_H - 2 * pad) / bh);
    pctx.save();
    pctx.translate((GATE_PREVIEW_W - bw * s) / 2 - minX * s,
      (GATE_PREVIEW_H - bh * s) / 2 - minY * s);
    pctx.scale(s, s);
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
    // Pan (v3.5.0): espacio mantenido o botón central, con CUALQUIER
    // herramienta. Se resuelve aquí, antes de onMouseDown, porque es cámara y
    // no gesto de dibujo: no debe pisar isDrawing/marquee ni entrar en undo.
    // El preventDefault del botón central suprime además el autoscroll del
    // navegador (los pointer events cancelados no generan mousedown).
    if (activePointerId === null &&
        (spacePan || (e.pointerType === 'mouse' && e.button === 1))) {
      e.preventDefault();
      activePointerId = e.pointerId;
      panDrag = {
        sx: e.clientX, sy: e.clientY,
        sl: canvasArea ? canvasArea.scrollLeft : 0,
        st: canvasArea ? canvasArea.scrollTop : 0,
      };
      mainCanvas.setPointerCapture(e.pointerId);
      updateCursor();
      return;
    }
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
    if (panDrag) {
      if (canvasArea) {
        canvasArea.scrollLeft = panDrag.sl - (e.clientX - panDrag.sx);
        canvasArea.scrollTop = panDrag.st - (e.clientY - panDrag.sy);
      }
      return;
    }
    onMouseMove(e);
  });
  mainCanvas.addEventListener('pointerup', e => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (mainCanvas.hasPointerCapture(e.pointerId)) mainCanvas.releasePointerCapture(e.pointerId);
    if (panDrag) {
      panDrag = null;
      activePointerId = null;
      updateCursor();
      return;
    }
    onMouseUp(e);
    activePointerId = null;
  });
  mainCanvas.addEventListener('pointercancel', e => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (panDrag) {
      panDrag = null;
      activePointerId = null;
      updateCursor();
      return;
    }
    // Cerrar CUALQUIER gesto a medias (dibujo, arrastre, resize o marquee): si
    // no, state.resizing/marquee quedaban colgados y secuestraban el siguiente.
    if (gestureActive()) onMouseUp(e);
    activePointerId = null;
  });
  // El espacio se suelta en keyup — y en blur, porque un Cmd+Tab con la tecla
  // pulsada se lleva el keyup a otra aplicación y la mano se quedaba puesta.
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' && spacePan) {
      spacePan = false;
      updateCursor();
    }
  });
  window.addEventListener('blur', () => {
    if (spacePan) {
      spacePan = false;
      updateCursor();
    }
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

  /**
   * Vuelca `state` en TODOS los mandos de la interfaz. Lo llaman los dos
   * momentos en los que el estado cambia entero por debajo: el arranque (tras
   * restaurar prefs) y «Limpiar todo». Tenerlo en un solo sitio es lo que
   * impide que se vuelvan a separar — el botón reseteaba `state` y refrescaba
   * su propia lista de mandos, más corta.
   *
   * Los controles de semántica dual (color, grosor, relleno, tamaño de letra,
   * discontinuo, doble punta) NO hacen falta aquí: `redrawNow` los sincroniza
   * en cada repintado, y sin selección enseña justo estos defaults. Aquí van
   * los que no tienen quien los sincronice.
   */
  function syncAllControls() {
    $('canvas-bg-picker').value = state.canvasBg;
    $('grid-color-picker').value = state.gridColor;
    $('overlap-mode').value = state.overlapMode;
    $('check-grid').checked = state.showGrid;
    $('check-snap').checked = state.snapGrid;
    updateCanvasPresetActive();
    $('select-modal-multi').checked = state.multiSelect;
    $('select-modal-align').checked = state.alignGuides;
    // Aplica la letra y pide su descarga: el lienzo no dispara la carga de una
    // webfont por sí solo, así que sin esto la primera pintada usaría el
    // resguardo del sistema aunque el .woff2 esté aquí al lado.
    applySketchFont(state.sketchFontId);
    // Y los puntos de sincronía de cada modal, sin dejarse ninguno: Verjas y
    // Cancela faltaban en el botón, y sus modales seguían enseñando el diseño
    // y la altura anteriores hasta volver a abrirlos.
    syncBuildControls();
    syncPathControls();
    syncWallControls();
    syncFenceControls();
    syncGateControls();
    syncGardenLabelControls();
    syncStrokeControls();
    syncShapeControls();
    syncTextControls();
    syncUiControls();
    syncEmojiControls();
    syncEraserControls();
    syncAirbrushControls();
    syncInkControls();
    syncSolidControls();
  }

  function init() {
    // Repintar cuando cargue una imagen (autosave/import restauran data-URLs)
    Renderer.setImageLoadCallback(redraw);
    restoreAutosave();
    restorePrefs();
    buildSidebar();
    buildColors();
    wireControls();
    setupModals();
    // Después de setupModals: las casillas de los cinco modales botánicos las
    // crea installPlantControls, y hasta aquí no existen. Y después de
    // wireControls, porque el selector de letra ya tiene sus opciones.
    syncAllControls();
    updateCursor();
    fitZoomToViewport();
    redraw();
  }

  init();

})();
