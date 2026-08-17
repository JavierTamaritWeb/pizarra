'use strict';
/* ============================================================
   app-interaction.test.js — Gestos reales sobre src/js/app.js.

   Estos tests ejecutan la app entera (sidebar, modales, canvas) sobre el
   DOM de tests/helpers/dom-stub.js y comprueban el resultado leyendo el
   autosave, que es la serialización real de `state.elements`. Cubren la
   zona que BUGS.md marcaba como "solo verificable manualmente".

   Ejecutar: node --test tests/app-interaction.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app.js');
const { loadAll } = require('./helpers/load.js');

// isValidElement es pura: se toma del cargador normal en vez de hurgar en el
// contexto vm de la app (sus `const` top-level no cuelgan de globalThis).
const { Exporter, TOOLS, Airbrush } = loadAll();

/** Desplazamiento en x de un elemento entre dos escenas (rect/line). */
const dx = (before, after) =>
  after.x !== undefined ? after.x - before.x : after.x1 - before.x1;

/** Dibuja una fachada y devuelve { app, gid, count }. */
function withFacade() {
  const app = loadApp();
  app.selectTool('fachada');
  app.drag(100, 100, 300, 420);
  const els = app.elements();
  assert.ok(els.length > 2, 'la fachada debe crear varias piezas');
  const gid = els[0].buildingGroupId;
  assert.ok(gid, 'las piezas deben compartir buildingGroupId');
  assert.ok(els.every(e => e.buildingGroupId === gid), 'todas del mismo grupo');
  return { app, gid, count: els.length };
}

test('el arnés arranca la app real sin lanzar', () => {
  const app = loadApp();
  assert.deepEqual(app.elements(), []);
  const tools = app.dom.document.querySelectorAll('.sidebar__tool');
  assert.ok(tools.length > 10, 'el sidebar se construye desde TOOL_GROUPS');
});

/* ── Regresión: el marco de un edificio seleccionado se tragaba los clics ── */

test('con un edificio seleccionado, Supr borra el elemento pulsado, no el edificio', () => {
  const { app, count } = withFacade();
  app.selectTool('rect');
  app.drag(150, 200, 190, 240);   // dos rects DENTRO del marco de la fachada
  app.drag(210, 260, 250, 300);

  app.selectTool('select');
  app.click(100, 100);            // selecciona la fachada entera
  app.click(170, 220);            // pulsa uno de los rects
  app.key('Delete');

  const els = app.elements();
  assert.equal(els.filter(e => e.buildingGroupId).length, count,
    'la fachada NO debe borrarse al pulsar Supr sobre otro elemento');
  assert.equal(els.filter(e => e.type === 'rect' && e.w === 40).length, 1,
    'debe borrarse exactamente el rect pulsado');
});

test('con un edificio seleccionado, arrastrar un elemento de encima lo mueve a él', () => {
  const { app, gid, count } = withFacade();
  app.selectTool('puerta');
  app.drag(150, 300, 190, 400);   // puerta dibujada ENCIMA de la fachada
  const doorGid = app.elements().slice(count)[0].buildingGroupId;
  assert.notEqual(doorGid, gid, 'la puerta es un grupo independiente');

  app.selectTool('select');
  app.click(100, 100);            // selecciona la fachada
  const before = app.elements();
  app.drag(170, 350, 260, 350);   // arrastra la PUERTA, dentro del marco
  const after = app.elements();

  const movedFacade = after.filter((e, i) => e.buildingGroupId === gid && dx(before[i], e) !== 0);
  const movedDoor = after.filter((e, i) => e.buildingGroupId === doorGid && dx(before[i], e) !== 0);
  assert.equal(movedFacade.length, 0, 'la fachada no debe moverse');
  assert.equal(movedDoor.length, 3, 'debe moverse la puerta entera');
  assert.ok(movedDoor.every(e => Math.abs(dx(before[after.indexOf(e)], e) - 90) < 1e-6),
    'la puerta se desplaza los 90px arrastrados');
});

test('sigue funcionando arrastrar el edificio desde un hueco de su marco', () => {
  const { app, gid, count } = withFacade();
  app.selectTool('select');
  app.click(100, 100);            // selecciona la fachada
  const before = app.elements();
  // (105, 410) cae dentro del marco pero sobre ninguna pieza concreta:
  // es la comodidad de "arrastrar el grupo desde cualquier punto".
  app.drag(105, 412, 205, 412);
  const after = app.elements();
  const moved = after.filter((e, i) => e.buildingGroupId === gid && dx(before[i], e) !== 0);
  assert.equal(moved.length, count, 'el edificio entero debe moverse como unidad');
});

test('Alt+clic sigue aislando una pieza del edificio', () => {
  const { app, count } = withFacade();
  app.selectTool('select');
  app.click(100, 100, { altKey: true });
  app.key('Delete');
  assert.equal(app.elements().length, count - 1, 'Alt+clic borra solo la pieza');
});

/* ── Regresión (auditoría 2026-08-08): Alt+clic era la ÚNICA vía de aislar
   una pieza — un acorde tecla+puntero, imposible con una sola mano. El doble
   clic sobre una pieza de la selección múltiple desciende a ella. ── */

test('doble clic desciende a la pieza del edificio: aislar sin teclado (una mano)', () => {
  const { app, count } = withFacade();
  app.selectTool('select');
  app.click(100, 100);          // primer clic: el edificio entero
  app.dblclick(100, 100);       // doble clic: desciende a la pieza bajo el cursor
  app.key('Delete');
  assert.equal(app.elements().length, count - 1,
    'se borra solo la pieza aislada por doble clic, sin ninguna tecla');
});

/* ── Regresión (auditoría 2026-08-08): Shift+clic era la única vía de
   multi-selección disjunta y de quitar un elemento de la selección — otro
   acorde tecla+puntero. La casilla «Los clics acumulan selección» es la vía
   de una mano; Shift queda como atajo. ── */

test('«Los clics acumulan selección»: multi-selección disjunta sin teclado', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 90, 90);
  app.drag(300, 300, 340, 340);
  app.selectTool('select');
  toggle(app, 'select-modal-multi');
  app.click(70, 70);
  app.click(320, 320);          // añade: no sustituye
  app.key('Delete');
  assert.equal(app.elements().length, 0, 'los dos rects estaban seleccionados a la vez');
});

test('en modo acumular, arrastrar sigue moviendo y el clic sin arrastre quita', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 90, 90);
  app.drag(300, 300, 340, 340);
  app.selectTool('select');
  toggle(app, 'select-modal-multi');
  app.click(70, 70);
  app.click(320, 320);
  // Arrastrar desde un elemento ya seleccionado mueve toda la selección
  // (la retirada solo se consuma si el gesto acaba sin arrastre)
  app.drag(70, 70, 120, 70);
  let els = app.elements();
  assert.deepEqual(els.map(e => e.x).sort((a, b) => a - b), [100, 350],
    'los dos rects se movieron 50px como grupo');
  // Un clic sin arrastre sobre uno seleccionado lo quita de la selección
  app.click(370, 320);
  app.key('Delete');
  els = app.elements();
  assert.equal(els.length, 1, 'solo se borró lo que seguía seleccionado');
  assert.equal(els[0].x, 350, 'sobrevive el rect retirado de la selección');
});

/* ── Regresión (auditoría 2026-08-08): doble clic sobre el SEGUNDO control
   de un tramo cúbico encadenado reseteaba el primero (cx/cy) y dejaba
   cx2/cy2 intacto: tramo medio reseteado y deformado. ── */

test('doble clic en el handle segCtrl2 resetea el tramo entero, no el control equivocado', () => {
  const chain = {
    type: 'curveArrow', color: '#1a1a2e', lineWidth: 2,
    x1: 0, y1: 100, x2: 200, y2: 100,
    segments: [
      { x1: 0, y1: 100, cx: 30, cy: 40, cx2: 70, cy2: 160, x2: 100, y2: 100 },
      { x1: 100, y1: 100, cx: 130, cy: 40, cx2: 170, cy2: 160, x2: 200, y2: 100 },
    ],
  };
  const app = loadApp({ autosave: [chain] });
  app.selectTool('select');
  app.click(100, 100);          // selecciona la cadena (clic sobre la junta)
  app.dblclick(70, 160);        // doble clic sobre el handle segCtrl2 del tramo 0
  const seg = app.elements()[0].segments[0];
  // S canónica del tramo (cuerda (0,100)→(100,100), sVal = 25):
  assert.ok(Math.abs(seg.cx - 25) < 1 && Math.abs(seg.cy - 125) < 1,
    `el primer control va a la S canónica (cx=${seg.cx}, cy=${seg.cy})`);
  assert.ok(Math.abs(seg.cx2 - 75) < 1 && Math.abs(seg.cy2 - 75) < 1,
    `el segundo control también se resetea (cx2=${seg.cx2}, cy2=${seg.cy2})`);
});

/* ── Regresión: elegir tipo de puerta/ventana sin salir del flujo de Fachada ── */

test('el modal de Fachada permite elegir el tipo de puerta y de ventana', () => {
  const app = loadApp();
  const door = app.$('facade-door-type');
  const win = app.$('facade-window-type');
  assert.ok(door.children.length >= 8, 'el selector de puerta se llena desde DOOR_TYPES');
  assert.ok(win.children.length >= 8, 'el selector de ventana se llena desde WINDOW_TYPES');

  app.selectTool('fachada');
  door.value = 'arch';
  door.__fire('change', { target: door });
  win.value = 'round';
  win.__fire('change', { target: win });
  app.flush();
  app.drag(100, 100, 320, 440);

  const els = app.elements();
  assert.ok(els.filter(e => e.type === 'circle').length > 0,
    'con Óculo la fachada debe traer ventanas circulares');
  assert.ok(els.some(e => e.type === 'curveArrow' && e.arc === true),
    'con Puerta de arco la fachada debe traer el arco');
});

/* ── Jardín: el ancho por defecto del camino, cuando el arrastre no lo da ── */

test('el slider de ancho de camino cambia el camino y se recuerda', () => {
  const app = loadApp();
  const slider = app.$('garden-path-width');
  slider.value = '72';
  slider.__fire('input', { target: slider });
  slider.__fire('change', { target: slider });
  app.flush();
  assert.equal(app.$('path-width-val').textContent, '72', 'el número sigue al dedo');

  app.selectTool('camino');
  // El selector de atributo no lo entiende el stub del DOM: se filtra a mano.
  const btn = [...app.$('path-catalog').querySelectorAll('.modal__path')]
    .find(b => b.dataset.path === 'pathStraight');
  app.$('modal-path').__fire('click', { target: btn });
  app.flush();
  // Arrastre en línea recta: sin lado corto que leer, el ancho lo pone el panel.
  app.drag(100, 300, 400, 300);

  const [a, b] = app.elements().filter(e => e.type === 'line');
  assert.equal(Math.abs(a.y1 - b.y1), 72, 'el camino sale con el ancho elegido');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.pathWidth, 72);
  assert.equal(loadApp({ prefs }).$('garden-path-width').value, '72',
    'y vuelve puesto al arrancar de nuevo');
});

/** Elige la variante recta en el catálogo de Camino ya abierto. */
function pickPathVariant(app, id = 'pathStraight') {
  const btn = [...app.$('path-catalog').querySelectorAll('.modal__path')]
    .find(b => b.dataset.path === id);
  app.$('modal-path').__fire('click', { target: btn });
  app.flush();
}

/** Elige Camino y su variante recta, sobre una app ya cargada. */
function pickPathStraight(app) {
  app.selectTool('camino');
  pickPathVariant(app);
}

/** Marca/desmarca una casilla y dispara su `change`, como haría un clic. */
function toggle(app, id, on = true) {
  const el = app.$(id);
  el.checked = on;
  el.__fire('change', { target: el });
  app.flush();
  return el;
}

/* ── Camino: la inclinación es un ajuste de un clic, no una tecla mantenida ──
   Shift+arrastrar exige DOS manos y deja fuera a quien solo puede usar una, así
   que no puede ser la única forma de trazar un camino inclinado. */

test('«Cualquier inclinación» traza en diagonal sin tocar el teclado', () => {
  const app = loadApp();
  app.selectTool('camino');
  toggle(app, 'path-any-angle');            // un clic dentro del propio catálogo
  assert.equal(app.$('check-path-any-angle').checked, true,
    'la gemela del panel debe quedar al día sin haberla tocado');
  pickPathVariant(app);

  app.drag(100, 100, 400, 300);             // SIN shiftKey: una sola mano
  const lines = app.elements().filter(e => e.type === 'line');
  assert.equal(lines.length, 2);
  for (const e of lines) {
    assert.ok(e.x1 !== e.x2 && e.y1 !== e.y2, 'el camino debe salir inclinado');
    assert.ok(Math.abs((e.x2 - e.x1) / (e.y2 - e.y1) - 300 / 200) < 0.01,
      'y paralelo al vector exacto del arrastre (300×200)');
  }

  // Es un ajuste, no un modo de un solo uso: sigue puesto al volver a arrancar.
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.pathAnyAngle, true);
  assert.equal(loadApp({ prefs }).$('path-any-angle').checked, true);
});

// Lo que el usuario no podía hacer: con el camino inclinado, el arrastre ya no
// deja lado corto que leer, así que el ancho SOLO puede venir del deslizador —
// y tenía que estar donde se elige el trazado, no únicamente en el panel.
test('el ancho del camino inclinado se cambia desde el propio catálogo', () => {
  const app = loadApp();
  app.selectTool('camino');
  toggle(app, 'path-any-angle');
  const slider = app.$('path-width-modal');
  slider.value = '80';
  slider.__fire('input', { target: slider });
  slider.__fire('change', { target: slider });
  app.flush();

  assert.equal(app.$('garden-path-width').value, '80', 'el gemelo del panel sigue al del modal');
  assert.equal(app.$('path-width-val').textContent, '80');
  assert.equal(app.$('path-width-modal-val').textContent, '80');

  pickPathVariant(app);
  app.drag(100, 100, 400, 300);
  const [a, b] = app.elements().filter(e => e.type === 'line');
  assert.ok(Math.abs(Math.hypot(a.x1 - b.x1, a.y1 - b.y1) - 80) < 1e-6,
    'el camino inclinado sale con el ancho elegido en el catálogo');
});

/* El ángulo es lo único que decide el gesto cuando el camino va inclinado, y
   nada más lo dice: sin el rótulo hay que acertarlo a ojo. Va en el overlay, así
   que se comprueba sobre las llamadas de pintado, no sobre la escena. */
test('al trazar un camino inclinado se ve el ángulo junto al puntero', () => {
  const app = loadApp();
  app.selectTool('camino');
  toggle(app, 'path-any-angle');
  pickPathVariant(app);

  // El rótulo vive mientras se arrastra: al soltar, el overlay se limpia. Hay
  // que mirar a media pulsación, sin llegar al pointerup.
  const anguloEnCurso = (a, p1, p2) => {
    const canvas = a.$('main-canvas'), overlay = a.$('overlay-canvas');
    canvas.__fire('pointerdown', { ...p1, pointerId: 1, button: 0 });
    overlay._ctx.reset();               // solo interesa lo que pinta el arrastre
    canvas.__fire('pointermove', { ...p2, pointerId: 1, buttons: 1 });
    a.flush();
    return overlay._ctx.callsTo('fillText').map(c => c.args[0]).filter(t => /°$/.test(t));
  };

  // 45° exactos hacia arriba: en pantalla la y crece hacia abajo, y el rótulo
  // usa convención de transportador (0° a la derecha, positivo hacia arriba).
  assert.deepEqual(
    [...anguloEnCurso(app, { clientX: 200, clientY: 400 }, { clientX: 400, clientY: 200 })],
    ['45°'], 'debe rotularse el ángulo del arrastre');

  // En modo caja el camino solo puede salir a 0° o 90°: el número sería ruido.
  const caja = loadApp();
  caja.selectTool('camino');
  pickPathVariant(caja);
  assert.deepEqual(
    [...anguloEnCurso(caja, { clientX: 200, clientY: 400 }, { clientX: 400, clientY: 200 })],
    [], 'sin inclinación libre no debe aparecer ningún ángulo');
});

// Los iconos distinguen el TRAZADO (serpenteante/recto, liso/empedrado), no la
// inclinación: con la casilla marcada se pintarían en diagonal y con el ancho
// del panel, que a 120px deja el icono hecho una mancha.
test('con «Cualquier inclinación» los iconos del catálogo siguen en modo caja', () => {
  const app = loadApp();
  app.selectTool('camino');
  toggle(app, 'path-any-angle');

  const seen = [];
  const orig = app.context.Garden.elements;
  app.context.Garden.elements = (tool, p1, p2, opts) => {
    if (tool === TOOLS.GARDEN_PATH) seen.push({ p2, freeAngle: opts.freeAngle });
    return orig(tool, p1, p2, opts);
  };
  app.selectTool('camino');   // reabre el catálogo → 4 iconos + la miniatura
  app.context.Garden.elements = orig;

  // Los iconos se piden con la caja fija del catálogo (44×84); la miniatura,
  // con un recorrido largo. Es lo que los distingue entre sí.
  const icons = seen.filter(c => c.p2.x === 44 && c.p2.y === 84);
  const preview = seen.filter(c => !(c.p2.x === 44 && c.p2.y === 84));
  assert.equal(icons.length, 4, 'reabrir el catálogo debe repintar los cuatro iconos');
  assert.ok(icons.every(c => c.freeAngle === false),
    'ningún icono debe heredar la inclinación del ajuste');
  // Y la miniatura, al revés: es justo la que tiene que enseñarla.
  assert.equal(preview.length, 1, 'debe repintarse la miniatura, una sola vez');
  assert.equal(preview[0].freeAngle, true,
    'la miniatura sí debe salir inclinada, que es lo que enseña');
});

test('Shift durante el arrastre traza el camino en cualquier inclinación', () => {
  // Sin Shift, el mismo arrastre en diagonal se sigue leyendo como caja: el
  // lado largo (dx=300) manda, y el camino sale horizontal.
  const sinShift = loadApp();
  pickPathStraight(sinShift);
  sinShift.drag(100, 100, 400, 300);
  const [a1, b1] = sinShift.elements().filter(e => e.type === 'line');
  assert.ok(a1.y1 === a1.y2 && b1.y1 === b1.y2,
    'sin Shift, un arrastre en diagonal debe seguir dando un camino horizontal');

  // Con Shift, el mismo arrastre sale en su inclinación exacta: ya no hay
  // eje al que snapear, así que ningún borde queda horizontal ni vertical.
  const conShift = loadApp();
  pickPathStraight(conShift);
  conShift.drag(100, 100, 400, 300, { shiftKey: true });
  const [a2, b2] = conShift.elements().filter(e => e.type === 'line');
  for (const e of [a2, b2]) {
    assert.ok(e.x1 !== e.x2 && e.y1 !== e.y2,
      'con Shift, el borde no debe quedar ni horizontal ni vertical');
    const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
    assert.ok(Math.abs(dx / dy - 300 / 200) < 0.01,
      'y debe ir paralelo al vector exacto del arrastre (300×200)');
  }
});

// state.pathFreeAngle viaja dentro de gardenOpts(), así que los iconos del
// catálogo (que también llaman a Garden.elements) lo heredarían si no se
// reiniciara al soltar: un arrastre en diagonal con Shift dejaría el
// catálogo pintando sus cuatro iconos en diagonal la próxima vez que se abra.
test('el modo libre del camino no se filtra a los iconos del catálogo', () => {
  const app = loadApp();
  pickPathStraight(app);
  app.drag(100, 100, 400, 300, { shiftKey: true });   // commit en diagonal

  const seen = [];
  const orig = app.context.Garden.elements;
  app.context.Garden.elements = (tool, p1, p2, opts) => {
    if (tool === TOOLS.GARDEN_PATH) seen.push(opts.freeAngle);
    return orig(tool, p1, p2, opts);
  };
  app.selectTool('camino');   // reabre el catálogo → repinta los 4 iconos
  app.context.Garden.elements = orig;

  assert.ok(seen.length > 0, 'reabrir el catálogo debe repintar los iconos');
  assert.ok(seen.every(f => !f),
    'los iconos deben pintarse en modo caja, no en el diagonal del arrastre anterior');
});

test('los iconos de plantas usan la caja botánica, no un rectángulo genérico', () => {
  const app = loadApp();
  const seen = [];
  const orig = app.context.Garden.elements;
  app.context.Garden.elements = (tool, p1, p2, opts) => {
    if (tool === TOOLS.GARDEN_TREE) seen.push({ p1: { ...p1 }, p2: { ...p2 }, opts });
    return orig(tool, p1, p2, opts);
  };
  app.selectTool('arbol');
  app.context.Garden.elements = orig;

  const icons = seen.filter(c => c.opts.labels === false && c.p1.x === 0 && c.p1.y === 0);
  assert.ok(icons.length >= app.context.TREE_TYPES.length,
    'debe generar al menos un icono por especie del catálogo');

  // Cada especie tiene su icono, y su caja lleva la PROPORCIÓN botánica —no la
  // 100 × 84 genérica del resto de catálogos—: es lo que mantiene el ciprés
  // fastigiado. Se amplía a un lado mayor fijo porque en píxeles reales una
  // especie de 0,25 m cabía en 5 px, y ahí todo el detalle se iguala a su
  // mínimo, se solapa y el icono sale convertido en un borrón.
  for (const spec of app.context.TREE_TYPES) {
    const alto = spec.depthM || spec.spreadM;   // el catálogo se abre en planta
    const ratio = spec.spreadM / alto;
    const icon = icons.find(c => c.opts.treeType === spec.id &&
      c.opts.plantView === 'plan' &&
      Math.abs(Math.max(c.p2.x, c.p2.y) - 64) < 1e-6 &&
      Math.abs(c.p2.x / c.p2.y - ratio) < 1e-6);
    assert.ok(icon, `el icono de ${spec.name} no usa su caja botánica ampliada`);
  }
});

/* ── Balcón: catálogo genérico, con la geometría real como icono ── */

test('el catálogo de Balcón se llena desde BALCONY_TYPES y elegir un tipo lo aplica', () => {
  const app = loadApp();
  app.selectTool('balcon');
  const btns = app.$('balcony-catalog').querySelectorAll('.modal__balcony');
  assert.equal(btns.length, 8, 'un botón por entrada de BALCONY_TYPES');
  // El icono es la geometría real (un <canvas> pintado), no un SVG a mano: así
  // no puede desincronizarse de lo que sale al arrastrar.
  assert.ok([...btns].every(b => b.querySelector('canvas')),
    'cada botón lleva su icono dibujado con la geometría de la herramienta');

  // El listener vive en el <dialog> (delegación), así que el click se dispara
  // allí con el botón como target, igual que hace el navegador al burbujear.
  const forja = [...btns].find(b => b.dataset.balcony === 'iron');
  app.$('modal-balcony').__fire('click', { target: forja });
  app.flush();
  app.drag(100, 100, 260, 180);

  const els = app.elements();
  assert.ok(els.length > 4, 'el balcón se dibuja con varias piezas');
  assert.ok(els.every(e => e.buildingGroupId === els[0].buildingGroupId),
    'todas las piezas nacen en el mismo grupo');
  assert.ok(els.some(e => e.type === 'curveArrow' && e.arc === true),
    'la forja trae los barrotes abombados elegidos en el catálogo');
});

// El balcón es una herramienta de creación como el resto de Edificios: su tipo
// tiene que sobrevivir a la recarga o media sección se recuerda y media no.
test('el tipo de balcón elegido persiste en prefs y vuelve al arrancar', () => {
  const app = loadApp();
  app.selectTool('balcon');
  const mirador = [...app.$('balcony-catalog').querySelectorAll('.modal__balcony')]
    .find(b => b.dataset.balcony === 'mirador');
  app.$('modal-balcony').__fire('click', { target: mirador });
  app.flush();

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.balconyType, 'mirador');

  const again = loadApp({ prefs });
  again.selectTool('balcon');
  const marcado = [...again.$('balcony-catalog').querySelectorAll('.modal__balcony')]
    .filter(b => b.getAttribute('aria-pressed') === 'true');
  assert.equal(marcado.length, 1, 'solo una variante activa');
  assert.equal(marcado[0].dataset.balcony, 'mirador', 'vuelve marcada la elegida');
});

test('los tipos elegidos en el modal de Fachada persisten en prefs', () => {
  const app = loadApp();
  const win = app.$('facade-window-type');
  win.value = 'grid';
  win.__fire('change', { target: win });
  app.flush();
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.windowType, 'grid');

  // Y se recuperan al arrancar de nuevo con esas prefs
  const again = loadApp({ prefs });
  assert.equal(again.$('facade-window-type').value, 'grid');
});

/* ── Regresión: el atajo de herramienta no debe filtrarse al modal ── */

// Sin preventDefault, la tecla sigue viva y la recibe el control que el
// <dialog> enfoca: pulsar "1" (Fachada) acababa fijando Plantas=1 por el
// type-ahead del <select>. Detectado probando la app en un navegador real.
test('el atajo de herramienta cancela la tecla (no llega al modal que abre)', () => {
  const app = loadApp();
  const ev = app.key('1');
  assert.equal(ev.defaultPrevented, true,
    'la tecla debe cancelarse para que no la consuma ningún control del modal');
  assert.equal(app.$('facade-floors').value, 'auto', 'Plantas no debe cambiar sola');
});

test('el modal de Fachada enfoca la vista activa, no el primer <select>', () => {
  const app = loadApp();
  app.key('1');
  const active = app.$('facade-catalog').querySelectorAll('.modal__facade')
    .find(b => b.classList.contains('modal__shape--active'));
  assert.ok(active, 'hay una vista activa');
  assert.equal(active.autofocus, true,
    'la vista activa lleva autofocus: es la acción principal y evita que un ' +
    'select quede a tiro de una pulsación suelta');
});

/* ── Regresión: el borrador elimina de verdad, no enmascara ── */

test('el borrador elimina los elementos y no deja ninguna máscara en la escena', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.drag(400, 100, 500, 200);
  app.selectTool('eraser');
  app.drag(90, 150, 210, 150);          // pasada sobre el primero

  const els = app.elements();
  assert.equal(els.filter(e => e.type === 'eraser').length, 0,
    'el borrador no debe añadir ningún elemento a la escena');
  // Desde la v2.33.0 el contorno se RECORTA: del primer rectángulo quedan las
  // tiras de contorno que la pasada no ha tocado, ya como trazo a mano alzada.
  assert.equal(els.filter(e => e.type === 'rect').length, 1,
    'el rect barrido deja de ser un rect');
  assert.equal(els.find(e => e.type === 'rect').x, 400, 'el rect lejano sobrevive');
  const tiras = els.filter(e => e.type === 'pencil');
  assert.ok(tiras.length >= 1, 'y lo que no se barrió sigue dibujado');
  assert.ok(tiras.every(p => p.points.every(pt => pt.x < 260)),
    'ninguna tira invade la zona del rect lejano');
});

/* ── Regresión: recta/flecha/trazo se recortan, no se borran enteros ── */

test('un mordisco en el medio de una recta deja dos trozos, no la borra entera', () => {
  const app = loadApp();
  app.selectTool('line');
  app.drag(100, 300, 300, 300);
  app.selectTool('eraser');
  app.drag(190, 300, 210, 300);           // mordisco en el centro de la recta
  const els = app.elements();
  assert.equal(els.length, 2, 'sobreviven los dos trozos de la recta');
  assert.ok(els.every(e => e.type === 'line'), 'ninguno se convierte en otra cosa');
  assert.ok(els.every(e => Math.abs(e.x1 - e.x2) < 90),
    'ambos trozos son más cortos que la recta original: algo se recortó');
});

