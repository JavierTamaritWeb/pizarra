# BUGS.md — Registro de errores corregidos

Registro de bugs encontrados y corregidos en Pizarra, para que no se repitan.
Cada entrada indica el síntoma, la causa raíz, dónde se arregló y su
**guardia de regresión**: el test automático que falla si el bug vuelve, o
—cuando no se puede automatizar— los pasos de verificación manual que hay que
repetir antes de tocar esa zona.

> **Desde v1.13.1 `src/js/app.js` también es testeable.** El arnés
> `tests/helpers/load-app.js` levanta la app entera bajo `node:vm` con el DOM
> construido a partir del `index.html` real, y los tests lanzan gestos de
> verdad (pointer, teclado, modales) leyendo el resultado del autosave. Las
> entradas de la sección "solo verificables manualmente" son anteriores: al
> tocar una de esas zonas, conviértela en test en vez de repetir los pasos.
>
> **Hay una tercera categoría, desde la v2.25.1: los artefactos y la
> documentación.** La build de `dist/`, las capturas del README y la propia
> guía de CLAUDE.md envejecen en silencio —nada falla, simplemente dejan de ser
> verdad—, y el código no siempre puede comprobarlo por sí mismo. Lo que sí se
> puede atar, se ata: los recuentos que afirma la Ayuda salen de los catálogos
> y hay guardas contra las referencias a mandos retirados.
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

### v3.13.3 — La «posición de fábrica» de las barras flotantes se calculó dos veces con coordenadas, y las dos veces salió una disposición que no era la pedida

- **Síntoma:** el usuario pidió que al pulsar «Barras» las paletas aparecieran
  «en la posición original, no separadas» — y hicieron falta **tres
  versiones** para dárselo. La v3.13.0 las colocaba en una **fila horizontal**
  bajo el topbar; la v3.13.2, apiladas a la izquierda pero **saltando a otra
  columna** cuando no cabían — que en su pantalla volvía a leerse como
  «separadas» (lo confirmó con una captura). Lo pedido era el sitio del
  sidebar: **una columna pegada al borde, las barras juntas sin huecos**.
- **Causa:** dos, una de proceso y una técnica.
  1. **Interpretar dos veces una petición ambigua en vez de preguntar.**
     «Posición original, no separadas» admitía varias lecturas y se eligió una
     plausible cada vez. A la tercera se preguntó con AskUserQuestion y
     **previews ASCII de las tres disposiciones posibles**, y el usuario eligió
     la suya en un clic. Ese es el camino correcto desde el principio: cuando
     una petición de disposición visual admite lecturas, se enseñan bocetos y
     se pregunta — sale más barato que una versión descartada.
  2. **Calcular coordenadas para un problema de FLUJO.** Apilar «sin huecos»
     exige conocer la altura real de cada barra, y ahí no hay opción buena:
     medirla con `getBoundingClientRect` falla dos veces (con el modo apagado
     la barra está `display:none` y mide 0, y **el stub del arnés vm devuelve
     una caja fija de 1200×800 para cualquier elemento** — la v3.13.2 salió
     con cada barra en su propia columna en los tests por exactamente eso), y
     estimarla (46 + 59 por fila) deja huecos de ~9 px y se desincroniza del
     CSS en cuanto alguien toque un padding.
- **Arreglo:** la disposición de fábrica dejó de calcularse: **es flujo CSS**.
  `#floatbars` es una franja fija en el borde izquierdo (del topbar abajo, con
  `overflow-y: auto` — escrolea como el sidebar) y las barras viven dentro en
  flujo, apiladas sin huecos por construcción. Solo **arrastrar** una barra le
  pone `position: fixed` inline (en el punto exacto donde estaba:
  `getBoundingClientRect` da coordenadas de viewport, el sistema de fixed), y
  volver a fábrica es **borrar esos estilos** (`resetFloatbars`), no recolocar.
  `clampFloatbar` ignora las barras en flujo — no pueden perderse. Dos reglas
  que esta entrada deja escritas: **ninguna lógica que corra en el arnés vm
  puede depender de medir el DOM** (el stub miente con una caja fija), y
  cuando el resultado deseado es «como lo coloca el CSS», la respuesta es
  dejárselo al CSS, no imitarlo con números.
- **Guardia:** `tests/app-interaction.test.js` — *«buildFloatbars crea 5
  barras en su posición de fábrica…»* exige que las barras nazcan **sin
  estilos inline de posición** (fábrica = flujo; un cálculo de coordenadas
  reaparecería como estilos inline y fallaría), y
  `e2e/floatbars.spec.js` — *«la disposición de fábrica es UNA columna pegada
  al borde, sin huecos, que escrolea»* mide contra las cajas REALES que cada
  barra empieza a ≤1 px de donde acaba la anterior, en x=0 desde y=52, y que
  la columna escrolea (400 px de `scrollTop` mueven la última barra
  exactamente 400 px).

### v3.13.1 — Activar el modo de barras flotantes recuperaba las posiciones de la sesión anterior del modo

- **Síntoma:** con el modo flotante ya usado una vez —barras arrastradas por
  el lienzo, alguna plegada—, apagarlo y volver a pulsar «Barras» las
  enseñaba **donde habían quedado**, desperdigadas. El usuario pidió
  explícitamente que encender el modo las mostrara siempre en la disposición
  original (las posiciones ya morían con la recarga, pero no al conmutar).
- **Causa:** las posiciones viven solo en el DOM (decisión de diseño: ni
  `state` ni prefs), así que apagar el modo —que es solo quitar la clase
  `app--floatbars`— las dejaba intactas, y encenderlo las revelaba tal cual.
  Faltaba distinguir «seguir en la sesión del modo» (el viaje
  ancho→estrecho→ancho del viewport, donde conservar posiciones es correcto)
  de «entrar en el modo» (donde se espera la disposición limpia).
- **Arreglo:** `applyFloatToolbars` llama a `resetFloatbars()` **solo cuando
  enciende** (`if (state.floatToolbars)`): posiciones a fábrica, barras
  desplegadas, scroll de la columna a cero. Apagar no toca nada, y el viaje
  por viewport estrecho tampoco pasa por ahí (es CSS puro), así que dentro de
  la sesión del modo las posiciones se conservan — que es el único sitio
  donde deben conservarse.
- **Guardia:** `tests/app-interaction.test.js` — *«activar «Barras» devuelve
  SIEMPRE la disposición de fábrica»* (una barra arrastrada a fixed y otra
  plegada; apagar+encender debe devolver ambas al flujo y desplegadas —
  **verificada fallando** sin la llamada a `resetFloatbars` en
  `applyFloatToolbars`) y `e2e/floatbars.spec.js` — *«apagar y encender el
  modo devuelve la barra movida a fábrica»* con el ratón de verdad, más
  *«bajo 1100px…»*, que fija el complemento: el viaje por viewport SÍ
  conserva las posiciones.

### v3.12.1 — Una de cada tres pasadas de la suite e2e fallaba, y cada vez en otro sitio

- **Síntoma:** la suite completa (`npm run test:e2e`) fallaba **un test
  distinto** en aproximadamente una de cada tres pasadas —`solids.spec.js` o
  `stars.spec.js`—, y los dos pasaban en aislamiento incluso repetidos cuatro
  veces. Comprobado en un worktree limpio que el fallo era **anterior** a las
  fases 5-8: no lo introdujo ningún cambio de la aplicación.
- **Causa:** dos fallos independientes, los dos en las pruebas y ninguno en la
  app.
  1. **Medida única de un overlay que aún no se ha pintado.** `settle()`
     espera dos fotogramas, pero el `pointermove` puede no haberse procesado
     todavía cuando arranca esa espera: la previsualización se pinta después y
     la medida sale **0** (el overlay vacío), no «a medias». Es la cara
     complementaria de la trampa que ya documentaba la v3.10.0: allí el
     problema era que esperar no servía, aquí que se espera lo que no es.
  2. **Exactitud imposible en la rejilla de píxeles.** `stars.spec.js` exigía
     `Math.round(star.w) === 240`, y en la ventana WIDE el lienzo va al 120 %:
     el ratón aterriza en píxeles de DISPOSITIVO, así que medio píxel de
     pantalla son ~0,4 de lienzo y el radio salía 119,6 de vez en cuando.
- **Arreglo:** las medidas del overlay a mitad de gesto se **sondean** con
  `expect.poll` (que es lo que `e2e/feedback.spec.js` ya hacía, y por eso
  nunca falló), y la medida de la caja de la estrella pasa a tener tolerancia
  de ±2 px — lo que se quiere comprobar es que la caja ES el arrastre, no un
  redondeo que la rejilla no puede garantizar. Se conserva exacta la igualdad
  `w === h`, que sí sale del mismo radio.
- **Guardia:** las propias pruebas, y la evidencia de **diez pasadas completas
  seguidas en verde** frente a ~1 de cada 3 fallando antes. Regla para las
  nuevas: **toda medida de píxeles tomada a mitad de gesto va con
  `expect.poll`**, nunca con una lectura única.

### v3.10.0 — `elements()` de e2e devuelve la escena VIEJA cuando el cambio no altera el recuento

- **Síntoma:** las guardas nuevas de voltear, alinear y agrupar fallaban con la
  app correcta: la escena leída tras el gesto era siempre la anterior
  (verificado a mano en el navegador — el volteo se veía perfectamente — y en
  el arnés `node:vm`, donde las mismas comprobaciones pasaban). Y al revés, la
  comprobación «ida y vuelta devuelve lo mismo» habría pasado *sin que el
  volteo existiera*: leer dos veces el estado viejo la satisface.
- **Causa:** `elements()` (e2e/helpers.js) espera a que el contador «Elementos»
  y el autosave **coincidan**, y ese acuerdo ya se cumple con el par rancio
  (2 === 2) en cuanto la operación no crea ni borra nada. Es la misma trampa
  que CLAUDE.md ya documentaba para `settle()`, con otra cara: allí el riesgo
  era no esperar, aquí es que *esperar no sirve*, porque el autosave va con
  500 ms de rebote y la condición de parada no depende de lo que cambió.
- **Arreglo:** en `e2e/align.spec.js`, un `sceneField(page, get)` que sondea
  con `expect.poll` **el valor concreto** que tiene que cambiar, leyendo el
  autosave crudo (`readAutosave`). Regla general: si el gesto no cambia el
  número de elementos, `elements()` no vale como punto de sincronía.
- **Guardia:** las cuatro pruebas de `e2e/align.spec.js` (con el sondeo pasan;
  sin él, tres fallaban con la app correcta y la cuarta era vacua).

### v3.7.0 — El long-press no aislaba nada: el marco combinado se comía el Alt

- **Síntoma:** mantener el dedo quieto sobre la pieza de una fachada —el
  Alt+clic táctil recién estrenado— disparaba su anillo, re-ejecutaba el
  mousedown con `altKey: true`… y al pulsar Supr caía la fachada **entera**:
  la selección seguía siendo el grupo completo, como si el long-press no
  hubiera pasado.
- **Causa:** el `pointerdown` del dedo ya había seleccionado el grupo entero
  antes de que el temporizador venciera, así que cuando el mousedown se
  re-decide con Alt el punto cae **dentro del marco combinado de la
  selección**, y esa rama (arrastrar la selección) corre antes de que el
  hit-test con Alt pueda aislar nada. Con ratón el orden es el correcto —Alt
  se pulsa antes del clic—; el long-press es el único camino donde la
  selección de grupo ocurre *primero*.
- **Arreglo:** el disparo del long-press **vacía la selección**
  (`setSelection([])`) antes de re-ejecutar `onMouseDown`, además de
  descartar `dragLast`/`resizing`/`marquee`. Así el mousedown con Alt se
  resuelve fresco y aísla la pieza, que queda arrastrable sin levantar el dedo.
- **Guardia:** *"el long-press aísla la pieza (el Alt+clic que el táctil no
  tiene)"* en `e2e/touch.spec.js` — long-press real por CDP sobre una fachada
  de ~99 piezas y Supr debe eliminar exactamente **una**. **Verificada
  fallando** contra el código sin el `setSelection([])` (borraba las 99).
- **Lección:** re-ejecutar un handler «como si» fuera otro gesto exige
  reconstruir también el **estado previo** que ese gesto habría encontrado.
  El orden de precedencia del mousedown (handles → marco combinado → hitTest)
  está pensado para clics que llegan de cero, no para clics que llegan con la
  selección que ellos mismos acaban de crear.

### v3.6.0 — La cota en vivo contaminó la medición de tinta de los specs de sólidos

- **Síntoma:** al estrenar la cota `ancho × alto` junto al puntero, dos specs
  de `e2e/solids.spec.js` se pusieron rojos: la comparación «la
  previsualización dibuja lo mismo que aparece al soltar» pasó de ~0.05 a
  0.29 de desviación, sin que la previsualización hubiera cambiado.
- **Causa:** esos specs miden la tinta del overlay contando píxeles opacos
  (`overlayInk`), y la pastilla de la cota —relleno `#4ecdc4` + texto
  `#12121c`— vive en ese mismo overlay junto al puntero: ~1.100 píxeles que no
  son tinta del sólido inflaban el lado «preview» de la comparación.
- **Arreglo:** `overlayInk` excluye los **dos colores exactos** de la pastilla
  (78,205,196 y 18,18,28). El trazo del sólido es `#1a1a2e` (26,26,46) y no
  colisiona; los píxeles de antialiasing del borde quedan dentro de la
  tolerancia.
- **Guardia:** los propios specs (`la previsualización dibuja lo mismo…` y
  `la miniatura del modal…`), que son los que fallaban.
- **Lección:** el overlay es un espacio **compartido**: cualquier cosa nueva
  que se pinte ahí (guías, cotas, anillos) aparece en las mediciones de todo
  test que cuente píxeles del overlay. Al añadir un adorno junto al puntero,
  buscar `overlay` en `e2e/` antes de dar la suite por verde.

### v3.6.0–3.7.0 — Dos trampas de e2e que costaron una tarde en total

- **`Ctrl+C` sintético no despacha `copy`:** en Chromium headless, pulsar
  Ctrl+C por teclado sin una selección de **texto** del documento no emite el
  evento `copy` que la app escucha — el toast de «Copiado» jamás aparecía en
  el spec aunque en un navegador de verdad funciona. El evento real se dispara
  con `document.execCommand('copy')` (ver `e2e/feedback.spec.js`).
- **Un control dentro del panel-cajón cerrado no tiene `innerText`:** a 393 px
  de ancho el panel es un cajón con `visibility: hidden`, y el `#zoom-val`
  oculto devuelve `innerText` vacío → `Number('') === 0`, con lo que el spec
  del auto-fit móvil «pasaba» su `< 100` con un cero absurdo y fallaba el
  `>= 30`. La lectura robusta es el **`value` del slider**, que existe igual
  esté visible o no (ver `e2e/touch.spec.js`).
- **Guardia:** los dos specs citados, que documentan el porqué en su comentario.
- **Lección:** cuando un spec e2e falla contra una funcionalidad que en el
  navegador se ve funcionar, sospecha primero del **arnés** — y deja el motivo
  escrito en el propio spec, que es donde el siguiente lo va a pisar.

### v3.4.4 — El «volumen suave» de la copa no se pintaba: un `curveArrow` no se rellena

- **Síntoma:** la copa de la parra malvasía se dibujó con el mismo
  `_massInk(...)` que usan las copas de los árboles, sobre un `_blob`, y en
  pantalla no aparecía relleno ninguno: sólo el contorno. Nada fallaba —ni un
  error, ni un test rojo—, así que el primer diagnóstico fue «se ve poco» y se
  subió la opacidad, que tampoco hizo nada.
- **Causa:** `_blob` devuelve un `_chain`, y un `_chain` es un **`curveArrow`**.
  La rama `case 'curveArrow'` de `Renderer.renderElement` recorre los segmentos
  y **traza**, sin mirar `el.fill` jamás. El elemento viajaba con `fill: true` y
  su `fillColor`, `isValidElement` lo aceptaba y el export lo copiaba: un fallo
  perfectamente mudo de punta a punta. Las copas de los árboles no lo sufren
  porque su masa es un `circle`, no un blob.
- **Arreglo:** el relleno de la copa va en un **`polygon`** (tipo rellenable,
  el mismo que usan las caras de los sólidos y las manchas de la Tinta), con
  `stroke: false`, y el contorno lo dibuja encima una `_chain` cerrada que
  recorre **los mismos puntos**, de modo que tinta y trazo no pueden discrepar.
- **Guardia:** *"el jardín nunca confía un relleno a una curva: un curveArrow
  no se rellena"* en `tests/garden.test.js` — recorre las 72 variantes en los
  dos modos de color y las dos vistas. **Verificada fallando** al devolver el
  relleno a la cadena.
- **Lección:** «lo dibujo igual que aquello» sólo vale si el **tipo de
  elemento** es el mismo. La pareja campo/renderer se rompe por el lado que
  nadie mira: un campo que el renderer de ese tipo no consulta no da error,
  simplemente no existe.

### v3.4.4 — La copa como piezas translúcidas solapadas: se veían los globos y las costuras

