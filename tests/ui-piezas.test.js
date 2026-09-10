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

/* ---------------- el globo con formas y picos (v3.24.0) ---------------- */

const { TOOLTIP_SHAPES, TOOLTIP_TAILS } = ctx;
const combosGlobo = [];
for (const f of TOOLTIP_SHAPES) {
  for (const t of TOOLTIP_TAILS) {
    combosGlobo.push(f.id === 'round' && t.id === 'down'
      ? 'tooltip' : `tooltip-${f.id}-${t.id}`);
  }
}

test('el globo: los 12 combos forma×pico validan; el default explícito y los malformados no', () => {
  for (const v of combosGlobo) {
    assert.ok(Exporter.isValidElement(make('uiPiece', { variant: v })),
      `${v} no valida`);
  }
  // redondeado+abajo escrito compuesto es 'tooltip' dos veces: se rechaza.
  assert.equal(Exporter.isValidElement(make('uiPiece', { variant: 'tooltip-round-down' })), false);
  for (const malo of ['tooltip-oval', 'tooltip-oval-x', 'tooltip-x-up', 'tooltip-oval-up-x']) {
    assert.equal(Exporter.isValidElement(make('uiPiece', { variant: malo })), false,
      `${malo} valida y no debería`);
  }
});

test('el globo: los 12 combos pintan distinto entre sí (huella de llamadas)', () => {
  const huellas = combosGlobo.map(v => {
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
    Renderer.renderElement(grabado, make('uiPiece', { variant: v }));
    return calls.join('|');
  });
  assert.equal(new Set(huellas).size, huellas.length, 'dos combos del globo pintan idéntico');
});

test('el globo: el SVG emite formas para cada combo, con elipse en las ovales', () => {
  for (const v of combosGlobo) {
    ctx.Exporter.svg([make('uiPiece', { variant: v })]);
    const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
    assert.ok(/(<rect|<ellipse)/.test(out), `SVG sin cuerpo para ${v}`);
    if (v.includes('oval') || v.includes('thought')) {
      assert.ok(out.includes('<ellipse'), `${v} debería llevar cuerpo de elipse`);
    }
    if (v.includes('thought')) {
      assert.ok(out.includes('<circle'), `${v} debería llevar burbujas`);
    }
  }
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

// v3.24.1: «Piezas» nació fuera de RASTER_ERASE_TYPES y el borrador la
// fulminaba entera con solo cruzar su caja, mientras el resto de la sección
// UI se muerde por trama. El arnés vm no tiene píxeles que leer (sin
// `deps.rasterErase` real cae al borrado íntegro), así que la guarda pinea la
// lista en el fuente: todo tipo de UI con variantes o único debe estar en ella.
test('el borrador muerde por trama todos los tipos de la sección UI, «Piezas» incluida', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'src/js/app.js'), 'utf8');
  const m = app.match(/const RASTER_ERASE_TYPES = \[([^\]]*)\]/);
  assert.ok(m, 'no se encuentra RASTER_ERASE_TYPES en app.js');
  const lista = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map(x => x[1]);
  for (const [type] of VARIANTED) {
    assert.ok(lista.includes(type), `${type} debe morderse por trama`);
  }
  for (const type of SINGLES) {
    assert.ok(lista.includes(type), `${type} debe morderse por trama`);
  }
  assert.ok(lista.includes(TOOLS.UI_PIECE), '«Piezas» se borraba entera (v3.24.1)');
});

/* ---------------- la paginación escala con su caja (v3.25.1) ---------------- */
// Los botones tenían un tope fijo de 22 px: agrandar la pieza con los handles
// o desde «Posición y tamaño» no cambiaba nada a la vista. La caja por defecto
// (200×32) debe seguir pintando el botón de 22 px, y una caja doble, el doble.
const pagina = (w, h) => make('uiPiece', { variant: 'pagination', x: 0, y: 0, w, h });

test('paginación: el SVG dibuja botones de 22 px en la caja por defecto y del doble en una caja doble', () => {
  const anchos = (w, h) => {
    ctx.Exporter.svg([pagina(w, h)]);
    const out = ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
    return [...out.matchAll(/<rect [^>]*width="([\d.]+)" height="([\d.]+)" rx="3"/g)].map(m => Number(m[1]));
  };
  assert.deepEqual(anchos(200, 32), [22, 22, 22], 'la caja por defecto no cambia de dibujo');
  assert.deepEqual(anchos(400, 64), [44, 44, 44], 'una caja doble pinta botones dobles');
  // Y una caja muy ancha pero baja sigue acotada por la altura; una alta
  // pero estrecha, por el ancho: nunca se sale de la caja.
  assert.deepEqual(anchos(1000, 32), [22, 22, 22]);
  assert.ok(anchos(130, 400)[0] <= 20, 'estrecha: acota el ancho');
});

