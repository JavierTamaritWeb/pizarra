'use strict';
/* ============================================================
   garden.test.js — Geometría de la sección "Jardín" (js/garden.js).
   Todas las herramientas son de creación: producen elementos ya existentes
   (rect/line/circle/curveArrow/text) en vista de planta.
   Ejecutar: node --test tests/garden.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const {
  Garden, TOOLS, GARDEN_TOOLS, PLOT_SHAPES, TREE_TYPES, SHRUB_TYPES,
  FLOWER_TYPES, DECOR_TYPES, PATH_TYPES, HERB_TYPES, Renderer, Exporter, CurvePath,
} = ctx;

const O = { color: '#123456', lineWidth: 3 };
const P1 = { x: 100, y: 100 }, P2 = { x: 260, y: 240 };

/** Clave de opts que elige la variante de cada herramienta. */
const VARIANT_KEY = {
  [TOOLS.GARDEN_PLOT]:   'plotShape',
  [TOOLS.GARDEN_TREE]:   'treeType',
  [TOOLS.GARDEN_SHRUB]:  'shrubType',
  [TOOLS.GARDEN_FLOWER]: 'flowerType',
  [TOOLS.GARDEN_DECOR]:  'decorType',
  [TOOLS.GARDEN_PATH]:   'pathType',
  [TOOLS.GARDEN_HERB]:   'herbType',
};

const CATALOG = {
  [TOOLS.GARDEN_PLOT]:   PLOT_SHAPES,
  [TOOLS.GARDEN_TREE]:   TREE_TYPES,
  [TOOLS.GARDEN_SHRUB]:  SHRUB_TYPES,
  [TOOLS.GARDEN_FLOWER]: FLOWER_TYPES,
  [TOOLS.GARDEN_DECOR]:  DECOR_TYPES,
  [TOOLS.GARDEN_PATH]:   PATH_TYPES,
  [TOOLS.GARDEN_HERB]:   HERB_TYPES,
};

/** Todas las combinaciones herramienta × variante del catálogo. */
const ALL_VARIANTS = GARDEN_TOOLS.flatMap(tool =>
  CATALOG[tool].map(v => ({ tool, id: v.id, name: v.name })));

const make = (tool, id, opts = {}, p1 = P1, p2 = P2) =>
  Garden.elements(tool, p1, p2, { ...O, [VARIANT_KEY[tool]]: id, ...opts });

/** Caja que envuelve a un grupo de piezas. app.js tiene getElementBounds, pero
    vive fuera del arnés node:vm: aquí basta con los cuatro tipos del jardín. */
function unionBounds(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of els) {
    let b;
    if (el.type === 'line') {
      b = { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2),
            w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    } else if (el.type === 'curveArrow') {
      b = CurvePath.bounds(el);
    } else {
      b = el;   // rect y circle ya vienen en x/y/w/h
    }
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* ---------------- contrato del módulo ---------------- */

test('solo emite tipos de elemento que ya existían', () => {
  const allowed = new Set(['rect', 'line', 'circle', 'curveArrow', 'text']);
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.ok(allowed.has(el.type), `tipo inesperado "${el.type}" en ${tool}/${id}`);
    }
  }
});

test('ninguna pieza trae seed: lo pone app.js con withSeeds', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.equal(el.seed, undefined, `${tool}/${id} llega con seed`);
    }
  }
});

// La guarda más valiosa del archivo: caza cualquier curva encadenada mal
// formada, que se renderiza bien pero se DESCARTA en silencio al reimportar
// el JSON (exporter.js avisa con un "se descartaron N elementos" y poco más).
test('toda pieza emitida pasa isValidElement (sobrevive al round-trip JSON)', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const els = make(tool, id);
    assert.ok(els.length, `${tool}/${id} no produjo nada`);
    for (const el of els) {
      assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
        `elemento inválido en ${tool}/${id}: ${JSON.stringify(el)}`);
    }
  }
});

// Sin heads:'none' el renderer dibuja la punta de flecha por defecto: una copa
// de árbol con una flecha tangente en la costura.
test('ningún curveArrow lleva punta de flecha', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      if (el.type === 'curveArrow') {
        assert.equal(el.heads, 'none', `punta de flecha en ${tool}/${id}`);
      }
    }
  }
});

