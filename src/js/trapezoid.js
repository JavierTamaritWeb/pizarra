/* ============================================================
   trapezoid.js — Geometría de las «formas de caja»: trapecio y
   triángulo irregular. Ambas rellenan el rectángulo arrastrado
   (sin exigir w === h) y giran a cuartos de vuelta.
   ============================================================ */

const Trapezoid = (() => {
  'use strict';

  /** Vértice superior del triángulo irregular, como fracción del ancho:
      0.5 deja los dos lados inclinados iguales (isósceles) y cualquier
      otro valor los hace los tres distintos (escaleno). */
  const APEX = Object.freeze({ isosceles: 0.5, escaleno: 0.25 });

  function isType(type) {
    return type === 'trapezoid' || type === 'freeTriangle';
  }

  /** `apex` saneado: fuera de (0,1) o ausente cae al isósceles, para que un
      JSON manipulado no degenere el triángulo en una línea. */
  function apexRatio(el) {
    const apex = Number(el && el.apex);
    return apex > 0 && apex < 1 ? apex : APEX.isosceles;
  }

  function normalize(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  /**
   * Trapecio isósceles (base superior al 60% y base inferior completa) o
   * triángulo irregular (vértice superior en `apex`, base completa abajo).
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
    const points = el.type === 'freeTriangle'
      ? [
        { x: baseW * (apexRatio(el) - 0.5), y: -baseH / 2 },
        { x:  baseW / 2, y:  baseH / 2 },
        { x: -baseW / 2, y:  baseH / 2 },
      ]
      : [
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
    if (points.length < 3) return false;
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

  return { APEX, isType, apexRatio, normalize, vertices, contains };
})();
