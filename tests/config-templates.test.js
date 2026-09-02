'use strict';
/* ============================================================
   config-templates.test.js — Tests de src/js/config.js y src/js/templates.js
   Ejecutar desde la raíz del proyecto:
     node --test tests/config-templates.test.js
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

/* ---------------- config.js ---------------- */

test('config.js — TOOLS', async t => {
  const ctx = load('src/js/config.js');

  await t.test('TOOLS está congelado (Object.freeze)', () => {
    assert.equal(Object.isFrozen(ctx.TOOLS), true);
  });

  await t.test('TOOLS tiene exactamente los 68 ids esperados', () => {
    const expected = [
      'pencil', 'airbrush', 'line', 'rect', 'roundedRect', 'circle', 'arrow',
      'curveArrow', 'arc',
      // Flecha semicírculo (v3.20.0, creación): el mismo arco pero con punta
      'arcArrow',
      'text', 'eraser', 'select', 'pick', 'imagePlaceholder',
      'button', 'input', 'nav', 'card', 'image', 'emoji',
      // Marco (v3.12.0): contenedor de un wireframe, tipo de elemento real
      'frame',
      // Piezas de formulario y datos (v3.22.0): tipos de elemento reales, las
      // tres primeras con campo `variant` opcional
      'formControl', 'uiTable', 'chart', 'dialog', 'tabs', 'sidebar',
      // «Piezas» (v3.23.0): las menores de UI en un solo tipo con variantes
      'uiPiece',
      'square', 'trapezoid', 'triangle', 'pentagon', 'hexagon', 'star5', 'star6',
      // Triángulo irregular (v3.19.0): llena la caja y guarda su vértice en `apex`
      'freeTriangle',
      // Polígono libre: tipo de elemento sin botón, como `image`
      'polygon',
      // Tinta (creación): el bote de pintura NO es un tipo — lo que crea es un
      // `polygon` con `ink: true`, así que va en CREATION_ONLY_TOOLS
      'ink',
      // Edificios (creación): Fachada y Tejado unifican sus tipos en sendos modales
      'planta', 'fachada', 'tejado', 'puerta', 'ventana', 'balcon', 'muro', 'verja', 'cancela',
      'iluminacion',
      // Parte técnica del plano (v3.22.0, creación): escalera, cota, símbolos,
      // pilar, mobiliario, porche y siluetas de escala
      'stair', 'dimension', 'symbol', 'column', 'furniture', 'porch', 'silhouette',
      // Jardín (creación): cada una elige su variante en su propio modal
      'jardin', 'arbol', 'arbusto', 'flor', 'decoracion', 'camino', 'aromatica', 'trepadora',
      // 3D (creación): el botón elige el remate y su catálogo la sección
      'prisma', 'piramide', 'tronco', 'esfera',
    ];
    const values = Object.values(ctx.TOOLS);
    assert.equal(values.length, 68);
    assert.deepEqual([...values].sort(), [...expected].sort());
    // Las claves también son 68 y únicas
    assert.equal(Object.keys(ctx.TOOLS).length, 68);
    assert.equal(new Set(values).size, 68);
  });
});

test('config.js — Aerógrafo y Tinta van junto al Lápiz y son los de Dibujo sin atajo', () => {
  const ctx = load('src/js/config.js');
  const dibujo = ctx.TOOL_GROUPS.find(g => g.label === 'Dibujo');
  assert.ok(dibujo, 'falta el grupo Dibujo en el sidebar');
  // El orden es el que se pinta: las dos herramientas a mano alzada juntas, y
  // luego lo geométrico (línea, flechas, semicírculo).
  assert.deepEqual([...dibujo.tools.map(t => t.id)],
    ['pencil', 'airbrush', 'ink', 'line', 'arrow', 'curveArrow', 'arc', 'arcArrow']);
  // Entraron sin atajo por lo mismo que «Select» y Balcón: no queda ninguna
  // tecla suelta libre. Fijar la lista impide tanto que lo pierda un refactor
  // como que gane uno que choque.
  assert.deepEqual([...dibujo.tools.filter(t => !t.key).map(t => t.id)],
    ['airbrush', 'ink', 'arcArrow']);
});

test('config.js — TOOL_GROUPS: cada tool referenciado existe en TOOLS', () => {
  const ctx = load('src/js/config.js');
  const toolIds = new Set(Object.values(ctx.TOOLS));
  assert.ok(Array.isArray(ctx.TOOL_GROUPS));
  assert.ok(ctx.TOOL_GROUPS.length > 0);
  for (const group of ctx.TOOL_GROUPS) {
    assert.equal(typeof group.label, 'string');
    assert.ok(Array.isArray(group.tools));
    for (const tool of group.tools) {
      assert.ok(
        toolIds.has(tool.id),
        `tool.id "${tool.id}" (grupo "${group.label}") no existe en TOOLS`,
      );
      assert.equal(typeof tool.icon, 'string');
      assert.equal(typeof tool.name, 'string');
    }
  }
});

