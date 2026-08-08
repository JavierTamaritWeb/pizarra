# Changelog

Los cambios notables de Pizarra se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

## [2.0.0] — 2026-08-08

Salto de versión mayor: consolida el cambio de stack de desarrollo iniciado en
la 1.25.0 — estilos en **SCSS (BEM) compilados con Gulp 5 + dart-sass**, fuente
en `src/`, publicable minificado en `dist/` y toolchain de stylelint/terser. La
app en runtime sigue siendo la misma (cero dependencias, clonar y abrir), pero
la forma de desarrollarla ya no: `css/styles.css` es un artefacto y editarlo a
mano está vetado.

### Corregido

- **Los nombres del sidebar ya no se parten por dentro de la palabra ni pisan
  su icono.** «Rectángulo» salía como «Rectán / gulo» y los nombres de varias
  líneas se montaban sobre el icono: el `overflow-wrap: anywhere` partía por
  cualquier carácter y el botón tenía altura fija y 52px de ancho para
  palabras que en OpenDyslexic miden 58. El botón pasa a 6.8rem con
  `min-height`, sin letter-spacing en el nombre; los anchos del sidebar
  (72/132px) no cambian. Ver `BUGS.md`.
- `.panel__select` usaba `var(--text-main)`, que no existe (la real es
  `--text-primary`): la declaración se descartaba en silencio y el `<select>`
  heredaba el color del padre. Era el fix aparte que dejó programado la
  migración a SCSS de v1.25.0. Ver `BUGS.md`.
- El export HTML interpolaba la familia tipográfica (`SKETCHY_FONT`, leída de
  `--font-sketch`) sin sanear dentro de su `<style>`; era la única
  interpolación del exporter sin defensa. Ahora `FONT_CSS` descarta `<>{};`
  (no se puede cerrar la etiqueta ni inyectar reglas) y `FONT_FALLBACK`
  descarta también `<>&` para los atributos XML del SVG. Ver `BUGS.md`.

### Tests

- Guardia general nueva en `tests/smoke.test.js`: **toda custom property usada
  en `css/styles.css` está definida** — un `var()` con nombre equivocado no
  falla en ningún sitio por sí solo.
- Guardia en `tests/exporter.test.js`: una `--font-sketch` envenenada no puede
  cerrar el `<style>` del HTML exportado (config.js se carga con un
  `getComputedStyle` manipulado).
- Guardia e2e en `responsive.spec.js`: en ambos modos del sidebar, ningún
  nombre desborda su caja, invade su icono ni se sale del botón.
- `BUGS.md` y `CHANGELOG.md` normalizados a markdownlint (líneas en blanco
  alrededor de títulos y listas; `.markdownlint.json` nuevo con `MD024
  siblings_only` para los títulos repetidos del formato Keep a Changelog);
  sin cambios de contenido. Cache-busting (`?v=`), insignia del topbar y
  badges del README sincronizados con la versión. **399 unitarios + 26 e2e.**

## [1.25.0] — 2026-08-08

### Cambiado

- **Los estilos se desarrollan en SCSS (BEM) y se compilan con Gulp 5 +
  dart-sass.** El antiguo `css/styles.css` monolítico pasa a ser un artefacto
  generado desde `src/scss/` — 18 ficheros que respetan el orden literal del
  original: un parcial por bloque BEM con sus propias media queries, más
  `abstracts/` con los tokens de diseño (`_variables.scss`), las tipografías
  (`_fonts.scss`), los breakpoints y los mixins. El CSS compilado **sigue
  commiteado en la misma ruta**, así que clonar y abrir `index.html` funciona
  igual que siempre y la app conserva sus **cero dependencias en runtime**;
  Node solo hace falta para desarrollar. La equivalencia con el CSS anterior
  se verificó con un diff normalizado que resuelve los valores computados:
  mismas 141 reglas, mismo resultado.
- **Todas las distancias de la interfaz están ahora en `rem`, con 1rem =
  10px** (raíz al 62.5%, `body` restaura los 16px efectivos): si se sube el
  tamaño de fuente del navegador, la interfaz escala con él — mejora real de
  accesibilidad. Los breakpoints de las media queries y las coordenadas del
  lienzo (px de canvas, fijadas por JS) se quedan en px a propósito.
- **Las tipografías se cambian en un único sitio:**
  `src/scss/abstracts/_fonts.scss` declara `$font-ui` y `$font-sketch`, de ahí
  salen las custom properties del CSS, y ahora también el lienzo:
  `SKETCHY_FONT` (config.js) lee `--font-sketch` en runtime (con su literal
  como resguardo para el harness de tests) y `FONT_FALLBACK` (exporter.js) se
  deriva de ella sin comillas para los atributos XML del SVG exportado. Antes
  la misma familia estaba escrita 4 veces en 3 ficheros con 3 sintaxis.
- **La interfaz usa OpenDyslexic**, una tipografía diseñada para lectores con
  dislexia, en lugar de IBM Plex Sans. Va **autoalojada** en `fonts/`: cuatro
  woff2 (Regular, Bold, Italic y BoldItalic) generados con fontTools a partir
  de los OTF oficiales aportados por el usuario — familia clásica derivada de
  Bitstream Vera, con su licencia al lado — así que funciona sin red y
  abriendo por `file://`. Sus `@font-face` viven en
  `src/scss/base/_font-faces.scss` y el `<link>` de Google Fonts queda solo
  para Architects Daughter, la manuscrita del lienzo. Como OpenDyslexic es
  más ancha, las etiquetas de la barra estrecha parten ahora las palabras
  largas en dos líneas («Semicírculo» se recortaba por los lados).

### Añadido

- **La app fuente vive en `src/`**: `src/scss/` (estilos) y `src/js/` (los
  14 módulos, movidos desde la raíz; `index.html` apunta ahora a
  `src/js/*.js`). `index.html` se queda en la raíz — el harness de tests,
  Playwright y el «clonar y abrir» lo anclan ahí.
- **`dist/`, el publicable minificado**: `npm run build` deja en `dist/` la
  app lista para desplegar — LICENSE tal cual, index.html con las rutas
  `src/js/` aplanadas a `js/` (la única transformación de HTML que existe),
  el CSS recompilado comprimido (24K → 16K) y el JS minificado con terser
  (396K → 172K) conservando nombres de fichero. Va sin versionar: se
  regenera cuando se necesita. Los `src/js/` no se transforman nunca en el
  árbol fuente — son los que leen el harness de tests y el navegador en
  desarrollo.
- **Toolchain de desarrollo**: Gulp 5 (`build`/`build:css`/`watch:css`) con la
  API moderna de Sass —sin plugins intermedios, sin sourcemaps, sin
  autoprefixer, salida determinista—, terser para el `dist/` y stylelint
  (`stylelint-config-standard-scss` con el patrón de clases ajustado a BEM y
  notación de color legacy a propósito, para no reescribir el CSS heredado).

### Tests

- Guardia nueva en `smoke.test.js`: `css/styles.css` debe ser el artefacto
  compilado (banner), conservar la convención `1rem = 10px`, las custom
  properties responsive (`--sidebar-w` 7.2/13.2rem), las cuatro media queries,
  los selectores vendor sin agrupar y — la clave — **la familia de
  `--font-sketch` idéntica al resguardo de `SKETCHY_FONT`**, porque en
  navegador una divergencia sería invisible para el harness. Verificada
  contra el código roto (cambiar la familia solo en el CSS la tumba).
  **397 unitarios + 25 e2e.**
- Conocido (fix aparte): `.panel__select` usa `var(--text-main)`, que no
  existe. Se migró tal cual para que esta versión no cambie ni un byte de
  comportamiento; corregirlo lleva su propia entrada en BUGS.md.

## [1.24.0] — 2026-08-08

### Cambiado

