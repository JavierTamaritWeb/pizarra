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

const frenteDe = els => els[els.length - 1];
const aristasDe = els => els.slice(0, -1);

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

test('la cara frontal es el elemento 2D REAL de la sección, y va la última', () => {
  // Es lo que hace que herede el relleno, el temblor de Sketchy, el hit-test y
  // el borrado por silueta, «Bordes ocultos» y las cinco exportaciones sin una
  // línea de código propia. Y va la última para que su relleno tape lo que
  // pasa por detrás.
  for (const [tool, section, els] of TODAS()) {
    assert.equal(frenteDe(els).type, section, `${tool}/${section}: la última no es la cara`);
    assert.ok(frenteDe(els).w > 0 && frenteDe(els).h > 0);
    for (const el of aristasDe(els)) {
      assert.ok(el.type === 'line' || el.type === 'curveArrow',
        `${tool}/${section}: arista de tipo ${el.type}`);
    }
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
  const conAngulo = a => JSON.stringify(dibuja(TOOLS.SOLID_PRISM, TOOLS.RECT,
    { solidAngle: a }).map(e => !!e.dash));
  // Contra la fuga OPUESTA: dentro de un mismo cuadrante un rectángulo tiene
  // las mismas caras vistas, así que comparar 30° con 85° no probaría nada.
  assert.notEqual(conAngulo(30), conAngulo(210));
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