test('config.js — genera los botones Cuadrado y Trapecio con atajos propios', () => {
  const ctx = load('src/js/config.js');
  const forms = ctx.TOOL_GROUPS.find(group => group.label === 'Formas');
  const square = forms.tools.find(tool => tool.id === ctx.TOOLS.SQUARE);
  const trapezoid = forms.tools.find(tool => tool.id === ctx.TOOLS.TRAPEZOID);
  assert.deepEqual(JSON.parse(JSON.stringify(square)), {
    id: 'square', icon: '□', name: 'Cuadrado', key: '4',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(trapezoid)), {
    id: 'trapezoid', icon: '⏢', name: 'Trapecio', key: '7',
  });
});

test('config.js — Formas son once, y solo estrellas y triángulo irregular van sin atajo', () => {
  const ctx = load('src/js/config.js');
  const forms = ctx.TOOL_GROUPS.find(group => group.label === 'Formas');
  assert.ok(forms, 'falta el grupo Formas en el sidebar');
  // El orden es el que se pinta: de la caja al polígono —el triángulo
  // irregular junto al regular—, y las estrellas al final porque son las
  // últimas en llegar y las únicas cóncavas.
  assert.deepEqual([...forms.tools.map(t => t.id)], [
    'rect', 'roundedRect', 'circle', 'square', 'trapezoid',
    'triangle', 'freeTriangle', 'pentagon', 'hexagon', 'star5', 'star6',
  ]);
  // Estrellas y triángulo irregular entraron sin tecla por lo mismo que
  // Balcón, «Select» y el Aerógrafo: las 26 letras y los 10 dígitos están
  // asignados, y `f q d s` son acciones de la flecha curva que se atienden
  // ANTES que TOOL_KEYS. Se fija aquí para que el hueco no crezca por
  // descuido ni una forma con atajo lo pierda en una refactorización.
  assert.deepEqual([...forms.tools.filter(t => !t.key).map(t => t.id)],
    ['freeTriangle', 'star5', 'star6']);
});