test('las siluetas orgánicas son UNA curva encadenada y cerrada', () => {
  const cases = [
    [TOOLS.GARDEN_TREE, 'broadleaf'], [TOOLS.GARDEN_TREE, 'olive'],
    [TOOLS.GARDEN_SHRUB, 'clump'], [TOOLS.GARDEN_DECOR, 'stone'],
    [TOOLS.GARDEN_DECOR, 'pond'], [TOOLS.GARDEN_PLOT, 'organic'],
    [TOOLS.GARDEN_FLOWER, 'bed'],
  ];
  for (const [tool, id] of cases) {
    const chain = make(tool, id).find(el => el.type === 'curveArrow' && CurvePath.isChain(el));
    assert.ok(chain, `${tool}/${id} no produjo una curva encadenada`);
    // Cerrada: el último extremo vuelve al primero, y los espejos de nivel
    // superior lo reflejan (es lo que exige isValidElement).
    assert.equal(chain.x1, chain.x2, `silueta abierta en ${tool}/${id}`);
    assert.equal(chain.y1, chain.y2, `silueta abierta en ${tool}/${id}`);
    // Con `segments` no puede haber arc/cx2/cy2 arriba
    assert.equal(chain.arc, undefined);
    assert.equal(chain.cx2, undefined);
    assert.equal(chain.cy2, undefined);
    assert.ok(chain.segments.length >= 3, 'una silueta necesita al menos 3 tramos');
  }
});

// Si la geometría fuera aleatoria, la previsualización del arrastre no
// coincidiría con lo que aparece al soltar y no habría nada que fijar.
test('es determinista: dos llamadas iguales dan el mismo resultado', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    assert.equal(JSON.stringify(make(tool, id)), JSON.stringify(make(tool, id)),
      `${tool}/${id} no es determinista`);
  }
});

// Detectado mirando el catálogo en el navegador: "Frondoso" y "Olivo" eran una
// copa lobulada con radios y solo cambiaba la tabla de lóbulos, así que en el
// icono resultaban indistinguibles y no había forma de elegir. Los tests
// pasaban todos: ninguno comparaba una variante con sus hermanas.
test('dentro de un catálogo, dos variantes nunca se dibujan igual', () => {
  // Firma: qué tipos de elemento hay y cuántos —para las curvas, distinguiendo
  // siluetas cerradas de trazos abiertos— MÁS la proporción del conjunto. La
  // proporción cuenta porque hay variantes que se eligen justo por ella: la
  // parcela cuadrada lleva las mismas piezas que la rectangular y aun así son
  // dos opciones distintas de un vistazo.
  const signature = els => {
    const parts = els.filter(el => el.type !== 'text');
    const kinds = parts.map(el => el.type === 'curveArrow'
      ? `curveArrow:${CurvePath.isChain(el) && el.x1 === el.x2 && el.y1 === el.y2 ? 'closed' : 'open'}`
      : el.type).sort().join(',');
    const b = unionBounds(parts);
    return `${kinds}|${(b.w / Math.max(1, b.h)).toFixed(1)}`;
  };

  for (const tool of GARDEN_TOOLS) {
    const seen = new Map();
    for (const v of CATALOG[tool]) {
      const sig = signature(make(tool, v.id));
      const twin = seen.get(sig);
      assert.equal(twin, undefined,
        `en ${tool}, "${v.name}" se dibuja igual que "${twin}" — nadie podría elegir`);
      seen.set(sig, v.name);
    }
  }
});

/* ---------------- etiquetas ---------------- */

test('cada pieza lleva una etiqueta de texto con el nombre de su variante', () => {
  for (const { tool, id, name } of ALL_VARIANTS) {
    const texts = make(tool, id).filter(el => el.type === 'text');
    assert.equal(texts.length, 1, `${tool}/${id} debería llevar una etiqueta`);
    assert.equal(texts[0].value, name);
    assert.ok(texts[0].fontSize > 0);
  }
});

test('labels:false quita la etiqueta y no toca nada más', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const con = make(tool, id);
    const sin = make(tool, id, { labels: false });
    assert.equal(sin.filter(el => el.type === 'text').length, 0);
    assert.equal(JSON.stringify(sin),
      JSON.stringify(con.filter(el => el.type !== 'text')),
      `labels:false alteró el dibujo en ${tool}/${id}`);
  }
});