- **La inclinación del camino se marca de un clic, no manteniendo Shift.** El
  ángulo libre llegó en la v1.23.0 atado a Shift+arrastrar, que es un gesto de
  **dos manos**: quien solo puede usar una se quedaba fuera de la función
  entera. Ahora es un ajuste pegajoso, **«Cualquier inclinación»**, con casilla
  en el propio catálogo de Camino y gemela en el panel «Jardín», que se
  recuerda entre sesiones. Shift sigue valiendo, pero como atajo opcional para
  inclinar un camino suelto sin tocar la casilla.

### Añadido

- **El ancho del camino se cambia desde el propio catálogo.** Con el camino
  inclinado el arrastre ya no deja lado corto que leer, así que el ancho solo
  puede venir del deslizador — y estaba únicamente en el panel, que por debajo
  de 1100px ni siquiera se ve (es un cajón). Ahora hay un gemelo dentro del
  modal de Camino, junto a una **miniatura en vivo** que enseña el ancho y la
  inclinación activos antes de dibujar nada, siguiendo el patrón de Fachada.
  Los iconos del catálogo siguen pintándose en modo caja a propósito: distinguen
  el trazado (serpenteante/recto, liso/empedrado), no el ángulo.
- **El ángulo se ve mientras dibujas.** Con la inclinación libre, el ángulo es
  lo único que decide el gesto y nada lo decía: acertar una diagonal concreta
  era a ojo. Ahora sale rotulado junto al puntero durante el arrastre (0° a la
  derecha, positivo hacia arriba), y desaparece al soltar — vive en la capa de
  previsualización, así que no es un elemento ni entra en el dibujo. En modo
  caja no aparece: ahí el camino solo puede salir a 0° o 90°.

### Tests

- Cuatro guardias nuevas en `app-interaction.test.js`: el trazado en diagonal
  sin tocar el teclado (y su persistencia en prefs), el ancho cambiado desde el
  modal llegando al camino inclinado, el reparto correcto entre iconos (modo
  caja) y miniatura (inclinada), y el rótulo del ángulo —presente a 45°, ausente
  en modo caja—. Verificadas contra el código roto: ignorar el ajuste pegajoso
  tumba tres, quitar el `opts` propio del catálogo tumba la del catálogo, y
  tanto no pintar el rótulo como pintarlo siempre tumban la del ángulo.
  **396 unitarios + 25 e2e.**

## [1.23.0] — 2026-08-07

### Añadido

- **El camino puede trazarse en cualquier ángulo.** Por defecto, el arrastre
  de Camino sigue leyéndose como caja —el lado largo es el recorrido y el
  corto, el grosor, tal cual desde v1.21.0—. Manteniendo pulsado **Shift**
  durante el arrastre, el recorrido pasa a ser el vector exacto del gesto, a
  cualquier inclinación; como ya no queda lado corto que leer, el grosor sale
  en ese modo del ajuste **«Ancho del camino»** del panel, igual que ya
  ocurría con un clic o una línea recta. El mecanismo reutiliza el mismo
  patrón que `curveFlip` (Shift durante el trazado de una flecha curva):
  `state.pathFreeAngle` se fija en los mismos tres puntos del gesto y se
  reinicia al soltar, para que el catálogo de Camino no herede el ángulo del
  último arrastre en sus iconos. De propina, el aplastamiento de los cantos
  del empedrado (`rx`/`ry`) pasa de un `if` horizontal/vertical a una fórmula
  continua: en ángulo libre no hay un salto visible justo a 45°, y ahí los
  cantos salen casi redondos.

### Tests

- Seis guardias nuevas en `garden.test.js` (dirección exacta a varios
  ángulos, el ancho lo manda `pathWidth` y no un lado corto inexistente, el
  clic sin arrastrar no cambia con el flag, los cantos siguen cabiendo entre
  los bordes en diagonal, y el redondeo del empedrado en diagonal) y dos en
  `app-interaction.test.js` (el gesto real con Shift frente a sin Shift, y que
  el modo libre no se filtra a los iconos del catálogo al reabrirlo). El
  helper `tests/helpers/load-app.js` ahora expone `context.Garden` y el resto
  de `KNOWN_GLOBALS` (vía `loadScript`, igual que `loadAll()`), necesario para
  la segunda guardia. **392 unitarios + 25 e2e.**

## [1.22.1] — 2026-08-07

### Arreglado

- **«Limpiar todo» reinicia el tamaño del borrador.** El botón ya devolvía el
  fondo, la cuadrícula, el solapamiento y el zoom a sus valores por defecto,
  pero olvidaba `state.eraserSize`: si se había cambiado el tamaño del
  borrador, seguía con ese valor tras limpiar en vez de volver a 16px.

### Tests

- Guardia en `app-interaction.test.js` para el reinicio del tamaño del
  borrador al pulsar «Limpiar todo». **384 unitarios + 25 e2e**.

## [1.22.0] — 2026-08-07

### Añadido

- **Modal de tamaño del borrador.** Elegir la herramienta Borrador abre un
  modal con una previsualización más grande del círculo real y su propio
  deslizador, igual que Planta o Balcón abren su catálogo al elegirlos; un
  botón ⚙ junto al slider "Tamaño del borrador" del panel lo reabre sin
  soltar la herramienta. Ambos controles quedan sincronizados, como los
  gemelos de Edificios. A diferencia de los catálogos, cerrarlo no devuelve a
  la herramienta anterior: el borrador ya es usable con el tamaño que tenga.

### Cambiado

- **El borrador recorta recta, flecha y trazo a mano en vez de borrarlos
  enteros.** Pasar el borrador por el centro de una línea, o justo por donde
  se cruzan dos trazos, ya solo se lleva el tramo bajo el círculo: lo demás
  sobrevive partido en tantos trozos como haga falta. Una flecha solo sigue
  siendo flecha en el trozo que conserva su punta original; cualquier otro
  trozo pasa a línea suelta, sin inventar una punta en el corte. El resto de
  tipos (formas, texto, imágenes, componentes, curvas) sigue el borrado
  entero de siempre — recortar el contorno de una forma o una curva Bézier
  de forma exacta queda fuera de alcance.

### Tests

- Cobertura de `Eraser.erase()`: recorte de recta y flecha (con y sin doble
  punta), trazo con hueco en medio, la intersección de dos trazos que ya no
  se borra entera, y que el resto de tipos sigue eliminándose entero.
  Gestos reales en `app-interaction.test.js` para el recorte y para el modal
  de tamaño. **383 unitarios + 25 e2e**.

## [1.21.0] — 2026-08-07

### Cambiado

- **El grosor del camino vuelve al ratón.** El arrastre se lee otra vez como
  caja: el lado largo es el recorrido y el corto, el grosor, así que moviendo el
  ratón arriba o abajo el camino engorda mientras se dibuja. Es la única forma
  de sacar las dos cosas de un solo gesto —un arrastre da dos datos, y el
  tercero tendría que venir de una tecla o de un segundo paso—, y por eso
  **se revierte el trazado en diagonal** que estrenó la 1.19.0: entre las dos,
  el grosor a mano pesa más.
- El **ancho del camino** del panel pasa a ser lo que dice su nombre: el ancho
  por defecto, el que se usa cuando el arrastre no lo da (un clic o una línea
  recta). El que sale del arrastre no se acota: ahí se ve exactamente lo que se
  dibuja.
- **El empedrado gana hileras al ensanchar el camino, en vez de piedras más
  gordas.** Con dos hileras fijas, un camino de 90 px salía con cantos de medio
  metro y se leía como una hilera de globos; ahora entra una hilera por cada
  17 px de ancho, con el total acotado para que un camino de punta a punta no
  suelte cientos de piezas.

### Tests

- Las guardias de camino se reescriben para la caja: el recorrido por el lado
  largo, el grosor creciendo al bajar el ratón, el ancho del panel como
  reserva, los cantos entre los bordes en los dos sentidos y a cualquier ancho,
  y la nueva —más cantos, no más gordos—. **365 unitarios + 25 e2e**.

## [1.20.0] — 2026-08-07

### Añadido