test('borrar la intersección de dos trazos los parte a los dos, no los borra enteros', () => {
  const app = loadApp();
  app.selectTool('pencil');
  app.drag(100, 300, 300, 300);           // trazo horizontal
  app.drag(200, 200, 200, 400);           // trazo vertical: cruza al horizontal en (200,300)
  app.selectTool('eraser');
  app.drag(190, 300, 210, 300);           // mordisco justo en el cruce
  const els = app.elements();
  assert.equal(els.length, 4, 'cada trazo sobrevive partido en dos, ninguno desaparece entero');
  assert.ok(els.every(e => e.type === 'pencil'));
});

test('elegir el borrador abre su modal de tamaño, como Planta o Balcón abren el suyo', () => {
  const app = loadApp();
  app.selectTool('rect');
  assert.equal(app.$('modal-eraser').open, false);
  app.selectTool('eraser');
  assert.equal(app.$('modal-eraser').open, true,
    'se abre solo al elegir la herramienta, sin tener que encontrar el botón ⚙ del panel');
  // Cerrarlo no debe devolver a la herramienta anterior: a diferencia de
  // Planta/Balcón, el borrador ya es usable sin elegir nada en el modal.
  app.$('modal-eraser').close();
  app.flush();
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, 'eraser',
    'cerrar el modal se queda en el borrador, no cae a la herramienta previa');
});

test('el modal de tamaño del borrador se sincroniza con el panel y su ajuste se recuerda', () => {
  const app = loadApp();
  // Desde la v2.21.0 «Trazo» no tiene ⚙ (era el botón camaleón): se reabre
  // volviendo a pulsar la herramienta, que es la vía primaria y la única que
  // funciona también con el panel cerrado o convertido en cajón.
  app.selectTool('eraser');
  app.$('modal-eraser').close();   // se abrió solo al elegir la herramienta; lo cerramos para reabrirlo
  app.flush();

  app.selectTool('eraser');
  assert.equal(app.$('modal-eraser').open, true,
    'volver a pulsar el Borrador lo reabre, sin salir de la herramienta');

  const modalSlider = app.$('eraser-size-modal-slider');
  modalSlider.value = '50';
  modalSlider.__fire('input', { target: modalSlider });
  modalSlider.__fire('change', { target: modalSlider });
  app.flush();

  // El mando del panel se retiró en la v2.21.0: el tamaño vive solo aquí.
  assert.equal(app.$('eraser-size-modal-val').textContent, '50');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.eraserSize, 50);

  const app2 = loadApp({ prefs });
  app2.selectTool('eraser');
  assert.equal(app2.$('eraser-size-modal-slider').value, '50', 'y vuelve puesto al arrancar de nuevo');
});

/* ── Panel: secciones contextuales y ajustes de trazo ── */

// El panel era una lista plana: dibujando con el lápiz seguían delante
// «Plantas», «Cubierta del alzado» o «Ancho del camino», que solo sirven para
// Fachada y para Camino. Ahora cada sección aparece con su herramienta.
test('el panel solo enseña las secciones de la herramienta activa', () => {
  const app = loadApp();
  const shown = id => !app.$(id).hidden;

  app.selectTool('rect');
  assert.equal(shown('panel-sec-build'), false, 'Edificios no pinta nada dibujando un rectángulo');
  assert.equal(shown('panel-sec-garden'), false, 'ni Jardín');
  assert.equal(shown('panel-sec-text'), false, 'ni Texto');
  assert.equal(shown('panel-sec-fill'), true, 'Relleno sí: el rectángulo se puede rellenar');
  assert.equal(shown('panel-sec-canvas'), true, 'Lienzo y Selección están siempre');
  assert.equal(shown('panel-sec-selection'), true);

  app.selectTool('fachada');
  assert.equal(shown('panel-sec-build'), true, 'Edificios aparece con una herramienta de Edificios');
  assert.equal(shown('panel-sec-garden'), false);

  app.selectTool('arbol');
  assert.equal(shown('panel-sec-garden'), true, 'y Jardín con una del Jardín');
  assert.equal(shown('panel-sec-build'), false);

  app.selectTool('text');
  assert.equal(shown('panel-sec-text'), true, 'el tamaño de texto, con la herramienta Texto');

  app.selectTool('line');
  assert.equal(app.$('row-dash').hidden, false, 'el discontinuo aplica a la línea');
  assert.equal(app.$('row-double-head').hidden, true, 'pero la línea no lleva puntas');
  app.selectTool('arrow');
  assert.equal(app.$('row-double-head').hidden, false, 'la flecha sí');
});

// El punto delicado de ocultar por herramienta: los controles de relleno, trazo
// y texto tienen semántica dual, así que con algo seleccionado tienen que estar
// aunque la herramienta activa no los use. Si esto falla, seleccionar una forma
// deja de permitir editarla, que es peor que el panel largo original.
test('las secciones reaparecen con la selección, no solo con la herramienta', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(120, 120, 260, 240);
  app.selectTool('pencil');
  assert.equal(app.$('panel-sec-fill').hidden, true, 'con el lápiz y sin selección, Relleno se va');

  app.selectTool('select');
  app.click(190, 180);
  assert.equal(app.elements().length, 1);
  assert.equal(app.$('panel-sec-fill').hidden, false,
    'pero con el rectángulo seleccionado vuelve, o no habría forma de rellenarlo');
  assert.equal(app.$('check-fill').checked, false, 'y muestra el valor del elemento');
});

// Elegir una herramienta de dibujo abre sus ajustes, igual que el Borrador abre
// el suyo o Planta su catálogo: la vía a un ajuste tiene que salir de la propia
// herramienta, no solo del panel (que además es un cajón oculto bajo 1100px).
test('elegir una herramienta de dibujo abre sus ajustes de trazo', () => {
  const app = loadApp();
  for (const tool of ['pencil', 'line', 'arrow', 'curveArrow', 'arc']) {
    app.selectTool('select');          // la única sin modal, para partir de cero
    app.$('modal-stroke').close();
    app.selectTool(tool);
    assert.equal(app.$('modal-stroke').open, true, `${tool} debe abrir sus ajustes`);
    // Cerrar deja la herramienta puesta: no hay nada que elegir, como en el
    // Borrador. Si volviera a la anterior no se podría dibujar.
    app.$('modal-stroke').close();
    app.flush();
    assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, tool,
      `cerrar los ajustes de ${tool} no puede cambiar de herramienta`);
  }
});

// Las diez de Formas abren su propio modal, que además de trazo lleva el
// relleno entero: es la sección del panel que solo les sirve a ellas.
test('elegir una forma abre sus ajustes, con trazo y relleno', () => {
  const app = loadApp();
  const shapes = ['rect', 'roundedRect', 'circle', 'square',
    'trapezoid', 'triangle', 'pentagon', 'hexagon', 'star5', 'star6'];
  for (const tool of shapes) {
    app.selectTool('select');
    app.$('modal-shape').close();
    app.selectTool(tool);
    assert.equal(app.$('modal-shape').open, true, `${tool} debe abrir sus ajustes`);
    app.$('modal-shape').close();
    app.flush();
    assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, tool,
      `cerrar los ajustes de ${tool} no puede cambiar de herramienta`);
  }

  // Los seis campos son gemelos de los del panel, en los dos sentidos.
  app.selectTool('rect');
  const fill = app.$('shape-modal-fill');
  fill.checked = true; fill.__fire('change', { target: fill });
  app.flush();
  assert.equal(app.$('check-fill').checked, true, 'el relleno viaja al panel');

  const transp = app.$('shape-modal-fill-transparent');
  transp.checked = true; transp.__fire('change', { target: transp });
  app.flush();
  assert.equal(app.$('check-fill-transparent').checked, true);
  assert.equal(app.$('fill-opacity-slider').disabled, false,
    'y la opacidad se habilita en los dos, como en el panel');

  const op = app.$('shape-modal-opacity');
  op.value = '70'; op.__fire('input', { target: op });
  app.flush();
  assert.equal(app.$('fill-opacity-val').textContent, '70');

  const panelOp = app.$('fill-opacity-slider');
  panelOp.value = '25'; panelOp.__fire('input', { target: panelOp });
  app.flush();
  assert.equal(app.$('shape-modal-opacity-val').textContent, '25', 'y al revés');

  const w = app.$('shape-modal-slider');
  w.value = '5'; w.__fire('input', { target: w });
  app.flush();
  assert.equal(app.$('stroke-modal-slider').value, '5',
    'el grosor también es el mismo en los demás gemelos');

  // Y lo dibujado sale con esos ajustes.
  app.$('modal-shape').close();
  app.flush();
  app.drag(120, 120, 240, 240);
  const el = app.elements()[0];
  assert.equal(el.fill, true);
  assert.equal(el.fillTransparent, true);
  assert.equal(el.fillOpacity, 0.25);
  assert.equal(el.lineWidth, 5);
});

/* ── Editar lo ya dibujado: color, posición, tamaño y texto ── */

// Los componentes de UI se movían y se redimensionaban arrastrando, pero su
// color no se podía cambiar (el picker era el ÚNICO control de aspecto sin
// semántica dual), no había forma de dar una medida exacta y su rótulo solo se
// tocaba con doble clic sobre el dibujo. Vale para todos los tipos, no solo UI.
test('un elemento ya dibujado se puede recolorear, medir y rotular desde el panel', () => {
  for (const tool of ['button', 'input', 'nav', 'card', 'imagePlaceholder']) {
    const app = loadApp();
    app.selectTool(tool);
    app.drag(200, 200, 340, 250);
    const el0 = app.elements()[0];
    assert.equal(el0.type, tool);

    app.selectTool('select');
    app.click(el0.x + el0.w / 2, el0.y + el0.h / 2);
    assert.equal(app.$('panel-sec-element').hidden, false,
      'con algo seleccionado aparece «Posición y tamaño»');

    // Color: el picker recolorea la selección, y todo el gesto es UN undo.
    const before = app.elements();
    const picker = app.$('color-picker');
    picker.value = '#ff0000';
    picker.__fire('input', { target: picker });
    picker.__fire('change', { target: picker });
    app.flush();
    assert.equal(app.elements()[0].color, '#ff0000', `${tool} debe poder recolorearse`);
    app.key('z', { ctrlKey: true });
    assert.deepEqual(app.elements(), before, 'y deshacerse de una vez');

    // Deshacer vacía la selección: hay que volver a coger el elemento.
    app.click(el0.x + el0.w / 2, el0.y + el0.h / 2);

    // Posición y tamaño exactos.
    const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
    set('el-x', 60); set('el-y', 80); set('el-w', 300); set('el-h', 120);
    app.flush();
    const box = app.elements()[0];
    assert.equal(Math.round(box.x), 60, `${tool}: X exacta`);
    assert.equal(Math.round(box.y), 80, `${tool}: Y exacta`);
    assert.equal(Math.round(box.w), 300, `${tool}: ancho exacto`);
    assert.equal(Math.round(box.h), 120, `${tool}: alto exacto`);
    // Y los campos reflejan lo que hay, no lo último tecleado.
    assert.equal(app.$('el-w').value, '300');
  }
});

// Las estrellas no traen ni una rama propia en app.js: entran en
// REGULAR_POLYGON_TYPES y de ahí heredan nacer desde el CENTRO, la caja
// cuadrada y el hit-test por silueta. Esta guarda comprueba justo eso a través
// de gestos reales, que es donde se vería un olvido en cualquiera de las
// listas por las que pasa el tipo.
test('las estrellas se arrastran desde el centro y se seleccionan por su silueta', () => {
  const app = loadApp();
  for (const tool of ['star5', 'star6']) {
    app.selectTool(tool);
    app.$('modal-shape').close();
    // Arrastre centro → borde: el radio es la distancia, no la diagonal.
    app.drag(300, 300, 300, 380);
    const star = app.elements().at(-1);
    assert.equal(star.type, tool);
    assert.equal(Math.round(star.w), 160, `${tool}: el arrastre es el radio`);
    assert.equal(star.w, star.h, `${tool}: caja cuadrada, como todo polígono regular`);
    assert.equal(Math.round(star.x + star.w / 2), 300, `${tool}: centrada en el origen`);
    assert.ok(Exporter.isValidElement(star), `${tool}: sobrevive al round-trip JSON`);

    // El clic selecciona por la silueta real, no por el bbox: el hueco entre
    // dos puntas (media altura, pegado al borde de la caja) no la coge.
    app.selectTool('select');
    app.click(224, 300);
    app.key('Delete');
    app.flush();
    assert.equal(app.elements().length, 1,
      `${tool}: el hueco entre puntas no la selecciona`);
    app.click(300, 300);
    app.key('Delete');
    app.flush();
    assert.equal(app.elements().length, 0, `${tool}: el centro sí la selecciona`);
  }
});

// Escribir una medida no puede permitir lo que arrastrar un tirador prohíbe:
// un polígono regular deformado no pasa isValidElement, así que el proyecto
// dejaría de poder reimportarse; y un grupo escala en proporción o rompe esa
// misma invariante en las piezas que lleva dentro.
test('la caja escrita respeta las invariantes: polígono cuadrado y grupo proporcional', () => {
  const app = loadApp();
  app.selectTool('pentagon');
  app.$('modal-shape').close();
  app.drag(150, 150, 250, 250);
  app.selectTool('select');
  app.click(200, 200);

  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('el-w', 240);
  app.flush();
  const pent = app.elements()[0];
  assert.equal(Math.round(pent.w), 240);
  assert.equal(Math.round(pent.h), 240, 'el alto sigue al ancho: w === h');
  assert.ok(Exporter.isValidElement(pent), 'y sigue siendo importable');
  assert.equal(app.$('el-h').value, '240', 'el campo enseña el valor real, no el tecleado');

  // Grupo: un edificio son muchas piezas y escala en proporción.
  const app2 = loadApp();
  app2.selectTool('fachada');
  app2.pickVariant('facade-catalog', 'modal__facade', 'flat', 'facade');
  app2.drag(200, 200, 400, 360);
  app2.selectTool('select');
  app2.click(300, 280);
  assert.ok(app2.elements().length > 2, 'la fachada es un grupo');
  const box = app2.$('el-w').value;
  const alto = app2.$('el-h').value;
  const set2 = (id, v) => { app2.$(id).value = String(v); app2.$(id).__fire('change', { target: app2.$(id) }); };
  set2('el-w', Number(box) * 2);
  app2.flush();
  const ratioAntes = Number(box) / Number(alto);
  const ratioDespues = Number(app2.$('el-w').value) / Number(app2.$('el-h').value);
  assert.ok(Math.abs(ratioAntes - ratioDespues) < 0.02,
    'el grupo conserva la proporción al escribir un ancho');
  app2.elements().forEach(el => assert.ok(Exporter.isValidElement({ ...el, seed: 1 }),
    'ninguna pieza del grupo queda inválida'));
});

// Escalar una mancha de aerógrafo escalaba también su boquilla SIN acotarla al
// rango [R_MIN, R_MAX] que isValidElement exige — y como restoreAutosave e
// importJSON filtran con esa misma validación, agrandarla ×2,5 la volvía
// inválida y la mancha DESAPARECÍA en la siguiente recarga, sin ningún aviso
// (auditoría v2.30.0). El clamp vive en scaleElement, el único camino por el
// que pasan los tiradores, el campo «Ancho» y el resize de grupo.
test('escalar un aerógrafo mantiene la boquilla en rango y la mancha sobrevive a la recarga', () => {
  const app = loadApp();
  app.selectTool('airbrush');
  app.$('modal-airbrush').close();
  app.drag(100, 100, 300, 150);
  app.selectTool('select');
  app.click(200, 125);
  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };

  set('el-w', 900);                        // ×~3,7: sin clamp, radius 24 → ~87
  app.flush();
  const grande = app.elements()[0];
  assert.ok(grande.radius <= Airbrush.R_MAX,
    `agrandar acota la boquilla a R_MAX (salió ${grande.radius})`);
  assert.ok(Exporter.isValidElement(grande), 'la mancha agrandada sigue siendo válida');

  set('el-w', 30);                         // y a la baja: sin clamp, radius < 4
  app.flush();
  const chica = app.elements()[0];
  assert.ok(chica.radius >= Airbrush.R_MIN,
    `encoger acota la boquilla a R_MIN (salió ${chica.radius})`);
  assert.ok(Exporter.isValidElement(chica), 'la mancha encogida sigue siendo válida');

  // La prueba de fuego es la recarga: el autosave se filtra con isValidElement.
  const app2 = loadApp({ autosave: [grande, chica].map(el => ({ ...el })) });
  assert.equal(app2.elements().length, 2,
    'las manchas escaladas sobreviven a recargar la página');
});

test('el texto de un componente y de un texto se edita desde el panel', () => {
  const app = loadApp();
  app.selectTool('button');
  app.drag(200, 200, 340, 250);
  app.selectTool('select');
  app.click(270, 225);
  assert.equal(app.$('el-label-row').hidden, false, 'un botón tiene rótulo');
  const lab = app.$('el-label');
  lab.value = 'Enviar'; lab.__fire('change', { target: lab });
  app.flush();
  assert.equal(app.elements()[0].label, 'Enviar');
  app.key('z', { ctrlKey: true });
  assert.notEqual(app.elements()[0].label, 'Enviar', 'y se deshace');

  // La imagen no lleva rótulo: la fila no debe ofrecerse.
  const app2 = loadApp();
  app2.selectTool('imagePlaceholder');
  app2.drag(200, 200, 340, 250);
  app2.selectTool('select');
  app2.click(270, 225);
  assert.equal(app2.$('el-label-row').hidden, true,
    'el marcador de imagen no tiene texto que editar');
});

/* ── v2.10.0: pulsar la herramienta del elemento seleccionado lo edita ── */

// Antes, selectTool vaciaba la selección SIEMPRE, así que el modal de ajustes
// solo servía para los defaults de creación. Ahora, si lo seleccionado es del
// tipo que ese modal sabe editar, la selección se conserva y el modal abre
// editándolo — la semántica dual hace el resto, posición incluida.
test('pulsar la herramienta de un elemento seleccionado lo edita en su modal, posición incluida', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(150, 150, 270, 230);
  app.selectTool('select');
  app.click(210, 190);
  assert.equal(app.$('panel-sec-element').hidden, false, 'el clic seleccionó el rectángulo');

  app.selectTool('rect');
  assert.equal(app.$('modal-shape').open, true, 'vuelve a abrir sus ajustes');
  assert.equal(app.$('panel-sec-element').hidden, false, 'sin perder la selección');
  assert.equal(app.$('shape-modal-geo').hidden, false, 'y el modal enseña su posición');
  assert.equal(app.$('shape-modal-x').value, String(Math.round(app.elements()[0].x)));

  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('shape-modal-x', 60); set('shape-modal-w', 300);
  app.flush();
  const el = app.elements()[0];
  assert.equal(Math.round(el.x), 60, 'la X escrita en el modal mueve el elemento');
  assert.equal(Math.round(el.w), 300, 'y el ancho lo escala');
  assert.equal(app.$('el-w').value, '300', 'el campo del panel refleja lo mismo: es el mismo cuerpo');

  // La regla es por tipo exacto: con un rect seleccionado, otra herramienta
  // deselecciona como siempre.
  app.selectTool('circle');
  assert.equal(app.$('panel-sec-element').hidden, true, 'círculo ≠ rect: deselecciona');
});

// La caja escrita en el modal respeta las mismas invariantes que la del panel
// (es literalmente el mismo applyGeometry, parametrizado por prefijo): un
// polígono regular deformado no pasa isValidElement y el proyecto no reabriría.
test('la caja escrita en el modal respeta las invariantes del polígono', () => {
  const app = loadApp();
  app.selectTool('pentagon');
  app.$('modal-shape').close();
  app.drag(150, 150, 250, 250);
  app.selectTool('select');
  app.click(200, 200);
  app.selectTool('pentagon');        // conserva la selección y reabre el modal
  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('shape-modal-w', 240);
  app.flush();
  const pent = app.elements()[0];
  assert.equal(Math.round(pent.w), 240);
  assert.equal(Math.round(pent.h), 240, 'w === h también escribiendo en el modal');
  assert.ok(Exporter.isValidElement(pent), 'y sigue siendo importable');
});

test('empezar a dibujar suelta la selección conservada', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(100, 100, 180, 160);
  app.selectTool('select');
  app.click(140, 130);
  app.selectTool('rect');            // conserva la selección para editar
  app.$('modal-shape').close();
  assert.equal(app.$('panel-sec-element').hidden, false);

  app.drag(300, 300, 380, 360);      // …pero el siguiente trazo es crear
  assert.equal(app.elements().length, 2, 'el arrastre crea otro rectángulo, no mueve el primero');
  assert.equal(Math.round(app.elements()[0].x), 100, 'el primero no se ha movido');
  assert.equal(app.$('panel-sec-element').hidden, true,
    'y la selección se soltó al empezar el trazo');
});

/* ── v2.10.0: ajustes propios de los componentes UI, el texto y el emoji ── */

test('el modal de UI fija el rótulo de creación y edita el del seleccionado', () => {
  const app = loadApp();
  app.selectTool('button');
  assert.equal(app.$('modal-ui').open, true, 'Botón abre sus ajustes al elegirlo');
  assert.equal(app.$('modal-ui-title').textContent, 'Ajustes de Botón');

  // Sin selección, el rótulo escrito es el default de creación…
  const lab = app.$('ui-modal-label');
  lab.value = 'Enviar'; lab.__fire('change', { target: lab });
  app.flush();
  app.drag(200, 200, 340, 250);
  app.drag(200, 300, 340, 350);
  assert.equal(app.elements()[0].label, 'Enviar', 'el primer botón nace rotulado');
  assert.equal(app.elements()[1].label, 'Enviar', 'y el segundo igual');
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.uiLabels.button, 'Enviar', 'el default se recuerda entre sesiones');

  // …y con un botón seleccionado, el mismo campo edita ESE botón.
  app.selectTool('select');
  app.click(270, 225);
  app.selectTool('button');          // conserva la selección y reabre el modal
  assert.equal(app.$('ui-modal-label').value, 'Enviar', 'enseña el rótulo del elemento');
  lab.value = 'Comprar'; lab.__fire('change', { target: lab });
  app.flush();
  assert.equal(app.elements()[0].label, 'Comprar', 'edita el seleccionado');
  assert.equal(app.elements()[1].label, 'Enviar', 'sin tocar al otro');
  const prefs2 = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs2.uiLabels.button, 'Enviar', 'ni el default de creación');

  // Imagen no tiene rótulo (su renderer no lo recibe): la fila se oculta,
  // igual que hace el panel con #el-label-row.
  const app2 = loadApp();
  app2.selectTool('imagePlaceholder');
  assert.equal(app2.$('modal-ui-title').textContent, 'Ajustes de Imagen');
  assert.equal(app2.$('ui-modal-label-row').hidden, true);
});

test('Texto abre su modal y el tamaño de letra tiene semántica dual', () => {
  const app = loadApp();
  app.selectTool('text');
  assert.equal(app.$('modal-text').open, true, 'Texto abre sus ajustes al elegirlo');
  assert.equal(app.$('btn-text-settings').hidden, false, 'y el ⚙ de «Texto» queda para reabrirlos');

  // Sin selección, cualquiera de los dos gemelos fija el default de creación.
  const modalSize = app.$('text-modal-size');
  modalSize.value = '30';
  modalSize.__fire('input', { target: modalSize });
  modalSize.__fire('change', { target: modalSize });
  app.flush();
  assert.equal(app.$('font-val').textContent, '30', 'el gemelo del panel sigue al del modal');
  app.$('modal-text').close();

  app.click(200, 200);
  const input = app.$('text-input');
  input.value = 'Hola';
  input.__fire('blur', { target: input });
  app.flush();
  assert.equal(app.elements()[0].fontSize, 30, 'el texto nace con el tamaño elegido');

  // Con el texto seleccionado, el mismo deslizador edita ESE texto…
  app.selectTool('select');
  app.click(210, 215);
  assert.equal(app.$('panel-sec-element').hidden, false, 'el clic seleccionó el texto');
  const panelSize = app.$('font-slider');
  panelSize.value = '40';
  panelSize.__fire('input', { target: panelSize });
  panelSize.__fire('change', { target: panelSize });
  app.flush();
  assert.equal(app.elements()[0].fontSize, 40, 'el deslizador edita el texto seleccionado');
  // …y todo el gesto es UN paso de undo que lo devuelve a como estaba.
  app.key('z', { ctrlKey: true });
  assert.equal(app.elements()[0].fontSize, 30, 'un gesto, un undo');
});

test('el emoji se estampa con el tamaño elegido en su catálogo', () => {
  const app = loadApp();
  app.selectTool('emoji');
  assert.equal(app.$('modal-emoji').open, true);
  const size = app.$('emoji-modal-size');
  assert.equal(size.value, '32', 'arranca en el mínimo, el tamaño de icono');
  size.value = '64';
  size.__fire('input', { target: size });
  size.__fire('change', { target: size });
  app.$('modal-emoji').close();
  app.flush();

  app.click(300, 300);
  const emoji = app.elements()[0];
  assert.equal(emoji.type, 'text', 'el emoji es un text corriente');
  assert.equal(emoji.fontSize, 64, 'estampado al tamaño del deslizador');

  // Con Emoji activo, la sección «Texto» del panel se retitula y gobierna el
  // tamaño del EMOJI (retargeteo estilo borrador): enseña 64 bajo «Emoji»…
  assert.equal(app.$('font-label').textContent, 'Emoji');
  assert.equal(app.$('font-val').textContent, '64');
  // …sin haber tocado el tamaño de letra: al volver a Texto, sigue en 18.
  app.selectTool('text');
  app.$('modal-text').close();
  app.flush();
  assert.equal(app.$('font-label').textContent, 'Texto');
  assert.equal(app.$('font-val').textContent, '18',
    'el tamaño de letra del texto no se ha movido');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.emojiSize, 64, 'y se recuerda entre sesiones');
});

/* ── Auditoría v2.10.1: guardas de los defectos corregidos ── */

// Los campos de medida ENSEÑAN valores redondeados: comparar lo tecleado
// contra la caja exacta hacía «cambiado» a todo campo fraccionario, y como el
// ancho se evalúa primero, el alto que acababas de teclear PERDÍA contra un
// ancho que nadie había tocado. Cualquier arrastre diagonal de un polígono da
// caja fraccionaria (y con el auto-zoom del navegador, casi todo lo demás).
test('el lado tecleado manda aunque la caja sea fraccionaria', () => {
  const app = loadApp();
  app.selectTool('pentagon');
  app.$('modal-shape').close();
  app.drag(300, 300, 330, 341);          // radio diagonal → caja fraccionaria
  const p0 = app.elements()[0];
  assert.ok(p0.w !== Math.round(p0.w), 'la caja de partida es fraccionaria (premisa)');
  app.selectTool('select');
  app.click(p0.x + p0.w / 2, p0.y + p0.h / 2);
  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('el-h', 200);
  app.flush();
  const p = app.elements()[0];
  assert.equal(Math.round(p.h), 200, 'el alto tecleado no pierde contra el ancho sin tocar');
  assert.equal(p.w, p.h, 'y el polígono sigue cuadrado');
});