test('la etiqueta se centra bajo la pieza', () => {
  const els = make(TOOLS.GARDEN_TREE, 'broadleaf');
  const label = els.find(el => el.type === 'text');
  const midBox = (P1.x + P2.x) / 2;
  const midLabel = label.x + (label.value.length * label.fontSize * 0.5) / 2;
  assert.ok(Math.abs(midBox - midLabel) < 1, 'la etiqueta no está centrada');
  assert.ok(label.y > P2.y, 'la etiqueta debe ir por debajo de la pieza');
});

// El measureText inyectado (app.js lo saca del canvas real) solo puede MOVER la
// etiqueta: si cambiara el número de piezas o cualquier otra coordenada, los
// tests —que corren con la estimación— estarían fijando algo que el navegador
// no hace.
test('measureText inyectado solo mueve la etiqueta', () => {
  for (const { tool, id } of ALL_VARIANTS) {
    const estimado = make(tool, id);
    const medido = make(tool, id, { measureText: (v, size) => v.length * size * 0.83 });
    assert.equal(medido.length, estimado.length);
    const soloTexto = a => a.filter(el => el.type !== 'text');
    assert.equal(JSON.stringify(soloTexto(medido)), JSON.stringify(soloTexto(estimado)),
      `measureText alteró el dibujo en ${tool}/${id}`);
    const t1 = estimado.find(el => el.type === 'text');
    const t2 = medido.find(el => el.type === 'text');
    assert.equal(t1.y, t2.y, 'la medida no debe mover la etiqueta en vertical');
    assert.notEqual(t1.x, t2.x, 'con otra medida la x debe recolocarse');
  }
});

/* ---------------- tamaños por defecto ---------------- */

// Un clic sin arrastrar cae en DEFAULTS. A diferencia de Edificios, aquí la
// variante manda: un seto es apaisado y una flor suelta es un punto.
test('cada variante tiene un tamaño por defecto positivo al hacer clic', () => {
  const click = { x: 400, y: 300 };
  for (const { tool, id } of ALL_VARIANTS) {
    const els = make(tool, id, {}, click, { x: 402, y: 301 }); // arrastre < MIN_SPAN
    assert.ok(els.length, `${tool}/${id} no produjo nada con un clic`);
    for (const el of els) {
      if (el.type === 'rect' || el.type === 'circle') {
        assert.ok(el.w > 0 && el.h > 0,
          `caja degenerada en ${tool}/${id}: ${el.w}×${el.h}`);
      }
    }
  }
});

test('el seto nace apaisado y la mata redonda; la flor suelta, menuda', () => {
  const click = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const boxOf = (tool, id) => {
    const rect = make(tool, id, { labels: false }, ...click)
      .find(el => el.type === 'rect' || el.type === 'circle');
    return rect;
  };
  const hedge = boxOf(TOOLS.GARDEN_SHRUB, 'hedge');
  assert.ok(hedge.w > hedge.h * 2, 'un seto por defecto debe ser alargado');
  const bush = boxOf(TOOLS.GARDEN_SHRUB, 'bush');
  assert.ok(Math.abs(bush.w - bush.h) < 1, 'una mata por defecto es redonda');
  const daisy = boxOf(TOOLS.GARDEN_FLOWER, 'daisy');
  assert.ok(daisy.w < bush.w, 'una flor suelta es menor que un arbusto');
});

/* ---------------- geometría por herramienta ---------------- */

test('la parcela lleva contorno y césped, y el césped va en trazo fino', () => {
  for (const shape of PLOT_SHAPES.map(s => s.id)) {
    const els = make(TOOLS.GARDEN_PLOT, shape, { labels: false });
    const grass = els.filter(el => el.type === 'line' && el.lineWidth < O.lineWidth);
    assert.ok(grass.length >= 3, `sin césped en la parcela ${shape}`);
    assert.ok(grass.length % 3 === 0, 'cada mata son tres briznas');
  }
});

// La cuadrada es la única variante que impone su proporción: toma el lado
// menor del arrastre y se centra en él, para no salirse de lo que se marcó.
test('la parcela cuadrada sale cuadrada aunque el arrastre no lo sea', () => {
  const p1 = { x: 100, y: 200 }, p2 = { x: 500, y: 400 };   // 400×200
  const els = make(TOOLS.GARDEN_PLOT, 'square', { labels: false }, p1, p2);
  const box = els.find(el => el.type === 'rect');
  assert.ok(box, 'la parcela cuadrada es un rectángulo');
  assert.equal(box.w, box.h, `no es cuadrada: ${box.w}×${box.h}`);
  assert.equal(box.h, 200, 'el lado es el menor del arrastre');
  assert.equal(box.x + box.w / 2, (p1.x + p2.x) / 2, 'va centrada en el arrastre');
  assert.equal(box.y + box.h / 2, (p1.y + p2.y) / 2);
  assert.ok(box.x >= p1.x && box.x + box.w <= p2.x, 'no puede desbordar el arrastre');
});

