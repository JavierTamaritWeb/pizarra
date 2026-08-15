'use strict';
/* ============================================================
   solid.test.js — Geometría de la sección "3D" (src/js/solid.js).

   Las cuatro herramientas son de creación: producen la forma 2D real de la
   cara frontal más line/curveArrow para las aristas del volumen.
   Ejecutar: node --test tests/solid.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('./helpers/load.js');

const ctx = loadAll();
const { Solid, TOOLS, SOLID_TOOLS, SOLID_SECTIONS, PRISM_SECTIONS,
        PYRAMID_SECTIONS, FRUSTUM_SECTIONS, Exporter, CurvePath,
        RegularPolygon, Trapezoid } = ctx;

const O = { color: '#123456', lineWidth: 3 };
const EXTRUSORAS = [TOOLS.SOLID_PRISM, TOOLS.SOLID_PYRAMID, TOOLS.SOLID_FRUSTUM];
/** Las ocho secciones convexas: todas menos las dos estrellas. */
const CONVEXAS = SOLID_SECTIONS.filter(s => !RegularPolygon.isStar(s));

/** Un arrastre que sirve a las dos convenciones: los polígonos regulares lo
    leen desde el centro y el resto como caja. */
const dibuja = (tool, section, opts) =>
  Solid.elements(tool, { x: 0, y: 0 }, { x: 80, y: 80 }, { ...O, solidSection: section, ...opts });

/** Todas las combinaciones: 3 remates × 10 secciones + la esfera. */
function* TODAS() {
  for (const tool of EXTRUSORAS) {
    for (const section of SOLID_SECTIONS) yield [tool, section, dibuja(tool, section)];
  }
  yield [TOOLS.SOLID_SPHERE, TOOLS.CIRCLE, dibuja(TOOLS.SOLID_SPHERE, TOOLS.CIRCLE)];
}

const ES_ARISTA = e => e.type === 'line' || e.type === 'curveArrow';
/** La cara frontal: el único elemento que no es arista ni cara rellena. Se
    busca por tipo y no por posición, porque el orden de emisión es
    significativo y cambiarlo no debe romper los tests que no van de eso. */
const frenteDe = els => els.find(e => !ES_ARISTA(e) && e.type !== 'polygon');
const aristasDe = els => els.filter(ES_ARISTA);
const carasDe = els => els.filter(e => e.type === 'polygon');

test('Solid.elements existe y las cuatro herramientas producen algo', () => {
  assert.equal(typeof Solid.elements, 'function');
  for (const tool of SOLID_TOOLS) {
    assert.ok(dibuja(tool, TOOLS.RECT).length >= 1, `${tool} no produce nada`);
  }
  // Una herramienta ajena no devuelve piezas fantasma
  assert.deepEqual([...Solid.elements(TOOLS.PENCIL, { x: 0, y: 0 }, { x: 9, y: 9 }, O)], []);
});

test('es determinista: dos llamadas iguales dan exactamente lo mismo', () => {
  // Si la geometría llevara Math.random, la previsualización del arrastre no
  // coincidiría con lo que aparece al soltar (misma regla que garden.js).
  for (const [tool, section] of [...TODAS()]) {
    assert.equal(
      JSON.stringify(dibuja(tool, section)),
      JSON.stringify(dibuja(tool, section)),
      `${tool}/${section} no es determinista`);
  }
});

test('ninguna pieza trae seed: lo pone app.js con withSeeds', () => {
  for (const [tool, section, els] of TODAS()) {
    for (const el of els) {
      assert.equal(el.seed, undefined, `${tool}/${section} trae seed propio`);
    }
  }
});

test('la cara frontal es el elemento 2D REAL de la sección', () => {
  // Es lo que hace que herede el relleno, el temblor de Sketchy, el hit-test y
  // el borrado por silueta, «Bordes ocultos» y las cinco exportaciones sin una
  // línea de código propia.
  for (const [tool, section, els] of TODAS()) {
    const frente = frenteDe(els);
    assert.ok(frente, `${tool}/${section}: no hay cara frontal`);
    assert.equal(frente.type, section);
    assert.ok(frente.w > 0 && frente.h > 0);
    // Sin relleno no se emite ninguna cara: el dibujo es el de siempre
    assert.deepEqual([...carasDe(els)], []);
    assert.equal(els.length, aristasDe(els).length + 1);
  }
});

test('el orden de emisión es ocultas, caras, frente y aristas vistas encima', () => {
  // El orden ES el resultado. Con relleno opaco las caras tapan lo que pasa por
  // detrás; y las aristas vistas van DESPUÉS de la cara frontal porque el
  // ecuador de una esfera va por dentro de ella y con el relleno delante
  // desaparecía: una esfera rellena salía como un círculo plano.
  for (const [tool, section] of [...TODAS()]) {
    const els = dibuja(tool, section, { fill: true, fillColor: '#88ccbb' });
    const idxFrente = els.findIndex(e => !ES_ARISTA(e) && e.type !== 'polygon');
    const idxCaras = els.map((e, i) => (e.type === 'polygon' ? i : -1)).filter(i => i >= 0);
    const idxOcultas = els.map((e, i) => (e.dash ? i : -1)).filter(i => i >= 0);
    const idxVistas = els.map((e, i) => (ES_ARISTA(e) && !e.dash ? i : -1)).filter(i => i >= 0);
    const etiqueta = `${tool}/${section}`;
    for (const i of idxOcultas) {
      for (const j of idxCaras) assert.ok(i < j, `${etiqueta}: oculta después de una cara`);
      assert.ok(i < idxFrente, `${etiqueta}: oculta después del frente`);
    }
    for (const j of idxCaras) {
      assert.ok(j < idxFrente, `${etiqueta}: cara después del frente`);
    }
    for (const v of idxVistas) {
      assert.ok(v > idxFrente, `${etiqueta}: arista vista debajo del frente`);
    }
  }
});