- **Síntoma:** el manto de la pérgola, ya relleno, se leía como una fila de
  globos verdes: cada solape salía más oscuro que el resto y dibujaba las
  costuras de la construcción. El usuario lo describió como «un chapuzo», y en
  la captura se veía exactamente eso.
- **Causa:** la copa eran cinco elipses **translúcidas** solapadas. El alfa se
  **acumula** en cada solape (es el mismo principio que hace funcionar al
  aerógrafo translúcido, aquí en contra), así que las intersecciones delataban
  las piezas en vez de fundirse en una masa.
- **Arreglo:** una sola silueta. **Un** `polygon` de relleno con la forma
  completa —tinte uniforme, imposible de oscurecer por solape— y **un** contorno
  festoneado encima: panza recta apoyada en el larguero y festones redondeados,
  más anchos que altos, por el borde superior (en planta, por el perímetro
  entero). La proporción se calibró en un navegador real sobre papel blanco:
  con festones estrechos la copa sale picuda como una corona.
- **Guardia:** *"la copa de la parra malvasía es UNA superficie rellena, no
  piezas solapadas"* en `tests/garden.test.js` — exige exactamente **una** pieza
  con relleno en cada vista, que sea `polygon` y que en modo tinta no haya
  ninguna. **Verificada fallando** con dos elipses solapadas.
- **Lección:** varias piezas translúcidas del mismo color no componen una masa,
  componen un diagrama de Venn. Cuando lo que se quiere es **una** superficie,
  hay que emitir una.

### v3.3.0 — El buscador de la Ayuda dejó mudo al atajo «?» que la abre

- **Síntoma:** con la Ayuda abierta, pulsar `?` ya no la cerraba. El atajo
  seguía abriéndola, así que la única forma de salir era el botón «Cerrar» o
  `Escape` — un atajo documentado que funciona a la ida y no a la vuelta.
- **Causa:** un `<dialog showModal>` enfoca su primer control focalizable, y
  al añadir el buscador ese pasó a ser un `<input>`. La primera guarda del
  `keydown` global es «no capturar mientras se escribe en cualquier control»
  (`tag === 'INPUT'` → `return`), así que el bloque de `?` dejaba de correr.
  Nada del código de la Ayuda cambió: cambió dónde estaba el foco.
- **Fix:** un `keydown` propio del campo de búsqueda que cierra la ayuda con
  `?` (app.js). Va en local y no relajando la guarda global: buscar «?» en la
  ayuda no significa nada, y ablandar esa guarda afectaría a todos los campos
  de la app. El foco en el buscador se conserva a propósito — la ayuda se abre
  lista para escribir.
- **Guardia:** `e2e/keyboard-focus.spec.js` → *«?» no apila la Ayuda sobre
  otro modal, y su toggle sigue vivo*. Ya existía, y es quien lo cazó: es
  exactamente el caso que el arnés `node:vm` no puede ver, porque allí el foco
  no lo mueve nadie.

### v2.30.0 — Escalar una mancha de aerógrafo la volvía inválida: desaparecía al recargar, sin aviso

- **Síntoma:** pintar con el Aerógrafo, agrandar la mancha (tiradores, campo
  «Ancho», o el resize de grupo) y recargar la página: la mancha había
  desaparecido del lienzo, sin ningún mensaje. Al reimportar el JSON exportado,
  lo mismo (ahí al menos con el alert de «elemento inválido»). También al
  encogerla mucho. Encontrado en la auditoría v2.30.0; severidad ALTA — pérdida
  silenciosa de trabajo en el flujo más corriente.
- **Causa:** `scaleElement` escalaba la boquilla (`radius`) **sin acotarla** al
  rango `[Airbrush.R_MIN, R_MAX]` (4–60) que `isValidElement` exige — y tanto
  `restoreAutosave` como `importJSON` filtran con esa validación. Con el radio
  de fábrica (24) bastaba escalar ×2,5. El comentario contiguo explicaba por
  qué el *grano* no escala («un resize que lo sacara de rango dejaría ese mando
  mintiendo»)… el mismo razonamiento que no se aplicó al radio.
- **Arreglo:** clamp en `scaleElement` (app.js), el único camino por el que
  pasan los tres gestos de resize.
- **Guardia:** *"escalar un aerógrafo mantiene la boquilla en rango y la mancha
  sobrevive a la recarga"* en `tests/app-interaction.test.js` — escala a lo
  grande y a lo chico, valida con `isValidElement` y recarga la app con esas
  manchas en el autosave. **Verificada fallando sin el clamp.**
- **Lección:** todo campo que la validación de import acota tiene que estar
  acotado también en cada operación que lo recalcula — la pareja
  validación/mutación se rompe por el lado que nadie mira.


### v2.30.0 — Con la fuga a 0°, 180° o 360°, el modo «De pie» no dibujaba NADA

- **Síntoma:** con Pirámide o Tronco «de pie» y el «Ángulo de fuga» en 0, 180 o
  360 —tres posiciones directas del deslizador—, arrastrar sobre el lienzo no
  producía ni figura ni previsualización ni aviso: la herramienta parecía
  muerta. 2 780 combinaciones afectadas en la rejilla de la auditoría.
- **Causa:** `_upright` tumba la sección usando `d.y` como profundidad; con la
  fuga horizontal (`sin θ = 0`) todos los puntos de la base proyectada caían en
  la misma Y, `_shoelace` daba 0 y `if (!area) return []` descartaba la figura
  entera. El suelo de fuga existente (`minLen`) sólo acota la **longitud** de
  `d`, no su componente vertical, así que no protegía de este caso.
- **Arreglo:** un segundo suelo en `_upright` para `|d.y|`
  (`max(6, 0.06·box.h)`); a cero exacto se inclina mirando desde arriba, como
  la fuga de fábrica.
- **Guardia:** *"de pie, la fuga horizontal (0°/180°/360°) sigue dibujando la
  figura"* en `tests/solid.test.js` — las 10 secciones × 2 remates × 3 ángulos,
  exigiendo figura no vacía y campos finitos. **Verificada fallando sin el
  suelo vertical.**
- **Lección:** un clamp que protege una magnitud derivada (la longitud) no
  protege sus componentes: si una fórmula se anula con una componente concreta,
  esa componente necesita su propio suelo.


### v2.30.0 — Girar una figura «de pie» y regenerarla la sustituía por OTRA figura

- **Síntoma:** dibujar una pirámide de pie, girarla un cuarto de vuelta con
  `←`/`→` o `Shift+R` (queda tumbada) y tocar cualquier mando que regenere
  (rellenarla, un deslizador, el color): la figura tumbada desaparecía y en su
  lugar aparecía una pirámide **erguida**, de otra posición y otro tamaño.
  Contradecía el contrato documentado («regenerar conserva dónde está y cuánto
  mide aunque la hayan movido, escalado o girado»). Confirmado por dos
  auditores independientes.
- **Causa:** `_upright` sólo sabe construir figuras erguidas (base horizontal,
  punta vertical). `rotateAround` giraba `solidMeta.gesture` y ajustaba
  `angle` creyendo que con eso bastaba —es lo que funciona en el modo de
  siempre—, pero **ningún par (gesto girado, fuga ajustada) representa una
  figura tumbada**: `regenerateSolid` reconstruía una erguida sobre el gesto
  girado.
- **Arreglo:** en modo `upright`, `rotateAround` deja el gesto y la fuga
  quietos y **acumula los cuartos de vuelta pendientes en `solidMeta.turns`**;
  `regenerateSolid` reconstruye la figura erguida y le re-aplica esos giros
  alrededor de su centro (un cuarto de vuelta conserva el centro del bbox), y
  después la recoloca sobre el centro de la figura en pantalla — lo que absorbe
  el caso de haber girado junto a otros elementos, donde el pivote no fue el
  suyo. `isValidElement` acepta el campo opcional (`turns` entero 1–3, sólo con
  gesto).
- **Guardia:** *"una pirámide DE PIE girada un cuarto sigue tumbada y en su
  sitio tras regenerarla"* en `tests/app-interaction.test.js` — gira con `→`,
  rellena, y compara el bbox de las aristas antes y después a 1e-6.
  **Verificada fallando sin la re-aplicación de `turns`.**
- **Lección:** cuando una transformación no es representable en los parámetros
  de un generador, no se fuerza en ellos: se guarda como transformación
  pendiente y se re-aplica al resultado.


### v2.30.0 — Un sólido de sección pentagonal girado con las flechas saltaba 18° al regenerarlo

- **Síntoma:** prisma pentagonal (o de estrella de 5), girado un cuarto de
  vuelta con `→`, y luego marcar «Rellenar»: la figura entera saltaba
  visiblemente de 90° a 108°, como si se recolocara sola. Sólo pentagon y
  star5 — los dos únicos tipos cuyo paso (36°) no divide a 90; triángulo,
  cuadrado, hexágono, star6 y trapecio salían exactos.
- **Causa:** el giro de grupo escribe `rotation: 90` en la cara frontal — una
  orientación legítima e importable, aunque no sea múltiplo del paso. Pero
  `regenerateSolid` volvía a pasar ese valor por `_rotationFor`, la
  cuantización pensada para el MANDO del modal, que lo redondeaba al paso:
  `round(90/36)·36 = 108`.
- **Arreglo:** `Solid.elements` acepta `solidRotationExact` (sin cuantizar,
  sólo normalizado a [0,360)) y `regenerateSolid` lo usa siempre que el cambio
  pedido no sea precisamente la rotación del mando.
- **Guardia:** *"girar un prisma pentagonal con «→» y rellenarlo conserva el
  giro exacto"* en `tests/app-interaction.test.js`. **Verificada fallando sin
  la rotación exacta.**
- **Lección:** la cuantización pertenece al mando que la necesita, no a la
  función de geometría: aplicada en el sitio común, castiga a todos los caminos
  que ya llevaban un valor exacto.


### v2.30.0 — Un sólido «de pie» vaciado perdía su color de relleno

- **Síntoma:** pirámide de pie creada con relleno verde → desmarcar
  «Rellenar» → volver a marcarlo: reaparecía rellena con el color del
  **trazo**, no con el verde. En el modo de siempre funcionaba (documentado:
  «vaciar y volver a rellenar recupera el mismo»).
- **Causa:** en modo `depth` la cara frontal conserva `fillColor` incluso sin
  relleno, pero de pie **no hay cara frontal** y las laterales sólo se emiten
  rellenas: al vaciar, ninguna pieza guardaba ya el color, y el siguiente
  rellenado caía en `fillColor || color`.
- **Arreglo:** el color viaja como campo opcional de `solidMeta`
  (`fillColor`, hex validado), estampado al crear y al regenerar; el fallback
  de `relleroDe` lo lee cuando no queda ninguna cara.
- **Guardia:** *"un sólido de pie vaciado recupera SU color de relleno al
  rellenarlo otra vez"* en `tests/app-interaction.test.js`. **Verificada
  fallando sin el fallback del meta.**
- **Lección:** «la ausencia del campo es el default» exige saber dónde vive el
  campo: si el portador natural (la cara) es opcional, el dato necesita un
  portador que siempre exista.


### v2.30.0 — La cara rellena de una esquina redondeada salía en pajarita

- **Síntoma:** en un prisma/pirámide/tronco de sección «Caja redondeada» con
  relleno, la cara emitida para la esquina donde la silueta hace tangencia era
  un polígono autointersecado. En opaco lo tapaba la cara frontal; en
  translúcido dejaba una cuña de tono doble junto a esa esquina — y viajaba
  igual al SVG. 2 100 combinaciones en la rejilla, incluida la configuración
  de fábrica.
- **Causa:** la cara de un arco de esquina se emitía entera con la visibilidad
  de su **cuerda** (`vis[i]`), pero en la esquina que contiene el punto de
  tangencia parte del cuarto de cilindro se ve y parte no: la arista de cierre
  cruzaba el arco frontal.
- **Arreglo:** en `_extrude`, la visibilidad de una cara de arco se decide por
  **sub-tramo muestreado** y se emite una cara por cada tramo visible seguido.
- **Guardia:** *"las caras de la caja redondeada rellena son polígonos simples,
  sin pajaritas"* en `tests/solid.test.js` — test de cruce transversal entre
  todas las parejas de lados no adyacentes, en los 3 remates × 4 ángulos.
  **Verificada fallando contra la emisión por cuerda.**
- **Lección:** una propiedad decidida sobre un agregado (la cuerda) no vale
  para sus partes cuando la frontera puede caer dentro: se decide a la
  resolución a la que se dibuja.


### v2.30.0 — La Ayuda y el README estrenaron el modo «De pie» sin contarlo

- **Síntoma:** el mando «Eje» de Pirámide y Tronco (v2.27.0–2.28.0) no
  aparecía ni en la sección «Figuras 3D» de la Ayuda ni en el README: la misma
  clase de olvido que la v2.25.1 corrigió tres veces.
- **Causa:** la funcionalidad se documentó en CLAUDE.md y BUGS.md (para quien
  desarrolla) pero no donde lee el usuario, y ninguna guarda lo exigía.
- **Arreglo:** un punto nuevo en la lista de la Ayuda y una frase en la fila
  «Volumen a tu gusto» del README.
- **Guardia:** *"la Ayuda y el README cuentan el modo «De pie» mientras exista
  su mando"* en `tests/smoke.test.js` — si `#pyramid-apex` existe en el HTML,
  ambos documentos deben mencionarlo. **Verificada fallando al quitar el punto
  de la Ayuda.**
- **Lección:** ya existía para los recuentos y para los mandos retirados; la
  regla general es que un mando nuevo se ata a su documentación igual que un
  número: con una guarda que muera con él.


### v2.30.0 — `_uppercase.scss` rescataba una clase que no existe

- **Síntoma:** ninguno visible — latente. El partial rescataba de las
  mayúsculas `.canvas-area__text-editor`, pero la clase real del editor
  flotante es `.canvas-area__text-input`: el selector no casaba con nada y el
  editor sólo quedaba protegido de rebote por la regla genérica `textarea`. Si
  el editor dejara de ser un `<textarea>`, se escribiría viendo mayúsculas
  mientras el elemento guarda otra cosa — el mando que miente contra el que el
  propio partial se escribió.
- **Causa:** un selector de clase que no casa no falla en ningún sitio: ni
  Sass, ni stylelint, ni el navegador.
- **Arreglo:** una palabra en `src/scss/base/_uppercase.scss`.
- **Guardia:** *"los selectores de rescate de _uppercase.scss casan con clases
  reales"* en `tests/smoke.test.js` — cada clase que el partial nombra debe
  existir en `index.html`. **Verificada fallando con el selector viejo.**
- **Lección:** la misma que la de los `var()` sin definir de la v2.0.0: lo que
  el CSS referencia por nombre y nadie valida, se ata con una guarda textual.


### v2.27.1 — La pirámide de pie salía con las aristas de detrás sólidas y las de delante a trazos

- **Síntoma:** en la Pirámide con el vértice «en el plano», las líneas
  discontinuas estaban justo al revés: el borde trasero de la base se dibujaba
  sólido y cruzaba por delante de la figura, mientras que el borde de delante y
  la arista del vértice más cercano salían punteados. En el cono, la mitad de
  la base que se tapaba era la que se tenía que ver. Reportado por el usuario
  con una captura.
- **Causa:** dos signos, cada uno por su lado.
  1. `_faceVisible` decide con el signo del área proyectada **contra un signo de
     referencia**, y en `_extrude` ese signo lo pone la cara frontal, que mira al
     observador. En `_upright` no hay cara frontal y se le pasó el de la base…
     que mira al **suelo**, es decir, en sentido contrario. Todo el criterio
     quedó invertido.
  2. En la base redonda, el ángulo con el que se emiten los dos arcos se calculó
     como `+2πi/n` sobre el índice del muestreo, pero `proj` invierte el seno al
     tumbar la sección: el parámetro que corresponde a la muestra `i` es
     `−2πi/n`. Los dos arcos salían intercambiados.
- **Arreglo:** `-sigma` como referencia en `_upright`, y `ang(i) = −2πi/n` con el
  ángulo decreciendo al crecer el índice.
- **Guardia:** dos tests en `tests/solid.test.js` — *"de pie, lo que se tapa son
  las aristas de DETRÁS (caso canónico)"*, resuelto a mano sobre una base
  cuadrada y con la dirección de visión deducida de la propia proyección
  (`δX = −dx·δZ`, `δY = dy·δZ` ⇒ se mira desde `(+X, +Y, −Z)`), y *"de pie, el
  cono enseña la mitad de la base que da al observador"*. **Verificados fallando
  contra cada una de las dos mutaciones.**
- **Lección:** el modo se dio por bueno mirando capturas de figuras grandes, donde
  la inversión no salta a la vista. Un criterio de visibilidad no se valida a
  ojo: se resuelve un caso pequeño a mano y se fija en un test — que es
  exactamente lo que ya hacía la regla del cubo canónico de la v2.24.0.


### v2.25.4 — El relleno «sólido» de una figura 3D salía MÁS transparente que el translúcido

- **Síntoma:** se dibuja un sólido en hueco, se vuelve a seleccionar y se marca
  «Rellenar las caras»: la figura se pintaba de un tono lavado, a un paso del
  papel, en vez de opaco. Y al marcar además «Relleno translúcido» quedaba
  **más** cubierta que en el modo llamado sólido. Reportado por el usuario.
