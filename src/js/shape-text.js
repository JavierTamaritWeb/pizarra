/* ============================================================
   shape-text.js — Texto dentro de una forma, ajustado como en Word (v3.28.0)

   Una forma (rectángulo, redondeado, óvalo, cuadrado, trapecio, triángulos,
   pentágono, hexágono, estrellas) puede llevar un texto propio: `el.label`
   (con saltos `\n`) y, opcionalmente, `el.labelSize` (el tamaño de letra
   pedido; su ausencia es DEFAULT_SIZE). El color es el del trazo de la forma.

   Todo lo demás es estado DERIVADO y se recalcula donde se necesita (lienzo,
   SVG, HTML), igual que la trama de `hatch.js`: el reparto en líneas y la
   reducción de la letra dependen de la medida de la fuente, y una medida no
   puede vivir en el JSON (cambiaría con la letra del lienzo o del visor).

   Módulo PURO: sin DOM. La medida entra INYECTADA: `measure(texto, font)` →
   ancho en px. El renderer la construye con su `ctx.measureText`; el arnés
   de tests con una métrica sintética. Regla heredada del proyecto (edificios,
   jardín): la medida solo puede repartir texto, nunca mover la geometría.

   La caja de texto es el rectángulo de mayor área que cabe ENTERO dentro de
   la silueta real de la forma (`Hatch.outline`, la misma geometría que pinta
   el renderer): en un rectángulo es la caja menos el margen, en un óvalo
   ≈ 0,707 de la caja, en un triángulo la mitad inferior, en una estrella una
   caja pequeña. Es lo que hace Word con su «cuadro de texto» inscrito; todas
   las líneas tienen el mismo ancho. Si el texto no cabe, la letra baja de
   uno en uno hasta MIN_SIZE.
   ============================================================ */

