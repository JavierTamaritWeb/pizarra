# BUGS.md — Registro de errores corregidos

Registro de bugs encontrados y corregidos en Pizarra, para que no se repitan.
Cada entrada indica el síntoma, la causa raíz, dónde se arregló y su
**guardia de regresión**: el test automático que falla si el bug vuelve, o
—cuando no se puede automatizar— los pasos de verificación manual que hay que
repetir antes de tocar esa zona.

> **Desde v1.13.1 `js/app.js` también es testeable.** El arnés
> `tests/helpers/load-app.js` levanta la app entera bajo `node:vm` con el DOM
> construido a partir del `index.html` real, y los tests lanzan gestos de
> verdad (pointer, teclado, modales) leyendo el resultado del autosave. Las
> entradas de la sección "solo verificables manualmente" son anteriores: al
> tocar una de esas zonas, conviértela en test en vez de repetir los pasos.

Al corregir un bug nuevo, añade aquí una entrada con el mismo formato y, si
el código es testable, el test que lo prueba (regla completa en `CLAUDE.md`).

---

## Cubiertos por tests automáticos

### La sección "Edificios" generaba geometría degenerada en arrastres pequeños
- **Síntoma:** con la herramienta Planta en modo Claustro/U/L y un arrastre
  corto (6–19 px), el elemento resultante tenía rectángulos de `w`/`h`
  negativos o polilíneas autointersectadas; esa basura entraba en
  `state.elements`, viajaba a autosave/JSON/undo y producía cajas de impacto
  invertidas en el hit-test.
- **Causa:** `_wing` (grosor de crujía) tenía un suelo fijo de 10 px, así que
  `2·t ≥ 20` invadía cualquier caja menor de 20 px: el claustro emitía un patio
  de tamaño negativo y la U/L cruzaban sus vértices.
- **Fix:** `_wing` en `js/building.js` acota el grosor a `w/2−1` y `h/2−1` (nunca
  invade la caja), y `_plantaClaustro` solo añade el patio si
  `w−2t > 0 && h−2t > 0`. Detectado en la crítica adversarial previa a publicar.
- **Guardia:** `tests/building.test.js` › *"cajas pequeñas: sin rects de w/h ≤ 0
  ni polilíneas U cruzadas"*.

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

### El botón «Alzado (2 aguas)» dibujaba otra cubierta distinta
- **Síntoma:** el modal de Fachada ofrecía «Alzado (2 aguas)», pero la cubierta
  que se dibujaba realmente la decide `state.roofType` del panel Edificios. Con
  «Cuatro aguas» o «Mansarda» seleccionadas, el botón etiquetado *2 aguas*
  producía un edificio con otro tejado: la etiqueta mentía y no había forma de
  saber desde el modal qué iba a salir.
- **Causa:** `FACADE_TYPES` (`js/config.js`) fijaba la forma en el nombre,
  mientras que `_gable` (`js/building.js`) elige la cubierta por `o.roofType`.
  Dos fuentes de verdad para el mismo dato, y la visible era la falsa.
- **Fix:** el nombre deja de nombrar una forma (hoy «Con tejado», con «Alzado»
  como subtítulo técnico) y `buildFacadeCatalog` (`js/app.js`) dibuja el icono
  con el faldón realmente activo (`FACADE_ROOF_PTS`), reconstruyéndose en cada
  apertura del modal (antes solo se refrescaba el resaltado) porque el usuario
  puede haber cambiado la cubierta entretanto. El primer arreglo añadía además
  una nota *"Cubierta: …"* bajo el botón; al meter después el propio selector de
  cubierta y la miniatura en vivo dentro del modal, la nota pasó a ser
  redundante y se retiró — el dato sigue a la vista, y en dos sitios mejores.
- **Guardia:** `tests/building.test.js` › *"el catálogo de Fachada no promete
  una cubierta concreta en el nombre"* (cubre `name` y `hint`).

