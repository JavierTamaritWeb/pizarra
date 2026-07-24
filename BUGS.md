# BUGS.md — Registro de errores corregidos

Registro de bugs encontrados y corregidos en Pizarra, para que no se repitan.
Cada entrada indica el síntoma, la causa raíz, dónde se arregló y su
**guardia de regresión**: el test automático que falla si el bug vuelve, o
—cuando el código vive en `js/app.js`, que requiere DOM real y por eso queda
fuera del arnés `node:vm` de `tests/` (ver `CLAUDE.md`)— los pasos de
verificación manual que hay que repetir antes de tocar esa zona.

Al corregir un bug nuevo, añade aquí una entrada con el mismo formato y, si
el código es testable, el test que lo prueba (regla completa en `CLAUDE.md`).

---

## Cubiertos por tests automáticos

### El Borrador perforaba el fondo y parecía pintar una mancha oscura
- **Síntoma:** al borrar sobre el lienzo, el trazo podía verse transparente
  u oscuro y también desaparecía la cuadrícula, dando la impresión de que la
  herramienta no funcionaba.
- **Causa:** `redrawNow()` pintaba fondo y cuadrícula antes que los elementos;
  el `destination-out` del borrador eliminaba por tanto las tres capas.
- **Fix:** `Renderer.renderScene()` compone primero los elementos sobre
  transparencia y añade después cuadrícula y fondo con `destination-over`.
  La app y los exports raster usan ahora el mismo flujo. Mientras se arrastra,
  `redrawNow()` incorpora un borrador temporal a la escena para mostrar el
  resultado real en vivo, sin añadir pasos extra al undo. El tamaño se guarda
  en `eraser.size` y es independiente del trazo normal; los elementos antiguos
  sin ese campo conservan `lineWidth × 4`. Los bordes ocultos cuyo render se
  difiere hasta una forma superior se recortan geométricamente con cualquier
  borrador intermedio para que no reaparezcan después.
- **Guardia:** `tests/sketchy-renderer.test.js` › *"renderScene: el borrador
  elimina contenido sin perforar fondo ni cuadrícula"*.

### El borrador corrompía PNG/JPG (agujero transparente / mancha negra)
- **Síntoma:** exportar a PNG dejaba agujeros transparentes donde se había
  borrado; en JPG salían manchas negras (la transparencia se compone sobre
  negro en `toDataURL('image/jpeg')`).
- **Causa:** el trazo de borrador usa `globalCompositeOperation:
  'destination-out'`, que perfora también el fondo blanco ya pintado.
- **Fix:** `js/exporter.js` (`_renderClean`) usa el mismo
  `Renderer.renderScene()` que la aplicación y compone el blanco con
  `destination-over` después de renderizar los elementos.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.png: repinta fondo
  blanco con destination-over tras renderizar (eraser)"*.

### SVG/HTML simulaban el borrador con una línea blanca
- **Síntoma:** un trazo borrado con el borrador volvía a aparecer en el SVG
  y el HTML exportados o quedaba cubierto de blanco aunque el fondo fuese
  diferente.
- **Causa:** SVG no implementa `destination-out` como Canvas y se aproximaba
  cada borrado con un `<path>` blanco.
- **Fix:** `js/exporter.js` crea máscaras SVG secuenciales: cada borrador
  recorta únicamente los elementos anteriores, usa su tamaño real y deja el
  fondo fuera de la máscara. HTML utiliza una escena SVG única cuando existe
  algún borrado para mantener el mismo orden de capas.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.svg: eraser usa máscara
  con su tamaño real y conserva el fondo"* y *"Exporter.html: con borrador
  usa una escena SVG única y una máscara real"*.

### Import JSON malformado rompía toda la app
- **Síntoma:** importar un JSON con `elements` no-array, un `pencil` sin
  `points` o coordenadas en string hacía fallar `redraw()` — y como todo
  pasa por `redraw()`, la app entera dejaba de responder.
