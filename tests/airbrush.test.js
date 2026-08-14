'use strict';
/* ============================================================
   airbrush.test.js — Tests de src/js/airbrush.js (la nube de gotas).

   El módulo es puro y determinista a propósito: la nube se regenera en el
   lienzo, en las cinco exportaciones, en la miniatura del modal y en la
   previsualización del arrastre, así que cualquier no-determinismo se vería
   como cinco dibujos distintos del mismo elemento.

   Los objetos que cruzan el vm se leen por propiedades numéricas.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

const A = () => load('src/js/airbrush.js').Airbrush;

/** Elemento de referencia: trazo horizontal de 200 px. */
function stroke(extra) {
  return Object.assign({
    type: 'airbrush',
    points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
    color: '#1a1a2e',
    lineWidth: 3,
    radius: 20,
    density: 45,
    seed: 12345,
  }, extra || {});
}

/** Distancia de un punto al segmento a-b. */
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Distancia mínima al eje completo (polilínea). */
function distToAxis(p, pts) {
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
  }
  return best;
}

test('la nube es determinista: dos llamadas dan exactamente las mismas gotas', () => {
  const Airbrush = A();
  const el = stroke();
  const a = Airbrush.dots(el);
  const b = Airbrush.dots(el);
  assert.ok(a.length > 50, 'el trazo de referencia debe dar bastantes gotas');
  assert.equal(a.length, b.length);
  a.forEach((dot, i) => {
    assert.equal(dot.x, b[i].x);
    assert.equal(dot.y, b[i].y);
    assert.equal(dot.r, b[i].r);
  });
});

test('dos seeds distintos con la misma geometría dan nubes distintas', () => {
  const Airbrush = A();
  const a = Airbrush.dots(stroke({ seed: 1 }));
  const b = Airbrush.dots(stroke({ seed: 2 }));
  const same = a.length === b.length &&
    a.every((d, i) => d.x === b[i].x && d.y === b[i].y);
  assert.equal(same, false, 'el seed tiene que decidir la nube');
});

test('ninguna gota se sale de la banda: distancia al eje ≤ radio', () => {
  const Airbrush = A();
  // Trazo quebrado: comprueba también los segmentos internos y las esquinas.
  const el = stroke({
    points: [{ x: 100, y: 100 }, { x: 250, y: 140 }, { x: 260, y: 300 }],
    radius: 25,
  });
  const pts = el.points;
  for (const d of Airbrush.dots(el)) {
    assert.ok(distToAxis(d, pts) <= el.radius + 1e-9,
      `una gota a ${distToAxis(d, pts)} px del eje se sale del radio ${el.radius}`);
  }
});

test('la nube está sesgada al centro: la mitad interior concentra más gotas', () => {
  const Airbrush = A();
  const el = stroke({ radius: 30, density: 100 });
  const pts = el.points;
  let dentro = 0, fuera = 0;
  for (const d of Airbrush.dots(el)) {
    if (distToAxis(d, pts) <= el.radius / 2) dentro++; else fuera++;
  }
  // Con SPREAD = 0.75 la mitad interior se lleva ~2/3 de las gotas (u^0.75 ≤
  // 0.5 ⟺ u ≤ 0.5^(4/3) ≈ 0.397 sobre el disco, más el peso de las tapas).
  // El margen es generoso a propósito: lo que se fija es el SESGO, no la
  // constante. Sin él (disco uniforme) sería 1/4, y con 1-D sería 1/2.
  assert.ok(dentro > fuera,
    `la mitad interior debe concentrar más tinta (dentro ${dentro}, fuera ${fuera})`);
  const decilExterior = Airbrush.dots(el)
    .filter(d => distToAxis(d, pts) > el.radius * 0.9).length;
  const decilInterior = Airbrush.dots(el)
    .filter(d => distToAxis(d, pts) <= el.radius * 0.1).length;
  assert.ok(decilExterior < dentro + fuera,
    'el borde no puede llevarse toda la tinta');
  assert.ok(decilInterior > 0, 'tiene que haber tinta en el eje');
});

