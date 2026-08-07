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
>
> **Y ahora hay además una suite end-to-end en un navegador real**
> (`e2e/`, Playwright — `npm run test:e2e`). Cubre lo que el arnés `node:vm` no
> puede ver por definición: layout, CSS, foco y acciones por defecto del
> navegador. Varias entradas de más abajo ya tienen ahí su guardia; se indica
> en cada una. Regla para elegir dónde va un test nuevo: **coordenadas, undo,
> exportación y geometría → `tests/`; se ve, cabe, recibe el foco o hace scroll
> → `e2e/`**.

Al corregir un bug nuevo, añade aquí una entrada con el mismo formato y, si
el código es testable, el test que lo prueba (regla completa en `CLAUDE.md`).

---

## Cubiertos por tests automáticos

### «Limpiar todo» dejaba el lienzo pequeño, no como al abrir la app
- **Síntoma:** al abrir Pizarra en una pantalla ancha, el lienzo se ajusta solo
  para aprovechar el espacio disponible (auto-ajuste del zoom). Pulsar «Limpiar
  todo» —que promete devolver la app a su estado inicial— lo dejaba al 100% con
  márgenes vacíos alrededor, y además el auto-ajuste quedaba **desactivado para
  el resto de la sesión**: redimensionar la ventana ya no volvía a encajarlo.
- **Causa:** el handler de `#btn-clear` (`js/app.js`) hacía `zoomManual = true;
  applyZoom(1)`. El 100% fijo se eligió como "valor por defecto" del zoom, pero
  el valor por defecto real de la app no es 100%: es lo que decida
  `fitZoomToViewport()`, que es justo lo que corre en `init()`. Y marcar
  `zoomManual` —la bandera que existe para que el auto-ajuste **nunca** pise una
  elección del usuario— convertía un reset en una elección manual permanente.
- **Fix:** `js/app.js` — el handler pasa a `zoomManual = false;
  fitZoomToViewport()`, la misma pareja de efectos que tiene arrancar la app.
- **Guardia:** `tests/app-interaction.test.js` › *"«Limpiar todo» devuelve el
  zoom al ajuste automático, no a un 100% fijo"* (agranda `.canvas-area`, fuerza
  un zoom manual del 50% y comprueba que tras limpiar vuelve al zoom ajustado y
  que el sizer lo acompaña) y *"tras «Limpiar todo» el auto-ajuste vuelve a
  actuar al redimensionar"* (fija que `zoomManual` también se resetea).

### La previsualización del arrastre no dibujaba las curvas encadenadas ni el texto
- **Síntoma:** al arrastrar una pieza de Jardín con silueta orgánica (copa de
  árbol, piedra, estanque, parcela orgánica) la previsualización mostraba solo
  el detalle: la silueta y la etiqueta aparecían de golpe al soltar. Preview ≠
  resultado, que en este código cuenta como fallo.
- **Causa:** `drawBuildingPreview` leía `el.cx`/`el.cx2` de **nivel superior**,
  que una `curveArrow` encadenada no tiene —los suyos van dentro de
  `segments`—, así que ejecutaba `quadraticCurveTo(undefined, undefined, …)`.
  Según la especificación de Canvas, un argumento no finito hace que el método
  **retorne sin hacer nada y sin avisar**. Y los elementos `text` no tenían
  rama ninguna. Era un fallo latente: ninguna herramienta de Edificios emite
  curvas encadenadas ni texto, así que nunca se había disparado.
- **Fix:** `drawPiecesPreview` (renombrada, ya sirve a dos secciones) recorre
  `CurvePath.segments(el)` —que normaliza curva suelta y encadenada en un solo
  módulo— y delega los `text` en `Renderer.renderElement`, en vez de
  reimplementar fuente, anclaje e interlineado y arriesgarse a que diverjan.
- **Guardia:** `tests/app-interaction.test.js` › *"la previsualización del
  arrastre pinta la silueta encadenada y la etiqueta"*, que inspecciona las
  llamadas reales al contexto del canvas de overlay a mitad de arrastre.