test('con relleno aparecen las caras VISTAS, sin contorno propio', () => {
  for (const [tool, section] of [...TODAS()]) {
    const els = dibuja(tool, section, { fill: true, fillColor: '#88ccbb' });
    const caras = carasDe(els);
    // La esfera no tiene cara lateral: su volumen es la propia cara frontal
    if (tool === TOOLS.SOLID_SPHERE) {
      assert.deepEqual([...caras], []);
      continue;
    }
    assert.ok(caras.length > 0, `${tool}/${section}: no se rellenó ninguna cara`);
    for (const cara of caras) {
      assert.equal(cara.fill, true);
      // Sin contorno: las aristas se dibujan aparte, una a una, y cada una
      // decide por su cuenta si va discontinua. Con contorno saldrían dobles y
      // las ocultas se volverían sólidas.
      assert.equal(cara.stroke, false, `${tool}/${section}: la cara lleva contorno`);
      assert.ok(cara.points.length >= 3);
      assert.equal(cara.dash, undefined);
      assert.ok(Exporter.isValidElement({ ...cara, seed: 1 }));
    }
    // Nunca se rellenan más caras que aristas vistas hay: sólo las que se ven
    assert.ok(caras.length <= aristasDe(els).length + 1);
  }
});

test('la cara frontal nace como su forma 2D: los regulares desde el centro y cuadrados', () => {
  // isValidElement rechaza un polígono regular deformado, y el gesto tiene que
  // sentirse igual que en «Formas».
  for (const section of SOLID_SECTIONS) {
    const frente = frenteDe(Solid.elements(
      TOOLS.SOLID_PRISM, { x: 100, y: 100 }, { x: 160, y: 180 },
      { ...O, solidSection: section }));
    if (RegularPolygon.isType(section)) {
      assert.ok(Math.abs(frente.w - frente.h) < 1e-6, `${section} no es cuadrado`);
      // Desde el centro: el punto inicial es el centro de la caja
      assert.ok(Math.abs(frente.x + frente.w / 2 - 100) < 1e-6);
      assert.ok(Math.abs(frente.y + frente.h / 2 - 100) < 1e-6);
    } else {
      assert.equal(frente.x, 100);
      assert.equal(frente.y, 100);
    }
  }
});

test('todas las piezas de las 31 figuras pasan isValidElement', () => {
  // De un golpe: `dash` sólo `true`, `heads` en la whitelist, w/h > 0 y la
  // igualdad |w−h| < 1e-6 de los polígonos regulares.
  for (const [tool, section, els] of TODAS()) {
    for (const el of els) {
      assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
        `${tool}/${section}: pieza inválida ${JSON.stringify(el)}`);
    }
  }
});

test('ninguna curva lleva arc:true, y todas van sin punta y bien encadenadas', () => {
  // `arc: true` es una trampa: app.js re-normaliza a semicírculo exacto
  // cualquier elemento con esa marca en cuanto se le arrastra un extremo o el
  // handle de curvatura, así que el ecuador de una esfera se convertiría en
  // semicírculo al tocarlo.
  const isNum = v => typeof v === 'number' && isFinite(v);
  for (const [tool, section, els] of TODAS()) {
    for (const el of els.filter(e => e.type === 'curveArrow')) {
      assert.equal(el.arc, undefined, `${tool}/${section}: curva con arc:true`);
      assert.equal(el.heads, 'none');
      assert.ok(CurvePath.isValidSegments(el.segments, isNum),
        `${tool}/${section}: cadena con empalmes que no coinciden`);
    }
  }
});

test('el cubo canónico: arriba y derecha sólidas, abajo e izquierda ocultas', () => {
  // La tabla completa del dibujo de manual. Se comprueba por posición
  // geométrica, no por índice, para que reordenar la emisión no la rompa.
  const els = Solid.elements(TOOLS.SOLID_PRISM, { x: 0, y: 100 }, { x: 100, y: 0 },
    { ...O, solidSection: TOOLS.RECT, solidAngle: 45, solidDepth: 60, solidForeshorten: 100 });
  const frente = frenteDe(els);
  assert.equal(frente.type, 'rect');
  const lineas = aristasDe(els);
  assert.equal(lineas.length, 8);          // 4 aristas traseras + 4 conectores

  const d = { x: lineas.find(l => l.x1 === 0 && l.y1 === 0).x2, y: lineas.find(l => l.x1 === 0 && l.y1 === 0).y2 };
  assert.ok(d.x > 0 && d.y < 0, 'la fuga va arriba-derecha');

  const conector = (x, y) => lineas.find(l => l.x1 === x && l.y1 === y);
  assert.equal(conector(0, 0).dash, undefined, 'conector superior izquierdo: sólido');
  assert.equal(conector(100, 0).dash, undefined, 'conector superior derecho: sólido');
  assert.equal(conector(100, 100).dash, undefined, 'conector inferior derecho: sólido');
  assert.equal(conector(0, 100).dash, true, 'conector inferior izquierdo: DISCONTINUO');

  // De la tapa trasera, dos sólidas y dos discontinuas
  const traseras = lineas.filter(l => l !== conector(0, 0) && l !== conector(100, 0) &&
    l !== conector(100, 100) && l !== conector(0, 100));
  assert.equal(traseras.length, 4);
  assert.equal(traseras.filter(l => l.dash).length, 2);
});