// Un <input type=number> vaciado (o con basura) da value '' y Number('') es 0:
// vaciar «Ancho» colapsaba el elemento a 1px y vaciar «X» lo mandaba a 0.
test('vaciar un campo de medida no colapsa el elemento', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(100, 100, 300, 200);
  app.selectTool('select');
  app.click(200, 150);
  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('el-w', '');
  set('el-x', '');
  app.flush();
  const el = app.elements()[0];
  assert.equal(Math.round(el.w), 200, 'el ancho no se colapsa a 1px');
  assert.equal(Math.round(el.x), 100, 'la X no salta a 0');
  assert.equal(app.$('el-w').value, '200', 'y el campo vuelve a decir la verdad');
});

// selectionGroupBounds exige buildingGroupId: con dos elementos SUELTOS los
// campos enseñaban valores rancios y teclear no hacía nada, cuando el panel
// promete la caja combinada de cualquier selección.
test('la caja escrita también funciona con una multi-selección libre, en proporción', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(100, 100, 180, 160);
  app.drag(300, 300, 380, 360);
  app.selectTool('select');
  app.drag(50, 50, 500, 450);            // marquesina sobre ambos
  assert.equal(app.$('el-w').value, '280', 'los campos enseñan la caja combinada');

  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('el-w', 560);                       // el doble → escala uniforme ×2
  app.flush();
  const [a, b] = app.elements();
  assert.equal(Math.round(a.w), 160, 'la primera pieza escala');
  assert.equal(Math.round(b.w), 160, 'la segunda también');
  assert.equal(Math.round(b.h), 120, 'en proporción');
  assert.equal(Math.round(b.x), 500, 'y las posiciones relativas escalan con la caja');
});

// Teclear una medida que la geometría no puede absorber (el alto de una línea
// horizontal: scaleElement fuerza sy=1 con from.h = 0) apilaba un paso de
// deshacer fantasma y el campo se quedaba prometiendo un alto inexistente.
test('una medida que la geometría no absorbe ni apila undo ni miente', () => {
  const app = loadApp();
  app.selectTool('line');
  app.$('modal-stroke').close();
  app.drag(100, 100, 300, 100);          // línea horizontal: alto 0
  app.selectTool('select');
  app.click(200, 100);
  assert.equal(app.$('panel-sec-element').hidden, false, 'la línea está seleccionada');
  const set = (id, v) => { app.$(id).value = String(v); app.$(id).__fire('change', { target: app.$(id) }); };
  set('el-h', 50);
  app.flush();
  assert.equal(app.$('el-h').value, '0', 'el campo vuelve al alto real, no al prometido');
  app.key('z', { ctrlKey: true });
  assert.equal(app.elements().length, 0,
    'UN solo deshacer quita la línea: no había paso fantasma por medio');
});

// En navegador, clicar otro elemento dispara PRIMERO el mousedown (que cambia
// la selección) y DESPUÉS el blur→change del campo: el ancho tecleado para A
// se aplicaba al B recién seleccionado. Se reproduce el orden real disparando
// el clic sin drenar el rAF que resincroniza.
test('un change rezagado no aplica la medida a la selección recién cambiada', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(100, 100, 200, 160);
  app.drag(300, 300, 400, 360);
  app.selectTool('select');
  app.click(150, 130);                    // selecciona A
  app.$('el-w').value = '500';            // teclea… sin confirmar todavía
  const cv = app.$('main-canvas');
  cv.__fire('pointerdown', { clientX: 350, clientY: 330, pointerId: 1, button: 0 });
  cv.__fire('pointerup', { clientX: 350, clientY: 330, pointerId: 1, button: 0 });
  app.$('el-w').__fire('change', { target: app.$('el-w') });   // el blur rezagado
  app.flush();
  const [a, b] = app.elements();
  assert.equal(Math.round(a.w), 100, 'A conserva su ancho');
  assert.equal(Math.round(b.w), 100, 'y B no hereda el 500 tecleado para A');
});

// applyLabel era la única fuga de la semántica dual: con una multi-selección
// delante, escribir el rótulo cambiaba EN SILENCIO el default de creación. Y
// la fila se ofrecía aunque editar no hiciera nada.
test('con multi-selección el rótulo ni edita el default ni se ofrece', () => {
  const app = loadApp();
  app.selectTool('button');
  const lab = app.$('ui-modal-label');
  lab.value = 'Enviar'; lab.__fire('change', { target: lab });
  app.flush();
  app.drag(100, 100, 220, 150);
  app.drag(100, 200, 220, 250);
  app.selectTool('select');
  app.click(160, 125);
  app.click(160, 225, { shiftKey: true });
  app.selectTool('button');               // conserva la multi-selección
  assert.equal(app.$('ui-modal-label-row').hidden, true,
    'la fila de rótulo no se ofrece con varias piezas');
  lab.value = 'Hola'; lab.__fire('change', { target: lab });
  app.flush();
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.uiLabels.button, 'Enviar', 'el default de creación no se toca');
  app.elements().forEach(el => assert.equal(el.label, 'Enviar', 'ni los elementos'));

  // Y el default se recorta a 120, el mismo tope que aplica restorePrefs: sin
  // él, un rótulo más largo encogía en silencio al recargar.
  const app2 = loadApp();
  app2.selectTool('button');
  const lab2 = app2.$('ui-modal-label');
  lab2.value = 'x'.repeat(150); lab2.__fire('change', { target: lab2 });
  app2.flush();
  const prefs2 = JSON.parse(app2.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs2.uiLabels.button.length, 120, 'recortado al guardar, no al recargar');
});

// Vaciar el contenido de un `text` desde el panel dejaba un elemento invisible
// de caja cero; el editor de doble clic (commitText) en el mismo caso borra.
// Las dos vías deben decir lo mismo.
test('vaciar el texto desde el panel lo borra, como el editor de doble clic', () => {
  const app = loadApp();
  app.selectTool('text');
  app.$('modal-text').close();
  app.click(200, 200);
  const input = app.$('text-input');
  input.value = 'Hola';
  input.__fire('blur', { target: input });
  app.flush();
  assert.equal(app.elements().length, 1);

  app.selectTool('select');
  app.click(210, 210);
  const lab = app.$('el-label');
  lab.value = ''; lab.__fire('change', { target: lab });
  app.flush();
  assert.equal(app.elements().length, 0, 'el texto vaciado se borra, no queda invisible');
  assert.equal(app.$('panel-sec-element').hidden, true, 'y la selección se suelta');
  app.key('z', { ctrlKey: true });
  assert.equal(app.elements().length, 1, 'con su paso de deshacer');
});

// selectTool ganó `silent` en la 2.10.0 y Emoji no lo honraba: cancelar un
// catálogo viniendo de Emoji reabría su catálogo encima del recién cerrado.
test('cancelar un catálogo viniendo de Emoji no reabre su catálogo', () => {
  const app = loadApp();
  app.selectTool('emoji');
  app.$('modal-emoji').close();
  app.flush();
  app.selectTool('planta');
  app.$('modal-planta').close();          // cancelar, sin elegir huella
  app.flush();
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, 'emoji',
    'cancelar devuelve a Emoji');
  assert.equal(app.$('modal-emoji').open, false,
    'sin encadenar su catálogo encima del que se acaba de cerrar');
});

// El modal de trazo ofrecía «Trazo discontinuo» al lápiz (que lo ignora: el
// case pencil del renderer no tiene dash) y «Doble punta» a un semicírculo
// seleccionado (heads:'none', que nunca la lleva).
test('discontinuo y doble punta se atenúan cuando no aplican', () => {
  const app = loadApp();
  app.selectTool('pencil');
  assert.equal(app.$('stroke-modal-dash').disabled, true,
    'el lápiz no lleva discontinuo: la casilla se atenúa');
  app.$('modal-stroke').close();
  app.selectTool('line');
  assert.equal(app.$('stroke-modal-dash').disabled, false, 'la línea sí');
  assert.equal(app.$('stroke-modal-double').disabled, true, 'pero no lleva punta');
  app.$('modal-stroke').close();

  app.drag(200, 200, 300, 200);           // una línea para poder salir de ella
  app.selectTool('arc');
  app.$('modal-stroke').close();
  app.drag(200, 300, 300, 300);           // semicírculo (curveArrow heads:none)
  app.key('a', { ctrlKey: true });        // Ctrl+A selecciona todo (Mover)
  app.selectTool('select');
  app.click(250, 300, { altKey: true });  // aísla el semicírculo
  const semi = app.elements().find(el => el.heads === 'none');
  assert.ok(semi, 'hay un semicírculo (premisa)');
  app.selectTool('arc');                  // conserva la selección y abre ajustes
  assert.equal(app.$('stroke-modal-double').disabled, true,
    'un semicírculo nunca lleva punta: la casilla se atenúa');
  assert.equal(app.$('stroke-modal-dash').disabled, false,
    'el discontinuo sí se le puede poner');
});

// Con la selección conservada y una herramienta de creación activa, los
// tiradores ya no se dibujan (son de Mover): agarrar la esquina CREA, y el
// lienzo no debe prometer otra cosa.
test('con selección conservada y herramienta de creación, la esquina crea', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.drag(100, 100, 180, 160);
  app.selectTool('select');
  app.click(140, 130);
  app.selectTool('rect');                 // conserva la selección
  app.$('modal-shape').close();
  app.drag(180, 160, 240, 220);           // desde la esquina exacta del rect
  assert.equal(app.elements().length, 2, 'la esquina crea otro rectángulo');
  assert.equal(Math.round(app.elements()[0].w), 80, 'sin escalar el primero');
});

// La muestra del relleno sólido copiaba el color del picker aunque nunca se
// hubiera elegido: la creación real solo escribe fillColor si EXISTE, y sin él
// el relleno es el tinte clásico del trazo. Se pina la fuente compartida.
test('rellenar sin color elegido conserva el tinte clásico (sin fillColor)', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  const fill = app.$('check-fill');
  fill.checked = true; fill.__fire('change', { target: fill });
  app.flush();
  app.drag(100, 100, 200, 160);
  const el = app.elements()[0];
  assert.equal(el.fill, true);
  assert.equal('fillColor' in el, false,
    'sin color elegido no se escribe fillColor: manda el tinte del trazo');
});

// El giro era una acción SOLO sobre lo ya dibujado («Rotar selección», un paso
// por clic): no había forma de decidir la orientación antes de trazar, y llegar
// a 288° en un pentágono costaba ocho pulsaciones. Ahora es un ajuste más de la
// forma, con el paso propio de cada tipo.
test('el giro de la forma se elige antes de dibujar y sale en el elemento', () => {
  const app = loadApp();
  const slider = () => app.$('shape-modal-rotation');

  // El paso lo manda el tipo: 36° el pentágono, 30° el hexágono, 90° el
  // triángulo, 45° el cuadrado. Un rectángulo no guarda ángulo y no lo ofrece.
  const pasos = {
    pentagon: '36', hexagon: '30', triangle: '90', square: '45', trapezoid: '90',
    // Las estrellas repiten el paso de su polígono: medio giro de simetría.
    star5: '36', star6: '30',
  };
  for (const [tool, step] of Object.entries(pasos)) {
    app.selectTool(tool);
    assert.equal(app.$('shape-modal-rotation-row').hidden, false, `${tool} debe ofrecer giro`);
    assert.equal(String(slider().step), step, `el paso de ${tool}`);
    assert.equal(String(slider().max), String(360 - Number(step)), `el máximo de ${tool}`);
    app.$('modal-shape').close();
  }
  app.selectTool('rect');
  assert.equal(app.$('shape-modal-rotation-row').hidden, true,
    'el rectángulo guarda su giro en las dimensiones, no como ángulo: no lo ofrece');
  app.$('modal-shape').close();

  // Sin selección fija cómo NACE la próxima forma.
  app.selectTool('pentagon');
  slider().value = '72';
  slider().__fire('input', { target: slider() });
  app.$('modal-shape').close();
  app.flush();
  app.drag(140, 140, 240, 240);
  const pent = app.elements()[0];
  assert.equal(pent.type, 'pentagon');
  assert.equal(pent.rotation, 72, 'el pentágono nace ya girado');
  assert.ok(Exporter.isValidElement(pent), 'y sobrevive al round-trip JSON');

  // Con selección, gira lo seleccionado, en UN solo paso de deshacer.
  app.selectTool('select');
  app.click(190, 190);
  assert.equal(app.elements().length, 1);
  const before = app.elements();
  slider().value = '216';
  slider().__fire('input', { target: slider() });
  slider().__fire('change', { target: slider() });
  app.flush();
  assert.equal(app.elements()[0].rotation, 216, 'la selección gira al ángulo elegido');
  app.key('z', { ctrlKey: true });
  assert.deepEqual(app.elements(), before, 'y todo el arrastre se deshace de una vez');
});

// El trapecio no solo guarda el ángulo: al girar un cuarto intercambia ancho y
// alto. Fijar `rotation` a pelo dejaría su caja desalineada de la silueta, así
// que el giro pasa por ShapeRotation.rotateElement.
test('el trapecio girado conserva caja y silueta, y solo admite cuartos de vuelta', () => {
  const app = loadApp();
  app.selectTool('trapezoid');
  const slider = app.$('shape-modal-rotation');
  slider.value = '90';
  slider.__fire('input', { target: slider });
  app.$('modal-shape').close();
  app.flush();
  app.drag(120, 120, 260, 200);

  const trap = app.elements()[0];
  assert.equal(trap.rotation, 90);
  assert.ok(Exporter.isValidElement(trap),
    'isValidElement rechaza un trapecio con un giro que no sea múltiplo de 90');
  const vertices = app.context.Trapezoid.vertices(trap);
  assert.equal(vertices.length, 4);
  const cx = trap.x + trap.w / 2, cy = trap.y + trap.h / 2;
  const mx = vertices.reduce((s, v) => s + v.x, 0) / 4;
  const my = vertices.reduce((s, v) => s + v.y, 0) / 4;
  assert.ok(Math.abs(mx - cx) < 1 && Math.abs(my - cy) < 1,
    'la silueta sigue centrada en la caja del elemento');
});

// Cancelar un catálogo devuelve a la herramienta anterior. Ahora que casi todas
// abren sus ajustes al elegirse, ese retorno encadenaría un segundo modal encima
// del que se acaba de cerrar; se vuelve en modo `silent`. Mandar a Seleccionar
// —el camino fácil— habría dejado al usuario sin su herramienta.
test('cancelar un catálogo recupera la herramienta sin encadenar modales', () => {
  const app = loadApp();
  for (const tool of ['line', 'rect', 'eraser']) {
    app.selectTool(tool);
    app.$('modal-stroke').close();
    app.$('modal-shape').close();
    app.$('modal-eraser').close();
    app.flush();

    app.selectTool('planta');
    app.$('modal-planta').close();       // cancelar, sin elegir huella
    app.flush();

    assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, tool,
      `cancelar debe devolver a ${tool}, no tirar a Seleccionar`);
    for (const m of ['modal-stroke', 'modal-shape', 'modal-eraser']) {
      assert.equal(app.$(m).open, false,
        `${m} no puede abrirse detrás del catálogo que se acaba de cerrar`);
    }
  }
});

test('el modal de Trazo y el panel son el mismo ajuste', () => {
  const app = loadApp();
  app.selectTool('line');
  assert.equal(app.$('modal-stroke').open, true);

  const modalSlider = app.$('stroke-modal-slider');
  modalSlider.value = '6';
  modalSlider.__fire('input', { target: modalSlider });
  app.flush();
  // El grosor dejó el panel en la v2.21.0: sus gemelos son ahora los otros
  // cuatro modales de ajustes, que siguen siendo el mismo dato.
  assert.equal(app.$('shape-modal-slider').value, '6', 'el gemelo de Formas sigue al de Trazo');
  assert.equal(app.$('text-modal-stroke').value, '6', 'y el de Texto también');

  const shapeSlider = app.$('shape-modal-slider');
  shapeSlider.value = '3';
  shapeSlider.__fire('input', { target: shapeSlider });
  app.flush();
  assert.equal(app.$('stroke-modal-val').textContent, '3', 'y al revés');

  const dash = app.$('stroke-modal-dash');
  dash.checked = true; dash.__fire('change', { target: dash });
  app.flush();
  assert.equal(app.$('check-dash').checked, true, 'el discontinuo también viaja a los dos');

  // «Trazo» perdió su ⚙ en la v2.21.0 (era el botón que se re-apuntaba a cinco
  // modales). Se reabre por donde se abrió: pulsando la herramienta.
  app.selectTool('pencil');
  app.$('modal-stroke').close();
  app.flush();
  app.selectTool('pencil');
  assert.equal(app.$('modal-stroke').open, true, 'volver a pulsar el Lápiz lo reabre');
  assert.equal(app.$('modal-eraser').open, false, 'y no abre el del borrador');
});

/* Reparto del ⚙ (v2.21.0): había UNO solo, en la cabecera «Trazo», que se
   re-apuntaba a cinco modales según la herramienta; ahora cada sección lleva el
   suyo y abre siempre los ajustes de esa sección. Estas tres guardas son lo que
   impide que el reparto se deshaga: la primera fija el destino de cada botón,
   la segunda que el de la selección sigue al TIPO y no a la herramienta, y la
   tercera la promesa que los distingue del botón del sidebar. */

const GEAR_MODALS = ['modal-stroke', 'modal-shape', 'modal-text', 'modal-ui',
  'modal-eraser', 'modal-select', 'modal-emoji'];

/** Cierra los siete diálogos de ajustes y pulsa un ⚙, dejando la escena lista
    para comprobar cuál se abrió. */
function pressGear(app, id) {
  GEAR_MODALS.forEach(m => app.$(m).close());
  app.flush();
  app.$(id).__fire('click', { target: app.$(id) });
  app.flush();
}

/** Exige que se haya abierto ESE modal y ninguno de los otros seis. */
function onlyOpen(app, expected, why) {
  for (const m of GEAR_MODALS) {
    assert.equal(app.$(m).open, m === expected,
      `${why}: #${m} debería estar ${m === expected ? 'abierto' : 'cerrado'}`);
  }
}

test('cada ⚙ del panel abre los ajustes de SU sección, no los de otra', () => {
  const app = loadApp();

  // «Relleno»: #modal-shape es el único que lleva ese bloque.
  app.selectTool('circle');
  pressGear(app, 'btn-fill-settings');
  onlyOpen(app, 'modal-shape', 'relleno → forma');

  // «Texto»: el catálogo del emoji SOLO cuando el deslizador es el suyo.
  app.selectTool('emoji');
  pressGear(app, 'btn-text-settings');
  onlyOpen(app, 'modal-emoji', 'emoji sin selección → catálogo');
  app.selectTool('text');
  pressGear(app, 'btn-text-settings');
  onlyOpen(app, 'modal-text', 'texto → texto');

  // «Elementos»: con CUALQUIER herramienta, no solo con las dos de Edición.
  app.selectTool('pencil');
  pressGear(app, 'btn-selection-settings');
  onlyOpen(app, 'modal-select', 'selección → selección');
});

test('el ⚙ de «Posición y tamaño» abre los ajustes del tipo seleccionado', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 190, 180);
  app.selectTool('line');
  app.drag(300, 100, 390, 180);
  app.selectTool('button');
  app.drag(500, 100, 590, 150);
  // Mover conserva la selección y su modal es #modal-select: si el ⚙ mirase la
  // herramienta activa, abriría ese en los tres casos.
  app.selectTool('select');

  app.click(145, 140);
  pressGear(app, 'btn-element-settings');
  onlyOpen(app, 'modal-shape', 'un rectángulo abre los ajustes de forma');

  app.click(345, 140);
  pressGear(app, 'btn-element-settings');
  onlyOpen(app, 'modal-stroke', 'una línea, los de trazo');

  app.click(545, 125);
  pressGear(app, 'btn-element-settings');
  onlyOpen(app, 'modal-ui', 'un botón, los del componente');
  assert.equal(app.$('modal-ui-title').textContent, 'Ajustes de Botón',
    'y titulados por el tipo SELECCIONADO, no por la herramienta activa');

  // Tipos que discrepan: no hay UN modal que los edite, así que no se ofrece
  // ninguno — la misma regla que commonOf, no inventar un valor común.
  GEAR_MODALS.forEach(m => app.$(m).close());
  app.key('a', { ctrlKey: true });
  app.flush();
  assert.equal(app.$('btn-element-settings').hidden, true,
    'con tipos distintos seleccionados el ⚙ desaparece');
  app.$('btn-element-settings').__fire('click', { target: app.$('btn-element-settings') });
  app.flush();
  GEAR_MODALS.forEach(m => assert.equal(app.$(m).open, false,
    `y pulsarlo igualmente no abre nada: #${m}`));
});

test('ningún ⚙ del panel cambia de herramienta ni suelta la selección', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 190, 180);
  app.selectTool('select');
  app.click(145, 140);
  assert.equal(app.elements().length, 1, 'premisa: hay un rectángulo dibujado');

  for (const gear of ['btn-element-settings', 'btn-fill-settings',
    'btn-selection-settings']) {
    pressGear(app, gear);
    assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool,
      'select', `#${gear} no puede cambiar de herramienta`);
    assert.equal(app.$('panel-sec-element').hidden, false,
      `#${gear} no puede vaciar la selección: es la vía para retocar sin soltarla`);
  }
});

test('«Etiquetas» del panel y la de los modales del jardín son el mismo ajuste', () => {
  const app = loadApp();
  app.selectTool('arbol');
  assert.equal(app.$('check-garden-labels').checked, true);

  // La casilla botánica se crea en runtime: un id asignado así no entra en el
  // índice del arnés, de modo que se llega a ella recorriendo el modal, no con
  // $(). Es el mismo motivo por el que app.js la sincroniza por referencia.
  const treeBox = app.$('modal-tree').querySelectorAll('input')
    .find(i => i.id === 'tree-garden-labels');
  assert.ok(treeBox, 'el modal botánico lleva su casilla de etiquetas');
  assert.equal(treeBox.checked, true, 'arranca según el estado');

  treeBox.checked = false;
  treeBox.__fire('change', { target: treeBox });
  app.flush();
  assert.equal(app.$('check-garden-labels').checked, false, 'la gemela del panel se entera');
  assert.equal(app.$('plot-garden-labels').checked, false, 'y las de los otros modales también');

  app.pickVariant('tree-catalog', 'modal__tree', 'broadleaf', 'tree');
  app.drag(200, 200, 300, 300);
  assert.ok(!app.elements().some(el => el.type === 'text'),
    'y la planta sale sin rótulo, que es lo que la casilla promete');
});

test('tras «Limpiar todo» los controles de Verjas y Cancela vuelven a su valor', () => {
  const app = loadApp();
  app.selectTool('verja');
  const fence = app.$('fence-height');
  fence.value = '40'; fence.__fire('input', { target: fence });
  app.flush();
  assert.equal(app.$('fence-height-val').textContent, '40');

  app.$('modal-fence').close();
  app.$('btn-clear').__fire('click', { target: app.$('btn-clear') });
  app.flush();
  assert.equal(app.$('fence-height').value, '180', 'el modal no puede quedarse con el valor viejo');
  assert.equal(app.$('fence-height-val').textContent, '180');
  assert.equal(app.$('gate-height').value, '200');
});

test('lo borrado no reaparece al mover el dibujo (el fallo de la máscara)', () => {
  const { app, count } = withFacade();
  app.selectTool('eraser');
  const antes = JSON.stringify(app.elements());
  app.drag(150, 200, 250, 200);
  const afterErase = app.elements().length;
  assert.notEqual(JSON.stringify(app.elements()), antes,
    'la pasada muerde piezas de la fachada');

  app.selectTool('select');
  app.click(100, 100);
  app.drag(105, 412, 405, 412);          // mueve lo que queda
  assert.equal(app.elements().length, afterErase,
    'mover no debe resucitar nada: ya no hay máscara posicional');
});

test('una pasada del borrador es un solo paso de undo', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.drag(220, 100, 320, 200);
  app.selectTool('eraser');
  app.drag(90, 150, 330, 150);           // barre los dos de una pasada
  const tras = app.elements();
  assert.equal(tras.filter(e => e.type === 'rect').length, 0, 'ninguno sigue siendo rect');
  assert.ok(tras.length > 0, 'quedan las tiras de contorno que no se barrieron');
  app.key('z', { ctrlKey: true });
  const vueltos = app.elements();
  assert.equal(vueltos.length, 2, 'un único Ctrl+Z devuelve los dos');
  assert.ok(vueltos.every(e => e.type === 'rect'), 'y los devuelve como rectángulos');
});

test('una pasada que no toca nada no ensucia el historial', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.selectTool('eraser');
  app.drag(600, 600, 700, 700);          // al aire
  assert.equal(app.elements().length, 1);
  app.key('z', { ctrlKey: true });
  assert.equal(app.elements().length, 0,
    'el Ctrl+Z debe deshacer el rect, no una pasada vacía');
});

test('los proyectos antiguos conservan su máscara y siguen viéndose igual', () => {
  const legacy = [
    { type: 'rect', x: 100, y: 100, w: 100, h: 100, color: '#000000', lineWidth: 2, seed: 1 },
    {
      type: 'eraser', color: '#000000', lineWidth: 2, size: 16, seed: 2,
      points: [{ x: 90, y: 150 }, { x: 210, y: 150 }],
    },
  ];
  const app = loadApp({ autosave: { elements: legacy, settings: { overlapMode: 'normal' } } });
  const loaded = app.elements();
  assert.equal(loaded.length, 2, 'el proyecto antiguo se carga entero');
  assert.equal(loaded.filter(e => e.type === 'eraser').length, 1, 'la máscara se conserva');

  // Pasar el borrador nuevo por encima borra el rect pero NO la máscara:
  // quitarla haría reaparecer justo lo que oculta.
  app.selectTool('eraser');
  app.drag(90, 150, 210, 150);
  const after = app.elements();
  assert.equal(after.filter(e => e.type === 'eraser').length, 1, 'la máscara sobrevive');
  assert.equal(after.filter(e => e.type === 'rect').length, 0, 'el rect sí se elimina');
});

test('el tamaño del borrador cambia su alcance', () => {
  const near = () => {
    const app = loadApp();
    app.selectTool('rect');
    app.drag(100, 100, 200, 200);
    return app;
  };
  // El tamaño se ajusta en #modal-eraser, que se abre al elegir la herramienta
  // (desde la v2.21.0 no hay mando en el panel).
  const setSize = (app, v) => {
    const s = app.$('eraser-size-modal-slider');
    s.value = String(v);
    s.__fire('input', { target: s });
    app.flush();
  };
  const small = near();
  small.selectTool('eraser');
  setSize(small, 4);
  small.drag(100, 88, 200, 88);                   // 12px por encima del borde
  assert.equal(small.elements().length, 1, 'con 4px no alcanza');
  assert.equal(small.elements()[0].type, 'rect', 'y lo deja intacto');

  const big = near();
  big.selectTool('eraser');
  setSize(big, 60);
  big.drag(100, 88, 200, 88);
  const tras = big.elements();
  assert.equal(tras.filter(e => e.type === 'rect').length, 0, 'con 60px sí alcanza');
  // Se ha comido el lado de arriba, no el rectángulo entero.
  assert.ok(tras.length >= 1 && tras.every(e => e.type === 'pencil'));
  assert.ok(!tras.some(e => e.points.some(p => p.y < 108 && p.x > 130 && p.x < 170)),
    'el lado barrido no está');
});

test('el panel y el modal de Fachada quedan sincronizados en ambos sentidos', () => {
  const app = loadApp();
  const panelFloors = app.$('build-floors');
  const modalFloors = app.$('facade-floors');

  panelFloors.value = '5';
  panelFloors.__fire('change', { target: panelFloors });
  app.flush();
  assert.equal(modalFloors.value, '5', 'panel → modal');

  modalFloors.value = '3';
  modalFloors.__fire('change', { target: modalFloors });
  app.flush();
  assert.equal(panelFloors.value, '3', 'modal → panel');
});

