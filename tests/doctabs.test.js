'use strict';
/* ============================================================
   doctabs.test.js — Pestañas de documento (v3.17.0)

   El contrato de almacenamiento es la mitad de la función:
     sketchwire.autosave  → SIEMPRE el documento activo (formato de siempre)
     sketchwire.tabs      → índice {v, active, order}
     sketchwire.doc.<id>  → los documentos dormidos
   Los tests observan por localStorage, como el resto del arnés.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app.js');

const TABS = 'sketchwire.tabs';
const AUTO = 'sketchwire.autosave';
const DOC = id => 'sketchwire.doc.' + id;

const indice = app => JSON.parse(app.dom.localStorage.getItem(TABS));
const barra = app => app.$('doctabs-list').querySelectorAll('.doctabs__tab');

const nuevaPestana = app => {
  const btn = app.$('btn-tab-new');
  btn.__fire('click', { target: btn });
  app.flush();
};

/** Click en la pestaña i-ésima de la barra (sobre su rótulo, como un usuario). */
const irAPestana = (app, i) => {
  const wrap = barra(app)[i];
  const label = wrap.querySelector('.doctabs__label');
  app.$('doctabs-list').__fire('click', { target: label });
  app.flush();
};

const dibujarRect = (app, x = 100, y = 100) => {
  app.selectTool('rect');
  app.$('modal-shape') && app.$('modal-shape').close();
  app.flush();
  app.drag(x, y, x + 80, y + 60);
};

/* ── Migración y arranque ── */

test('sin índice previo, el autosave existente se convierte en la única pestaña «Pizarra 1»', () => {
  const auto = { elements: [{ type: 'rect', x: 1, y: 1, w: 10, h: 10, color: '#123456', lineWidth: 2 }], settings: { overlapMode: 'normal' } };
  const app = loadApp({ autosave: auto });
  const idx = indice(app);
  assert.equal(idx.v, 1);
  assert.equal(idx.order.length, 1, 'una sola pestaña');
  assert.equal(idx.order[0].name, 'Pizarra 1');
  assert.equal(idx.active, idx.order[0].id);
  assert.equal(app.elements().length, 1, 'el dibujo del autosave sigue ahí');
  assert.equal(barra(app).length, 1, 'la barra enseña la pestaña');
  assert.equal(barra(app)[0].querySelector('.doctabs__close'), null,
    'la única pestaña no lleva botón de cerrar');
});

test('un índice corrupto se trata como ausente: una pestaña sobre el autosave', () => {
  const app = loadApp({ storage: { [TABS]: '{"v":1,"active":' } });
  const idx = indice(app);
  assert.equal(idx.order.length, 1);
  assert.equal(idx.order[0].name, 'Pizarra 1');
});

test('con índice y docs sembrados vuelven todas las pestañas, con la activa recordada', () => {
  const docB = { elements: [{ type: 'circle', x: 5, y: 5, w: 20, h: 20, color: '#654321', lineWidth: 2 }], settings: { overlapMode: 'normal' } };
  const app = loadApp({
    autosave: { elements: [], settings: { overlapMode: 'normal' } },
    storage: {
      [TABS]: { v: 1, active: 'aaa', order: [{ id: 'aaa', name: 'Croquis' }, { id: 'bbb', name: 'Planta' }] },
      [DOC('bbb')]: docB,
    },
  });
  assert.equal(barra(app).length, 2, 'vuelven las dos');
  const idx = indice(app);
  assert.equal(idx.active, 'aaa');
  assert.equal(app.elements().length, 0, 'la activa es la vacía');
  irAPestana(app, 1);
  assert.equal(app.elements()[0].type, 'circle', 'la dormida vuelve con su dibujo');
  assert.equal(indice(app).active, 'bbb');
});

/* ── Crear y cambiar ── */

test('el botón «+» crea una pestaña vacía y aparta el documento anterior', () => {
  const app = loadApp();
  dibujarRect(app);
  const antes = app.elements();
  assert.equal(antes.length, 1);

  nuevaPestana(app);
  const idx = indice(app);
  assert.equal(idx.order.length, 2);
  assert.equal(idx.order[1].name, 'Pizarra 2');
  assert.equal(idx.active, idx.order[1].id, 'la nueva queda activa');
  assert.equal(app.elements().length, 0, 'y nace vacía');
  const dormido = JSON.parse(app.dom.localStorage.getItem(DOC(idx.order[0].id)));
  assert.deepEqual(dormido.elements.map(e => e.type), ['rect'],
    'el dibujo anterior duerme en su sketchwire.doc.<id>');
});

