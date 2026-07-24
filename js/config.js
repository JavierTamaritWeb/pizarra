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
  BUILD_PLANTA: 'planta',         BUILD_ALZADO: 'alzado',
  BUILD_PERFIL: 'perfil',         BUILD_FACADE: 'fachada',
  BUILD_ROOF2:  'tejadoDosAguas', BUILD_ROOF1:  'tejadoUnAgua',
  BUILD_ROOFF:  'tejadoPlano',    BUILD_DOOR:   'puerta',
  BUILD_WINDOW: 'ventana',
});

/** Herramientas de la sección "Edificios": todas son SOLO de creación
    (producen rect/line), nunca valores de `el.type`. */
const BUILDING_TOOLS = Object.freeze([
  TOOLS.BUILD_PLANTA, TOOLS.BUILD_ALZADO, TOOLS.BUILD_PERFIL,
  TOOLS.BUILD_FACADE, TOOLS.BUILD_ROOF2, TOOLS.BUILD_ROOF1, TOOLS.BUILD_ROOFF,
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
    (doorIcon) a partir del id. */
const DOOR_TYPES = Object.freeze([
  { id: 'door',      name: 'Puerta' },
  { id: 'arch',      name: 'Puerta de arco' },
  { id: 'frame',     name: 'Marco' },
  { id: 'archFrame', name: 'Marco de arco' },
]);

/** Tipos del botón Ventana (catálogo del modal). El icono lo dibuja app.js
    (windowIcon) a partir del id. */
const WINDOW_TYPES = Object.freeze([
  { id: 'window',    name: 'Ventana' },
  { id: 'arch',      name: 'Ventana de arco' },
  { id: 'frame',     name: 'Marco' },
  { id: 'archFrame', name: 'Marco de arco' },
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
      { id: TOOLS.BUILD_ALZADO, icon: '🏠', name: 'Alzado',         key: 'x' },
      { id: TOOLS.BUILD_PERFIL, icon: '🏠', name: 'Perfil',         key: 'h' },
      { id: TOOLS.BUILD_FACADE, icon: '▮',  name: 'Fachada',        key: '1' },
      { id: TOOLS.BUILD_ROOF2,  icon: '△',  name: 'Tejado 2 aguas', key: '2' },
      { id: TOOLS.BUILD_ROOF1,  icon: '◺',  name: 'Tejado 1 agua',  key: '8' },
      { id: TOOLS.BUILD_ROOFF,  icon: '▬',  name: 'Tejado plano',   key: '9' },
      { id: TOOLS.BUILD_DOOR,   icon: '🚪', name: 'Puerta',         key: '0' },
      { id: TOOLS.BUILD_WINDOW, icon: '🪟', name: 'Ventana',        key: 'y' },
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