- **Ancho del camino**, en el panel «Jardín» (8–120 px). Al pasar el arrastre a
  ser el recorrido (1.19.0) desapareció el lado corto de la caja, que era de
  donde salía el ancho: el camino quedó sin forma de ensancharse o estrecharse.
  Es un default de creación, como el resto de la sección, y **se recuerda entre
  sesiones**. El número sigue al dedo mientras se mueve el slider, y si hay un
  camino en curso la previsualización se actualiza en el momento.

### Tests

- 4 guardias nuevas: el ancho pedido es el que separa los bordes, se acota a
  los topes, se conserva a cualquier inclinación, y el rango del slider coincide
  con el que aplica `js/garden.js` (que ahora lo exporta justo para poder
  compararlo). Más la del panel: mueve el control, dibuja y comprueba que el
  camino sale con ese ancho y que vuelve puesto al recargar. **366 unitarios +
  25 e2e**.

## [1.19.0] — 2026-08-07

### Añadido

- **Los caminos del Jardín se trazan en cualquier inclinación.** El arrastre ya
  no es una caja: **es el recorrido**, así que el camino sale en la dirección
  del gesto —vertical, horizontal o en cualquier diagonal— en vez de limitarse
  a los dos ejes. Un sendero de jardín cruza en diagonal tan a menudo como en
  horizontal. Un clic sin arrastrar sigue dando el camino vertical por defecto.

### Cambiado

- El ancho del camino pasa a ser una fracción acotada de su recorrido (antes lo
  daba el lado corto de la caja, que ya no existe): un sendero largo no sale
  como un hilo ni uno corto como una plaza.
- Los iconos del catálogo de Caminos se dibujan en diagonal, que es justo lo que
  la herramienta hace.
- Sigue habiendo **una sola geometría**, no una por orientación: se calcula en
  coordenadas de camino y se gira al lienzo, de modo que el empedrado comparte
  con los bordes la misma y única onda a cualquier ángulo.

### Tests

- Las guardias de camino pasan a barrer varios ángulos (0°, 90°, 30°, −45°,
  135°, 180°, −120°): la dirección y el sentido de los bordes, el giro completo
  del serpenteante y —la más valiosa— que los cantos siguen cabiendo entre los
  bordes sea cual sea la inclinación. Un signo suelto en la normal es invisible
  en horizontal y las tumba en cuanto se gira. **362 unitarios + 25 e2e**.

## [1.18.1] — 2026-08-07

### Cambiado

- **Los caminos del Jardín nacen en vertical** y, sobre todo, **corren por el
  eje largo del arrastre**: arrástralo a lo alto y el sendero baja; a lo ancho,
  cruza. Antes el recorrido estaba clavado en la horizontal, así que un
  arrastre alto daba un camino aplastado dentro de una caja que no le
  correspondía. En un plano de jardín un sendero baja tan a menudo como cruza.
  El icono del catálogo, que es la geometría real, lo refleja.
- La geometría sigue siendo **una sola**: se calcula en coordenadas de camino
  (fracción del recorrido × desvío del eje) y se lleva al lienzo con un
  mapeador, de modo que el empedrado sigue compartiendo con los bordes la misma
  y única onda.

### Tests

- 2 guardias nuevas: el camino sigue el eje largo del arrastre (recto y
  serpenteante) y los cantos caben entre los bordes también en vertical —el
  gemelo en el otro eje de la guardia que ya existía—. **362 unitarios + 25
  e2e**.

## [1.18.0] — 2026-08-07

Nueva herramienta **Balcón** en la sección Edificios, con 8 tipos.

### Añadido

- **Balcón** (sección Edificios): barandilla arriba y losa volada abajo, en
  alzado como la puerta y la ventana. Ocho tipos en su catálogo — **de
  barrotes, francés, de forja, balaustrada, corrido, acristalado, terraza y
  mirador**—, cada uno con su propia proporción al hacer clic sin arrastrar (un
  mirador nace alto; un balcón corrido, largo). Como el resto de la sección es
  **solo de creación**: cada arrastre produce rect/line/circle/curveArrow
  corrientes, así que exportación, undo, JSON y selección de grupo funcionan sin
  código específico.
- Su catálogo estrena en Edificios el patrón del Jardín: **el icono es el dibujo
  real** que sale al arrastrar, pintado por la misma geometría, así que no puede
  desincronizarse de la herramienta.
- El tipo elegido **persiste en las preferencias**, como los otros cinco de la
  sección.

### Cambiado

- La tabla de modales de variante (`VARIANT_MODALS` en `app.js`) deja de ser
  exclusiva del Jardín: ahora describe también el catálogo del Balcón, con el
  módulo generador y el constructor de opts como campos. Los cinco catálogos
  antiguos de Edificios siguen con su icono SVG a mano, a propósito: no son
  uniformes entre sí y su comportamiento no está fijado por tests.
- **Balcón no tiene atajo de teclado**, como Caminos y Aromáticas: las 26 letras
  y los 10 dígitos ya estaban asignados, y `F Q D S` las usan las acciones de
  flecha curva. Queda fijado por un test para que el hueco no crezca por
  descuido.

### Tests

- 13 guardias nuevas: geometría de los ocho tipos, la panza de la forja, las
  ménsulas del corrido, cajas por variante, ningún rect degenerado en balcones
  diminutos, «dos tipos nunca se dibujan igual» (la misma guardia que el
  jardín), el catálogo del modal y la persistencia del tipo elegido.
  **360 unitarios + 25 e2e**.

## [1.17.1] — 2026-08-07

Auditoría severa del código completo: **19 defectos corregidos**, cada uno con
su entrada en `BUGS.md` y su guardia de regresión probada contra el código
roto (14 tests nuevos en `tests/`, 4 en `e2e/`).

### Corregido

- **Atajos y foco.** Cambiar un `<select>` del panel («Solapamiento»,
  «Plantas»…) dejaba muertos todos los atajos hasta clicar en otro sitio;
  `Shift+R` sobre una selección sin formas rotables activaba Rectángulo y
  perdía la selección; `?` abría la Ayuda apilada sobre otro modal; y `Ctrl+V`
  pegaba clones detrás de un modal abierto cambiando además la herramienta.
- **Historial de undo.** Elegir color de relleno arrastrando por el diálogo
  nativo apilaba un paso por cada tono pisado (podía vaciar el historial de un
  gesto), y mantener pulsado `+`/`−`/`F`/`Q`/`D`/`S` sobre una curva apilaba
  ~30 pasos por segundo. Ahora todo gesto es un único paso, como el grosor y
  la opacidad.
- **Selección de flechas.** Las esquinas del bbox de una flecha seleccionada
  eran handles de resize invisibles: clicar en espacio vacío junto a una
  esquina escalaba la flecha en vez de deseleccionar.
- **Borrador.** El interior de una forma rellena contaba como tinta por su
  caja, no por su silueta: la esquina del bbox de un círculo relleno lo
  borraba desde ~15 px de distancia de cualquier tinta. Y un polígono
  degenerado (tamaño cero, llegado de datos externos) era imborrable.
- **Dibujo.** Un rectángulo redondeado menor de 24 px salía autointersecado
  (el radio no se acotaba al lado); el círculo del borrador quedaba fantasma
  en el overlay al cambiar de herramienta por teclado; y la previsualización
  del modo cadena ignoraba «Ajustar a cuadrícula» aunque el commit sí snapeaba.
- **Exportación.** El HTML exportado perdía el orden de capas entre vectores y
  componentes (toda flecha quedaba debajo de todo card); un color `#rrggbbaa`
  importado rompía los tintes de botones/inputs/cards en canvas y en los
  exports (fondos negros en SVG); la validación del import aceptaba `w/h ≤ 0`
  y `fontSize ≤ 0` (elementos que se veían en canvas y desaparecían del
  SVG/HTML); y un fallo de lectura del archivo dejaba el import colgado sin
  avisar. La validación endurecida se verificó contra 4.740 elementos de todas
  las variantes de Edificios y Jardín: cero rechazos, ningún proyecto guardado
  pierde piezas.