test('la etiqueta de la parcela cuadrada la sigue, no se queda en el arrastre', () => {
  const p1 = { x: 100, y: 200 }, p2 = { x: 500, y: 400 };
  const els = make(TOOLS.GARDEN_PLOT, 'square', {}, p1, p2);
  const box = els.find(el => el.type === 'rect');
  const label = els.find(el => el.type === 'text');
  assert.ok(label, 'sin etiqueta');
  assert.ok(label.y >= box.y + box.h, 'la etiqueta va debajo de la parcela');
  // Centrada bajo el cuadrado (con la estimación de ancho, no al píxel)
  assert.ok(Math.abs(label.x - (box.x + box.w / 2)) < box.w / 2,
    'la etiqueta ha quedado descolgada del dibujo');
});

test('el césped no se sale de una parcela redonda', () => {
  const b = { x: 0, y: 0, w: 200, h: 160 };
  const els = make(TOOLS.GARDEN_PLOT, 'round', { labels: false },
    { x: b.x, y: b.y }, { x: b.w, y: b.h });
  const cx = b.w / 2, cy = b.h / 2;
  for (const el of els.filter(e => e.type === 'line')) {
    const nx = (el.x1 - cx) / (b.w / 2), ny = (el.y1 - cy) / (b.h / 2);
    assert.ok(nx * nx + ny * ny <= 1, 'una mata de césped nace fuera de la elipse');
  }
});

test('cada árbol lleva copa y su detalle va más fino que el contorno', () => {
  for (const type of TREE_TYPES.map(t => t.id)) {
    const els = make(TOOLS.GARDEN_TREE, type, { labels: false });
    assert.ok(els.length >= 2, `el árbol ${type} necesita copa y detalle`);
    const contour = els.filter(el => el.lineWidth === O.lineWidth);
    const detail = els.filter(el => el.lineWidth < O.lineWidth);
    assert.ok(contour.length >= 1, `sin contorno en ${type}`);
    assert.ok(detail.length >= 1, `sin detalle fino en ${type}`);
  }
});

test('la conífera dibuja sus acículas como radios desde el centro', () => {
  const els = make(TOOLS.GARDEN_TREE, 'conifer', { labels: false });
  const spokes = els.filter(el => el.type === 'line');
  assert.equal(spokes.length, 12);
  const cx = (P1.x + P2.x) / 2, cy = (P1.y + P2.y) / 2;
  for (const s of spokes) {
    const inner = Math.hypot(s.x1 - cx, s.y1 - cy);
    const outer = Math.hypot(s.x2 - cx, s.y2 - cy);
    assert.ok(outer > inner, 'la acícula debe ir de dentro hacia fuera');
  }
});

test('la palmera son frondas curvas, sin copa cerrada', () => {
  const els = make(TOOLS.GARDEN_TREE, 'palm', { labels: false });
  const fronds = els.filter(el => el.type === 'curveArrow');
  assert.equal(fronds.length, 8);
  assert.ok(fronds.every(f => !CurvePath.isChain(f)), 'una fronda es una curva suelta');
});

test('el seto es una caja con la ondulación del recorte dentro', () => {
  const els = make(TOOLS.GARDEN_SHRUB, 'hedge', { labels: false });
  assert.equal(els.filter(el => el.type === 'rect').length, 1);
  const wave = els.find(el => el.type === 'curveArrow');
  assert.ok(wave && CurvePath.isChain(wave), 'el seto necesita su onda');
  assert.ok(wave.lineWidth < O.lineWidth, 'la ondulación es detalle, va fina');
});

test('el banco lleva sus lamas horizontales y finas', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'bench', { labels: false });
  assert.equal(els.filter(el => el.type === 'rect').length, 1);
  const slats = els.filter(el => el.type === 'line');
  assert.equal(slats.length, 3);
  assert.ok(slats.every(l => l.y1 === l.y2 && l.lineWidth < O.lineWidth));
});

