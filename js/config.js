/* ============================================================
   config.js — Constants & tool definitions
   ============================================================ */

const TOOLS = Object.freeze({
  PENCIL:           'pencil',
  LINE:             'line',
  RECT:             'rect',
  ROUNDED_RECT:     'roundedRect',
  CIRCLE:           'circle',
  SQUARE:           'square',
  TRAPEZOID:        'trapezoid',
  TRIANGLE:         'triangle',
  PENTAGON:         'pentagon',
  HEXAGON:          'hexagon',
  ARROW:            'arrow',
  CURVE_ARROW:      'curveArrow',
  ARC:              'arc', // herramienta de creación: produce curveArrow con arc:true
  TEXT:             'text',
  EMOJI:            'emoji', // herramienta de creación: produce elementos text
  ERASER:           'eraser',
  SELECT:           'select',
  IMAGE_PLACEHOLDER:'imagePlaceholder',
  IMAGE:            'image', // imagen real pegada (sin botón en el sidebar)
  BUTTON:           'button',
  INPUT:            'input',
  NAV:              'nav',
  CARD:             'card',
  // Edificios — herramientas de creación (NO tipos de elemento): cada una
  // produce elementos de tipos ya existentes (rect/line). Ver js/building.js.
  BUILD_PLANTA: 'planta',         BUILD_FACADE: 'fachada',
  BUILD_ROOF:   'tejado',         BUILD_DOOR:   'puerta',
  BUILD_WINDOW: 'ventana',
  // Jardín — herramientas de creación (NO tipos de elemento): producen
  // rect/line/circle/curveArrow/text. Todo en vista de planta. Ver js/garden.js.
  GARDEN_PLOT:   'jardin',        GARDEN_TREE:   'arbol',
  GARDEN_SHRUB:  'arbusto',       GARDEN_FLOWER: 'flor',
  GARDEN_DECOR:  'decoracion',
});

/** Herramientas de la sección "Edificios": todas son SOLO de creación
    (producen rect/line), nunca valores de `el.type`. */
const BUILDING_TOOLS = Object.freeze([
  TOOLS.BUILD_PLANTA, TOOLS.BUILD_FACADE, TOOLS.BUILD_ROOF,
  TOOLS.BUILD_DOOR, TOOLS.BUILD_WINDOW,
]);

/** Formas de huella del botón Planta (catálogo del modal). Ampliable.
    El icono lo dibuja app.js (plantaIcon) a partir del id. */
const PLANTA_SHAPES = Object.freeze([
  { id: 'rect',     name: 'Rectangular' },
  { id: 'l',        name: 'En L' },
  { id: 'u',        name: 'En U (jardín)' },
  { id: 'claustro', name: 'Claustro' },
]);

/** Tipos del botón Puerta (catálogo del modal). El icono lo dibuja app.js
    (doorIcon) a partir del id. Hojas primero, marcos al final. */
const DOOR_TYPES = Object.freeze([
  { id: 'door',        name: 'Puerta' },
  { id: 'arch',        name: 'Puerta de arco' },
  { id: 'double',      name: 'Puerta doble' },
  { id: 'panel',       name: 'Puerta de paneles' },
  { id: 'garage',      name: 'Puerta de garaje' },
  { id: 'frame',       name: 'Marco' },
  { id: 'archFrame',   name: 'Marco de arco' },
  { id: 'doubleFrame', name: 'Marco doble' },
]);

/** Tipos del botón Ventana (catálogo del modal). El icono lo dibuja app.js
    (windowIcon) a partir del id. Hojas primero, marcos al final. */
const WINDOW_TYPES = Object.freeze([
  { id: 'window',      name: 'Ventana' },
  { id: 'arch',        name: 'Ventana de arco' },
  { id: 'double',      name: 'Ventana de 2 hojas' },
  { id: 'grid',        name: 'Ventana cuadrícula' },
  { id: 'round',       name: 'Óculo' },
  { id: 'frame',       name: 'Marco' },
  { id: 'archFrame',   name: 'Marco de arco' },
  { id: 'roundFrame',  name: 'Marco redondo' },
]);

/** Tipos del botón Tejado (catálogo del modal). El icono lo dibuja app.js
    (roofIcon) a partir del id. */
const ROOF_TYPES = Object.freeze([
  { id: 'gable',   name: 'Dos aguas' },
  { id: 'mono',    name: 'Un agua' },
  { id: 'flat',    name: 'Plano' },
  { id: 'hip',     name: 'Cuatro aguas' },
  { id: 'mansard', name: 'Mansarda' },
]);

/** Tipos del botón Fachada (catálogo del modal). El icono lo dibuja app.js
    (facadeIcon) a partir del id.
    `name` va en lenguaje llano (quien no es arquitecto no sabe elegir entre
    «alzado» y «perfil») y `hint` conserva el término técnico como subtítulo.
    Ninguno de los dos puede prometer una forma de cubierta: en el alzado la
    elige `state.roofType`, no esta entrada. */
