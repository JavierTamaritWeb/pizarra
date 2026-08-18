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

test('index publica v3.4.6 sin caché antigua y documenta el tamaño del borrador', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /class="topbar__badge">v3\.4\.6</);
  assert.match(html, /css\/styles\.css\?v=3\.4\.6/);
  assert.match(html, /src\/js\/app\.js\?v=3\.4\.6/);
  assert.match(html, /src\/js\/building\.js\?v=3\.4\.6/);
  assert.match(html, /src\/js\/garden\.js\?v=3\.4\.6/);
  assert.match(html, /src\/js\/config\.js\?v=3\.4\.6/);
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
  assert.match(html, /id="modal-select"/);
  assert.match(html, /id="modal-airbrush"/);
  // 3D: los tres modales de extrusión y el de la esfera, que no lleva catálogo
  assert.match(html, /id="modal-prism"/);
  assert.match(html, /id="modal-pyramid"/);
  assert.match(html, /id="modal-frustum"/);
  assert.match(html, /id="modal-sphere"/);
  assert.match(html, /src\/js\/solid\.js\?v=3\.4\.6/);
  assert.match(html, /src\/js\/airbrush\.js\?v=3\.4\.6/);
  // «Los clics acumulan selección» dejó el panel en la v2.17.0 y es el ajuste
  // de «Select». Si volviera a existir la casilla vieja habría dos controles
  // para un mismo estado, y solo uno cableado: el arnés `node:vm` fabrica un
  // <div> vacío para cualquier id desconocido, así que un id huérfano no
  // rompería ningún test — solo dejaría de hacer nada en el navegador.
  assert.match(html, /id="select-modal-multi"/);
  assert.doesNotMatch(html, /id="check-multi-select"/,
    'la casilla vieja del panel no debe volver');
  // El grosor dejó el panel en la v2.21.0: era un mando cuyo significado
  // dependía de la herramienta activa (con el Borrador gobernaba SU tamaño y se
  // retitulaba). Vive en los cinco modales de ajustes, uno por herramienta.
  assert.doesNotMatch(html, /id="stroke-slider"|id="stroke-val"|id="stroke-label"/,
    'el deslizador de grosor del panel no debe volver');
  assert.match(html, /Tamaño del borrador/);
  assert.match(html, /entre 4 y 100 px \(16 px por defecto\)/);
});

// La ayuda de la app seguía diciendo que «Los clics acumulan selección» era la
// casilla «del panel», de donde salió en la v2.17.0. La guarda de al lado —que
// el id viejo no vuelva— no lo veía: la casilla existe, solo que en otro sitio,
// así que el texto podía mentir indefinidamente sin romper nada.
test('la ayuda no manda al panel a buscar la casilla de selección', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const linea = html.match(/<li>Multi-selección:[\s\S]*?<\/li>/);
  assert.ok(linea, 'falta la línea de multi-selección en la ayuda');
  assert.doesNotMatch(linea[0], /acumulan selección<\/strong> del panel/,
    'la casilla dejó el panel en la v2.17.0');
  assert.match(linea[0], /Mover/, 'la ayuda debe nombrar las herramientas que la abren');
  assert.match(linea[0], /Select/);
});

// v2.20.0: el papel del lienzo (pizarra azulada + cuadrícula casi blanca) está
// escrito DOS veces —la constante de app.js y el atributo `value` del mando en
// index.html— y solo la primera manda. Si divergen, el mando enseña un color
// que el lienzo no tiene hasta que alguien lo toca; el arnés `node:vm` no lo
// vería, porque lee el valor que app.js le acaba de asignar.
test('los mandos de Fondo y Cuadrícula nacen con el color que dice app.js', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'src/js/app.js'), 'utf8');
  for (const [constante, id] of [
    ['DEFAULT_CANVAS_BG', 'canvas-bg-picker'],
    ['DEFAULT_GRID_COLOR', 'grid-color-picker'],
  ]) {
    const enJs = app.match(new RegExp(`const ${constante} = '(#[0-9a-f]{6})'`));
    assert.ok(enJs, `no se encuentra ${constante} en app.js`);
    const enHtml = html.match(new RegExp(`id="${id}" value="(#[0-9a-f]{6})"`));
    assert.ok(enHtml, `no se encuentra el value de #${id} en index.html`);
    assert.equal(enHtml[1], enJs[1], `#${id} no coincide con ${constante}`);
  }
});