- **Fix:** `Exporter.isValidElement` valida cada elemento por tipo antes de
  aceptarlo (`js/exporter.js`); los inválidos se descartan en vez de
  colarse.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.importJSON: JSON
  inválido alerta y resuelve null"* y *"Exporter.isValidElement: rechaza
  elementos malformados"*.

### `label` no-string se colaba en flechas (regresión de orden de checks)
- **Síntoma:** un `label` no-string pasaba la validación en `arrow` /
  `curveArrow` / `pencil` aunque sí se rechazaba en otros tipos.
- **Causa:** el check de `label` estaba escrito después de los `return`
  tempranos por tipo, así que nunca se alcanzaba para esos tipos.
- **Fix:** `js/exporter.js`, `isValidElement` — el check de `label` se
  ejecuta antes de los `return` por tipo.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.isValidElement: label
  no-string se rechaza también en flechas (regresión de orden)"*.

### Valores sin escapar en los exports SVG/HTML (inyección de markup)
- **Síntoma:** `el.color`, `el.lineWidth` y el texto de usuario se
  interpolaban crudos en atributos y contenido; un JSON importado
  manipulado podía inyectar markup ejecutable en el archivo exportado.
- **Fix:** todo valor interpolado pasa por `_escapeXml`/`_escapeHtml`
  (`js/exporter.js`); `_escapeHtml` escapa también comillas simples y
  dobles.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.svg: text con el
  contenido escapado (&lt;, &amp;, &quot; nunca crudos)"*, *"Exporter.html:
  _escapeHtml escapa comillas dobles y simples"*, *"Exporter.html: color y
  lineWidth se escapan en los atributos style"*.

---

## Solo verificables manualmente (lógica en `app.js`, sin arnés DOM)

### El undo de un arrastre no revertía nada
- **Síntoma:** mover un elemento y pulsar Ctrl+Z no lo devolvía a su
  posición original; el stack de undo además se llenaba de snapshots
  duplicados en cada click de selección, destruyendo el `redoStack`.
- **Causa:** el snapshot se guardaba en `onMouseUp`, ya después de que
  `onMouseMove` hubiera mutado `state.elements`.
- **Fix:** `js/app.js` — el snapshot se captura en `onMouseDown` al iniciar
  el arrastre; `saveUndo()` solo se apila si hubo movimiento real
  (`didDrag`).
- **Verificación manual:** arrastrar un elemento, pulsar Ctrl+Z → debe
  volver exactamente a su posición previa; repetir con un solo click sin
  arrastre → no debe apilar undo.

### Colocar un texto y hacer click para colocar otro descartaba el primero
- **Síntoma:** con la herramienta Texto, escribir un texto y —sin pulsar
  Enter— hacer click en otro punto del lienzo para poner otro **borraba el
  primero sin guardarlo**, y además el editor nuevo no quedaba abierto.
- **Causa:** orden de eventos determinista. El `pointerdown` del segundo click
  ejecuta `onMouseDown → showTextInput`, que **reinicia `textInput.value=''`**
  para el texto nuevo; solo *después* se dispara el `blur → commitText`, que
  lee el valor ya vacío y descarta lo escrito (confirmado instrumentando el
  `blur`: llegaba con `value=""`). Ese mismo blur cerraba el editor recién
  abierto.
- **Fix:** `js/app.js`, rama TEXT de `onMouseDown` — si ya hay un editor
  abierto, la apertura del nuevo se aplaza un tick (`setTimeout(…,0)`), de modo
  que el `blur` confirma primero el texto anterior con su valor intacto y el
  editor nuevo se abre después, sin blur pendiente que lo cierre.
- **Verificación manual:** Texto (`T`), click, escribir "uno", click en otro
  punto, escribir "dos", Enter → deben quedar los dos textos.

