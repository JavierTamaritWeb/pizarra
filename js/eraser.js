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

  /** Segmentos del trazo del borrador. Un solo punto = segmento degenerado. */
  function _strokeSegments(pts) {
    if (!pts || !pts.length) return [];
    if (pts.length === 1) return [[pts[0], pts[0]]];
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
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
    if (deps.polygonVertices) {
      const verts = deps.polygonVertices(el);
      if (verts) return _touchesPolyline(verts, segs, r, true) || _touchesBox(boundsOf(el), segs, r);
    }
    if (deps.trapezoidVertices) {
      const verts = deps.trapezoidVertices(el);
      if (verts) return _touchesPolyline(verts, segs, r, true) || _touchesBox(boundsOf(el), segs, r);
    }
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
      if (el.type === 'eraser') return;
      if (touches(el, pts, r, deps)) out.push(i);
    });
    return out;
  }

  /** Escena resultante de aplicar el trazo (array nuevo; no muta la entrada). */
  function apply(elements, pts, r, deps = {}) {
    const kill = new Set(doomedIndices(elements, pts, r, deps));
    return kill.size ? elements.filter((_, i) => !kill.has(i)) : elements;
  }

  return { touches, doomedIndices, apply, distToSegment, segDist, segmentsIntersect };
})();