- **Causa:** las caras y la cara frontal se emitían **sin `fillColor`** cuando el
  usuario no había elegido uno, y ahí `Renderer.fillStyle` cae en el tinte
  clásico del trazo, `color + '20'` — un 12 % de opacidad. El modo translúcido,
  en cambio, usa `fillOpacity` con su 40 % de fábrica, así que salía tres veces
  más cubriente que el «sólido». Ese tinte al 12 % es retrocompatibilidad
  deliberada de las **formas planas** (un proyecto viejo tiene que dibujarse
  igual), pero un sólido 3D es de la v2.24.0: no hay nada anterior que conservar,
  y ahí «sólido» sólo puede significar opaco.
- **Arreglo:** `_face` y `_frontEl` (`src/js/solid.js`) estampan **siempre**
  `fillColor: o.fillColor || o.color` cuando hay relleno — el color que el propio
  selector del modal está enseñando, en vez de uno que no aplica. Sin relleno se
  conserva el `fillColor` elegido, si lo había, para que vaciar y volver a
  rellenar recupere el mismo color, pero no se inventa uno derivado del trazo.
- **Guardia:** `tests/solid.test.js` («el relleno sólido de un sólido es OPACO…»)
  y un spec en `e2e/solids.spec.js` («rellenar un sólido ya dibujado lo pinta
  OPACO…»), que mide la luminancia real de la banda central del lienzo en los dos
  modos. **Verificado fallando** con el emisor anterior.

### v2.25.2 — En una figura 3D no se podía cambiar el color de las aristas ni el de los lados

- **Síntoma:** con un sólido ya dibujado y seleccionado se le podía cambiar la
  posición y el tamaño, pero no el color. Reportado por el usuario.
- **Causa:** tres cosas encadenadas.
  1. `selectTool` vaciaba la selección con las herramientas 3D — no están en
     `MODAL_EDIT_TYPE`, que empareja herramienta con un tipo de elemento exacto,
     y un sólido no tiene uno—, así que su modal pasaba a configurar el sólido
     siguiente y sus mandos no tocaban la figura seleccionada.
  2. Las **caras laterales son elementos** y sólo se emiten al crear la figura.
     Un sólido dibujado sin relleno no las tiene, de modo que marcar «Rellenar
     las caras» después sólo pintaba la cara frontal: no había lados que
     colorear. Es un defecto de diseño de la v2.25.0 — el relleno se hizo una
     decisión de creación en vez de una propiedad editable.
  3. `syncSolidControls` leía el valor de **un** elemento (`selection.length === 1`),
     y un sólido son siempre varias piezas, así que caía a los valores de
     fábrica. Como corre en cada repintado, **desmarcaba la casilla de relleno
     justo después de marcarla**. Es el mismo fallo que tuvo `syncStrokeControls`
     en la v2.16.3.
- **Arreglo:** (1) una herramienta 3D conserva la selección cuando ésta es una
  figura 3D completa (`selectedSolid()`); (2) `regenerateSolid()` vuelve a crear
  el sólido con el ajuste nuevo, reconstruyendo el arrastre equivalente **desde
  la propia cara frontal** —así conserva sitio y tamaño aunque lo hayan movido,
  escalado o girado— con `solidMeta` guardando lo único que no se deduce, el
  remate y la proyección; (3) `syncSolidControls` usa `commonOf`.
- **Guardia:** tres tests en `tests/app-interaction.test.js` («pulsar la
  herramienta 3D con un sólido puesto lo EDITA…», «rellenar un sólido ya
  dibujado le CREA las caras…», «regenerar un sólido es UN paso de deshacer…») y
  dos specs en `e2e/solids.spec.js`. Los cinco **verificados fallando** con su
  mutación. El tercer fallo no lo mata ninguna guarda del arnés vm y sí las e2e:
  sólo se manifiesta con el ciclo de repintado real, que es exactamente la
  frontera que separa `tests/` de `e2e/`.

### v2.25.1 — La Ayuda de la app describía tres cosas que ya no eran verdad

- **Síntoma:** ninguno visible en el dibujo, y por eso duró tanto. La Ayuda (`?`
  de la barra superior) mandaba al usuario a mandos que no existen y le daba una
  cifra falsa:
  1. del **borrador** decía que el ⚙ de la cabecera «Trazo» del panel reabre su
     modal de tamaño. Esa sección se quedó **sin ⚙** en la v2.21.0 —su botón
     abría cinco modales distintos según la herramienta activa, que es justo lo
     que el panel dejó de hacer—; lo reabre volver a pulsar la herramienta;
  2. del **emoji** decía que su tamaño lo fija el deslizador «Texto». Tiene el
     suyo propio, en su catálogo y de 32 a 96 px, desde la v2.10.0: se
     independizó precisamente para que agrandar un emoji no encogiera el texto
     siguiente;
  3. del **jardín** decía «40 especies vegetales». Son **49** desde que llegaron
     aromáticas y trepadoras.
- **Causa:** la Ayuda es HTML suelto en `index.html` y **nada la ataba al
  código**. Cada una de las tres frases fue verdad el día que se escribió y
  ninguna prueba se enteró de que dejaba de serlo, porque no había ninguna que
  las mirara: el arnés vm sólo consulta la Ayuda para comprobar que el modal
  existe y se puede cerrar.
- **Arreglo:** corregidas las tres, y las figuras 3D pasan a tener su propia
  sección en la Ayuda en vez de dos líneas sueltas en «General».
- **Guardia:** dos tests en `tests/smoke.test.js`. *«los recuentos que afirman la
  Ayuda y el README salen de los catálogos»* extrae cada cifra del texto («N
  especies vegetales», «N figuras», «N diseños de forja»…) y la compara con
  `config.js`, y exige que sigan existiendo al menos siete cifras, para que
  borrarlas no sea una forma de aprobar. *«la Ayuda no describe mandos que ya no
  existen»* comprueba que «Trazo» sigue sin ⚙ en el HTML y que la Ayuda no manda
  ahí, y que no ata el tamaño del emoji al deslizador de Texto; trabaja sobre el
  texto **sin etiquetas**, porque la primera versión miraba el marcado y no
  detectaba la frase con un `<strong>` en medio. Las tres verificadas
  reintroduciendo su error.

### v2.25.0 — El ecuador de la esfera salía entero discontinuo

- **Síntoma:** una esfera se dibujaba con sus dos medias elipses del ecuador a
  trazos, en vez de una vista y otra oculta. Sin relleno pasaba desapercibido
  —dos arcos discontinuos siguen leyéndose como una esfera—; al estrenar el
  relleno de caras se volvió evidente: una esfera rellena salía como un
  **círculo plano**, sin ecuador ninguno.
- **Causa:** dos cosas a la vez. El recorte de líneas ocultas (`_occlude`) marca
  discontinua toda pieza que pase por detrás de la cara frontal, y el ecuador va
  justo por DENTRO del círculo, así que lo daba por tapado. Y el orden de
  emisión ponía la cara frontal la última, de modo que su relleno tapaba
  cualquier arista que cayera dentro de ella.
- **Arreglo:** la esfera se excluye del recorte —es el único caso, porque su
  ecuador es una línea sobre la superficie y no una arista de detrás— y el orden
  pasa a `[ocultas, caras, frente, aristas vistas]`, con las vistas encima del
  relleno.
- **Guardia:** *«el ecuador de la esfera tiene una mitad vista y otra oculta»* y
  *«el orden de emisión es ocultas, caras, frente y aristas vistas encima»* en
  `tests/solid.test.js`, más el spec e2e del relleno. La primera comprueba
  además que la mitad vista se emite DESPUÉS del círculo.

### v2.24.0 — La previsualización del arrastre ignoraba el trazo discontinuo de cada pieza

- **Síntoma:** con «Discontinuo» marcado en el panel, la previsualización de
  cualquier herramienta compuesta (un árbol del Jardín, una fachada) salía
  **punteada entera** mientras se arrastraba, y al soltar aparecía sólida. Con
  las figuras 3D era peor y al revés: la mitad de sus aristas son ocultas y
  deben salir discontinuas, y en la previsualización salían **todas** así.
- **Causa:** `drawPiecesPreview` (app.js) nunca miraba `el.dash`. Heredaba el
  `setLineDash` global que `paintOverlay` deja puesto para el marco del
  arrastre, así que el guion no dependía de la pieza sino del ajuste de trazo
  activo. Un comentario en esa misma función avisaba de esta clase de fallo
  —«todo tipo que una herramienta de creación pueda emitir TIENE que estar
  aquí»— pero sobre los *tipos*, no sobre sus atributos.
- **Arreglo:** fijar `octx.setLineDash(el.dash ? [4·lw, 4·lw] : [])` **por
  pieza y en las dos ramas**, con la misma fórmula del renderer. Las dos ramas
  son obligatorias: poniendo sólo la de `true`, el guion se filtra a la pieza
  siguiente. De paso se arreglaron las seis miniaturas de los modales, que
  pasan todas por esta función.
- **Bonus de la misma zona:** la función sólo sabía dibujar `line`, `rect`,
  `circle`, `curveArrow` y `text`. La cara frontal de un sólido es un
  `pentagon`/`star6`/…, así que **no se dibujaba**: se delega en
  `Renderer.renderElement`, con un seed fijo si la pieza no lo trae (los
  generadores no lo ponen, y sin él Sketchy cae en `Math.random` y el temblor
  hierve en cada fotograma).
- **Guardia:** `e2e/solids.spec.js` — «la previsualización dibuja lo mismo que
  aparece al soltar» compara la tinta del overlay durante el arrastre con la
  del lienzo al soltar, y «la previsualización trae la cara frontal…» recorre
  el borde izquierdo de la cara exigiéndolo continuo. **Verificadas fallando**
  con las dos mutaciones (quitar el `setLineDash` por pieza y quitar la
  delegación en el renderer). Tenía que ir a `e2e/`: el arnés `node:vm` no
  pinta, así que no ve ni el guion ni lo que falta.

### v2.23.0 — La build de `dist/` se queda atrás y aparenta que la herramienta nueva no existe

- **Síntoma:** las dos estrellas se habían añadido al grupo «Formas», estaban en
  `config.js`, pasaban los 640 tests del arnés `node:vm` y los tres `e2e`… y en
  el navegador del usuario no salían sus botones. Comprobado sirviendo la raíz
  del repo con Playwright, sí salían — dos veces, con captura del sidebar. El
  usuario seguía sin verlas.
- **Causa:** estaba abriendo `dist/index.html`, la build publicable, generada
  antes del cambio y por tanto **congelada en la v2.22.1**: `dist/js/config.js`
  no contenía `star5` y `dist/index.html` pedía sus scripts con `?v=2.22.1`.
  `dist/` está en `.gitignore` y no se regenera solo, así que puede quedarse
  atrás indefinidamente. Y no hay **ninguna** señal en pantalla: la app abre, se
  dibuja, funciona entera — simplemente es otra versión de la app, con una
  herramienta menos en el sidebar. La chapa de versión de la topbar lo dice,
  pero es lo último que uno mira cuando falta un botón. Es exactamente el tipo
  de fallo que hace perder la tarde depurando código que ya estaba bien.
- **Fix:** `npm run build`, que regenera `dist/` con la versión en curso.
- **Guardia:** `tests/smoke.test.js` — *si dist/ existe, es de la versión que
  dice package.json* (compara todos los `?v=` y la chapa de la topbar contra
  `package.json`; se calla si no hay `dist/`, porque es opcional y regenerable).
  Verificada retrocediendo `dist/index.html` a 2.22.1: falla nombrando las dos
  versiones y pidiendo el build.
- **Recordatorio:** al verificar en el navegador un cambio que "no se ve",
  comprobar **primero desde qué ruta se está abriendo la app** —raíz del repo,
  `dist/` o `file://`— antes de dar por bueno un "yo sí lo veo".

### v2.22.1 — «Limpiar todo» dejaba dieciséis ajustes sin resetear

- **Síntoma:** el botón promete la app recién abierta, pero tras pulsarlo
  seguían puestos el color elegido, el grosor, el tamaño de letra, el relleno
  entero (activado, translúcido, opacidad y color), el trazo discontinuo, la
  doble punta, la cuadrícula apagada, «Ajustar a cuadrícula», «Los clics
  acumulan selección», la letra del lienzo y los tres ajustes del estilo de
  texto (negrita, sombra y su color). Tampoco volvía la herramienta activa.
- **Causa:** el handler reseteaba **a mano** una lista corta de ajustes
  (fondo, cuadrícula, solapamiento, borrador, `CREATION_DEFAULTS`, emoji y
  rótulos de UI). Esa lista había que ampliarla con cada ajuste nuevo y se fue
  quedando atrás. Peor: los ajustes que se persisten seguían vivos en `state`
  aunque el botón borrase la clave de `localStorage`, así que el primer
  `savePrefs()` posterior —cambiar el color del fondo, por ejemplo— los volvía
  a escribir enteros y reaparecían en la recarga siguiente. El tamaño del
  borrador tenía además su propio caso: `state.eraserSize` sí se reseteaba,
  pero su mando solo lo escribían `applyEraserSize` y `openEraserSizeModal`, así
  que el deslizador seguía enseñando el tamaño anterior.
- **Fix:** `appDefaults()` (src/js/app.js) es ahora la fuente **única** de los
  valores de fábrica, y la usan tanto el `state` inicial como el botón, que hace
  `Object.assign(state, appDefaults())`. Es una función y no un objeto porque
  `uiLabels` se muta en sitio y compartir la referencia devolvería lo último
  escrito en vez del valor de fábrica. Los mandos se refrescan desde
  `syncAllControls()`, que llaman el arranque y el botón —antes cada uno
  refrescaba su propia lista—, y el tamaño del borrador estrena
  `syncEraserControls()` con el mismo refactor que ya tenía el emoji. La
  herramienta vuelve al **Lápiz** con `silent`, para no abrir sus ajustes encima
  del lienzo recién vaciado.
- **Guardia:** `tests/app-interaction.test.js` — *«Limpiar todo» devuelve TODOS
  los ajustes a los de fábrica, no solo unos cuantos* (compara treinta mandos
  contra un arranque limpio, y exige haber tocado al menos veinte antes de
  limpiar para que no pase en vacío) y *tras «Limpiar todo», el siguiente
  guardado no resucita los ajustes borrados*.

### v2.16.3 — un arrastre por el color de la sombra vaciaba el historial de deshacer

- **Síntoma:** con un texto con sombra seleccionado, arrastrar el cursor por el
  selector de color de la sombra **borraba el historial de deshacer**. Después,
  Ctrl+Z iba revirtiendo tonos intermedios de uno en uno, y todo el trabajo
  anterior había desaparecido sin aviso.
- **Causa:** el diálogo nativo de un `<input type="color">` no manda un solo
  aviso al soltar: dispara un `input` **por cada tono que se pisa**, decenas en
  un arrastre normal. `applyTextShadowColor` llamaba a `saveUndo()` en cada uno,
  y como `UNDO_LIMIT` es 50 y `pushUndo` hace `shift()` al superarlo, un único
  gesto expulsaba casi todas las entradas útiles. La app ya tenía este patrón
  resuelto en los otros cinco controles continuos (color de trazo, color de
  relleno, grosor, opacidad y giro), y el comentario del color de relleno
  advierte literalmente de esto; el control nuevo de la v2.16.0 se escribió sin
  aplicarlo. De paso, la rama sin selección llamaba a `savePrefs()` por cada
  tono, machacando `localStorage` durante todo el arrastre.
- **Fix:** `applyTextShadowColor` (src/js/app.js) adopta el patrón de gesto de
  sus hermanos: un `snapshot()` al primer `input` y un solo `pushUndo` en
  `commitTextShadowColorGesture`, enganchado al `change`. Si el gesto termina
  donde empezó se restauran las referencias originales sin apilar nada, y el
  default de creación se persiste al cerrar el gesto, no en cada tono.
- **Guardia:** `tests/app-interaction.test.js` — *«un arrastre por el color de
  la sombra es UN paso de deshacer, no uno por tono»* dispara **60 tonos**
  (más que el límite de 50, que es lo que hace la prueba discriminante:
  con el bug ese solo gesto vaciaba el historial) y comprueba que un Ctrl+Z
  revierte el gesto entero y que el paso anterior **sigue vivo**. Y
  *«ningún picker de color apila más de un paso de undo por gesto»* extiende la
  comprobación a los tres selectores de color a la vez, para que el próximo no
  repita el patrón.

### v2.16.3 — cambiar el tipo de sombra borraba el color elegido para ella

- **Síntoma:** con un texto seleccionado se elegía rojo para su sombra y, al
  cambiar el tipo de «suave» a «halo», la sombra volvía al gris por defecto.
- **Causa:** `applyTextShadowType` estampaba siempre `state.textShadowColor`
  junto al tipo, y el spread del patch gana al valor del elemento. Pero
  `state.textShadowColor` **no se actualiza cuando hay selección**: ahí el
  picker escribe en el elemento y no en el default (semántica dual), así que el
  state seguía en gris y pisaba el rojo recién elegido. Además contradecía al
  propio picker, que para un texto sin color propio enseña
  `DEFAULT_SHADOW_COLOR` — el mismo gris al que ya caen renderer y
  exportadores.
