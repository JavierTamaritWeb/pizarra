/* ============================================================
   garden.js — Geometría pura de la sección "Jardín", en VISTA DE PLANTA
   (cenital, como un plano de paisajismo).

   Mismo contrato que js/building.js: herramientas SOLO de creación, que
   producen elementos YA EXISTENTES —rect, line, circle, curveArrow (suelto o
   encadenado, siempre heads:'none') y text (la etiqueta)— sin tipos nuevos,
   así que renderer/exporter/isValidElement/bounds siguen intactos. Objetos
   planos y serializables, sin `seed` (lo pone app.js con withSeeds) ni DOM.
     · Jardín     : parcela rect / redonda / en L / orgánica, con césped
     · Árbol      : copa vista desde arriba, 6 especies
     · Arbusto    : mata, seto, macizo, topiario
     · Flor       : margarita, rosa, tulipán, parterre, girasol
     · Decoración : maceta, pozo, regadera, piedra, banco, fuente, estanque, camino

   DETERMINISTA: aquí no se llama a Math.random(). El temblor de mano lo pone
   Sketchy al pintar, a partir del `seed` del elemento; si la geometría también
   fuera aleatoria, la previsualización del arrastre no coincidiría con lo que
   aparece al soltar y los tests no podrían fijar nada. La irregularidad de las
   siluetas orgánicas sale de tablas de radios fijas (LOBES).

   Como en las fachadas, el detalle (hierba, ramas, pétalos, lamas, orillas)
   usa TRAZO FINO —`_fine(o)`, 0.55× — y los contornos, el trazo del usuario.
   ============================================================ */