/* ── Jardín ── */

test('un árbol se crea como grupo, con su etiqueta dentro', () => {
  const app = loadApp();
  app.selectTool('arbol');
  app.drag(200, 200, 300, 300);

  const els = app.elements();
  assert.ok(els.length > 2, 'un árbol son copa, detalle y etiqueta');
  const gid = els[0].buildingGroupId;
  assert.ok(gid, 'las piezas comparten grupo');
  assert.ok(els.every(e => e.buildingGroupId === gid));
  const label = els.find(e => e.type === 'text');
  assert.ok(label, 'debe llevar etiqueta');
  assert.equal(label.value, 'Encina · H 12 m · Ø 14 m');
  assert.equal(label.buildingGroupId, gid, 'la etiqueta va en el grupo');
  assert.ok(els.every(e => e.gardenMeta && e.gardenMeta.variant === 'broadleaf'),
    'cada pieza conserva la ficha editable del ejemplar');
  assert.ok(els.every(e => e.gardenMeta.color === '#1a1a2e' && e.gardenMeta.lineWidth === 2),
    'la ficha conserva también el acabado original');
});

test('una planta colocada se puede mover y editar como un único cambio reversible', () => {
  const app = loadApp();
  app.selectTool('arbol');
  app.drag(200, 200, 300, 300);
  const original = app.elements();
  const gid = original[0].buildingGroupId;

  app.selectTool('select');
  app.drag(250, 250, 280, 270);
  const moved = app.elements();
  assert.equal(moved[0].gardenMeta.p1.x, 230, 'la ficha se desplaza con la geometría');
  assert.equal(app.$('btn-edit-garden').hidden, false, 'aparece Editar planta para el grupo completo');

  app.$('btn-edit-garden').__fire('click', { target: app.$('btn-edit-garden') });
  app.flush();
  assert.equal(app.$('modal-tree').open, true);
  const view = app.$('tree-plant-view');
  view.value = 'elevation'; view.__fire('change', { target: view });
  const scale = app.$('tree-plant-scale');
  scale.value = '125'; scale.__fire('input', { target: scale });
  app.pickVariant('tree-catalog', 'modal__tree', 'cypress', 'tree');

  const edited = app.elements();
  assert.ok(edited.length > 2);
  assert.ok(edited.every(e => e.buildingGroupId === gid), 'conserva la identidad del grupo');
  assert.ok(edited.every(e => e.gardenMeta.variant === 'cypress'));
  assert.ok(edited.every(e => e.gardenMeta.plantView === 'elevation'));
  assert.ok(edited.every(e => e.gardenMeta.plantScalePct === 125));
  assert.ok(edited.every(e => e.gardenMeta.p1.x === 230 && e.gardenMeta.p1.y === 220),
    'la regeneración usa la posición ya desplazada');
  assert.match(edited.find(e => e.type === 'text').value, /Ciprés/);

  app.key('z', { ctrlKey: true });
  assert.deepEqual(app.elements(), moved, 'Deshacer restaura la planta movida anterior en un paso');
});

test('Jardín botánico: alzado, etapa, escala, etiqueta y color se aplican y persisten', () => {
  const app = loadApp();
  app.selectTool('arbol');
  const modal = app.$('modal-tree');
  assert.equal(modal.open, true);
  const view = app.$('tree-plant-view');
  const stage = app.$('tree-plant-stage');
  const scale = app.$('tree-plant-scale');
  const px = app.$('tree-plant-px');
  const labelMode = app.$('tree-plant-label-mode');
  assert.ok(view && stage && scale && px && labelMode, 'faltan controles botánicos');

  view.value = 'elevation'; view.__fire('change', { target: view });
  stage.value = 'developing'; stage.__fire('change', { target: stage });
  scale.value = '75'; scale.__fire('input', { target: scale });
  px.value = '24'; px.__fire('input', { target: px });
  labelMode.value = 'botanical'; labelMode.__fire('change', { target: labelMode });
  app.pickVariant('tree-catalog', 'modal__tree', 'olive', 'tree');
  app.click(180, 120);

  const els = app.elements();
  assert.ok(els.some(el => el.type === 'line' && el.y1 === el.y2), 'falta la rasante del alzado');
  assert.ok(els.some(el => el.fill && el.fillTransparent), 'falta el volumen natural');
  assert.match(els.find(el => el.type === 'text').value, /Olivo · Olea europaea/);
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.plantView, 'elevation');
  assert.equal(prefs.plantStage, 'developing');
  assert.equal(prefs.plantScalePct, 75);
  assert.equal(prefs.plantPxPerM, 24);
  assert.equal(prefs.gardenLabelMode, 'botanical');
  assert.equal(prefs.treeType, 'olive');

  const again = loadApp({ prefs });
  again.selectTool('arbol');
  assert.equal(again.$('tree-plant-view').value, 'elevation');
  assert.equal(again.$('tree-plant-stage').value, 'developing');
  assert.equal(Number(again.$('tree-plant-scale').value), 75);
  assert.equal(Number(again.$('tree-plant-px').value), 24);
});

test('Jardín botánico acota preferencias inválidas y conserva defaults seguros', () => {
  const app = loadApp({ prefs: {
    plantView: 'perspectiva', plantStage: 'ancestral', plantScalePct: 999,
    plantPxPerM: -20, plantColorMode: 'neon', gardenLabelMode: 'latín',
    climberType: 'inexistente',
  } });
  app.selectTool('arbol');
  assert.equal(app.$('tree-plant-view').value, 'plan');
  assert.equal(app.$('tree-plant-stage').value, 'adult');
  assert.equal(Number(app.$('tree-plant-scale').value), app.context.Garden.PLANT_SCALE_MAX);
  assert.equal(Number(app.$('tree-plant-px').value), app.context.Garden.PLANT_PX_PER_M_MIN);
  assert.equal(app.$('tree-plant-label-mode').value, 'dimensions');
  assert.equal(app.$('tree-plant-natural').checked, true);
});

test('Trepadoras tiene botón, modal y seis especies en planta y alzado', () => {
  const app = loadApp();
  app.selectTool('trepadora');
  assert.equal(app.$('modal-climber').open, true);
  assert.equal(app.$('climber-catalog').querySelectorAll('.modal__climber').length, 6);
  const view = app.$('climber-plant-view');
  view.value = 'elevation'; view.__fire('change', { target: view });
  app.pickVariant('climber-catalog', 'modal__climber', 'wisteria', 'climber');
  app.drag(100, 100, 260, 280);
  const els = app.elements();
  assert.match(els.find(el => el.type === 'text').value, /Glicinia/);
  assert.ok(els.filter(el => el.type === 'curveArrow').length >= 3, 'faltan tallos colgantes');
});

test('mover un árbol arrastra también su etiqueta', () => {
  const app = loadApp();
  app.selectTool('arbol');
  app.drag(200, 200, 300, 300);
  const before = app.elements();

  app.selectTool('select');
  app.click(250, 250);          // un clic selecciona el árbol entero
  app.drag(250, 250, 290, 250); // y arrastrarlo lo mueve completo

  const after = app.elements();
  assert.equal(after.length, before.length);
  const moved = before.map((el, i) => dx(el, after[i]));
  assert.ok(moved.every(d => Math.abs(d - moved[0]) < 0.01),
    'todas las piezas, etiqueta incluida, se mueven lo mismo');
  assert.ok(Math.abs(moved[0] - 40) < 0.01, 'y se mueven lo arrastrado');
});

test('apagar las etiquetas quita el texto y persiste en prefs', () => {
  const app = loadApp();
  const check = app.$('check-garden-labels');
  assert.equal(check.checked, true, 'las etiquetas vienen activadas');
  check.checked = false;
  check.__fire('change', { target: check });
  app.flush();

  app.selectTool('flor');
  app.drag(100, 100, 140, 140);
  assert.equal(app.elements().filter(e => e.type === 'text').length, 0);

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.gardenLabels, false);
  assert.equal(loadApp({ prefs }).$('check-garden-labels').checked, false);
});

test('elegir variante en el catálogo cambia lo que se dibuja y persiste', () => {
  const app = loadApp();
  app.selectTool('decoracion');
  app.pickVariant('decor-catalog', 'modal__decor', 'bench', 'decor');
  app.drag(100, 100, 200, 140);

  const label = app.elements().find(e => e.type === 'text');
  assert.equal(label.value, 'Banco');
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.decorType, 'bench');
});

// Con `f`, `q`, `d` o `s` la colisión sería intermitente: esas teclas solo
// actúan cuando hay una flecha curva seleccionada, y toda pieza de jardín
// lleva curvas dentro.
test('los atajos del jardín no chocan con las acciones de flecha curva', () => {
  const app = loadApp();
  app.selectTool('arbol');
  app.drag(200, 200, 300, 300);
  app.selectTool('select');
  app.click(250, 250);          // árbol seleccionado: hay curveArrow dentro
  const before = JSON.stringify(app.elements());

  ['8', '9', 'h', 'x', 'z'].forEach(k => {
    const ev = app.key(k);
    assert.equal(ev.defaultPrevented, true, `el atajo ${k} debe cancelar la tecla`);
  });
  assert.equal(JSON.stringify(app.elements()), before,
    'ningún atajo de jardín puede alterar el dibujo seleccionado');
});

// Lo que la previsualización no sabe pintar no da error: simplemente no sale, y
// deja de coincidir con lo que aparece al soltar. Pasaba con las curvas
// encadenadas (no tienen cx/cy de nivel superior, y quadraticCurveTo(undefined…)
// es un no-op silencioso) y con las etiquetas.
test('la previsualización del arrastre pinta la silueta encadenada y la etiqueta', () => {
  const app = loadApp();
  app.selectTool('arbol');
  const canvas = app.$('main-canvas');
  const overlay = app.$('overlay-canvas');
  const fire = (type, x, y, extra = {}) =>
    canvas.__fire(type, { clientX: x, clientY: y, pointerId: 1, button: 0, ...extra });

  fire('pointerdown', 200, 200);
  overlay._ctx.reset();                 // solo interesa lo que pinta el arrastre
  fire('pointermove', 320, 320, { buttons: 1 });
  app.flush();

  const pintado = overlay._ctx.methodNames();
  assert.ok(pintado.includes('bezierCurveTo'),
    'la copa es una curva encadenada: sin recorrer sus segments no se dibuja nada');
  assert.ok(pintado.includes('fillText'),
    'la etiqueta forma parte de la pieza y debe verse ya en la previsualización');
  fire('pointerup', 320, 320);
});

// Cancelar sin elegir variante debe devolver la herramienta anterior, en las dos
// secciones. Nadie lo había fijado, y al añadir Jardín la condición de
// wireBuildModalCancel pasó a mirar dos listas: sin test, romperla no se notaría.
const activeTool = app => app.dom.document.querySelectorAll('.sidebar__tool')
  .find(b => b.classList.contains('sidebar__tool--active')).dataset.tool;

test('cancelar un catálogo devuelve la herramienta anterior (Edificios y Jardín)', () => {
  for (const [tool, modal] of [['planta', 'modal-planta'], ['arbol', 'modal-tree']]) {
    const app = loadApp();
    app.selectTool('rect');
    app.selectTool(tool);
    assert.equal(activeTool(app), tool, `${tool} debe quedar activa con el modal abierto`);
    app.$(modal).close();
    app.flush();
    assert.equal(activeTool(app), 'rect', `cancelar ${modal} debe volver a Rectángulo`);
  }
});

// Si la herramienta previa TAMBIÉN abre catálogo, restaurarla reabriría un modal
// en cascada nada más cerrar el anterior. Para llegar a ese caso hay que elegir
// variante en el primero (así la herramienta se conserva) y luego cambiar al
// segundo y cancelar.
test('cancelar cuando la herramienta previa también abre catálogo cae en Mover', () => {
  const app = loadApp();
  app.selectTool('jardin');
  app.pickVariant('plot-catalog', 'modal__plot', 'round', 'plot');
  assert.equal(activeTool(app), 'jardin');
  app.selectTool('flor');        // previa = jardin, que abre modal
  app.$('modal-flower').close();
  app.flush();
  assert.equal(activeTool(app), 'select', 'no debe reabrir el catálogo de Jardín');
  assert.equal(app.$('modal-plot').open, false);
});

test('elegir variante NO devuelve la herramienta anterior: se queda para dibujar', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.selectTool('arbol');
  app.pickVariant('tree-catalog', 'modal__tree', 'palm', 'tree');
  assert.equal(activeTool(app), 'arbol', 'tras elegir, la herramienta se conserva');
});

/* ── Regresión: «Limpiar todo» deja la app como recién abierta ── */

/** Agranda el área visible del lienzo y deja que el auto-ajuste reaccione.
    Devuelve el zoom resultante en % (leído del panel, sin hooks de test). */
function widenViewport(app, w = 2000, h = 1400) {
  const area = app.dom.document.querySelector('.canvas-area');
  area.clientWidth = w;
  area.clientHeight = h;
  app.dom.window.__fire('resize');   // el handler encola un setTimeout…
  app.flush();                       // …que flush() ejecuta
  return +app.$('zoom-val').textContent;
}

test('«Limpiar todo» devuelve el zoom al ajuste automático, no a un 100% fijo', () => {
  const app = loadApp();
  const fitted = widenViewport(app);
  assert.ok(fitted > 100, 'con área de sobra el auto-ajuste agranda el lienzo');

  const slider = app.$('zoom-slider');
  slider.value = '50';
  slider.__fire('input', { target: slider });   // elección manual: 50%
  app.flush();
  assert.equal(+app.$('zoom-val').textContent, 50);

  app.$('btn-clear').__fire('click');
  app.flush();
  assert.equal(+app.$('zoom-val').textContent, fitted,
    'tras limpiar, el lienzo debe ocupar el espacio igual que al abrir la app');
  assert.equal(app.$('canvas-sizer').style.width, `${1200 * (fitted / 100)}px`,
    'y la caja de layout debe seguir al zoom recalculado');
});

test('tras «Limpiar todo» el auto-ajuste vuelve a actuar al redimensionar', () => {
  const app = loadApp();
  const slider = app.$('zoom-slider');
  slider.value = '50';
  slider.__fire('input', { target: slider });   // desactiva el auto-ajuste
  app.flush();
  assert.equal(widenViewport(app), 50, 'con zoom manual, redimensionar no toca nada');

  app.$('btn-clear').__fire('click');
  app.flush();
  assert.ok(widenViewport(app, 2400, 1600) > 100,
    'limpiar también resetea zoomManual: el auto-ajuste queda vivo otra vez');
});

test('«Limpiar todo» reinicia el tamaño del borrador a 16px', () => {
  const app = loadApp();
  app.selectTool('eraser');
  app.$('modal-eraser').close();
  app.flush();

  const modalSlider = app.$('eraser-size-modal-slider');
  modalSlider.value = '60';
  modalSlider.__fire('input', { target: modalSlider });
  modalSlider.__fire('change', { target: modalSlider });
  app.flush();
  assert.equal(app.$('eraser-size-modal-val').textContent, '60',
    'premisa: el tamaño cambió antes de limpiar');

  app.$('btn-clear').__fire('click');
  app.flush();

  app.selectTool('eraser');   // reabre el modal, que es donde vive el tamaño
  assert.equal(app.$('eraser-size-modal-slider').value, '16', 'vuelve al tamaño por defecto');
  assert.equal(app.$('eraser-size-modal-val').textContent, '16');
});

test('todo lo que dibuja el jardín sobrevive al round-trip JSON', () => {
  const app = loadApp();
  for (const tool of ['jardin', 'arbol', 'arbusto', 'flor', 'decoracion', 'aromatica']) {
    app.selectTool(tool);
    app.drag(100, 100, 240, 240);
  }
  const els = app.elements();
  assert.ok(els.length > 10);
  for (const el of els) {
    assert.ok(Exporter.isValidElement(el),
      `elemento que no sobreviviría a la importación: ${JSON.stringify(el)}`);
  }
});

/* ============================================================
   Auditoría v1.17.0 — atajos, undo por gesto y handles
   ============================================================ */

// El diálogo nativo de color dispara 'input' por cada tono pisado al
// arrastrar; con un saveUndo() por evento, elegir un color podía expulsar el
// historial entero (límite 50) y Ctrl+Z recorría cada tono intermedio.
test('elegir color de relleno arrastrando por el picker es UN paso de undo', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.selectTool('select');
  app.click(150, 150);

  const picker = app.$('fill-color-picker');
  for (const v of ['#ff0000', '#00ff00', '#0000ff']) {
    picker.value = v;
    picker.__fire('input', { target: picker });
  }
  picker.__fire('change', { target: picker });
  app.flush();

  let el = app.elements()[0];
  assert.equal(el.fillColor, '#0000ff', 'el último tono del gesto queda aplicado');
  assert.equal(el.fill, true);

  app.key('z', { ctrlKey: true });
  el = app.elements()[0];
  assert.equal(el.fillColor, undefined, 'un único Ctrl+Z deshace el gesto entero');
  assert.ok(!el.fill, 'incluido el relleno que activó');
});

// Mantener pulsado +/− repite ~30 veces/s; sin filtrar e.repeat cada
// repetición apilaba un undo y en ~2s expulsaba los 50 pasos de historial.
test('mantener pulsado + sobre una curva es UN paso de undo', () => {
  const app = loadApp();
  app.selectTool('curveArrow');
  app.drag(100, 100, 200, 100);
  app.selectTool('select');
  const antes = app.elements()[0];
  // Punto medio real de la cuadrática: B(0.5) = P0/4 + C/2 + P2/4
  app.click(
    0.25 * antes.x1 + 0.5 * antes.cx + 0.25 * antes.x2,
    0.25 * antes.y1 + 0.5 * antes.cy + 0.25 * antes.y2,
  );

  app.key('+');
  app.key('+', { repeat: true });
  app.key('+', { repeat: true });
  app.key('+', { repeat: true });
  assert.notEqual(app.elements()[0].cy, antes.cy, 'la curvatura ha cambiado');

  app.key('z', { ctrlKey: true });
  assert.equal(app.elements()[0].cy, antes.cy,
    'un único Ctrl+Z devuelve la curvatura previa a TODA la pulsación');
});

// drawSelection omite los handles de esquina en las flechas (usan
// extremos/curvatura), pero hitHandle los activaba igual: clicar cerca de una
// esquina del bbox —espacio vacío a la vista— arrancaba un resize invisible.
test('la esquina del bbox de una curva seleccionada no es un handle invisible', () => {
  const app = loadApp();
  app.selectTool('curveArrow');
  app.drag(100, 100, 200, 100);
  app.selectTool('select');
  const antes = app.elements()[0];
  app.click(
    0.25 * antes.x1 + 0.5 * antes.cx + 0.25 * antes.x2,
    0.25 * antes.y1 + 0.5 * antes.cy + 0.25 * antes.y2,
  );

  // Esquina INFERIOR izquierda del bbox (el control comba hacia abajo, así
  // que es espacio vacío): lejos de los handles reales de la flecha
  const corner = {
    x: Math.min(antes.x1, antes.cx, antes.x2),
    y: Math.max(antes.y1, antes.cy, antes.y2),
  };
  for (const p of [[antes.x1, antes.y1], [antes.x2, antes.y2], [antes.cx, antes.cy]]) {
    assert.ok(Math.hypot(corner.x - p[0], corner.y - p[1]) > 10,
      'premisa: la esquina no pisa ningún handle real');
  }
  app.drag(corner.x, corner.y, corner.x - 40, corner.y + 40);

  const tras = app.elements()[0];
  assert.deepEqual(
    [tras.x1, tras.y1, tras.cx, tras.cy, tras.x2, tras.y2],
    [antes.x1, antes.y1, antes.cx, antes.cy, antes.x2, antes.y2],
    'arrastrar desde esa esquina no debe escalar la curva');
});

// Shift+R (rotar) con una selección sin formas rotables caía al selector de
// herramientas: k === 'r' activaba Rectángulo y se perdía la selección.
test('Shift+R sobre una selección sin rotables no cae en Rectángulo', () => {
  const app = loadApp();
  app.selectTool('arrow');
  app.drag(100, 100, 200, 100);
  app.selectTool('select');
  app.click(150, 100);

  const ev = app.key('R', { shiftKey: true });
  assert.equal(ev.defaultPrevented, true, 'el atajo se consume siempre');
  assert.equal(activeTool(app), 'select', 'la herramienta no cambia');
  app.key('Delete');
  assert.equal(app.elements().length, 0, 'y la selección sigue viva');
});

// En modo cadena, lastPos se fijaba snapeado y una línea más abajo se pisaba
// con la posición cruda si el botón estaba pulsado: la preview ignoraba la
// cuadrícula mientras el commit del mouseup sí snapeaba (preview ≠ resultado).
test('la previsualización de la cadena respeta «Ajustar a cuadrícula»', () => {
  const app = loadApp();
  const snap = app.$('check-snap');
  snap.checked = true;
  snap.__fire('change', { target: snap });
  app.flush();

  app.selectTool('curveArrow');
  app.click(140, 140);                    // un clic sin arrastre inicia la cadena
  const canvas = app.$('main-canvas');
  const overlay = app.$('overlay-canvas');
  canvas.__fire('pointerdown', { clientX: 140, clientY: 140, pointerId: 1, button: 0 });
  overlay._ctx.reset();
  canvas.__fire('pointermove', { clientX: 147, clientY: 153, pointerId: 1, buttons: 1 });
  app.flush();

  const quads = overlay._ctx.callsTo('quadraticCurveTo');
  assert.ok(quads.length > 0, 'hay preview del tramo en curso');
  const [, , x, y] = quads[quads.length - 1].args;
  assert.deepEqual([x, y], [140, 160],
    'el extremo de la preview va snapeado, como el commit');
  canvas.__fire('pointerup', { clientX: 147, clientY: 153, pointerId: 1 });
});

/* ── Regresión (auditoría 2026-08-08): «Limpiar todo» no reseteaba los
   defaults de Edificios/Jardín en state, y el siguiente savePrefs() los
   re-persistía — deshaciendo el removeItem que el botón acababa de hacer. ── */

test('«Limpiar todo» también devuelve los defaults de Edificios y Jardín', () => {
  const app = loadApp({ prefs: { treeType: 'olive', pathWidth: 72, buildFloors: 3 } });
  assert.equal(app.$('garden-path-width').value, '72', 'premisa: los prefs entraron');
  const clear = app.$('btn-clear');
  clear.__fire('click', { target: clear });
  app.flush();
  assert.equal(app.$('garden-path-width').value, '34', 'el slider gemelo vuelve al default');
  // Cualquier savePrefs posterior ya no debe resucitar la configuración vieja
  toggle(app, 'check-garden-labels', true);
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.treeType, 'broadleaf', 'la variante de árbol vuelve a su default');
  assert.equal(prefs.pathWidth, 34, 'el ancho de camino vuelve a su default');
  assert.equal(prefs.buildFloors, 'auto', 'las plantas vuelven a auto');
});

/* ── Regresión (auditoría 2026-08-08): HEX_RE aceptaba longitudes hex que no
   son colores CSS (#abcde, 5 dígitos): el canvas las ignora en silencio y el
   picker divergía del estado. ── */

test('unas prefs con un hex inválido de 5 dígitos no cuelan; el válido sí', () => {
  // El fondo por defecto se lee de una app sin prefs en vez de escribirlo aquí:
  // así el test sigue comprobando «el hex malo cae al default» aunque el
  // default cambie (y en la v2.20.0 cambió).
  const porDefecto = loadApp().$('canvas-bg-picker').value;
  const app = loadApp({ prefs: { canvasBg: '#abcde', gridColor: '#123456' } });
  assert.equal(app.$('canvas-bg-picker').value, porDefecto, 'el hex de 5 dígitos se rechaza');
  assert.equal(app.$('grid-color-picker').value, '#123456', 'el hex válido sí entra');
});

test('Muro: elegir la herramienta abre su modal con los cuatro ajustes utilizables', () => {
  const app = loadApp();
  app.selectTool('muro');
  assert.equal(app.$('modal-wall').open, true, 'debe abrirse #modal-wall');
  // Ninguno se deshabilita según la vista: elegir vista CIERRA el modal, así
  // que atenuar la altura y la verja en planta —la vista por defecto— las
  // dejaba fuera de alcance en la única visita en la que se podían tocar.
  assert.equal(app.$('wall-height').disabled, false, 'la altura debe poder elegirse ya');
  assert.equal(app.$('wall-railing').disabled, false, 'la verja debe poder elegirse ya');
  assert.equal(app.$('wall-material').disabled, false);
  assert.equal(app.$('wall-gate-type').disabled, false);
});

test('Muro: cambiar material/altura/verja/puerta se refleja al dibujar y persiste en prefs', () => {
  const app = loadApp();
  app.selectTool('muro');
  app.pickVariant('wall-catalog', 'modal__wall', 'elevation', 'wall');
  // El catálogo cierra el modal al elegir (como en Fachada); reabrir para
  // seguir ajustando el muro recién elegido.
  app.selectTool('muro');

  const set = (id, prop, value) => {
    const el = app.$(id);
    el[prop] = value;
    el.__fire('change', { target: el });
  };
  set('wall-material', 'value', 'concrete');
  set('wall-height', 'value', '2');
  set('wall-railing', 'checked', true);
  const railingHeight = app.$('wall-railing-height');
  railingHeight.value = '1.2';
  railingHeight.__fire('input', { target: railingHeight });
  railingHeight.__fire('change', { target: railingHeight });
  set('wall-gate-type', 'value', 'double');
  app.flush();
  app.$('modal-wall').close();

  app.drag(100, 100, 300, 190);
  const els = app.elements();
  assert.ok(els.some(e => e.type === 'curveArrow' && e.arc === true),
    'la verja de forja aparece combada');
  assert.ok(els.filter(e => e.type === 'rect' && e.w < 25).length >= 4,
    'la cancela trae sus dos pilastras rematadas en albardilla');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.wallView, 'elevation');
  assert.equal(prefs.wallMaterial, 'concrete');
  assert.equal(prefs.wallHeight, 2);
  assert.equal(prefs.wallRailing, true);
  assert.equal(prefs.wallRailingHeight, 1.2);
  assert.equal(prefs.wallGateType, 'double');
});

test('Muro: prefs con valores fuera de catálogo no cuelan', () => {
  const app = loadApp({ prefs: {
    wallView: 'elevation', wallMaterial: 'wood', wallHeight: 3,
    wallRailing: 'yes', wallGateType: 'triple',
  } });
  assert.equal(app.$('wall-material').value, 'stone', 'material desconocido: cae al default');
  assert.equal(app.$('wall-height').value, '1', 'altura fuera de {1,2}: cae al default');
  assert.equal(app.$('wall-railing').checked, false, 'verja no booleana: cae al default');
  assert.equal(app.$('wall-railing-height').value, '0.7', 'sin valor válido usa 0,7 m');
  assert.equal(app.$('wall-gate-type').value, 'concave', 'puerta desconocida: cae al nuevo default visible');
});

test('Muro: la cancela cóncava está disponible y se restaura desde prefs', () => {
  const app = loadApp({ prefs: { wallDesignVersion: 1, wallGateType: 'concave' } });
  assert.equal(app.$('wall-gate-type').value, 'concave');
  const options = app.$('wall-gate-type').children.map(o => o.value);
  assert.ok(options.includes('concave'), 'la variante señorial figura en el selector');
});