### Tras usar un control del panel, los atajos y Ctrl+Z/C/V dejaban de funcionar
- **Síntoma:** después de mover el slider de trazo/zoom, marcar un checkbox o
  elegir un color, `Ctrl+Z`, copiar/pegar y las teclas de herramienta **no
  respondían** hasta hacer click en el lienzo.
- **Causa:** el handler global de `keydown` (y el de `copy`) hace `return`
  cuando `e.target` es un `<input>`, y el foco se quedaba en el control del
  panel recién usado.
- **Fix:** `js/app.js`, `wireControls` — un listener delegado en `.panel`
  suelta el foco (`blur()`) del control al terminar de ajustarlo (`change` =
  release del slider / toggle / cierre del picker).
- **Verificación manual:** dibujar algo, mover el slider "Trazo", y sin tocar
  el lienzo pulsar `Ctrl+Z` → debe deshacer.

### Los atajos de teclado seguían activos con un modal abierto
- **Síntoma:** con el modal de Exportar/Plantillas/Emoji/Ayuda abierto, pulsar
  una tecla de herramienta, `Supr` o `Ctrl+Z` **actuaba sobre el lienzo de
  detrás** del modal.
- **Causa:** el listener de `keydown` vive en `document` y el evento burbujea
  hasta ahí aunque el foco esté atrapado en el `<dialog>`; no había guard.
- **Fix:** `js/app.js` — `if (document.querySelector('dialog[open]')) return;`
  tras el handler de `?` (que sí sigue cerrando la ayuda; `Escape` cierra el
  modal de forma nativa).
- **Verificación manual:** dibujar un elemento, abrir la Ayuda, pulsar `Supr`
  y una tecla de herramienta → el elemento y la herramienta activa no cambian.

### Los botones "Duplicar/Eliminar selección" se veían siempre
- **Síntoma:** los botones que solo deberían aparecer con una selección se
  mostraban permanentemente, incluso con el lienzo vacío.
- **Causa:** `.btn { display: inline-flex }` gana en especificidad a la regla
  `[hidden]` del navegador, así que `boton.hidden = true` desde JS no ocultaba
  nada.
- **Fix:** `css/styles.css` — regla `.btn[hidden] { display: none }`.
- **Verificación manual:** sin selección, los botones "Duplicar/Eliminar
  selección" no se ven; al seleccionar un elemento, aparecen.

### Gestos de puntero y atajos a media interacción (varios)
Un segundo bloque de la auditoría, todos con la misma raíz: estado de gesto
que quedaba a medias.
- **`pointercancel` no cerraba un resize ni un marquee** (solo miraba
  `isDrawing`/`didDrag`): el gesto quedaba colgado y **secuestraba el
  siguiente**. Ahora `pointercancel` cierra cualquier gesto activo
  (`isDrawing`/`didDrag`/`resizing`/`dragLast`/`marquee`).
- **Un segundo dedo en pantalla táctil** disparaba otro `onMouseDown` y
  reiniciaba el trazo/arrastre en curso. Ahora se atiende **un solo puntero a
  la vez** (`activePointerId`): el segundo se ignora hasta soltar el primero.
- **Atajos a mitad de un gesto** (`Supr`, `Ctrl+Z`, tecla de herramienta
  mientras se arrastra/redimensiona) dejaban índices y flags a medias — p.ej.
  borrar durante un resize escribía en `state.elements[undefined]`. El
  `keydown` ahora ignora los atajos si hay un gesto de puntero en curso.
- **Confirmar una edición de texto sin cambiar nada** apilaba un undo y
  **vaciaba el redoStack**. `commitText` solo apila undo si el valor (o la
  etiqueta) cambió de verdad.
- **Click en el padding interior de un modal** lo cerraba como si fuera el
  backdrop (un `<dialog>` da `e.target === dialog` tanto en su padding como en
  el backdrop). Ahora solo cierra si el click cae **fuera del rectángulo** del
  cuadro (`getBoundingClientRect`).