- **Fix:** `applyTextShadowType` (src/js/app.js) cambia **solo el tipo**. Sin
  color propio el elemento se dibuja con `DEFAULT_SHADOW_COLOR`, que es justo lo
  que el control enseña, así que no estampar nada es lo que mantiene de acuerdo
  el picker con el dibujo — y de paso el elemento serializa más ligero. Al
  **crear** sí se estampa, en `textStyleDefaults()`, que es donde el default
  manda y donde el picker sí muestra `state.textShadowColor`.
- **Guardia:** `tests/app-interaction.test.js` — *«cambiar el TIPO de sombra
  conserva el color propio del texto»*.

### v2.16.3 — con varios seleccionados, dos casillas del panel mentían

- **Síntoma:** seleccionar tres flechas discontinuas y con doble punta y pulsar
  la herramienta Flecha para editarlas mostraba **«Trazo discontinuo» y «Doble
  punta» desmarcadas**, aunque las tres lo estuvieran. Marcarlas apilaba además
  un paso de deshacer que no deshacía nada visible.
- **Causa:** `syncStrokeControls` escribe en `#check-dash` y
  `#check-double-head`, que son del **panel**, no del modal. Con una
  multiselección su `single` es `null` y caía a `state.dashed`/`state.doubleHead`
  —los defaults de creación—, pisando en cada frame el valor común que
  `redrawNow` acababa de calcular bien con `commonOf` (regla v2.12.0). Bastaba
  con tener abierto `#modal-stroke` para que ganara siempre el valor falso,
  porque `syncPanelSections` vuelve a llamar a la función al final de cada
  repintado. Era la única de las tres funciones hermanas sin la regla:
  `syncShapeControls` tiene un `return` temprano y `syncTextControls` usa
  `commonOf`.
- **Fix:** `syncStrokeControls` (src/js/app.js) calcula grosor, color,
  discontinuo y doble punta con `commonOf` sobre los elementos a los que cada
  control **afecta**, y no escribe nada cuando no hay valor común. De paso, las
  dos filas del modal se habilitan mirando toda la selección y no solo el
  elemento único.
- **Guardia:** `tests/app-interaction.test.js` — *«con varios seleccionados el
  panel enseña su valor común, no los defaults»*.

### v2.16.2 — el modal de texto dejaba la app bloqueada en ventanas bajas

- **Síntoma:** reportado por el usuario como «no funciona, cuando intentas
  teclear texto no funciona». Al elegir la herramienta **Texto** se abre su
  modal de ajustes; en una ventana de altura corriente ese modal no cabía y su
  botón **«Cerrar» quedaba por debajo del borde de la pantalla**. Como un
  `<dialog showModal>` vuelve **inerte** todo lo que hay detrás, el lienzo
  dejaba de responder: no se podía clicar, ni dibujar, ni escribir. La
  aplicación entera parecía rota, y nada indicaba que el diálogo se podía
  desplazar para llegar al botón.
- **Causa:** la v2.16.0 añadió tres controles al modal (negrita, sombra y
  color de sombra) y su alto natural pasó de los ~500 px que caben en un
  portátil con la barra de marcadores abierta. El diálogo ya tenía
  `max-height` y `overflow-y: auto`, así que técnicamente se podía desplazar,
  pero el botón viajaba con el contenido y no había forma de verlo. Nada lo
  detectó: el arnés `node:vm` no tiene layout y los specs de e2e usaban
  viewports altos, donde el modal sí cabe.
- **Fix:** `.modal__cancel` (src/scss/components/_modal.scss) pasa a ser
  **pegajoso al fondo** del diálogo. Es regla del bloque, no de ese modal: le
  habría pasado a cualquiera que creciera. Tres detalles que costaron dos
  intentos: `bottom` debe ser **0 y nunca negativo** —un valor negativo le
  devuelve justo el permiso de quedarse por debajo del borde—, un margen
  inferior negativo lo despega y deja asomar por el hueco el control de
  detrás, y como un elemento pegajoso se ancla al borde de su bloque
  contenedor (la caja de **contenido**), hace falta una segunda sombra sin
  desenfoque que tape los 2.8 rem de relleno que quedan a sus pies.
- **Guardia:** `e2e/modal-fit.spec.js` — los cinco modales de ajustes, en una
  ventana **deliberadamente baja** (1160×560, que es donde el fallo se
  reproduce: con los 700 de `NARROW` el modal cabe y la guarda no guardaría
  nada). Comprueba que el botón cae dentro de la ventana, que se puede
  **pulsar de verdad** (Playwright falla si algo lo tapa) y que al cerrarlo el
  lienzo vuelve a responder, que es el síntoma tal como se reportó. Verificado
  que la guarda falla al revertir el arreglo.

### v2.12.1 — lanzar un objeto fuera del lienzo lo perdía

- **Síntoma:** seleccionar algo y arrastrarlo deprisa fuera del lienzo lo hacía
  **desaparecer**. Y no era solo visual: el elemento seguía en la escena
  (contaba en «Elementos») y viajaba dentro del JSON y de las exportaciones,
  pero quedaba invisible e **inalcanzable** — el clic no llega ahí fuera y una
  marquesina solo puede dibujarse sobre el lienzo, así que ni seleccionándolo
  todo volvía—. La única vía de vuelta era Ctrl+Z, y solo si te dabas cuenta
  en el momento. Reportado con el arrastre; la sonda demostró que las **teclas
  de flecha** (mantener `Shift`+flecha) y **teclear una X o Y** en «Posición y
  tamaño» lo perdían exactamente igual, solo que más despacio.
- **Causa:** nada sujetaba el desplazamiento. `onMouseDown` hace
  `setPointerCapture`, así que el arrastre sigue vivo fuera del lienzo y
  `getPos` devuelve coordenadas muy por encima de `CANVAS_W`/`CANVAS_H`;
  `onMouseMove` las aplicaba tal cual. El lienzo tiene un tamaño fijo
  (1200×800) pero nada relacionaba las coordenadas de los elementos con él.
- **Fix:** `clampDelta` (app.js) recorta el desplazamiento para que siempre
  queden `KEEP_VISIBLE` (24) px del objeto dentro del lienzo —o el objeto
  entero, si es más pequeño—, y `moveSelectionBy` lo aplica en las tres vías.
  Dos decisiones deliberadas: (1) se sujeta la caja **combinada** de la
  selección, nunca pieza a pieza, o un edificio frenado se desmontaría contra
  el borde; (2) solo se limita el movimiento que **empeora**, así que un
  elemento que ya estuviera fuera —un JSON anterior a esta versión— puede
  volver hacia dentro, y mover una selección que lo contenga no le da un
  tirón que rompa su posición relativa. `dragLast` guarda la posición **real**
  del puntero, no la recortada: al volver hacia dentro el objeto lo acompaña
  desde el primer píxel, sin zona muerta.
- **Guardia:** `tests/app-interaction.test.js` › *"lanzar un objeto fuera del
  lienzo lo frena en el borde, y sigue siendo alcanzable"* (que además lo
  vuelve a seleccionar con marquesina, porque «alcanzable» es el síntoma real),
  *"el freno del borde vale también para las teclas de flecha"*, *"el freno del
  borde no deforma un grupo: se para entero"*, *"una X tecleada fuera del
  lienzo también se frena, y el campo lo confiesa"* y *"un elemento que YA
  estaba fuera puede volver hacia dentro"*.

### v2.12.0 — pulsar «Mover» soltaba la selección múltiple

- **Síntoma:** seleccionar varios objetos (enmarcándolos con «Select», o con
  cualquier otra vía: marquesina, Shift, «Los clics acumulan») y pulsar
  **Mover** para desplazarlos: el arrastre movía **solo** el objeto sobre el
  que caía el puntero, y el resto se quedaba donde estaba. Reportado por el
  usuario nada más estrenar «Select», que es la herramienta que hace evidente
  el reparto —enmarcar con una, mover con la otra—.
- **Causa:** `selectTool` vaciaba la selección salvo que la herramienta
  estuviera en `MODAL_EDIT_TYPE` (la tabla de «pulsar la herramienta del
  elemento seleccionado lo edita», v2.10.0). Ni Mover ni «Select» están ahí
  —no tienen modal de ajustes—, así que ambas caían en el `setSelection([])`
  heredado del «vaciar siempre» anterior a la 2.10.0. Con la selección ya
  vacía, el arrastre entraba por la rama 4 de `onMouseDown` (clic sobre un
  elemento: seleccionar e iniciar drag) y movía ese uno.
- **Fix:** `SELECTION_TOOLS` (app.js) — Mover y «Select» son las dos
  herramientas que trabajan **sobre** la selección (una la desplaza,
  redimensiona y duplica; la otra la construye), así que ninguna la vacía al
  elegirla. El resto no cambia: las de creación, el Borrador, Emoji y los
  catálogos siguen vaciando como siempre.
- **Guardia:** `tests/app-interaction.test.js` › *"seleccionar varios con
  «Select» y pulsar Mover los mueve TODOS a la vez"*, *"y al revés: con varios
  seleccionados en Mover, pulsar «Select» tampoco los suelta"* y *"una
  herramienta de creación sigue vaciando la selección al elegirla"* (esta
  última fija que el arreglo son las dos de Edición, no una vuelta atrás).

### Auditoría v2.10.1 — el lado tecleado perdía contra una caja fraccionaria

- **Síntoma:** con un pentágono (o cualquier caja de medidas fraccionarias —
  con el auto-zoom del 120% lo es casi todo, porque `getPos` divide por 1.2),
  teclear el **alto** en «Posición y tamaño» no hacía nada: el elemento se
  quedaba prácticamente igual. Dos hermanos del mismo parser: **vaciar** un
  campo colapsaba el elemento (Ancho → 1px, X → 0), y teclear una medida que
  la geometría no puede absorber (el alto de una línea horizontal) apilaba un
  paso de deshacer fantasma — el primer Ctrl+Z parecía muerto.
- **Causa:** los campos *enseñan* valores redondeados (`put` hace
  `Math.round`), pero `applyGeometry` comparaba lo tecleado contra la caja
  **exacta**: todo campo fraccionario contaba como «cambiado», y como el ancho
  se evalúa primero, ganaba siempre un ancho que nadie había tocado. Además
  `Number('')` es `0`, no `NaN`, así que el fallback pensado para entradas
  inválidas era código muerto; y el guard de no-op comparaba cajas, no el
  efecto (`scaleElement` fuerza `sy = 1` cuando `from.h` es 0).
- **Fix:** `applyGeometry` (app.js) — un lector de campo que decide «cambiado»
  comparando contra lo que el campo **mostraba** (y devuelve el valor exacto
  cuando no cambió), trata `''`/basura como «sin cambio», y un guard de no-op
  por efecto (`dx/dy/sx/sy`) que además resincroniza para que el campo vuelva
  a decir la verdad.
- **Guardia:** `tests/app-interaction.test.js` › *"el lado tecleado manda
  aunque la caja sea fraccionaria"*, *"vaciar un campo de medida no colapsa el
  elemento"* y *"una medida que la geometría no absorbe ni apila undo ni
  miente"*.

### Auditoría v2.10.1 — la medida tecleada para A se aplicaba al B que clicabas después

- **Síntoma:** teclear un ancho en «Posición y tamaño» y, sin confirmarlo,
  clicar otro elemento en el lienzo: el ancho saltaba al elemento recién
  seleccionado.
- **Causa:** en navegador, el `mousedown` que cambia la selección corre ANTES
  que el `blur` → `change` del campo; `applyGeometry` leía el campo contra la
  selección nueva. El redraw que resincroniza va por rAF, siempre posterior.
- **Fix:** `geoFieldsFor` (app.js): `syncGeometryControls` apunta para qué
  selección escribió los campos y `applyGeometry` descarta el change si la
  selección ya es otra (y resincroniza).
- **Guardia:** `e2e/panel.spec.js` › *"un ancho tecleado y sin confirmar no se
  aplica al elemento que se clica después"* — el orden de eventos es
  exactamente lo que el arnés vm no simula; hay además una réplica del orden
  en `tests/app-interaction.test.js` › *"un change rezagado…"*.

### Auditoría v2.10.1 — «Posición y tamaño» muerto con una multi-selección libre

- **Síntoma:** con dos elementos sueltos seleccionados (marquesina o
  Shift+clic), los campos X/Y/Ancho/Alto enseñaban los valores de la selección
  anterior y teclear en ellos no hacía nada — cuando CLAUDE.md y el propio
  panel prometen la caja combinada de cualquier selección.
- **Causa:** la lectura/escritura reutilizaba `selectionGroupBounds()`, que es
  **solo-de-grupo** a propósito (exige `buildingGroupId` compartido: decide la
  caja única con tiradores) y devuelve `null` para multi-selecciones libres.
- **Fix:** `selectionBounds()` (app.js): caja combinada de cualquier
  selección; `syncGeometryControls`/`applyGeometry` la usan, y la escala sigue
  siendo uniforme para toda multi-selección (misma invariante que los grupos).
- **Guardia:** `tests/app-interaction.test.js` › *"la caja escrita también
  funciona con una multi-selección libre, en proporción"*.

### Auditoría v2.10.1 — el rótulo con multi-selección editaba el default de creación

- **Síntoma:** con varios botones seleccionados (el modal de UI los edita:
  color y grosor funcionan), escribir en «Rótulo» no renombraba ninguno… pero
  cambiaba EN SILENCIO el rótulo con el que nacerían los siguientes, y lo
  persistía en prefs. Además el default admitía cualquier longitud al teclear
  y `restorePrefs` lo recortaba a 120: un rótulo largo encogía al recargar.
- **Causa:** el `else` de `applyLabel` no exigía selección vacía — era la
  única fuga de la semántica dual que quedaba (`applyFontSize`, `applyFill`,
  etc. la respetan); y el recorte de 120 vivía solo en la restauración.
- **Fix:** `applyLabel` exige `!state.selection.length` para tocar
  `state.uiLabels` y recorta a 120 al escribir; `syncUiControls` oculta la
  fila de rótulo con multi-selección (un campo visible que no edita nada es un
  callejón sin salida — precedente Muro v2.3.1); `#ui-modal-label` lleva
  `maxlength="120"`.
- **Guardia:** `tests/app-interaction.test.js` › *"con multi-selección el
  rótulo ni edita el default ni se ofrece"*; `tests/smoke.test.js` pina el
  `maxlength`.

### Auditoría v2.10.1 — vaciar un texto desde el panel dejaba un elemento invisible

- **Síntoma:** borrar todo el contenido del campo «Texto» del panel con un
  `text` seleccionado dejaba un elemento con `value:''` — invisible, de caja
  cero, casi imposible de volver a seleccionar. El editor de doble clic
  (`commitText`) en el mismo caso **borra** el elemento: dos vías, dos
  semánticas.
- **Fix:** `applyLabel` borra el `text` vaciado (con su paso de deshacer),
  igual que `commitText`. El rótulo vacío de un componente sigue siendo
  válido: recupera el default del renderer.
- **Guardia:** `tests/app-interaction.test.js` › *"vaciar el texto desde el
  panel lo borra, como el editor de doble clic"*.

### Auditoría v2.10.1 — tiradores dibujados que mentían con la selección conservada

- **Síntoma:** tras pulsar la herramienta de un elemento seleccionado (la
  selección se conserva desde v2.10.0), el lienzo seguía dibujando los
  tiradores de esquina; agarrar uno no escalaba: pintaba un elemento nuevo
  encima y soltaba la selección.
- **Causa:** `redrawNow` dibujaba la selección con tiradores sin mirar la
  herramienta, pero el hit-test de tiradores vive en la rama de **Mover** de
  `onMouseDown`. El estado «selección + herramienta de creación» no existía
  antes de v2.10.0 y nadie revisó esa premisa.
- **Fix:** `handlesOn = state.tool === TOOLS.SELECT` en `redrawNow`: caja
  discontinua siempre (comunica qué se edita), tiradores solo con Mover — los
  de esquina y los de flecha.
- **Guardia:** `tests/app-interaction.test.js` › *"con selección conservada y
  herramienta de creación, la esquina crea"* pina el comportamiento del
  gesto; que los tiradores no se pinten se comprueba a mano (el arnés no ve
  el canvas): rect → Mover → clic → Rectángulo → cerrar modal → sin tiradores.

### Auditoría v2.10.1 — la sección «Texto» quedó muerta para el Emoji

- **Síntoma:** con la herramienta Emoji activa, el deslizador «Texto» del
  panel no hacía nada: desde que el emoji tiene tamaño propio
  (`state.emojiSize`), aquel control editaba un default que `placeEmoji` ya no
  lee — y **antes de v2.10.0 sí mandaba** sobre el emoji (`max(fontSize, 32)`).
  Además, seleccionar un emoji de más de 48px recortaba el deslizador (su
  `max` era 48 y `EMOJI_MAX_SIZE` es 96).
- **Fix:** el patrón del borrador: con Emoji activo, `redrawNow` retitula la
  sección («Emoji», vía `#font-label`) y el deslizador gobierna
  `state.emojiSize` (min 32) a través del punto único `applyEmojiSize`, que
  sincroniza también el deslizador del catálogo. `#font-slider` y
  `#text-modal-size` llegan hasta `EMOJI_MAX_SIZE` (96).