- README: Caminos también es herramienta sin atajo, no solo Aromáticas.

### Herramientas

- Eliminado el código muerto del export (`'eraser'` inalcanzable en
  `VECTOR_TYPES`/`_svgElement`) y la copia duplicada de `distToSegment` en
  `app.js` (ahora delega en `Eraser.distToSegment`).
- El stub de `FileReader` del arnés sabe simular un fallo de lectura
  (`{ error: true }`).
- Suites: **347 tests unitarios** y **25 e2e**.

## [1.17.0] — 2026-08-07

### Añadido

- **Botón «Caminos» en el Jardín, con cuatro trazados.** El camino tiene ahora
  dos ejes independientes: puede ser **serpenteante o recto** y **liso o
  empedrado**, en sus cuatro combinaciones. El empedrado son cantos irregulares
  a matajunta que siguen exactamente la ondulación de los bordes, con el tamaño
  que manda el ancho del camino —como en un empedrado de verdad—, así que un
  camino largo lleva más piedras, no piedras más grandes.
- Los caminos **salen de «Decoración» a su propio botón**: siendo cuatro,
  ocupaban la mitad de aquel catálogo y tapaban el resto de piezas. Sin atajo de
  teclado, como Aromáticas: las teclas sueltas libres están agotadas y ninguna
  de las que quedan puede usarse sin pisar una acción de flecha curva.
- **Reloj de sol** en Decoración, en sus dos formas: **de suelo** (sobre su
  pedestal, con la corona horaria y el gnomon apuntando al norte) y **de pared**
  (colgado de un muro, con el cuadrante abierto hacia el sur). Como todo el
  Jardín, en vista de planta.
- **Parcela cuadrada** en «Forma del jardín». Es la única variante que impone su
  proporción: toma el lado menor del arrastre y se centra en él, sin salirse
  nunca de lo que se marcó.

### Cambiado

- La guardia *"dos variantes nunca se dibujan igual"* compara también la
  **proporción**, no solo qué piezas hay: la parcela cuadrada lleva exactamente
  las mismas que la rectangular y aun así son dos opciones distintas de un
  vistazo. Sin eso, la primera variante que se eligiera por su forma habría
  hecho saltar el test sin haber nada roto.

### Herramientas

- **Suite end-to-end en un navegador real** (`e2e/`, Playwright): 21 tests que
  cubren lo que el arnés `node:vm` no puede ver por definición —layout, CSS,
  foco y acciones por defecto del navegador—. Casi todos son entradas de
  `BUGS.md` que hasta ahora decían *"verificación manual"*: el alcance del
  scroll con zoom, el editor de texto con zoom ≠ 100 %, el cajón del panel por
  debajo de 1100 px, los modales a 320 px, `Ctrl+Z` después de tocar el panel,
  los atajos con un modal abierto y el auto-ajuste del lienzo. Se ejecuta con
  `npm run test:e2e` (`npm run e2e:install` la primera vez).
- La aplicación **sigue sin dependencias**: `package.json` y `node_modules`
  existen solo para esa suite. `index.html` no ha cambiado y se sigue abriendo
  en el navegador tal cual.

## [1.16.1] — 2026-08-07

### Corregido

- **«Limpiar todo» dejaba el lienzo pequeño en vez de como al abrir la app.**
  En pantallas anchas el lienzo se ajusta solo para aprovechar el espacio, pero
  el botón forzaba el zoom al 100% y dejaba márgenes vacíos alrededor. Peor: lo
  marcaba como elección manual del usuario, así que el ajuste automático se
  quedaba desactivado el resto de la sesión y redimensionar la ventana ya no
  volvía a encajarlo. Ahora limpiar rehace el mismo ajuste que hace arrancar la
  app, que es lo que el botón promete.

## [1.16.0] — 2026-07-25

### Añadido

- **Almendro y algarrobo** en el catálogo de Árbol (Jardín), que pasa de 6 a 8
  especies. Como el resto, en vista de planta y con silueta propia: el almendro
  es una copa clara y abierta con la flor marcada en la periferia; el algarrobo,
  una copa ancha, densa y festoneada con su sombra dentro. El algarrobo nace
  además más grande por defecto (124×112), porque hace copa ancha.
- **Nuevo botón «Aromáticas»** en Jardín, con las matas aromáticas de siempre
  (lavanda, romero, tomillo, salvia, santolina) y las mediterráneas de porte
  arquitectónico (agave, aloe, chumbera). En planta, una roseta de hojas
  puntiagudas no se parece en nada a una mata redonda, y por eso viven aparte.
  Es el **único botón sin atajo de teclado**: `8 9 H X Z` agotaron las teclas
  sueltas libres y las que quedan ya hacen otra cosa.
- **Arbusto** suma los leñosos mediterráneos: **adelfa**, **boj recortado** y
  **lentisco** (de 4 a 7 tipos).
- El jardín queda en **40 variantes** repartidas en seis catálogos.

## [1.15.0] — 2026-07-25

### Añadido

- **Sección «Jardín»** en el sidebar, después de Edificios: cinco herramientas
  que dibujan **en vista de planta** (cenital, como un plano de paisajismo).
  Como las de Edificios, son **solo de creación** —producen `rect`/`line`/
  `circle`/`curveArrow`/`text` corrientes, ningún tipo de elemento nuevo—, así
  que render, exportación, undo, JSON y bounds funcionan sin código específico.
  - **Jardín** (`8`): parcela rectangular, redonda, en L u orgánica, con
    textura de césped en trazo fino.
  - **Árbol** (`9`): frondoso, conífera, palmera, olivo, frutal y ciprés.
  - **Arbusto** (`H`): mata redonda, seto, macizo y topiario.
  - **Flor** (`X`): margarita, rosa, tulipán, parterre y girasol.
  - **Decoración** (`Z`): maceta, pozo, regadera, piedra, banco, fuente,
    estanque y camino.
- **Etiqueta de texto** en cada pieza con el nombre de su tipo, dentro del mismo
  grupo (se mueve, duplica y borra con ella). Se apaga con la casilla
  «Etiquetas» de la sección **Jardín** del panel, y la elección se recuerda.
- Los **iconos de los catálogos son el dibujo real**: los pinta la propia
  geometría de `js/garden.js` sobre un `<canvas>`, con el mismo par
  (`Garden.elements` + el pintor de previsualización) que usa el arrastre. No
  pueden desincronizarse de lo que crea la herramienta.
- Cada pieza nace con el **tamaño propio de su tipo**: un seto y un camino
  salen alargados, una flor suelta menuda.

### Corregido

- **La previsualización del arrastre no dibujaba las curvas encadenadas.**
  `drawBuildingPreview` leía `cx`/`cy` de nivel superior, que una curva
  encadenada no tiene, y `quadraticCurveTo(undefined, …)` no hace nada ni avisa.
  Ninguna herramienta de Edificios las emite, así que nunca se había visto; las
  siluetas orgánicas del jardín sí. Ahora recorre `CurvePath.segments`, dibuja
  también los elementos `text` —delegando en el renderer de verdad, para no
  tener una segunda copia de la fuente y el interlineado— y se llama
  `drawPiecesPreview`, que es lo que hace.
- `pickVariant` (arnés de tests) resolvía mal el id del modal, así que elegir
  una variante desde un test no hacía nada. No lo usaba ningún test todavía.

### Corregido tras probarlo en el navegador

Tres cosas que **pasaban todos los tests** y solo se ven usando la aplicación:

- **«Frondoso» y «Olivo» se dibujaban igual.** Cada variante se comprobaba por
  separado y ninguna prueba comparaba una con sus hermanas. El olivo motea
  ahora el follaje en vez de marcar ramas, y un test nuevo compara la firma de
  todas las variantes de un mismo catálogo.
- **El césped se leía como flechas «↓».** Tres briznas que salen del mismo
  punto con la central más larga forman una punta de flecha. Ahora cada brizna
  arranca de su sitio, y el número de matas se deduce del área (una parcela
  grande salía con cuatro matas en fila).