test('cambiar de pestaña y volver devuelve cada dibujo a su sitio', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  app.selectTool('circle');
  app.$('modal-shape') && app.$('modal-shape').close();
  app.flush();
  app.drag(300, 300, 380, 380);
  assert.equal(app.elements()[0].type, 'circle');

  irAPestana(app, 0);
  assert.deepEqual(app.elements().map(e => e.type), ['rect'], 'vuelve el dibujo de A');
  const idx = indice(app);
  const dormidoB = JSON.parse(app.dom.localStorage.getItem(DOC(idx.order[1].id)));
  assert.deepEqual(dormidoB.elements.map(e => e.type), ['circle'], 'B duerme con el suyo');

  irAPestana(app, 1);
  assert.deepEqual(app.elements().map(e => e.type), ['circle'], 'y B despierta igual');
  assert.equal(app.dom.localStorage.getItem(DOC(idx.order[1].id)), null,
    'el doc despierto no se duplica: vive solo en el autosave');
});

test('«Pizarra N» rellena los huecos: cerrar la 2 y crear otra vuelve a dar «Pizarra 2»', () => {
  const app = loadApp();
  nuevaPestana(app);            // Pizarra 2
  nuevaPestana(app);            // Pizarra 3
  // Cerrar «Pizarra 2» (vacía: sin diálogo)
  const wrap = barra(app)[1];
  app.$('doctabs-list').__fire('click', { target: wrap.querySelector('.doctabs__close') });
  app.flush();
  nuevaPestana(app);
  assert.deepEqual(indice(app).order.map(t => t.name),
    ['Pizarra 1', 'Pizarra 3', 'Pizarra 2']);
});

/* ── Deshacer y aspecto, por pestaña ── */

test('el historial de deshacer es de cada pestaña: Ctrl+Z en B no toca A', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  dibujarRect(app, 300, 300);
  assert.equal(app.elements().length, 1);
  app.key('z', { ctrlKey: true });
  app.flush();
  assert.equal(app.elements().length, 0, 'el undo deshace lo de B');
  app.key('z', { ctrlKey: true });
  app.flush();
  assert.equal(app.elements().length, 0, 'y no sigue hacia el dibujo de A');
  irAPestana(app, 0);
  assert.equal(app.elements().length, 1, 'A intacta');
});

test('el aspecto del lienzo viaja con el documento: cada pestaña su fondo', () => {
  const app = loadApp();
  const picker = app.$('canvas-bg-picker');
  picker.value = '#1f2b2a';
  picker.__fire('input', { target: picker });
  picker.__fire('change', { target: picker });
  app.flush();
  assert.equal(JSON.parse(app.dom.localStorage.getItem(AUTO)).settings.canvasBg, '#1f2b2a',
    'el aspecto va en el settings del autosave');

  nuevaPestana(app);
  assert.notEqual(app.$('canvas-bg-picker').value, undefined);
  const fondoB = app.$('canvas-bg-picker').value;

  irAPestana(app, 0);
  assert.equal(app.$('canvas-bg-picker').value, '#1f2b2a', 'A recupera su fondo');
  irAPestana(app, 1);
  assert.equal(app.$('canvas-bg-picker').value, fondoB, 'B conserva el suyo');
});

/* ── Cerrar ── */

test('cerrar una pestaña con dibujo pasa por el diálogo propio, jamás por confirm()', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  // Cerrar la 0 (tiene dibujo) desde la barra
  const wrap = barra(app)[0];
  app.$('doctabs-list').__fire('click', { target: wrap.querySelector('.doctabs__close') });
  app.flush();
  assert.equal(app.context.confirms.length, 0, 'nada de confirm() nativo');
  assert.equal(app.$('modal-tab-close').open, true, 'se abre el diálogo propio');
  assert.equal(app.$('tab-close-name').textContent, 'Pizarra 1', 'con el nombre de la pestaña');

  // Cancelar no cierra nada
  const cancel = app.$('btn-tab-close-cancel');
  cancel.__fire('click', { target: cancel });
  app.flush();
  assert.equal(indice(app).order.length, 2, 'Cancelar conserva la pestaña');

  // Confirmar cierra, borra su doc y activa la vecina
  app.$('doctabs-list').__fire('click', { target: barra(app)[0].querySelector('.doctabs__close') });
  app.flush();
  const idCerrada = indice(app).order[0].id;
  const confirmar = app.$('btn-tab-close-confirm');
  confirmar.__fire('click', { target: confirmar });
  app.flush();
  const idx = indice(app);
  assert.equal(idx.order.length, 1);
  assert.equal(app.dom.localStorage.getItem(DOC(idCerrada)), null, 'su doc se borra');
  assert.equal(idx.active, idx.order[0].id);
});

test('cerrar una pestaña vacía no pregunta, y la última no se puede cerrar', () => {
  const app = loadApp();
  nuevaPestana(app);
  assert.equal(indice(app).order.length, 2);
  // La nueva (activa, vacía): cierre directo
  const wrap = barra(app)[1];
  app.$('doctabs-list').__fire('click', { target: wrap.querySelector('.doctabs__close') });
  app.flush();
  assert.equal(app.$('modal-tab-close').open, false, 'vacía: sin diálogo');
  assert.equal(indice(app).order.length, 1);
  // Y la superviviente ni siquiera ofrece la «×»
  assert.equal(barra(app)[0].querySelector('.doctabs__close'), null);
});

