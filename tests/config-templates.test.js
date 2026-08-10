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

  await t.test('TOOLS tiene exactamente los 41 ids esperados', () => {
    const expected = [
      'pencil', 'line', 'rect', 'roundedRect', 'circle', 'arrow',
      'curveArrow', 'arc', 'text', 'eraser', 'select', 'pick', 'imagePlaceholder',
      'button', 'input', 'nav', 'card', 'image', 'emoji',
      'square', 'trapezoid', 'triangle', 'pentagon', 'hexagon',
      // Edificios (creación): Fachada y Tejado unifican sus tipos en sendos modales
      'planta', 'fachada', 'tejado', 'puerta', 'ventana', 'balcon', 'muro', 'verja', 'cancela',
      // Jardín (creación): cada una elige su variante en su propio modal
      'jardin', 'arbol', 'arbusto', 'flor', 'decoracion', 'camino', 'aromatica', 'trepadora',
    ];
    const values = Object.values(ctx.TOOLS);
    assert.equal(values.length, 41);
    assert.deepEqual([...values].sort(), [...expected].sort());
    // Las claves también son 41 y únicas
    assert.equal(Object.keys(ctx.TOOLS).length, 41);
    assert.equal(new Set(values).size, 41);
  });
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

test('config.js — COLORS son colores hex válidos (#rrggbb)', () => {
  const ctx = load('src/js/config.js');
  assert.ok(Array.isArray(ctx.COLORS));
  assert.ok(ctx.COLORS.length > 0);
  for (const c of ctx.COLORS) {
    assert.match(c, /^#[0-9a-fA-F]{6}$/, `COLORS contiene un hex inválido: ${c}`);
  }
});

test('config.js — CANVAS_W/CANVAS_H', () => {
  const ctx = load('src/js/config.js');
  assert.equal(ctx.CANVAS_W, 1200);
  assert.equal(ctx.CANVAS_H, 800);
});

test('config.js — UI_DEFAULTS tiene w/h positivos para los 5 componentes UI', () => {
  const ctx = load('src/js/config.js');
  const { TOOLS, UI_DEFAULTS } = ctx;
  const keys = [TOOLS.BUTTON, TOOLS.INPUT, TOOLS.IMAGE_PLACEHOLDER, TOOLS.NAV, TOOLS.CARD];
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

test('config.js — el sidebar de Edificios y BUILDING_TOOLS son la misma lista', () => {
  const ctx = load('src/js/config.js');
  const build = ctx.TOOL_GROUPS.find(g => g.label === 'Edificios');
  assert.ok(build, 'falta el grupo Edificios en el sidebar');
  assert.deepEqual(
    [...build.tools.map(t => t.id)].sort(),
    [...ctx.BUILDING_TOOLS].sort(),
    'los botones del sidebar y BUILDING_TOOLS deben coincidir');
  // Balcón, Muro, Verjas y Cancela entraron sin atajo porque ya no queda ninguna tecla suelta
  // libre: las 26 letras y los 10 dígitos están asignados y `f q d s` las usan
  // las acciones de flecha curva. Se fija igual que en Jardín, para que el
  // hueco no crezca por descuido ni un botón pierda su tecla en una refactorización.
  assert.deepEqual([...build.tools.filter(t => !t.key).map(t => t.id)],
    ['balcon', 'muro', 'verja', 'cancela']);
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

test('config.js — los catálogos de variante están congelados y bien formados', () => {
  const ctx = load('src/js/config.js');
  const catalogs = {
    PLOT_SHAPES: ctx.PLOT_SHAPES, TREE_TYPES: ctx.TREE_TYPES,
    SHRUB_TYPES: ctx.SHRUB_TYPES, FLOWER_TYPES: ctx.FLOWER_TYPES,
    DECOR_TYPES: ctx.DECOR_TYPES, PATH_TYPES: ctx.PATH_TYPES,
    HERB_TYPES: ctx.HERB_TYPES, CLIMBER_TYPES: ctx.CLIMBER_TYPES,
    BALCONY_TYPES: ctx.BALCONY_TYPES,
    WALL_VIEWS: ctx.WALL_VIEWS, FORGE_TYPES: ctx.FORGE_TYPES,
    FENCE_VIEWS: ctx.FENCE_VIEWS,
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