- **El arbusto «Macizo» salía como un rombo.** Su tabla de lóbulos alternaba
  radio alto y bajo en ocho puntos: eso es simetría de orden 4.

### Notas

- Los atajos del jardín son `8 9 H X Z`, las cinco teclas sueltas que quedaban
  libres. Un test nuevo impide que una herramienta reutilice `F`, `Q`, `D` o `S`:
  esas ya actúan sobre las flechas curvas y se comprueban antes, así que la
  colisión sería intermitente y muda.

## [1.14.1] — 2026-07-25

Ajustes salidos de probar la aplicación en un navegador real.

### Corregido

- **Pulsar `1` para abrir Fachada cambiaba «Plantas» a 1.** El atajo de
  herramienta no cancelaba la tecla, así que seguía viva y la recibía el primer
  control que el diálogo enfoca: el `<select>` de Plantas la interpretaba como
  su type-ahead. Ahora el atajo hace `preventDefault` y el foco va al botón de
  la vista activa —que además es la acción principal: Enter la confirma— en vez
  de a un campo del formulario.
- **El borrador se llevaba figuras enteras al barrer por su hueco.** Usaba la
  caja del elemento, así que una sola pasada por el centro de una fachada
  borraba el muro completo. Ahora **se borra lo que se ve**: en formas sin
  relleno solo cuenta su contorno (el rectángulo vacío se borra por el borde, no
  por el hueco; el círculo por el aro, no por la esquina de su caja). Si la
  forma está rellena, el interior también es tinta y sigue contando; el texto,
  las imágenes y los componentes de UI se borran por su caja, porque ahí la caja
  sí es el dibujo.

## [1.14.0] — 2026-07-25

### Cambiado

- **El borrador elimina de verdad.** Hasta ahora no borraba: añadía al lienzo una
  *máscara* que tapaba lo que había debajo. Como la máscara se queda fija en su
  sitio, al mover el dibujo lo "borrado" salía de debajo y **reaparecía**; además
  seguía viajando dentro del JSON exportado. Ahora la pasada quita los elementos
  que toca y no deja nada en la escena. El criterio de alcance es el mismo del
  clic de selección ampliado por el radio: **si un clic ahí seleccionaría el
  elemento, el borrador ahí lo elimina**. Los elementos desaparecen ya mientras
  barres, así que lo que ves durante el gesto es el resultado; cada pasada sigue
  siendo un único paso de deshacer, y una que no toca nada no ensucia el
  historial.
- **Compatibilidad:** los proyectos guardados antes de esta versión conservan sus
  máscaras y se ven exactamente igual — se siguen renderizando y exportando como
  siempre, y el borrador nuevo no las retira (quitarlas haría reaparecer justo lo
  que ocultan). Lo que cambia es que la herramienta ya no crea ninguna.

### Interno

- Nuevo `js/eraser.js` (`Eraser`): geometría pura de "qué toca el trazo", con
  distancia segmento-segmento y detección de cruce. Recibe por inyección lo que
  vive fuera (bounds, muestreo de curvas, vértices de polígonos y trapecios), así
  que es testeable sin DOM. Suite de **253 → 273** pruebas.

## [1.13.1] — 2026-07-25

### Corregido

- **Lo dibujado sobre un edificio quedaba inalcanzable.** Con un edificio
  seleccionado, su marco combinado cubre todo su interior y se tragaba cualquier
  clic dentro: la puerta o la ventana que pusieras encima no se podían
  seleccionar, **arrastrarlas movía el edificio entero** dejándolas quietas, y
  **Supr borraba el edificio** en lugar del elemento pulsado (por lo que lo que
  creías haber borrado seguía apareciendo). Ahora, si el punto cae sobre un
  elemento ajeno a la selección, gana ese elemento; arrastrar el grupo desde un
  hueco de su marco y **Alt+clic** para aislar una pieza siguen funcionando.
- **El tipo de puerta y de ventana no se podía elegir al crear una fachada.**
  La fachada ya los respetaba, pero solo se fijaban desde las herramientas
  Puerta y Ventana, que cambian de herramienta y sacan del flujo. El modal de
  Fachada incorpora ahora ambos selectores, junto a la miniatura, que se repinta
  al cambiarlos. El de puerta se atenúa en la vista *De lado*, que no lleva.

### Interno

- **`js/app.js` pasa a ser testeable.** Nuevo arnés (`tests/helpers/dom-stub.js` +
  `load-app.js`) que construye el DOM desde el `index.html` real y ejecuta la
  app entera bajo `node:vm`; los tests lanzan gestos de verdad (pointer, teclado,
  clics de modal) y leen el resultado del autosave, sin ningún hook de test en
  producción. Cierra el hueco que `PLAN.md §6` daba por inevitable. Suite de
  **245 → 253** pruebas, con `tests/app-interaction.test.js` cubriendo los dos
  fallos anteriores y la sincronización panel ↔ modal.

## [1.13.0] — 2026-07-25

### Añadido

- **Miniatura en vivo en el modal de Fachada**: se repinta con cada ajuste, así
  que ya no hay que dibujar-deshacer-repetir para ver el efecto. No es un dibujo
  aparte: usa la misma geometría que la previsualización del arrastre, de modo
  que no puede divergir de lo que se acaba dibujando.
- **Los ajustes de Edificios, junto a la elección de vista**: plantas, ventanas
  por planta, pendiente y cubierta están ahora también **dentro** del modal de
  Fachada, sincronizados en ambos sentidos con el panel lateral (que sigue
  existiendo). Antes vivían solo en el panel, que en pantallas ≤1100 px es un
  cajón oculto.
- **Previsualización al pasar el puntero**: señalar una vista la muestra en la
  miniatura sin elegirla; al salir vuelve la seleccionada.
- Los ajustes que la vista elegida **ignora se atenúan** (la fachada plana no
  tiene cubierta ni pendiente; el perfil lleva siempre la suya trapezoidal).

### Cambiado

- Las tres vistas de Fachada pasan a **lenguaje llano** —*De frente*, *Con
  tejado*, *De lado*— con el término de arquitecto (*Fachada plana*, *Alzado*,
  *Perfil*) como subtítulo: quien no es arquitecto no sabía cuál elegir.
- **Todas** las variantes de Edificios se recuerdan entre sesiones. Antes solo
  persistían plantas, vanos, pendiente y cubierta: la huella de Planta, la vista
  de Fachada, la forma de Tejado y el tipo de Puerta y Ventana se reseteaban al
  recargar, así que media configuración sobrevivía y media no.

### Corregido

- El botón **«Alzado (2 aguas)» dibujaba otra cubierta**: la forma real la fija
  `roofType`, así que con *Cuatro aguas* o *Mansarda* la etiqueta mentía. El
  nombre ya no promete una forma y el icono dibuja el faldón realmente activo.
- La vista de **Perfil dibujaba la puerta principal centrada**, repitiendo los
  huecos de la fachada frontal. Un canto lateral no tiene el acceso principal:
  ahora va sin puerta y con las plantas acompasadas.

### Interno

- `buildOpts()` centraliza los opts de `Building.elements` para sus tres
  consumidores (preview del arrastre, commit y miniatura), que antes los
  duplicaban; `syncBuildControls()` es el único punto que reparte el estado a
  los dos juegos de controles. Suite de **241 → 245** pruebas, con guardias
  nuevas para el perfil sin puerta, los textos del catálogo y la coherencia
  entre los controles gemelos del panel y el modal.

## [1.12.0] — 2026-07-24

### Añadido

- **Fachadas ricas**: Fachada, Alzado y Perfil dibujan sus huecos con el **tipo de
  Puerta y Ventana elegido** en los modales (antes siempre usaban los básicos).
  Elige *Óculo* o *Ventana de arco* y la fachada los coloca; igual con la puerta
  (arco, doble, paneles, garaje).
- **Panel de opciones de Edificios**: controla el **nº de plantas**, las
  **ventanas por planta**, la **pendiente** y la **cubierta del alzado** en vez de
  deducirlo solo del arrastre. Son defaults de creación y se recuerdan entre
  sesiones.
