/* ============================================================
   freehand.js — Contorno del lápiz con presión simulada (Freehand)

   Reimplementación en vanilla JS de la idea de perfect-freehand
   (steveruizok/perfect-freehand, MIT): la presión se simula con la
   VELOCIDAD del gesto — puntos muy espaciados (trazo rápido) dan un
   trazo fino, puntos juntos (trazo lento) lo engordan — y los dos
   extremos se afilan. El resultado no es una polilínea que se traza,
   sino un POLÍGONO CERRADO que se rellena con el color del trazo.

   Contrato, el de los módulos puros de la casa (arc, curve-path…):
   sin DOM, sin Math.random — mismo input, mismo polígono, siempre.
   El wobble manuscrito ya viene puesto en los propios puntos del
   gesto, así que aquí no se añade jitter ninguno.

   La envolvente está acotada por el grosor nominal: el semiancho
   máximo es lineWidth/2, exactamente el que ya ocupa el lápiz
   clásico, de modo que bounds, hit-test y el alcance del borrador
   (`r + lineWidth/2`) siguen valiendo sin tocarlos.
   ============================================================ */

const Freehand = (() => {
  'use strict';

  /* Cuánto se arrima cada punto crudo al anterior ya suavizado (0 = crudo).
     Es el «streamline» de perfect-freehand: mata el dentado del ratón sin
     redondear las esquinas de verdad. */
  const STREAMLINE = 0.3;
  /* Fracción del semiancho que conserva el trazo a toda velocidad: 0 aquí
     haría desaparecer los tramos rápidos en vez de afinarlos. */
  const MIN_W = 0.35;
  /* La presión persigue a su objetivo con esta inercia por punto; sin ella
     un punto lento aislado clava un bulto en mitad del trazo. */
  const EASE = 0.5;
  /* Distancia (en semianchos) a la que un salto entre puntos cuenta como
     «velocidad máxima»: más separación ya no afina más. Calibrada para que
     con la decimación de 2 px del lápiz un trazo pausado vaya casi a ancho
     completo y un latigazo de ratón caiga claramente a MIN_W. */
  const SPEED_SPAN = 4;
  /* Longitud del afilado de cada extremo, en múltiplos del semiancho: la
     punta crece de nada al ancho de crucero en ese tramo. */
  const TAPER_SPAN = 5;

  /** Suavizado + presión: devuelve [{x, y, r}] con el semirradio de cada
      punto ya resuelto (velocidad, inercia y afilado de extremos). */
  function _strokePoints(points, baseWidth) {
    const half = Math.max(0.5, baseWidth / 2);
    const pts = [];
    let prev = null;
    for (const p of points) {
      const q = prev
        ? { x: prev.x + (p.x - prev.x) * (1 - STREAMLINE),
            y: prev.y + (p.y - prev.y) * (1 - STREAMLINE) }
        : { x: p.x, y: p.y };
      // Puntos clavados (el gesto se detuvo): no aportan dirección y
      // duplicarían el vértice del contorno.
      if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) < 0.05) continue;
      pts.push(q);
      prev = q;
    }
    if (pts.length < 2) return [];

    // Presión simulada por separación entre puntos, con inercia: el primer
    // punto arranca a media presión, como hace perfect-freehand.
    let pressure = 0.5;
    const out = [];
    let travelled = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = i ? Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) : 0;
      travelled += d;
      const target = 1 - Math.min(1, d / (half * SPEED_SPAN));
      pressure = pressure + (target - pressure) * EASE;
      out.push({ x: pts[i].x, y: pts[i].y, d: travelled,
        r: half * (MIN_W + (1 - MIN_W) * pressure) });
    }
    // Afilado de extremos sobre la longitud recorrida, no sobre el índice:
    // con índices, una zona densa de puntos afilaría medio trazo.
    const total = out[out.length - 1].d;
    const span = Math.min(half * TAPER_SPAN, total / 2);
    if (span > 0) {
      for (const p of out) {
        const t = Math.min(1, Math.min(p.d, total - p.d) / span);
        p.r *= 0.1 + 0.9 * t;
      }
    }
    return out;
  }

  /**
   * Polígono cerrado del contorno del trazo: la banda de ida por un lado
   * del eje y la de vuelta por el otro. Con menos de dos puntos útiles no
   * hay dirección que seguir y devuelve [] — el llamador no dibuja nada,
   * igual que el case clásico del lápiz con points.length < 2.
   */
  function outline(points, baseWidth) {
    const pts = _strokePoints(points || [], baseWidth || 1);
    if (pts.length < 2) return [];
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      // Dirección por vecinos (central en el interior, lateral en las
      // puntas): la perpendicular decide hacia dónde crece el ancho.
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      left.push({ x: pts[i].x + nx * pts[i].r, y: pts[i].y + ny * pts[i].r });
      right.push({ x: pts[i].x - nx * pts[i].r, y: pts[i].y - ny * pts[i].r });
    }
    right.reverse();
    return left.concat(right);
  }

  return { outline };
})();