test('cerrar la pestaña activa despierta a la vecina con su dibujo', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  assert.equal(app.elements().length, 0);
  // Cerrar la activa (B, vacía) → debe despertar A con su rect
  const wrap = barra(app)[1];
  app.$('doctabs-list').__fire('click', { target: wrap.querySelector('.doctabs__close') });
  app.flush();
  assert.equal(indice(app).order.length, 1);
  assert.deepEqual(app.elements().map(e => e.type), ['rect']);
});

/* ── Renombrar ── */

test('doble clic renombra con un input inline: Enter confirma y Escape cancela', () => {
  const app = loadApp();
  const label = barra(app)[0].querySelector('.doctabs__label');
  app.$('doctabs-list').__fire('dblclick', { target: label });
  app.flush();
  let input = app.$('doctabs-list').querySelector('.doctabs__input');
  assert.ok(input, 'aparece el input inline');
  input.value = 'Fachada sur';
  input.__fire('keydown', { key: 'Enter', target: input });
  app.flush();
  assert.equal(indice(app).order[0].name, 'Fachada sur');
  assert.equal(barra(app)[0].querySelector('.doctabs__label').textContent, 'Fachada sur');

  // Escape: ni caso al texto escrito
  app.$('doctabs-list').__fire('dblclick', { target: barra(app)[0].querySelector('.doctabs__label') });
  app.flush();
  input = app.$('doctabs-list').querySelector('.doctabs__input');
  input.value = 'Otro nombre';
  input.__fire('keydown', { key: 'Escape', target: input });
  app.flush();
  assert.equal(indice(app).order[0].name, 'Fachada sur', 'Escape no cambia nada');

  // Un nombre vacío tampoco cuela
  app.$('doctabs-list').__fire('dblclick', { target: barra(app)[0].querySelector('.doctabs__label') });
  app.flush();
  input = app.$('doctabs-list').querySelector('.doctabs__input');
  input.value = '   ';
  input.__fire('keydown', { key: 'Enter', target: input });
  app.flush();
  assert.equal(indice(app).order[0].name, 'Fachada sur');
});

/* ── Integraciones ── */

test('«Limpiar todo» limpia SOLO la pestaña activa: las demás ni se enteran', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  dibujarRect(app, 300, 300);
  const idx = indice(app);
  const btn = app.$('btn-clear');
  btn.__fire('click', { target: btn });
  app.flush();
  assert.equal(app.elements().length, 0, 'la activa queda vacía');
  const dormido = JSON.parse(app.dom.localStorage.getItem(DOC(idx.order[0].id)));
  assert.equal(dormido.elements.length, 1, 'la otra pestaña conserva su dibujo');
  assert.deepEqual(indice(app).order.map(t => t.name), idx.order.map(t => t.name),
    'el índice de pestañas no se toca');
});

test('los atajos: Ctrl+Alt+T crea, Ctrl+Alt+flechas cambia, Ctrl+Alt+W cierra', () => {
  const app = loadApp();
  app.key('t', { ctrlKey: true, altKey: true, code: 'KeyT' });
  assert.equal(indice(app).order.length, 2, 'Ctrl+Alt+T crea pestaña');
  dibujarRect(app);

  app.key('ArrowLeft', { ctrlKey: true, altKey: true, code: 'ArrowLeft' });
  assert.equal(indice(app).active, indice(app).order[0].id, 'la flecha cambia de pestaña');
  app.key('ArrowRight', { ctrlKey: true, altKey: true, code: 'ArrowRight' });
  assert.equal(indice(app).active, indice(app).order[1].id);

  // Ctrl+Alt+W sobre la activa CON dibujo: abre el diálogo, no cierra a pelo
  app.key('w', { ctrlKey: true, altKey: true, code: 'KeyW' });
  assert.equal(app.$('modal-tab-close').open, true);
  const cancel = app.$('btn-tab-close-cancel');
  cancel.__fire('click', { target: cancel });
  app.flush();
  assert.equal(indice(app).order.length, 2);
});

test('el autosave del activo y el vuelco del dormido comparten forma (settings con aspecto)', () => {
  const app = loadApp();
  dibujarRect(app);
  nuevaPestana(app);
  const idx = indice(app);
  const dormido = JSON.parse(app.dom.localStorage.getItem(DOC(idx.order[0].id)));
  const activo = JSON.parse(app.dom.localStorage.getItem(AUTO));
  for (const doc of [dormido, activo]) {
    assert.ok(Array.isArray(doc.elements));
    for (const k of ['overlapMode', 'canvasBg', 'gridColor', 'showGrid']) {
      assert.ok(k in doc.settings, `settings.${k} presente`);
    }
  }
});