### Dos tipos de árbol distintos se dibujaban igual ("Frondoso" y "Olivo")
- **Síntoma:** en el catálogo de Árbol, "Frondoso" y "Olivo" mostraban el mismo
  icono a efectos prácticos: copa lobulada con radios y tronco. No había forma
  de elegir entre ellos, ni en el catálogo ni en el lienzo.
- **Causa:** ambos usaban `_blob` + `_spokes` + `_trunk` y solo cambiaba la
  tabla de lóbulos, cuya diferencia se pierde a tamaño de icono. **Todos los
  tests pasaban**: cada variante se comprobaba por separado y ninguno comparaba
  una con sus hermanas. Detectado abriendo el catálogo en el navegador.
- **Fix:** el olivo motea el follaje (círculos finos) en vez de marcar ramas —
  que además es como se representa un olivo en un plano de paisajismo.
- **Guardia:** `tests/garden.test.js` › *"dentro de un catálogo, dos variantes
  nunca se dibujan igual"*, que compara la firma (tipos de elemento, cantidad y
  si las curvas son siluetas cerradas o trazos abiertos) de todas las hermanas.

### Un atajo nuevo podía chocar en silencio con una acción de flecha curva
- **Síntoma:** (evitado antes de publicar) las teclas `F`, `Q`, `D` y `S` ya
  actúan sobre las flechas curvas seleccionadas y se comprueban **antes** que
  `TOOL_KEYS`. Asignar una de ellas a una herramienta nueva habría funcionado
  hasta que hubiera una curva seleccionada, momento en el que la tecla haría
  otra cosa. Y toda pieza de Jardín lleva curvas dentro, así que en la práctica
  la colisión habría sido constante pero difícil de atribuir.
- **Causa:** el orden del `keydown` en `app.js` no está documentado en
  `config.js`, donde se eligen los atajos.
- **Fix:** los atajos de Jardín usan `8 9 H X Z` (las cinco teclas sueltas que
  quedaban) y `config.js` lleva la advertencia junto al grupo.
- **Guardia:** `tests/config-templates.test.js` › *"ningún atajo de herramienta
  pisa una acción ya reservada"*, con la lista `RESERVED_PLAIN_KEYS`.

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

### El atajo de herramienta se filtraba al modal que abría (`1` fijaba Plantas=1)
- **Síntoma:** pulsar `1` para abrir **Fachada** abría el modal y, de paso,
  cambiaba **Plantas** a 1 sin que el usuario tocara nada. Silencioso: el
  siguiente edificio salía de una planta.
- **Causa:** la rama de atajos de herramienta (`js/app.js`) llamaba a
  `selectTool` **sin `preventDefault()`** —la rama de cadenas de curva sí lo
  hacía, era una inconsistencia—. La tecla seguía viva y la recibía el control
  que `<dialog>.showModal()` enfoca por defecto, el primero del formulario: el
  `<select>` de Plantas la interpretó como su type-ahead. El fallo no existía
  antes de v1.13.0 porque el modal solo tenía botones.
- **Fix:** `e.preventDefault()` en la rama de atajos, y `autofocus` en el botón
  de la vista activa dentro de `buildFacadeCatalog` para que el algoritmo de
  enfoque del diálogo elija la acción principal (Enter la confirma) en vez de un
  campo del formulario. Enfocarlo a mano tras `showModal()` no sirve: el diálogo
  reaplica su autofoco después.
- **Detectado:** probando la app en un navegador real; el arnés no simula la
  acción por defecto del navegador.
- **Guardia:** `tests/app-interaction.test.js` › *"el atajo de herramienta
  cancela la tecla (no llega al modal que abre)"* y *"el modal de Fachada enfoca
  la vista activa, no el primer &lt;select&gt;"*.

