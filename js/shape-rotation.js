/* ============================================================
   shape-rotation.js — Rotación discreta de formas geométricas
   ============================================================ */

const ShapeRotation = (() => {
  'use strict';

  const STEPS = Object.freeze({
    square: 45,
    trapezoid: 90,
    rect: 90,
    roundedRect: 90,
    triangle: 90,
    pentagon: 36,
    hexagon: 30,
  });

  function isType(type) {
    return Object.prototype.hasOwnProperty.call(STEPS, type);
  }

  function step(type) {
    return STEPS[type] || 0;
  }

  function normalize(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  /**
   * Gira una forma un paso alrededor de su centro.
   *
   * Los rectángulos siguen alineados con los ejes tras cada cuarto de vuelta,
   * por lo que basta intercambiar ancho y alto. Los polígonos guardan su
   * orientación en grados; al completar una vuelta se elimina el campo para
   * conservar el formato histórico más compacto.
   */
  function rotateElement(el) {
    if (!el || !isType(el.type)) return el;

    if (el.type === 'rect' || el.type === 'roundedRect') {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      return {
        ...el,
        x: cx - el.h / 2,
        y: cy - el.w / 2,
        w: el.h,
        h: el.w,
      };
    }

    const current = Number.isFinite(el.rotation) ? el.rotation : 0;
    const rotation = normalize(current + step(el.type));
    if (el.type === 'trapezoid') {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const copy = {
        ...el,
        x: cx - el.h / 2,
        y: cy - el.w / 2,
        w: el.h,
        h: el.w,
      };
      if (rotation === 0) delete copy.rotation;
      else copy.rotation = rotation;
      return copy;
    }
    const copy = { ...el };
    if (rotation === 0) delete copy.rotation;
    else copy.rotation = rotation;
    return copy;
  }

  return { STEPS, isType, step, normalize, rotateElement };
})();