test('Muro: los nueve diseños cóncavos y los cuatro convexos están disponibles y persisten', () => {
  const types = ['concave', 'concaveSwan', 'concavePanel', 'concaveOrnate',
    'concaveFan', 'concaveLyre', 'concaveDiamond', 'concaveRings', 'concavePalmette',
    'convexPanel', 'convexFan', 'convexMedallion', 'convexBlind'];
  for (const type of types) {
    const app = loadApp({ prefs: { wallDesignVersion: 1, wallGateType: type } });
    assert.equal(app.$('wall-gate-type').value, type);
  }
});

test('Muro: ladrillo cara vista y los tres portones urbanos persisten', () => {
  const app = loadApp({ prefs: {
    wallDesignVersion: 1, wallMaterial: 'brick', wallGateType: 'solidTransom',
  } });
  assert.equal(app.$('wall-material').value, 'brick');
  assert.equal(app.$('wall-gate-type').value, 'solidTransom');
  for (const type of ['openBars', 'openScrolls']) {
    const restored = loadApp({ prefs: { wallDesignVersion: 1, wallGateType: type } });
    assert.equal(restored.$('wall-gate-type').value, type);
  }
});

test('Muro: los trece diseños de verja superior están disponibles y persisten', () => {
  const types = ['spear', 'minimal', 'arches', 'diamonds', 'rings', 'scrolls', 'fans',
    'castilian', 'plateresque', 'herrerian', 'andalusian', 'catalan', 'valencian'];
  for (const type of types) {
    const app = loadApp({ prefs: { wallRailingType: type } });
    assert.equal(app.$('wall-railing-type').value, type);
  }
});

test('Muro: la cancela cóncava en alzado es el inicio visible y migra defaults antiguos', () => {
  const fresh = loadApp();
  fresh.selectTool('muro');
  assert.equal(fresh.$('wall-gate-type').value, 'concave');

  const legacy = loadApp({ prefs: { wallView: 'plan', wallGateType: 'none' } });
  assert.equal(legacy.$('wall-gate-type').value, 'concave', 'el default histórico no oculta el diseño nuevo');
});

test('Verjas: el botón abre un modal con trece tipos, altura y dos vistas', () => {
  const app = loadApp();
  app.selectTool('verja');
  assert.equal(app.$('modal-fence').open, true);
  assert.deepEqual(app.$('fence-type').children.map(option => option.value),
    ['spear', 'minimal', 'arches', 'diamonds', 'rings', 'scrolls', 'fans',
      'castilian', 'plateresque', 'herrerian', 'andalusian', 'catalan', 'valencian']);
  const views = app.$('fence-catalog').querySelectorAll('.modal__fence')
    .map(button => button.dataset.fence);
  assert.deepEqual(views, ['plan', 'elevation']);
  assert.equal(app.$('fence-height').value, '180');
});

test('Verjas: tipo, altura y vista se dibujan y persisten', () => {
  const app = loadApp();
  app.selectTool('verja');
  const type = app.$('fence-type');
  type.value = 'fans';
  type.__fire('change', { target: type });
  const height = app.$('fence-height');
  height.value = '350';
  height.__fire('input', { target: height });
  height.__fire('change', { target: height });
  app.pickVariant('fence-catalog', 'modal__fence', 'elevation', 'fence');
  app.drag(100, 100, 300, 100);
  const els = app.elements();
  assert.ok(els.filter(e => e.type === 'circle').length >= 2,
    'el abanico conserva sus cubos ornamentales');
  const bounds = els.reduce((acc, el) => {
    if ('y' in el && 'h' in el) { acc.min = Math.min(acc.min, el.y); acc.max = Math.max(acc.max, el.y + el.h); }
    if ('y1' in el) { acc.min = Math.min(acc.min, el.y1, el.y2); acc.max = Math.max(acc.max, el.y1, el.y2); }
    return acc;
  }, { min: Infinity, max: -Infinity });
  assert.ok(bounds.max - bounds.min > 200, '350 cm produce una verja monumental');
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.fenceView, 'elevation');
  assert.equal(prefs.fenceType, 'fans');
  assert.equal(prefs.fenceHeightCm, 350);
});

test('Verjas: preferencias inválidas se ignoran o se acotan al rango', () => {
  const app = loadApp({ prefs: {
    fenceView: 'perspective', fenceType: 'barbed', fenceHeightCm: 999,
  } });
  assert.equal(app.$('fence-type').value, 'spear');
  assert.equal(app.$('fence-height').value, '350');
  app.selectTool('verja');
  const active = app.$('fence-catalog').querySelector('.modal__shape--active');
  assert.equal(active.dataset.fence, 'elevation');
});

test('Cancela: el botón abre un modal con dieciocho estilos, altura y dos vistas', () => {
  const app = loadApp();
  app.selectTool('cancela');
  assert.equal(app.$('modal-gate').open, true);
  assert.deepEqual(app.$('gate-type').children.map(option => option.value),
    [...app.context.GATE_TYPES.map(type => type.id)]);
  assert.equal(app.$('gate-type').children.length, 18);
  const views = app.$('gate-catalog').querySelectorAll('.modal__gate')
    .map(button => button.dataset.gate);
  assert.deepEqual(views, ['plan', 'elevation']);
  assert.equal(app.$('gate-height').value, '200');
});

test('Cancela: estilo, altura y vista se dibujan y persisten', () => {
  const app = loadApp();
  app.selectTool('cancela');
  const type = app.$('gate-type');
  type.value = 'convexFan';
  type.__fire('change', { target: type });
  const height = app.$('gate-height');
  height.value = '350';
  height.__fire('input', { target: height });
  height.__fire('change', { target: height });
  app.pickVariant('gate-catalog', 'modal__gate', 'elevation', 'gate');
  app.drag(100, 100, 320, 100);
  const els = app.elements();
  assert.ok(els.length > 30, 'la cancela conserva hojas, pilastras y ornamentación');
  assert.ok(els.some(el => el.type === 'circle'), 'el abanico imperial conserva su rosetón');
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.gateView, 'elevation');
  assert.equal(prefs.gateType, 'convexFan');
  assert.equal(prefs.gateHeightCm, 350);
});

test('Cancela: preferencias inválidas se ignoran o se acotan al rango', () => {
  const app = loadApp({ prefs: {
    gateView: 'perspective', gateType: 'automatic', gateHeightCm: 999,
  } });
  assert.equal(app.$('gate-type').value, 'concave');
  assert.equal(app.$('gate-height').value, '350');
  app.selectTool('cancela');
  const active = app.$('gate-catalog').querySelector('.modal__shape--active');
  assert.equal(active.dataset.gate, 'elevation');
});

/* ---------------- resize de grupo ---------------- */

// Caja envolvente de una escena leída del autosave (los elementos son planos).
function sceneBounds(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  els.forEach(e => {
    const xs = [e.x, e.x1, e.x2].filter(v => typeof v === 'number');
    const ys = [e.y, e.y1, e.y2].filter(v => typeof v === 'number');
    if (typeof e.x === 'number' && typeof e.w === 'number') xs.push(e.x + e.w);
    if (typeof e.y === 'number' && typeof e.h === 'number') ys.push(e.y + e.h);
    xs.forEach(v => { x1 = Math.min(x1, v); x2 = Math.max(x2, v); });
    ys.forEach(v => { y1 = Math.min(y1, v); y2 = Math.max(y2, v); });
  });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// Desde que Edificios y Jardín crean grupos, casi todo lo que se dibuja es una
// multi-selección, y el resize solo existía para un elemento suelto: en la
// práctica el redimensionado había desaparecido de la app.
test('un grupo seleccionado se redimensiona arrastrando una esquina', () => {
  const app = loadApp();
  app.selectTool('muro');
  app.drag(200, 200, 500, 320);
  const before = sceneBounds(app.elements());

  app.selectTool('select');
  app.click(350, 260);                       // selecciona el grupo entero
  // El handle vive en la esquina del marco de selección (bounds + 4)
  app.drag(before.x + before.w + 4, before.y + before.h + 4,
           before.x + before.w + 204, before.y + before.h + 204);

  const after = sceneBounds(app.elements());
  assert.ok(after.w > before.w + 20, `el grupo debe ensancharse (${before.w} -> ${after.w})`);
  assert.ok(after.h > before.h + 20, `el grupo debe crecer en alto (${before.h} -> ${after.h})`);
});

// El escalado del grupo es UNIFORME a propósito: dentro viaja de todo, y un
// estirón libre rompería invariantes ajenas —un polígono regular exige w === h
// e isValidElement RECHAZA al importar los que no lo cumplen—, de modo que el
// proyecto podría quedar imposible de volver a abrir.
test('el resize de grupo conserva la proporción y no invalida las piezas', () => {
  const app = loadApp();
  app.selectTool('muro');
  app.drag(200, 200, 500, 320);
  const before = sceneBounds(app.elements());

  app.selectTool('select');
  app.click(350, 260);
  // Arrastre deliberadamente desproporcionado: mucho en x, poco en y
  app.drag(before.x + before.w + 4, before.y + before.h + 4,
           before.x + before.w + 300, before.y + before.h + 20);

  const after = sceneBounds(app.elements());
  // Sin esta comprobación el test sería vacuo: si el grupo no se escalara en
  // absoluto, la proporción «se conservaría» por no haber cambiado nada.
  assert.ok(after.w > before.w + 20,
    `el arrastre tiene que haber escalado de verdad (${before.w} -> ${after.w})`);
  const r0 = before.w / before.h, r1 = after.w / after.h;
  assert.ok(Math.abs(r1 - r0) < 0.01,
    `la proporción debe mantenerse (${r0.toFixed(3)} -> ${r1.toFixed(3)})`);

  const { Exporter } = require('./helpers/load.js').loadAll();
  const bad = app.elements().filter(el => !Exporter.isValidElement(el));
  assert.equal(bad.length, 0,
    'toda pieza escalada debe seguir siendo válida para reimportar');
});

// Los handles caen justo sobre las esquinas del marco combinado, que es
// también la zona desde la que se arrastra el grupo. Si el hit-test del
// handle no fuera primero, agarrar una esquina movería en vez de escalar.
test('arrastrar por dentro del marco sigue moviendo el grupo, no escalándolo', () => {
  const app = loadApp();
  app.selectTool('muro');
  app.drag(200, 200, 500, 320);
  const before = sceneBounds(app.elements());

  app.selectTool('select');
  app.click(350, 260);
  app.drag(350, 260, 400, 300);              // por dentro, lejos de las esquinas

  const after = sceneBounds(app.elements());
  assert.ok(Math.abs(after.w - before.w) < 0.5 && Math.abs(after.h - before.h) < 0.5,
    'mover no debe cambiar el tamaño');
  assert.ok(Math.abs((after.x - before.x) - 50) < 0.5, 'debe haberse desplazado 50px en x');
});

/* ══════════════════════════════════════════════════════════════
   «Select» (v2.11.0) — herramienta de SOLO selección: el clic
   selecciona con la misma semántica que Mover y el arrastre dibuja
   SIEMPRE marquesina, incluso naciendo encima de un elemento — el
   gesto que con Mover lo movería. Nada se desplaza jamás con ella.
   ══════════════════════════════════════════════════════════════ */

test('«Select»: el clic selecciona (Supr borra) y el clic en vacío deselecciona', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.drag(300, 50, 400, 150);
  app.selectTool('pick');
  app.click(100, 100);           // selecciona el primero
  app.click(700, 500);           // vacío: deselecciona
  app.key('Delete');
  assert.equal(app.elements().length, 2, 'tras el clic en vacío, Supr no borra nada');
  app.click(100, 100);
  app.key('Delete');
  const els = app.elements();
  assert.equal(els.length, 1, 'el clic seleccionó el rect y Supr lo borró');
  assert.equal(els[0].x, 300, 'sobrevive el otro rect');
});

test('«Select»: arrastrar desde ENCIMA de un elemento no lo mueve — dibuja marquesina', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.drag(300, 50, 400, 150);
  app.selectTool('pick');
  // El arrastre nace sobre el primer rect y cruza hasta cubrir el segundo:
  // con Mover esto desplazaría el rect; con «Select» enmarca y selecciona.
  app.drag(100, 100, 450, 200);
  const els = app.elements();
  assert.deepEqual(els.map(e => e.x).sort((a, b) => a - b), [50, 300],
    'ningún elemento debe haberse movido');
  app.key('Delete');
  assert.equal(app.elements().length, 0, 'la marquesina seleccionó los dos');
});

test('«Select»: el clic selecciona el grupo completo y el doble clic desciende a la pieza', () => {
  const { app, count } = withFacade();
  app.selectTool('pick');
  app.click(100, 100);           // el edificio entero
  app.dblclick(100, 100);        // desciende a la pieza bajo el cursor
  app.key('Delete');
  assert.equal(app.elements().length, count - 1,
    'se borra solo la pieza aislada por doble clic');
});

test('«Select» respeta «Los clics acumulan selección»: añade, y el clic repetido retira', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 90, 90);
  app.drag(300, 300, 340, 340);
  app.selectTool('pick');
  toggle(app, 'select-modal-multi');
  app.click(70, 70);
  app.click(320, 320);           // añade: no sustituye
  app.click(320, 320);           // clic repetido: retira
  app.key('Delete');
  const els = app.elements();
  assert.equal(els.length, 1, 'solo seguía seleccionado el primero');
  assert.equal(els[0].x, 300, 'sobrevive el retirado de la selección');
});

test('«Select»: el doble clic sobre un texto suelto NO abre el editor (solo selecciona)', () => {
  const app = loadApp();
  app.selectTool('text');
  app.click(200, 200);
  const input = app.$('text-input');
  input.value = 'hola';
  input.__fire('blur', { target: input });
  app.flush();
  assert.equal(app.elements().length, 1, 'hay un texto');
  app.selectTool('pick');
  app.dblclick(202, 208);        // sobre el texto
  app.flush();
  assert.equal(input.hidden, true, 'el editor no debe abrirse con «Select»');
  assert.equal(app.elements()[0].value, 'hola', 'el texto queda intacto');
});

/* ── Regresión (v2.12.0): pulsar «Mover» vaciaba la selección. Enmarcabas
   varios objetos con «Select», pulsabas Mover para moverlos y el arrastre
   solo movía aquel sobre el que caía el puntero: la selección ya no existía.
   Mover y «Select» son las dos herramientas que trabajan SOBRE la selección
   (SELECTION_TOOLS), así que ninguna la vacía al elegirla. ── */

test('seleccionar varios con «Select» y pulsar Mover los mueve TODOS a la vez', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.drag(300, 50, 400, 150);
  app.selectTool('pick');
  app.drag(20, 20, 500, 200);          // marquesina sobre los dos
  app.selectTool('select');            // ← pulsar «Mover»: la selección sobrevive
  app.drag(100, 100, 200, 100);        // arrastrar desde encima de uno de ellos
  const xs = app.elements().map(e => Math.round(e.x)).sort((a, b) => a - b);
  assert.deepEqual(xs, [150, 400], 'los dos rects debían moverse 100px como unidad');
});

test('y al revés: con varios seleccionados en Mover, pulsar «Select» tampoco los suelta', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.drag(300, 50, 400, 150);
  app.selectTool('select');
  app.drag(20, 20, 500, 200);          // marquesina de Mover sobre los dos
  app.selectTool('pick');
  app.key('Delete');
  assert.equal(app.elements().length, 0,
    'la selección debe seguir viva tras cambiar a «Select»');
});

test('una herramienta de creación sigue vaciando la selección al elegirla', () => {
  // El arreglo es para las dos de Edición, no una vuelta al «no vaciar nunca»:
  // con un rect seleccionado, pulsar Círculo deselecciona como siempre.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.selectTool('select');
  app.click(100, 100);
  app.selectTool('circle');
  app.key('Delete');
  assert.equal(app.elements().length, 1, 'Supr no debe borrar nada: no hay selección');
});

/* ══════════════════════════════════════════════════════════════
   Editar VARIOS elementos a la vez (v2.12.0). Color, grosor y
   relleno ya se aplicaban a toda la selección, pero el panel no
   lo enseñaba y el ratón no podía escalarla si no era un grupo.
   ══════════════════════════════════════════════════════════════ */

/** Dibuja dos rects sueltos y los deja seleccionados con Mover. */
function twoSelectedRects() {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.drag(300, 50, 400, 150);
  app.selectTool('select');
  app.drag(20, 20, 500, 200);          // marquesina sobre los dos
  return app;
}

/** Mueve un control del panel como lo haría el usuario (input + change). */
function setControl(app, id, value) {
  const el = app.$(id);
  el.value = value;
  el.__fire('input', { target: el });
  el.__fire('change', { target: el });
  app.flush();
}

test('varios elementos sueltos se redimensionan arrastrando la esquina de su marco', () => {
  const app = twoSelectedRects();
  // La caja combinada es (50,50)-(400,150): se agarra su esquina inferior derecha.
  app.drag(400, 150, 750, 400);
  const els = app.elements();
  assert.ok(els.every(e => e.w > 150),
    `los dos rects debían crecer, no solo uno (${els.map(e => Math.round(e.w))})`);
  // Uniforme, como el resize de grupo: un estirón libre rompería invariantes
  // de piezas que la selección puede contener (un polígono exige w === h).
  els.forEach(e => assert.ok(Math.abs(e.w / e.h - 1) < 0.01,
    'el rect era cuadrado y debe seguir siéndolo: la escala es uniforme'));
  const { Exporter } = require('./helpers/load.js').loadAll();
  assert.equal(app.elements().filter(el => !Exporter.isValidElement(el)).length, 0,
    'toda pieza escalada debe seguir siendo válida para reimportar');
});

test('arrastrar por el centro del marco combinado sigue moviendo, no escalando', () => {
  const app = twoSelectedRects();
  const before = app.elements().map(e => Math.round(e.w));
  app.drag(225, 100, 325, 100);        // por dentro, lejos de las esquinas
  const els = app.elements();
  assert.deepEqual(els.map(e => Math.round(e.w)), before, 'mover no cambia el tamaño');
  assert.deepEqual(els.map(e => Math.round(e.x)).sort((a, b) => a - b), [150, 400],
    'los dos se desplazaron 100px');
});

test('con varios seleccionados, color, grosor y relleno se cambian a la vez', () => {
  const app = twoSelectedRects();
  setControl(app, 'color-picker', '#ff0000');
  setControl(app, 'shape-modal-slider', '7');   // el grosor dejó el panel en la v2.21.0
  const check = app.$('check-fill');
  check.checked = true;
  check.__fire('change', { target: check });
  app.flush();
  const els = app.elements();
  assert.deepEqual(els.map(e => e.color), ['#ff0000', '#ff0000'], 'los dos recoloreados');
  assert.deepEqual(els.map(e => e.lineWidth), [7, 7], 'los dos con el grosor nuevo');
  assert.deepEqual(els.map(e => e.fill), [true, true], 'los dos rellenados');
});

test('el panel enseña el valor común de la selección, y no lo inventa si discrepan', () => {
  const app = twoSelectedRects();
  setControl(app, 'color-picker', '#ff0000');   // los dos rojos
  const check = app.$('check-fill');
  check.checked = true;
  check.__fire('change', { target: check });    // y los dos rellenos
  app.flush();
  app.click(700, 700);                          // deseleccionar
  app.drag(20, 20, 500, 200);                   // volver a seleccionarlos
  assert.equal(app.$('color-picker').value, '#ff0000',
    'con los dos rojos, el panel debe decir rojo (antes enseñaba el default)');
  assert.equal(app.$('check-fill').checked, true, 'y el relleno común');
  // El grosor ya no se comprueba aquí: dejó el panel en la v2.21.0 y sus mandos
  // están en los modales, que se sincronizan al abrirse. Que un cambio de
  // grosor alcanza a TODA la selección lo cubre el test de arriba.

  // Ahora uno azul: sin valor común, el control se queda como estaba en vez
  // de enseñar el del primero como si fuera el de todos.
  app.click(350, 100);
  setControl(app, 'color-picker', '#0000ff');
  const antes = app.$('color-picker').value;
  app.drag(20, 20, 500, 200);
  assert.equal(app.$('color-picker').value, antes,
    'con colores dispares el picker no debe inventar un color de la selección');
});

/* ── Regresión (v2.12.1): lanzar un objeto fuera del lienzo lo perdía.
   Seguía en la escena y en el archivo exportado, pero invisible e
   inalcanzable: ni el clic ni una marquesina que cubriera todo el lienzo
   llegan ahí fuera, así que solo Ctrl+Z lo recuperaba —y solo si te dabas
   cuenta en el momento—. Ahora clampDelta deja siempre KEEP_VISIBLE px
   dentro, en las tres vías que mueven una selección. ── */

/** ¿Asoma la caja del elemento por el lienzo de 1200×800? */
const onCanvas = e => {
  const x = e.x !== undefined ? e.x : Math.min(e.x1, e.x2);
  const y = e.y !== undefined ? e.y : Math.min(e.y1, e.y2);
  const w = e.w !== undefined ? e.w : Math.abs(e.x2 - e.x1);
  const h = e.h !== undefined ? e.h : Math.abs(e.y2 - e.y1);
  return x + w > 0 && x < 1200 && y + h > 0 && y < 800;
};

test('lanzar un objeto fuera del lienzo lo frena en el borde, y sigue siendo alcanzable', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.selectTool('select');
  app.click(100, 100);
  app.drag(100, 100, 2000, 1600);        // lanzarlo lejos, muy fuera
  const el = app.elements()[0];
  assert.ok(onCanvas(el), `el rect debe seguir asomando (x=${Math.round(el.x)}, y=${Math.round(el.y)})`);
  // Y «alcanzable» es literal: una marquesina sobre el lienzo vuelve a cogerlo.
  app.click(600, 400);                   // deseleccionar
  app.drag(1, 1, 1199, 799);
  app.key('Delete');
  assert.equal(app.elements().length, 0, 'debe poder volver a seleccionarse y borrarse');
});

test('el freno del borde vale también para las teclas de flecha', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.selectTool('select');
  app.click(100, 100);
  for (let i = 0; i < 40; i++) app.key('ArrowLeft', { shiftKey: true });   // 40 × 20px
  assert.ok(onCanvas(app.elements()[0]), 'mantener la flecha no debe expulsar el elemento');
});

test('el freno del borde no deforma un grupo: se para entero', () => {
  const { app, count } = withFacade();
  app.selectTool('select');
  app.click(150, 150);
  const before = app.elements();
  app.drag(150, 150, 3000, 2000);
  const after = app.elements();
  assert.equal(after.length, count, 'no se pierde ninguna pieza');
  assert.ok(after.some(onCanvas), 'el edificio debe seguir a la vista');
  // Todas las piezas se han desplazado LO MISMO: el freno actúa sobre la caja
  // combinada, nunca pieza a pieza (eso desmontaría la composición).
  const deltas = after.map((e, i) => Math.round(dx(before[i], e)));
  assert.equal(new Set(deltas).size, 1,
    `todas las piezas debían moverse igual, hubo ${new Set(deltas).size} desplazamientos distintos`);
});

test('una X tecleada fuera del lienzo también se frena, y el campo lo confiesa', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.selectTool('select');
  app.click(100, 100);
  const x = app.$('el-x');
  x.value = '9000';
  x.__fire('change', { target: x });
  app.flush();
  const el = app.elements()[0];
  assert.ok(onCanvas(el), 'teclear una X imposible no puede perder el elemento');
  assert.equal(app.$('el-x').value, String(Math.round(el.x)),
    'el campo debe resincronizarse a donde el elemento ha quedado de verdad');
});

test('un elemento que YA estaba fuera puede volver hacia dentro', () => {
  // Un JSON de antes de esta versión puede traerlos: el freno solo limita el
  // movimiento que empeora, así que traerlo de vuelta sigue siendo posible.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 150, 150);
  app.selectTool('select');
  app.click(100, 100);
  app.drag(100, 100, 2000, 100);         // pegado al borde derecho
  const atEdge = app.elements()[0].x;
  app.drag(1190, 100, 900, 100);         // arrastrar hacia dentro
  assert.ok(app.elements()[0].x < atEdge - 100, 'debe poder volver hacia el centro');
});

/* ══════════════════════════════════════════════════════════════
   Letra del lienzo elegible (v2.13.0). Las familias viajan autoalojadas
   y el selector vive en el panel y en #modal-text. El rótulo dejó de
   decir «manuscrita» en la 2.15.0: dos de las siete no lo son.
   ══════════════════════════════════════════════════════════════ */

test('los dos selectores de letra ofrecen el catálogo entero y son gemelos', () => {
  const app = loadApp();
  const { SKETCH_FONTS } = loadAll();
  const ids = [...SKETCH_FONTS].map(f => f.id);
  for (const sel of ['sketch-font', 'text-modal-font']) {
    const opts = [...app.$(sel).children].map(o => o.value);
    assert.deepEqual([...opts], ids,
      `#${sel} debe ofrecer las mismas familias, y en el mismo orden`);
  }
  // Cambiar uno mueve el otro: es el mismo ajuste global, no dos.
  const panel = app.$('sketch-font');
  panel.value = 'kalam';
  panel.__fire('change', { target: panel });
  app.flush();
  assert.equal(app.$('text-modal-font').value, 'kalam',
    'el gemelo del modal debe seguir al del panel');
});

test('la letra elegida se usa al dibujar y sobrevive a la recarga', () => {
  const app = loadApp();
  const sel = app.$('text-modal-font');
  sel.value = 'indie';
  sel.__fire('change', { target: sel });
  app.flush();
  // Lo que de verdad importa: con qué escribe el lienzo.
  assert.match(app.context.sketchFont(), /Indie Flower/,
    'el lienzo debe pasar a escribir con la familia elegida');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.sketchFontId, 'indie', 'la elección persiste en prefs');
  const reloaded = loadApp({ prefs });
  assert.equal(reloaded.$('sketch-font').value, 'indie',
    'y se restaura en los dos selectores');
  assert.equal(reloaded.$('text-modal-font').value, 'indie');
  assert.match(reloaded.context.sketchFont(), /Indie Flower/);
});

test('una letra guardada que ya no existe no deja el lienzo sin fuente', () => {
  // Un prefs de otra versión (o manipulado): se ignora y manda el default.
  const app = loadApp({ prefs: { sketchFontId: 'papiro-inexistente' } });
  const { SKETCH_FONTS } = loadAll();
  assert.equal(app.$('sketch-font').value, SKETCH_FONTS[0].id);
  assert.match(app.context.sketchFont(), /Architects Daughter/);
});

/* ══════════════════════════════════════════════════════════════
   Estilo del texto: negrita y sombras (v2.16.0). Los tres controles
   viven dos veces (panel y #modal-text) con la semántica dual.
   ══════════════════════════════════════════════════════════════ */

/** Escribe un texto en el lienzo y devuelve la app. */
function withText(app = loadApp(), x = 200, y = 200, valor = 'Hola') {
  app.selectTool('text');
  app.click(x, y);
  const input = app.$('text-input');
  input.value = valor;
  input.__fire('blur', { target: input });
  app.flush();
  return app;
}

test('sin selección, negrita y sombra son el estilo con el que NACE el texto', () => {
  const app = loadApp();
  app.selectTool('text');
  const bold = app.$('check-bold');
  bold.checked = true;
  bold.__fire('change', { target: bold });
  const shadow = app.$('text-modal-shadow');
  shadow.value = 'hard';
  shadow.__fire('change', { target: shadow });
  app.flush();

  withText(app, 300, 300, 'Titular');
  const el = app.elements()[0];
  assert.equal(el.bold, true, 'nace en negrita');
  assert.equal(el.shadow, 'hard', 'y con la sombra elegida');
  assert.ok(el.shadowColor, 'la sombra lleva su color: sin él se dibujaría con otro');
});