### El borrador se llevaba figuras enteras al barrer por su hueco
- **Síntoma:** con el borrador nuevo (v1.14.0), una sola pasada horizontal por
  el centro de una fachada borraba **el muro entero**, no solo las ventanas que
  el usuario cruzaba. Cualquier forma grande desaparecía al barrer por dentro.
- **Causa:** `Eraser.touches` usaba la caja del elemento para las formas, por
  coherencia con `hitTest`. Pero un rectángulo sin relleno es visualmente solo
  su contorno: su interior está vacío y el usuario no espera perderlo al pasar
  por ahí. Lo que vale para seleccionar (caja generosa, cómoda) es demasiado
  agresivo para borrar.
- **Fix:** `js/eraser.js` — para las formas de `OUTLINE_TYPES` se comprueba el
  **contorno** (rectángulo, elipse muestreada, o los vértices reales de
  polígonos y trapecios), y la caja solo si `el.fill`. Texto, imágenes y
  componentes de UI siguen usando la caja: ahí la caja sí es el dibujo.
- **Detectado:** probando la app en un navegador real. La regla anterior pasaba
  todos los tests porque los tests la daban por buena — el fallo era de criterio,
  no de implementación.
- **Guardia:** `tests/eraser.test.js` › *"el interior hueco de una forma sin
  relleno no se borra; el contorno sí"*, *"una forma RELLENA sí se borra por su
  interior"*, *"círculos vacíos: se usa la elipse, no su caja"*, *"polígonos
  regulares: usa la silueta real, no la caja"* y *"texto e imágenes sí se borran
  por su caja"*.

### Lo borrado reaparecía al mover el dibujo (el borrador no borraba)
- **Síntoma:** pasabas el borrador sobre parte de una fachada y desaparecía; al
  mover luego la fachada, lo borrado **volvía a verse**. Lo mismo con cualquier
  elemento. Además lo "borrado" seguía viajando dentro del JSON exportado, así
  que reaparecía al importar el proyecto en otro sitio.
- **Causa:** el borrador no eliminaba nada. Añadía a la escena un elemento
  `type:'eraser'` que se componía con `destination-out`, es decir una **máscara
  fija en coordenadas del lienzo**. Al mover el contenido, este salía de debajo
  de la máscara y volvía a ser visible; la máscara seguía donde se pintó.
- **Fix:** nuevo módulo puro `js/eraser.js` (`Eraser.doomedIndices`/`apply`) que
  calcula qué elementos toca el trazo, con el mismo criterio que el clic de
  selección ampliado por el radio. La rama de borrador en `onMouseUp`
  (`js/app.js`) ahora **elimina** esos elementos con un solo `saveUndo` por
  pasada y no deja nada en la escena; `redrawNow` previsualiza el gesto quitando
  ya los condenados, así que lo que se ve durante el arrastre es el resultado.
  Una pasada que no toca nada no apila undo.
- **Compatibilidad:** los `eraser` de proyectos anteriores se siguen
  renderizando, exportando y validando igual, y `doomedIndices` los **excluye**
  a propósito: borrar una máscara haría reaparecer justo lo que oculta.
