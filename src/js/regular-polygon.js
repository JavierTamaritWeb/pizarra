/* ============================================================
   regular-polygon.js — Geometría de polígonos regulares y estrellas
   ============================================================ */

const RegularPolygon = (() => {
  'use strict';

  const SIDES = Object.freeze({
    square: 4,
    triangle: 3,
    pentagon: 5,
    hexagon: 6,
  });

  /**
   * Estrellas regulares, por número de PUNTAS. Viven aquí y no en un módulo
   * propio a propósito: su silueta es un polígono más (concavo, con el doble
   * de vértices que puntas), así que compartiendo `vertices()` heredan sin
   * una sola línea extra el hit-test, el borrador, el relleno, el modo de
   * solapamiento, el giro, la caja cuadrada obligatoria y los dos exportadores.
   */
  const STAR_POINTS = Object.freeze({
    star5: 5,
    star6: 6,
  });

  /**
   * Radio interior relativo de la estrella regular canónica: aquel en el que
   * PROLONGAR el lado de una punta lleva exactamente a otra punta, de modo que
   * la silueta son rectas completas y no una flor de pétalos rectos. Es lo que
   * da el pentagrama de siempre (5) y la Estrella de David (6); cualquier otro
   * radio dibuja una estrella más gorda o más raquítica, no la clásica.
   *   cos(2π/n) / cos(π/n)  →  0.381966 (n=5) · 0.577350 (n=6)
   */
  function innerRatio(points) {
    return Math.cos(2 * Math.PI / points) / Math.cos(Math.PI / points);
  }

  function isStar(type) {
    return Object.prototype.hasOwnProperty.call(STAR_POINTS, type);
  }

  function isType(type) {
    return Object.prototype.hasOwnProperty.call(SIDES, type) || isStar(type);
  }

  /** Puntas de una estrella, o 0 si el tipo no lo es. */
  function points(type) {
    return STAR_POINTS[type] || 0;
  }

  /** Lados de la silueta — y por tanto vértices: una estrella tiene el doble
      que puntas, porque alterna radio exterior e interior. */
  function sides(type) {
    if (SIDES[type]) return SIDES[type];
    return STAR_POINTS[type] ? STAR_POINTS[type] * 2 : 0;
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
    // El resto de polígonos nace con un vértice arriba. El cuadrado parte
    // 45° antes para mostrar lados horizontales/verticales; su primer giro
    // de 45° lo convierte en rombo sin cambiar lados, centro ni radio.
    const startAngle = el.type === 'square' ? -Math.PI / 4 : -Math.PI / 2;
    if (!radius) return [];
    // Las estrellas nacen con una punta arriba (índice par = radio exterior),
    // así que su bbox real no llena el cuadrado por los lados; se acepta a
    // cambio de que la caja siga siendo la del círculo circunscrito, que es lo
    // que hace que giro, escalado y w===h funcionen igual que en los demás.
    const inner = isStar(el.type) ? radius * innerRatio(points(el.type)) : 0;
    return Array.from({ length: count }, (_, index) => {
      const angle = startAngle + rotation + index * Math.PI * 2 / count;
      const r = inner && index % 2 ? inner : radius;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
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

  return {
    SIDES, STAR_POINTS, isType, isStar, sides, points, innerRatio,
    vertices, fromCenter, contains,
  };
})();