### El marco de un edificio seleccionado se tragaba todos los clics de su interior
- **Síntoma:** tres síntomas del mismo fallo. Con un edificio seleccionado, todo
  lo dibujado dentro de su marco quedaba inalcanzable: (1) **Supr borraba el
  edificio** en lugar del elemento pulsado, así que lo que el usuario creía
  haber borrado seguía apareciendo después; (2) **arrastrar una puerta o ventana
  puesta encima movía el edificio entero** y dejaba la pieza quieta; (3) el clic
  nunca cambiaba la selección, sin pista visual de por qué.
- **Causa:** el paso 2 de `onMouseDown` (`js/app.js`) implementa la comodidad de
  "arrastrar la multiselección desde cualquier punto de su marco combinado" y
  **retornaba antes de llamar a `hitTest`**. Con elementos sueltos el marco es
  pequeño y apenas molesta, pero un edificio es *siempre* multiselección y su
  marco cubre toda la fachada: cualquier clic dentro se interpretaba como
  "arrastrar el grupo", nunca como "seleccionar lo que hay debajo del cursor".
- **Fix:** `js/app.js` — `hitTest(pos)` se calcula **antes** de esa rama y la
  comodidad solo se aplica si el punto no cae sobre un elemento ajeno a la
  selección (`idx < 0 || state.selection.includes(idx)`). Si cae sobre uno
  ajeno, se sigue al flujo normal y gana ese elemento. La comodidad original
  (arrastrar desde un hueco del marco) y `Alt`+clic no cambian.
- **Guardia:** `tests/app-interaction.test.js` › *"con un edificio seleccionado,
  Supr borra el elemento pulsado, no el edificio"*, *"…arrastrar un elemento de
  encima lo mueve a él"* y *"sigue funcionando arrastrar el edificio desde un
  hueco de su marco"* (esta última evita "arreglarlo" quitando la comodidad).

### El tipo de puerta y ventana no se podía elegir al crear una fachada
- **Síntoma:** la fachada dibuja sus huecos con `state.doorType`/`windowType`,
  pero esos valores solo se fijaban desde las herramientas **Puerta** y
  **Ventana**, que al seleccionarlas cambian la herramienta activa. Desde el
  flujo de Fachada no había forma de elegirlos: había que salir a otra
  herramienta, elegir, y volver — y quien no lo supiera se quedaba siempre con
  la puerta y la ventana básicas.
- **Causa:** al unificar los ajustes en el modal de Fachada (v1.13.0) se
  llevaron los cuatro del panel (plantas, vanos, pendiente, cubierta) pero no
  los dos tipos de hueco, que viven en otros modales.
- **Fix:** `index.html` + `js/app.js` — el modal de Fachada incorpora
  `#facade-door-type` y `#facade-window-type`, rellenados por
  `fillVariantSelect()` desde `DOOR_TYPES`/`WINDOW_TYPES` (una sola fuente de
  verdad). Escriben el mismo `state` que los catálogos de esas herramientas y
  refrescan su resaltado (`updateDoorActive`/`updateWindowActive`), así que
  ambos caminos quedan sincronizados. El selector de puerta se atenúa en la
  vista *De lado*, que no lleva.
- **Guardia:** `tests/app-interaction.test.js` › *"el modal de Fachada permite
  elegir el tipo de puerta y de ventana"* y *"los tipos elegidos en el modal de
  Fachada persisten en prefs"*.

### El Perfil (vista lateral) dibujaba la puerta principal centrada
- **Síntoma:** la vista **Perfil** repetía exactamente los huecos de la fachada
  frontal: mismo ritmo de vanos y la puerta de entrada centrada en la planta
  baja. Un canto lateral con portalón central es arquitectónicamente falso, y
  al montar frontal + perfil el edificio parecía tener dos accesos principales.
- **Causa:** `_profile` reutilizaba `_body` sin distinguir la vista, así que
  `_openings` marcaba `ground = f === n - 1` también en el lateral: reservaba el
  hueco central y añadía la puerta.