- **Guardia:** `tests/eraser.test.js` (14 casos de geometría, incluido *"las
  máscaras heredadas no se borran con el borrador nuevo"*) y
  `tests/app-interaction.test.js` › *"el borrador elimina los elementos y no deja
  ninguna máscara"*, *"lo borrado no reaparece al mover el dibujo"*, *"una pasada
  del borrador es un solo paso de undo"*, *"una pasada que no toca nada no
  ensucia el historial"* y *"los proyectos antiguos conservan su máscara"*.

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

## Solo verificables manualmente (juicio visual, no lógica)

### El césped de la parcela se leía como flechas «↓», y el macizo como un rombo
- **Síntoma:** las matas de césped del botón Jardín parecían flechas apuntando
  hacia abajo, y el arbusto "Macizo" salía como un rombo en vez de una mata.
  Ambas cosas eran geométricamente correctas y pasaban todos los tests.
- **Causa:** dos coincidencias de forma, no dos errores de cálculo. (1) Tres
  trazos que convergen en un mismo punto con el central más largo **son** una
  punta de flecha: el ojo completa el triángulo. (2) Una tabla de ocho lóbulos
  que alterna radio alto y bajo tiene simetría de orden 4, y una silueta con
  simetría de orden 4 es un rombo.
- **Fix:** las briznas arrancan cada una de su propio punto y con alturas
  escalonadas (`_tuft`), y la tabla `LOBES.clump` va desacompasada. De paso, el
  número de matas se deduce del área en vez de un tamaño de celda fijo, que
  dejaba las parcelas grandes con cuatro matas en fila.
- **Verificación manual:** dibujar una parcela grande (≈400×330) y comprobar
  que la textura se lee como hierba y está repartida; abrir el catálogo de
  Arbusto y comprobar que "Macizo" es irregular, no un rombo. **Ningún test
  puede juzgar esto**: la suite prueba lógica, no cómo se lee un dibujo.

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
- **Guardia (e2e):** `e2e/keyboard-focus.spec.js` › *"tras usar un control del
  panel, Ctrl+Z sigue deshaciendo"* (el foco real solo existe en un navegador).
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
- **Guardia (e2e):** `e2e/keyboard-focus.spec.js` › *"con un modal abierto, los
  atajos no actúan sobre el lienzo de detrás"*.
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
- **Guardia (e2e):** `e2e/responsive.spec.js` › *"por debajo de 1100px el panel
  es un cajón que se abre con «⚙ Panel»"* (y su pareja en escritorio ancho).
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
- **Guardia (e2e):** `e2e/zoom.spec.js` › *"con zoom al 300% se alcanza la
  esquina superior izquierda del lienzo"* y *"dibujar con zoom da coordenadas
  sin escalar"*.
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
- **Guardia (e2e):** `e2e/zoom.spec.js` › *"el editor de texto aparece donde se
  ha pulsado, con zoom ≠ 100%"*.
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
- **Guardia (e2e):** `e2e/keyboard-focus.spec.js` › *"Escape cancela el catálogo
  y devuelve la herramienta anterior"* (con la tecla real, no `dialog.close()`).
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
- **Guardia (e2e):** `e2e/responsive.spec.js` › *"a 320px de ancho los modales
  caben sin desborde horizontal"* y *"…las variantes se apilan en una columna"*.
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

---

## Auditoría severa (2026-08-07, tras v1.17.0): 19 defectos corregidos

Barrido completo de app.js, exportadores, renderer y los módulos de geometría,
con verificación adversarial de cada hallazgo antes de corregirlo. Todos los
fixes de esta tanda llevan guardia automática, y cada guardia se probó contra
el código roto (revertir el fix hace fallar exactamente sus tests).

### Los `<select>` del panel dejaban muertos todos los atajos
- **Síntoma:** cambiar «Solapamiento», «Plantas» o cualquier `<select>` del
  panel con el ratón mataba TODOS los atajos (Ctrl+Z/C/V, teclas de
  herramienta) hasta hacer clic en otro sitio.
- **Causa:** el blur que "revive" los atajos tras usar un control
  (`js/app.js`, listener de `change` en `.panel`) solo cubría
  `e.target.matches('input')`; el guard del keydown global ignora también
  `SELECT`, así que el select retenía el foco y ningún atajo llegaba. Era el
  mismo bug que ese handler decía haber arreglado, a medias.
- **Fix:** `js/app.js` — el matcher pasa a `'input, select'`.
- **Guardia:** `e2e/keyboard-focus.spec.js` › *"tras cambiar un `<select>` del
  panel, los atajos siguen vivos"* (foco real: el arnés vm no lo simula). El
  test enfoca el select antes de elegir, porque `selectOption` a secas no
  mueve el foco y pasaría incluso sin el arreglo.

### Elegir color de relleno podía expulsar el historial de undo entero
- **Síntoma:** con una forma seleccionada, arrastrar por el diálogo nativo de
  «Color de relleno» apilaba decenas de pasos de undo (uno por tono pisado);
  el límite del stack es 50, así que un solo gesto podía vaciar el historial, y
  Ctrl+Z recorría cada tono intermedio.
- **Causa:** el handler de `input` del picker hacía `saveUndo()` por evento,
  sin el snapshot de gesto que ya usaban el slider de grosor y el de opacidad.
- **Fix:** `js/app.js` — `fillColorGestureSnap` + `commitFillColorGesture` en
  `change`, el mismo patrón exacto de sus dos hermanos (incluida la detección
  de gesto no-op, que restaura las referencias sin apilar).
- **Guardia:** `tests/app-interaction.test.js` › *"elegir color de relleno
  arrastrando por el picker es UN paso de undo"*.

### Mantener pulsado un atajo de curva inundaba el historial
- **Síntoma:** mantener `+`/`−` sobre una flecha curva (~30 repeticiones/s)
  apilaba un undo por auto-repeat y en ~2 s expulsaba los 50 pasos; F/Q/D/S
  tenían el mismo agujero.
- **Causa:** ninguno de esos handlers filtraba `e.repeat`; el handler de las
  flechas de mover (NUDGE) sí lo hacía, con un comentario explicando justo
  este problema.
- **Fix:** `js/app.js` — `+`/`−` usan `if (!e.repeat) saveUndo()` (mantener la
  tecla extiende el mismo paso, como NUDGE); los toggles F/Q/D/S ignoran la
  repetición del todo (`if (e.repeat) return`): alternar en ráfaga solo mete
  ruido.
- **Guardia:** `tests/app-interaction.test.js` › *"mantener pulsado + sobre
  una curva es UN paso de undo"*.

### Las flechas tenían handles de esquina invisibles pero activos
- **Síntoma:** con una flecha o curva seleccionada, clicar a ≤8 px de una
  esquina de su bbox —espacio vacío a la vista, el bbox incluye los puntos de
  control— no deseleccionaba ni iniciaba marquee: arrancaba un **resize
  invisible** que escalaba la flecha.
- **Causa:** `drawSelection` omite los handles de esquina en las flechas
  (usan extremos/curvatura), pero `hitHandle` en `onMouseDown` los activaba
  igualmente: lo que se dibuja y lo que responde habían divergido.
- **Fix:** `js/app.js` — `hitHandle` solo se consulta si el elemento no es
  `arrow`/`curveArrow`, alineando el hit con lo que se pinta.
- **Guardia:** `tests/app-interaction.test.js` › *"la esquina del bbox de una
  curva seleccionada no es un handle invisible"* (con premisa verificada de
  que la esquina no pisa ningún handle real).

