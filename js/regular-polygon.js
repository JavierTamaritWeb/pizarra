/* ============================================================
   regular-polygon.js — Geometría de polígonos regulares
   ============================================================ */

const RegularPolygon = (() => {
  'use strict';

  const SIDES = Object.freeze({
    triangle: 3,
    pentagon: 5,
    hexagon: 6,
  });

  function isType(type) {
    return Object.prototype.hasOwnProperty.call(SIDES, type);
  }

  function sides(type) {
    return SIDES[type] || 0;
  }

  /**
   * Vértices inscritos en el mayor círculo contenido en el bbox. Las formas
   * creadas por la app usan w===h; min() protege proyectos manipulados.
   */
  function vertices(el) {
    const count = sides(el.type);
    if (!count) return [];
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const radius = Math.min(Math.abs(el.w), Math.abs(el.h)) / 2;
    const rotation = Number.isFinite(el.rotation) ? el.rotation * Math.PI / 180 : 0;
    if (!radius) return [];
    return Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + rotation + index * Math.PI * 2 / count;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
  }

  /** Bbox cuadrado cuyo centro es start y cuyo radio llega hasta end. */
  function fromCenter(start, end) {
    const radius = Math.hypot(end.x - start.x, end.y - start.y);
    return {
      x: start.x - radius,
      y: start.y - radius,
      w: radius * 2,
      h: radius * 2,
    };
  }

  /** Point-in-polygon por ray casting, incluyendo aproximadamente el borde. */
  function contains(point, el) {
    const pts = vertices(el);
    if (pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      const crosses = (a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  return { SIDES, isType, sides, vertices, fromCenter, contains };
})();