test('invertir la fuga INTERCAMBIA qué aristas son discontinuas', () => {
  // La guarda que muere si alguien deja la visibilidad en `true` fijo o
  // invierte el signo del área: sin regla, las dos versiones serían idénticas.
  // Se mira UN conector concreto, el que nace de la esquina inferior izquierda
  // de la cara, y se comprueba que cambia de estado al invertir la fuga. Va por
  // geometría y no por posición en el array, porque el orden de emisión agrupa
  // las ocultas al principio: comparar la secuencia de banderas daría igual en
  // los dos casos aunque la regla estuviera rota.
  const conectorEn = (a, x, y) => dibuja(TOOLS.SOLID_PRISM, TOOLS.RECT, { solidAngle: a })
    .find(e => e.type === 'line' && Math.abs(e.x1 - x) < 1e-6 && Math.abs(e.y1 - y) < 1e-6);
  // La cara nace en (0,0)-(80,80): esquina inferior izquierda en (0,80).
  // Contra la fuga OPUESTA: dentro de un mismo cuadrante un rectángulo tiene
  // las mismas caras vistas, así que comparar 30° con 85° no probaría nada.
  assert.equal(!!conectorEn(30, 0, 80).dash, true, 'con la fuga arriba-derecha, oculto');
  assert.equal(!!conectorEn(210, 0, 80).dash, false, 'con la fuga invertida, visible');
  const els = dibuja(TOOLS.SOLID_PRISM, TOOLS.RECT);
  const solidas = aristasDe(els).filter(e => !e.dash).length;
  assert.ok(solidas > 0 && solidas < aristasDe(els).length,
    'ni todas sólidas ni todas discontinuas');

  // Y con la tapa BIEN LEJOS de la cara frontal, donde el recorte por punto
  // interior no puede ayudar: si algo sigue saliendo discontinuo sólo puede
  // ser porque la regla de caras lo dijo. Sin esta parte, dejar la regla en
  // `true` fijo pasaría la prueba, porque a profundidades cortas el recorte
  // reconstruye el resultado correcto él solo.
  const lejos = Solid.elements(TOOLS.SOLID_PRISM, { x: 0, y: 0 }, { x: 100, y: 100 },
    { ...O, solidSection: TOOLS.RECT, solidDepth: 150, solidForeshorten: 100, solidAngle: 30 });
  const frente = frenteDe(lejos);
  // Las aristas ENTERAS fuera de la cara: el recorte por punto interior no
  // puede tocarlas, así que si alguna sale discontinua sólo puede haberlo
  // dicho la regla de caras.
  const fuera = aristasDe(lejos).filter(el =>
    Math.min(el.x1, el.x2) > frente.x + frente.w ||
    Math.max(el.y1, el.y2) < frente.y);
  assert.ok(fuera.length >= 2, 'la comprobación necesita aristas fuera de la cara');
  assert.ok(fuera.some(e => e.dash),
    'sin poder recortar, lo oculto sólo puede venir de la regla de caras');
  assert.ok(fuera.some(e => !e.dash));
});

test('siempre hay caras vistas y caras ocultas, en todo el barrido de ángulos', () => {
  // Coherencia de silueta: con un convexo hay exactamente dos conectores de
  // silueta, luego el reparto nunca puede ser 0 o 100 %.
  // Los TRES remates: en la pirámide es además lo que atrapa que el ápice se
  // quede dentro de la base, que da una figura entera discontinua —correcta y
  // a la vez ilegible— y es justo lo que evita el suelo de profundidad.
  for (const tool of EXTRUSORAS) {
    for (const section of CONVEXAS) {
      for (let a = 0; a <= 360; a += 15) {
       // Con fuga corta además: es donde actúa el suelo de profundidad, y sin
       // él el ápice cae dentro de la base y sale TODO discontinuo.
       for (const corta of [false, true]) {
        const els = dibuja(tool, section, corta
          ? { solidAngle: a, solidDepth: 10, solidForeshorten: 10 }
          : { solidAngle: a });
        const aristas = aristasDe(els);
        const ocultas = aristas.filter(e => e.dash).length;
        // Universal: nunca TODO oculto. Es lo que garantiza el suelo de
        // profundidad —sin él, el ápice cae dentro de la base, todas las caras
        // son traseras y la figura sale entera discontinua: correcta y a la vez
        // ilegible—. Que haya AL MENOS una oculta no es universal: el cono no
        // oculta nada (su base se ve entera, el cuerpo queda detrás) y un
        // tetraedro visto por un vértice, tampoco.
        assert.ok(ocultas < aristas.length,
          `${tool}/${section} a ${a}°: las ${aristas.length} aristas ocultas`);
        // En un prisma sí lo es: la tapa trasera siempre tiene lado de atrás.
        if (tool === TOOLS.SOLID_PRISM) {
          assert.ok(ocultas > 0, `${tool}/${section} a ${a}°: nada oculto`);
        }
       }
      }
    }
  }
});

test('ninguna pieza sólida pasa por detrás de la cara frontal', () => {
  // La propiedad que de verdad importa, y la razón de ser del recorte. En un
  // prisma convexo la regla de caras ya la garantiza sola; en las estrellas
  // (cóncavas) y con k < 1 (tronco y pirámide) NO, y sin el recorte esto falla.
  const dentro = frente => {
    const m = 2.5;                       // mismo margen que usa el módulo, y un pelo más
    const w = Math.max(1, frente.w - 2 * m), h = Math.max(1, frente.h - 2 * m);
    const s = { type: frente.type, rotation: 0, w, h,
      x: frente.x + frente.w / 2 - w / 2, y: frente.y + frente.h / 2 - h / 2 };
    if (RegularPolygon.isType(s.type)) return p => RegularPolygon.contains(p, s);
    if (s.type === 'trapezoid') return p => Trapezoid.contains(p, s);
    const rx = s.w / 2, ry = s.h / 2, cx = s.x + rx, cy = s.y + ry;
    if (s.type === 'circle') return p => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1;
    return p => Math.abs(p.x - cx) < rx && Math.abs(p.y - cy) < ry;
  };
  for (const [tool, section, els] of TODAS()) {
    // La esfera está exenta a propósito: su ecuador es una línea SOBRE la
    // superficie, va por dentro del círculo y no está oculto (ver el test del
    // ecuador). Es el único caso.
    if (tool === TOOLS.SOLID_SPHERE) continue;
    const test_ = dentro(frenteDe(els));
    for (const el of aristasDe(els).filter(e => !e.dash)) {
      const pts = [];
      if (el.type === 'line') {
        for (let i = 1; i < 8; i++) {
          pts.push({ x: el.x1 + (el.x2 - el.x1) * i / 8, y: el.y1 + (el.y2 - el.y1) * i / 8 });
        }
      } else {
        el.segments.forEach(s => {
          for (let i = 1; i < 8; i++) {
            const t = i / 8, m = 1 - t;
            pts.push({
              x: m ** 3 * s.x1 + 3 * m * m * t * s.cx + 3 * m * t * t * s.cx2 + t ** 3 * s.x2,
              y: m ** 3 * s.y1 + 3 * m * m * t * s.cy + 3 * m * t * t * s.cy2 + t ** 3 * s.y2,
            });
          }
        });
      }
      assert.ok(!pts.some(test_),
        `${tool}/${section}: pieza sólida oculta tras la cara ${JSON.stringify(el).slice(0, 90)}`);
    }
  }
});