const Garden = (function () {
  'use strict';

  const MIN_SPAN   = 6;    // arrastre mínimo por eje; por debajo, tamaño por defecto
  const LABEL_SIZE = 12;   // cuerpo de la etiqueta de texto
  const LABEL_GAP  = 6;    // hueco entre la pieza y su etiqueta
  const GRASS_MAX  = 14;   // tope de matas por parcela (cada una son 3 trazos)

  /* Tamaño al hacer clic sin arrastrar. Ojo: aquí NO basta con una caja por
     herramienta como en Edificios —donde una Puerta mide igual sea del tipo
     que sea—, porque en el jardín la variante manda: un seto es apaisado, un
     camino aún más, y una flor suelta es un punto. `byVariant` sobreescribe la
     caja base. Escala de referencia: una parcela de 320 px ≈ 16 m, o sea unos
     20 px por metro (un árbol de 96 px es una copa de ~5 m). */
  const DEFAULTS = {
    [TOOLS.GARDEN_PLOT]:   { w: 320, h: 240 },
    [TOOLS.GARDEN_TREE]:   { w: 96, h: 96, byVariant: {
      palm: { w: 72, h: 72 }, cypress: { w: 40, h: 40 } } },
    [TOOLS.GARDEN_SHRUB]:  { w: 56, h: 56, byVariant: {
      hedge: { w: 180, h: 40 } } },
    [TOOLS.GARDEN_FLOWER]: { w: 28, h: 28, byVariant: {
      bed: { w: 140, h: 90 }, sunflower: { w: 36, h: 36 } } },
    [TOOLS.GARDEN_DECOR]:  { w: 48, h: 48, byVariant: {
      pot: { w: 34, h: 40 },  well:  { w: 44, h: 44 },  can:  { w: 36, h: 30 },
      stone: { w: 40, h: 32 }, bench: { w: 62, h: 24 }, fountain: { w: 70, h: 70 },
      pond: { w: 150, h: 95 }, path: { w: 220, h: 56 } } },
  };

  /* Catálogo de cada herramienta: de dónde sale la variante activa y el texto
     de la etiqueta. Un único sitio, para que añadir una variante sea añadir
     una entrada en config.js y su `case` aquí abajo. */
  const CATALOGS = {
    [TOOLS.GARDEN_PLOT]:   { list: PLOT_SHAPES,   key: 'plotShape'   },
    [TOOLS.GARDEN_TREE]:   { list: TREE_TYPES,    key: 'treeType'    },
    [TOOLS.GARDEN_SHRUB]:  { list: SHRUB_TYPES,   key: 'shrubType'   },
    [TOOLS.GARDEN_FLOWER]: { list: FLOWER_TYPES,  key: 'flowerType'  },
    [TOOLS.GARDEN_DECOR]:  { list: DECOR_TYPES,   key: 'decorType'   },
  };

  /** Variante activa de una herramienta (la primera del catálogo por defecto). */
  function _variant(tool, o) {
    const cat = CATALOGS[tool];
    if (!cat) return null;
    const id = o[cat.key];
    return cat.list.some(v => v.id === id) ? id : cat.list[0].id;
  }

  /** Nombre legible de una variante — es lo que va en la etiqueta. */
  function _variantName(tool, id) {
    const cat = CATALOGS[tool];
    const found = cat && cat.list.find(v => v.id === id);
    return found ? found.name : '';
  }

  function elements(tool, p1, p2, opts) {
    const o = { color: '#000000', lineWidth: 2, ...(opts || {}) };
    const base = DEFAULTS[tool];
    if (!base) return [];
    const variant = _variant(tool, o);
    const def = (base.byVariant && base.byVariant[variant]) || base;
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    const b = {
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      w: rawW >= MIN_SPAN ? rawW : def.w,
      h: rawH >= MIN_SPAN ? rawH : def.h,
    };
    let els;
    switch (tool) {
      case TOOLS.GARDEN_PLOT:   els = _plotTool(b, o, variant);   break;
      case TOOLS.GARDEN_TREE:   els = _treeTool(b, o, variant);   break;
      case TOOLS.GARDEN_SHRUB:  els = _shrubTool(b, o, variant);  break;
      case TOOLS.GARDEN_FLOWER: els = _flowerTool(b, o, variant); break;
      case TOOLS.GARDEN_DECOR:  els = _decorTool(b, o, variant);  break;
      default: return [];
    }
    els = els.filter(Boolean);
    if (o.labels !== false) {
      const label = _label(_variantName(tool, variant), b, o);
      if (label) els.push(label);
    }
    return els;
  }

  /* ── primitivas ── */

  const _line = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color, lineWidth: o.lineWidth });

  const _rectEl = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  const _circleEl = (x, y, w, h, o) =>
    ({ type: 'circle', x, y, w, h, color: o.color, lineWidth: o.lineWidth, fill: false });

  /** Círculo por centro y radio: en planta casi todo se piensa así. */
  const _dot = (cx, cy, r, o) => _circleEl(cx - r, cy - r, r * 2, r * 2, o);

  /** Copia de las opciones con el trazo fino del detalle (0.55×, mínimo 1). */
  const _fine = o =>
    ({ ...o, lineWidth: Math.max(1, Math.round((o.lineWidth || 2) * 0.55)) });

  /** Polilínea cerrada (siluetas rectas: la L de la parcela). */
  function _poly(pts, o) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      out.push(_line(a[0], a[1], c[0], c[1], o));
    }
    return out;
  }

  /** Grosor del ala de la L, sin degenerar en cajas pequeñas. */
  const _wing = (w, h) => Math.max(1, Math.min(
    Math.max(8, Math.round(Math.min(w, h) * 0.4)),
    Math.floor(w / 2) - 1, Math.floor(h / 2) - 1,
  ));

  /**
   * Curva suave que pasa por `pts`, como UN SOLO `curveArrow` encadenado
   * (Catmull-Rom convertida a Béziers cúbicas). `closed` la cierra sobre sí
   * misma: así una copa de árbol es un elemento y no doce líneas sueltas —el
   * borrador se la lleva de una pasada y la escena no se llena de piezas.
   *
   * Cumple `isValidElement`: los `segments` son C0-continuos, los x1/y1/x2/y2
   * de nivel superior reflejan el primer y el último extremo (que en un lazo
   * cerrado coinciden), y NO se ponen `arc`/`cx2`/`cy2` arriba. `heads:'none'`
   * es obligatorio o el renderer le dibuja una punta de flecha.
   */
  function _chain(pts, o, closed) {
    const n = pts.length;
    if (n < 2 || (closed && n < 3)) return null;
    const at = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const segs = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      segs.push({
        x1: p1.x, y1: p1.y,
        cx:  p1.x + (p2.x - p0.x) / 6, cy:  p1.y + (p2.y - p0.y) / 6,
        cx2: p2.x - (p3.x - p1.x) / 6, cy2: p2.y - (p3.y - p1.y) / 6,
        x2: p2.x, y2: p2.y,
      });
    }
    const first = segs[0], tail = segs[segs.length - 1];
    return {
      type: 'curveArrow',
      x1: first.x1, y1: first.y1, x2: tail.x2, y2: tail.y2,
      segments: segs, heads: 'none',
      color: o.color, lineWidth: o.lineWidth,
    };
  }

  /** Silueta orgánica cerrada: radios tomados de `table` (fija, determinista). */
  const _blob = (cx, cy, rx, ry, table, o) => _chain(table.map((k, i) => {
    const a = (i / table.length) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k };
  }), o, true);

  /** Curva única (cuadrática) sin punta: fronda de palmera, asa, pétalo. */
  const _curve = (x1, y1, cx, cy, x2, y2, o) =>
    ({ type: 'curveArrow', x1, y1, cx, cy, x2, y2, heads: 'none',
       color: o.color, lineWidth: o.lineWidth });

  /** Línea ondulada entre dos puntos, como una sola curva encadenada. */
  function _wave(x1, y1, x2, y2, amp, n, o) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;      // normal unitaria
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = Math.sin(t * Math.PI * 2) * amp;
      pts.push({ x: x1 + dx * t + px * s, y: y1 + dy * t + py * s });
    }
    return _chain(pts, o, false);
  }

  /* Tablas de lóbulos: la irregularidad es fija, nunca aleatoria. */
  const LOBES = {
    plot:      [1, 0.95, 1, 0.93, 0.99, 0.96, 1, 0.94, 0.98, 0.95, 1, 0.96],
    broadleaf: [1, 0.92, 1.02, 0.9, 1, 0.95, 1.03, 0.9, 1.01, 0.94],
    olive:     [1, 0.86, 0.99, 0.82, 0.96, 0.88, 1.01, 0.84, 0.94],
    // Ojo con las tablas de 8 valores que alternan alto/bajo: dan simetría de
    // orden 4 y la silueta sale como un rombo, no como una mata. Los radios
    // tienen que ir desacompasados.
    clump:     [1, 0.93, 0.85, 0.98, 0.82, 0.96, 0.88, 0.99],
    stone:     [1, 0.82, 0.95, 0.78, 1, 0.86, 0.9],
    pond:      [1, 0.9, 1, 0.84, 0.95, 1, 0.88, 0.97, 0.92],
    bed:       [1, 0.88, 0.97, 0.85, 1, 0.9, 0.95, 0.87],
  };

  /* ── etiqueta ── */

  /**
   * Etiqueta de la pieza: un `text` centrado justo debajo de su caja.
   *
   * El render de `text` ancla en la esquina superior izquierda, así que
   * centrarlo exige el ancho del texto — y eso pide `ctx.measureText`, o sea
   * DOM, que aquí no hay. Como en js/eraser.js, la dependencia se INYECTA:
   * `opts.measureText(value, fontSize)`. Sin ella (tests) se estima; el
   * desvío es de unos píxeles y no se aprecia en un dibujo a mano alzada.
   *
   * INVARIANTE: `measureText` solo puede MOVER una etiqueta. No puede cambiar
   * el número de elementos, sus tipos ni ninguna coordenada que no sea la `x`
   * de la etiqueta. Todo lo demás que devuelve `elements` es función pura de
   * (tool, p1, p2, variante) — si no, los tests (que corren con la estimación)
   * estarían fijando algo distinto de lo que hace el navegador.
   */
  function _label(text, box, o) {
    if (!text) return null;
    const size = o.labelSize || LABEL_SIZE;
    const w = typeof o.measureText === 'function'
      ? o.measureText(text, size)
      : text.length * size * 0.5;
    return {
      type: 'text',
      x: box.x + box.w / 2 - w / 2,
      y: box.y + box.h + LABEL_GAP,
      value: text,
      color: o.color,
      fontSize: size,
      lineWidth: o.lineWidth,
    };
  }

  /* ── Jardín (parcela) ── */

  /** Vértices de la parcela en L: barra vertical a la izquierda y pie abajo. */
  function _lPoints(b) {
    const t = _wing(b.w, b.h);
    return [
      [b.x, b.y], [b.x + t, b.y], [b.x + t, b.y + b.h - t],
      [b.x + b.w, b.y + b.h - t], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
    ];
  }

  /** ¿Cae el punto dentro de la parcela? Sirve para no sacar césped fuera. */
  function _insidePlot(shape, b, x, y) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (shape === 'round' || shape === 'organic') {
      const k = shape === 'organic' ? 0.85 : 0.88;   // margen: la orilla ondula
      const nx = (x - cx) / (b.w / 2 * k), ny = (y - cy) / (b.h / 2 * k);
      return nx * nx + ny * ny <= 1;
    }
    if (shape === 'l') {
      const t = _wing(b.w, b.h);
      return x <= b.x + t || y >= b.y + b.h - t;
    }
    return true;   // rectangular: toda la caja
  }

  /**
   * Mata de césped: tres briznas sueltas, cada una con SU PROPIO arranque.
   *
   * Las briznas no pueden compartir vértice. Tres trazos que convergen en un
   * punto con el del medio más largo no son una mata: son una punta de flecha,
   * y así se leían («↓»). Separando los arranques y escalonando las alturas
   * desaparece el triángulo y queda un manojo de hierba.
   */
  const _tuft = (x, y, s, f) => [
    _line(x - s * 0.55, y,            x - s * 0.85, y - s * 0.8,  f),
    _line(x,            y + s * 0.14, x + s * 0.06, y - s * 1.05, f),
    _line(x + s * 0.5,  y - s * 0.05, x + s * 0.8,  y - s * 0.75, f),
  ];

  /* Desplazamientos fijos de la retícula de césped: sin ellos se ve el patrón
     regular de una cuadrícula impresa en vez de una pradera. */
  const GRASS_JITTER = [
    [0.18, 0.62], [0.7, 0.3], [0.42, 0.8], [0.24, 0.34], [0.76, 0.68],
    [0.5, 0.16], [0.32, 0.58], [0.66, 0.44], [0.14, 0.76], [0.58, 0.72],
    [0.86, 0.5], [0.38, 0.26], [0.62, 0.9], [0.08, 0.44],
  ];

  /** Matas según el área, para que una parcela grande no salga pelada. */
  const _grassCount = (w, h) =>
    Math.max(4, Math.min(GRASS_MAX, Math.round((w * h) / 9000)));

  /** Césped repartido por la parcela, con tope de matas para no inflar la escena. */
  function _grass(b, o, shape) {
    const f = _fine(o);
    // La retícula se deduce del número de matas y de la proporción de la caja
    // (no de un tamaño de celda fijo, que dejaba las parcelas grandes con
    // cuatro matas en fila).
    const want = _grassCount(b.w, b.h);
    const cols = Math.max(1, Math.round(Math.sqrt(want * (b.w / Math.max(1, b.h)))));
    const rows = Math.max(1, Math.ceil(want / cols));
    const s = Math.max(4, Math.min(11, Math.min(b.w, b.h) * 0.09));
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [jx, jy] = GRASS_JITTER[(r * cols + c) % GRASS_JITTER.length];
        const x = b.x + (c + jx) * (b.w / cols);
        const y = b.y + (r + jy) * (b.h / rows);
        if (!_insidePlot(shape, b, x, y)) continue;
        out.push(..._tuft(x, y, s, f));
      }
    }
    return out;
  }

  function _plotTool(b, o, shape) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let outline;
    switch (shape) {
      case 'round':   outline = [_circleEl(b.x, b.y, b.w, b.h, o)]; break;
      case 'l':       outline = _poly(_lPoints(b), o); break;
      case 'organic': outline = [_blob(cx, cy, b.w / 2, b.h / 2, LOBES.plot, o)]; break;
      default:        outline = [_rectEl(b.x, b.y, b.w, b.h, o)];
    }
    return [...outline, ..._grass(b, o, shape)];
  }

  /* ── Árbol ── */

  /** Tronco visto desde arriba: círculo pequeño en el centro de la copa. */
  const _trunk = (cx, cy, r, f) => _dot(cx, cy, Math.max(1.5, r * 0.15), f);

  /** Radios finos desde el tronco hasta el borde: ramas o acículas. */
  function _spokes(cx, cy, rx, ry, count, from, to, f) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      out.push(_line(
        cx + Math.cos(a) * rx * from, cy + Math.sin(a) * ry * from,
        cx + Math.cos(a) * rx * to,   cy + Math.sin(a) * ry * to, f));
    }
    return out;
  }

  /** Fronda de palmera: nervio curvo del centro hacia fuera. */
  function _frond(cx, cy, a, rx, ry, o) {
    const tx = cx + Math.cos(a) * rx, ty = cy + Math.sin(a) * ry;
    const mx = (cx + tx) / 2, my = (cy + ty) / 2;
    const len = Math.hypot(tx - cx, ty - cy);
    return _curve(cx, cy, mx - Math.sin(a) * len * 0.3, my + Math.cos(a) * len * 0.3, tx, ty, o);
  }

  function _treeTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'conifer':   // acículas en estrella: la copa de un pino desde arriba
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                ..._spokes(cx, cy, rx, ry, 12, 0.3, 0.95, f),
                _trunk(cx, cy, r, f)];
      case 'palm': {    // corona de frondas alrededor del ápice
        const fronds = [];
        for (let i = 0; i < 8; i++) fronds.push(_frond(cx, cy, (i / 8) * Math.PI * 2, rx, ry, o));
        return [...fronds, _dot(cx, cy, Math.max(2, r * 0.16), f)];
      }
      case 'olive': {   // copa menuda y clara: se moteé el follaje en vez de
                        // marcar ramas, o no se distinguiría del frondoso
        const foliage = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.9;
          foliage.push(_dot(cx + Math.cos(a) * rx * 0.48, cy + Math.sin(a) * ry * 0.48,
                            Math.max(1.5, r * 0.22), f));
        }
        return [_blob(cx, cy, rx, ry, LOBES.olive, o), ...foliage, _trunk(cx, cy, r, f)];
      }
      case 'fruit': {   // copa redonda con la fruta marcada
        const fruits = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          fruits.push(_dot(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55,
                           Math.max(1.5, r * 0.09), f));
        }
        return [_circleEl(b.x, b.y, b.w, b.h, o), ...fruits, _trunk(cx, cy, r, f)];
      }
      case 'cypress':   // columnar: copa estrecha, dos anillos apretados
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.58, f),
                _trunk(cx, cy, r, f)];
      default:          // frondoso: copa lobulada con ramas principales
        return [_blob(cx, cy, rx, ry, LOBES.broadleaf, o),
                ..._spokes(cx, cy, rx, ry, 5, 0.18, 0.68, f),
                _trunk(cx, cy, r, f)];
    }
  }

  /* ── Arbusto ── */

  function _shrubTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'hedge': {   // seto: masa alargada con la ondulación del recorte
        const inset = Math.min(b.w, b.h) * 0.28;
        return [_rectEl(b.x, b.y, b.w, b.h, o),
                _wave(b.x + inset * 0.4, cy, b.x + b.w - inset * 0.4, cy,
                      Math.max(2, b.h * 0.16), 4, f)];
      }
      case 'clump': {   // macizo: mata lobulada con dos matas menores dentro
        return [_blob(cx, cy, rx, ry, LOBES.clump, o),
                _dot(cx - rx * 0.28, cy + ry * 0.12, r * 0.3, f),
                _dot(cx + rx * 0.3, cy - ry * 0.18, r * 0.26, f)];
      }
      case 'topiary':   // bola recortada: anillos concéntricos
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.62, f),
                _dot(cx, cy, r * 0.28, f)];
      default: {        // mata redonda: círculo con el follaje insinuado
        const arcs = [];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          const ax = cx + Math.cos(a) * rx * 0.45, ay = cy + Math.sin(a) * ry * 0.45;
          arcs.push(_dot(ax, ay, r * 0.3, f));
        }
        return [_circleEl(b.x, b.y, b.w, b.h, o), ...arcs];
      }
    }
  }

  /* ── Flor ── */

  function _flowerTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'rose': {    // espiral: anillos desplazados hacia el corazón
        return [_dot(cx, cy, r, o),
                _dot(cx + rx * 0.12, cy, r * 0.62, f),
                _dot(cx + rx * 0.2, cy, r * 0.3, f)];
      }
      case 'tulip': {   // tres pétalos abiertos
        const petals = [];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          petals.push(_dot(cx + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.5,
                           r * 0.46, o));
        }
        return [...petals, _dot(cx, cy, Math.max(1.5, r * 0.16), f)];
      }
      case 'bed': {     // parterre: masa de flores, no una flor suelta
        const dots = [];
        const spots = [[-0.5, -0.3], [0.1, -0.5], [0.5, -0.1], [-0.2, 0.1],
                       [0.3, 0.4], [-0.5, 0.4], [0, 0.6]];
        spots.forEach(([sx, sy]) =>
          dots.push(_dot(cx + rx * sx * 0.8, cy + ry * sy * 0.8, Math.max(1.5, r * 0.13), f)));
        return [_blob(cx, cy, rx, ry, LOBES.bed, o), ...dots];
      }
      case 'sunflower': // corazón grande y muchos pétalos radiales
        return [_dot(cx, cy, r * 0.42, o),
                ..._spokes(cx, cy, rx, ry, 14, 0.5, 1, f)];
      default: {        // margarita: corazón con corona de pétalos
        const petals = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          petals.push(_dot(cx + Math.cos(a) * rx * 0.62, cy + Math.sin(a) * ry * 0.62,
                           Math.max(1.5, r * 0.3), f));
        }
        return [...petals, _dot(cx, cy, Math.max(1.5, r * 0.3), o)];
      }
    }
  }

  /* ── Decoración ── */

  function _decorTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'well':      // brocal, interior y el palo del cubo cruzando
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.62, f),
                _line(cx - rx * 0.95, cy, cx + rx * 0.95, cy, f)];
      case 'can': {     // regadera: cuerpo, pitorro con roseta y asa
        const bodyR = r * 0.55;
        const bx = cx - rx * 0.25;
        const tipX = cx + rx * 0.92, tipY = cy - ry * 0.5;
        return [_dot(bx, cy, bodyR, o),
                _line(bx + bodyR * 0.7, cy - bodyR * 0.4, tipX, tipY, o),
                _dot(tipX, tipY, Math.max(1.5, r * 0.14), f),
                _curve(bx - bodyR * 0.5, cy - bodyR * 0.7,
                       bx, cy - bodyR * 1.9,
                       bx + bodyR * 0.6, cy - bodyR * 0.8, f)];
      }
      case 'stone':     // canto rodado: silueta irregular pero fija
        return [_blob(cx, cy, rx, ry, LOBES.stone, o)];
      case 'bench': {   // banco: tablero con sus lamas
        const slats = [];
        for (let i = 1; i <= 3; i++) {
          const y = b.y + (b.h * i) / 4;
          slats.push(_line(b.x + b.w * 0.06, y, b.x + b.w * 0.94, y, f));
        }
        return [_rectEl(b.x, b.y, b.w, b.h, o), ...slats];
      }
      case 'fountain':  // pilón, taza y surtidor
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.66, f),
                _dot(cx, cy, r * 0.36, f),
                _dot(cx, cy, Math.max(1.5, r * 0.12), o)];
      case 'pond':      // lámina de agua con su orilla
        return [_blob(cx, cy, rx, ry, LOBES.pond, o),
                _blob(cx, cy, rx * 0.74, ry * 0.74, LOBES.pond, f)];
      case 'path':      // sendero: dos bordes que serpentean
        return [_wave(b.x, b.y + b.h * 0.2, b.x + b.w, b.y + b.h * 0.2,
                      Math.max(2, b.h * 0.16), 4, o),
                _wave(b.x, b.y + b.h * 0.8, b.x + b.w, b.y + b.h * 0.8,
                      Math.max(2, b.h * 0.16), 4, o)];
      default:          // maceta: borde y boca
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.72, f)];
    }
  }

  return { elements, MIN_SPAN, LABEL_SIZE, LABEL_GAP };
})();