- **Verificación:** `verify-plausibles.js`, `verify-noop.js` y
  `verify-multitouch.js` (Supr a mitad de resize no borra; edición no-op
  conserva el redo; click en padding no cierra pero en el backdrop sí; segundo
  puntero ignorado sin corromper el trazo).

### En ventanas ≤1100px el panel entero desaparecía sin alternativa
- **Síntoma:** en una ventana estrecha (`@media (max-width:1100px)`) el panel
  derecho se ocultaba con `display:none`, y con él **color, trazo, tamaño de
  texto, zoom, relleno, fondo/cuadrícula y los botones**, sin ninguna forma
  de acceder a esos ajustes.
- **Fix:** `index.html` / `css/styles.css` / `js/app.js` — el panel pasa a ser
  un **cajón deslizable**: botón `⚙ Panel` en la barra (solo visible ≤1100px)
  que lo muestra/oculta, con un fondo para cerrarlo. En pantallas anchas el
  botón está oculto y el panel sigue fijo como antes.
- **Verificación manual:** estrechar la ventana por debajo de 1100px → aparece
  "⚙ Panel"; al pulsarlo se abre el panel y sus controles son usables.

### Anclar los dos extremos de una flecha al mismo elemento la colapsaba
- **Síntoma:** arrastrar ambos extremos de una flecha sobre el mismo elemento
  la dejaba con longitud ~0 (invisible).
- **Causa:** `resolveAnchors` proyecta cada extremo hacia el otro sobre el
  borde del elemento; con los dos anclados al mismo rectángulo convergían al
  mismo punto.
- **Fix:** `js/app.js` — al fijar un anclaje (creación y arrastre de extremo)
  se rechaza si el otro extremo ya ancla ese mismo elemento (queda libre); y
  `resolveAnchors` ignora una flecha cuyos dos anclajes comparten `id`
  (defensa ante JSON importado).
- **Verificación manual:** anclar un extremo a un rect y arrastrar el otro al
  mismo rect → la flecha conserva su longitud (el segundo extremo no se ancla).

### Otros arreglos menores de la auditoría
- **Importar JSON no limpiaba la selección** (`js/app.js`): los índices
  previos apuntaban a elementos importados arbitrarios. Ahora hace
  `setSelection([])` como al cargar una plantilla.
- **Nudge con la flecha mantenida** apilaba un undo por cada repetición y
  expulsaba el historial (límite 50): ahora solo la primera pulsación apila
  undo (`if (!e.repeat)`), así el mantenido es un único paso.
- **Soltar un archivo fuera del lienzo** hacía que el navegador lo abriera y
  saliera de la app: `window` cancela ahora el `dragover`/`drop` por defecto
  (el drop sobre el lienzo sigue funcionando).
- **`isValidElement` aceptaba `type:'arc'`/`'emoji'`** (ids de herramienta, no
  tipos de elemento): un JSON importado colaba elementos fantasma invisibles
  pero seleccionables. Ahora se excluyen junto a `select`. Cubierto por test.

### La herramienta Texto no creaba nada (el editor se cerraba solo)
- **Síntoma:** con la herramienta Texto, al hacer click en el lienzo el
  textarea aparecía y desaparecía en el mismo instante, así que era
  **imposible crear texto**: lo escrito no llegaba a ninguna parte. Editar un
  texto ya existente con doble click sí funcionaba, lo que enmascaraba el
  fallo. Reproducido tanto en headless como en un navegador con ventana.
- **Causa:** `showTextInput()` llamaba a `textInput.focus()` de forma
  síncrona dentro del handler de `pointerdown`. La acción por defecto del
  evento mueve el foco al `body` justo después de los listeners (el `<canvas>`
  no es enfocable), lo que disparaba el `blur` del textarea → `commitText()`
  → valor vacío → `hidden = true` y ningún elemento creado. Por doble click
  no ocurría porque el cambio de foco ya había sucedido antes.