test('config.js — COLORS son colores hex válidos (#rrggbb)', () => {
  const ctx = load('src/js/config.js');
  assert.ok(Array.isArray(ctx.COLORS));
  assert.ok(ctx.COLORS.length > 0);
  for (const c of ctx.COLORS) {
    assert.match(c, /^#[0-9a-fA-F]{6}$/, `COLORS contiene un hex inválido: ${c}`);
  }
});

/**
 * HSL de un `#rrggbb`, para poder razonar sobre «tono» y «pastel» en las
 * guardas de abajo sin depender de ninguna dependencia.
 */
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2
    : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

test('config.js — la paleta va por filas de 6 y los cromáticos siguen el arco iris', async t => {
  const { COLORS } = load('src/js/config.js');

  // La rejilla del panel es `repeat(6, 1fr)`: el array ES la maquetación, y un
  // color suelto descuadraría todas las familias de una fila en adelante.
  await t.test('el total es múltiplo de 6 (la rejilla tiene 6 columnas)', () => {
    assert.equal(COLORS.length % 6, 0, `COLORS tiene ${COLORS.length} colores`);
  });

  await t.test('no hay colores repetidos', () => {
    assert.equal(new Set(COLORS).size, COLORS.length);
  });

  // Bloques declarados en config.js: fila 1 tinta/neutros, filas 2-4 vivos,
  // filas 5-6 pasteles.
  const tinta = COLORS.slice(0, 6);
  const vivos = COLORS.slice(6, 24);
  const pasteles = COLORS.slice(24);

  await t.test('la tinta abre la paleta con el color por defecto y sube de luminosidad', () => {
    assert.equal(tinta[0], '#1a1a2e', 'la primera muestra es el color de creación por defecto');
    const ls = tinta.map(c => hsl(c).l);
    ls.forEach((l, i) => {
      if (i) assert.ok(l > ls[i - 1], `la tinta no va de oscuro a claro en ${tinta[i]}`);
    });
  });

  // Un grado de tolerancia: dos colores del mismo tono (#c0392b y #e74c3c
  // difieren en 0,02°) no tienen un orden por tono, y ahí manda la regla
  // documentada — primero el más oscuro.
  const MISMO_TONO = 1;
  for (const [nombre, bloque] of [['vivos', vivos], ['pasteles', pasteles]]) {
    await t.test(`el tono nunca retrocede dentro de los ${nombre}`, () => {
      bloque.forEach((c, i) => {
        if (!i) return;
        const prev = hsl(bloque[i - 1]), cur = hsl(c);
        const detalle = `${c} (tono ${cur.h.toFixed(0)}) detrás de `
          + `${bloque[i - 1]} (tono ${prev.h.toFixed(0)})`;
        if (Math.abs(cur.h - prev.h) <= MISMO_TONO) {
          assert.ok(cur.l >= prev.l, `mismo tono, pero el claro va antes: ${detalle}`);
        } else {
          assert.ok(cur.h > prev.h, `el arco iris retrocede: ${detalle}`);
        }
      });
    });
  }

  // Y que la frontera entre los dos bloques signifique algo: si un vivo cayera
  // entre los pasteles el tono podría seguir ordenado y la fila mentiría.
  await t.test('los vivos son vivos y los pasteles, pastel', () => {
    for (const c of vivos) {
      const { s, l } = hsl(c);
      assert.ok(l < 0.7, `${c} es demasiado claro para el bloque de vivos`);
      assert.ok(s > 0.2, `${c} está desaturado para ser un color vivo`);
    }
    for (const c of pasteles) {
      const { s, l } = hsl(c);
      assert.ok(l >= 0.7, `${c} no es lo bastante claro para ser pastel`);
      assert.ok(s > 0.2, `${c} está desaturado para ser un pastel`);
    }
  });

  // Reordenar y ampliar no debe quitarle a nadie un color que ya usaba.
  await t.test('siguen estando los 18 colores históricos', () => {
    const historicos = [
      '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#f39c12',
      '#27ae60', '#2980b9', '#8e44ad', '#c0392b', '#1abc9c', '#e74c3c',
      '#3498db', '#2ecc71', '#f1c40f', '#95a5a6', '#ecf0f1', '#ffffff',
    ];
    for (const c of historicos) assert.ok(COLORS.includes(c), `falta el color ${c}`);
  });
});

test('config.js — CANVAS_W/CANVAS_H', () => {
  const ctx = load('src/js/config.js');
  assert.equal(ctx.CANVAS_W, 1200);
  assert.equal(ctx.CANVAS_H, 800);
});

test('config.js — UI_DEFAULTS tiene w/h positivos para los 12 componentes UI', () => {
  const ctx = load('src/js/config.js');
  const { TOOLS, UI_DEFAULTS } = ctx;
  const keys = [TOOLS.BUTTON, TOOLS.INPUT, TOOLS.IMAGE_PLACEHOLDER, TOOLS.NAV, TOOLS.CARD,
    TOOLS.FORM_CONTROL, TOOLS.UI_TABLE, TOOLS.CHART, TOOLS.DIALOG, TOOLS.TABS, TOOLS.SIDEBAR,
    TOOLS.UI_PIECE];
  for (const key of keys) {
    const def = UI_DEFAULTS[key];
    assert.ok(def, `UI_DEFAULTS no tiene entrada para "${key}"`);
    assert.equal(typeof def.w, 'number');
    assert.equal(typeof def.h, 'number');
    assert.ok(def.w > 0, `UI_DEFAULTS[${key}].w debe ser > 0 (es ${def.w})`);
    assert.ok(def.h > 0, `UI_DEFAULTS[${key}].h debe ser > 0 (es ${def.h})`);
  }
});

/* ---------------- templates.js ---------------- */

const TEMPLATE_NAMES = ['landing', 'dashboard', 'form'];

test('templates.js — Templates.get devuelve copias profundas', () => {
  const ctx = load('src/js/templates.js');
  for (const name of TEMPLATE_NAMES) {
    const a = ctx.Templates.get(name);
    assert.ok(Array.isArray(a) && a.length > 0, `template "${name}" vacío`);
    // Mutar el resultado no debe afectar a la siguiente llamada
    a[0].x = 99999;
    a[0].type = 'mutado';
    a.push({ type: 'basura' });
    const b = ctx.Templates.get(name);
    assert.notEqual(a, b, 'get() debe devolver un array nuevo cada vez');
    assert.notEqual(a[0], b[0], 'los elementos deben ser objetos nuevos');
    assert.notEqual(b[0].x, 99999);
    assert.notEqual(b[0].type, 'mutado');
    assert.equal(b.length, a.length - 1, 'la mutación del array no debe persistir');
  }
});

test('templates.js — elementos válidos (type conocido, coords en canvas, w/h positivos)', async t => {
  const ctx = load('src/js/templates.js');
  const knownTypes = new Set(Object.values(ctx.TOOLS));
  const W = ctx.CANVAS_W; // 1200
  const H = ctx.CANVAS_H; // 800

  for (const name of TEMPLATE_NAMES) {
    await t.test(`template "${name}"`, () => {
      const els = ctx.Templates.get(name);
      assert.ok(els.length > 0);
      els.forEach((el, i) => {
        const tag = `${name}[${i}] (${el.type})`;
        assert.ok(knownTypes.has(el.type), `${tag}: type desconocido "${el.type}"`);

        assert.equal(typeof el.x, 'number', `${tag}: x no numérico`);
        assert.equal(typeof el.y, 'number', `${tag}: y no numérico`);
        assert.ok(Number.isFinite(el.x) && el.x >= 0 && el.x <= W, `${tag}: x=${el.x} fuera de [0,${W}]`);
        assert.ok(Number.isFinite(el.y) && el.y >= 0 && el.y <= H, `${tag}: y=${el.y} fuera de [0,${H}]`);

        if ('w' in el || 'h' in el) {
          assert.equal(typeof el.w, 'number', `${tag}: w no numérico`);
          assert.equal(typeof el.h, 'number', `${tag}: h no numérico`);
          assert.ok(el.w > 0, `${tag}: w=${el.w} debe ser > 0`);
          assert.ok(el.h > 0, `${tag}: h=${el.h} debe ser > 0`);
          // El elemento entero cabe dentro del canvas 1200x800
          assert.ok(el.x + el.w <= W, `${tag}: x+w=${el.x + el.w} > ${W}`);
          assert.ok(el.y + el.h <= H, `${tag}: y+h=${el.y + el.h} > ${H}`);
        }

        assert.equal(typeof el.color, 'string', `${tag}: color no string`);
        // Nota: templates.js usa colores hex de 6 dígitos, salvo el subtítulo
        // del landing que usa C + '80' => hex de 8 dígitos (#rrggbbaa) para
        // simular transparencia. Ambos son válidos para canvas.
        assert.match(el.color, /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, `${tag}: color inválido "${el.color}"`);
        assert.equal(typeof el.lineWidth, 'number', `${tag}: lineWidth no numérico`);
      });
    });
  }
});

test('templates.js — Templates.get("inexistente") devuelve []', () => {
  const ctx = load('src/js/templates.js');
  const res = ctx.Templates.get('inexistente');
  assert.ok(Array.isArray(res));
  assert.equal(res.length, 0);
  // También con undefined/null
  // (nota: los arrays vienen del realm del vm, así que se comprueba
  //  estructuralmente en vez de con deepStrictEqual contra [] del host)
  assert.equal(ctx.Templates.get().length, 0);
  assert.equal(ctx.Templates.get(null).length, 0);
});

test('templates.js — get() con nombres heredados de Object.prototype devuelve []', () => {
  // Regresión: `all[name] || []` no filtraba propiedades heredadas y
  // Templates.get('toString') lanzaba SyntaxError. Corregido con Object.hasOwn.
  const ctx = load('src/js/templates.js');
  assert.equal(ctx.Templates.get('toString').length, 0);
  assert.equal(ctx.Templates.get('constructor').length, 0);
  assert.equal(ctx.Templates.get('hasOwnProperty').length, 0);
});

/* ────────────────────────────────────────────────────────────
   Catálogo de emoji
   ──────────────────────────────────────────────────────────── */

test('config.js — EMOJI_GROUPS: grupos con label y emojis no vacíos', () => {
  const ctx = load('src/js/config.js');
  assert.ok(Array.isArray(ctx.EMOJI_GROUPS));
  assert.ok(ctx.EMOJI_GROUPS.length > 0);
  for (const g of ctx.EMOJI_GROUPS) {
    assert.equal(typeof g.label, 'string');
    assert.ok(g.label.length > 0);
    assert.ok(Array.isArray(g.emojis));
    assert.ok(g.emojis.length > 0, `el grupo "${g.label}" no tiene emojis`);
    for (const em of g.emojis) {
      assert.equal(typeof em, 'string');
      assert.ok(em.length > 0);
    }
  }
});

test('config.js — EMOJI_GROUPS: sin emojis repetidos entre grupos', () => {
  const ctx = load('src/js/config.js');
  const all = ctx.EMOJI_GROUPS.flatMap(g => g.emojis);
  assert.equal(new Set(all).size, all.length, 'hay emojis duplicados en el catálogo');
});

test('config.js — EMOJI_MIN_SIZE es un número positivo', () => {
  const ctx = load('src/js/config.js');
  assert.equal(typeof ctx.EMOJI_MIN_SIZE, 'number');
  assert.ok(ctx.EMOJI_MIN_SIZE > 0);
});

test('config.js — la herramienta Emoji existe en TOOL_GROUPS con atajo propio', () => {
  const ctx = load('src/js/config.js');
  const all = ctx.TOOL_GROUPS.flatMap(g => g.tools);
  const emojiTool = all.find(t => t.id === ctx.TOOLS.EMOJI);
  assert.ok(emojiTool, 'falta la entrada de la herramienta Emoji en el sidebar');
  assert.equal(typeof emojiTool.key, 'string');
  // El atajo no puede chocar con el de otra herramienta
  const keys = all.filter(t => t.key).map(t => t.key);
  assert.equal(new Set(keys).size, keys.length, 'hay atajos de herramienta duplicados');
});

// app.js atiende varias teclas sueltas ANTES de mirar TOOL_KEYS (app.js:3061), y
// además solo cuando la selección contiene una flecha curva. Una herramienta que
// reutilizara una de ellas fallaría de forma intermitente y muda: funcionaría
// hasta que hubiera una curva seleccionada. Toda pieza de Jardín lleva curvas,
// así que la colisión sería constante en la práctica.
const RESERVED_PLAIN_KEYS = Object.freeze({
  f: 'invertir el giro de las flechas curvas',
  q: 'alternar semicírculo',
  d: 'invertir el sentido de la flecha',
  s: 'curva en S',
});

test('config.js — ningún atajo de herramienta pisa una acción ya reservada', () => {
  const ctx = load('src/js/config.js');
  const all = ctx.TOOL_GROUPS.flatMap(g => g.tools);
  for (const tool of all.filter(t => t.key)) {
    assert.equal(
      RESERVED_PLAIN_KEYS[tool.key], undefined,
      `el atajo "${tool.key}" de ${tool.name} choca con «${RESERVED_PLAIN_KEYS[tool.key]}» (app.js)`);
  }
});

test('config.js — el grupo Edición es Mover, «Select» y Borrador, y solo «Select» va sin atajo', () => {
  const ctx = load('src/js/config.js');
  const ed = ctx.TOOL_GROUPS.find(g => g.label === 'Edición');
  assert.ok(ed, 'falta el grupo Edición en el sidebar');
  // El orden es el que se pinta: Mover abre el sidebar y «Select» (solo
  // selección: clic o marquesina, nunca mueve) vive entre Mover y Borrador.
  assert.deepEqual([...ed.tools.map(t => t.id)], ['select', 'pick', 'eraser']);
  // «Select» entró sin atajo por lo mismo que Balcón: las 26 letras y los 10
  // dígitos están asignados y `f q d s` son acciones de la flecha curva.
  assert.deepEqual([...ed.tools.filter(t => !t.key).map(t => t.id)], ['pick']);
});

test('config.js — el grupo UI: componentes, Marco y las piezas de formulario y datos', () => {
  const ctx = load('src/js/config.js');
  const ui = ctx.TOOL_GROUPS.find(g => g.label === 'UI');
  assert.ok(ui, 'falta el grupo UI en el sidebar');
  // Orden por flujo de maquetado (v3.23.0): contenido básico, contenedores,
  // navegación, formulario, datos y remates. Los atajos viajaron con su botón.
  assert.deepEqual([...ui.tools.map(t => t.id)],
    ['text', 'emoji', 'frame', 'card', 'dialog', 'nav', 'tabs', 'sidebar',
     'input', 'button', 'formControl', 'uiTable', 'chart',
     'imagePlaceholder', 'uiPiece']);
  // Los sin tecla entraron así por lo de siempre: las 26 letras y los 10
  // dígitos están asignados. CLAUDE.md afirma que la lista exacta de
  // herramientas sin atajo está pinneada.
  assert.deepEqual([...ui.tools.filter(t => !t.key).map(t => t.id)],
    ['frame', 'dialog', 'tabs', 'sidebar', 'formControl', 'uiTable', 'chart', 'uiPiece']);
});

test('config.js — el sidebar de Edificios y BUILDING_TOOLS son la misma lista', () => {
  const ctx = load('src/js/config.js');
  const build = ctx.TOOL_GROUPS.find(g => g.label === 'Edificios');
  assert.ok(build, 'falta el grupo Edificios en el sidebar');
  assert.deepEqual(
    [...build.tools.map(t => t.id)].sort(),
    [...ctx.BUILDING_TOOLS].sort(),
    'los botones del sidebar y BUILDING_TOOLS deben coincidir');
  // Balcón, Muro, Verjas, Cancela e Iluminación entraron sin atajo porque ya no queda ninguna tecla suelta
  // libre: las 26 letras y los 10 dígitos están asignados y `f q d s` las usan
  // las acciones de flecha curva. Se fija igual que en Jardín, para que el
  // hueco no crezca por descuido ni un botón pierda su tecla en una refactorización.
  assert.deepEqual([...build.tools.filter(t => !t.key).map(t => t.id)],
    ['balcon', 'muro', 'verja', 'cancela', 'iluminacion',
     'stair', 'dimension', 'symbol', 'column', 'furniture', 'porch', 'silhouette']);
});

test('config.js — el sidebar de Jardín y GARDEN_TOOLS son la misma lista', () => {
  const ctx = load('src/js/config.js');
  const garden = ctx.TOOL_GROUPS.find(g => g.label === 'Jardín');
  assert.ok(garden, 'falta el grupo Jardín en el sidebar');
  assert.deepEqual(
    [...garden.tools.map(t => t.id)].sort(),
    [...ctx.GARDEN_TOOLS].sort(),
    'los botones del sidebar y GARDEN_TOOLS deben coincidir');
  // Caminos, Aromáticas y Trepadoras se quedaron sin atajo: `8 9 h x z` agotaron las teclas
  // sueltas libres. Es deliberado —mejor sin atajo que pisando una acción
  // existente—, así que se fija aquí para que el hueco no crezca por descuido:
  // toda herramienta nueva del jardín entra ya sin tecla, y ninguna de las que
  // sí la tienen puede perderla en una refactorización.
  const sinAtajo = garden.tools.filter(t => !t.key).map(t => t.id);
  assert.deepEqual([...sinAtajo], ['camino', 'aromatica', 'trepadora']);
});

test('config.js — el sidebar de 3D y SOLID_TOOLS son la misma lista, y ninguna lleva atajo', () => {
  const ctx = load('src/js/config.js');
  const solidos = ctx.TOOL_GROUPS.find(g => g.label === '3D');
  assert.ok(solidos, 'falta el grupo 3D en el sidebar');
  assert.deepEqual(
    [...solidos.tools.map(t => t.id)].sort(),
    [...ctx.SOLID_TOOLS].sort(),
    'los botones del sidebar y SOLID_TOOLS deben coincidir');
  // El orden pintado va de más lleno a más vacío, y la esfera al final por no
  // ser una extrusión. Las cuatro entran sin tecla: las 26 letras y los 10
  // dígitos están asignados, y `f q d s` son acciones de la flecha curva
  // atendidas ANTES que TOOL_KEYS. Se fija para que el hueco no crezca por
  // descuido ni una de ellas gane un atajo que pise algo.
  assert.deepEqual([...solidos.tools.map(t => t.id)],
    ['prisma', 'piramide', 'tronco', 'esfera']);
  assert.deepEqual([...solidos.tools.filter(t => !t.key).map(t => t.id)],
    ['prisma', 'piramide', 'tronco', 'esfera']);
  // Va justo detrás de Formas: sus secciones SON esas diez siluetas
  const labels = ctx.TOOL_GROUPS.map(g => g.label);
  assert.equal(labels[labels.indexOf('Formas') + 1], '3D');
});

test('config.js — las secciones de 3D son los tipos de Formas menos el triángulo irregular', () => {
  const ctx = load('src/js/config.js');
  const formas = ctx.TOOL_GROUPS.find(g => g.label === 'Formas');
  // El id de la sección ES el `el.type` que se crea: la cara frontal se emite
  // como el elemento 2D real de ese tipo. Si dejaran de coincidir, la cara
  // saldría de un tipo que el renderer no conoce y no se dibujaría nada.
  // El triángulo irregular queda fuera a propósito (v3.19.0): su `apex` no
  // tiene sentido como cara de un sólido.
  assert.deepEqual([...ctx.SOLID_SECTIONS],
    [...formas.tools.map(t => t.id).filter(id => id !== 'freeTriangle')]);
});

test('config.js — FLOATBAR_GROUPS reparte los 7 grupos en 6 barras sin repetir ni dejar ninguno', () => {
  const ctx = load('src/js/config.js');
  const fb = ctx.FLOATBAR_GROUPS;
  assert.equal(fb.length, 6, 'son seis barras flotantes');
  // Partición exacta: cada grupo del sidebar aparece en UNA barra, en el
  // mismo orden en que se pintan — si un grupo nuevo entra en TOOL_GROUPS
  // sin barra asignada, sus herramientas no existirían en el modo flotante
  // y nada lo avisaría.
  // Spreads por la trampa del realm vm: los arrays nacidos dentro del
  // contexto no comparten prototipo con los del host y deepEqual los rechaza.
  const repartidos = [...fb.flatMap(b => [...b.groups])];
  assert.deepEqual(repartidos, [...ctx.TOOL_GROUPS.map(g => g.label)]);
  // El reparto acordado, con sus rótulos de asa exactos: solo Formas y 3D
  // comparten barra. Edificios y Jardín se separaron en la v3.22.1: juntas,
  // con la parte técnica del plano, eran 25 botones — más que la ventana.
  assert.deepEqual([...fb.map(b => [b.label, [...b.groups]])], [
    ['Edición', ['Edición']],
    ['Dibujo', ['Dibujo']],
    ['Formas y 3D', ['Formas', '3D']],
    ['UI', ['UI']],
    ['Edificios', ['Edificios']],
    ['Jardín', ['Jardín']],
  ]);
});

test('config.js — los catálogos de variante están congelados y bien formados', () => {
  const ctx = load('src/js/config.js');
  const catalogs = {
    PLOT_SHAPES: ctx.PLOT_SHAPES, TREE_TYPES: ctx.TREE_TYPES,
    SHRUB_TYPES: ctx.SHRUB_TYPES, FLOWER_TYPES: ctx.FLOWER_TYPES,
    DECOR_TYPES: ctx.DECOR_TYPES, PATH_TYPES: ctx.PATH_TYPES,
    HERB_TYPES: ctx.HERB_TYPES, CLIMBER_TYPES: ctx.CLIMBER_TYPES,
    BALCONY_TYPES: ctx.BALCONY_TYPES, LIGHT_TYPES: ctx.LIGHT_TYPES,
    LIGHT_SPORTS: ctx.LIGHT_SPORTS,
    WALL_VIEWS: ctx.WALL_VIEWS, FORGE_TYPES: ctx.FORGE_TYPES,
    FENCE_VIEWS: ctx.FENCE_VIEWS,
    // Los históricos que faltaban en este mapa (hueco de cobertura, v3.22.0)
    PLANTA_SHAPES: ctx.PLANTA_SHAPES, DOOR_TYPES: ctx.DOOR_TYPES,
    WINDOW_TYPES: ctx.WINDOW_TYPES, ROOF_TYPES: ctx.ROOF_TYPES,
    FACADE_TYPES: ctx.FACADE_TYPES, GARDEN_PLANT_VIEWS: ctx.GARDEN_PLANT_VIEWS,
    // Parte técnica del plano y piezas UI (v3.22.0)
    STAIR_TYPES: ctx.STAIR_TYPES, STAIR_VIEWS: ctx.STAIR_VIEWS,
    SYMBOL_TYPES: ctx.SYMBOL_TYPES, COLUMN_TYPES: ctx.COLUMN_TYPES,
    FURNITURE_TYPES: ctx.FURNITURE_TYPES, PORCH_TYPES: ctx.PORCH_TYPES,
    SILHOUETTE_TYPES: ctx.SILHOUETTE_TYPES, ROOF_ADDONS: ctx.ROOF_ADDONS,
    FORM_VARIANTS: ctx.FORM_VARIANTS, TABLE_VARIANTS: ctx.TABLE_VARIANTS,
    CHART_VARIANTS: ctx.CHART_VARIANTS,
    // Las veteranas, el Diálogo, «Piezas» y los presets del Marco (v3.23.0)
    BUTTON_VARIANTS: ctx.BUTTON_VARIANTS, INPUT_VARIANTS: ctx.INPUT_VARIANTS,
    CARD_VARIANTS: ctx.CARD_VARIANTS, NAV_VARIANTS: ctx.NAV_VARIANTS,
    DIALOG_VARIANTS: ctx.DIALOG_VARIANTS, UI_PIECE_VARIANTS: ctx.UI_PIECE_VARIANTS,
    FRAME_PRESETS: ctx.FRAME_PRESETS,
    PRISM_SECTIONS: ctx.PRISM_SECTIONS, PYRAMID_SECTIONS: ctx.PYRAMID_SECTIONS,
    FRUSTUM_SECTIONS: ctx.FRUSTUM_SECTIONS,
  };
  for (const [name, list] of Object.entries(catalogs)) {
    assert.ok(Array.isArray(list) && list.length > 0, `${name} vacío`);
    assert.equal(Object.isFrozen(list), true, `${name} no está congelado`);
    const ids = list.map(v => v.id);
    assert.equal(new Set(ids).size, ids.length, `${name} tiene ids repetidos`);
    for (const v of list) {
      assert.equal(typeof v.id, 'string');
      assert.ok(v.name && typeof v.name === 'string', `${name}/${v.id} sin nombre`);
    }
  }
});

/* ---------------- Marco y «Piezas» (v3.23.0) ---------------- */

test('config.js — FRAME_PRESETS: cajas válidas y la primera es la histórica', () => {
  const ctx = load('src/js/config.js');
  for (const preset of ctx.FRAME_PRESETS) {
    assert.ok(preset.w > 0 && preset.h > 0, `preset ${preset.id} degenerado`);
  }
  // El primer preset ES la caja que UI_DEFAULTS[frame] daba a un clic hasta la
  // 3.22.x: cambiarla cambiaría el gesto más común sin que nadie lo pida.
  assert.equal(ctx.FRAME_PRESETS[0].id, 'movil');
  assert.equal(ctx.FRAME_PRESETS[0].w, ctx.UI_DEFAULTS[ctx.TOOLS.FRAME].w);
  assert.equal(ctx.FRAME_PRESETS[0].h, ctx.UI_DEFAULTS[ctx.TOOLS.FRAME].h);
});

test('config.js — UI_PIECE_DEFAULTS: una caja válida por cada variante de «Piezas»', () => {
  const ctx = load('src/js/config.js');
  const ids = ctx.UI_PIECE_VARIANTS.map(v => v.id);
  assert.deepEqual([...Object.keys(ctx.UI_PIECE_DEFAULTS)].sort(), [...ids].sort(),
    'las claves de UI_PIECE_DEFAULTS deben ser exactamente los ids del catálogo');
  for (const id of ids) {
    const caja = ctx.UI_PIECE_DEFAULTS[id];
    assert.ok(caja.w > 0 && caja.h > 0, `caja de ${id} degenerada`);
  }
  // Y la caja genérica de UI_DEFAULTS es la del default (avatar), para que la
  // vista previa de #modal-ui y la creación cuenten la misma historia.
  assert.deepEqual(ctx.UI_DEFAULTS[ctx.TOOLS.UI_PIECE], ctx.UI_PIECE_DEFAULTS.avatar);
});

/* ---------------- Aspectos de lienzo (v2.31.0) ---------------- */

// El primer aspecto ES el estado de fábrica. Está escrito dos veces —el
// catálogo y las constantes/appDefaults de app.js— y solo la segunda manda al
// arrancar, así que si divergen la fila enseña «Plano» sin marcar nada nada
// más abrir la app (el estado real no coincidiría con ninguna muestra).
test('el primer aspecto de lienzo es el de fábrica que dice app.js', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ctx = load('src/js/config.js');
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'src/js/app.js'), 'utf8');
  const primero = ctx.CANVAS_PRESETS[0];

  const bg = app.match(/const DEFAULT_CANVAS_BG = '(#[0-9a-f]{6})'/);
  const grid = app.match(/const DEFAULT_GRID_COLOR = '(#[0-9a-f]{6})'/);
  assert.ok(bg && grid, 'no se encuentran los colores de fábrica en app.js');
  assert.equal(primero.bg, bg[1], 'el primer aspecto no usa DEFAULT_CANVAS_BG');
  assert.equal(primero.grid, grid[1], 'el primer aspecto no usa DEFAULT_GRID_COLOR');

  // El tercer campo vive en appDefaults(), no en una constante.
  const showGrid = app.match(/showGrid:\s*(true|false),/);
  assert.ok(showGrid, 'no se encuentra showGrid en appDefaults()');
  assert.equal(primero.showGrid, showGrid[1] === 'true',
    'el primer aspecto no coincide con el showGrid de appDefaults()');
});

