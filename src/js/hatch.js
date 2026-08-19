/* ============================================================
   hatch.js — Rellenos tramados (la idea de rough.js)

   Un relleno plano contradice el resto del dibujo: el trazo es de mano
   temblorosa y la superficie, una mancha impresa. La trama —rayado, cruzado,
   puntos o zigzag— es lo que hace que un boceto se lea como un boceto.

   Módulo PURO: sin DOM, sin Math.random. La geometría se regenera donde se
   necesita (lienzo, exportación SVG, HTML y las miniaturas), igual que hace
   el aerógrafo con sus gotas, así que el JSON no engorda y los formatos no
   pueden divergir. El elemento solo guarda `fillPattern`.
   ============================================================ */

const Hatch = (() => {
  'use strict';

  const PATTERNS = Object.freeze(['hachure', 'cross-hatch', 'dots', 'zigzag']);
  const EMPTY = Object.freeze({ lines: [], dots: [] });

  function isPattern(v) {
    return PATTERNS.includes(v);
  }

  /**
   * Aleatoriedad como FUNCIÓN, no como secuencia — la misma lección que el
   * aerógrafo (`airbrush.js`): un generador secuencial re-tira toda la trama
   * en cuanto cambia el número de líneas, así que la forma "hierve" mientras
   * se redimensiona. Con un hash por línea, crecer solo AÑADE.
   */
  function _rnd(seed, i, canal) {
    let h = (seed | 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(canal + 1, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ── Contorno de cada tipo rellenable ── */

  const ELLIPSE_STEPS = 48;
  const ROUND_RADIUS = 12;      // el mismo que dibuja el renderer
  const ROUND_STEPS = 6;

  function _box(el) {
    const x2 = el.x + el.w, y2 = el.y + el.h;
    return {
      x: Math.min(el.x, x2), y: Math.min(el.y, y2),
      w: Math.abs(el.w), h: Math.abs(el.h),
    };
  }

  function _roundedOutline(b) {
    const r = Math.max(0, Math.min(ROUND_RADIUS, b.w / 2, b.h / 2));
    if (!r) return [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
    ];
    const pts = [];
    const esquina = (cx, cy, desde) => {
      for (let i = 0; i <= ROUND_STEPS; i++) {
        const a = desde + (i / ROUND_STEPS) * (Math.PI / 2);
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
    };
    esquina(b.x + b.w - r, b.y + r, -Math.PI / 2);          // sup. derecha
    esquina(b.x + b.w - r, b.y + b.h - r, 0);               // inf. derecha
    esquina(b.x + r, b.y + b.h - r, Math.PI / 2);           // inf. izquierda
    esquina(b.x + r, b.y + r, Math.PI);                     // sup. izquierda
    return pts;
  }

  /**
   * El polígono que encierra la superficie de un elemento rellenable. Es el
   * MISMO contorno que dibuja el renderer (el círculo muestreado, las
   * esquinas redondeadas de verdad, la silueta real de un polígono o una
   * estrella), porque una trama que se saliera del dibujo delataría al
   * instante que son dos geometrías distintas.
   */
  function outline(el) {
    if (!el) return [];
    if (Array.isArray(el.points)) {
      return el.points.length >= 3 ? el.points.map(p => ({ x: p.x, y: p.y })) : [];
    }
    if (!(Math.abs(el.w) > 0 && Math.abs(el.h) > 0)) return [];
    const b = _box(el);
    if (el.type === 'circle') {
      const rx = b.w / 2, ry = b.h / 2;
      const cx = b.x + rx, cy = b.y + ry;
      return Array.from({ length: ELLIPSE_STEPS }, (_, i) => {
        const a = (i / ELLIPSE_STEPS) * Math.PI * 2;
        return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
      });
    }
    if (el.type === 'roundedRect') return _roundedOutline(b);
    if (el.type === 'trapezoid') {
      return typeof Trapezoid !== 'undefined' ? Trapezoid.vertices(el) : [];
    }
    if (typeof RegularPolygon !== 'undefined' && RegularPolygon.isType(el.type)) {
      return RegularPolygon.vertices(el);
    }
    return [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
    ];
  }

  /* ── Barrido ── */

  /** Separación entre líneas: crece con el grosor, así que la proporción de
      tinta se mantiene al engordar el trazo. */
  function spacing(el) {
    const lw = Math.max(1, Number(el.lineWidth) || 2);
    return Math.max(4, 4 * lw);
  }

  function _centro(poly) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of poly) {
      x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
    }
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  /**
   * Segmentos de un barrido de líneas paralelas en la dirección `ang`.
   *
   * La rejilla se ancla al CENTRO de la figura, no a su esquina ni al origen
   * del lienzo, y eso es lo que la hace estable en los dos gestos que la
   * pondrían a hervir: mover la figura se la lleva entera, y agrandarla
   * AÑADE líneas sin correr las que ya había.
   */
  function _scan(poly, c, ang, gap, seed, canal) {
    const cos = Math.cos(-ang), sin = Math.sin(-ang);
    // A un sistema donde las líneas del barrido son horizontales.
    const rot = poly.map(p => {
      const dx = p.x - c.x, dy = p.y - c.y;
      return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
    });
    let min = Infinity, max = -Infinity;
    for (const p of rot) { min = Math.min(min, p.y); max = Math.max(max, p.y); }
    const out = [];
    const kIni = Math.ceil(min / gap), kFin = Math.floor(max / gap);
    // Cota de seguridad: una figura enorme con separación mínima no puede
    // colgar el repintado (misma idea que MAX_DOTS del aerógrafo).
    if (kFin - kIni > 400) return out;
    const inv = { cos: Math.cos(ang), sin: Math.sin(ang) };
    for (let k = kIni; k <= kFin; k++) {
      // El temblor va por línea y sale del hash, no de un contador: así una
      // línea conserva su desviación aunque aparezcan otras nuevas.
      const y = k * gap + (_rnd(seed, k, canal) - 0.5) * gap * 0.25;
      const cortes = [];
      for (let i = 0, j = rot.length - 1; i < rot.length; j = i++) {
        const a = rot[j], b = rot[i];
        if ((a.y > y) === (b.y > y)) continue;
        cortes.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
      }
      if (cortes.length < 2) continue;
      cortes.sort((p, q) => p - q);
      for (let i = 0; i + 1 < cortes.length; i += 2) {
        // Los extremos se recogen un poco, y de forma distinta cada uno: es
        // lo que evita que las puntas formen un borde recto de imprenta.
        const largo = cortes[i + 1] - cortes[i];
        if (largo < 1) continue;
        const m1 = cortes[i] + largo * 0.03 * _rnd(seed, k, canal + 7);
        const m2 = cortes[i + 1] - largo * 0.03 * _rnd(seed, k, canal + 13);
        out.push([
          { x: c.x + m1 * inv.cos - y * inv.sin, y: c.y + m1 * inv.sin + y * inv.cos },
          { x: c.x + m2 * inv.cos - y * inv.sin, y: c.y + m2 * inv.sin + y * inv.cos },
        ]);
      }
    }
    return out;
  }

  function _segALinea(s) {
    return { x1: s[0].x, y1: s[0].y, x2: s[1].x, y2: s[1].y };
  }

  function _dentro(poly, p) {
    let dentro = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  }

  const ANG = Math.PI / 4;      // 45°, la inclinación clásica del rayado

  /**
   * La geometría de la trama de un elemento: `{lines, dots}` en coordenadas
   * de lienzo. Determinista a partir de `el.seed`.
   *
   * Sin `fillPattern` (o con uno desconocido) devuelve vacío: la ausencia del
   * campo ES el relleno plano de siempre.
   */
  function geometry(el) {
    if (!el || !isPattern(el.fillPattern)) return EMPTY;
    const poly = outline(el);
    if (poly.length < 3) return EMPTY;
    const gap = spacing(el);
    const c = _centro(poly);
    const seed = Number.isFinite(el.seed) ? el.seed : 1;

    if (el.fillPattern === 'dots') {
      const dots = [];
      const r = Math.max(0.8, (Number(el.lineWidth) || 2) * 0.45);
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const p of poly) {
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
        x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
      }
      const iIni = Math.ceil((x1 - c.x) / gap), iFin = Math.floor((x2 - c.x) / gap);
      const jIni = Math.ceil((y1 - c.y) / gap), jFin = Math.floor((y2 - c.y) / gap);
      if ((iFin - iIni) * (jFin - jIni) > 20000) return EMPTY;
      for (let i = iIni; i <= iFin; i++) {
        for (let j = jIni; j <= jFin; j++) {
          const idx = i * 1021 + j;
          const p = {
            x: c.x + i * gap + (_rnd(seed, idx, 1) - 0.5) * gap * 0.5,
            y: c.y + j * gap + (_rnd(seed, idx, 2) - 0.5) * gap * 0.5,
          };
          if (_dentro(poly, p)) dots.push({ x: p.x, y: p.y, r });
        }
      }
      return { lines: [], dots };
    }

    const barrido = _scan(poly, c, ANG, gap, seed, 0);
    if (el.fillPattern === 'cross-hatch') {
      const cruz = _scan(poly, c, -ANG, gap, seed, 31);
      return { lines: barrido.concat(cruz).map(_segALinea), dots: [] };
    }
    if (el.fillPattern === 'zigzag') {
      // Los mismos tramos, encadenados en ida y vuelta: el lápiz no levanta.
      const lines = [];
      for (let i = 0; i < barrido.length; i++) {
        const s = i % 2 ? [barrido[i][1], barrido[i][0]] : barrido[i];
        lines.push(_segALinea(s));
        const sig = barrido[i + 1];
        if (sig) {
          const fin = s[1];
          const ini = (i + 1) % 2 ? sig[1] : sig[0];
          lines.push({ x1: fin.x, y1: fin.y, x2: ini.x, y2: ini.y });
        }
      }
      return { lines, dots: [] };
    }
    return { lines: barrido.map(_segALinea), dots: [] };
  }

  return { PATTERNS, isPattern, outline, geometry, spacing };
})();