- **Sidebar de Edificios más compacto**: **Fachada/Alzado/Perfil** se unifican en
  un botón **Fachada** (modal con 3 vistas: plana, alzado frontal, perfil lateral)
  y los **tejados** en un botón **Tejado** (modal), igual que Puerta/Ventana — de
  9 botones a 5. Dos tejados nuevos: **cuatro aguas** y **mansarda**, disponibles
  también como cubierta del Alzado.
- **Agrupación de edificios**: cada edificio se crea como una **unidad** — un clic
  lo selecciona entero y se mueve, duplica o borra de una vez; **Alt+clic** aísla
  una pieza. El clon de un edificio es un grupo independiente.

### Corregido

- La **previsualización del óculo** no mostraba el círculo al arrastrar; ahora sí,
  y la preview respeta el trazo fino del detalle.
- **Cancelar** (Cerrar/Escape/clic-exterior) un modal de Planta/Puerta/Ventana sin
  elegir variante **restaura la herramienta anterior** (antes quedaba "a medias").
- Los **modales** ya no desbordan en pantallas estrechas (~320 px) y hacen scroll.
- El icono de **Perfil** se distingue del de Alzado; la **cornisa** deja de
  solaparse con el tejado en Alzado/Perfil.

### Interno

- Unificado el arco de puerta/ventana (`_arched`) y extraído el alféizar (`_sill`)
  en `js/building.js`; nuevo campo `buildingGroupId` validado en `isValidElement`
  y preservado en el round-trip JSON. Suite de **231 → 241** pruebas.

## [1.11.0] — 2026-07-24

### Añadido

- Más **tipos de puerta** en el modal (de 4 a **8**): además de *Puerta*,
  *Puerta de arco*, *Marco* y *Marco de arco*, ahora **Puerta doble** (dos hojas
  con montante central y tiradores), **Puerta de paneles** (dos paneles
  rehundidos), **Puerta de garaje** (lamas horizontales) y **Marco doble**
  (marco con montante central, sin hoja).
- Más **tipos de ventana** en el modal (de 4 a **8**): además de *Ventana*,
  *Ventana de arco*, *Marco* y *Marco de arco*, ahora **Ventana de 2 hojas**
  (montante central + travesaño), **Ventana cuadrícula** (parteluces adaptativos),
  **Óculo** (ventana redonda con cruz) y **Marco redondo** (solo el aro).
- Todos son herramientas SOLO de creación: reutilizan tipos ya existentes
  (`rect`/`line`/`circle`/`curveArrow`), por lo que render, exportación
  (PNG/JPG/SVG/HTML), undo y JSON siguen funcionando sin código específico.
  El óculo usa el tipo `circle`; el detalle (paneles, lamas, parteluces) va a
  trazo fino (`_lineT`/`_rectT`).

### Interno

- Iconos SVG nuevos en `doorIcon`/`windowIcon` (app.js) para las tarjetas del
  modal, construidos con `createElementNS` (nunca `innerHTML`).
- La guardia de regresión `tests/building.test.js` gana 6 pruebas de geometría
  para los tipos nuevos y sus bucles de render recorren `DOOR_TYPES`/`WINDOW_TYPES`
  automáticamente: la suite pasa de 225 a **231** pruebas.

## [1.10.0] — 2026-07-24

### Añadido

- Nueva sección de barra lateral **Edificios** para bocetar el exterior de un
  edificio: **Planta** (`w`) con selector de huella en modal (rectangular, en L,
  en U con jardín, claustro); **Fachada** (`1`), **Alzado** (`x`) y **Perfil**
  (`h`) son fachadas multiplanta con **ventanas por planta y puerta en la baja**
  (el número de plantas se deduce de la altura del arrastre); y tejados a
  **dos aguas** (`2`), a **un agua** (`8`) y **plano** (`9`).
  Son herramientas SOLO de creación —como Semicírculo y Emoji—: producen
  elementos de tipos ya existentes (`line`, `rect`), sin introducir ningún tipo
  nuevo, por lo que render, selección, exportación (PNG/JPG/SVG/HTML), undo y
  JSON funcionan sin código específico.
- Fachadas con **ventanas verticales** (montante en cruz + alféizar) y **puerta**
  con dintel en la planta baja, **cornisa** e impostas; **Alzado** con cubierta a
  dos aguas (alero volado, tejas, cumbrera y chimenea) y **Perfil** con cubierta
  trapezoidal de cumbrera horizontal (silueta distinta); **tejas** en todos los
  tejados. Diseño basado en un estudio de alzado (plano de arquitecto); el detalle
  se dibuja a trazo fino y el contorno al trazo del usuario.
- Botón **Puerta** (`0`) con **modal de tipo** (como el de Planta): *Puerta*
  (dintel de abanico + junta), *Puerta de arco* (**arco de medio punto** —un
  `curveArrow` de arco que comba hacia arriba— con **altura ajustable** por el
  arrastre), *Marco* (rectangular) y *Marco de arco* (arco + jambas + umbral,
  sin imposta ni hoja).
- Botón **Ventana** (`y`) con **modal de tipo** análogo: *Ventana* (montante en
  cruz + alféizar), *Ventana de arco* (arco de medio punto), *Marco* (rectangular)
  y *Marco de arco* (arco + jambas, sin partición).
- Módulo `js/building.js` (global `Building`) con la geometría pura y su guardia
  de regresión `tests/building.test.js` (19 pruebas).

### Interno

- `CREATION_ONLY_TOOLS` (exporter.js) excluye las herramientas de Edificios de
  `ELEMENT_TYPES`, evitando elementos fantasma al importar un JSON manipulado.
- El comando de test documentado pasa a `node --test tests/*.test.js`: la forma
  con directorio (`node --test tests/`) omite un archivo bajo el glob de Node 22.x.

## [1.9.0] — 2026-07-24

### Añadido

- Botones **Cuadrado** (`4`) y **Trapecio** (`7`) en la barra de Formas.
  El cuadrado se crea regular desde el centro; el trapecio isósceles se crea
  por esquinas y admite proporciones libres.
- Rotación discreta de 45° para cuadrados y de 90° para trapecios, siempre
  alrededor del centro de la forma.
- Ambas formas admiten selección por su silueta real, redimensionado,
  relleno sólido o translúcido, bordes ocultos y exportación completa a PNG,
  JPG, SVG, HTML y JSON.
- 9 pruebas de configuración, geometría, rotación, renderizado,
  solapamiento, validación y exportación: la suite pasa de 197 a 206 pruebas.

## [1.8.1] — 2026-07-24

### Añadido

- **Tamaño del borrador independiente**, regulable de 4 a 100 px y con
  16 px por defecto. Al activar el Borrador, el control de Trazo cambia de
  nombre, rango y valor sin modificar el grosor del lápiz o de las formas.
- Indicador circular sobre el lienzo que representa el área exacta del
  borrador antes y durante cada pasada.
- La preferencia del tamaño se conserva entre sesiones. Los proyectos
  anteriores, que solo almacenaban `lineWidth`, mantienen su aspecto
  histórico usando automáticamente cuatro veces ese grosor.

### Corregido

- El **Borrador** ya no perfora el color de fondo ni la cuadrícula: elimina
  únicamente los elementos dibujados, por lo que deja de verse como una
  mancha oscura o transparente. App y exportación raster comparten ahora el
  mismo orden de composición, y el resultado se muestra en tiempo real
  mientras se arrastra en vez de utilizar un trazo rojo provisional.
- SVG y HTML aplican los borrados con máscaras vectoriales secuenciales:
  dejan de simularlos con una línea blanca y respetan fondos, tamaños y
  elementos creados después de cada pasada.
- Los recursos CSS y JavaScript incluyen la versión en su URL para impedir
  que el navegador reutilice archivos antiguos tras actualizar.