test('con un texto seleccionado, los mismos controles lo editan', () => {
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const bold = app.$('text-modal-bold');
  bold.checked = true;
  bold.__fire('change', { target: bold });
  const shadow = app.$('text-shadow');
  shadow.value = 'glow';
  shadow.__fire('change', { target: shadow });
  const color = app.$('text-modal-shadow-color');
  color.value = '#ff0000';
  color.__fire('input', { target: color });
  app.flush();

  const el = app.elements()[0];
  assert.equal(el.bold, true);
  assert.equal(el.shadow, 'glow');
  assert.equal(el.shadowColor, '#ff0000');
  // Y no ha tocado el default de creación: es edición, no configuración.
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs') || '{}');
  assert.notEqual(prefs.textShadow, 'glow', 'editar no debe reescribir el default');
});

test('quitar el estilo lo BORRA del elemento, no lo guarda en falso', () => {
  // Un texto sin negrita ni sombra debe serializarse como los de siempre: es
  // lo que mantiene idénticos los proyectos anteriores y no engorda el JSON.
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const bold = app.$('check-bold');
  bold.checked = true;
  bold.__fire('change', { target: bold });
  const shadow = app.$('text-shadow');
  shadow.value = 'soft';
  shadow.__fire('change', { target: shadow });
  app.flush();
  assert.equal(app.elements()[0].bold, true);

  bold.checked = false;
  bold.__fire('change', { target: bold });
  shadow.value = 'none';
  shadow.__fire('change', { target: shadow });
  app.flush();
  const el = app.elements()[0];
  assert.ok(!('bold' in el), 'sin negrita no debe quedar el campo');
  assert.ok(!('shadow' in el), 'ni el de sombra');
  assert.ok(!('shadowColor' in el), 'ni su color huérfano');
});

test('el estilo del texto sobrevive al round-trip de JSON', () => {
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const bold = app.$('check-bold');
  bold.checked = true;
  bold.__fire('change', { target: bold });
  const shadow = app.$('text-shadow');
  shadow.value = 'soft';
  shadow.__fire('change', { target: shadow });
  app.flush();
  const { Exporter } = require('./helpers/load.js').loadAll();
  const el = app.elements()[0];
  assert.equal(Exporter.isValidElement(el), true,
    'un texto con estilo debe poder reimportarse');
  assert.equal(Exporter.isValidElement({ ...el, shadow: 'inventada' }), false,
    'una sombra fuera del catálogo no: acabaría en el markup exportado');
  assert.equal(Exporter.isValidElement({ ...el, shadowColor: 'rojo' }), false,
    'ni un color que no sea hexadecimal');
  assert.equal(Exporter.isValidElement({ ...el, bold: 'sí' }), false);
});

test('el color de la sombra no se la pone a un texto que no la tiene', () => {
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const color = app.$('text-shadow-color');
  color.value = '#00ff00';
  color.__fire('input', { target: color });
  app.flush();
  const el = app.elements()[0];
  assert.ok(!('shadow' in el), 'tocar el color no debe estrenar una sombra');
  assert.ok(!('shadowColor' in el), 'ni dejar el color suelto');
});

test('con el Emoji activo se ocultan negrita y sombra: ahí no significan nada', () => {
  const app = loadApp();
  app.selectTool('text');
  assert.equal(app.$('row-text-bold').hidden, false, 'con Texto sí se ofrecen');
  app.selectTool('emoji');
  app.flush();
  assert.equal(app.$('row-text-bold').hidden, true);
  assert.equal(app.$('row-text-shadow').hidden, true);
  assert.equal(app.$('row-text-shadow-color').hidden, true);
});

/* ══════════════════════════════════════════════════════════════
   Auditoría v2.16.3: los tres defectos que la revisión encontró en
   el estilo de texto recién estrenado y en su gemelo del trazo.
   ══════════════════════════════════════════════════════════════ */

test('un arrastre por el color de la sombra es UN paso de deshacer, no uno por tono', () => {
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const shadow = app.$('text-shadow');
  shadow.value = 'soft';
  shadow.__fire('change', { target: shadow });
  app.flush();

  // 60 tonos en un solo gesto: MÁS que el límite de 50 del historial. El
  // diálogo nativo dispara un 'input' por cada tono que se pisa al arrastrar,
  // así que con el saveUndo() por evento con el que nació el control (v2.16.0)
  // este único arrastre expulsaba del historial todo el trabajo anterior.
  const color = app.$('text-shadow-color');
  for (let i = 1; i <= 60; i++) {
    color.value = '#0000' + String(i).padStart(2, '0');
    color.__fire('input', { target: color });
  }
  color.__fire('change', { target: color });
  app.flush();
  assert.equal(app.elements()[0].shadowColor, '#000060', 'el gesto tiñe el texto');

  app.key('z', { ctrlKey: true });
  app.flush();
  const el = app.elements()[0];
  assert.ok(!('shadowColor' in el), 'un solo Ctrl+Z revierte el gesto ENTERO');
  assert.equal(el.shadow, 'soft', 'y se detiene justo antes de él');

  app.key('z', { ctrlKey: true });
  app.flush();
  assert.ok(!('shadow' in app.elements()[0]),
    'el paso anterior sigue vivo: 60 tonos no pueden vaciar el historial');
});

test('ningún picker de color apila más de un paso de undo por gesto', () => {
  // El del trazo y el del relleno ya lo cumplían —cada uno con su comentario
  // advirtiéndolo—, y aun así el de la sombra nació sin el patrón. La guarda
  // cubre a los tres juntos para que el próximo picker no lo repita.
  const casos = [
    {
      nombre: 'trazo',
      picker: 'color-picker',
      campo: 'color',
      preparar: app => {
        app.selectTool('rect');
        app.drag(100, 100, 200, 200);
        app.selectTool('select');
        app.click(150, 150);
      },
    },
    {
      nombre: 'relleno',
      picker: 'fill-color-picker',
      campo: 'fillColor',
      preparar: app => {
        app.selectTool('rect');
        app.drag(100, 100, 200, 200);
        app.selectTool('select');
        app.click(150, 150);
      },
    },
    {
      nombre: 'sombra',
      picker: 'text-shadow-color',
      campo: 'shadowColor',
      preparar: app => {
        withText(app, 200, 200, 'Hola');
        app.selectTool('select');
        app.click(205, 210);
        const s = app.$('text-shadow');
        s.value = 'soft';
        s.__fire('change', { target: s });
      },
    },
  ];
  for (const caso of casos) {
    const app = loadApp();
    caso.preparar(app);
    app.flush();
    const antes = app.elements()[0][caso.campo];
    const picker = app.$(caso.picker);
    for (let i = 1; i <= 12; i++) {
      picker.value = '#0000' + String(i).padStart(2, '0');
      picker.__fire('input', { target: picker });
    }
    picker.__fire('change', { target: picker });
    app.flush();
    assert.equal(app.elements()[0][caso.campo], '#000012',
      `${caso.nombre}: el gesto sí aplica el último tono`);
    app.key('z', { ctrlKey: true });
    app.flush();
    assert.equal(app.elements()[0][caso.campo], antes,
      `${caso.nombre}: un solo Ctrl+Z devuelve al color previo al gesto`);
  }
});

test('cambiar el TIPO de sombra conserva el color propio del texto', () => {
  const app = withText();
  app.selectTool('select');
  app.click(205, 210);
  const shadow = app.$('text-shadow');
  shadow.value = 'soft';
  shadow.__fire('change', { target: shadow });
  const color = app.$('text-shadow-color');
  color.value = '#ff0000';
  color.__fire('input', { target: color });
  color.__fire('change', { target: color });
  app.flush();
  assert.equal(app.elements()[0].shadowColor, '#ff0000');

  shadow.value = 'glow';
  shadow.__fire('change', { target: shadow });
  app.flush();
  const el = app.elements()[0];
  assert.equal(el.shadow, 'glow', 'cambia el tipo...');
  assert.equal(el.shadowColor, '#ff0000',
    '...y NO el color: con selección el picker escribe en el elemento, así que'
    + ' el default de creación no puede pisarlo al cambiar de sombra');
});

test('con varios seleccionados el panel enseña su valor común, no los defaults', () => {
  const app = loadApp();
  // Tres flechas discontinuas y de doble punta.
  const dash = app.$('check-dash');
  dash.checked = true;
  dash.__fire('change', { target: dash });
  const doble = app.$('check-double-head');
  doble.checked = true;
  doble.__fire('change', { target: doble });
  app.selectTool('arrow');
  app.drag(100, 100, 200, 100);
  app.drag(100, 150, 200, 150);
  app.drag(100, 200, 200, 200);
  app.flush();
  assert.equal(app.elements().length, 3);
  assert.equal(app.elements()[0].dash, true);
  assert.equal(app.elements()[0].heads, 'both');

  // Los defaults de creación se apagan DESPUÉS: lo dibujado no cambia.
  dash.checked = false;
  dash.__fire('change', { target: dash });
  doble.checked = false;
  doble.__fire('change', { target: doble });
  app.flush();
  assert.equal(app.elements()[0].dash, true, 'apagar el default no toca lo dibujado');

  // Seleccionar las tres y pulsar su herramienta abre #modal-stroke con la
  // selección viva (v2.10.0). Ahí syncStrokeControls caía a los defaults y los
  // escribía en las casillas del PANEL, pisando en cada frame el valor común
  // que redrawNow acababa de calcular: las tres flechas se anunciaban
  // continuas y sin punta doble.
  app.selectTool('select');
  app.key('a', { ctrlKey: true });
  app.selectTool('arrow');
  app.flush();
  assert.equal(app.$('modal-stroke').open, true, 'el modal está abierto');
  assert.equal(app.$('check-dash').checked, true,
    'el panel enseña el discontinuo que comparten las tres');
  assert.equal(app.$('check-double-head').checked, true,
    'y su doble punta');
  assert.equal(app.$('stroke-modal-dash').checked, true, 'el gemelo del modal, igual');
  assert.equal(app.$('stroke-modal-double').checked, true);
});

/* ══════════════════════════════════════════════════════════════
   «Los clics acumulan selección» pasa del panel a los ajustes de
   «Select» (v2.17.0).
   ══════════════════════════════════════════════════════════════ */

test('pulsar «Select» abre sus ajustes con la casilla de acumular', () => {
  const app = loadApp();
  app.selectTool('pick');
  assert.equal(app.$('modal-select').open, true, '«Select» abre su modal al elegirla');
  assert.equal(app.$('select-modal-multi').checked, false, 'y enseña el estado actual');

  // Se cierra por su BOTÓN, no llamando a close(): cada modal cablea el suyo a
  // mano, y uno sin cablear no se puede cerrar — con el lienzo inerte detrás,
  // eso es la app bloqueada (v2.16.2). Cerrarlo deja además la herramienta
  // puesta: no hay nada que elegir, así que no pasa por opensVariantModal
  // (mismo criterio que el borrador y el Emoji).
  const cerrar = app.$('modal-select').querySelector('.modal__cancel');
  cerrar.__fire('click', { target: cerrar });
  app.flush();
  assert.equal(app.$('modal-select').open, false, 'el botón «Cerrar» lo cierra de verdad');
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool,
    'pick', 'cerrar no devuelve a la herramienta anterior');
});

test('Mover abre los mismos ajustes, y el ⚙ de «Elementos» los reabre', () => {
  const app = loadApp();
  // La casilla gobierna el clic de las DOS herramientas de Edición, así que
  // las dos la enseñan al elegirlas (v2.18.0).
  app.selectTool('select');
  assert.equal(app.$('modal-select').open, true, 'elegir Mover abre sus ajustes');
  const cerrar = app.$('modal-select').querySelector('.modal__cancel');
  cerrar.__fire('click', { target: cerrar });
  app.flush();
  assert.equal(app.$('modal-select').open, false);

  // Desde la v2.21.0 ese ⚙ es el de la cabecera «Elementos», y está con
  // CUALQUIER herramienta: la casilla que abre gobierna el clic, no el dibujo.
  assert.equal(app.$('btn-selection-settings').hidden, false, 'el ⚙ de «Elementos» sigue ahí');
  app.$('btn-selection-settings').__fire('click', { target: app.$('btn-selection-settings') });
  app.flush();
  assert.equal(app.$('modal-select').open, true, 'y lo reabre sin soltar la herramienta');
  assert.equal(app.$('modal-eraser').open, false, 'no el del borrador');
  assert.equal(app.$('modal-stroke').open, false, 'ni el del trazo');
});

test('Ctrl+A y pegar no abren el modal de selección', () => {
  // Los dos activan Mover por su cuenta. Si Mover abriera su modal —o si el ⚙
  // se confundiera con la apertura automática—, un atajo de teclado acabaría
  // sacando un diálogo que deja el lienzo inerte.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(50, 50, 90, 90);
  app.key('a', { ctrlKey: true });
  app.flush();
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool,
    'select', 'Ctrl+A pasa a Mover');
  assert.equal(app.$('modal-select').open, false, 'sin abrir ningún modal');
});

test('cancelar un catálogo que cae en Mover no encadena el modal de selección', () => {
  // Cancelar un catálogo cuya herramienta ANTERIOR era otro catálogo cae en
  // Mover: volver a la anterior reabriría un catálogo, que no es lo que pide
  // quien cancela. Desde la v2.18.0 Mover abre sus ajustes al elegirla, así que
  // ese retorno tiene que ser `silent` o saldría un segundo modal encima del
  // que se acaba de cerrar — justo lo que `silent` existe para evitar.
  const app = loadApp();
  app.selectTool('planta');
  app.selectTool('puerta');            // toolBeforeModal = 'planta'
  app.$('modal-door').close();         // cancelar sin elegir tipo
  app.flush();
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool,
    'select', 'cancelar una reentrada cae en Mover');
  assert.equal(app.$('modal-select').open, false,
    'y no abre sus ajustes encima del catálogo recién cerrado');
});

/* ────────────────────────────────────────────────────────────
   Aerógrafo (v2.22.0)
   ──────────────────────────────────────────────────────────── */

/** Elige el Aerógrafo y cierra su modal, que es lo que hace cualquiera antes
    de ponerse a pintar (un <dialog showModal> abierto deja el lienzo inerte). */
function withAirbrush(prefs) {
  const app = loadApp(prefs ? { prefs } : undefined);
  app.selectTool('airbrush');
  app.$('modal-airbrush').close();
  app.flush();
  return app;
}

/** Pone un mando del modal en un valor, con el gesto completo. */
function slide(app, id, valor) {
  const s = app.$(id);
  s.value = String(valor);
  s.__fire('input', { target: s });
  s.__fire('change', { target: s });
  app.flush();
}

test('elegir el Aerógrafo abre sus ajustes y cerrarlos deja la herramienta puesta', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.flush();
  assert.equal(app.$('modal-airbrush').open, false);
  app.selectTool('airbrush');
  assert.equal(app.$('modal-airbrush').open, true,
    'se abre solo al elegir la herramienta, como el Borrador y las de Dibujo');
  // Se cierra por el BOTÓN, no llamando a close(): olvidar cablear el
  // .modal__cancel no rompe ningún test que cierre por la API, y en el
  // navegador deja la app bloqueada tras un diálogo que no se puede cerrar.
  const cerrar = app.$('modal-airbrush').querySelector('.modal__cancel');
  cerrar.__fire('click', { target: cerrar });
  app.flush();
  assert.equal(app.$('modal-airbrush').open, false, 'el botón «Cerrar» tiene que cerrarlo');
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, 'airbrush',
    'cerrar los ajustes se queda en el Aerógrafo, no cae a la herramienta previa');
});

test('arrastrar con el Aerógrafo crea UNA mancha, sin campos que no hagan falta', () => {
  const app = withAirbrush();
  app.drag(200, 200, 400, 260);
  const els = app.elements();
  assert.equal(els.length, 1);
  assert.equal(els[0].type, 'airbrush');
  assert.ok(els[0].points.length >= 2, 'el eje se decima, como el del lápiz');
  assert.equal(typeof els[0].radius, 'number');
  assert.equal(typeof els[0].density, 'number');
  assert.equal(typeof els[0].seed, 'number');
  // La ausencia ES el aspecto por defecto: sin opacidad la pintura es sólida y
  // sin clip cubre todo el lienzo. Guardarlos igualmente engordaría cada mancha
  // de cada proyecto sin cambiar nada de lo que se ve.
  assert.equal('opacity' in els[0], false, 'al 100 % no se guarda la opacidad');
  assert.equal('clip' in els[0], false, 'sin área no se guarda el recorte');
  // Y es UN paso de deshacer.
  app.key('z', { ctrlKey: true });
  assert.deepEqual(app.elements(), []);
});

test('el modo área arma el siguiente arrastre: marca el rectángulo y NO pinta', () => {
  // El modal se deja ABIERTO a propósito: la comprobación es que armar el área
  // lo cierre, y partiendo de uno ya cerrado ese assert pasaría solo.
  const app = loadApp();
  app.selectTool('airbrush');
  assert.equal(app.$('modal-airbrush').open, true);
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  // Armar el área CIERRA el modal: si no, el usuario se queda mirando un
  // lienzo inerte esperando un arrastre que no puede hacer (v2.16.2).
  assert.equal(app.$('modal-airbrush').open, false,
    'elegir «solo dentro de un área» tiene que cerrar el diálogo');

  app.drag(100, 100, 400, 300);
  assert.deepEqual(app.elements(), [], 'ese arrastre marca el área, no pinta');
  // Y el área no es un elemento: no cuenta, no viaja en el JSON, no se deshace.
  assert.equal(String(app.$('el-count').textContent), '0');

  app.drag(150, 150, 350, 250);
  const els = app.elements();
  assert.equal(els.length, 1, 'a partir de aquí sí pinta');
  assert.deepEqual(els[0].clip, { x: 100, y: 100, w: 300, h: 200 });
});

test('una mancha cuyas gotas caen todas fuera del área no se crea', () => {
  // Sería un elemento invisible que cuenta en «Elementos» y viaja en el JSON.
  const app = withAirbrush();
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  app.drag(100, 100, 300, 250);   // marca el área
  app.drag(700, 600, 800, 700);   // pinta lejos de ella
  assert.deepEqual(app.elements(), [], 'fuera del área no queda pintura, así que no hay elemento');
  app.drag(150, 150, 250, 220);   // dentro sí
  assert.equal(app.elements().length, 1);
});

test('cambiar de herramienta cancela el armado del área', () => {
  // El armado pertenece al gesto del aerógrafo: si sobreviviera, el siguiente
  // arrastre con el lápiz se comería el gesto sin nada que lo explicase.
  const app = withAirbrush();
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  app.selectTool('pencil');
  app.$('modal-stroke').close();
  app.flush();
  app.drag(100, 100, 300, 300);
  const els = app.elements();
  assert.equal(els.length, 1);
  assert.equal(els[0].type, 'pencil', 'el lápiz dibuja, no marca áreas');
});

test('«Quitar el área» la borra y la mancha siguiente vuelve a cubrir el lienzo', () => {
  const app = withAirbrush();
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  app.drag(100, 100, 400, 300);
  const quitar = app.$('btn-airbrush-clear-area');
  quitar.__fire('click', { target: quitar });
  app.flush();
  app.drag(600, 500, 700, 560);
  const els = app.elements();
  assert.equal(els.length, 1);
  assert.equal('clip' in els[0], false, 'sin área, la mancha no lleva recorte');
});

test('los ajustes del aerógrafo se recuerdan al recargar, área incluida', () => {
  const app = withAirbrush();
  slide(app, 'airbrush-modal-radius', 80);   // el mando es el diámetro
  slide(app, 'airbrush-modal-density', 90);
  slide(app, 'airbrush-modal-opacity', 40);
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  app.drag(60, 60, 500, 400);

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.airbrushRadius, 40, 'el elemento guarda el RADIO, el mando enseña el diámetro');
  assert.equal(prefs.airbrushDensity, 90);
  assert.equal(prefs.airbrushOpacity, 0.4);
  assert.equal(prefs.airbrushAreaMode, 'area');
  assert.deepEqual(prefs.airbrushArea, { x: 60, y: 60, w: 440, h: 340 });

  const app2 = withAirbrush(prefs);
  assert.equal(app2.$('airbrush-modal-radius').value, '80');
  assert.equal(app2.$('airbrush-modal-opacity').value, '40');
  app2.drag(100, 100, 300, 200);
  const el = app2.elements()[0];
  assert.equal(el.radius, 40);
  assert.equal(el.opacity, 0.4);
  assert.deepEqual(el.clip, { x: 60, y: 60, w: 440, h: 340 });
});

test('pulsar Aerógrafo con una mancha seleccionada la conserva y la edita', () => {
  const app = withAirbrush();
  app.drag(200, 200, 400, 260);
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(300, 230);
  assert.equal(app.$('panel-sec-element').hidden, false, 'la mancha queda seleccionada');
  app.selectTool('airbrush');
  assert.equal(app.$('modal-airbrush').open, true);
  assert.equal(app.$('panel-sec-element').hidden, false,
    'pulsar su herramienta la edita en vez de deseleccionarla (MODAL_EDIT_TYPE)');
  // Y el mando edita la mancha, no el default de creación.
  slide(app, 'airbrush-modal-density', 100);
  assert.equal(app.elements()[0].density, 100);
});

test('un arrastre por el deslizador de densidad es UN paso de deshacer, no uno por valor', () => {
  // El historial son 50 pasos: 60 valores intermedios lo vaciarían entero y se
  // llevarían por delante el trabajo del usuario, en silencio.
  const app = withAirbrush();
  app.drag(200, 200, 400, 260);
  const antes = app.elements();
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(300, 230);

  const s = app.$('airbrush-modal-density');
  for (let v = 10; v <= 120; v += 2) {   // 56 valores, por encima del límite de 50
    s.value = String(v);
    s.__fire('input', { target: s });
  }
  s.__fire('change', { target: s });
  app.flush();
  assert.equal(app.elements()[0].density, 120, 'el arrastre deja el último valor');
  app.key('z', { ctrlKey: true });
  assert.deepEqual(app.elements(), antes, 'y UN solo Ctrl+Z lo devuelve todo');
});

test('la opacidad al 100 % BORRA el campo del elemento, no lo guarda en 1', () => {
  const app = withAirbrush();
  slide(app, 'airbrush-modal-opacity', 35);
  app.drag(200, 200, 400, 260);
  assert.equal(app.elements()[0].opacity, 0.35);
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(300, 230);
  slide(app, 'airbrush-modal-opacity', 100);
  assert.equal('opacity' in app.elements()[0], false,
    'sólido = sin campo, igual que quitar la sombra de un texto lo borra');
});

test('el resize de una mancha conserva la proporción y escala su boquilla', () => {
  const app = withAirbrush();
  app.drag(200, 200, 400, 300);
  const antes = app.elements()[0];
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(300, 250);
  // Teclear una medida no puede permitir lo que arrastrar prohíbe: la boquilla
  // es UN escalar y no existe la boquilla elíptica.
  const w = app.$('el-w');
  const alto0 = Number(app.$('el-h').value);
  w.value = String(Math.round(Number(w.value) * 2));
  w.__fire('change', { target: w });
  app.flush();
  const despues = app.elements()[0];
  assert.ok(despues.radius > antes.radius * 1.8, 'la boquilla escala con el dibujo');
  assert.ok(Number(app.$('el-h').value) > alto0 * 1.8, 'y el alto sigue al ancho');
  // El grano NO escala: su mando tiene rango fijo 1–8 y sacarlo de ahí lo
  // dejaría mintiendo sobre lo que hay dibujado.
  assert.equal(despues.lineWidth, antes.lineWidth);
});

test('mover una mancha se lleva su área con ella', () => {
  // Si el recorte se quedara quieto, mover el dibujo cambiaría lo que se ve de
  // él —el mismo defecto que tenía la máscara del borrador antiguo—.
  const app = withAirbrush();
  const sel = app.$('airbrush-area-mode');
  sel.value = 'area';
  sel.__fire('change', { target: sel });
  app.flush();
  app.drag(100, 100, 400, 300);
  app.drag(150, 150, 350, 250);
  const antes = app.elements()[0];
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(250, 200);
  app.drag(250, 200, 300, 240);
  const despues = app.elements()[0];
  assert.equal(Math.round(despues.clip.x - antes.clip.x), Math.round(despues.points[0].x - antes.points[0].x),
    'el área se desplaza lo mismo que la mancha');
  assert.equal(despues.clip.w, antes.clip.w);
});

test('la paleta de los ajustes del aerógrafo cambia el color, y el activo se ve en las dos', () => {
  const app = withAirbrush();
  const rejilla = app.$('airbrush-color-grid');
  const muestras = rejilla.querySelectorAll('.panel__color-swatch');
  assert.equal(muestras.length, 36, 'la rejilla del modal lleva los 36 colores');

  // Sin selección fija el default de creación, como la del panel.
  const azul = [...muestras].find(s => s.dataset.color === '#3498db');
  assert.ok(azul, 'falta el azul en la rejilla del modal');
  azul.__fire('click', { target: azul });
  app.flush();
  app.drag(200, 200, 350, 240);
  assert.equal(app.elements()[0].color, '#3498db');

  // El resaltado del color activo se reparte por CLASE, así que sale en las dos
  // rejillas sin que ninguna sepa de la otra.
  const activaEn = id => [...app.$(id).querySelectorAll('.panel__color-swatch')]
    .filter(s => s.classList.contains('panel__color-swatch--active'))
    .map(s => s.dataset.color);
  assert.deepEqual(activaEn('airbrush-color-grid'), ['#3498db']);
  assert.deepEqual(activaEn('color-grid'), ['#3498db'],
    'la del panel tiene que enseñar lo mismo: es el mismo color');
});

test('con una mancha seleccionada, la paleta del modal la recolorea en un solo paso', () => {
  const app = withAirbrush();
  app.drag(200, 200, 400, 260);
  const antes = app.elements();
  app.selectTool('select');
  app.$('modal-select').close();
  app.flush();
  app.click(300, 230);
  const rojo = [...app.$('airbrush-color-grid').querySelectorAll('.panel__color-swatch')]
    .find(s => s.dataset.color === '#e94560');
  rojo.__fire('click', { target: rojo });
  app.flush();
  assert.equal(app.elements()[0].color, '#e94560', 'edita la selección, no el default');
  app.key('z', { ctrlKey: true });
  assert.deepEqual(app.elements(), antes, 'y es UN paso de deshacer');
});

/* ── «Limpiar todo» deja la app como recién abierta (v2.22.1) ── */

/** Foto de TODOS los mandos de ajuste, leída del DOM (que es la única
    observabilidad sin hooks en producción). Cualquier ajuste nuevo debería
    entrar aquí: es lo que convierte «acordarse del botón» en un test. */
function fotoDeAjustes(app) {
  const v = id => app.$(id).value;
  const c = id => app.$(id).checked;
  return {
    color: v('color-picker'), grosor: v('stroke-modal-slider'), letra: v('font-slider'),
    relleno: c('check-fill'), translucido: c('check-fill-transparent'),
    opacidad: v('fill-opacity-slider'), colorRelleno: v('fill-color-picker'),
    discontinuo: c('check-dash'), doblePunta: c('check-double-head'),
    cuadricula: c('check-grid'), ajustar: c('check-snap'), acumular: c('select-modal-multi'),
    fuente: v('sketch-font'), negrita: c('check-bold'), sombra: v('text-shadow'),
    colorSombra: v('text-shadow-color'), emoji: v('emoji-modal-size'),
    aeroAncho: v('airbrush-modal-radius'), aeroOpacidad: v('airbrush-modal-opacity'),
    aeroArea: v('airbrush-area-mode'), borrador: v('eraser-size-modal-slider'),
    solapamiento: v('overlap-mode'), fondo: v('canvas-bg-picker'), rejilla: v('grid-color-picker'),
    plantas: v('build-floors'), tejado: v('build-roof-type'), camino: v('garden-path-width'),
    muro: v('wall-material'), verja: v('fence-type'), cancela: v('gate-type'),
  };
}