- **Fix:** `js/building.js` — `_body`/`_openings` reciben un flag `side`;
  con él `ground` es siempre `false`, de modo que el perfil no lleva puerta y su
  planta baja se acompasa como el resto (ritmo uniforme, sin el hueco de la
  entrada). `_profile` lo pasa; `_facade`/`_gable` no cambian.
- **Guardia:** `tests/building.test.js` › *"perfil: sin puerta central y con la
  planta baja acompasada"*.

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

### La previsualización del óculo (Edificios) no dibujaba el círculo
- **Síntoma:** al arrastrar con Ventana → **Óculo** (`round`/`roundFrame`), el
  aro circular **no aparecía** durante el arrastre (solo la cruz de diámetros);
  el óculo sí se creaba bien al soltar. Además la preview de cualquier edificio
  dibujaba todo el detalle al grosor del contorno, ignorando el trazo fino.
- **Causa:** el bucle de preview de edificios en `paintOverlay` (`js/app.js`)
  solo contemplaba `line`/`rect`/`curveArrow` —**no `circle`**— y fijaba
  `state.lineWidth`/`state.color` globales para todos los trazos.
- **Fix:** `js/app.js` — helper `drawBuildingPreview(octx, els)` que añade la
  rama `circle` (elipse inscrita) y aplica `el.color`/`el.lineWidth` por pieza,
  envuelto en `save()`/`restore()`.
- **Verificación manual:** Ventana → Óculo, arrastrar → durante el arrastre debe
  verse el aro completo además de la cruz, con el aro más grueso que la cruz.

### Cancelar el modal de variante dejaba la herramienta de Edificios "a medias"
- **Síntoma:** al pulsar Planta/Puerta/Ventana se abre un modal de variante; si
  se cerraba con **Escape / Cerrar / clic-exterior** sin elegir, la herramienta
  de edificio quedaba activa igual, así que un arrastre dibujaba el edificio
  aunque el usuario creía haber cancelado.
- **Causa:** `selectTool` fijaba `state.tool` a la herramienta de edificio antes
  de abrir el modal y **no guardaba la herramienta previa**; los cierres solo
  hacían `modal.close()`.
- **Fix:** `js/app.js` — `selectTool` guarda `state.toolBeforeModal` y resetea
  `state.variantChosen`; los handlers de variante ponen `variantChosen=true`; un
  listener `close` (cubre botón, Escape y backdrop) restaura la herramienta
  previa si no se eligió variante.
- **Verificación manual:** estar en Rectángulo, pulsar Puerta, pulsar `Esc` →
  debe volver a Rectángulo; repetir y elegir una variante → debe quedar en
  Puerta.

### Los modales desbordaban en pantallas estrechas (~320px)
- **Síntoma:** en móvil (~320px de ancho) los diálogos de variante (y el resto)
  desbordaban horizontalmente el viewport; sin scroll vertical si el contenido
  superaba el alto.
- **Causa:** `.modal` (`css/styles.css`) usaba `min-width:380px` sin
  `max-height`/`overflow`; solo `.modal--help` scrolleaba, y no había media query
  para pantallas pequeñas.
- **Fix:** `css/styles.css` — `.modal` usa `width: min(460px, calc(100vw-24px))`,
  `max-height: calc(100vh-24px)` y `overflow-y:auto`; `.modal--help` se ajusta a
  `min(620px, calc(100vw-24px))`; media query `≤360px` pasa `.modal__shape-grid`
  a una sola columna.
- **Verificación manual:** a 320px de ancho, abrir Puerta → el cuadro cabe sin
  desborde horizontal y las variantes se apilan en una columna.

### Media configuración de Edificios se perdía al recargar
- **Síntoma:** los ajustes de la sección Edificios sobrevivían a la recarga solo
  a medias. Plantas, vanos, pendiente y cubierta volvían tal como se dejaron,
  pero la variante elegida en cada modal (huella de Planta, vista de Fachada,
  forma de Tejado, tipo de Puerta y de Ventana) se reseteaba a su valor inicial
  (`rect`/`flat`/`gable`/`door`/`window`). Quien trabajaba con puerta de arco y
  ventana de cuadrícula tenía que volver a elegirlas en cada sesión.
