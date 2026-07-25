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