// v2.10.0: los cuatro modales de ajustes llevan su bloque «Posición y tamaño»
// (visible solo con selección) y el catálogo de emoji su deslizador de tamaño,
// acotado por las mismas constantes que usa app.js al restaurar prefs.
test('los modales de ajustes llevan geometría y el emoji su tamaño acotado', () => {
  const ctx = load('src/js/config.js');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  for (const p of ['stroke-modal', 'shape-modal', 'text-modal', 'ui-modal', 'airbrush-modal']) {
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
  // Curvatura (v3.2.0): el rango vive en config.js y en el HTML, y restorePrefs
  // recorta contra él — si divergen, una comba guardada válida se recortaría a
  // un valor que el mando no puede enseñar.
  const curva = html.match(/<input[^>]*id="stroke-modal-curve"[^>]*>/);
  assert.ok(curva, 'falta el deslizador de curvatura');
  assert.match(curva[0], new RegExp(`min="${ctx.CURVE_BULGE_MIN}"`));
  assert.match(curva[0], new RegExp(`max="${ctx.CURVE_BULGE_MAX}"`));
  assert.match(curva[0], new RegExp(`step="${ctx.CURVE_BULGE_STEP}"`));
  const curvePath = load('src/js/curve-path.js').CurvePath;
  assert.match(curva[0], new RegExp(`value="${Math.round(curvePath.DEFAULT_BULGE * 100)}"`),
    'el valor inicial del HTML debe ser la comba de fábrica de CurvePath');
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
test('todo botón de la barra superior envuelve su rótulo en .btn__label', () => {
  // Por debajo de $topbar-icons la barra se queda en iconos ocultando
  // `.btn__label`. Un botón cuyo texto vaya suelto —como iban los siete hasta
  // la v2.42.1— no tiene nada que el CSS pueda ocultar y vuelve a desbordar
  // la barra, dejando «Exportar» fuera de la pantalla. El arnés vm no lo ve.
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const nav = html.match(/<nav class="topbar__actions">[\s\S]*?<\/nav>/);
  assert.ok(nav, 'falta la barra de acciones');
  const botones = nav[0].match(/<button[\s\S]*?<\/button>/g) || [];
  assert.ok(botones.length >= 7, `sólo se encontraron ${botones.length} botones`);
  for (const b of botones) {
    const id = (b.match(/id="([^"]+)"/) || [])[1] || '(sin id)';
    assert.match(b, /<span class="btn__label">/,
      `el rótulo de #${id} va suelto: hay que envolverlo en .btn__label`);
    // Sin rótulo a la vista, el tooltip es lo único que queda para saber qué
    // hace el botón.
    assert.match(b, /title="/, `#${id} se queda sin tooltip al ir en icono`);
  }
  // Y la regla que los oculta tiene que estar en el artefacto compilado.
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  assert.match(css, /max-width:\s*1060px/,
    'falta el breakpoint que deja la barra en iconos');
  assert.match(css, /\.topbar__actions \.btn__label/,
    'falta la regla que oculta los rótulos de la barra');
  // Nunca en absolute: escaparía del recorte del ancestro y estiraría el
  // scroll horizontal de la página en un móvil (regresión de la v2.42.1).
  const regla = css.match(/\.topbar__actions \.btn__label\s*\{[^}]*\}/);
  assert.ok(regla && !/position:\s*absolute/.test(regla[0]),
    'el rótulo recortado no puede ser absolute: escapa del overflow y crea scroll');
});

test('«Abrir proyecto» dice lo que abre y lo que se lleva por delante', () => {
  // Se llamaba «Importar» a secas: ni el formato (.json, y solo ese de los
  // cinco que exporta) ni que SUSTITUYE el lienzo. El usuario preguntó qué
  // hacía el botón (v2.42.0). El arnés vm no ve el texto ni el title.
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const btn = html.match(/<button[^>]*id="btn-import"[\s\S]*?<\/button>/);
  assert.ok(btn, 'falta el botón de abrir proyecto');
  assert.match(btn[0], /Abrir proyecto/,
    'el botón tiene que decir que abre un proyecto, no «Importar» a secas');
  assert.match(btn[0], /title="[^"]*\.json[^"]*"/,
    'su ayuda tiene que nombrar el formato que abre');
  assert.match(btn[0], /title="[^"]*[Ss]ustituye[^"]*"/,
    'su ayuda tiene que avisar de que reemplaza el dibujo');
  // Y la Ayuda explica el ciclo completo, incluido que los otros cuatro
  // formatos no se pueden reabrir y que una imagen se pega con Ctrl+V.
  assert.match(html, /Exportar → JSON<\/strong> baja el proyecto/,
    'la Ayuda debe explicar cómo se guarda y se recupera un dibujo');
});

test('el panel tiene sus secciones contextuales y el CSS que las oculta', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['panel-sec-element', 'panel-sec-stroke', 'panel-sec-fill',
    'panel-sec-text', 'panel-sec-build', 'panel-sec-garden', 'panel-sec-canvas',
    'panel-sec-selection']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la sección #${id}`);
  }
  // Cada bloque del panel que declara `display` necesita su regla `[hidden]`:
  // ese `display` gana al del user-agent y el atributo no oculta nada. Ha
  // mordido cuatro veces (sección, casilla, ⚙ y campo), así que se pinta la
  // lista entera en el artefacto compilado.
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const hiddenRule = /\{\s*display:\s*none/;
  for (const sel of ['\\.panel__section\\[hidden\\]', '\\.panel__check\\[hidden\\]',
    '\\.panel__field\\[hidden\\]', '\\.panel__gear\\[hidden\\]',
    '\\.panel__zorder\\[hidden\\]', '\\.panel__canvas-colors\\[hidden\\]']) {
    assert.match(css, new RegExp(sel + '[^{]*' + hiddenRule.source),
      `sin ${sel.replace(/\\/g, '')} el atributo hidden no oculta nada`);
  }
  // El cursor de «Select» es CSS puro (el arnés vm no lo ve): flecha normal,
  // ni la cruz de dibujar ni el `move` de Mover — la herramienta ni crea ni
  // desplaza, y el cursor es lo que lo promete.
  assert.match(css, /\.canvas-area__canvas--pick\s*\{\s*cursor:\s*default/,
    'falta el cursor de la herramienta «Select» en el CSS compilado');
  // Y el de Mover es la mano que señala con el índice (v2.36.0, petición del
  // usuario: el gesto del ☝️ de su propio botón). `pointer`, no `move`.
  assert.match(css, /\.canvas-area__canvas--move\s*\{\s*cursor:\s*pointer/,
    'falta la mano de la herramienta Mover en el CSS compilado');
  // Borrador y aerógrafo esconden el cursor del sistema porque dibujan su
  // propio indicador en el overlay (el círculo con el alcance real). Sin el
  // `cursor: none` se ven los dos a la vez, y en el aerógrafo la cruz del
  // sistema encima del círculo es exactamente lo que se pidió quitar.
  for (const tool of ['eraser', 'airbrush']) {
    assert.match(css, new RegExp(`\\.canvas-area__canvas--${tool}\\s*\\{\\s*cursor:\\s*none`),
      `falta el cursor: none de ${tool} en el CSS compilado`);
  }
});

// La paleta vive en dos sitios desde la v2.22.0 (el panel y los ajustes del
// aerógrafo). Va sobre el TEXTO de index.html porque dom-stub.js fabrica un
// <div> vacío para cualquier id desconocido: si el contenedor faltara en el
// HTML, buildColors pintaría 36 muestras en un div fantasma y ningún test vm
// se enteraría — en la página no habría paleta.
test('los ajustes del aerógrafo llevan su propia rejilla de color', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ini = html.indexOf('id="modal-airbrush"');
  const fin = html.indexOf('</dialog>', ini);
  assert.ok(ini > 0 && fin > ini, 'falta #modal-airbrush');
  const modal = html.slice(ini, fin);
  assert.match(modal, /class="panel__color-grid" id="airbrush-color-grid"/,
    'la rejilla debe estar DENTRO del modal y con la clase del panel');
  // El selector libre sigue estando: la rejilla son 36 colores fijos, no todos.
  assert.match(modal, /id="airbrush-modal-color"/);
});

// El reparto del ⚙ (v2.21.0) se comprueba SOBRE EL TEXTO de index.html y no en
// el arnés: dom-stub.js fabrica un <div> vacío para cualquier id desconocido,
// así que si un botón se cablea en app.js y se olvida en el HTML, las guardas
// vm pasan enteras —el listener se engancha al div fantasma y __fire lo
// dispara— y en la página no hay botón que pulsar.
test('cada sección con ajustes propios lleva su ⚙ dentro, en el HTML', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const GEARS = {
    'panel-sec-element': 'btn-element-settings',
    'panel-sec-fill': 'btn-fill-settings',
    'panel-sec-text': 'btn-text-settings',
    'panel-sec-build': 'btn-build-settings',
    'panel-sec-garden': 'btn-garden-settings',
    'panel-sec-selection': 'btn-selection-settings',
  };
  for (const [sec, btn] of Object.entries(GEARS)) {
    const start = html.indexOf(`id="${sec}"`);
    const end = html.indexOf('</section>', start);
    assert.ok(start > 0 && end > start, `falta la sección #${sec}`);
    assert.match(html.slice(start, end),
      new RegExp(`class="panel__gear" id="${btn}"`),
      `#${sec} necesita su propio ⚙ #${btn} DENTRO de la sección`);
  }
  assert.doesNotMatch(html, /id="btn-eraser-size"/,
    'el ⚙ camaleón que se re-apuntaba a cinco modales se repartió en la v2.21.0');
  // Dos secciones SIN ⚙, cada una por su motivo:
  //   · «Trazo» era la casa del botón camaleón, el único cuyo engranaje no abría
  //     «lo suyo» sino los ajustes de la herramienta activa. Sus destinos se
  //     alcanzan pulsando la herramienta y, con selección, desde «Posición y
  //     tamaño»; devolverle un ⚙ es reabrir el problema que la v2.21.0 cerró.
  //   · «Lienzo» no tiene modal equivalente: un ⚙ ahí no llevaría a ninguna parte.
  for (const [sec, porque] of [
    ['panel-sec-stroke', 'era el ⚙ camaleón: se reabre pulsando la herramienta'],
    ['panel-sec-canvas', 'no tiene ajustes en ningún modal'],
  ]) {
    const desde = html.indexOf(`id="${sec}"`);
    assert.doesNotMatch(html.slice(desde, html.indexOf('</section>', desde)), /panel__gear/,
      `#${sec} no debe llevar ⚙: ${porque}`);
  }
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
  // Los CUATRO mandos del grosor (v2.21.0: el del panel se retiró, y #modal-text
  // ganó el suyo para que un texto seleccionado no se quedara sin sitio desde el
  // que cambiar su trazo). Con rangos distintos, mover uno recortaría a otro.
  const ref = rangeOf('stroke-modal-slider');
  assert.deepEqual(ref, ['1', '8', '1'], 'el grosor va de 1 a 8 de uno en uno');
  for (const id of ['shape-modal-slider', 'ui-modal-slider', 'text-modal-stroke']) {
    assert.deepEqual(rangeOf(id), ref, `#${id} debe cubrir el mismo rango de grosor`);
  }
  assert.deepEqual(rangeOf('shape-modal-opacity'), rangeOf('fill-opacity-slider'),
    'la opacidad del modal de forma y la del panel, lo mismo');
  assert.deepEqual(rangeOf('text-modal-size'), rangeOf('font-slider'),
    'el tamaño de letra de #modal-text y el del panel deben cubrir el mismo rango');
  // El grano del aerógrafo ES un lineWidth, así que comparte el rango de los
  // otros cuatro: si no, una mancha podría nacer con un grosor que ningún otro
  // mando puede volver a poner.
  assert.deepEqual(rangeOf('airbrush-modal-grain'), ref,
    'el grano del aerógrafo es un grosor más: mismo rango');
});

// Los deslizadores del aerógrafo declaran sus topes en el HTML y el módulo los
// vuelve a acotar al validar un import: si se separan, o el mando no llega a lo
// que el módulo admite, o deja fijar algo que un JSON exportado ya no acepta.
// Mismo patrón que las guardas de Verjas, Cancela y el ancho de camino.
test('los deslizadores del aerógrafo cubren justo lo que acota airbrush.js', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const attr = (id, a) => {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `no existe el slider #${id}`);
    return Number((tag[0].match(new RegExp(`${a}="([^"]+)"`)) || [])[1]);
  };
  const { Airbrush } = loadAll();
  // El mando de anchura enseña el DIÁMETRO y el elemento guarda el radio.
  assert.equal(attr('airbrush-modal-radius', 'min'), Airbrush.R_MIN * 2);
  assert.equal(attr('airbrush-modal-radius', 'max'), Airbrush.R_MAX * 2);
  assert.equal(attr('airbrush-modal-density', 'min'), Airbrush.DENSITY_MIN);
  assert.equal(attr('airbrush-modal-density', 'max'), Airbrush.DENSITY_MAX);
  assert.equal(attr('airbrush-modal-grain', 'min'), Airbrush.GRAIN_MIN);
  assert.equal(attr('airbrush-modal-grain', 'max'), Airbrush.GRAIN_MAX);
  // La opacidad va en porcentaje y llega a 100 = sólido, que es el valor con
  // el que el elemento NO guarda el campo.
  assert.equal(attr('airbrush-modal-opacity', 'max'), 100);
  assert.ok(attr('airbrush-modal-opacity', 'min') > 0,
    'una opacidad de 0 sería una mancha invisible que igualmente cuenta como elemento');
  // Y el valor inicial de cada mando cae dentro de su propio rango.
  for (const id of ['airbrush-modal-radius', 'airbrush-modal-density',
    'airbrush-modal-grain', 'airbrush-modal-opacity']) {
    const v = attr(id, 'value');
    assert.ok(v >= attr(id, 'min') && v <= attr(id, 'max'), `#${id} nace fuera de su rango`);
  }
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

// Regresión de la tokenización v3.3.1 (BUGS.md): dos medidas convivían
// desviadas 1px de sus escalas —un radio de 0.7rem (la escala es
// 0.4/0.6/0.8/1/1.6) y un foco de 0.15rem (el estándar es 0.2rem)— y nada las
// detectaba: SCSS, stylelint y el navegador aceptan cualquier número.
test('las escalas tokenizadas no tienen desviaciones en el CSS compilado', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  assert.ok(!css.includes('border-radius: 0.7rem'),
    'un radio de 0.7rem se ha colado fuera de la escala de $radius-* (_variables.scss)');
  assert.ok(!css.includes('outline: 0.15rem'),
    'un anillo de foco de 0.15rem se ha colado fuera de $focus-ring-w (_variables.scss)');
});

// Regresión de var(--text-main) (BUGS.md): una custom property usada pero no
// definida no falla en ningún sitio — ni SCSS, ni stylelint, ni el navegador
// avisan; la declaración se descarta en silencio y gana la herencia.
test('toda custom property usada en css/styles.css está definida', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  // Excepción: las que escribe app.js en línea sobre el elemento
  // (`style.setProperty`) no pueden estar en la hoja. No se dan por buenas
  // por listarlas aquí: tienen que aparecer de verdad en app.js Y usarse
  // siempre con resguardo —`var(--x, algo)`—, para que un elemento al que no
  // le llegue el valor se dibuje con algo en vez de desaparecer.
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'src/js/app.js'), 'utf8');
  for (const use of css.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
    if (defined.has(use[1])) continue;
    assert.ok(app.includes(`setProperty('${use[1]}'`),
      `var(${use[1]}) no está definida en el CSS ni la escribe app.js`);
    assert.equal(use[2], ',',
      `var(${use[1]}) la escribe app.js en línea: necesita un valor de resguardo`);
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
  // Los tres pickers de color del panel necesitan nombre accesible, por
  // `aria-label` o por un <label> que los envuelva —nunca los dos: aria-label
  // gana, y el nombre dejaría de coincidir con el rótulo que se lee en
  // pantalla—. #color-picker pasó de hex a rótulo «Color» en la v2.21.0 y con
  // él cambió de forma; los de «Lienzo» siempre usaron el <label>.
  // Un <label> nombra al control envolviéndolo o con `for`; los de «Lienzo»
  // usan lo primero, sin `for`, así que hay que mirar si el input cae dentro de
  // un <label> abierto y no solo si existe un `for="…"`.
  const dentroDeLabel = id => {
    const antes = html.slice(0, html.indexOf(`id="${id}"`));
    return antes.lastIndexOf('<label') > antes.lastIndexOf('</label>');
  };
  for (const id of ['color-picker', 'canvas-bg-picker', 'grid-color-picker']) {
    const conAria = /aria-label="/.test(tag(id));
    const conLabel = dentroDeLabel(id) || new RegExp(`<label[^>]*for="${id}"`).test(html);
    assert.ok(conAria || conLabel, `#${id} necesita nombre accesible (aria-label o <label>)`);
    assert.ok(!(conAria && conLabel), `#${id} no debe llevar aria-label Y <label>: se pisan`);
  }
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

/*
 * La Ayuda de la app y el README AFIRMAN cantidades («49 especies vegetales»,
 * «31 figuras»…). Nada las ataba a los catálogos, así que envejecían solas: la
 * Ayuda estuvo diciendo 40 especies mientras el jardín tenía 49, y nadie se
 * entera hasta que alguien las cuenta a mano (v2.25.1). Aquí se atan.
 */
test('los recuentos que afirman la Ayuda y el README salen de los catálogos', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
  const ctx = loadAll();
  const n = k => ctx[k].length;

  const especies = n('TREE_TYPES') + n('SHRUB_TYPES') + n('FLOWER_TYPES') +
    n('HERB_TYPES') + n('CLIMBER_TYPES');
  const variantes = especies + n('PLOT_SHAPES') + n('DECOR_TYPES') + n('PATH_TYPES');
  // 3 remates de extrusión × 10 secciones, más la esfera, que no es extrusión
  const figuras3d = n('SOLID_SECTIONS') * 3 + 1;

  const esperado = {
    'especies vegetales': especies,
    'variantes': variantes,
    'figuras': figuras3d,
    'diseños de forja': n('FORGE_TYPES'),
    'estilos de entrada': n('GATE_TYPES'),
  };
  let comprobados = 0;
  for (const [texto, valor] of Object.entries(esperado)) {
    for (const [nombre, doc] of [['la Ayuda', html], ['el README', readme]]) {
      const re = new RegExp(`(\\d+)\\s+${texto}`, 'g');
      for (const m of doc.matchAll(re)) {
        assert.equal(Number(m[1]), valor,
          `${nombre} dice ${m[1]} ${texto} y los catálogos tienen ${valor}`);
        comprobados++;
      }
    }
  }
  // Si nadie afirma nada, la guarda no guarda: se exige que siga habiendo cifras
  assert.ok(comprobados >= 7, `sólo se comprobaron ${comprobados} recuentos`);
});