/* ---------------- Caminos: herramienta propia y dos ejes ---------------- */

const PATH_IDS = ['path', 'pathStraight', 'pathPaved', 'pathStraightPaved'];

// Los caminos salieron de Decoración a su propio botón cuando pasaron a ser
// cuatro: dentro del catálogo decorativo ocupaban la mitad de las fichas y
// tapaban el resto. Que no vuelvan a colarse ahí por copiar-pegar.
test('los caminos viven en su propia herramienta, no en Decoración', () => {
  assert.deepEqual([...PATH_TYPES.map(v => v.id)], PATH_IDS);
  const decor = DECOR_TYPES.map(v => v.id);
  for (const id of PATH_IDS) {
    assert.ok(!decor.includes(id), `"${id}" sigue duplicado en DECOR_TYPES`);
  }
  // Y la herramienta responde: pedirle un camino a Decoración no lo dibuja
  const els = make(TOOLS.GARDEN_DECOR, 'pathPaved', { labels: false });
  assert.equal(cobbles(els).length, 0, 'Decoración no debe saber empedrar');
});

/** Cantos del empedrado: siluetas cerradas y finas, nunca los bordes. */
const cobbles = els => els.filter(el =>
  el.type === 'curveArrow' && CurvePath.isChain(el) &&
  el.x1 === el.x2 && el.y1 === el.y2);

test('el camino son dos bordes que serpentean', () => {
  const els = make(TOOLS.GARDEN_PATH, 'path', { labels: false });
  const edges = els.filter(el => el.type === 'curveArrow');
  assert.equal(edges.length, 2);
  assert.ok(edges.every(e => CurvePath.isChain(e) && e.x1 !== e.x2),
    'los bordes del camino son curvas abiertas');
});

test('el camino recto va con dos líneas paralelas, sin ondular', () => {
  // Arrastre horizontal, o sea recorrido horizontal: los bordes corren en y
  // constante. La dirección la pone el gesto, ver el test de más abajo.
  const recto = [{ x: 40, y: 120 }, { x: 400, y: 120 }];
  for (const id of ['pathStraight', 'pathStraightPaved']) {
    const els = make(TOOLS.GARDEN_PATH, id, { labels: false }, ...recto);
    const edges = els.filter(el => el.type === 'line');
    assert.equal(edges.length, 2, `${id} necesita sus dos bordes rectos`);
    assert.ok(edges.every(e => e.y1 === e.y2 && e.x1 !== e.x2),
      `los bordes de ${id} no pueden ondular`);
    assert.ok(edges.every(e => e.lineWidth === O.lineWidth),
      'los bordes son contorno, no detalle');
    // Y no queda ni rastro de la versión serpenteante
    assert.equal(els.filter(el => el.type === 'curveArrow' && !CurvePath.isChain(el)).length, 0);
    assert.equal(cobbles(els).length, els.filter(el => el.type === 'curveArrow').length,
      `en ${id} las únicas curvas son los cantos`);
  }
});

test('solo el camino empedrado trae cantos, y van en trazo fino', () => {
  const stones = id => cobbles(make(TOOLS.GARDEN_PATH, id, { labels: false }));
  assert.equal(stones('path').length, 0, 'el camino liso no lleva cantos');
  assert.equal(stones('pathStraight').length, 0, 'el camino recto liso tampoco');
  for (const id of ['pathPaved', 'pathStraightPaved']) {
    const s = stones(id);
    assert.ok(s.length >= 6, `${id} necesita un empedrado visible, hay ${s.length}`);
    assert.ok(s.every(c => c.lineWidth < O.lineWidth),
      'los cantos son detalle: van más finos que los bordes');
  }
});