test('la pirámide colapsa la tapa en el ápice y no emite aristas de longitud cero', () => {
  for (const section of SOLID_SECTIONS) {
    const els = dibuja(TOOLS.SOLID_PYRAMID, section);
    for (const el of aristasDe(els).filter(e => e.type === 'line')) {
      assert.ok(Math.hypot(el.x2 - el.x1, el.y2 - el.y1) > 1e-6,
        `${section}: arista degenerada en la pirámide`);
    }
  }
  // Una pirámide poligonal tiene sólo conectores: tantos como vértices
  const penta = aristasDe(dibuja(TOOLS.SOLID_PYRAMID, TOOLS.PENTAGON));
  assert.equal(penta.length, 5);
  // Y todos acaban en el MISMO punto, el ápice
  const apex = { x: penta[0].x2, y: penta[0].y2 };
  for (const el of penta) {
    assert.ok(Math.hypot(el.x2 - apex.x, el.y2 - apex.y) < 1e-6);
  }
});

test('los degenerados no producen NaN ni piezas imposibles', () => {
  // El cono con el ápice DENTRO de la elipse no tiene tangentes (la raíz sería
  // NaN); el módulo aleja la fuga lo justo en vez de emitir basura.
  const extremos = [
    { solidDepth: 10, solidForeshorten: 10 },
    { solidDepth: 150, solidForeshorten: 100, solidAngle: 90 },
    { solidDepth: 10, solidForeshorten: 10, solidAngle: 0 },
    { solidTaper: 95 }, { solidTaper: 10 },
  ];
  for (const opts of extremos) {
    for (const [tool, section, els] of [...TODAS()]) {
      const piezas = Solid.elements(tool, { x: 0, y: 0 }, { x: 80, y: 80 },
        { ...O, solidSection: section, ...opts });
      assert.ok(piezas.length >= 1, `${tool}/${section} con ${JSON.stringify(opts)}: vacío`);
      for (const el of piezas) {
        for (const [k, v] of Object.entries(el)) {
          if (typeof v === 'number') {
            assert.ok(isFinite(v), `${tool}/${section}: ${k} no es finito`);
          }
        }
        assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
          `${tool}/${section} con ${JSON.stringify(opts)}: pieza inválida`);
      }
      assert.ok(els.length >= 1);
    }
  }
});

test('un arrastre del doble da una figura semejante', () => {
  // Protege contra constantes en píxeles mal colocadas: la profundidad va en
  // PORCENTAJE de la cara, así que doblar el arrastre dobla todo.
  const chico = Solid.elements(TOOLS.SOLID_PRISM, { x: 0, y: 0 }, { x: 60, y: 60 },
    { ...O, solidSection: TOOLS.RECT });
  const grande = Solid.elements(TOOLS.SOLID_PRISM, { x: 0, y: 0 }, { x: 120, y: 120 },
    { ...O, solidSection: TOOLS.RECT });
  assert.equal(chico.length, grande.length);
  chico.forEach((a, i) => {
    const b = grande[i];
    assert.equal(a.type, b.type);
    assert.equal(!!a.dash, !!b.dash);
    if (a.type === 'line') {
      assert.ok(Math.abs(a.x1 * 2 - b.x1) < 1e-6 && Math.abs(a.y2 * 2 - b.y2) < 1e-6,
        'la figura no escala en proporción');
    }
  });
});

test('los tres catálogos comparten ids y sólo cambian el nombre', () => {
  for (const cat of [PRISM_SECTIONS, PYRAMID_SECTIONS, FRUSTUM_SECTIONS]) {
    assert.equal(Object.isFrozen(cat), true);
    assert.deepEqual([...cat.map(i => i.id)], [...SOLID_SECTIONS]);
    for (const item of cat) assert.ok(item.name && typeof item.name === 'string');
  }
  // Y los nombres SÍ difieren: es el motivo de que haya tres catálogos y no uno
  assert.notEqual(PRISM_SECTIONS[3].name, PYRAMID_SECTIONS[3].name);
  assert.notEqual(PRISM_SECTIONS[2].name, FRUSTUM_SECTIONS[2].name);
});

test('dentro de un remate, dos secciones nunca se dibujan igual', () => {
  // Misma firma que usa garden.test.js: el multiconjunto de tipos más la
  // proporción global. Si dos entradas del catálogo coinciden en las dos, sus
  // iconos son indistinguibles y una de ellas sobra.
  for (const tool of EXTRUSORAS) {
    const vistas = new Map();
    for (const section of SOLID_SECTIONS) {
      const els = dibuja(tool, section);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      els.forEach(el => {
        const xs = el.type === 'line' ? [el.x1, el.x2] : [el.x, el.x + el.w];
        const ys = el.type === 'line' ? [el.y1, el.y2] : [el.y, el.y + el.h];
        if (el.type === 'curveArrow') return;
        minX = Math.min(minX, ...xs); maxX = Math.max(maxX, ...xs);
        minY = Math.min(minY, ...ys); maxY = Math.max(maxY, ...ys);
      });
      const firma = els.map(e => e.type).sort().join(',') +
        '|' + ((maxX - minX) / (maxY - minY)).toFixed(2);
      assert.ok(!vistas.has(firma),
        `${tool}: «${section}» se dibuja igual que «${vistas.get(firma)}»`);
      vistas.set(firma, section);
    }
  }
});

test('los topes que exporta el módulo son coherentes', () => {
  const pares = [
    [Solid.DEPTH_MIN, Solid.DEPTH_MAX], [Solid.ANGLE_MIN, Solid.ANGLE_MAX],
    [Solid.FORESHORTEN_MIN, Solid.FORESHORTEN_MAX], [Solid.TAPER_MIN, Solid.TAPER_MAX],
  ];
  for (const [lo, hi] of pares) {
    assert.equal(typeof lo, 'number');
    assert.ok(hi > lo, `tope inválido ${lo}..${hi}`);
  }
  // El tronco no puede llegar a 100 %: ahí es un prisma, y a 0 una pirámide.
  assert.ok(Solid.TAPER_MAX < 100 && Solid.TAPER_MIN > 0);
});