const FACADE_TYPES = Object.freeze([
  { id: 'flat',    name: 'De frente',  hint: 'Fachada plana' },
  { id: 'gable',   name: 'Con tejado', hint: 'Alzado' },
  { id: 'profile', name: 'De lado',    hint: 'Perfil' },
]);

/** Herramientas de la sección "Jardín": como las de Edificios, todas son SOLO
    de creación (producen rect/line/circle/curveArrow/text), nunca valores de
    `el.type`. Ver js/garden.js. */
const GARDEN_TOOLS = Object.freeze([
  TOOLS.GARDEN_PLOT, TOOLS.GARDEN_TREE, TOOLS.GARDEN_SHRUB,
  TOOLS.GARDEN_FLOWER, TOOLS.GARDEN_DECOR,
]);

/* Los cinco catálogos del jardín comparten formato con los de Edificios
   ({ id, name }) y su icono NO se dibuja a mano: app.js lo pinta con la
   geometría real de js/garden.js, así que el icono es siempre lo que se
   obtiene al arrastrar. Añadir una variante = añadir una entrada aquí y su
   caso en garden.js; el modal se rellena solo. */

/** Formas de la parcela del botón Jardín. */
const PLOT_SHAPES = Object.freeze([
  { id: 'rect',    name: 'Rectangular' },
  { id: 'round',   name: 'Redonda' },
  { id: 'l',       name: 'En L' },
  { id: 'organic', name: 'Orgánica' },
]);

/** Tipos del botón Árbol (copa vista desde arriba). */
const TREE_TYPES = Object.freeze([
  { id: 'broadleaf', name: 'Frondoso' },
  { id: 'conifer',   name: 'Conífera' },
  { id: 'palm',      name: 'Palmera' },
  { id: 'olive',     name: 'Olivo' },
  { id: 'fruit',     name: 'Frutal' },
  { id: 'cypress',   name: 'Ciprés' },
]);

/** Tipos del botón Arbusto. */
const SHRUB_TYPES = Object.freeze([
  { id: 'bush',   name: 'Mata redonda' },
  { id: 'hedge',  name: 'Seto' },
  { id: 'clump',  name: 'Macizo' },
  { id: 'topiary',name: 'Topiario' },
]);

/** Tipos del botón Flor. */
const FLOWER_TYPES = Object.freeze([
  { id: 'daisy',     name: 'Margarita' },
  { id: 'rose',      name: 'Rosa' },
  { id: 'tulip',     name: 'Tulipán' },
  { id: 'bed',       name: 'Parterre' },
  { id: 'sunflower', name: 'Girasol' },
]);

/** Tipos del botón Decoración. */
const DECOR_TYPES = Object.freeze([
  { id: 'pot',      name: 'Maceta' },
  { id: 'well',     name: 'Pozo' },
  { id: 'can',      name: 'Regadera' },
  { id: 'stone',    name: 'Piedra' },
  { id: 'bench',    name: 'Banco' },
  { id: 'fountain', name: 'Fuente' },
  { id: 'pond',     name: 'Estanque' },
  { id: 'path',     name: 'Camino' },
]);