### Ctrl+V pegaba detrás de un modal abierto
- **Síntoma:** con Exportar (o cualquier modal) abierto, Ctrl+V con un payload
  propio en el portapapeles pegaba clones en el lienzo detrás del modal y
  además cambiaba la herramienta activa a Mover.
- **Causa:** el listener global de `paste` no comprobaba `dialog[open]`; el de
  `keydown` sí, así que el invariante "con un modal abierto ningún atajo toca
  el lienzo" tenía una puerta trasera.
- **Fix:** `js/app.js` — el mismo guard `document.querySelector('dialog[open]')`
  al principio del listener de paste.
- **Guardia:** `e2e/keyboard-focus.spec.js` › *"pegar funciona en el lienzo
  pero no detrás de un modal abierto"*, con control positivo (el mismo payload
  sí se pega sin modal) para que el test no pase en vacío.

### El borrador trataba el interior de una forma rellena como su CAJA
- **Síntoma:** un círculo o triángulo rellenos se borraban barriendo la
  esquina de su bounding box, a ~15 px de la tinta más cercana — contradice la
  regla documentada «se borra lo que se ve», que la caja solo cumple para
  rectángulos.
- **Causa:** `js/eraser.js` usaba `_touchesBox` para el caso `el.fill`, sobre
  cualquier `OUTLINE_TYPE`.