- **Causa:** `savePrefs` (`js/app.js`) serializaba `buildFloors`, `buildBays`,
  `roofPitch` y `roofType`, pero **no** `plantaShape`, `facadeShape`,
  `roofShape`, `doorType` ni `windowType`; además los handlers de los cinco
  modales no llamaban a `savePrefs()` al elegir variante. Todos son defaults de
  creación de la misma sección, así que la asimetría no tenía justificación.
- **Fix:** `js/app.js` — `savePrefs` incluye las cinco variantes; `restorePrefs`
  las valida contra su propio catálogo (`PLANTA_SHAPES`/`FACADE_TYPES`/
  `ROOF_TYPES`/`DOOR_TYPES`/`WINDOW_TYPES`) con el helper `restoreVariant`, de
  modo que un id desconocido de otra versión se ignora sin romper; los cinco
  handlers de modal llaman a `savePrefs()`. `restorePrefs()` corre antes de
  `setupModals()` en `init()`, así que los catálogos ya se construyen con el
  resaltado correcto.
- **Verificación manual:** elegir Puerta → «Puerta de arco», Ventana →
  «Óculo», Planta → «Claustro», Fachada → «Perfil», Tejado → «Mansarda»;
  recargar la página → al abrir cada modal debe seguir resaltada la misma
  variante, y un arrastre debe dibujarlas sin volver a elegirlas. Comprobar
  también que «Limpiar todo» borra la clave `sketchwire.prefs` y que tras
  recargar vuelven los valores por defecto.

### Los ajustes de Fachada estaban lejos de la elección de vista
- **Síntoma:** el modal de Fachada solo dejaba elegir la vista; plantas,
  ventanas por planta, pendiente y cubierta vivían en el panel lateral, que en
  pantallas ≤1100px es un cajón oculto. Se elegía la vista a ciegas y había que
  dibujar, deshacer, cambiar un ajuste y repetir para ver el efecto. Además se
  ofrecían los cuatro ajustes siempre, aunque la vista elegida ignorara alguno
  (la fachada plana no tiene cubierta ni pendiente; el perfil lleva siempre la
  suya trapezoidal, `_profile` no mira `roofType`).
- **Causa:** decisión de diseño inicial —un modal por catálogo, sin parámetros—
  que no se revisó al añadir a Fachada opciones que las otras herramientas de
  Edificios no tienen.
- **Fix:** `#modal-facade` (`index.html`) incorpora una **miniatura en vivo**
  (`#facade-preview`) y gemelos de los cuatro controles del panel.
  `js/app.js`: `buildOpts()` centraliza los opts de `Building.elements` para los
  tres consumidores (preview del arrastre, commit y miniatura);
  `syncBuildControls()` reparte el `state` a los dos juegos de controles y
  repinta —fijar `.value` no dispara eventos, así que no se realimentan—;
  `renderFacadePreview(shape?)` reutiliza `Building.elements` +
  `drawBuildingPreview`, encaja por bounds reales y pinta `state.canvasBg` de
  papel (sobre el modal oscuro el trazo no se vería); `updateFacadeFieldsEnabled()`
  atenúa lo que la vista ignora. Pasar el puntero por una vista la previsualiza
  sin elegirla.
- **Guardia:** `tests/smoke.test.js` › *"los controles gemelos de Edificios
  (panel y modal) ofrecen lo mismo"* (opciones y rango idénticos: si divergen,
  `syncBuildControls` dejaría un control en blanco en silencio).
- **Verificación manual:** abrir Fachada → la miniatura muestra la vista activa;
  cambiar Plantas/Ventanas/Pendiente/Cubierta → se repinta al instante y el
  panel lateral refleja el mismo valor (y al revés); elegir «De frente» → se
  atenúan Cubierta y Pendiente; elegir «De lado» → se atenúa solo Cubierta;
  pasar el puntero por otra vista → la miniatura la muestra y al salir vuelve
  la elegida.