- 5 guardias nuevas o ampliadas de render, tamaño, importación, caché,
  solapamiento y exportación: la suite pasa de 192 a 197 pruebas.

## [1.8.0] — 2026-07-24

### Añadido

- **Rotación discreta de formas** desde el panel o con `Shift+R`: cada
  triángulo, rectángulo o rectángulo redondeado gira 90°, cada pentágono 36°
  y cada hexágono 30° alrededor de su propio centro. La acción admite
  multi-selección y un único paso de undo.
- La orientación de los polígonos se conserva en autoguardado, portapapeles,
  JSON, SVG, HTML, PNG y JPG; el giro de rectángulos se representa
  intercambiando sus dimensiones.
- 6 pruebas de pasos, centro, normalización, inmutabilidad y conservación de
  lados: la suite pasa de 186 a 192.

## [1.7.0] — 2026-07-24

### Añadido

- **Triángulo, pentágono y hexágono regulares** en la barra de Formas, con
  atajos `3`, `5` y `6`. El arrastre parte del centro y el redimensionado
  conserva un contenedor cuadrado para que todos los lados sigan siendo
  iguales.
- Los nuevos polígonos admiten relleno sólido/translúcido, detección por su
  silueta real, bordes ocultos y exportación PNG, JPG, SVG, HTML y JSON.
- 9 pruebas de geometría, renderizado, solapamiento, validación y exportación:
  la suite pasa de 177 a 186.
- **Flechas curvas encadenadas**: un click sin arrastrar inicia la cadena,
  cada click fija un nuevo tramo y `Ctrl`/`Cmd`+click confirma el último y
  coloca la punta final. `Retroceso`, `Esc` y `Enter` permiten corregir,
  cancelar o terminar la construcción.
- Edición de controles y puntos de unión, inversión de giro/dirección,
  anclaje de extremos y exportación completa a PNG, JPG, SVG, HTML y JSON
  para las cadenas.
- 8 pruebas nuevas de geometría, continuidad, renderizado, validación,
  exportación y round-trip JSON: la suite pasa de 169 a 177.

### Cambiado

- En pantallas de más de 1200 px, la barra lateral amplía su ancho y organiza
  todas las herramientas en dos columnas; hasta 1200 px conserva la
  disposición compacta de una columna.

## [1.6.0] — 2026-07-24

### Añadido

- **Relleno sólido o translúcido regulable** para círculo/elipse, rectángulo y
  rectángulo redondeado: el checkbox "Relleno translúcido" alterna el modo y
  un nuevo slider permite ajustar la opacidad del 0 al 100 % (40 % por
  defecto). Ambos siguen la semántica dual del panel: con selección editan
  las formas seleccionadas (un paso de undo por gesto); sin selección fijan
  los valores de las próximas formas.
- Los campos `fillTransparent` y `fillOpacity` se conservan en los cinco
  formatos de exportación (PNG/JPG vía render, SVG, HTML y JSON). Las formas
  translúcidas antiguas sin `fillOpacity` mantienen el 40 %, y las formas sin
  `fillTransparent` se ven igual que antes.
- **Dos modos globales de solapamiento**: "Normal" mantiene la mezcla actual y
  "Bordes ocultos" dibuja discontinuos solo los tramos del contorno inferior
  cubiertos por rectángulos, redondeados o círculos/elipses superiores. El
  cálculo usa la geometría real y el orden de capas, se actualiza en vivo y
  se conserva en autoguardado, JSON y los cinco formatos de exportación.
- 16 tests nuevos (render, geometría, z-order, export SVG/HTML, validación y
  round-trip): la suite pasa de 153 a 169.

## [1.5.0] — 2026-07-23

### Cambiado

- **La aplicación pasa a llamarse Pizarra también en la interfaz**: el
  wordmark de la barra superior y el `<title>` de la pestaña decían todavía
  "SketchWire", mientras que el README ya usaba Pizarra desde la 1.1.1.
- Las claves de `localStorage` (`sketchwire.autosave`, `sketchwire.prefs`) y
  el marcador del portapapeles (`sketchwire/elements`) **conservan el nombre
  antiguo a propósito**: renombrarlas dejaría huérfanos el lienzo y las
  preferencias ya guardados de cada usuario. Queda anotado en el código y en
  `CLAUDE.md`.
- **"Limpiar todo" devuelve también el zoom al 100 %** (además de vaciar el
  lienzo y restaurar los colores). El 100 % se mantiene aunque después se
  redimensione la ventana: la limpieza cuenta como una elección explícita de
  zoom, así que el auto-ajuste no vuelve a agrandarlo por su cuenta.

### Corregido

- **La herramienta Texto no creaba nada.** Al hacer click en el lienzo, el
  editor se abría y se cerraba en el mismo instante (el `focus()` síncrono se
  perdía por el cambio de foco por defecto del `pointerdown`, y el `blur`
  disparaba el commit en vacío), así que era imposible escribir texto nuevo;
  editar un texto existente con doble click sí funcionaba y ocultaba el
  problema. Ver `BUGS.md`.
- **Correcciones de una auditoría de errores** (detalladas en `BUGS.md`):
  - Colocar un texto y hacer click para poner otro **ya no descarta el
    primero** ni deja el editor nuevo cerrado.
  - Tras usar un control del panel (trazo, zoom, color, checkbox), los atajos
    y `Ctrl+Z`/`C`/`V` **vuelven a funcionar** sin tener que hacer click en el
    lienzo: el control suelta el foco al terminar de ajustarlo.
  - Con un **modal abierto**, las teclas de herramienta, `Supr` y los atajos
    ya no tocan el lienzo de detrás.
  - Los botones **"Duplicar/Eliminar selección"** vuelven a ocultarse cuando
    no hay selección (una regla CSS los mostraba siempre).
  - En ventanas **≤1100px** el panel derecho ya no desaparece: pasa a ser un
    **cajón deslizable** (botón `⚙ Panel`), así color/trazo/zoom/relleno
    siguen accesibles.
  - Anclar **los dos extremos de una flecha al mismo elemento** ya no la
    colapsa a longitud cero.
  - **Importar JSON** limpia la selección; el **nudge con la tecla mantenida**
    es un único paso de undo; **soltar un archivo fuera del lienzo** ya no
    saca de la app; y el validador de import rechaza los pseudo-tipos
    `arc`/`emoji`.
  - **Gestos de puntero robustos**: `pointercancel` cierra cualquier gesto a
    medias (resize/marquee incluidos), un segundo dedo en táctil se ignora en
    vez de corromper el trazo, y los atajos de teclado se ignoran mientras
    hay un gesto en curso (borrar/deshacer a mitad de un resize ya no corrompe
    el estado).
  - Confirmar una **edición de texto sin cambios** ya no consume un paso de
    undo ni vacía el redo, y **hacer click en el padding de un modal** ya no
    lo cierra (solo el click fuera del cuadro).

### Añadido

- **Pestaña de Ayuda**: nuevo botón `❔ Ayuda` en la barra superior (y tecla
  `?`) que abre un panel con todos los atajos y trucos, agrupados por tema
  (general, selección y portapapeles, formas y relleno, emoji, flechas y
  curvas, semicírculos) y con las teclas resaltadas. Sustituye a la lista
  apretada del pie del panel derecho, que quedaba recortada y era ilegible;
  ahí queda solo un recordatorio de que `?` abre la ayuda.
- **Insertar emoji**: nueva herramienta `🙂 Emoji` (tecla `J`) en el grupo UI.
  Al elegirla se abre un catálogo de 60 emoji agrupados en cinco categorías
  (caras, estado, flechas, objetos y datos); tras escoger uno, cada click en
  el lienzo lo estampa centrado en el punto pulsado. Volver a pulsar la
  herramienta permite cambiar de emoji.
- El emoji se inserta como un elemento **`text` normal** (su `value` es el
  carácter), así que selección, movimiento, redimensionado, duplicado,
  undo, autoguardado y los cinco formatos de exportación funcionan sin
  código específico. También puede editarse con doble click como cualquier
  texto, lo que permite escribir cualquier emoji fuera del catálogo.
