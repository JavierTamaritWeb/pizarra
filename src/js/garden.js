/* ============================================================
   garden.js — Geometría pura de la sección "Jardín". Parcelas y caminos se
   dibujan en planta; la vegetación admite PLANTA y ALZADO paisajístico.

   Mismo contrato que js/building.js: herramientas SOLO de creación, que
   producen elementos YA EXISTENTES —rect, line, circle, curveArrow (suelto o
   encadenado, siempre heads:'none') y text (la etiqueta)— sin tipos nuevos,
   así que renderer/exporter/isValidElement/bounds siguen intactos. Objetos
   planos y serializables, sin `seed` (lo pone app.js con withSeeds) ni DOM.
     · Jardín     : parcela rect / redonda / en L / orgánica, con césped
     · Árbol      : copa vista desde arriba, 6 especies
     · Arbusto    : mata, seto, macizo, topiario
     · Flor       : margarita, rosa, tulipán, parterre, girasol
     · Decoración : maceta, pozo, regadera, piedra, banco, fuente, reloj de
                    sol (de suelo o de pared) y estanque
     · Caminos    : serpenteante o recto, liso o empedrado

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
  /* Tope de cantos por hilera. El tamaño del canto lo manda el ancho del
     camino, no su largo —como en un empedrado de verdad—, así que el número
     crece con el recorrido; esto es solo un freno para que un camino de punta
     a punta del lienzo no suelte cientos de piezas. Al llegar al tope el
     empedrado se va aclarando, que es preferible a quedarse a medias. El tope
     está en el mismo orden que las 42 briznas de una parcela: es lo máximo que
     esta app da por razonable soltar de un solo arrastre. */
  const PATH_COLS  = 18;
  /* Empedrado: las hileras crecen con el ancho del camino (una cada PATH_ROW_H
     px) en vez de engordar los cantos, con un tope por si alguien se va a un
     camino de 120 px de ancho. PATH_STONES acota el TOTAL —el freno de
     PATH_COLS solo mira una hilera—, y PATH_SPREAD deja sitio al canto de las
     hileras de los extremos para que no asomen por los bordes. */
  const PATH_ROWS = 6, PATH_ROW_H = 17, PATH_STONES = 96, PATH_SPREAD = 0.92;
  const PLANT_PX_PER_M_MIN = 8, PLANT_PX_PER_M_MAX = 50;
  /* Tope de tramos de la escala gráfica: a 8 px/m un arrastre ancho pediría
     veinte y la barra se volvería una cremallera ilegible. */
  const SCALE_BAR_MAX_M = 10;
  const PLANT_SCALE_MIN = 50, PLANT_SCALE_MAX = 150;
  const PLANT_TOOLS = Object.freeze([
    TOOLS.GARDEN_TREE, TOOLS.GARDEN_SHRUB, TOOLS.GARDEN_FLOWER,
    TOOLS.GARDEN_HERB, TOOLS.GARDEN_CLIMBER,
  ]);

  /* Tamaño al hacer clic sin arrastrar. Ojo: aquí NO basta con una caja por
     herramienta como en Edificios —donde una Puerta mide igual sea del tipo
     que sea—, porque en el jardín la variante manda: un seto es apaisado, un
     camino aún más, y una flor suelta es un punto. `byVariant` sobreescribe la
     caja base. Escala de referencia: una parcela de 320 px ≈ 16 m, o sea unos
     20 px por metro (un árbol de 96 px es una copa de ~5 m). */
  const DEFAULTS = {
    [TOOLS.GARDEN_PLOT]:   { w: 320, h: 240, byVariant: {
      square: { w: 280, h: 280 } } },
    [TOOLS.GARDEN_TREE]:   { w: 96, h: 96, byVariant: {
      palm: { w: 72, h: 72 }, cypress: { w: 40, h: 40 },
      carob: { w: 124, h: 112 } } },   // el algarrobo hace copa ancha
    [TOOLS.GARDEN_SHRUB]:  { w: 56, h: 56, byVariant: {
      hedge: { w: 180, h: 40 }, oleander: { w: 80, h: 80 },
      box: { w: 64, h: 48 } } },
    [TOOLS.GARDEN_HERB]:   { w: 40, h: 40, byVariant: {
      thyme: { w: 52, h: 34 },        // el tomillo tapiza, no hace mata
      agave: { w: 70, h: 70 }, pricklypear: { w: 76, h: 66 } } },
    [TOOLS.GARDEN_CLIMBER]: { w: 120, h: 90 },
    [TOOLS.GARDEN_FLOWER]: { w: 28, h: 28, byVariant: {
      bed: { w: 140, h: 90 }, sunflower: { w: 36, h: 36 } } },
    [TOOLS.GARDEN_DECOR]:  { w: 48, h: 48, byVariant: {
      pot: { w: 34, h: 40 },  well:  { w: 44, h: 44 },  can:  { w: 36, h: 30 },
      stone: { w: 40, h: 32 }, bench: { w: 62, h: 24 }, fountain: { w: 70, h: 70 },
      pond: { w: 150, h: 95 },
      sundial: { w: 64, h: 64 }, sundialWall: { w: 60, h: 46 },
      // La piscina es una pieza física: 8×4 m a la escala de referencia de la
      // sección (20 px/m). Las otras dos son símbolos de plano, así que su
      // tamaño es el que se lee bien, no una medida del jardín.
      pool: { w: 160, h: 80 }, north: { w: 48, h: 64 },
      scalebar: { w: 120, h: 26 } } },
    // El camino no está aquí: no se define por una caja sino por un eje, y su
    // tamaño por defecto vive en PATH_LEN / PATH_W_* (ver `_pathAxis`).
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
    [TOOLS.GARDEN_PATH]:   { list: PATH_TYPES,    key: 'pathType'    },
    [TOOLS.GARDEN_HERB]:   { list: HERB_TYPES,    key: 'herbType'    },
    [TOOLS.GARDEN_CLIMBER]:{ list: CLIMBER_TYPES, key: 'climberType' },
  };

  const _spec = (tool, id) => {
    const cat = CATALOGS[tool];
    return cat && cat.list.find(v => v.id === id) || null;
  };

  const _plantInk = (o, spec) => o.plantColorMode === 'natural' && spec ? {
    ...o,
    labelColor: o.color,
    color: spec.foliage || '#4f7248',
  } : o;

  const _accentInk = (o, spec) => o.plantColorMode === 'natural' && spec && spec.accent
    ? { ...o, color: spec.accent }
    : _fine(o);

  /* Segunda tinta de flor del dondiego de noche: la especie mezcla corolas
     fucsias y blancas en la misma mata, así que su `accent` no basta. Blanco
     cálido, en la familia de los cremas que ya usan mirto y alcaparra. */
  const MIRABILIS_WHITE = '#ece4d6';

  const _trunkInk = o => o.plantColorMode === 'natural'
    ? { ...o, color: '#755642', fillColor: '#9a7658' }
    : o;

  function plantSize(tool, id, opts) {
    const spec = _spec(tool, id);
    if (!PLANT_TOOLS.includes(tool) || !spec ||
        !Number.isFinite(spec.heightM) || !Number.isFinite(spec.spreadM)) return null;
    const o = opts || {};
    const stage = GARDEN_STAGES.find(v => v.id === o.plantStage) ||
      GARDEN_STAGES.find(v => v.id === 'adult');
    const pct = Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX,
      Number.isFinite(o.plantScalePct) ? o.plantScalePct : 100));
    const factor = stage.factor * pct / 100;
    return {
      spec, stage: stage.id,
      heightM: spec.heightM * factor,
      spreadM: spec.spreadM * factor,
      depthM: (Number.isFinite(spec.depthM) ? spec.depthM : spec.spreadM) * factor,
    };
  }

  function _plantDefault(tool, variant, o) {
    const size = plantSize(tool, variant, o);
    if (!size) return null;
    const px = Math.max(PLANT_PX_PER_M_MIN, Math.min(PLANT_PX_PER_M_MAX,
      Number.isFinite(o.plantPxPerM) ? o.plantPxPerM : 20));
    const elevation = o.plantView === 'elevation';
    return {
      w: Math.max(5, size.spreadM * px),
      h: Math.max(5, (elevation ? size.heightM : size.depthM) * px),
    };
  }

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
    let o = { color: '#000000', lineWidth: 2, ...(opts || {}) };
    const variant = _variant(tool, o);
    if (variant === null) return [];     // no es una herramienta del jardín
    // El «color natural» es un ajuste BOTÁNICO: tiñe el dibujo con el follaje
    // de la especie. La Decoración no tiene follaje —es mobiliario y símbolos
    // de plano: un banco, un pozo, la flecha de norte, la escala—, pero su
    // entrada de catálogo existe igual, así que `_plantInk` la daba por buena
    // y le aplicaba su verde de reserva: TODA la decoración salía verde
    // (reportado por el usuario, v2.41.1). Ahí manda el color del trazo.
    if (tool !== TOOLS.GARDEN_DECOR) o = _plantInk(o, _spec(tool, variant));
    // El camino se resuelve aparte porque de su arrastre salen DOS cosas —el
    // recorrido por el lado largo y el grosor por el corto—, y porque su caja
    // por defecto no es un tamaño sino un largo. La etiqueta va bajo la caja
    // del trazado, no bajo la del arrastre: el camino no la llena entera.
    if (tool === TOOLS.GARDEN_PATH) {
      const cfg = PATH_VARIANTS[variant] || PATH_VARIANTS.path;
      const ax = o.freeAngle ? _pathAxisFree(p1, p2, cfg, o) : _pathAxis(p1, p2, cfg, o);
      return _labelled(_pathTool(ax, o, variant), _pathBox(ax), tool, variant, o);
    }
    const base = DEFAULTS[tool];
    if (!base) return [];
    const def = _plantDefault(tool, variant, o) ||
      (base.byVariant && base.byVariant[variant]) || base;
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    const b = {
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      w: rawW >= MIN_SPAN ? rawW : def.w,
      h: rawH >= MIN_SPAN ? rawH : def.h,
    };
    // La parcela cuadrada es la única variante que impone su proporción, y se
    // arregla aquí y no en `_plotTool` porque la etiqueta se coloca a partir de
    // esta misma caja: si la encogiera el generador, el nombre quedaría
    // descolgado del dibujo. Se toma el lado menor y se centra en el arrastre.
    if (tool === TOOLS.GARDEN_PLOT && variant === 'square') {
      const side = Math.min(b.w, b.h);
      b.x += (b.w - side) / 2; b.y += (b.h - side) / 2;
      b.w = side; b.h = side;
    }
    let els;
    if (PLANT_TOOLS.includes(tool) && o.plantView === 'elevation') {
      els = _plantElevation(tool, b, o, variant);
      return _labelled(els, b, tool, variant, o);
    }
    switch (tool) {
      case TOOLS.GARDEN_PLOT:   els = _plotTool(b, o, variant);   break;
      case TOOLS.GARDEN_TREE:   els = _treeTool(b, o, variant);   break;
      case TOOLS.GARDEN_SHRUB:  els = _shrubTool(b, o, variant);  break;
      case TOOLS.GARDEN_FLOWER: els = _flowerTool(b, o, variant); break;
      case TOOLS.GARDEN_DECOR:  els = _decorTool(b, o, variant);  break;
      case TOOLS.GARDEN_HERB:   els = _herbTool(b, o, variant);   break;
      case TOOLS.GARDEN_CLIMBER:els = _climberPlan(b, o, variant); break;
      default: return [];
    }
    return _labelled(els, b, tool, variant, o);
  }

  /** Descarta piezas nulas y rotula bajo `b` el nombre de la variante. */
  function _labelled(els, b, tool, variant, o) {
    const out = els.filter(Boolean);
    if (o.labels !== false) {
      const spec = _spec(tool, variant);
      const size = plantSize(tool, variant, o);
      let text = _variantName(tool, variant);
      if (spec && o.gardenLabelMode === 'botanical') {
        text += ` · ${spec.botanical}`;
      } else if (size && o.gardenLabelMode === 'dimensions') {
        text += ` · H ${_metres(size.heightM)} m · Ø ${_metres(size.spreadM)} m`;
      }
      const label = _label(text, b, o);
      if (label) out.push(label);
    }
    return out;
  }

  const _metres = n => Number(n.toFixed(n < 1 ? 2 : 1)).toLocaleString('es-ES');

  /* ── primitivas ── */

  const _line = (x1, y1, x2, y2, o) =>
    ({ type: 'line', x1, y1, x2, y2, color: o.color, lineWidth: o.lineWidth });

  const _shapePaint = o => o.fill ? {
    fill: true,
    fillColor: o.fillColor || o.color,
    fillTransparent: o.fillTransparent !== false,
    fillOpacity: Number.isFinite(o.fillOpacity) ? o.fillOpacity : 0.18,
  } : { fill: false };

  const _rectEl = (x, y, w, h, o) =>
    ({ type: 'rect', x, y, w, h, color: o.color, lineWidth: o.lineWidth, ..._shapePaint(o) });

  const _circleEl = (x, y, w, h, o) =>
    ({ type: 'circle', x, y, w, h, color: o.color, lineWidth: o.lineWidth, ..._shapePaint(o) });

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

  /** La misma tabla de lóbulos girada `k` posiciones: así dos cantos seguidos
      no salen calcados sin tener que recurrir a Math.random(). */
  const _turn = (table, k) =>
    table.map((_, i) => table[(i + k) % table.length]);

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
    // El algarrobo SÍ alterna a propósito: con 14 puntos la alternancia da
    // simetría de orden 7, que se lee como una copa densa y festoneada. Lo que
    // hay que evitar es alternar con pocos puntos (ver `clump`, orden 4 = rombo).
    carob:     [1, 0.87, 1, 0.87, 1, 0.87, 1, 0.87, 1, 0.87, 1, 0.87, 1, 0.87],
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
      color: o.labelColor || o.color,
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
    if (type === 'malvasia') {
      return _malvasiaPergolaPlan(b, o, _spec(TOOLS.GARDEN_TREE, type));
    }
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
      case 'almond': {  // almendro: copa clara y abierta, con la flor en la periferia
        const blossom = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          blossom.push(_dot(cx + Math.cos(a) * rx * 0.7, cy + Math.sin(a) * ry * 0.7,
                            Math.max(1.2, r * 0.11), f));
        }
        return [_circleEl(b.x, b.y, b.w, b.h, o), ...blossom,
                ..._spokes(cx, cy, rx, ry, 4, 0.16, 0.5, f),
                _trunk(cx, cy, r, f)];
      }
      case 'carob':     // algarrobo: copa densa y festoneada, con su sombra dentro
        return [_blob(cx, cy, rx, ry, LOBES.carob, o),
                _blob(cx, cy, rx * 0.66, ry * 0.66, LOBES.carob, f),
                _trunk(cx, cy, r, f)];
      case 'fruit': {   // copa redonda con la fruta marcada
        const fruits = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          fruits.push(_dot(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55,
                           Math.max(1.5, r * 0.09), f));
        }
        return [_circleEl(b.x, b.y, b.w, b.h, o), ...fruits, _trunk(cx, cy, r, f)];
      }
      case 'fig': {     // higuera: hojas grandes y copa ancha, algo abierta
        const leaves = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.18;
          leaves.push(_dot(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55,
            Math.max(1.4, r * 0.13), f));
        }
        return [_blob(cx, cy, rx, ry, LOBES.broadleaf, o), ...leaves,
                ..._spokes(cx, cy, rx, ry, 3, 0.15, 0.58, f), _trunk(cx, cy, r, f)];
      }
      case 'pomegranate': { // granado: copa menor, abierta, con frutos periféricos
        const a = _accentInk(o, _spec(TOOLS.GARDEN_TREE, type));
        return [_blob(cx, cy, rx, ry, LOBES.olive, o),
                _dot(cx - rx * 0.5, cy - ry * 0.35, Math.max(1.5, r * 0.1), a),
                _dot(cx + rx * 0.52, cy + ry * 0.16, Math.max(1.5, r * 0.1), a),
                _dot(cx - rx * 0.12, cy + ry * 0.55, Math.max(1.5, r * 0.1), a),
                ..._spokes(cx, cy, rx, ry, 4, 0.18, 0.65, f), _trunk(cx, cy, r, f)];
      }
      case 'lemon': {   // limonero: copa densa con fruta oval sugerida por parejas
        const a = _accentInk(o, _spec(TOOLS.GARDEN_TREE, type));
        const fruit = [[-0.45,-0.25],[0.08,-0.52],[0.48,-0.1],[-0.2,0.42],[0.4,0.4],[-0.55,0.25]];
        return [_circleEl(b.x, b.y, b.w, b.h, o),
          ...fruit.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy, Math.max(1.2, r * 0.075), a)),
          _dot(cx, cy, r * 0.7, f), _trunk(cx, cy, r, f)];
      }
      case 'jacaranda': { // jacaranda: copa aparasolada con racimos florales
        const a = _accentInk(o, _spec(TOOLS.GARDEN_TREE, type));
        const blossom = [[-0.55,-0.3],[-0.12,-0.58],[0.42,-0.38],[0.58,0.16],[0.08,0.52],[-0.48,0.35]];
        return [_blob(cx, cy, rx, ry, LOBES.bed, o),
          ...blossom.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy, Math.max(1.5, r * 0.12), a)),
          ..._spokes(cx, cy, rx, ry, 6, 0.16, 0.62, f), _trunk(cx, cy, r, f)];
      }
      case 'persimmon': { // caqui: copa ancha y el fruto grande, que es su seña
        const a = _accentInk(o, _spec(TOOLS.GARDEN_TREE, type));
        const fruit = [[-0.46, -0.28], [0.34, -0.44], [0.5, 0.22], [-0.24, 0.5]];
        return [_blob(cx, cy, rx, ry, LOBES.broadleaf, o),
          ...fruit.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy,
            Math.max(1.8, r * 0.16), a)),
          ..._spokes(cx, cy, rx, ry, 6, 0.18, 0.66, f), _trunk(cx, cy, r, f)];
      }
      case 'cypress':   // copa compacta de conífera: verticilos densos, no anillos de boj
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                ..._spokes(cx, cy, rx, ry, 14, 0.18, 0.86, f),
                _dot(cx, cy, r * 0.42, f),
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
      case 'clump': {   // alcaparra: mata rastrera irregular con capullos claros
        const a = _accentInk(o, _spec(TOOLS.GARDEN_SHRUB, type));
        const buds = [[-.5,-.2],[-.12,-.48],[.42,-.25],[.28,.38],[-.4,.34]];
        return [_blob(cx, cy, rx, ry, LOBES.clump, o),
                ...buds.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy,
                  Math.max(1.3, r * .12), a)),
                ..._spokes(cx, cy, rx, ry, 6, .18, .72, f)];
      }
      case 'topiary':   // bola recortada: anillos concéntricos
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.62, f),
                _dot(cx, cy, r * 0.28, f)];
      case 'oleander': { // romero arbustivo: ramas radiales y hoja lineal
        const a = _accentInk(o, _spec(TOOLS.GARDEN_SHRUB, type));
        const flowers = [];
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.35;
          flowers.push(_dot(cx + Math.cos(ang) * rx * 0.55,
            cy + Math.sin(ang) * ry * 0.55, Math.max(1.3, r * 0.1), a));
        }
        return [_blob(cx, cy, rx, ry, LOBES.clump, o),
                ..._spokes(cx, cy, rx, ry, 10, .16, .82, f), ...flowers];
      }
      case 'box': {     // olivo recortado: masa cúbica de hoja estrecha
        const texture = [];
        for (let i = 1; i <= 4; i++) {
          const x = b.x + (b.w * i) / 5;
          texture.push(_line(x, b.y + b.h * 0.12, x, b.y + b.h * 0.88, f));
        }
        return [_rectEl(b.x, b.y, b.w, b.h, o), ...texture];
      }
      case 'mastic': {  // lentisco: mata densa e irregular, de hoja menuda
        const leaves = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.25;
          leaves.push(_line(cx + Math.cos(a) * rx * 0.34, cy + Math.sin(a) * ry * 0.34,
                            cx + Math.cos(a) * rx * 0.72, cy + Math.sin(a) * ry * 0.72, f));
        }
        return [_blob(cx, cy, rx, ry, LOBES.stone, o), ...leaves];
      }
      case 'strawberryTree': { // madroño: bayas sobre una mata compacta
        const a = _accentInk(o, _spec(TOOLS.GARDEN_SHRUB, type));
        return [_blob(cx, cy, rx, ry, LOBES.broadleaf, o),
                _dot(cx - rx * 0.44, cy - ry * 0.34, Math.max(1.3, r * 0.1), a),
                _dot(cx + rx * 0.46, cy - ry * 0.05, Math.max(1.3, r * 0.1), a),
                _dot(cx, cy + ry * 0.5, Math.max(1.3, r * 0.1), a),
                ..._spokes(cx, cy, rx, ry, 5, 0.2, 0.7, f)];
      }
      case 'mirabilis': { // dondiego de noche: trompetas por TODA la mata
        const a = _accentInk(o, _spec(TOOLS.GARDEN_SHRUB, type));
        // La especie (también llamada «don Pedro») mezcla flores fucsias y
        // BLANCAS incluso en la misma mata: una de cada tres sale en blanco
        // cálido en modo natural (en tinta, ambas caen a _fine, como el
        // accent). Petición del usuario, v2.40.1.
        const w = o.plantColorMode === 'natural'
          ? { ...o, color: MIRABILIS_WHITE } : f;
        const flowers = [];
        // Dos coronas de flores, no un anillo: el dondiego florece repartido
        // por toda la superficie, y eso es lo que lo distingue en planta de
        // la jara (un anillo de cinco) o el romero (seis y muchas ramas).
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + 0.6;
          const rad = i % 2 ? 0.62 : 0.36;
          flowers.push(_dot(cx + Math.cos(ang) * rx * rad,
            cy + Math.sin(ang) * ry * rad, Math.max(1.4, r * 0.11),
            i % 3 === 1 ? w : a));
        }
        return [_blob(cx, cy, rx, ry, LOBES.clump, o),
                ..._spokes(cx, cy, rx, ry, 4, 0.16, 0.6, f), ...flowers];
      }
      case 'pittosporum': { // jara: mata grisácea con flores grandes de cinco pétalos
        const a = _accentInk(o, _spec(TOOLS.GARDEN_SHRUB, type));
        const flowers = [];
        for (let i = 0; i < 5; i++) {
          const ang = i / 5 * Math.PI * 2 - Math.PI / 2;
          flowers.push(_dot(cx + Math.cos(ang) * rx * .52,
            cy + Math.sin(ang) * ry * .52, Math.max(1.5, r * .12), a));
        }
        return [_blob(cx, cy, rx, ry, LOBES.clump, o), ...flowers,
                _dot(cx, cy, Math.max(1.5, r * 0.1), f)];
      }
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

  /* ── Aromáticas y mediterráneas ── */

  /**
   * Roseta de hojas: los brazos arrancan del centro y terminan en punta.
   * Es la silueta de un agave o un aloe vistos desde arriba, y lo que los
   * distingue de cualquier mata redonda.
   */
  function _rosette(cx, cy, rx, ry, count, o, curved) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.15;
      const tx = cx + Math.cos(a) * rx, ty = cy + Math.sin(a) * ry;
      if (curved) {
        const mx = (cx + tx) / 2, my = (cy + ty) / 2;
        const len = Math.hypot(tx - cx, ty - cy);
        out.push(_curve(cx, cy, mx - Math.sin(a) * len * 0.26, my + Math.cos(a) * len * 0.26,
                        tx, ty, o));
      } else {
        out.push(_line(cx, cy, tx, ty, o));
      }
    }
    return out;
  }

  function _herbTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'rosemary': {  // romero: mata suelta con la hoja fina marcada
        const needles = [];
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.35;
          needles.push(_line(cx + Math.cos(a) * rx * 0.3, cy + Math.sin(a) * ry * 0.3,
                             cx + Math.cos(a) * rx * 0.78, cy + Math.sin(a) * ry * 0.78, f));
        }
        return [_blob(cx, cy, rx, ry, LOBES.clump, o), ...needles];
      }
      case 'thyme': {     // tomillo: tapiz bajo y menudo
        const dots = [];
        const spots = [[-0.45, -0.25], [0.05, -0.45], [0.45, -0.1],
                       [-0.3, 0.3], [0.25, 0.4], [-0.05, 0.05]];
        spots.forEach(([sx, sy]) =>
          dots.push(_dot(cx + rx * sx * 0.85, cy + ry * sy * 0.85, Math.max(1.2, r * 0.12), f)));
        return [_blob(cx, cy, rx, ry, LOBES.bed, o), ...dots];
      }
      case 'sage':        // salvia: mata con la hoja ancha
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                ..._rosette(cx, cy, rx * 0.72, ry * 0.72, 5, f, true)];
      case 'lemonverbena': { // maría luisa: mata abierta, hoja de tres en tres
        const a = _accentInk(o, _spec(TOOLS.GARDEN_HERB, type));
        const whorls = [];
        // El verticilo de tres hojas es su rasgo de identificación en campo. Van
        // cortos y repetidos: abiertos y escasos se leen como flechas sueltas.
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2 + 0.25;
          const d = 0.42 + (i % 3) * 0.15;
          const hx = cx + Math.cos(ang) * rx * d, hy = cy + Math.sin(ang) * ry * d;
          for (let j = -1; j <= 1; j++) {
            // 120° entre hojas: es el verticilo real, y además evita que las
            // tres juntas se lean como una punta de flecha hacia afuera.
            const la = ang + j * (Math.PI * 2 / 3);
            whorls.push(_line(hx, hy, hx + Math.cos(la) * rx * 0.22,
                                     hy + Math.sin(la) * ry * 0.22, f));
          }
        }
        const panicles = [[-0.3, -0.52], [0.5, -0.16], [-0.06, 0.55]].map(([sx, sy]) =>
          _dot(cx + rx * sx, cy + ry * sy, Math.max(1.2, r * 0.085), a));
        return [_blob(cx, cy, rx, ry, LOBES.broadleaf, o), ...whorls, ...panicles];
      }
      case 'mint': {      // hierbabuena: mata baja con estolones que se escapan
        const a = _accentInk(o, _spec(TOOLS.GARDEN_HERB, type));
        const runners = [], tips = [];
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + 0.6;
          const ex = cx + Math.cos(ang) * rx * 1.14, ey = cy + Math.sin(ang) * ry * 1.14;
          runners.push(_curve(cx + Math.cos(ang) * rx * 0.3, cy + Math.sin(ang) * ry * 0.3,
                              cx + Math.cos(ang + 0.55) * rx * 0.82,
                              cy + Math.sin(ang + 0.55) * ry * 0.82, ex, ey, f));
          tips.push(_dot(ex, ey, Math.max(1.2, r * 0.09), a));   // brote enraizado
        }
        // Hoja opuesta: dos trazos enfrentados en cada nudo, no una raya suelta.
        const pairs = [];
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + 0.2;
          const px = cx + Math.cos(ang) * rx * 0.44, py = cy + Math.sin(ang) * ry * 0.44;
          // Enfrentadas pero no alineadas: a 180° exactos las dos se leerían
          // como un solo trazo recto atravesando la mata.
          for (const la of [ang + 1.15, ang - 1.15]) {
            pairs.push(_line(px, py, px + Math.cos(la) * rx * 0.19,
                                     py + Math.sin(la) * ry * 0.19, f));
          }
        }
        // `plot` tiene 12 lóbulos suaves: con 8 el tapiz salía con esquinas.
        return [_blob(cx, cy, rx * 0.8, ry * 0.8, LOBES.plot, o),
                ...runners, ...tips, ...pairs];
      }
      case 'santolina':   // santolina: bola apretada con sus botones
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.55, f),
                _dot(cx - rx * 0.4, cy - ry * 0.3, Math.max(1.2, r * 0.13), f),
                _dot(cx + rx * 0.38, cy + ry * 0.34, Math.max(1.2, r * 0.13), f)];
      case 'agave':       // agave: roseta rígida de hoja puntiaguda
        return [..._rosette(cx, cy, rx, ry, 11, o, false),
                _dot(cx, cy, Math.max(1.5, r * 0.13), f)];
      case 'aloe':        // aloe: roseta menor, de hoja curva y carnosa
        return [..._rosette(cx, cy, rx, ry, 7, o, true),
                _dot(cx, cy, Math.max(1.5, r * 0.16), f)];
      case 'pricklypear': { // chumbera: palas encadenadas
        const pads = [_circleEl(b.x, b.y + b.h * 0.3, b.w * 0.5, b.h * 0.7, o),
                      _circleEl(b.x + b.w * 0.42, b.y, b.w * 0.44, b.h * 0.62, o),
                      _circleEl(b.x + b.w * 0.3, b.y + b.h * 0.45, b.w * 0.42, b.h * 0.55, o)];
        return pads;
      }
      default: {          // lavanda: mata con las espigas asomando
        const spikes = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.5;
          spikes.push(_line(cx + Math.cos(a) * rx * 0.62, cy + Math.sin(a) * ry * 0.62,
                            cx + Math.cos(a) * rx * 1.18, cy + Math.sin(a) * ry * 1.18, f));
        }
        return [_blob(cx, cy, rx * 0.78, ry * 0.78, LOBES.olive, o), ...spikes];
      }
    }
  }

  /* ── Flor ── */

  function _flowerTool(b, o, type) {
    const f = _fine(o), a = _accentInk(o, _spec(TOOLS.GARDEN_FLOWER, type));
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2, r = Math.min(rx, ry);
    switch (type) {
      case 'rose': {    // rosa siempreverde: corola clásica de cinco pétalos
        const petals = [];
        for (let i = 0; i < 5; i++) {
          const ang = i / 5 * Math.PI * 2 - Math.PI / 2;
          petals.push(_dot(cx + Math.cos(ang) * rx * .4,
            cy + Math.sin(ang) * ry * .4, r * .4, a));
        }
        return [...petals, _dot(cx, cy, Math.max(1.5, r * .28), a),
          _dot(cx, cy, Math.max(1.1, r * .1), f)];
      }
      case 'tulip': {   // estátice: nube ramificada de pequeñas flores papiráceas
        const blooms = [[-.45,-.28],[-.16,-.52],[.16,-.42],[.46,-.18],
          [-.34,.18],[0,.08],[.38,.28],[-.05,.46]];
        return [_blob(cx, cy, rx * .82, ry * .78, LOBES.bed, o),
          ...blooms.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy,
            Math.max(1.2, r * .12), a)),
          ..._spokes(cx, cy, rx, ry, 5, .08, .68, f)];
      }
      case 'bed': {     // parterre: masa de flores, no una flor suelta
        const dots = [];
        const spots = [[-0.5, -0.3], [0.1, -0.5], [0.5, -0.1], [-0.2, 0.1],
                       [0.3, 0.4], [-0.5, 0.4], [0, 0.6]];
        spots.forEach(([sx, sy]) =>
          dots.push(_dot(cx + rx * sx * 0.8, cy + ry * sy * 0.8, Math.max(1.5, r * 0.13), a)));
        return [_blob(cx, cy, rx, ry, LOBES.bed, o), ...dots];
      }
      case 'sunflower': { // boca de dragón: racimo compacto de flores bilabiadas
        const blooms = [[-.28,-.42],[.28,-.3],[-.32,0],[.3,.12],[-.18,.38]];
        return [..._spokes(cx, cy, rx, ry, 6, .12, .84, f),
          ...blooms.map(([sx, sy]) => [
            _dot(cx + rx * sx, cy + ry * sy, Math.max(1.3, r * .22), a),
            _dot(cx + rx * sx + r * .13, cy + ry * sy + r * .08,
              Math.max(1.1, r * .12), a),
          ]).flat(), _dot(cx, cy, Math.max(1.2, r * .13), f)];
      }
      case 'seadaffodil': {  // lirio de mar: roseta de hoja acintada + umbela
        const umbel = [];
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
          umbel.push(_dot(cx + Math.cos(ang) * rx * .34, cy + Math.sin(ang) * ry * .34,
            Math.max(1.3, r * .13), a));
        }
        return [..._rosette(cx, cy, rx, ry, 6, f, true), ...umbel,
          _dot(cx, cy, Math.max(1.2, r * .12), f)];
      }
      case 'snowbell': {     // campanilla valenciana: mata menuda de hoja linear
        const bells = [[-.44, -.38], [.44, -.3], [.03, .46]].map(([sx, sy]) =>
          _dot(cx + rx * sx, cy + ry * sy, Math.max(1.2, r * .13), a));
        return [..._spokes(cx, cy, rx, ry, 5, .1, .92, f), ...bells,
          _dot(cx, cy, Math.max(1.1, r * .1), f)];
      }
      case 'rockdragon': {   // boca de dragón de roca: tallos tendidos y flores
        const out = [];
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + .4;
          const ex = cx + Math.cos(ang) * rx * .92, ey = cy + Math.sin(ang) * ry * .92;
          out.push(_curve(cx, cy, cx + Math.cos(ang + .5) * rx * .5,
            cy + Math.sin(ang + .5) * ry * .5, ex, ey, f));
          // Corola bilabiada: dos lóbulos, como en la boca de dragón de jardín.
          out.push(_dot(ex, ey, Math.max(1.3, r * .17), a));
          out.push(_dot(ex + Math.cos(ang) * r * .13, ey + Math.sin(ang) * r * .13,
            Math.max(1.1, r * .1), a));
        }
        return out;
      }
      case 'silene': {       // silene de Ifach: cojín rupícola con flor rosada
        const blooms = [[-.4, -.34], [.42, -.26], [-.14, .42], [.34, .36]].map(([sx, sy]) =>
          _dot(cx + rx * sx, cy + ry * sy, Math.max(1.2, r * .1), a));
        return [_blob(cx, cy, rx * .84, ry * .84, LOBES.stone, o),
          ..._spokes(cx, cy, rx, ry, 7, .3, .78, f), ...blooms];
      }
      case 'saladina': {     // limonio: roseta basal y panícula muy ramificada
        const panicle = [[-.42, -.34], [.1, -.5], [.48, -.16],
          [-.28, .28], [.24, .42], [-.02, .04]];
        const branches = [[-.42, -.34], [.48, -.16], [.24, .42]].map(([sx, sy]) =>
          _line(cx, cy, cx + rx * sx, cy + ry * sy, f));
        return [..._rosette(cx, cy, rx * .92, ry * .92, 7, f, true), ...branches,
          ...panicle.map(([sx, sy]) => _dot(cx + rx * sx, cy + ry * sy,
            Math.max(1, r * .075), a))];
      }
      case 'trumpetdaffodil': {  // narciso: seis tépalos y la trompa en el centro
        const tepals = [];
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          tepals.push(_dot(cx + Math.cos(ang) * rx * .44, cy + Math.sin(ang) * ry * .44,
            Math.max(1.4, r * .26), a));
        }
        return [..._spokes(cx, cy, rx, ry, 4, .74, 1, f), ...tepals,
          _dot(cx, cy, Math.max(1.5, r * .26), a),
          _dot(cx, cy, Math.max(1.1, r * .12), f)];
      }
      default: {        // caléndula: corazón con corona densa de pétalos
        const petals = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          petals.push(_dot(cx + Math.cos(a) * rx * 0.62, cy + Math.sin(a) * ry * 0.62,
                           Math.max(1.5, r * 0.3), _accentInk(o, _spec(TOOLS.GARDEN_FLOWER, type))));
        }
        return [...petals, _dot(cx, cy, Math.max(1.5, r * 0.3), o)];
      }
    }
  }

  /* ── Vegetación en alzado ── */

  const _ground = (b, o) => _line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, _fine(o));

  const _massInk = (o, spec, opacity = 0.16) => o.plantColorMode === 'natural'
    ? { ...o, color: spec.foliage, fill: true, fillColor: spec.foliage,
        fillTransparent: true, fillOpacity: opacity }
    : { ...o, fill: false };

  function _taperedTrunk(cx, baseY, topY, width, o) {
    const t = _trunkInk(o), half = Math.max(1, width / 2), top = half * 0.42;
    return [
      _line(cx - half, baseY, cx - top, topY, t),
      _line(cx + half, baseY, cx + top, topY, t),
      _line(cx - half, baseY, cx + half, baseY, t),
    ];
  }

  function _treeElevation(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_TREE, type);
    if (type === 'malvasia') return _malvasiaPergolaElevation(b, o, spec);
    const f = _fine(o), a = _accentInk(o, spec), mass = _massInk(o, spec);
    const cx = b.x + b.w / 2, baseY = b.y + b.h;
    const out = [_ground(b, o)];

    if (spec.habit === 'palm') {
      const crownY = b.y + b.h * 0.22;
      out.push(..._taperedTrunk(cx, baseY, crownY, b.w * 0.1, o));
      for (let i = 1; i <= 7; i++) {
        const y = crownY + (baseY - crownY) * i / 8;
        out.push(_line(cx - b.w * 0.045, y, cx + b.w * 0.045, y - b.h * 0.015, f));
      }
      for (let i = 0; i < 11; i++) {
        const t = i / 10, tx = b.x + b.w * (0.03 + t * 0.94);
        const droop = Math.abs(t - 0.5) * b.h * 0.3;
        out.push(_curve(cx, crownY, cx + (tx - cx) * 0.45, b.y - b.h * 0.04,
          tx, crownY + droop, o));
      }
      out.push(_dot(cx, crownY, Math.max(2, b.w * 0.055), a));
      return out;
    }

    if (spec.habit === 'columnar') {
      /* Cupressus sempervirens: silueta fastigiada en llama. El ápice termina
         en un punto real y el máximo diámetro queda en el tercio inferior;
         una elipse, aunque fuese estrecha, seguía leyéndose como una bola. */
      const foliageBase = b.y + b.h * 0.965;
      out.push(..._taperedTrunk(cx, baseY, b.y + b.h * 0.78, b.w * 0.1, o));
      // Un volumen interior muy estrecho da tono natural sin redondear el perfil.
      out.push(_circleEl(b.x + b.w * 0.29, b.y + b.h * 0.12,
        b.w * 0.42, b.h * 0.78, mass));
      const flame = [
        [0.50, 0], [0.39, 0.09], [0.31, 0.23], [0.25, 0.42],
        [0.17, 0.64], [0.21, 0.82], [0.34, 0.96], [0.50, 0.985],
        [0.66, 0.96], [0.79, 0.82], [0.83, 0.64], [0.75, 0.42],
        [0.69, 0.23], [0.61, 0.09],
      ].map(([x, y]) => ({ x: b.x + b.w * x, y: b.y + b.h * y }));
      out.push(_chain(flame, o, true));
      out.push(_line(cx, b.y + b.h * 0.055, cx, foliageBase, f));
      for (let i = 0; i < 7; i++) {
        const y = b.y + b.h * (0.18 + i * 0.105);
        const half = b.w * (0.12 + i * 0.025);
        out.push(_curve(cx, y + b.h * 0.055, cx - half * 0.55, y,
          cx - half, y - b.h * 0.025, f));
        out.push(_curve(cx, y + b.h * 0.055, cx + half * 0.55, y,
          cx + half, y - b.h * 0.025, f));
      }
      return out;
    }

    if (type === 'conifer') {
      /* El pino piñonero adulto no es una copa redonda: fuste limpio y copa
         aparasolada, ancha y casi plana por arriba, en estratos horizontales. */
      const crownH = b.h * 0.43, trunkTop = b.y + crownH * 0.76;
      out.push(..._taperedTrunk(cx, baseY, trunkTop, b.w * 0.085, o));
      for (const side of [-1, 1]) {
        out.push(_curve(cx, trunkTop, cx + side * b.w * 0.14, b.y + crownH * 0.5,
          cx + side * b.w * 0.38, b.y + crownH * 0.32, _trunkInk(f)));
      }
      out.push(_circleEl(b.x + b.w * 0.12, b.y + crownH * 0.1,
        b.w * 0.76, crownH * 0.6, mass));
      const umbrella = [
        [0.03, .43], [.10, .24], [.30, .09], [.50, .03], [.70, .09], [.90, .24],
        [.97, .43], [.83, .66], [.61, .73], [.50, .62], [.39, .73], [.17, .66],
      ].map(([x, y]) => ({ x: b.x + b.w * x, y: b.y + crownH * y }));
      out.push(_chain(umbrella, o, true));
      out.push(_curve(b.x + b.w * .12, b.y + crownH * .43, cx, b.y + crownH * .3,
        b.x + b.w * .88, b.y + crownH * .43, f));
      return out;
    }

    const umbrella = spec.habit === 'umbrella';
    const vase = spec.habit === 'vase';
    const spreading = spec.habit === 'spreading';
    const crownH = b.h * (umbrella ? 0.45 : 0.62);
    const trunkTop = b.y + crownH * (umbrella ? 0.78 : 0.72);
    out.push(..._taperedTrunk(cx, baseY, trunkTop, b.w * (type === 'carob' ? 0.13 : 0.09), o));

    // Ramas estructurales: el porte en vaso se abre antes y deja el corazón
    // visible; el aparasolado sostiene la copa sobre un fuste más limpio.
    const branchY = trunkTop + crownH * 0.04;
    const branchCount = vase ? 4 : type === 'olive' || type === 'fig' ? 5 : 3;
    for (let i = 0; i < branchCount; i++) {
      const t = branchCount === 1 ? 0.5 : i / (branchCount - 1);
      const tx = b.x + b.w * (0.16 + t * 0.68);
      out.push(_curve(cx, branchY, cx + (tx - cx) * 0.35, branchY - crownH * 0.22,
        tx, b.y + crownH * (0.35 + Math.abs(t - 0.5) * 0.2), _trunkInk(f)));
    }

    // Volumen translúcido interior y contorno según el porte adulto real.
    out.push(_circleEl(b.x + b.w * 0.08, b.y + crownH * 0.14, b.w * 0.5, crownH * 0.66, mass));
    out.push(_circleEl(b.x + b.w * 0.42, b.y + crownH * 0.1, b.w * 0.5, crownH * 0.68, mass));
    const profiles = {
      umbrella: [[.03,.43],[.12,.22],[.32,.08],[.52,.03],[.73,.1],[.93,.27],[.97,.48],[.78,.73],[.55,.78],[.31,.74],[.08,.63]],
      vase: [[.08,.34],[.16,.17],[.33,.05],[.5,.14],[.67,.05],[.84,.17],[.92,.34],[.82,.64],[.64,.84],[.5,.7],[.36,.84],[.18,.64]],
      spreading: [[.02,.42],[.1,.23],[.29,.08],[.48,.15],[.66,.06],[.9,.2],[.98,.4],[.88,.68],[.66,.8],[.45,.72],[.24,.82],[.07,.66]],
      rounded: [[.07,.45],[.12,.24],[.3,.08],[.5,.02],[.7,.08],[.88,.24],[.94,.46],[.86,.7],[.67,.86],[.46,.82],[.25,.88],[.1,.68]],
    };
    const profile = (umbrella ? profiles.umbrella : vase ? profiles.vase :
      spreading ? profiles.spreading : profiles.rounded)
      .map(([x, y]) => ({ x: b.x + b.w * x, y: b.y + crownH * y }));
    out.push(_chain(profile, o, true));

    const details = {
      almond: 8, fruit: 6, lemon: 7, pomegranate: 4, jacaranda: 9,
      fig: 5, olive: 4, carob: 2, broadleaf: 3, conifer: 6, persimmon: 5,
    }[type] || 3;
    for (let i = 0; i < details; i++) {
      const t = (i + 0.7) / details;
      const x = b.x + b.w * (0.12 + ((i * 0.618) % 1) * 0.76);
      const y = b.y + crownH * (0.2 + (t % 0.55));
      if (['almond','fruit','lemon','pomegranate','jacaranda','persimmon'].includes(type)) {
        // El caqui carga un fruto mucho mayor que un cítrico, y es lo único
        // que lo separa del naranjo cuando la copa va sin hoja.
        out.push(_dot(x, y, Math.max(1.5, Math.min(b.w, crownH) *
          (type === 'persimmon' ? 0.062 : 0.035)), a));
      } else {
        out.push(_curve(x - b.w * 0.04, y, x, y - crownH * 0.06,
          x + b.w * 0.045, y + crownH * 0.01, f));
      }
    }
    return out;
  }

  function _shrubElevation(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_SHRUB, type);
    const f = _fine(o), a = _accentInk(o, spec), mass = _massInk(o, spec, 0.2);
    const cx = b.x + b.w / 2, baseY = b.y + b.h;
    const out = [_ground(b, o)];
    if (type === 'hedge' || type === 'box') {
      const top = type === 'hedge' ? b.y + b.h * 0.12 : b.y + b.h * 0.2;
      out.push(_rectEl(b.x + b.w * 0.02, top, b.w * 0.96, baseY - top, mass));
      out.push(_wave(b.x + b.w * 0.03, top, b.x + b.w * 0.97, top,
        type === 'hedge' ? b.h * 0.035 : 0, 6, o));
      for (let i = 1; i < 6; i++) {
        const x = b.x + b.w * i / 6;
        out.push(_line(x, top + b.h * 0.08, x, baseY - b.h * 0.06, f));
      }
      return out;
    }
    if (type === 'topiary') {
      out.push(..._taperedTrunk(cx, baseY, b.y + b.h * 0.55, b.w * 0.08, o));
      out.push(_circleEl(b.x + b.w * 0.12, b.y + b.h * 0.06, b.w * 0.76, b.h * 0.58, mass));
      out.push(_circleEl(b.x + b.w * 0.22, b.y + b.h * 0.16, b.w * 0.56, b.h * 0.42, o));
      return out;
    }
    if (type === 'strawberryTree') {
      // El madroño adulto se lee como arbolito multirramificado, no como bola.
      out.push(..._taperedTrunk(cx, baseY, b.y + b.h * 0.53, b.w * 0.09, o));
      out.push(_curve(cx, b.y + b.h * .6, b.x + b.w * .34, b.y + b.h * .35,
        b.x + b.w * .22, b.y + b.h * .25, _trunkInk(f)));
      out.push(_curve(cx, b.y + b.h * .6, b.x + b.w * .66, b.y + b.h * .34,
        b.x + b.w * .8, b.y + b.h * .24, _trunkInk(f)));
    } else {
      const stems = type === 'oleander' ? 7 : 5;
      for (let i = 0; i < stems; i++) {
        const t = i / (stems - 1), tx = b.x + b.w * (0.08 + t * 0.84);
        const top = type === 'mastic' ? .24 : type === 'oleander' ? .08 : .15;
        out.push(_curve(cx, baseY, cx + (tx - cx) * 0.45, b.y + b.h * 0.48,
          tx, b.y + b.h * (top + Math.abs(t - 0.5) * 0.2), f));
      }
    }
    const profiles = {
      bush: [[.13,.56],[.2,.3],[.37,.08],[.5,.17],[.63,.06],[.8,.29],[.88,.56],[.78,.8],[.58,.94],[.38,.9],[.2,.8]],
      clump: [[.01,.68],[.09,.48],[.27,.36],[.47,.43],[.68,.34],[.91,.46],[.99,.67],[.84,.82],[.61,.88],[.36,.84],[.1,.8]],
      oleander: [[.06,.38],[.14,.18],[.32,.06],[.48,.14],[.64,.04],[.84,.16],[.94,.38],[.84,.7],[.66,.91],[.5,.78],[.32,.91],[.15,.7]],
      mastic: [[.02,.5],[.1,.31],[.28,.2],[.46,.25],[.68,.18],[.9,.3],[.98,.49],[.87,.72],[.63,.82],[.4,.78],[.17,.84],[.05,.68]],
      mirabilis: [[.04,.58],[.1,.32],[.26,.14],[.44,.2],[.6,.08],[.78,.22],[.94,.38],[.97,.6],[.84,.84],[.6,.95],[.36,.9],[.14,.82]],
      strawberryTree: [[.08,.34],[.16,.14],[.35,.04],[.52,.1],[.7,.03],[.9,.19],[.95,.39],[.83,.58],[.62,.67],[.43,.62],[.23,.68],[.08,.53]],
      rounded: [[.04,.48],[.1,.27],[.28,.12],[.48,.16],[.68,.08],[.89,.25],[.97,.48],[.86,.72],[.65,.9],[.44,.84],[.22,.92],[.07,.72]],
    };
    const profileKey = profiles[type] ? type : 'rounded';
    const profile = profiles[profileKey].map(([x, y]) => ({
      x: b.x + b.w * x, y: b.y + b.h * y,
    }));
    const massTop = type === 'strawberryTree' ? .06 : type === 'mastic' ? .2 : .1;
    const massHeight = type === 'strawberryTree' ? .58 : type === 'mastic' ? .62 : .78;
    out.push(_circleEl(b.x + b.w * .09, b.y + b.h * massTop,
      b.w * .82, b.h * massHeight, mass));
    out.push(_chain(profile, o, true));
    if (type === 'oleander') {
      // El id histórico se mantiene, pero la especie visible es romero: hojas
      // lineares pareadas sobre ramas leñosas, sin las corolas de la adelfa.
      for (let i = 0; i < 7; i++) {
        const x = b.x + b.w * (.14 + i * .12);
        const y = b.y + b.h * (.25 + (i % 3) * .13);
        out.push(_line(x - b.w * .035, y + b.h * .025,
          x + b.w * .035, y - b.h * .025, f));
      }
    }
    if (type === 'mirabilis') {
      // Trompetas del atardecer: cada flor lleva su tubo fino colgando de la
      // corola — es el rasgo que da nombre a la planta de las cuatro (la flor
      // abre al caer la tarde) y lo que separa este alzado del de la jara.
      // Como en planta, una de cada tres corolas sale blanca: la especie
      // mezcla fucsia y blanco en la misma mata (v2.40.1).
      const w = o.plantColorMode === 'natural'
        ? { ...o, color: MIRABILIS_WHITE } : f;
      for (let i = 0; i < 6; i++) {
        const x = b.x + b.w * (0.16 + i * 0.136);
        const y = b.y + b.h * (0.2 + (i % 3) * 0.16);
        out.push(_line(x, y, x + b.w * 0.03, y + b.h * 0.055, f));
        out.push(_dot(x, y, Math.max(1.4, Math.min(b.w, b.h) * 0.04),
          i % 3 === 1 ? w : a));
      }
    }
    const flowers = { bush: 3, clump: 5, oleander: 7, strawberryTree: 4, pittosporum: 5 }[type] || 0;
    for (let i = 0; i < flowers; i++) {
      const x = b.x + b.w * (0.15 + ((i * 0.37) % 0.7));
      const y = b.y + b.h * (0.22 + ((i * 0.23) % 0.48));
      out.push(_dot(x, y, Math.max(1.4, Math.min(b.w, b.h) * 0.035), a));
    }
    return out;
  }

  function _herbElevation(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_HERB, type);
    const f = _fine(o), a = _accentInk(o, spec), baseY = b.y + b.h;
    const cx = b.x + b.w / 2, out = [_ground(b, o)];
    if (type === 'agave' || type === 'aloe') {
      const n = type === 'agave' ? 11 : 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), tx = b.x + b.w * (0.04 + t * 0.92);
        const peakY = b.y + b.h * (0.08 + Math.abs(t - 0.5) * 0.48);
        out.push(_curve(cx, baseY, cx + (tx - cx) * 0.48, peakY, tx, baseY - b.h * 0.05, o));
      }
      if (type === 'aloe') out.push(_line(cx, baseY, cx, b.y + b.h * 0.02, a));
      return out;
    }
    if (type === 'pricklypear') {
      out.push(_circleEl(b.x + b.w * 0.08, b.y + b.h * 0.36, b.w * 0.38, b.h * 0.62, _massInk(o, spec, 0.22)));
      out.push(_circleEl(b.x + b.w * 0.37, b.y + b.h * 0.08, b.w * 0.34, b.h * 0.62, _massInk(o, spec, 0.22)));
      out.push(_circleEl(b.x + b.w * 0.62, b.y + b.h * 0.3, b.w * 0.3, b.h * 0.68, _massInk(o, spec, 0.22)));
      out.push(_dot(b.x + b.w * 0.54, b.y + b.h * 0.08, Math.max(1.5, b.w * 0.035), a));
      return out;
    }
    if (type === 'thyme') {
      // Tapizante leñoso: perfil bajo continuo y pequeñas cabezuelas, sin abanico alto.
      const dome = [[.02,.82],[.12,.55],[.32,.42],[.5,.5],[.68,.39],[.9,.55],[.98,.82]]
        .map(([x, y]) => ({ x: b.x + b.w * x, y: b.y + b.h * y }));
      out.push(_chain(dome, o, false));
      for (const [x, y] of [[.18,.58],[.38,.47],[.61,.48],[.82,.59]]) {
        out.push(_dot(b.x + b.w * x, b.y + b.h * y,
          Math.max(1.1, b.w * .018), a));
      }
      return out;
    }
    if (type === 'santolina') {
      // Cojín hemisférico plateado con botones florales por encima.
      out.push(_curve(b.x + b.w * .04, baseY, cx, b.y + b.h * .38,
        b.x + b.w * .96, baseY, o));
      for (let i = 0; i < 5; i++) {
        const x = b.x + b.w * (.18 + i * .16);
        const top = b.y + b.h * (.08 + (i % 2) * .08);
        out.push(_line(x, baseY - b.h * .18, x, top, f));
        out.push(_dot(x, top, Math.max(1.3, b.w * .027), a));
      }
      return out;
    }
    if (type === 'rosemary') {
      // Ramas leñosas ascendentes y arqueadas con hojas lineares pareadas.
      for (let i = 0; i < 7; i++) {
        const t = i / 6, x = b.x + b.w * (.08 + t * .84);
        const top = b.y + b.h * (.08 + Math.abs(t - .5) * .35);
        out.push(_curve(cx, baseY, x, b.y + b.h * .42, x, top, o));
        for (let j = 1; j <= 3; j++) {
          const y = top + (baseY - top) * j / 5;
          out.push(_line(x - b.w * .035, y + b.h * .025,
            x + b.w * .035, y - b.h * .025, f));
        }
      }
      return out;
    }
    if (type === 'lemonverbena') {
      // Mata leñosa alta y abierta: varas erguidas, hoja verticilada y
      // panícula terminal clara. Es la única aromática con porte de arbusto.
      for (let i = 0; i < 5; i++) {
        const t = i / 4, x = b.x + b.w * (.12 + t * .76);
        const top = b.y + b.h * (.08 + Math.abs(t - .5) * .3);
        out.push(_curve(cx, baseY, cx + (x - cx) * .5, b.y + b.h * .5, x, top, o));
        for (let j = 1; j <= 3; j++) {
          const y = top + (baseY - top) * j / 4.5;
          out.push(_line(x, y, x - b.w * .07, y - b.h * .03, f));
          out.push(_line(x, y, x + b.w * .07, y - b.h * .03, f));
        }
        out.push(_dot(x, top, Math.max(1.2, b.w * .022), a));
      }
      return out;
    }
    if (type === 'mint') {
      // Herbácea baja: tallos rectos, hojas opuestas y espiga terminal.
      for (let i = 0; i < 6; i++) {
        const t = i / 5, x = b.x + b.w * (.12 + t * .76);
        const top = b.y + b.h * (.16 + Math.abs(t - .5) * .26);
        out.push(_line(x, baseY, x, top, o));
        for (let j = 1; j <= 3; j++) {
          const y = baseY - (baseY - top) * j / 4;
          out.push(_curve(x, y, x - b.w * .06, y - b.h * .045, x - b.w * .085, y, f));
          out.push(_curve(x, y, x + b.w * .06, y - b.h * .045, x + b.w * .085, y, f));
        }
        out.push(_line(x, top, x, top - b.h * .09, a));
        out.push(_dot(x, top - b.h * .09, Math.max(1.05, b.w * .018), a));
      }
      return out;
    }
    if (type === 'sage') {
      // Hojas basales anchas y espigas florales separadas.
      for (let i = 0; i < 6; i++) {
        const t = i / 5, x = b.x + b.w * (.08 + t * .84);
        out.push(_curve(cx, baseY, x, b.y + b.h * .58,
          x, baseY - b.h * .08, f));
      }
      for (let i = 0; i < 4; i++) {
        const x = b.x + b.w * (.25 + i * .17);
        const top = b.y + b.h * (.07 + (i % 2) * .07);
        out.push(_line(x, baseY - b.h * .2, x, top, f));
        for (let j = 0; j < 3; j++) out.push(_dot(x, top + b.h * (.04 + j * .055),
          Math.max(1.05, b.w * .017), a));
      }
      return out;
    }
    // Lavanda: mata basal compacta y espigas delgadas, verticales y escalonadas.
    out.push(_curve(b.x + b.w * .06, baseY, cx, b.y + b.h * .45,
      b.x + b.w * .94, baseY, f));
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = b.x + b.w * (.1 + t * .8);
      const top = b.y + b.h * (.08 + Math.abs(t - .5) * .22);
      out.push(_curve(cx, baseY, x, b.y + b.h * .5, x, top, f));
      out.push(_line(x, top, x, top + b.h * .14, a));
      out.push(_dot(x, top, Math.max(1.05, b.w * .016), a));
    }
    return out;
  }

  function _flowerElevation(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_FLOWER, type);
    const f = _fine(o), a = _accentInk(o, spec), baseY = b.y + b.h;
    const out = [_ground(b, o)];
    if (type === 'sunflower') {
      // Boca de dragón: tallo erguido y flores bilabiadas alternas en espiga.
      const cx = b.x + b.w / 2;
      out.push(_line(cx, baseY, cx, b.y + b.h * .06, f));
      out.push(_curve(cx, baseY, b.x + b.w * .24, b.y + b.h * .62,
        b.x + b.w * .12, b.y + b.h * .46, f));
      out.push(_curve(cx, baseY, b.x + b.w * .76, b.y + b.h * .64,
        b.x + b.w * .88, b.y + b.h * .48, f));
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const y = b.y + b.h * (.1 + i * .095);
        const x = cx + side * b.w * (.12 + i * .008);
        out.push(_line(cx, y + b.h * .025, x, y, f));
        out.push(_dot(x, y, Math.max(1.6, b.w * .07), a));
        out.push(_dot(x + side * b.w * .06, y + b.h * .012,
          Math.max(1.15, b.w * .042), a));
      }
      return out;
    }
    if (type === 'seadaffodil') {
      // Bulbo dunar: escapo robusto, umbela de trompetas blancas y hoja
      // acintada saliendo de la arena.
      const cx = b.x + b.w / 2;
      for (const s of [-1, -.45, .45, 1]) {
        out.push(_curve(cx, baseY, cx + s * b.w * .3, b.y + b.h * .58,
          cx + s * b.w * .46, b.y + b.h * .44, f));
      }
      out.push(_line(cx, baseY, cx, b.y + b.h * .24, f));
      for (const [s, rise] of [[-1, .06], [0, 0], [1, .06]]) {
        const fx = cx + b.w * .2 * s, fy = b.y + b.h * (.14 + rise);
        out.push(_line(cx, b.y + b.h * .24, fx, fy, f));
        for (let p = 0; p < 6; p++) {
          const ang = (p / 6) * Math.PI * 2;
          out.push(_dot(fx + Math.cos(ang) * b.w * .06, fy + Math.sin(ang) * b.h * .05,
            Math.max(1.2, b.w * .032), a));
        }
        out.push(_dot(fx, fy, Math.max(1.2, b.w * .03), f));   // corona estaminal
      }
      return out;
    }
    if (type === 'snowbell') {
      // Campanillas péndulas colgando de un escapo fino, entre hoja linear.
      const cx = b.x + b.w / 2;
      for (const s of [-1, -.4, .4, 1]) {
        out.push(_line(cx, baseY, cx + s * b.w * .17, b.y + b.h * (.28 + Math.abs(s) * .14), f));
      }
      out.push(_line(cx, baseY, cx, b.y + b.h * .16, f));
      for (const [s, d] of [[-1, .1], [1, .17]]) {
        const bx = cx + s * b.w * .14, by = b.y + b.h * (.2 + d);
        out.push(_curve(cx, b.y + b.h * .16, cx + s * b.w * .1, b.y + b.h * .14, bx, by, f));
        out.push(_dot(bx, by + b.h * .05, Math.max(1.4, b.w * .075), a));
      }
      return out;
    }
    if (type === 'rockdragon') {
      // Rupícola: los tallos ascienden poco y se vencen, como cuelga de la roca.
      const cx = b.x + b.w / 2;
      for (let i = 0; i < 5; i++) {
        const s = i % 2 ? 1 : -1, t = Math.floor(i / 2) / 2;
        const ex = cx + s * b.w * (.18 + t * .26), ey = b.y + b.h * (.32 + t * .24);
        out.push(_curve(cx, baseY, cx + s * b.w * .12, b.y + b.h * (.18 + t * .12), ex, ey, o));
        out.push(_dot(ex, ey, Math.max(1.4, b.w * .058), a));
        out.push(_dot(ex + s * b.w * .045, ey + b.h * .035, Math.max(1.1, b.w * .034), a));
      }
      return out;
    }
    if (type === 'silene') {
      // Mata leñosa en la base y tallos glandulosos con flor de cinco pétalos.
      const cx = b.x + b.w / 2;
      out.push(_curve(b.x + b.w * .18, baseY, cx, b.y + b.h * .74, b.x + b.w * .82, baseY, o));
      for (let i = 0; i < 5; i++) {
        const t = i / 4, x = b.x + b.w * (.14 + t * .72);
        const top = b.y + b.h * (.12 + Math.abs(t - .5) * .26);
        out.push(_curve(cx, baseY, cx + (x - cx) * .6, b.y + b.h * .5, x, top, f));
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2 - Math.PI / 2;
          out.push(_dot(x + Math.cos(ang) * b.w * .045, top + Math.sin(ang) * b.h * .04,
            Math.max(1.1, b.w * .03), a));
        }
      }
      return out;
    }
    if (type === 'saladina') {
      // Roseta basal pegada al suelo y panícula alta muy ramificada: es lo que
      // la separa del estátice de jardín, que ramifica desde media altura.
      const cx = b.x + b.w / 2;
      for (const s of [-1, -.5, .5, 1]) {
        out.push(_curve(cx, baseY, cx + s * b.w * .22, baseY - b.h * .1,
          cx + s * b.w * .38, baseY - b.h * .03, f));
      }
      out.push(_line(cx, baseY, cx, b.y + b.h * .3, f));
      for (const [s, up] of [[-1, .1], [1, .16], [-.5, .2], [.5, .25]]) {
        const tx = cx + s * b.w * .25, ty = b.y + b.h * (.3 - up);
        out.push(_curve(cx, b.y + b.h * .3, cx + s * b.w * .13,
          b.y + b.h * (.3 - up * .6), tx, ty, f));
        out.push(_dot(tx, ty, Math.max(1.1, b.w * .03), a));
        out.push(_dot(tx - s * b.w * .07, ty + b.h * .035, Math.max(1, b.w * .025), a));
      }
      return out;
    }
    if (type === 'trumpetdaffodil') {
      // Narciso trompón: la trompa es tan larga como los tépalos, y ese es su
      // rasgo; por eso el centro va más grande que en cualquier otra flor.
      const cx = b.x + b.w / 2;
      for (const s of [-1, -.35, .35, 1]) {
        out.push(_line(cx, baseY, cx + s * b.w * .2, b.y + b.h * (.22 + Math.abs(s) * .16), f));
      }
      out.push(_line(cx, baseY, cx, b.y + b.h * .18, f));
      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * Math.PI * 2;
        out.push(_dot(cx + Math.cos(ang) * b.w * .09, b.y + b.h * .18 + Math.sin(ang) * b.h * .07,
          Math.max(1.3, b.w * .045), a));
      }
      out.push(_dot(cx, b.y + b.h * .18, Math.max(1.4, b.w * .06), a));
      out.push(_dot(cx, b.y + b.h * .18, Math.max(1.1, b.w * .03), f));
      return out;
    }
    const stems = type === 'bed' ? 7 : 1;
    for (let i = 0; i < stems; i++) {
      const x = stems === 1 ? b.x + b.w / 2 : b.x + b.w * (0.1 + i * 0.8 / (stems - 1));
      const top = b.y + b.h * (type === 'bed' ? 0.15 + (i % 3) * 0.12 : 0.08);
      const bloomY = top + b.h * .09;
      out.push(_line(x, baseY, x, bloomY, f));
      const leafSide = i % 2 ? 1 : -1;
      out.push(_curve(x, b.y + b.h * .62, x + leafSide * b.w * .1,
        b.y + b.h * .55, x + leafSide * b.w * .18, b.y + b.h * .64, f));
      const rr = Math.max(2.5, Math.min(b.w / Math.max(2.2, stems), b.h) * 0.15);
      const kind = type === 'bed' ? ['daisy','tulip','rose'][i % 3] : type;
      if (kind === 'tulip') {
        // Estátice: ramificación aérea acabada en cabezuelas diminutas.
        for (const [side, rise] of [[-1, 1.2], [1, 1.5], [-.45, 1.8], [.5, 2]]) {
          const tx = x + rr * side, ty = bloomY - rr * rise;
          out.push(_curve(x, bloomY, x + rr * side * .35,
            bloomY - rr * rise * .55, tx, ty, f));
          out.push(_dot(tx, ty, Math.max(1.1, rr * .28), a));
          out.push(_dot(tx + rr * .3, ty + rr * .08, Math.max(1, rr * .2), a));
        }
      } else if (kind === 'rose') {
        // Rosa siempreverde: cinco pétalos solapados y centro doble.
        for (let p = 0; p < 5; p++) {
          const ang = p / 5 * Math.PI * 2 - Math.PI / 2;
          out.push(_dot(x + Math.cos(ang) * rr * .62,
            bloomY + Math.sin(ang) * rr * .62, rr * .54, a));
        }
        out.push(_dot(x, bloomY, rr * .38, a));
        out.push(_dot(x, bloomY, Math.max(1, rr * .14), f));
      } else {
        const petals = 8;
        const reach = rr * 1.05;
        for (let p = 0; p < petals; p++) {
          const ang = p / petals * Math.PI * 2;
          out.push(_dot(x + Math.cos(ang) * reach, bloomY + Math.sin(ang) * reach,
            Math.max(1, rr * .36), a));
        }
        out.push(_dot(x, bloomY, rr * .43, f));
      }
    }
    return out;
  }

  /** Marca esquemática propia de cada trepadora: bráctea, flor, racimo u hoja. */
  function _climberMark(type, x, y, r, a, f) {
    switch (type) {
      case 'bougainvillea':
        return [_dot(x - r * .7, y, r * .62, a), _dot(x + r * .65, y, r * .62, a),
          _dot(x, y - r * .65, r * .62, a)];
      case 'jasmine': {
        const petals = [];
        for (let p = 0; p < 5; p++) {
          const ang = p / 5 * Math.PI * 2 - Math.PI / 2;
          petals.push(_dot(x + Math.cos(ang) * r * .65,
            y + Math.sin(ang) * r * .65, r * .38, a));
        }
        return [...petals, _dot(x, y, r * .22, f)];
      }
      case 'vine':
        return [_dot(x, y, r * .55, a), _dot(x - r * .42, y + r * .65, r * .42, a),
          _dot(x + r * .42, y + r * .65, r * .42, a), _dot(x, y + r * 1.2, r * .38, a)];
      case 'malvasia': {
        // Racimo cónico y suelto de uva blanca, con raspón y la baya que
        // remata la punta — el porte alargado es lo que distingue la malvasía
        // del racimo compacto de la parra tinta.
        const grapes = [_line(x, y - r * .85, x, y - r * .15, f)];
        const rows = [[-.6, 0, .6], [-.35, .35], [0]];
        rows.forEach((cols, ri) => cols.forEach(c =>
          grapes.push(_dot(x + c * r, y + ri * r * .72, r * .45, a))));
        grapes.push(_dot(x + r * .3, y + r * 2.1, r * .32, a));
        return grapes;
      }
      case 'wisteria':
        return [_line(x, y, x, y + r * 2.1, a), _dot(x, y + r * .7, r * .42, a),
          _dot(x, y + r * 1.35, r * .34, a), _dot(x, y + r * 1.95, r * .26, a)];
      case 'ivy':
        return [_line(x, y + r, x - r, y - r * .65, a),
          _line(x, y + r, x + r, y - r * .65, a),
          _line(x - r, y - r * .65, x, y - r * .15, f),
          _line(x + r, y - r * .65, x, y - r * .15, f)];
      default: // rosal trepador: flor estratificada
        return [_dot(x, y, r, a), _dot(x + r * .12, y, r * .52, f)];
    }
  }

  /** La malvasía no tapiza un muro: se empárra sobre una estructura de sombra,
      y por eso vive en el catálogo de ÁRBOLES aunque la vid sea trepadora.
      En alzado, pies derechos, larguero doble con las correas y el tronco
      retorcido subiendo por un lado, con los racimos colgando del plano del
      techo; en planta, el marco de vigas visto desde arriba bajo el manto de
      pámpanos. La madera va con `_trunkInk` para salir marrón en natural.
      Su racimo sigue siendo el caso 'malvasia' de `_climberMark`. */
  function _malvasiaPergolaPlan(b, o, spec) {
    const f = _fine(o), a = _accentInk(o, spec), w = _fine(_trunkInk(o));
    const out = [_rectEl(b.x, b.y, b.w, b.h, _trunkInk(o))];
    const beams = 4;
    for (let i = 1; i < beams; i++) {
      const y = b.y + b.h * i / beams;
      out.push(_line(b.x, y, b.x + b.w, y, w));
    }
    out.push(_wave(b.x, b.y + b.h * 0.3, b.x + b.w, b.y + b.h * 0.42, b.h * 0.14, 5, o));
    out.push(_wave(b.x + b.w * 0.05, b.y + b.h * 0.7, b.x + b.w * 0.95, b.y + b.h * 0.58, b.h * 0.12, 4, o));
    for (let i = 0; i < 4; i++) {
      const x = b.x + b.w * (0.15 + i * 0.7 / 3);
      out.push(..._climberMark('malvasia', x, b.y + b.h * (i % 2 ? 0.32 : 0.6),
        Math.max(1.3, b.h * 0.05), a, f));
    }
    return out;
  }

  function _malvasiaPergolaElevation(b, o, spec) {
    const f = _fine(o), a = _accentInk(o, spec), wood = _trunkInk(o);
    const out = [_ground(b, o)];
    const topY = b.y + b.h * 0.16, beamY = topY + b.h * 0.08;
    for (const px of [0.06, 0.5, 0.94]) {
      const x = b.x + b.w * px;
      out.push(_line(x, beamY, x, b.y + b.h, wood));
    }
    out.push(_line(b.x, topY, b.x + b.w, topY, wood));
    out.push(_line(b.x, beamY, b.x + b.w, beamY, _fine(wood)));
    const ticks = Math.max(4, Math.round(b.w / 34));
    for (let i = 1; i < ticks; i++) {
      const x = b.x + b.w * i / ticks;
      out.push(_line(x, topY, x, beamY, _fine(wood)));
    }
    // El tronco viejo trepa retorciéndose por un pie, como junto a la casa
    const tx = b.x + b.w * 0.86;
    out.push(_wave(tx - b.w * 0.035, b.y + b.h, tx + b.w * 0.02, beamY, b.w * 0.03, 4, wood));
    out.push(_wave(tx + b.w * 0.04, b.y + b.h, tx - b.w * 0.025, beamY, b.w * 0.025, 3, wood));
    // El manto de hojas cabalga la cubierta: es lo que da la sombra
    out.push(_wave(b.x, topY - b.h * 0.05, b.x + b.w, topY - b.h * 0.05, b.h * 0.055, 7, o));
    out.push(_wave(b.x + b.w * 0.04, topY - b.h * 0.11, b.x + b.w * 0.96, topY - b.h * 0.1, b.h * 0.045, 6, f));
    // Y los racimos cuelgan del plano de sombra, no de un muro
    for (let i = 0; i < 5; i++) {
      const x = b.x + b.w * (0.1 + i * 0.8 / 4);
      const drop = b.h * (0.06 + (i % 2) * 0.05);
      out.push(_line(x, beamY, x, beamY + drop, f));
      out.push(..._climberMark('malvasia', x, beamY + drop + b.h * 0.05,
        Math.max(1.4, b.w * 0.016), a, f));
    }
    return out;
  }

  function _climberPlan(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_CLIMBER, type);
    const f = _fine(o), a = _accentInk(o, spec), cy = b.y + b.h / 2;
    const out = [_line(b.x, b.y, b.x + b.w, b.y, o),
      _wave(b.x, cy, b.x + b.w, cy, b.h * 0.22, 5, f),
      _wave(b.x, cy + b.h * 0.2, b.x + b.w, cy + b.h * 0.2, b.h * 0.16, 4, f)];
    const n = { ivy: 8, vine: 6, wisteria: 7, jasmine: 5, climbingRose: 10, bougainvillea: 9 }[type] || 5;
    for (let i = 0; i < n; i++) {
      const x = b.x + b.w * (i + 0.5) / n;
      out.push(..._climberMark(type, x, cy + (i % 2 ? -1 : 1) * b.h * 0.16,
        Math.max(1.3, b.h * 0.045), a, f));
    }
    return out;
  }

  function _climberElevation(b, o, type) {
    const spec = _spec(TOOLS.GARDEN_CLIMBER, type);
    const f = _fine(o), a = _accentInk(o, spec), out = [_ground(b, o)];
    // Soporte ligero: muestra el porte sin confundirse con una masa arbustiva.
    out.push(_line(b.x + b.w * 0.04, b.y, b.x + b.w * 0.04, b.y + b.h, f));
    out.push(_line(b.x + b.w * 0.96, b.y, b.x + b.w * 0.96, b.y + b.h, f));
    for (let i = 1; i <= 4; i++) {
      const y = b.y + b.h * i / 5;
      out.push(_line(b.x + b.w * 0.04, y, b.x + b.w * 0.96, y, f));
    }
    const vines = type === 'ivy' ? 5 : 3;
    for (let i = 0; i < vines; i++) {
      const x1 = b.x + b.w * (0.12 + i * 0.76 / Math.max(1, vines - 1));
      const x2 = b.x + b.w * (0.82 - i * 0.62 / Math.max(1, vines - 1));
      out.push(_wave(x1, b.y + b.h, x2, b.y + b.h * 0.04,
        b.w * (type === 'wisteria' ? 0.055 : 0.035), 5, o));
    }
    const flowers = { bougainvillea: 12, jasmine: 8, vine: 7, wisteria: 10,
      ivy: 5, climbingRose: 9 }[type] || 6;
    for (let i = 0; i < flowers; i++) {
      const x = b.x + b.w * (0.1 + ((i * 0.37) % 0.8));
      const y = b.y + b.h * (0.08 + ((i * 0.23) % 0.78));
      out.push(..._climberMark(type, x, y, Math.max(1.3, b.w * 0.014), a, f));
    }
    return out;
  }

  function _plantElevation(tool, b, o, type) {
    switch (tool) {
      case TOOLS.GARDEN_TREE: return _treeElevation(b, o, type);
      case TOOLS.GARDEN_SHRUB: return _shrubElevation(b, o, type);
      case TOOLS.GARDEN_FLOWER: return _flowerElevation(b, o, type);
      case TOOLS.GARDEN_HERB: return _herbElevation(b, o, type);
      case TOOLS.GARDEN_CLIMBER: return _climberElevation(b, o, type);
      default: return [];
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
      case 'pool':      // piscina: andén, vaso, agua y escalerilla
        return _poolTool(b, o);
      case 'north':     // flecha de norte
        return _northTool(b, o);
      case 'scalebar':  // escala gráfica
        return _scaleBarTool(b, o);
      case 'sundial': case 'sundialWall':
        return _sundialTool(b, o, type);
      default:          // maceta: borde y boca
        return [_circleEl(b.x, b.y, b.w, b.h, o),
                _dot(cx, cy, r * 0.72, f)];
    }
  }

  /**
   * Piscina vista desde arriba: el andén, el vaso, el agua y la escalerilla.
   *
   * El vaso va con el trazo del contorno (es la pieza) y el agua y la
   * escalerilla, finas. El agua se omite si el vaso no da de sí: en una caja
   * degenerada las ondas se apelotonarían en una raya, y una cadena sin
   * recorrido no dice nada.
   */
  function _poolTool(b, o) {
    const f = _fine(o);
    const inset = Math.min(b.w, b.h) * 0.12;
    const vw = Math.max(1, b.w - inset * 2), vh = Math.max(1, b.h - inset * 2);
    const vx = b.x + inset, vy = b.y + inset;
    const cy = vy + vh / 2;
    const els = [_rectEl(b.x, b.y, b.w, b.h, o),       // andén
                 _rectEl(vx, vy, vw, vh, o)];          // vaso
    // Escalerilla anclada al borde izquierdo del vaso y PERPENDICULAR a él,
    // que es como entra una escalera al agua. Con los largueros paralelos a
    // ese borde —la primera versión— se leía como una «H» flotando dentro de
    // la piscina; visto en el navegador. Va con el trazo de la pieza: es
    // herraje, no agua.
    const len = Math.max(2, Math.min(vw * 0.18, vh * 0.4));
    const sep = Math.max(2, Math.min(vh * 0.24, len));
    els.push(_line(vx, cy - sep / 2, vx + len, cy - sep / 2, o),
             _line(vx, cy + sep / 2, vx + len, cy + sep / 2, o));
    for (let i = 1; i <= 2; i++) {
      const px = vx + (len * i) / 3;
      els.push(_line(px, cy - sep / 2, px, cy + sep / 2, o));
    }
    // Agua: dos ondas a partir de la escalerilla, para no cruzarla. En el
    // tercio central bastan para leer la lámina sin llenarla de rayas, y se
    // omiten si el vaso no da de sí: en una caja degenerada se apelotonarían.
    const wx0 = vx + len + vw * 0.06, wx1 = vx + vw * 0.94;
    if (wx1 - wx0 > 10 && vh > 8) {
      for (let i = 1; i <= 2; i++) {
        const wy = vy + (vh * i) / 3;
        els.push(_wave(wx0, wy, wx1, wy, Math.max(1, vh * 0.07), 3, f));
      }
    }
    return els;
  }

  /**
   * Flecha de norte: la rosa, la aguja y la «N».
   *
   * La «N» se dibuja con TRES LÍNEAS y no con un elemento `text`, y no es un
   * capricho: cada variante del jardín emite una sola etiqueta de texto —la
   * suya, que pone `_labelled`—, y con `labels:false` no puede quedar ninguna.
   * Un rótulo dentro del dibujo rompería las dos cosas. Además el temblor de
   * Sketchy le da a la letra el mismo aire manuscrito que al resto.
   */
  function _northTool(b, o) {
    const f = _fine(o);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const rx = b.w / 2, ry = b.h / 2;
    // La punta se queda a media altura para dejarle sitio a la «N» ENCIMA,
    // que es donde se rotula un norte de verdad: probado en el navegador con
    // la letra bajo la punta, a tamaño de icono se fundía con el eje.
    const tipY = cy - ry * 0.42, wing = Math.max(1, rx * 0.18);
    const els = [_circleEl(b.x, b.y, b.w, b.h, o),
                 _line(cx, cy + ry * 0.62, cx, tipY, o),        // eje
                 _line(cx - wing, cy - ry * 0.06, cx, tipY, o), // alas de la punta
                 _line(cx + wing, cy - ry * 0.06, cx, tipY, o)];
    const nh = Math.max(2, ry * 0.32), nw = Math.max(1.5, rx * 0.26);
    const ny = cy - ry * 0.52, nx = cx - nw / 2;
    els.push(_line(nx, ny, nx, ny - nh, f),
             _line(nx + nw, ny, nx + nw, ny - nh, f),
             _line(nx, ny - nh, nx + nw, ny, f));
    return els;
  }

  /**
   * Escala gráfica: la barra de tramos de un metro.
   *
   * Mide METROS DE VERDAD, leyendo `o.plantPxPerM` —la escala que la app ya
   * conoce y que hasta ahora no dibujaba nadie—, así que la barra puede salir
   * algo más corta o más larga que el arrastre: una escala que se estirara
   * hasta llenar el gesto estaría mintiendo, que es lo único que no puede
   * hacer. Los tramos pares van rellenos, como en un plano de verdad.
   *
   * Ojo, y es la contrapartida de que los elementos sean planos: la barra
   * guarda la escala del momento en que se dibujó. Si luego se cambia el
   * px/m, la barra vieja sigue diciendo lo que decía —hay que rehacerla—,
   * igual que el alzado de una planta no se rehace solo.
   */
  function _scaleBarTool(b, o) {
    const f = _fine(o);
    const px = Math.max(PLANT_PX_PER_M_MIN, Math.min(PLANT_PX_PER_M_MAX,
      Number.isFinite(o.plantPxPerM) ? o.plantPxPerM : 20));
    const tramos = Math.max(1, Math.min(SCALE_BAR_MAX_M, Math.round(b.w / px)));
    const barW = tramos * px;
    const barH = Math.max(3, Math.min(b.h * 0.5, px * 0.4));
    const x0 = b.x + (b.w - barW) / 2, y0 = b.y + (b.h - barH) / 2;
    const els = [_rectEl(x0, y0, barW, barH, o)];
    // Tramos pares en sólido. El `fillColor` va SIEMPRE explícito: sin él,
    // `Renderer.fillStyle` cae en el tinte al 12 % del trazo, que es
    // retrocompatibilidad de las formas planas y aquí saldría desvaído.
    const solido = { ...o, fill: true, fillColor: o.fillColor || o.color,
      fillTransparent: false };
    for (let i = 0; i < tramos; i += 2) {
      els.push(_rectEl(x0 + i * px, y0, px, barH, solido));
    }
    // Una división fina por junta, para que se cuenten los metros aunque el
    // relleno no se vea (modo tinta sobre papel oscuro, por ejemplo).
    for (let i = 1; i < tramos; i++) {
      els.push(_line(x0 + i * px, y0, x0 + i * px, y0 + barH, f));
    }
    return els;
  }

  /**
   * Reloj de sol, en las dos formas en que aparece en un jardín: sobre su
   * pedestal («de suelo») o colgado de un muro («de pared»).
   *
   * Sigue la regla de la sección: se ve DESDE ARRIBA. Un reloj de pared en
   * planta no enseña su cuadrante —está de canto contra el muro—, así que se
   * dibuja como se dibuja en un plano de paisajismo: la línea del muro, la
   * huella de la placa y el abanico de horas proyectado sobre el suelo. Es lo
   * que lo hace reconocible; sin el abanico sería una caja pegada a una raya.
   * El gnomon va con el trazo del contorno (es la pieza) y las horas, finas.
   */
  function _sundialTool(b, o, type) {
    const f = _fine(o);
    const cx = b.x + b.w / 2;
    const els = [];
    // Todo va en radios rx/ry por separado: si el arrastre no es cuadrado, un
    // radio único dejaría la corona flotando dentro de la elipse del pedestal.
    if (type === 'sundial') {
      const rx = b.w / 2, ry = b.h / 2, cy = b.y + ry;
      els.push(_circleEl(b.x, b.y, b.w, b.h, o));          // canto del pedestal
      els.push(_circleEl(cx - rx * 0.78, cy - ry * 0.78,   // corona horaria
                         rx * 1.56, ry * 1.56, f));
      // Las horas ocupan la mitad sur: al norte va el gnomon, que las taparía.
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI;                      // de este a oeste
        els.push(_line(cx + Math.cos(a) * rx * 0.22, cy + Math.sin(a) * ry * 0.22,
                       cx + Math.cos(a) * rx * 0.78, cy + Math.sin(a) * ry * 0.78, f));
      }
      // Gnomon: la varilla vista desde arriba es un triángulo estrecho que
      // apunta al norte, con la base ancha en el centro.
      const half = Math.max(1, rx * 0.11), tip = cy - ry * 0.72;
      els.push(_line(cx - half, cy, cx + half, cy, o),
               _line(cx - half, cy, cx, tip, o),
               _line(cx + half, cy, cx, tip, o));
      return els;
    }
    // De pared: el muro arriba, la placa colgando y el cuadrante abierto al sur.
    const wallY = b.y, plateH = Math.max(2, b.h * 0.16);
    const plateW = b.w * 0.6;
    const gy = wallY + plateH;                                 // arranque del gnomon
    const fanX = b.w * 0.44, fanY = (b.h - plateH) * 0.88;
    const A0 = Math.PI * 0.1, A1 = Math.PI * 0.9;
    const on = (a, k) => ({ x: cx + Math.cos(a) * fanX * k, y: gy + Math.sin(a) * fanY * k });
    els.push(_line(b.x, wallY, b.x + b.w, wallY, o));          // traza del muro
    els.push(_rectEl(cx - plateW / 2, wallY, plateW, plateH, o)); // el cuadrante
    // Horas: ocho marcas a media cuenta, para que ninguna caiga justo encima
    // del gnomon —si coincidieran, la varilla dejaría de leerse como tal— y
    // arrancando lejos del centro, que si no se apelotonan en la base.
    for (let i = 0; i < 8; i++) {
      const a = A0 + ((i + 0.5) / 8) * (A1 - A0);
      const p = on(a, 1), q = on(a, 0.34);
      els.push(_line(q.x, q.y, p.x, p.y, f));
    }
    // El arco que cierra la escala: sin él el abanico se lee como un foco.
    const rim = [];
    for (let i = 0; i <= 10; i++) rim.push(on(A0 + (i / 10) * (A1 - A0), 1));
    els.push(_chain(rim, f, false));
    els.push(_line(cx, gy, cx, gy + fanY * 0.6, o));           // gnomon saliente
    return els;
  }

  /* Los dos ejes del camino, explícitos: mirar el id por dentro (¿contiene
     "Straight"?) ataría la geometría a cómo se escriben los ids. */
  const PATH_VARIANTS = {
    path:              { winding: true,  paved: false },
    pathStraight:      { winding: false, paved: false },
    pathPaved:         { winding: true,  paved: true  },
    pathStraightPaved: { winding: false, paved: true  },
  };

  const PATH_LEN = 220;            // largo del camino al hacer clic sin arrastrar
  const PATH_W_DEF = 34;           // ancho de reserva si no lo da ni el arrastre ni el panel
  const PATH_W_MIN = 8, PATH_W_MAX = 120;   // topes de #garden-path-width
  const PATH_W_BAND = 0.6;         // del lado corto: el resto se lo lleva el vaivén
  const PATH_AMP = 0.27;           // vaivén, en fracción del ancho del camino

  /**
   * Eje del camino a partir del arrastre, leído POR DEFECTO como CAJA: el
   * recorrido va por el lado largo y el grosor lo da el corto, de modo que
   * mover el ratón en perpendicular engorda o adelgaza el camino mientras se
   * dibuja. Es la única forma de sacar recorrido y grosor de un solo gesto sin
   * tecla ni segundo paso, y por eso este modo sale horizontal o vertical, no
   * en diagonal. Con `o.freeAngle` (Shift durante el arrastre, ver app.js) se
   * usa `_pathAxisFree` en su lugar: el ángulo queda libre y a cambio el
   * grosor deja de salir del arrastre.
   *
   * Si el lado corto no da ni para MIN_SPAN (un clic, o una línea recta sin
   * apenas grosor) el ancho lo pone `o.pathWidth`, el ajuste del panel: es su
   * papel, el de ancho por defecto. El del arrastre NO se acota —ahí el usuario
   * ve exactamente lo que dibuja—; los topes son los del slider.
   */
  function _pathAxis(p1, p2, cfg, o) {
    const rawW = Math.abs(p2.x - p1.x), rawH = Math.abs(p2.y - p1.y);
    const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
    const vert = rawH >= rawW;
    const along = vert ? rawH : rawW, across = vert ? rawW : rawH;
    const fallback = Number.isFinite(o && o.pathWidth) ? o.pathWidth : PATH_W_DEF;
    const w = across >= MIN_SPAN
      ? across * PATH_W_BAND
      : Math.max(PATH_W_MIN, Math.min(PATH_W_MAX, fallback));
    // Eje por el centro del lado corto. Sin recorrido (un clic) baja PATH_LEN
    // desde el punto pulsado, que es como se entra a un jardín desde la calle.
    let x1, y1, x2, y2;
    if (along < MIN_SPAN) {
      x1 = x2 = p1.x; y1 = p1.y; y2 = p1.y + PATH_LEN;
    } else if (vert) {
      x1 = x2 = x + rawW / 2; y1 = y; y2 = y + rawH;
    } else {
      y1 = y2 = y + rawH / 2; x1 = x; x2 = x + rawW;
    }
    const len = Math.hypot(x2 - x1, y2 - y1);
    return {
      x1, y1, x2, y2, len, w,
      ux: (x2 - x1) / len, uy: (y2 - y1) / len,     // unitario del recorrido
      amp: cfg.winding ? Math.max(2, w * PATH_AMP) : 0,  // vaivén a cada lado del eje
    };
  }

  /**
   * Eje del camino en ÁNGULO LIBRE: el arrastre ES el recorrido, con la
   * inclinación exacta del gesto, en vez de snapear al lado largo de una caja.
   * Al no quedar ya un "lado corto" del que sacar el grosor, este sale SIEMPRE
   * de `o.pathWidth` (el ajuste del panel) — el mismo resguardo que `_pathAxis`
   * ya usa para un clic o una línea recta, aquí generalizado a cualquier
   * arrastre. Un arrastre solo da dos números (aquí, ángulo y longitud); el
   * grosor necesita un tercero, y por eso deja de venir del ratón en este modo.
   */
  function _pathAxisFree(p1, p2, cfg, o) {
    let { x: x1, y: y1 } = p1, { x: x2, y: y2 } = p2;
    if (Math.hypot(x2 - x1, y2 - y1) < MIN_SPAN) { x2 = x1; y2 = y1 + PATH_LEN; }
    const len = Math.hypot(x2 - x1, y2 - y1);
    const fallback = Number.isFinite(o && o.pathWidth) ? o.pathWidth : PATH_W_DEF;
    const w = Math.max(PATH_W_MIN, Math.min(PATH_W_MAX, fallback));
    return {
      x1, y1, x2, y2, len, w,
      ux: (x2 - x1) / len, uy: (y2 - y1) / len,     // unitario del recorrido
      amp: cfg.winding ? Math.max(2, w * PATH_AMP) : 0,  // vaivén a cada lado del eje
    };
  }

  /** Caja del camino ya trazado: la del rectángulo girado, más el vaivén. */
  function _pathBox(ax) {
    const r = ax.w / 2 + ax.amp;                 // lo más que se aparta del eje
    const nx = -ax.uy * r, ny = ax.ux * r;
    const xs = [ax.x1 + nx, ax.x1 - nx, ax.x2 + nx, ax.x2 - nx];
    const ys = [ax.y1 + ny, ax.y1 - ny, ax.y2 + ny, ax.y2 - ny];
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  /**
   * Camino: dos bordes paralelos —rectos o serpenteantes— y, si es empedrado,
   * cantos escalonados entre ellos.
   *
   * Las cuatro variantes salen de aquí y no de cuatro `case` porque el
   * empedrado tiene que seguir EXACTAMENTE la misma ondulación que los bordes;
   * calcularla en dos sitios sería garantizar que antes o después se despegan.
   * De ahí que la onda viva en `_at`, que es lo único que consultan ambos.
   *
   * El recorrido y el grosor salen los dos del arrastre (ver `_pathAxis`). La
   * geometría es UNA, no una por orientación: se escribe en coordenadas de
   * camino —`u` = fracción del recorrido, `v` = desvío respecto al eje— y `_p`
   * la gira y la lleva al lienzo. `v` va medido en la MISMA dirección que
   * `_wave` toma como normal, así que `_at` vale igual en los dos sentidos sin
   * un signo suelto por en medio.
   */
  function _pathTool(ax, o, variant) {
    const cfg = PATH_VARIANTS[variant] || PATH_VARIANTS.path;
    const nx = -ax.uy, ny = ax.ux;                  // normal unitaria (la de _wave)
    const _p = (u, v) => ({
      x: ax.x1 + (ax.x2 - ax.x1) * u + nx * v,
      y: ax.y1 + (ax.y2 - ax.y1) * u + ny * v,
    });
    const half = ax.w / 2;
    // Desvío del camino en la fracción `t` de su recorrido. Es el mismo seno
    // que `_wave` aplica a los bordes (una vuelta completa).
    const _at = t => Math.sin(t * Math.PI * 2) * ax.amp;

    const edge = v => {
      const a = _p(0, v), z = _p(1, v);
      return cfg.winding
        ? _wave(a.x, a.y, z.x, z.y, ax.amp, 4, o)
        : _line(a.x, a.y, z.x, z.y, o);
    };
    const els = [edge(-half), edge(half)];
    if (!cfg.paved) return els;

    // Cantos a matajunta: las hileras impares van desplazadas media columna y
    // con un canto menos, para que ninguno caiga sobre el borde final.
    //
    // Al ensanchar el camino crece el NÚMERO de hileras, no el tamaño de las
    // piedras: con dos hileras fijas, un camino de 90 px salía empedrado con
    // cantos de medio metro y se leía como una hilera de globos. Un empedrado
    // de verdad mete más piezas, no piezas más grandes. El radio sale del paso
    // entre hileras y sigue acotado por el largo, para que un camino corto y
    // ancho no los solape.
    const f = _fine(o);
    const rows = Math.max(2, Math.min(PATH_ROWS, Math.round(ax.w / PATH_ROW_H)));
    const rr = Math.max(1.2, Math.min((ax.w / rows) * 0.44, ax.len * 0.11));
    const cols = Math.max(2, Math.min(PATH_COLS,
      Math.floor(PATH_STONES / rows), Math.round(ax.len / (rr * 2.3))));
    // El canto va algo alargado EN EL SENTIDO DEL CAMINO, y `_blob` no sabe
    // girar: el achatamiento se reparte entre los dos radios según la
    // inclinación del recorrido (continuo, no un `if` horizontal/vertical),
    // para que un camino en ángulo libre no dé un salto visible justo a 45° —
    // en horizontal o vertical da exactamente el mismo 0.82 de siempre, y en
    // diagonal el canto sale casi redondo, que es lo que se ve al girar una
    // piedra chata.
    const rx = rr * (1 - 0.18 * Math.abs(ax.uy)), ry = rr * (1 - 0.18 * Math.abs(ax.ux));
    let k = 0;
    for (let row = 0; row < rows; row++) {
      const even = row % 2 === 0;
      const n = even ? cols : cols - 1;
      // Centro de la hilera. Se reparten sobre PATH_SPREAD del ancho, no sobre
      // el ancho entero: las de los extremos tienen que dejar sitio al canto.
      const v0 = ((row + 0.5) / rows - 0.5) * ax.w * PATH_SPREAD;
      for (let i = 0; i < n; i++) {
        const t = even ? (i + 0.5) / cols : (i + 1) / cols;
        const c = _p(t, _at(t) + v0);
        els.push(_blob(c.x, c.y, rx, ry, _turn(LOBES.stone, k++), f));
      }
    }
    return els;
  }

  // PATH_W_MIN/MAX salen fuera para que el rango del slider no se pueda
  // desincronizar en silencio: lo comprueba un test contra index.html.
  return {
    elements, plantSize, MIN_SPAN, LABEL_SIZE, LABEL_GAP, PATH_W_MIN, PATH_W_MAX,
    PLANT_PX_PER_M_MIN, PLANT_PX_PER_M_MAX, PLANT_SCALE_MIN, PLANT_SCALE_MAX,
  };
})();
