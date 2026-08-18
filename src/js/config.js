/* ============================================================
   config.js — Constants & tool definitions
   ============================================================ */

const TOOLS = Object.freeze({
  PENCIL:           'pencil',
  // Tipo de elemento REAL, a diferencia de arc/emoji y de Edificios/Jardín:
  // el aerógrafo se guarda como `type:'airbrush'` y su nube de gotas se
  // regenera desde el seed en js/airbrush.js. Por eso NO va en
  // CREATION_ONLY_TOOLS (exporter.js) — meterlo ahí lo borraría al importar.
  AIRBRUSH:         'airbrush',
  LINE:             'line',
  RECT:             'rect',
  ROUNDED_RECT:     'roundedRect',
  CIRCLE:           'circle',
  SQUARE:           'square',
  TRAPEZOID:        'trapezoid',
  TRIANGLE:         'triangle',
  PENTAGON:         'pentagon',
  HEXAGON:          'hexagon',
  // Estrellas regulares: tipos de elemento REALES, como el resto de Formas.
  // Su silueta la da RegularPolygon (un polígono cóncavo de 10 y 12 vértices),
  // así que no necesitan nada propio en renderer, exporter ni borrador.
  STAR5:            'star5',
  STAR6:            'star6',
  // Polígono libre: una lista de puntos con relleno propio y contorno
  // opcional. NO tiene botón en el sidebar (como `image`): lo produce
  // js/solid.js para las caras laterales de las figuras 3D, que son
  // cuadriláteros arbitrarios y ningún otro tipo sabe representar.
  POLYGON:          'polygon',
  // El bote de pintura. Al revés que el aerógrafo, NO es un tipo de elemento:
  // lo que crea es un `polygon` con el contorno de la zona (con `ink: true`),
  // así que va en CREATION_ONLY_TOOLS (exporter.js) o `type:'ink'` entraría
  // como elemento fantasma al importar.
  INK:              'ink',
  ARROW:            'arrow',
  CURVE_ARROW:      'curveArrow',
  ARC:              'arc', // herramienta de creación: produce curveArrow con arc:true
  TEXT:             'text',
  EMOJI:            'emoji', // herramienta de creación: produce elementos text
  ERASER:           'eraser',
  SELECT:           'select',
  PICK:             'pick', // «Select»: solo selección — clic o marquesina, nunca mueve
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
  BUILD_WINDOW: 'ventana',        BUILD_BALCONY:'balcon',
  BUILD_WALL:   'muro',           BUILD_FENCE:  'verja',
  BUILD_GATE:   'cancela',
  // Jardín — herramientas de creación (NO tipos de elemento): producen
  // rect/line/circle/curveArrow/text. La vegetación admite planta y alzado.
  GARDEN_PLOT:   'jardin',        GARDEN_TREE:   'arbol',
  GARDEN_SHRUB:  'arbusto',       GARDEN_FLOWER: 'flor',
  GARDEN_DECOR:  'decoracion',    GARDEN_PATH:   'camino',
  GARDEN_HERB:   'aromatica',     GARDEN_CLIMBER:'trepadora',
  // 3D — herramientas de creación (NO tipos de elemento): cada arrastre define
  // la CARA FRONTAL y el módulo js/solid.js devuelve esa forma 2D real más las
  // aristas del volumen como line/curveArrow. Los ids no colisionan con ningún
  // `el.type`, y van en CREATION_ONLY_TOOLS (exporter.js) por lo mismo que
  // Edificios y Jardín.
  SOLID_PRISM:   'prisma',        SOLID_PYRAMID: 'piramide',
  SOLID_FRUSTUM: 'tronco',        SOLID_SPHERE:  'esfera',
});

/** Herramientas de la sección "Edificios": todas son SOLO de creación
    (producen rect/line), nunca valores de `el.type`. */