/*
 * La Ayuda describía DOS mandos que ya no existen así: el ⚙ de «Trazo», que se
 * retiró con esa sección en la v2.21.0, y el tamaño del emoji atado al
 * deslizador de Texto, del que se independizó en la v2.10.0. Ninguna prueba las
 * ataba al HTML, así que sobrevivieron años a los cambios que las invalidaron.
 */
test('la Ayuda no describe mandos que ya no existen', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ayuda = html.slice(html.indexOf('id="modal-help"'));
  const fin = ayuda.indexOf('</dialog>');
  // Sin etiquetas: lo que se comprueba es lo que el usuario LEE, y entre «⚙» y
  // «Trazo» hay un <strong> que rompería cualquier patrón pegado al marcado.
  const texto = ayuda.slice(0, fin).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // «Trazo» es la única sección con ajustes y SIN ⚙, a propósito (v2.21.0): su
  // botón abría cinco modales distintos según la herramienta. Si la Ayuda
  // vuelve a mandar ahí, o miente o es que el ⚙ ha vuelto.
  const seccionTrazo = html.slice(html.indexOf('id="panel-sec-stroke"'));
  const finSeccion = seccionTrazo.indexOf('</section>');
  assert.ok(!seccionTrazo.slice(0, finSeccion).includes('panel__gear'),
    '«Trazo» no debe tener ⚙; si lo tiene, revisa también lo que dice la Ayuda');
  assert.ok(!/⚙.{0,40}«Trazo»/.test(texto) && !/«Trazo».{0,20}⚙/.test(texto),
    'la Ayuda no puede mandar al ⚙ de «Trazo»: esa sección no tiene');

  // El emoji tiene tamaño PROPIO desde la v2.10.0
  assert.ok(html.includes('id="emoji-modal-size"'), 'el emoji tiene su propio deslizador');
  assert.ok(!/tamaño lo fija el slider Texto/.test(texto),
    'la Ayuda no puede atar el tamaño del emoji al deslizador de Texto');
});

