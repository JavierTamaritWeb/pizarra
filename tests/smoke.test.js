'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, loadAll, getGlobal } = require('./helpers/load.js');

test('config.js expone TOOLS y CANVAS_W en el contexto', () => {
  const ctx = load('js/config.js');
  assert.ok(ctx.TOOLS, 'TOOLS debe existir');
  assert.equal(typeof ctx.TOOLS, 'object');
  assert.equal(ctx.TOOLS.PENCIL, 'pencil');
  assert.equal(ctx.CANVAS_W, 1200);
  assert.equal(ctx.CANVAS_H, 800);
  assert.ok(Array.isArray(ctx.TOOL_GROUPS));
  assert.ok(Array.isArray(ctx.COLORS));
  assert.equal(typeof ctx.UI_DEFAULTS, 'object');
  assert.equal(typeof ctx.SKETCHY_FONT, 'string');
  // getGlobal lee bindings const arbitrarios del contexto
  assert.equal(getGlobal(ctx, 'CANVAS_W'), 1200);
});

test('loadAll carga todos los scripts en orden y expone los globals', () => {
  const ctx = loadAll();
  assert.equal(typeof ctx.Sketchy, 'object');
  assert.equal(typeof ctx.Sketchy.line, 'function');
  assert.equal(typeof ctx.ShapeRotation.rotateElement, 'function');
  assert.equal(typeof ctx.Renderer, 'object');
  assert.equal(typeof ctx.Renderer.renderElement, 'function');
  assert.equal(typeof ctx.Renderer.renderElements, 'function');
  assert.equal(typeof ctx.Renderer.renderScene, 'function');
  assert.equal(typeof ctx.Renderer.eraserSize, 'function');
  assert.equal(typeof ctx.Exporter, 'object');
  assert.equal(typeof ctx.Exporter.png, 'function');
  assert.equal(typeof ctx.Building, 'object');
  assert.equal(typeof ctx.Building.elements, 'function');
  assert.equal(typeof ctx.Garden, 'object');
  assert.equal(typeof ctx.Garden.elements, 'function');
  assert.equal(typeof ctx.Templates, 'object');
});

test('index publica v1.24.0 sin caché antigua y documenta el tamaño del borrador', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /class="topbar__badge">v1\.24\.0</);
  assert.match(html, /css\/styles\.css\?v=1\.24\.0/);
  assert.match(html, /js\/app\.js\?v=1\.24\.0/);
  assert.match(html, /js\/building\.js\?v=1\.24\.0/);
  assert.match(html, /js\/garden\.js\?v=1\.24\.0/);
  assert.match(html, /js\/config\.js\?v=1\.24\.0/);
  assert.match(html, /id="modal-planta"/);
  assert.match(html, /id="modal-balcony"/);
  assert.match(html, /id="modal-plot"/);
  assert.match(html, /id="modal-path"/);
  assert.match(html, /id="modal-herb"/);
  assert.match(html, /id="modal-eraser"/);
  assert.match(html, /id="stroke-label">Trazo</);
  assert.match(html, /Tamaño del borrador/);
  assert.match(html, /entre 4 y 100 px \(16 px por defecto\)/);
});

// El rango del slider de ancho de camino y los topes con los que garden.js
// acota `pathWidth` son el mismo dato en dos sitios. Si se separan no falla
// nada: el slider deja pedir un ancho que el módulo recorta en silencio, o se
// queda corto respecto a lo que el módulo admite.
test('el slider de ancho de camino cubre justo el rango que acota garden.js', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.match(/<input[^>]*id="garden-path-width"[\s\S]*?\/>/);
  assert.ok(tag, 'no existe el slider #garden-path-width');
  const attrs = tag[0].replace(/\s+/g, ' ');
  const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  const { Garden } = loadAll();
  assert.equal(attr('min'), Garden.PATH_W_MIN);
  assert.equal(attr('max'), Garden.PATH_W_MAX);
  // Y su valor inicial cae dentro, o el panel arrancaría mintiendo.
  assert.ok(attr('value') >= Garden.PATH_W_MIN && attr('value') <= Garden.PATH_W_MAX);
});

// Los ajustes de Edificios existen DOS veces (panel + modal de Fachada) y
// app.js los sincroniza fijando `.value` en ambos. Si a un gemelo le faltara
// una opción o tuviera otro rango, `syncBuildControls` no fallaría: dejaría
// el control en blanco o en otro valor, en silencio.
test('los controles gemelos de Edificios (panel y modal) ofrecen lo mismo', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const optionsOf = id => {
    const block = html.match(new RegExp(`id="${id}"[\\s\\S]*?</select>`));
    assert.ok(block, `no existe el <select> #${id}`);
    return [...block[0].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
  };
  for (const [panelId, modalId] of [
    ['build-floors', 'facade-floors'],
    ['build-bays', 'facade-bays'],
    ['build-roof-type', 'facade-roof-type'],
  ]) {
    assert.deepEqual([...optionsOf(panelId)], [...optionsOf(modalId)],
      `#${panelId} y #${modalId} deben ofrecer las mismas opciones`);
  }
  // El slider de pendiente: mismo rango y paso en los dos sitios.
  const rangeOf = id => {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[\\s\\S]*?/>`));
    assert.ok(tag, `no existe el slider #${id}`);
    const attrs = tag[0].replace(/\s+/g, ' ');
    return ['min', 'max', 'step'].map(a => attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  };
  assert.deepEqual([...rangeOf('build-roof-pitch')], [...rangeOf('facade-roof-pitch')],
    'el slider de pendiente debe tener el mismo min/max/step en panel y modal');
});