const TOOL_GROUPS = [
  {
    label: 'Dibujo',
    tools: [
      { id: TOOLS.PENCIL, icon: '✏️', name: 'Lápiz',    key: 'p' },
      { id: TOOLS.LINE,   icon: '📏', name: 'Línea',    key: 'l' },
      { id: TOOLS.ARROW,  icon: '➡️', name: 'Flecha',   key: 'a' },
      { id: TOOLS.CURVE_ARROW, icon: '↷', name: 'Flecha curva', key: 'u' },
      { id: TOOLS.ARC,    icon: '◠', name: 'Semicírculo', key: 'g' },
      { id: TOOLS.ERASER, icon: '🧽', name: 'Borrador', key: 'e' },
    ],
  },
  {
    label: 'Formas',
    tools: [
      { id: TOOLS.RECT,         icon: '◻️', name: 'Rectángulo', key: 'r' },
      { id: TOOLS.ROUNDED_RECT, icon: '▢',  name: 'Redondeado', key: 'o' },
      { id: TOOLS.CIRCLE,       icon: '⬭',  name: 'Círculo',    key: 'c' },
      { id: TOOLS.SQUARE,       icon: '□',  name: 'Cuadrado',   key: '4' },
      { id: TOOLS.TRAPEZOID,    icon: '⏢',  name: 'Trapecio',   key: '7' },
      { id: TOOLS.TRIANGLE,     icon: '△',  name: 'Triángulo regular', key: '3' },
      { id: TOOLS.PENTAGON,     icon: '⬠',  name: 'Pentágono regular', key: '5' },
      { id: TOOLS.HEXAGON,      icon: '⬡',  name: 'Hexágono regular',  key: '6' },
    ],
  },
  {
    label: 'UI',
    tools: [
      { id: TOOLS.TEXT,              icon: 'T',  name: 'Texto',  key: 't' },
      { id: TOOLS.EMOJI,            icon: '🙂', name: 'Emoji',  key: 'j' },
      { id: TOOLS.BUTTON,           icon: '🔘', name: 'Botón',  key: 'b' },
      { id: TOOLS.INPUT,            icon: '▭',  name: 'Input',  key: 'i' },
      { id: TOOLS.IMAGE_PLACEHOLDER,icon: '🖼️', name: 'Imagen', key: 'm' },
      { id: TOOLS.NAV,              icon: '☰',  name: 'Navbar', key: 'n' },
      { id: TOOLS.CARD,             icon: '🃏', name: 'Tarjeta', key: 'k' },
    ],
  },
  {
    label: 'Edición',
    tools: [
      { id: TOOLS.SELECT, icon: '👆', name: 'Mover', key: 'v' },
    ],
  },
  {
    label: 'Edificios',
    tools: [
      { id: TOOLS.BUILD_PLANTA, icon: '▭',  name: 'Planta',         key: 'w' },
      { id: TOOLS.BUILD_FACADE, icon: '🏠', name: 'Fachada',        key: '1' },
      { id: TOOLS.BUILD_ROOF,   icon: '△',  name: 'Tejado',         key: '2' },
      { id: TOOLS.BUILD_DOOR,   icon: '🚪', name: 'Puerta',         key: '0' },
      { id: TOOLS.BUILD_WINDOW, icon: '🪟', name: 'Ventana',        key: 'y' },
    ],
  },
  {
    label: 'Jardín',
    // Atajos: `8 9 h x z` son las CINCO teclas sueltas que quedaban libres, y
    // por eso van en el orden del sidebar en vez de por inicial. Ojo al elegir
    // otras: `f`, `q`, `d` y `s` ya están cogidas por acciones de flecha curva
    // (app.js), que se comprueban ANTES que TOOL_KEYS y solo cuando hay una
    // curva seleccionada — o sea que la colisión sería intermitente y muda, y
    // toda pieza de jardín lleva curvas dentro. Lo fija RESERVED_PLAIN_KEYS en
    // tests/config-templates.test.js.
    tools: [
      { id: TOOLS.GARDEN_PLOT,   icon: '🟩', name: 'Jardín',     key: '8' },
      { id: TOOLS.GARDEN_TREE,   icon: '🌳', name: 'Árbol',      key: '9' },
      { id: TOOLS.GARDEN_SHRUB,  icon: '🌿', name: 'Arbusto',    key: 'h' },
      { id: TOOLS.GARDEN_FLOWER, icon: '🌸', name: 'Flor',       key: 'x' },
      { id: TOOLS.GARDEN_DECOR,  icon: '🪴', name: 'Decoración', key: 'z' },
    ],
  },
];

const COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#e94560', '#f39c12', '#27ae60', '#2980b9',
  '#8e44ad', '#c0392b', '#1abc9c', '#e74c3c',
  '#3498db', '#2ecc71', '#f1c40f', '#95a5a6',
  '#ecf0f1', '#ffffff',
];

/**
 * Catálogo del selector de emoji, agrupado por categoría. Un emoji insertado
 * es un elemento `text` normal (su `value` es el carácter), así que render,
 * exportación, selección y undo funcionan sin código específico.
 */
const EMOJI_GROUPS = [
  {
    label: 'Caras',
    emojis: ['🙂', '😀', '😍', '🤔', '😅', '😎', '😴', '😡', '😱', '🤯', '🥳', '🤝'],
  },
  {
    label: 'Estado',
    emojis: ['✅', '❌', '⚠️', '❓', '❗', '⭐', '🔥', '💡', '🎯', '🚀', '🏆', '🔒'],
  },
  {
    label: 'Flechas',
    emojis: ['⬆️', '⬇️', '⬅️', '➡️', '↔️', '↕️', '🔄', '🔙', '▶️', '⏸️', '⏹️', '🔃'],
  },
  {
    label: 'Objetos',
    emojis: ['📱', '💻', '🖥️', '⌨️', '🖱️', '📷', '🔍', '📎', '📌', '📁', '📄', '🗑️'],
  },
  {
    label: 'Datos',
    emojis: ['📊', '📈', '📉', '💰', '🛒', '👤', '👥', '📧', '🔔', '⚙️', '🕐', '📅'],
  },
];

const CANVAS_W = 1200;
const CANVAS_H = 800;

/** Tamaño mínimo al insertar un emoji, para que se lea como icono */
const EMOJI_MIN_SIZE = 32;

const SKETCHY_FONT = "'Architects Daughter', 'Segoe Print', 'Comic Neue', cursive";

/** Default dimensions when a UI component is placed with a tiny drag */
const UI_DEFAULTS = {
  [TOOLS.BUTTON]:            { w: 120, h: 40 },
  [TOOLS.INPUT]:             { w: 220, h: 36 },
  [TOOLS.IMAGE_PLACEHOLDER]: { w: 200, h: 150 },
  [TOOLS.NAV]:               { w: 600, h: 50 },
  [TOOLS.CARD]:              { w: 220, h: 280 },
};