- **Guardia:** `tests/app-interaction.test.js` › *"el emoji se estampa con el
  tamaño elegido en su catálogo"* (ampliada con el retitulado);
  `tests/smoke.test.js` pina el `max` del panel contra `EMOJI_MAX_SIZE`.

### Auditoría v2.10.1 — cancelar un catálogo viniendo de Emoji encadenaba su catálogo

- **Síntoma:** Emoji → cerrar su catálogo → Planta (o Balcón…) → Cancelar: el
  catálogo de Emoji se reabría solo encima del que se acababa de cerrar.
- **Causa:** el retorno tras cancelar usa `selectTool(prev, { silent: true })`
  precisamente para no encadenar modales, pero la rama de Emoji era anterior a
  `silent` y abría incondicionalmente.
- **Fix:** `if (id === TOOLS.EMOJI && !silent)` en `selectTool`.
- **Guardia:** `tests/app-interaction.test.js` › *"cancelar un catálogo
  viniendo de Emoji no reabre su catálogo"*.

### Auditoría v2.10.1 — casillas habilitadas e inertes en el modal de trazo

- **Síntoma:** con el Lápiz, `#modal-stroke` ofrecía «Trazo discontinuo»: la
  muestra se dibujaba discontinua, el trazo real salía continuo (el case
  `pencil` del renderer no tiene dash) y, de propina, quedaba cambiado
  `state.dashed` — la siguiente **línea** nacía discontinua sin pedirlo. Con
  un Semicírculo seleccionado, «Doble punta» estaba habilitada e inerte
  (`applyDoubleHead` ignora los `heads:'none'`… pero la casilla quedaba
  marcada porque el `return` temprano se saltaba la resincronización).
- **Fix:** `syncStrokeControls` atenúa el discontinuo con el mismo criterio
  que el panel (`DASHABLE_TYPES` + Semicírculo) y excluye `heads:'none'` de la
  doble punta, como ya hacía `syncPanelSections`; `applyDash`/`applyDoubleHead`
  resincronizan SIEMPRE (sin `return` temprano); la muestra ignora una casilla
  deshabilitada.
- **Guardia:** `tests/app-interaction.test.js` › *"discontinuo y doble punta
  se atenúan cuando no aplican"*.

### Auditoría v2.10.1 — la muestra del relleno sólido mentía

- **Síntoma:** marcar «Rellenar formas» sin haber elegido nunca color de
  relleno pintaba la muestra de `#modal-shape` con un sólido **opaco** del
  color del trazo; la forma real salía con el tinte clásico (`color + '20'`,
  ~12%).
- **Causa:** la muestra copiaba el valor del picker, que enseña siempre un
  color (`hex6(fillColor || color)`); la creación solo escribe `fillColor` si
  existe de verdad.
- **Fix:** `renderShapePreview` lee la misma fuente que la creación
  (`single.fillColor` o `state.fillColor`), no el picker.
- **Guardia:** `tests/app-interaction.test.js` › *"rellenar sin color elegido
  conserva el tinte clásico (sin fillColor)"* pina la fuente compartida; la
  muestra en sí se comprueba a mano (el arnés no pinta canvas): marcar
  «Rellenar formas» en `#modal-shape` recién abierto → la muestra debe verse
  con tinte tenue, no opaca.

### Auditoría v2.10.1 — el export decía cosas que la app nunca dice

- **Síntoma:** el HTML exportado de un marcador de imagen mostraba «Image
  Placeholder» — en inglés y un texto que el canvas ni siquiera dibuja. Y el
  SVG de un navbar no llevaba **ningún** enlace, cuando canvas y HTML pintan
  «Inicio / Nosotros / Contacto».
- **Causa:** un literal olvidado por el barrido de traducción de v2.10.0, y
  una divergencia histórica del SVG (tampoco llevaba Home/About/Contact) que
  el contrato «los tres formatos dicen lo mismo» nunca toleró.
- **Fix:** exporter.js — «Imagen» en el HTML del marcador; los tres enlaces en
  el SVG del nav, en las mismas posiciones que el renderer (el SVG sigue
  simplificando *formas* a propósito; lo que no puede es callarse un texto).
- **Guardia:** `tests/exporter.test.js` › *"los tres formatos dicen lo mismo:
  enlaces del nav en SVG y marcador en español"*.

### El ⚙ del borrador se veía con todas las herramientas

- **Síntoma:** el engranaje de la cabecera «Trazo» del panel estaba a la vista
  con cualquier herramienta —lápiz, rectángulo, texto— y al pulsarlo abría el
  modal del **tamaño del borrador**, que no venía a cuento. Existía desde que
  se creó el botón (v1.22.0).
- **Causa:** `app.js` le ponía y le quitaba el atributo `hidden` correctamente,
  pero `.panel__gear` declara `display: inline-flex` para cumplir el objetivo
  táctil de 24×24px (WCAG 2.5.8), y esa declaración **gana** al
  `[hidden] { display: none }` del user-agent. Es exactamente la misma trampa
  que ya había obligado a escribir `.btn[hidden]` en `_btn.scss`, pero nadie la
  volvió a mirar al añadir el ⚙. Ninguna guarda podía verlo: en el arnés
  `node:vm` `hidden` es una propiedad de JavaScript, no un estilo, así que
  `assert.equal(app.$('btn-eraser-size').hidden, true)` pasaba —y sigue
  pasando— con el botón perfectamente visible en el navegador.
- **Fix:** `src/scss/components/_panel.scss` — `&__gear[hidden] { display: none }`,
  y de paso lo mismo para `&__section[hidden]` y `&__check[hidden]`, que la
  reorganización del panel (v2.9.0) iba a necesitar y habrían fallado igual.
- **Guardia (e2e):** `e2e/panel.spec.js` › *"cada sección enseña su propio ⚙, y
  el del elemento sigue al tipo seleccionado"* — comprueba visibilidad real, no
  la propiedad. Y `tests/smoke.test.js` › *"el panel tiene sus secciones
  contextuales y el CSS que las oculta"* asserta las reglas en el artefacto
  compilado. (La guarda estuvo apuntando a un título de test inexistente hasta
  la v2.21.0, que además repartió aquel ⚙ único: desde entonces el botón que
  depende de `.panel__gear[hidden]` es `#btn-element-settings`, el único que
  sigue ocultándose desde JS.)

### «Cuadrícula» se salía del panel por el borde de la ventana

- **Síntoma:** en la sección «Lienzo», el rótulo del segundo selector de color
  quedaba cortado por el borde derecho de la ventana.
- **Causa:** `.panel__canvas-colors` era un `flex` sin `wrap`, y «Fondo» +
  «Cuadrícula» con sus dos muestras no caben en los 22rem del panel menos su
  padding.
- **Fix:** `src/scss/components/_panel.scss` — `flex-wrap: wrap` y `gap` con
  componente vertical, para que el segundo baje a su línea en vez de desbordar.
- **Verificación manual:** abrir la app y mirar la sección «Lienzo»: los dos
  rótulos se leen enteros dentro del panel.

### Tras «Limpiar todo», Verjas y Cancela conservaban los valores anteriores

- **Síntoma:** después de pulsar «Limpiar todo», abrir el modal de Verjas o el
  de Cancela seguía mostrando el diseño y la altura de antes del reset, aunque
  `state` ya tenía los valores por defecto. El primer arrastre salía con lo que
  decía `state`, no con lo que enseñaba el modal.
- **Causa:** el reset llamaba a `syncBuildControls()`, `syncPathControls()` y
  `syncWallControls()`, pero no a `syncFenceControls()` ni `syncGateControls()`,
  que se añadieron después (v2.6.0) sin volver a mirar esta lista.
- **Fix:** `src/js/app.js`, `btn-clear` — se llama a los cinco puntos de
  sincronía.
- **Guardia:** `tests/app-interaction.test.js` › *"tras «Limpiar todo» los
  controles de Verjas y Cancela vuelven a su valor"*.

### El ciprés del catálogo parecía una bola en vez de una llama

- **Síntoma:** en la vista de alzado, el icono del Ciprés mediterráneo era un
  óvalo casi redondo. Además, especies de alturas y diámetros muy diferentes
  ocupaban la misma proporción dentro de sus iconos.
- **Causa:** `variantIcon()` entregaba a todas las variantes vegetales una caja
  fija de 100 × 84 px. Al existir un arrastre válido, `Garden.elements()` no
  llegaba a consultar las dimensiones botánicas; un `Cupressus sempervirens`
  de 18 × 4 m terminaba deformado a la misma caja que cualquier copa redonda.
  Su contorno de alzado era, además, una elipse sin ápice.
- **Fix:** los iconos vegetales simulan ahora un clic sin arrastre, para que la
  caja nazca de altura, diámetro, etapa y escala. El ciprés usa un contorno
  fastigiado cerrado, con ápice centrado, ensanchamiento inferior y ramas
  ascendentes. La auditoría se extendió a las 40 especies: perfiles de copa,
  matas, espigas, corolas y racimos conservan rasgos botánicos reconocibles.
- **Guardias:** `tests/app-interaction.test.js` › *«los iconos de plantas usan
  la caja botánica…»*; `tests/garden.test.js` › *«las 40 especies conservan sus
  proporciones…»* y *«el ciprés… es una llama…»*; y
  `e2e/garden-botanical.spec.js` › *«el icono del ciprés conserva su silueta
  fastigiada en llama»*, que mide la tinta del canvas en Chromium.

### Los controles botánicos se veían entrecortados en ventanas intermedias

- **Síntoma:** en los modales de Árbol, Arbusto, Flor, Aromáticas y
  Trepadoras, textos como «Vista de alzado», «Adulto» o «Nombre y
  dimensiones» aparecían cortados, especialmente alrededor de 450–720 px de
  ancho.
- **Causa:** todos los diálogos estaban limitados a 46rem y la ficha intentaba
  mantener simultáneamente una miniatura de 17,6rem y dos columnas de campos.
  El breakpoint general de 420px miraba el viewport, no el ancho útil que
  quedaba dentro del diálogo tras descontar padding. Además, el ancho mínimo
  intrínseco de los controles nativos podía ensanchar las celdas del grid.
- **Fix:** los cinco diálogos llevan `modal--plant` (máximo 72rem), la ficha
  apila miniatura y controles a 700px y pasa los campos a una columna a 520px.
  Los controles aceptan `min-width:0`, ocupan el 100% de su celda y el selector
  de etiqueta usa una fila completa.
- **Guardia:** `e2e/garden-botanical.spec.js` › *«los controles botánicos no
  se cortan en anchos intermedios»*. Chromium mide el texto seleccionado con
  la fuente real, reserva la flecha nativa y comprueba ausencia de overflow a
  460 y 720px.

### El muro de piedra salía de bloques prefabricados, la altura no se notaba y la verja no se podía elegir

- **Síntoma:** tres defectos de la herramienta Muro reportados juntos. (1) El
  paramento de piedra en alzado parecía de bloques prefabricados. (2) Elegir
  «2 m» no cambiaba nada visible. (3) La casilla «Verja de forja arriba» no se
  podía marcar.
- **Causa:** (1) `_wallTextureElevation` dibujaba una retícula exacta —hilada
  fija de 22 px y junta siempre a media pieza—, que es literalmente el aparejo
  de un bloque de hormigón. (2) `wallHeight` solo alimentaba la caja por
  defecto (`byVariant`), y un arrastre de verdad siempre gana, así que el
  ajuste solo se veía al hacer clic sin arrastrar. (3) `updateWallFieldsEnabled`
  atenuaba altura y verja mientras la vista fuera `plan` —la vista por
  defecto—, pero elegir vista **cierra** el modal: en la única visita en la que
  esos campos existían, estaban deshabilitados. Callejón sin salida.
- **Arreglo:** en `src/js/building.js`, la piedra pasa a ser mampostería con
  hiladas y mampuestos irregulares y llagas inclinadas, generada con `_noise`
  (determinista: nada de `Math.random`, que rompería la coincidencia entre
  icono, miniatura, previsualización y trazo). La altura pasa a ser la
  **escala** del dibujo (`_wallPxPerM`), de la que cuelgan hilada, mampuesto,
  tongadas del hormigón y verja; en planta manda además el canto por defecto.
  Se elimina `updateWallFieldsEnabled` (app.js) y la verja se dibuja también en
  planta (`_wallRailingPlan`), para que ningún ajuste del modal quede sin
  efecto. La clave sintética `wallSizeKey` se deriva ahora dentro de
  building.js (`_wallSizeKey`) en vez de en `buildOpts()`, con lo que el icono
  de cada vista del catálogo nace con SU caja aunque la vista activa sea la
  otra.
- **Guardia:** `tests/building.test.js` — «muro de piedra: mampostería
  irregular y determinista, no una retícula de bloques», «la altura en metros
  cambia la textura aunque el arrastre sea el mismo», «la verja se ve en las
  dos vistas del muro» y «el clic sin arrastrar da la caja propia de cada
  vista/altura de Muro»; y `tests/app-interaction.test.js` — «Muro: elegir la
  herramienta abre su modal con los cuatro ajustes utilizables».

### Alt+clic era la única vía para aislar una pieza de un grupo

- **Síntoma:** mover, recolorear o redimensionar una pieza suelta de un
  edificio o un elemento de Jardín exigía mantener <kbd>Alt</kbd> mientras se
  clicaba — un acorde tecla+puntero, imposible con una sola mano en el ratón.
  Violaba la regla permanente del proyecto («ningún gesto con modificador como
  única vía»), que hasta ahora solo se había aplicado a los arrastres.
  Detectado en la auditoría de accesibilidad de 2026-08-08.
- **Causa:** el aislamiento solo existía en las dos ramas `e.altKey` de
  `onMouseDown` (app.js); re-clicar un grupo ya seleccionado no descendía a la
  pieza, y la marquesina tampoco sirve (selecciona por intersección de cajas:
  el bbox del muro cubre sus ventanas).
- **Fix:** `src/js/app.js` (manejador `dblclick`) — doble clic sobre una pieza
  de la selección múltiple desciende a esa pieza. Alt+clic queda como
  acelerador. La ayuda (`index.html`) documenta el doble clic como vía
  principal. Sobre una etiqueta de texto, el doble clic siguiente (ya aislada)
  abre el editor, como cualquier texto.
- **Guardia:** `tests/app-interaction.test.js` › *"doble clic desciende a la
  pieza del edificio: aislar sin teclado (una mano)"* — falla con el código
  anterior (verificado por sabotaje).

### Doble clic en el segundo control de una cadena reseteaba el control equivocado

- **Síntoma:** en una curva encadenada con tramos cúbicos (todas las piezas
  orgánicas de Jardín), doble clic sobre el handle del **segundo** control de
  un tramo movía el **primero** (`cx/cy`) a un default cuadrático y dejaba
  `cx2/cy2` intacto: tramo medio reseteado y deformado, con su paso de undo
  consumido. Detectado en la auditoría de 2026-08-08.
- **Causa:** app.js extraía el índice de `'segCtrl2:N'` pero llamaba siempre a
  `CurvePath.withControl(sel, index, …, false)` — el flag `second` nunca era
  `true` (el arrastre del mismo handle sí lo distingue; el reset no).
- **Fix:** `src/js/app.js` — en un tramo cúbico el doble clic resetea los
  **dos** controles a la S canónica (`defaultCubicCtrls`, la misma que usa el
  reset de la curva suelta); en uno cuadrático, el único control, como antes.
- **Guardia:** `tests/app-interaction.test.js` › *"doble clic en el handle
  segCtrl2 resetea el tramo entero, no el control equivocado"* — falla con el
  código anterior (verificado por sabotaje).

### El borrador «tocaba» sin morder y desanclaba flechas en silencio

- **Síntoma:** doble. (1) Pasar el borrador rozando un trazo grueso —el círculo
  tocaba la tinta pero sin llegar al eje— no borraba nada visible, pero aun así
  apilaba un paso de undo, deseleccionaba, y la recta/flecha perdía `id`,
  `startAnchor` y `endAnchor`: una flecha anclada a una forma dejaba de
  seguirla sin ningún cambio en pantalla. (2) En tinta gruesa el hueco borrado
  salía más estrecho que lo barrido. Y un mordisco en la cola de una flecha
  anclada desconectaba también la punta, que no se había movido. Detectado en
  la auditoría de 2026-08-08.
- **Causa:** doble umbral. `Eraser.touches` decide el contacto con margen de
  tinta (`r + lineWidth/2`, eraser.js), pero `_splitLine`/`_splitPencil`
  clasificaban los puntos muestreados solo con `r`; en la franja intermedia el
  elemento se reconstruía en un trozo geométricamente idéntico… al que se le
  hacía incondicionalmente `delete piece.id/startAnchor/endAnchor`.
- **Fix:** `src/js/eraser.js` — el recorte clasifica con el mismo
  `r + lineWidth/2` que `touches`; si ninguna muestra cae dentro, el split
  devuelve el elemento intacto **por referencia** (y `erase()` no lo cuenta
  como cambio: sin undo fantasma); el trozo que sigue siendo flecha con su
  extremo original conserva el ancla de ese extremo (el trozo degradado a
  línea no arrastra anclas muertas — `resolveAnchors` ignora las líneas).