- **Fix:** `js/eraser.js` — el interior que cuenta es la **silueta real**:
  punto-en-polígono (ray casting) sobre los mismos vértices que ya usa el test
  de contorno (polígono/trapecio reales, elipse muestreada, caja solo para
  rect/roundedRect, donde sí es la silueta). Un trazo que atraviesa sin puntos
  dentro cruza el contorno y lo detecta el test de contorno, así que la
  cobertura es completa.
- **Guardia:** `tests/eraser.test.js` › *"rellenas: el interior que cuenta es
  la silueta real, no la caja"*.

### Un radio mayor que el lado dibujaba `roundedRect` autointersecado
- **Síntoma:** un rectángulo redondeado menor de 24 px (creable: el umbral de
  creación es >3 px) salía como un garabato cruzado en el canvas, mientras el
  SVG/HTML exportado se veía bien — misma forma, dibujo distinto por formato.
- **Causa:** `Sketchy.roundedRect` no acotaba `r` a `min(w,h)/2`: con
  `w−2r < 0` el borde retrocede. `canvas.roundRect` y el `rx` del SVG
  autoacotan por especificación; el trazado manual no.
- **Fix:** `js/sketchy.js` — `r = Math.max(0, Math.min(r, w/2, h/2))`.
- **Guardia:** `tests/sketchy-renderer.test.js` › *"el radio se acota y el
  borde de una forma 16×16 no retrocede"* (el assert vigila el retroceso del
  borde, no la caja: el bug nunca sale de la caja).

### El export HTML perdía el z-order entre vectores y componentes
- **Síntoma:** en el HTML exportado, toda línea/flecha/forma vectorial quedaba
  DEBAJO de todos los componentes HTML: una flecha dibujada encima de un card
  desaparecía tras él.
- **Causa:** `js/exporter.js` emitía un único `<svg>` con todos los vectores
  al principio y los `<div>` después; entre absolutos, los posteriores pintan
  encima. (El propio archivo ya resolvía esto para el borrador vía `_svgScene`,
  pero no para el solape vector/HTML.)
- **Fix:** `js/exporter.js` — un `<svg>` por **tramo contiguo** de vectores,
  intercalado en el orden del lienzo (`flushVectors` al cambiar de tipo y al
  final).
- **Guardia:** `tests/exporter.test.js` › *"los vectores conservan el z-order
  con los componentes"* (ambos órdenes + conteo de `<svg>` por tramos).

### Un color `#rrggbbaa` importado rompía todos los tintes concatenados
- **Síntoma:** con un color de 8 dígitos (que `HEX_COLOR` acepta
  expresamente), botones/inputs/cards se pintaban con el estilo que quedara
  del elemento anterior en canvas, y en el SVG/HTML exportado el fondo salía
  negro (fill por defecto) o el borde desaparecía.
- **Causa:** los tintes se construían concatenando (`color + '15'`): sobre un
  color con alfa propio dan 10 dígitos hex, inválido en todas partes.
  `fillStyle`/`_fillColor` ya hacían `slice(0, 7)`; los componentes UI no.
- **Fix:** `js/renderer.js` — helper `_tint(color, alpha)` en los 6 tintes de
  componentes; `js/exporter.js` — helper `tint(a)` en `_svgElement` y en el
  switch HTML (7 usos).
- **Guardia:** `tests/sketchy-renderer.test.js` › *"los tintes de los
  componentes UI parten del color base aunque traiga alfa"* y
  `tests/exporter.test.js` › *"un color #rrggbbaa no rompe los tintes
  concatenados"*.

### `isValidElement` aceptaba cajas con `w/h ≤ 0` y `fontSize` sin signo
- **Síntoma:** un JSON manipulado con `w:-100` (rect, imagen, componente UI) o
  `fontSize:-20` pasaba la validación: el canvas aún dibujaba algo, pero
  `<rect width="-100">` es un error SVG y CSS descarta los width negativos —
  el elemento "desaparecía" solo en los exports. Divergencia PNG↔SVG con
  entrada aceptada.