test('«Limpiar todo» devuelve TODOS los ajustes a los de fábrica, no solo unos cuantos', () => {
  // El botón promete la app recién abierta. Mantenía a mano una lista de
  // ajustes que se quedó atrás en dieciséis (color, grosor, tamaño de letra,
  // el relleno entero, discontinuo, doble punta, cuadrícula, ajustar a la
  // rejilla, clics acumulativos, la letra del lienzo y los tres del estilo de
  // texto). Ahora sale todo de appDefaults(), la misma fuente que el estado
  // inicial, así que la comparación es contra un arranque limpio de verdad.
  const fabrica = fotoDeAjustes(loadApp());

  const app = loadApp();
  const set = (id, valor) => {
    const e = app.$(id);
    e.value = String(valor);
    e.__fire('input', { target: e });
    e.__fire('change', { target: e });
    app.flush();
  };
  const marcar = (id, valor) => {
    const e = app.$(id);
    e.checked = valor;
    e.__fire('change', { target: e });
    app.flush();
  };
  const conHerramienta = (tool, modal, hacer) => {
    app.selectTool(tool);
    app.$(modal).close();
    app.flush();
    hacer();
  };

  set('color-picker', '#e94560');
  conHerramienta('rect', 'modal-shape', () => set('shape-modal-slider', 7));
  set('font-slider', 60);
  marcar('check-fill', true);
  marcar('check-fill-transparent', true);
  set('fill-opacity-slider', 80);
  set('fill-color-picker', '#27ae60');
  conHerramienta('arrow', 'modal-stroke', () => {
    marcar('check-dash', true);
    marcar('check-double-head', true);
  });
  marcar('check-grid', false);
  marcar('check-snap', true);
  marcar('select-modal-multi', true);
  set('sketch-font', 'kalam');
  conHerramienta('text', 'modal-text', () => {
    marcar('check-bold', true);
    set('text-shadow', 'soft');
    set('text-shadow-color', '#e94560');
  });
  set('emoji-modal-size', 80);
  conHerramienta('airbrush', 'modal-airbrush', () => {
    set('airbrush-modal-radius', 100);
    set('airbrush-modal-opacity', 40);
  });
  conHerramienta('eraser', 'modal-eraser', () => set('eraser-size-modal-slider', 70));
  // De vuelta a una herramienta que CREA: con el borrador puesto, el arrastre
  // de abajo borraría en vez de dejar algo que limpiar.
  app.selectTool('rect');
  app.$('modal-shape').close();
  app.flush();
  set('overlap-mode', 'hidden-dashed');
  set('canvas-bg-picker', '#ffffff');
  set('grid-color-picker', '#000000');
  set('build-floors', '4');
  set('build-roof-type', 'hip');
  set('garden-path-width', 60);
  set('wall-material', 'brick');
  app.drag(100, 100, 300, 300);
  assert.ok(app.elements().length > 0, 'la escena tiene que tener algo que limpiar');
  // Nada de lo tocado puede coincidir ya con fábrica, o el test no probaría nada.
  const tocados = Object.keys(fabrica)
    .filter(k => String(fabrica[k]) !== String(fotoDeAjustes(app)[k]));
  assert.ok(tocados.length >= 20,
    `hay que tocar de verdad los ajustes antes de limpiar (solo cambiaron ${tocados.length})`);

  app.$('btn-clear').__fire('click', { target: app.$('btn-clear') });
  app.flush();

  assert.deepEqual(app.elements(), [], 'la escena se vacía');
  // Y la herramienta vuelve al Lápiz, con la que arranca la app. En silencio:
  // nadie la ha pulsado, así que sus ajustes no deben abrirse encima.
  assert.equal(app.$('sidebar').querySelector('.sidebar__tool--active').dataset.tool, 'pencil');
  assert.equal(app.$('modal-stroke').open, false,
    'volver al Lápiz al limpiar no puede abrir un modal que nadie pidió');
  const despues = fotoDeAjustes(app);
  // El ASPECTO del lienzo es la excepción deliberada (v3.0.0): papel, color de
  // rejilla y si se ve sobreviven al borrado, porque describen la mesa de
  // trabajo y no el dibujo. Todo lo demás vuelve a fábrica.
  const ASPECTO = ['cuadricula', 'fondo', 'rejilla'];
  const supervivientes = Object.keys(fabrica)
    .filter(k => !ASPECTO.includes(k))
    .filter(k => String(fabrica[k]) !== String(despues[k]));
  assert.deepEqual(supervivientes, [],
    'estos ajustes sobrevivieron a «Limpiar todo» en vez de volver a fábrica');
  for (const k of ASPECTO) {
    assert.notEqual(String(despues[k]), String(fabrica[k]),
      `«${k}» es aspecto del lienzo: «Limpiar todo» debe respetarlo, no resetearlo`);
  }
});

/* ── «Limpiar todo» respeta el aspecto del lienzo (v3.0.0) ──
   El botón vacía el dibujo y devuelve los ajustes a fábrica, pero el papel no
   es un ajuste de dibujo: es cómo está puesta la mesa. Volver al azul de
   fábrica en cada limpieza obligaba a recomponer «Pizarra» o «Blanco» a mano,
   y el camino de vuelta son dos códigos de color que no aparecen en ninguna
   parte de la interfaz. */
test('«Limpiar todo» conserva el aspecto del lienzo, y lo deja guardado', () => {
  const app = loadApp();
  const poner = (id, valor) => {
    const e = app.$(id);
    e.value = String(valor);
    e.__fire('input', { target: e });
    e.__fire('change', { target: e });
    app.flush();
  };
  // «Pizarra»: papel oscuro, rejilla verdosa, con cuadrícula.
  poner('canvas-bg-picker', '#1f2b2a');
  poner('grid-color-picker', '#4e6b66');

  app.selectTool('rect');
  app.$('modal-shape').close();
  app.flush();
  app.drag(100, 100, 300, 300);
  app.flush();
  assert.ok(app.elements().length > 0);

  app.$('btn-clear').__fire('click', { target: app.$('btn-clear') });
  app.flush();

  assert.deepEqual(app.elements(), [], 'el dibujo sí se vacía');
  assert.equal(app.$('canvas-bg-picker').value, '#1f2b2a', 'el papel se queda');
  assert.equal(app.$('grid-color-picker').value, '#4e6b66', 'y el color de la rejilla');

  // Y sobrevive a la recarga: el botón borra la clave de prefs, así que el
  // aspecto conservado tiene que quedar reescrito en el acto o volvería al de
  // fábrica por el camino largo.
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.canvasBg, '#1f2b2a');
  assert.equal(prefs.gridColor, '#4e6b66');
  const app2 = loadApp({ prefs });
  assert.equal(app2.$('canvas-bg-picker').value, '#1f2b2a');
});

test('tras «Limpiar todo», el siguiente guardado no resucita los ajustes borrados', () => {
  // Los ajustes que se persisten seguían vivos en `state` aunque el botón
  // borrase la clave de localStorage, así que el primer savePrefs() posterior
  // —cambiar el color del fondo, por ejemplo— los reescribía enteros y volvían
  // en la recarga siguiente.
  const app = loadApp();
  app.selectTool('airbrush');
  app.$('modal-airbrush').close();
  app.flush();
  const radio = app.$('airbrush-modal-radius');
  radio.value = '100';
  radio.__fire('input', { target: radio });
  radio.__fire('change', { target: radio });
  const fuente = app.$('sketch-font');
  fuente.value = 'kalam';
  fuente.__fire('change', { target: fuente });
  app.flush();

  app.$('btn-clear').__fire('click', { target: app.$('btn-clear') });
  app.flush();
  // Un cambio cualquiera que dispare savePrefs
  const fondo = app.$('canvas-bg-picker');
  fondo.value = '#ffffff';
  fondo.__fire('input', { target: fondo });
  fondo.__fire('change', { target: fondo });
  app.flush();

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.airbrushRadius, 24, 'el radio guardado vuelve a ser el de fábrica');
  assert.equal(prefs.sketchFontId, 'architects', 'y la letra también');
  // Y al arrancar con esas prefs, la app sale de fábrica salvo el fondo.
  const app2 = loadApp({ prefs });
  app2.selectTool('airbrush');
  assert.equal(app2.$('airbrush-modal-radius').value, '48', 'el mando enseña el diámetro de fábrica');
  assert.equal(app2.$('sketch-font').value, 'architects');
});

// v2.23.0: con una forma que guarda su orientación como ángulo, ←/→ pasan de
// una orientación válida a la siguiente. Se cobra el nudge horizontal de esas
// formas, así que exige que TODA la selección sea rotable: con un rectángulo o
// un texto dentro, las cuatro flechas siguen moviendo como siempre.
test('←/→ giran la forma seleccionada, y solo si toda la selección es rotable', () => {
  const app = loadApp();

  app.selectTool('pentagon');
  app.drag(300, 300, 380, 380);
  app.flush();
  assert.equal(app.elements().length, 1);

  app.selectTool('select');
  app.click(300, 300);
  app.flush();
  const antes = app.elements()[0];
  assert.equal(antes.rotation, undefined, 'nace sin campo rotation');

  app.key('ArrowRight');
  app.flush();
  assert.equal(app.elements()[0].rotation, 36, 'una pulsación, un paso del pentágono');
  assert.equal(app.elements()[0].x, antes.x, 'girar no mueve');
  assert.equal(app.elements()[0].y, antes.y);

  app.key('ArrowLeft');
  app.flush();
  assert.equal(app.elements()[0].rotation, undefined,
    '← deshace el paso: los dos sentidos son inversos exactos');

  // ↑/↓ siguen moviendo la misma forma.
  app.key('ArrowDown');
  app.flush();
  assert.equal(app.elements()[0].y, antes.y + 1, '↓ sigue siendo el nudge');

  // Con un rectángulo también seleccionado, ←/→ vuelven a mover.
  app.selectTool('rect');
  app.drag(600, 300, 700, 360);
  app.flush();
  app.selectTool('pick');
  app.drag(250, 250, 760, 420);   // marquesina sobre los dos
  app.flush();
  assert.equal(app.elements().length, 2);

  const pentagono = app.elements().find(el => el.type === 'pentagon');
  const rect = app.elements().find(el => el.type === 'rect');
  app.key('ArrowRight');
  app.flush();
  const despues = app.elements();
  assert.equal(despues.find(el => el.type === 'pentagon').rotation, undefined,
    'con un rect en la selección, → no gira');
  assert.equal(despues.find(el => el.type === 'pentagon').x, pentagono.x + 1, 'mueve');
  assert.equal(despues.find(el => el.type === 'rect').x, rect.x + 1);
});

/* ── 3D: un arrastre, un grupo, un paso de deshacer ── */

test('un sólido nace como grupo, con un solo paso de deshacer, y se selecciona entero', () => {
  const app = loadApp();
  app.selectTool('prisma');          // el modal se abre, pero no bloquea el arnés
  app.drag(200, 200, 320, 320);
  app.flush();
  const els = app.elements();
  assert.ok(els.length > 2, 'un prisma son varias piezas');

  // Grupo: todas comparten un mismo buildingGroupId (el campo se llama así por
  // historia; vale para cualquier herramienta compuesta).
  const gid = els[0].buildingGroupId;
  assert.ok(gid, 'las piezas deben compartir buildingGroupId');
  assert.ok(els.every(e => e.buildingGroupId === gid), 'todas del mismo grupo');

  // La cara frontal es un elemento de forma REAL, no una polilínea: es lo que
  // le da relleno, hit-test por silueta y exportación sin código propio.
  assert.ok(els.some(e => e.type === 'rect'), 'falta la cara frontal');
  assert.ok(els.some(e => e.type === 'line' && e.dash === true),
    'faltan las aristas ocultas discontinuas');

  // UN paso de deshacer para todo el sólido
  app.key('z', { ctrlKey: true });
  app.flush();
  assert.equal(app.elements().length, 0, 'deshacer se lleva el sólido entero');

  // Pulsar una pieza selecciona el grupo completo, así que Supr lo borra de una
  app.key('y', { ctrlKey: true });
  app.flush();
  assert.equal(app.elements().length, els.length, 'rehacer lo devuelve entero');
  app.selectTool('select');
  app.click(260, 260);
  app.flush();
  app.key('Delete');
  app.flush();
  assert.equal(app.elements().length, 0, 'se borra como una unidad');
});

test('un clic sin arrastrar con una herramienta 3D crea la figura por defecto', () => {
  // Igual que Edificios y Jardín: por debajo de MIN_SPAN manda la caja por
  // defecto, en vez de no crear nada o crear algo de 1 px.
  const app = loadApp();
  app.selectTool('esfera');
  app.click(400, 300);
  app.flush();
  const els = app.elements();
  assert.ok(els.length >= 1, 'el clic debe crear la esfera');
  const circulo = els.find(e => e.type === 'circle');
  assert.ok(circulo && circulo.w > 20, 'la esfera nace con su caja propia');
  assert.ok(Math.abs(circulo.w - circulo.h) < 1e-6, 'una esfera es redonda');
});

/* ── Girar una figura compuesta en el lienzo ── */

test('Shift+R gira el sólido entero, no cada pieza por su lado', () => {
  const app = loadApp();
  app.selectTool('prisma');
  app.drag(300, 300, 400, 400);
  app.flush();
  const antes = app.elements();
  assert.ok(antes.length > 2);
  const caja = els => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    els.forEach(e => {
      const xs = e.type === 'line' ? [e.x1, e.x2] : [e.x, e.x + e.w];
      const ys = e.type === 'line' ? [e.y1, e.y2] : [e.y, e.y + e.h];
      if (xs[0] === undefined) return;
      x0 = Math.min(x0, ...xs); x1 = Math.max(x1, ...xs);
      y0 = Math.min(y0, ...ys); y1 = Math.max(y1, ...ys);
    });
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  const b0 = caja(antes);

  app.selectTool('select');
  app.click(320, 320);
  app.flush();
  app.key('R', { shiftKey: true });
  app.flush();
  const despues = app.elements();
  assert.equal(despues.length, antes.length, 'girar no crea ni destruye piezas');
  const b1 = caja(despues);
  // Un cuarto de vuelta intercambia ancho y alto del conjunto y conserva su
  // centro. Si cada pieza girase por su lado (el comportamiento viejo), las
  // líneas ni se moverían y la caja no cambiaría de proporción.
  assert.ok(Math.abs(b1.w - b0.h) < 1.5, `ancho ${b1.w} ≈ alto anterior ${b0.h}`);
  assert.ok(Math.abs(b1.h - b0.w) < 1.5, `alto ${b1.h} ≈ ancho anterior ${b0.w}`);
  assert.ok(Math.abs(b1.cx - b0.cx) < 1.5 && Math.abs(b1.cy - b0.cy) < 1.5,
    'el centro se conserva');
  // Cuatro vueltas devuelven la figura a su sitio
  for (let i = 0; i < 3; i++) { app.key('R', { shiftKey: true }); app.flush(); }
  const vuelta = app.elements();
  const b4 = caja(vuelta);
  assert.ok(Math.abs(b4.w - b0.w) < 1.5 && Math.abs(b4.h - b0.h) < 1.5,
    'cuatro cuartos de vuelta son la identidad');
});

test('←/→ giran una figura compuesta, y en sentidos opuestos', () => {
  const app = loadApp();
  app.selectTool('prisma');
  app.drag(300, 300, 400, 400);
  app.flush();
  app.selectTool('select');
  app.click(320, 320);
  app.flush();
  const medir = els => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    els.forEach(e => {
      const xs = e.type === 'line' ? [e.x1, e.x2] : [e.x, e.x + e.w];
      const ys = e.type === 'line' ? [e.y1, e.y2] : [e.y, e.y + e.h];
      if (xs[0] === undefined) return;
      x0 = Math.min(x0, ...xs); x1 = Math.max(x1, ...xs);
      y0 = Math.min(y0, ...ys); y1 = Math.max(y1, ...ys);
    });
    return { w: x1 - x0, h: y1 - y0 };
  };
  const b0 = medir(app.elements());
  const antes = JSON.stringify(app.elements());

  app.key('ArrowRight');
  app.flush();
  const b1 = medir(app.elements());
  // Que la escena CAMBIE no basta: sin esta comprobación, mover un píxel
  // pasaría la prueba igual que girar. El cuarto de vuelta intercambia el
  // ancho y el alto del conjunto.
  assert.ok(Math.abs(b1.w - b0.h) < 1.5 && Math.abs(b1.h - b0.w) < 1.5,
    `→ tiene que GIRAR: ${b0.w}x${b0.h} → ${b1.w}x${b1.h}`);

  app.key('ArrowLeft');
  app.flush();
  // Los dos sentidos son inversos exactos, como en las formas sueltas
  assert.equal(JSON.stringify(app.elements()), antes, '← lo deshace');
});

test('girar una forma suelta sigue girando sobre su propio centro', () => {
  // El régimen viejo no se toca: con todo girable por tipo, cada elemento gira
  // su paso alrededor de sí mismo. Sólo cambia lo que antes no hacía nada.
  const app = loadApp();
  app.selectTool('pentagon');
  app.drag(400, 300, 460, 360);
  app.flush();
  const antes = app.elements()[0];
  app.selectTool('select');
  app.click(400, 300);
  app.flush();
  app.key('R', { shiftKey: true });
  app.flush();
  const despues = app.elements()[0];
  assert.equal(despues.rotation, 36, 'un paso del pentágono');
  assert.equal(despues.x, antes.x, 'no se mueve');
  assert.equal(despues.y, antes.y);
});

/* ── Editar un sólido ya dibujado: color de aristas y de lados ── */

test('pulsar la herramienta 3D con un sólido puesto lo EDITA, no lo deselecciona', () => {
  // Sin esto, su modal pasaba a configurar el sólido siguiente y el color y el
  // grosor de las aristas no llegaban nunca a la figura que se tenía delante.
  const app = loadApp();
  app.selectTool('prisma');
  app.drag(300, 300, 400, 400);
  app.flush();
  const piezas = app.elements().length;
  assert.ok(piezas > 2);

  app.selectTool('select');
  app.click(320, 320);
  app.flush();
  app.selectTool('prisma');
  app.flush();
  // La selección sobrevive: se comprueba por su efecto, cambiando el color
  // desde el mando del modal y viendo que llega a las piezas.
  const picker = app.$('prism-color');
  picker.value = '#ff0055';
  picker.__fire('input', { target: picker });
  picker.__fire('change', { target: picker });
  app.flush();
  const els = app.elements();
  assert.equal(els.length, piezas, 'editar no crea ni destruye piezas');
  assert.ok(els.every(e => e.color === '#ff0055'),
    'el color del modal tiene que llegar a TODAS las aristas');
});

test('rellenar un sólido ya dibujado le CREA las caras, sin moverlo ni cambiar su tamaño', () => {
  // Las caras laterales son elementos y sólo se emiten al crear la figura: una
  // dibujada en hueco no las tenía, así que «el color de los lados» no existía.
  const app = loadApp();
  app.selectTool('prisma');
  app.drag(300, 300, 420, 420);
  app.flush();
  const antes = app.elements();
  assert.equal(antes.filter(e => e.type === 'polygon').length, 0,
    'sin relleno no hay caras, que es justo el problema');
  const caraAntes = antes.find(e => e.type !== 'line' && e.type !== 'curveArrow');

  app.selectTool('select');
  app.click(320, 320);
  app.flush();
  app.selectTool('prisma');
  app.flush();
  const casilla = app.$('prism-fill');
  casilla.checked = true;
  casilla.__fire('change', { target: casilla });
  app.flush();

  const despues = app.elements();
  const caras = despues.filter(e => e.type === 'polygon');
  assert.ok(caras.length > 0, 'ahora sí hay caras que colorear');
  assert.ok(caras.every(c => c.fill === true && c.stroke === false));
  // Y la figura no se ha movido ni ha cambiado de tamaño: el arrastre
  // equivalente se reconstruye desde la propia cara frontal.
  const caraDespues = despues.find(e =>
    e.type !== 'line' && e.type !== 'curveArrow' && e.type !== 'polygon');
  assert.ok(Math.abs(caraDespues.x - caraAntes.x) < 1e-6);
  assert.ok(Math.abs(caraDespues.y - caraAntes.y) < 1e-6);
  assert.ok(Math.abs(caraDespues.w - caraAntes.w) < 1e-6);
  assert.ok(Math.abs(caraDespues.h - caraAntes.h) < 1e-6);
  // Todas las piezas siguen siendo un grupo y conservan sus metadatos
  const gid = despues[0].buildingGroupId;
  assert.ok(gid && despues.every(e => e.buildingGroupId === gid && e.solidMeta));
});

test('regenerar un sólido es UN paso de deshacer y no toca a los demás elementos', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(60, 60, 140, 120);         // un rectángulo suelto, antes del sólido
  app.flush();
  app.selectTool('prisma');
  app.drag(300, 300, 400, 400);
  app.flush();
  const antes = app.elements();
  const sueltoAntes = antes[0];

  app.selectTool('select');
  app.click(320, 320);
  app.flush();
  app.selectTool('prisma');
  app.flush();
  const casilla = app.$('prism-fill');
  casilla.checked = true;
  casilla.__fire('change', { target: casilla });
  app.flush();
  const conCaras = app.elements();
  assert.ok(conCaras.some(e => e.type === 'polygon'));
  // El rectángulo suelto sigue intacto y DELANTE del sólido: la sustitución
  // respeta el orden de dibujo.
  assert.deepEqual({ ...conCaras[0] }, { ...sueltoAntes });

  app.key('z', { ctrlKey: true });
  app.flush();
  const tras = app.elements();
  assert.equal(tras.length, antes.length, 'un solo paso deshace toda la regeneración');
  assert.equal(tras.filter(e => e.type === 'polygon').length, 0);
});

/* ── Girar un sólido y regenerarlo (auditoría v2.30.0) ── */

// Un cuarto de vuelta del conjunto deja al pentágono a rotation: 90, que no es
// múltiplo de su paso (36°) aunque sí una orientación legítima e importable.
// regenerateSolid re-pasaba ese giro por la cuantización del mando y lo saltaba
// a 108°: marcar «Rellenar» recolocaba la figura entera sin que nadie lo
// pidiera. Sólo pentagon y star5 lo sufren (su paso es el único que no divide
// a 90), por eso la guarda usa esa sección.
test('girar un prisma pentagonal con «→» y rellenarlo conserva el giro exacto', () => {
  const app = loadApp();
  app.selectTool('prisma');
  app.pickVariant('prism-catalog', 'modal__prism', 'pentagon', 'prism');
  app.drag(300, 300, 380, 300);
  app.flush();
  app.selectTool('select');
  app.click(300, 300);
  app.flush();
  app.key('ArrowRight');                    // cuarto de vuelta del conjunto
  app.flush();
  const esFrente = e => !['line', 'curveArrow', 'polygon'].includes(e.type);
  const frente = app.elements().find(esFrente);
  assert.equal(frente.rotation, 90, 'el conjunto queda a 90°');

  app.selectTool('prisma');                 // editar el sólido seleccionado
  app.flush();
  const casilla = app.$('prism-fill');
  casilla.checked = true;
  casilla.__fire('change', { target: casilla });
  app.flush();
  const tras = app.elements().find(esFrente);
  assert.equal(tras.rotation, 90, 'regenerar no re-cuantiza el giro (saltaba a 108°)');
  assert.ok(Math.abs(tras.x - frente.x) < 1e-6 && Math.abs(tras.y - frente.y) < 1e-6,
    'y la figura no se recoloca');
});

// De pie no hay cara frontal, y _upright sólo sabe construir figuras erguidas:
// girar el gesto (el intento original) hacía que regenerar una figura girada la
// sustituyera por OTRA, erguida y de otro tamaño. Ahora el giro pendiente se
// acumula en solidMeta.turns y la regeneración lo re-aplica alrededor del
// centro, así que la figura tumbada sigue tumbada, en su sitio.
test('una pirámide DE PIE girada un cuarto sigue tumbada y en su sitio tras regenerarla', () => {
  const app = loadApp();
  app.selectTool('piramide');
  const eje = app.$('pyramid-apex');
  eje.value = 'upright';
  eje.__fire('change', { target: eje });
  app.pickVariant('pyramid-catalog', 'modal__pyramid', 'rect', 'pyramid');
  app.drag(260, 200, 400, 330);
  app.flush();
  assert.ok(app.elements().every(e => e.solidMeta && e.solidMeta.apex === 'upright'),
    'la figura nació de pie');

  const bbox = els => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const e of els) {
      const pts = e.points ? e.points
        : e.x1 !== undefined ? [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]
          : [{ x: e.x, y: e.y }, { x: e.x + (e.w || 0), y: e.y + (e.h || 0) }];
      for (const p of pts) {
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
        x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
      }
    }
    return [x1, y1, x2, y2];
  };

  app.key('a', { ctrlKey: true });
  app.key('ArrowRight');                    // la figura queda TUMBADA
  app.flush();
  const girada = app.elements();
  const cajaGirada = bbox(girada);
  assert.ok(girada.every(e => e.solidMeta.turns === 1), 'el giro pendiente se acumula');

  app.selectTool('piramide');               // editar → regenerar rellenando
  app.flush();
  const casilla = app.$('pyramid-fill');
  casilla.checked = true;
  casilla.__fire('change', { target: casilla });
  app.flush();
  const tras = app.elements();
  assert.ok(tras.some(e => e.type === 'polygon'), 'la regeneración creó las caras');
  const cajaTras = bbox(tras.filter(e => e.type !== 'polygon'));
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(cajaTras[i] - cajaGirada[i]) < 1e-6,
      `la figura sigue tumbada y en su sitio (lado ${i}: ${cajaGirada[i]} → ${cajaTras[i]})`);
  }
});

// De pie y en hueco, ninguna pieza guarda el color de relleno (no hay cara
// frontal y las laterales sólo se emiten rellenas): vaciar y volver a rellenar
// caía al color del trazo. El color viaja ahora en solidMeta.fillColor.
test('un sólido de pie vaciado recupera SU color de relleno al rellenarlo otra vez', () => {
  const app = loadApp();
  const picker = app.$('fill-color-picker');
  picker.value = '#00aa00';
  picker.__fire('input', { target: picker });
  picker.__fire('change', { target: picker });
  app.selectTool('piramide');
  const eje = app.$('pyramid-apex');
  eje.value = 'upright';
  eje.__fire('change', { target: eje });
  app.pickVariant('pyramid-catalog', 'modal__pyramid', 'rect', 'pyramid');
  const casilla = app.$('pyramid-fill');
  casilla.checked = true;
  casilla.__fire('change', { target: casilla });
  app.drag(260, 200, 400, 330);
  app.flush();
  const caraInicial = app.elements().find(e => e.type === 'polygon');
  assert.ok(caraInicial, 'nace rellena');
  assert.equal(caraInicial.fillColor, '#00aa00');

  app.key('a', { ctrlKey: true });
  app.selectTool('piramide');
  app.flush();
  casilla.checked = false;                  // vaciar…
  casilla.__fire('change', { target: casilla });
  app.flush();
  assert.equal(app.elements().filter(e => e.type === 'polygon').length, 0);
  casilla.checked = true;                   // …y volver a rellenar
  casilla.__fire('change', { target: casilla });
  app.flush();
  const cara = app.elements().find(e => e.type === 'polygon');
  assert.ok(cara, 'vuelve a tener caras');
  assert.equal(cara.fillColor, '#00aa00',
    'recupera SU color, no el del trazo (documentado: vaciar no pierde el color)');
});