// El empedrado se calcula aparte de los bordes, así que lo que hay que fijar es
// que siga SU MISMA ondulación: si se despegara, los cantos de la cresta
// asomarían fuera del camino. Se comprueba en varias inclinaciones porque la
// onda vive en coordenadas de camino y es el giro lo que podría descuadrarla:
// un signo suelto en la normal se vería solo fuera de la horizontal.
test('los cantos caben entre los bordes, en cualquier inclinación', () => {
  for (const deg of [0, 90, 30, -45, 135]) {
    const { a, p1, p2 } = at(deg, 320);
    const els = make(TOOLS.GARDEN_PATH, 'pathPaved', { labels: false }, p1, p2);
    const edges = els.filter(el => el.type === 'curveArrow' && !cobbles([el]).length);
    assert.equal(edges.length, 2, `${deg}°: hacen falta los dos bordes para acotar`);
    // Coordenadas de camino: u a lo largo del eje, v perpendicular.
    const sin = Math.sin(a), cos = Math.cos(a);
    const uv = p => ({ u: (p.x - p1.x) * cos + (p.y - p1.y) * sin,
                       v: (p.x - p1.x) * -sin + (p.y - p1.y) * cos });
    // Desvío de un borde a una u dada, muestreando la curva real.
    const vAt = (edge, u) => {
      const pts = CurvePath.sample(edge, 120).map(uv);
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.u - u) < Math.abs(best.u - u)) best = p;
      return best.v;
    };
    const [lo, hi] = uv({ x: edges[0].x1, y: edges[0].y1 }).v <
                     uv({ x: edges[1].x1, y: edges[1].y1 }).v ? edges : [edges[1], edges[0]];
    const stones = cobbles(els);
    assert.ok(stones.length >= 6, `${deg}°: no hay empedrado que comprobar`);
    for (const c of stones) {
      const cb = CurvePath.bounds(c);
      const p = uv({ x: cb.x + cb.w / 2, y: cb.y + cb.h / 2 });
      const r = Math.max(cb.w, cb.h) / 2;      // radio circunscrito: cota estricta
      assert.ok(p.v - r > vAt(lo, p.u) - 1, `${deg}°: un canto asoma por un borde`);
      assert.ok(p.v + r < vAt(hi, p.u) + 1, `${deg}°: un canto asoma por el otro`);
    }
  }
});

test('dos cantos consecutivos no salen calcados', () => {
  const stones = cobbles(make(TOOLS.GARDEN_PATH, 'pathStraightPaved', { labels: false }));
  // Firma relativa al centro: el tamaño es el mismo, lo que debe variar es la forma
  const shape = c => {
    const b = CurvePath.bounds(c);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return CurvePath.segments(c)
      .map(s => `${(s.x1 - cx).toFixed(2)},${(s.y1 - cy).toFixed(2)}`).join(' ');
  };
  assert.ok(new Set(stones.map(shape)).size >= 3,
    'un empedrado con todos los cantos idénticos se lee como una fila de puntos');
});

test('las cuatro variantes de camino nacen en vertical, con la misma caja', () => {
  const click = [{ x: 0, y: 0 }, { x: 1, y: 1 }];   // arrastre < MIN_SPAN
  const boxes = PATH_IDS.map(id =>
    unionBounds(make(TOOLS.GARDEN_PATH, id, { labels: false }, ...click)));
  for (let i = 0; i < boxes.length; i++) {
    assert.ok(boxes[i].h > boxes[i].w * 2,
      `${PATH_IDS[i]} debe nacer vertical: ${boxes[i].w}×${boxes[i].h}`);
    assert.equal(boxes[i].h, boxes[0].h,
      'las cuatro variantes comparten caja: solo cambian trazado y acabado');
  }
});

/* El arrastre ES el recorrido: el camino sale en la dirección del gesto y con
   su inclinación. Antes se normalizaba a una caja, y `Math.min`/`Math.abs`
   tiraban justo el dato que aquí manda —hacia dónde va—, así que solo se podían
   trazar caminos horizontales. Un sendero de jardín cruza en diagonal tan a
   menudo como en horizontal. */

const ORIGIN = { x: 200, y: 200 };
/** Arrastre de largo `L` desde ORIGIN con `deg` grados de inclinación. */
const at = (deg, L = 300) => {
  const a = deg * Math.PI / 180;
  return { a, p1: ORIGIN,
           p2: { x: ORIGIN.x + Math.cos(a) * L, y: ORIGIN.y + Math.sin(a) * L } };
};

