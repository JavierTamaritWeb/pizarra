/* ============================================================
   trapezoid.js — Geometría del trapecio y sus cuartos de vuelta
   ============================================================ */

const Trapezoid = (() => {
  'use strict';

  function normalize(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  /**
   * Trapecio isósceles: base superior al 60% y base inferior completa.
   * En 90°/270°, ShapeRotation ya intercambió w/h; se reconstruyen las
   * dimensiones anteriores al giro para conservar exactamente la forma.
   */
  function vertices(el) {
    const width = Math.abs(el.w);
    const height = Math.abs(el.h);
    if (!width || !height) return [];
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const degrees = normalize(Number.isFinite(el.rotation) ? el.rotation : 0);
    const quarter = Math.round(degrees / 90) % 4;
    const baseW = quarter % 2 ? height : width;
    const baseH = quarter % 2 ? width : height;
    const points = [
      { x: -baseW * 0.3, y: -baseH / 2 },
      { x:  baseW * 0.3, y: -baseH / 2 },
      { x:  baseW / 2,   y:  baseH / 2 },
      { x: -baseW / 2,   y:  baseH / 2 },
    ];
    const angle = degrees * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(point => ({
      x: cx + point.x * cos - point.y * sin,
      y: cy + point.x * sin + point.y * cos,
    }));
  }

  function contains(point, el) {
    const points = vertices(el);
    if (points.length !== 4) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      const crosses = (a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  return { normalize, vertices, contains };
})();