test('las herramientas 3D NO son tipos de elemento', () => {
  // Sin ...SOLID_TOOLS en CREATION_ONLY_TOOLS, un JSON manipulado con
  // `type:'prisma'` colaría un elemento fantasma: invisible pero seleccionable.
  for (const tool of SOLID_TOOLS) {
    assert.equal(
      Exporter.isValidElement({ type: tool, x: 0, y: 0, w: 10, h: 10, color: '#000000', lineWidth: 2, seed: 1 }),
      false, `${tool} se acepta como tipo de elemento`);
  }
});

test('un sólido sobrevive al viaje export → import', () => {
  const els = dibuja(TOOLS.SOLID_PRISM, TOOLS.STAR6).map((e, i) => ({ ...e, seed: i + 1 }));
  const json = JSON.parse(JSON.stringify(els));
  for (const el of json) assert.ok(Exporter.isValidElement(el));
  // Estructural: los arrays nacidos dentro del realm vm no comparten prototipo
  assert.deepEqual([...json.map(e => e.type)], [...els.map(e => e.type)]);
  assert.deepEqual([...json.map(e => !!e.dash)], [...els.map(e => !!e.dash)]);
});

test('el ecuador de la esfera tiene una mitad vista y otra oculta', () => {
  // Va por DENTRO del círculo, así que el recorte por punto interior lo daba
  // entero por oculto: las dos mitades salían discontinuas y, con relleno
  // opaco, tapadas — una esfera rellena era un círculo plano.
  const els = dibuja(TOOLS.SOLID_SPHERE, TOOLS.CIRCLE);
  const arcos = els.filter(e => e.type === 'curveArrow');
  assert.equal(arcos.length, 2, 'el ecuador son dos medias elipses');
  assert.equal(arcos.filter(e => e.dash).length, 1, 'una oculta');
  assert.equal(arcos.filter(e => !e.dash).length, 1, 'y una vista');
  // Y la vista se dibuja ENCIMA del círculo, o el relleno la taparía
  const conRelleno = dibuja(TOOLS.SOLID_SPHERE, TOOLS.CIRCLE, { fill: true });
  const iFrente = conRelleno.findIndex(e => e.type === 'circle');
  const iVista = conRelleno.findIndex(e => e.type === 'curveArrow' && !e.dash);
  assert.ok(iVista > iFrente, 'la mitad vista del ecuador va encima del relleno');
});

/* ── Giro de la sección ── */

test('el giro de la sección se cuantiza al paso válido de su tipo', () => {
  // 36° no es una orientación posible de un hexágono, y un trapecio fuera del
  // cuarto de vuelta lo RECHAZA isValidElement al reimportar el proyecto.
  const rot = (section, valor) => frenteDe(dibuja(TOOLS.SOLID_PRISM, section,
    { solidRotation: valor })).rotation;
  assert.equal(rot(TOOLS.HEXAGON, 30), 30);
  assert.equal(rot(TOOLS.HEXAGON, 36), 30, 'se ajusta al paso de 30°');
  assert.equal(rot(TOOLS.PENTAGON, 40), 36, 'se ajusta al paso de 36°');
  assert.equal(rot(TOOLS.TRAPEZOID, 100), 90, 'el trapecio sólo cuartos de vuelta');
  // Y la ausencia del campo sigue siendo la orientación de siempre
  assert.equal(rot(TOOLS.HEXAGON, 0), undefined);
  assert.equal(rot(TOOLS.HEXAGON, 5), undefined, '5° cuantiza a 0, y 0 no se guarda');
});

test('las secciones que no orientan por ángulo ignoran el giro', () => {
  // En el rectángulo, el redondeado y el círculo girar es intercambiar ancho y
  // alto; un `rotation` en ellos lo rechaza isValidElement.
  for (const section of [TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE]) {
    const els = dibuja(TOOLS.SOLID_PRISM, section, { solidRotation: 90 });
    assert.equal(frenteDe(els).rotation, undefined, `${section} no guarda ángulo`);
    for (const el of els) assert.ok(Exporter.isValidElement({ ...el, seed: 1 }));
  }
  assert.equal(Solid.isRotatableSection(TOOLS.RECT), false);
  assert.equal(Solid.isRotatableSection(TOOLS.HEXAGON), true);
  assert.equal(Solid.isRotatableSection(TOOLS.TRAPEZOID), true);
});

test('girar la sección gira TODA la figura, no sólo la cara', () => {
  // Si el giro no llegara al perfil, la cara saldría girada y las aristas
  // seguirían saliendo de los vértices de antes: el sólido se rompería.
  const sin = dibuja(TOOLS.SOLID_PRISM, TOOLS.HEXAGON);
  const con = dibuja(TOOLS.SOLID_PRISM, TOOLS.HEXAGON, { solidRotation: 30 });
  assert.equal(sin.length, con.length);
  const conectores = els => els.filter(e => e.type === 'line')
    .map(e => `${e.x1.toFixed(1)},${e.y1.toFixed(1)}`).sort().join('|');
  assert.notEqual(conectores(sin), conectores(con),
    'las aristas tienen que nacer de los vértices girados');
  for (const el of con) assert.ok(Exporter.isValidElement({ ...el, seed: 1 }));
});

/* ── Grosor y color de las aristas ── */

test('el grosor y el color llegan a TODAS las piezas', () => {
  for (const [tool, section] of [...TODAS()]) {
    const els = dibuja(tool, section,
      { color: '#ff0055', lineWidth: 6, fill: true, fillColor: '#00ffaa' });
    for (const el of els) {
      assert.equal(el.color, '#ff0055', `${tool}/${section}: ${el.type} con otro color`);
      assert.equal(el.lineWidth, 6, `${tool}/${section}: ${el.type} con otro grosor`);
    }
    for (const cara of carasDe(els)) {
      assert.equal(cara.fillColor, '#00ffaa');
    }
  }
});

