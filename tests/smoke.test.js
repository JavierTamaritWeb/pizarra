'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, loadAll, getGlobal } = require('./helpers/load.js');

test('config.js expone TOOLS y CANVAS_W en el contexto', () => {
  const ctx = load('src/js/config.js');
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

test('index publica v2.1.0 sin caché antigua y documenta el tamaño del borrador', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /class="topbar__badge">v2\.1\.0</);
  assert.match(html, /css\/styles\.css\?v=2\.1\.0/);
  assert.match(html, /src\/js\/app\.js\?v=2\.1\.0/);
  assert.match(html, /src\/js\/building\.js\?v=2\.1\.0/);
  assert.match(html, /src\/js\/garden\.js\?v=2\.1\.0/);
  assert.match(html, /src\/js\/config\.js\?v=2\.1\.0/);
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

// css/styles.css es un artefacto compilado desde scss/ (Gulp 5 + dart-sass).
// Este guard vigila sus contratos de runtime: que nadie lo edite a mano
// (banner), que la convención 1rem = 10px siga en pie, que las custom
// properties responsive existan (los e2e las asertan computadas), que los
// selectores vendor de los thumbs no acaben agrupados con coma (un selector
// desconocido invalida el grupo entero) y — la clave — que --font-sketch y
// el fallback de config.js digan lo mismo, porque en navegador SKETCHY_FONT
// se lee de esa custom property y una divergencia sería invisible en el vm.
test('css/styles.css es el artefacto compilado y conserva sus contratos', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  assert.match(css, /GENERADO AUTOMÁTICAMENTE desde src\/scss\//);
  assert.match(css, /html \{\s*font-size: 62\.5%;/);
  assert.match(css, /--sidebar-w: 7\.2rem/);
  assert.match(css, /--sidebar-w: 13\.2rem/);
  for (const mq of ['(min-width: 1201px)', '(max-width: 1100px)',
                    '(max-width: 420px)', '(max-width: 360px)']) {
    assert.ok(css.includes(`@media ${mq}`), `falta @media ${mq}`);
  }
  assert.match(css, /\ninput\[type=range\]::-webkit-slider-thumb \{/);
  assert.match(css, /\ninput\[type=range\]::-moz-range-thumb \{/);
  const m = css.match(/--font-sketch:\s*([^;]+);/);
  assert.ok(m, 'falta --font-sketch en :root');
  const ctx = load('src/js/config.js'); // sin getComputedStyle: SKETCHY_FONT es el fallback
  assert.equal(m[1].trim().replace(/"/g, "'"), ctx.SKETCHY_FONT);
});

// Regresión de var(--text-main) (BUGS.md): una custom property usada pero no
// definida no falla en ningún sitio — ni SCSS, ni stylelint, ni el navegador
// avisan; la declaración se descarta en silencio y gana la herencia.
test('toda custom property usada en css/styles.css está definida', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const use of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    assert.ok(defined.has(use[1]), `var(${use[1]}) se usa pero no está definida`);
  }
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

// Los iconos son binarios que nadie compila: si un fichero se renombra o no
// llega al repo, el navegador se limita a un 404 silencioso y cae al icono
// por defecto. Y un `sizes` que miente hace que el sistema elija mal la pieza.
test('todos los iconos referenciados existen y miden lo que declaran', () => {
  const root = path.resolve(__dirname, '..');
  const pngSize = rel => {
    const buf = fs.readFileSync(path.join(root, rel)); // IHDR: ancho/alto en 16..24
    assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${rel} no es un PNG válido`);
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  };

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g)]
    .map(m => m[0]);
  assert.ok(links.length >= 5, 'el <head> debe declarar el .ico, los PNG y el manifiesto');
  for (const tag of links) {
    const href = tag.match(/href="([^"]+)"/)[1];
    assert.ok(!href.startsWith('/'), `${href} debe ser relativo (la app se abre por file://)`);
    assert.ok(fs.existsSync(path.join(root, href)), `falta ${href}`);
    const sizes = tag.match(/sizes="(\d+)x\d+"/);
    if (sizes && href.endsWith('.png')) {
      assert.deepEqual(pngSize(href), [Number(sizes[1]), Number(sizes[1])],
        `${href} no mide lo que declara su atributo sizes`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), `falta ${icon.src} del manifiesto`);
    const [w, h] = pngSize(icon.src);
    assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} no mide ${icon.sizes}`);
  }
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable'),
    'falta un icono maskable: Android recorta el resto en un círculo');

  // El logo de la topbar es la única imagen del documento, y su ?v= la mete
  // en el mismo cache-busting que el resto de assets versionados.
  const logo = html.match(/<img[^>]*class="topbar__logo-icon"[^>]*>/);
  assert.ok(logo, 'la marca de la topbar debe ser un <img>, no un glifo');
  const src = logo[0].match(/src="([^"?]+)/)[1];
  assert.ok(fs.existsSync(path.join(root, src)), `falta ${src}`);
  assert.match(logo[0], /alt=""/, 'el logo es decorativo: alt vacío, el nombre va al lado');
  const [lw, lh] = pngSize(src);
  assert.equal(lw, lh, `${src} debe ser cuadrado`);
  assert.ok(lw >= 64, `${src} debe cubrir pantallas 2x sobre sus 32 px de caja`);
});