test('la tinta acaba EXACTAMENTE en el radio: ninguna gota sobresale', () => {
  const Airbrush = A();
  // El círculo que sigue al puntero se dibuja a `radius`, así que rodea la
  // superficie que se va a pintar. Si una gota asomara por fuera, ese círculo
  // estaría mintiendo — y con él los bounds, el recorte al área y el alcance
  // del borrador, que también toman el radio como cota.
  for (const [radius, lineWidth] of [[24, 5], [8, 8], [60, 1], [12, 7], [4, 8]]) {
    const el = stroke({ points: [{ x: 200, y: 200 }], radius, lineWidth, density: 120 });
    let borde = 0;
    for (const d of Airbrush.dots(el)) {
      borde = Math.max(borde, Math.hypot(d.x - 200, d.y - 200) + d.r);
    }
    assert.ok(borde <= radius + 1e-9,
      `con radio ${radius} y grano ${lineWidth} la tinta llega a ${borde}`);
    // Y llega hasta ahí, no se queda a medias: si no, el círculo prometería
    // más superficie de la que se pinta.
    assert.ok(borde > radius * 0.97, `con radio ${radius} la tinta se queda en ${borde}`);
  }
});

test('las gotas adelgazan hacia el borde de la banda', () => {
  const Airbrush = A();
  const el = stroke({ radius: 30, density: 120, lineWidth: 8 });
  const pts = el.points;
  const media = sel => sel.reduce((s, d) => s + d.r, 0) / sel.length;
  const todas = Airbrush.dots(el);
  const centro = todas.filter(d => distToAxis(d, pts) <= el.radius * 0.25);
  const borde = todas.filter(d => distToAxis(d, pts) >= el.radius * 0.75);
  assert.ok(centro.length && borde.length);
  assert.ok(media(centro) > media(borde),
    'la gota del borde tiene que ser más pequeña que la del eje');
});

/** Clave exacta de una gota, para comparar nubes como conjuntos. Comparar
    por índice del array NO vale: cada tramo aporta un número distinto de
    gotas, así que un tramo que crece desplaza el resto del array aunque
    ninguna gota se haya movido. */
const key = d => `${d.x}|${d.y}`;

test('alargar el trazo NO mueve las gotas ya generadas', () => {
  const Airbrush = A();
  // Es lo que se ve mientras se dibuja: la mancha crece por la punta en vez
  // de re-sortearse entera en cada fotograma («hervido»). Es la propiedad
  // que justifica que la aleatoriedad sea una función y no un generador.
  const corto = stroke({ points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] });
  const largo = stroke({
    points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 260, y: 130 }],
  });
  const a = Airbrush.dots(corto);
  const b = new Set(Airbrush.dots(largo).map(key));
  assert.ok(b.size > a.length, 'alargar tiene que añadir gotas');
  const siguen = a.filter(d => b.has(key(d))).length;
  // Lo único que legítimamente se mueve es la tapa del extremo, que ahora
  // remata la punta nueva: son ~caps/2 gotas de las ~236 del trazo corto.
  assert.ok(siguen > a.length * 0.85,
    `las gotas ya pintadas no pueden moverse (${siguen}/${a.length} siguen en su sitio)`);
});

test('al escalar en proporción, las gotas que sobreviven se mueven con la geometría', () => {
  const Airbrush = A();
  // Escalar ×2 desde el origen: puntos y radio se multiplican por 2. Las
  // gotas que existían antes tienen que caer justo en su imagen afín, no en
  // una nube nueva (que es lo que pasaría con un PRNG secuencial).
  const base = stroke({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], radius: 20 });
  const doble = stroke({ points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], radius: 40 });
  const a = Airbrush.dots(base);
  const b = new Set(Airbrush.dots(doble).map(key));
  const coinciden = a.filter(d => b.has(key({ x: d.x * 2, y: d.y * 2 }))).length;
  assert.ok(coinciden > a.length * 0.95,
    `las gotas supervivientes deben moverse afinmente (${coinciden}/${a.length})`);
  // Y la mancha ampliada NO queda más rala: al escalar por s, la banda crece
  // por s² y las gotas también.
  assert.ok(Airbrush.dots(doble).length > a.length * 3.5,
    'la densidad tiene que conservarse al ampliar');
});

