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

test('index publica v2.12.0 sin caché antigua y documenta el tamaño del borrador', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /class="topbar__badge">v2\.12\.0</);
  assert.match(html, /css\/styles\.css\?v=2\.12\.0/);
  assert.match(html, /src\/js\/app\.js\?v=2\.12\.0/);
  assert.match(html, /src\/js\/building\.js\?v=2\.12\.0/);
  assert.match(html, /src\/js\/garden\.js\?v=2\.12\.0/);
  assert.match(html, /src\/js\/config\.js\?v=2\.12\.0/);
  assert.match(html, /id="modal-planta"/);
  assert.match(html, /id="modal-balcony"/);
  assert.match(html, /id="modal-plot"/);
  assert.match(html, /id="modal-path"/);
  assert.match(html, /id="modal-herb"/);
  assert.match(html, /id="modal-eraser"/);
  assert.match(html, /id="modal-stroke"/);
  assert.match(html, /id="modal-shape"/);
  assert.match(html, /id="modal-text"/);
  assert.match(html, /id="modal-ui"/);
  assert.match(html, /id="stroke-label">Trazo</);
  assert.match(html, /Tamaño del borrador/);
  assert.match(html, /entre 4 y 100 px \(16 px por defecto\)/);
});

// v2.10.0: los cuatro modales de ajustes llevan su bloque «Posición y tamaño»
// (visible solo con selección) y el catálogo de emoji su deslizador de tamaño,
// acotado por las mismas constantes que usa app.js al restaurar prefs.
test('los modales de ajustes llevan geometría y el emoji su tamaño acotado', () => {
  const ctx = load('src/js/config.js');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  for (const p of ['stroke-modal', 'shape-modal', 'text-modal', 'ui-modal']) {
    assert.match(html, new RegExp(`id="${p}-geo" hidden`),
      `#${p}-geo debe existir y nacer oculto (sin selección no hay nada que colocar)`);
    for (const f of ['x', 'y', 'w', 'h']) {
      assert.match(html, new RegExp(`id="${p}-${f}"`), `falta el campo #${p}-${f}`);
    }
  }
  const slider = html.match(/<input[^>]*id="emoji-modal-size"[^>]*>/);
  assert.ok(slider, 'falta el deslizador de tamaño del emoji');
  assert.match(slider[0], new RegExp(`min="${ctx.EMOJI_MIN_SIZE}"`),
    'el min del deslizador debe ser EMOJI_MIN_SIZE');
  assert.match(slider[0], new RegExp(`max="${ctx.EMOJI_MAX_SIZE}"`),
    'y el max, EMOJI_MAX_SIZE (restorePrefs recorta contra ellas)');
  // El deslizador del panel llega hasta EMOJI_MAX_SIZE (con Emoji activo se
  // retitula vía #font-label y gobierna emojiSize), y el rótulo del componente
  // lleva el mismo tope de 120 que aplican applyLabel y restorePrefs.
  const fontSlider = html.match(/<input[^>]*id="font-slider"[^>]*>/);
  assert.match(fontSlider[0], new RegExp(`max="${ctx.EMOJI_MAX_SIZE}"`),
    'el deslizador del panel debe alcanzar EMOJI_MAX_SIZE o un emoji grande lo desborda');
  assert.match(html, /id="font-label"/, 'falta el rótulo retitulable del deslizador');
  const uiLabel = html.match(/<input[^>]*id="ui-modal-label"[^>]*>/);
  assert.match(uiLabel[0], /maxlength="120"/,
    'el rótulo debe recortarse donde se escribe, no solo al recargar');
});

// El panel se reorganizó en secciones que aparecen según la herramienta activa
// (syncPanelSections). Dos contratos que fallarían en silencio:
//   1. Sin `.panel__section[hidden]{display:none}` el atributo `hidden` NO
//      oculta nada, porque `.panel__section` es display:flex y gana al estilo
//      del user-agent. La misma trampa que ya obligó a escribir `.btn[hidden]`.
//      El síntoma sería el panel entero visible siempre: exactamente el estado
//      previo, y ninguna guarda del arnés lo notaría (allí `hidden` es una
//      propiedad JS, no CSS).
//   2. Las secciones que el JS oculta tienen que existir con ese id.
test('el panel tiene sus secciones contextuales y el CSS que las oculta', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['panel-sec-stroke', 'panel-sec-fill', 'panel-sec-text',
    'panel-sec-build', 'panel-sec-garden', 'panel-sec-canvas', 'panel-sec-selection']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la sección #${id}`);
  }
  // Cada bloque del panel que declara `display` necesita su regla `[hidden]`:
  // ese `display` gana al del user-agent y el atributo no oculta nada. Ha
  // mordido cuatro veces (sección, casilla, ⚙ y campo), así que se pinta la
  // lista entera en el artefacto compilado.
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const hiddenRule = /\{\s*display:\s*none/;
  for (const sel of ['\\.panel__section\\[hidden\\]', '\\.panel__check\\[hidden\\]',
    '\\.panel__field\\[hidden\\]', '\\.panel__gear\\[hidden\\]']) {
    assert.match(css, new RegExp(sel + '[^{]*' + hiddenRule.source),
      `sin ${sel.replace(/\\/g, '')} el atributo hidden no oculta nada`);
  }
  // El cursor de «Select» es CSS puro (el arnés vm no lo ve): flecha normal,
  // ni la cruz de dibujar ni el `move` de Mover — la herramienta ni crea ni
  // desplaza, y el cursor es lo que lo promete.
  assert.match(css, /\.canvas-area__canvas--pick\s*\{\s*cursor:\s*default/,
    'falta el cursor de la herramienta «Select» en el CSS compilado');
});