/*
 * El modo «De pie» (el mando «Eje» de Pirámide y Tronco, v2.27.0–2.28.0) se
 * estrenó sin una línea en la Ayuda ni en el README: la misma clase de olvido
 * que la v2.25.1 ya corrigió tres veces. Un mando que existe en el HTML tiene
 * que estar contado donde el usuario lee qué hace la app (auditoría v2.30.0).
 */
test('la Ayuda y el README cuentan el modo «De pie» mientras exista su mando', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
  if (!html.includes('id="pyramid-apex"')) return; // el mando se retiró: nada que contar
  const ayuda = html.slice(html.indexOf('id="modal-help"'));
  const texto = ayuda.slice(0, ayuda.indexOf('</dialog>'))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(/[Dd]e pie/.test(texto),
    'existe #pyramid-apex pero la Ayuda no menciona el modo «De pie»');
  assert.ok(/[Dd]e pie/.test(readme),
    'existe #pyramid-apex pero el README no menciona el modo «De pie»');
});

/*
 * Misma clase de olvido, contada en la actualización de la Ayuda de la v3.0.0:
 * cuatro cosas llevaban versiones existiendo en el HTML sin una línea donde el
 * usuario lee qué hace la app —el trazo con presión del lápiz (v2.37.0), las
 * guías de alineación (v2.38.0), la letra del lienzo y el estilo del texto
 * (negrita y sombras, v2.16.0)—. Cada mando se ata aquí a la palabra que lo
 * nombra en la Ayuda: mientras el mando exista, la Ayuda tiene que contarlo.
 */