- **Guardia:** `tests/eraser.test.js` › *"el roce que toca la tinta gruesa
  pero no el eje también muerde (mismo umbral que touches)"*, *"mordisco en la
  cola de una flecha anclada: la punta no se desconecta"* y *"roce que toca sin
  que ninguna muestra caiga dentro: intacto por referencia (sin undo
  fantasma)"* — las tres fallan con el código anterior (verificado por
  sabotaje).

### Shift+clic era la única vía de multi-selección disjunta

- **Síntoma:** juntar dos elementos alejados sin arrastrar lo de en medio, o
  sacar un elemento de la selección, exigía Shift+clic — el mismo acorde
  tecla+puntero del caso Alt+clic. La marquesina solo cubre selecciones
  contiguas. Detectado en la auditoría de accesibilidad de 2026-08-08.
- **Causa:** el toggle de selección solo existía en la rama `e.shiftKey` de
  `onMouseDown` (app.js).
- **Fix:** `src/js/app.js` + `index.html` — casilla «Los clics acumulan
  selección» (`#check-multi-select`, mismo patrón que «Ajustar a cuadrícula»:
  modo pegajoso en el panel, Shift queda como atajo). Con el modo activo, el
  clic sobre un elemento no seleccionado **añade** su grupo; el clic **sin
  arrastre** sobre uno ya seleccionado lo quita (se apunta en `mousedown` como
  `pendingUnselect` — también en la rama del marco combinado, que captura esos
  clics — y solo se consuma en `mouseup` si no hubo arrastre, para que
  arrastrar la selección siga funcionando).
- **Guardia:** `tests/app-interaction.test.js` › *"«Los clics acumulan
  selección»: multi-selección disjunta sin teclado"* y *"en modo acumular,
  arrastrar sigue moviendo y el clic sin arrastre quita"* (verificadas por
  sabotaje).

### La caché de imágenes del Renderer crecía sin límite

- **Síntoma:** cada imagen distinta pegada o importada en una sesión larga
  (data-URLs de megabytes) quedaba retenida en memoria para siempre, aunque el
  elemento se borrara, se deshiciera o se limpiara el lienzo; un data-URL que
  no decodificaba quedaba como placeholder sin repintado. Detectado en la
  auditoría de 2026-08-08.
- **Causa:** `Renderer._imgCache` era un Map al que solo se añadía, sin poda
  ni `onerror`.
- **Fix:** `src/js/renderer.js` — `Renderer.pruneImageCache(liveSrcs)`
  (devuelve cuántas expulsó: la caché es privada y ese retorno es la única
  observabilidad) y `onerror` que notifica el repintado; `src/js/app.js` — la
  poda va a remolque del autosave (ya debounced, y justo cuando la escena
  cambió), conservando los `src` de la escena y del historial de undo/redo
  (deshacer debe repintar sin recargar).
- **Guardia:** `tests/sketchy-renderer.test.js` › *"Renderer.pruneImageCache
  expulsa los src muertos y conserva los vivos"*.

### `role="toolbar"` sin el patrón de teclado que ese rol promete

- **Síntoma:** cada una de las ~45 herramientas del sidebar era una parada de
  Tab: cruzar del topbar al lienzo por teclado costaba una tabulación por
  botón, y el rol anunciaba a los lectores una navegación por flechas que no
  existía. Detectado en la auditoría de 2026-08-08.
- **Causa:** `buildSidebar` (app.js) creaba botones planos sin gestión de foco.
- **Fix:** `src/js/app.js` — roving tabindex: un solo `tabindex="0"` en la
  barra, flechas/Home/End mueven el foco (y el tabstop viaja con él). De paso,
  el botón se construye con `createElement`/`textContent` (era el único
  `innerHTML` interpolado del proyecto) y el emoji del icono va `aria-hidden`
  (el nombre ya lo da su span de texto).
- **Guardia (e2e):** `e2e/keyboard-focus.spec.js` › *"la barra de herramientas
  es una sola parada de Tab y se recorre con flechas"*.

### Contrastes por debajo del mínimo en texto secundario, pista de sliders y objetivo del ⚙

- **Síntoma:** `--text-dim` en el pie del panel daba 4.20:1 y `--text-muted`
  sobre `--bg-hover` (los `<small>` de los modales, texto de 10px) 4.28:1 —
  AA exige 4.5:1; la pista de los sliders daba 1.30:1 contra el panel (mínimo
  no textual: 3:1) y el ⚙ del borrador medía ~21×17px de objetivo efectivo
  (mínimo 24×24). Detectado en la auditoría de 2026-08-08 con ratios WCAG
  calculados.
- **Fix:** `src/scss/abstracts/_variables.scss` — `$text-dim: #7d8295`
  (4.63), `$text-muted: #9096a8` (4.61 sobre hover, 5.99 sobre panel) y token
  nuevo `$slider-track: #61678a` (3.21) que `base/_reset.scss` usa en la
  pista; `components/_panel.scss` — el ⚙ pasa a `min-width/min-height 2.4rem`
  con centrado flex.
- **Guardia:** `tests/smoke.test.js` › *"texto secundario ≥4.5:1 y pista del
  slider ≥3:1 sobre sus fondos reales"* — calcula los ratios sobre el
  artefacto compilado.

### El publicable (`dist/`) se generaba sin verificación y sin tests

- **Síntoma:** el `replaceAll` que aplana `src/js/` → `js/` en
  `dist/index.html` no verificaba el resultado (un cambio de formato en los
  `<script>` dejaba un dist/ roto en silencio); el `rmSync` inicial dejaba
  `dist/` a medias si el build fallaba a mitad; ningún test cubría la carpeta;
  `cpSync` habría publicado cualquier `.DS_Store`. Detectado en la auditoría
  de 2026-08-08.
- **Fix:** `gulpfile.js` — el build lanza un error si el HTML aplanado
  conserva rutas `src/`; se construye entero en `dist.tmp` y solo al final
  sustituye a `dist/`; filtro de `.DS_Store` en las dos copias recursivas.
- **Guardia:** `tests/dist.test.js` — rutas aplanadas, mismos scripts que
  `src/js/`, fuentes/licencias/manifest presentes e `IMG_SKIP` respetado; con
  `dist/` ausente hace **skip explícito** (es un artefacto local: `npm run
  build` primero), nunca un verde engañoso.

### «Limpiar todo» resucitaba media configuración de Edificios/Jardín

- **Síntoma:** el botón borraba `sketchwire.prefs` pero dejaba en `state` los
  defaults de creación (variantes de modal, plantas, ancho de camino…): el
  siguiente `savePrefs()` —cambiar el fondo, p. ej.— los re-persistía,
  deshaciendo el `removeItem`. El botón promete «la app recién abierta» y para
  media configuración no lo cumplía. Detectado en la auditoría de 2026-08-08.
- **Fix:** `src/js/app.js` — los defaults viven una sola vez en
  `CREATION_DEFAULTS` (el estado inicial los esparce y `btn-clear` los
  re-asigna con `Object.assign` + `syncBuildControls()` + `syncPathControls()`
  + el checkbox de etiquetas).
- **Guardia:** `tests/app-interaction.test.js` › *"«Limpiar todo» también
  devuelve los defaults de Edificios y Jardín"* (verificada por sabotaje).

### `HEX_RE` de prefs aceptaba hex de 5 y 7 dígitos

- **Síntoma:** unas prefs con `canvasBg: '#abcde'` (manipuladas o corruptas)
  pasaban la validación: el canvas ignora ese `fillStyle` en silencio y el
  picker divergía del estado. Detectado en la auditoría de 2026-08-08.
- **Fix:** `src/js/app.js` — `HEX_RE` solo acepta las longitudes válidas en
  CSS (3/4/6/8).
- **Guardia:** `tests/app-interaction.test.js` › *"unas prefs con un hex
  inválido de 5 dígitos no cuelan; el válido sí"* (verificada por sabotaje).

### El cajón del panel cerrado seguía siendo tabulable y expuesto a los lectores

- **Síntoma:** en pantallas ≤1100px con el cajón cerrado, Tab tras la barra
  superior metía el foco en ~30 controles invisibles: el indicador de foco
  desaparecía de la pantalla durante decenas de tabulaciones, y los lectores
  de pantalla leían el panel como contenido presente. Además el botón «⚙
  Panel» no anunciaba el estado y Escape no cerraba el cajón. Detectado en la
  auditoría de accesibilidad de 2026-08-08.
- **Causa:** el cajón se ocultaba solo con `transform: translateX(100%)`, que
  desplaza visualmente pero no saca del árbol de accesibilidad ni del orden de
  tabulación.
- **Fix:** `src/scss/components/_panel-drawer.scss` — `visibility: hidden` en
  el estado cerrado, con delay en la transición para que el deslizamiento se
  vea entero (se oculta al acabar; al abrir, delay 0). `src/js/app.js`
  (`setupModals`) — helper `setPanelOpen` que sincroniza la clase con
  `aria-expanded` en el botón, y Escape cierra el cajón cuando no hay ningún
  `<dialog>` abierto. `index.html` — `aria-expanded`/`aria-controls` iniciales
  y `id="side-panel"` en el panel.
- **Guardia (e2e):** `e2e/responsive.spec.js` › *"el cajón cerrado no puede
  recibir el foco; aria-expanded y Escape acompañan"* — solo un navegador real
  ve visibility, foco y Escape.

### Tres controles del panel no tenían nombre accesible

- **Síntoma:** `#font-slider`, `#zoom-slider` y `#color-picker` (color del
  trazo) se anunciaban como «deslizador»/«selector de color» a secas: los
  `<h3>` adyacentes («Texto: 18px», «Zoom: 100%», «Color») no estaban
  asociados programáticamente. El resto de sliders sí llevaba `aria-label` —
  era omisión, no criterio. Detectado en la auditoría de 2026-08-08.
- **Causa:** rótulos como encabezados (`<h3>`) en vez de `<label for>`.
- **Fix:** `index.html` — los rótulos de Texto y Zoom pasan a
  `<label class="panel__title panel__title--block" for="…">` (mismo estilo:
  el modificador `--block` en `_panel.scss` les devuelve la línea propia sin
  volver block los `span.panel__title` que conviven con su control);
  `aria-label` en `#color-picker`. De paso, el nombre de la app en el topbar
  pasa de `<span>` a `<h1>`: el documento no tenía ningún encabezado raíz.
- **Guardia:** `tests/smoke.test.js` › *"los controles del panel tienen nombre
  accesible y el cajón anuncia su estado"*.

### Los botones destructivos eran el texto menos legible de la app

- **Síntoma:** «🗑 Eliminar selección» y «🗑 Limpiar todo» (texto de 12px
  sobre fondo translúcido) daban 4.13:1 en reposo y 3.61:1 en hover — por
  debajo del AA (4.5:1) justo en las dos acciones más peligrosas. Detectado en
  la auditoría de 2026-08-08 calculando los ratios WCAG sobre los colores
  compuestos reales.
- **Causa:** `$color-danger: #e94560` como color de texto sobre
  `rgba(233,69,96,.12/.22)` compuesto sobre `--bg-panel` (#161822).
- **Fix:** `src/scss/abstracts/_variables.scss` — `$color-danger: #f4778c`
  (mismo tono, más claro: 5.92:1 y 5.18:1). El token solo lo consume ese
  texto; los fondos rgba no cambian.
- **Guardia:** `tests/smoke.test.js` › *"el texto de .btn--danger cumple AA
  (≥4.5:1) en reposo y en hover"* — calcula el ratio sobre el artefacto
  compilado real (verificado por sabotaje).

### Los nombres del sidebar se partían por dentro y pisaban su icono

- **Síntoma:** los nombres de las herramientas salían cortados por cualquier
  sitio («Rectán / gulo», «Borrad / or», «Tarjet / a») y, al crecer a dos o
  tres líneas, el texto se montaba sobre el icono o se salía del botón.
  Reportado por el usuario con captura.
- **Causa:** tres decisiones que se sumaban. (1) `overflow-wrap: anywhere`
  —añadido en la migración a OpenDyslexic justo para que las palabras largas
  no se recortaran— parte por cualquier carácter, no por sílabas ni espacios.
  (2) El botón medía 5.2rem (52px) cuando la palabra más ancha del catálogo
  («Redondeado») mide ~58px en OpenDyslexic a 0.9rem sin letter-spacing —con
  el letter-spacing de 0.05rem subía a 63px—, así que ninguna caja podía
  contenerla entera. (3) La altura del botón era fija (`height`), así que un
  nombre de varias líneas no tenía dónde crecer y empujaba sobre el icono.
- **Fix:** `src/scss/components/_sidebar.scss` — el botón compacto pasa a
  6.8rem de ancho (cabe en los 7.2rem contractuales del sidebar) con
  `min-height` en vez de `height`; fuera el `overflow-wrap: anywhere` y el
  `letter-spacing` del nombre; en el modo ancho (columnas de ~59px) el cuerpo
  baja medio punto (0.85rem). Los anchos documentados del sidebar (72/132px)
  no cambian.
- **Guardia (e2e):** `e2e/responsive.spec.js` › *"los nombres del sidebar
  caben enteros y no pisan su icono"* — en ambos modos: ningún nombre
  desborda su caja (`scrollWidth`), ninguno invade el rectángulo del icono y
  ninguno se sale del botón. Solo un navegador real puede medir esto.

### El desplegable del panel usaba una variable CSS inexistente (`--text-main`)

- **Síntoma:** `.panel__select` declaraba `color: var(--text-main)`, pero esa
  custom property no existe en ningún sitio (la real es `--text-primary`). La
  declaración se descartaba en silencio y el `<select>` heredaba el color del
  padre — legible de casualidad, no por diseño. Detectado en la migración a
  SCSS (v1.25.0) y migrado tal cual a propósito para no cambiar ni un byte;
  este es el fix aparte que aquella versión dejó programado.
- **Causa:** un `var()` con nombre equivocado no falla en ninguna parte: ni
  dart-sass ni stylelint ni el navegador avisan — la declaración inválida se
  ignora y gana la herencia.
- **Fix:** `src/scss/components/_panel.scss` — `color: var(--text-primary)`
  (y `css/styles.css` recompilado).
- **Guardia:** `tests/smoke.test.js` › *"toda custom property usada en
  css/styles.css está definida"* — general: cubre esta y cualquier futura
  variable con nombre equivocado en el artefacto compilado.

### La familia tipográfica entraba sin sanear en el `<style>` del export HTML

- **Síntoma:** `html()` interpolaba `SKETCHY_FONT` crudo dentro del bloque
  `<style>` del archivo exportado. El valor viene de la custom property
  `--font-sketch` (la hoja de estilos propia), así que en uso normal es
  inocuo, pero era la única interpolación del exporter sin sanear: una hoja
  de estilos manipulada podía cerrar el `<style>` e inyectar markup en el
  HTML exportado. Detectado en la auditoría de 2026-08-08.
- **Causa:** `FONT_FALLBACK` ya saneaba la misma familia para los atributos
  XML del SVG, pero el bloque CSS del HTML usaba el valor original.
- **Fix:** `src/js/exporter.js` — `FONT_CSS` (la familia sin `<`, `>`, `{`, `}`
  ni `;`: sin `<` no hay forma de cerrar la etiqueta, y sin llaves ni `;` no
  se inyectan reglas o declaraciones ajenas); `FONT_FALLBACK` descarta ahora
  también `<>&`, que malformarían el XML del SVG.
- **Guardia:** `tests/exporter.test.js` › *"una --font-sketch envenenada no
  puede cerrar el <style>"* (config.js cargado con un `getComputedStyle`
  manipulado).

### La inclinación del camino exigía dos manos, y su ancho quedaba fuera de alcance

- **Síntoma:** el usuario, que **solo puede utilizar la mano izquierda**, no
  podía trazar ningún camino inclinado: la función entera (v1.23.0) estaba
  atada a `Shift`+arrastrar, y mantener una tecla mientras se arrastra el ratón
  necesita las dos manos. Además, una vez inclinado el camino, «no se puede
  cambiar la anchura»: el arrastre ya no la daba y su único control estaba en
  el panel lateral, que por debajo de 1100px ni siquiera se ve (es un cajón).
  Y no había forma de saber a qué ángulo estaba saliendo el camino.
- **Causa:** se eligió `Shift` por seguir el patrón de `state.curveFlip`
  (Shift al trazar una flecha curva comba al otro lado), que es un precedente
  real del propio código — pero un precedente sobre *qué* tecla usar no dice
  nada sobre *si* una tecla mantenida puede ser la única vía. Lo era, y eso
  convierte una función opcional en una función inexistente para quien no
  puede hacer ese gesto. El ancho arrastraba el mismo error de forma más
  suave: existir solo en el panel es, en la práctica, casi no existir (ver
  también la entrada del tamaño del borrador, mismo patrón).
