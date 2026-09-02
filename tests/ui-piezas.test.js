'use strict';
/* ============================================================
   ui-piezas.test.js — Las piezas UI con `variant` (v3.22.0 y, desde la
   v3.23.0, también las veteranas button/input/card/nav, el dialog y uiPiece),
   más tabs y sidebar (piezas únicas). Son tipos de elemento REALES: aquí se
   fija su contrato de validación (la ausencia de variant ES el default), su
   render y su SVG. Las veteranas exportan a HTML como widget real (no SVG):
   su bloque va aparte, al final.
   Ejecutar: node --test tests/ui-piezas.test.js
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, createCtxStub } = require('./helpers/load.js');

const ctx = loadAll();
const {
  TOOLS, UI_DEFAULTS, FORM_VARIANTS, TABLE_VARIANTS, CHART_VARIANTS,
  BUTTON_VARIANTS, INPUT_VARIANTS, CARD_VARIANTS, NAV_VARIANTS,
  DIALOG_VARIANTS, UI_PIECE_VARIANTS,
  Renderer, Exporter,
} = ctx;

const VARIANTED = [
  ['formControl', FORM_VARIANTS],
  ['uiTable',     TABLE_VARIANTS],
  ['chart',       CHART_VARIANTS],
  // v3.23.0: las veteranas, el diálogo y «Piezas»
  ['button',      BUTTON_VARIANTS],
  ['input',       INPUT_VARIANTS],
  ['card',        CARD_VARIANTS],
  ['nav',         NAV_VARIANTS],
  ['dialog',      DIALOG_VARIANTS],
  ['uiPiece',     UI_PIECE_VARIANTS],
];
const SINGLES = ['tabs', 'sidebar'];
// Las veteranas emiten widget HTML real (<button>, <input>…), no SVG: quedan
// fuera del test de VECTOR_TYPES y tienen el suyo propio al final.
const VETERANOS = ['button', 'input', 'nav', 'card'];

const make = (type, extra = {}) => ({
  type, x: 20, y: 20,
  w: UI_DEFAULTS[type].w, h: UI_DEFAULTS[type].h,
  color: '#123456', lineWidth: 2, seed: 7, ...extra,
});

/* ---------------- validación (round-trip JSON) ---------------- */

test('todas las piezas pasan isValidElement sin campos extra', () => {
  for (const type of [...VARIANTED.map(v => v[0]), ...SINGLES]) {
    assert.ok(Exporter.isValidElement(make(type)), `${type} básico no valida`);
  }
});

test('variant válido se acepta; el default explícito se RECHAZA (la ausencia es el default)', () => {
  for (const [type, catalog] of VARIANTED) {
    for (const v of catalog.slice(1)) {
      assert.ok(Exporter.isValidElement(make(type, { variant: v.id })),
        `${type}/${v.id} no valida`);
    }
    // La primera entrada del catálogo, explícita, es el mismo aspecto guardado
    // dos veces: la lección de bold:false y fillPattern:'solid'.
    assert.equal(Exporter.isValidElement(make(type, { variant: catalog[0].id })), false,
      `${type} acepta el default explícito ${catalog[0].id}`);
  }
});

test('variant es un campo atado a su tipo: ajeno o cruzado, se rechaza', () => {
  // En un rect no significa nada
  assert.equal(Exporter.isValidElement(
    { type: 'rect', x: 0, y: 0, w: 100, h: 40, color: '#123456', lineWidth: 2, seed: 7, variant: 'radio' }),
  false);
  // Y en un botón (con catálogo desde la v3.23.0) una variante ajena tampoco
  assert.equal(Exporter.isValidElement(make('button', { variant: 'radio' })), false);
  // Y una variante de otro catálogo tampoco
  assert.equal(Exporter.isValidElement(make('formControl', { variant: 'bars' })), false);
  assert.equal(Exporter.isValidElement(make('chart', { variant: 'radio' })), false);
  assert.equal(Exporter.isValidElement(make('uiTable', { variant: 42 })), false);
});