test('paginación: el renderer pinta el doble de alto en una caja doble (mismo escalado que el SVG)', () => {
  const alto = (w, h) => {
    const stub = createCtxStub();
    Renderer.renderElement(stub, pagina(w, h));
    const ys = [];
    for (const c of stub.calls) {
      if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(c.name)) {
        // el último par de argumentos es siempre el punto final
        ys.push(c.args[c.args.length - 1]);
      }
    }
    return Math.max(...ys) - Math.min(...ys);
  };
  const base = alto(200, 32), doble = alto(400, 64);
  assert.ok(base >= 18 && base <= 26, `dibujo por defecto de ~22 px de alto (${base})`);
  assert.ok(doble >= 40 && doble <= 50, `caja doble → ~44 px de alto (${doble})`);
});

/* ---------------- globo y migas escalan con su caja (v3.25.2) ---------------- */
// Mismo defecto que la paginación: pico, esquinas, burbujas y barras «/» eran
// medidas fijas en píxeles. k = 1 en la caja por defecto de cada una.
const svgDe = el => {
  ctx.Exporter.svg([el]);
  return ctx.URL.blobs[ctx.URL.blobs.length - 1].content;
};

test('migas: las barras «/» miden 12 px de alto en la caja por defecto y 24 en una doble', () => {
  const altoBarras = (w, h) => {
    const out = svgDe(make('uiPiece', { variant: 'breadcrumbs', x: 0, y: 0, w, h }));
    const barras = [...out.matchAll(/<line x1="[\d.-]+" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)" stroke="#[0-9a-f]{6}60"/g)];
    assert.equal(barras.length, 2, 'dos barras');
    return barras.map(m => Number(m[2]) - Number(m[1]));
  };
  assert.deepEqual(altoBarras(260, 20), [12, 12], 'la caja por defecto no cambia de dibujo');
  assert.deepEqual(altoBarras(520, 40), [24, 24], 'una caja doble pinta barras dobles');
});

test('globo: base del pico y esquinas miden lo de siempre en la caja por defecto y el doble en una doble', () => {
  const medidas = (w, h) => {
    const out = svgDe(make('uiPiece', { variant: 'tooltip', x: 0, y: 0, w, h }));
    const rx = Number(out.match(/<rect [^>]*rx="([\d.]+)"/)[1]);
    const pico = out.match(/<path d="M ([\d.]+) [\d.]+ L [\d.]+ [\d.]+ L ([\d.]+) [\d.]+"/);
    return { rx, base: Number(pico[2]) - Number(pico[1]) };
  };
  assert.deepEqual(medidas(160, 60), { rx: 6, base: 12 }, 'la caja por defecto no cambia de dibujo');
  assert.deepEqual(medidas(320, 120), { rx: 12, base: 24 }, 'una caja doble, el doble');
  // Pensamiento: las burbujas también.
  const out = svgDe(make('uiPiece', { variant: 'tooltip-thought-down', x: 0, y: 0, w: 320, h: 120 }));
  const radios = [...out.matchAll(/<circle [^>]*r="([\d.]+)"/g)].map(m => Number(m[1]));
  assert.deepEqual(radios, [6.4, 3.6], 'burbujas dobles en caja doble');
});

test('migas y globo: el renderer escala igual que el SVG (extensión vertical de las llamadas)', () => {
  const extY = (variant, w, h, filtro) => {
    const stub = createCtxStub();
    Renderer.renderElement(stub, make('uiPiece', { variant, x: 0, y: 0, w, h }));
    const ys = [];
    for (const c of stub.calls) {
      if (['moveTo', 'lineTo'].includes(c.name)) ys.push(c.args[1]);
    }
    return filtro(ys);
  };
  // Migas: todo lo que no está en cy = h/2 son las barras «/» (±6k).
  const barras = (w, h) => extY('breadcrumbs', w, h, ys => {
    const fuera = ys.filter(y => Math.abs(y - h / 2) > 1);
    return Math.max(...fuera) - Math.min(...fuera);
  });
  assert.ok(Math.abs(barras(260, 20) - 12) < 3, `barras de ~12 px (${barras(260, 20)})`);
  assert.ok(Math.abs(barras(520, 40) - 24) < 3, `barras de ~24 px en caja doble (${barras(520, 40)})`);
});