- **Causa:** solo los polígonos regulares y el trapecio exigían `w>0 && h>0`;
  el resto de cajas y el `fontSize` solo pedían "número finito".
- **Fix:** `js/exporter.js` — `w > 0 && h > 0` también en el retorno general y
  en `image`; `fontSize > 0` en `text`. Compatibilidad verificada con un
  barrido de 4.740 elementos generados por todas las variantes de Edificios y
  Jardín (arrastres degenerados incluidos): cero rechazos.
- **Guardia:** `tests/exporter.test.js` › *"rechaza w/h no positivos también
  en las cajas"* y *"el fontSize del texto debe ser positivo"*.

### Un polígono degenerado (w=h=0) era invisible e imborrable
- **Síntoma:** un polígono de tamaño cero llegado de datos externos no se
  veía, no respondía al hit-test y el borrador tampoco lo eliminaba: solo lo
  quitaba «Limpiar todo».
- **Causa:** `js/eraser.js` — `RegularPolygon.vertices` devuelve `[]` para esa
  caja, y `[]` es truthy: cortaba el encadenado de fallbacks
  (`polygonVertices || trapezoidVertices || caja`) y `_touchesPolyline([])` da
  false.
- **Fix:** `js/eraser.js` — los vértices vacíos ya no cortan la cadena
  (`poly && poly.length && poly`); el degenerado cae a la caja y se borra.
  (La validación endurecida del punto anterior además le cierra la puerta del
  import.)
- **Guardia:** `tests/eraser.test.js` › *"un polígono degenerado (w=h=0) sigue
  siendo borrable"*.

### Un fallo de lectura en el import JSON colgaba la promesa para siempre
- **Síntoma:** si `FileReader` fallaba al leer el archivo elegido, el import
  moría en silencio: ni alerta ni error, y el `await` del llamador quedaba
  colgado.
- **Causa:** `importJSON` (`js/exporter.js`) manejaba `onload`, el cancel del
  picker y el JSON malformado, pero no `reader.onerror`.
- **Fix:** `js/exporter.js` — `onerror` alerta («No se pudo leer el archivo»)
  y resuelve `null`, como los demás caminos de error.
- **Guardia:** `tests/exporter.test.js` › *"un fallo de lectura alerta y
  resuelve null"* (el stub de FileReader del arnés ahora sabe simular el
  fallo con `{ error: true }`).

### Shift+R sin formas rotables activaba la herramienta Rectángulo
- **Síntoma:** seleccionar una flecha y pulsar Shift+R (atajo documentado de
  rotar) cambiaba la herramienta a Rectángulo y perdía la selección.
- **Causa:** la condición del handler de rotar exigía "hay algo rotable en la
  selección"; si no, la tecla caía al selector de herramientas, que no filtra
  `shiftKey`, y `k === 'r'` es Rectángulo.
- **Fix:** `js/app.js` — Shift+R se consume SIEMPRE (rota lo rotable si lo
  hay; si no, no hace nada).
- **Guardia:** `tests/app-interaction.test.js` › *"Shift+R sobre una selección
  sin rotables no cae en Rectángulo"*.

### «?» apilaba la Ayuda encima de cualquier otro modal
- **Síntoma:** con Exportar (u otro modal) abierto, pulsar `?` abría la Ayuda
  encima, apilando dos diálogos.
- **Causa:** el handler de `?` corre antes del guard de `dialog[open]` a
  propósito —para poder CERRAR la Ayuda—, pero ese orden también le permitía
  abrirla.
- **Fix:** `js/app.js` — `?` solo abre si no hay otro `dialog[open]`; cerrarse
  a sí misma sigue funcionando.
- **Guardia:** `e2e/keyboard-focus.spec.js` › *"«?» no apila la Ayuda sobre
  otro modal, y su toggle sigue vivo"*.