test('el relleno translúcido y su opacidad viajan a las caras y a la frontal', () => {
  const els = dibuja(TOOLS.SOLID_PRISM, TOOLS.SQUARE,
    { fill: true, fillColor: '#00ffaa', fillTransparent: true, fillOpacity: 0.25 });
  const rellenables = [...carasDe(els), frenteDe(els)];
  assert.ok(rellenables.length > 1);
  for (const el of rellenables) {
    assert.equal(el.fill, true);
    assert.equal(el.fillColor, '#00ffaa');
    assert.equal(el.fillTransparent, true);
    assert.equal(el.fillOpacity, 0.25);
  }
  // Sólido = AUSENCIA del flag, como en el resto de la app
  const solido = dibuja(TOOLS.SOLID_PRISM, TOOLS.SQUARE, { fill: true, fillColor: '#00ffaa' });
  for (const el of [...carasDe(solido), frenteDe(solido)]) {
    assert.equal(el.fillTransparent, undefined);
  }
});

test('el relleno sólido de un sólido es OPACO: sin color propio se usa el del trazo', () => {
  // El tinte clásico `color + '20'` (12 %) que Renderer.fillStyle aplica a una
  // forma sin `fillColor` es retrocompatibilidad de las formas planas; en un
  // sólido dejaba el modo «sólido» MÁS transparente que el translúcido (40 %).
  for (const [tool, section] of [...TODAS()]) {
    const els = dibuja(tool, section, { color: '#123456', fill: true });
    for (const el of [...carasDe(els), frenteDe(els)]) {
      assert.equal(el.fillColor, '#123456',
        `${tool}/${section}: ${el.type} sin color de relleno explícito`);
    }
  }
  // El color elegido sigue mandando sobre el del trazo
  const con = dibuja(TOOLS.SOLID_PRISM, TOOLS.SQUARE,
    { color: '#123456', fill: true, fillColor: '#00ffaa' });
  for (const el of [...carasDe(con), frenteDe(con)]) assert.equal(el.fillColor, '#00ffaa');

  // Sin relleno no se inventa ninguno, pero el elegido se conserva: vaciar y
  // volver a rellenar tiene que recuperar el mismo color.
  const hueco = dibuja(TOOLS.SOLID_PRISM, TOOLS.SQUARE, { color: '#123456' });
  assert.equal(frenteDe(hueco).fillColor, undefined);
  const huecoConColor = dibuja(TOOLS.SOLID_PRISM, TOOLS.SQUARE,
    { color: '#123456', fillColor: '#00ffaa' });
  assert.equal(carasDe(huecoConColor).length, 0, 'sin relleno no hay caras');
  assert.equal(frenteDe(huecoConColor).fill, false);
  assert.equal(frenteDe(huecoConColor).fillColor, '#00ffaa');
});

/* ── Pirámide de pie: el vértice en el plano del papel ── */

const dePie = (section, opts, tool) => Solid.elements(tool || TOOLS.SOLID_PYRAMID,
  { x: 0, y: 0 }, { x: 80, y: 80 },
  { ...O, solidSection: section, solidApex: 'upright', ...opts });

test('«de pie» es otra proyección: no hay cara frontal y la base se tumba', () => {
  for (const section of SOLID_SECTIONS) {
    const els = dePie(section);
    assert.ok(els.length >= 4, `${section}: figura vacía`);
    // La marca del modo: en el de siempre la cara frontal es un elemento de
    // forma de verdad; aquí no hay ninguno, porque la base va tumbada.
    assert.equal(frenteDe(els), undefined,
      `${section}: la pirámide de pie no puede tener cara frontal`);
    for (const el of els) {
      assert.ok(ES_ARISTA(el) || el.type === 'polygon',
        `${section}: pieza inesperada ${el.type}`);
      assert.ok(Exporter.isValidElement({ ...el, seed: 1 }));
    }
    // Y hay volumen: algo se ve y algo queda detrás.
    assert.ok(els.some(e => e.dash), `${section}: nada oculto, no se lee el volumen`);
    assert.ok(els.some(e => !e.dash), `${section}: todo oculto`);
  }
});

test('la punta cae dentro del arrastre, y encima de la base', () => {
  for (const section of SOLID_SECTIONS) {
    const els = dePie(section);
    const ys = els.flatMap(e => e.points ? e.points.map(p => p.y)
      : [e.y1, e.y2].filter(Number.isFinite));
    const xs = els.flatMap(e => e.points ? e.points.map(p => p.x)
      : [e.x1, e.x2].filter(Number.isFinite));
    const arriba = Math.min(...ys), abajo = Math.max(...ys);
    // La caja del gesto para un polígono regular nace del centro, así que se
    // compara con la de la figura: lo que se comprueba es que el vértice está
    // ARRIBA del todo y la base ABAJO, que es lo que distingue este modo.
    assert.ok(abajo - arriba > 20, `${section}: figura aplastada`);
    // Un único punto en lo más alto: la punta. Se cuentan posiciones DISTINTAS
    // —de una estrella nacen diez aristas del mismo vértice— redondeadas al
    // píxel, porque ahí es donde concurren todas las aristas laterales.
    const cima = new Set();
    els.forEach(e => [[e.x1, e.y1], [e.x2, e.y2]].forEach(([x, y]) => {
      if (Number.isFinite(y) && y < arriba + 1) cima.add(`${Math.round(x)},${Math.round(y)}`);
    }));
    assert.equal(cima.size, 1, `${section}: la cúspide no es un solo punto`);
    assert.ok(xs.length > 4);
  }
});

test('la fuga mínima no deja la base sin área (la figura no desaparece)', () => {
  for (const section of SOLID_SECTIONS) {
    const els = dePie(section, { solidDepth: 10, solidForeshorten: 10 });
    assert.ok(els.length >= 4, `${section}: se queda sin figura con la fuga al mínimo`);
  }
});