- **Fix:** `js/app.js` + `index.html` — la vía principal pasa a ser un ajuste
  pegajoso de un clic, `state.pathAnyAngle` («Cualquier inclinación»), con
  casilla en el propio catálogo de Camino y gemela en el panel, persistida en
  prefs; `gardenOpts()` hace OR de ese ajuste con el `Shift` transitorio, que
  sobrevive solo como acelerador opcional. El ancho gana un gemelo dentro del
  modal (`#path-width-modal`) junto a una miniatura en vivo
  (`renderPathPreview`) que enseña ancho e inclinación antes de dibujar, y
  `syncPathControls()` reparte ambos valores a los dos juegos de controles.
  El ángulo se rotula junto al puntero durante el arrastre (`drawPathAngle`,
  solo en la capa de previsualización).
- **Guardia:** `tests/app-interaction.test.js` › *"«Cualquier inclinación»
  traza en diagonal sin tocar el teclado"*, *"el ancho del camino inclinado se
  cambia desde el propio catálogo"*, *"al trazar un camino inclinado se ve el
  ángulo junto al puntero"* y *"con «Cualquier inclinación» los iconos del
  catálogo siguen en modo caja"*.
- **Regla que deja:** ninguna función puede tener como única vía de acceso un
  gesto de tecla-mantenida-mientras-se-arrastra. Un modificador vale como
  atajo, nunca como puerta. Anotado también en `CLAUDE.md`.

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

### La ayuda de la app mandaba al panel a buscar una casilla que ya no está ahí

- **Síntoma:** «Ayuda» → «Selección y portapapeles» decía que «Los clics
  acumulan selección» era «la casilla **del panel**». La casilla dejó el panel
  en la v2.17.0 y ahora sale al pulsar Mover o «Select». Quien siguiera la
  ayuda buscaba en el panel un control que no existe allí, y en pantallas
  estrechas encima tenía que abrir el cajón para comprobarlo.
- **Causa:** al mover el control se actualizaron el HTML del panel, el modal y
  los tests, pero no el texto de la ayuda ni el README. Ningún test miraba la
  ayuda: la casilla seguía existiendo, solo que en otro sitio, así que la
  guarda de *"la casilla vieja del panel no debe volver"* pasaba igual.
- **Fix:** `index.html` (línea de la ayuda) y `README.md` — ambos nombran ahora
  las dos herramientas que la abren y el ⚙ que la reabre.
- **Guardia:** `tests/smoke.test.js` › *"la ayuda no manda al panel a buscar la
  casilla de selección"*: la línea de multi-selección tiene que nombrar Mover y
  «Select», y no puede volver a decir «del panel».

---

## Solo verificables manualmente (artefactos y documentación)

Lo que se genera aparte del código —la build de `dist/`, las capturas del
README— y lo que el código no puede comprobar de sí mismo —la guía de
CLAUDE.md— envejece en silencio: nada falla, simplemente deja de ser verdad.
Los recuentos y las referencias a mandos concretos sí se atan con tests (ver la
entrada de la Ayuda, v2.25.1); lo de aquí abajo, no.

### v2.25.1 — La captura del README enseñaba una versión sin las herramientas nuevas

- **Síntoma:** la imagen de cabecera del README mostraba un sidebar **sin las
  estrellas y sin el grupo 3D**, es decir, prometía una app con menos
  herramientas de las que tiene. Estaba generada con la v2.22.1.
- **Causa:** la misma que el `dist/` desfasado de la v2.23.0 — un artefacto que
  no se regenera solo y cuyo desfase es invisible desde el código—, sólo que
  aquí el perjudicado es quien llega al repo por primera vez.
- **Arreglo:** regenerada con la versión actual, con el grupo 3D visible, la
  herramienta Prisma activa y tres sólidos rellenos en el lienzo, y reescrito su
  texto alternativo.
- **Verificación manual** (no hay guarda automática razonable: es una imagen):
  al añadir o quitar una herramienta del sidebar, **abrir la captura del README
  y comprobar que el sidebar que enseña es el de ahora**. El nombre tiene que
  seguir empezando por `screenshot-`, o `IMG_SKIP` (gulpfile.js) deja de
  excluirla y acaba publicada en `dist/`.

### v2.25.1 — CLAUDE.md daba mal el orden de carga y la lista de un tipo nuevo

- **Síntoma:** dos datos falsos en la guía para desarrollar, los dos del tipo que
  se consulta justo antes de tocar algo delicado: el **orden de carga de los
  scripts** listaba todos menos `solid`, y la sección **«Adding a new element
  type»** omitía tres pasos que hoy no son opcionales.
- **Causa:** el orden de carga se quedó sin actualizar al añadir el módulo en la
  v2.24.0. La lista de pasos venía de cuando se escribió y nunca se revisó
  contra lo que de verdad hace falta hoy.
- **Arreglo:** corregido el orden, y la lista completada con los tres pasos que
  faltaban, todos de fallo **silencioso**: `VECTOR_TYPES` y la rama de
  `isValidElement` en el exportador (sin ellos el elemento no se exporta y se
  rechaza al reimportar), y `OUTLINE_TYPES`/`eraserDeps` (sin ellos el borrador
  funciona por caja, el defecto que esa lista existe para evitar). Salieron de
  haber añadido el polígono libre en la v2.25.0.
- **Verificación manual:** al añadir un módulo `src/js/*.js`, comprobar que
  aparece en las cuatro listas que lo nombran — `index.html`, `ALL_FILES` y
  `KNOWN_GLOBALS` de `tests/helpers/load.js`, y el orden documentado en
  CLAUDE.md. Las tres primeras las vigilan los tests; la cuarta, no.

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

### Un `seed` corrupto en un JSON importado hacía temblar el elemento para siempre

- **Síntoma:** un proyecto JSON (o un payload del portapapeles) editado a mano
  con `seed: "abc"` o `seed: null` pasaba la validación; `Sketchy.setSeed` cae
  entonces a `Math.random` y el elemento «temblaba» en cada redraw — justo el
  defecto que el seed determinista existe para eliminar — y el valor corrupto
  se re-exportaba. Detectado en la auditoría de 2026-08-08.
- **Fix:** `src/js/app.js` — `withSeeds` re-siembra todo seed no finito
  (`Number.isFinite`), no solo los `undefined`.
- **Verificación manual:** exportar un JSON, editar un `"seed"` a `"abc"`,
  importarlo → el elemento debe dibujarse estable (sin temblor al mover el
  ratón por encima) y re-exportarse con un seed numérico. (El arnés no cubre
  el diálogo de importación: su `FileReader` es un stub inerte.)

### Un cambio hecho justo antes de cerrar la pestaña se perdía

- **Síntoma:** el autosave va con debounce de 500 ms y no había flush al
  cerrar: dibujar y cerrar la pestaña en menos de medio segundo perdía ese
  último cambio. Detectado en la auditoría de 2026-08-08.
- **Fix:** `src/js/app.js` — el cuerpo del guardado sale a `saveAutosaveNow()`
  y un listener de `pagehide` (no `beforeunload`: no corre al entrar en
  bfcache) lo dispara en el acto.
- **Verificación manual:** dibujar un trazo y cerrar la pestaña
  inmediatamente; al reabrir la app el trazo debe estar. (El evento `pagehide`
  real solo existe en un navegador.)

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

### Los rótulos de dos herramientas vecinas se tocaban (sidebar a dos columnas)

- **Síntoma:** por encima de 1201px, con el sidebar a dos columnas,
  «RECTÁNGULO» y «REDONDEADO» —y las demás parejas de nombres largos— se leían
  de corrido, como una sola palabra: entre el final de uno y el principio del
  otro quedaban 3.5px.
- **Causa:** el aire entre columnas era `0.2rem` (2px) y los nombres largos
  ocupan casi todo el ancho de su botón (57.5px de 58.5), así que la
  separación *visible* entre rótulos era la calle del grid más lo poco que le
  sobraba al más ancho. La guarda de la v2.29.0 no lo veía porque medía otra
  cosa: que el rótulo no desbordara su caja y que no fuera más ancho que su
  botón — las dos ciertas mientras los textos se rozaban.
- **Fix:** `src/scss/components/_sidebar.scss` — a dos columnas, la calle pasa
  a `0.7rem` y el margen lateral del sidebar baja de `0.6rem` a `0.4rem` para
  pagarla. El hueco real pasa de 3.5px a 8px. El cuerpo del rótulo **no** se
  toca: encogerlo era la otra salida y cuesta legibilidad, que es justo lo que
  se compró eligiendo OpenDyslexic.
- **Guardia:** `e2e/responsive.spec.js` › *"los nombres del sidebar caben
  enteros y no pisan su icono"*, ampliada con la medida del hueco mínimo entre
  dos rótulos de la misma fila (≥6px). Verificada fallando contra el CSS
  anterior.

### El borrador se llevaba entero el aerógrafo, las flechas curvas y las formas

- **Síntoma:** «el borrador funciona bien al borrar Lápiz, Línea y Flecha pero
  no funciona bien en el aerógrafo, las flechas curvas y las formas». Rozar
  cualquiera de esos tres hacía desaparecer el elemento completo: un toque en
  una esquina de un rectángulo se llevaba los cuatro lados, y un roce en el
  borde de una mancha de espray, la mancha entera.
- **Causa:** el recorte parcial de la v1.22.0 se hizo solo para
  `line`/`arrow`/`pencil` («recortar el contorno de una forma o una curva
  Bézier queda fuera de alcance»), y todo lo demás caía en el borrado íntegro.
  El resultado no se lee como un alcance limitado sino como un borrador roto,
  porque el elemento desaparece *sin haber pasado por encima de casi nada de
  él*.
- **Fix:** `src/js/eraser.js` — `erase()` recorta también la `curveArrow` (se
  muestrea y los trozos salen como `pencil`), el eje del `airbrush` y el
  contorno de las formas SIN relleno (anillo cerrado, con su costura vuelta a
  coser). Tres detalles sin los cuales no funciona: `_densify` (el contorno de
  un rectángulo son cuatro puntos, y entre dos de ellos no se detecta ningún
  corte), `_shapeOutline` compartido con `touches` (si midieran contornos
  distintos, tocaría una cosa y cortaría otra) y el margen `r + radius` del
  aerógrafo (los tramos que sobreviven siguen rociando hacia el hueco, así que
  con menos margen queda un residuo tenue justo donde se acaba de borrar).
  Siguen yéndose enteros el texto, las imágenes, los componentes y cualquier
  forma **rellena**: su dibujo es una superficie y no hay tipo que represente
  una superficie mordida.
- **Guardia:** `tests/eraser.test.js` › nueve pruebas nuevas (los dos trozos de
  una curva, el trozo que no hereda ni punta ni `rotation` ni `dash`, la
  costura del anillo, el círculo recortado por su elipse y no por su caja, la
  forma rellena que sí se va entera, el aerógrafo partido en dos) y
  `e2e/eraser.spec.js` (nuevo) que lo mide sobre píxeles reales. Verificadas
  fallando: quitando las tres ramas nuevas del despacho caen diez pruebas.

### El borrador se llevaba entero el texto y los componentes de UI

- **Síntoma:** continuación del anterior. En la sección UI (Texto, Emoji,
  Botón, Input, Imagen, Navbar, Tarjeta) el borrador seguía fulminando el
  elemento entero, y además bastaba con cruzar su **caja**: pasar por el hueco
  vacío de una tarjeta se la llevaba sin haber tocado un solo trazo suyo.
- **Causa:** ninguno de esos tipos tiene geometría que partir —una palabra son
  glifos, un componente es contorno + rótulo + tinte, una imagen es una
  trama— y no existe ningún tipo de elemento que represente «un botón al que
  le falta una esquina». El recorte geométrico no llegaba ahí, y el alcance
  caía en `_touchesBox`.
- **Fix:** `src/js/app.js` (`rasterErase`, inyectado en `Eraser.erase` como
  `deps.rasterErase`) — el elemento se rasteriza tal y como lo dibuja el
  renderer, se le abre el hueco con `destination-out` y lo que queda pasa a
  ser un `image` recortado a su tinta. El aspecto es idéntico por
  construcción; el precio, elegido por el usuario, es que deja de ser texto o
  componente editable. Comparar la tinta antes y después da de regalo el
  alcance exacto: si no se ha quitado un píxel, el elemento se devuelve **por
  referencia** y no pasa nada. La previsualización usa el canvas vivo
  (`bitmap`) en vez de un `toDataURL` por fotograma, cuya decodificación
  asíncrona haría parpadear el elemento durante todo el gesto.
- **Guardia:** `e2e/eraser.spec.js` › *"borrar por el medio de una palabra
  deja lo de fuera, ya como imagen"*, *"cruzar el hueco vacío de una tarjeta
  ya no se la lleva"* y *"morder el borde de un botón le abre un hueco y
  conserva el resto"*. Sólo pueden vivir en e2e: sin canvas no hay trama, y el
  arnés vm cae por diseño al borrado íntegro. Verificadas fallando las tres al
  quitar la rama `deps.rasterErase`.

## Auditoría severa v2.35.0

Tres auditores en paralelo (borrador v2.33-34, Tinta v2.32, transversal) con
repro obligatoria. Cinco defectos confirmados, cinco corregidos; cada guarda
verificada fallando contra su mutación.

### Un roce sin tinta convertía el componente tras cambiar la letra del lienzo

- **Síntoma:** con un `nav` (o texto, botón…) en el lienzo, rozar con el
  borrador una zona SIN tinta lo dejaba intacto; tras cambiar la letra del
  lienzo, el MISMO roce lo sustituía por una imagen — perdía su editabilidad
  de componente sin ningún mordisco visible, en silencio.
- **Causa:** el recuento de «tinta previa» de `rasterErase` se memorizaba en
  un WeakMap que decía ser «mientras dura el arrastre» pero no se vaciaba
  jamás. Con otra letra el render cuenta distinto, `queda.n !== antesN` y el
  elemento se sustituía aunque el trazo no hubiera quitado un píxel.
- **Fix:** `src/js/app.js` — la caché desapareció de raíz: el commit corre una
  vez por pasada y calcula «antes» y «después» frescos; la previsualización ya
  no cuenta píxeles (ver el siguiente). Todo el estado entre fotogramas vive
  en `eraserSession`, que nace en el primer fotograma y muere al soltar.
- **Guardia:** `e2e/eraser.spec.js` › *"cambiar la letra del lienzo no hace
  que un roce sin tinta convierta el componente"* (la repro exacta).

### La previsualización del borrador recalculaba TODO por fotograma

- **Síntoma:** arrastrando el borrador por una escena de una docena de formas,
  la previsualización iba a saltos: 95–186 ms por fotograma (presupuesto: 16),
  y creciendo con la longitud del trazo.
- **Causa:** cada `redrawNow` pasaba el trazo entero a `Eraser.erase`, que
  reclasificaba todas las muestras de todos los elementos contra todos los
  tramos — O(muestras × tramos) × fotogramas —, y el recorte por trama pagaba
  además un `getImageData` completo por elemento y fotograma.
- **Fix:** `src/js/eraser.js` + `src/js/app.js` — memos por pasada
  (`deps.session`): el trazo solo crece y un punto borrado no des-borra, así
  que cada fotograma clasifica solo contra los tramos NUEVOS; `touches` prueba
  solo la cola nueva; un descarte por caja del trazo salta los elementos
  lejanos; y la previsualización por trama perfora incrementalmente un canvas
  vivo por elemento, sin recuentos ni `toDataURL`. Medido: 15,8 → 0,4 ms por
  fotograma (el arrastre de 40 fotogramas cuesta ahora lo que costaba UNO).
- **Guardia:** *"la previsualización incremental (session) da EXACTAMENTE lo
  mismo que el recorte completo"* y *"el descarte por caja no roba alcance"*
  (`tests/eraser.test.js`) — la equivalencia es la corrección; el número es
  consecuencia.

### Morder una foto la convertía en un PNG ×5-7 y mataba el autosave sin avisar

- **Síntoma:** un mordisco de esquina a una foto JPEG de ~350 KB la
  re-serializaba como PNG de ~2,4 MB; con dos fotos, `localStorage` superaba
  su cuota, `setItem` lanzaba, el `catch` mudo lo tragaba y TODO lo dibujado
  después se perdía al recargar — con la app diciendo que todo iba bien.
- **Causa:** `toDataURL('image/png')` incondicional (PNG sin pérdida sobre
  contenido fotográfico se dispara) + `catch (_)` sin señal en
  `saveAutosaveNow`.
- **Fix:** `src/js/app.js` — una foto (src JPEG/WebP) mordida se re-serializa
  como **WebP con pérdida** (conserva el alfa del hueco; el dibujo de línea
  sigue en PNG, donde es más pequeño y nítido), con caída a PNG si el
  navegador no lo soporta; `IMAGE_SRC` (exporter.js) admite
  `data:image/webp`. Y el fallo de cuota ya no es mudo: `#autosave-warn` en la
  topbar se enciende mientras el guardado no quepa y se apaga solo al volver a
  caber.
- **Guardia:** `e2e/eraser.spec.js` › *"morder una FOTO la re-serializa como
  WebP…"* y *"cuando el autoguardado no cabe, la topbar lo AVISA…"*, más el
  WebP en la validación de import (`tests/exporter.test.js`).

### El aerógrafo con área podía partirse en trozos invisibles