test('el tope de gotas adelgaza el ritmo y no corta el final del trazo', () => {
  const Airbrush = A();
  const el = stroke({
    points: [{ x: 0, y: 400 }, { x: 1200, y: 400 }],
    radius: 60, density: 120,
  });
  const est = Airbrush.estimate(el);
  assert.equal(est.capped, true, 'este trazo tiene que tocar techo');
  const nube = Airbrush.dots(el);
  // El tope es un objetivo, no un corte exacto: el redondeo estocástico que
  // reparte las fracciones puede desviarse unas pocas gotas (±√n). Lo que
  // se fija aquí es el orden de magnitud, que es para lo que existe.
  assert.ok(nube.length <= Airbrush.MAX_DOTS * 1.05,
    `el tope es ${Airbrush.MAX_DOTS} y salieron ${nube.length}`);
  assert.ok(nube.length > Airbrush.MAX_DOTS * 0.9,
    'el tope no puede quedarse corto: la mancha se adelgaza, no desaparece');
  // Cortar con un `break` al llegar al tope dejaría el final en blanco.
  assert.ok(nube.some(d => d.x < 100), 'falta tinta al principio del trazo');
  assert.ok(nube.some(d => d.x > 1100), 'el tope cortó el final del trazo');
});

test('más densidad da más gotas, y más radio da banda más ancha', () => {
  const Airbrush = A();
  const poca = Airbrush.dots(stroke({ density: 20 })).length;
  const mucha = Airbrush.dots(stroke({ density: 100 })).length;
  assert.ok(mucha > poca * 2, `la densidad debe mandar (${poca} → ${mucha})`);
  const estrecha = Airbrush.bandBox(stroke({ radius: 10 }));
  const ancha = Airbrush.bandBox(stroke({ radius: 40 }));
  assert.equal(ancha.h - estrecha.h, 60);
  assert.equal(estrecha.y, 90);
});

test('un clic sin arrastre da un soplo redondo', () => {
  const Airbrush = A();
  const el = stroke({ points: [{ x: 200, y: 200 }], radius: 24, density: 90 });
  const nube = Airbrush.dots(el);
  assert.ok(nube.length > 20, 'un clic tiene que pintar algo');
  const cuadrantes = [0, 0, 0, 0];
  for (const d of nube) {
    cuadrantes[(d.x >= 200 ? 1 : 0) + (d.y >= 200 ? 2 : 0)]++;
  }
  cuadrantes.forEach((n, i) => assert.ok(n > 0, `el cuadrante ${i} quedó vacío`));
  for (const d of nube) {
    assert.ok(Math.hypot(d.x - 200, d.y - 200) <= el.radius + 1e-9,
      'el soplo no puede salirse del radio');
  }
});

test('el área recorta la nube y isEmpty detecta la mancha completamente fuera', () => {
  const Airbrush = A();
  const sinArea = Airbrush.dots(stroke()).length;
  const conArea = Airbrush.dots(stroke({ clip: { x: 100, y: 80, w: 60, h: 40 } }));
  assert.ok(conArea.length > 0 && conArea.length < sinArea,
    'el área tiene que quitar gotas, no todas');
  for (const d of conArea) {
    assert.ok(d.x >= 100 && d.x <= 160 && d.y >= 80 && d.y <= 120,
      'una gota se coló fuera del área');
  }
  assert.equal(Airbrush.isEmpty(stroke()), false);
  assert.equal(Airbrush.isEmpty(stroke({ clip: { x: 900, y: 600, w: 50, h: 50 } })), true,
    'una mancha cuyas gotas caen todas fuera del área está vacía');
});