test('«de pie» rellena las caras vistas, y nunca la base', () => {
  const els = dePie(TOOLS.SQUARE, { fill: true, fillColor: '#00ffaa' });
  const caras = els.filter(e => e.type === 'polygon');
  assert.ok(caras.length >= 1 && caras.length <= 3,
    'de una pirámide cuadrada se ven una o dos caras, nunca las cuatro');
  for (const c of caras) {
    assert.equal(c.fill, true);
    assert.equal(c.fillColor, '#00ffaa');
    assert.equal(c.stroke, false);
    assert.equal(c.points.length, 3, 'una cara lateral es un triángulo');
  }
  // Sin relleno no hay ninguna cara
  assert.equal(dePie(TOOLS.SQUARE).filter(e => e.type === 'polygon').length, 0);
});

test('el modo por defecto NO cambia: sin solidApex, la pirámide es la de siempre', () => {
  const antes = Solid.elements(TOOLS.SOLID_PYRAMID, { x: 0, y: 0 }, { x: 80, y: 80 },
    { ...O, solidSection: TOOLS.SQUARE });
  const conModo = Solid.elements(TOOLS.SOLID_PYRAMID, { x: 0, y: 0 }, { x: 80, y: 80 },
    { ...O, solidSection: TOOLS.SQUARE, solidApex: 'depth' });
  assert.deepEqual(JSON.parse(JSON.stringify(conModo)), JSON.parse(JSON.stringify(antes)));
  assert.ok(frenteDe(antes), 'el modo de siempre sigue teniendo cara frontal');
  // Y el modo no se cuela en los remates que no lo tienen
  assert.deepEqual([...Solid.UPRIGHT_TOOLS], [TOOLS.SOLID_PYRAMID, TOOLS.SOLID_FRUSTUM]);
  for (const tool of [TOOLS.SOLID_PRISM, TOOLS.SOLID_SPHERE]) {
    const els = Solid.elements(tool, { x: 0, y: 0 }, { x: 80, y: 80 },
      { ...O, solidSection: TOOLS.SQUARE, solidApex: 'upright' });
    assert.ok(frenteDe(els), `${tool}: el modo de la pirámide no le incumbe`);
  }
});

test('APEX_MODES es la lista que valida las prefs', () => {
  assert.deepEqual([...Solid.APEX_MODES], ['depth', 'upright']);
});

test('de pie, lo que se tapa son las aristas de DETRÁS (caso canónico)', () => {
  // Caso resuelto a mano, porque el signo de referencia de _faceVisible lo pone
  // aquí la base —que mira al SUELO— y no una cara frontal: con el signo sin
  // cambiar la pirámide sale con las traseras sólidas y las delanteras a
  // trazos, que es exactamente el defecto que hubo que corregir.
  //
  // Base cuadrada tumbada y fuga por defecto (30°, hacia arriba y a la
  // derecha). La proyección induce su propia dirección de visión: un
  // desplazamiento invisible cumple δX = −dx·δZ y δY = dy·δZ, o sea que se
  // mira desde (+X, +Y, −Z) — desde la DERECHA, desde ARRIBA y desde DELANTE.
  // De ahí lo que tiene que verse: la cara de delante y la de la derecha.
  const els = Solid.elements(TOOLS.SOLID_PYRAMID, { x: 0, y: 0 }, { x: 100, y: 100 },
    { ...O, solidSection: TOOLS.RECT, solidApex: 'upright' });
  const lin = els.filter(e => e.type === 'line');
  assert.equal(lin.length, 8, 'cuatro aristas de base y cuatro laterales');
  const apice = Math.min(...lin.flatMap(e => [e.y1, e.y2]));
  const base = lin.filter(e => e.y1 > apice + 1 && e.y2 > apice + 1);
  const lados = lin.filter(e => e.y1 <= apice + 1 || e.y2 <= apice + 1);
  assert.equal(base.length, 4);
  assert.equal(lados.length, 4);

  // La base tumbada de un rectángulo es un paralelogramo: DOS vértices en el
  // borde cercano y dos en el lejano, no uno y uno.
  const ys = base.flatMap(e => [e.y1, e.y2]);
  const cerca = Math.max(...ys), lejos = Math.min(...ys);
  const enY = (e, y) => Math.abs(e.y1 - y) < 1 && Math.abs(e.y2 - y) < 1;
  const delante = base.find(e => enY(e, cerca));
  const detras = base.find(e => enY(e, lejos));
  assert.ok(delante && detras, 'la base tiene un borde cercano y otro lejano');
  assert.ok(!delante.dash, 'el borde de delante de la base se ve');
  assert.ok(detras.dash, 'el borde de detrás queda tapado por el cuerpo');

  // Y de las dos aristas que unen los dos bordes se ve la de la DERECHA, que
  // es donde está el observador.
  const cruzadas = base.filter(e => e !== delante && e !== detras);
  assert.equal(cruzadas.length, 2);
  const mediaX = e => (e.x1 + e.x2) / 2;
  const der = mediaX(cruzadas[0]) > mediaX(cruzadas[1]) ? cruzadas[0] : cruzadas[1];
  const izq = der === cruzadas[0] ? cruzadas[1] : cruzadas[0];
  assert.ok(!der.dash, 'con la fuga a la derecha, la arista derecha de la base se ve');
  assert.ok(izq.dash, 'y la izquierda queda detrás del cuerpo');

  // De las cuatro aristas que suben al ápice sólo se esconde una: la del único
  // vértice que no toca ninguna cara vista, el de detrás a la izquierda.
  assert.equal(lados.filter(e => e.dash).length, 1,
    'sólo el vértice de detrás a la izquierda queda oculto');
});