test('la Ayuda cuenta los mandos que existen en el HTML', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ayuda = html.slice(html.indexOf('id="modal-help"'));
  const texto = ayuda.slice(0, ayuda.indexOf('</dialog>'))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const pares = [
    ['id="stroke-modal-taper"', /presión/i,               'el trazo con presión del lápiz'],
    ['id="select-modal-align"', /guías de alineación/i,   'las guías de alineación'],
    ['id="text-modal-bold"',    /negrita/i,               'la negrita del texto'],
    ['id="text-shadow"',        /sombra/i,                'las sombras del texto'],
    ['id="sketch-font"',        /letra del lienzo/i,      'la letra del lienzo'],
  ];
  for (const [mando, patron, nombre] of pares) {
    if (!html.includes(mando)) continue; // el mando se retiró: nada que contar
    assert.match(texto, patron, `existe ${mando} pero la Ayuda no cuenta ${nombre}`);
  }
});

/*
 * _uppercase.scss rescata de las mayúsculas «lo que escribe el usuario» por
 * clase, y un selector de clase que no casa con nada no falla en ningún sitio:
 * ni Sass, ni stylelint, ni el navegador. Así nació apuntando a
 * `.canvas-area__text-editor` cuando la clase real es `.canvas-area__text-input`
 * — el editor solo quedaba protegido de rebote por la regla genérica `textarea`
 * (auditoría v2.30.0). Cada clase que el partial nombra debe existir en el HTML.
 */
test('los selectores de rescate de _uppercase.scss casan con clases reales', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const scss = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'scss', 'base', '_uppercase.scss'), 'utf8');
  const clases = [...scss.matchAll(/^\.([a-z0-9_-]+)/gim)].map(m => m[1]);
  assert.ok(clases.length >= 2, 'el partial ya no rescata por clase: revisa la guarda');
  for (const c of clases) {
    assert.ok(html.includes(`class="${c}`) || html.includes(` ${c}`) ||
      new RegExp(`class="[^"]*\\b${c}\\b`).test(html),
      `_uppercase.scss nombra .${c} y esa clase no existe en index.html`);
  }
});