// Mismo contrato que los gemelos de Edificios: el grosor vive a la vez en el
// panel y en #modal-stroke, y syncStrokeControls() asigna el valor a los dos.
// Con rangos distintos, mover uno recortaría el otro sin avisar.
test('los controles gemelos del trazo (panel y modal) ofrecen lo mismo', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const rangeOf = id => {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `no existe el slider #${id}`);
    return ['min', 'max', 'step'].map(a => (tag[0].match(new RegExp(`${a}="([^"]+)"`)) || [])[1]);
  };
  assert.deepEqual(rangeOf('stroke-modal-slider'), rangeOf('stroke-slider'),
    'el grosor del modal y el del panel deben cubrir el mismo rango');
  assert.deepEqual(rangeOf('shape-modal-slider'), rangeOf('stroke-slider'),
    'y el de #modal-shape, también');
  assert.deepEqual(rangeOf('shape-modal-opacity'), rangeOf('fill-opacity-slider'),
    'la opacidad del modal de forma y la del panel, lo mismo');
  assert.deepEqual(rangeOf('ui-modal-slider'), rangeOf('stroke-slider'),
    'el grosor de #modal-ui, el mismo rango que el del panel');
  assert.deepEqual(rangeOf('text-modal-size'), rangeOf('font-slider'),
    'el tamaño de letra de #modal-text y el del panel deben cubrir el mismo rango');
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