test('de pie, el cono enseña la mitad de la base que da al observador', () => {
  const els = Solid.elements(TOOLS.SOLID_PYRAMID, { x: 0, y: 0 }, { x: 100, y: 100 },
    { ...O, solidSection: TOOLS.CIRCLE, solidApex: 'upright' });
  const arcos = els.filter(e => e.type === 'curveArrow');
  assert.equal(arcos.length, 2, 'la base se emite como dos arcos, no como 64 tramos');
  const visto = arcos.find(e => !e.dash), oculto = arcos.find(e => e.dash);
  assert.ok(visto && oculto, 'una mitad se ve y la otra queda detrás');
  // El parámetro del arco emitido es el opuesto del índice del muestreo; con
  // el signo sin corregir salían intercambiados, y el punto más CERCANO de la
  // base —el más bajo en pantalla— caía en el arco oculto.
  const bajo = c => Math.max(...c.segments.flatMap(s => [s.y1, s.y2]));
  const alto = c => Math.min(...c.segments.flatMap(s => [s.y1, s.y2]));
  assert.ok(bajo(visto) > bajo(oculto),
    'el punto más cercano de la base está en la mitad que se ve');
  assert.ok(alto(oculto) < alto(visto),
    'y el más lejano, en la que se tapa');
});

/* ── El mismo modo de pie, en el Tronco ── */

const troncoDePie = (section, opts) => dePie(section, opts, TOOLS.SOLID_FRUSTUM);

test('el tronco de pie es el mismo cuerpo con tapa: base abajo, tapa arriba', () => {
  for (const section of SOLID_SECTIONS) {
    const els = troncoDePie(section);
    assert.equal(frenteDe(els), undefined, `${section}: tampoco tiene cara frontal`);
    assert.ok(els.some(e => e.dash), `${section}: nada oculto`);
    for (const el of els) assert.ok(Exporter.isValidElement({ ...el, seed: 1 }));
    // Hay DOS contornos horizontales, base y tapa, y la tapa está más arriba.
    const ys = els.flatMap(e => e.points ? e.points.map(p => p.y)
      : e.segments ? e.segments.flatMap(sg => [sg.y1, sg.y2])
        : [e.y1, e.y2].filter(Number.isFinite));
    assert.ok(Math.max(...ys) - Math.min(...ys) > 20, `${section}: figura aplastada`);
  }
  // La pirámide es este mismo cuerpo con la tapa colapsada: mismo número de
  // aristas menos las de la tapa.
  const tronco = troncoDePie(TOOLS.RECT).filter(e => e.type === 'line');
  const piramide = dePie(TOOLS.RECT).filter(e => e.type === 'line');
  assert.equal(tronco.length, 12, '4 de base + 4 de tapa + 4 laterales');
  assert.equal(piramide.length, 8, 'sin tapa: 4 de base + 4 laterales');
});

test('de pie se ve la cara de arriba, y sólo una de las dos horizontales', () => {
  // Con la fuga por defecto (hacia arriba) se mira desde arriba: la tapa se ve
  // entera y la base queda tapada por el cuerpo. Con la fuga hacia abajo, al
  // revés. Es lo que distingue una cara horizontal de una lateral: no la
  // decide el criterio de caras, sino desde dónde se mira.
  const arriba = troncoDePie(TOOLS.RECT);
  const abajo = troncoDePie(TOOLS.RECT, { solidAngle: 210 });
  const ysDe = els => els.flatMap(e => [e.y1, e.y2].filter(Number.isFinite));
  const cotaTapa = els => Math.min(...ysDe(els));
  // Ninguna arista a la altura de la tapa va discontinua cuando se mira desde
  // arriba; y con la fuga hacia abajo, la de la base tampoco.
  const tocaCota = (e, y) => Math.abs(e.y1 - y) < 1 && Math.abs(e.y2 - y) < 1;
  const tapaArriba = arriba.filter(e => tocaCota(e, cotaTapa(arriba)));
  assert.ok(tapaArriba.length >= 1);
  assert.ok(tapaArriba.every(e => !e.dash), 'mirando desde arriba, la tapa se ve entera');
  const bordeAbajo = abajo.filter(e => tocaCota(e, Math.max(...ysDe(abajo))));
  assert.ok(bordeAbajo.length >= 1);
  assert.ok(bordeAbajo.every(e => !e.dash), 'mirando desde abajo se ve la cara de abajo');
});

test('con relleno, la cara horizontal que se ve también se pinta', () => {
  // Sin ella el tronco queda con un agujero justo donde debería estar su cara
  // de arriba, y se ve el papel a través. Va la ÚLTIMA de las caras, que es lo
  // que la deja dibujada encima de las laterales.
  const els = troncoDePie(TOOLS.RECT, { fill: true, fillColor: '#00ffaa' });
  const caras = els.filter(e => e.type === 'polygon');
  assert.ok(caras.length >= 2, 'las laterales vistas más la tapa');
  const tapa = caras[caras.length - 1];
  const alto = c => Math.max(...c.points.map(p => p.y)) - Math.min(...c.points.map(p => p.y));
  const laterales = caras.slice(0, -1);
  assert.ok(laterales.every(c => alto(c) > alto(tapa) * 2),
    'la cara de arriba es horizontal: mucho menos alta que cualquier lateral');
  assert.equal(tapa.fillColor, '#00ffaa');
  // Y está arriba del todo
  const arribaDeTodo = Math.min(...caras.flatMap(c => c.points.map(p => p.y)));
  assert.ok(Math.min(...tapa.points.map(p => p.y)) <= arribaDeTodo + 1e-6);
  // La pirámide no tiene tapa que pintar: todas sus caras son laterales
  const pir = dePie(TOOLS.RECT, { fill: true }).filter(e => e.type === 'polygon');
  assert.ok(pir.every(c => c.points.length === 3), 'las de la pirámide son triángulos');
});

test('el tronco de cono de pie no parte su superficie en dos caras', () => {
  // El barrido arranca en un tramo oculto justo para eso: dos polígonos
  // adyacentes comparten borde y en translúcido ese borde sale doble.
  const els = troncoDePie(TOOLS.CIRCLE, { fill: true, fillTransparent: true });
  const caras = els.filter(e => e.type === 'polygon');
  // La última es la tapa (elipse entera); lo de delante, la superficie vista.
  assert.equal(caras.length, 2, 'una cara lateral y la tapa, ni una más');
  const alto = c => Math.max(...c.points.map(p => p.y)) - Math.min(...c.points.map(p => p.y));
  assert.ok(alto(caras[0]) > alto(caras[1]) * 2, 'la primera es la superficie lateral');
});