- **Fix:** `js/app.js` — el `focus()`/`select()` se aplaza un tick con
  `setTimeout(…, 0)`, de modo que se aplica después del cambio de foco por
  defecto (y se aborta si para entonces el textarea ya está oculto).
- **Verificación manual:** herramienta Texto (`T`), click en el lienzo → el
  cursor debe quedarse parpadeando en el recuadro; escribir y pulsar Enter
  debe crear el texto. Comprobar además que el doble click sobre un texto (o
  un emoji) sigue abriendo el editor con su contenido y que guardar no
  duplica el elemento.

### Con zoom > 100% no se podía llegar a la parte izquierda/superior del lienzo
- **Síntoma:** al ampliar, el lienzo crecía hacia los cuatro lados pero el
  scroll solo alcanzaba la parte derecha/inferior: al 200 % quedaban ~960 px
  inalcanzables por la izquierda, y al 300 % más de 2000 px. El trabajo
  seguía ahí, pero no había forma de verlo ni de dibujar en esa zona.
- **Causa:** `transform: scale()` no modifica la caja de layout, así que el
  área scrollable seguía siendo la del lienzo sin escalar. Con
  `transform-origin: center center`, lo que desbordaba por la izquierda y
  por arriba caía fuera de esa área — y el desbordamiento en negativo nunca
  es scrollable en CSS.
- **Fix:** `index.html` / `css/styles.css` / `js/app.js` — se añade un
  `.canvas-area__sizer` cuya caja de layout `applyZoom` iguala al tamaño ya
  escalado (`CANVAS_W/H * zoom`), y el wrapper pasa a
  `transform-origin: top left` con `width: fit-content` (sin esto se
  estiraría al ancho del sizer y el transform lo escalaría por segunda vez).
- **Verificación manual:** subir el zoom al 300 %, llevar el scroll a 0 → la
  esquina superior izquierda del lienzo debe quedar visible, y el área
  scrollable (`scrollWidth`) debe ser ≈ `1200 × zoom`. Dibujar en esa zona
  debe producir coordenadas sin escalar (un arrastre desde la esquina da
  x ≈ 0, no x ≈ 0 × zoom).

### El textarea de texto aparecía lejos del click con zoom ≠ 100%
- **Síntoma:** con el zoom distinto de 100%, hacer doble click para editar
  texto abría el textarea desplazado del punto pulsado.
- **Causa:** `showTextInput` multiplicaba la posición por el zoom, pero el
  wrapper que lo contiene ya está escalado por `transform: scale()`.
- **Fix:** `js/app.js` — el textarea usa `left/top = pos.x/pos.y` sin
  multiplicar por zoom.
- **Verificación manual:** subir el zoom al 150-200%, doble click sobre el
  lienzo → el textarea debe abrirse justo en el punto pulsado.

### Hit-test de líneas/flechas robaba clicks por su bounding box
- **Síntoma:** una diagonal larga tenía un bounding box de media pantalla y
  capturaba clicks muy lejos del trazo real.
- **Fix:** `js/app.js` — hit-test de `line`/`arrow`/`curveArrow` por
  distancia punto-segmento (proyección escalar clampada), no por bbox.
- **Verificación manual:** dibujar una línea diagonal larga, hacer click
  lejos del trazo pero dentro de su bbox → no debe seleccionarla.

### Texto multilínea con bounds incorrectos
- **Síntoma:** el bbox estimado de un texto ignoraba los `\n`: altura de
  una sola línea y ancho absurdo para textos de varias líneas, difíciles de
  seleccionar.
- **Fix:** `js/app.js` — bounds calculados con `ctx.measureText` de la
  línea más larga y altura `nLíneas * (fontSize + 4)`.
- **Verificación manual:** crear un texto de 3+ líneas, comprobar que el
  marco de selección las envuelve todas y que el handle de resize queda en
  la esquina real.
