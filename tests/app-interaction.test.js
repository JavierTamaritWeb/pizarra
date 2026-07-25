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