// Los cuatro deslizadores de 3D existen repetidos en cuatro modales contra un
// único estado, y sus topes tienen que ser los que exporta el módulo: app.js
// acota con Solid.* al restaurar prefs, así que un rango distinto en el HTML
// dejaría el mando prometiendo valores que el estado recorta en silencio.
test('los deslizadores de 3D declaran los topes que exporta Solid', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const { Solid } = loadAll();
  const rangos = {
    depth: [Solid.DEPTH_MIN, Solid.DEPTH_MAX],
    angle: [Solid.ANGLE_MIN, Solid.ANGLE_MAX],
    foreshorten: [Solid.FORESHORTEN_MIN, Solid.FORESHORTEN_MAX],
    taper: [Solid.TAPER_MIN, Solid.TAPER_MAX],
  };
  // Prefijos y qué mandos lleva cada uno: la esfera no tiene fondo que graduar
  // y sólo el tronco tiene tapa.
  const modales = {
    prism: ['depth', 'angle', 'foreshorten'],
    pyramid: ['depth', 'angle', 'foreshorten'],
    frustum: ['depth', 'angle', 'foreshorten', 'taper'],
    sphere: ['angle', 'foreshorten'],
  };
  let encontrados = 0;
  for (const [prefijo, campos] of Object.entries(modales)) {
    for (const campo of campos) {
      const tag = html.match(new RegExp(`<input[^>]*id="${prefijo}-${campo}"[\\s\\S]*?/>`));
      assert.ok(tag, `no existe el deslizador #${prefijo}-${campo}`);
      const attrs = tag[0].replace(/\s+/g, ' ');
      const attr = a => Number(attrs.match(new RegExp(`${a}="([^"]+)"`))[1]);
      const [lo, hi] = rangos[campo];
      assert.equal(attr('min'), lo, `#${prefijo}-${campo}: min`);
      assert.equal(attr('max'), hi, `#${prefijo}-${campo}: max`);
      assert.ok(attr('value') >= lo && attr('value') <= hi, `#${prefijo}-${campo}: value`);
      // Y su etiqueta con el valor, que es lo que sincroniza syncSolidControls
      assert.ok(html.includes(`id="${prefijo}-${campo}-val"`),
        `falta #${prefijo}-${campo}-val`);
      encontrados++;
    }
    assert.ok(html.includes(`id="${prefijo}-preview"`), `falta la miniatura #${prefijo}-preview`);
  }
  assert.equal(encontrados, 12);
  // Los mandos que NO debe haber: si aparecieran, prometerían algo que su
  // figura ignora (la esfera no tiene fondo, y sólo el tronco tiene tapa).
  for (const ausente of ['sphere-depth', 'sphere-taper', 'prism-taper', 'pyramid-taper',
    // Ni giro en la esfera: no tiene sección que orientar
    'sphere-rotation']) {
    assert.ok(!html.includes(`id="${ausente}"`), `sobra el mando #${ausente}`);
  }
  // Trazo, color y relleno de las aristas y las caras: existen en los CUATRO
  // modales, porque cambiarlos es lo que uno quiere hacer nada más elegir la
  // herramienta y el panel queda lejos (regla de «los ajustes de una
  // herramienta se abren desde la herramienta»).
  for (const prefijo of Object.keys(modales)) {
    for (const campo of ['stroke', 'color', 'fill', 'fill-transparent',
      'opacity', 'fill-color', 'color-grid']) {
      assert.ok(html.includes(`id="${prefijo}-${campo}"`),
        `falta #${prefijo}-${campo}`);
    }
    assert.ok(html.includes(`id="${prefijo}-stroke-val"`));
    assert.ok(html.includes(`id="${prefijo}-opacity-val"`));
  }
  // El giro sólo en los tres que eligen sección, con su fila propia para poder
  // ocultarla cuando la sección no orienta por ángulo.
  for (const prefijo of ['prism', 'pyramid', 'frustum']) {
    assert.ok(html.includes(`id="${prefijo}-rotation"`), `falta #${prefijo}-rotation`);
    assert.ok(html.includes(`id="${prefijo}-rotation-row"`), `falta #${prefijo}-rotation-row`);
    assert.ok(html.includes(`id="${prefijo}-rotation-val"`));
  }
  // Y el grosor comparte rango con el de los demás modales: es el MISMO ajuste
  const anchos = [...html.matchAll(/id="(?:stroke-modal-slider|prism-stroke)"[\s\S]*?\/>/g)]
    .map(m => m[0].replace(/\s+/g, ' '));
  assert.equal(anchos.length, 2);
  const rango = t => [t.match(/min="([^"]+)"/)[1], t.match(/max="([^"]+)"/)[1]].join('-');
  assert.equal(rango(anchos[0]), rango(anchos[1]),
    'el grosor de las aristas tiene que ofrecer el mismo rango que el del trazo');
  // Los tres catálogos de sección, y que la esfera NO tenga: no hay sección
  // que elegir, así que su modal es sólo de ajustes.
  for (const root of ['prism-catalog', 'pyramid-catalog', 'frustum-catalog']) {
    assert.ok(html.includes(`id="${root}"`), `falta el catálogo #${root}`);
  }
  assert.ok(!html.includes('id="sphere-catalog"'));
  // Cada modal cablea su propio «Cerrar»: sin él, un <dialog showModal> deja
  // inerte el lienzo entero y la app se queda bloqueada (ver v2.16.2).
  for (const modal of ['modal-prism', 'modal-pyramid', 'modal-frustum', 'modal-sphere']) {
    const bloque = html.slice(html.indexOf(`id="${modal}"`));
    const fin = bloque.indexOf('</dialog>');
    assert.ok(bloque.slice(0, fin).includes('modal__cancel'),
      `#${modal} no tiene botón de cerrar`);
  }
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

/* ══════════════════════════════════════════════════════════════
   Tipografías manuscritas autoalojadas (v2.13.0). El lienzo ya no
   pide nada a Google Fonts: las cinco familias viajan en fonts/.
   Nada de esto lo ve el arnés vm —son ficheros, CSS compilado y el
   <head>—, y todo falla en silencio: una familia sin @font-face o
   sin .woff2 no rompe nada, el lienzo se limita a dibujar con el
   resguardo del sistema y el boceto deja de parecerse a lo que la
   app promete.
   ══════════════════════════════════════════════════════════════ */

test('la app no pide ninguna fuente por red', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com/,
    'index.html no debe enlazar Google Fonts: las manuscritas están en fonts/');
  assert.doesNotMatch(html, /fonts\.gstatic\.com/,
    'ni preconectar con gstatic, que era su único motivo');
  assert.match(html, /id="sketch-font"/, 'falta el selector de letra manuscrita');
});