test('los aspectos de lienzo están congelados y son distinguibles', () => {
  const ctx = load('src/js/config.js');
  const lista = ctx.CANVAS_PRESETS;
  assert.equal(Object.isFrozen(lista), true, 'CANVAS_PRESETS no está congelado');
  assert.ok(lista.length >= 2, 'una fila de aspectos con menos de dos no es una fila');

  const ids = lista.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos');

  for (const p of lista) {
    assert.ok(p.name && typeof p.name === 'string', `${p.id} sin nombre`);
    assert.equal(typeof p.showGrid, 'boolean', `${p.id}: showGrid no es booleano`);
    // Los dos colores son hexadecimales de seis: acaban en un <input
    // type="color"> y en el `value` de un picker nativo, que no acepta otra
    // cosa. Y `grid` existe SIEMPRE, también en los aspectos sin rejilla:
    // es lo que permite encender la casilla después y ver algo.
    for (const campo of ['bg', 'grid']) {
      assert.match(p[campo], /^#[0-9a-f]{6}$/, `${p.id}/${campo} no es hex de seis`);
    }
  }

  // Dos aspectos iguales en los tres campos serían dos muestras idénticas en
  // la fila, y sólo una de ellas se podría marcar como activa.
  const firmas = lista.map(p => `${p.bg}|${p.grid}|${p.showGrid}`);
  assert.equal(new Set(firmas).size, firmas.length,
    'dos aspectos de lienzo son indistinguibles');
});