test('el rótulo vale donde el renderer lo pinta', () => {
  for (const type of ['formControl', 'uiTable', 'dialog', 'button', 'input', 'nav', 'card']) {
    assert.ok(Exporter.isValidElement(make(type, { label: 'Enviar' })));
  }
});

/* ---------------- render ---------------- */

test('cada pieza y cada variante se renderizan sin lanzar', () => {
  const stub = createCtxStub();
  for (const [type, catalog] of VARIANTED) {
    for (const v of catalog) Renderer.renderElement(stub, make(type, { variant: v.id }));
  }
  for (const type of SINGLES) Renderer.renderElement(stub, make(type));
});

test('dos variantes nunca se pintan igual (huella de llamadas al ctx)', () => {
  for (const [type, catalog] of VARIANTED) {
    const huellas = catalog.map(v => {
      const stub = createCtxStub();
      const calls = [];
      const grabado = new Proxy(stub, {
        get(target, prop) {
          const val = target[prop];
          if (typeof val === 'function') {
            return (...args) => { calls.push(prop + ':' + JSON.stringify(args)); return val.apply(target, args); };
          }
          return val;
        },
        set(target, prop, value) { calls.push('set:' + String(prop) + '=' + String(value)); target[prop] = value; return true; },
      });
      Renderer.renderElement(grabado, make(type, { variant: v.id }));
      return calls.join('|');
    });
    assert.equal(new Set(huellas).size, huellas.length,
      `dos variantes de ${type} pintan idéntico`);
  }
});

/* ---------------- SVG y HTML ---------------- */

test('Exporter.svg emite markup con forma para cada pieza y variante', () => {
  for (const [type, catalog] of VARIANTED) {
    for (const v of catalog) {
      ctx.Exporter.svg([make(type, v.id === catalog[0].id ? {} : { variant: v.id })]);
      const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
      assert.ok(/(<rect|<circle|<line|<path|<polyline)/.test(out),
        `SVG sin formas para ${type}/${v.id}`);
    }
  }
  for (const type of SINGLES) {
    ctx.Exporter.svg([make(type)]);
    const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
    assert.ok(/(<rect|<circle|<line|<path)/.test(out), `SVG sin formas para ${type}`);
  }
});

test('los textos default del SVG coinciden con los del renderer', () => {
  // La duplicación renderer/exporter es deliberada; que no diverja.
  ctx.Exporter.svg([make('formControl'), make('dialog')]);
  const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.ok(out.includes('Opción'), 'falta el default «Opción» del formControl');
  assert.ok(out.includes('Diálogo'), 'falta el default «Diálogo» del dialog');
});

test('en HTML las piezas de dibujo van por el <svg> incrustado (VECTOR_TYPES)', () => {
  ctx.Exporter.html([make('tabs'), make('sidebar'), make('uiPiece')]);
  const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
  assert.ok(out.includes('<svg'), 'el HTML no incrusta el SVG de las piezas');
});

/* ---------------- las veteranas en HTML (v3.23.0) ---------------- */

test('las veteranas siguen exportando widget HTML real, con o sin variante', () => {
  // El export HTML no cambió de naturaleza al ganar catálogo: un botón sigue
  // siendo <button>. La variante solo se refleja donde el HTML la tiene
  // gratis: search cambia el type del input, textarea cambia la etiqueta.
  for (const type of VETERANOS) {
    ctx.Exporter.html([make(type)]);
    const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
    const tag = { button: '<button', input: '<input', nav: '<nav', card: '<div' }[type];
    assert.ok(out.includes(tag), `${type} sin su widget HTML`);
  }
  ctx.Exporter.html([make('input', { variant: 'search' })]);
  assert.ok(ctx.URL.blobs[ctx.URL.blobs.length - 1].content.includes('type="search"'),
    'input/search no emite type="search"');
  ctx.Exporter.html([make('input', { variant: 'textarea' })]);
  assert.ok(ctx.URL.blobs[ctx.URL.blobs.length - 1].content.includes('<textarea'),
    'input/textarea no emite <textarea>');
});