const ShapeText = (() => {
  'use strict';

  const TYPES = Object.freeze([
    'rect', 'roundedRect', 'circle', 'square', 'trapezoid', 'freeTriangle',
    'triangle', 'pentagon', 'hexagon', 'star5', 'star6',
  ]);
  const PAD = 4;           // margen interior de la caja de texto
  const DEFAULT_SIZE = 18; // el tamaño de fábrica de la herramienta Texto
  const MIN_SIZE = 8;      // por debajo ya no se lee: ahí se para la reducción
  const LEADING = 4;       // interlineado = tamaño + 4, la constante de todo el proyecto
  const EDGE_SAMPLES = 8;  // puntos por lado al comprobar que la caja cabe
  // Estilo propio del texto (v3.29.0), todo opcional y con la ausencia como
  // valor de siempre: `labelColor` (el del trazo), `labelBold`, `labelFont`
  // (id de SKETCH_FONTS; sin él, la letra del lienzo), `labelAlign`
  // ('left'|'center'|'right', centrado) y `labelValign` ('top'|'middle'|
  // 'bottom', en medio).
  const ALIGNS = Object.freeze(['left', 'center', 'right']);
  const VALIGNS = Object.freeze(['top', 'middle', 'bottom']);

  /** La familia con la que se escribe el texto de la forma. */
  function family(el) {
    if (el && el.labelFont && typeof sketchFontById === 'function') {
      return sketchFontById(el.labelFont).stack;
    }
    return typeof sketchFont === 'function' ? sketchFont() : 'sans-serif';
  }

  /** Los campos del texto de una forma: para borrarlos todos a la vez. */
  const FIELDS = Object.freeze(['label', 'labelSize', 'labelColor', 'labelBold',
    'labelFont', 'labelAlign', 'labelValign']);

  function isType(t) {
    return TYPES.includes(t);
  }

  /** ¿Lleva texto que dibujar? (un rótulo en blanco no cuenta) */
  function hasLabel(el) {
    return !!el && isType(el.type) && typeof el.label === 'string' && el.label.trim() !== '';
  }

  function _inside(poly, p) {
    let dentro = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  }

  /** Centroide (por área) de un polígono simple; si degenera, la media. */
  function _centroid(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
      a += cross;
      cx += (poly[j].x + poly[i].x) * cross;
      cy += (poly[j].y + poly[i].y) * cross;
    }
    if (Math.abs(a) < 1e-9) {
      const n = poly.length;
      return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
    }
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }

  /** ¿Cabe la caja entera en la silueta? Esquinas y puntos de cada lado,
      para que valga también con siluetas cóncavas (estrellas). */
  function _fits(poly, x, y, w, h) {
    for (let i = 0; i <= EDGE_SAMPLES; i++) {
      const t = i / EDGE_SAMPLES;
      if (!_inside(poly, { x: x + w * t, y }) ||
          !_inside(poly, { x: x + w * t, y: y + h }) ||
          !_inside(poly, { x, y: y + h * t }) ||
          !_inside(poly, { x: x + w, y: y + h * t })) return false;
    }
    return true;
  }

  /** El tramo horizontal MÁS ANCHO de la silueta a la altura `y`
      (cortes de la recta con las aristas, por pares), o null. */
  function _widestSpan(poly, y) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    if (xs.length < 2) return null;
    xs.sort((p, q) => p - q);
    let best = null;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (!best || xs[k + 1] - xs[k] > best.r - best.l) best = { l: xs[k], r: xs[k + 1] };
    }
    return best;
  }

  const LEVELS = 32;       // alturas muestreadas al buscar la caja
  const _cache = new Map();
  const CACHE_MAX = 256;

  /**
   * La caja de texto inscrita de una forma, o null si no hay sitio.
   * Coordenadas de lienzo, ya con el margen interior descontado.
   *
   * Es el rectángulo de ÁREA MÁXIMA que cabe en la silueta: se muestrean
   * alturas, en cada una se toma el tramo más ancho, y para cada par de
   * alturas la caja es la intersección de sus tramos. En un rectángulo sale
   * la caja entera, en un óvalo la de ≈ 0,707 centrada, en un triángulo la
   * mitad inferior (base/2 × alto/2) — la misma que Word pone en sus
   * formas. Con siluetas cóncavas el tramo más ancho puede saltar de lóbulo,
   * así que la candidata se verifica con `_fits`. Empate (±2 % de área):
   * gana la más próxima al centroide, para que el texto quede centrado.
   * Cacheada por geometría: se recalcula en cada repintado.
   */
  function innerBox(el) {
    if (!el || !isType(el.type)) return null;
    const key = `${el.type}|${el.x}|${el.y}|${el.w}|${el.h}|${el.rotation || 0}|${el.apex || ''}`;
    if (_cache.has(key)) return _cache.get(key);
    const box = _innerBox(el);
    if (_cache.size >= CACHE_MAX) _cache.clear();
    _cache.set(key, box);
    return box;
  }

  function _innerBox(el) {
    const poly = typeof Hatch !== 'undefined' ? Hatch.outline(el) : [];
    if (poly.length < 3) return null;
    const eps = 0.5;   // medio píxel hacia dentro: sobre el borde el test es ambiguo
    let minY = Infinity, maxY = -Infinity;
    poly.forEach(p => { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    if (!(maxY - minY > eps * 2)) return null;
    const ys = [];
    for (let k = 0; k <= LEVELS; k++) ys.push(minY + eps + (maxY - minY - eps * 2) * k / LEVELS);
    const spans = ys.map(y => _widestSpan(poly, y));
    const c = _centroid(poly);
    const cands = [];
    for (let i = 0; i < ys.length; i++) {
      if (!spans[i]) continue;
      let l = spans[i].l, r = spans[i].r;
      for (let j = i + 1; j < ys.length; j++) {
        if (!spans[j]) break;
        l = Math.max(l, spans[j].l);
        r = Math.min(r, spans[j].r);
        const w = r - l - eps * 2, h = ys[j] - ys[i];
        if (w <= 0) break;
        cands.push({ x: l + eps, y: ys[i], w, h, area: w * h });
      }
    }
    cands.sort((p, q) => q.area - p.area);
    let best = null;
    for (const cand of cands) {
      if (best && cand.area < best.area * 0.98) break;
      if (!_fits(poly, cand.x, cand.y, cand.w, cand.h)) continue;
      if (!best) { best = cand; continue; }
      const d = b => Math.hypot(b.x + b.w / 2 - c.x, b.y + b.h / 2 - c.y);
      if (d(cand) < d(best)) best = cand;
    }
    if (!best) return null;
    const w = best.w - PAD * 2, h = best.h - PAD * 2;
    if (!(w > 0 && h > 0)) return null;
    return { x: best.x + PAD, y: best.y + PAD, w, h };
  }

  /** Corta una palabra más ancha que la caja por caracteres. */
  function _breakWord(word, maxW, width) {
    const out = [];
    let cur = '';
    for (const ch of word) {
      if (cur && width(cur + ch) > maxW) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /**
   * Reparto codicioso por palabras al ancho dado. Respeta los saltos de
   * línea explícitos; una palabra más ancha que la caja se corta.
   */
  function wrap(text, maxW, width) {
    const lines = [];
    String(text).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      let cur = '';
      words.forEach(word => {
        const trial = cur ? `${cur} ${word}` : word;
        if (width(trial) <= maxW) { cur = trial; return; }
        if (cur) lines.push(cur);
        if (width(word) <= maxW) { cur = word; return; }
        const trozos = _breakWord(word, maxW, width);
        cur = trozos.pop() || '';
        lines.push(...trozos);
      });
      lines.push(cur);
    });
    return lines;
  }

  /**
   * El texto de la forma ya repartido y encajado:
   *   { size, font, box, lines: [{ text, x, y }] }
   * con `x` el centro de la línea (textAlign center) e `y` su centro vertical
   * (textBaseline middle). `family` es la letra del lienzo; por defecto la
   * de `sketchFont()` si el módulo está cargado.
   */
  function layout(el, measure, fam) {
    if (!hasLabel(el)) return null;
    const box = innerBox(el);
    if (!box) return null;
    fam = fam || family(el);
    const bold = el.labelBold === true;
    const align = ALIGNS.includes(el.labelAlign) ? el.labelAlign : 'center';
    const valign = VALIGNS.includes(el.labelValign) ? el.labelValign : 'middle';
    const start = Math.max(MIN_SIZE, Math.round(el.labelSize || DEFAULT_SIZE));
    let size = start, font = '', lines = [];
    for (size = start; size >= MIN_SIZE; size--) {
      font = `${bold ? 'bold ' : ''}${size}px ${fam}`;
      const width = t => measure(t, font);
      lines = wrap(el.label, box.w, width);
      const cabeAncho = lines.every(ln => width(ln) <= box.w);
      const cabeAlto = lines.length * (size + LEADING) <= box.h;
      if (cabeAncho && cabeAlto) break;
    }
    if (size < MIN_SIZE) size = MIN_SIZE; // no cabe ni al mínimo: se queda al mínimo
    const step = size + LEADING;
    const total = lines.length * step;
    const y0 = (valign === 'top' ? box.y
      : valign === 'bottom' ? box.y + box.h - total
      : box.y + box.h / 2 - total / 2) + step / 2;
    const x = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
    return {
      size, font, box, bold, align, valign,
      family: fam,
      color: el.labelColor || el.color,
      lines: lines.map((text, i) => ({ text, x, y: y0 + i * step })),
    };
  }

  return { TYPES, FIELDS, ALIGNS, VALIGNS, PAD, DEFAULT_SIZE, MIN_SIZE, LEADING,
    isType, hasLabel, family, innerBox, wrap, layout };
})();