test('el camino va en la dirección del arrastre, con cualquier inclinación', () => {
  // Los dos casos que se piden a ojo, en crudo:
  const linesOf = (p1, p2) => make(TOOLS.GARDEN_PATH, 'pathStraight', { labels: false }, p1, p2)
    .filter(el => el.type === 'line');
  const horiz = linesOf({ x: 0, y: 0 }, { x: 300, y: 0 });
  assert.ok(horiz.length === 2 && horiz.every(e => e.y1 === e.y2 && e.x1 !== e.x2),
    'arrastrando en horizontal, el camino cruza');
  const vert = linesOf({ x: 0, y: 0 }, { x: 0, y: 300 });
  assert.ok(vert.length === 2 && vert.every(e => e.x1 === e.x2 && e.y1 !== e.y2),
    'arrastrando en vertical, el camino baja');

  // Y en cualquier ángulo: los bordes son paralelos al arrastre, van en su
  // mismo sentido y quedan a lado y lado del eje, a la misma distancia.
  for (const deg of [0, 90, 30, -45, 135, 180, -120]) {
    const { a, p1, p2 } = at(deg);
    const edges = linesOf(p1, p2);
    assert.equal(edges.length, 2, `${deg}°: hacen falta los dos bordes`);
    const sin = Math.sin(a), cos = Math.cos(a);
    for (const e of edges) {
      const ex = e.x2 - e.x1, ey = e.y2 - e.y1;
      assert.ok(Math.abs(ex * sin - ey * cos) < 1e-9,
        `${deg}°: el borde no es paralelo al arrastre`);
      assert.ok(ex * cos + ey * sin > 0, `${deg}°: el borde va al revés`);
    }
    const offset = e => (e.x1 - p1.x) * -sin + (e.y1 - p1.y) * cos;
    const [d1, d2] = edges.map(offset);
    assert.ok(d1 * d2 < 0, `${deg}°: los bordes deben caer a lados opuestos del eje`);
    assert.ok(Math.abs(Math.abs(d1) - Math.abs(d2)) < 1e-9,
      `${deg}°: y a la misma distancia`);
  }
});

test('el camino serpenteante también gira entero con el arrastre', () => {
  for (const deg of [90, 30, -45]) {
    const { a, p1, p2 } = at(deg);
    const edges = make(TOOLS.GARDEN_PATH, 'path', { labels: false }, p1, p2)
      .filter(el => el.type === 'curveArrow');
    assert.equal(edges.length, 2);
    // Los extremos de cada borde caen sobre las perpendiculares del arrastre en
    // sus dos puntas: si la onda no girara, se saldrían por delante o por detrás.
    const along = p => ((p.x - p1.x) * Math.cos(a) + (p.y - p1.y) * Math.sin(a));
    for (const e of edges) {
      assert.ok(Math.abs(along({ x: e.x1, y: e.y1 })) < 1e-9, `${deg}°: arranque descuadrado`);
      assert.ok(Math.abs(along({ x: e.x2, y: e.y2 }) - 300) < 1e-6, `${deg}°: final descuadrado`);
    }
  }
});

/* ---------------- el reloj de sol ---------------- */

test('el reloj de suelo lleva corona horaria y gnomon, y las horas van finas', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'sundial', { labels: false });
  const rings = els.filter(el => el.type === 'circle');
  assert.equal(rings.length, 2, 'pedestal y corona');
  const cen = rings.map(el => `${(el.x + el.w / 2).toFixed(3)},${(el.y + el.h / 2).toFixed(3)}`);
  assert.equal(new Set(cen).size, 1, 'la corona va centrada en el pedestal');
  const lines = els.filter(el => el.type === 'line');
  const gnomon = lines.filter(l => l.lineWidth === O.lineWidth);
  assert.equal(gnomon.length, 3, 'el gnomon es un triángulo estrecho de tres trazos');
  assert.ok(lines.length - gnomon.length >= 8, 'faltan líneas horarias');
});

test('el gnomon apunta al norte y las horas se reparten al sur', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'sundial', { labels: false });
  const cy = (P1.y + P2.y) / 2;
  const lines = els.filter(el => el.type === 'line');
  const gnomon = lines.filter(l => l.lineWidth === O.lineWidth);
  assert.ok(gnomon.some(l => Math.min(l.y1, l.y2) < cy - 1),
    'la varilla tiene que subir por encima del centro');
  for (const h of lines.filter(l => l.lineWidth < O.lineWidth)) {
    assert.ok(h.y1 >= cy - 0.001 && h.y2 >= cy - 0.001,
      'una hora se ha metido en la mitad norte, donde va el gnomon');
  }
});

