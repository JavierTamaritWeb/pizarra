'use strict';
/* ============================================================
   app-interaction.test.js — Gestos reales sobre js/app.js.

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
const { Exporter } = loadAll();

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
  assert.equal(els.length, 1, 'el rect barrido desaparece del estado');
  assert.equal(els.filter(e => e.type === 'eraser').length, 0,
    'el borrador no debe añadir ningún elemento a la escena');
  assert.equal(els[0].x, 400, 'el rect lejano sobrevive');
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
  app.selectTool('pencil');
  assert.equal(app.$('btn-eraser-size').hidden, true, 'sin el borrador activo, el botón está oculto');
  app.selectTool('eraser');
  assert.equal(app.$('btn-eraser-size').hidden, false, 'con el borrador activo, aparece el botón');
  app.$('modal-eraser').close();   // se abrió solo al elegir la herramienta; lo cerramos para reabrirlo a mano
  app.flush();

  app.$('btn-eraser-size').__fire('click', { target: app.$('btn-eraser-size') });
  app.flush();
  assert.equal(app.$('modal-eraser').open, true, 'el botón también lo reabre, sin soltar la herramienta');

  const modalSlider = app.$('eraser-size-modal-slider');
  modalSlider.value = '50';
  modalSlider.__fire('input', { target: modalSlider });
  modalSlider.__fire('change', { target: modalSlider });
  app.flush();

  assert.equal(app.$('stroke-slider').value, '50', 'el slider del panel refleja el mismo tamaño');
  assert.equal(app.$('stroke-val').textContent, '50');

  const prefs = JSON.parse(app.dom.localStorage.getItem('sketchwire.prefs'));
  assert.equal(prefs.eraserSize, 50);

  const app2 = loadApp({ prefs });
  app2.selectTool('eraser');
  app2.$('btn-eraser-size').__fire('click', { target: app2.$('btn-eraser-size') });
  app2.flush();
  assert.equal(app2.$('eraser-size-modal-slider').value, '50', 'y vuelve puesto al arrancar de nuevo');
});

test('lo borrado no reaparece al mover el dibujo (el fallo de la máscara)', () => {
  const { app, count } = withFacade();
  app.selectTool('eraser');
  app.drag(150, 200, 250, 200);
  const afterErase = app.elements().length;
  assert.ok(afterErase < count, 'la pasada elimina piezas de la fachada');

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
  assert.equal(app.elements().length, 0);
  app.key('z', { ctrlKey: true });
  assert.equal(app.elements().length, 2, 'un único Ctrl+Z devuelve los dos');
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
  const small = near();
  small.$('stroke-slider').value = '4';           // el panel edita el tamaño con el borrador activo
  small.selectTool('eraser');
  small.$('stroke-slider').value = '4';
  small.$('stroke-slider').__fire('input', { target: small.$('stroke-slider') });
  small.flush();
  small.drag(100, 88, 200, 88);                   // 12px por encima del borde
  assert.equal(small.elements().length, 1, 'con 4px no alcanza');

  const big = near();
  big.selectTool('eraser');
  big.$('stroke-slider').value = '60';
  big.$('stroke-slider').__fire('input', { target: big.$('stroke-slider') });
  big.flush();
  big.drag(100, 88, 200, 88);
  assert.equal(big.elements().length, 0, 'con 60px sí alcanza');
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
  assert.equal(label.value, 'Frondoso');
  assert.equal(label.buildingGroupId, gid, 'la etiqueta va en el grupo');
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