- **Síntoma:** con un área armada que enseña solo un tramo del eje, borrar por
  la zona visible dejaba trozos cuyas gotas caían TODAS fuera del área:
  invisibles, pero contando en «Elementos», viajando en el JSON y con un marco
  de selección sobre lienzo vacío — justo lo que `onMouseUp` impide al crear.
- **Causa:** `_splitAirbrush` no filtraba trozos vacíos (no podía: `isEmpty`
  necesita regenerar la nube y vive fuera del módulo puro).
- **Fix:** `src/js/eraser.js` + `src/js/app.js` — `eraserDeps` inyecta
  `deps.isEmpty` (Airbrush.isEmpty) y el split filtra las piezas invisibles;
  sin la dependencia (arnés vm) se comporta como antes.
- **Guardia:** `tests/eraser.test.js` › *"el aerógrafo con área no deja trozos
  invisibles al partirse"*, verificada fallando sin el filtro.

### «Sustituir un color» distinguía #FF0000 de #ff0000

- **Síntoma:** tras importar un JSON con colores en mayúsculas (la validación
  los acepta: `HEX_COLOR` es case-insensitive), el desplegable de la Tinta
  listaba el mismo color dos veces y «Sustituir un color» cambiaba solo los
  elementos que coincidían byte a byte.
- **Causa:** `hex6` (app.js) recortaba a 7 caracteres sin normalizar la caja,
  y tanto el agrupado de `inkSceneColors` como la comparación del botón usaban
  esa clave.
- **Fix:** `src/js/app.js` — `hex6` normaliza a minúsculas; todo lo que la app
  genera ya era minúscula, así que solo cambia el trato a lo importado.
- **Guardia:** `tests/app-interaction.test.js` › *"«Sustituir un color» no
  distingue mayúsculas"*, verificada fallando sin el `toLowerCase`.

## Auditoría severa v2.39.1

Tres auditores en paralelo (freehand v2.37, guías/orden Z v2.38-39,
transversal) con repro obligatoria, más una pasada propia. Siete defectos
confirmados con sonda ejecutada, siete corregidos.

### Alt a mitad de arrastre hacía saltar la selección hacia atrás al soltarlo

- **Síntoma:** arrastrando con Mover, pulsar Alt (el acelerador documentado
  para suspender el imán) y soltarlo a media pasada hacía que la selección
  retrocediera de golpe exactamente lo recorrido con Alt pulsado.
- **Causa:** `alignAdjust` retornaba en la guarda `!alignGuides || altKey`
  ANTES de acumular `free`, la posición libre del gesto. Los fotogramas con
  Alt movían con el delta crudo pero `free` no avanzaba; al soltar Alt la
  corrección se calculaba contra un `free` desfasado.
- **Fix:** `src/js/app.js` — `free` acumula siempre que hay sesión, también
  con Alt; los fotogramas suspendidos devuelven la posición libre.
- **Guardia:** `tests/app-interaction.test.js` › *"Alt a mitad de arrastre
  suspende el imán sin que el objeto salte atrás al soltarlo"* (sonda del
  auditor, verificada fallando contra el código previo).

### Imán en un solo eje + snapGrid: el otro eje sin imán Y sin cuadrícula

- **Síntoma:** con «Ajustar a cuadrícula» activo, si la guía imantaba solo la
  X, la Y se soltaba en un valor libre — ni alineada ni en la rejilla.
- **Causa:** `alignSession.snapped` era un booleano único y el mouseup
  saltaba el re-snap de cuadrícula ENTERO cuando el imán había pegado
  cualquier eje.
- **Fix:** `src/js/app.js` — `snappedX`/`snappedY` por separado; el mouseup
  omite la rejilla solo en el eje donde ganó la guía.
- **Guardia:** `tests/app-interaction.test.js` › *"imán solo en X con
  snapGrid: la Y libre sí vuelve a la cuadrícula al soltar"*.

### El imán pegaba a la posición fantasma de una flecha anclada

- **Síntoma:** arrastrando un elemento con una flecha anclada a él, la guía
  aparecía —y la selección se imantaba— sobre una coordenada vacía: la caja
  que la flecha tenía ANTES de empezar el gesto.
- **Causa:** los candidatos se congelan al primer fotograma («lo no
  seleccionado no cambia durante el arrastre»), pero una flecha anclada a lo
  arrastrado sí cambia: `resolveAnchors` la mueve en cada repintado. En la
  práctica es parte de lo que se mueve y no debía ser candidata.
- **Fix:** `src/js/app.js` — al construir los candidatos se excluyen los
  elementos cuyo `startAnchor`/`endAnchor` apunte al `id` de algo
  seleccionado, con el mismo criterio con que se excluye la selección.
- **Guardia:** `tests/app-interaction.test.js` › *"el imán ignora la posición
  vieja de una flecha anclada que viaja con la selección"*.

### El borrador partía un lápiz con presión donde no había tinta visible

- **Síntoma:** con un trazo `taper` dibujado rápido (tinta real de ~1,4 px de
  semiancho con grosor nominal 8), una pasada del borrador a 10 px de la
  tinta —sin tocarla— lo partía en dos, con paso de undo y re-afilado
  visible de los fragmentos. La inversa exacta de la franja que corrigió la
  v2.2.0, y una violación de la regla del borrador («lo que se ve, no la
  caja»).
- **Causa:** `_splitPencil` clasificaba con el margen nominal
  `r + lineWidth/2`, pero con presión simulada el semiancho real baja hasta
  `MIN_W` (35 %) en los tramos rápidos y al 10 % en las puntas.
- **Fix:** `src/js/eraser.js` + `src/js/freehand.js` — `Freehand.halfWidths`
  expone el semiancho visible por punto crudo y `_survivingRuns` acepta un
  margen por muestra (array además de escalar); el corte interpolado usa la
  media de sus dos extremos. Sin `Freehand` cargado (arnés suelto) se
  conserva el margen nominal.
- **Guardia:** `tests/eraser.test.js` › *"el borrador no parte un lápiz con
  presión donde solo hay grosor nominal, no tinta"* y
  `tests/freehand.test.js` › *"halfWidths es paralelo a los puntos…"*.

### La envolvente del lápiz con presión rompía su cota con puntos dispersos

- **Síntoma:** un `pencil` importado con puntos espaciados (válido:
  `isValidElement` no exige densidad) dibujaba tinta a ~9 px del eje contra
  el que miden bounds, hit-test y el alcance del borrador, rompiendo la cota
  documentada («el semiancho máximo es lineWidth/2»).
- **Causa:** el retraso del streamline es proporcional a la separación entre
  puntos: en una esquina de segmentos largos el eje suavizado se aleja
  ~0,43 · longitud del segmento del eje crudo.
- **Fix:** `src/js/freehand.js` — `LAG_MAX` (2 px, el paso de decimación del
  lápiz) acota el retraso; con los gestos de la app (≤ 2 px entre puntos) no
  cambia nada.
- **Guardia:** `tests/freehand.test.js` › *"el suavizado no aleja la tinta
  del eje crudo más que un tope fijo"*.

### Escalar un grupo vegetal no escalaba su `gardenMeta` y regenerar lo encogía

- **Síntoma:** agrandar una planta (handle de grupo o Ancho/Alto de
  «Posición y tamaño») y luego «Editar planta» —cambiar especie, vista o
  etapa— la devolvía en silencio a su tamaño de dibujo original.
- **Causa:** doble. `scaleElement` no mapeaba `gardenMeta.p1/p2` (al
  contrario que `moveElement`, que sí los desplaza); y además las piezas
  encadenadas (`curveArrow`, la mayoría de un árbol) salían por
  `CurvePath.scale` con un return temprano que se saltaba TODOS los bloques
  de meta — también `solidMeta.gesture`, el mismo escape latente.
- **Fix:** `src/js/app.js` — `scaleElement` unifica la salida en `m` (cadena
  o no) y aplica después los bloques de `solidMeta`/`gardenMeta`; los puntos
  de inserción escalan con los mismos `mapX`/`mapY` que la pieza.
- **Guardia:** `tests/app-interaction.test.js` › *"escalar un grupo vegetal
  escala también su gardenMeta, y regenerar no lo encoge"* (sonda del
  auditor: fallaba con meta ×1,0 frente a dibujo ×1,6).

### `.panel__zorder[hidden]` existía sin guarda (y el CHANGELOG sin 2.37-2.39)

- **Síntoma:** ninguno en runtime — deuda de guarda y de documentación.
  Borrar la regla `[hidden]` del SCSS habría dejado los cuatro botones de
  orden Z visibles sin selección y ningún test lo habría visto; y el
  CHANGELOG se quedó sin las entradas 2.37.0–2.39.0 (tres versiones
  publicadas solo en git).
- **Causa:** la lista de reglas `[hidden]` de `tests/smoke.test.js` no se
  actualizó al añadir la rejilla en v2.39.0; los tres commits de features
  actualizaron `package.json` pero no el CHANGELOG.
- **Fix:** `tests/smoke.test.js` suma `\.panel__zorder\[hidden\]` al bucle;
  `CHANGELOG.md` repone 2.37.0, 2.38.0 y 2.39.0. La lista de scripts de
  CLAUDE.md suma `freehand` y `flood`, que faltaban.
- **Guardia:** la propia regla del bucle de smoke.

### La Decoración del Jardín se dibujaba en verde follaje

- **Síntoma:** todos los elementos de Decoración —banco, pozo, maceta,
  piedra, estanque, piscina, y también la flecha de norte y la escala
  gráfica— salían en verde en vez de en la tinta del trazo. Reportado por el
  usuario tras la v2.41.0.
- **Causa:** `_plantInk` (garden.js) aplica el follaje de la especie cuando el
  modo de color es «natural», con `spec.foliage || '#4f7248'` de reserva. Para
  la Decoración `_spec` SÍ devuelve una entrada —está en el catálogo— pero sin
  `foliage`, así que caía en ese verde de reserva. El mando es botánico y vive
  en los modales de planta; la decoración es mobiliario y símbolos de plano,
  no vegetación.
- **Fix:** `src/js/garden.js` — `elements()` no aplica `_plantInk` cuando la
  herramienta es `GARDEN_DECOR`. Las plantas conservan su verde.
- **Guardia:** `tests/garden.test.js` › *"la Decoración se dibuja con la tinta
  del trazo, nunca de verde"*, verificada fallando al restaurar la línea
  anterior. Comprueba las doce variantes en los dos modos de color, y que el
  modo natural siga tiñendo un árbol.
- **Pendiente relacionado:** Parcela y Camino comparten el mismo tinte de
  reserva por la misma vía. Se dejan como estaban a la espera de decidir qué
  debe pasar con el césped de la parcela, que sí es vegetación.

### La escalerilla de la piscina se leía como una «H»

- **Síntoma:** la escalerilla de la piscina (v2.41.0) parecía una «H» flotando
  dentro del vaso, no una escalera.
- **Causa:** sus largueros iban paralelos al borde en el que se ancla, en vez
  de perpendiculares a él.
- **Fix:** `src/js/garden.js` — `_poolTool` ancla la escalerilla al borde
  izquierdo del vaso con los largueros perpendiculares, y el agua arranca
  después de ella para no cruzarla.
- **Guardia:** las tres aserciones de *"la piscina lleva andén, vaso, agua y
  escalerilla"* siguen valiendo (el multiset de piezas no cambió); el defecto
  era de lectura visual y se detectó en la pasada por Chrome, que es donde se
  juzgan estas cosas.

### «Importar» no decía qué importaba ni que sustituía el dibujo

- **Síntoma:** el usuario preguntó directamente qué hacía el botón. Decía solo
  «Importar», y ni el rótulo ni la interfaz explicaban que abre un `.json` de
  los que produce Exportar → JSON —el único de los cinco formatos que se
  puede volver a cargar— ni que **sustituye** el lienzo en lugar de fusionar.
  Tampoco avisaba antes de llevarse por delante el dibujo en curso.
- **Causa:** el nombre describía una categoría genérica, no la acción. El
  formato solo aparecía en el `title` (visible al pasar el ratón) y en la
  letra pequeña del modal de exportación.
- **Fix:** `index.html` + `src/js/app.js` (v2.42.0) — el botón pasa a «Abrir
  proyecto», su ayuda emergente nombra el `.json` y avisa del reemplazo, y con
  el lienzo ocupado se pide confirmación diciendo cuántos elementos se
  sustituyen. La Ayuda estrena el ciclo guardar/recuperar y recuerda que una
  imagen se pega con `Ctrl+V`.
- **Guardia:** `tests/app-interaction.test.js` › *"abrir un proyecto sustituye
  el lienzo, y con dibujo dentro pregunta antes"* (vacío no pregunta, el «no»
  no toca nada, el «sí» sustituye y `Ctrl+Z` lo deshace), verificada fallando
  sin el aviso; y en `tests/smoke.test.js`, que el rótulo y el `title` digan
  formato y reemplazo — el arnés vm no ve textos ni tooltips.

### La barra superior desbordaba en pantallas medianas y pequeñas

- **Síntoma:** por debajo de unos 1040 px de ancho, los botones de la barra no
  cabían y «Exportar» quedaba fuera de la pantalla, sin scroll que lo
  alcanzara. Medido: 138 px de exceso a 900 px de ventana. Defecto viejo, no
  de la v2.42.0 (renombrar el botón solo añadía 3 px).
- **Causa:** siete botones con rótulo, y el de «Panel» aparece justo al pasar
  el panel a cajón (1100 px), que es cuando menos sitio hay. Nada reducía la
  barra al estrecharse.
- **Fix:** `src/scss/abstracts/_breakpoints.scss` + `components/_topbar.scss`
  (v2.42.1) — nuevo breakpoint `$topbar-icons` (1060 px): por debajo, los
  botones se quedan en **icono**. No se oculta ningún botón, solo su rótulo, y
  se oculta a la vista pero no a un lector de pantalla, así que cada uno
  conserva su nombre; todos tienen `title` para el usuario vidente.
- **Guardia:** `e2e/responsive.spec.js` › *"la barra superior se queda en
  iconos antes de desbordar"* (mide el exceso y la posición de «Exportar» a
  1200/1060/900/700 px), y en `tests/smoke.test.js` que **todo** botón de la
  barra envuelva su rótulo en `.btn__label` y tenga `title`: uno nuevo con el
  texto suelto no tendría nada que ocultar y reabriría el desborde.

### Un rótulo recortado en `position: absolute` estiraba el scroll del móvil

- **Síntoma:** al ocultar los rótulos de la barra con la técnica clásica de
  «visually hidden» (`position: absolute` + recorte), la página pasó a
  desbordar horizontalmente a 320 px: `scrollWidth` 531 sobre 320 de ancho.
  Regresión introducida y detectada dentro de la misma pasada, por el spec de
  320 px que ya existía.
- **Causa:** un descendiente **absoluto escapa del `overflow: hidden`** del
  ancestro que recorta la barra, porque ese ancestro no está posicionado. Los
  rótulos, aun midiendo un píxel, quedaban colocados lejos a la derecha y
  estiraban el área desplazable. El texto suelto de antes, al ir en flujo, sí
  se recortaba: por eso la barra podía desbordar 834 px sin que la página
  hiciera scroll.
- **Fix:** `src/scss/components/_topbar.scss` — el rótulo se recorta **en
  flujo** (`display: inline-block`, un píxel de ancho, `overflow: hidden` y
  `clip-path`), nunca en absolute.
- **Guardia:** el spec de 320 px que la detectó (*"a 320px de ancho los
  modales caben sin desborde horizontal"*), más una aserción en
  `tests/smoke.test.js` que rechaza `position: absolute` en esa regla del CSS
  compilado, con el motivo escrito al lado.

### Dos medidas desviadas de sus escalas: un radio de 0.7rem y un foco de 0.15rem

- **Síntoma:** (v3.3.1, tokenización de estilos) la ficha de dimensiones
  botánicas llevaba `border-radius: 0.7rem` —la escala de radios del proyecto
  es 0.4/0.6/0.8/1/1.6— y el anillo de la herramienta activa del sidebar,
  `outline: 0.15rem` frente al `0.2rem` estándar del foco. Invisibles a simple
  vista (1px cada una), pero cualquier retoque futuro que «igualara» valores a
  ojo podía caer en cualquiera de los dos lados.
- **Causa:** valores escritos a mano en momentos distintos, sin una fuente
  única que los nombrara. Es el defecto que la tokenización de v3.3.1 elimina:
  toda medida repetida o con significado vive ahora en
  `src/scss/abstracts/_variables.scss` (radios, sombras, tintes de marca,
  z-index, `$ease-slow`, `$modal-pad`…), y estas dos eran las únicas cuyo
  arreglo cambiaba píxeles reales (el resto del refactor dejó el CSS compilado
  byte a byte idéntico).
- **Fix:** `_modal.scss` (`.modal__plant-dimensions` → `v.$radius-lg`) y
  `_sidebar.scss` (`.sidebar__tool--active` → `v.$focus-ring-w`), con el OK
  explícito del usuario por cambiar píxeles.
- **Guardia:** `tests/smoke.test.js` › *"las escalas tokenizadas no tienen
  desviaciones en el CSS compilado"* — rechaza `border-radius: 0.7rem` y
  `outline: 0.15rem` en el artefacto, los dos valores exactos que convivieron
  con sus escalas.