test('el reloj de pared cuelga de la traza del muro', () => {
  const els = make(TOOLS.GARDEN_DECOR, 'sundialWall', { labels: false });
  const plate = els.find(el => el.type === 'rect');
  assert.ok(plate, 'falta la huella del cuadrante');
  const wall = els.filter(el => el.type === 'line' && el.lineWidth === O.lineWidth)
    .find(l => l.y1 === l.y2 && l.y1 === P1.y);
  assert.ok(wall, 'falta la traza del muro, arriba de la caja');
  assert.equal(plate.y, wall.y1, 'la placa tiene que nacer pegada al muro');
  assert.ok(wall.x2 - wall.x1 > plate.w, 'el muro se prolonga más que la placa');
  // El abanico sale hacia el sur, nunca atraviesa el muro
  for (const h of els.filter(el => el.type === 'line' && el.lineWidth < O.lineWidth)) {
    assert.ok(h.y1 > wall.y1 && h.y2 > wall.y1, 'una hora atraviesa el muro');
  }
});

test('los dos relojes de sol no se confunden entre sí', () => {
  const kinds = id => make(TOOLS.GARDEN_DECOR, id, { labels: false })
    .map(el => el.type).sort().join(',');
  assert.notEqual(kinds('sundial'), kinds('sundialWall'));
  // El de suelo es una pieza redonda; el de pared, una placa contra una recta
  assert.equal(make(TOOLS.GARDEN_DECOR, 'sundial', { labels: false })
    .filter(el => el.type === 'rect').length, 0);
  assert.equal(make(TOOLS.GARDEN_DECOR, 'sundialWall', { labels: false })
    .filter(el => el.type === 'circle').length, 0);
});

test('la fuente y la maceta son anillos concéntricos', () => {
  const centro = els => els.filter(el => el.type === 'circle')
    .map(el => `${el.x + el.w / 2},${el.y + el.h / 2}`);
  for (const id of ['fountain', 'pot']) {
    const c = centro(make(TOOLS.GARDEN_DECOR, id, { labels: false }));
    assert.ok(c.length >= 2, `${id} necesita al menos dos anillos`);
    assert.equal(new Set(c).size, 1, `los anillos de ${id} no son concéntricos`);
  }
});

/* ---------------- robustez ---------------- */

test('herramienta desconocida no produce nada', () => {
  assert.deepEqual([...Garden.elements('no-existe', P1, P2, O)], []);
});

test('una variante inexistente cae en la primera del catálogo', () => {
  for (const tool of GARDEN_TOOLS) {
    const raro = make(tool, 'variante-que-no-existe');
    const primera = make(tool, CATALOG[tool][0].id);
    assert.equal(JSON.stringify(raro), JSON.stringify(primera),
      `${tool} no cae en su variante por defecto`);
  }
});

// Guarda de regresión: en cajas pequeñas ningún cálculo puede degenerar.
test('cajas pequeñas: sin rects ni círculos de w/h ≤ 0', () => {
  const smalls = [
    [{ x: 0, y: 0 }, { x: 12, y: 10 }],
    [{ x: 0, y: 0 }, { x: 15, y: 15 }],
    [{ x: 0, y: 0 }, { x: 7, y: 8 }],
    [{ x: 0, y: 0 }, { x: 60, y: 7 }],   // muy apaisada
    [{ x: 0, y: 0 }, { x: 7, y: 60 }],   // muy apaisada al revés
  ];
  for (const [a, b] of smalls) {
    for (const { tool, id } of ALL_VARIANTS) {
      for (const el of make(tool, id, {}, a, b)) {
        if (el.type === 'rect' || el.type === 'circle') {
          assert.ok(el.w > 0 && el.h > 0,
            `caja degenerada ${tool}/${id} en ${b.x}×${b.y}: ${el.w}×${el.h}`);
        }
        if (el.type === 'curveArrow' && el.segments) {
          assert.ok(el.segments.length >= 1);
        }
      }
    }
  }
});

test('todos los elementos generados se renderizan sin lanzar', () => {
  const stub = createCtxStub();
  for (const { tool, id } of ALL_VARIANTS) {
    for (const el of make(tool, id)) {
      assert.doesNotThrow(() => Renderer.renderElement(stub, { ...el, seed: 1 }),
        `${tool}/${id} rompe el render`);
    }
  }
});

test('las herramientas de jardín no son tipos de elemento válidos', () => {
  for (const tool of GARDEN_TOOLS) {
    assert.equal(
      Exporter.isValidElement({ type: tool, x: 0, y: 0, w: 10, h: 10, color: '#000000', lineWidth: 2 }),
      false,
      `type:'${tool}' colaría como elemento fantasma`);
  }
});