const BUILDING_TOOLS = Object.freeze([
  TOOLS.BUILD_PLANTA, TOOLS.BUILD_FACADE, TOOLS.BUILD_ROOF,
  TOOLS.BUILD_DOOR, TOOLS.BUILD_WINDOW, TOOLS.BUILD_BALCONY, TOOLS.BUILD_WALL,
  TOOLS.BUILD_FENCE, TOOLS.BUILD_GATE,
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

/**
 * Tipos del botón Balcón (catálogo del modal), en ALZADO como la puerta y la
 * ventana: la caja del arrastre es el balcón entero —barandilla arriba, losa
 * abajo— y el vuelo sobresale a los lados, como el alero de un tejado.
 *
 * A diferencia de Puerta y Ventana, aquí el tipo manda en la proporción (un
 * mirador es alto, un balcón corrido es una franja), así que su caja por
 * defecto va por variante en `byVariant` (js/building.js).
 *
 * Su icono NO se dibuja a mano: lo pinta la geometría real de js/building.js,
 * como los del jardín. Añadir una variante = una entrada aquí y su `case` en
 * `_balconyTool`; el modal se rellena solo.
 *
 * Orden: primero las barandillas abiertas, después las cerradas o macizas.
 */
const BALCONY_TYPES = Object.freeze([
  { id: 'balcony',    name: 'Balcón' },
  { id: 'french',     name: 'Balcón francés' },
  { id: 'iron',       name: 'Balcón de forja' },
  { id: 'balustrade', name: 'Balaustrada' },
  { id: 'long',       name: 'Balcón corrido' },
  { id: 'glass',      name: 'Balcón acristalado' },
  { id: 'terrace',    name: 'Terraza' },
  { id: 'mirador',    name: 'Mirador' },
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

/** Vistas del botón Muro (catálogo del modal). El icono NO se dibuja a mano:
    lo pinta la geometría real de js/building.js, como el de Balcón. Material,
    altura, verja y puerta son ejes independientes de la vista —no caben como
    variantes de este catálogo— y viven como controles propios en #modal-wall. */
const WALL_VIEWS = Object.freeze([
  { id: 'plan',      name: 'Vista de planta' },
  { id: 'elevation', name: 'Vista de alzado' },
]);

/** Los trece diseños de forja se comparten entre la coronación del Muro y la
    herramienta Verjas. Todos conservan puntas de lanza defensivas. */
const FORGE_TYPES = Object.freeze([
  { id: 'spear',    name: 'Lanzas clásicas' },
  { id: 'minimal',  name: 'Recta minimalista con lanzas' },
  { id: 'arches',   name: 'Arcos entrelazados con lanzas' },
  { id: 'diamonds', name: 'Rombos ingleses con lanzas' },
  { id: 'rings',    name: 'Anillas neoclásicas con lanzas' },
  { id: 'scrolls',  name: 'Volutas barrocas con lanzas' },
  { id: 'fans',     name: 'Abanicos ornamentales con lanzas' },
  { id: 'castilian', name: 'Castellana de cuadradillo torsionado' },
  { id: 'plateresque', name: 'Plateresca de medallones y palmetas' },
  { id: 'herrerian', name: 'Herreriana de nudos sobrios' },
  { id: 'andalusian', name: 'Andaluza de roleos en S' },
  { id: 'catalan', name: 'Catalana de espirales y rosetas' },
  { id: 'valencian', name: 'Valenciana barroca de rocalla' },
]);

/** Vistas arquitectónicas de la herramienta Verjas. El tipo y la altura son
    ajustes independientes dentro de su modal. */
const FENCE_VIEWS = Object.freeze([
  { id: 'plan',      name: 'Vista de planta' },
  { id: 'elevation', name: 'Vista de alzado' },
]);

/** Cancelas autónomas disponibles también como puerta del Muro. Se excluye
    «Sin puerta» porque esta herramienta siempre crea una cancela real. */
const GATE_TYPES = Object.freeze([
  { id: 'single', name: 'Barrotes, una hoja' },
  { id: 'double', name: 'Barrotes, dos hojas' },
  { id: 'concave', name: 'Cóncava pura, barrotes graduados' },
  { id: 'concaveSwan', name: 'Cuello de cisne, doble curva' },
  { id: 'concavePanel', name: 'Cóncava con zócalo ciego' },
  { id: 'concaveOrnate', name: 'Cóncava ornamental y volutas' },
  { id: 'concaveFan', name: 'Cóncava con abanico radial' },
  { id: 'concaveLyre', name: 'Cóncava con lira central' },
  { id: 'concaveDiamond', name: 'Cóncava con rombos ingleses' },
  { id: 'concaveRings', name: 'Cóncava de anillas neoclásicas' },
  { id: 'concavePalmette', name: 'Cóncava de palmetas barrocas' },
  { id: 'convexPanel', name: 'Convexa monumental · Panelada clásica' },
  { id: 'convexFan', name: 'Convexa monumental · Abanico imperial' },
  { id: 'convexMedallion', name: 'Convexa monumental · Doble cenefa' },
  { id: 'convexBlind', name: 'Convexa monumental · Ciega acanalada' },
  { id: 'solidTransom', name: 'Portón ciego con montante superior' },
  { id: 'openBars', name: 'Portón abierto de barrotes con lanzas' },
  { id: 'openScrolls', name: 'Portón abierto ornamental con lanzas' },
]);

const GATE_VIEWS = Object.freeze([
  { id: 'plan',      name: 'Vista de planta' },
  { id: 'elevation', name: 'Vista de alzado' },
]);

/** Herramientas de la sección "Jardín": como las de Edificios, todas son SOLO
    de creación (producen rect/line/circle/curveArrow/text), nunca valores de
    `el.type`. Ver js/garden.js. */
const GARDEN_TOOLS = Object.freeze([
  TOOLS.GARDEN_PLOT, TOOLS.GARDEN_TREE, TOOLS.GARDEN_SHRUB,
  TOOLS.GARDEN_FLOWER, TOOLS.GARDEN_DECOR, TOOLS.GARDEN_PATH,
  TOOLS.GARDEN_HERB, TOOLS.GARDEN_CLIMBER,
]);

/** Herramientas de la sección "3D": como las de Edificios y Jardín, todas son
    SOLO de creación (producen la forma 2D de la cara frontal más line y
    curveArrow), nunca valores de `el.type`. Ver js/solid.js. */
const SOLID_TOOLS = Object.freeze([
  TOOLS.SOLID_PRISM, TOOLS.SOLID_PYRAMID, TOOLS.SOLID_FRUSTUM,
  TOOLS.SOLID_SPHERE,
]);

/** Las diez secciones son EXACTAMENTE los diez tipos del grupo Formas: la cara
    frontal se emite como el elemento 2D real de ese tipo, así que el id de la
    sección ES el `el.type` que se crea. */
const SOLID_SECTIONS = Object.freeze([
  TOOLS.RECT, TOOLS.ROUNDED_RECT, TOOLS.CIRCLE, TOOLS.SQUARE, TOOLS.TRAPEZOID,
  TOOLS.TRIANGLE, TOOLS.PENTAGON, TOOLS.HEXAGON, TOOLS.STAR5, TOOLS.STAR6,
]);

// Los tres catálogos comparten los ids de SOLID_SECTIONS y sólo cambian el
// NOMBRE, que es justo lo que se quiere leer en el catálogo: la misma sección
// da «Cubo», «Pirámide» o «Tronco de pirámide» según el remate.
const PRISM_SECTIONS = Object.freeze([
  { id: 'rect',        name: 'Caja' },
  { id: 'roundedRect', name: 'Caja redondeada' },
  { id: 'circle',      name: 'Cilindro' },
  { id: 'square',      name: 'Cubo' },
  { id: 'trapezoid',   name: 'Prisma trapezoidal' },
  { id: 'triangle',    name: 'Prisma triangular' },
  { id: 'pentagon',    name: 'Prisma pentagonal' },
  { id: 'hexagon',     name: 'Prisma hexagonal' },
  { id: 'star5',       name: 'Prisma estrellado de 5' },
  { id: 'star6',       name: 'Prisma estrellado de 6' },
]);

const PYRAMID_SECTIONS = Object.freeze([
  { id: 'rect',        name: 'Pirámide rectangular' },
  { id: 'roundedRect', name: 'Pirámide de base roma' },
  { id: 'circle',      name: 'Cono' },
  { id: 'square',      name: 'Pirámide cuadrangular' },
  { id: 'trapezoid',   name: 'Pirámide trapezoidal' },
  { id: 'triangle',    name: 'Tetraedro' },
  { id: 'pentagon',    name: 'Pirámide pentagonal' },
  { id: 'hexagon',     name: 'Pirámide hexagonal' },
  { id: 'star5',       name: 'Pirámide estrellada de 5' },
  { id: 'star6',       name: 'Pirámide estrellada de 6' },
]);

const FRUSTUM_SECTIONS = Object.freeze([
  { id: 'rect',        name: 'Tronco rectangular' },
  { id: 'roundedRect', name: 'Tronco de base roma' },
  { id: 'circle',      name: 'Tronco de cono' },
  { id: 'square',      name: 'Tronco cuadrangular' },
  { id: 'trapezoid',   name: 'Tronco trapezoidal' },
  { id: 'triangle',    name: 'Tronco triangular' },
  { id: 'pentagon',    name: 'Tronco pentagonal' },
  { id: 'hexagon',     name: 'Tronco hexagonal' },
  { id: 'star5',       name: 'Tronco estrellado de 5' },
  { id: 'star6',       name: 'Tronco estrellado de 6' },
]);

/** Vistas y etapas compartidas por toda la vegetación. `factor` se aplica a
    la altura y anchura adultas de la ficha botánica. */
const GARDEN_PLANT_VIEWS = Object.freeze([
  { id: 'plan', name: 'Vista de planta' },
  { id: 'elevation', name: 'Vista de alzado' },
]);
const GARDEN_STAGES = Object.freeze([
  { id: 'young', name: 'Joven', factor: 0.38 },
  { id: 'developing', name: 'En desarrollo', factor: 0.68 },
  { id: 'adult', name: 'Adulto', factor: 1 },
]);
const GARDEN_LABEL_MODES = Object.freeze([
  { id: 'name', name: 'Nombre común' },
  { id: 'botanical', name: 'Nombre común y botánico' },
  { id: 'dimensions', name: 'Nombre y dimensiones' },
]);

/* Los ocho catálogos del jardín comparten formato con los de Edificios
   ({ id, name }) y su icono NO se dibuja a mano: app.js lo pinta con la
   geometría real de js/garden.js, así que el icono es siempre lo que se
   obtiene al arrastrar. Añadir una variante = añadir una entrada aquí y su
   caso en garden.js; el modal se rellena solo. */

/** Formas de la parcela del botón Jardín. */
const PLOT_SHAPES = Object.freeze([
  { id: 'rect',    name: 'Rectangular' },
  { id: 'square',  name: 'Cuadrada' },
  { id: 'round',   name: 'Redonda' },
  { id: 'l',       name: 'En L' },
  { id: 'organic', name: 'Orgánica' },
]);

/** Especies del botón Árbol. Las cotas son valores adultos orientativos en
    metros y gobiernan el tamaño a escala al hacer clic sin arrastrar. */
const TREE_TYPES = Object.freeze([
  { id: 'broadleaf', name: 'Encina', botanical: 'Quercus ilex', heightM: 12, spreadM: 14, habit: 'rounded', foliage: '#496b3a' },
  { id: 'conifer',   name: 'Pino piñonero', botanical: 'Pinus pinea', heightM: 18, spreadM: 12, habit: 'umbrella', foliage: '#365f46' },
  { id: 'palm',      name: 'Palmera datilera', botanical: 'Phoenix dactylifera', heightM: 14, spreadM: 7, habit: 'palm', foliage: '#557c3e' },
  { id: 'olive',     name: 'Olivo', botanical: 'Olea europaea', heightM: 7, spreadM: 8, habit: 'spreading', foliage: '#718067' },
  { id: 'almond',    name: 'Almendro', botanical: 'Prunus dulcis', heightM: 6, spreadM: 7, habit: 'vase', foliage: '#78905d', accent: '#d89bb0' },
  { id: 'carob',     name: 'Algarrobo', botanical: 'Ceratonia siliqua', heightM: 9, spreadM: 13, habit: 'spreading', foliage: '#3f643b' },
  { id: 'fruit',     name: 'Naranjo', botanical: 'Citrus sinensis', heightM: 5, spreadM: 5, habit: 'rounded', foliage: '#397246', accent: '#e58a26' },
  { id: 'cypress',   name: 'Ciprés mediterráneo', botanical: 'Cupressus sempervirens', heightM: 18, spreadM: 4, habit: 'columnar', foliage: '#315c49' },
  { id: 'fig',       name: 'Higuera', botanical: 'Ficus carica', heightM: 6, spreadM: 8, habit: 'spreading', foliage: '#5f7d43' },
  { id: 'pomegranate', name: 'Granado', botanical: 'Punica granatum', heightM: 5, spreadM: 4, habit: 'vase', foliage: '#537b3d', accent: '#b93632' },
  { id: 'lemon',     name: 'Limonero', botanical: 'Citrus limon', heightM: 5, spreadM: 5, habit: 'rounded', foliage: '#4d8240', accent: '#e1c83e' },
  { id: 'jacaranda', name: 'Jacaranda', botanical: 'Jacaranda mimosifolia', heightM: 12, spreadM: 10, habit: 'umbrella', foliage: '#557d55', accent: '#7655a6' },
  { id: 'persimmon', name: 'Caqui', botanical: 'Diospyros kaki', heightM: 8, spreadM: 7, habit: 'spreading', foliage: '#3f6b3c', accent: '#e0721f' },
]);

/** Tipos del botón Arbusto: primero las formas genéricas, luego los arbustos
    leñosos habituales en un jardín mediterráneo. */
const SHRUB_TYPES = Object.freeze([
  { id: 'bush',     name: 'Mirto', botanical: 'Myrtus communis', heightM: 2.5, spreadM: 2.2, habit: 'rounded', foliage: '#3e7351', accent: '#e6e5d5' },
  { id: 'hedge',    name: 'Seto de mirto y lentisco', botanical: 'Myrtus communis + Pistacia lentiscus', heightM: 2, spreadM: 5, depthM: 0.8, habit: 'hedge', foliage: '#467247' },
  { id: 'clump',    name: 'Alcaparra', botanical: 'Capparis spinosa', heightM: 1.2, spreadM: 1.8, habit: 'spreading', foliage: '#587057', accent: '#f0e5d4' },
  { id: 'topiary',  name: 'Olivo topiario', botanical: 'Olea europaea', heightM: 3.5, spreadM: 2.5, habit: 'topiary', foliage: '#66765f' },
  { id: 'oleander', name: 'Romero arbustivo', botanical: 'Salvia rosmarinus', heightM: 2, spreadM: 2.5, habit: 'vase', foliage: '#587266', accent: '#7182b4' },
  { id: 'box',      name: 'Olivo recortado', botanical: 'Olea europaea', heightM: 2.5, spreadM: 2, habit: 'box', foliage: '#66765f' },
  { id: 'mastic',   name: 'Lentisco', botanical: 'Pistacia lentiscus', heightM: 3, spreadM: 3.5, habit: 'spreading', foliage: '#426b3e' },
  { id: 'strawberryTree', name: 'Madroño', botanical: 'Arbutus unedo', heightM: 5, spreadM: 4, habit: 'rounded', foliage: '#476f43', accent: '#b43f32' },
  /* `pittosporum` se conserva como id interno para no romper proyectos
     guardados; la especie visible sí se sustituye por una mediterránea. */
  { id: 'pittosporum', name: 'Jara blanca', botanical: 'Cistus albidus', heightM: 1.5, spreadM: 1.5, habit: 'rounded', foliage: '#6f7a55', accent: '#c987a6' },
  { id: 'mirabilis', name: 'Dondiego de noche', botanical: 'Mirabilis jalapa', heightM: 0.9, spreadM: 0.9, habit: 'mound', foliage: '#4c7d46', accent: '#c73a8b' },
]);

/** Tipos del botón Aromáticas: las matas aromáticas de toda la vida y las
    mediterráneas de porte arquitectónico (roseta), que en planta se leen muy
    distintas de un arbusto cualquiera. */
const HERB_TYPES = Object.freeze([
  { id: 'lavender',  name: 'Lavanda', botanical: 'Lavandula angustifolia', heightM: 0.8, spreadM: 0.9, habit: 'tuft', foliage: '#718366', accent: '#72589a' },
  { id: 'rosemary',  name: 'Romero', botanical: 'Salvia rosmarinus', heightM: 1.5, spreadM: 1.5, habit: 'tuft', foliage: '#54715f', accent: '#6b76a8' },
  { id: 'thyme',     name: 'Tomillo', botanical: 'Thymus vulgaris', heightM: 0.35, spreadM: 0.6, habit: 'groundcover', foliage: '#70805d', accent: '#a783a8' },
  { id: 'sage',      name: 'Salvia', botanical: 'Salvia officinalis', heightM: 0.7, spreadM: 0.8, habit: 'tuft', foliage: '#77816f', accent: '#8068a5' },
  { id: 'lemonverbena', name: 'María Luisa', botanical: 'Aloysia citriodora', heightM: 2.5, spreadM: 2, habit: 'shrubby', foliage: '#7d9550', accent: '#e7e3ce' },
  { id: 'mint',      name: 'Hierbabuena', botanical: 'Mentha spicata', heightM: 0.6, spreadM: 1, habit: 'spreading', foliage: '#4f8347', accent: '#b6a3cd' },
  { id: 'santolina', name: 'Santolina', botanical: 'Santolina chamaecyparissus', heightM: 0.6, spreadM: 0.8, habit: 'rounded', foliage: '#8a9170', accent: '#d2b93c' },
  { id: 'agave',     name: 'Agave', botanical: 'Agave americana', heightM: 1.8, spreadM: 2.4, habit: 'rosette', foliage: '#5e8377' },
  { id: 'aloe',      name: 'Aloe', botanical: 'Aloe vera', heightM: 0.8, spreadM: 0.9, habit: 'rosette', foliage: '#5f8a62', accent: '#d66f32' },
  { id: 'pricklypear', name: 'Chumbera', botanical: 'Opuntia ficus-indica', heightM: 3, spreadM: 3, habit: 'pads', foliage: '#66864f', accent: '#c65b46' },
]);

/** Tipos del botón Flor. */
const FLOWER_TYPES = Object.freeze([
  /* Los ids históricos permanecen estables para que preferencias y escenas
     antiguas migren sin perder ejemplares. */
  { id: 'daisy',     name: 'Caléndula', botanical: 'Calendula officinalis', heightM: 0.5, spreadM: 0.5, habit: 'flower', foliage: '#687a4e', accent: '#df9c28' },
  { id: 'rose',      name: 'Rosa siempreverde', botanical: 'Rosa sempervirens', heightM: 1.5, spreadM: 1.2, habit: 'flower', foliage: '#4f7148', accent: '#f1eee2' },
  { id: 'tulip',     name: 'Estátice mediterráneo', botanical: 'Limonium sinuatum', heightM: 0.6, spreadM: 0.5, habit: 'flower', foliage: '#667956', accent: '#7c69a7' },
  { id: 'bed',       name: 'Macizo mediterráneo', botanical: 'Calendula officinalis + Rosa sempervirens + Limonium sinuatum', heightM: 0.7, spreadM: 4, depthM: 2.4, habit: 'bed', foliage: '#668052', accent: '#b56b8d' },
  { id: 'sunflower', name: 'Boca de dragón', botanical: 'Antirrhinum majus', heightM: 1, spreadM: 0.4, habit: 'flower', foliage: '#5f7c41', accent: '#c65c78' },
  /* Autóctonas y endémicas valencianas. Van juntas y al final para no alterar
     el orden que ya tenía el catálogo; la primera entrada de la lista sigue
     siendo la variante por defecto. */
  { id: 'seadaffodil', name: 'Lirio de mar', botanical: 'Pancratium maritimum', heightM: 0.5, spreadM: 0.45, habit: 'bulb', foliage: '#7d9a8e', accent: '#d8d1b8' },
  { id: 'snowbell', name: 'Campanilla valenciana', botanical: 'Acis valentina', heightM: 0.25, spreadM: 0.25, habit: 'bulb', foliage: '#5d7f4e', accent: '#dcd8c4' },
  { id: 'rockdragon', name: 'Boca de dragón de roca', botanical: 'Antirrhinum valentinum', heightM: 0.4, spreadM: 0.6, habit: 'rupicolous', foliage: '#6c7f5c', accent: '#e8dca0' },
  { id: 'silene', name: 'Silene de Ifach', botanical: 'Silene hifacensis', heightM: 0.45, spreadM: 0.4, habit: 'rupicolous', foliage: '#6e8168', accent: '#d99ab5' },
  { id: 'saladina', name: 'Limonio de Dufour', botanical: 'Limonium dufourii', heightM: 0.5, spreadM: 0.35, habit: 'rosette', foliage: '#7d8a6a', accent: '#9b86bd' },
  { id: 'trumpetdaffodil', name: 'Narciso trompón', botanical: 'Narcissus radinganorum', heightM: 0.3, spreadM: 0.25, habit: 'bulb', foliage: '#5f7f4c', accent: '#e0c23c' },
]);

/** Trepadoras: en planta se dibuja su banda de ocupación; el alzado enseña el
    soporte, la arquitectura de los tallos y la floración. */
const CLIMBER_TYPES = Object.freeze([
  { id: 'bougainvillea', name: 'Buganvilla', botanical: 'Bougainvillea glabra', heightM: 6, spreadM: 5, depthM: 0.6, habit: 'climber', foliage: '#4b7444', accent: '#c44188' },
  { id: 'jasmine', name: 'Jazmín', botanical: 'Jasminum officinale', heightM: 5, spreadM: 4, depthM: 0.5, habit: 'climber', foliage: '#3f714b', accent: '#f0ead2' },
  { id: 'vine', name: 'Parra', botanical: 'Vitis vinifera', heightM: 3, spreadM: 6, depthM: 0.8, habit: 'climber', foliage: '#5e7d42', accent: '#76557c' },
  { id: 'malvasia', name: 'Parra malvasía', botanical: 'Vitis vinifera \'Malvasía\'', heightM: 2.5, spreadM: 8, depthM: 5, habit: 'climber', foliage: '#6f8f4a', accent: '#ccd47d' },
  { id: 'wisteria', name: 'Glicinia', botanical: 'Wisteria sinensis', heightM: 8, spreadM: 6, depthM: 0.7, habit: 'climber', foliage: '#52734e', accent: '#7463a0' },
  { id: 'ivy', name: 'Hiedra', botanical: 'Hedera helix', heightM: 8, spreadM: 5, depthM: 0.4, habit: 'climber', foliage: '#365f42' },
  { id: 'climbingRose', name: 'Rosal trepador', botanical: 'Rosa spp.', heightM: 4, spreadM: 3, depthM: 0.6, habit: 'climber', foliage: '#477045', accent: '#c74f61' },
]);

/** Tipos del botón Decoración. */
const DECOR_TYPES = Object.freeze([
  { id: 'pot',      name: 'Maceta' },
  { id: 'well',     name: 'Pozo' },
  { id: 'can',      name: 'Regadera' },
  { id: 'stone',    name: 'Piedra' },
  { id: 'bench',    name: 'Banco' },
  { id: 'fountain', name: 'Fuente' },
  { id: 'sundial',     name: 'Reloj de sol' },
  { id: 'sundialWall', name: 'Reloj de sol de pared' },
  { id: 'pond',     name: 'Estanque' },
  { id: 'pool',     name: 'Piscina' },
  /* Las dos marcas que convierten un croquis en plano (v2.41.0). El nombre de
     la escala dice su unidad a propósito: las cifras no pueden ir dentro del
     dibujo —cada variante emite UNA sola etiqueta de texto, la suya— así que
     el rótulo que estampa `_labelled` es donde cabe decir cuánto mide cada
     tramo. La «N» del norte, por lo mismo, se dibuja con tres líneas. */
  { id: 'north',    name: 'Flecha de norte' },
  { id: 'scalebar', name: 'Escala gráfica (tramos de 1 m)' },
]);

/**
 * Tipos del botón Caminos.
 *
 * Son las cuatro combinaciones de sus dos ejes independientes: trazado
 * (serpenteante o recto) y acabado (liso o empedrado). Van como variantes de
 * catálogo y no como dos casillas del panel porque en esta sección la variante
 * manda: es la que elige la caja por defecto y la que da nombre a la etiqueta,
 * y una casilla no tendría ni lo uno ni lo otro.
 *
 * El camino tuvo su propio botón desde que fueron cuatro: dentro de Decoración
 * ocupaba la mitad del catálogo y tapaba el resto de piezas.
 */
const PATH_TYPES = Object.freeze([
  { id: 'path',              name: 'Camino' },
  { id: 'pathStraight',      name: 'Camino recto' },
  { id: 'pathPaved',         name: 'Camino empedrado' },
  { id: 'pathStraightPaved', name: 'Camino recto empedrado' },
]);

const TOOL_GROUPS = [
  /* «Mover» abre el sidebar: es la herramienta a la que se vuelve entre gesto y
     gesto —seleccionar, arrastrar, redimensionar— y estaba al final, después de
     tres grupos de creación. Este array es el orden que se pinta. */
  {
    label: 'Edición',
    tools: [
      { id: TOOLS.SELECT, icon: '👆', name: 'Mover', key: 'v' },
      // «Select» es SOLO selección: el clic selecciona cualquier elemento (con
      // la misma semántica de grupos que Mover) y el arrastre siempre dibuja
      // marquesina, incluso empezando ENCIMA de un elemento — el gesto que con
      // Mover lo movería. Nada se desplaza jamás con esta herramienta, así que
      // en un lienzo denso se puede enmarcar sin miedo. Sin atajo: las 26
      // letras y los 10 dígitos están cogidos (misma situación que Balcón).
      { id: TOOLS.PICK, icon: '⬚', name: 'Select' },
      // El Borrador vive aquí y no en «Dibujo»: no crea nada, quita lo que ya
      // está dibujado, que es lo mismo que hace el resto de este grupo.
      { id: TOOLS.ERASER, icon: '🧽', name: 'Borrador', key: 'e' },
    ],
  },
  {
    label: 'Dibujo',
    tools: [
      { id: TOOLS.PENCIL, icon: '✏️', name: 'Lápiz',    key: 'p' },
      // Junto al Lápiz porque es la otra herramienta a mano alzada: el grupo
      // va de lo libre a lo geométrico. Sin atajo, como «Select» y Balcón —
      // las 26 letras y los 10 dígitos están cogidos, y `f q d s` son
      // acciones de la flecha curva que se atienden ANTES que TOOL_KEYS.
      { id: TOOLS.AIRBRUSH, icon: '💨', name: 'Aerógrafo' },
      // El bote de pintura, junto a las otras dos que aplican color en vez de
      // dibujar una forma. Sin atajo por lo mismo que el Aerógrafo.
      { id: TOOLS.INK,    icon: '🪣', name: 'Tinta' },
      { id: TOOLS.LINE,   icon: '📏', name: 'Línea',    key: 'l' },
      { id: TOOLS.ARROW,  icon: '➡️', name: 'Flecha',   key: 'a' },
      { id: TOOLS.CURVE_ARROW, icon: '↷', name: 'Flecha curva', key: 'u' },
      { id: TOOLS.ARC,    icon: '◠', name: 'Semicírculo', key: 'g' },
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
      // Sin atajo, como Balcón, «Select» y el Aerógrafo: las 26 letras y los
      // 10 dígitos están asignados, y `f q d s` son acciones de la flecha
      // curva que se atienden ANTES que TOOL_KEYS.
      { id: TOOLS.STAR5,        icon: '★',  name: 'Estrella de 5 puntas' },
      { id: TOOLS.STAR6,        icon: '✶',  name: 'Estrella de 6 puntas' },
    ],
  },
  {
    // Justo detrás de Formas: el botón elige el REMATE y su catálogo la
    // sección, que son las mismas diez siluetas de arriba. Las cuatro entran
    // sin atajo por lo mismo que las estrellas.
    label: '3D',
    tools: [
      // Glifos monocromos, como los de Formas, y cada uno describe su figura
      // vista por el eje de fuga: dos cuadrados unidos es una extrusión, y un
      // cuadrado dentro de otro es literalmente la proyección de un tronco.
      { id: TOOLS.SOLID_PRISM,   icon: '⧉', name: 'Prisma' },
      { id: TOOLS.SOLID_PYRAMID, icon: '◭', name: 'Pirámide' },
      { id: TOOLS.SOLID_FRUSTUM, icon: '⧈', name: 'Tronco' },
      { id: TOOLS.SOLID_SPHERE,  icon: '◍', name: 'Esfera' },
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
    label: 'Edificios',
    tools: [
      { id: TOOLS.BUILD_PLANTA, icon: '▭',  name: 'Planta',         key: 'w' },
      { id: TOOLS.BUILD_FACADE, icon: '🏠', name: 'Fachada',        key: '1' },
      { id: TOOLS.BUILD_ROOF,   icon: '△',  name: 'Tejado',         key: '2' },
      { id: TOOLS.BUILD_DOOR,   icon: '🚪', name: 'Puerta',         key: '0' },
      { id: TOOLS.BUILD_WINDOW, icon: '🪟', name: 'Ventana',        key: 'y' },
      // Sin atajo: no queda ninguna tecla suelta libre —las 26 letras y los 10
      // dígitos están asignados, y `f q d s` las usan las acciones de flecha
      // curva—, así que entra igual que Caminos, Aromáticas y Trepadoras. `key` es
      // opcional; mejor sin atajo que pisando una acción existente.
      { id: TOOLS.BUILD_BALCONY, icon: '▥', name: 'Balcón' },
      { id: TOOLS.BUILD_WALL,    icon: '🧱', name: 'Muro y cancela' },
      { id: TOOLS.BUILD_FENCE,   icon: '╫',  name: 'Verjas' },
      { id: TOOLS.BUILD_GATE,    icon: '⚜',  name: 'Cancela' },
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
      // Sin atajo: `8 9 h x z` agotaron las teclas sueltas libres y ninguna de
      // las que quedan está sin uso. `key` es opcional; mejor sin atajo que
      // pisando una acción existente.
      { id: TOOLS.GARDEN_PATH,   icon: '〰️', name: 'Caminos' },
      { id: TOOLS.GARDEN_HERB,   icon: '🍃', name: 'Aromáticas' },
      { id: TOOLS.GARDEN_CLIMBER,icon: '🍇', name: 'Trepadoras' },
    ],
  },
];

/**
 * Muestras de color del panel. La rejilla (`.panel__color-grid`) es de SEIS
 * columnas, así que cada tramo de seis de este array es una fila visible: el
 * orden de aquí ES la maquetación, y por eso está agrupado en bloques de 6.
 *
 * Orden: primero la tinta y los neutros (por luminosidad, empezando por el
 * color por defecto), y a continuación los cromáticos **ordenados por tono
 * del arco iris** (rojo → naranja → amarillo → verde → turquesa → azul →
 * añil → violeta → rosa), primero los vivos y después los pasteles. Dentro de
 * un mismo tono va antes el más oscuro. Mantener ese criterio al añadir un
 * color: `tests/config-templates.test.js` comprueba que el tono no retrocede
 * dentro de cada bloque cromático.
 */
const COLORS = [
  // Tinta y neutros, de oscuro a claro. `#1a1a2e` es el color de creación por
  // defecto (`state.color` en app.js) y por eso abre la paleta.
  '#1a1a2e', '#16213e', '#0f3460', '#95a5a6', '#ecf0f1', '#ffffff',
  // Vivos · rojo → amarillo
  '#c0392b', '#e74c3c', '#d35400', '#e67e22', '#f39c12', '#f1c40f',
  // Vivos · lima → azul
  '#7cb342', '#27ae60', '#2ecc71', '#1abc9c', '#2980b9', '#3498db',
  // Vivos · añil → rosa
  '#3f51b5', '#533483', '#8e44ad', '#9b59b6', '#d63384', '#e94560',
  // Pasteles · rojo → verde
  '#ffb3ab', '#ffcdb2', '#ffe0a3', '#fdfd96', '#d0f0a0', '#b7e4c7',
  // Pasteles · turquesa → rosa
  '#a0e7e5', '#a8d8ea', '#b3c7f5', '#c7c3f0', '#dcc0ec', '#f6c3de',
];

/**
 * Aspectos de lienzo: papel + color de rejilla + rejilla sí/no, los tres de
 * una vez. Existen porque componerlos a mano son tres gestos, dos de ellos
 * dentro del diálogo de color del sistema, y el camino de vuelta pedía
 * recordar dos hexadecimales que no están escritos en ninguna parte de la
 * interfaz: en la práctica, quien ponía el lienzo en blanco no sabía volver.
 *
 * NO tocan el color de la tinta. Un aspecto describe el papel; el color con el
 * que se dibuja es otro mando. Consecuencia asumida: sobre «Pizarra» hay que
 * elegir un color claro en la paleta o no se ve el trazo.
 *
 * La PRIMERA entrada es el estado de fábrica y debe decir exactamente lo que
 * dicen DEFAULT_CANVAS_BG / DEFAULT_GRID_COLOR y el `showGrid` de
 * appDefaults() (app.js) — lo ata tests/config-templates.test.js, igual que la
 * primera de SKETCH_FONTS está atada a --font-sketch.
 *
 * «Blanco» guarda un `grid` que no dibuja: es lo que hace que encender la
 * casilla después dé una rejilla utilizable en lugar de blanco sobre blanco, y
 * lo que deja que «Blanco» y «Milimetrado» se diferencien SOLO por `showGrid`.
 */
const CANVAS_PRESETS = Object.freeze([
  { id: 'plano',       name: 'Plano',       bg: '#686f92', grid: '#fcfcfc', showGrid: true },
  { id: 'blanco',      name: 'Blanco',      bg: '#ffffff', grid: '#cdd3de', showGrid: false },
  { id: 'milimetrado', name: 'Milimetrado', bg: '#ffffff', grid: '#cdd3de', showGrid: true },
  { id: 'crema',       name: 'Crema',       bg: '#f7f1e3', grid: '#d9cdb4', showGrid: true },
  { id: 'pizarra',     name: 'Pizarra',     bg: '#1f2b2a', grid: '#4e6b66', showGrid: true },
]);

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

/* Comba con la que nacen las flechas curvas, en PORCENTAJE de la cuerda
   (v3.2.0). Hasta entonces era la constante 0.25 de CurvePath.defaultCtrl y
   por eso todas las curvas salían idénticas. El deslizador de #modal-stroke
   trabaja en enteros —de ahí el porcentaje— y su min/max deben coincidir con
   los de #stroke-modal-curve en index.html; lo pina tests/smoke.test.js.
   El 0 % es legítimo: una flecha curva sin comba es una recta, y es la manera
   de tener recta y punta con la misma herramienta. */
const CURVE_BULGE_MIN = 0;
const CURVE_BULGE_MAX = 100;
/** Paso del deslizador. 5 % se nota a simple vista y no obliga a hilar. */
const CURVE_BULGE_STEP = 5;

/** Tamaño mínimo al insertar un emoji, para que se lea como icono */
const EMOJI_MIN_SIZE = 32;

/** Tope del deslizador de tamaño del catálogo de emoji. Debe coincidir con el
    max de #emoji-modal-size en index.html — lo pina tests/smoke.test.js. */
const EMOJI_MAX_SIZE = 96;

/** Familia manuscrita del lienzo. La fuente de verdad es --font-sketch
    (scss/abstracts/_fonts.scss): cambiarla allí cambia también esto. El
    literal es el resguardo para el harness node:vm (sin getComputedStyle)
    y para una hoja de estilos que no cargó; tests/smoke.test.js comprueba
    que ambos dicen lo mismo. */
const SKETCHY_FONT = (() => {
  const FALLBACK = "'Architects Daughter', 'Segoe Print', 'Comic Neue', cursive";
  try {
    if (typeof getComputedStyle !== 'function' || !document.documentElement) return FALLBACK;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-sketch').trim();
    return v || FALLBACK;
  } catch (e) {
    return FALLBACK;
  }
})();

/**
 * Letras manuscritas que puede usar el lienzo. Las cinco viajan autoalojadas
 * en fonts/ (SIL OFL 1.1), así que elegir una no pide nada por red.
 *
 * `stack` es la pila COMPLETA, con los mismos resguardos del sistema que
 * $font-sketch: si el .woff2 no cargara (una copia incompleta del repo), el
 * lienzo sigue escribiendo a mano en vez de caer a una sans.
 *
 * La primera entrada es la de siempre y el valor por defecto; su `stack` debe
 * coincidir con --font-sketch (scss/abstracts/_fonts.scss), que es de donde
 * sale SKETCHY_FONT — lo ata tests/smoke.test.js, igual que exige un
 * @font-face por entrada.
 */
const SKETCH_FONTS = Object.freeze([
  { id: 'architects', name: 'Architects Daughter', google: true,
    stack: "'Architects Daughter', 'Segoe Print', 'Comic Neue', cursive" },
  { id: 'caveat', name: 'Caveat', google: true,
    stack: "'Caveat', 'Segoe Print', 'Comic Neue', cursive" },
  { id: 'patrick', name: 'Patrick Hand', google: true,
    stack: "'Patrick Hand', 'Segoe Print', 'Comic Neue', cursive" },
  { id: 'kalam', name: 'Kalam', google: true,
    stack: "'Kalam', 'Segoe Print', 'Comic Neue', cursive" },
  { id: 'indie', name: 'Indie Flower', google: true,
    stack: "'Indie Flower', 'Segoe Print', 'Comic Neue', cursive" },
  /* OpenDyslexic no es manuscrita: es la letra de la interfaz, elegida por
     legibilidad para lectores con dislexia, y está aquí para poder escribir
     TAMBIÉN el lienzo con ella —hasta ahora la accesibilidad se quedaba en la
     interfaz y el dibujo seguía en cursiva—. Dos diferencias que se derivan
     de eso: sus resguardos son los de la interfaz (si fallara, lo útil es una
     sans legible, no otra manuscrita), y `google` es falso porque NO está en
     Google Fonts: los exportados no pueden pedirla por URL (ver FONT_URL en
     exporter.js) y caen a esa misma pila. */
  { id: 'dyslexic', name: 'OpenDyslexic', google: false,
    stack: "'OpenDyslexic', 'Segoe UI', system-ui, sans-serif" },
  /* Montserrat Alternates tampoco es manuscrita: es una geométrica con formas
     alternativas, para bocetos de aire más tipográfico que dibujado. Sus
     resguardos son sans por lo mismo que los de OpenDyslexic —si fallara, lo
     coherente con su dibujo es otra geométrica, no una cursiva— pero sí está
     en Google Fonts, así que los exportados pueden pedirla. */
  { id: 'montserrat-alt', name: 'Montserrat Alternates', google: true,
    stack: "'Montserrat Alternates', 'Segoe UI', system-ui, sans-serif" },
]);

/**
 * Sombreados del texto. Tres, y bien distintos entre sí: al tamaño de un
 * boceto, variantes parecidas se ven iguales y sobran.
 *   · suave — desplazada y difuminada: profundidad discreta
 *   · dura  — desplazada sin difuminar: el cartel serigrafiado
 *   · halo  — sin desplazar y muy difuminada: resplandor alrededor, que es lo
 *             que hace legible un texto claro sobre un dibujo denso
 * `dx/dy/blur` van en píxeles de lienzo a tamaño 18 (el de referencia) y se
 * escalan con la letra en Renderer, para que la sombra de un título no sea la
 * misma manchita que la de una nota al pie.
 */
const TEXT_SHADOWS = Object.freeze([
  { id: 'none',  name: 'Sin sombra', dx: 0, dy: 0, blur: 0 },
  { id: 'soft',  name: 'Suave',      dx: 2, dy: 2, blur: 4 },
  // El desplazamiento de la dura es DELIBERADAMENTE pequeño: sin desenfoque
  // que la funda, una separación mayor deja de leerse como sombra y pasa a
  // leerse como la palabra escrita dos veces. Con 3 —el valor con el que nació
  // y que en un título de 44px se convierte en 7px— el efecto era exactamente
  // ese; comprobado en navegador comparando 3, 2, 1,5 y 1.
  { id: 'hard',  name: 'Dura',       dx: 1, dy: 1, blur: 0 },
  { id: 'glow',  name: 'Halo',       dx: 0, dy: 0, blur: 8 },
]);

/** Color por defecto de la sombra. Gris medio: sobre papel claro da relieve
    sin ensuciar, y sobre fondo oscuro sigue leyéndose. */
const DEFAULT_SHADOW_COLOR = '#7d8295';

/** Tamaño de letra para el que están medidos los dx/dy/blur de TEXT_SHADOWS. */
const SHADOW_REF_SIZE = 18;

/** Entrada de sombra por id (la primera —sin sombra— si no existe). */
function textShadowById(id) {
  return TEXT_SHADOWS.find(s => s.id === id) || TEXT_SHADOWS[0];
}

/* Letra manuscrita activa. Es MUTABLE a propósito: SKETCHY_FONT se calcula una
   sola vez al arrancar, así que sin esto elegir otra familia no habría podido
   cambiar nada ya dibujado. Todo lo que escribe en el lienzo —renderer,
   previsualizaciones, exportadores— pasa por sketchFont(), nunca por la
   constante, para que el cambio alcance hasta el último rótulo. */
let sketchFontStack = SKETCHY_FONT;

/** Pila tipográfica manuscrita en uso. */
function sketchFont() {
  return sketchFontStack;
}

/** Entrada del catálogo por id (la primera si no existe). */
function sketchFontById(id) {
  return SKETCH_FONTS.find(f => f.id === id) || SKETCH_FONTS[0];
}

/**
 * Cambia la letra manuscrita. Además de la pila que usa el lienzo, actualiza
 * --font-sketch: el editor de texto flotante es un <textarea> real y toma su
 * familia de esa custom property, así que sin esto escribirías con una letra
 * y verías otra en cuanto soltaras. Devuelve la entrada aplicada.
 */
function setSketchFont(id) {
  const font = sketchFontById(id);
  sketchFontStack = font.stack;
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--font-sketch', font.stack);
    }
  } catch (e) { /* sin DOM (harness node:vm): basta con la pila */ }
  return font;
}

/** Default dimensions when a UI component is placed with a tiny drag */
const UI_DEFAULTS = {
  [TOOLS.BUTTON]:            { w: 120, h: 40 },
  [TOOLS.INPUT]:             { w: 220, h: 36 },
  [TOOLS.IMAGE_PLACEHOLDER]: { w: 200, h: 150 },
  [TOOLS.NAV]:               { w: 600, h: 50 },
  [TOOLS.CARD]:              { w: 220, h: 280 },
};