### El círculo del borrador quedaba fantasma al cambiar de herramienta
- **Síntoma:** pasar el cursor por el lienzo con Borrador y pulsar `v` (sin
  mover el ratón) dejaba el círculo indicador pintado en el overlay hasta el
  siguiente gesto.
- **Causa:** `selectTool` no repintaba el overlay; `pointerleave` solo limpia
  si la herramienta sigue siendo el borrador, y `onMouseMove` en reposo con
  otra herramienta no reprograma nada.
- **Fix:** `js/app.js` — `selectTool` termina con `scheduleOverlay()`
  (`paintOverlay` limpia el lienzo de overlay al empezar).
- **Guardia:** `e2e/keyboard-focus.spec.js` › *"el círculo del borrador no
  queda fantasma al cambiar de herramienta"* (cuenta píxeles con alfa en el
  overlay real).

### La preview del modo cadena ignoraba «Ajustar a cuadrícula»
- **Síntoma:** arrastrando durante un clic de cadena con snap activo, el tramo
  en la previsualización seguía al puntero sin snap, y al soltar el commit sí
  snapeaba: preview ≠ resultado.
- **Causa:** `onMouseMove` fijaba `lastPos` snapeado en la rama de cadena y,
  si el botón estaba pulsado, la misma pasada lo sobreescribía más abajo con
  la posición cruda.
- **Fix:** `js/app.js` — en modo cadena el `lastPos` snapeado ya no se pisa.
- **Guardia:** `tests/app-interaction.test.js` › *"la previsualización de la
  cadena respeta «Ajustar a cuadrícula»"* (inspecciona el extremo del
  `quadraticCurveTo` real del overlay a mitad de gesto).

### Limpieza: rama muerta de `eraser` en el export HTML
- **Síntoma (latente):** `'eraser'` en `VECTOR_TYPES` y el `case 'eraser'`
  vacío de `_svgElement` eran inalcanzables — `html()` desvía a `_svgScene`
  toda escena con borradores y `_svgScene` los convierte en máscaras antes de
  llamar a `_svgElement`— y sugerían una cobertura que no existía.
- **Fix:** `js/exporter.js` — eliminados ambos; un comentario en su lugar
  documenta por qué los `eraser` nunca llegan ahí.
- **Guardia:** las suites existentes de export con borradores heredados siguen
  en verde (el comportamiento no cambia).

### «Limpiar todo» no reiniciaba el tamaño del borrador
- **Síntoma:** tras cambiar el tamaño del borrador (panel o modal) a algo
  distinto de 16px, pulsar «Limpiar todo» dejaba el lienzo en blanco pero el
  borrador seguía con el tamaño que se le hubiera dado, en vez de volver al
  de recién abierta.
- **Causa:** el handler de `btn-clear` ya reiniciaba `canvasBg`, `gridColor`,
  `overlapMode` y el zoom a sus valores por defecto, pero olvidaba
  `state.eraserSize` — quedaba vivo en memoria aunque `sketchwire.prefs` se
  borrase de `localStorage`.
- **Fix:** `js/app.js` — `btn-clear` asigna también
  `state.eraserSize = DEFAULT_ERASER_SIZE` (16px), junto al resto de valores
  por defecto.
- **Guardia:** `tests/app-interaction.test.js` › *"«Limpiar todo» reinicia el
  tamaño del borrador a 16px"*.

### Limpieza: `distToSegment` estaba duplicado en app.js
- **Síntoma (latente):** `js/app.js` mantenía su propia copia de la distancia
  punto-segmento que `js/eraser.js` ya exporta — la misma fórmula dos veces
  esperando a divergir.
- **Fix:** `js/app.js` — la copia local es ahora un adaptador de una línea
  sobre `Eraser.distToSegment` (solo cambia la firma a escalares, cómoda para
  `hitTest`).
- **Guardia:** los tests existentes de hit-test/selección siguen en verde (el
  comportamiento no cambia).
