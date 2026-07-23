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

### El borrador corrompía PNG/JPG (agujero transparente / mancha negra)
- **Síntoma:** exportar a PNG dejaba agujeros transparentes donde se había
  borrado; en JPG salían manchas negras (la transparencia se compone sobre
  negro en `toDataURL('image/jpeg')`).
- **Causa:** el trazo de borrador usa `globalCompositeOperation:
  'destination-out'`, que perfora también el fondo blanco ya pintado.
- **Fix:** `js/exporter.js` (`_renderClean`) repinta blanco en una segunda
  pasada con `destination-over` después de renderizar los elementos.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.png: repinta fondo
  blanco con destination-over tras renderizar (eraser)"*.

### El borrador no existía en los exports SVG/HTML (lo borrado reaparecía)
- **Síntoma:** un trazo borrado con el borrador volvía a aparecer en el SVG
  y el HTML exportados, porque no había `case 'eraser'`.
- **Fix:** `js/exporter.js` emite el trazo de eraser como un `<path>` blanco
  con `stroke-width = lineWidth * 4`.
- **Guardia:** `tests/exporter.test.js` › *"Exporter.svg: eraser se
  aproxima con trazo blanco de lineWidth*4"*.

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