// Regresión de la auditoría 2026-08-08: el texto de .btn--danger («Eliminar
// selección», «Limpiar todo» — justo las acciones destructivas) daba 4.13:1
// (3.61 en hover) sobre su fondo translúcido, por debajo del AA (4.5:1 para
// texto pequeño). El ratio se calcula aquí sobre el artefacto compilado real:
// si alguien re-oscurece el token o sube el alpha del fondo, esto falla.
test('el texto de .btn--danger cumple AA (≥4.5:1) en reposo y en hover', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const lum = hex => {
    const [r, g, b] = hex.match(/\w\w/g).map(h => parseInt(h, 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // rgba(R,G,B,a) compuesto sobre un fondo opaco → hex efectivo
  const over = (rgba, base) => {
    const [, r, g, b, a] = rgba.map(Number);
    return base.match(/\w\w/g).map((h, i) =>
      Math.round([r, g, b][i] * a + parseInt(h, 16) * (1 - a))
        .toString(16).padStart(2, '0')).join('');
  };
  const text = css.match(/--color-danger:\s*#([0-9a-f]{6})/i)[1];
  const panel = css.match(/--bg-panel:\s*#([0-9a-f]{6})/i)[1];
  const rest = css.match(/\.btn--danger \{[^}]*rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
  const hover = css.match(/\.btn--danger:hover \{[^}]*rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
  assert.ok(rest && hover, 'los fondos rgba de .btn--danger deben existir');
  const rRest = ratio(text, over(rest, panel));
  const rHover = ratio(text, over(hover, panel));
  assert.ok(rRest >= 4.5, `reposo ${rRest.toFixed(2)}:1 — debe ser ≥ 4.5:1`);
  assert.ok(rHover >= 4.5, `hover ${rHover.toFixed(2)}:1 — debe ser ≥ 4.5:1`);
});

// Auditoría 2026-08-08: los pares de texto pequeño secundario y la pista de
// los sliders quedaban por debajo del mínimo WCAG. Se calculan aquí sobre los
// tokens reales del artefacto, para que un retoque de paleta no los devuelva
// por debajo sin que falle nada.
test('texto secundario ≥4.5:1 y pista del slider ≥3:1 sobre sus fondos reales', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const token = name => css.match(new RegExp(`${name}:\\s*#([0-9a-f]{6})`, 'i'))[1];
  const lum = hex => {
    const [r, g, b] = hex.match(/\w\w/g).map(h => parseInt(h, 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const panel = token('--bg-panel'), hover = token('--bg-hover');
  const dim = ratio(token('--text-dim'), panel);
  const muted = ratio(token('--text-muted'), hover);
  const track = ratio(token('--slider-track'), panel);
  assert.ok(dim >= 4.5, `--text-dim sobre panel: ${dim.toFixed(2)}:1 — debe ser ≥ 4.5`);
  assert.ok(muted >= 4.5, `--text-muted sobre hover: ${muted.toFixed(2)}:1 — debe ser ≥ 4.5`);
  assert.ok(track >= 3, `--slider-track sobre panel: ${track.toFixed(2)}:1 — debe ser ≥ 3`);
});

// Regresión de la auditoría 2026-08-08: tres controles del panel no tenían
// nombre accesible (un lector anunciaba «deslizador» sin decir qué ajusta), y
// el cajón del panel no anunciaba su estado. Guard textual sobre index.html.
test('los controles del panel tienen nombre accesible y el cajón anuncia su estado', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = id => (html.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`)) || [null])[0];
  assert.match(html, /<label[^>]*for="font-slider"/, 'el slider de texto necesita <label for>');
  assert.match(html, /<label[^>]*for="zoom-slider"/, 'el slider de zoom necesita <label for>');
  assert.match(tag('color-picker'), /aria-label="/, 'el picker de color del trazo necesita aria-label');
  assert.match(tag('btn-panel-toggle'), /aria-expanded="false"/, 'el toggle del cajón anuncia su estado');
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

// Mismo contrato para el alto de la cancela: el rango del deslizador y los
// topes con los que building.js lo acota son el mismo dato en dos sitios.
test('el slider de alto de cancela cubre justo el rango que acota building.js', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.match(/<input[^>]*id="wall-gate-height"[\s\S]*?\/>/);
  assert.ok(tag, 'no existe el slider #wall-gate-height');
  const attrs = tag[0].replace(/\s+/g, ' ');
  const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  const { Building } = loadAll();
  assert.equal(attr('min'), Building.WALL_GATE_H_MIN);
  assert.equal(attr('max'), Building.WALL_GATE_H_MAX);
  assert.ok(attr('value') >= Building.WALL_GATE_H_MIN && attr('value') <= Building.WALL_GATE_H_MAX);
});

test('el slider de alto de verja cubre justo el rango que acota building.js', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.match(/<input[^>]*id="wall-railing-height"[\s\S]*?\/>/);
  assert.ok(tag, 'no existe el slider #wall-railing-height');
  const attrs = tag[0].replace(/\s+/g, ' ');
  const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  const { Building } = loadAll();
  assert.equal(attr('min'), Building.WALL_RAIL_H_MIN);
  assert.equal(attr('max'), Building.WALL_RAIL_H_MAX);
});

test('el slider de Verjas cubre exactamente de 0 a 350 cm', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.match(/<input[^>]*id="fence-height"[\s\S]*?\/>/);
  assert.ok(tag, 'no existe el slider #fence-height');
  const attrs = tag[0].replace(/\s+/g, ' ');
  const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  const { Building } = loadAll();
  assert.equal(attr('min'), Building.FENCE_H_MIN_CM);
  assert.equal(attr('max'), Building.FENCE_H_MAX_CM);
  assert.ok(attr('value') >= Building.FENCE_H_MIN_CM &&
    attr('value') <= Building.FENCE_H_MAX_CM);
});

test('el slider de Cancela cubre exactamente de 0 a 350 cm', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.match(/<input[^>]*id="gate-height"[\s\S]*?\/>/);
  assert.ok(tag, 'no existe el slider #gate-height');
  const attrs = tag[0].replace(/\s+/g, ' ');
  const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
  const { Building } = loadAll();
  assert.equal(attr('min'), Building.GATE_H_MIN_CM);
  assert.equal(attr('max'), Building.GATE_H_MAX_CM);
  assert.ok(attr('value') >= Building.GATE_H_MIN_CM &&
    attr('value') <= Building.GATE_H_MAX_CM);
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

// Todas las imágenes viven en src/img/. Una suelta en la raíz o en una carpeta
// propia funcionaría igual en desarrollo y desaparecería del publicable: el
// build solo aplana src/img/ → img/, no sabe de ninguna otra ruta.
test('no hay imágenes fuera de src/img/', () => {
  const root = path.resolve(__dirname, '..');
  const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results',
                        'playwright-report', 'src']);
  const IMG = /\.(png|jpe?g|gif|webp|svg|ico|avif)$/i;
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : walk(full);
    return IMG.test(e.name) ? [path.relative(root, full)] : [];
  });
  assert.deepEqual(walk(root), [], 'mueve estas imágenes a src/img/');
  // Y dentro de src/ solo puede haberlas en img/.
  const inSrc = fs.readdirSync(path.join(root, 'src'), { withFileTypes: true })
    .filter(e => e.name !== 'img')
    .flatMap(e => e.isDirectory() ? walk(path.join(root, 'src', e.name)) : []);
  assert.deepEqual(inSrc, [], 'mueve estas imágenes a src/img/');
});