test('visibleBox es la banda recortada al área, y nunca degenerada', () => {
  const Airbrush = A();
  const band = Airbrush.bandBox(stroke());
  assert.deepEqual({ ...band }, { x: 80, y: 80, w: 240, h: 40 });
  const vis = Airbrush.visibleBox(stroke({ clip: { x: 100, y: 0, w: 60, h: 500 } }));
  assert.deepEqual({ ...vis }, { x: 100, y: 80, w: 60, h: 40 });
  // Intersección vacía (solo alcanzable manipulando el JSON): se devuelve la
  // banda. Una caja de tamaño cero rompería el marco y el redimensionado.
  const nula = Airbrush.visibleBox(stroke({ clip: { x: 900, y: 600, w: 10, h: 10 } }));
  assert.ok(nula.w > 0 && nula.h > 0);
});

test('sin puntos, sin radio o sin densidad no se pinta nada, y no lanza', () => {
  const Airbrush = A();
  assert.deepEqual([...Airbrush.dots(stroke({ points: [] }))], []);
  assert.deepEqual([...Airbrush.dots(stroke({ radius: 0 }))], []);
  assert.deepEqual([...Airbrush.dots(stroke({ density: 0 }))], []);
  assert.deepEqual([...Airbrush.dots({ type: 'airbrush' })], []);
  assert.equal(Airbrush.estimate({ type: 'airbrush' }).dots, 0);
  assert.equal(Airbrush.axisLength({ type: 'airbrush' }), 0);
  // Un seed no finito (JSON manipulado) se trata como 0 en vez de dar NaN.
  const sinSeed = Airbrush.dots(stroke({ seed: 'x' }));
  assert.ok(sinSeed.length > 0 && sinSeed.every(d => isFinite(d.x) && isFinite(d.y)));
});

test('el hash reparte: media ≈ 0,5 en cada canal y gotas contiguas no se parecen', () => {
  const Airbrush = A();
  // Una mezcla pobre produce bandas visibles en la mancha: la comprobación
  // barata es que la nube llene su caja de forma uniforme en los dos ejes.
  const el = stroke({ points: [{ x: 400, y: 400 }], radius: 50, density: 120 });
  const nube = Airbrush.dots(el);
  const mediaX = nube.reduce((s, d) => s + d.x, 0) / nube.length;
  const mediaY = nube.reduce((s, d) => s + d.y, 0) / nube.length;
  assert.ok(Math.abs(mediaX - 400) < 5, `el soplo está descentrado en x (${mediaX})`);
  assert.ok(Math.abs(mediaY - 400) < 5, `el soplo está descentrado en y (${mediaY})`);
  const repes = nube.filter((d, i) => i > 0 &&
    Math.abs(d.x - nube[i - 1].x) < 1e-6 && Math.abs(d.y - nube[i - 1].y) < 1e-6);
  assert.equal(repes.length, 0, 'dos gotas seguidas no pueden caer en el mismo sitio');
});

test('los límites exportados son coherentes entre sí', () => {
  const Airbrush = A();
  assert.ok(Airbrush.R_MIN > 0 && Airbrush.R_MIN < Airbrush.R_MAX);
  assert.ok(Airbrush.DENSITY_MIN > 0 && Airbrush.DENSITY_MIN < Airbrush.DENSITY_MAX);
  assert.ok(Airbrush.GRAIN_MIN >= 1 && Airbrush.GRAIN_MAX <= 8);
  assert.ok(Airbrush.MAX_DOTS >= 500);
  assert.ok(Airbrush.SPREAD > 0.5 && Airbrush.SPREAD < 1,
    'SPREAD=0.5 sería disco uniforme y SPREAD=1 un núcleo duro');
  assert.ok(Airbrush.MIN_AREA > 0);
});