test('cada letra del catálogo tiene su @font-face y su .woff2', () => {
  const ctx = load('src/js/config.js');
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const root = path.resolve(__dirname, '..');
  assert.ok(ctx.SKETCH_FONTS.length >= 5, 'el catálogo no puede quedarse sin familias');
  for (const f of ctx.SKETCH_FONTS) {
    assert.equal(typeof f.id, 'string');
    assert.equal(typeof f.name, 'string');
    // La familia declarada en el @font-face es la PRIMERA de la pila: las
    // demás son resguardos del sistema, que nadie autoaloja.
    const family = f.stack.split(',')[0].replace(/['"]/g, '').trim();
    const face = new RegExp(
      `@font-face\\s*\\{[^}]*font-family:\\s*"${family}"[^}]*src:\\s*url\\("\\.\\./fonts/([^"]+\\.woff2)"`);
    const m = css.match(face);
    assert.ok(m, `sin @font-face para «${family}» el lienzo cae al resguardo sin avisar`);
    assert.ok(fs.existsSync(path.join(root, 'fonts', m[1])),
      `falta el fichero fonts/${m[1]} que declara el CSS`);
  }
  // Toda pila acaba en una familia genérica, para que una copia incompleta del
  // repo siga escribiendo con algo razonable: `cursive` en las manuscritas (a
  // mano y no en una sans) y `sans-serif` en las que no lo son —OpenDyslexic,
  // Montserrat Alternates—, donde lo coherente con su dibujo es otra sans.
  for (const f of ctx.SKETCH_FONTS) {
    assert.match(f.stack, /(cursive|sans-serif)$/,
      `la pila de ${f.name} debe acabar en una familia genérica`);
  }
  // Y las que no están en Google Fonts se declaran como tales: si no, el
  // exportado pediría por URL una familia inexistente y fallaría en silencio.
  const propias = ctx.SKETCH_FONTS.filter(f => !f.google).map(f => f.name);
  assert.deepEqual([...propias], ['OpenDyslexic'],
    'solo OpenDyslexic es propia de la app; el resto vienen de Google Fonts');
});

test('la letra por defecto del catálogo es la misma que --font-sketch', () => {
  const ctx = load('src/js/config.js');
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const token = css.match(/--font-sketch:\s*([^;]+);/);
  assert.ok(token, 'falta --font-sketch en el CSS compilado');
  const norm = s => s.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(norm(ctx.SKETCH_FONTS[0].stack), norm(token[1]),
    'la primera entrada del catálogo es el default y debe decir lo que --font-sketch');
  assert.equal(norm(ctx.SKETCHY_FONT), norm(ctx.SKETCH_FONTS[0].stack),
    'y SKETCHY_FONT (el resguardo del arnés) tiene que coincidir con ella');
});

// La negrita solo es REAL en las familias que traen su propio corte de 700.
// Declarar un @font-face de 700 apuntando al fichero de 400 sería peor que no
// declararlo: el navegador lo daría por bueno y la negrita saldría idéntica a
// la normal, en vez de sintetizarla. Es el error que tuvo Caveat («400 700»
// sobre un fichero que solo trae 400) hasta la v2.16.0.
test('cada negrita declarada tiene su propio fichero, distinto del regular', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const root = path.resolve(__dirname, '..');
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const porFamilia = new Map();
  for (const face of faces) {
    const fam = (face.match(/font-family:\s*"([^"]+)"/) || [])[1];
    const file = (face.match(/url\("\.\.\/fonts\/([^"]+)"\)/) || [])[1];
    const peso = (face.match(/font-weight:\s*([^;]+);/) || [])[1].trim();
    if (!fam || !file) continue;
    if (!porFamilia.has(fam)) porFamilia.set(fam, []);
    porFamilia.get(fam).push({ file, peso });
  }
  let negritas = 0;
  for (const [fam, cortes] of porFamilia) {
    const bold = cortes.filter(c => c.peso.includes('700') && !c.file.includes('Italic'));
    const regular = cortes.find(c => c.peso === '400' && !c.file.includes('Italic'));
    for (const b of bold) {
      negritas++;
      assert.ok(fs.existsSync(path.join(root, 'fonts', b.file)),
        `falta el fichero de negrita fonts/${b.file}`);
      assert.notEqual(b.file, regular && regular.file,
        `la negrita de ${fam} apunta al mismo fichero que la redonda: saldría idéntica`);
    }
  }
  assert.ok(negritas >= 4,
    'deben declararse las negritas reales (Caveat, Kalam, Montserrat Alternates y OpenDyslexic)');
});

// Los tres sombreados y sus dos juegos de controles.
test('los sombreados del texto tienen sus controles gemelos', () => {
  const ctx = load('src/js/config.js');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ids = [...ctx.TEXT_SHADOWS].map(s => s.id);
  assert.deepEqual(ids, ['none', 'soft', 'hard', 'glow'],
    'tres sombras más «sin sombra», en ese orden');
  // Panel y modal: mismos tres controles, para que ninguno quede solo en un sitio.
  for (const id of ['check-bold', 'text-shadow', 'text-shadow-color',
    'text-modal-bold', 'text-modal-shadow', 'text-modal-shadow-color']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta el control #${id}`);
  }
  // Los <select> se rellenan desde el catálogo: vacíos en el HTML a propósito.
  assert.match(html, /<select[^>]*id="text-shadow"[^>]*><\/select>/,
    'el selector de sombra lo rellena app.js desde TEXT_SHADOWS');
});

// Las paletas de los modales de ajustes (v2.26.0). Guarda TEXTUAL, y por la
// razón de siempre: `dom-stub.js` fabrica un <div> vacío para un id que no
// existe, así que una rejilla cableada en app.js pero ausente del HTML pasa
// todos los tests del arnés y sencillamente no está en el navegador.
test('cada paleta cableada en app.js existe en index.html', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'js', 'app.js'), 'utf8');
  const listaDe = re => {
    const m = app.match(re);
    assert.ok(m, `no se encuentra la lista ${re}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  };
  const trazo = listaDe(/const COLOR_GRIDS = \[([\s\S]*?)\];/);
  const relleno = listaDe(/const FILL_COLOR_GRIDS = \[([\s\S]*?)\];/);
  assert.equal(trazo.length, 10, 'el panel, el aerógrafo, los cuatro 3D y los cuatro de ajustes');
  assert.equal(relleno.length, 6, '#modal-shape, la Tinta y los cuatro 3D');
  for (const id of [...trazo, ...relleno]) {
    assert.match(html, new RegExp(`id="${id}"`), `falta la rejilla #${id} en index.html`);
  }
  // Las dos familias no se pisan: las muestras del relleno llevan clase propia
  // o updateColorActive las resaltaría con el color del trazo.
  assert.match(app, /className = 'panel__fill-swatch'/);
  assert.match(app, /querySelectorAll\('\.panel__fill-swatch'\)/);
});

