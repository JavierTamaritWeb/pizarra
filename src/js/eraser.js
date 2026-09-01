/* ============================================================
   eraser.js — Geometría pura del borrador: qué elementos toca un trazo.

   Desde v1.14.0 el borrador ELIMINA elementos en vez de enmascararlos. La
   máscara antigua (elementos `type:'eraser'` compuestos con
   `destination-out`) era posicional: al mover el dibujo, lo "borrado"
   reaparecía porque salía de debajo de la máscara. Los elementos `eraser`
   de proyectos ya guardados se siguen renderizando y exportando igual
   (renderer.js / exporter.js) para no alterar trabajo antiguo; lo que
   cambia es que la herramienta ya no crea ninguno.

   Criterio de "toca": el mismo que el clic de selección (`hitTest` en
   app.js) ampliado por el radio del borrador — si un clic ahí
   seleccionaría el elemento, el borrador ahí lo elimina.
   ============================================================ */
const Eraser = (function () {
  'use strict';

  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  }

  const _cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  /** ¿Se cruzan los segmentos a1a2 y b1b2? (orientaciones opuestas a ambos lados) */
  function segmentsIntersect(a1, a2, b1, b2) {
    const d1 = _cross(b1, b2, a1), d2 = _cross(b1, b2, a2);
    const d3 = _cross(a1, a2, b1), d4 = _cross(a1, a2, b2);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  /** Distancia mínima entre dos segmentos (0 si se cruzan). */
  function segDist(a1, a2, b1, b2) {
    if (segmentsIntersect(a1, a2, b1, b2)) return 0;
    return Math.min(
      distToSegment(a1, b1, b2), distToSegment(a2, b1, b2),
      distToSegment(b1, a1, a2), distToSegment(b2, a1, a2),
    );
  }

  /** Un tramo del trazo, con su caja colgada encima para poder descartarlo sin
      calcular distancias (ver `_erasedAt`). Sigue siendo el par `[a, b]` que
      desestructuran los demás consumidores. */
  function _seg(a, b) {
    const seg = [a, b];
    seg.minX = Math.min(a.x, b.x); seg.maxX = Math.max(a.x, b.x);
    seg.minY = Math.min(a.y, b.y); seg.maxY = Math.max(a.y, b.y);
    return seg;
  }

  /** Segmentos del trazo del borrador. Un solo punto = segmento degenerado. */
  function _strokeSegments(pts) {
    if (!pts || !pts.length) return [];
    if (pts.length === 1) return [_seg(pts[0], pts[0])];
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push(_seg(pts[i - 1], pts[i]));
    return segs;
  }

  /** ¿Algún segmento del trazo pasa a ≤ r de la polilínea dada? */
  function _touchesPolyline(poly, segs, r, closed) {
    const n = poly.length;
    if (!n) return false;
    if (n === 1) return segs.some(([a, b]) => distToSegment(poly[0], a, b) <= r);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      for (const [a, b] of segs) if (segDist(a, b, p, q) <= r) return true;
    }
    return false;
  }

  /** ¿El trazo toca la caja (incluido su interior, como hace el hit-test)? */
  function _touchesBox(box, segs, r) {
    const x1 = box.x - r, y1 = box.y - r;
    const x2 = box.x + box.w + r, y2 = box.y + box.h + r;
    for (const [a, b] of segs) {
      if ((a.x >= x1 && a.x <= x2 && a.y >= y1 && a.y <= y2) ||
          (b.x >= x1 && b.x <= x2 && b.y >= y1 && b.y <= y2)) return true;
    }
    const corners = [
      { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
    ];
    return _touchesPolyline(corners, segs, 0, true);
  }

  const _bounds = el => ({ x: el.x, y: el.y, w: el.w, h: el.h });

  /** Contorno de una caja como polilínea cerrada. */
  const _boxOutline = b => [
    { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
  ];

  /** Elipse inscrita en la caja, muestreada como polilínea cerrada. */
  function _ellipseOutline(b, steps = 32) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    return pts;
  }

  /** ¿`p` está dentro del polígono (ray casting)? */
  function _pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < a.x + (b.x - a.x) * (p.y - a.y) / (b.y - a.y)) inside = !inside;
    }
    return inside;
  }

  /** Formas cuyo "dibujo" es solo su contorno mientras no estén rellenas. */
  const OUTLINE_TYPES = ['rect', 'roundedRect', 'circle', 'square',
    'triangle', 'pentagon', 'hexagon', 'star5', 'star6', 'trapezoid',
    'freeTriangle',
    'polygon',
    // El marco (v3.12.0) es su borde y nada más: por la caja se borraría al
    // barrer por su interior vacío, que es justo donde se dibuja dentro de él.
    'frame'];

  /** Esquina redondeada muestreada, en el mismo radio que dibuja el renderer. */
  function _roundedOutline(b, r = 12, segs = 6) {
    r = Math.max(0, Math.min(r, b.w / 2, b.h / 2));
    if (!r) return _boxOutline(b);
    const pts = [];
    // Centros de las cuatro esquinas y el ángulo con el que arranca cada una.
    const corners = [
      { cx: b.x + b.w - r, cy: b.y + r, a0: -Math.PI / 2 },
      { cx: b.x + b.w - r, cy: b.y + b.h - r, a0: 0 },
      { cx: b.x + r, cy: b.y + b.h - r, a0: Math.PI / 2 },
      { cx: b.x + r, cy: b.y + r, a0: Math.PI },
    ];
    for (const c of corners) {
      for (let i = 0; i <= segs; i++) {
        const a = c.a0 + (i / segs) * (Math.PI / 2);
        pts.push({ x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a) });
      }
    }
    return pts;
  }

  /**
   * Contorno real de una forma como polilínea CERRADA (el último punto no
   * repite el primero). Es la silueta que se ve, y por eso la comparten el
   * alcance del borrador y su recorte: si midieran contornos distintos, el
   * borrador tocaría una cosa y cortaría otra.
   */
  function _shapeOutline(el, deps = {}) {
    const box = (deps.boundsOf || _bounds)(el);
    // Vértices degenerados ([] en un polígono de tamaño cero) NO cortan el
    // encadenado: `[]` es truthy y dejaba el elemento imborrable.
    const poly = deps.polygonVertices && deps.polygonVertices(el);
    const trap = deps.trapezoidVertices && deps.trapezoidVertices(el);
    if (poly && poly.length) return poly;
    if (trap && trap.length) return trap;
    if (el.type === 'circle') return _ellipseOutline(box);
    if (el.type === 'roundedRect') return _roundedOutline(box);
    return _boxOutline(box);
  }

  /**
   * ¿El trazo `pts` con radio `r` toca al elemento `el`?
   * `deps` inyecta lo que vive fuera de este módulo:
   *   { boundsOf, sampleCurve, polygonVertices, trapezoidVertices }
   * Cualquiera puede faltar: se degrada a la caja del elemento.
   */
  function touches(el, pts, r, deps = {}) {
    const segs = _strokeSegments(pts);
    if (!segs.length || !el) return false;
    const boundsOf = deps.boundsOf || _bounds;

    if (el.type === 'pencil' || el.type === 'eraser') {
      return _touchesPolyline(el.points || [], segs, r + (el.lineWidth || 1) / 2, false);
    }
    if (el.type === 'line' || el.type === 'arrow') {
      const w = r + (el.lineWidth || 1) / 2;
      return segs.some(([a, b]) =>
        segDist(a, b, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= w);
    }
    if (el.type === 'curveArrow') {
      const sampled = deps.sampleCurve ? deps.sampleCurve(el, 24)
        : [{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }];
      return _touchesPolyline(sampled, segs, r + (el.lineWidth || 1) / 2, false);
    }
    // Aerógrafo: la banda pintada es el eje ensanchado por la boquilla, y su
    // radio es una cota dura (ninguna gota cae más lejos), así que el alcance
    // puede ser exacto. Sin esta rama caería en el `_touchesBox` final y una
    // mancha en diagonal se borraría barriendo por cualquier esquina vacía de
    // su caja — el mismo defecto que el borrado por bbox de las fachadas.
    if (el.type === 'airbrush') {
      // Con área, fuera de ella no hay tinta que borrar: se borra lo que se VE.
      if (el.clip && !_touchesBox(el.clip, segs, r)) return false;
      return _touchesPolyline(el.points || [], segs,
        r + (el.radius || 0) + (el.lineWidth || 1) / 2, false);
    }
    // Formas: se borra lo que se VE. Sin relleno solo cuenta el contorno —
    // barrer por el hueco interior de un rectángulo vacío no debe llevárselo
    // entero (con la caja, una pasada por el centro de una fachada borraba
    // el muro completo). Rellenas, el interior también es tinta.
    if (OUTLINE_TYPES.includes(el.type)) {
      const w = r + (el.lineWidth || 1) / 2;
      const verts = _shapeOutline(el, deps);
      // Relleno: el interior es tinta, pero el interior REAL (la silueta),
      // no la caja — la esquina del bbox de un círculo o un triángulo
      // rellenos está a ~15 px de la tinta más cercana y no debe borrarlos.
      // Un punto del trazo dentro de la silueta, o un cruce del contorno
      // (lo detecta el test de contorno de abajo), cubren todos los casos.
      if (el.fill && pts.some(p => _pointInPolygon(p, verts))) return true;
      return _touchesPolyline(verts, segs, w, true);
    }
    // Texto, imágenes y componentes de UI: su caja SÍ es su dibujo.
    return _touchesBox(boundsOf(el), segs, r);
  }

  /**
   * Índices (ascendentes) de los elementos que el trazo elimina.
   * Los `eraser` heredados NO se borran con el borrador: son máscaras de
   * proyectos antiguos y quitarlas haría reaparecer lo que ocultan.
   */
  function doomedIndices(elements, pts, r, deps = {}) {
    const out = [];
    (elements || []).forEach((el, i) => {
      if (el.type === 'eraser' || el.locked) return;
      if (touches(el, pts, r, deps)) out.push(i);
    });
    return out;
  }

  /** Escena resultante de aplicar el trazo (array nuevo; no muta la entrada). */
  function apply(elements, pts, r, deps = {}) {
    const kill = new Set(doomedIndices(elements, pts, r, deps));
    return kill.size ? elements.filter((_, i) => !kill.has(i)) : elements;
  }

  /* ---- Borrado parcial ----
     Nada de lo que se dibuja con una PLUMILLA se borra entero al tocarlo:
     sobrevive lo que quede fuera del círculo del borrador, partido en tantos
     trozos como haga falta. Desde la v1.22.0 valía para line/arrow/pencil, y
     desde la v2.33.0 también para la flecha curva, el contorno de las formas
     sin relleno y el eje del aerógrafo — antes bastaba rozarlos para que
     desaparecieran completos, que es justo lo que un borrador no hace.
     Siguen yéndose enteros, y por el mismo motivo en los tres casos (su
     dibujo es una superficie, no una línea, y no hay tipo que represente esa
     superficie mordida): el texto, las imágenes, los componentes de UI y
     cualquier forma RELLENA. */
  const LINE_SAMPLE_STEP = 4; // px: resolución con la que se recorta una recta/flecha

  /**
   * ¿El punto `p` cae dentro de algún tramo del trazo del borrador?
   *
   * El descarte por caja no es adorno: esto se llama una vez por muestra
   * (cada 4 px de contorno) y por tramo del trazo, en CADA fotograma del
   * arrastre — el recorte se recalcula entero desde `state.elements` para la
   * previsualización. Con un barrido largo sobre varias formas grandes son
   * millones de operaciones por fotograma; la caja se salta la raíz cuadrada
   * en la inmensa mayoría (medido en Chrome: 42 ms → 15 ms por fotograma, con
   * 12 círculos grandes solapados y un barrido de 400 puntos).
   */
  function _erasedAt(p, segs, r) {
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (p.x < seg.minX - r || p.x > seg.maxX + r ||
          p.y < seg.minY - r || p.y > seg.maxY + r) continue;
      if (distToSegment(p, seg[0], seg[1]) <= r) return true;
    }
    return false;
  }

  /** Punto donde `p1→p2` cruza el borde del área borrada (bisección). */
  function _crossing(p1, p2, segs, r, erasedAtP1) {
    let lo = 0, hi = 1;
    const at = t => ({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (_erasedAt(at(mid), segs, r) === erasedAtP1) lo = mid; else hi = mid;
    }
    return at((lo + hi) / 2);
  }

  /**
   * Tramos de `points` que sobreviven al trazo del borrador, con puntos de
   * corte interpolados en cada transición. Cada tramo tiene ≥ 2 puntos;
   * ninguno si todo cae dentro del área borrada.
   *
   * `memo` (opcional, uno por elemento y por PASADA) hace la clasificación
   * incremental: durante el arrastre el trazo solo crece, y un punto que ya
   * cayó dentro no vuelve a salir, así que cada fotograma basta con probar
   * los puntos aún vivos contra los tramos NUEVOS. Sin él, la
   * previsualización reclasificaba todas las muestras contra todo el trazo en
   * cada fotograma — O(muestras × tramos) creciendo con el arrastre, medido
   * en 95-186 ms/fotograma en una escena de 12 formas (auditoría v2.35.0).
   * El memo exige que `points` sea idéntico entre fotogramas (mismo muestreo
   * del mismo elemento); quien lo pasa cachea también los puntos.
   */
  function _survivingRuns(points, segs, r, memo) {
    if (!points || points.length < 2) return [];
    // `r` puede ser un escalar o un array paralelo a `points` (el lápiz con
    // presión simulada tiene semiancho DISTINTO en cada punto): el margen se
    // resuelve por muestra, y el corte interpolado usa la media de sus dos
    // extremos — la frontera exacta varía a lo largo del segmento y la
    // bisección solo necesita un valor coherente con la clasificación.
    const rAt = Array.isArray(r) ? i => r[i] : () => r;
    let erased;
    if (memo && memo.erased && memo.erased.length === points.length) {
      erased = memo.erased;
      const nuevos = segs.slice(memo.nSegs || 0);
      if (nuevos.length) {
        for (let i = 0; i < points.length; i++) {
          if (!erased[i] && _erasedAt(points[i], nuevos, rAt(i))) erased[i] = true;
        }
      }
    } else {
      erased = points.map((p, i) => _erasedAt(p, segs, rAt(i)));
    }
    if (memo) { memo.erased = erased; memo.nSegs = segs.length; }
    const runs = [];
    let current = erased[0] ? [] : [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      if (erased[i] !== erased[i + 1]) {
        const cross = _crossing(points[i], points[i + 1], segs,
          (rAt(i) + rAt(i + 1)) / 2, erased[i]);
        if (erased[i]) {
          current = [cross]; // empieza un tramo nuevo justo al salir del área borrada
        } else {
          current.push(cross); // cierra el tramo actual justo al entrar
          if (current.length >= 2) runs.push(current);
          current = [];
        }
      }
      if (!erased[i + 1]) current.push(points[i + 1]);
    }
    if (current.length >= 2) runs.push(current);
    return runs;
  }

  /** Puntos de p1 a p2 cada LINE_SAMPLE_STEP px, con p1/p2 como mismas
      referencias (para poder distinguir después qué tramo conserva cada
      extremo original sin arrastrar imprecisión de coma flotante). */
  function _sampleLine(p1, p2) {
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(1, Math.round(len / LINE_SAMPLE_STEP));
    const pts = [p1];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
    }
    pts.push(p2);
    return pts;
  }

  /**
   * Recorta una `line`/`arrow` contra el trazo del borrador.
   * Una `arrow` solo sigue siendo `arrow` en el tramo que conserva su punta
   * original (x2,y2); cualquier otro trozo pasa a `line` (sin punta ni
   * etiqueta) — cortar una flecha por la mitad no inventa una punta nueva
   * en el corte.
   */
  function _splitLine(el, segs, r, memo) {
    // El mismo margen de tinta que usa `touches`: clasificar solo con `r`
    // dejaba una franja (entre el eje y el borde del trazo) que "tocaba"
    // sin borrar nada visible — y aun así reconstruía el elemento.
    const w = r + (el.lineWidth || 1) / 2;
    // El muestreo se cachea junto a la clasificación: el memo incremental de
    // _survivingRuns exige que los puntos sean LOS MISMOS entre fotogramas
    // (las comprobaciones de "intacto" van por referencia a los extremos).
    let pts = memo && memo.pts;
    if (!pts) {
      pts = _sampleLine({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 });
      if (memo) memo.pts = pts;
    }
    const p1 = pts[0], p2 = pts[pts.length - 1];
    const runs = _survivingRuns(pts, segs, w, memo);
    // Roce sin mordisco (contacto continuo justo entre dos muestras):
    // intacto POR REFERENCIA — reconstruirlo desanclaba la flecha y
    // apilaba un paso de undo sin ningún cambio visible.
    if (runs.length === 1 && runs[0][0] === p1 && runs[0][runs[0].length - 1] === p2) {
      return [el];
    }
    return runs.map(run => {
      const a = run[0], b = run[run.length - 1];
      const piece = { ...el, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      delete piece.id; delete piece.startAnchor; delete piece.endAnchor;
      if (el.type === 'arrow') {
        const hasP2 = b === p2;
        if (!hasP2) {
          piece.type = 'line';
          delete piece.heads; delete piece.label; delete piece.labelT;
        } else if (a === p1 && el.heads === 'both') {
          piece.heads = 'both';
        } else {
          delete piece.heads;
        }
      }
      // Un extremo que no se ha movido conserva su ancla — solo mientras el
      // trozo siga siendo flecha (resolveAnchors ignora las líneas): morder
      // la cola no debe desconectar la punta anclada, que está donde estaba.
      if (piece.type === 'arrow') {
        if (a === p1 && el.startAnchor !== undefined) piece.startAnchor = el.startAnchor;
        if (b === p2 && el.endAnchor !== undefined) piece.endAnchor = el.endAnchor;
      }
      return piece;
    });
  }

  /** Recorta un `pencil` contra el trazo del borrador: un hueco en medio del
      trazo lo parte en varios `pencil` independientes. */
  function _splitPencil(el, segs, r, memo) {
    const pts = el.points;
    let w = r + (el.lineWidth || 1) / 2; // mismo margen de tinta que `touches`
    // Con presión simulada la tinta real es más estrecha que el grosor
    // nominal (hasta MIN_W en los tramos rápidos y el 10 % en las puntas):
    // clasificar con el margen nominal partía trazos que el círculo del
    // borrador nunca tocó — la inversa exacta de la franja que corrigió la
    // v2.2.0. El semiancho local sale de Freehand, un módulo puro hermano
    // que carga antes (mismo trato que renderer/exporter le dan); el typeof
    // cubre un arnés que cargue el borrador suelto, donde se conserva el
    // margen nominal de siempre.
    if (el.taper === true && typeof Freehand !== 'undefined' && Freehand.halfWidths) {
      let halfs = memo && memo.halfs;
      if (!halfs) {
        halfs = Freehand.halfWidths(pts, el.lineWidth);
        if (memo && halfs) memo.halfs = halfs;
      }
      if (halfs && halfs.length === pts.length) w = halfs.map(h => r + h);
    }
    const runs = _survivingRuns(pts, segs, w, memo);
    // Roce sin mordisco: intacto por referencia (ver _splitLine).
    if (runs.length === 1 &&
        runs[0][0] === pts[0] && runs[0][runs[0].length - 1] === pts[pts.length - 1]) {
      return [el];
    }
    return runs.map(run => {
      const piece = { ...el, points: run };
      delete piece.id;
      return piece;
    });
  }

  /** Densifica una polilínea a ~LINE_SAMPLE_STEP px conservando los vértices
      originales POR REFERENCIA (el recorte los usa para saber qué trozo
      conserva cada extremo). Sin esto, el contorno de un rectángulo son
      cuatro puntos: borrar el centro de un lado no cambia la clasificación de
      ninguno de sus dos extremos y no se corta nada. */
  function _densify(points) {
    if (!points || points.length < 2) return points || [];
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      out.push(..._sampleLine(points[i - 1], points[i]).slice(1));
    }
    return out;
  }

  /** Trozo de trazo a mano alzada equivalente a un pedazo de otro elemento.
      Se construye de cero, nunca con `{...el}`: un `rotation` heredado por un
      `pencil` lo rechaza `isValidElement` al importar, y `w`/`h`/`fill` serían
      basura serializada. `dash` tampoco se hereda — el renderer no lo aplica a
      un `pencil`, así que copiarlo dibujaría continuo diciendo discontinuo. */
  function _asPencil(el, run) {
    const piece = {
      type: 'pencil',
      points: run.map(p => ({ x: p.x, y: p.y })),
      color: el.color,
      lineWidth: el.lineWidth,
    };
    if (el.seed !== undefined) piece.seed = el.seed;
    // La presión simulada sí viaja con el trozo: solo la lleva un `pencil`
    // de origen (isValidElement la ata al tipo), y un fragmento con el
    // aspecto clásico junto al resto afilado cantaría como otro trazo.
    if (el.taper === true) piece.taper = true;
    // El trozo sigue siendo pieza del mismo edificio/jardín/sólido: perder el
    // grupo dejaría un cacho suelto imposible de seleccionar con el resto.
    if (el.buildingGroupId !== undefined) piece.buildingGroupId = el.buildingGroupId;
    return piece;
  }

  /**
   * Recorta una `curveArrow` contra el trazo del borrador. Los trozos salen
   * como `pencil`: la curva se muestrea fina y lo que queda ya no es un
   * Bézier con sus extremos y controles, igual que un trozo de flecha
   * cortado deja de ser flecha. Se pierden puntas y etiqueta, que es lo
   * coherente — la punta estaba en el extremo que acaba de borrarse.
   */
  function _splitCurve(el, segs, r, deps, memo) {
    const w = r + (el.lineWidth || 1) / 2;
    let pts = memo && memo.pts;
    if (!pts) {
      const sampled = deps.sampleCurve ? deps.sampleCurve(el, 24)
        : [{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }];
      pts = _densify(sampled);
      if (memo) memo.pts = pts;
    }
    if (pts.length < 2) return null;   // curva degenerada: borrado íntegro
    const runs = _survivingRuns(pts, segs, w, memo);
    if (runs.length === 1 &&
        runs[0][0] === pts[0] && runs[0][runs[0].length - 1] === pts[pts.length - 1]) {
      return [el];                     // roce sin mordisco: intacta por referencia
    }
    return runs.map(run => _asPencil(el, run));
  }

  /**
   * Recorta el CONTORNO de una forma sin relleno. El anillo se cierra por su
   * costura antes de recortar y los dos trozos que la comparten se vuelven a
   * unir: sin eso, borrar por cualquier otro lado partiría la forma en dos
   * pedazos por un sitio donde el borrador no ha pasado.
   */
  function _splitOutline(el, segs, r, deps, memo) {
    const w = r + (el.lineWidth || 1) / 2;
    let closed = memo && memo.pts;
    if (!closed) {
      const ring = _shapeOutline(el, deps);
      if (!ring || ring.length < 3) return null;
      closed = _densify(ring.concat([ring[0]]));
      if (memo) memo.pts = closed;
    }
    if (closed.length < 4) return null;
    const first = closed[0], last = closed[closed.length - 1];
    const runs = _survivingRuns(closed, segs, w, memo);
    if (runs.length === 1 &&
        runs[0][0] === first && runs[0][runs[0].length - 1] === last) {
      return [el];                     // roce sin mordisco: intacta por referencia
    }
    if (runs.length > 1) {
      const a = runs[0], b = runs[runs.length - 1];
      if (a[0] === first && b[b.length - 1] === last) {
        runs.pop();
        runs.shift();
        runs.unshift(b.slice(0, -1).concat(a));   // la costura no estaba borrada
      }
    }
    return runs.map(run => _asPencil(el, run));
  }

  /**
   * Recorta el EJE de una mancha de aerógrafo. El margen es el mismo que usa
   * `touches` —radio del borrador MÁS la boquilla entera— y ese "entera" es
   * geometría, no prudencia: los tramos de eje que sobreviven siguen rociando
   * hacia el hueco hasta el radio completo, así que cortando el eje a `r + R`
   * del trazo el claro que queda mide exactamente `r`, el círculo del
   * borrador. Con menos margen el hueco se cierra solo y queda un residuo
   * tenue justo donde se acaba de borrar (medido: con media boquilla, un 7 %
   * de tinta en el claro). Contrapartida asumida: pasar por el halo exterior
   * se lleva ese tramo de banda entero, porque el eje que lo pinta está
   * debajo. Un soplo de un solo punto no tiene eje que partir: se borra entero.
   */
  function _splitAirbrush(el, segs, r, deps, memo) {
    if (!el.points || el.points.length < 2) return null;
    // El eje viene decimado a 2 px cuando lo dibuja la herramienta, pero un
    // proyecto importado o una mancha escalada pueden traerlo con vértices
    // muy separados, y entre dos muestras el borrador no ve nada que cortar.
    let pts = memo && memo.pts;
    if (!pts) {
      pts = _densify(el.points);
      if (memo) memo.pts = pts;
    }
    const w = r + (el.radius || 0) + (el.lineWidth || 1) / 2;
    const runs = _survivingRuns(pts, segs, w, memo);
    if (runs.length === 1 &&
        runs[0][0] === pts[0] && runs[0][runs[0].length - 1] === pts[pts.length - 1]) {
      return [el];
    }
    let piezas = runs.map(run => {
      const piece = { ...el, points: run };
      delete piece.id;
      return piece;
    });
    // Con área (`clip`), un trozo puede quedarse con TODAS sus gotas fuera de
    // ella: invisible, pero contando en «Elementos» y viajando en el JSON —
    // exactamente lo que onMouseUp impide al crear. `isEmpty` vive fuera del
    // módulo (necesita regenerar la nube), así que llega inyectado; sin la
    // dependencia se conservan todos los trozos, como antes.
    if (deps && deps.isEmpty) piezas = piezas.filter(pz => !deps.isEmpty(pz));
    return piezas;
  }

  /**
   * Escena resultante de aplicar el trazo del borrador (array nuevo; no
   * muta la entrada). A diferencia de `apply`, lo que se dibuja con una
   * plumilla no se elimina entero: se sustituye por los trozos que sobreviven
   * fuera del círculo. Devuelve la misma referencia si nada cambió.
   */
  function erase(elements, pts, r, deps = {}) {
    const segs = _strokeSegments(pts);
    if (!segs.length || !elements || !elements.length) return elements;
    // Caja del trazo completo, para el descarte rápido de elementos lejanos:
    // durante el arrastre esto corre por FOTOGRAMA, y sin el descarte cada
    // elemento pagaba un `touches` O(muestras × tramos) aunque el borrador
    // estuviera en la otra punta del lienzo.
    let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
    for (const sg of segs) {
      if (sg.minX < sMinX) sMinX = sg.minX;
      if (sg.minY < sMinY) sMinY = sg.minY;
      if (sg.maxX > sMaxX) sMaxX = sg.maxX;
      if (sg.maxY > sMaxY) sMaxY = sg.maxY;
    }
    // Memos por elemento y por pasada (deps.session, un Map que app.js crea al
    // empezar el arrastre y tira al soltar): clasificación incremental de
    // _survivingRuns y `touches` probado solo contra los tramos nuevos.
    const memoOf = deps.session
      ? el => {
        let m = deps.session.get(el);
        if (!m) { m = {}; deps.session.set(el, m); }
        return m;
      }
      : () => null;
    let changed = false;
    const out = [];
    elements.forEach(el => {
      if (el.type === 'eraser') { out.push(el); return; }
      // Un elemento BLOQUEADO (v3.8.0) es intocable también para el borrador:
      // el candado protege de cualquier alteración con el puntero, y borrar
      // es la peor de todas. Se devuelve por referencia, como los intactos.
      if (el.locked) { out.push(el); return; }
      const memo = memoOf(el);
      // Descarte por caja. El margen cubre todo lo que `touches` puede
      // alcanzar más allá de los bounds: el grosor del trazo del elemento (la
      // banda del aerógrafo ya viene incluida en su visibleBox). Solo cuando
      // la caja es medible — sin `boundsOf` inyectado, un pencil no la tiene.
      if (!(memo && memo.touched)) {
        const bb = (deps.boundsOf || _bounds)(el);
        const margen = r + (el.lineWidth || 1);
        if (Number.isFinite(bb.x) && Number.isFinite(bb.w) &&
            (bb.x + bb.w + margen < sMinX || bb.x - margen > sMaxX ||
             bb.y + bb.h + margen < sMinY || bb.y - margen > sMaxY)) {
          out.push(el);
          return;
        }
      }
      // `touches` es monótono con el trazo (un tramo nuevo solo puede añadir
      // alcance), así que con memo basta probar la cola nueva — con un punto
      // de solape, para no perder el tramo que une lo viejo con lo nuevo.
      let touched;
      if (memo) {
        if (memo.touched) {
          touched = true;
        } else {
          const desde = Math.max(0, (memo.checkedPts || 0) - 1);
          touched = touches(el, desde ? pts.slice(desde) : pts, r, deps);
          memo.checkedPts = pts.length;
          if (touched) memo.touched = true;
        }
      } else {
        touched = touches(el, pts, r, deps);
      }
      if (!touched) { out.push(el); return; }
      let pieces = null;
      if (el.type === 'pencil') pieces = _splitPencil(el, segs, r, memo);
      else if (el.type === 'line' || el.type === 'arrow') pieces = _splitLine(el, segs, r, memo);
      else if (el.type === 'curveArrow') pieces = _splitCurve(el, segs, r, deps, memo);
      else if (el.type === 'airbrush') pieces = _splitAirbrush(el, segs, r, deps, memo);
      // Una forma RELLENA se va entera: su dibujo es la superficie, y no hay
      // ningún tipo que represente una superficie mordida. Sin relleno, lo
      // dibujado es el contorno y el contorno sí se recorta.
      else if (OUTLINE_TYPES.includes(el.type) && !el.fill) {
        pieces = _splitOutline(el, segs, r, deps, memo);
      }
      // Texto, emoji, imágenes y componentes de UI: no hay geometría que
      // partir, así que quien tenga un canvas (app.js, vía `deps.rasterErase`)
      // devuelve el dibujo con el hueco abierto. Sin esa dependencia —arnés
      // vm, exportaciones— se cae al borrado íntegro de siempre.
      else if (deps.rasterErase) pieces = deps.rasterErase(el, pts, r);
      if (pieces) {
        // `touches` mide distancia continua y el recorte muestrea cada 4 px:
        // un roce puede tocar sin que ninguna muestra caiga dentro. Si el
        // split devuelve el elemento intacto, no ha cambiado nada.
        if (pieces.length === 1 && pieces[0] === el) { out.push(el); return; }
        changed = true;
        out.push(...pieces);
        return;
      }
      changed = true; // cualquier otro tipo tocado se elimina entero
    });
    return changed ? out : elements;
  }

  return {
    touches, doomedIndices, apply, erase,
    distToSegment, segDist, segmentsIntersect,
    // Se exporta por el mismo motivo que distToSegment: app.js necesita el
    // mismo punto-en-polígono para el hit-test del polígono libre, y duplicar
    // la fórmula es garantizar que un día discrepen.
    pointInPolygon: _pointInPolygon,
  };
})();