/* ─────────── Aspectos de lienzo (v2.31.0) ─────────── */

/** La muestra de aspecto con ese id, dentro de la fila del panel. */
function muestraAspecto(app, id) {
  const btn = app.$('canvas-preset-grid').querySelectorAll('.panel__canvas-preset')
    .find(b => b.dataset.preset === id);
  assert.ok(btn, `no existe la muestra del aspecto «${id}»`);
  return btn;
}

/** El aspecto marcado como activo, o null si no hay ninguno. */
function aspectoActivo(app) {
  const activa = app.$('canvas-preset-grid').querySelectorAll('.panel__canvas-preset')
    .find(b => b.className.includes('panel__canvas-preset--active'));
  return activa ? activa.dataset.preset : null;
}

test('un aspecto de lienzo pone papel, rejilla y su interruptor de una vez', () => {
  const app = loadApp();
  // Arranca en el de fábrica y la fila lo dice.
  assert.equal(aspectoActivo(app), 'plano');
  assert.equal(app.$('check-grid').checked, true);

  app.dibujo = app.drag; // (no se usa: el aspecto no debe tocar lo dibujado)
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  const antes = app.elements();
  const colorAntes = app.$('color-picker').value;

  muestraAspecto(app, 'blanco').__fire('click', {});
  app.flush();

  assert.equal(app.$('canvas-bg-picker').value, '#ffffff');
  // El tercer campo: el lienzo blanco es blanco LISO, sin cuadrícula.
  assert.equal(app.$('check-grid').checked, false);
  assert.equal(aspectoActivo(app), 'blanco');
  // Un aspecto describe el papel, no la tinta ni el dibujo.
  assert.equal(app.$('color-picker').value, colorAntes,
    'el aspecto no debe tocar el color de trazo');
  assert.deepEqual(app.elements(), antes,
    'el aspecto no debe tocar lo dibujado');

  // Y la vuelta existe, que es de lo que iba todo esto.
  muestraAspecto(app, 'plano').__fire('click', {});
  app.flush();
  assert.equal(app.$('canvas-bg-picker').value, '#686f92');
  assert.equal(app.$('grid-color-picker').value, '#fcfcfc');
  assert.equal(app.$('check-grid').checked, true);
  assert.equal(aspectoActivo(app), 'plano');
});

test('la fila de aspectos no afirma uno que no es el que se está viendo', () => {
  const app = loadApp();
  assert.equal(aspectoActivo(app), 'plano');

  // Componer un papel a mano no es ninguno de los aspectos: si «Plano» se
  // quedara marcado, la fila estaría mintiendo sobre lo que hay en pantalla.
  app.$('canvas-bg-picker').value = '#123456';
  app.$('canvas-bg-picker').__fire('input', { target: app.$('canvas-bg-picker') });
  app.flush();
  assert.equal(aspectoActivo(app), null);

  // Apagar la rejilla a mano tampoco: sobre papel de plano no hay aspecto que
  // valga (y «Blanco» tiene otro papel).
  app.$('canvas-bg-picker').value = '#686f92';
  app.$('canvas-bg-picker').__fire('input', { target: app.$('canvas-bg-picker') });
  app.$('check-grid').checked = false;
  app.$('check-grid').__fire('change', { target: app.$('check-grid') });
  app.flush();
  assert.equal(aspectoActivo(app), null);

  // Volver a encenderla recupera «Plano» sin tener que pulsar la muestra.
  app.$('check-grid').checked = true;
  app.$('check-grid').__fire('change', { target: app.$('check-grid') });
  app.flush();
  assert.equal(aspectoActivo(app), 'plano');
});

test('el aspecto elegido sobrevive a la recarga, cuadrícula incluida', () => {
  const app = loadApp();
  muestraAspecto(app, 'blanco').__fire('click', {});
  app.flush();

  // Lo que quedó guardado es lo que leerá la sesión siguiente. Antes de la
  // v2.31.0 `showGrid` no se guardaba, así que el lienzo blanco LISO volvía
  // con la rejilla encendida y el aspecto ya no coincidía con ninguna muestra.
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.canvasBg, '#ffffff');
  assert.equal(prefs.showGrid, false);

  const otra = loadApp({ prefs });
  assert.equal(otra.$('canvas-bg-picker').value, '#ffffff');
  assert.equal(otra.$('check-grid').checked, false);
  assert.equal(aspectoActivo(otra), 'blanco');
});

/* ─────────── Tinta: el bote de pintura (v2.32.0) ─────────── */

// El flood real no se puede probar aquí: el stub de canvas no devuelve
// píxeles. Ése es justamente el reparto que justifica src/js/flood.js —su
// geometría se prueba con máscaras a mano en tests/flood.test.js, y la zona
// cerrada de verdad, en e2e/ink.spec.js. Aquí se prueba lo que decide app.js.

test('la Tinta rellena la forma que hay bajo el clic sin crear nada nuevo', () => {
  const app = loadApp();
  app.selectTool('circle');
  app.drag(200, 200, 400, 400);
  assert.equal(app.elements().length, 1);
  assert.ok(!app.elements()[0].fill, 'nace sin relleno');

  app.selectTool('ink');
  app.click(300, 300);
  const els = app.elements();
  assert.equal(els.length, 1, 'rellenar una forma no debe añadir elementos');
  assert.equal(els[0].type, 'circle');
  assert.equal(els[0].fill, true);
  // El color estampado es explícito: sin `fillColor`, Renderer.fillStyle cae
  // en el tinte del trazo al 12% y el relleno sale casi invisible.
  assert.ok(/^#[0-9a-f]{6}$/i.test(els[0].fillColor), 'debe llevar fillColor propio');
});

test('con «siempre la zona» la Tinta ya no rellena la forma bajo el clic', () => {
  const app = loadApp();
  app.selectTool('circle');
  app.drag(200, 200, 400, 400);
  app.selectTool('ink');
  app.$('ink-target').value = 'zone';
  app.$('ink-target').__fire('change', { target: app.$('ink-target') });
  app.click(300, 300);
  const els = app.elements();
  assert.equal(els.length, 1);
  assert.ok(!els[0].fill, 'el modo «zona» no debe tocar la forma');
});

test('la Tinta no toca el color del TRAZO, sólo el relleno', () => {
  // Un aspecto de la herramienta que se decidió a propósito: pinta el papel,
  // no la tinta con la que se dibuja. Un mando, una cosa.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 300, 300);
  const colorTrazo = app.elements()[0].color;
  app.selectTool('ink');
  app.click(200, 200);
  assert.equal(app.elements()[0].color, colorTrazo);
});

test('«Pintar lo seleccionado» es UN paso de deshacer para todo el lote', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.selectTool('circle');
  app.drag(300, 100, 400, 200);
  app.key('a', { ctrlKey: true });
  assert.equal(app.elements().length, 2);

  app.selectTool('ink');
  app.$('btn-ink-selection').__fire('click', {});
  app.flush();
  assert.ok(app.elements().every(el => el.fill === true), 'las dos deben quedar rellenas');

  app.key('z', { ctrlKey: true });
  assert.ok(app.elements().every(el => !el.fill),
    'un solo deshacer debe quitar el relleno de las dos');
});

test('sustituir un color lo cambia en trazo y relleno, en un paso', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  const original = app.elements()[0].color;

  app.selectTool('ink');
  // El desplegable lo rellena syncInkControls con los colores de la escena.
  app.$('ink-replace').value = original;
  app.$('ink-modal-fill-color').value = '#ff0000';
  app.$('ink-modal-fill-color').__fire('input', { target: app.$('ink-modal-fill-color') });
  app.$('btn-ink-replace').__fire('click', {});
  app.flush();
  assert.equal(app.elements()[0].color, '#ff0000');

  app.key('z', { ctrlKey: true });
  assert.equal(app.elements()[0].color, original, 'un solo deshacer lo revierte');
});

test('el cierre de huecos y el objetivo del clic sobreviven a la recarga', () => {
  const app = loadApp();
  app.selectTool('ink');
  app.$('ink-gap').value = '9';
  app.$('ink-gap').__fire('input', { target: app.$('ink-gap') });
  app.$('ink-gap').__fire('change', { target: app.$('ink-gap') });
  app.$('ink-target').value = 'zone';
  app.$('ink-target').__fire('change', { target: app.$('ink-target') });

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.inkGap, 9);
  assert.equal(prefs.inkTarget, 'zone');

  const otra = loadApp({ prefs });
  assert.equal(otra.$('ink-gap').value, '9');
  assert.equal(otra.$('ink-target').value, 'zone');
});

test('elegir la Tinta conserva la selección de formas, pero no otra cosa', () => {
  // Si vaciara la selección, su propio botón «Pintar lo seleccionado» sería
  // inalcanzable: al pulsar la herramienta ya no habría nada que pintar.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 200, 200);
  app.key('a', { ctrlKey: true });
  app.selectTool('ink');
  assert.equal(app.$('btn-ink-selection').disabled, false,
    'con una forma seleccionada, el botón debe estar activo');

  // Con un trazo suelto no hay nada rellenable, así que se limpia como con
  // cualquier otra herramienta de creación.
  const otra = loadApp();
  otra.selectTool('line');
  otra.drag(100, 100, 300, 300);
  otra.key('a', { ctrlKey: true });
  otra.selectTool('ink');
  assert.equal(otra.$('btn-ink-selection').disabled, true);
});

test('«Sustituir un color» no distingue mayúsculas: #FF0000 y #ff0000 son el mismo', () => {
  // La validación de import acepta hex en mayúsculas, así que un JSON externo
  // puede traer #FF0000; sin normalizar, el desplegable lo listaba dos veces
  // y la sustitución dejaba la mitad sin cambiar (auditoría v2.35.0).
  const app = loadApp({
    autosave: {
      elements: [
        { type: 'line', x1: 10, y1: 10, x2: 100, y2: 10, color: '#FF0000', lineWidth: 2 },
        { type: 'line', x1: 10, y1: 40, x2: 100, y2: 40, color: '#ff0000', lineWidth: 2 },
      ],
      settings: { overlapMode: 'normal' },
    },
  });
  assert.equal(app.elements().length, 2);

  app.selectTool('ink');
  app.$('ink-replace').value = '#ff0000';
  app.$('ink-modal-fill-color').value = '#00aa00';
  app.$('ink-modal-fill-color').__fire('input', { target: app.$('ink-modal-fill-color') });
  app.$('btn-ink-replace').__fire('click', {});
  app.flush();
  assert.ok(app.elements().every(el => el.color === '#00aa00'),
    'las DOS líneas cambian, no solo la que coincide byte a byte');
});

/* ── Lápiz con presión simulada (v2.37.0) ─────────────────────── */

test('«Trazo con presión»: el default estampa taper y la casilla edita el lápiz seleccionado', () => {
  const app = loadApp();

  // Sin marcar, el lápiz clásico: el campo NI EXISTE (la ausencia es el
  // aspecto de siempre y lo que serializa un proyecto viejo).
  app.selectTool('pencil');
  app.drag(100, 100, 220, 160);
  let els = app.elements();
  assert.equal(els.length, 1);
  assert.equal(els[0].taper, undefined, 'sin marcar, el lápiz no lleva el campo');

  // Marcada sin selección: fija el default de creación, no toca lo dibujado.
  const taper = app.$('stroke-modal-taper');
  taper.checked = true; taper.__fire('change', { target: taper });
  app.flush();
  app.drag(100, 300, 220, 360);
  els = app.elements();
  assert.equal(els.length, 2);
  assert.equal(els[1].taper, true, 'el lápiz nuevo nace con presión');
  assert.equal(els[0].taper, undefined, 'y el anterior no cambia');

  // Semántica dual: con el primer trazo seleccionado, la casilla LO edita.
  app.selectTool('select');
  app.click(160, 130);
  app.flush();
  assert.equal(taper.checked, false, 'la casilla enseña el valor del seleccionado');
  taper.checked = true; taper.__fire('change', { target: taper });
  app.flush();
  els = app.elements();
  assert.equal(els[0].taper, true, 'el trazo seleccionado gana la presión');
  taper.checked = false; taper.__fire('change', { target: taper });
  app.flush();
  assert.equal(app.elements()[0].taper, undefined,
    'quitarla BORRA el campo, no guarda false');
});

/* ── Guías de alineación (v2.38.0) ─────────────────────────────── */

test('el imán de alineación pega el arrastre al borde del vecino, y apagado no', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 180, 160);   // vecino: bordes x en 100/140/180
  app.drag(300, 300, 380, 360);   // el que se arrastra

  // Arrastre que deja el borde izquierdo a 3 px del vecino (103): el imán
  // debe clavarlo en 100 exacto, en las dos coordenadas.
  app.selectTool('select');
  app.drag(340, 330, 143, 133);
  let els = app.elements();
  assert.equal(els.length, 2);
  assert.equal(els[1].x, 100, 'x imantada al borde del vecino');
  assert.equal(els[1].y, 100, 'y imantada también');

  // Con «Guías de alineación» apagada, el mismo gesto deja el objeto donde
  // el puntero lo suelta: a 3 px, sin imán.
  const align = app.$('select-modal-align');
  align.checked = false; align.__fire('change', { target: align });
  app.flush();
  app.drag(140, 130, 343, 333);   // devolverlo lejos (queda en 303: sin imán
                                  // cerca, el arrastre es 1:1 con el puntero)
  app.drag(343, 333, 146, 136);   // y repetir el acercamiento (303 − 197)
  els = app.elements();
  assert.equal(els[1].x, 106, 'sin imán, se queda donde suelta el puntero');
  assert.equal(els[1].y, 106);
});

test('Alt a mitad de arrastre suspende el imán sin que el objeto salte atrás al soltarlo', () => {
  // `free` tiene que acumular TAMBIÉN en los fotogramas con Alt: si no, al
  // soltar Alt la corrección se mide contra un free desfasado y la selección
  // retrocede justo lo recorrido con Alt pulsado (auditoría v2.39.1).
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 180, 160);   // vecino lejano (no imanta en esta ruta)
  app.drag(300, 300, 380, 360);   // el que se arrastra
  app.selectTool('select');
  app.click(340, 330);

  const canvas = app.$('main-canvas');
  const fire = (type, x, y, o = {}) =>
    canvas.__fire(type, { clientX: x, clientY: y, pointerId: 1, button: 0, ...o });
  fire('pointerdown', 340, 330);
  fire('pointermove', 360, 330, { buttons: 1 });                 // +20 sin Alt
  fire('pointermove', 420, 330, { buttons: 1, altKey: true });   // +60 con Alt
  fire('pointermove', 421, 330, { buttons: 1 });                 // +1 ya sin Alt
  fire('pointerup', 421, 330);
  app.flush();

  const B = app.elements()[1];
  assert.ok(Math.abs(B.x - 381) <= 5,
    `el puntero acabó 81 px a la derecha y B quedó en x=${B.x} (esperado ~381)`);
});

test('imán solo en X con snapGrid: la Y libre sí vuelve a la cuadrícula al soltar', () => {
  // La guía gana a la rejilla SOLO en su eje: con un flag único, el eje donde
  // el imán no pegó nada se quedaba sin imán Y sin cuadrícula a la vez.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 180, 160);   // vecino: líneas x en 100/140/180
  app.drag(300, 300, 380, 360);
  const snap = app.$('check-snap');
  snap.checked = true; snap.__fire('change', { target: snap });
  app.flush();

  // Suelta con el borde izquierdo a 3 px de x=100 (imán → 100) y la Y en 253,
  // lejos de toda línea del vecino (la rejilla debe llevarla a 260).
  app.selectTool('select');
  app.drag(340, 330, 143, 283);
  const B = app.elements()[1];
  assert.equal(B.x, 100, 'X imantada al borde del vecino');
  assert.equal(B.y % 20, 0,
    `la Y debía volver a la cuadrícula y quedó en ${B.y}`);
});

test('el imán ignora la posición vieja de una flecha anclada que viaja con la selección', () => {
  // Los candidatos se congelan al primer fotograma, pero una flecha anclada a
  // lo arrastrado se mueve con ello (resolveAnchors): sus líneas iniciales
  // eran candidatas fantasma y el imán clavaba la selección sobre aire vacío.
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 180, 160);   // rect A
  app.selectTool('arrow');
  app.drag(600, 400, 500, 300);   // flecha suelta
  app.selectTool('select');
  app.click(550, 350);            // selecciona la flecha
  app.drag(500, 300, 140, 130);   // ancla su punta dentro de A
  let els = app.elements();
  assert.ok(els[1].endAnchor, 'prerrequisito: la punta quedó anclada a A');

  app.click(120, 115);            // selecciona solo A
  els = app.elements();
  const a1 = els[1];
  const oldCenterX = (Math.min(a1.x1, a1.x2) + Math.max(a1.x1, a1.x2)) / 2;
  // Arrastra A hasta dejar su borde izquierdo a 3 px del centro-x VIEJO de la
  // flecha: sin candidatos fantasma, A se queda en la posición libre.
  const dx = (oldCenterX - 3) - 100;
  app.drag(120, 115, 120 + dx, 115);
  els = app.elements();
  assert.equal(els[0].x, oldCenterX - 3,
    `A debía quedarse libre en ${oldCenterX - 3} y quedó en ${els[0].x}`);
});

/* ── Orden Z: traer al frente / enviar al fondo (v2.39.0) ──────── */

test('el orden Z se cambia por pasos y a los extremos, sin undo fantasma en el tope', () => {
  const app = loadApp();
  app.selectTool('rect');
  app.drag(100, 100, 150, 150);   // A (abajo del todo)
  app.drag(200, 100, 250, 150);   // B
  app.drag(300, 100, 350, 150);   // C (arriba del todo)
  const xs = () => app.elements().map(el => el.x);
  assert.deepEqual(xs(), [100, 200, 300]);

  // Seleccionar A y adelantarla un paso: B queda debajo.
  app.selectTool('select');
  app.click(125, 125);
  app.key('ArrowUp', { ctrlKey: true });
  assert.deepEqual(xs(), [200, 100, 300], 'A salta sobre B');

  // Al frente con Ctrl+Mayús+↑.
  app.key('ArrowUp', { ctrlKey: true, shiftKey: true });
  assert.deepEqual(xs(), [200, 300, 100], 'A pasa arriba del todo');

  // En el tope, repetir NO cambia nada ni apila undo: el siguiente Ctrl+Z
  // debe volver exactamente al paso anterior, no a un clon del actual.
  app.key('ArrowUp', { ctrlKey: true, shiftKey: true });
  assert.deepEqual(xs(), [200, 300, 100]);
  app.key('z', { ctrlKey: true });
  assert.deepEqual(xs(), [200, 100, 300], 'undo deshace el «al frente», no un fantasma');

  // Al fondo por el botón del panel (el undo vació la selección: se re-elige A).
  app.click(125, 125);
  app.$('btn-z-back').__fire('click', {});
  app.flush();
  assert.deepEqual(xs(), [100, 200, 300], 'A vuelve abajo del todo');
});

test('reordenar un edificio lo mueve como bloque contiguo y con su orden interno', () => {
  const app = loadApp();
  app.selectTool('fachada');
  app.drag(100, 100, 300, 420);   // grupo de decenas de piezas
  app.selectTool('rect');
  app.drag(150, 200, 190, 240);   // un rect por encima de la fachada
  const before = app.elements();
  const n = before.length;
  const gid = before[0].buildingGroupId;
  assert.ok(gid && n > 2);

  // Seleccionar la fachada (clic la coge entera) y traerla al frente.
  app.selectTool('select');
  app.click(102, 410);            // sobre el muro, lejos del rect
  app.key('ArrowUp', { ctrlKey: true, shiftKey: true });
  const after = app.elements();
  assert.equal(after[0].buildingGroupId, undefined, 'el rect queda debajo');
  const grupo = after.slice(1);
  assert.ok(grupo.every(el => el.buildingGroupId === gid), 'el grupo queda contiguo arriba');
  assert.deepEqual(
    grupo.map(el => [el.type, el.x, el.y]),
    before.filter(el => el.buildingGroupId === gid).map(el => [el.type, el.x, el.y]),
    'y conserva su orden interno pieza a pieza');
});

/* ── gardenMeta sigue al escalado (v2.39.1) ─────────────────────── */

test('escalar un grupo vegetal escala también su gardenMeta, y regenerar no lo encoge', () => {
  // scaleElement no mapeaba gardenMeta.p1/p2 (moveElement sí los desplaza), y
  // además las piezas encadenadas (curveArrow) salían por CurvePath.scale con
  // un return temprano que se saltaba TODAS las fichas de regeneración: tras
  // agrandar una planta, «Editar planta» la devolvía en silencio a su tamaño
  // de dibujo original (auditoría v2.39.1).
  const app = loadApp();
  app.selectTool('arbol');
  app.drag(200, 200, 300, 300);
  const bboxOf = els => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const acc = (x, y) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    els.forEach(el => {
      if (el.points) el.points.forEach(p => acc(p.x, p.y));
      else if (el.x1 !== undefined) { acc(el.x1, el.y1); acc(el.x2, el.y2); }
      else if (el.w !== undefined) { acc(el.x, el.y); acc(el.x + el.w, el.y + el.h); }
      else acc(el.x || 0, el.y || 0);
    });
    return { w: x1 - x0, h: y1 - y0 };
  };
  const b0 = bboxOf(app.elements());

  app.selectTool('select');
  app.click(250, 250);
  app.flush();
  const wField = app.$('el-w');
  wField.value = String(Math.round(b0.w * 2));
  wField.__fire('change', { target: wField });
  app.flush();

  const scaled = app.elements();
  const b1 = bboxOf(scaled);
  const meta = scaled[0].gardenMeta;
  assert.ok(b1.w > b0.w * 1.4, 'prerrequisito: el grupo se agrandó de verdad');
  // La meta escala con el mismo factor que el dibujo (todas las piezas la
  // llevan idéntica, cadenas incluidas).
  const fMeta = (meta.p2.x - meta.p1.x) / 100;
  const fBox = b1.w / b0.w;
  assert.ok(Math.abs(fMeta - fBox) < 0.02,
    `el gesto de la ficha escala como el dibujo (meta ×${fMeta.toFixed(3)}, bbox ×${fBox.toFixed(3)})`);
  assert.ok(scaled.every(el => !el.gardenMeta ||
    (el.gardenMeta.p1.x === meta.p1.x && el.gardenMeta.p2.x === meta.p2.x)),
  'todas las piezas comparten la misma ficha escalada');

  // Regenerar la MISMA especie parte del gesto escalado, no del original.
  const btn = app.$('btn-edit-garden');
  btn.__fire('click', { target: btn });
  app.flush();
  app.pickVariant('tree-catalog', 'modal__tree', 'broadleaf', 'tree');
  const b2 = bboxOf(app.elements());
  assert.ok(b2.w > b1.w * 0.7,
    `regenerar no debe encoger la planta al tamaño original (quedó en ${b2.w.toFixed(0)}px de ${b1.w.toFixed(0)}px)`);
});

/* ── «Abrir proyecto» avisa antes de sustituir (v2.42.0) ────────── */

test('abrir un proyecto sustituye el lienzo, y con dibujo dentro pregunta antes', async () => {
  // El botón se llamaba «Importar» y no decía ni qué formato abre ni que se
  // lleva por delante lo que haya en pantalla; el usuario preguntó qué hacía.
  const app = loadApp();
  const proyecto = () => {
    const arr = [{ type: 'rect', x: 10, y: 10, w: 40, h: 30,
      color: '#123456', lineWidth: 2 }];
    Object.defineProperty(arr, 'overlapMode', { value: 'normal', enumerable: false });
    return arr;
  };
  app.context.Exporter.importJSON = async () => proyecto();
  const abrir = async () => {
    app.$('btn-import').__fire('click', {});
    await new Promise(r => setImmediate(r));
    app.flush();
  };

  // Con el lienzo VACÍO no se molesta al usuario: no hay nada que perder.
  await abrir();
  assert.equal(app.context.confirms.length, 0,
    'con el lienzo vacío no debe preguntar nada');
  assert.equal(app.elements().length, 1, 'el proyecto se ha abierto');

  // Con dibujo dentro, pregunta; y si se dice que NO, no toca nada.
  app.selectTool('rect');
  app.drag(200, 200, 300, 280);
  const antes = app.elements();
  app.context.confirmAnswer = false;
  await abrir();
  assert.equal(app.context.confirms.length, 1, 'tenía que preguntar');
  assert.match(app.context.confirms[0], /sustituir/i);
  assert.deepEqual(app.elements().map(e => e.type), antes.map(e => e.type),
    'al decir que no, el dibujo se queda como estaba');

  // Y si se dice que sí, sustituye —no fusiona— y se puede deshacer.
  app.context.confirmAnswer = true;
  await abrir();
  assert.equal(app.elements().length, 1, 'sustituye el lienzo entero');
  app.key('z', { ctrlKey: true });
  app.flush();
  assert.equal(app.elements().length, antes.length,
    'Ctrl+Z devuelve el dibujo anterior');
});

/* ── Abrir un proyecto restaura el aspecto con el que se dibujó (v3.1.0) ──
   Un dibujo hecho sobre «Pizarra» con tinta clara se abría sobre el papel de
   quien lo abre —blanco muchas veces— y el trazo desaparecía sin que nada
   explicase por qué. El JSON es el único formato que se vuelve a abrir, así
   que es el único que lleva el aspecto. */
test('abrir un proyecto restaura su aspecto, y uno sin aspecto no lo toca', async () => {
  const app = loadApp();
  const proyecto = extra => {
    const arr = [{ type: 'rect', x: 10, y: 10, w: 40, h: 30, color: '#eeeeee', lineWidth: 2 }];
    Object.defineProperty(arr, 'overlapMode', { value: 'normal', enumerable: false });
    for (const k of Object.keys(extra || {})) {
      Object.defineProperty(arr, k, { value: extra[k], enumerable: false });
    }
    return arr;
  };
  const abrir = async extra => {
    app.context.Exporter.importJSON = async () => proyecto(extra);
    app.$('btn-import').__fire('click', {});
    await new Promise(r => setImmediate(r));
    app.flush();
  };

  await abrir({ canvasBg: '#1f2b2a', gridColor: '#4e6b66', showGrid: false });
  assert.equal(app.$('canvas-bg-picker').value, '#1f2b2a', 'el papel del proyecto');
  assert.equal(app.$('grid-color-picker').value, '#4e6b66');
  assert.equal(app.$('check-grid').checked, false, 'y la cuadrícula, apagada como venía');
  // Queda guardado: si no, la recarga siguiente lo devolvería al de fábrica.
  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.canvasBg, '#1f2b2a');

  // Un proyecto ANTERIOR (o de otra herramienta) no trae aspecto, y la
  // ausencia significa «deja el que tengas»: no se inventa uno de fábrica.
  app.context.confirmAnswer = true;
  await abrir({});
  assert.equal(app.$('canvas-bg-picker').value, '#1f2b2a',
    'sin aspecto en el archivo, el del usuario se queda');
  assert.equal(app.$('check-grid').checked, false);
});