// El ancho de los modales de ajustes es CSS puro: el arnés vm no tiene layout,
// así que aquí solo se comprueba que las reglas están en el artefacto (el
// comportamiento real lo mide e2e/modal-palette.spec.js).
test('css/styles.css ensancha los modales de ajustes por encima de 1200px', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  // El mismo breakpoint que la sidebar de dos columnas
  assert.match(css, /@media \(min-width: 1201px\)[\s\S]*?\.modal--settings \{\s*width: min\(76rem/);
  assert.match(css, /\.modal--settings \.modal__build-fields \{[\s\S]*?grid-template-columns: repeat\(2/);
  // Las muestras se fijan al tamaño de la muestra: con 1fr la paleta se
  // desparramaba por todo el modal ancho.
  assert.match(css, /\.modal__palette \.panel__color-grid \{[\s\S]*?repeat\(6, 2\.8rem\)/);
  // La muestra del relleno comparte aspecto con la del trazo
  assert.match(css, /\.panel__color-swatch,\s*\.panel__fill-swatch \{/);
  // Y la clase la llevan los quince diálogos con miniatura
  const conMiniatura = (html.match(/<div class="modal__build">/g) || []).length;
  const marcados = (html.match(/class="modal modal--settings"/g) || []).length;
  assert.equal(conMiniatura, 16); // los quince de la v2.26.0 más la Tinta
  assert.equal(marcados, conMiniatura,
    'todo modal con miniatura tiene que llevar modal--settings, o se queda estrecho');
});

// El mando del eje (v2.27.0, extendido al Tronco en la v2.28.0). Guarda
// TEXTUAL por la razón de siempre: `dom-stub.js` fabrica un <div> vacío para un
// id que no existe, y un <select> cableado en app.js pero ausente del HTML
// pasaría todos los tests del arnés sin estar en el navegador.
test('el eje tiene su mando en la Pirámide y el Tronco, y sólo ahí', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ctx = loadAll();
  assert.deepEqual([...ctx.Solid.APEX_MODES], ['depth', 'upright']);
  assert.deepEqual([...ctx.Solid.UPRIGHT_TOOLS],
    [ctx.TOOLS.SOLID_PYRAMID, ctx.TOOLS.SOLID_FRUSTUM]);
  for (const p of ['pyramid', 'frustum']) {
    assert.match(html, new RegExp(`id="${p}-apex"`), `falta el selector del eje en ${p}`);
    // Las dos opciones del catálogo, y sólo ésas
    const bloque = html.slice(html.indexOf(`id="${p}-apex"`));
    const opciones = [...bloque.slice(0, bloque.indexOf('</select>')).matchAll(/value="([^"]+)"/g)]
      .map(m => m[1]);
    assert.deepEqual(opciones, [...ctx.Solid.APEX_MODES], `opciones raras en ${p}`);
  }
  // El prisma saldría del mismo cuerpo con k = 1 y la esfera no tiene eje: un
  // mando ahí no cambiaría nada que valga la pena.
  for (const p of ['prism', 'sphere']) {
    assert.doesNotMatch(html, new RegExp(`id="${p}-apex"`), `${p} no lleva mando de eje`);
  }
  // Y ningún subtítulo puede prometer una sola proyección
  assert.doesNotMatch(html, /la punta se va hacia el fondo/);
  assert.doesNotMatch(html, /con la tapa del fondo más pequeña\./);
});

// v2.31.0: la fila de aspectos de lienzo. Tres cosas que el arnés `node:vm`
// no puede ver, cada una silenciosa a su manera.
test('la fila de aspectos existe, no duplica el catálogo y sabe pintar la rejilla', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');
  const ctx = load('src/js/config.js');

  // 1. El contenedor está DENTRO de «Lienzo» y VACÍO: lo puebla app.js desde
  //    CANVAS_PRESETS. `dom-stub.js` fabrica un <div> vacío para un id que no
  //    existe, así que sin esta guarda un contenedor ausente pasa todos los
  //    tests vm y simplemente no está en el navegador.
  const desde = html.indexOf('id="panel-sec-canvas"');
  const seccion = html.slice(desde, html.indexOf('</section>', desde));
  assert.match(seccion, /id="canvas-preset-grid"[^>]*>\s*<\/div>/,
    '#canvas-preset-grid debe estar en «Lienzo» y vacío (lo puebla app.js)');
  // Y ningún color del catálogo escrito a mano en el HTML.
  for (const p of ctx.CANVAS_PRESETS) {
    assert.doesNotMatch(seccion, new RegExp(`data-preset="${p.id}"`),
      `el aspecto «${p.id}» no debe existir también en el HTML`);
  }

  // 2. La muestra dibuja la rejilla. Sin el gradiente, «Blanco» y
  //    «Milimetrado» son dos cuadrados blancos idénticos: comparten los dos
  //    colores y sólo se diferencian por showGrid.
  const regla = css.match(/\.panel__canvas-preset\s*\{[^}]*\}/);
  assert.ok(regla, 'falta .panel__canvas-preset en el CSS compilado');
  assert.match(regla[0], /--preset-bg/, 'la muestra no pinta el papel del aspecto');
  assert.match(regla[0], /repeating-linear-gradient[^;]*--preset-grid/,
    'la muestra no dibuja la rejilla: «Blanco» y «Milimetrado» saldrían iguales');
  assert.match(css, /\.panel__canvas-preset--active/,
    'sin la clase de activo la fila no dice qué aspecto está puesto');

  // 3. Los dos aspectos que sólo se distinguen por la rejilla siguen ahí: es
  //    lo que da sentido al punto 2 y a la propia fila.
  const porColores = new Map();
  for (const p of ctx.CANVAS_PRESETS) {
    const k = `${p.bg}|${p.grid}`;
    porColores.set(k, (porColores.get(k) || 0) + 1);
  }
  assert.ok([...porColores.values()].some(n => n > 1),
    'ningún par de aspectos comparte colores: revisa el punto 2 antes de tocarlo');
});