- Se inserta al tamaño del texto con un mínimo de 32 px (`EMOJI_MIN_SIZE`)
  para que se lea como icono; el slider "Texto" lo controla por encima de
  ese mínimo.
- 8 tests nuevos (catálogo sin duplicados, atajos de herramienta únicos,
  validación y export SVG/HTML/JSON del emoji): la suite pasa de 144 a 152.

## [1.4.0] — 2026-07-23

### Añadido

- **Rellenar formas con color**: las formas geométricas (rectángulo,
  redondeado y círculo) admiten un color de relleno propio (`fillColor`),
  elegible desde la nueva sección "Relleno" del panel. Hasta ahora el
  relleno solo podía decidirse **antes** de dibujar y siempre era un tinte
  translúcido del color del trazo; ahora se puede rellenar una forma **ya
  creada** seleccionándola y eligiendo el color.
- El relleno se conserva en los cinco formatos de exportación (PNG/JPG vía
  el render, SVG, HTML y JSON) y `fillColor` se valida como hex en el
  import, igual que `color`, por ser un valor que se interpola en los
  exports SVG/HTML.

### Cambiado

- El **zoom llega hasta el 300 %** (antes 200 %). Los límites viven ahora en
  `ZOOM_MIN`/`ZOOM_MAX` en app.js, que acotan `applyZoom` y el auto-ajuste,
  en lugar de estar repetidos a mano.

### Corregido

- **Con zoom > 100 % ya se puede llegar a todo el lienzo.** El desbordamiento
  por la izquierda y por arriba quedaba fuera del área scrollable (un
  `transform: scale` no cambia la caja de layout), así que al 200 % había
  ~960 px inalcanzables y al 300 % más de 2000. Ahora un `.canvas-area__sizer`
  ocupa en layout el tamaño ya escalado y el lienzo se ancla arriba a la
  izquierda, de modo que el scroll cubre el lienzo entero. Ver `BUGS.md`.
- El checkbox **"Rellenar formas"** pasa a tener la semántica dual del resto
  de controles del panel: **con selección** rellena o vacía las formas
  seleccionadas (un único paso de undo); **sin selección** fija el default
  de creación, como antes. Vaciar una forma conserva su color de relleno,
  así que volver a marcarla lo recupera en vez de perderlo.
- Elegir un color de relleno activa el relleno automáticamente (el checkbox
  sigue siendo la forma de quitarlo).
- **Compatibilidad**: una forma sin `fillColor` se sigue pintando con el
  tinte translúcido del trazo, así que los proyectos guardados antes de esta
  versión se ven exactamente igual.
- 9 tests nuevos (render, export SVG/HTML, validación y round-trip JSON del
  relleno con color): la suite pasa de 134 a 144.

## [1.3.0] — 2026-07-23

### Añadido

- **Colores personalizables del lienzo**: nueva sección "Lienzo" en el panel
  derecho con selectores de color para el **fondo** y la **cuadrícula**.
  `Renderer.drawGrid` acepta ahora un color base (antes fijo), con la línea
  menor y la mayor distinguidas por opacidad en vez de por un segundo color
  fijo. Las preferencias se guardan en `localStorage` y sobreviven a recargar
  la página.
- El botón **"Limpiar todo"** devuelve el fondo y la cuadrícula a su color
  original (además de vaciar el lienzo), y borra la preferencia guardada.

### Cambiado

- **Lienzo más grande y aprovechamiento de pantalla**: el padding alrededor
  del lienzo baja de 24 a 12 px, y el zoom se auto-ajusta al cargar la página
  (y al redimensionar la ventana) al mayor valor que quepa en el espacio
  disponible, sin bajar nunca del 100 % — en pantallas estrechas se comporta
  igual que antes (scroll si hace falta) y en pantallas anchas crece solo.
  Tocar el slider de zoom a mano desactiva este auto-ajuste.
- 1 test nuevo (color de cuadrícula personalizado) y el test de `drawGrid`
  actualizado al nuevo esquema de color único + opacidad: la suite pasa de
  133 a 134.

## [1.2.1] — 2026-07-23

### Cambiado

- **Mover la multi-selección en grupo desde cualquier punto de su marco**:
  con varios elementos seleccionados, el arrastre puede empezar también en
  el espacio vacío dentro del recuadro combinado (antes había que acertar
  sobre un trazo y, si no, la selección se perdía). Shift+click conserva el
  toggle, el click fuera del marco sigue deseleccionando/iniciando marquee,
  y el movimiento en grupo sigue siendo un único paso de undo con snap a
  cuadrícula al soltar.

## [1.2.0] — 2026-07-23

### Añadido

- **Copiar y pegar la selección** con `Ctrl/Cmd+C` y `Ctrl/Cmd+V`: funciona
  con uno o varios elementos (Shift+click, marquee o `Ctrl/Cmd+A`), pega con
  desplazamiento de 20 px, activa la herramienta Mover y deja lo pegado
  seleccionado para encadenar pegados o arrastrar.
- El payload viaja por el portapapeles del sistema, así que el pegado
  funciona **entre pestañas** y tras recargar. Al pegar se regeneran ids y
  semillas, y las flechas ancladas se re-vinculan a los clones si su destino
  también se copió (misma lógica que "Duplicar", ahora compartida en
  `insertClones`).
- Lo pegado pasa por el mismo validador que el import JSON; un portapapeles
  manipulado no puede inyectar elementos inválidos.

### Cambiado

- El pegado de imágenes PNG/JPG con `Ctrl/Cmd+V` se mantiene: los elementos
  propios tienen prioridad y, si no los hay, se intenta la imagen. Dentro de
  campos de texto, copiar/pegar siguen siendo los nativos del navegador.

## [1.1.1] — 2026-07-23

### Cambiado

- El proyecto pasa a presentarse como **Pizarra** en el README.
- Se amplía la documentación con instrucciones de clonación y ejecución, un
  flujo básico de uso, detalles del autoguardado y atajos multiplataforma.
- La versión visible en la aplicación y la insignia del README quedan
  sincronizadas en `1.1.1`.

## [1.1.0] — 2026-07-23

### Añadido

- **Herramienta Semicírculo** (`◠`, tecla `G`): dibuja arcos de 180° exactos
  y sin puntas de flecha. El arrastre fija el diámetro, así que cada trazo
  puede tener un radio distinto.
- Ajuste de **radio** de un semicírculo seleccionado con `+`/`−` (paso de
  5 px; `Shift`: 1 px) o arrastrando su handle turquesa — siempre conservando
  la media circunferencia perfecta (el centro del diámetro no se mueve).
- Tecla **`Q`**: convierte una flecha curva seleccionada en semicírculo
  (pierde la punta) y viceversa (la recupera).
- `js/arc.js` (`ArcMath`): geometría pura de arcos circulares — ajusta una
  Bézier cúbica al arco (error radial ≤ 1,7 % del radio, invisible bajo el
  trazo sketchy). Los semicírculos son elementos `curveArrow` normales con
  `arc: true`, por lo que exportación (PNG/JPG/SVG/HTML/JSON), selección,
  undo y conectores funcionan sin código específico.
- `heads: 'none'` en flechas: trazo sin punta en ningún extremo (usado por
  los semicírculos y validado en el import JSON).
- 10 tests nuevos (geometría de arcos, validación y export sin puntas):
  la suite pasa de 123 a 133.

### Cambiado

- La punta de las flechas curvas al desactivar un semicírculo con `Q` se
  restaura al valor por defecto (una punta).
- El checkbox "Doble punta" ignora los semicírculos (nunca llevan punta).

## [1.0.0] — 2026-07-22

Estado inicial versionado: dibujo sketchy determinista, componentes UI,
flechas curvas (cuadráticas y en S) con conectores anclados, etiquetas sobre
el trazo, plantillas, undo/redo, autoguardado, exportación PNG/JPG/SVG/HTML/
JSON con import validado y suite de 123 tests sin dependencias.
